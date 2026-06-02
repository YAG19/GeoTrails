-- RAG: natural-language timeline query feature.
-- Stores one embedded, human-readable summary per visit/activity segment.
--
-- Requires the pgvector extension to be available in the Postgres image.
-- (The default postgis/postgis image does NOT bundle pgvector — the DB image
--  must provide it, otherwise this migration fails on CREATE EXTENSION.)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE timeline_embeddings (
    id              BIGSERIAL    PRIMARY KEY,
    user_id         BIGINT       NOT NULL,            -- multi-tenant scoping (NOT in original spec); FK to users.id (BIGINT)
    segment_type    VARCHAR(20)  NOT NULL,            -- "visit" or "activity"
    segment_id      BIGINT       NOT NULL,            -- FK to visits.id or user_activity.id
    summary         TEXT         NOT NULL,            -- human-readable sentence
    embedding       vector(768)  NOT NULL,            -- Gemini text-embedding-004 dimension
    segment_date    DATE         NOT NULL,            -- for fast date pre-filter
    start_time      TIMESTAMPTZ  NOT NULL,
    end_time        TIMESTAMPTZ  NOT NULL,
    created_at      TIMESTAMPTZ  DEFAULT now(),
    CONSTRAINT uq_timeline_embeddings_segment UNIQUE (user_id, segment_type, segment_id)
);

-- Approximate nearest-neighbour index for cosine similarity search.
CREATE INDEX idx_te_embedding ON timeline_embeddings
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Date pre-filter + per-user lookup helpers.
CREATE INDEX idx_te_date ON timeline_embeddings (segment_date);
CREATE INDEX idx_te_user ON timeline_embeddings (user_id);
