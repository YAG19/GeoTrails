package com.geotrail.trips.entity;

import com.geotrail.auth.entity.User;
import com.geotrail.places.entity.Place;
import jakarta.persistence.*;
import lombok.*;
import org.locationtech.jts.geom.LineString;

import java.time.Instant;

@Entity
@Table(name = "trips")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Trip {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "ended_at", nullable = false)
    private Instant endedAt;

    @Column(name = "distance_meters")
    private Double distanceMeters;

    @Column(columnDefinition = "geometry(LineString, 4326)")
    private LineString route;

    @Column(name = "transport_mode", length = 30)
    private String transportMode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "from_place_id")
    private Place fromPlace;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "to_place_id")
    private Place toPlace;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
