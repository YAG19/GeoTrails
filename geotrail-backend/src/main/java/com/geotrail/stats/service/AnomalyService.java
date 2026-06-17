package com.geotrail.stats.service;

import com.geotrail.stats.dto.AnomalyDto;
import com.geotrail.timeline.dto.TimelineDtos.SegmentDto;
import com.geotrail.timeline.service.TimelineService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Flags notable days/trips from the user's timeline using simple, deterministic
 * statistics (no LLM) over the travel segments in a window: unusually long single
 * trips, late-night movement, and unusually busy days. Cheap enough to run on
 * every dashboard load.
 *
 * <p>Hour-of-day and day bucketing use the configured display zone, not UTC —
 * otherwise a 09:00 IST commute lands in the 03:30 UTC bucket and gets flagged
 * as late-night movement.
 */
@Service
public class AnomalyService {

    /** A trip must clear both the statistical bar and this floor to count as "long". */
    private static final double LONG_TRIP_FLOOR_M = 30_000;   // 30 km
    private static final int MAX_RESULTS = 12;

    private final TimelineService timelineService;
    private final ZoneId zone;

    public AnomalyService(TimelineService timelineService,
                          @Value("${geotrail.rag.display-zone:Asia/Kolkata}") String displayZone) {
        this.timelineService = timelineService;
        this.zone = ZoneId.of(displayZone);
    }

    public List<AnomalyDto> detect(Long userId, Instant from, Instant to) {
        List<SegmentDto> segments = timelineService.getSegments(userId, from, to);

        List<SegmentDto> activities = segments.stream()
                .filter(s -> "ACTIVITY".equals(s.kind()) && s.startTime() != null)
                .toList();
        if (activities.isEmpty()) return List.of();

        List<AnomalyDto> out = new ArrayList<>();
        out.addAll(longTrips(activities));
        out.addAll(lateNightTrips(activities));
        out.addAll(busyDays(activities));

        return out.stream()
                .sorted(Comparator.comparing(AnomalyDto::date).reversed())
                .limit(MAX_RESULTS)
                .toList();
    }

    private List<AnomalyDto> longTrips(List<SegmentDto> activities) {
        double[] dist = activities.stream()
                .map(SegmentDto::distanceMeters)
                .filter(d -> d != null)
                .mapToDouble(Double::doubleValue)
                .toArray();
        if (dist.length < 3) return List.of();

        double mean = mean(dist);
        double threshold = Math.max(LONG_TRIP_FLOOR_M, mean + 2 * std(dist, mean));

        List<AnomalyDto> out = new ArrayList<>();
        for (SegmentDto s : activities) {
            if (s.distanceMeters() != null && s.distanceMeters() >= threshold) {
                double km = s.distanceMeters() / 1000.0;
                out.add(new AnomalyDto(
                        date(s.startTime()), "LONG_TRIP",
                        "Long trip: %.0f km".formatted(km),
                        "A %.0f km %s trip — well above your usual.".formatted(km, mode(s)),
                        km > 200 ? "high" : "medium"));
            }
        }
        return out;
    }

    private List<AnomalyDto> lateNightTrips(List<SegmentDto> activities) {
        List<AnomalyDto> out = new ArrayList<>();
        for (SegmentDto s : activities) {
            int hour = s.startTime().atZone(zone).getHour();
            if (hour >= 0 && hour < 5) {
                out.add(new AnomalyDto(
                        date(s.startTime()), "LATE_NIGHT",
                        "Late-night movement",
                        "%s travel starting around %02d:00.".formatted(mode(s), hour),
                        "low"));
            }
        }
        return out;
    }

    private List<AnomalyDto> busyDays(List<SegmentDto> activities) {
        Map<String, Integer> perDay = new LinkedHashMap<>();
        for (SegmentDto s : activities) {
            perDay.merge(date(s.startTime()), 1, Integer::sum);
        }
        if (perDay.size() < 3) return List.of();

        double[] counts = perDay.values().stream().mapToDouble(Integer::doubleValue).toArray();
        double mean = mean(counts);
        double threshold = mean + 2 * std(counts, mean);

        List<AnomalyDto> out = new ArrayList<>();
        perDay.forEach((day, count) -> {
            if (count >= threshold && count >= 5) {
                out.add(new AnomalyDto(day, "BUSY_DAY",
                        "Busy day: %d trips".formatted(count),
                        "%d separate trips — one of your most active days.".formatted(count),
                        "medium"));
            }
        });
        return out;
    }

    // ==================== helpers ====================

    private static String mode(SegmentDto s) {
        if (s.type() == null) return "a";
        return s.type().replaceFirst("^IN_", "").replace('_', ' ').toLowerCase();
    }

    private String date(Instant t) {
        return t.atZone(zone).toLocalDate().toString();
    }

    private static double mean(double[] v) {
        double sum = 0;
        for (double x : v) sum += x;
        return sum / v.length;
    }

    private static double std(double[] v, double mean) {
        double sum = 0;
        for (double x : v) sum += (x - mean) * (x - mean);
        return Math.sqrt(sum / v.length);
    }
}
