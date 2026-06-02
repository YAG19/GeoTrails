package com.geotrail.location.repository;

import com.geotrail.common.dto.ApiResponse;
import com.geotrail.location.entity.LocationPoint;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;

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

    /**
     * Find the centroid of the densest ~1m grid cell across all of the user's location history.
     * Returns [lat, lng, pointCount], or [null, null, 0] if no data exists.
     */
    @Query(value = """
        WITH dense_area AS (
            SELECT
                ROUND(ST_Y(coordinates)::numeric, 5) AS lat_bucket,
                ROUND(ST_X(coordinates)::numeric, 5) AS lng_bucket
            FROM location_points
            WHERE user_id = :userId
            GROUP BY lat_bucket, lng_bucket
            ORDER BY COUNT(*) DESC
            LIMIT 1
        )
        SELECT
            ST_Y(ST_Centroid(ST_Collect(lp.coordinates))) AS lat,
            ST_X(ST_Centroid(ST_Collect(lp.coordinates))) AS lng,
            COUNT(*) AS point_count
        FROM location_points lp, dense_area d
        WHERE lp.user_id = :userId
          AND ROUND(ST_Y(lp.coordinates)::numeric, 5) = d.lat_bucket
          AND ROUND(ST_X(lp.coordinates)::numeric, 5) = d.lng_bucket
        """, nativeQuery = true)
    Object[] findHeatmapCenter(@Param("userId") Long userId);

    /**
     * Compute all density grid buckets for a user — used to populate heatmap_tiles.
     * Returns rows of [lat_bucket, lng_bucket, point_count], ordered by density descending.
     * Buckets with fewer than minCount points are excluded.
     */
    @Query(value = """
        SELECT
            ROUND(ST_Y(coordinates)::numeric, 5) AS lat_bucket,
            ROUND(ST_X(coordinates)::numeric, 5) AS lng_bucket,
            CAST(COUNT(*) AS INTEGER) AS point_count
        FROM location_points
        WHERE user_id = :userId
        GROUP BY lat_bucket, lng_bucket
        HAVING COUNT(*) >= :minCount
        ORDER BY point_count DESC
        """, nativeQuery = true)
    List<Object[]> computeHeatmapBuckets(
            @Param("userId") Long userId,
            @Param("minCount") int minCount
    );

    /**
     * Sum distance_meters per activity_type within a date range.
     * Only rows with a non-null, positive distance_meters value are included
     * (live-tracking points have null; only imported activity start-points carry this value).
     */
    @Query(value = """
        SELECT lp.activity_type  AS activityType,
               SUM(lp.distance_meters) AS totalDistanceM
        FROM location_points lp
        WHERE lp.user_id = :userId
          AND lp.recorded_at BETWEEN :from AND :to
          AND lp.activity_type IS NOT NULL
          AND lp.distance_meters IS NOT NULL
          AND lp.distance_meters > 0
        GROUP BY lp.activity_type
        ORDER BY totalDistanceM DESC
        """, nativeQuery = true)
    List<Object[]> sumDistanceByActivityType(
            @Param("userId") Long userId,
            @Param("from") Instant from,
            @Param("to") Instant to
    );

    @Query(value = "SELECT MIN(recorded_at)::date FROM location_points WHERE user_id = :userId", nativeQuery = true)
    Optional<LocalDate> findEarliestDateByUserId(@Param("userId") Long userId);

    @Query(value = "SELECT MAX(recorded_at)::date FROM location_points WHERE user_id = :userId", nativeQuery = true)
    Optional<LocalDate> findLatestDateByUserId(@Param("userId") Long userId);

    @Query(value = "SELECT DISTINCT activity_type FROM location_points " +
            "WHERE user_id = :userId AND activity_type IS NOT NULL " +
            "ORDER BY activity_type", nativeQuery = true)
    List<String> findDistinctActivityTypeByUserId(@Param("userId") Long userId);
}