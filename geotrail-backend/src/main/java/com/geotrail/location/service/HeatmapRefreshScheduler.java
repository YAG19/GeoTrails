package com.geotrail.location.service;

import com.geotrail.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class HeatmapRefreshScheduler {

    private final LocationService locationService;
    private final UserRepository userRepository;

    // Runs nightly at 3 AM UTC — after the stats scheduler (2 AM)
    @Scheduled(cron = "0 0 3 * * *")
    public void refreshAll() {
        log.info("Starting nightly heatmap tile refresh for all users");
        userRepository.findAll().forEach(user -> {
            try {
                locationService.refreshHeatmapTiles(user.getId());
            } catch (Exception e) {
                log.error("Heatmap refresh failed for user {}: {}", user.getId(), e.getMessage());
            }
        });
        log.info("Nightly heatmap tile refresh complete");
    }
}
