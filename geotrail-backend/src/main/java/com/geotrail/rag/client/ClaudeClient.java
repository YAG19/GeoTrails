package com.geotrail.rag.client;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Calls the Anthropic Messages API directly via RestClient.
 *
 * <p>The RAG spec asks for "the Anthropic SDK for full control"; a direct HTTP call gives even
 * more control and avoids pinning an SDK version we cannot verify here (the spec's
 * {@code com.anthropic:sdk:0.8.0} coordinate does not exist on Maven Central).
 */
@Component
public class ClaudeClient {

    private static final String BASE_URL = "https://api.anthropic.com";
    private static final String ANTHROPIC_VERSION = "2023-06-01";

    private final RestClient restClient;
    private final String model;
    private final int maxTokens;

    public ClaudeClient(
            @Value("${anthropic.api.key:${ANTHROPIC_API_KEY:}}") String apiKey,
            @Value("${geotrail.rag.claude-model:claude-sonnet-4-20250514}") String model,
            @Value("${geotrail.rag.max-tokens:1024}") int maxTokens) {
        this.model = model;
        this.maxTokens = maxTokens;
        SimpleClientHttpRequestFactory rf = new SimpleClientHttpRequestFactory();
        rf.setConnectTimeout(Duration.ofMillis(5000));
        rf.setReadTimeout(Duration.ofMillis(120000));
        this.restClient = RestClient.builder()
                .baseUrl(BASE_URL)
                .defaultHeader("x-api-key", apiKey)
                .defaultHeader("anthropic-version", ANTHROPIC_VERSION)
                .requestFactory(rf)
                .build();
    }

    @SuppressWarnings("unchecked")
    public String complete(String systemPrompt, String userMessage, String customModel, Double customTemperature) {
        String activeModel = (customModel != null && !customModel.isBlank()) ? customModel : this.model;
        
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("model", activeModel);
        body.put("max_tokens", maxTokens);
        body.put("system", systemPrompt);
        body.put("messages", List.of(Map.of("role", "user", "content", userMessage)));
        if (customTemperature != null) {
            body.put("temperature", customTemperature);
        }

        Map<String, Object> response = restClient.post()
                .uri("/v1/messages")
                .body(body)
                .retrieve()
                .body(Map.class);

        if (response == null || !(response.get("content") instanceof List<?> blocks)) {
            throw new IllegalStateException("Unexpected Claude response: " + response);
        }

        StringBuilder out = new StringBuilder();
        for (Object block : blocks) {
            if (block instanceof Map<?, ?> b && "text".equals(b.get("type"))) {
                out.append(String.valueOf(b.get("text")));
            }
        }
        return out.toString().trim();
    }
}
