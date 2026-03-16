package com.geotrail.tracking.controller;

import com.geotrail.auth.entity.User;
import com.geotrail.auth.repository.UserRepository;
import com.geotrail.tracking.dto.OwnTracksPayload;
import com.geotrail.tracking.service.LiveTrackingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Collections;

/**
 * OwnTracks HTTP endpoint.
 *
 * In the OwnTracks app, configure:
 *   Mode: HTTP
 *   URL: https://your-domain.com/api/owntracks
 *   Authentication: username/password (HTTP Basic)
 *
 * OwnTracks expects a JSON response with an empty array [] on success.
 */
@RestController
@RequestMapping("/owntracks")
@RequiredArgsConstructor
@Slf4j
public class OwnTracksController {

    private final LiveTrackingService trackingService;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @PostMapping
    public ResponseEntity<?> receivePayload(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody OwnTracksPayload payload
    ) {
        User user = authenticateBasic(authHeader);
        if (user == null) {
            return ResponseEntity.status(401).body(Collections.emptyList());
        }

        trackingService.processOwnTracksPayload(user, payload);

        // OwnTracks expects [] as success response
        return ResponseEntity.ok(Collections.emptyList());
    }

    /**
     * OwnTracks sends HTTP Basic auth.
     * We validate against the same user table.
     */
    private User authenticateBasic(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Basic ")) {
            log.debug("Missing or invalid Authorization header for OwnTracks");
            return null;
        }

        try {
            String decoded = new String(
                    Base64.getDecoder().decode(authHeader.substring(6)),
                    StandardCharsets.UTF_8
            );
            String[] parts = decoded.split(":", 2);
            if (parts.length != 2) return null;

            String username = parts[0];
            String password = parts[1];

            return userRepository.findByUsername(username)
                    .filter(user -> passwordEncoder.matches(password, user.getPasswordHash()))
                    .orElse(null);

        } catch (Exception e) {
            log.warn("Failed to parse OwnTracks Basic auth: {}", e.getMessage());
            return null;
        }
    }
}
