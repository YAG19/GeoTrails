package com.geotrail.geocode.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;

/**
 * Thin client over the public Nominatim reverse-geocoding endpoint
 * ({@code GET /reverse?lat=..&lon=..&format=jsonv2}).
 *
 * <p>Honours the OSM usage policy: sends an identifying {@code User-Agent} and
 * serialises calls to at most one per second (see {@link #rateLimit()}). The public
 * server is rate-limited and must not be used for bulk traffic — callers MUST cache
 * results (see {@code GeocodeService}).
 */
@Component
public class NominatimClient {

    private static final Logger log = LoggerFactory.getLogger(NominatimClient.class);

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final long minIntervalMs;

    private final Object lock = new Object();
    private long lastCallAt = 0L;

    public NominatimClient(
            @Value("${geotrail.geocode.base-url:https://nominatim.openstreetmap.org}") String baseUrl,
            @Value("${geotrail.geocode.user-agent:GeoTrails/1.0 (starboyygg@gmail.com)}") String userAgent,
            @Value("${geotrail.geocode.connect-timeout-ms:5000}") int connectTimeoutMs,
            @Value("${geotrail.geocode.read-timeout-ms:10000}") int readTimeoutMs,
            @Value("${geotrail.geocode.min-interval-ms:1100}") long minIntervalMs,
            ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.minIntervalMs = minIntervalMs;
        SimpleClientHttpRequestFactory rf = new SimpleClientHttpRequestFactory();
        rf.setConnectTimeout(Duration.ofMillis(connectTimeoutMs));
        rf.setReadTimeout(Duration.ofMillis(readTimeoutMs));
        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                // Nominatim rejects requests without a valid identifying User-Agent.
                .defaultHeader("User-Agent", userAgent)
                .requestFactory(rf)
                .build();
    }

    /**
     * Reverse-geocodes a coordinate. Returns the parsed Nominatim JSON, or {@code null}
     * on any failure (transport error, rate-limit block, malformed response) so callers
     * can fall back gracefully — geocoding must never break the calling flow.
     */
    public JsonNode reverse(double lat, double lon) {
        try {
            rateLimit();
            String json = restClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/reverse")
                            .queryParam("lat", lat)
                            .queryParam("lon", lon)
                            .queryParam("format", "jsonv2")
                            .queryParam("addressdetails", 1)
                            .build())
                    .retrieve()
                    .body(String.class);
            if (json == null || json.isBlank()) {
                return null;
            }
            JsonNode node = objectMapper.readTree(json);
            // Nominatim returns {"error": ...} for points it can't resolve.
            if (node.has("error")) {
                log.debug("Nominatim could not resolve {},{}: {}", lat, lon, node.get("error"));
                return null;
            }
            return node;
        } catch (Exception e) {
            log.warn("Nominatim reverse geocode failed for {},{}: {}", lat, lon, e.toString());
            return null;
        }
    }

    /** Blocks until at least {@code minIntervalMs} has elapsed since the previous call. */
    private void rateLimit() {
        synchronized (lock) {
            long now = System.currentTimeMillis();
            long wait = minIntervalMs - (now - lastCallAt);
            if (wait > 0) {
                try {
                    Thread.sleep(wait);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
            lastCallAt = System.currentTimeMillis();
        }
    }
}
