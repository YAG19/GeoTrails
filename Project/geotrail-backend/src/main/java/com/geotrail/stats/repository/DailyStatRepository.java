package com.geotrail.stats.repository;

import com.geotrail.stats.entity.DailyStat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface DailyStatRepository extends JpaRepository<DailyStat, Long> {

    Optional<DailyStat> findByUserIdAndStatDate(Long userId, LocalDate statDate);

    List<DailyStat> findByUserIdAndStatDateBetweenOrderByStatDateAsc(
            Long userId, LocalDate from, LocalDate to);

    @Query("""
        SELECT COALESCE(SUM(d.totalDistanceM), 0)
        FROM DailyStat d
        WHERE d.user.id = :userId
          AND d.statDate BETWEEN :from AND :to
        """)
    double sumDistanceForRange(
            @Param("userId") Long userId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to
    );

    @Query("""
        SELECT COALESCE(SUM(d.totalPoints), 0)
        FROM DailyStat d
        WHERE d.user.id = :userId
          AND d.statDate BETWEEN :from AND :to
        """)
    long sumPointsForRange(
            @Param("userId") Long userId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to
    );
}
