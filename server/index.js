import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { config } from './config.js';
import { moviesRouter } from './routes/movies.js';
import { recommendationsRouter } from './routes/recommendations.js';
import { tasteVerdictRouter } from './routes/tasteVerdict.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());

// Static frontend (vanilla HTML/CSS/JS — SPEC § 4.1)
app.use(express.static(join(__dirname, '..', 'public')));

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

// Central error handler — nothing leaks a stack trace to the client.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[cinerank]', err);
  res.status(500).json({ error: 'Something went wrong on our side.' });
});

app.listen(config.port, () => {
  console.log(`CineRank running at http://localhost:${config.port}`);
});
