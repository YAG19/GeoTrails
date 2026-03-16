package com.geotrail.places.controller;

import com.geotrail.auth.entity.User;
import com.geotrail.common.dto.ApiResponse;
import com.geotrail.places.dto.PlaceDtos.*;
import com.geotrail.places.service.PlaceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/places")
@RequiredArgsConstructor
public class PlaceController {

    private final PlaceService placeService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Response>>> getPlaces(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(placeService.getPlacesForUser(user.getId())));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Response>> createPlace(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody CreateRequest request
    ) {
        Response response = placeService.createPlace(user, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<Response>> updatePlace(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @Valid @RequestBody UpdateRequest request
    ) {
        Response response = placeService.updatePlace(user.getId(), id, request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePlace(
            @AuthenticationPrincipal User user,
            @PathVariable Long id
    ) {
        placeService.deletePlace(user.getId(), id);
        return ResponseEntity.noContent().build();
    }
}
