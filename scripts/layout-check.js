/**
 * @file Layout checks on the real UI, in real headless browsers, with no
 * external service: `npm run layout-check -- [options]`.
 *
 * It serves `public/` itself and answers every `/api/*` call from the fixtures
 * below, so it needs no `.env`, calls no Supabase, TMDB or OpenRouter, and
 * cannot write anything: a write request to `/api/movies` is held open and
 * never answered (which is also what keeps an Add button in its "Adding…"
 * state). The page still loads its web fonts from Google, as the live app
 * does; offline, the measurements are taken in fallback fonts.
 *
 * Each browser loads the app inside an iframe that `scripts/layout-probe.js`
 * resizes to every requested width, so widths are exact even where a headless
 * window has a minimum size. Results come back over plain HTTP, so the tool
 * needs no DevTools connection.
 *
 * MODES
 *   (default)          health: at every width, text stays inside its box and
 *                      the viewport, no two parts of a card overlap, nothing
 *                      scrolls sideways, and every line break inside a word
 *                      obeys softHyphenate()'s rules; plus the verdict typing
 *                      and the clipboard. Exit 1 on any failure.
 *   --baseline=REF     diff: the layout under a baseline stylesheet (a git ref
 *                      or a file) against the candidate, element by element,
 *                      at every width. Informational unless --expect-same.
 *   --self-test        health checks against a deliberately broken copy of the
 *                      candidate stylesheet. Exit 1 unless every check fires.
 *
 * OPTIONS
 *   --browsers=chrome,firefox,edge  default chrome,firefox. Paths come from
 *                      CHROME_PATH / EDGE_PATH / FIREFOX_PATH, else the usual
 *                      install locations; a missing browser is skipped, and a
 *                      run in which no browser ran fails.
 *   --widths=SPEC      e.g. 290-420,440-800:20,1280 (range:step, comma-list).
 *                      Default 290-420,440-800:20,900,1000,1280 for health and
 *                      1000-1100:20,1200,1280,1440,1920 for diff.
 *   --css=FILE         candidate stylesheet, default public/styles.css.
 *   --reference-width=PX  diff mode: also compare the candidate at every width
 *                      above PX with the baseline at exactly PX, for the header,
 *                      main and footer. That is the test for a max-width change:
 *                      the new layout should be one the app already renders at
 *                      PX. The AI log dialog is left out of it, since its width
 *                      is a share of the viewport and so has its own reference.
 *   --expect-same      diff mode: exit 1 on any difference (for refactors).
 *   --timeout=SECONDS  per browser, default 900.
 *   --stall=SECONDS    abandon a run whose probe goes quiet this long, default
 *                      120; the probe reports every width it reaches.
 *   --verbose          more samples: up to 12 per category (health), up to 30
 *                      changed elements per width (diff).
 *   --debug            log every request the fixture server receives.
 *
 * TESTING A DESIGN CHANGE, STEP BY STEP
 *   1. Before editing: `npm run layout-check` passes. If it does not, the
 *      failure predates your change.
 *   2. Make the change and run it again. A new failure is yours; rerun with
 *      --verbose, and with --widths set to the widths in the samples.
 *   3. See exactly what moved: `npm run layout-check -- --baseline=HEAD`
 *      compares the stylesheet on disk with the committed one. Add
 *      --expect-same when nothing should move (a refactor), or
 *      --reference-width=PX for a max-width change.
 *   4. If the change adds a new kind of card or component, or new text that
 *      softHyphenate() processes, add it to the selector lists at the top of
 *      scripts/layout-probe.js first, or it goes unchecked; then --self-test
 *      confirms every check still fires. New data on screen may need new
 *      fixtures (below).
 *   Only the stylesheet can be swapped (--css, --baseline); app.js and
 *   index.html are always the ones on disk.
 *
 * READING THE OUTPUT
 *   Health and self-test print, per browser, a header line:
 *     == chrome: 153 widths 290–1280px, all exact: true; on screen: 12 ranked,
 *        7 search rows, 6 rec cards, 60 log rows
 *   "all exact: false" means a width could not be set, so the run is not
 *   valid. "on screen" confirms every surface was checked; a 0 means that
 *   surface did not render and was not checked.
 *   Then one line per category, with a count:
 *     !!     a failure. The categories:
 *            contain:  text outside the viewport, outside its card or
 *                      component, or cut off by a box that clips it
 *            collide:  two parts of a component overlap
 *            scroll:   the page is wider than the viewport, or a box scrolls
 *                      sideways
 *            hyph:     a soft-hyphen break in a short word, too near a word's
 *                      edge, or beside a dash; or a word broken at a soft
 *                      hyphen above the width where soft hyphens are off
 *            clip:     an invisible character reached the clipboard, or the
 *                      verdict did not copy exactly once
 *            typing:   a letter moved back up a line while the verdict typed
 *            page errors: a script error or unhandled rejection in the page
 *     ok:    correct behaviour, counted for reassurance (a long word
 *            hyphenated, a break beside a dash).
 *     note:  not a failure, worth a glance: a break without a hyphen where
 *            Unicode allows one (between two emoji, say), or a word wider
 *            than its whole column broken by overflow-wrap.
 *   Samples follow "e.g.": the width, then the words around a break with `|`
 *   where the line broke (`401px moving|—honestly`); for containment the
 *   component and the text; for an overlap, `component: part × part`.
 *   The last line, FAILING, names every failing category.
 *
 *   Diff mode prints, per width:
 *     1041px: 248/1795 moved (max 1.0px) {".site-head":5,"main":234,".site-foot":9}
 *   How many elements changed position or size by more than 0.5px, out of
 *   how many were compared; the largest change; and where: the header, main,
 *   the footer or the AI log dialog. "appeared" / "disappeared" count
 *   elements shown in one layout and not the other (a toggle a wrap hides,
 *   say). With --reference-width, a second block compares the candidate above
 *   that width with the baseline AT it. After a max-width change expect 0 in
 *   main and the footer, and a few header elements moving by under a pixel:
 *   those come from the header's vw-based padding and icon size, and move
 *   with the window whether or not the change is there.
 *
 *   Other lines: "stalled (nothing for 120s)" means the probe went quiet and
 *   that attempt was abandoned (Edge is retried once). "NO RESULT" means no
 *   attempt finished, which fails the run. "not installed, skipped", and "No
 *   browser ran", which fails. "write request(s) held" is informational.
 *
 *   Exit code 0: passed. 1: a check failed, a browser gave no result, no
 *   browser ran, a self-test fault went uncaught, or (diff with
 *   --expect-same) something moved. 2: the tool itself failed.
 *
 * Adapting it: the fixtures are below, and the selectors that define "a card"
 * and "a component" for the containment and overlap checks are at the top of
 * scripts/layout-probe.js. The hyphenation rules are read out of app.js and
 * styles.css, so they follow the code instead of being restated here.
 */

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');

