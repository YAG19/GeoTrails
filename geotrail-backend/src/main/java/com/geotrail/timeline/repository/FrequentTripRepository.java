package com.geotrail.timeline.repository;

import com.geotrail.timeline.entity.FrequentTrip;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FrequentTripRepository extends JpaRepository<FrequentTrip, Long> {

    List<FrequentTrip> findByUserIdOrderByTripCountDesc(Long userId);

    void deleteByUserId(Long userId);
}
