package com.geotrail.common.util;

import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;

/**
 * Utility class for geospatial operations.
 * <p>
 * SRID 4326 = WGS84 (GPS standard coordinate system).
 * JTS uses (x=longitude, y=latitude) — easy to mix up, so centralize here.
 */
public final class GeoUtils {

    public static final int SRID_WGS84 = 4326;
    private static final GeometryFactory GEOMETRY_FACTORY =
            new GeometryFactory(new PrecisionModel(), SRID_WGS84);

    private static final double EARTH_RADIUS_METERS = 6_371_000;

    private GeoUtils() {}

    /**
     * Create a JTS Point from latitude and longitude.
     * Note: JTS Coordinate takes (x=lon, y=lat).
     */
    public static Point createPoint(double latitude, double longitude) {
        Point point = GEOMETRY_FACTORY.createPoint(new Coordinate(longitude, latitude));
        point.setSRID(SRID_WGS84);
        return point;
    }

    /**
     * Haversine distance between two lat/lon pairs in meters.
     * Use this for in-memory distance calculations; for DB queries use PostGIS ST_DistanceSphere.
     */
    public static double haversineMeters(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_METERS * c;
    }

    /**
     * Speed in m/s between two points given a time difference in seconds.
     */
    public static double speedMps(double distanceMeters, long timeDiffSeconds) {
        if (timeDiffSeconds <= 0) return 0;
        return distanceMeters / timeDiffSeconds;
    }

    /**
     * Classify transport mode based on speed (m/s).
     */
    public static String classifyTransportMode(double speedMps) {
        double kmh = speedMps * 3.6;
        if (kmh < 1) return "stationary";
        if (kmh < 7) return "walking";
        if (kmh < 25) return "cycling";
        if (kmh < 120) return "driving";
        return "flying";
    }

    public static GeometryFactory getGeometryFactory() {
        return GEOMETRY_FACTORY;
    }
}
