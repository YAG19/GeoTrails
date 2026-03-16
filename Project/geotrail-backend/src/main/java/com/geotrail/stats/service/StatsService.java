package com.geotrail.stats.service;

import com.geotrail.location.repository.LocationPointRepository;
import com.geotrail.stats.dto.DashboardSummaryDto;
import com.geotrail.stats.dto.DailyStatDto;
import com.geotrail.stats.entity.DailyStat;
import com.geotrail.stats.repository.DailyStatRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class StatsService {

    private final DailyStatRepository dailyStatRepo;
    private final LocationPointRepository locationRepo;

    @Cacheable(value = "dashboardSummary", key = "#userId")
    @Transactional(readOnly = true)
    public DashboardSummaryDto getDashboardSummary(Long userId) {
        LocalDate today = LocalDate.now();
        LocalDate thirtyDaysAgo = today.minusDays(30);
        LocalDate yearStart = today.withDayOfYear(1);

        // Last 30 days
        double distance30d = dailyStatRepo.sumDistanceForRange(userId, thirtyDaysAgo, today);
        long points30d = dailyStatRepo.sumPointsForRange(userId, thirtyDaysAgo, today);

        // This year
        double distanceYear = dailyStatRepo.sumDistanceForRange(userId, yearStart, today);

        // All time point count
        long totalPoints = locationRepo.countByUserAndTimeRange(
                userId,
                Instant.parse("2000-01-01T00:00:00Z"),
                Instant.now()
        );

        return DashboardSummaryDto.builder()
                .totalPointsAllTime(totalPoints)
                .distanceLast30DaysM(distance30d)
                .pointsLast30Days(points30d)
                .distanceThisYearM(distanceYear)
                .build();
    }

    @Transactional(readOnly = true)
    public List<DailyStatDto> getDailyStats(Long userId, LocalDate from, LocalDate to) {
        return dailyStatRepo.findByUserIdAndStatDateBetweenOrderByStatDateAsc(userId, from, to)
                .stream().map(this::toDto).toList();
    }

    /**
     * Compute and upsert stats for a specific date.
     * Called by the nightly scheduler.
     */
    @Transactional
    public void computeStatsForDate(Long userId, LocalDate date) {
        Instant dayStart = date.atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant dayEnd = date.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);

        long pointCount = locationRepo.countByUserAndTimeRange(userId, dayStart, dayEnd);
        double distance = 0;
        if (pointCount > 1) {
            distance = locationRepo.calculateTotalDistance(userId, dayStart, dayEnd);
        }

        DailyStat stat = dailyStatRepo.findByUserIdAndStatDate(userId, date)
                .orElse(DailyStat.builder()
                        .user(null) // Will be set below
                        .statDate(date)
                        .build());

        stat.setTotalPoints((int) pointCount);
        stat.setTotalDistanceM(distance);

        // If new, we need to set the user reference
        if (stat.getId() == null) {
            // Fetch user lazily — the scheduler passes userId
            // For simplicity, create a proxy reference
            stat.setUser(new com.geotrail.auth.entity.User());
            stat.getUser().setId(userId);
        }

        dailyStatRepo.save(stat);
        log.debug("Computed stats for user {} on {}: {} points, {:.0f}m", userId, date, pointCount, distance);
    }

    private DailyStatDto toDto(DailyStat stat) {
        return DailyStatDto.builder()
                .statDate(stat.getStatDate())
                .totalDistanceM(stat.getTotalDistanceM())
                .totalPoints(stat.getTotalPoints())
                .citiesVisited(stat.getCitiesVisited())
                .countriesVisited(stat.getCountriesVisited())
                .timeAtHomeMin(stat.getTimeAtHomeMin())
                .timeInTransitMin(stat.getTimeInTransitMin())
                .build();
    }
}
