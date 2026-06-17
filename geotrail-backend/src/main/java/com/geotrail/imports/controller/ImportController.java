package com.geotrail.imports.controller;

import com.geotrail.auth.entity.User;
import com.geotrail.common.dto.ApiResponse;
import com.geotrail.imports.dto.ImportJobDto;
import com.geotrail.imports.entity.ImportJob;
import com.geotrail.imports.service.ImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/imports")
@RequiredArgsConstructor
public class ImportController {

    private final ImportService importService;

    /**
     * Upload a Google Timeline JSON file for import.
     * POST /api/imports/google-timeline
     */
    @PostMapping(value = "/google-timeline", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<ImportJobDto>> importGoogleTimeline(
            @AuthenticationPrincipal User user,
            @RequestParam("file") MultipartFile file
    ) {
        ImportJob job = importService.startGoogleTimelineImport(user, file);
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(ApiResponse.success(ImportJobDto.from(job), "Import started"));
    }

    /**
     * Get import job status (for polling progress).
     * GET /api/imports/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ImportJobDto>> getJob(@PathVariable Long id) {
        ImportJob job = importService.getJob(id);
        return ResponseEntity.ok(ApiResponse.success(ImportJobDto.from(job)));
    }

    /**
     * List all import jobs for the current user.
     * GET /api/imports
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<ImportJobDto>>> listJobs(
            @AuthenticationPrincipal User user
    ) {
        List<ImportJobDto> jobs = importService.getJobsForUser(user.getId())
                .stream().map(ImportJobDto::from).toList();
        return ResponseEntity.ok(ApiResponse.success(jobs));
    }

    /**
     * Retry a failed/incomplete import job.
     * POST /api/imports/{id}/retry
     */
    @PostMapping("/{id}/retry")
    public ResponseEntity<ApiResponse<ImportJobDto>> retry(
            @AuthenticationPrincipal User user,
            @PathVariable Long id
    ) {
        importService.retryForUserId(id);
        return ResponseEntity.ok(ApiResponse.success(ImportJobDto.from(importService.getJob(id))));
    }
}
