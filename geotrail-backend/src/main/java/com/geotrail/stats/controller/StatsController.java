package com.geotrail.stats.controller;

import com.geotrail.auth.entity.User;
import com.geotrail.common.dto.ApiResponse;
import com.geotrail.stats.dto.ActivityDistanceDto;
import com.geotrail.stats.dto.AnomalyDto;
import com.geotrail.stats.dto.DailyStatDto;
import com.geotrail.stats.dto.DashboardSummaryDto;
import com.geotrail.stats.service.AnomalyService;
import com.geotrail.stats.service.StatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/stats")
@RequiredArgsConstructor
public class StatsController {

    private final StatsService statsService;
    private final AnomalyService anomalyService;

    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<DashboardSummaryDto>> getDashboard(
            @AuthenticationPrincipal User user,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Integer currentYear
    ) {
        return ResponseEntity.ok(ApiResponse.success(statsService.getDashboardSummary(user.getId(), from, to, currentYear)));
    }

    @GetMapping("/daily")
    public ResponseEntity<ApiResponse<List<DailyStatDto>>> getDailyStats(
            @AuthenticationPrincipal User user,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return ResponseEntity.ok(ApiResponse.success(statsService.getDailyStats(user.getId(), from, to)));
    }

    @GetMapping("/activity-distances")
    public ResponseEntity<ApiResponse<List<ActivityDistanceDto>>> getActivityDistances(
            @AuthenticationPrincipal User user,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return ResponseEntity.ok(ApiResponse.success(statsService.getActivityDistances(user.getId(), from, to)));
    }


    /**
     * Notable/unusual events (long trips, late-night movement, busy days) in a window.
     * Cheap, deterministic — safe to call on every dashboard load.
     */
    @GetMapping("/anomalies")
    public ResponseEntity<ApiResponse<List<AnomalyDto>>> getAnomalies(
            @AuthenticationPrincipal User user,
            @RequestParam Instant from,
            @RequestParam Instant to
    ) {
        return ResponseEntity.ok(ApiResponse.success(anomalyService.detect(user.getId(), from, to)));
    }
}
