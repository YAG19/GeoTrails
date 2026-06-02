package com.geotrail.rag.llm;

/**
 * Abstraction over the final LLM call in the RAG pipeline so the chat backend can be
 * swapped (cloud Claude vs. local LM Studio) via the {@code geotrail.rag.llm-provider}
 * property. Exactly one implementation is active at a time (selected by
 * {@code @ConditionalOnProperty}).
 */
public interface LlmProvider {

    /** Generates an answer grounded in the system prompt (which already contains context). */
    String complete(String systemPrompt, String userQuestion, String customModel, Double customTemperature);

    /**
     * Provider-specific grounding prompt template. Contains a single {@code %s} placeholder
     * that the query service fills with the retrieved location records at runtime.
     *
     * <p>Smaller local models need simpler, more explicit rules than Claude, so each
     * provider brings its own template.
     */
    String systemPromptTemplate();
}
