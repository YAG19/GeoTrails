package com.geotrail.imports.service;

import com.geotrail.auth.entity.User;
import com.geotrail.imports.entity.ImportJob;
import com.geotrail.imports.entity.ImportJob.ImportStatus;
import com.geotrail.imports.parser.GoogleTimelineParser;
import com.geotrail.imports.parser.GoogleTimelineParser.ParseResult;
import com.geotrail.imports.repository.ImportJobRepository;
import com.geotrail.location.dto.LocationDtos.CreateRequest;
import com.geotrail.location.service.LocationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ImportService {

    private static final int BATCH_SIZE = 500;

    private final ImportJobRepository importJobRepo;
    private final GoogleTimelineParser googleParser;
    private final LocationService locationService;

    /**
     * Start a Google Timeline import.
     * Creates the job record synchronously, then processes asynchronously.
     */
    public ImportJob startGoogleTimelineImport(User user, MultipartFile file) {
        ImportJob job = ImportJob.builder()
                .user(user)
                .filename(file.getOriginalFilename())
                .fileSizeBytes(file.getSize())
                .status(ImportStatus.PENDING)
                .build();

        job = importJobRepo.save(job);
        log.info("Created import job {} for user {} — file: {} ({} bytes)",
                job.getId(), user.getUsername(), file.getOriginalFilename(), file.getSize());

        // Kick off async processing
        processImportAsync(job.getId(), user, file);

        return job;
    }

    /**
     * Get import job by ID (for polling progress).
     */
    public ImportJob getJob(Long jobId) {
        return importJobRepo.findById(jobId)
                .orElseThrow(() -> new IllegalArgumentException("Import job not found: " + jobId));
    }

    /**
     * List all import jobs for a user.
     */
    public List<ImportJob> getJobsForUser(Long userId) {
        return importJobRepo.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @Async
    protected void processImportAsync(Long jobId, User user, MultipartFile file) {
        ImportJob job = importJobRepo.findById(jobId).orElse(null);
        if (job == null) return;

        try {
            job.setStatus(ImportStatus.PROCESSING);
            job.setStartedAt(Instant.now());
            importJobRepo.save(job);

            // Parse the file
            InputStream inputStream = file.getInputStream();
            ParseResult result = googleParser.parse(inputStream);

            if (result.hasError()) {
                job.setStatus(ImportStatus.FAILED);
                job.setErrorLog(result.errorMessage());
                job.setCompletedAt(Instant.now());
                importJobRepo.save(job);
                return;
            }

            job.setTotalRecords(result.totalRecords());
            importJobRepo.save(job);

            // Insert in batches
            List<CreateRequest> points = result.points();
            int totalProcessed = 0;
            int totalErrors = 0;

            for (int i = 0; i < points.size(); i += BATCH_SIZE) {
                int end = Math.min(i + BATCH_SIZE, points.size());
                List<CreateRequest> batch = points.subList(i, end);

                try {
                    int inserted = locationService.batchInsert(user, batch);
                    totalProcessed += inserted;
                    totalErrors += (batch.size() - inserted);
                } catch (Exception e) {
                    totalErrors += batch.size();
                    log.error("Batch insert failed at offset {}: {}", i, e.getMessage());
                }

                // Update progress
                job.setProcessed(totalProcessed);
                job.setErrors(totalErrors);
                importJobRepo.save(job);

                if (totalProcessed % 5000 == 0) {
                    log.info("Import job {} progress: {}/{}", jobId, totalProcessed, result.totalRecords());
                }
            }

            job.setStatus(ImportStatus.COMPLETED);
            job.setProcessed(totalProcessed);
            job.setErrors(totalErrors + result.errors());
            job.setCompletedAt(Instant.now());
            importJobRepo.save(job);

            log.info("Import job {} completed: {} points inserted, {} errors",
                    jobId, totalProcessed, job.getErrors());

        } catch (Exception e) {
            log.error("Import job {} failed", jobId, e);
            job.setStatus(ImportStatus.FAILED);
            job.setErrorLog(e.getMessage());
            job.setCompletedAt(Instant.now());
            importJobRepo.save(job);
        }
    }

    public ImportJob retryForUserId(Long id) {
        ImportJob job = importJobRepo.findById(id).orElse(null);
        if (job == null) return null;
        
        return job;
    }
}
