# GeoTrail RAG — Local LLM with LM Studio

> **Read this AFTER completing all 12 sections of `GeoTrail-RAG-Spec.docx`.**
> This document extends Phase 1 with local LLM support via LM Studio.
> No Anthropic API key required once this is set up.

---

## Why Local LLM?

| | Claude API | LM Studio (Local) |
|---|---|---|
| Cost | Per token | Free |
| Privacy | Data leaves your machine | Stays on device |
| Speed | Network latency | GPU-dependent, no network |
| Quality | Higher | Depends on model |
| Internet required | Yes | No |
| Best for | Production / high accuracy | Dev / privacy / offline |

The architecture stays identical — only the LLM call at the end of the RAG pipeline changes. Vector search, embeddings, and DB are untouched.

---

## How LM Studio Exposes an API

LM Studio runs a **local HTTP server** that is OpenAI-API compatible.

```
http://localhost:1234/v1/chat/completions
```

This is the same shape as OpenAI's API — same JSON request/response format. Spring AI's `OpenAiChatModel` works against it by just changing the base URL. No new SDK needed.

```
User Question
     ↓
TimelineQueryService (unchanged)
     ↓
pgvector similarity search (unchanged)
     ↓
Build context string (unchanged)
     ↓
LM Studio HTTP call  ←── only this line changes
     ↓
Natural language answer
```

---

## Step 1 — Set Up LM Studio

### 1.1 Download and Install

Download from: https://lmstudio.ai

Supports: Windows, macOS, Linux (Ubuntu 22+)

### 1.2 Download a Model

Inside LM Studio, search and download one of these (pick based on your RAM):

| Model | RAM Required | Quality | Recommended For |
|---|---|---|---|
| `Mistral-7B-Instruct-v0.3-Q4_K_M` | 6 GB | Good | 8GB RAM machines |
| `Llama-3.2-8B-Instruct-Q4_K_M` | 7 GB | Very Good | 8–16 GB RAM |
| `Llama-3.1-8B-Instruct-Q8_0` | 10 GB | Best 8B quality | 16 GB RAM |
| `Mistral-Nemo-12B-Instruct-Q4_K_M` | 10 GB | Excellent | 16 GB RAM |
| `Qwen2.5-14B-Instruct-Q4_K_M` | 12 GB | Excellent | 16–32 GB RAM |

**For GeoTrail RAG, any Instruct model works. Mistral-7B or Llama-3.2-8B is sufficient.**

### 1.3 Start the Local Server

In LM Studio:
1. Click **"Local Server"** tab (left sidebar)
2. Select your downloaded model from the dropdown
3. Click **"Start Server"**
4. Confirm it says: `Server running on http://localhost:1234`

### 1.4 Verify It Works

```bash
curl http://localhost:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "local-model",
    "messages": [
      { "role": "user", "content": "Say hello in one sentence." }
    ]
  }'
```

Expected: a JSON response with a `choices[0].message.content` field.

---

## Step 2 — Spring Boot Config Changes

### 2.1 Add Spring AI OpenAI Starter

The LM Studio server is OpenAI-compatible, so use Spring AI's OpenAI client pointed at localhost.

Add to `pom.xml` (keep the pgvector and Gemini embedding starters from the main spec):

```xml
<!-- Spring AI OpenAI — used for LM Studio local server -->
<dependency>
  <groupId>org.springframework.ai</groupId>
  <artifactId>spring-ai-openai-spring-boot-starter</artifactId>
</dependency>
```

> **Note:** You already have `spring-ai-vertex-ai-embedding` for Gemini embeddings.
> Adding `spring-ai-openai` for the chat model is fine — they are separate beans.
> Spring AI supports multiple AI providers in the same app.

### 2.2 application.yml — Add LM Studio Config

```yaml
spring:
  ai:
    openai:
      api-key: lm-studio          # LM Studio ignores this — any non-empty string works
      base-url: http://localhost:1234
      chat:
        options:
          model: local-model       # LM Studio uses "local-model" as the model name
          temperature: 0.2         # Lower = more factual, less creative. Good for RAG.
          max-tokens: 1024

geotrail:
  rag:
    llm-provider: lmstudio        # "lmstudio" or "claude" — controls which bean is used
    top-k: 8
    min-similarity: 0.65
    max-context-chars: 3000
```

