-- V2__add_user_activity_columns.sql
-- Create user_activity table

CREATE TABLE user_activity (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type   VARCHAR(50)     NOT NULL,
    activity_date   DATE            NOT NULL,
    details         TEXT,
    distance_meters DOUBLE PRECISION,
    created_at      TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX idx_user_activity_user_date
    ON user_activity(user_id, activity_date DESC);
