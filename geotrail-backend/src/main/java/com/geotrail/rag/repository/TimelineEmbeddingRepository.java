package com.geotrail.rag.repository;

import com.geotrail.rag.embedding.EmbeddingProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

/**
 * Direct JDBC access to the active embedding provider's pgvector table.
 *
 * <p>We use {@link JdbcTemplate} rather than JPA so we can cast text literals to the
 * {@code vector} type cleanly (Hibernate has no native pgvector mapping here). Every
 * query is scoped by {@code user_id} so users never see each other's data.
 *
 * <p>The table is chosen by the active {@link EmbeddingProvider} (e.g. {@code timeline_embeddings}
 * for LM Studio, {@code gemini_timeline_embeddings} for Gemini), so indexing and querying always
 * use the same store as the model that produced the vectors.
 */
@Repository
public class TimelineEmbeddingRepository {

    // Allow-list of known embedding tables. The table name comes from a trusted provider
    // constant, not user input, but we validate anyway so it can never reach SQL unchecked.
    private static final Set<String> ALLOWED_TABLES =
            Set.of("timeline_embeddings", "gemini_timeline_embeddings");

    private final JdbcTemplate jdbc;
    private final String table;

    public TimelineEmbeddingRepository(JdbcTemplate jdbc, EmbeddingProvider embeddingProvider) {
        this.jdbc = jdbc;
        String t = embeddingProvider.tableName();
        if (!ALLOWED_TABLES.contains(t)) {
            throw new IllegalStateException("Unknown embedding table from provider: " + t);
        }
        this.table = t;
    }

//    public boolean exists(Long userId, String segmentType, long segmentId) {
//        Integer count = jdbc.queryForObject(
//                "SELECT COUNT(*) FROM " + table + " " +
//                        "WHERE user_id = ? AND segment_type = ? AND segment_id = ?",
//                Integer.class, userId, segmentType, segmentId);
//        return count != null && count > 0;
//    }

    /** Removes all embeddings for a user. Used to force a full re-index. Returns rows deleted. */
    public int deleteAllForUser(Long userId) {
        return jdbc.update("DELETE FROM " + table + " WHERE user_id = ?", userId);
    }

    public int insert(Long userId, String segmentType, long segmentId, String summary,
                       float[] embedding, LocalDate segmentDate, Instant startTime, Instant endTime) {
        return jdbc.update(
                "INSERT INTO " + table + " " +
                        "(user_id, segment_type, segment_id, summary, embedding, segment_date, start_time, end_time) " +
                        "VALUES (?, ?, ?, ?, CAST(? AS vector), ?, ?, ?) " +
                        " ON CONFLICT (user_id, segment_type, segment_id) DO NOTHING ",

                userId, segmentType, segmentId, summary, toVectorLiteral(embedding),
                segmentDate, Timestamp.from(startTime), Timestamp.from(endTime));
    }

    public List<EmbeddingMatch> findSimilar(Long userId, float[] queryVector,
                                            LocalDate dateFilter, int topK) {
        String vec = toVectorLiteral(queryVector);
        String date = dateFilter == null ? null : dateFilter.toString();
        return jdbc.query(
                "SELECT id, segment_type, segment_id, summary, start_time, end_time, " +
                        "       1 - (embedding <=> CAST(? AS vector)) AS similarity " +
                        "FROM " + table + " " +
                        "WHERE user_id = ? " +
                        "  AND (?::date IS NULL OR segment_date = ?::date) " +
                        "ORDER BY embedding <=> CAST(? AS vector) " +
                        "LIMIT ?",
                (rs, rowNum) -> new EmbeddingMatch(
                        rs.getLong("id"),
                        rs.getString("segment_type"),
                        rs.getLong("segment_id"),
                        rs.getString("summary"),
                        rs.getTimestamp("start_time").toInstant(),
                        rs.getTimestamp("end_time").toInstant(),
                        rs.getDouble("similarity")),
                vec, userId, date, date, vec, topK);
    }

    /** Renders a float[] as the pgvector text literal "[0.1,-0.2,...]". */
    static String toVectorLiteral(float[] vector) {
        StringBuilder sb = new StringBuilder(vector.length * 8 + 2);
        sb.append('[');
        for (int i = 0; i < vector.length; i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append(vector[i]);
        }
        sb.append(']');
        return sb.toString();
    }

    public record EmbeddingMatch(long id, String segmentType, long segmentId, String summary,
                                 Instant startTime, Instant endTime, double similarity) {
    }
}
