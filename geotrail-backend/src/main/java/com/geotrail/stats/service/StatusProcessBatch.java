package com.geotrail.stats.service;

import com.geotrail.auth.entity.User;
import com.geotrail.location.repository.LocationPointRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class StatusProcessBatch {

    private final LocationPointRepository locationPointRepository;
    private final StatsService statsService;

    public void processDailyStat(Long userId) {
//        Long userId = user.getId();

        Optional<LocalDate> startOpt = locationPointRepository.findEarliestDateByUserId(userId);
        Optional<LocalDate> endOpt   = locationPointRepository.findLatestDateByUserId(userId);

        if (startOpt.isEmpty() || endOpt.isEmpty()) {
            log.info("No location data found for user {}, skipping batch", userId);
            return;
        }

        LocalDate startDate = startOpt.get();
        LocalDate endDate   = endOpt.get();

        log.info("Processing daily stats for user {} from {} to {}", userId, startDate, endDate);

        for (LocalDate date = startDate; !date.isAfter(endDate); date = date.plusDays(1)) {
            try {
                statsService.computeStatsForDate(userId, date);
            } catch (Exception e) {
                log.error("Failed to compute stats for user {} on {}", userId, date, e);
            }
        }

        log.info("Finished daily stats batch for user {} ({} days)", userId,
                startDate.until(endDate).getDays() + 1);
    }
}
