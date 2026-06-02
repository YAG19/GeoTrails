package com.geotrail.rag.client;

import com.geotrail.rag.embedding.EmbeddingProvider;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Embeds text via Google's Gemini API ({@code POST /v1beta/models/{model}:embedContent}).
 * Active when {@code geotrail.rag.embedding-provider=gemini}.
 *
 * <p>Writes to its own table ({@link #tableName()}) because vectors from different embedding
 * models are not comparable. We request {@code gemini-embedding-001} with
 * {@code outputDimensionality=768} so the stored vector matches the {@code vector(768)} column,
 * but it must never be mixed with LM Studio / nomic-embed vectors.
 *
 * <p>API key is passed via the {@code x-goog-api-key} header, mirroring {@link GeminiLlmProvider}.
 *
 * <p>Rate limiting: the free tier caps embedding calls (e.g. 100/min) and a bulk {@code /embed}
 * backfill fires one call per timeline segment. This provider exposes {@link #minIntervalMillis()}
 * derived from the configured per-minute budget; the bulk indexer sleeps that long between calls
 * so we stay under the quota instead of getting 429s.
 */
@Component
@ConditionalOnProperty(name = "geotrail.rag.embedding-provider", havingValue = "gemini")
public class GeminiEmbeddingProvider implements EmbeddingProvider {

    private final RestClient restClient;
    private final String model;
    private final int dimensions;
    private final long minIntervalMillis;

    public GeminiEmbeddingProvider(
            @Value("${gemini.api.key:${GEMINI_API_KEY:}}") String apiKey,
            @Value("${geotrail.rag.gemini.base-url:https://generativelanguage.googleapis.com}") String baseUrl,
            @Value("${geotrail.rag.gemini.embedding-model:gemini-embedding-001}") String model,
            @Value("${geotrail.rag.gemini.embedding-dimensions:768}") int dimensions,
            @Value("${geotrail.rag.gemini.embed-requests-per-minute:90}") double requestsPerMinute,
            @Value("${geotrail.rag.gemini.connect-timeout-ms:5000}") int connectTimeoutMs,
            @Value("${geotrail.rag.gemini.embed-read-timeout-ms:30000}") int readTimeoutMs) {
        this.model = model;
        this.dimensions = dimensions;
        // Convert the per-minute budget into a per-call delay for the bulk indexer.
        // e.g. 90/min -> one call every ~667ms, comfortably under a 100/min cap.
        this.minIntervalMillis = requestsPerMinute > 0 ? Math.round(60_000.0 / requestsPerMinute) : 0;
        SimpleClientHttpRequestFactory rf = new SimpleClientHttpRequestFactory();
        rf.setConnectTimeout(Duration.ofMillis(connectTimeoutMs));
        rf.setReadTimeout(Duration.ofMillis(readTimeoutMs));
        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader("x-goog-api-key", apiKey)
                .build();
    }

    @Override
    @SuppressWarnings("unchecked")
    public float[] embed(String text) {
        Map<String, Object> body = Map.of(
                "model", "models/" + model,
                "content", Map.of("parts", List.of(Map.of("text", text))),
                "outputDimensionality", dimensions
        );

        Map<String, Object> response = restClient.post()
                .uri("/v1beta/models/{model}:embedContent", model)
                .body(body)
                .retrieve()
                .body(Map.class);

        if (response == null || !(response.get("embedding") instanceof Map<?, ?> embedding)
                || !(embedding.get("values") instanceof List<?> values)) {
            throw new IllegalStateException("Unexpected Gemini embedding response: " + response);
        }

        float[] vector = new float[values.size()];
        for (int i = 0; i < values.size(); i++) {
            vector[i] = ((Number) values.get(i)).floatValue();
        }
        return vector;
    }

    @Override
    public String tableName() {
        return "gemini_timeline_embeddings";
    }

    @Override
    public long minIntervalMillis() {
        return minIntervalMillis;
    }
}
