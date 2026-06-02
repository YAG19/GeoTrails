-- RAG: second embedding store, populated when geotrail.rag.embedding-provider=gemini.
--
-- Vectors from different embedding models are NOT comparable (cosine similarity across
-- models is meaningless), so Gemini embeddings live in their own table rather than mixing
-- with the LM Studio / nomic-embed vectors in timeline_embeddings. The dimension happens
-- to match (768) because we request gemini-embedding-001 with outputDimensionality=768,
-- but the separation is about model identity, not size.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE gemini_timeline_embeddings (
    id              BIGSERIAL    PRIMARY KEY,
    user_id         BIGINT       NOT NULL,            -- multi-tenant scoping; FK to users.id (BIGINT)
    segment_type    VARCHAR(20)  NOT NULL,            -- "visit" or "activity"
    segment_id      BIGINT       NOT NULL,            -- FK to visits.id or user_activity.id
    summary         TEXT         NOT NULL,            -- human-readable sentence
    embedding       vector(768)  NOT NULL,            -- gemini-embedding-001 @ outputDimensionality=768
    segment_date    DATE         NOT NULL,            -- for fast date pre-filter
    start_time      TIMESTAMPTZ  NOT NULL,
    end_time        TIMESTAMPTZ  NOT NULL,
    created_at      TIMESTAMPTZ  DEFAULT now(),
    CONSTRAINT uq_gemini_timeline_embeddings_segment UNIQUE (user_id, segment_type, segment_id)
);

-- Approximate nearest-neighbour index for cosine similarity search.
CREATE INDEX idx_gte_embedding ON gemini_timeline_embeddings
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Date pre-filter + per-user lookup helpers.
CREATE INDEX idx_gte_date ON gemini_timeline_embeddings (segment_date);
CREATE INDEX idx_gte_user ON gemini_timeline_embeddings (user_id);
