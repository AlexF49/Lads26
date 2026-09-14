-- Allows multiple players to be recorded as winners of the same bonus category on the
-- same hole/day (e.g. two Long Putt winners on the same hole across different matches).
-- Previously the unique constraint was (day, hole, competition_type_id), so only one
-- winner could ever be saved for a given hole+category — this widens it to also include
-- winner_id.
--
-- Safe to run against live/finished-competition data: every existing row already has a
-- distinct winner_id for its (day, hole, competition_type_id), since the old constraint
-- guaranteed at most one row per combination. Widening the constraint doesn't touch or
-- remove any existing rows.
--
-- Run this directly in the Supabase SQL editor (connects as table owner, bypasses RLS).

alter table competition_results
  drop constraint if exists competition_results_day_hole_competition_type_id_key;

alter table competition_results
  add constraint competition_results_day_hole_competition_type_id_winner_id_key
  unique (day, hole, competition_type_id, winner_id);
