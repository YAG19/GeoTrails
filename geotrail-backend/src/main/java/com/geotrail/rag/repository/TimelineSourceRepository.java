package com.geotrail.rag.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

/**
 * Repository for reading raw timeline source data (visits and activities)
 * to be embedded by the RAG feature.
 */
@Repository
public class TimelineSourceRepository {

    private final JdbcTemplate jdbc;

    public TimelineSourceRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public <T> List<T> loadVisits(Long userId, LocalDate since, RowMapper<T> mapper) {
        StringBuilder sql = new StringBuilder(
                "SELECT id, semantic_type, started_at, ended_at, lat, lng " +
                        "FROM visits WHERE user_id = ? AND started_at IS NOT NULL");
        List<Object> args = new ArrayList<>();
        args.add(userId);
        if (since != null) {
            sql.append(" AND started_at >= ?");
            args.add(Timestamp.from(since.atStartOfDay(ZoneOffset.UTC).toInstant()));
        }
        return jdbc.query(sql.toString(), mapper, args.toArray());
    }

    public <T> List<T> loadActivities(Long userId, LocalDate since, RowMapper<T> mapper) {
        StringBuilder sql = new StringBuilder(
                "SELECT id, activity_type, start_time, end_time, " +
                        "start_lat, start_lng, end_lat, end_lng, distance_meters " +
                        "FROM user_activity WHERE user_id = ? AND start_time IS NOT NULL");
        List<Object> args = new ArrayList<>();
        args.add(userId);
        if (since != null) {
            sql.append(" AND start_time >= ?");
            args.add(Timestamp.from(since.atStartOfDay(ZoneOffset.UTC).toInstant()));
        }
        return jdbc.query(sql.toString(), mapper, args.toArray());
    }
}
