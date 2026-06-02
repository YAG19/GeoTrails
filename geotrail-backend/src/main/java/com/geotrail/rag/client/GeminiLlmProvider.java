package com.geotrail.rag.client;

import com.geotrail.rag.llm.LlmProvider;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Cloud LLM provider backed by Google's Gemini API
 * ({@code POST /v1beta/models/{model}:generateContent}). Active when
 * {@code geotrail.rag.llm-provider=gemini}.
 *
 * <p>We call the endpoint directly with {@link RestClient} rather than via an SDK — this keeps
 * the feature dependency-free and consistent with the rest of the RAG package (see
 * {@link ClaudeClient} / {@link LmStudioLlmProvider}). The API key is passed as the
 * {@code x-goog-api-key} header.
 */
@Component
@ConditionalOnProperty(name = "geotrail.rag.llm-provider", havingValue = "gemini")
public class GeminiLlmProvider implements LlmProvider {

    private static final Logger log = LoggerFactory.getLogger(GeminiLlmProvider.class);

    private static final String SYSTEM_PROMPT_TEMPLATE = """
            You are a personal location history assistant for GeoTrail.

            You have been given a set of location records retrieved from the user's personal
            Google Timeline data. Answer the user's question based ONLY on these records.

            Rules:
            - Only use information from the provided records. Do not infer or hallucinate.
            - If the records do not contain enough information, say so clearly.
            - Be concise. Respond in 2-4 sentences unless detail is explicitly requested.
            - Always mention the specific dates and times from the records IF ASKED.
            - Never say "according to your data" — speak directly: "You were at home...".
            - Don't answer only in coordinates; mention the place name too.

            Location Records:
            %s
            """;

    private final RestClient restClient;
    private final String model;
    private final double temperature;
    private final int maxTokens;

    public GeminiLlmProvider(
            @Value("${gemini.api.key:${GEMINI_API_KEY:}}") String apiKey,
            @Value("${geotrail.rag.gemini.base-url:https://generativelanguage.googleapis.com}") String baseUrl,
            @Value("${geotrail.rag.gemini.model:gemini-2.5-flash}") String model,
            @Value("${geotrail.rag.gemini.temperature:0.2}") double temperature,
            @Value("${geotrail.rag.gemini.max-tokens:1024}") int maxTokens,
            @Value("${geotrail.rag.gemini.connect-timeout-ms:5000}") int connectTimeoutMs,
            @Value("${geotrail.rag.gemini.read-timeout-ms:120000}") int readTimeoutMs) {
        this.model = model;
        this.temperature = temperature;
        this.maxTokens = maxTokens;
        SimpleClientHttpRequestFactory rf = new SimpleClientHttpRequestFactory();
        rf.setConnectTimeout(Duration.ofMillis(connectTimeoutMs));
        rf.setReadTimeout(Duration.ofMillis(readTimeoutMs));
        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader("x-goog-api-key", apiKey)
                .requestFactory(rf)
                .build();
    }

    @Override
    @SuppressWarnings("unchecked")
    public String complete(String systemPrompt, String userQuestion, String customModel, Double customTemperature) {
        String activeModel = (customModel != null && !customModel.isBlank()) ? customModel : this.model;
        double activeTemp = (customTemperature != null) ? customTemperature : this.temperature;

        Map<String, Object> body = Map.of(
                "system_instruction", Map.of("parts", List.of(Map.of("text", systemPrompt))),
                "contents", List.of(Map.of(
                        "role", "user",
                        "parts", List.of(Map.of("text", userQuestion))
                )),
                "generationConfig", Map.of(
                        "temperature", activeTemp,
                        "maxOutputTokens", maxTokens
                )
        );

        log.info("Gemini request -> model={}, temperature={}, maxTokens={}, userQuestion={}",
                activeModel, activeTemp, maxTokens, userQuestion);

        long startedAt = System.currentTimeMillis();
        Map<String, Object> response = restClient.post()
                .uri("/v1beta/models/{model}:generateContent", activeModel)
                .body(body)
                .retrieve()
                .body(Map.class);
        log.info("Gemini response ({} ms) <- {}", System.currentTimeMillis() - startedAt, response);

        if (response == null || !(response.get("candidates") instanceof List<?> candidates)
                || candidates.isEmpty()
                || !(candidates.get(0) instanceof Map<?, ?> first)
                || !(first.get("content") instanceof Map<?, ?> content)
                || !(content.get("parts") instanceof List<?> parts)) {
            throw new IllegalStateException("Unexpected Gemini response: " + response);
        }

        StringBuilder out = new StringBuilder();
        for (Object part : parts) {
            if (part instanceof Map<?, ?> p && p.get("text") != null) {
                out.append(p.get("text"));
            }
        }
        return out.toString().trim();
    }

    @Override
    public String systemPromptTemplate() {
        return SYSTEM_PROMPT_TEMPLATE;
    }
}