> **Why temperature 0.2?** RAG answers should be factual and grounded.
> High temperature (0.8+) makes the model creative — which means more hallucination risk.
> Keep it low for location history queries.

---

## Step 3 — Code Changes

### 3.1 Create LlmProvider Interface

Abstract the LLM call so you can swap between Claude and LM Studio via config:

```java
package com.geotrail.rag.llm;

public interface LlmProvider {
    String complete(String systemPrompt, String userQuestion);
}
```

### 3.2 LmStudioLlmProvider.java

```java
package com.geotrail.rag.llm;

import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "geotrail.rag.llm-provider", havingValue = "lmstudio")
public class LmStudioLlmProvider implements LlmProvider {

    private final ChatModel chatModel;

    public LmStudioLlmProvider(ChatModel chatModel) {
        this.chatModel = chatModel;
    }

    @Override
    public String complete(String systemPrompt, String userQuestion) {
        Prompt prompt = new Prompt(
            List.of(
                new SystemMessage(systemPrompt),
                new UserMessage(userQuestion)
            )
        );
        return chatModel.call(prompt)
                        .getResult()
                        .getOutput()
                        .getContent();
    }
}
```

### 3.3 ClaudeLlmProvider.java

Move your existing Anthropic SDK call from `TimelineQueryService` into this class:

```java
package com.geotrail.rag.llm;

import com.anthropic.client.AnthropicOkHttpClient;
import com.anthropic.models.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.stream.Collectors;

@Component
@ConditionalOnProperty(name = "geotrail.rag.llm-provider", havingValue = "claude", matchIfMissing = true)
public class ClaudeLlmProvider implements LlmProvider {

    private final AnthropicOkHttpClient anthropic = AnthropicOkHttpClient.builder()
        .apiKey(System.getenv("ANTHROPIC_API_KEY"))
        .build();

    @Override
    public String complete(String systemPrompt, String userQuestion) {
        Message message = anthropic.messages().create(
            MessageCreateParams.builder()
                .model(Model.CLAUDE_SONNET_4_20250514)
                .maxTokens(1024)
                .system(systemPrompt)
                .addUserMessage(userQuestion)
                .build()
        );
        return message.content().stream()
            .filter(b -> b instanceof ContentBlock.Text)
            .map(b -> ((ContentBlock.Text) b).text())
            .collect(Collectors.joining());
    }
}
```

### 3.4 Update TimelineQueryService.java

Replace the direct Anthropic SDK call with the injected `LlmProvider`:

```java
// BEFORE (hardcoded Claude)
private String callClaude(String systemPrompt, String question) { ... }

// AFTER (provider-agnostic)
@Component
@RequiredArgsConstructor
public class TimelineQueryService {

    private final EmbeddingModel embeddingModel;
    private final TimelineEmbeddingRepository embeddingRepository;
    private final LlmProvider llmProvider;          // ← injected, not hardcoded

    public QueryResult query(String userQuestion) {
        // ... vector search unchanged ...

        String systemPromptWithContext = buildSystemPrompt(retrievedSummaries);
        String answer = llmProvider.complete(systemPromptWithContext, userQuestion);

        return new QueryResult(answer, retrievedSummaries, scores);
    }
}
```

**Switching between Claude and LM Studio is now a single line in `application.yml`:**

```yaml
geotrail.rag.llm-provider: lmstudio   # local
geotrail.rag.llm-provider: claude     # cloud
```

---

## Step 4 — The System Prompt for Local Models

Local models are less instruction-following than Claude. Use a slightly more explicit prompt:

```
You are a personal location assistant. You have been given location records from the user's Google Timeline.

IMPORTANT RULES:
1. Answer ONLY using the records provided below. Do not use outside knowledge.
2. If the records do not contain the answer, say: "I don't have location data for that period."
3. Keep the answer to 2-4 sentences unless more detail is asked for.
4. Always include specific dates and times mentioned in the records.
5. Speak directly. Say "You were at home" not "According to the data, the user was at home".

Location Records:
{CONTEXT_PLACEHOLDER}
```

