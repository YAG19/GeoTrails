package com.geotrail.rag.client;

import com.google.common.net.HttpHeaders;
import io.jsonwebtoken.Header;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import com.geotrail.rag.embedding.EmbeddingProvider;

/**
 * Embeds text via LM Studio's OpenAI-compatible server ({@code POST /v1/embeddings}).
 *
 * <p>Fully local: no API key required. The loaded embedding model
 * (e.g. {@code text-embedding-nomic-embed-text-v1.5}) returns 768-dimensional vectors,
 * matching the {@code vector(768)} column in the V11 migration.
 *
 * <p>IMPORTANT: the same model must be used for both indexing and querying, otherwise
 * cosine similarity is meaningless. Both paths go through this single bean.
 */
@Component
@ConditionalOnProperty(name = "geotrail.rag.embedding-provider", havingValue = "lmstudio", matchIfMissing = true)
public class LmStudioEmbeddingProvider implements EmbeddingProvider {

    private final RestClient restClient;
    private final String model;

    public LmStudioEmbeddingProvider(
            @Value("${geotrail.rag.lmstudio.base-url:http://localhost:1234}") String baseUrl,
            @Value("${geotrail.rag.lmstudio.embedding-model:text-embedding-nomic-embed-text-v1.5}") String model,
            @Value("${geotrail.rag.lmstudio.connect-timeout-ms:5000}") int connectTimeoutMs,
            @Value("${geotrail.rag.lmstudio.embed-read-timeout-ms:30000}") int readTimeoutMs) {
        this.model = model;
        // Bounded timeouts so a stalled LM Studio fails fast instead of hanging the request thread.
        SimpleClientHttpRequestFactory rf = new SimpleClientHttpRequestFactory();
        rf.setConnectTimeout(Duration.ofMillis(connectTimeoutMs));
        rf.setReadTimeout(Duration.ofMillis(readTimeoutMs));
        this.restClient = RestClient.builder().baseUrl(baseUrl).requestFactory(rf).build();
    }

    /**
     * Embeds a single piece of text. Throws on API/transport failure so bulk import can
     * isolate per-row errors.
     */
    @Override
    @SuppressWarnings("unchecked")
    public float[] embed(String text) {
        Map<String, Object> body = Map.of(
                "model", model,
                "input", text
        );

        Map<String, Object> response = restClient.post()
                .uri("/v1/embeddings")
                .header(HttpHeaders.CONTENT_TYPE, "application/json")
                .body(body)
                .retrieve()
                .body(Map.class);

        if (response == null || !(response.get("data") instanceof List<?> data)
                || data.isEmpty()
                || !(data.get(0) instanceof Map<?, ?> first)
                || !(first.get("embedding") instanceof List<?> values)) {
            throw new IllegalStateException("Unexpected embedding response: " + response);
        }

        float[] vector = new float[values.size()];
        for (int i = 0; i < values.size(); i++) {
            vector[i] = ((Number) values.get(i)).floatValue();
        }
        return vector;
    }

    @Override
    public String tableName() {
        return "timeline_embeddings";
    }
}
