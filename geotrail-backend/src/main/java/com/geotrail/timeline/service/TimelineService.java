package com.geotrail.timeline.service;

import com.geotrail.activity.entity.UserActivity;
import com.geotrail.activity.repository.UserActivityRepository;
import com.geotrail.timeline.dto.TimelineDtos.*;
import com.geotrail.timeline.entity.FrequentTrip;
import com.geotrail.timeline.entity.TimelinePath;
import com.geotrail.timeline.repository.FrequentTripRepository;
import com.geotrail.timeline.repository.TimelinePathRepository;
import com.geotrail.trips.entity.Visit;
import com.geotrail.trips.repository.VisitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Assembles the user's stored semantic data (visits, travel activities, GPS
 * breadcrumbs, commute patterns) into the shapes the UI needs: ordered day
 * timelines, animation paths, and aggregate insights. This is the shared read
 * layer that playback, the rail widgets and the AI features all build on.
 */
@Service
@RequiredArgsConstructor
public class TimelineService {

    private final VisitRepository visitRepository;
    private final UserActivityRepository activityRepository;
    private final TimelinePathRepository timelinePathRepository;
    private final FrequentTripRepository frequentTripRepository;

    // ==================== Ordered timelines ====================

    /** Ordered visits + activities for a single calendar day (UTC), plus the raw path. */
    public DayTimelineDto getDay(Long userId, LocalDate date) {
        Instant from = date.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant to = date.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        return DayTimelineDto.builder()
                .date(date.toString())
                .segments(getSegments(userId, from, to))
                .path(getPath(userId, from, to))
                .build();
    }

    /** Visits and activities in [from, to] merged into one chronological list. */
    public List<SegmentDto> getSegments(Long userId, Instant from, Instant to) {
        List<SegmentDto> segments = new ArrayList<>();
        for (Visit v : visitRepository.findByUserAndTimeRange(userId, from, to)) {
            segments.add(toVisitSegment(v));
        }
        for (UserActivity a : activityRepository.findByUserAndTimeRange(userId, from, to)) {
            segments.add(toActivitySegment(a));
        }
        segments.sort(Comparator.comparing(SegmentDto::startTime,
                Comparator.nullsLast(Comparator.naturalOrder())));
        return segments;
    }

    /** Ordered GPS breadcrumbs, each tagged with the transport mode in effect. */
    public List<PathPointDto> getPath(Long userId, Instant from, Instant to) {
        List<TimelinePath> crumbs = timelinePathRepository.findByUserAndTimeRange(userId, from, to);
        List<UserActivity> activities = activityRepository.findByUserAndTimeRange(userId, from, to);

        List<PathPointDto> path = new ArrayList<>(crumbs.size());
        int ai = 0; // pointer into the (chronological) activities list
        for (TimelinePath c : crumbs) {
            if (c.getLat() == null || c.getLng() == null) continue;
            Instant t = c.getRecordedAt();
            // Advance past activities that ended before this breadcrumb.
            while (ai < activities.size()
                    && activities.get(ai).getEndTime() != null
                    && activities.get(ai).getEndTime().isBefore(t)) {
                ai++;
            }
            String mode = null;
            if (ai < activities.size()) {
                UserActivity a = activities.get(ai);
                if (a.getStartTime() != null && !a.getStartTime().isAfter(t)) {
                    mode = effectiveType(a);
                }
            }
            path.add(new PathPointDto(toDouble(c.getLat()), toDouble(c.getLng()), t, mode));
        }
        return path;
    }

    // ==================== Aggregate insights ====================

    /** Distance + time grouped by effective transport mode (honours corrections). */
    public List<TransportModeDto> getTransportBreakdown(Long userId, Instant from, Instant to) {
        Map<String, double[]> acc = new LinkedHashMap<>(); // mode -> [distance, minutes, count]
        for (UserActivity a : activityRepository.findByUserAndTimeRange(userId, from, to)) {
            String mode = effectiveType(a);
            if (mode == null) mode = "UNKNOWN";
            double[] agg = acc.computeIfAbsent(mode, k -> new double[3]);
            agg[0] += a.getDistanceMeters() != null ? a.getDistanceMeters() : 0;
            if (a.getStartTime() != null && a.getEndTime() != null) {
                agg[1] += java.time.Duration.between(a.getStartTime(), a.getEndTime()).toMinutes();
            }
            agg[2] += 1;
        }
        List<TransportModeDto> out = new ArrayList<>(acc.size());
        acc.forEach((mode, agg) ->
                out.add(new TransportModeDto(mode, agg[0], (long) agg[1], (long) agg[2])));
        out.sort(Comparator.comparingDouble(TransportModeDto::distanceMeters).reversed());
        return out;
    }

