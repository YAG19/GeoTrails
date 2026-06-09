package com.geotrail.rag.service;

import com.geotrail.rag.llm.LlmProvider;
import com.geotrail.timeline.dto.TimelineDtos.SegmentDto;
import com.geotrail.timeline.service.TimelineService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Turns a window of the user's ordered timeline segments into a human-readable
 * narrative ("You started at home, took a taxi to…") via the active
 * {@link LlmProvider}. Grounded strictly in the provided segments — no vector
 * recall, so it works without prior embedding.
 */
@Service
@RequiredArgsConstructor
public class NarrativeService {

    private static final int MAX_SEGMENTS = 80;

    private static final DateTimeFormatter TIME_FMT =
            DateTimeFormatter.ofPattern("EEE dd MMM HH:mm").withZone(ZoneOffset.UTC);

    private static final String SYSTEM_PROMPT = """
            You are a warm, concise personal-timeline narrator. You are given a
            chronological list of a person's visits and trips. Write a short
            second-person narrative ("You started the morning at home, then took a
            taxi to ...") that flows naturally and highlights notable places and
            transport modes. Keep it to one tight paragraph. Use ONLY the facts
            provided — never invent places, times, distances or modes. If the list is
            empty, say there is no recorded activity for this period.

            Timeline:
            %s
            """;

    private final TimelineService timelineService;
    private final LlmProvider llmProvider;

    public String narrate(Long userId, Instant from, Instant to) {
        List<SegmentDto> segments = timelineService.getSegments(userId, from, to);
        if (segments.isEmpty()) {
            return "There is no recorded activity for this period.";
        }
        if (segments.size() > MAX_SEGMENTS) {
            segments = segments.subList(0, MAX_SEGMENTS);
        }

        StringBuilder context = new StringBuilder();
        for (SegmentDto s : segments) {
            context.append("- ").append(describe(s)).append('\n');
        }

        String systemPrompt = SYSTEM_PROMPT.formatted(context.toString().trim());
        String userMessage = "Write the narrative for the timeline above.";
        return llmProvider.complete(systemPrompt, userMessage, null, null);
    }

    private String describe(SegmentDto s) {
        String when = s.startTime() != null ? TIME_FMT.format(s.startTime()) : "unknown time";
        if ("VISIT".equals(s.kind())) {
            String place = s.type() != null ? s.type() : "a place";
            String dur = s.durationMinutes() != null ? " for " + humanMinutes(s.durationMinutes()) : "";
            return "%s — stayed at %s%s".formatted(when, place, dur);
        }
        String mode = s.type() != null ? s.type() : "an unknown mode";
        String dist = s.distanceMeters() != null
                ? " (%.1f km)".formatted(s.distanceMeters() / 1000.0) : "";
        String dur = s.durationMinutes() != null ? ", " + humanMinutes(s.durationMinutes()) : "";
        return "%s — travelled by %s%s%s".formatted(when, mode, dist, dur);
    }

    private static String humanMinutes(int minutes) {
        if (minutes < 60) return minutes + " min";
        int h = minutes / 60, m = minutes % 60;
        return m == 0 ? h + " h" : h + " h " + m + " min";
    }
}
