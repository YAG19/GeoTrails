package com.geotrail.timeline.repository;

import com.geotrail.timeline.entity.TimelinePath;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface TimelinePathRepository extends JpaRepository<TimelinePath, Long> {

    List<TimelinePath> findByUserIdOrderByRecordedAtAsc(Long userId);

    /** Ordered GPS breadcrumbs within [from, to] — the raw input for map playback. */
    @Query("""
        SELECT p FROM TimelinePath p
        WHERE p.user.id = :userId
          AND p.recordedAt >= :from AND p.recordedAt < :to
        ORDER BY p.recordedAt ASC
        """)
    List<TimelinePath> findByUserAndTimeRange(@Param("userId") Long userId,
                                              @Param("from") Instant from,
                                              @Param("to") Instant to);
}
