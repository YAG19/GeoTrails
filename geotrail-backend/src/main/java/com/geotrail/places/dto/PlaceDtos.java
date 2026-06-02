package com.geotrail.places.dto;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

public final class PlaceDtos {

    private PlaceDtos() {}

    @Data
    public static class CreateRequest {
        @NotBlank(message = "Place name is required")
        @Size(max = 255)
        private String name;

        @NotNull @Min(-90) @Max(90)
        private Double latitude;

        @NotNull @Min(-180) @Max(180)
        private Double longitude;

        @Min(10) @Max(10000)
        private Integer radiusMeters = 100;

        @Size(max = 50)
        private String category;
    }

    @Data
    public static class UpdateRequest {
        @Size(max = 255)
        private String name;

        @Min(-90) @Max(90)
        private Double latitude;

        @Min(-180) @Max(180)
        private Double longitude;

        @Min(10) @Max(10000)
        private Integer radiusMeters;

        @Size(max = 50)
        private String category;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Response {
        private Long id;
        private String name;
        private Double latitude;
        private Double longitude;
        private Integer radiusMeters;
        private String category;
        private Instant createdAt;
        private Instant updatedAt;
    }
}
