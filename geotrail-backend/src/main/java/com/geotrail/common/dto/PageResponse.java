package com.geotrail.common.dto;

import org.springframework.data.domain.Page;

import java.util.List;

/**
 * Stable, serialization-friendly page wrapper. Unlike Spring Data's {@code Page}/{@code PageImpl},
 * its JSON shape is part of our API contract and won't shift between Spring versions.
 */
public record PageResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
    public static <T> PageResponse<T> from(Page<T> page) {
        return new PageResponse<>(
                page.getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages()
        );
    }
}
