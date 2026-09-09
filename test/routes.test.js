import { test, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { startApp, makeFakeSupabase, stubFetch, MATRIX_TMDB, UNVOTED_TMDB } from './helpers.js';

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

// Regression guard. `.single()` reports "no such row" as PGRST116 rather than as
// an empty result, so this used to fall through to the central error handler and
// come back as the central error handler's generic 500 — which is both the wrong
// status and a message the user could never clear by retrying. Reachable for real:
// delete a film in one tab, save it from another.
test('PATCH /api/movies/:id for a row that no longer exists → 404, not 500', async () => {
  db.results['movies:update'] = {
    data: null,
    error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
  };
  try {
    const res = await client.patch('/api/movies/00000000-0000-0000-0000-000000000000', { rating: 5 });
    assert.equal(res.status, 404);
    assert.match((await res.json()).error, /may have been removed/);
  } finally {
    delete db.results['movies:update'];
  }
});

// Regression guard for migration 004's `review_requires_rating` constraint
// (backlog #15, D-041). Postgres enforces the rule itself; what this asserts is
// the ROUTE's half of it — a check_violation must surface as a 400 with a
// message that says what to do, not as the central handler's generic 500, which
// would blame the server for a request that is simply invalid. Unreachable from
// the UI (the rate dialog always sends a rating from a range input), but a
// direct API caller can do it — and the demo seed helper will be one.
test('PATCH /api/movies/:id writing a review onto an unrated film → 400, not 500', async () => {
  db.results['movies:update'] = {
    data: null,
    error: {
      code: '23514',
      message: 'new row for relation "movies" violates check constraint "review_requires_rating"',
    },
  };
  try {
    const res = await client.patch('/api/movies/00000000-0000-0000-0000-000000000000', {
      review: 'Written without ever rating it.',
    });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /needs a rating/);
  } finally {
    delete db.results['movies:update'];
  }
});

