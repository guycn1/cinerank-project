import { config } from '../config.js';

// All TMDB HTTP calls live here — never inline fetch() in a route handler
// (CLAUDE.md § Coding Conventions). This module is the trusted source of movie
// facts: posters, years, overviews. The AI never supplies those.

const { apiKey, base, imageBase } = config.tmdb;

class TmdbError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TmdbError';
  }
}
export { TmdbError };

async function tmdbGet(path, params = {}) {
  const url = new URL(base + path);
  url.searchParams.set('api_key', apiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch (err) {
    throw new TmdbError(`TMDB unreachable (${err.name})`);
  }
  if (!res.ok) throw new TmdbError(`TMDB responded ${res.status}`);
  return res.json();
}

function toPosterUrl(posterPath) {
  return posterPath ? imageBase + posterPath : null;
}

function shapeMovie(raw) {
  // TMDB reports `vote_average: 0` for a title NOBODY HAS VOTED ON. That is the
  // absence of a rating, not a rating of zero: its user vote scale starts at
  // 0.5, so an average of exactly 0 cannot be a real score. Passing it straight
  // through stored a 0, and the ranked card then read "TMDB 0.0" — worst film
  // imaginable — for an obscure title with no votes at all.
  // `vote_count` is the direct signal and is used whenever TMDB sends it. The
  // `avg > 0` test is the fallback, so a payload that happens to omit
  // vote_count can never null out a rating that is genuinely there.
  const avg = raw.vote_average;
  const hasRating =
    typeof avg === 'number' && avg > 0 && (raw.vote_count == null || raw.vote_count > 0);
  return {
    tmdb_id: raw.id,
    title: raw.title,
    year: raw.release_date ? Number(raw.release_date.slice(0, 4)) : null,
    description: raw.overview || null,
    poster_url: toPosterUrl(raw.poster_path),
    tmdb_rating: hasRating ? Number(avg.toFixed(1)) : null,
  };
}

/** Live search by title (SPEC § 2.1). Returns lightweight results for the picker. */
export async function searchMovies(query) {
  const data = await tmdbGet('/search/movie', { query, include_adult: 'false' });
  return (data.results || []).slice(0, 12).map(shapeMovie);
}

/** Full details for one movie, used when the user picks a search result. */
export async function getMovieDetails(tmdbId) {
  const raw = await tmdbGet(`/movie/${tmdbId}`);
  return shapeMovie(raw);
}

/**
 * Cross-check an AI-suggested title against TMDB (SPEC § 2.2 step 4).
 * Returns a real TMDB movie, or null when TMDB has never heard of the title.
 * The AI only picked the string; TMDB supplies every fact shown to the user.
 *
 * THIS IS A REAL-FILM CHECK, NOT A SAME-FILM CHECK, and the difference is
 * deliberate (D-054). A title TMDB returns nothing for is dropped; anything else
 * resolves to TMDB's own top result, which is occasionally a DIFFERENT film from
 * the one the model named, shown with the model's reason still attached.
 * This comment used to promise "or null if no confident match". That was never
 * true -- there is no confidence test here, and there was none when that line
 * was written.
 *
 * Tightening it was measured against live TMDB (30 probe titles) and rejected.
 * TMDB search is close to TOKEN matching rather than fuzzy, so invented titles
 * mostly return zero results and are already dropped, while the fallback earns
 * its keep rescuing real films the model named imprecisely ("Shawshank
 * Redemption", "Spider-Man: Into the Spiderverse"). And the commonest
 * hallucination shape is immune to any matching rule anyway: an invented-sounding
 * title like "The Silent Echo" turns out to be a real obscure film and
 * EXACT-matches. Read D-054 before changing this; the numbers are in it.
 */
export async function verifyTitle(title) {
  const data = await tmdbGet('/search/movie', { query: title, include_adult: 'false' });
  const results = data.results || [];
  if (results.length === 0) return null;

  const wanted = title.trim().toLowerCase();
  const exact = results.find((r) => r.title.trim().toLowerCase() === wanted);
  // Prefer a title-for-title match, else TMDB's top hit. The fallback is a
  // documented trade (D-054), not an oversight -- see the note above.
  return shapeMovie(exact || results[0]);
}
