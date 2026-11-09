package com.geotrail.trips.repository;

import com.geotrail.trips.entity.Trip;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface TripRepository extends JpaRepository<Trip, Long> {

    @Query("SELECT t FROM Trip t LEFT JOIN FETCH t.fromPlace LEFT JOIN FETCH t.toPlace WHERE t.user.id = :userId AND (t.startedAt <= :to AND t.endedAt >= :from) ORDER BY t.startedAt ASC")
    List<Trip> findByUserAndTimeRange(
            @Param("userId") Long userId,
            @Param("from") Instant from,
            @Param("to") Instant to
    );
}
