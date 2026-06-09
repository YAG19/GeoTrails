-- V14__frequent_trips.sql
-- Capture the `frequentTrips` / commute-pattern section of the Google Timeline
-- export, which was previously parsed-and-dropped. One row per recurring trip
-- (e.g. home -> work) describing its endpoints, how often it occurs and the
-- typical transport mode. Powers the "commute patterns" dashboard insight.
--
-- This table is a per-user snapshot of the latest export: the importer clears a
-- user's rows before re-inserting, so no dedup constraint is required.

CREATE TABLE frequent_trips (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    origin_lat      DECIMAL(10, 7),
    origin_lng      DECIMAL(10, 7),
    dest_lat        DECIMAL(10, 7),
    dest_lng        DECIMAL(10, 7),
    origin_place_id VARCHAR(255),   -- Google placeId of the origin, when present
    dest_place_id   VARCHAR(255),   -- Google placeId of the destination, when present
    trip_count      INTEGER,        -- how many times Google observed this trip
    typical_mode    VARCHAR(50),    -- dominant activity_type (e.g. IN_PASSENGER_VEHICLE)
    distance_meters DOUBLE PRECISION,
    created_at      TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX idx_frequent_trips_user ON frequent_trips(user_id);
