import express from 'express';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { config } from './config.js';
import { moviesRouter } from './routes/movies.js';
import { recommendationsRouter } from './routes/recommendations.js';
import { tasteVerdictRouter } from './routes/tasteVerdict.js';
import { aiLogRouter } from './routes/aiLog.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());

// Static frontend (vanilla HTML/CSS/JS — SPEC § 4.1)
app.use(express.static(join(__dirname, '..', 'public')));

// ---------------------------------------------------------------------------
// TEMPORARY — remove before the final merge to main, together with the matching
// <script> tag in public/index.html. Tracked as a checkbox under Pre-submission
// blockers in CLAUDE.md.
//
// The recommendations debug harness lives in scripts/, which is deliberately NOT
// inside the static root — so it needs this one explicit route to be loadable by
// the page at all. Serving the whole scripts/ directory would have been shorter
// and is not the same thing: this exposes exactly one known file.
//
// It is inert until debugRecs() is called from the console, and the file refuses
// to install itself on the deployed host regardless (see its hostname guard), so
// forgetting this line is not a live-site hazard on its own. Remove it anyway —
// a debug harness in a submitted build is its own kind of wrong.
// ---------------------------------------------------------------------------
app.get('/debug-recs.js', (_req, res) => {
  res.sendFile(join(__dirname, '..', 'scripts', 'debug-recs.js'));
});

// Liveness probe — most hosts (Render/Railway/Fly) want a cheap endpoint to poll.
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Config exposed to the frontend — public values only, never a secret.
app.get('/api/config', (_req, res) => {
  res.json({
    minRatedForRecommendations: config.recommendations.minRatedMovies,
    minRatedForVerdict: config.tasteVerdict.minRatedMovies,
    topN: config.recommendations.topN,
  });
});

app.use('/api/movies', moviesRouter);
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/taste-verdict', tasteVerdictRouter);
app.use('/api/ai-log', aiLogRouter);

// Central error handler — nothing leaks a stack trace to the client.
//
// The message does NOT say "on our side", and must not be changed back. This
// handler is the catch-all for everything unhandled anywhere in the app, and it
// cannot know whose fault the failure was: Supabase unreachable or refusing the
// credentials looks identical here to a genuine bug in this code. Naming a
// culprit it has not identified is a guess presented to the user as a fact, and
// it was wrong the first time anyone checked — bad Supabase credentials in .env
// produced "something went wrong on our side" for a problem that was neither a
// bug nor on the server's side. A vaguer message that is true beats a specific
// one that is not. The real cause is on the line above, in the server log,
// where it can be read without being guessed at.
app.use((err, _req, res, _next) => {
  console.error('[cinerank]', err);
  res.status(500).json({ error: 'Something went wrong.' });
});

export { app };

// Only listen when run directly (`node server/index.js`), not when imported by a
// test that drives the app on an ephemeral port.
const isEntry =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntry) {
  app.listen(config.port, () => {
    console.log(`CineRank running at http://localhost:${config.port}`);
  });
}
