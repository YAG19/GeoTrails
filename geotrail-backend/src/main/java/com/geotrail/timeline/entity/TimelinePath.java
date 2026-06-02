package com.geotrail.timeline.entity;

import com.geotrail.auth.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Raw GPS breadcrumb extracted from a Google Timeline movement segment
 * ({@code semanticSegments[].timelinePath[]}). One row per recorded point.
 */
@Entity
@Table(name = "timeline_paths")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TimelinePath {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Start time of the segment this breadcrumb belongs to. */
    @Column(name = "segment_start")
    private Instant segmentStart;

    @Column(name = "lat", precision = 10, scale = 7)
    private BigDecimal lat;

    @Column(name = "lng", precision = 10, scale = 7)
    private BigDecimal lng;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