/* ---------- options ------------------------------------------------------ */

/**
 * Parse `--key=value` and bare `--flag` arguments.
 *
 * @param {string[]} argv
 * @returns {Record<string, string|boolean>}
 */
function parseArgs(argv) {
  const opts = {};
  for (const arg of argv) {
    const m = arg.match(/^--([a-z-]+)(?:=(.*))?$/);
    if (!m) throw new Error(`unrecognised argument: ${arg}`);
    opts[m[1]] = m[2] === undefined ? true : m[2];
  }
  return opts;
}

/**
 * Expand a width spec such as `290-420,440-800:20,1280` into a list.
 *
 * @param {string} spec
 * @returns {number[]}
 */
function parseWidths(spec) {
  const out = [];
  for (const part of spec.split(',')) {
    const m = part.trim().match(/^(\d+)(?:-(\d+)(?::(\d+))?)?$/);
    if (!m) throw new Error(`bad width spec: ${part}`);
    const [from, to, step] = [Number(m[1]), Number(m[2] || m[1]), Number(m[3] || 1)];
    for (let w = from; w <= to; w += step) out.push(w);
  }
  return [...new Set(out)];
}

/**
 * Read a stylesheet from a file, or from `public/styles.css` at a git ref.
 *
 * @param {string} ref  A file path, or a git ref such as `HEAD~1`.
 * @returns {string}
 */
function readStylesheet(ref) {
  if (fs.existsSync(ref)) return fs.readFileSync(ref, 'utf8');
  return execFileSync('git', ['show', `${ref}:public/styles.css`], { cwd: ROOT, encoding: 'utf8' });
}

