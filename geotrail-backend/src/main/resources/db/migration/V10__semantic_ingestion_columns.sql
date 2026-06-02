-- V10__semantic_ingestion_columns.sql
-- Capture the rich semantic data from Google Timeline imports that was previously
-- discarded (everything was flattened into location_points).
--
--   * visits         -> raw Google placeId
--   * user_activity  -> segment start/end times and start/end coordinates
--   * timeline_paths -> new table for raw GPS breadcrumbs

-- ==================== VISITS ====================
-- semantic_type, lat, lng, probability were already added in V9.
ALTER TABLE visits ADD COLUMN IF NOT EXISTS google_place_id VARCHAR(255); -- Google placeId (e.g. "ChIJ...")

-- ==================== USER_ACTIVITY ====================
-- activity_type, distance_meters and probability already exist.
ALTER TABLE user_activity ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ;
ALTER TABLE user_activity ADD COLUMN IF NOT EXISTS end_time   TIMESTAMPTZ;
ALTER TABLE user_activity ADD COLUMN IF NOT EXISTS start_lat  DECIMAL(10, 7);
ALTER TABLE user_activity ADD COLUMN IF NOT EXISTS start_lng  DECIMAL(10, 7);
ALTER TABLE user_activity ADD COLUMN IF NOT EXISTS end_lat    DECIMAL(10, 7);
ALTER TABLE user_activity ADD COLUMN IF NOT EXISTS end_lng    DECIMAL(10, 7);

-- ==================== TIMELINE PATHS ====================
-- Raw GPS breadcrumbs (one row per recorded point inside a movement segment).
CREATE TABLE timeline_paths (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    segment_start   TIMESTAMPTZ,
    lat             DECIMAL(10, 7),
    lng             DECIMAL(10, 7),
    recorded_at     TIMESTAMPTZ     NOT NULL,
    created_at      TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX idx_timeline_paths_user_time
    ON timeline_paths(user_id, recorded_at DESC);

-- Prevent duplicate breadcrumbs when the same export is imported twice.
CREATE UNIQUE INDEX idx_timeline_paths_dedup
    ON timeline_paths(user_id, recorded_at, lat, lng);
