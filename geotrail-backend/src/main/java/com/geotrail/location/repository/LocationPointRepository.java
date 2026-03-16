package com.geotrail.location.repository;

import com.geotrail.location.entity.LocationPoint;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface LocationPointRepository extends JpaRepository<LocationPoint, Long> {

    /**
     * Find points within a date range for a user, ordered by time.
     */
    @Query("""
        SELECT lp FROM LocationPoint lp
        WHERE lp.user.id = :userId
          AND lp.recordedAt BETWEEN :from AND :to
        ORDER BY lp.recordedAt ASC
        """)
    List<LocationPoint> findByUserAndTimeRange(
            @Param("userId") Long userId,
            @Param("from") Instant from,
            @Param("to") Instant to
    );

    /**
     * Find points within a bounding box (map viewport) and date range.
     * Uses PostGIS ST_MakeEnvelope for spatial filtering — hits the GIST index.
     */
    @Query(value = """
        SELECT lp.* FROM location_points lp
        WHERE lp.user_id = :userId
          AND lp.recorded_at BETWEEN :from AND :to
          AND ST_Within(
              lp.coordinates,
              ST_MakeEnvelope(:minLon, :minLat, :maxLon, :maxLat, 4326)
          )
        ORDER BY lp.recorded_at ASC
        """, nativeQuery = true)
    List<LocationPoint> findByUserAndBoundingBox(
            @Param("userId") Long userId,
            @Param("from") Instant from,
            @Param("to") Instant to,
            @Param("minLon") double minLon,
            @Param("minLat") double minLat,
            @Param("maxLon") double maxLon,
            @Param("maxLat") double maxLat
    );

    /**
     * Find points near a coordinate within a radius (meters).
     * ST_DWithin on geography type uses meters.
     */
    @Query(value = """
        SELECT lp.* FROM location_points lp
        WHERE lp.user_id = :userId
          AND ST_DWithin(
              lp.coordinates::geography,
              ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
              :radiusMeters
          )
        ORDER BY lp.recorded_at DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<LocationPoint> findNearby(
            @Param("userId") Long userId,
            @Param("lat") double lat,
            @Param("lon") double lon,
            @Param("radiusMeters") double radiusMeters,
            @Param("limit") int limit
    );

    /**
     * Paginated query for all points of a user.
     */
    Page<LocationPoint> findByUserIdOrderByRecordedAtDesc(Long userId, Pageable pageable);

    /**
     * Count points in a date range — useful for stats and import progress.
     */
    @Query("""
        SELECT COUNT(lp) FROM LocationPoint lp
        WHERE lp.user.id = :userId
          AND lp.recordedAt BETWEEN :from AND :to
        """)
    long countByUserAndTimeRange(
            @Param("userId") Long userId,
            @Param("from") Instant from,
            @Param("to") Instant to
    );

    /**
     * Total distance traveled in a date range (meters).
     * Uses PostGIS ST_DistanceSphere for sequential point-to-point distance.
     */
    @Query(value = """
        SELECT COALESCE(SUM(dist), 0) FROM (
            SELECT ST_DistanceSphere(
                lp.coordinates,
                LAG(lp.coordinates) OVER (ORDER BY lp.recorded_at)
            ) AS dist
            FROM location_points lp
            WHERE lp.user_id = :userId
              AND lp.recorded_at BETWEEN :from AND :to
        ) sub
        WHERE dist IS NOT NULL AND dist < 50000
        """, nativeQuery = true)
    double calculateTotalDistance(
            @Param("userId") Long userId,
            @Param("from") Instant from,
            @Param("to") Instant to
    );
}