/**
 * The hyphenation rules the probe checks line breaks against, read out of the
 * code so they cannot drift: softHyphenate()'s word minimum, edge minimum and
 * word separator from app.js, and the width at or below which the stylesheet
 * switches soft hyphens on.
 *
 * @param {string} css  The stylesheet under test.
 * @returns {{minWord: number, minEdge: number, separator: string, threshold: number}}
 * @throws {Error} When app.js or the stylesheet no longer has the expected shape.
 */
function hyphenationRules(css) {
  const js = fs.readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');
  const minWord = js.match(/const HYPHENATE_MIN_WORD = (\d+);/);
  const minEdge = js.match(/const HYPHENATE_MIN_EDGE = (\d+);/);
  const sep = js.match(/const WORD_SEPARATOR = \/(.+)\/u;/);
  const threshold = css.match(/@media \(max-width: (\d+)px\) \{[^}]*hyphens: manual/);
  if (!minWord || !minEdge || !sep || !threshold) {
    throw new Error('could not read the hyphenation rules out of app.js / the stylesheet; update hyphenationRules()');
  }
  return { minWord: Number(minWord[1]), minEdge: Number(minEdge[1]), separator: sep[1], threshold: Number(threshold[1]) };
}

/**
 * Faults appended to the candidate stylesheet by --self-test. Each one must be
 * caught by the named check, or the self-test fails.
 */
const SELF_TEST_FAULTS = [
  ['contain', '.movie-card__body { overflow-wrap: normal !important; min-width: auto !important; }'],
  ['collide', '.movie-card__score { position: relative !important; left: -140px !important; }'],
  ['scroll', '.result-row .meta strong { white-space: nowrap !important; }'],
  ['hyph', '.movie-card__body, .rec-card__body, .result-row, .verdict__text { hyphens: manual !important; }'],
  ['clip', '.sr-only { -webkit-user-select: text !important; user-select: text !important; }'],
];

/* ---------- fixtures ------------------------------------------------------ */

/** The demo list as `scripts/seed-demo.js` loads it (that script runs on
 *  import, so it cannot be imported), plus films chosen to stress wrapping. */
const FILMS = [
  ['Mad Max: Fury Road', 2015, 9.1, 7.6, 'absolute peak and I will not be talked down from it. two hours of real trucks doing real things in a real desert, about forty lines of dialogue in the whole film, and it is still easier to follow than things carrying three times the plot. they built a man on a bungee cord with a flamethrower guitar and then just committed to him. no wink, no apology. that is the whole thing for me.'],
  ['Wicked', 2024, 8.6, 6.9, 'loved this so much 🔥 the songs are insane and elphaba and glinda absolutely carried the whole thing. genuinely magical on a big screen.'],
  ['Knives Out', 2019, 8.2, 7.8, null],
  ['The SpongeBob SquarePants Movie', 2004, 7.6, 7.0, 'absolute childhood classic and I am not taking questions. the goofy goober rock scene still slaps harder than it has any right to 🤧 loses a point because the shell city stretch drags and I just want to get back to the dumb stuff.'],
  ['Shrek 5', 2027, 4.5, null, 'trailer looks like it was assembled by a committee working off a deck about what people liked in 2004. will wait for streaming.'],
  ['Saw', 2004, 1.5, 7.4, 'sold to me as a clever puzzle box and it is really a gimmick with a twist stapled on the end. props for the swing, but there is no second idea underneath the first one.'],
  ['Shrek', 2001, null, 7.7, null],
  ['Spider-Man: Across the Spider-Verse', 2023, 8.8, 8.3, 'a self-indulgent, twenty-first-century crowd-pleaser — and I mean that as a compliment; the Spider-Verse sequences are extraordinarily well-constructed.'],
  ['Borat: Cultural Learnings of America for Make Benefit Glorious Nation of Kazakhstan', 2006, 6.4, 6.6, 'Donaudampfschifffahrtsgesellschaftskapitänskajüte-level absurdity 🔥🔥 and a surprisingly uncompromising commitment to the bit.'],
  ['Dr. Strangelove or: How I Learned to Stop Worrying and Love the Bomb', 1964, 9.4, 8.1, null],
  ['Birdman or (The Unexpected Virtue of Ignorance)', 2014, null, 7.5, null],
  ['Everything Everywhere All at Once', 2022, 9.0, 7.8, 'loved it 👨‍👩‍👧‍👦 — Amélie-level whimsy, SquarePants-level chaos, extraordinarily moving—honestly'],
];

