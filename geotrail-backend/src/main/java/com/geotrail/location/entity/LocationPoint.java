package com.geotrail.location.entity;

import com.geotrail.auth.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.locationtech.jts.geom.Point;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "location_points")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LocationPoint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /**
     * PostGIS Point geometry — stores (longitude, latitude) in SRID 4326 (WGS84).
     * IMPORTANT: JTS Point uses (x=longitude, y=latitude) order.
     */
    @Column(columnDefinition = "geometry(Point, 4326)", nullable = false)
    private Point coordinates;

    private Double altitude;

    private Double accuracy;

    @Column(name = "battery_level")
    private Short batteryLevel;

    private Double velocity;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String source = "live";

    @Column(name = "activity_type", length = 50)
    private String activityType;

    @Column(name = "distance_meters")
    private Double distanceMeters;

    /**
     * Store original payload as JSONB.
     *
     * The key issue: Hibernate by default binds String as VARCHAR.
     * PostgreSQL rejects VARCHAR → JSONB implicit cast.
     *
     * Fix: @JdbcTypeCode(SqlTypes.JSON) tells Hibernate to use PG's JSON type
     * when binding the parameter, so PostgreSQL accepts it.
     *
     * Alternative fix (application.yml):
     *   spring.jpa.properties.hibernate.dialect.non_contextual_creation=true
     *   spring.datasource.hikari.data-source-properties.stringtype=unspecified
     * But that's a global nuclear option — @JdbcTypeCode is per-field and explicit.
     */
    @Column(name = "raw_payload", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String rawPayload;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    // --- Convenience getters for lat/lon ---

    public double getLongitude() {
        return coordinates != null ? coordinates.getX() : 0;
    }

    public double getLatitude() {
        return coordinates != null ? coordinates.getY() : 0;
    }
}
