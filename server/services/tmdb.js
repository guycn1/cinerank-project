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
  return {
    tmdb_id: raw.id,
    title: raw.title,
    year: raw.release_date ? Number(raw.release_date.slice(0, 4)) : null,
    description: raw.overview || null,
    poster_url: toPosterUrl(raw.poster_path),
    tmdb_rating: typeof raw.vote_average === 'number' ? Number(raw.vote_average.toFixed(1)) : null,
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
 * Returns a real, TMDB-verified movie object, or null if no confident match.
 * The AI only picked the string; TMDB supplies every fact shown to the user.
 */
export async function verifyTitle(title) {
  const data = await tmdbGet('/search/movie', { query: title, include_adult: 'false' });
  const results = data.results || [];
  if (results.length === 0) return null;

  const wanted = title.trim().toLowerCase();
  const exact = results.find((r) => r.title.trim().toLowerCase() === wanted);
  return shapeMovie(exact || results[0]);
}
