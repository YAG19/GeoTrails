package com.geotrail.imports.dto;

import java.time.Instant;

/**
 * Rich records extracted from Google Timeline {@code semanticSegments}.
 * These carry the fields that don't fit the flat {@code location_points} model
 * (place ids, semantic types, segment endpoints, probabilities) and are
 * persisted into the visits / user_activity / timeline_paths tables.
 */
public final class SemanticDtos {

    private SemanticDtos() {}

    /** A stationary stay at a place ({@code semanticSegments[].visit}). */
    public record ParsedVisit(
            String googlePlaceId,
            String semanticType,
            Double lat,
            Double lng,
            Double probability,
            Instant startTime,
            Instant endTime
    ) {}

    /** A travel segment between places ({@code semanticSegments[].activity}). */
    public record ParsedActivity(
            String activityType,
            Double startLat,
            Double startLng,
            Double endLat,
            Double endLng,
            Double distanceMeters,
            Double probability,
            Instant startTime,
            Instant endTime
    ) {}

    /** A single raw GPS breadcrumb ({@code semanticSegments[].timelinePath[]}). */
    public record ParsedTimelinePath(
            Double lat,
            Double lng,
            Instant segmentStart,
            Instant recordedAt
    ) {}
}
