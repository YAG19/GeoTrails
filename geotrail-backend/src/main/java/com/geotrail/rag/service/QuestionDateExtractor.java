package com.geotrail.rag.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Best-effort extraction of a single calendar date from a natural-language question,
 * used to scope RAG retrieval to one day's segments. Returns {@code null} when no
 * unambiguous date is found, in which case retrieval falls back to pure semantic search.
 *
 * <p>Handles the common forms our summaries echo back ("1 January 2026",
 * "January 1, 2026", "Jan 1 2026", ISO "2026-01-01", "1/1/2026") plus the relative
 * words "today" and "yesterday". Deliberately conservative: ambiguous or range queries
 * ("last week", "in January") yield {@code null} so we don't over-filter.
 */
@Component
public class QuestionDateExtractor {

    private final ZoneId zone;

    // ISO: 2026-01-01
    private static final Pattern ISO = Pattern.compile("\\b(\\d{4})-(\\d{1,2})-(\\d{1,2})\\b");
    // Numeric: 1/1/2026 or 01-01-2026 (day-first, then fallback month-first)
    private static final Pattern NUMERIC = Pattern.compile("\\b(\\d{1,2})[/](\\d{1,2})[/](\\d{4})\\b");

    // Textual: "1 January 2026", "January 1, 2026", "Jan 1 2026", with optional ordinal suffix.
    private static final List<DateTimeFormatter> TEXT_FORMATS = List.of(
            DateTimeFormatter.ofPattern("d MMMM uuuu", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("d MMM uuuu", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("MMMM d uuuu", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("MMM d uuuu", Locale.ENGLISH));
    private static final Pattern TEXTUAL = Pattern.compile(
            "\\b("
                    + "(?:\\d{1,2}(?:st|nd|rd|th)?\\s+[A-Za-z]{3,9}\\s+\\d{4})"   // 1 January 2026
                    + "|(?:[A-Za-z]{3,9}\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4})"  // January 1, 2026
                    + ")\\b");

    public QuestionDateExtractor(
            @Value("${geotrail.rag.display-zone:Asia/Kolkata}") String displayZone) {
        this.zone = ZoneId.of(displayZone);
    }

    /** Returns the single date referenced by the question, or {@code null} if none/ambiguous. */
    public LocalDate extract(String question) {
        if (question == null || question.isBlank()) {
            return null;
        }
        String q = question.trim();
        String lower = q.toLowerCase(Locale.ENGLISH);

        if (lower.contains("yesterday")) {
            return LocalDate.now(zone).minusDays(1);
        }
        if (lower.contains("today")) {
            return LocalDate.now(zone);
        }

        Matcher iso = ISO.matcher(q);
        if (iso.find()) {
            LocalDate d = tryParse(() -> LocalDate.of(
                    Integer.parseInt(iso.group(1)),
                    Integer.parseInt(iso.group(2)),
                    Integer.parseInt(iso.group(3))));
            if (d != null) {
                return d;
            }
        }

        Matcher textual = TEXTUAL.matcher(q);
        if (textual.find()) {
            String cleaned = textual.group(1)
                    .replaceAll("(?<=\\d)(st|nd|rd|th)", "")  // drop ordinal suffix
                    .replace(",", "")
                    .replaceAll("\\s+", " ")
                    .trim();
            for (DateTimeFormatter fmt : TEXT_FORMATS) {
                LocalDate d = tryParse(() -> LocalDate.parse(cleaned, fmt));
                if (d != null) {
                    return d;
                }
            }
        }

        Matcher numeric = NUMERIC.matcher(q);
        if (numeric.find()) {
            int a = Integer.parseInt(numeric.group(1));
            int b = Integer.parseInt(numeric.group(2));
            int year = Integer.parseInt(numeric.group(3));
            // Prefer day/month; fall back to month/day if day-first is invalid.
            LocalDate d = tryParse(() -> LocalDate.of(year, b, a));
            if (d == null) {
                d = tryParse(() -> LocalDate.of(year, a, b));
            }
            return d;
        }

        return null;
    }

    private static LocalDate tryParse(java.util.function.Supplier<LocalDate> supplier) {
        try {
            return supplier.get();
        } catch (RuntimeException e) {
            return null;
        }
    }
}
