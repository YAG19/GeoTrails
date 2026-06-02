package com.geotrail.rag.service;

import com.geotrail.geocode.service.GeocodeService;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * Turns a visit/activity DB row into a human-readable English sentence.
 * That sentence is what gets embedded and later shown to Claude as grounding context.
 *
 * <p>Rules (per RAG spec section 6.1): always include the full date, format durations
 * and distances cleanly, normalise activity types, and omit the classification clause
 * for UNKNOWN visits. Lat/lng are resolved to an area name via the cached, rate-limited
 * {@link GeocodeService} (Nominatim); on a cache miss or geocoder failure we fall back to
 * a small hard-coded Bangalore lookup and finally a rounded lat/lng string, so summary
 * generation never breaks on a geocoder hiccup.
 */
@Slf4j
@Component
public class TimelineSummaryGenerator {

//    private static final Logger log = LoggerFactory.getLogger(TimelineSummaryGenerator.class);

    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("EEEE d MMMM uuuu", Locale.ENGLISH);
    private static final DateTimeFormatter TIME_FMT =
            DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH);

    private final ZoneId displayZone;
    private final GeocodeService geocodeService;

    public TimelineSummaryGenerator(
            @Value("${geotrail.rag.display-zone:Asia/Kolkata}") String displayZone,
            GeocodeService geocodeService) {
        this.displayZone = ZoneId.of(displayZone);
        this.geocodeService = geocodeService;
    }

    public String generateVisitSummary(String semanticType, Instant start, Instant end,
                                       BigDecimal lat, BigDecimal lng) {
        ZonedDateTime startZdt = start.atZone(displayZone);
        String when = startZdt.format(DATE_FMT) + " at " + startZdt.format(TIME_FMT);
        String area = areaName(lat, lng);
        String duration = formatDuration(start, end);

        StringBuilder sb = new StringBuilder();
        sb.append("On ").append(when)
          .append(", you stayed at a location near ").append(area);
        if (duration != null) {
            sb.append(" for ").append(duration);
        }
        sb.append(".");

        if (semanticType != null && !semanticType.isBlank()
                && !"UNKNOWN".equalsIgnoreCase(semanticType)) {
            sb.append(" Google classified this as your ")
              .append(semanticType.toUpperCase(Locale.ENGLISH)).append(".");
        }
        return sb.toString();
    }

    public String generateActivitySummary(String activityType, Instant start, Instant end,
                                          BigDecimal startLat, BigDecimal startLng,
                                          BigDecimal endLat, BigDecimal endLng,
                                          Double distanceMeters) {
        ZonedDateTime startZdt = start.atZone(displayZone);
        String when = startZdt.format(DATE_FMT) + " at " + startZdt.format(TIME_FMT);
        String mode = formatActivityType(activityType);
        String fromArea = areaName(startLat, startLng);
        String toArea = areaName(endLat, endLng);

        StringBuilder sb = new StringBuilder();
        sb.append("On ").append(when)
          .append(", you travelled by ").append(mode);
        if (distanceMeters != null && distanceMeters > 0) {
            sb.append(" covering ")
              .append(String.format(Locale.ENGLISH, "%.1f", distanceMeters / 1000.0))
              .append(" km");
        }
        sb.append(" from ").append(fromArea).append(" to ").append(toArea);
        String duration = formatDuration(start, end);
        if (duration != null) {
            sb.append(", taking about ").append(duration);
        }
        sb.append(".");
        return sb.toString();
    }

    /** "X hours Y minutes" for >60 min, "X minutes" for <60 min; null if not computable. */
    private String formatDuration(Instant start, Instant end) {
        if (start == null || end == null) {
            return null;
        }
        long minutes = Duration.between(start, end).toMinutes();
        if (minutes <= 0) {
            return null;
        }
        if (minutes < 60) {
            return minutes + (minutes == 1 ? " minute" : " minutes");
        }
        long hours = minutes / 60;
        long rem = minutes % 60;
        String h = hours + (hours == 1 ? " hour" : " hours");
        return rem == 0 ? h : h + " " + rem + (rem == 1 ? " minute" : " minutes");
    }

    /** "IN_PASSENGER_VEHICLE" -> "passenger vehicle". */
    private String formatActivityType(String activityType) {
        if (activityType == null || activityType.isBlank()) {
            return "an unknown mode of transport";
        }
        String s = activityType.replace('_', ' ').toLowerCase(Locale.ENGLISH).trim();
        // common prefixes that read awkwardly
        if (s.startsWith("in ")) {
            s = s.substring(3);
        }
        return s;
    }

    /**
     * Resolves a coordinate to an area name. Tries the cached, rate-limited geocoder
     * first; on a miss/failure falls back to a small offline Bangalore lookup, and
     * finally a rounded lat/lng string — so a geocoder hiccup never breaks a summary.
     */
    private String areaName(BigDecimal lat, BigDecimal lng) {

        if (lat == null || lng == null) {
            return "an unknown location";
        }

        String resolved = geocodeService.resolveAreaName(lat, lng);
        if (resolved != null && !resolved.isBlank()) {
            log.debug("Successfully resolved area name via geocoder for coordinates {}, {}: {}", lat, lng, resolved);
            return resolved;
        }
        
        log.debug("Geocoder failed to resolve area name for coordinates {}, {}. Falling back to offline lookup.", lat, lng);

        double la = lat.doubleValue();
        double lo = lng.doubleValue();
        String[][] areas = {
                // name, lat, lng (approx centroids)
                {"Hebbal, Bangalore", "13.0358", "77.5970"},
                {"Koramangala, Bangalore", "12.9352", "77.6245"},
                {"Indiranagar, Bangalore", "12.9719", "77.6412"},
                {"Whitefield, Bangalore", "12.9698", "77.7500"},
                {"Electronic City, Bangalore", "12.8452", "77.6602"},
                {"Marathahalli, Bangalore", "12.9591", "77.6974"},
                {"MG Road, Bangalore", "12.9756", "77.6068"},
                {"Jayanagar, Bangalore", "12.9250", "77.5938"},
                {"HSR Layout, Bangalore", "12.9116", "77.6473"},
                {"Yelahanka, Bangalore", "13.1007", "77.5963"},
        };
        String best = null;
        double bestDist = Double.MAX_VALUE;
        for (String[] a : areas) {
            double aLat = Double.parseDouble(a[1]);
            double aLng = Double.parseDouble(a[2]);
            double d = Math.hypot(la - aLat, lo - aLng);
            if (d < bestDist) {
                bestDist = d;
                best = a[0];
            }
        }
        // ~0.05 deg ≈ 5.5 km radius; beyond that, don't guess an area name.
        if (best != null && bestDist <= 0.05) {
            return best;
        }
        return String.format(Locale.ENGLISH, "coordinates %.4f, %.4f", la, lo);
    }
}