/**
 * The fixture ranked list, in the order GET /api/movies returns it (rating
 * descending, unrated last, oldest first within a tie).
 *
 * @returns {object[]}
 */
function fixtureMovies() {
  const rows = FILMS.map(([title, year, rating, tmdb, review], i) => ({
    id: `fixture-${i}`, tmdb_id: -1000 - i, title, year, rating, tmdb_rating: tmdb, review,
    description: null, poster_url: null, created_at: new Date(Date.UTC(2026, 8, 1, 0, i)).toISOString(),
  }));
  return rows.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.created_at.localeCompare(b.created_at));
}

const SEARCH_RESULTS = [
  ['Night of the Day of the Dawn of the Son of the Bride of the Return of the Revenge of the Terror of the Attack of the Evil, Mutant, Alien, Flesh Eating, Hellbound, Zombified Living Dead Part 2', 2005, 4.1],
  ['Spider-Man: Into the Spider-Verse', 2018, 8.4],
  ['The SpongeBob SquarePants Movie', 2004, 7.0],
  ['Donaudampfschifffahrtsgesellschaftskapitänskajüte', 2020, null],
  ['Mission: Impossible – Dead Reckoning Part One', 2023, 7.5],
  ['Spider-Man: Across the Spider-Verse', 2023, 8.3],
  ['Up', 2009, 8.0],
].map(([title, year, tmdb], i) => ({
  // The sixth shares a tmdb_id with a film in the list, so it shows "In your list".
  tmdb_id: i === 5 ? -1007 : -2000 - i, title, year, tmdb_rating: tmdb, description: null, poster_url: null,
}));

const RECOMMENDATIONS = {
  suggestions: [
    ['Mad God', 2021, 'You rewarded uncompromising, handmade worlds — this stop-motion nightmare is exactly that.'],
    ['Everything Everywhere All at Once', 2022, 'Your SquarePants-level love of absurdity meets extraordinarily sincere emotional stakes here.'],
    ['Spider-Man: Across the Spider-Verse', 2023, 'You loved Fury Road’s kinetic craft; this is animation at that intensity.'],
    ['The Lord of the Rings: The Fellowship of the Ring', 2001, 'Big-canvas world-building, played completely straight, the way your top picks are.'],
    ['Hundreds of Beavers', 2022, 'Anarchic, self-aware slapstick—your SpongeBob rating says you will laugh.'],
    ['Birdman or (The Unexpected Virtue of Ignorance)', 2014, 'An incomprehensibly ambitious single-take conceit that never plays it safe.'],
  ].map(([title, year, reason], i) => ({ tmdb_id: -3000 - i, title, year, reason, poster_url: null })),
  emptyReason: null,
  meta: { promptVersion: 'recommend_v3', model: 'fixture/none', tokensUsed: 0, estimatedCostUsd: 0, durationMs: 0,
    basedOn: ['Mad Max: Fury Road', 'Wicked', 'Knives Out', 'Everything Everywhere All at Once', 'Dr. Strangelove or: How I Learned to Stop Worrying and Love the Bomb'] },
};

const VERDICT = {
  verdict: 'You gravitate toward uncompromising, extraordinarily physical filmmaking, SquarePants-level absurdity included, and you quietly punish anything that plays it safe. Knives Out lands because it is clever; Saw lands nowhere because it mistakes cruelty for craft.',
  meta: { promptVersion: 'taste_verdict_v7', model: 'fixture/none', tokensUsed: 0, estimatedCostUsd: 0, durationMs: 0 },
};

/**
 * Sixty AI call log rows in the shape GET /api/ai-log returns: both features,
 * successes and two failures, with totals.
 *
 * @returns {{rows: object[], totals: object}}
 */
