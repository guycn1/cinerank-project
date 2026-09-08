-- Migration 004 — a review cannot exist without a rating.
-- Run once in Supabase SQL editor. Safe to re-run (DROP IF EXISTS first).
-- New schema installs get this from db/schema.sql directly.
--
-- Why: the rating is the required part and the review is the optional one, but
-- only the UI knew that. PATCH /api/movies/:id has always accepted `review`
-- independently of `rating` (and accepts an explicit `rating: null`), so the
-- combination "review, no rating" was writable through the API even though no
-- path in the app can produce it: POST never writes either column, and the rate
-- dialog's Save always sends a number from a range input that cannot be empty.
--
-- Such a row was invisible rather than wrong. renderRanked() branches
-- `if (!isRated) … else if (m.review)`, so an unrated film draws the
-- "Not rated yet" chip and its review is never displayed at all — the text sits
-- in the table and no screen ever shows it (backlog #15).
--
-- Two ways to fix that: teach the renderer to display the state, or stop the
-- state existing. This is the second. It is enforced HERE and not in the route
-- because the rule is about the RESULTING ROW, not about the patch: PATCHing
-- only a review is perfectly valid when the film is already rated, and the
-- route would have to re-read the row to find that out. Postgres already knows
-- it. See D-041.
--
-- Verified empty before adding: `select … where review is not null and rating
-- is null` returned no rows, so no existing data is invalidated by this.
--
-- Note this is one-directional, deliberately. A rating with no review stays
-- perfectly valid — that is the common case, and backlog #20 is about labelling
-- it in the UI, not forbidding it.
alter table movies
  drop constraint if exists review_requires_rating;
alter table movies
  add constraint review_requires_rating
  check (review is null or rating is not null);
