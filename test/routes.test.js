import { test, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { startApp, makeFakeSupabase, stubFetch, MATRIX_TMDB } from './helpers.js';

// Route-level tests. The Supabase client is swapped for an in-memory fake so
// nothing here touches the live database (CLAUDE.md § Working agreements).
// TMDB / OpenRouter are stubbed per-test via globalThis.fetch.
const db = { results: {} };
mock.module('../server/supabase.js', {
  namedExports: { supabase: makeFakeSupabase(db) },
});

const { app } = await import('../server/index.js');

let client;
before(async () => {
  client = await startApp(app);
});
after(() => client.close());
beforeEach(() => {
  db.results = {};
  db.calls = [];
});

/* ---------- input validation (returns before any I/O) ------------------- */

test('GET /api/health → 200 ok', async () => {
  const res = await client.get('/api/health');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'ok');
});

test('GET /api/config → 200 with the threshold values', async () => {
  const res = await client.get('/api/config');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(typeof body.minRatedForRecommendations, 'number');
  assert.equal(typeof body.minRatedForVerdict, 'number');
  assert.equal(typeof body.topN, 'number');
});

test('GET /api/movies/search with no query → 400', async () => {
  const res = await client.get('/api/movies/search');
  assert.equal(res.status, 400);
});

test('POST /api/movies with no tmdb_id → 400', async () => {
  const res = await client.post('/api/movies', {});
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /tmdb_id/);
});

test('POST /api/movies with a non-integer tmdb_id → 400', async () => {
  const res = await client.post('/api/movies', { tmdb_id: 'not-a-number' });
  assert.equal(res.status, 400);
});

test('PATCH /api/movies/:id with rating out of range → 400', async () => {
  const res = await client.patch('/api/movies/some-id', { rating: 42 });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /between 0 and 10/);
});

test('PATCH /api/movies/:id with a non-numeric rating → 400', async () => {
  const res = await client.patch('/api/movies/some-id', { rating: 'nope' });
  assert.equal(res.status, 400);
});

test('PATCH /api/movies/:id with an empty body → 400 (nothing to update)', async () => {
  const res = await client.patch('/api/movies/some-id', {});
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /Nothing to update/);
});

test('unknown route → 404', async () => {
  const res = await client.get('/api/nope');
  assert.equal(res.status, 404);
});

/* ---------- duplicate handling + happy add ----------------------------- */

test('POST /api/movies for a movie already in the list → 409', async () => {
  const restore = stubFetch({ 'themoviedb.org': MATRIX_TMDB });
  db.results['movies:insert'] = { data: null, error: { code: '23505', message: 'duplicate key' } };
  try {
    const res = await client.post('/api/movies', { tmdb_id: 603 });
    assert.equal(res.status, 409);
    assert.match((await res.json()).error, /Already in your list/);
  } finally {
    restore();
  }
});

test('POST /api/movies happy path → 201 with the saved movie', async () => {
  const restore = stubFetch({ 'themoviedb.org': MATRIX_TMDB });
  db.results['movies:insert'] = {
    data: { id: 'uuid-1', tmdb_id: 603, title: 'The Matrix', year: 1999 },
    error: null,
  };
  try {
    const res = await client.post('/api/movies', { tmdb_id: 603 });
    assert.equal(res.status, 201);
    assert.equal((await res.json()).movie.title, 'The Matrix');
  } finally {
    restore();
  }
});

/* ---------- resilience: TMDB unreachable ------------------------------- */

test('GET /api/movies/search when TMDB is unreachable → 502, calm message', async () => {
  const restore = stubFetch({ 'themoviedb.org': 'throw' });
  try {
    const res = await client.get('/api/movies/search?q=matrix');
    assert.equal(res.status, 502);
    assert.match((await res.json()).error, /movie database/i);
  } finally {
    restore();
  }
});

test('POST /api/movies when TMDB is unreachable → 502 (no DB write)', async () => {
  const restore = stubFetch({ 'themoviedb.org': 'throw' });
  try {
    const res = await client.post('/api/movies', { tmdb_id: 603 });
    assert.equal(res.status, 502);
    assert.equal(db.calls.filter((c) => c.op === 'insert').length, 0);
  } finally {
    restore();
  }
});

/* ---------- not-enough-data guards (pre-AI, so NOT logged) ------------- */

test('POST /api/recommendations below the rated-movie threshold → 422, nothing logged', async () => {
  db.results['movies:select'] = { data: [{ id: '1', tmdb_id: 1, title: 'A', rating: 9 }], error: null };
  const res = await client.post('/api/recommendations');
  assert.equal(res.status, 422);
  assert.match((await res.json()).error, /at least 3/);
  assert.equal(db.calls.filter((c) => c.table === 'recommendation_logs').length, 0);
});

test('POST /api/taste-verdict below the rated-movie threshold → 422', async () => {
  db.results['movies:select'] = { data: [{ id: '1', title: 'A', rating: 9 }], error: null };
  const res = await client.post('/api/taste-verdict');
  assert.equal(res.status, 422);
  assert.match((await res.json()).error, /at least 2/);
});

/* ---------- resilience: OpenRouter unreachable IS logged -------------- */

test('POST /api/recommendations when OpenRouter is unreachable → 422 AND a failed row is logged', async () => {
  db.results['movies:select'] = {
    data: [
      { id: '1', tmdb_id: 1, title: 'Whiplash', year: 2014, rating: 10, review: 'relentless' },
      { id: '2', tmdb_id: 2, title: 'Dune', year: 2021, rating: 9, review: '' },
      { id: '3', tmdb_id: 3, title: 'Arrival', year: 2016, rating: 9, review: '' },
      { id: '4', tmdb_id: 4, title: 'Sicario', year: 2015, rating: 8, review: '' },
    ],
    error: null,
  };
  db.results['recommendation_logs:insert'] = { data: null, error: null };
  const restore = stubFetch({ 'openrouter.ai': 'throw' });
  try {
    const res = await client.post('/api/recommendations');
    assert.equal(res.status, 422);
    assert.match((await res.json()).error, /Couldn't generate recommendations/);
    const logged = db.calls.find((c) => c.table === 'recommendation_logs' && c.op === 'insert');
    assert.ok(logged, 'a recommendation_logs row should be written even on failure');
    assert.equal(logged.payload.status, 'failed');
  } finally {
    restore();
  }
});
