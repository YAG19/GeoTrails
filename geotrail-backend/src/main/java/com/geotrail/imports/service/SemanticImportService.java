package com.geotrail.imports.service;

import com.geotrail.auth.entity.User;
import com.geotrail.imports.dto.SemanticDtos.ParsedActivity;
import com.geotrail.imports.dto.SemanticDtos.ParsedFrequentPlace;
import com.geotrail.imports.dto.SemanticDtos.ParsedFrequentTrip;
import com.geotrail.imports.dto.SemanticDtos.ParsedTimelinePath;
import com.geotrail.imports.dto.SemanticDtos.ParsedVisit;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

/**
 * Persists the rich semantic records extracted from a Google Timeline import
 * (visits, travel activities and raw GPS breadcrumbs) into their dedicated
 * tables. Uses {@link JdbcTemplate} batch inserts for throughput, mirroring
 * {@code LocationService.batchInsert}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SemanticImportService {

    private static final int FLUSH_SIZE = 1000;

    private final JdbcTemplate jdbcTemplate;

    @Transactional
    public void persistVisits(User user, List<ParsedVisit> visits) {
        if (visits == null || visits.isEmpty()) return;

        final String sql = """
            INSERT INTO visits
                (user_id, center_point, started_at, ended_at, duration_minutes,
                 google_place_id, semantic_type, lat, lng, probability, created_at)
            VALUES
                (?, ST_SetSRID(ST_MakePoint(?, ?), 4326), ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            """;

        List<Object[]> args = new ArrayList<>();
        for (ParsedVisit v : visits) {
            if (v.startTime() == null || v.lat() == null || v.lng() == null) continue;
            Integer durationMinutes = v.endTime() != null
                    ? (int) Duration.between(v.startTime(), v.endTime()).toMinutes()
                    : null;
            args.add(new Object[]{
                    user.getId(),
                    v.lng(),                       // ST_MakePoint(x=lon, y=lat)
                    v.lat(),
                    Timestamp.from(v.startTime()),
                    v.endTime() != null ? Timestamp.from(v.endTime()) : null,
                    durationMinutes,
                    v.googlePlaceId(),
                    v.semanticType(),
                    v.lat(),
                    v.lng(),
                    v.probability()
            });
        }
        int inserted = flush(sql, args);
        log.info("Imported {} visits for user {}", inserted, user.getUsername());
    }

    @Transactional
    public void persistActivities(User user, List<ParsedActivity> activities) {
        if (activities == null || activities.isEmpty()) return;

        final String sql = """
            INSERT INTO user_activity
                (user_id, activity_type, activity_date, distance_meters, probability,
                 start_time, end_time, start_lat, start_lng, end_lat, end_lng, created_at)
            VALUES
                (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            """;

        List<Object[]> args = new ArrayList<>();
        for (ParsedActivity a : activities) {
            if (a.activityType() == null || a.startTime() == null) continue;
            args.add(new Object[]{
                    user.getId(),
                    a.activityType(),
                    java.sql.Date.valueOf(a.startTime().atZone(ZoneOffset.UTC).toLocalDate()),
                    a.distanceMeters(),
                    a.probability(),
                    Timestamp.from(a.startTime()),
                    a.endTime() != null ? Timestamp.from(a.endTime()) : null,
                    a.startLat(),
                    a.startLng(),
                    a.endLat(),
                    a.endLng()
            });
        }
        int inserted = flush(sql, args);
        log.info("Imported {} activities for user {}", inserted, user.getUsername());
    }

    @Transactional
    public void persistTimelinePaths(User user, List<ParsedTimelinePath> crumbs) {
        if (crumbs == null || crumbs.isEmpty()) return;

        final String sql = """
            INSERT INTO timeline_paths
                (user_id, segment_start, lat, lng, recorded_at, created_at)
            VALUES
                (?, ?, ?, ?, ?, NOW())
            ON CONFLICT (user_id, recorded_at, lat, lng) DO NOTHING
            """;

        List<Object[]> args = new ArrayList<>();
        for (ParsedTimelinePath c : crumbs) {
            if (c.recordedAt() == null || c.lat() == null || c.lng() == null) continue;
            args.add(new Object[]{
                    user.getId(),
                    c.segmentStart() != null ? Timestamp.from(c.segmentStart()) : null,
                    c.lat(),
                    c.lng(),
                    Timestamp.from(c.recordedAt())
            });
        }
        int inserted = flush(sql, args);
        log.info("Imported {} timeline-path breadcrumbs for user {}", inserted, user.getUsername());
    }

    /**
     * Auto-seed user places from the export's labelled frequent places (HOME / WORK).
     * Deduped: a place is only created when the user has no place with the same name
     * and none already within 150 m, so re-importing the same export is idempotent.
     */
    @Transactional
    public void seedPlacesFromFrequent(User user, List<ParsedFrequentPlace> places) {
        if (places == null || places.isEmpty()) return;

        final String sql = """
            INSERT INTO places (user_id, name, coordinates, radius_meters, category, created_at, updated_at)
            SELECT ?, ?, ST_SetSRID(ST_MakePoint(?, ?), 4326), ?, ?, NOW(), NOW()
            WHERE NOT EXISTS (
                SELECT 1 FROM places p
                WHERE p.user_id = ?
                  AND (p.name = ?
                       OR ST_DWithin(p.coordinates::geography,
                                     ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, 150))
            )
            """;

        int seeded = 0;
        for (ParsedFrequentPlace p : places) {
            if (p.lat() == null || p.lng() == null) continue;
            String name = labelToName(p.label());
            String category = p.label() != null ? p.label().toLowerCase() : "frequent";
            seeded += jdbcTemplate.update(sql,
                    user.getId(), name, p.lng(), p.lat(), 120, category,
                    user.getId(), name, p.lng(), p.lat());
        }
        log.info("Auto-seeded {} frequent places for user {}", seeded, user.getUsername());
    }

    /** Replace the user's commute-pattern snapshot with the latest export's. */
    @Transactional
    public void persistFrequentTrips(User user, List<ParsedFrequentTrip> trips) {
        if (trips == null) return;
        jdbcTemplate.update("DELETE FROM frequent_trips WHERE user_id = ?", user.getId());
        if (trips.isEmpty()) return;

        final String sql = """
            INSERT INTO frequent_trips
                (user_id, origin_lat, origin_lng, dest_lat, dest_lng,
                 origin_place_id, dest_place_id, trip_count, typical_mode, distance_meters, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            """;

        List<Object[]> args = new ArrayList<>();
        for (ParsedFrequentTrip t : trips) {
            args.add(new Object[]{
                    user.getId(),
                    t.originLat(), t.originLng(), t.destLat(), t.destLng(),
                    t.originPlaceId(), t.destPlaceId(), t.tripCount(), t.typicalMode(), t.distanceMeters()
            });
        }
        int inserted = flush(sql, args);
        log.info("Imported {} frequent trips for user {}", inserted, user.getUsername());
    }

    private static String labelToName(String label) {
        if (label == null || label.isBlank()) return "Frequent place";
        return switch (label.toUpperCase()) {
            case "HOME" -> "Home";
            case "WORK" -> "Work";
            default -> label.substring(0, 1).toUpperCase() + label.substring(1).toLowerCase();
        };
    }

    /** Batch-execute {@code sql} with {@code args}, flushing every {@link #FLUSH_SIZE} rows. */
    private int flush(String sql, List<Object[]> args) {
        int affected = 0;
        List<Object[]> buffer = new ArrayList<>();
        for (Object[] row : args) {
            buffer.add(row);
            if (buffer.size() >= FLUSH_SIZE) {
                affected += countAffected(jdbcTemplate.batchUpdate(sql, buffer));
                buffer.clear();
            }
        }
        if (!buffer.isEmpty()) {
            affected += countAffected(jdbcTemplate.batchUpdate(sql, buffer));
        }
        return affected;
    }

    private int countAffected(int[] results) {
        int n = 0;
        for (int r : results) {
            if (r != 0) n++;   // r may be SUCCESS_NO_INFO (-2) for some drivers
        }
        return n;
    }
}
