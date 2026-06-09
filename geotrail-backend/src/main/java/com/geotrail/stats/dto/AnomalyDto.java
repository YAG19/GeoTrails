package com.geotrail.stats.dto;

/**
 * A notable / unusual event surfaced from the user's timeline, for the dashboard
 * "Notable" strip. Computed deterministically from segments + daily stats.
 *
 * @param date        ISO date (YYYY-MM-DD) the anomaly falls on
 * @param type        machine token: LONG_TRIP | LATE_NIGHT | BUSY_DAY | HIGH_DISTANCE
 * @param title       short headline
 * @param description one-line human explanation
 * @param severity    low | medium | high
 */
public record AnomalyDto(
        String date,
        String type,
        String title,
        String description,
        String severity
) {}
