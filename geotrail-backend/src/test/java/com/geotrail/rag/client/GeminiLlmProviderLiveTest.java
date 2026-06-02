package com.geotrail.rag.client;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * Live smoke test against the real Gemini API. Skipped unless GEMINI_API_KEY is set,
 * so it never breaks the normal build. Run with:
 * {@code GEMINI_API_KEY=... mvn test -Dtest=GeminiLlmProviderLiveTest}
 */
class GeminiLlmProviderLiveTest {

    @Test
    @EnabledIfEnvironmentVariable(named = "GEMINI_API_KEY", matches = ".+")
    void completesAgainstLiveApi() {
        GeminiLlmProvider provider = new GeminiLlmProvider(
                System.getenv("GEMINI_API_KEY"),
                "https://generativelanguage.googleapis.com",
                "gemini-2.5-flash",
                0.2,
                256,
                5000,
                120000);

        String systemPrompt = String.format(provider.systemPromptTemplate(),
                "2024-05-01 09:00–17:00: Home, Bangalore (12.97, 77.59)");
        String answer = provider.complete(systemPrompt, "Where was I on May 1st 2024?", null, null);

        System.out.println("Gemini answer: " + answer);
        assertNotNull(answer);
        assertFalse(answer.isBlank(), "Gemini returned an empty answer");
    }
}
