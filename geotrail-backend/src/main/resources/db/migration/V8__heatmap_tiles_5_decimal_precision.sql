-- Increase heatmap bucket precision from 2 -> 5 decimal places (~1km -> ~1m grid)
-- for a more accurate heat map.
--
-- Existing rows were bucketed at 2 decimals and are meaningless at the new
-- resolution. heatmap_tiles is a derived cache (fully rebuilt nightly by
-- HeatmapRefreshScheduler / refreshHeatmapTiles), so we clear it here rather
-- than letting stale coarse buckets coexist with fine ones until each user's
-- next refresh.
TRUNCATE TABLE heatmap_tiles;

ALTER TABLE heatmap_tiles
    ALTER COLUMN lat_bucket TYPE NUMERIC(7, 5),
    ALTER COLUMN lng_bucket TYPE NUMERIC(8, 5);
