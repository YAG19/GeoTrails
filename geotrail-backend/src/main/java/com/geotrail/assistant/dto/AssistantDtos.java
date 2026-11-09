package com.geotrail.assistant.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

public final class AssistantDtos {

    private AssistantDtos() {}

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ChatRequest {
        @NotBlank(message = "Message prompt cannot be empty")
        private String message;

        @NotBlank(message = "Model selection is required")
        private String model;

        private String lmStudioUrl; // Optional custom LM Studio host

        @Builder.Default
        private Double temperature = 0.7;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ChatResponse {
        private String response;
        private List<SourceRecord> sources;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SourceRecord {
        private String type;     // "ACTIVITY", "VISIT", "PLACE", "LOCATION"
        private String time;     // Recorded time or date range
        private String details;  // Description of the location/activity
        private Double latitude;
        private Double longitude;
    }
}
