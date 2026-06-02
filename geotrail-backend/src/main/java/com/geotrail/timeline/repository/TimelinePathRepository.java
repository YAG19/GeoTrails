package com.geotrail.timeline.repository;

import com.geotrail.timeline.entity.TimelinePath;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TimelinePathRepository extends JpaRepository<TimelinePath, Long> {

    List<TimelinePath> findByUserIdOrderByRecordedAtAsc(Long userId);
}
