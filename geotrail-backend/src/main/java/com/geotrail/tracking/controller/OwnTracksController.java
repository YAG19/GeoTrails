package com.geotrail.tracking.controller;

import com.geotrail.auth.entity.User;
import com.geotrail.tracking.dto.OwnTracksPayload;
import com.geotrail.tracking.service.LiveTrackingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;

/**
 * OwnTracks HTTP endpoint.
 *
 * In the OwnTracks app, configure:
 *   Mode: HTTP
 *   URL: https://your-domain.com/api/owntracks
 *   Authentication: username/password (HTTP Basic)
 *
 * Authentication is handled upstream by {@code OwnTracksAuthFilter}; this controller only forwards
 * the authenticated principal to the service. OwnTracks expects a JSON response with an empty array
 * [] on success — an intentional exception to the app-wide {@code ApiResponse} envelope (it's the
 * OwnTracks wire protocol, not our API contract).
 */
@RestController
@RequestMapping("/owntracks")
@RequiredArgsConstructor
@Slf4j
public class OwnTracksController {

    private final LiveTrackingService trackingService;

    @PostMapping
    public ResponseEntity<?> receivePayload(
            @AuthenticationPrincipal User user,
            @RequestBody OwnTracksPayload payload
    ) {
        trackingService.processOwnTracksPayload(user, payload);

        // OwnTracks expects [] as success response (wire-protocol envelope exception).
        return ResponseEntity.ok(Collections.emptyList());
    }
}