function fixtureAiLog() {
  const rows = [];
  for (let i = 0; i < 60; i++) {
    const rec = i % 3 !== 0;
    const failed = i === 7 || i === 31;
    const p = failed ? null : 800 + (i % 7) * 97;
    const c = failed ? null : 90 + (i % 5) * 41;
    rows.push({
      id: `log-${i}`, feature: rec ? 'Recommendation' : 'Taste verdict',
      created_at: new Date(Date.UTC(2026, 8, 27, 23, 59 - i)).toISOString(),
      prompt_version: rec ? 'recommend_v3' : 'taste_verdict_v7',
      model_used: rec ? 'anthropic/claude-haiku-4.5' : 'anthropic/claude-sonnet-5',
      tokens_used: failed ? null : p + c, prompt_tokens: p, completion_tokens: c,
      duration_ms: failed ? 74 : 3000 + (i % 9) * 111, status: failed ? 'failed' : 'success',
      estimated_cost_usd: failed ? null : Number((0.002 + (i % 4) * 0.0007).toFixed(6)),
      error_text: failed ? 'OpenRouter responded 401' : null,
      ...(rec ? { suggested_titles: failed ? [] : ['Mad God', 'Hundreds of Beavers', 'Spider-Man: Across the Spider-Verse', 'The Lord of the Rings: The Fellowship of the Ring'] }
        : { verdict_text: failed ? null : VERDICT.verdict }),
    });
  }
  const sum = (k) => rows.reduce((n, r) => n + (r[k] || 0), 0);
  const detailed = rows.filter((r) => r.prompt_tokens != null).length;
  return { rows, totals: { calls: rows.length, tokens: sum('tokens_used'), cost: Number(sum('estimated_cost_usd').toFixed(6)),
    promptTokens: sum('prompt_tokens'), completionTokens: sum('completion_tokens'), detailed, durationMs: sum('duration_ms'), timed: rows.length } };
}

/* ---------- the fixture server ------------------------------------------- */

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

/**
 * Answer one fixture API request. Writes to the movie list are held open.
 *
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {URL} url
 * @param {{heldWrites: number}} stats
 * @returns {void}
 */
function answerApi(req, res, url, stats) {
  const json = (body) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (url.pathname.startsWith('/api/movies') && req.method !== 'GET') { stats.heldWrites += 1; return; }
  if (url.pathname === '/api/config') return json({ minRatedForRecommendations: 3, minRatedForVerdict: 2, topN: 5 });
  if (url.pathname === '/api/movies') return json({ movies: fixtureMovies() });
  if (url.pathname === '/api/movies/search') return json({ results: SEARCH_RESULTS });
  if (url.pathname === '/api/recommendations' && req.method === 'POST') return json(RECOMMENDATIONS);
  if (url.pathname === '/api/taste-verdict' && req.method === 'POST') return json(VERDICT);
  if (url.pathname === '/api/ai-log') return json(fixtureAiLog());
  if (url.pathname === '/api/health') return json({ status: 'ok' });
  res.writeHead(404); res.end();
}

/**
 * Start the fixture server on a free port.
 *
 * @param {{css: string, probeConfig: object}} setup
 * @returns {Promise<{url: string, close: () => void, expect: (run: string) => Promise<object|null>, stats: object}>}
 */
function startServer({ css, probeConfig }) {
  const waiting = new Map(); // run -> { release, resolve }
  const lastSeen = new Map(); // run -> when a request for it last arrived
  const stats = { heldWrites: 0 };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const run = url.searchParams.get('run');
    if (run) lastSeen.set(run, Date.now());
    if (probeConfig.debug) console.error(`[server] ${req.method} ${url.pathname}${url.search}`);
    if (url.pathname === '/__probe/frame') {
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end(`<!doctype html><body style="margin:0;background:#333"><iframe style="border:0;display:block" width="800" height="900" src="/?run=${run}"></iframe><img src="/__probe/wait?run=${run}" alt="" style="display:none"></body>`);
    }
    if (url.pathname === '/__probe/wait') {
      const w = waiting.get(run);
      if (w) w.release = () => { if (!res.headersSent) { res.writeHead(204); res.end(); } };
      return;
    }
    if (url.pathname === '/__probe/progress') { res.writeHead(204); return res.end(); } // the heartbeat; noted above in lastSeen
    if (url.pathname === '/__probe/config') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(probeConfig)); }
    if (url.pathname === '/__probe/probe.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, 'scripts', 'layout-probe.js'))); }
    if (url.pathname === '/__probe/done' && req.method === 'POST') {
      let body = ''; req.on('data', (c) => (body += c));
      return req.on('end', () => {
        res.writeHead(204); res.end();
        const w = waiting.get(run); if (!w) return;
        waiting.delete(run); // answered once, so close() cannot answer it again
        w.resolve(JSON.parse(body)); if (w.release) w.release();
      });
    }
    if (url.pathname.startsWith('/api/')) return answerApi(req, res, url, stats);
    if (url.pathname === '/styles.css') { res.writeHead(200, { 'content-type': 'text/css', 'cache-control': 'no-store' }); return res.end(css); }
    const file = path.join(PUBLIC, url.pathname === '/' ? 'index.html' : path.normalize(url.pathname));
    if (!file.startsWith(PUBLIC) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    let body = fs.readFileSync(file);
    if (file.endsWith('index.html')) body = String(body).replace('</body>', '<script src="/__probe/probe.js"></script></body>');
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    return res.end(body);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    resolve({
      url: `http://127.0.0.1:${port}`, // the address it listens on; `localhost` may resolve to IPv6 first
      stats,
      // Held write requests would otherwise keep the process alive.
      close: () => { for (const w of waiting.values()) if (w.release) w.release(); server.closeAllConnections(); server.close(); },
      expect: (runId) => { lastSeen.set(runId, Date.now()); return new Promise((done) => waiting.set(runId, { resolve: done })); },
      quietFor: (runId) => Date.now() - (lastSeen.get(runId) || Date.now()),
    });
  }));
}

