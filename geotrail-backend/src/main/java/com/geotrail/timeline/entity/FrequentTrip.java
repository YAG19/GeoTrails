package com.geotrail.timeline.entity;

import com.geotrail.auth.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * A recurring trip mined from the Google Timeline export ({@code frequentTrips} /
 * commute patterns). One row per pattern, e.g. home -> work. Stored as a per-user
 * snapshot of the latest import.
 */
@Entity
@Table(name = "frequent_trips")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FrequentTrip {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "origin_lat", precision = 10, scale = 7)
    private BigDecimal originLat;

    @Column(name = "origin_lng", precision = 10, scale = 7)
    private BigDecimal originLng;

    @Column(name = "dest_lat", precision = 10, scale = 7)
    private BigDecimal destLat;

    @Column(name = "dest_lng", precision = 10, scale = 7)
    private BigDecimal destLng;

    @Column(name = "origin_place_id")
    private String originPlaceId;

    @Column(name = "dest_place_id")
    private String destPlaceId;

    @Column(name = "trip_count")
    private Integer tripCount;

    @Column(name = "typical_mode", length = 50)
    private String typicalMode;

    @Column(name = "distance_meters")
    private Double distanceMeters;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
