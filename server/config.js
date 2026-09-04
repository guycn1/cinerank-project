import 'dotenv/config';

// Secrets live only in .env (CLAUDE.md § Security & Secrets #1). This module is the
// single place they enter the process; nothing else reads process.env directly.

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
    model: process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5',
  },

  // Recommendation tuning (SPEC § 2.2)
  recommendations: {
    minRatedMovies: 3,
    topN: 5,
  },
  tasteVerdict: {
    minRatedMovies: 2,
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
  'openai/gpt-4o-mini': 0.4,
};

export function estimateCostUsd(model, tokensUsed) {
  if (!tokensUsed) return null;
  const price = PRICE_PER_MTOK[model];
  if (price == null) return null;
  return Number(((tokensUsed / 1_000_000) * price).toFixed(6));
}
