package com.geotrail.geocode.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.geotrail.geocode.client.NominatimClient;
import com.geotrail.geocode.entity.GeocodeCache;
import com.geotrail.geocode.repository.GeocodeCacheRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Optional;

/**
 * Resolves coordinates to a human-readable area name, backed by {@link GeocodeCache}.
 *
 * <p>Cache key is lat/lng rounded to 4 decimals (~11m), so nearby points reuse one
 * lookup. On a miss it calls Nominatim once (rate-limited), persists the result, and
 * returns it. On any geocoder failure it returns {@code null} so callers can fall back.
 */
@Service
public class GeocodeService {

    private static final Logger log = LoggerFactory.getLogger(GeocodeService.class);

    private final GeocodeCacheRepository repository;
    private final NominatimClient nominatim;

    public GeocodeService(GeocodeCacheRepository repository, NominatimClient nominatim) {
        this.repository = repository;
        this.nominatim = nominatim;
    }

    /**
     * Returns the best area label for a coordinate, or {@code null} if it cannot be
     * resolved (caller should fall back). Never throws.
     */
    public String resolveAreaName(BigDecimal lat, BigDecimal lng) {
        if (lat == null || lng == null) {
            return null;
        }
        BigDecimal latKey = lat.setScale(4, RoundingMode.HALF_UP);
        BigDecimal lonKey = lng.setScale(4, RoundingMode.HALF_UP);

        Optional<GeocodeCache> cached = repository.findByLatKeyAndLonKey(latKey, lonKey);
        if (cached.isPresent()) {
            return cached.get().getAreaName();
        }

        JsonNode node = nominatim.reverse(latKey.doubleValue(), lonKey.doubleValue());
        if (node == null) {
            return null;
        }
        GeocodeCache entry = toEntity(node, latKey, lonKey);
        try {
            repository.save(entry);
        } catch (DataIntegrityViolationException e) {
            // Concurrent miss inserted the same key first — reuse theirs.
            log.debug("Geocode race for {},{}; reading existing row", latKey, lonKey);
            return repository.findByLatKeyAndLonKey(latKey, lonKey)
                    .map(GeocodeCache::getAreaName)
                    .orElse(entry.getAreaName());
        }
        return entry.getAreaName();
    }

    private GeocodeCache toEntity(JsonNode node, BigDecimal latKey, BigDecimal lonKey) {
        JsonNode addr = node.path("address");
        String suburb = text(addr, "suburb");
        String cityDistrict = text(addr, "city_district");
        String city = firstNonBlank(text(addr, "city"), text(addr, "town"), text(addr, "village"));
        String displayName = text(node, "display_name");

        String areaName = firstNonBlank(suburb, cityDistrict, city, displayName);

        return GeocodeCache.builder()
                .latKey(latKey)
                .lonKey(lonKey)
                .areaName(areaName)
                .displayName(displayName)
                .road(text(addr, "road"))
                .suburb(suburb)
                .cityDistrict(cityDistrict)
                .city(city)
                .state(text(addr, "state"))
                .postcode(text(addr, "postcode"))
                .country(text(addr, "country"))
                .countryCode(text(addr, "country_code"))
                .osmType(text(node, "osm_type"))
                .osmId(node.hasNonNull("osm_id") ? node.get("osm_id").asLong() : null)
                .rawResponse(node.toString())
                .fetchedAt(Instant.now())
                .build();
    }

    private static String text(JsonNode node, String field) {
        JsonNode v = node.path(field);
        return v.isMissingNode() || v.isNull() || v.asText().isBlank() ? null : v.asText();
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) {
                return v;
            }
        }
        return null;
    }
}
