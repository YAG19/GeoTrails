package com.geotrail.mcp;

import com.geotrail.auth.entity.User;
import com.geotrail.auth.repository.UserRepository;
import com.geotrail.places.dto.PlaceDtos;
import com.geotrail.places.service.PlaceService;
import com.geotrail.stats.dto.DashboardSummaryDto;
import com.geotrail.stats.service.StatsService;
import com.geotrail.timeline.dto.TimelineDtos.DayTimelineDto;
import com.geotrail.timeline.dto.TimelineDtos.SegmentDto;
import com.geotrail.timeline.service.TimelineService;
import io.modelcontextprotocol.server.McpServerFeatures.SyncToolSpecification;
import io.modelcontextprotocol.spec.McpSchema.CallToolResult;
import io.modelcontextprotocol.spec.McpSchema.Tool;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * Defines the read-only MCP tools an AI assistant (Claude Desktop, the MCP
 * Inspector, etc.) can call against GeoTrail. Each tool is a thin wrapper that
 * resolves the configured user, calls an existing service, and renders the
 * result as plain text — the shape MCP clients feed back to the model.
 *
 * <p>This is a proof-of-concept: it serves a single configured user (see
 * {@code geotrail.mcp.username}) and exposes no write operations.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class GeoTrailMcpTools {

    private static final DateTimeFormatter UTC_TIME =
            DateTimeFormatter.ofPattern("HH:mm").withZone(ZoneOffset.UTC);

    private final TimelineService timelineService;
    private final StatsService statsService;
    private final PlaceService placeService;
    private final UserRepository userRepository;

    /**
     * Username whose data the MCP tools expose. If blank, the first user in the
     * database is used — fine for a single-user self-hosted install.
     */
    @Value("${geotrail.mcp.username:}")
    private String mcpUsername;

    /** All tool specifications registered with the MCP server. */
    public List<SyncToolSpecification> toolSpecifications() {
        return List.of(timelineForDayTool(), statsSummaryTool(), searchPlacesTool());
    }

    // ==================== Tools ====================

    /** Ordered visits + travel segments for a single calendar day (UTC). */
    private SyncToolSpecification timelineForDayTool() {
        String schema = """
                {
                  "type": "object",
                  "properties": {
                    "date": {
                      "type": "string",
                      "description": "The calendar day to look up, in YYYY-MM-DD format (UTC)."
                    }
                  },
                  "required": ["date"]
                }
                """;
        Tool tool = new Tool(
                "get_timeline_for_day",
                "Get the location timeline for one calendar day: the ordered list of places "
                        + "visited and trips taken, with times, durations and transport modes.",
                schema);

        return new SyncToolSpecification(tool, (exchange, args) -> handle(() -> {
            LocalDate date = requireDate(args, "date");
            User user = resolveUser();
            DayTimelineDto day = timelineService.getDay(user.getId(), date);
            return renderTimeline(date, day);
        }));
    }

    /** High-level movement totals (distance, points) for the user. */
    private SyncToolSpecification statsSummaryTool() {
        String schema = """
                {
                  "type": "object",
                  "properties": {
                    "from": {
                      "type": "string",
                      "description": "Optional start date YYYY-MM-DD for the 'recent' window (defaults to 30 days ago)."
                    },
                    "to": {
                      "type": "string",
                      "description": "Optional end date YYYY-MM-DD for the 'recent' window (defaults to today)."
                    }
                  }
                }
                """;
        Tool tool = new Tool(
                "get_stats_summary",
                "Get summary movement statistics: total recorded points all-time, distance and "
                        + "points over a recent window, and distance so far this year.",
                schema);

        return new SyncToolSpecification(tool, (exchange, args) -> handle(() -> {
            LocalDate from = optionalDate(args, "from");
            LocalDate to = optionalDate(args, "to");
            User user = resolveUser();
            DashboardSummaryDto s = statsService.getDashboardSummary(user.getId(), from, to, null);
            return renderStats(s);
        }));
    }

    /** Fuzzy search over the user's saved/labelled places. */
    private SyncToolSpecification searchPlacesTool() {
        String schema = """
                {
                  "type": "object",
                  "properties": {
                    "query": {
                      "type": "string",
                      "description": "Text to match against a place's name or category (case-insensitive)."
                    }
                  },
                  "required": ["query"]
                }
                """;
        Tool tool = new Tool(
                "search_places",
                "Search the user's saved places (home, work, gym, ...) by name or category. "
                        + "Returns matching places with their coordinates and category.",
                schema);

        return new SyncToolSpecification(tool, (exchange, args) -> handle(() -> {
            String query = requireString(args, "query").toLowerCase();
            User user = resolveUser();
            List<PlaceDtos.Response> matches = placeService.getPlacesForUser(user.getId()).stream()
                    .filter(p -> contains(p.getName(), query) || contains(p.getCategory(), query))
                    .toList();
            return renderPlaces(query, matches);
        }));
    }

    // ==================== Rendering ====================

    private String renderTimeline(LocalDate date, DayTimelineDto day) {
        List<SegmentDto> segments = day.segments();
        if (segments == null || segments.isEmpty()) {
            return "No timeline data recorded for " + date + ".";
        }
        StringBuilder sb = new StringBuilder("Timeline for ").append(date)
                .append(" (times in UTC):\n");
        for (SegmentDto s : segments) {
            String when = s.startTime() != null ? UTC_TIME.format(s.startTime()) : "??:??";
            String until = s.endTime() != null ? UTC_TIME.format(s.endTime()) : "now";
            sb.append("- ").append(when).append("–").append(until).append("  ");
            if ("VISIT".equals(s.kind())) {
                sb.append("Visit");
                if (s.type() != null) sb.append(" (").append(s.type()).append(')');
            } else {
                sb.append("Travel");
                if (s.type() != null) sb.append(" by ").append(s.type());
                if (s.distanceMeters() != null) {
                    sb.append(String.format(" · %.1f km", s.distanceMeters() / 1000.0));
                }
            }
            if (s.durationMinutes() != null) sb.append(" · ").append(s.durationMinutes()).append(" min");
            sb.append('\n');
        }
        return sb.toString();
    }

    private String renderStats(DashboardSummaryDto s) {
        return """
                Movement summary:
                - Total recorded points (all time): %,d
                - Recent window: %.1f km over %,d points
                - This year so far: %.1f km
                """.formatted(
                s.getTotalPointsAllTime(),
                s.getDistanceLast30DaysKm(), s.getPointsLast30Days(),
                s.getDistanceThisYearKm());
    }

    private String renderPlaces(String query, List<PlaceDtos.Response> matches) {
        if (matches.isEmpty()) {
            return "No saved places match \"" + query + "\".";
        }
        StringBuilder sb = new StringBuilder("Places matching \"").append(query).append("\":\n");
        for (PlaceDtos.Response p : matches) {
            sb.append("- ").append(p.getName());
            if (p.getCategory() != null) sb.append(" [").append(p.getCategory()).append(']');
            sb.append(String.format(" @ %.5f, %.5f", p.getLatitude(), p.getLongitude()));
            if (p.getRadiusMeters() != null) sb.append(" (~").append(p.getRadiusMeters()).append("m)");
            sb.append('\n');
        }
        return sb.toString();
    }

    // ==================== Helpers ====================

    /** Runs a tool body, converting any failure into an MCP error result instead of throwing. */
    private CallToolResult handle(ToolBody body) {
        try {
            return new CallToolResult(body.run(), false);
        } catch (IllegalArgumentException e) {
            return new CallToolResult(e.getMessage(), true);
        } catch (Exception e) {
            log.warn("MCP tool failed", e);
            return new CallToolResult("Tool failed: " + e.getMessage(), true);
        }
    }

    private User resolveUser() {
        if (mcpUsername != null && !mcpUsername.isBlank()) {
            return userRepository.findByUsername(mcpUsername)
                    .orElseThrow(() -> new IllegalStateException(
                            "geotrail.mcp.username='" + mcpUsername + "' not found"));
        }
        return userRepository.findAll().stream().findFirst()
                .orElseThrow(() -> new IllegalStateException("No users exist to serve MCP requests"));
    }

    private static boolean contains(String haystack, String needleLower) {
        return haystack != null && haystack.toLowerCase().contains(needleLower);
    }

    private static String requireString(Map<String, Object> args, String key) {
        Object v = args == null ? null : args.get(key);
        if (v == null || v.toString().isBlank()) {
            throw new IllegalArgumentException("Missing required argument: " + key);
        }
        return v.toString();
    }

    private static LocalDate requireDate(Map<String, Object> args, String key) {
        return parseDate(requireString(args, key), key);
    }

    private static LocalDate optionalDate(Map<String, Object> args, String key) {
        Object v = args == null ? null : args.get(key);
        if (v == null || v.toString().isBlank()) return null;
        return parseDate(v.toString(), key);
    }

    private static LocalDate parseDate(String value, String key) {
        try {
            return LocalDate.parse(value.trim());
        } catch (Exception e) {
            throw new IllegalArgumentException(key + " must be a date in YYYY-MM-DD format, got: " + value);
        }
    }

    @FunctionalInterface
    private interface ToolBody {
        String run() throws Exception;
    }
}
