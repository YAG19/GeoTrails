package com.geotrail.rag.client;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * Live smoke test against the real Gemini embedding endpoint. Skipped unless GEMINI_API_KEY
 * is set. Run with: {@code GEMINI_API_KEY=... mvn test -Dtest=GeminiEmbeddingProviderLiveTest}
 */
class GeminiEmbeddingProviderLiveTest {

    @Test
    @EnabledIfEnvironmentVariable(named = "GEMINI_API_KEY", matches = ".+")
    void embedsAt768Dimensions() {
        GeminiEmbeddingProvider provider = new GeminiEmbeddingProvider(
                System.getenv("GEMINI_API_KEY"),
                "https://generativelanguage.googleapis.com",
                "gemini-embedding-001",
                768,
                90.0,   // requests-per-minute throttle
                5000,
                30000);

        float[] vector = provider.embed("Home in Bangalore from 09:00 to 17:00 on 2024-05-01");

        assertNotNull(vector);
        assertEquals(768, vector.length, "expected 768-dim vector to match the DB column");
        assertEquals("gemini_timeline_embeddings", provider.tableName());
    }
}
