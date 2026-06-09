-- V15__activity_overrides.sql
-- Let a user override Google's inferred transport mode for a travel segment
-- (e.g. Google logged IN_PASSENGER_VEHICLE / "driving" but it was actually a
-- taxi ride). The original `activity_type` is preserved untouched; reads
-- coalesce corrected -> original so insights/stats reflect the user's truth.
--
--   correction_source: 'manual' (inline edit) or 'ai' (assistant-driven)

ALTER TABLE user_activity ADD COLUMN IF NOT EXISTS corrected_activity_type VARCHAR(50);
ALTER TABLE user_activity ADD COLUMN IF NOT EXISTS correction_source       VARCHAR(20);
