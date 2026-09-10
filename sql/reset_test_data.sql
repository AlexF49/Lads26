-- One-off cleanup: wipes all test scoring/bonus data before the real event, while
-- leaving match pairings/tee times (matches, match_players), players, courses, holes,
-- competition point values, and settings untouched.
--
-- scores and corrections have no delete policy exposed to the app on purpose (so
-- nothing in the UI can ever wipe a score) — run this directly in the Supabase SQL
-- editor, which connects as the table owner and bypasses RLS.

delete from corrections;
delete from competition_results;
delete from hammers;
delete from drives;
delete from gruesomes;
delete from prediction_snapshots;
delete from scores;
