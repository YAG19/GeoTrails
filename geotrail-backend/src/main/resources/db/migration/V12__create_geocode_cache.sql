-- Cache of reverse-geocoded coordinates (Nominatim / OpenStreetMap).
-- Keyed on coordinates rounded to ~11m (4 decimal places) so nearby points
-- share a single lookup. Populated lazily on cache miss during summary
-- generation; never re-fetched while a row exists (subject to app-level TTL).
CREATE TABLE geocode_cache (
    id            BIGSERIAL PRIMARY KEY,
    lat_key       NUMERIC(9, 4) NOT NULL,
    lon_key       NUMERIC(9, 4) NOT NULL,
    area_name     VARCHAR(255),
    display_name  TEXT,
    road          VARCHAR(255),
    suburb        VARCHAR(255),
    city_district VARCHAR(255),
    city          VARCHAR(255),
    state         VARCHAR(255),
    postcode      VARCHAR(20),
    country       VARCHAR(100),
    country_code  VARCHAR(8),
    osm_type      VARCHAR(20),
    osm_id        BIGINT,
    raw_response  TEXT,
    fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_geocode_latlon UNIQUE (lat_key, lon_key)
);
