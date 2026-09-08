-- Migration 003 — a stored tmdb_rating of 0 means "no votes", so store NULL.
-- Run once in Supabase SQL editor. Safe to re-run (idempotent: after the first
-- run there are no zeros left to update).
--
-- Why: TMDB reports `vote_average: 0` for a title nobody has voted on. That is
-- the ABSENCE of a rating, not a rating of zero — TMDB's user vote scale starts
-- at 0.5, so an average of exactly 0 cannot be a real score. shapeMovie() passed
-- it straight through, so migration 002's new column (and the backfill script)
-- recorded 0 for such titles, and the ranked card rendered "TMDB 0.0" — which
-- reads as the worst film imaginable rather than "unrated".
--
-- shapeMovie() now maps that case to null at the source, so no NEW row can get a
-- zero. This fixes the rows already written.
--
-- Non-destructive: it replaces a value that was never meaningful with the null
-- that should have been there, and the real value is re-derivable at any time
-- with `npm run backfill-tmdb-rating`. No row is deleted and no other column is
-- touched.
update movies
   set tmdb_rating = null
 where tmdb_rating = 0;
