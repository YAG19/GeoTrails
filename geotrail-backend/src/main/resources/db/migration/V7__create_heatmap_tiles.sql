CREATE TABLE heatmap_tiles (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lat_bucket    NUMERIC(7, 2) NOT NULL,
    lng_bucket    NUMERIC(7, 2) NOT NULL,
    point_count   INTEGER NOT NULL DEFAULT 0,
    computed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, lat_bucket, lng_bucket)
);

CREATE INDEX idx_heatmap_tiles_user ON heatmap_tiles(user_id, point_count DESC);