/* ---------- browsers -------------------------------------------------------- */

const BROWSERS = {
  chrome: { env: 'CHROME_PATH', win: 'C:/Program Files/Google/Chrome/Application/chrome.exe', mac: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', linux: 'google-chrome', kind: 'chromium' },
  edge: { env: 'EDGE_PATH', win: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', mac: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', linux: 'microsoft-edge', kind: 'chromium' },
  firefox: { env: 'FIREFOX_PATH', win: 'C:/Program Files/Mozilla Firefox/firefox.exe', mac: '/Applications/Firefox.app/Contents/MacOS/firefox', linux: 'firefox', kind: 'firefox' },
};

/**
 * The executable for a browser, or null when it is not installed.
 *
 * @param {string} name
 * @returns {string|null}
 */
function browserPath(name) {
  const b = BROWSERS[name];
  if (!b) throw new Error(`unknown browser: ${name}`);
  const p = process.env[b.env] || (process.platform === 'win32' ? b.win : process.platform === 'darwin' ? b.mac : b.linux);
  return path.isAbsolute(p) && !fs.existsSync(p) ? null : p;
}

/**
 * Stop a browser this tool started, with its child processes. Only ever the
 * PID we spawned.
 *
 * @param {import('node:child_process').ChildProcess} child
 * @returns {void}
 */
function stopBrowser(child) {
  if (child.exitCode !== null) return;
  if (process.platform === 'win32') {
    try { execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* already gone */ }
  } else child.kill('SIGKILL');
}

/**
 * Run the probe in one browser and collect its result.
 *
 * @param {string} name
 * @param {{url: string, expect: Function}} server
 * @param {number} timeoutMs
 * @param {number} stallMs  How long the probe may go quiet before the run is abandoned.
 * @returns {Promise<object|null>} The probe's result, or null on timeout.
 */
async function runBrowser(name, server, timeoutMs, stallMs) {
  const exe = browserPath(name);
  if (!exe) return { skipped: true };
  const run = `${name}-${Date.now()}`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cinerank-layout-'));
  const target = `${server.url}/__probe/frame?run=${run}`;
  const args = BROWSERS[name].kind === 'firefox'
    ? ['-headless', '-no-remote', '-profile', profile, '-screenshot', path.join(profile, 'shot.png'), '-window-size=1400,1000', target]
    : ['--headless=new', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, '--window-size=1400,1000',
      // Headless Edge can treat the page as a background tab and throttle its
      // timers, which stalls the verdict's typing (one tick per 18ms) for good.
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
      '--dump-dom', target];
  const result = server.expect(run);
  const child = spawn(exe, args, { stdio: 'ignore' });
  // A browser named only by its command (as on Linux) that is not installed
  // fails to start; that is a skip, not a crash of the whole run.
  const failedToStart = new Promise((resolve) => child.on('error', () => resolve({ skipped: true })));
  let timer, watch;
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); });
  // The probe reports every width it reaches; a run that goes quiet has
  // stalled, so it is abandoned at once rather than at the timeout.
  const stalled = new Promise((resolve) => {
    watch = setInterval(() => {
      if (server.quietFor(run) > stallMs) { console.log(`\n== ${name}: stalled (nothing for ${stallMs / 1000}s), abandoning this attempt`); resolve(null); }
    }, 2000);
  });
  const out = await Promise.race([result, failedToStart, timeout, stalled]);
  clearTimeout(timer); clearInterval(watch);
  // Let a browser that is done exit by itself, then stop it and wait for it to go.
  const exited = new Promise((r) => { if (child.exitCode !== null) r(); else child.once('exit', r); });
  await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))]);
  stopBrowser(child);
  await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))]);
  PROFILES.add(profile);
  removeProfile(profile);
  return out;
}