> **Why a different prompt for local models?**
> Claude follows nuanced instructions reliably. Smaller local models (7B–14B) need
> simpler, numbered rules to stay on task. If you see the local model ignoring the
> context and answering from its training data, make the rules even more explicit.

---

## Step 5 — Testing LM Studio Integration

### 5.1 Confirm Server is Running

```bash
curl http://localhost:1234/v1/models
```

Expected: JSON with a `data` array listing `local-model`.

### 5.2 Test the Spring Boot → LM Studio Connection

```bash
# Set provider to lmstudio in application.yml, then:
POST /api/rag/query
Body: { "question": "What did I do on September 23?" }
```

Check the logs — you should see the HTTP call going to `localhost:1234`.

### 5.3 Latency Expectations

| Hardware | 7B model | 13B model |
|---|---|---|
| CPU only (no GPU) | 30–120 sec/response | Very slow, not recommended |
| Integrated GPU (iGPU) | 10–40 sec | 30–90 sec |
| Dedicated GPU (4GB VRAM) | 3–8 sec | 10–20 sec |
| Dedicated GPU (8GB VRAM) | 1–3 sec | 3–8 sec |

For development and personal use, even 10-second responses are fine. For production, use Claude.

---

## Step 6 — Running Both Simultaneously (Optional)

If you want to run both Claude and LM Studio in the same Spring Boot app and choose per request:

```java
// In TimelineRagController.java
@PostMapping("/query")
public QueryResult query(@RequestBody QueryRequest req,
                         @RequestParam(defaultValue = "default") String provider) {
    return queryService.query(req.question(), provider);
}

// In TimelineQueryService.java
public QueryResult query(String question, String providerHint) {
    LlmProvider provider = providerHint.equals("lmstudio")
        ? lmStudioProvider
        : claudeProvider;
    // ...
}
```

```bash
# Use Claude
POST /api/rag/query?provider=claude

# Use LM Studio
POST /api/rag/query?provider=lmstudio
```

---

## Common Issues

| Issue | Cause | Fix |
|---|---|---|
| `Connection refused localhost:1234` | LM Studio server not started | Open LM Studio → Local Server tab → Start Server |
| Empty or garbled response | Wrong model loaded | Make sure an Instruct model is loaded, not a base model |
| Model ignores context, answers from memory | Temperature too high or prompt too weak | Set `temperature: 0.1`, use numbered rules in system prompt |
| Very slow responses | Running on CPU only | In LM Studio settings, enable GPU layers (set to max your VRAM allows) |
| `401 Unauthorized` | Spring AI sending invalid auth header | Set `api-key: lm-studio` — any non-empty string works |
| Out of memory crash | Model too large for RAM | Use a smaller model or Q4_K_M quantization instead of Q8 |

---

## Recommended Dev Workflow

```
Day-to-day development
        ↓
Use LM Studio (free, fast iteration, no cost)
        ↓
Final testing / accuracy check
        ↓
Switch to Claude (better instruction following, higher accuracy)
        ↓
Production
        ↓
Decision: Claude API (easy) OR self-hosted Ollama on a server (advanced)
```

---

## Summary of All Config Changes

```yaml
# application.yml — full RAG + LM Studio config
spring:
  ai:
    vertex:
      ai:
        embedding:
          model: text-embedding-004           # embeddings stay on Gemini
          project-id: ${GOOGLE_CLOUD_PROJECT_ID}
    openai:
      api-key: lm-studio                      # fake key, LM Studio ignores it
      base-url: http://localhost:1234         # LM Studio server
      chat:
        options:
          model: local-model
          temperature: 0.2
          max-tokens: 1024
    vectorstore:
      pgvector:
        dimensions: 768
        table-name: timeline_embeddings
        initialize-schema: false

geotrail:
  rag:
    llm-provider: lmstudio                   # toggle: lmstudio | claude
    top-k: 8
    min-similarity: 0.65
    max-context-chars: 3000
```

**One property swap. Everything else is identical.**