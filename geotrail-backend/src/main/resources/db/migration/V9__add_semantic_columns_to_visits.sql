-- V9__add_semantic_columns_to_visits.sql

ALTER TABLE visits ADD COLUMN semantic_type VARCHAR(50); -- HOME, WORK, UNKNOWN
ALTER TABLE visits ADD COLUMN lat DECIMAL(10, 7);
ALTER TABLE visits ADD COLUMN lng DECIMAL(10, 7);
ALTER TABLE visits ADD COLUMN probability DECIMAL(5, 4);
