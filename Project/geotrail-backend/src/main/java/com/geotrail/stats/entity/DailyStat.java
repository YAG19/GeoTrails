package com.geotrail.stats.entity;

import com.geotrail.auth.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "daily_stats",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "stat_date"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DailyStat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "stat_date", nullable = false)
    private LocalDate statDate;

    @Column(name = "total_distance_m")
    @Builder.Default
    private Double totalDistanceM = 0.0;

    @Column(name = "total_points")
    @Builder.Default
    private Integer totalPoints = 0;

    @Column(name = "cities_visited")
    @Builder.Default
    private Integer citiesVisited = 0;

    @Column(name = "countries_visited")
    @Builder.Default
    private Integer countriesVisited = 0;

    @Column(name = "time_at_home_min")
    @Builder.Default
    private Integer timeAtHomeMin = 0;

    @Column(name = "time_in_transit_min")
    @Builder.Default
    private Integer timeInTransitMin = 0;
}
