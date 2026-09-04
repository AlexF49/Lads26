-- Lads 2026 — full database schema
-- Run this whole file once in the Supabase SQL editor to (re)create the project from scratch.
--
-- Status: Session 1 uses teams, players, courses, holes and settings. Session 2 (matchday
-- scoring) adds matches, match_players and scores. Everything else (hazards, competitions,
-- corrections, expenses, photos) is created now so the schema never needs a breaking change
-- later — later sessions just start writing to tables that already exist.

create extension if not exists pgcrypto;

-- ============================================================================
-- 1. Teams
-- ============================================================================
create table teams (
  id text primary key,              -- 'europe' | 'usa' | 'australia'
  name text not null,
  color_hex text not null,          -- used for team-colour theming throughout the app
  flag_emoji text                   -- e.g. 🇪🇺 — Unicode flag, no image asset needed
);

insert into teams (id, name, color_hex, flag_emoji) values
  ('europe',    'Europe',    '#1D4ED8', '🇪🇺'),  -- blue
  ('usa',       'USA',       '#DC2626', '🇺🇸'),  -- red
  ('australia', 'Australia', '#D4AF37', '🇦🇺');  -- gold

-- ============================================================================
-- 2. Players
-- ============================================================================
create table players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  team_id text references teams(id),
  handicap integer,                 -- base handicap
  handicap_day1 integer,            -- playing handicap, Day 1 (Greensomes)
  handicap_day2 integer,            -- playing handicap, Day 2 (Betterball matchplay)
  handicap_day3 integer,            -- playing handicap, Day 3 (Singles)
  seed integer,                     -- 1/2/3 within their team, used to order the roster display
  nickname text,                    -- shown instead of first name in the bonus grid header
  bio text,                         -- player bios subpage
  photo_url text,                   -- player bios subpage
  stats jsonb default '{}'::jsonb,  -- freeform career stats for the bios subpage
  created_at timestamptz default now()
);

insert into players (name, team_id, handicap, handicap_day1, handicap_day2, handicap_day3, seed, nickname) values
  ('Nick Bourne',    'europe',    12, 12, 12, 12, 1, 'Nikki'),
  ('Ben Brown',      'europe',    18, 18, 18, 18, 2, 'Habib'),
  ('James Pilling',  'europe',    26, 26, 26, 26, 3, 'Plink'),
  ('James Kibbey',   'usa',       12, 12, 12, 12, 1, 'Qwiz'),
  ('Alan Forrest',   'usa',       18, 18, 18, 18, 2, 'Alan'),
  ('Alex Robinson',  'usa',       24, 24, 24, 24, 3, 'Biggles'),
  ('Paul Cooper',    'australia', 15, 15, 15, 15, 1, 'Chief'),
  ('Andrew Conway',  'australia', 18, 18, 18, 18, 2, 'Leaky'),
  ('Jamie March',    'australia', 36, 36, 36, 36, 3, 'Boner');

-- ============================================================================
-- 3. Courses & holes
-- Stored in the database (not hardcoded in JS) so they can be corrected from the
-- admin panel later without a code change/redeploy.
-- ============================================================================
create table courses (
  id uuid primary key default gen_random_uuid(),
  day integer not null unique,      -- 1, 2 or 3 — this event plays one course per day
  name text not null,
  par_total integer not null
);

create table holes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete cascade,
  hole_number integer not null check (hole_number between 1 and 18),
  par integer not null,
  stroke_index integer not null,
  yardage_white integer,
  yardage_yellow integer,
  yardage_red integer,
  unique(course_id, hole_number)
);

