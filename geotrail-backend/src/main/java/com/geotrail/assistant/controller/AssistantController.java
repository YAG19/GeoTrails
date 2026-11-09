package com.geotrail.assistant.controller;

import com.geotrail.assistant.dto.AssistantDtos.ChatRequest;
import com.geotrail.assistant.dto.AssistantDtos.ChatResponse;
import com.geotrail.assistant.service.AssistantService;
import com.geotrail.auth.entity.User;
import com.geotrail.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/assistant")
@RequiredArgsConstructor
public class AssistantController {

    private final AssistantService assistantService;

    @PostMapping("/chat")
    public ResponseEntity<ApiResponse<ChatResponse>> chat(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody ChatRequest request
    ) {
        ChatResponse response = assistantService.chat(user, request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
