package com.geotrail.location.entity;

import com.geotrail.auth.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "heatmap_tiles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HeatmapTile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "lat_bucket", nullable = false, precision = 7, scale = 5)
    private BigDecimal latBucket;

    @Column(name = "lng_bucket", nullable = false, precision = 8, scale = 5)
    private BigDecimal lngBucket;

    @Column(name = "point_count", nullable = false)
    private Integer pointCount;

    @Column(name = "computed_at", nullable = false)
    @Builder.Default
    private Instant computedAt = Instant.now();
}