-- Day 1 — Quinta do Lago North
with c as (
  insert into courses (day, name, par_total) values (1, 'Quinta do Lago North', 71)
  returning id
)
insert into holes (course_id, hole_number, par, stroke_index, yardage_white, yardage_yellow, yardage_red)
select id, hole_number, par, stroke_index, yardage_white, yardage_yellow, yardage_red
from c, (values
  (1,  4, 15, 342, 321, 270),
  (2,  3, 11, 196, 174, 132),
  (3,  5,  9, 523, 500, 450),
  (4,  4,  1, 370, 349, 298),
  (5,  4,  5, 312, 390, 242),
  (6,  3, 13, 334, 300, 215),
  (7,  5,  7, 501, 482, 328),
  (8,  3, 17, 171, 148,  92),
  (9,  4,  3, 369, 341, 280),
  (10, 4, 12, 345, 325, 230),
  (11, 5, 10, 473, 437, 381),
  (12, 4,  4, 372, 340, 280),
  (13, 4,  6, 405, 380, 306),
  (14, 3, 16, 160, 140,  88),
  (15, 4,  2, 376, 350, 290),
  (16, 3, 18, 145, 125,  86),
  (17, 4, 14, 317, 287, 258),
  (18, 5,  8, 445, 410, 347)
) as h(hole_number, par, stroke_index, yardage_white, yardage_yellow, yardage_red);

-- Day 2 — Quinta do Lago South
with c as (
  insert into courses (day, name, par_total) values (2, 'Quinta do Lago South', 71)
  returning id
)
insert into holes (course_id, hole_number, par, stroke_index, yardage_white, yardage_yellow, yardage_red)
select id, hole_number, par, stroke_index, yardage_white, yardage_yellow, yardage_red
from c, (values
  (1,  4, 11, 390, 345, 320),
  (2,  5, 15, 500, 470, 415),
  (3,  4,  3, 387, 350, 285),
  (4,  3,  7, 171, 135, 110),
  (5,  5,  1, 505, 480, 435),
  (6,  4, 13, 350, 315, 290),
  (7,  3,  5, 182, 160, 142),
  (8,  4, 17, 385, 350, 320),
  (9,  4,  9, 355, 320, 290),
  (10, 4,  6, 410, 375, 340),
  (11, 3, 14, 190, 160, 112),
  (12, 4, 10, 460, 425, 380),
  (13, 4,  2, 325, 285, 255),
  (14, 4, 16, 383, 350, 300),
  (15, 3,  4, 200, 160, 125),
  (16, 4, 18, 372, 330, 270),
  (17, 5, 12, 510, 490, 465),
  (18, 4,  8, 413, 370, 338)
) as h(hole_number, par, stroke_index, yardage_white, yardage_yellow, yardage_red);

-- Day 3 — Laranjal
with c as (
  insert into courses (day, name, par_total) values (3, 'Laranjal', 72)
  returning id
)
insert into holes (course_id, hole_number, par, stroke_index, yardage_white, yardage_yellow, yardage_red)
select id, hole_number, par, stroke_index, yardage_white, yardage_yellow, yardage_red
from c, (values
  (1,  4,  5, 370, 350, 300),
  (2,  4, 17, 300, 290, 245),
  (3,  3,  9, 184, 158, 130),
  (4,  5,  3, 440, 430, 370),
  (5,  4, 15, 358, 327, 268),
  (6,  5,  7, 500, 478, 428),
  (7,  3,  1, 226, 205, 147),
  (8,  4, 13, 310, 281, 235),
  (9,  5, 11, 425, 405, 351),
  (10, 4,  4, 300, 278, 210),
  (11, 3, 12, 185, 170, 115),
  (12, 4, 16, 375, 345, 305),
  (13, 4,  2, 331, 325, 285),
  (14, 4, 10, 382, 362, 322),
  (15, 3, 18, 174, 163, 108),
  (16, 5,  8, 497, 471, 424),
  (17, 3, 14, 167, 155, 125),
  (18, 5,  6, 537, 492, 440)
) as h(hole_number, par, stroke_index, yardage_white, yardage_yellow, yardage_red);

-- ============================================================================
-- 4. Matches
-- 3 matches per day (round robin between the 3 teams) = 9 matches across the event.
-- Day 1 (Greensomes) and Day 2 (Betterball) are 2-vs-1; Day 3 (Singles) is 1-vs-1-vs-1,
-- so match_players carries the actual player list per match rather than assuming a fixed
-- team-vs-team shape.
-- ============================================================================
create table matches (
  id uuid primary key default gen_random_uuid(),
  day integer not null,
  match_number integer not null,
  format text not null check (format in ('greensomes', 'betterball', 'singles')),
  points_available numeric not null default 2,
  created_at timestamptz default now(),
  unique(day, match_number)
);

