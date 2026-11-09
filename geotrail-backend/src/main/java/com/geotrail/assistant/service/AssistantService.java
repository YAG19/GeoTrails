package com.geotrail.assistant.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.geotrail.assistant.dto.AssistantDtos.ChatRequest;
import com.geotrail.assistant.dto.AssistantDtos.ChatResponse;
import com.geotrail.auth.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

@Service
@RequiredArgsConstructor
@Slf4j
public class AssistantService {

    private final LocationSemanticService locationSemanticService;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate = new RestTemplate();

    public ChatResponse chat(User user, ChatRequest request) {
        log.info("Processing chat request for user '{}' using model '{}'", user.getUsername(), request.getModel());

        // 1. Retrieve the relevant database context (simulated vector DB search)
        LocationSemanticService.SemanticContext semanticContext =
                locationSemanticService.retrieveContext(user, request.getMessage());

        // 2. Prepare the system instruction and user prompt
        String systemInstruction = "You are GeoTrail Assistant, an intelligent personal location history bot.\n" +
                "You help the user explore their private location history, visits, trips, and daily activities.\n" +
                "Below is the factual location history data retrieved from the user's private database (Vector DB/PostGIS) matching their query.\n" +
                "Use this retrieved context to answer the user's question. Be friendly, conversational, direct, and factual.\n" +
                "If the retrieved data is empty or indicates no recorded history, explain that you couldn't find any location history logs in GeoTrails for that date, and offer to help them query a different day.\n" +
                "Do NOT invent locations, coordinate points, or activities not listed in the context.\n\n" +
                "Retrieved Location History Context:\n" +
                "===================================\n" +
                semanticContext.getContextText() + "\n" +
                "===================================\n";

        // 3. Construct the OpenAI-compatible request payload for LM Studio
        String lmStudioBaseUrl = request.getLmStudioUrl();
        if (lmStudioBaseUrl == null || lmStudioBaseUrl.isBlank()) {
            // Default to localhost, but check if we're running inside a Docker container.
            // If the environment indicates docker, use host.docker.internal, otherwise localhost.
            boolean isDocker = System.getenv("SPRING_PROFILES_ACTIVE") != null &&
                    System.getenv("SPRING_PROFILES_ACTIVE").contains("prod");
            lmStudioBaseUrl = isDocker ? "http://host.docker.internal:1234" : "http://localhost:1234";
        }

        // Clean trailing slash
        if (lmStudioBaseUrl.endsWith("/")) {
            lmStudioBaseUrl = lmStudioBaseUrl.substring(0, lmStudioBaseUrl.length() - 1);
        }

        String chatEndpoint = lmStudioBaseUrl + "/v1/chat/completions";
        log.info("Sending prompt to local LM Studio endpoint: {}", chatEndpoint);

        try {
            ObjectNode payload = objectMapper.createObjectNode();
            payload.put("model", request.getModel());
            payload.put("temperature", request.getTemperature());

            ArrayNode messages = objectMapper.createArrayNode();

            ObjectNode systemMsg = objectMapper.createObjectNode();
            systemMsg.put("role", "system");
            systemMsg.put("content", systemInstruction);
            messages.add(systemMsg);

            ObjectNode userMsg = objectMapper.createObjectNode();
            userMsg.put("role", "user");
            userMsg.put("content", request.getMessage());
            messages.add(userMsg);

            payload.set("messages", messages);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(payload), headers);

            ResponseEntity<String> responseEntity = restTemplate.postForEntity(chatEndpoint, entity, String.class);

            if (responseEntity.getStatusCode().is2xxSuccessful() && responseEntity.getBody() != null) {
                JsonNode root = objectMapper.readTree(responseEntity.getBody());
                String reply = root.path("choices").path(0).path("message").path("content").asText();

                return ChatResponse.builder()
                        .response(reply)
                        .sources(semanticContext.getSources())
                        .build();
            } else {
                log.error("LM Studio returned non-success response: {}", responseEntity.getStatusCode());
                return ChatResponse.builder()
                        .response("Error: LM Studio returned an unexpected status code: " + responseEntity.getStatusCode())
                        .sources(semanticContext.getSources())
                        .build();
            }

        } catch (ResourceAccessException e) {
            log.error("Failed to connect to LM Studio at {}: {}", chatEndpoint, e.getMessage());
            return ChatResponse.builder()
                    .response("I couldn't reach your local LM Studio instance at `" + lmStudioBaseUrl + "`.\n\n" +
                            "**How to fix:**\n" +
                            "1. Open **LM Studio** on your host computer.\n" +
                            "2. Click the **Developer API / Local Server** tab (the double arrow icon `<>` on the left panel).\n" +
                            "3. Select a model in the top dropdown and click **Start Server**.\n" +
                            "4. If GeoTrail is running inside Docker, ensure you configured the endpoint URL in Settings to `http://host.docker.internal:1234` so it can escape the container.")
                    .sources(semanticContext.getSources())
                    .build();
        } catch (Exception e) {
            log.error("Error communicating with local LLM", e);
            return ChatResponse.builder()
                    .response("An error occurred while communicating with the local LLM: " + e.getMessage())
                    .sources(semanticContext.getSources())
                    .build();
        }
    }
}
