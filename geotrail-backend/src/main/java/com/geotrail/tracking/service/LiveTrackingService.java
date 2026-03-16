package com.geotrail.tracking.service;

import com.geotrail.auth.entity.User;
import com.geotrail.common.util.GeoUtils;
import com.geotrail.location.dto.LocationDtos;
import com.geotrail.location.entity.LocationPoint;
import com.geotrail.location.repository.LocationPointRepository;
import com.geotrail.tracking.dto.OwnTracksPayload;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
@RequiredArgsConstructor
@Slf4j
public class LiveTrackingService {

    private final LocationPointRepository locationRepo;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Process an OwnTracks location payload:
     * 1. Persist to database
     * 2. Broadcast via WebSocket to all connected clients
     */
    @Transactional
    public void processOwnTracksPayload(User user, OwnTracksPayload payload) {
        if (!payload.isLocation()) {
            log.debug("Ignoring non-location OwnTracks payload type: {}", payload.getType());
            return;
        }

        if (payload.getLat() == null || payload.getLon() == null) {
            log.warn("OwnTracks payload missing lat/lon, skipping");
            return;
        }

        LocationPoint point = LocationPoint.builder()
                .user(user)
                .coordinates(GeoUtils.createPoint(payload.getLat(), payload.getLon()))
                .altitude(payload.getAltitude())
                .accuracy(payload.getAccuracy())
                .batteryLevel(payload.getBattery())
                .velocity(payload.getVelocity())
                .recordedAt(payload.getTimestamp() != null
                        ? Instant.ofEpochSecond(payload.getTimestamp())
                        : Instant.now())
                .source("owntracks")
                .rawPayload(null) // Could store original JSON if needed
                .build();

        LocationPoint saved = locationRepo.save(point);

        // Build response and broadcast to WebSocket subscribers
        LocationDtos.Response response = LocationDtos.Response.builder()
                .id(saved.getId())
                .latitude(saved.getLatitude())
                .longitude(saved.getLongitude())
                .altitude(saved.getAltitude())
                .accuracy(saved.getAccuracy())
                .batteryLevel(saved.getBatteryLevel())
                .velocity(saved.getVelocity())
                .recordedAt(saved.getRecordedAt())
                .source(saved.getSource())
                .build();

        // Broadcast to user-specific topic
        String destination = "/topic/tracking/" + user.getId();
        messagingTemplate.convertAndSend(destination, response);

        log.debug("Processed OwnTracks point for user {}: ({}, {})",
                user.getUsername(), payload.getLat(), payload.getLon());
    }
}
