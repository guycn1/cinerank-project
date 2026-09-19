import 'dotenv/config';

// Secrets live only in .env (CLAUDE.md § Security & Secrets #1). This module is the
// single place they enter the process; nothing else reads a SECRET out of
// process.env. The one other process.env read in the repository is
// scripts/seed-demo.js's CINERANK_URL, which is a base URL and not a
// credential. (This said "nothing else reads process.env directly", which that
// line has falsified since the seed helper was written.)

function required(name) {
  const value = process.env[name];
  if (!value || value.startsWith('your-') || value.includes('YOUR-')) {
    throw new Error(
      `Missing env var ${name}. Copy .env.example to .env and fill it in.`
    );
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT) || 3000,

  supabase: {
    url: required('SUPABASE_URL'),
    anonKey: required('SUPABASE_ANON_KEY'),
  },

  tmdb: {
    apiKey: required('TMDB_API_KEY'),
    base: 'https://api.themoviedb.org/3',
    imageBase: 'https://image.tmdb.org/t/p/w500',
  },

  openrouter: {
    apiKey: required('OPENROUTER_API_KEY'),
    base: 'https://openrouter.ai/api/v1/chat/completions',
    // The app-wide default, and what RECOMMENDATIONS use. The cheaper tier here is
    // deliberate and is NOT a judgement that the task is small. This comment used
    // to read 'that task is "name some films"', which was both dismissive and
    // wrong: the run reads the whole list, infers a taste from the top five rated
    // films and the reviews attached to them (topN below), excludes every title
    // already in the list whether rated or not, and justifies each pick in one
    // second-person sentence of 8-16 words tied to a specific rating or a pattern
    // across them (prompts/recommend_v3.md).
    // What makes the cheaper tier right is that the output is CHECKABLE --
    // structured JSON, every title cross-checked against TMDB, so a bad pick is
    // dropped rather than shown. The verdict has nothing to check it against,
    // which is the actual reason it alone moved up a tier (D-053).
    model: process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5',
  },

  // Recommendation tuning (SPEC § 2.2)
  recommendations: {
    minRatedMovies: 3,
    topN: 5,
  },
  tasteVerdict: {
    minRatedMovies: 2,
    // The ONE feature that does not run on the cheaper tier (D-053). Four prompt
    // versions failed to get Haiku to write in a plain spoken register; the
    // model turned out to be the constraint, not the wording. Sonnet-5 is the
    // cheapest real-time Sonnet on OpenRouter ($2/$10 per Mtok against Haiku's
    // $1/$5 — 2x, and ~0.29c a verdict), so this buys the register for a rounding
    // error. Recommendations stay on Haiku: nothing there depends on voice.
    // NOT a `:batch` slug, however cheap it looks in OpenRouter's list — those
    // are asynchronous and would break a live request.
    model: process.env.OPENROUTER_VERDICT_MODEL || 'anthropic/claude-sonnet-5',
  },
};

// Cost logging is a hard requirement (CLAUDE.md § Coding Conventions). We ask
// OpenRouter for the exact cost in its response (openrouter.js sends
// usage.include=true); this table is only the fallback when that field is
// absent — a blended USD-per-1M-tokens figure. Unknown model → null, not a guess.
const PRICE_PER_MTOK = {
  'anthropic/claude-haiku-4.5': 3.0,
  'anthropic/claude-3-haiku': 0.9,
  'anthropic/claude-sonnet-4.5': 9.0,
  // Blended and rounded UP so the fallback can never under-report: sonnet-5 is
  // $2/Mtok in and $10 out, and a verdict is ~93% input, so the true blend is
  // about 2.6.
  'anthropic/claude-sonnet-5': 3.0,
  'openai/gpt-4o-mini': 0.4,
};

export function estimateCostUsd(model, tokensUsed) {
  if (!tokensUsed) return null;
  const price = PRICE_PER_MTOK[model];
  if (price == null) return null;
  return Number(((tokensUsed / 1_000_000) * price).toFixed(6));
}
