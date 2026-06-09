package com.geotrail.timeline.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;

import java.time.Instant;
import java.util.List;

/**
 * Read-side DTOs that surface the rich semantic timeline (visits + travel
 * activities + GPS breadcrumbs) which until now was stored but never exposed.
 */
public final class TimelineDtos {

    private TimelineDtos() {}

    /** A single ordered step in a day: either a stationary VISIT or a moving ACTIVITY. */
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record SegmentDto(
            Long id,            // user_activity id for ACTIVITY (correctable); null for VISIT
            String kind,        // "VISIT" | "ACTIVITY"
            Instant startTime,
            Instant endTime,
            Integer durationMinutes,
            String type,        // effective activity_type (ACTIVITY) or semantic_type (VISIT)
            String originalType,// Google's original value when corrected, else same as type
            boolean corrected,
            Double startLat,
            Double startLng,
            Double endLat,
            Double endLng,
            Double distanceMeters,
            Double probability,
            String googlePlaceId
    ) {}

    /** One GPS breadcrumb for the playback animation, tagged with the mode in effect. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record PathPointDto(
            double lat,
            double lng,
            Instant recordedAt,
            String activityType
    ) {}

    /** A full day's ordered segments plus the raw path for animation. */
    @Builder
    public record DayTimelineDto(
            String date,
            List<SegmentDto> segments,
            List<PathPointDto> path
    ) {}

    /** Distance + time spent per transport mode over a window. */
    public record TransportModeDto(
            String mode,
            double distanceMeters,
            long totalMinutes,
            long count
    ) {}

    /** A recurring commute pattern mined from the export. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record CommuteTripDto(
            Double originLat,
            Double originLng,
            Double destLat,
            Double destLng,
            String originPlaceId,
            String destPlaceId,
            Integer tripCount,
            String typicalMode,
            Double distanceMeters
    ) {}

    /** Time spent per place semantic type (HOME / WORK / UNKNOWN). */
    public record DwellDto(
            String semanticType,
            long totalMinutes,
            long visits
    ) {}

    /** Request body for correcting a segment's transport mode. */
    public record CorrectionRequest(String activityType) {}
}
