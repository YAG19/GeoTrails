package com.geotrail.stats.scheduler;

import com.geotrail.auth.repository.UserRepository;
import com.geotrail.stats.service.StatsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/**
 * Nightly job to compute daily statistics for all users.
 * Runs at 2:00 AM UTC every day.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class StatsComputeScheduler {

    private final StatsService statsService;
    private final UserRepository userRepository;

    @Scheduled(cron = "0 0 2 * * *")  // 2:00 AM UTC daily
    @CacheEvict(value = {"dashboardSummary", "dailyStats"}, allEntries = true)
    public void computeDailyStats() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        log.info("Starting nightly stats computation for {}", yesterday);

        userRepository.findAll().forEach(user -> {
            try {
                statsService.computeStatsForDate(user.getId(), yesterday);
            } catch (Exception e) {
                log.error("Failed to compute stats for user {} on {}", user.getUsername(), yesterday, e);
            }
        });

        log.info("Nightly stats computation completed for {}", yesterday);
    }
}
