package com.geotrail.location.controller;

import com.geotrail.auth.entity.User;
import com.geotrail.common.dto.ApiResponse;
import com.geotrail.location.dto.LocationDtos.*;
import com.geotrail.location.service.LocationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/locations")
@RequiredArgsConstructor
public class LocationController {

    private final LocationService locationService;

    /**
     * Record a single location point.
     */
    @PostMapping
    public ResponseEntity<ApiResponse<Response>> recordPoint(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody CreateRequest request
    ) {
        Response response = locationService.recordPoint(user, request);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response));
    }

    /**
     * Query points with optional time range and bounding box.
     * GET /api/locations?from=2024-01-01T00:00:00Z&to=2024-12-31T23:59:59Z
     * GET /api/locations?from=...&to=...&minLat=40.7&maxLat=40.8&minLon=-74.0&maxLon=-73.9
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<Response>>> queryPoints(
            @AuthenticationPrincipal User user,
            @ModelAttribute QueryParams params
    ) {
        List<Response> points = locationService.queryPoints(user.getId(), params);
        return ResponseEntity.ok(ApiResponse.success(points));
    }

    /**
     * Paginated listing of all points (for table/list views).
     * GET /api/locations/paginated?page=0&size=50
     */
    @GetMapping("/paginated")
    public ResponseEntity<ApiResponse<Page<Response>>> getPointsPaginated(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        Page<Response> result = locationService.getPointsPaginated(user.getId(), page, size);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * Find points near a coordinate.
     * GET /api/locations/nearby?lat=40.7128&lon=-74.0060&radius=500&limit=100
     */
    @GetMapping("/nearby")
    public ResponseEntity<ApiResponse<List<Response>>> findNearby(
            @AuthenticationPrincipal User user,
            @RequestParam double lat,
            @RequestParam double lon,
            @RequestParam(defaultValue = "500") double radius,
            @RequestParam(defaultValue = "100") int limit
    ) {
        List<Response> points = locationService.findNearby(user.getId(), lat, lon, radius, limit);
        return ResponseEntity.ok(ApiResponse.success(points));
    }

    /**
     * Quick stats for a time range.
     * GET /api/locations/stats?from=2024-01-01T00:00:00Z&to=2024-12-31T23:59:59Z
     */
    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<StatsSnapshot>> getStats(
            @AuthenticationPrincipal User user,
            @RequestParam Instant from,
            @RequestParam Instant to
    ) {
        long count = locationService.getPointCount(user.getId(), from, to);
        double distance = locationService.getTotalDistance(user.getId(), from, to);

        StatsSnapshot stats = StatsSnapshot.builder()
                .totalPoints(count)
                .totalDistanceMeters(distance)
                .build();

        return ResponseEntity.ok(ApiResponse.success(stats));
    }
}
