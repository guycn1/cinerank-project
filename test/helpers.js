import { once } from 'node:events';

// The real fetch, captured before any test replaces globalThis.fetch with a stub.
// The HTTP client below always uses this, so stubbing TMDB/OpenRouter never
// breaks requests to the test server itself.
const realFetch = globalThis.fetch.bind(globalThis);

/** Start an Express app on an ephemeral port; returns a tiny HTTP client. */
export async function startApp(app) {
  const server = app.listen(0);
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const req = (method, path, body) =>
    realFetch(base + path, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  return {
    get: (p) => req('GET', p),
    post: (p, b) => req('POST', p, b),
    patch: (p, b) => req('PATCH', p, b),
    del: (p) => req('DELETE', p),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/**
 * A minimal stand-in for the Supabase JS client's query builder. Every chain
 * method returns the builder; awaiting it resolves to a result looked up in
 * `state.results` by `"<table>:<op>"` (op = select | insert | update | delete),
 * falling back to `"<table>"` then to an empty result. Writes are recorded in
 * `state.calls` so a test can assert "a log row was written".
 */
export function makeFakeSupabase(state) {
  state.calls = state.calls || [];
  return {
    from(table) {
      const b = { _op: 'select' };
      const record = (op, payload) => {
        b._op = op;
        state.calls.push({ table, op, payload });
        return b;
      };
      Object.assign(b, {
        select: () => b,
        eq: () => b,
        order: () => b,
        not: () => b,
        single: () => b,
        insert: (p) => record('insert', p),
        update: (p) => record('update', p),
        delete: () => record('delete'),
        then(resolve, reject) {
          const pick =
            state.results[`${table}:${b._op}`] ??
            state.results[table] ?? { data: null, error: null };
          const value = typeof pick === 'function' ? pick() : pick;
          return Promise.resolve(value).then(resolve, reject);
        },
      });
      return b;
    },
  };
}

/**
 * Replace globalThis.fetch for the duration of one test. `map` is
 * { urlFragment: responseJson | 'throw' }. Returns a restore function.
 */
export function stubFetch(map) {
  const previous = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url ?? String(input);
    for (const [fragment, response] of Object.entries(map)) {
      if (url.includes(fragment)) {
        if (response === 'throw') throw new Error('simulated network failure');
        return { ok: true, status: 200, json: async () => response };
      }
    }
    throw new Error(`stubFetch: unexpected request to ${url}`);
  };
  return () => {
    globalThis.fetch = previous;
  };
}

/** A TMDB /movie/:id (and /search/movie result) payload for "The Matrix". */
export const MATRIX_TMDB = {
  id: 603,
  title: 'The Matrix',
  release_date: '1999-03-31',
  overview: 'A hacker discovers reality is a simulation.',
  poster_path: '/matrix.jpg',
  vote_average: 8.2,
};
