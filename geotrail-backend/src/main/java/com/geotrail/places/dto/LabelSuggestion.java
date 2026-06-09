package com.geotrail.places.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * An AI-proposed name/category for a frequently visited but unnamed location.
 * Surfaced in the Places UI for one-click acceptance (which creates a real place).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record LabelSuggestion(
        double lat,
        double lng,
        String suggestedName,
        String category,
        String areaName,
        long visitCount,
        long totalMinutes,
        String reasoning
) {}
