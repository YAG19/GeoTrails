package com.geotrail.rag.web;

import com.geotrail.rag.service.NarrativeService;
import com.geotrail.rag.service.TimelineEmbeddingService;
import com.geotrail.rag.service.TimelineQueryService;

import com.geotrail.auth.entity.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Thin REST layer for the RAG feature. All business logic lives in the services.
 * Routes resolve under the {@code /api} context path, i.e. {@code POST /api/rag/query}
 * and {@code POST /api/rag/embed}.
 *
 * <p><b>Envelope exemption:</b> these endpoints intentionally return their own response records
 * (and an {@link SseEmitter} stream) rather than the app-wide {@code ApiResponse} envelope. The
 * streaming endpoint can't be wrapped, and the frontend RAG client consumes these raw shapes
 * directly — wrapping would buy nothing but break that contract.
 */
@RestController
@RequestMapping("/rag")
@RequiredArgsConstructor
public class TimelineRagController {

    private final TimelineQueryService queryService;
    private final TimelineEmbeddingService embeddingService;
    private final NarrativeService narrativeService;

    @PostMapping("/query")
    public QueryResponse query(@AuthenticationPrincipal User user,
                               @Valid @RequestBody QueryRequest request) {
        var result = queryService.query(user.getId(), request.question(), request.model(), request.temperature());
        return new QueryResponse(result.answer(), result.sourceSummaries());
    }

    /**
     * Kicks off embedding in the background and returns immediately with 202 Accepted. The run can
     * take many minutes when the active provider is rate-limited (e.g. Gemini), so we don't hold the
     * HTTP connection open — progress and the final report are written to the server logs.
     *
     * <p>{@code force=true} re-indexes from scratch (deletes existing vectors first); otherwise it's
     * an incremental backfill, optionally scoped to segments on/after {@code since}.
     */
    @PostMapping("/embed")
    public ResponseEntity<EmbedAccepted> embed(@AuthenticationPrincipal User user,
                                               @RequestBody(required = false) EmbedRequest request) {
        LocalDate since = request != null ? request.since() : null;
        boolean force = request != null && Boolean.TRUE.equals(request.force());
        embeddingService.embedAsync(user.getId(), since, force);
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(new EmbedAccepted("Embedding started in background; check server logs for progress."));
    }

    /**
     * Streaming counterpart to {@link #embed}: keeps the connection open and pushes Server-Sent
     * Events ({@code started}, {@code progress}, {@code complete}) as indexing runs, so the
     * frontend is notified the moment indexing for the requested date range finishes — instead of
     * having to poll or guess. Same request body as {@code /embed}.
     */
    @PostMapping("/embed/stream")
    public SseEmitter embedStream(@AuthenticationPrincipal User user,
                                  @RequestBody(required = false) EmbedRequest request) {
        LocalDate since = request != null ? request.since() : null;
        boolean force = request != null && Boolean.TRUE.equals(request.force());
        // Generous timeout: a throttled backfill (e.g. Gemini at 90/min) can run for many minutes.
        SseEmitter emitter = new SseEmitter(Duration.ofHours(1).toMillis());
        embeddingService.embedToEmitter(user.getId(), since, force, emitter);
        return emitter;
    }

    /**
     * Narrate a window of the user's timeline ("You started at home, took a taxi to…").
     * Grounded directly in the stored segments, so it works without prior embedding.
     */
    @PostMapping("/narrative")
    public NarrativeResponse narrative(@AuthenticationPrincipal User user,
                                       @Valid @RequestBody NarrativeRequest request) {
        String narrative = narrativeService.narrate(user.getId(), request.from(), request.to());
        return new NarrativeResponse(narrative);
    }

    public record QueryRequest(@NotBlank String question, String model, Double temperature) {
    }

    public record NarrativeRequest(@NotNull Instant from, @NotNull Instant to) {
    }

    public record NarrativeResponse(String narrative) {
    }

    public record QueryResponse(String answer, List<String> sources) {
    }

    public record EmbedRequest(LocalDate since, Boolean force) {
    }

    public record EmbedAccepted(String message) {
    }
}
