package com.geotrail.rag.service;

import com.geotrail.rag.domain.Pending;
import com.geotrail.rag.domain.SegmentType;
import com.geotrail.rag.embedding.EmbeddingProvider;
import com.geotrail.rag.repository.TimelineEmbeddingRepository;
import com.geotrail.rag.repository.TimelineSourceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

/**
 * Reads a user's visits and activities, turns each into a summary sentence, embeds it,
 * and stores the result in {@code timeline_embeddings}. Idempotent: rows already embedded
 * are skipped, so this can be re-run safely (e.g. after new timeline imports).
 */
@Service
public class TimelineEmbeddingService {

    private static final Logger log = LoggerFactory.getLogger(TimelineEmbeddingService.class);

    private static final int PROGRESS_LOG_EVERY = 100;

    private final TimelineSourceRepository sourceRepository;
    private final TimelineEmbeddingRepository repository;
    private final TimelineSummaryGenerator summaryGenerator;
    private final EmbeddingProvider embeddingProvider;

    public TimelineEmbeddingService(TimelineSourceRepository sourceRepository,
                                    TimelineEmbeddingRepository repository,
                                    TimelineSummaryGenerator summaryGenerator,
                                    EmbeddingProvider embeddingProvider) {
        this.sourceRepository = sourceRepository;
        this.repository = repository;
        this.summaryGenerator = summaryGenerator;
        this.embeddingProvider = embeddingProvider;
    }

    public EmbeddingReport embedAllSegments(Long userId) {
        return embed(userId, null, false);
    }

    public EmbeddingReport embedSegmentsSince(Long userId, LocalDate since) {
        return embed(userId, since, false);
    }

    /**
     * Fire-and-forget version of {@link #embed} for the REST layer. A throttled backfill
     * (e.g. Gemini at 90/min) can run for many minutes, so we run it on a background virtual thread
     * and return immediately rather than holding the HTTP request open. Invoked cross-bean from the
     * controller so Spring's @Async proxy applies; the result is logged, not returned.
     *
     * @param force when true, delete the user's existing embeddings first (full re-index)
     */
    @Async
    public void embedAsync(Long userId, LocalDate since, boolean force) {
        try {
            EmbeddingReport report = embed(userId, since, force);
            log.info("Async embedding run finished for user {}: {}", userId, report);
        } catch (Exception e) {
            log.error("Async embedding run failed for user {}", userId, e);
        }
    }

    /**
     * Streaming variant for the SSE endpoint: runs the embedding on a background virtual thread
     * and pushes {@code started}/{@code progress}/{@code complete} events to the client over the
     * supplied emitter, so the frontend can show live progress and react the moment indexing for
     * the requested date range finishes. Errors are pushed to the client as a terminal stream error.
     */
    @Async
    public void embedToEmitter(Long userId, LocalDate since, boolean force, SseEmitter emitter) {
        try {
            EmbeddingReport report = embed(userId, since, force,
                    event -> sendEvent(emitter, userId, event));
            sendEvent(emitter, userId, new EmbedEvent("complete", report.processed(), report.skipped(),
                    report.failed(), report.processed() + report.skipped() + report.failed(),
                    since, report.elapsed().toSeconds()));
            emitter.complete();
        } catch (Exception e) {
            log.error("SSE embedding run failed for user {}", userId, e);
            try {
                emitter.completeWithError(e);
            } catch (Exception ignored) {
                // emitter already torn down (e.g. client disconnected) — nothing more to do
            }
        }
    }

    /** Pushes a single SSE event, swallowing send failures (typically a disconnected client). */
    private void sendEvent(SseEmitter emitter, Long userId, EmbedEvent event) {
        try {
            emitter.send(SseEmitter.event().name(event.phase()).data(event));
        } catch (IOException | IllegalStateException e) {
            log.debug("SSE send failed for user {} (client gone?): {}", userId, e.toString());
        }
    }

    /**
     * Re-indexes from scratch: deletes the user's existing embeddings first, so every
     * segment's summary is regenerated (e.g. to pick up newly geocoded area names).
     */
    public EmbeddingReport reindexAllSegments(Long userId) {
        return embed(userId, null, true);
    }

    private EmbeddingReport embed(Long userId, LocalDate since, boolean force) {
        return embed(userId, since, force, event -> { });
    }

