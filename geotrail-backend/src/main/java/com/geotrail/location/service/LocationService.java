package com.geotrail.location.service;

import com.geotrail.auth.entity.User;
import com.geotrail.common.util.GeoUtils;
import com.geotrail.location.dto.LocationDtos.*;
import com.geotrail.location.entity.LocationPoint;
import com.geotrail.location.repository.LocationPointRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class LocationService {

    private final LocationPointRepository locationRepo;

    @Transactional
    public Response recordPoint(User user, CreateRequest request) {
        LocationPoint point = LocationPoint.builder()
                .user(user)
                .coordinates(GeoUtils.createPoint(request.getLatitude(), request.getLongitude()))
                .altitude(request.getAltitude())
                .accuracy(request.getAccuracy())
                .batteryLevel(request.getBatteryLevel())
                .velocity(request.getVelocity())
                .recordedAt(request.getRecordedAt() != null ? request.getRecordedAt() : Instant.now())
                .source(request.getSource() != null ? request.getSource() : "live")
                .build();

        LocationPoint saved = locationRepo.save(point);
        log.debug("Recorded location point {} for user {}", saved.getId(), user.getUsername());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<Response> queryPoints(Long userId, QueryParams params) {
        Instant from = resolveFrom(params.getFrom());
        Instant to = resolveTo(params.getTo());

        List<LocationPoint> points;

        if (hasBoundingBox(params)) {
            points = locationRepo.findByUserAndBoundingBox(
                    userId, from, to,
                    params.getMinLon(), params.getMinLat(),
                    params.getMaxLon(), params.getMaxLat()
            );
        } else {
            points = locationRepo.findByUserAndTimeRange(userId, from, to);
        }

        log.debug("Query returned {} points for user {} between {} and {}", points.size(), userId, from, to);
        return points.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public Page<Response> getPointsPaginated(Long userId, int page, int size) {
        return locationRepo.findByUserIdOrderByRecordedAtDesc(userId, PageRequest.of(page, size))
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public List<Response> findNearby(Long userId, double lat, double lon, double radiusMeters, int limit) {
        return locationRepo.findNearby(userId, lat, lon, radiusMeters, limit)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public double getTotalDistance(Long userId, Instant from, Instant to) {
        return locationRepo.calculateTotalDistance(userId, from, to);
    }

    @Transactional(readOnly = true)
    public long getPointCount(Long userId, Instant from, Instant to) {
        return locationRepo.countByUserAndTimeRange(userId, from, to);
    }

    // --- Batch insert for imports ---

    @Transactional
    public int batchInsert(User user, List<CreateRequest> requests) {
        int count = 0;
        for (CreateRequest req : requests) {
            try {
                LocationPoint point = LocationPoint.builder()
                        .user(user)
                        .coordinates(GeoUtils.createPoint(req.getLatitude(), req.getLongitude()))
                        .altitude(req.getAltitude())
                        .accuracy(req.getAccuracy())
                        .batteryLevel(req.getBatteryLevel())
                        .velocity(req.getVelocity())
                        .recordedAt(req.getRecordedAt() != null ? req.getRecordedAt() : Instant.now())
                        .source(req.getSource() != null ? req.getSource() : "import")
                        .build();
                locationRepo.save(point);
                count++;
            } catch (Exception e) {
                log.warn("Failed to insert point: {}", e.getMessage());
            }
        }
        return count;
    }

    // --- Helpers ---

    private Response toResponse(LocationPoint point) {
        return Response.builder()
                .id(point.getId())
                .latitude(point.getLatitude())
                .longitude(point.getLongitude())
                .altitude(point.getAltitude())
                .accuracy(point.getAccuracy())
                .batteryLevel(point.getBatteryLevel())
                .velocity(point.getVelocity())
                .recordedAt(point.getRecordedAt())
                .source(point.getSource())
                .createdAt(point.getCreatedAt())
                .build();
    }

    private boolean hasBoundingBox(QueryParams params) {
        return params.getMinLat() != null && params.getMaxLat() != null
                && params.getMinLon() != null && params.getMaxLon() != null;
    }

    private Instant resolveFrom(Instant from) {
        return from != null ? from : LocalDate.now().atStartOfDay().toInstant(ZoneOffset.UTC);
    }

    private Instant resolveTo(Instant to) {
        return to != null ? to : Instant.now();
    }
}
