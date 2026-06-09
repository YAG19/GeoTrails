package com.geotrail.trips.repository;

import com.geotrail.trips.entity.Visit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface VisitRepository extends JpaRepository<Visit, Long> {

    /**
     * Cluster a user's visits by location (~110 m buckets) to surface frequently
     * visited but unnamed spots for AI auto-labelling. Returns rows of
     * [lat, lng, visitCount, totalMinutes, semanticType] ordered by frequency.
     */
    @Query(value = """
        SELECT ROUND(lat, 3)                       AS lat,
               ROUND(lng, 3)                       AS lng,
               COUNT(*)                            AS visits,
               COALESCE(SUM(duration_minutes), 0)  AS minutes,
               MAX(semantic_type)                  AS semantic_type
        FROM visits
        WHERE user_id = :userId AND lat IS NOT NULL AND lng IS NOT NULL
        GROUP BY ROUND(lat, 3), ROUND(lng, 3)
        HAVING COUNT(*) >= :minVisits
        ORDER BY COUNT(*) DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<Object[]> findVisitClusters(@Param("userId") Long userId,
                                     @Param("minVisits") int minVisits,
                                     @Param("limit") int limit);

    /** Stationary stays whose start falls within [from, to], ordered chronologically. */
    @Query("""
        SELECT v FROM Visit v
        WHERE v.user.id = :userId
          AND v.startedAt >= :from AND v.startedAt < :to
        ORDER BY v.startedAt ASC
        """)
    List<Visit> findByUserAndTimeRange(@Param("userId") Long userId,
                                       @Param("from") Instant from,
                                       @Param("to") Instant to);

    /** Aggregate time-spent per semantic_type (HOME/WORK/...) over a window. */
    @Query("""
        SELECT COALESCE(v.semanticType, 'UNKNOWN') AS type,
               SUM(v.durationMinutes) AS minutes,
               COUNT(v) AS visits
        FROM Visit v
        WHERE v.user.id = :userId
          AND v.startedAt >= :from AND v.startedAt < :to
          AND v.durationMinutes IS NOT NULL
        GROUP BY COALESCE(v.semanticType, 'UNKNOWN')
        ORDER BY SUM(v.durationMinutes) DESC
        """)
    List<DwellAggregate> aggregateDwellBySemanticType(@Param("userId") Long userId,
                                                      @Param("from") Instant from,
                                                      @Param("to") Instant to);

    interface DwellAggregate {
        String getType();
        Long getMinutes();
        Long getVisits();
    }
}
