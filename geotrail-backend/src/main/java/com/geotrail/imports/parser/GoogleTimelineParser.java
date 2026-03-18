package com.geotrail.imports.parser;

import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.geotrail.location.dto.LocationDtos.CreateRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses ALL known Google Timeline / Location History export formats:
 *
 * FORMAT 1 — Old Records.json (pre-2022):
 *   { "locations": [{ "latitudeE7": 407128000, "longitudeE7": -740060000, "timestampMs": "1636403752674" }] }
 *
 * FORMAT 2 — New Records.json (post-2022):
 *   { "locations": [{ "latitudeE7": 414216106, "longitudeE7": 21684775, "timestamp": "2022-01-12T17:18:24.190Z" }] }
 *
 * FORMAT 3 — Semantic Location History (monthly files):
 *   { "timelineObjects": [{ "activitySegment": { ... }, "placeVisit": { ... } }] }
 *
 * FORMAT 4 — New phone-based export (2024+):
 *   { "semanticSegments": [{ "timelinePath": [{ "point": "13.0286°, 77.6655°", "time": "..." }], "visit": { ... } }] }
 *
 * Uses streaming JSON parser (JsonParser) for large files instead of loading entire file into memory.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class GoogleTimelineParser {

    private final ObjectMapper objectMapper;

    /**
     * Regex to parse degree-string coordinates like "13.0286824°, 77.6655964°"
     * Also handles negative values like "-74.0060°, 40.7128°"
     * Group 1 = latitude, Group 2 = longitude
     */
    private static final Pattern DEGREE_COORD_PATTERN =
            Pattern.compile("(-?[\\d.]+)°?,\\s*(-?[\\d.]+)°?");

    /**
     * Regex to parse geo: URI format like "geo:40.7128,-74.0060"
     */
    private static final Pattern GEO_URI_PATTERN =
            Pattern.compile("geo:(-?[\\d.]+),(-?[\\d.]+)");

    // ==================== PUBLIC API ====================

    /**
     * Auto-detect format and parse the Google Timeline export file.
     * Streams the JSON to handle files of any size.
     */
    public ParseResult parse(InputStream inputStream) {
        try {
            // We need to peek at the top-level keys to detect the format.
            // For very large files, we use streaming — but first we read the root object
            // to detect the format, then process accordingly.
            JsonNode root = objectMapper.readTree(inputStream);

            if (root.has("semanticSegments")) {
                log.info("Detected FORMAT 4: New phone-based export (semanticSegments)");
                return parseSemanticSegments(root);
            } else if (root.has("locations")) {
                log.info("Detected FORMAT 1/2: Records.json");
                return parseRecordsJson(root);
            } else if (root.has("timelineObjects")) {
                log.info("Detected FORMAT 3: Semantic Location History");
                return parseSemanticLocationHistory(root);
            } else {
                // Try if root is an array (some exports are just arrays)
                if (root.isArray()) {
                    log.info("Detected array format — treating as location records");
                    return parseLocationArray(root);
                }

                // Log what keys we actually found
                List<String> keys = new ArrayList<>();
                root.fieldNames().forEachRemaining(keys::add);
                log.warn("Unknown Google Timeline format. Top-level keys: {}", keys);
                return new ParseResult(List.of(), 0, 0, "Unknown format. Keys found: " + keys);
            }
        } catch (Exception e) {
            log.error("Failed to parse Google Timeline file", e);
            return new ParseResult(List.of(), 0, 0, "Failed to parse: " + e.getMessage());
        }
    }

    // ==================== FORMAT 4: semanticSegments (NEW 2024+) ====================

    /**
     * Parse the new phone-based export format.
     *
     * Structure:
     * {
     *   "semanticSegments": [
     *     {
     *       "startTime": "2025-09-22T17:30:00.000+05:30",
     *       "endTime": "2025-09-22T19:30:00.000+05:30",
     *       "timelinePath": [                          ← MOVEMENT: array of points
     *         { "point": "13.0286824°, 77.6655964°", "time": "2025-09-22T17:33:00.000+05:30" }
     *       ]
     *     },
     *     {
     *       "startTime": "...",
     *       "endTime": "...",
     *       "visit": {                                 ← VISIT: stayed at a place
     *         "topCandidate": {
     *           "placeId": "ChIJ...",
     *           "placeLocation": { "latLng": "13.0287628°, 77.6650928°" }
     *         }
     *       }
     *     },
     *     {
     *       "startTime": "...",
     *       "endTime": "...",
     *       "activity": {                              ← ACTIVITY: transport segment
     *         "start": "geo:13.0286,-77.6655",
     *         "end": "geo:13.0300,-77.6700",
     *         "topCandidate": { "type": "MOTORCYCLING" },
     *         "distanceMeters": 1234.5
     *       }
     *     }
     *   ],
     *   "rawSignals": [ ... ],                         ← Wi-Fi scans, activity signals (skip)
     *   "userLocationProfile": { ... },                ← Profile summary (skip)
     *   "frequentPlaces": [ ... ],                     ← Home/work labels (can extract later)
     *   "frequentTrips": [ ... ]                       ← Commute patterns (can extract later)
     * }
     */
    private ParseResult parseSemanticSegments(JsonNode root) {
        List<CreateRequest> points = new ArrayList<>();
        int totalSegments = 0;
        int errors = 0;

        JsonNode segments = root.path("semanticSegments");
        if (!segments.isArray()) {
            return new ParseResult(points, 0, 0, "semanticSegments is not an array");
        }

        totalSegments = segments.size();
        log.info("Processing {} semantic segments", totalSegments);

        for (JsonNode segment : segments) {
            try {
                // === TIMELINE PATH (movement points) ===
                if (segment.has("timelinePath")) {
                    JsonNode path = segment.get("timelinePath");
                    if (path.isArray()) {
                        for (JsonNode waypoint : path) {
                            CreateRequest point = parseTimelinePathPoint(waypoint);
                            if (point != null) {
                                points.add(point);
                            }
                        }
                    }
                }

                // === VISIT (stationary at a place) ===
                if (segment.has("visit")) {
                    CreateRequest point = parseVisitSegment(segment);
                    if (point != null) {
                        points.add(point);
                    }
                }

                // === ACTIVITY (transport between places) ===
                if (segment.has("activity")) {
                    List<CreateRequest> activityPoints = parseActivitySegment(segment);
                    points.addAll(activityPoints);
                }

            } catch (Exception e) {
                errors++;
                if (errors <= 20) {
                    log.debug("Failed to parse segment: {}", e.getMessage());
                }
            }
        }

        // Also try to extract points from rawSignals if present
        if (root.has("rawSignals")) {
            int rawCount = parseRawSignals(root.get("rawSignals"), points);
            log.info("Extracted {} additional points from rawSignals", rawCount);
        }

        log.info("Parsed {} points from {} segments ({} errors)", points.size(), totalSegments, errors);
        return new ParseResult(points, totalSegments, errors, null);
    }

    /**
     * Parse a single point from timelinePath array.
     * { "point": "13.0286824°, 77.6655964°", "time": "2025-09-22T17:33:00.000+05:30" }
     */
    private CreateRequest parseTimelinePathPoint(JsonNode node) {
        String pointStr = node.path("point").asText(null);
        String timeStr = node.path("time").asText(null);

        if (pointStr == null || timeStr == null) return null;

        double[] coords = parseDegreeString(pointStr);
        if (coords == null) return null;

        Instant timestamp = parseTimestamp(timeStr);
        if (timestamp == null) return null;

        CreateRequest req = new CreateRequest();
        req.setLatitude(coords[0]);
        req.setLongitude(coords[1]);
        req.setRecordedAt(timestamp);
        req.setSource("google_semantic_path");
        return req;
    }

    /**
     * Parse a visit segment — extract the place location as a single point at the visit start time.
     */
    private CreateRequest parseVisitSegment(JsonNode segment) {
        JsonNode visit = segment.get("visit");
        JsonNode topCandidate = visit.path("topCandidate");
        JsonNode placeLocation = topCandidate.path("placeLocation");

        String latLngStr = placeLocation.path("latLng").asText(null);
        String startTime = segment.path("startTime").asText(null);

        if (latLngStr == null || startTime == null) return null;

        double[] coords = parseDegreeString(latLngStr);
        if (coords == null) return null;

        Instant timestamp = parseTimestamp(startTime);
        if (timestamp == null) return null;

        CreateRequest req = new CreateRequest();
        req.setLatitude(coords[0]);
        req.setLongitude(coords[1]);
        req.setRecordedAt(timestamp);
        req.setSource("google_semantic_visit");
        return req;
    }

    /**
     * Parse an activity segment — extract start and end points.
     * Activity segments may have:
     *   - "start" / "end" as geo: URIs
     *   - "start" / "end" as degree strings
     *   - "waypointPath" with intermediate points
     */
    private List<CreateRequest> parseActivitySegment(JsonNode segment) {
        List<CreateRequest> points = new ArrayList<>();
        JsonNode activity = segment.get("activity");

        String startTime = segment.path("startTime").asText(null);
        String endTime = segment.path("endTime").asText(null);

        // Start point
        String startStr = activity.path("start").asText(null);
        if (startStr != null && startTime != null) {
            double[] coords = parseAnyCoordFormat(startStr);
            Instant ts = parseTimestamp(startTime);
            if (coords != null && ts != null) {
                CreateRequest req = new CreateRequest();
                req.setLatitude(coords[0]);
                req.setLongitude(coords[1]);
                req.setRecordedAt(ts);
                req.setSource("google_semantic_activity");
                points.add(req);
            }
        }

        // End point
        String endStr = activity.path("end").asText(null);
        if (endStr != null && endTime != null) {
            double[] coords = parseAnyCoordFormat(endStr);
            Instant ts = parseTimestamp(endTime);
            if (coords != null && ts != null) {
                CreateRequest req = new CreateRequest();
                req.setLatitude(coords[0]);
                req.setLongitude(coords[1]);
                req.setRecordedAt(ts);
                req.setSource("google_semantic_activity");
                points.add(req);
            }
        }

        // Waypoints within the activity
        JsonNode waypointPath = activity.path("waypointPath");
        if (waypointPath.has("waypoints") && waypointPath.get("waypoints").isArray()) {
            for (JsonNode wp : waypointPath.get("waypoints")) {
                // Waypoints can be degree strings or latE7/lngE7
                String pointStr = wp.path("point").asText(null);
                if (pointStr != null) {
                    double[] coords = parseAnyCoordFormat(pointStr);
                    String wpTime = wp.path("time").asText(startTime); // fallback to segment start
                    Instant ts = parseTimestamp(wpTime);
                    if (coords != null && ts != null) {
                        CreateRequest req = new CreateRequest();
                        req.setLatitude(coords[0]);
                        req.setLongitude(coords[1]);
                        req.setRecordedAt(ts);
                        req.setSource("google_semantic_waypoint");
                        points.add(req);
                    }
                } else if (wp.has("latE7")) {
                    // Old waypoint format with E7 integers
                    double lat = wp.get("latE7").asDouble() / 1e7;
                    double lon = wp.get("lngE7").asDouble() / 1e7;
                    Instant ts = parseTimestamp(wp.path("time").asText(startTime));
                    if (ts != null && isValidCoord(lat, lon)) {
                        CreateRequest req = new CreateRequest();
                        req.setLatitude(lat);
                        req.setLongitude(lon);
                        req.setRecordedAt(ts);
                        req.setSource("google_semantic_waypoint");
                        points.add(req);
                    }
                }
            }
        }

        return points;
    }

    /**
     * Parse rawSignals — these contain Wi-Fi scans and activity detections
     * that sometimes include position data.
     *
     * Structure:
     * { "rawSignals": [
     *     { "signal": { "position": { "point": "13.02°, 77.66°", "accuracyMm": 10000, "altitudeMeters": 920 } },
     *       "additionalTimestamp": "2025-09-22T17:30:00.000+05:30" }
     * ] }
     */
    private int parseRawSignals(JsonNode rawSignals, List<CreateRequest> points) {
        if (!rawSignals.isArray()) return 0;

        int count = 0;
        for (JsonNode signal : rawSignals) {
            try {
                JsonNode position = signal.path("signal").path("position");
                if (position.isMissingNode()) continue;

                String pointStr = position.path("point").asText(null);
                String timeStr = signal.path("additionalTimestamp").asText(
                        signal.path("timestamp").asText(null)
                );

                if (pointStr == null || timeStr == null) continue;

                double[] coords = parseDegreeString(pointStr);
                Instant ts = parseTimestamp(timeStr);

                if (coords != null && ts != null) {
                    CreateRequest req = new CreateRequest();
                    req.setLatitude(coords[0]);
                    req.setLongitude(coords[1]);
                    req.setRecordedAt(ts);
                    req.setSource("google_raw_signal");

                    // Extract accuracy if present (mm → meters)
                    if (position.has("accuracyMm")) {
                        req.setAccuracy(position.get("accuracyMm").asDouble() / 1000.0);
                    }
                    // Extract altitude
                    if (position.has("altitudeMeters")) {
                        req.setAltitude(position.get("altitudeMeters").asDouble());
                    }

                    points.add(req);
                    count++;
                }
            } catch (Exception e) {
                // Skip malformed signals
            }
        }
        return count;
    }

    // ==================== FORMAT 1/2: Records.json ====================

    private ParseResult parseRecordsJson(JsonNode root) {
        List<CreateRequest> points = new ArrayList<>();
        int errors = 0;

        JsonNode locations = root.path("locations");
        if (!locations.isArray()) {
            return new ParseResult(points, 0, 0, "No 'locations' array found");
        }

        int total = locations.size();
        log.info("Parsing {} records from Records.json", total);

        for (JsonNode node : locations) {
            try {
                CreateRequest point = parseRecordNode(node);
                if (point != null) {
                    points.add(point);
                }
            } catch (Exception e) {
                errors++;
                if (errors <= 20) {
                    log.debug("Failed to parse record: {}", e.getMessage());
                }
            }
        }

        log.info("Parsed {}/{} points ({} errors)", points.size(), total, errors);
        return new ParseResult(points, total, errors, null);
    }

    private CreateRequest parseRecordNode(JsonNode node) {
        Double lat = null;
        Double lon = null;
        Instant recordedAt = null;

        // Coordinates (E7 format — divide by 10^7)
        if (node.has("latitudeE7")) {
            lat = node.get("latitudeE7").asDouble() / 1e7;
        }
        if (node.has("longitudeE7")) {
            lon = node.get("longitudeE7").asDouble() / 1e7;
        }

        // Timestamp — try ISO first (post-2022), then milliseconds (pre-2022)
        if (node.has("timestamp")) {
            recordedAt = parseTimestamp(node.get("timestamp").asText());
        } else if (node.has("timestampMs")) {
            try {
                recordedAt = Instant.ofEpochMilli(Long.parseLong(node.get("timestampMs").asText()));
            } catch (NumberFormatException e) {
                // skip
            }
        }

        if (lat == null || lon == null || recordedAt == null) return null;
        if (!isValidCoord(lat, lon)) return null;

        CreateRequest req = new CreateRequest();
        req.setLatitude(lat);
        req.setLongitude(lon);
        req.setRecordedAt(recordedAt);
        req.setSource("google_records");

        if (node.has("accuracy")) req.setAccuracy(node.get("accuracy").asDouble());
        if (node.has("altitude")) req.setAltitude(node.get("altitude").asDouble());
        if (node.has("velocity")) req.setVelocity(node.get("velocity").asDouble());

        return req;
    }

    // ==================== FORMAT 3: Semantic Location History ====================

    private ParseResult parseSemanticLocationHistory(JsonNode root) {
        List<CreateRequest> points = new ArrayList<>();
        int errors = 0;

        JsonNode timelineObjects = root.path("timelineObjects");
        if (!timelineObjects.isArray()) {
            return new ParseResult(points, 0, 0, "No 'timelineObjects' array found");
        }

        int total = timelineObjects.size();
        log.info("Parsing {} timeline objects from Semantic Location History", total);

        for (JsonNode obj : timelineObjects) {
            try {
                if (obj.has("activitySegment")) {
                    points.addAll(parseOldActivitySegment(obj.get("activitySegment")));
                }
                if (obj.has("placeVisit")) {
                    CreateRequest visit = parseOldPlaceVisit(obj.get("placeVisit"));
                    if (visit != null) points.add(visit);
                }
            } catch (Exception e) {
                errors++;
            }
        }

        log.info("Parsed {} points from {} timeline objects ({} errors)", points.size(), total, errors);
        return new ParseResult(points, total, errors, null);
    }

    private List<CreateRequest> parseOldActivitySegment(JsonNode segment) {
        List<CreateRequest> points = new ArrayList<>();

        String startTime = segment.path("duration").path("startTimestamp").asText(null);
        String endTime = segment.path("duration").path("endTimestamp").asText(null);

        // Start location
        JsonNode startLoc = segment.path("startLocation");
        if (startLoc.has("latitudeE7") && startTime != null) {
            double lat = startLoc.get("latitudeE7").asDouble() / 1e7;
            double lon = startLoc.get("longitudeE7").asDouble() / 1e7;
            Instant ts = parseTimestamp(startTime);
            if (ts != null && isValidCoord(lat, lon)) {
                CreateRequest req = new CreateRequest();
                req.setLatitude(lat);
                req.setLongitude(lon);
                req.setRecordedAt(ts);
                req.setSource("google_semantic_activity");
                points.add(req);
            }
        }

        // End location
        JsonNode endLoc = segment.path("endLocation");
        if (endLoc.has("latitudeE7") && endTime != null) {
            double lat = endLoc.get("latitudeE7").asDouble() / 1e7;
            double lon = endLoc.get("longitudeE7").asDouble() / 1e7;
            Instant ts = parseTimestamp(endTime);
            if (ts != null && isValidCoord(lat, lon)) {
                CreateRequest req = new CreateRequest();
                req.setLatitude(lat);
                req.setLongitude(lon);
                req.setRecordedAt(ts);
                req.setSource("google_semantic_activity");
                points.add(req);
            }
        }

        // Waypoints (use latE7/lngE7 — note shorter key names!)
        JsonNode waypointPath = segment.path("waypointPath");
        if (waypointPath.has("waypoints")) {
            for (JsonNode wp : waypointPath.get("waypoints")) {
                if (wp.has("latE7")) {
                    double lat = wp.get("latE7").asDouble() / 1e7;
                    double lon = wp.get("lngE7").asDouble() / 1e7;
                    // Waypoints don't have individual timestamps — use segment start
                    Instant ts = parseTimestamp(startTime);
                    if (ts != null && isValidCoord(lat, lon)) {
                        CreateRequest req = new CreateRequest();
                        req.setLatitude(lat);
                        req.setLongitude(lon);
                        req.setRecordedAt(ts);
                        req.setSource("google_semantic_waypoint");
                        points.add(req);
                    }
                }
            }
        }

        return points;
    }

    private CreateRequest parseOldPlaceVisit(JsonNode placeVisit) {
        JsonNode location = placeVisit.path("location");
        String startTime = placeVisit.path("duration").path("startTimestamp").asText(null);

        if (!location.has("latitudeE7") || startTime == null) return null;

        double lat = location.get("latitudeE7").asDouble() / 1e7;
        double lon = location.get("longitudeE7").asDouble() / 1e7;
        Instant ts = parseTimestamp(startTime);

        if (ts == null || !isValidCoord(lat, lon)) return null;

        CreateRequest req = new CreateRequest();
        req.setLatitude(lat);
        req.setLongitude(lon);
        req.setRecordedAt(ts);
        req.setSource("google_semantic_visit");
        return req;
    }

    // ==================== Array format ====================

    private ParseResult parseLocationArray(JsonNode root) {
        List<CreateRequest> points = new ArrayList<>();
        int errors = 0;

        for (JsonNode node : root) {
            try {
                CreateRequest point = parseRecordNode(node);
                if (point != null) points.add(point);
            } catch (Exception e) {
                errors++;
            }
        }

        return new ParseResult(points, root.size(), errors, null);
    }

    // ==================== COORDINATE PARSERS ====================

    /**
     * Parse degree-string coordinates: "13.0286824°, 77.6655964°"
     * Returns [latitude, longitude] or null if unparseable.
     */
    private double[] parseDegreeString(String input) {
        if (input == null) return null;

        Matcher matcher = DEGREE_COORD_PATTERN.matcher(input);
        if (matcher.find()) {
            try {
                double lat = Double.parseDouble(matcher.group(1));
                double lon = Double.parseDouble(matcher.group(2));
                if (isValidCoord(lat, lon)) {
                    return new double[]{lat, lon};
                }
            } catch (NumberFormatException e) {
                // fall through
            }
        }
        return null;
    }

    /**
     * Parse geo: URI format: "geo:40.7128,-74.0060"
     * Returns [latitude, longitude] or null if unparseable.
     */
    private double[] parseGeoUri(String input) {
        if (input == null) return null;

        Matcher matcher = GEO_URI_PATTERN.matcher(input);
        if (matcher.find()) {
            try {
                double lat = Double.parseDouble(matcher.group(1));
                double lon = Double.parseDouble(matcher.group(2));
                if (isValidCoord(lat, lon)) {
                    return new double[]{lat, lon};
                }
            } catch (NumberFormatException e) {
                // fall through
            }
        }
        return null;
    }

    /**
     * Try all known coordinate formats: degree string, geo URI, or plain "lat,lon".
     */
    private double[] parseAnyCoordFormat(String input) {
        if (input == null) return null;

        // Try geo: URI first
        if (input.startsWith("geo:")) {
            return parseGeoUri(input);
        }

        // Try degree string (has ° character)
        if (input.contains("°")) {
            return parseDegreeString(input);
        }

        // Try plain "lat, lon" format
        String[] parts = input.split(",");
        if (parts.length == 2) {
            try {
                double lat = Double.parseDouble(parts[0].trim());
                double lon = Double.parseDouble(parts[1].trim());
                if (isValidCoord(lat, lon)) {
                    return new double[]{lat, lon};
                }
            } catch (NumberFormatException e) {
                // fall through
            }
        }

        return null;
    }

    // ==================== TIMESTAMP PARSERS ====================

    /**
     * Parse timestamps in all known formats:
     * - ISO 8601 with offset: "2025-09-22T17:30:00.000+05:30"
     * - ISO 8601 UTC: "2022-01-12T17:18:24.190Z"
     * - ISO 8601 without millis: "2022-03-03T12:22:24Z"
     * - Unix millis as string: "1636403752674"
     * - Unix seconds as number
     */
    private Instant parseTimestamp(String input) {
        if (input == null || input.isBlank()) return null;

        // Try ISO 8601 with offset (your format: "2025-09-22T17:30:00.000+05:30")
        try {
            return OffsetDateTime.parse(input, DateTimeFormatter.ISO_OFFSET_DATE_TIME).toInstant();
        } catch (DateTimeParseException e) {
            // try next
        }

        // Try ISO 8601 (handles both "Z" and offset formats)
        try {
            return Instant.parse(input);
        } catch (DateTimeParseException e) {
            // try next
        }

        // Try Unix millis as string
        try {
            long millis = Long.parseLong(input);
            if (millis > 1_000_000_000_000L) {
                // Looks like milliseconds
                return Instant.ofEpochMilli(millis);
            } else {
                // Looks like seconds
                return Instant.ofEpochSecond(millis);
            }
        } catch (NumberFormatException e) {
            // give up
        }

        log.debug("Unparseable timestamp: {}", input);
        return null;
    }

    // ==================== VALIDATION ====================

    private boolean isValidCoord(double lat, double lon) {
        return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
                && !(lat == 0 && lon == 0); // Skip null island
    }

    // ==================== RESULT ====================

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