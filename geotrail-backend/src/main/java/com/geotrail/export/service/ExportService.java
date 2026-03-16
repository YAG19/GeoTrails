package com.geotrail.export.service;

import com.geotrail.location.entity.LocationPoint;
import com.geotrail.location.repository.LocationPointRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExportService {

    private final LocationPointRepository locationRepo;

    @Transactional(readOnly = true)
    public String exportGeoJson(Long userId, Instant from, Instant to) {
        List<LocationPoint> points = locationRepo.findByUserAndTimeRange(userId, from, to);

        StringBuilder sb = new StringBuilder();
        sb.append("{\"type\":\"FeatureCollection\",\"features\":[");

        for (int i = 0; i < points.size(); i++) {
            LocationPoint p = points.get(i);
            if (i > 0) sb.append(",");
            sb.append("{\"type\":\"Feature\",")
              .append("\"geometry\":{\"type\":\"Point\",\"coordinates\":[")
              .append(p.getLongitude()).append(",").append(p.getLatitude());
            if (p.getAltitude() != null) sb.append(",").append(p.getAltitude());
            sb.append("]},")
              .append("\"properties\":{")
              .append("\"id\":").append(p.getId()).append(",")
              .append("\"recorded_at\":\"").append(p.getRecordedAt()).append("\",")
              .append("\"source\":\"").append(p.getSource()).append("\"");
            if (p.getAccuracy() != null) sb.append(",\"accuracy\":").append(p.getAccuracy());
            if (p.getVelocity() != null) sb.append(",\"velocity\":").append(p.getVelocity());
            sb.append("}}");
        }

        sb.append("]}");
        log.info("Exported {} points as GeoJSON for user {}", points.size(), userId);
        return sb.toString();
    }

    @Transactional(readOnly = true)
    public String exportGpx(Long userId, Instant from, Instant to) {
        List<LocationPoint> points = locationRepo.findByUserAndTimeRange(userId, from, to);
        DateTimeFormatter fmt = DateTimeFormatter.ISO_INSTANT;

        StringBuilder sb = new StringBuilder();
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
          .append("<gpx version=\"1.1\" creator=\"GeoTrail\"\n")
          .append("     xmlns=\"http://www.topografix.com/GPX/1/1\">\n")
          .append("  <trk>\n")
          .append("    <name>GeoTrail Export</name>\n")
          .append("    <trkseg>\n");

        for (LocationPoint p : points) {
            sb.append("      <trkpt lat=\"").append(p.getLatitude())
              .append("\" lon=\"").append(p.getLongitude()).append("\">\n");
            if (p.getAltitude() != null) {
                sb.append("        <ele>").append(p.getAltitude()).append("</ele>\n");
            }
            sb.append("        <time>").append(fmt.format(p.getRecordedAt())).append("</time>\n");
            sb.append("      </trkpt>\n");
        }

        sb.append("    </trkseg>\n")
          .append("  </trk>\n")
          .append("</gpx>");

        log.info("Exported {} points as GPX for user {}", points.size(), userId);
        return sb.toString();
    }
}
