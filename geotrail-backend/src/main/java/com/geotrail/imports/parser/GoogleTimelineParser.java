package com.geotrail.imports.parser;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.geotrail.location.dto.LocationDtos.CreateRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Parses Google Timeline / Location History export files.
 *
 * Google has used multiple export formats over the years:
 *
 * 1. OLD format (pre-2024): "Location History.json"
 *    { "locations": [ { "latitudeE7": 407128000, "longitudeE7": -740060000, "timestampMs": "..." } ] }
 *
 * 2. NEW format (2024+): "Records.json" from Google Takeout
 *    { "locations": [ { "latitudeE7": 407128000, "longitudeE7": -740060000, "timestamp": "2024-01-01T00:00:00Z" } ] }
 *
 * 3. SEMANTIC format: "Semantic Location History" with placeVisit/activitySegment
 *    (parsed separately for visits/trips — not handled here)
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class GoogleTimelineParser {

    private final ObjectMapper objectMapper;

    /**
     * Parse a Google Timeline JSON file and return location points.
     *
     * @param inputStream the uploaded JSON file
     * @return list of parsed location requests
     */
    public ParseResult parse(InputStream inputStream) {
        List<CreateRequest> points = new ArrayList<>();
        int errors = 0;

        try {
            JsonNode root = objectMapper.readTree(inputStream);
            JsonNode locations = root.path("locations");

            if (locations.isMissingNode() || !locations.isArray()) {
                log.warn("No 'locations' array found in JSON. Trying alternative formats...");
                // Try if root itself is an array
                if (root.isArray()) {
                    locations = root;
                } else {
                    return new ParseResult(points, 0, 0, "No 'locations' array found in JSON");
                }
            }

            int total = locations.size();
            log.info("Parsing {} location records from Google Timeline", total);

            for (JsonNode node : locations) {
                try {
                    CreateRequest point = parseLocationNode(node);
                    if (point != null) {
                        points.add(point);
                    }
                } catch (Exception e) {
                    errors++;
                    if (errors <= 10) {
                        log.debug("Failed to parse location node: {}", e.getMessage());
                    }
                }
            }

            log.info("Parsed {}/{} points ({} errors)", points.size(), total, errors);
            return new ParseResult(points, total, errors, null);

        } catch (Exception e) {
            log.error("Failed to parse Google Timeline JSON", e);
            return new ParseResult(points, 0, errors, "Failed to parse JSON: " + e.getMessage());
        }
    }

    private CreateRequest parseLocationNode(JsonNode node) {
        Double lat = null;
        Double lon = null;
        Instant recordedAt = null;

        // --- Latitude ---
        if (node.has("latitudeE7")) {
            lat = node.get("latitudeE7").asDouble() / 1e7;
        } else if (node.has("latitude")) {
            lat = node.get("latitude").asDouble();
        }

        // --- Longitude ---
        if (node.has("longitudeE7")) {
            lon = node.get("longitudeE7").asDouble() / 1e7;
        } else if (node.has("longitude")) {
            lon = node.get("longitude").asDouble();
        }

        // --- Timestamp ---
        if (node.has("timestampMs")) {
            // Old format: milliseconds as string
            recordedAt = Instant.ofEpochMilli(Long.parseLong(node.get("timestampMs").asText()));
        } else if (node.has("timestamp")) {
            String ts = node.get("timestamp").asText();
            try {
                recordedAt = Instant.parse(ts);
            } catch (Exception e) {
                // Try parsing as epoch seconds
                try {
                    recordedAt = Instant.ofEpochSecond(Long.parseLong(ts));
                } catch (NumberFormatException nfe) {
                    log.debug("Unparseable timestamp: {}", ts);
                }
            }
        }

        if (lat == null || lon == null || recordedAt == null) {
            return null;
        }

        // Sanity check coordinates
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            return null;
        }

        CreateRequest request = new CreateRequest();
        request.setLatitude(lat);
        request.setLongitude(lon);
        request.setRecordedAt(recordedAt);
        request.setSource("google_import");

        // Optional fields
        if (node.has("accuracy")) {
            request.setAccuracy(node.get("accuracy").asDouble());
        }
        if (node.has("altitude")) {
            request.setAltitude(node.get("altitude").asDouble());
        }
        if (node.has("velocity")) {
            request.setVelocity(node.get("velocity").asDouble());
        }

        return request;
    }

    // --- Result container ---

    public record ParseResult(
            List<CreateRequest> points,
            int totalRecords,
            int errors,
            String errorMessage
    ) {
        public boolean hasError() {
            return errorMessage != null;
        }
    }
}
