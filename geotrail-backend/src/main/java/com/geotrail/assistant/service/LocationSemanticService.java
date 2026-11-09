package com.geotrail.assistant.service;

import com.geotrail.activity.entity.UserActivity;
import com.geotrail.activity.repository.UserActivityRepository;
import com.geotrail.assistant.dto.AssistantDtos.SourceRecord;
import com.geotrail.auth.entity.User;
import com.geotrail.location.entity.LocationPoint;
import com.geotrail.location.repository.LocationPointRepository;
import com.geotrail.trips.entity.Trip;
import com.geotrail.trips.entity.Visit;
import com.geotrail.trips.repository.TripRepository;
import com.geotrail.trips.repository.VisitRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class LocationSemanticService {

    private final LocationPointRepository locationPointRepository;
    private final UserActivityRepository userActivityRepository;
    private final VisitRepository visitRepository;
    private final TripRepository tripRepository;

    @Data
    @Builder
    public static class SemanticContext {
        private String contextText;
        private List<SourceRecord> sources;
    }

    public SemanticContext retrieveContext(User user, String query) {
        LocalDate parsedDate = parseDateFromQuery(query);
        List<SourceRecord> sources = new ArrayList<>();
        StringBuilder contextBuilder = new StringBuilder();

        if (parsedDate != null) {
            log.info("Parsed date '{}' from query '{}' for user '{}'", parsedDate, query, user.getUsername());
            contextBuilder.append("RETRIEVED LOCATION DATA FOR DATE: ").append(parsedDate).append("\n\n");

            Instant start = parsedDate.atStartOfDay(ZoneOffset.UTC).toInstant();
            Instant end = parsedDate.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();

            // 1. Fetch activities for that specific day
            List<UserActivity> activities = userActivityRepository.findByUserIdAndActivityDate(user.getId(), parsedDate);
            if (!activities.isEmpty()) {
                contextBuilder.append("--- ACTIVITIES ON THIS DATE ---\n");
                for (UserActivity act : activities) {
                    String desc = String.format("- Type: %s, Distance: %.1f m, Probability: %.1f%%, Details: %s",
                            act.getActivityType(),
                            act.getDistanceMeters() != null ? act.getDistanceMeters() : 0.0,
                            act.getProbability() != null ? act.getProbability() * 100 : 100.0,
                            act.getDetails() != null ? act.getDetails() : "None");
                    contextBuilder.append(desc).append("\n");

                    sources.add(SourceRecord.builder()
                            .type("ACTIVITY")
                            .time(parsedDate.toString())
                            .details(desc.substring(2))
                            .build());
                }
                contextBuilder.append("\n");
            }

            // 2. Fetch visits on that specific day
            List<Visit> visits = visitRepository.findByUserAndTimeRange(user.getId(), start, end);
            if (!visits.isEmpty()) {
                contextBuilder.append("--- PLACE VISITS ON THIS DATE ---\n");
                for (Visit v : visits) {
                    String placeName = v.getPlace() != null ? v.getPlace().getName() : "Unknown Place";
                    String category = v.getPlace() != null ? v.getPlace().getCategory() : "General";
                    String desc = String.format("- Visited '%s' (Category: %s), Started: %s, Ended: %s, Duration: %s mins",
                            placeName, category,
                            v.getStartedAt() != null ? formatInstant(v.getStartedAt()) : "N/A",
                            v.getEndedAt() != null ? formatInstant(v.getEndedAt()) : "Still there",
                            v.getDurationMinutes() != null ? v.getDurationMinutes() : "Unknown");
                    contextBuilder.append(desc).append("\n");

                    double lat = v.getCenterPoint() != null ? v.getCenterPoint().getY() : 0.0;
                    double lon = v.getCenterPoint() != null ? v.getCenterPoint().getX() : 0.0;

                    sources.add(SourceRecord.builder()
                            .type("VISIT")
                            .time(v.getStartedAt() != null ? formatInstant(v.getStartedAt()) : parsedDate.toString())
                            .details(desc.substring(2))
                            .latitude(lat != 0.0 ? lat : null)
                            .longitude(lon != 0.0 ? lon : null)
                            .build());
                }
                contextBuilder.append("\n");
            }

            // 3. Fetch trips on that specific day
            List<Trip> trips = tripRepository.findByUserAndTimeRange(user.getId(), start, end);
            if (!trips.isEmpty()) {
                contextBuilder.append("--- TRIPS ON THIS DATE ---\n");
                for (Trip t : trips) {
                    String fromStr = t.getFromPlace() != null ? t.getFromPlace().getName() : "Start Coordinates";
                    String toStr = t.getToPlace() != null ? t.getToPlace().getName() : "End Coordinates";
                    String desc = String.format("- Travel by %s from '%s' to '%s', Distance: %.1f m, Started: %s, Ended: %s",
                            t.getTransportMode() != null ? t.getTransportMode() : "Unknown Mode",
                            fromStr, toStr,
                            t.getDistanceMeters() != null ? t.getDistanceMeters() : 0.0,
                            formatInstant(t.getStartedAt()),
                            formatInstant(t.getEndedAt()));
                    contextBuilder.append(desc).append("\n");

                    sources.add(SourceRecord.builder()
                            .type("TRIP")
                            .time(formatInstant(t.getStartedAt()))
                            .details(desc.substring(2))
                            .build());
                }
                contextBuilder.append("\n");
            }

            // 4. Fetch location points for that specific day (sample/limit to avoid overloading LLM)
            List<LocationPoint> points = locationPointRepository.findByUserAndTimeRange(user.getId(), start, end);
            if (!points.isEmpty()) {
                contextBuilder.append("--- DETAILED COORDINATES RECORDED (Sampled) ---\n");
                int step = Math.max(1, points.size() / 20); // Get max 20 points
                for (int i = 0; i < points.size(); i += step) {
                    LocationPoint pt = points.get(i);
                    double lat = pt.getCoordinates().getY();
                    double lon = pt.getCoordinates().getX();
                    String desc = String.format("Time: %s, Location: [%.6f, %.6f], Accuracy: %.1fm, Speed: %.1f m/s, Source: %s",
                            formatInstant(pt.getRecordedAt()),
                            lat, lon,
                            pt.getAccuracy() != null ? pt.getAccuracy() : 0.0,
                            pt.getVelocity() != null ? pt.getVelocity() : 0.0,
                            pt.getSource());
                    contextBuilder.append("- ").append(desc).append("\n");

                    sources.add(SourceRecord.builder()
                            .type("LOCATION")
                            .time(formatInstant(pt.getRecordedAt()))
                            .details(desc)
                            .latitude(lat)
                            .longitude(lon)
                            .build());

                    if (sources.size() >= 40) break; // Hard limit for sources size
                }
            }

            if (activities.isEmpty() && visits.isEmpty() && trips.isEmpty() && points.isEmpty()) {
                contextBuilder.append("No locations, visits, or activities were found in the database for this date.");
            }

        } else {
            // Default to returning the latest history context if no specific date is parsed
            log.info("No specific date found in query '{}' for user '{}'. Loading recent history.", query, user.getUsername());
            contextBuilder.append("RETRIEVED RECENT LOCATION HISTORY (No specific date parsed):\n\n");

            // Fetch recent activities
            List<UserActivity> recentActivities = userActivityRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
            if (!recentActivities.isEmpty()) {
                contextBuilder.append("--- RECENT ACTIVITIES ---\n");
                int limit = Math.min(recentActivities.size(), 5);
                for (int i = 0; i < limit; i++) {
                    UserActivity act = recentActivities.get(i);
                    String desc = String.format("- Date: %s, Type: %s, Distance: %.1f m, Details: %s",
                            act.getActivityDate(), act.getActivityType(),
                            act.getDistanceMeters() != null ? act.getDistanceMeters() : 0.0,
                            act.getDetails() != null ? act.getDetails() : "None");
                    contextBuilder.append(desc).append("\n");

                    sources.add(SourceRecord.builder()
                            .type("ACTIVITY")
                            .time(act.getActivityDate().toString())
                            .details(desc.substring(2))
                            .build());
                }
                contextBuilder.append("\n");
            }

            // Fetch recent visits
            PageRequest page = PageRequest.of(0, 5);
            List<Visit> recentVisits = visitRepository.findByUserAndTimeRange(
                    user.getId(),
                    Instant.now().minus(Period.ofDays(30)),
                    Instant.now()
            );
            if (!recentVisits.isEmpty()) {
                contextBuilder.append("--- RECENT VISITS (Last 30 Days) ---\n");
                int limit = Math.min(recentVisits.size(), 5);
                for (int i = 0; i < limit; i++) {
                    Visit v = recentVisits.get(i);
                    String placeName = v.getPlace() != null ? v.getPlace().getName() : "Unknown Place";
                    String desc = String.format("- Place: '%s', Date: %s, Duration: %s mins",
                            placeName, formatInstant(v.getStartedAt()),
                            v.getDurationMinutes() != null ? v.getDurationMinutes() : "Unknown");
                    contextBuilder.append(desc).append("\n");

                    double lat = v.getCenterPoint() != null ? v.getCenterPoint().getY() : 0.0;
                    double lon = v.getCenterPoint() != null ? v.getCenterPoint().getX() : 0.0;

                    sources.add(SourceRecord.builder()
                            .type("VISIT")
                            .time(formatInstant(v.getStartedAt()))
                            .details(desc.substring(2))
                            .latitude(lat != 0.0 ? lat : null)
                            .longitude(lon != 0.0 ? lon : null)
                            .build());
                }
            }
        }

        return SemanticContext.builder()
                .contextText(contextBuilder.toString())
                .sources(sources)
                .build();
    }

    /**
     * Regex based simple natural language date extractor.
     * Matches patterns:
     * - "2026-01-01" or "2026/01/01" or "2026-1-1"
     * - "1 jan 2026" or "12 january 2026"
     * - "jan 1 2026" or "january 15, 2026"
     */
    private LocalDate parseDateFromQuery(String query) {
        if (query == null || query.isBlank()) {
            return null;
        }

        String lowerQuery = query.toLowerCase();

        // 1. Matches YYYY-MM-DD or YYYY/MM/DD
        Pattern ymdPattern = Pattern.compile("\\b(\\d{4})[-/](\\d{1,2})[-/](\\d{1,2})\\b");
        Matcher ymdMatcher = ymdPattern.matcher(lowerQuery);
        if (ymdMatcher.find()) {
            try {
                int y = Integer.parseInt(ymdMatcher.group(1));
                int m = Integer.parseInt(ymdMatcher.group(2));
                int d = Integer.parseInt(ymdMatcher.group(3));
                return LocalDate.of(y, m, d);
            } catch (Exception e) {
                log.warn("Failed to parse standard date match: {}", ymdMatcher.group(0), e);
            }
        }

        String monthRegex = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

        // 2. Matches "1 jan 2026", "15 december 2025", "1st jan 2026", "2nd january 2026"
        Pattern dmyPattern = Pattern.compile("\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+" + monthRegex + "\\s+(\\d{4})\\b");
        Matcher dmyMatcher = dmyPattern.matcher(lowerQuery);
        if (dmyMatcher.find()) {
            try {
                int d = Integer.parseInt(dmyMatcher.group(1));
                int m = parseMonth(dmyMatcher.group(2));
                int y = Integer.parseInt(dmyMatcher.group(3));
                return LocalDate.of(y, m, d);
            } catch (Exception e) {
                log.warn("Failed to parse DMY date match: {}", dmyMatcher.group(0), e);
            }
        }

        // 3. Matches "jan 1 2026", "january 15, 2026", "oct 1st 2026"
        Pattern mdyPattern = Pattern.compile("\\b" + monthRegex + "\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b");
        Matcher mdyMatcher = mdyPattern.matcher(lowerQuery);
        if (mdyMatcher.find()) {
            try {
                int m = parseMonth(mdyMatcher.group(1));
                int d = Integer.parseInt(mdyMatcher.group(2));
                int y = Integer.parseInt(mdyMatcher.group(3));
                return LocalDate.of(y, m, d);
            } catch (Exception e) {
                log.warn("Failed to parse MDY date match: {}", mdyMatcher.group(0), e);
            }
        }

        return null;
    }

    private int parseMonth(String monthStr) {
        if (monthStr.startsWith("jan")) return 1;
        if (monthStr.startsWith("feb")) return 2;
        if (monthStr.startsWith("mar")) return 3;
        if (monthStr.startsWith("apr")) return 4;
        if (monthStr.startsWith("may")) return 5;
        if (monthStr.startsWith("jun")) return 6;
        if (monthStr.startsWith("jul")) return 7;
        if (monthStr.startsWith("aug")) return 8;
        if (monthStr.startsWith("sep")) return 9;
        if (monthStr.startsWith("oct")) return 10;
        if (monthStr.startsWith("nov")) return 11;
        if (monthStr.startsWith("dec")) return 12;
        throw new IllegalArgumentException("Unknown month: " + monthStr);
    }

    private String formatInstant(Instant instant) {
        if (instant == null) return "N/A";
        return DateTimeFormatter.ISO_LOCAL_TIME
                .withZone(ZoneId.of("UTC"))
                .format(instant)
                .substring(0, 5); // Just "HH:mm"
    }
}
