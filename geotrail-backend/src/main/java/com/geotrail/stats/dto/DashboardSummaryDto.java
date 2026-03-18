package com.geotrail.stats.dto;

import lombok.Builder;
import lombok.Data;

import java.io.Serializable;

@Data
@Builder
// @RequiredArgsConstructor
public class DashboardSummaryDto implements Serializable {
    private static final long serialVersionUID = 1L;
    private long totalPointsAllTime;
    private double distanceLast30DaysM;
    private long pointsLast30Days;
    private double distanceThisYearM;

    public double getDistanceLast30DaysKm() {
        return distanceLast30DaysM / 1000.0;
    }

    public double getDistanceThisYearKm() {
        return distanceThisYearM / 1000.0;
    }
}
