-- Runs once on first DB init (empty data volume). Enables the extensions GeoTrail
-- relies on so they exist before Flyway runs. Flyway's V11 also issues
-- CREATE EXTENSION IF NOT EXISTS vector, so this is belt-and-suspenders.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;
