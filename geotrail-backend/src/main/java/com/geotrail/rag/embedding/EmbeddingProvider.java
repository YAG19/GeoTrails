package com.geotrail.rag.embedding;

/**
 * Interface for providing text embeddings.
 */
public interface EmbeddingProvider {

    /**
     * Embeds a single piece of text into a vector.
     *
     * @param text the text to embed
     * @return the embedding vector
     */
    float[] embed(String text);

    /**
     * The pgvector table this provider's vectors live in. Vectors from different embedding
     * models are not comparable, so each provider owns a separate table; the repository uses
     * this so indexing and querying always hit the same store as the active embedding model.
     */
    String tableName();

    /**
     * Minimum delay the bulk indexer should leave between successive {@link #embed} calls so we
     * stay under the provider's rate limit. {@code 0} means no client-side throttle — the default
     * for local providers (e.g. LM Studio) with no per-minute quota.
     */
    default long minIntervalMillis() {
        return 0;
    }
}
