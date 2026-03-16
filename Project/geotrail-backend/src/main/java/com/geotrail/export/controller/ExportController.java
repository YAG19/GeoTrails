package com.geotrail.export.controller;

import com.geotrail.auth.entity.User;
import com.geotrail.export.service.ExportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;

@RestController
@RequestMapping("/export")
@RequiredArgsConstructor
public class ExportController {

    private final ExportService exportService;

    @GetMapping("/geojson")
    public ResponseEntity<String> exportGeoJson(
            @AuthenticationPrincipal User user,
            @RequestParam Instant from,
            @RequestParam Instant to
    ) {
        String geojson = exportService.exportGeoJson(user.getId(), from, to);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=geotrail-export.geojson")
                .contentType(MediaType.APPLICATION_JSON)
                .body(geojson);
    }

    @GetMapping("/gpx")
    public ResponseEntity<String> exportGpx(
            @AuthenticationPrincipal User user,
            @RequestParam Instant from,
            @RequestParam Instant to
    ) {
        String gpx = exportService.exportGpx(user.getId(), from, to);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=geotrail-export.gpx")
                .contentType(MediaType.APPLICATION_XML)
                .body(gpx);
    }
}
