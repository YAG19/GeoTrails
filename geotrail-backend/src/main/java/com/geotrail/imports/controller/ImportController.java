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
        if (file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("File is empty"));
        }

        String filename = file.getOriginalFilename();
        if (filename == null || !filename.toLowerCase().endsWith(".json")) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Only JSON files are supported"));
        }

        ImportJob job = importService.startGoogleTimelineImport(user, file);
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(ApiResponse.success(toDto(job), "Import started"));
    }

    /**
     * Get import job status (for polling progress).
     * GET /api/imports/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ImportJobDto>> getJob(@PathVariable Long id) {
        ImportJob job = importService.getJob(id);
        return ResponseEntity.ok(ApiResponse.success(toDto(job)));
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
                .stream().map(this::toDto).toList();
        return ResponseEntity.ok(ApiResponse.success(jobs));
    }

    private ImportJobDto toDto(ImportJob job) {
        return ImportJobDto.builder()
                .id(job.getId())
                .filename(job.getFilename())
                .fileSizeBytes(job.getFileSizeBytes())
                .status(job.getStatus().name())
                .totalRecords(job.getTotalRecords())
                .processed(job.getProcessed())
                .duplicates(job.getDuplicates())
                .errors(job.getErrors())
                .startedAt(job.getStartedAt())
                .completedAt(job.getCompletedAt())
                .createdAt(job.getCreatedAt())
                .build();
    }


    @GetMapping("/{id}/test")
    public ResponseEntity<ApiResponse<ImportJobDto>> test(@AuthenticationPrincipal User user,
                                                        @PathVariable Long id,
                                                        @RequestParam("file") MultipartFile file) {
        //Retry the importjob for id
        // ImportJob job = importService.getJob(id);
        ImportJob job = importService.startGoogleTimelineImport(user, file);

        
        return ResponseEntity.ok(ApiResponse.success(toDto(importService.getJob(id))));
    }   
}
