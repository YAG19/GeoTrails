package com.geotrail.stats.service;

import com.geotrail.stats.dto.AnomalyDto;
import com.geotrail.timeline.dto.TimelineDtos.SegmentDto;
import com.geotrail.timeline.service.TimelineService;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Late-night/busy-day bucketing must use the configured display zone, not UTC.
 * With IST (UTC+05:30), 00:00–05:00 UTC is actually 05:30–10:30 local — so under
 * UTC bucketing a normal morning commute gets flagged and real late-night
 * movement (local midnight–5am, i.e. 18:30–23:30 UTC) never does.
 */
class AnomalyServiceTest {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final Long USER = 1L;

    private final TimelineService timelineService = mock(TimelineService.class);
    private final AnomalyService service = new AnomalyService(timelineService, "Asia/Kolkata");

    private static SegmentDto trip(Instant start) {
        return SegmentDto.builder()
                .kind("ACTIVITY")
                .startTime(start)
                .type("IN_PASSENGER_VEHICLE")
                .build();
    }

    private List<AnomalyDto> detect(SegmentDto... segments) {
        when(timelineService.getSegments(eq(USER), any(), any())).thenReturn(List.of(segments));
        return service.detect(USER, Instant.EPOCH, Instant.now());
    }

    @Test
    void morningCommuteAtNineIstIsNotFlaggedLateNight() {
        // 09:00 IST == 03:30 UTC; UTC-hour bucketing would wrongly flag this
        Instant nineAmIst = ZonedDateTime.of(2026, 6, 10, 9, 0, 0, 0, IST).toInstant();

        List<AnomalyDto> anomalies = detect(trip(nineAmIst));

        assertTrue(anomalies.stream().noneMatch(a -> "LATE_NIGHT".equals(a.type())),
                "a 09:00 IST commute must not be classified as late-night movement");
    }

    @Test
    void localOneAmTripIsFlaggedLateNightOnTheLocalDate() {
        // 01:00 IST on Jun 10 == 19:30 UTC on Jun 9; UTC bucketing misses it entirely
        Instant oneAmIst = ZonedDateTime.of(2026, 6, 10, 1, 0, 0, 0, IST).toInstant();

        List<AnomalyDto> anomalies = detect(trip(oneAmIst));

        List<AnomalyDto> lateNight = anomalies.stream()
                .filter(a -> "LATE_NIGHT".equals(a.type()))
                .toList();
        assertEquals(1, lateNight.size(), "a 01:00 IST trip must be flagged as late-night");
        assertEquals("2026-06-10", lateNight.get(0).date(),
                "the anomaly must carry the local date, not the UTC date (2026-06-09)");
    }
}