    private EmbeddingReport embed(Long userId, LocalDate since, boolean force, Consumer<EmbedEvent> listener) {
        Instant started = Instant.now();
        if (force) {
            int deleted = repository.deleteAllForUser(userId);
            log.info("Force re-index: deleted {} existing embeddings for user {}", deleted, userId);
        }
        List<Pending> pending = new ArrayList<>();
        pending.addAll(loadVisits(userId, since));
        pending.addAll(loadActivities(userId, since));

        int total = pending.size();
        int processed = 0;
        int skipped = 0;
        int failed = 0;

        listener.accept(new EmbedEvent("started", 0, 0, 0, total, since, 0));

        // Pace the loop to the active provider's rate limit. The embedding call is the only
        // throttled work here, so we sleep this long after each *attempted* embed (skipped rows
        // make no API call and are not paced). 0 = local provider, no throttle.
        long intervalMs = embeddingProvider.minIntervalMillis();
        if (intervalMs > 0) {
            log.info("Throttling embeddings to ~{} req/min ({} ms between calls) for user {}",
                    Math.round(60_000.0 / intervalMs), intervalMs, userId);
        }

        for (int i = 0; i < pending.size(); i++) {
            Pending p = pending.get(i);
//            if (repository.exists(userId, p.segmentType().name(), p.segmentId())) {
//                skipped++;
//                continue;
//            }
            try {
                float[] vector = embeddingProvider.embed(p.summary());
                int num = repository.insert(userId, p.segmentType().name(), p.segmentId(), p.summary(),
                        vector, p.segmentDate(), p.startTime(), p.endTime());
                processed++;
                System.out.println("Inserted " + num + " rows for " + p.segmentType() + " #" + p.segmentId());
            } catch (Exception e) {
                // Per-row isolation: never let one bad row fail the whole batch.
                failed++;
                log.warn("Failed to embed {} #{}: {}", p.segmentType(), p.segmentId(), e.toString());
            } finally {
                // Throttle every attempted API call, success or failure, to respect the quota.
                sleep(intervalMs);
            }

            if ((i + 1) % PROGRESS_LOG_EVERY == 0) {
                log.info("Embedded {}/{} segments...", i + 1, total);
                long elapsed = Duration.between(started, Instant.now()).toSeconds();
                listener.accept(new EmbedEvent("progress", processed, skipped, failed, total, since, elapsed));
            }
        }

        EmbeddingReport report = new EmbeddingReport(processed, skipped, failed,
                Duration.between(started, Instant.now()));
        log.info("Embedding run complete for user {}: {}", userId, report);
        return report;
    }

    private List<Pending> loadVisits(Long userId, LocalDate since) {
        return sourceRepository.loadVisits(userId, since, (rs, n) -> {
            long id = rs.getLong("id");
            Instant start = rs.getTimestamp("started_at").toInstant();
            Timestamp endTs = rs.getTimestamp("ended_at");
            Instant end = endTs != null ? endTs.toInstant() : start;
            BigDecimal lat = rs.getBigDecimal("lat");
            BigDecimal lng = rs.getBigDecimal("lng");
            String summary = summaryGenerator.generateVisitSummary(
                    rs.getString("semantic_type"), start, end, lat, lng);
            return new Pending(SegmentType.VISIT, id, summary, dateOf(start), start, end);
        });
    }

    private List<Pending> loadActivities(Long userId, LocalDate since) {
        return sourceRepository.loadActivities(userId, since, (rs, n) -> {
            long id = rs.getLong("id");
            Instant start = rs.getTimestamp("start_time").toInstant();
            Timestamp endTs = rs.getTimestamp("end_time");
            Instant end = endTs != null ? endTs.toInstant() : start;
            Double distance = rs.getObject("distance_meters") != null
                    ? rs.getDouble("distance_meters") : null;
            String summary = summaryGenerator.generateActivitySummary(
                    rs.getString("activity_type"), start, end,
                    rs.getBigDecimal("start_lat"), rs.getBigDecimal("start_lng"),
                    rs.getBigDecimal("end_lat"), rs.getBigDecimal("end_lng"), distance);
            return new Pending(SegmentType.ACTIVITY, id, summary, dateOf(start), start, end);
        });
    }

    private static LocalDate dateOf(Instant instant) {
        return instant.atZone(ZoneOffset.UTC).toLocalDate();
    }

    private void sleep(long ms) {
        if (ms <= 0) {
            return;
        }
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    public record EmbeddingReport(int processed, int skipped, int failed, Duration elapsed) {
    }

    /**
     * One progress notification streamed to the client over SSE.
     *
     * @param phase          {@code started}, {@code progress}, or {@code complete}
     * @param processed      segments embedded so far (or in total, on completion)
     * @param skipped        segments skipped (already embedded)
     * @param failed         segments that failed to embed
     * @param total          total segments to process for this run
     * @param since          the requested start date (null = full history); echoed back so the
     *                       frontend can correlate the notification with the date it asked for
     * @param elapsedSeconds wall-clock seconds since the run started
     */
    public record EmbedEvent(String phase, int processed, int skipped, int failed, int total,
                             LocalDate since, long elapsedSeconds) {
    }
}
