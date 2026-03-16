package com.geotrail.imports.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class ImportJobDto {
    private Long id;
    private String filename;
    private Long fileSizeBytes;
    private String status;
    private Integer totalRecords;
    private Integer processed;
    private Integer duplicates;
    private Integer errors;
    private Instant startedAt;
    private Instant completedAt;
    private Instant createdAt;

    /**
     * Progress percentage (0-100).
     */
    public int getProgressPercent() {
        if (totalRecords == null || totalRecords == 0) return 0;
        return Math.min(100, (int) ((processed * 100L) / totalRecords));
    }
}
