package com.geotrail.places.repository;

import com.geotrail.places.entity.Place;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PlaceRepository extends JpaRepository<Place, Long> {

    List<Place> findByUserIdOrderByNameAsc(Long userId);

    List<Place> findByUserIdAndCategory(Long userId, String category);

    /**
     * Find the nearest place to a coordinate within max distance.
     * Returns the closest match — used for auto-detecting visits.
     */
    @Query(value = """
        SELECT p.* FROM places p
        WHERE p.user_id = :userId
          AND ST_DWithin(
              p.coordinates::geography,
              ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
              p.radius_meters
          )
        ORDER BY ST_Distance(
            p.coordinates::geography,
            ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
        )
        LIMIT 1
        """, nativeQuery = true)
    Optional<Place> findNearestPlace(
            @Param("userId") Long userId,
            @Param("lat") double lat,
            @Param("lon") double lon
    );

    /**
     * Find all places within a radius of a point.
     */
    @Query(value = """
        SELECT p.* FROM places p
        WHERE p.user_id = :userId
          AND ST_DWithin(
              p.coordinates::geography,
              ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
              :radiusMeters
          )
        ORDER BY ST_Distance(
            p.coordinates::geography,
            ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
        )
        """, nativeQuery = true)
    List<Place> findPlacesNearby(
            @Param("userId") Long userId,
            @Param("lat") double lat,
            @Param("lon") double lon,
            @Param("radiusMeters") double radiusMeters
    );
}
