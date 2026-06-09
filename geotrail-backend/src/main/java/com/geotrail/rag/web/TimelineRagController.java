package com.geotrail.rag.web;

import com.geotrail.rag.service.NarrativeService;
import com.geotrail.rag.service.TimelineEmbeddingService;
import com.geotrail.rag.service.TimelineQueryService;

import com.geotrail.auth.entity.User;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Thin REST layer for the RAG feature. All business logic lives in the services.
 * Routes resolve under the {@code /api} context path, i.e. {@code POST /api/rag/query}
 * and {@code POST /api/rag/embed}.
 */
@RestController
@RequestMapping("/rag")
public class TimelineRagController {

    private final TimelineQueryService queryService;
    private final TimelineEmbeddingService embeddingService;
    private final NarrativeService narrativeService;

    public TimelineRagController(TimelineQueryService queryService,
                                 TimelineEmbeddingService embeddingService,
                                 NarrativeService narrativeService) {
        this.queryService = queryService;
        this.embeddingService = embeddingService;
        this.narrativeService = narrativeService;
    }

    @PostMapping("/query")
    public QueryResponse query(@AuthenticationPrincipal User user,
                               @RequestBody QueryRequest request) {
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
     * Narrate a window of the user's timeline ("You started at home, took a taxi to…").
     * Grounded directly in the stored segments, so it works without prior embedding.
     */
    @PostMapping("/narrative")
    public NarrativeResponse narrative(@AuthenticationPrincipal User user,
                                       @RequestBody NarrativeRequest request) {
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
