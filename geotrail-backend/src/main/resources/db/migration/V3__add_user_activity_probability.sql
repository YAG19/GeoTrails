-- V3__add_user_activity_probability.sql
-- Add probability column to user_activity

ALTER TABLE user_activity ADD COLUMN probability DOUBLE PRECISION;
