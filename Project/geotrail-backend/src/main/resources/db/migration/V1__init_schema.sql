-- V1__init_schema.sql
-- GeoTrail core schema with PostGIS spatial types

CREATE EXTENSION IF NOT EXISTS postgis;

-- ==================== USERS ====================
CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    username        VARCHAR(50)  UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    timezone        VARCHAR(50)  DEFAULT 'UTC',
    distance_unit   VARCHAR(10)  DEFAULT 'km',      -- 'km' or 'mi'
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- ==================== LOCATION POINTS ====================
CREATE TABLE location_points (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    coordinates     GEOMETRY(Point, 4326) NOT NULL,
    altitude        DOUBLE PRECISION,
    accuracy        DOUBLE PRECISION,
    battery_level   SMALLINT,
    velocity        DOUBLE PRECISION,
    recorded_at     TIMESTAMPTZ     NOT NULL,
    source          VARCHAR(20)     NOT NULL DEFAULT 'live',
    raw_payload     JSONB,
    created_at      TIMESTAMPTZ     DEFAULT NOW()
);

-- Spatial index for map bounding-box queries
CREATE INDEX idx_location_coords
    ON location_points USING GIST(coordinates);

-- Composite index for time-range queries per user
CREATE INDEX idx_location_user_time
    ON location_points(user_id, recorded_at DESC);

-- Source filtering
CREATE INDEX idx_location_source
    ON location_points(user_id, source);

-- Prevent duplicate points (same user, same timestamp, same source)
CREATE UNIQUE INDEX idx_location_dedup
    ON location_points(user_id, recorded_at, source);

-- ==================== PLACES ====================
CREATE TABLE places (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(255)    NOT NULL,
    coordinates     GEOMETRY(Point, 4326) NOT NULL,
    radius_meters   INTEGER         DEFAULT 100,
    category        VARCHAR(50),
    created_at      TIMESTAMPTZ     DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX idx_places_coords
    ON places USING GIST(coordinates);

CREATE INDEX idx_places_user
    ON places(user_id);

-- ==================== VISITS ====================
CREATE TABLE visits (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    place_id        BIGINT          REFERENCES places(id) ON DELETE SET NULL,
    center_point    GEOMETRY(Point, 4326) NOT NULL,
    started_at      TIMESTAMPTZ     NOT NULL,
    ended_at        TIMESTAMPTZ,
    duration_minutes INTEGER,
    created_at      TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX idx_visits_user_time
    ON visits(user_id, started_at DESC);

-- ==================== TRIPS ====================
CREATE TABLE trips (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at      TIMESTAMPTZ     NOT NULL,
    ended_at        TIMESTAMPTZ     NOT NULL,
    distance_meters DOUBLE PRECISION,
    route           GEOMETRY(LineString, 4326),
    transport_mode  VARCHAR(30),
    from_place_id   BIGINT          REFERENCES places(id) ON DELETE SET NULL,
    to_place_id     BIGINT          REFERENCES places(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX idx_trips_user_time
    ON trips(user_id, started_at DESC);

-- ==================== DAILY STATS ====================
CREATE TABLE daily_stats (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stat_date           DATE            NOT NULL,
    total_distance_m    DOUBLE PRECISION DEFAULT 0,
    total_points        INTEGER         DEFAULT 0,
    cities_visited      INTEGER         DEFAULT 0,
    countries_visited   INTEGER         DEFAULT 0,
    time_at_home_min    INTEGER         DEFAULT 0,
    time_in_transit_min INTEGER         DEFAULT 0,
    UNIQUE(user_id, stat_date)
);

-- ==================== IMPORT JOBS ====================
CREATE TABLE import_jobs (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename        VARCHAR(255)    NOT NULL,
    file_size_bytes BIGINT,
    status          VARCHAR(20)     DEFAULT 'PENDING',
    total_records   INTEGER,
    processed       INTEGER         DEFAULT 0,
    duplicates      INTEGER         DEFAULT 0,
    errors          INTEGER         DEFAULT 0,
    error_log       TEXT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX idx_import_jobs_user
    ON import_jobs(user_id, created_at DESC);