/** Every temporary browser profile this run created; see removeProfile(). */
const PROFILES = new Set();

/**
 * Delete a temporary browser profile. A browser's helper processes (the crash
 * reporter among them) can hold files in it for a while after the browser has
 * gone, so a failure here is retried, and main() sweeps again at the end.
 *
 * @param {string} profile
 * @returns {boolean} Whether it is gone.
 */
function removeProfile(profile) {
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 }); } catch { /* retried at the end */ }
  if (!fs.existsSync(profile)) PROFILES.delete(profile);
  return !fs.existsSync(profile);
}

/**
 * The last sweep: retry every profile still on disk for up to half a minute,
 * and name any that could not be removed rather than leave them silently.
 *
 * @returns {Promise<void>}
 */
async function sweepProfiles() {
  for (let i = 0; i < 15 && PROFILES.size; i++) {
    for (const p of [...PROFILES]) removeProfile(p);
    if (PROFILES.size) await new Promise((r) => setTimeout(r, 2000));
  }
  for (const p of PROFILES) console.log(`\n(could not remove the temporary browser profile ${p}; it is safe to delete)`);
}

/* ---------- reports ---------------------------------------------------------- */

/**
 * Print a health-mode result and say whether it passed.
 *
 * @param {string} name
 * @param {object} r
 * @param {boolean} verbose
 * @returns {string[]} The failing categories.
 */
function reportHealth(name, r, verbose) {
  const ws = r.widths;
  console.log(`\n== ${name}: ${ws.length} widths ${ws[0]}–${ws[ws.length - 1]}px, all exact: ${r.allExact}; on screen: ${r.setup.ranked} ranked, ${r.setup.search} search rows, ${r.setup.recs} rec cards, ${r.setup.logRows} log rows`);
  const keys = Object.keys(r.counts).sort();
  const failing = keys.filter((k) => !k.startsWith('ok:') && !k.startsWith('note:'));
  for (const k of keys) {
    const bad = failing.includes(k);
    console.log(`  ${bad ? '!!' : '  '} ${k}: ${r.counts[k]}`);
    if ((bad || verbose) && r.samples[k]) console.log(`       e.g. ${r.samples[k].slice(0, verbose ? 12 : 4).join(' ; ')}`);
  }
  if (r.errors.length) { console.log(`  !! page errors: ${r.errors.join(' | ')}`); failing.push('page errors'); }
  console.log(`  verdict typing: ${r.typing.ticks} ticks, letters jumping up a line: ${r.typing.jumps}`);
  console.log(`  FAILING: ${failing.length ? failing.join(', ') : 'none'}`);
  return failing;
}

/**
 * Print a diff-mode result.
 *
 * @param {string} name
 * @param {object} r
 * @param {boolean} verbose
 * @returns {number} How many differences it found in total.
 */
function reportDiff(name, r, verbose) {
  let total = 0;
  const line = (label, s) => {
    total += s.changed + s.appeared.length + s.disappeared.length;
    const extra = s.appeared.length || s.disappeared.length ? `, appeared ${s.appeared.length}, disappeared ${s.disappeared.length}` : '';
    console.log(`   ${label}: ${s.changed}/${s.compared} moved (max ${s.maxShift.toFixed(1)}px)${extra} ${JSON.stringify(s.byRegion)}`);
    if (verbose || (s.changed && s.changed <= 12)) for (const d of s.samples.slice(0, verbose ? 30 : 6)) console.log(`        ${d}`);
  };
  console.log(`\n== ${name}`);
  console.log('  baseline vs candidate, same width:');
  for (const x of r.same) line(`${x.w}px`, x);
  if (r.reference) {
    console.log(`  candidate at W vs baseline at exactly ${r.reference.width}px (header, main and footer; not the dialog, whose vw width has its own reference):`);
    for (const x of r.reference.results) line(`${x.w}px`, x);
  }
  return total;
}

