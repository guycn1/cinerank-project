import { Router } from 'express';
import { supabase } from '../supabase.js';
import { searchMovies, getMovieDetails, TmdbError } from '../services/tmdb.js';

export const moviesRouter = Router();

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// GET /api/movies — ranking is recalculated on every read, never stored stale
// (SPEC § 2.1).
moviesRouter.get(
  '/',
  wrap(async (_req, res) => {
    const { data, error } = await supabase
      .from('movies')
      .select('*')
      .order('rating', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    res.json({ movies: data });
  })
);

// GET /api/movies/search?q=  — thin proxy to TMDB search (SPEC § 4.5)
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
          error: "Couldn't reach the movie database. Try again in a moment.",
          short: 'TMDB is unreachable',
        });
      }
      throw err;
    }
  })
);

// POST /api/movies  — body: { tmdb_id }. TMDB supplies every stored fact.
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
          error: "Couldn't reach the movie database. Try again in a moment.",
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

// PATCH /api/movies/:id  — body: { rating?, review? }
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
        .json({ error: "Couldn't find that film — it may have been removed. Refresh and try again." });
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

// DELETE /api/movies/:id
moviesRouter.delete(
  '/:id',
  wrap(async (req, res) => {
    const { error } = await supabase.from('movies').delete().eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.status(204).end();
  })
);
