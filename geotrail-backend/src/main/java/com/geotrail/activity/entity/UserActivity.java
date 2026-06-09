package com.geotrail.activity.entity;

import com.geotrail.auth.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "user_activity")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserActivity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "activity_type", nullable = false, length = 50)
    private String activityType;

    /** User/AI override of {@link #activityType}; null means use the original. */
    @Column(name = "corrected_activity_type", length = 50)
    private String correctedActivityType;

    /** Where the correction came from: 'manual' or 'ai'. Null when uncorrected. */
    @Column(name = "correction_source", length = 20)
    private String correctionSource;

    @Column(name = "activity_date", nullable = false)
    private LocalDate activityDate;

    @Column(columnDefinition = "TEXT")
    private String details;

    @Column(name = "distance_meters")
    private Double distanceMeters;

    @Column
    private Double probability;

    /** Start/end instants of the travel segment (from Google Timeline). */
    @Column(name = "start_time")
    private Instant startTime;

    @Column(name = "end_time")
    private Instant endTime;

    @Column(name = "start_lat", precision = 10, scale = 7)
    private BigDecimal startLat;

    @Column(name = "start_lng", precision = 10, scale = 7)
    private BigDecimal startLng;

    @Column(name = "end_lat", precision = 10, scale = 7)
    private BigDecimal endLat;

    @Column(name = "end_lng", precision = 10, scale = 7)
    private BigDecimal endLng;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
