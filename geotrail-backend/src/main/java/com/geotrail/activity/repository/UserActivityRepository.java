package com.geotrail.activity.repository;

import com.geotrail.activity.entity.UserActivity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface UserActivityRepository extends JpaRepository<UserActivity, Long> {

    List<UserActivity> findByUserIdOrderByCreatedAtDesc(Long userId);

    /** Travel segments whose start falls within [from, to], ordered chronologically. */
    @Query("""
        SELECT a FROM UserActivity a
        WHERE a.user.id = :userId
          AND a.startTime >= :from AND a.startTime < :to
        ORDER BY a.startTime ASC
        """)
    List<UserActivity> findByUserAndTimeRange(@Param("userId") Long userId,
                                              @Param("from") Instant from,
                                              @Param("to") Instant to);
}
