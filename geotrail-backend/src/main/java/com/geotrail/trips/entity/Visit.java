package com.geotrail.trips.entity;

import com.geotrail.auth.entity.User;
import com.geotrail.places.entity.Place;
import jakarta.persistence.*;
import lombok.*;
import org.locationtech.jts.geom.Point;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "visits")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Visit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "place_id")
    private Place place;

    @Column(name = "center_point", columnDefinition = "geometry(Point, 4326)", nullable = false)
    private Point centerPoint;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    @Column(name = "duration_minutes")
    private Integer durationMinutes;

    /** Raw Google placeId for the visited place (e.g. "ChIJ..."). */
    @Column(name = "google_place_id")
    private String googlePlaceId;

    /** HOME, WORK, UNKNOWN, etc. as inferred by Google. */
    @Column(name = "semantic_type", length = 50)
    private String semanticType;

    @Column(name = "lat", precision = 10, scale = 7)
    private BigDecimal lat;

    @Column(name = "lng", precision = 10, scale = 7)
    private BigDecimal lng;

    @Column(name = "probability", precision = 5, scale = 4)
    private BigDecimal probability;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
