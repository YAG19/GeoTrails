package com.geotrail.places.service;

import com.geotrail.auth.entity.User;
import com.geotrail.common.exception.ResourceNotFoundException;
import com.geotrail.common.util.GeoUtils;
import com.geotrail.places.dto.PlaceDtos.*;
import com.geotrail.places.entity.Place;
import com.geotrail.places.repository.PlaceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class PlaceService {

    private final PlaceRepository placeRepo;

    @Cacheable(value = "userPlaces", key = "#userId")
    @Transactional(readOnly = true)
    public List<Response> getPlacesForUser(Long userId) {
        return placeRepo.findByUserIdOrderByNameAsc(userId)
                .stream().map(this::toResponse).toList();
    }

    @CacheEvict(value = "userPlaces", key = "#user.id")
    @Transactional
    public Response createPlace(User user, CreateRequest request) {
        Place place = Place.builder()
                .user(user)
                .name(request.getName())
                .coordinates(GeoUtils.createPoint(request.getLatitude(), request.getLongitude()))
                .radiusMeters(request.getRadiusMeters())
                .category(request.getCategory())
                .build();

        Place saved = placeRepo.save(place);
        log.info("Created place '{}' for user {}", saved.getName(), user.getUsername());
        return toResponse(saved);
    }

    @CacheEvict(value = "userPlaces", key = "#userId")
    @Transactional
    public Response updatePlace(Long userId, Long placeId, UpdateRequest request) {
        Place place = placeRepo.findById(placeId)
                .filter(p -> p.getUser().getId().equals(userId))
                .orElseThrow(() -> new ResourceNotFoundException("Place", "id", placeId));

        if (request.getName() != null) place.setName(request.getName());
        if (request.getCategory() != null) place.setCategory(request.getCategory());
        if (request.getRadiusMeters() != null) place.setRadiusMeters(request.getRadiusMeters());
        if (request.getLatitude() != null && request.getLongitude() != null) {
            place.setCoordinates(GeoUtils.createPoint(request.getLatitude(), request.getLongitude()));
        }

        Place saved = placeRepo.save(place);
        return toResponse(saved);
    }

    @CacheEvict(value = "userPlaces", key = "#userId")
    @Transactional
    public void deletePlace(Long userId, Long placeId) {
        Place place = placeRepo.findById(placeId)
                .filter(p -> p.getUser().getId().equals(userId))
                .orElseThrow(() -> new ResourceNotFoundException("Place", "id", placeId));

        placeRepo.delete(place);
        log.info("Deleted place '{}' (id={})", place.getName(), placeId);
    }

    /**
     * Find the nearest known place to a coordinate.
     * Used by visit detection to auto-label visits.
     */
    @Transactional(readOnly = true)
    public Optional<Place> findNearestPlace(Long userId, double lat, double lon) {
        return placeRepo.findNearestPlace(userId, lat, lon);
    }

    private Response toResponse(Place place) {
        return Response.builder()
                .id(place.getId())
                .name(place.getName())
                .latitude(place.getLatitude())
                .longitude(place.getLongitude())
                .radiusMeters(place.getRadiusMeters())
                .category(place.getCategory())
                .createdAt(place.getCreatedAt())
                .updatedAt(place.getUpdatedAt())
                .build();
    }
}
