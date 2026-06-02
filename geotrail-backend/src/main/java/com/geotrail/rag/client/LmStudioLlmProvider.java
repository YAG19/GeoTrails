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
 * Local LLM provider backed by LM Studio's OpenAI-compatible HTTP server
 * ({@code POST /v1/chat/completions}). Active when {@code geotrail.rag.llm-provider=lmstudio}.
 *
 * <p>We call the endpoint directly with {@link RestClient} rather than via the Spring AI
 * OpenAI starter — this keeps the feature dependency-free and consistent with the rest of
 * the RAG package (the Spring AI 1.x starters target Spring Boot 3.4+, this project is 3.3.5).
 * LM Studio ignores the API key, so none is sent.
 */
@Component
@ConditionalOnProperty(name = "geotrail.rag.llm-provider", havingValue = "lmstudio")
public class LmStudioLlmProvider implements LlmProvider {

    private static final Logger log = LoggerFactory.getLogger(LmStudioLlmProvider.class);

    // Explicit, numbered rules — smaller local models follow these more reliably than prose.
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

    public LmStudioLlmProvider(
            @Value("${geotrail.rag.lmstudio.base-url:http://localhost:1234}") String baseUrl,
            @Value("${geotrail.rag.lmstudio.model:local-model}") String model,
            @Value("${geotrail.rag.lmstudio.temperature:0.2}") double temperature,
            @Value("${geotrail.rag.lmstudio.max-tokens:1024}") int maxTokens,
            @Value("${geotrail.rag.lmstudio.connect-timeout-ms:5000}") int connectTimeoutMs,
            @Value("${geotrail.rag.lmstudio.chat-read-timeout-ms:180000}") int readTimeoutMs) {
        this.model = model;
        this.temperature = temperature;
        this.maxTokens = maxTokens;
        // Generous read timeout: local "thinking" models can take a while to respond,
        // but we still want a hard ceiling rather than an indefinite hang.
        SimpleClientHttpRequestFactory rf = new SimpleClientHttpRequestFactory();
        rf.setConnectTimeout(Duration.ofMillis(connectTimeoutMs));
        rf.setReadTimeout(Duration.ofMillis(readTimeoutMs));
        this.restClient = RestClient.builder().baseUrl(baseUrl).requestFactory(rf).build();
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

        log.info("LM Studio request -> model={}, temperature={}, maxTokens={}, systemPrompt={}, userQuestion={}",
                activeModel, activeTemp, maxTokens, systemPrompt, userQuestion);

        long startedAt = System.currentTimeMillis();
        Map<String, Object> response = restClient.post()
                .uri("/v1/chat/completions")
                .body(body)
                .retrieve()
                .body(Map.class);
        log.info("LM Studio response ({} ms) <- {}", System.currentTimeMillis() - startedAt, response);

        if (response == null || !(response.get("choices") instanceof List<?> choices)
                || choices.isEmpty()
                || !(choices.get(0) instanceof Map<?, ?> first)
                || !(first.get("message") instanceof Map<?, ?> message)) {
            throw new IllegalStateException("Unexpected LM Studio response: " + response);
        }

        Object content = message.get("content");
        return content == null ? "" : content.toString().trim();
    }

    @Override
    public String systemPromptTemplate() {
        return SYSTEM_PROMPT_TEMPLATE;
    }
}
