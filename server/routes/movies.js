/**
 * The movie CRUD routes, mounted at /api/movies: the ranked list, a TMDB search
 * proxy, add, rate/review, and remove.
 *
 * @module server/routes/movies
 */
import { Router } from 'express';
import { supabase } from '../supabase.js';
import { searchMovies, getMovieDetails, TmdbError } from '../services/tmdb.js';

/**
 * One row of the movies table, as every route here returns it.
 *
 * @typedef {object} MovieRow
 * @property {string} id  A uuid.
 * @property {number} tmdb_id  Unique, so a film can be in the list once.
 * @property {string} title
 * @property {number | null} year
 * @property {string | null} description  TMDB's overview.
 * @property {string | null} poster_url
 * @property {number | null} rating  0–10 to one decimal; null until rated.
 * @property {number | null} tmdb_rating  TMDB's score when the film was added (D-036).
 * @property {string | null} review  Only ever present on a rated film (D-041).
 * @property {string} created_at  ISO timestamp.
 */

/** The router server/index.js mounts at /api/movies. */
export const moviesRouter = Router();

/**
 * Let an async handler fail properly under Express 4, which does not await a
 * handler: a rejected promise is passed to `next()`, so it reaches the central
 * error handler in server/index.js.
 *
 * @param {import('express').RequestHandler} fn  An async route handler.
 * @returns {import('express').RequestHandler}
 */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * GET /api/movies — ranking is recalculated on every read, never stored stale
 * (SPEC § 2.1).
 *
 * Responds 200 with `{ movies: MovieRow[] }`: every film, rating descending
 * with the unrated ones last, ties oldest-first. A database error reaches the
 * central handler as a 500.
 */
moviesRouter.get(
  '/',
  wrap(async (_req, res) => {
    const { data, error } = await supabase
      .from('movies')
      .select('*')
      .order('rating', { ascending: false, nullsFirst: false })
      // ASCENDING, so films the user scored identically read oldest-first — and
      // so do the unrated ones, which are all tied with each other by
      // definition. It was descending, which put a newly added film ABOVE
      // everything it tied with: add two films and the second one jumped over
      // the first, and rate two films 4.0 and the second sat above the first.
      // Adding to a list should append to it. The tie-break carries no meaning
      // either way — D-038 is the whole point, and a tie shows one shared rank
      // number and a "tied" caption precisely because the order within it is
      // arbitrary — but ascending is the arbitrary order that does not surprise.
      // (User-raised, 2026-09-09.)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    res.json({ movies: data });
  })
);

/**
 * GET /api/movies/search?q=  — thin proxy to TMDB search (SPEC § 4.5)
 *
 * Responds 200 with `{ results }`, up to 12 TMDB matches in the shape
 * searchMovies() returns (empty when nothing matches); 400 when `q` is missing
 * or blank; 502 with `{ error, short }` when TMDB is unreachable.
 */
moviesRouter.get(
  '/search',
  wrap(async (req, res) => {
    const q = (req.query.q || '').toString().trim();
    if (!q) return res.status(400).json({ error: 'Missing search query' });
    try {
      res.json({ results: await searchMovies(q) });
    } catch (err) {
      if (err instanceof TmdbError) {
        // `short` is ADDITIVE: the `error` text is untouched, so every existing
        // consumer behaves exactly as it did. It exists for the client's
        // failureText(), which puts a context in front of the cause and cannot
        // use the full sentence without doubling — 'Couldn’t add “Dune” —
        // Couldn’t reach the movie database. Try again in a moment.' (D-042).
        return res.status(502).json({
          error: "Couldn’t reach the movie database. Try again in a moment.",
          short: 'TMDB is unreachable',
        });
      }
      throw err;
    }
  })
);

/**
 * POST /api/movies  — body: { tmdb_id }. TMDB supplies every stored fact.
 *
 * Responds 201 with `{ movie: MovieRow }`, unrated; 400 when `tmdb_id` is not
 * an integer; 409 when the film is already in the list; 502 with
 * `{ error, short }` when TMDB is unreachable.
 */
