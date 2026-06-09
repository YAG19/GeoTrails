package com.geotrail.timeline.controller;

import com.geotrail.auth.entity.User;
import com.geotrail.common.dto.ApiResponse;
import com.geotrail.timeline.dto.TimelineDtos.*;
import com.geotrail.timeline.service.TimelineService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Read API over the stored semantic timeline (visits, travel activities, GPS
 * breadcrumbs, commute patterns) plus segment corrections. Mirrors
 * {@code LocationController}'s auth + {@link ApiResponse} envelope conventions.
 */
@RestController
@RequestMapping("/timeline")
@RequiredArgsConstructor
public class TimelineController {

    private final TimelineService timelineService;

    /** Ordered segments + animation path for one calendar day. */
    @GetMapping("/day")
    public ResponseEntity<ApiResponse<DayTimelineDto>> getDay(
            @AuthenticationPrincipal User user,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return ResponseEntity.ok(ApiResponse.success(timelineService.getDay(user.getId(), date)));
    }

    /** Chronological visits + activities within a window — feeds insight widgets. */
    @GetMapping("/segments")
    public ResponseEntity<ApiResponse<List<SegmentDto>>> getSegments(
            @AuthenticationPrincipal User user,
            @RequestParam Instant from,
            @RequestParam Instant to
    ) {
        return ResponseEntity.ok(ApiResponse.success(timelineService.getSegments(user.getId(), from, to)));
    }

    /** Raw ordered breadcrumbs for the map playback animation. */
    @GetMapping("/path")
    public ResponseEntity<ApiResponse<List<PathPointDto>>> getPath(
            @AuthenticationPrincipal User user,
            @RequestParam Instant from,
            @RequestParam Instant to
    ) {
        return ResponseEntity.ok(ApiResponse.success(timelineService.getPath(user.getId(), from, to)));
    }

    /** Distance + time per transport mode (honours user corrections). */
    @GetMapping("/transport-breakdown")
    public ResponseEntity<ApiResponse<List<TransportModeDto>>> getTransportBreakdown(
            @AuthenticationPrincipal User user,
            @RequestParam Instant from,
            @RequestParam Instant to
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                timelineService.getTransportBreakdown(user.getId(), from, to)));
    }

    /** Recurring commute patterns mined from the export. */
    @GetMapping("/commute-patterns")
    public ResponseEntity<ApiResponse<List<CommuteTripDto>>> getCommutePatterns(
            @AuthenticationPrincipal User user
    ) {
        return ResponseEntity.ok(ApiResponse.success(timelineService.getCommutePatterns(user.getId())));
    }

    /** Time spent per place semantic type (HOME / WORK / ...). */
    @GetMapping("/dwell")
    public ResponseEntity<ApiResponse<List<DwellDto>>> getDwell(
            @AuthenticationPrincipal User user,
            @RequestParam Instant from,
            @RequestParam Instant to
    ) {
        return ResponseEntity.ok(ApiResponse.success(timelineService.getDwell(user.getId(), from, to)));
    }

    /** Override a travel segment's transport mode (manual inline edit). */
    @PostMapping("/segments/{id}/correct")
    public ResponseEntity<ApiResponse<SegmentDto>> correctSegment(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @Valid @RequestBody CorrectionRequest request
    ) {
        SegmentDto updated = timelineService.correctSegment(user.getId(), id, request.activityType(), "manual");
        return ResponseEntity.ok(ApiResponse.success(updated, "Segment updated"));
    }
}
