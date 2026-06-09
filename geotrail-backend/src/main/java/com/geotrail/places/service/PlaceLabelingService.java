package com.geotrail.places.service;

import com.geotrail.geocode.service.GeocodeService;
import com.geotrail.places.dto.LabelSuggestion;
import com.geotrail.places.repository.PlaceRepository;
import com.geotrail.rag.llm.LlmProvider;
import com.geotrail.trips.repository.VisitRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Proposes names/categories for frequently visited but unnamed locations.
 * Clusters the user's visits, drops clusters already covered by a saved place,
 * reverse-geocodes the rest, then asks the LLM for friendly labels. Falls back to
 * the geocoded area name if the LLM is unavailable, so it always returns something.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PlaceLabelingService {

    private static final int MIN_VISITS = 3;
    private static final int MAX_SUGGESTIONS = 6;

    private static final String SYSTEM_PROMPT = """
            You name people's frequently visited places from location data. You are given
            a numbered list of candidate places, each with a rough area/address, how many
            times it was visited, total time spent and any label Google inferred (HOME,
            WORK, etc.). For EACH candidate reply with exactly one line in the form:

            N. <Short friendly name> | <category>

            Category must be one of: home, work, gym, food, shopping, transit, leisure, other.
            Keep names short (e.g. "Home", "Office", "Corner Gym"). Do not add any other text.
            """;

    private final VisitRepository visitRepository;
    private final PlaceRepository placeRepository;
    private final GeocodeService geocodeService;
    private final LlmProvider llmProvider;

    public List<LabelSuggestion> suggest(Long userId) {
        // Pull extra clusters so we can skip ones already covered by a saved place.
        List<Object[]> clusters = visitRepository.findVisitClusters(userId, MIN_VISITS, MAX_SUGGESTIONS * 3);

        List<Candidate> candidates = new ArrayList<>();
        for (Object[] row : clusters) {
            if (candidates.size() >= MAX_SUGGESTIONS) break;
            BigDecimal lat = (BigDecimal) row[0];
            BigDecimal lng = (BigDecimal) row[1];
            if (lat == null || lng == null) continue;

            // Already labelled by the user? Skip.
            if (placeRepository.findNearestPlace(userId, lat.doubleValue(), lng.doubleValue()).isPresent()) {
                continue;
            }
            long visits = ((Number) row[2]).longValue();
            long minutes = ((Number) row[3]).longValue();
            String semanticType = row[4] != null ? row[4].toString() : null;
            String areaName = safeGeocode(lat, lng);

            candidates.add(new Candidate(lat.doubleValue(), lng.doubleValue(),
                    areaName, visits, minutes, semanticType));
        }

        if (candidates.isEmpty()) return List.of();

        String[] labels = askLlm(candidates);
        List<LabelSuggestion> out = new ArrayList<>(candidates.size());
        for (int i = 0; i < candidates.size(); i++) {
            Candidate c = candidates.get(i);
            String name = labels != null && i < labels.length && labels[i] != null
                    ? splitName(labels[i]) : fallbackName(c);
            String category = labels != null && i < labels.length && labels[i] != null
                    ? splitCategory(labels[i]) : fallbackCategory(c);
            out.add(new LabelSuggestion(c.lat, c.lng, name, category, c.areaName,
                    c.visits, c.minutes, reasoning(c)));
        }
        return out;
    }

    private String[] askLlm(List<Candidate> candidates) {
        try {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < candidates.size(); i++) {
                Candidate c = candidates.get(i);
                sb.append(i + 1).append(". ")
                        .append("area: ").append(c.areaName != null ? c.areaName : "unknown")
                        .append("; visits: ").append(c.visits)
                        .append("; time: ").append(c.minutes).append(" min")
                        .append("; google_label: ").append(c.semanticType != null ? c.semanticType : "none")
                        .append('\n');
            }
            String response = llmProvider.complete(SYSTEM_PROMPT, sb.toString(), null, null);
            if (response == null || response.isBlank()) return null;

            String[] lines = response.strip().split("\\r?\\n");
            String[] labels = new String[candidates.size()];
            for (String line : lines) {
                String trimmed = line.strip();
                int dot = trimmed.indexOf('.');
                if (dot <= 0) continue;
                try {
                    int idx = Integer.parseInt(trimmed.substring(0, dot).trim()) - 1;
                    if (idx >= 0 && idx < labels.length) {
                        labels[idx] = trimmed.substring(dot + 1).trim();
                    }
                } catch (NumberFormatException ignore) {
                    // line without a leading number — skip
                }
            }
            return labels;
        } catch (Exception e) {
            log.info("LLM labelling failed, falling back to geocoded names: {}", e.getMessage());
            return null;
        }
    }

    private String safeGeocode(BigDecimal lat, BigDecimal lng) {
        try {
            return geocodeService.resolveAreaName(lat, lng);
        } catch (Exception e) {
            return null;
        }
    }

    private static String splitName(String label) {
        int bar = label.indexOf('|');
        String name = bar >= 0 ? label.substring(0, bar).trim() : label.trim();
        return name.isBlank() ? "Frequent place" : name;
    }

    private static String splitCategory(String label) {
        int bar = label.indexOf('|');
        return bar >= 0 ? label.substring(bar + 1).trim().toLowerCase() : "other";
    }

    private static String fallbackName(Candidate c) {
        if ("HOME".equalsIgnoreCase(c.semanticType)) return "Home";
        if ("WORK".equalsIgnoreCase(c.semanticType)) return "Work";
        return c.areaName != null ? c.areaName : "Place near %.3f, %.3f".formatted(c.lat, c.lng);
    }

    private static String fallbackCategory(Candidate c) {
        if (c.semanticType == null) return "other";
        return switch (c.semanticType.toUpperCase()) {
            case "HOME" -> "home";
            case "WORK" -> "work";
            default -> "other";
        };
    }

    private static String reasoning(Candidate c) {
        return "%d visits, %d min total%s".formatted(
                c.visits, c.minutes,
                c.semanticType != null ? " · Google: " + c.semanticType : "");
    }

    private record Candidate(double lat, double lng, String areaName,
                             long visits, long minutes, String semanticType) {}
}
