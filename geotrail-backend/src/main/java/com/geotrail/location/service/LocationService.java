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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class LocationService {

    private final LocationPointRepository locationRepo;
    private final JdbcTemplate jdbcTemplate;

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

    /**
     * Batch insert using native SQL with ON CONFLICT DO NOTHING.
     *
     * Why not JPA save() in a loop?
     * 1. If ANY save() throws (e.g., duplicate), PostgreSQL marks the transaction
     *    as aborted — ALL subsequent inserts in the same @Transactional fail with
     *    "current transaction is aborted, commands ignored until end of transaction block".
     *    The try/catch in the loop doesn't help because Spring's TransactionInterceptor
     *    has already marked the tx as rollback-only.
     *
     * 2. Individual save() calls are slow — each one does a SELECT (merge check) + INSERT.
     *    Native batch SQL with ON CONFLICT skips duplicates without aborting the transaction.
     *
     * 3. For 100K+ points, this is ~50x faster than JPA save-per-row.
     *
     * Interview note: This is the @Transactional + exception trap. Options to fix:
     *   a) Native SQL with ON CONFLICT (what we do here) — best for bulk imports
     *   b) Propagation.REQUIRES_NEW on each save (new tx per row) — slow, 1 connection per save
     *   c) savepoint per row via EntityManager — complex, still slow
     *   d) Spring Batch — overkill for this use case
     */
    @Transactional
    public int batchInsert(User user, List<CreateRequest> requests) {
        if (requests.isEmpty()) return 0;

        for(int i = 0 ; i < 5; i++) {
          log.info("Processing batch {} of {}", i, requests.get(i));   
        }
        final String sql = """
            INSERT INTO location_points
                (user_id, coordinates, altitude, accuracy, battery_level, velocity,
                 recorded_at, source, activity_type, distance_meters, created_at)
            VALUES
                (?, ST_SetSRID(ST_MakePoint(?, ?), 4326), ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ON CONFLICT (user_id, recorded_at, source) DO NOTHING
            """;

        int inserted = 0;
        int skipped = 0;

        // Process in mini-batches for memory efficiency
        List<Object[]> batchArgs = new ArrayList<>();

        for (CreateRequest req : requests) {
            if (req.getLatitude() == null || req.getLongitude() == null || req.getRecordedAt() == null) {
                skipped++;
                continue;
            }

            batchArgs.add(new Object[]{
                    user.getId(),
                    req.getLongitude(),                           // ST_MakePoint(x=lon, y=lat)
                    req.getLatitude(),
                    req.getAltitude(),
                    req.getAccuracy(),
                    req.getBatteryLevel(),
                    req.getVelocity(),
                    Timestamp.from(req.getRecordedAt()),
                    req.getSource() != null ? req.getSource() : "import",
                    req.getActivityType(),
                    req.getDistanceMeters()
            });

            // Flush every 1000 rows
            if (batchArgs.size() >= 1000) {
                int[] results = jdbcTemplate.batchUpdate(sql, batchArgs);
                for (int r : results) {
                    if (r > 0) inserted++;
                    else skipped++;
                }
                batchArgs.clear();
            }
        }

        // Flush remaining
        if (!batchArgs.isEmpty()) {
            int[] results = jdbcTemplate.batchUpdate(sql, batchArgs);
            for (int r : results) {
                if (r > 0) inserted++;
                else skipped++;
            }
        }

        log.info("Batch insert: {} inserted, {} skipped (duplicates/invalid) out of {} total",
                inserted, skipped, requests.size());
        return inserted;
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
                .activityType(point.getActivityType())
                .distanceMeters(point.getDistanceMeters())
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