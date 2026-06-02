package com.geotrail.rag.domain;

import java.time.Instant;
import java.time.LocalDate;

public record Pending(
        SegmentType segmentType,
        long segmentId,
        String summary,
        LocalDate segmentDate,
        Instant startTime,
        Instant endTime) {
}
