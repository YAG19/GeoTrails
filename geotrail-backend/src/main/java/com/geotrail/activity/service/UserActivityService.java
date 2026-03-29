package com.geotrail.activity.service;

import com.geotrail.activity.entity.UserActivity;
import com.geotrail.activity.repository.UserActivityRepository;
import com.geotrail.auth.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserActivityService {

    private final UserActivityRepository userActivityRepository;

    public UserActivity save(User user, String activityType, LocalDate activityDate,
                             String details, Double distanceMeters, Double probability) {
        UserActivity activity = UserActivity.builder()
                .user(user)
                .activityType(activityType)
                .activityDate(activityDate)
                .details(details)
                .distanceMeters(distanceMeters)
                .probability(probability)
                .build();

        UserActivity saved = userActivityRepository.save(activity);
        log.info("Saved activity '{}' for user {} on {}", activityType, user.getUsername(), activityDate);
        return saved;
    }

    public List<UserActivity> getActivitiesForUser(Long userId) {
        return userActivityRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }
}
