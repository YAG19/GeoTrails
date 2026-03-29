ALTER TABLE location_points
    ADD COLUMN activity_type VARCHAR(50);

CREATE INDEX idx_location_activity_type
    ON location_points(user_id, activity_type);
