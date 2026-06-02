package com.geotrail.rag.client;

import com.geotrail.rag.llm.LlmProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Cloud LLM provider backed by the Anthropic Messages API (via {@link ClaudeClient}).
 * Default when {@code geotrail.rag.llm-provider} is unset or {@code claude}.
 */
@Component
@ConditionalOnProperty(name = "geotrail.rag.llm-provider", havingValue = "claude", matchIfMissing = true)
public class ClaudeLlmProvider implements LlmProvider {

    private static final String SYSTEM_PROMPT_TEMPLATE = """
            You are a personal location history assistant for GeoTrail.

            You have been given a set of location records retrieved from the user's personal
            Google Timeline data. Answer the user's question based ONLY on these records.

            Rules:
            - Only use information from the provided records. Do not infer or hallucinate.
            - If the records do not contain enough information, say so clearly.
            - Be concise. Respond in 2-4 sentences unless detail is explicitly requested.
            - Always mention the specific dates and times from the records.
            - Never say "according to your data" — speak directly: "You were at home...".

            Location Records:
            %s
            """;

    private final ClaudeClient claudeClient;

    public ClaudeLlmProvider(ClaudeClient claudeClient) {
        this.claudeClient = claudeClient;
    }

    @Override
    public String complete(String systemPrompt, String userQuestion, String customModel, Double customTemperature) {
        return claudeClient.complete(systemPrompt, userQuestion, customModel, customTemperature);
    }

    @Override
    public String systemPromptTemplate() {
        return SYSTEM_PROMPT_TEMPLATE;
    }
}