create table match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  team_id text references teams(id),
  side text not null,               -- groups players competing together on one score, e.g. 'A' / 'B' / 'C'
  unique(match_id, player_id)
);

-- ============================================================================
-- 5. Scores
-- ============================================================================
create table scores (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  day integer not null,
  hole integer not null check (hole between 1 and 18),
  gross_strokes integer not null check (gross_strokes between 1 and 15),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(player_id, day, hole)
);

-- Betterball only: a side calls a Hammer on a hole for double points if it succeeds
-- (see js/matchLogic.js betterballHammerSuccess for the win condition). A row's presence
-- means the hammer was called that hole; deleting it un-calls it.
create table hammers (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  hole integer not null check (hole between 1 and 18),
  side text not null check (side in ('pair', 'single')),
  created_at timestamptz default now(),
  unique(match_id, hole, side)
);

-- Greensomes only: which pair member's drive was used on a hole (only one per hole —
-- the two radio buttons in the UI are mutually exclusive). Used to show each player's
-- remaining count toward the "at least 6 drives" rule.
create table drives (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  hole integer not null check (hole between 1 and 18),
  player_id uuid references players(id) on delete cascade,
  created_at timestamptz default now(),
  unique(match_id, hole)
);

-- Win predictor history (see js/predictor.js) — one row per team logged after every hole
-- save, so the leaderboard can plot a "worm diagram" of win probability over the event.
-- holes_completed (0-162) is the x-axis: total holes scored across every match so far,
-- used instead of wall-clock time so gaps between play sessions don't flatten the chart.
create table prediction_snapshots (
  id uuid primary key default gen_random_uuid(),
  holes_completed integer not null,
  team_id text references teams(id),
  win_probability numeric not null,
  projected_points numeric not null,
  current_points numeric not null,
  created_at timestamptz default now()
);

-- Hazards (optional — for tracking OOB, water, etc.)
create table hazards (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players(id) on delete cascade,
  day integer not null,
  hole integer not null,
  type text not null,
  created_at timestamptz default now(),
  unique(player_id, day, hole, type)
);

-- ============================================================================
-- 6. Side competitions — Nearest the Pin, Drive the Green, Long Putt, Hammer
-- ============================================================================
create table competition_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  points integer not null,                     -- from Lads 2026.xlsx, Leaderboard tab, Point Allocation row; base/fallback value
  points_day1 integer,                          -- per-day points, editable from the admin page; falls back to `points` if null
  points_day2 integer,
  points_day3 integer,
  applies_day integer,                          -- null = every day (all the original types); a day number restricts the
                                                 -- bonus grid to only offer it that day, e.g. Ballbag is Day 3 (Singles) only
  sort_order integer not null,
  counts_toward_bonus boolean not null default true,  -- Clutch Shot is tracked but scored separately (its own competition)
  is_automated boolean not null default false  -- Net Eagle is derived from scores, not hand-picked in the bonus grid
);

insert into competition_types (name, points, points_day1, points_day2, points_day3, applies_day, sort_order, counts_toward_bonus, is_automated) values
  ('Net Eagle', 2, 2, 2, 2, null, 1, true, true),
  ('Par3 Pin', 2, 2, 2, 2, null, 2, true, false),
  ('Long Putt', 3, 3, 3, 3, null, 3, true, false),
  ('Chip In', 3, 3, 3, 3, null, 4, true, false),
  ('Green Drive', 3, 3, 3, 3, null, 5, true, false),
  ('Clutch', 1, 1, 1, 1, null, 6, false, false),
  ('Ballbag', 3, 3, 3, 3, 3, 7, true, false);

create table competition_results (
  id uuid primary key default gen_random_uuid(),
  day integer not null,
  hole integer,                     -- nullable: some competitions are round-level, not hole-specific
  competition_type_id uuid references competition_types(id),
  winner_id uuid references players(id),
  created_at timestamptz default now(),
  unique(day, hole, competition_type_id)
);

-- ============================================================================
-- 7. App settings (active day, etc.)
-- ============================================================================
create table settings (
  key text primary key,
  value text
);

insert into settings (key, value) values ('active_day', '1');