// The handler matches the constraint NAME, not the bare 23514 code, because the
// movies table carries two range constraints as well. This is that guard: a
// violation of one of those must not be dressed up as the review rule.
test('PATCH /api/movies/:id — an unrelated check violation is not reported as the review rule', async () => {
  db.results['movies:update'] = {
    data: null,
    error: {
      code: '23514',
      message: 'new row for relation "movies" violates check constraint "tmdb_rating_range"',
    },
  };
  try {
    const res = await client.patch('/api/movies/some-id', { rating: 5 });
    assert.equal(res.status, 500);
    assert.doesNotMatch((await res.json()).error, /needs a rating/);
  } finally {
    delete db.results['movies:update'];
  }
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

// Regression guard for backlog #11. shapeMovie() has always returned
// tmdb_rating and the search rows have always shown it, but the insert dropped
// it because no column existed — so the number was fetched, displayed once and
// thrown away. Migration 002 added the column; this asserts the value actually
// reaches the insert payload, which is the half a schema change cannot enforce
// on its own. MATRIX_TMDB carries vote_average: 8.2.
test('POST /api/movies stores TMDB own rating in the insert payload', async () => {
  const restore = stubFetch({ 'themoviedb.org': MATRIX_TMDB });
  db.results['movies:insert'] = {
    data: { id: 'uuid-1', tmdb_id: 603, title: 'The Matrix', tmdb_rating: 8.2 },
    error: null,
  };
  try {
    await client.post('/api/movies', { tmdb_id: 603 });
    const inserts = db.calls.filter((c) => c.table === 'movies' && c.op === 'insert');
    assert.ok(inserts.length, 'expected an insert on movies');
    assert.equal(inserts.at(-1).payload.tmdb_rating, 8.2);
  } finally {
    restore();
  }
});

// TMDB reports vote_average: 0 for a title nobody has voted on — an ABSENCE,
// not a score of zero (its vote scale starts at 0.5). Storing the 0 made the
// ranked card read "TMDB 0.0", i.e. worst film imaginable, while the search row
// hid it because it used truthiness. Both surfaces now say "no rating" for the
// same reason, because shapeMovie() nulls it at the source.
test('POST /api/movies stores null, not 0, for a title with no TMDB votes', async () => {
  const restore = stubFetch({ 'themoviedb.org': UNVOTED_TMDB });
  db.results['movies:insert'] = { data: { id: 'uuid-2', tmdb_id: 999999 }, error: null };
  try {
    await client.post('/api/movies', { tmdb_id: 999999 });
    const inserts = db.calls.filter((c) => c.table === 'movies' && c.op === 'insert');
    assert.equal(inserts.at(-1).payload.tmdb_rating, null);
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

// Guards the server half of #16(c) (D-042). The TMDB 502 carries a `short`
// companion to `error` so the client can put a context in front of the cause
// without doubling ('Couldn’t add “Dune” — Couldn’t reach the movie database.
// Try again in a moment.'). Both halves are asserted deliberately: `error` must
// be UNCHANGED, since every other consumer still reads it and the whole point of
// adding a field rather than editing one was that nothing existing moves.
test('the TMDB 502 carries a short form alongside its unchanged error text', async () => {
  const restore = stubFetch({ 'themoviedb.org': 'throw' });
  try {
    const body = await (await client.post('/api/movies', { tmdb_id: 603 })).json();
    assert.match(body.error, /movie database/i);
    assert.equal(body.short, 'TMDB is unreachable');
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
    const body = await res.json();
    assert.match(body.error, /Couldn’t generate recommendations/);
    // R8: the technical cause must not reach the user. It used to be appended
    // straight onto the message, so an outage read "Couldn’t generate
    // recommendations: OpenRouter unreachable (TimeoutError)" — our vendor's name
    // and a JS error class, to someone who wanted a film suggestion.
    assert.doesNotMatch(body.error, /OpenRouter|TimeoutError|fetch/i);
    // R9: an AI call was made and its row committed, so the UI may point at the
    // AI call log for this one.
    assert.equal(body.logged, true);
    const logged = db.calls.find((c) => c.table === 'recommendation_logs' && c.op === 'insert');
    assert.ok(logged, 'a recommendation_logs row should be written even on failure');
    assert.equal(logged.payload.status, 'failed');
    // ...and the cause is still recorded in full, where it belongs.
    assert.match(logged.payload.error_text, /OpenRouter/);
  } finally {
    restore();
  }
});

/* ---------- the SUCCESS path: which picks survive verification -------- */

// Until now the only recommendation tests were the two failure paths (the
// below-threshold 422 and the OpenRouter-down 422), so every rule that decides
// what a user actually SEES was unproven (backlog R19). There are three, and one
// run exercises all of them: a pick TMDB cannot confirm is dropped, a pick the
// user already owns is dropped, and two picks that resolve to the SAME film
// collapse to one.
//
// The stub answers each TMDB lookup by its `query=` fragment, so the four picks
// are deliberately titles whose first query word is distinct — `url.includes()`
// would otherwise let one fragment match another film's URL.
const RECS_LIBRARY = {
  data: [
    { id: '1', tmdb_id: 1, title: 'Whiplash', year: 2014, rating: 10, review: 'relentless' },
    { id: '2', tmdb_id: 2, title: 'Dune', year: 2021, rating: 9, review: '' },
    { id: '3', tmdb_id: 3, title: 'Arrival', year: 2016, rating: 9, review: '' },
    { id: '4', tmdb_id: 4, title: 'Sicario', year: 2015, rating: 8, review: '' },
  ],
  error: null,
};

const HEAT_TMDB = {
  id: 949,
  title: 'Heat',
  release_date: '1995-12-15',
  overview: 'A crew of professional robbers and the detective hunting them.',
  poster_path: '/heat.jpg',
  vote_average: 8.3,
  vote_count: 7000,
};

// The model names four films; exactly one should reach the user.
const FOUR_PICKS = JSON.stringify([
  { title: 'Heat', reason: 'You rated Sicario highly, so its patient dread will land.' },
  { title: 'Whiplash', reason: 'Already yours — must be dropped as owned.' },
  { title: 'Zzyzx Road', reason: 'TMDB knows nothing about this one.' },
  { title: 'Collateral', reason: 'Resolves to the same film as Heat.' },
]);

function openRouterReply(content) {
  return {
    choices: [{ message: { content } }],
    usage: { total_tokens: 900, prompt_tokens: 700, completion_tokens: 200, cost: 0.0012 },
    model: 'anthropic/claude-haiku-4.5',
  };
}

function stubRecsRun() {
  return stubFetch({
    'openrouter.ai': openRouterReply(FOUR_PICKS),
    // Fragment order is not load-bearing here (no `query=` value is a prefix of
    // another), but each is pinned to `query=` so a fragment cannot match some
    // other film's URL.
    'query=Heat': { results: [HEAT_TMDB] },
    'query=Whiplash': { results: [{ ...MATRIX_TMDB, id: 1, title: 'Whiplash' }] },
    'query=Zzyzx': { results: [] }, // TMDB has never heard of it
    'query=Collateral': { results: [HEAT_TMDB] }, // same tmdb_id as the Heat pick
  });
}

test('POST /api/recommendations drops unverifiable, already-owned and duplicate picks', async () => {
  db.results['movies:select'] = RECS_LIBRARY;
  db.results['recommendation_logs:insert'] = { data: null, error: null };
  const restore = stubRecsRun();
  try {
    const res = await client.post('/api/recommendations');
    assert.equal(res.status, 200);
    const { suggestions } = await res.json();

    assert.deepEqual(
      suggestions.map((s) => s.title),
      ['Heat'],
      'only the verified, unowned, non-duplicate pick should survive'
    );
    // Every fact on the card comes from TMDB, never from the model (SPEC § 2.2).
    // The model supplied only the title string and the reason.
    assert.equal(suggestions[0].tmdb_id, 949);
    assert.equal(suggestions[0].year, 1995);
    assert.match(suggestions[0].reason, /Sicario/);
  } finally {
    restore();
  }
});

test('POST /api/recommendations logs a success row holding exactly the shown titles', async () => {
  db.results['movies:select'] = RECS_LIBRARY;
  db.results['recommendation_logs:insert'] = { data: null, error: null };
  const restore = stubRecsRun();
  try {
    await client.post('/api/recommendations');
    const logged = db.calls.find((c) => c.table === 'recommendation_logs' && c.op === 'insert');
    assert.ok(logged, 'a successful run must be logged too, not only a failure');
    assert.equal(logged.payload.status, 'success');
    assert.equal(logged.payload.error_text, null);
    // The audit row records what the user was SHOWN, not what the model said —
    // the three dropped titles must not appear here.
    assert.deepEqual(logged.payload.suggested_titles, ['Heat']);
    // Cost logging is a hard requirement (CLAUDE.md § Coding Conventions), and
    // OpenRouter's own usage.cost is preferred over the estimate table.
    assert.equal(logged.payload.estimated_cost_usd, 0.0012);
    assert.equal(logged.payload.tokens_used, 900);
    assert.equal(logged.payload.prompt_version, 'recommend_v3');
  } finally {
    restore();
  }
});

// R2: the owned-titles filter used to be built from the SAME query that feeds
// the taste profile, and that query is filtered to rated films — so a film the
// user had added but not yet rated was invisible to it and could be recommended
// straight back at them. The card would even have been right that it was "not
// yet rated"; the Add button under it would have 409'd.
test('POST /api/recommendations never suggests a film already in the list but UNRATED', async () => {
  db.results['movies:select'] = {
    data: [
      { id: '1', tmdb_id: 1, title: 'Whiplash', year: 2014, rating: 10, review: 'relentless' },
      { id: '2', tmdb_id: 2, title: 'Dune', year: 2021, rating: 9, review: '' },
      { id: '3', tmdb_id: 3, title: 'Arrival', year: 2016, rating: 9, review: '' },
      // Added, never rated. Absent from the taste profile by design — and it must
      // still be absent from the suggestions.
      { id: '5', tmdb_id: 5, title: 'Tenet', year: 2020, rating: null, review: null },
    ],
    error: null,
  };
  db.results['recommendation_logs:insert'] = { data: null, error: null };
  const restore = stubFetch({
    'openrouter.ai': openRouterReply(
      JSON.stringify([
        { title: 'Heat', reason: 'You rated Arrival highly, so its patient dread will land.' },
        { title: 'Tenet', reason: 'Already yours, just unrated — must still be dropped.' },
      ])
    ),
    'query=Heat': { results: [HEAT_TMDB] },
    'query=Tenet': {
      results: [{ ...HEAT_TMDB, id: 5, title: 'Tenet', release_date: '2020-08-26' }],
    },
  });
  try {
    const res = await client.post('/api/recommendations');
    assert.equal(res.status, 200);
    const { suggestions } = await res.json();
    assert.deepEqual(
      suggestions.map((s) => s.title),
      ['Heat'],
      'an unrated film already in the list must not be recommended back'
    );
  } finally {
    restore();
  }
});

// R9's other half. Not every failure has something to read: this one dies on the
// library read, before any AI call, so no recommendation_logs row exists. The
// response must therefore NOT carry `logged`, or the UI would send the user to
// an empty log. The below-threshold test above covers the third no-row case.
test('POST /api/recommendations failing BEFORE the AI call offers no log link', async () => {
  db.results['movies:select'] = { data: null, error: { message: 'connection refused' } };
  const res = await client.post('/api/recommendations');
  assert.equal(res.status, 422);
  const body = await res.json();
  assert.equal(body.logged, undefined, 'nothing was logged, so nothing to point at');
  assert.doesNotMatch(body.error, /connection refused|DB read/i);
  assert.equal(db.calls.filter((c) => c.table === 'recommendation_logs').length, 0);
});

// The one cause that IS the user's answer survives verbatim — flagged
// `userFacing` at the throw site, not pattern-matched in the route.
test('POST /api/recommendations below the threshold keeps its specific message', async () => {
  db.results['movies:select'] = { data: [{ id: '1', tmdb_id: 1, title: 'A', rating: 9 }], error: null };
  const res = await client.post('/api/recommendations');
  const body = await res.json();
  assert.match(body.error, /Need at least 3 rated movies/);
  assert.equal(body.logged, undefined);
});

/* ---------- WHY a run came back empty ---------------------------------- */

// The UI used to assert one cause for all of them — "the model only named films
// already in your list" — which is wrong three times out of four. One test per
// reason, so the wrong sentence cannot come back by accident.
function emptyRun(picks, tmdbStubs) {
  db.results['movies:select'] = RECS_LIBRARY;
  db.results['recommendation_logs:insert'] = { data: null, error: null };
  return stubFetch({ 'openrouter.ai': openRouterReply(JSON.stringify(picks)), ...tmdbStubs });
}

test('empty run: every pick already owned → all-owned', async () => {
  const restore = emptyRun(
    [{ title: 'Whiplash', reason: 'Already yours.' }],
    { 'query=Whiplash': { results: [{ ...MATRIX_TMDB, id: 1, title: 'Whiplash' }] } }
  );
  try {
    const body = await (await client.post('/api/recommendations')).json();
    assert.deepEqual(body.suggestions, []);
    assert.equal(body.emptyReason, 'all-owned');
  } finally {
    restore();
  }
});

test('empty run: the model named nothing → none-named', async () => {
  const restore = emptyRun([], {});
  try {
    const body = await (await client.post('/api/recommendations')).json();
    assert.equal(body.emptyReason, 'none-named');
  } finally {
    restore();
  }
});

// The one that matters most. TMDB being down produced a run that logs 'success'
// and told the user the model had named only films they already had — a
// confident false statement that also hid the outage.
test('empty run: TMDB unreachable → tmdb-unreachable, not all-owned', async () => {
  const restore = emptyRun([{ title: 'Heat', reason: 'A real pick.' }], {
    '/search/movie': 'throw',
  });
  try {
    const res = await client.post('/api/recommendations');
    assert.equal(res.status, 200, 'one TMDB outage must not fail the whole run');
    const body = await res.json();
    assert.equal(body.emptyReason, 'tmdb-unreachable');
    assert.notEqual(body.emptyReason, 'all-owned');
    // The audit row explains itself: empty suggested_titles, and a tally saying
    // whose fault that was.
    const row = db.calls.find((c) => c.table === 'recommendation_logs' && c.op === 'insert');
    assert.deepEqual(row.payload.suggested_titles, []);
    assert.equal(row.payload.raw_model_output.verification.tmdbErrors, 1);
    assert.equal(row.payload.raw_model_output.verification.owned, 0);
  } finally {
    restore();
  }
});

test('empty run: TMDB answered but knows no such film → unverifiable', async () => {
  const restore = emptyRun([{ title: 'Zzyzx Road', reason: 'Not a real film.' }], {
    'query=Zzyzx': { results: [] },
  });
  try {
    const body = await (await client.post('/api/recommendations')).json();
    assert.equal(body.emptyReason, 'unverifiable');
  } finally {
    restore();
  }
});

test('a run WITH suggestions carries no emptyReason at all', async () => {
  db.results['movies:select'] = RECS_LIBRARY;
  db.results['recommendation_logs:insert'] = { data: null, error: null };
  const restore = stubRecsRun();
  try {
    const body = await (await client.post('/api/recommendations')).json();
    assert.equal(body.suggestions.length, 1);
    assert.equal(body.emptyReason, null, 'a value here invites it to be read as a warning');
  } finally {
    restore();
  }
});

/* ---------- the invariant: a logged failure is ALWAYS advertised ------- */

// The user's requirement for R23, stated as a rule rather than a scenario: if a
// row with status 'failed' reaches an AI log table, the response MUST carry
// `logged` so the UI can point at it. A false negative here is a failure the
// user is told nothing about while its full cause sits in the log.
//
// Both features are asserted the same way and in the same place, because the
// whole point of R23 was that they had drifted into two different answers to one
// question.
const RATED_FOUR = {
  data: [
    { id: '1', tmdb_id: 1, title: 'Whiplash', year: 2014, rating: 10, review: 'relentless' },
    { id: '2', tmdb_id: 2, title: 'Dune', year: 2021, rating: 9, review: '' },
    { id: '3', tmdb_id: 3, title: 'Arrival', year: 2016, rating: 9, review: '' },
    { id: '4', tmdb_id: 4, title: 'Sicario', year: 2015, rating: 8, review: '' },
  ],
  error: null,
};

for (const feature of [
  { name: 'recommendations', path: '/api/recommendations', table: 'recommendation_logs' },
  { name: 'taste verdict', path: '/api/taste-verdict', table: 'taste_verdict_logs' },
]) {
  test(`POST ${feature.path}: a logged 'failed' row is always advertised to the UI`, async () => {
    db.results['movies:select'] = RATED_FOUR;
    db.results[`${feature.table}:insert`] = { data: null, error: null };
    const restore = stubFetch({ 'openrouter.ai': 'throw' });
    try {
      const res = await client.post(feature.path);
      assert.equal(res.status, 422);
      const body = await res.json();
      const row = db.calls.find((c) => c.table === feature.table && c.op === 'insert');

      assert.ok(row, `${feature.name}: a failure must still be logged`);
      assert.equal(row.payload.status, 'failed');
      // The invariant. Written as an implication so the failure message says
      // which half broke rather than just "expected true".
      assert.equal(
        body.logged,
        true,
        `${feature.name}: a 'failed' row was written but the response did not advertise the log`
      );
      // R8's half of the same change: the cause belongs in the row, not the UI.
      assert.doesNotMatch(body.error, /OpenRouter|TimeoutError|fetch/i);
      assert.match(row.payload.error_text, /OpenRouter/);
    } finally {
      restore();
    }
  });

  test(`POST ${feature.path}: a failure with NO log row advertises nothing`, async () => {
    // Dies on the library read, before any AI call — so there is no row, and
    // offering the log would send the user to an empty page.
    db.results['movies:select'] = { data: null, error: { message: 'connection refused' } };
    const res = await client.post(feature.path);
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.logged, undefined, `${feature.name}: nothing logged, nothing to point at`);
    assert.doesNotMatch(body.error, /connection refused|DB read/i);
    assert.equal(db.calls.filter((c) => c.table === feature.table).length, 0);
  });
}

// The third no-row case, and the one most likely to be broken by reordering: the
// AI call failed AND the log write failed, so there is genuinely nothing to read.
test('POST /api/taste-verdict when the log write itself fails advertises nothing', async () => {
  db.results['movies:select'] = RATED_FOUR;
  db.results['taste_verdict_logs:insert'] = { data: null, error: { message: 'insert refused' } };
  const restore = stubFetch({ 'openrouter.ai': 'throw' });
  try {
    const res = await client.post('/api/taste-verdict');
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.logged, undefined);
    assert.doesNotMatch(body.error, /insert refused|log write/i);
  } finally {
    restore();
  }
});

/* ---------- /api/ai-log shape ---------------------------------------- */

test('GET /api/ai-log returns structured result data per row', async () => {
  db.results['recommendation_logs:select'] = {
    data: [
      { id: 'r1', created_at: '2026-09-04T10:00:00Z', prompt_version: 'recommend_v3', model_used: 'anthropic/claude-haiku-4.5', tokens_used: 1000, prompt_tokens: 700, completion_tokens: 300, duration_ms: 3000, status: 'success', error_text: null, estimated_cost_usd: 0.002, suggested_titles: ['Hostel', 'Saw'] },
      { id: 'r2', created_at: '2026-09-04T09:00:00Z', prompt_version: 'recommend_v3', model_used: 'x', tokens_used: null, prompt_tokens: null, completion_tokens: null, duration_ms: 500, status: 'failed', error_text: 'OpenRouter unreachable', estimated_cost_usd: null, suggested_titles: [] },
    ],
    error: null,
  };
  db.results['taste_verdict_logs:select'] = {
    data: [
      { id: 'v1', created_at: '2026-09-04T11:00:00Z', prompt_version: 'taste_verdict_v4', model_used: 'x', tokens_used: 900, prompt_tokens: 800, completion_tokens: 100, duration_ms: 2000, status: 'success', error_text: null, estimated_cost_usd: 0.001, verdict_text: 'You like bold films.' },
      // pre-migration-001 shape: no token split, no duration recorded
      { id: 'v0', created_at: '2026-09-04T08:00:00Z', prompt_version: 'taste_verdict_v1', model_used: 'x', tokens_used: 400, prompt_tokens: null, completion_tokens: null, duration_ms: null, status: 'success', error_text: null, estimated_cost_usd: 0.0005, verdict_text: 'Old row.' },
    ],
    error: null,
  };

  const res = await client.get('/api/ai-log');
  assert.equal(res.status, 200);
  const { rows, totals } = await res.json();

  assert.equal(rows.length, 4);
  assert.deepEqual(rows.find((r) => r.id === 'r1').suggested_titles, ['Hostel', 'Saw']);
  assert.equal(rows.find((r) => r.id === 'r2').error_text, 'OpenRouter unreachable');
  assert.equal(rows.find((r) => r.id === 'r2').suggested_titles.length, 0);
  assert.equal(rows.find((r) => r.id === 'v1').verdict_text, 'You like bold films.');
  assert.equal(rows.find((r) => r.id === 'v1').error_text, null);
  assert.equal(totals.calls, 4);

  // Totals sum only the calls that recorded a split / duration, and report the
  // coverage so the viewer can say the in+out doesn't cover every call.
  assert.equal(totals.tokens, 2300);            // 1000 + 900 + 400 (r2 is null)
  assert.equal(totals.promptTokens, 1500);      // r1 700 + v1 800
  assert.equal(totals.completionTokens, 400);   // r1 300 + v1 100
  assert.equal(totals.detailed, 2);             // r2 and v0 have no split
  assert.equal(totals.durationMs, 5500);        // 3000 + 500 + 2000
  assert.equal(totals.timed, 3);                // v0 has no duration
});
