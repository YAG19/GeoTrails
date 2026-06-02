package com.geotrail.geocode.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * A single reverse-geocoded coordinate, keyed on lat/lng rounded to 4 decimals.
 * One row serves every point that rounds to the same key, across all users.
 */
@Entity
@Table(name = "geocode_cache",
        uniqueConstraints = @UniqueConstraint(name = "uq_geocode_latlon",
                columnNames = {"lat_key", "lon_key"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GeocodeCache {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "lat_key", precision = 9, scale = 4, nullable = false)
    private BigDecimal latKey;

    @Column(name = "lon_key", precision = 9, scale = 4, nullable = false)
    private BigDecimal lonKey;

    /** Best human-readable area label (suburb -> city_district -> city -> display_name). */
    @Column(name = "area_name")
    private String areaName;

    @Column(name = "display_name", columnDefinition = "text")
    private String displayName;

    private String road;
    private String suburb;

    @Column(name = "city_district")
    private String cityDistrict;

    private String city;
    private String state;
    private String postcode;
    private String country;

    @Column(name = "country_code", length = 8)
    private String countryCode;

    @Column(name = "osm_type", length = 20)
    private String osmType;

    @Column(name = "osm_id")
    private Long osmId;

    @Column(name = "raw_response", columnDefinition = "text")
    private String rawResponse;

    @Column(name = "fetched_at", nullable = false)
    @Builder.Default
    private Instant fetchedAt = Instant.now();
}
