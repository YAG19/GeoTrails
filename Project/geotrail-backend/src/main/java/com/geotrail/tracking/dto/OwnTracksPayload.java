package com.geotrail.tracking.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

/**
 * OwnTracks HTTP payload format.
 * See: https://owntracks.org/booklet/tech/json/
 *
 * The phone sends JSON like:
 * {
 *   "_type": "location",
 *   "lat": 40.7128,
 *   "lon": -74.0060,
 *   "acc": 10,
 *   "alt": 50,
 *   "batt": 85,
 *   "vel": 5,
 *   "tst": 1700000000,
 *   "tid": "AB"
 * }
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class OwnTracksPayload {

    @JsonProperty("_type")
    private String type;  // "location", "waypoint", "transition", etc.

    private Double lat;
    private Double lon;

    @JsonProperty("acc")
    private Double accuracy;

    @JsonProperty("alt")
    private Double altitude;

    @JsonProperty("batt")
    private Short battery;

    @JsonProperty("vel")
    private Double velocity;

    /**
     * Unix timestamp (seconds since epoch).
     */
    @JsonProperty("tst")
    private Long timestamp;

    /**
     * Tracker ID (2-char identifier set in OwnTracks app).
     */
    @JsonProperty("tid")
    private String trackerId;

    /**
     * Connection type: w=wifi, m=mobile, o=offline.
     */
    @JsonProperty("conn")
    private String connection;

    /**
     * Trigger: p=ping, c=circular region, b=beacon, r=response, u=manual, t=timer.
     */
    @JsonProperty("t")
    private String trigger;

    public boolean isLocation() {
        return "location".equals(type);
    }
}
