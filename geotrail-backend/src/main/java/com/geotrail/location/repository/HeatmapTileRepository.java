package com.geotrail.location.repository;

import com.geotrail.location.entity.HeatmapTile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface HeatmapTileRepository extends JpaRepository<HeatmapTile, Long> {

    void deleteByUserId(Long userId);

    List<HeatmapTile> findByUserIdOrderByPointCountDesc(Long userId);

    Optional<HeatmapTile> findTopByUserIdOrderByPointCountDesc(Long userId);
}