moviesRouter.post(
  '/',
  wrap(async (req, res) => {
    const tmdbId = Number(req.body?.tmdb_id);
    if (!Number.isInteger(tmdbId)) {
      return res.status(400).json({ error: 'tmdb_id (integer) is required' });
    }

    let details;
    try {
      details = await getMovieDetails(tmdbId);
    } catch (err) {
      if (err instanceof TmdbError) {
        // `short` is ADDITIVE: the `error` text is untouched, so every existing
        // consumer behaves exactly as it did. It exists for the client's
        // failureText(), which puts a context in front of the cause and cannot
        // use the full sentence without doubling — 'Couldn’t add “Dune” —
        // Couldn’t reach the movie database. Try again in a moment.' (D-042).
        return res.status(502).json({
          error: "Couldn’t reach the movie database. Try again in a moment.",
          short: 'TMDB is unreachable',
        });
      }
      throw err;
    }

    const { data, error } = await supabase
      .from('movies')
      .insert({
        tmdb_id: details.tmdb_id,
        title: details.title,
        year: details.year,
        description: details.description,
        poster_url: details.poster_url,
        // shapeMovie() has always returned this and the search rows have always
        // shown it; until migration 002 there was no column to put it in, so it
        // was fetched, displayed once and discarded (backlog #11). Stored at ADD
        // time and never refreshed: it is the score the film had when it entered
        // the list, which is what makes it a fair thing to compare a rating
        // against. Null for a title TMDB has no votes for.
        tmdb_rating: details.tmdb_rating,
      })
      .select()
      .single();

    if (error) {
      // Postgres unique_violation → the clean duplicate answer for § 3.4
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Already in your list' });
      }
      throw new Error(error.message);
    }
    res.status(201).json({ movie: data });
  })
);

/**
 * PATCH /api/movies/:id  — body: { rating?, review? }
 *
 * `rating` is rounded to one decimal, and `null` clears it; an empty string is
 * treated as absent. `review` is cut to 2,000 characters, and an empty one is
 * stored as null.
 *
 * Responds 200 with `{ movie: MovieRow }`; 400 for a rating outside 0–10, a
 * body with neither field, or a review on an unrated film; 404 when the row no
 * longer exists.
 */
moviesRouter.patch(
  '/:id',
  wrap(async (req, res) => {
    const patch = {};
    if (req.body?.rating !== undefined && req.body.rating !== null && req.body.rating !== '') {
      const rating = Number(req.body.rating);
      if (Number.isNaN(rating) || rating < 0 || rating > 10) {
        // Phrased as a sentence because it is DISPLAYED: the rate dialog renders
        // it inline above its buttons (D-032). The three validation messages in
        // this file that the UI guards against ever sending — missing query,
        // missing tmdb_id, empty patch — stay terse and developer-facing, since
        // only a direct API call can reach them.
        return res.status(400).json({ error: 'Your rating must be between 0 and 10.' });
      }
      patch.rating = Math.round(rating * 10) / 10;
    } else if (req.body?.rating === null) {
      patch.rating = null;
    }
    if (req.body?.review !== undefined) {
      patch.review = (req.body.review || '').toString().slice(0, 2000) || null;
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const { data, error } = await supabase
      .from('movies')
      .update(patch)
      .eq('id', req.params.id)
      .select()
      .single();
    // `.single()` does not mean "one row or nothing" — it asserts that exactly
    // one row comes back, and PostgREST reports a broken assertion as an ERROR
    // (PGRST116, "zero or multiple rows returned"), not as an empty result. So
    // this has to be checked BEFORE the generic throw below: otherwise a film
    // deleted in another tab fell through to the central handler and surfaced
    // as the central error handler's generic 500 — blaming the server for the
    // client asking about something that is simply gone, and giving the user a
    // message that no amount of retrying could clear.
    // The `!data` half is belt-and-braces for a client that returns an empty
    // result instead; both mean the same thing to the caller.
    if (error?.code === 'PGRST116' || (!error && !data)) {
      return res
        .status(404)
        .json({ error: "Couldn’t find that film — it may have been removed. Refresh and try again." });
    }
    // Postgres check_violation. The `review_requires_rating` constraint added in
    // migration 004 forbids a review on an unrated film (D-041), and without
    // this it would reach the central handler as a generic 500 — blaming the
    // server for a request that is simply invalid, which is the same fault the
    // "on our side" wording pass existed to fix. Matched on the constraint NAME,
    // not on 23514 alone: the table carries two range constraints as well, and
    // this message must not be put in front of a violation of either.
    if (error?.code === '23514' && error.message?.includes('review_requires_rating')) {
      return res.status(400).json({ error: 'A review needs a rating — rate the film first.' });
    }
    if (error) throw new Error(error.message);
    res.json({ movie: data });
  })
);

/**
 * DELETE /api/movies/:id
 *
 * Responds 204 with no body. The rating and review go with the row, and there
 * is no undo.
 */
moviesRouter.delete(
  '/:id',
  wrap(async (req, res) => {
    const { error } = await supabase.from('movies').delete().eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.status(204).end();
  })
);
