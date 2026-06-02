-- Core place visits
CREATE TABLE visits (
id BIGSERIAL PRIMARY KEY,
place_id VARCHAR(255),          -- Google placeId
semantic_type VARCHAR(50),      -- HOME, WORK, UNKNOWN
start_time TIMESTAMPTZ NOT NULL,
end_time TIMESTAMPTZ NOT NULL,
lat DECIMAL(10, 7),
lng DECIMAL(10, 7),
probability DECIMAL(5, 4)
);

-- Travel activities between places
CREATE TABLE user_activity (
id BIGSERIAL PRIMARY KEY,
activity_type VARCHAR(50),      -- MOTORCYCLING, WALKING, etc.
start_time TIMESTAMPTZ NOT NULL,
end_time TIMESTAMPTZ NOT NULL,
start_lat DECIMAL(10, 7),
start_lng DECIMAL(10, 7),
end_lat DECIMAL(10, 7),
end_lng DECIMAL(10, 7),
distance_meters DECIMAL(10, 2),
probability DECIMAL(5, 4)
);

-- Raw GPS breadcrumbs (optional, for map rendering)
CREATE TABLE timeline_paths (
id BIGSERIAL PRIMARY KEY,
segment_start TIMESTAMPTZ,
lat DECIMAL(10, 7),
lng DECIMAL(10, 7),
recorded_at TIMESTAMPTZ NOT NULL
);