-- ============================================================================
-- 8. Audit log for admin score corrections
-- ============================================================================
create table corrections (
  id uuid primary key default gen_random_uuid(),
  score_id uuid references scores(id) on delete set null,
  player_id uuid references players(id),
  day integer,
  hole integer,
  old_value integer,
  new_value integer,
  changed_by text,
  changed_at timestamptz default now()
);

-- ============================================================================
-- 9. Expense tracking subpage
-- ============================================================================
create table expenses (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players(id),
  description text not null,
  amount numeric(10, 2) not null,
  currency text not null default 'EUR',
  created_at timestamptz default now()
);

-- ============================================================================
-- 10. Gallery subpage
-- ============================================================================
create table photos (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,       -- path in Supabase Storage
  caption text,
  year integer not null default 2026,  -- which trip this photo is from, for the gallery's year selector
  uploaded_by uuid references players(id),
  day integer,
  hole integer,
  created_at timestamptz default now()
);

-- ============================================================================
-- Row Level Security
-- No login system exists (admin uses a client-side 5-tap unlock, not real auth),
-- so every table is read/write through the public anon key. Policies are still
-- enabled explicitly so access is a deliberate decision per table, not a default.
-- ============================================================================
alter table teams enable row level security;
alter table players enable row level security;
alter table courses enable row level security;
alter table holes enable row level security;
alter table matches enable row level security;
alter table match_players enable row level security;
alter table scores enable row level security;
alter table hammers enable row level security;
alter table drives enable row level security;
alter table prediction_snapshots enable row level security;
alter table hazards enable row level security;
alter table competition_types enable row level security;
alter table competition_results enable row level security;
alter table settings enable row level security;
alter table corrections enable row level security;
alter table expenses enable row level security;
alter table photos enable row level security;

create policy "public read" on teams for select using (true);
create policy "public read" on players for select using (true);
create policy "public read" on courses for select using (true);
create policy "public read" on holes for select using (true);
create policy "public read" on matches for select using (true);
create policy "public read" on match_players for select using (true);
create policy "public read" on scores for select using (true);
create policy "public read" on hammers for select using (true);
create policy "public read" on drives for select using (true);
create policy "public read" on prediction_snapshots for select using (true);
create policy "public read" on hazards for select using (true);
create policy "public read" on competition_types for select using (true);
create policy "public read" on competition_results for select using (true);
create policy "public read" on settings for select using (true);
create policy "public read" on corrections for select using (true);
create policy "public read" on expenses for select using (true);
create policy "public read" on photos for select using (true);

-- Write access for the tables players/scorers write to directly.
create policy "public write" on matches for insert with check (true);
create policy "public write insert" on match_players for insert with check (true);
create policy "public write delete" on match_players for delete using (true);
create policy "public write insert" on scores for insert with check (true);
create policy "public write update" on scores for update using (true);
create policy "public write insert" on hammers for insert with check (true);
create policy "public write delete" on hammers for delete using (true);
create policy "public write insert" on drives for insert with check (true);
create policy "public write update" on drives for update using (true);
create policy "public write delete" on drives for delete using (true);
create policy "public write insert" on prediction_snapshots for insert with check (true);
create policy "public write delete" on prediction_snapshots for delete using (true);
create policy "public write" on hazards for insert with check (true);
create policy "public write insert" on competition_results for insert with check (true);
create policy "public write update" on competition_results for update using (true);
create policy "public write delete" on competition_results for delete using (true);
create policy "public write" on corrections for insert with check (true);
create policy "public write" on expenses for insert with check (true);
create policy "public write" on photos for insert with check (true);

-- Admin page: editing player team/handicaps and per-day bonus points.
create policy "public write update" on players for update using (true);
create policy "public write update" on competition_types for update using (true);

-- ============================================================================
-- Realtime — the leaderboard subscribes to these so it re-sorts live as scores
-- and bonus picks are saved, without needing a manual refresh.
-- ============================================================================
alter publication supabase_realtime add table scores;
alter publication supabase_realtime add table hammers;
alter publication supabase_realtime add table drives;
alter publication supabase_realtime add table prediction_snapshots;
alter publication supabase_realtime add table competition_results;
alter publication supabase_realtime add table match_players;
