package com.geotrail.rag.client;

import com.geotrail.rag.llm.LlmProvider;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * LLM provider backed by Ollama's OpenAI-compatible HTTP server
 * ({@code POST /v1/chat/completions}). Active when {@code geotrail.rag.llm-provider=ollama}.
 *
 * <p>Works with both local Ollama instances (no key needed) and remote instances that
 * require a Bearer token. Set {@code OLLAMA_API_KEY} to a non-empty value to enable auth.
 */
@Component
@ConditionalOnProperty(name = "geotrail.rag.llm-provider", havingValue = "ollama")
public class OllamaLlmProvider implements LlmProvider {

    private static final Logger log = LoggerFactory.getLogger(OllamaLlmProvider.class);

    private static final String SYSTEM_PROMPT_TEMPLATE = """
            You are a personal location assistant. You have been given location records from the
            user's Google Timeline.

            IMPORTANT RULES:
            1. Answer ONLY using the records provided below. Do not use outside knowledge.
            2. If the records do not contain the answer, say: "I don't have location data for that period."
            3. Keep the answer to 2-4 sentences unless more detail is asked for.
            4. Always include specific dates and times mentioned in the records If ASKED.
            5. Speak directly. Say "You were at home" not "According to the data, the user was at home".
            6. DONT JUST ANSWER IN COORDINATES MENTION THAT PLACE ALSO.

            Location Records:
            %s
            """;

    private final RestClient restClient;
    private final String model;
    private final double temperature;
    private final int maxTokens;
    private final String chatPath;

    public OllamaLlmProvider(
            @Value("${geotrail.rag.ollama.base-url:http://localhost:11434}") String baseUrl,
            @Value("${geotrail.rag.ollama.model:llama3.2}") String model,
            @Value("${geotrail.rag.ollama.temperature:0.2}") double temperature,
            @Value("${geotrail.rag.ollama.max-tokens:1024}") int maxTokens,
            @Value("${geotrail.rag.ollama.connect-timeout-ms:5000}") int connectTimeoutMs,
            @Value("${geotrail.rag.ollama.chat-read-timeout-ms:180000}") int readTimeoutMs,
            @Value("${ollama.api.key:}") String apiKey) {
        this.model = model;
        this.temperature = temperature;
        this.maxTokens = maxTokens;
        // If the base URL already contains /v1 (cloud providers), use /chat/completions.
        // Local Ollama exposes /v1/chat/completions from the root.
        this.chatPath = baseUrl.contains("/v1") ? "/chat/completions" : "/v1/chat/completions";

        SimpleClientHttpRequestFactory rf = new SimpleClientHttpRequestFactory();
        rf.setConnectTimeout(Duration.ofMillis(connectTimeoutMs));
        rf.setReadTimeout(Duration.ofMillis(readTimeoutMs));

        RestClient.Builder builder = RestClient.builder().baseUrl(baseUrl).requestFactory(rf);
        if (apiKey != null && !apiKey.isBlank()) {
            builder.defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey);
        }
        this.restClient = builder.build();
    }

    @Override
    @SuppressWarnings("unchecked")
    public String complete(String systemPrompt, String userQuestion, String customModel, Double customTemperature) {
        String activeModel = (customModel != null && !customModel.isBlank()) ? customModel : this.model;
        double activeTemp = (customTemperature != null) ? customTemperature : this.temperature;

        Map<String, Object> body = Map.of(
                "model", activeModel,
                "temperature", activeTemp,
                "max_tokens", maxTokens,
                "messages", List.of(
                        Map.of("role", "system", "content", systemPrompt),
                        Map.of("role", "user", "content", userQuestion)
                )
        );

        log.info("Ollama request -> model={}, temperature={}, maxTokens={}", activeModel, activeTemp, maxTokens);

        long startedAt = System.currentTimeMillis();
        Map<String, Object> response = restClient.post()
                .uri(chatPath)
                .body(body)
                .retrieve()
                .body(Map.class);
        log.info("Ollama response ({} ms) <- {}", System.currentTimeMillis() - startedAt, response);

        if (response == null || !(response.get("choices") instanceof List<?> choices)
                || choices.isEmpty()
                || !(choices.get(0) instanceof Map<?, ?> first)
                || !(first.get("message") instanceof Map<?, ?> message)) {
            throw new IllegalStateException("Unexpected Ollama response: " + response);
        }

        Object content = message.get("content");
        return content == null ? "" : content.toString().trim();
    }

    @Override
    public String systemPromptTemplate() {
        return SYSTEM_PROMPT_TEMPLATE;
    }
}
