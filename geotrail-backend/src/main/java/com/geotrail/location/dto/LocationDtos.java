package com.geotrail.location.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;

public final class LocationDtos {

    private LocationDtos() {}

    @Data
    public static class CreateRequest {
        @NotNull(message = "Latitude is required")
        @Min(value = -90, message = "Latitude must be >= -90")
        @Max(value = 90, message = "Latitude must be <= 90")
        private Double latitude;

        @NotNull(message = "Longitude is required")
        @Min(value = -180, message = "Longitude must be >= -180")
        @Max(value = 180, message = "Longitude must be <= 180")
        private Double longitude;

        private Double altitude;
        private Double accuracy;
        private Short batteryLevel;
        private Double velocity;
        private Instant recordedAt;  // defaults to now if null
        private String source;
        private String activityType;
        private Double distanceMeters;
    }

    @Data
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Response {
        private Long id;
        private Double latitude;
        private Double longitude;
        private Double altitude;
        private Double accuracy;
        private Short batteryLevel;
        private Double velocity;
        private Instant recordedAt;
        private String source;
        private String activityType;
        private Double distanceMeters;
        private Instant createdAt;
    }

    @Data
    public static class QueryParams {
        private Instant from;
        private Instant to;
        // Bounding box for map viewport
        private Double minLat;
        private Double maxLat;
        private Double minLon;
        private Double maxLon;
        // Pagination
        private Integer page;
        private Integer size;
    }

    @Data
    @Builder
    public static class StatsSnapshot {
        private long totalPoints;
        private double totalDistanceMeters;
        private Instant earliestPoint;
        private Instant latestPoint;
    }

    @Data
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class HeatmapCenter {
        private BigDecimal latitude;
        private BigDecimal longitude;
        private Long pointCount;
    }

    @Data
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class HeatmapTileDto {
        private BigDecimal lat;
        private BigDecimal lng;
        private Integer pointCount;
    }
}