/* ---------- main ------------------------------------------------------------ */

/**
 * The configuration the probe runs from, built from the options.
 *
 * @param {Record<string, string|boolean>} opts
 * @returns {{candidate: string, probeConfig: object}}
 */
function buildConfig(opts) {
  const cssFile = opts.css ? path.resolve(String(opts.css)) : path.join(PUBLIC, 'styles.css');
  let candidate = fs.readFileSync(cssFile, 'utf8');
  if (opts['self-test']) candidate += `\n/* layout-check --self-test faults */\n${SELF_TEST_FAULTS.map(([, rule]) => rule).join('\n')}\n`;
  const mode = opts.baseline ? 'diff' : 'health';
  const defaultWidths = mode === 'diff' ? '1000-1100:20,1200,1280,1440,1920' : '290-420,440-800:20,900,1000,1280';
  return {
    candidate,
    probeConfig: {
      mode,
      widths: parseWidths(String(opts.widths || defaultWidths)),
      rules: hyphenationRules(candidate),
      baselineCss: opts.baseline ? readStylesheet(String(opts.baseline)) : null,
      candidateCss: candidate,
      referenceWidth: opts['reference-width'] ? Number(opts['reference-width']) : null,
      debug: Boolean(opts.debug),
    },
  };
}

/**
 * Run one browser and report it.
 *
 * @param {string} name
 * @param {object} server
 * @param {Record<string, string|boolean>} opts
 * @param {string} mode
 * @returns {Promise<{failed: boolean, failing: string[], skipped?: boolean}>}
 */
async function checkBrowser(name, server, opts, mode) {
  const timeoutMs = Number(opts.timeout || 900) * 1000;
  const stallMs = Number(opts.stall || 120) * 1000;
  let r = await runBrowser(name, server, timeoutMs, stallMs);
  // One retry for Edge, as a backstop: it stalled on first attempts until the
  // timer-throttling switches in runBrowser() went in.
  if (!r && name === 'edge') r = await runBrowser(name, server, timeoutMs, stallMs);
  if (r && r.skipped) { console.log(`\n== ${name}: not installed, skipped`); return { failed: false, failing: [], skipped: true }; }
  if (!r) { console.log(`\n== ${name}: NO RESULT (stalled or timed out)`); return { failed: true, failing: [] }; }
  if (r.fatal) { console.log(`\n== ${name}: probe error\n${r.fatal}`); return { failed: true, failing: [] }; }
  if (mode === 'diff') {
    const differences = reportDiff(name, r, opts.verbose); // always print, whatever --expect-same says
    return { failed: Boolean(opts['expect-same']) && differences > 0, failing: [] };
  }
  const failing = reportHealth(name, r, opts.verbose);
  return { failed: !opts['self-test'] && failing.length > 0, failing };
}

/**
 * Parse the options, run every browser and print the report.
 *
 * @returns {Promise<boolean>} Whether the run failed.
 */
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { candidate, probeConfig } = buildConfig(opts);
  const server = await startServer({ css: candidate, probeConfig });
  let failed = false;
  let ran = 0;
  const fired = new Set();
  for (const name of String(opts.browsers || 'chrome,firefox').split(',')) {
    const r = await checkBrowser(name, server, opts, probeConfig.mode);
    failed = failed || r.failed;
    if (!r.skipped) ran += 1;
    r.failing.forEach((k) => fired.add(k.split(':')[0]));
  }
  // Nothing checked is not a pass.
  if (!ran) { console.log('\nNo browser ran: install one, or set CHROME_PATH / EDGE_PATH / FIREFOX_PATH.'); failed = true; }
  if (opts['self-test']) {
    const missed = SELF_TEST_FAULTS.map(([check]) => check).filter((check) => !fired.has(check));
    console.log(`\nself-test: ${missed.length ? `NOT caught: ${missed.join(', ')}` : 'every planted fault was caught'}`);
    failed = failed || missed.length > 0; // a browser with no result still fails the run
  }
  if (server.stats.heldWrites) console.log(`\n(${server.stats.heldWrites} write request(s) held and never answered, as designed)`);
  server.close();
  await sweepProfiles();
  return failed;
}

main().then(
  (failed) => { process.exitCode = failed ? 1 : 0; },
  (err) => { console.error(err); process.exitCode = 2; },
);