    /** Recurring commute patterns mined from the export. */
    public List<CommuteTripDto> getCommutePatterns(Long userId) {
        List<CommuteTripDto> out = new ArrayList<>();
        for (FrequentTrip t : frequentTripRepository.findByUserIdOrderByTripCountDesc(userId)) {
            out.add(new CommuteTripDto(
                    toDouble(t.getOriginLat()), toDouble(t.getOriginLng()),
                    toDouble(t.getDestLat()), toDouble(t.getDestLng()),
                    t.getOriginPlaceId(), t.getDestPlaceId(),
                    t.getTripCount(), t.getTypicalMode(), t.getDistanceMeters()));
        }
        return out;
    }

    /** Time spent per place semantic type (HOME / WORK / ...). */
    public List<DwellDto> getDwell(Long userId, Instant from, Instant to) {
        List<DwellDto> out = new ArrayList<>();
        for (var row : visitRepository.aggregateDwellBySemanticType(userId, from, to)) {
            out.add(new DwellDto(
                    row.getType(),
                    row.getMinutes() != null ? row.getMinutes() : 0,
                    row.getVisits() != null ? row.getVisits() : 0));
        }
        return out;
    }

    // ==================== Corrections (W5) ====================

    /** Override a travel segment's transport mode. {@code source} is 'manual' or 'ai'. */
    @Transactional
    public SegmentDto correctSegment(Long userId, Long activityId, String newType, String source) {
        UserActivity a = activityRepository.findById(activityId)
                .filter(act -> act.getUser().getId().equals(userId))
                .orElseThrow(() -> new IllegalArgumentException("Segment not found: " + activityId));
        a.setCorrectedActivityType(newType);
        a.setCorrectionSource(source);
        activityRepository.save(a);
        return toActivitySegment(a);
    }

    // ==================== Mapping helpers ====================

    private SegmentDto toVisitSegment(Visit v) {
        return SegmentDto.builder()
                .id(null)
                .kind("VISIT")
                .startTime(v.getStartedAt())
                .endTime(v.getEndedAt())
                .durationMinutes(v.getDurationMinutes())
                .type(v.getSemanticType())
                .originalType(v.getSemanticType())
                .corrected(false)
                .startLat(toDouble(v.getLat()))
                .startLng(toDouble(v.getLng()))
                .probability(toDouble(v.getProbability()))
                .googlePlaceId(v.getGooglePlaceId())
                .build();
    }

    private SegmentDto toActivitySegment(UserActivity a) {
        Integer minutes = (a.getStartTime() != null && a.getEndTime() != null)
                ? (int) java.time.Duration.between(a.getStartTime(), a.getEndTime()).toMinutes()
                : null;
        boolean corrected = a.getCorrectedActivityType() != null;
        return SegmentDto.builder()
                .id(a.getId())
                .kind("ACTIVITY")
                .startTime(a.getStartTime())
                .endTime(a.getEndTime())
                .durationMinutes(minutes)
                .type(effectiveType(a))
                .originalType(a.getActivityType())
                .corrected(corrected)
                .startLat(toDouble(a.getStartLat()))
                .startLng(toDouble(a.getStartLng()))
                .endLat(toDouble(a.getEndLat()))
                .endLng(toDouble(a.getEndLng()))
                .distanceMeters(a.getDistanceMeters())
                .probability(a.getProbability())
                .build();
    }

    private static String effectiveType(UserActivity a) {
        return a.getCorrectedActivityType() != null ? a.getCorrectedActivityType() : a.getActivityType();
    }

    private static Double toDouble(BigDecimal v) {
        return v != null ? v.doubleValue() : null;
    }
}
