-- Migration 002 — store TMDB's own rating alongside the user's.
-- Run once in Supabase SQL editor. Safe to re-run (IF NOT EXISTS / DROP IF EXISTS).
-- New schema installs get this from db/schema.sql directly.
--
-- Why: shapeMovie() in server/services/tmdb.js has always returned tmdb_rating,
-- and the search results have always displayed it ("2023 · TMDB 7.2"), but the
-- POST /api/movies insert dropped it on the floor because no column existed.
-- The number was fetched, shown once, and then thrown away the moment the film
-- was added. This is the column it should have been landing in, so the ranked
-- list can show "your 8.5 vs TMDB 7.2".
--
-- Nullable, and deliberately so: rows added before this migration have no value
-- and must stay valid. TMDB itself also returns 0/absent for obscure titles that
-- nobody has voted on, which shapeMovie() already maps to null.
alter table movies
  add column if not exists tmdb_rating numeric(3,1);

-- Mirrors the existing rating_range constraint on the user's own rating, so the
-- two columns cannot disagree about what a valid score is. Dropped first so the
-- whole file stays re-runnable (ADD CONSTRAINT has no IF NOT EXISTS).
alter table movies
  drop constraint if exists tmdb_rating_range;
alter table movies
  add constraint tmdb_rating_range
  check (tmdb_rating is null or (tmdb_rating >= 0 and tmdb_rating <= 10));

-- Existing rows keep NULL until backfilled. `npm run backfill-tmdb-rating`
-- fills them from TMDB; it only ever writes this one new column, only where it
-- is still NULL, and never deletes anything.
