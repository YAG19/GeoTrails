package com.geotrail.stats.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;

@Data
@Builder
public class DailyStatDto {
    private LocalDate statDate;
    private Double totalDistanceM;
    private Integer totalPoints;
    private Integer citiesVisited;
    private Integer countriesVisited;
    private Integer timeAtHomeMin;
    private Integer timeInTransitMin;

    public double getTotalDistanceKm() {
        return totalDistanceM != null ? totalDistanceM / 1000.0 : 0;
    }
}
