import { supabase } from '../supabase.js';
import { config, estimateCostUsd } from '../config.js';
import { loadPrompt } from './promptLoader.js';
import { chat, OpenRouterError } from './openrouter.js';
import { verifyTitle } from './tmdb.js';

const PROMPT_VERSION = 'recommend_v2';

class RecommendationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RecommendationError';
  }
}
export { RecommendationError };

// Review text is untrusted user input flowing into the prompt (CLAUDE.md
// § Prompt Injection). We cap length and keep it clearly inside the data block;
// the prompt itself instructs the model to treat the block as data only. Even if
// injection partly succeeds, the blast radius is "a weird title" — every title is
// then verified against TMDB before the user ever sees it.
function line(movie) {
  const review = (movie.review || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  const base = `- "${movie.title}" (${movie.year ?? 'n/a'}) — rated ${movie.rating}/10`;
  return review ? `${base}; review: <<${review}>>` : base;
}

function parseModelJson(text) {
  // Structured output only — no regex-parsing of prose (SPEC § 6). We tolerate a
  // markdown code fence but nothing looser than that.
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let arr;
  try {
    arr = JSON.parse(cleaned);
  } catch {
    throw new RecommendationError('Model did not return valid JSON');
  }
  if (!Array.isArray(arr)) throw new RecommendationError('Model JSON was not an array');
  return arr
    .filter((x) => x && typeof x.title === 'string' && typeof x.reason === 'string')
    .map((x) => ({ title: x.title.trim(), reason: x.reason.trim() }))
    .slice(0, 6);
}

/**
 * Run one recommendation pass. Always writes a row to recommendation_logs
 * (SPEC § 2.2) — the audit record is the point, not a nice-to-have.
 */
export async function generateRecommendations() {
  const { data: rated, error } = await supabase
    .from('movies')
    .select('id, tmdb_id, title, year, rating, review')
    .not('rating', 'is', null)
    .order('rating', { ascending: false });

  if (error) throw new RecommendationError(`DB read failed: ${error.message}`);
  if (!rated || rated.length < config.recommendations.minRatedMovies) {
    throw new RecommendationError(
      `Need at least ${config.recommendations.minRatedMovies} rated movies`
    );
  }

  const topN = rated.slice(0, config.recommendations.topN);
  const ownedTmdbIds = new Set(rated.map((m) => m.tmdb_id));

  const { system, user, version } = await loadPrompt(PROMPT_VERSION, {
    TASTE_PROFILE: topN.map(line).join('\n'),
  });

  let result;
  try {
    result = await chat({ system, user, maxTokens: 600, temperature: 0.8 });
  } catch (err) {
    if (err instanceof OpenRouterError) throw new RecommendationError(err.message);
    throw err;
  }

  const picks = parseModelJson(result.text);

  // Cross-check every title against TMDB; TMDB supplies all facts (SPEC § 2.2 #4).
  // Unverifiable or already-owned titles are silently dropped (§ 2.2 #5).
  const verified = [];
  for (const pick of picks) {
    let movie;
    try {
      movie = await verifyTitle(pick.title);
    } catch {
      movie = null; // TMDB hiccup on one lookup shouldn't kill the whole run
    }
    if (!movie) continue;
    if (ownedTmdbIds.has(movie.tmdb_id)) continue;
    if (verified.some((v) => v.tmdb_id === movie.tmdb_id)) continue;
    verified.push({ ...movie, reason: pick.reason });
  }

  const logRow = {
    prompt_version: version,
    input_movie_ids: topN.map((m) => m.id),
    raw_model_output: { text: result.text, parsed: picks },
    suggested_titles: verified.map((v) => v.title),
    model_used: result.model,
    tokens_used: result.tokensUsed,
    estimated_cost_usd: result.costUsd ?? estimateCostUsd(result.model, result.tokensUsed),
  };
  const { error: logError } = await supabase.from('recommendation_logs').insert(logRow);
  if (logError) {
    // Logging is a hard requirement — surface the failure rather than hide it.
    throw new RecommendationError(`Recommendation log write failed: ${logError.message}`);
  }

  return {
    suggestions: verified,
    meta: {
      promptVersion: version,
      model: result.model,
      tokensUsed: result.tokensUsed,
      estimatedCostUsd: logRow.estimated_cost_usd,
      basedOn: topN.map((m) => m.title),
    },
  };
}
