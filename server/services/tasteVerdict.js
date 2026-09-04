import { supabase } from '../supabase.js';
import { config, estimateCostUsd } from '../config.js';
import { loadPrompt } from './promptLoader.js';
import { chat, OpenRouterError } from './openrouter.js';

const PROMPT_VERSION = 'taste_verdict_v1';
const MAX_LEN = 240; // matches the hard cap stated in the prompt (SPEC § 6)

class TasteVerdictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TasteVerdictError';
  }
}
export { TasteVerdictError };

function line(movie) {
  const review = (movie.review || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  const base = `- "${movie.title}" — ${movie.rating}/10`;
  return review ? `${base}; review: <<${review}>>` : base;
}

/**
 * Generate a fresh taste verdict (SPEC § 2.3). Lowest-stakes feature in the app:
 * output is opinion, shown as plain text, never rendered as HTML, length-capped.
 * Still logged with the same discipline as recommendations (§ 5.3).
 */
export async function generateTasteVerdict() {
  const { data: rated, error } = await supabase
    .from('movies')
    .select('id, title, rating, review')
    .not('rating', 'is', null)
    .order('rating', { ascending: false });

  if (error) throw new TasteVerdictError(`DB read failed: ${error.message}`);
  if (!rated || rated.length < config.tasteVerdict.minRatedMovies) {
    throw new TasteVerdictError(
      `Need at least ${config.tasteVerdict.minRatedMovies} rated movies`
    );
  }

  const { system, user, version } = await loadPrompt(PROMPT_VERSION, {
    RATED_MOVIES: rated.map(line).join('\n'),
  });

  let result;
  try {
    result = await chat({ system, user, maxTokens: 120, temperature: 0.9 });
  } catch (err) {
    if (err instanceof OpenRouterError) throw new TasteVerdictError(err.message);
    throw err;
  }

  // Enforce the length cap even if the model ignores it. Plain text only — the
  // frontend renders this via textContent, never innerHTML.
  const verdict = result.text.replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);

  const logRow = {
    prompt_version: version,
    input_movie_ids: rated.map((m) => m.id),
    verdict_text: verdict,
    model_used: result.model,
    tokens_used: result.tokensUsed,
    estimated_cost_usd: result.costUsd ?? estimateCostUsd(result.model, result.tokensUsed),
  };
  const { error: logError } = await supabase.from('taste_verdict_logs').insert(logRow);
  if (logError) throw new TasteVerdictError(`Taste verdict log write failed: ${logError.message}`);

  return {
    verdict,
    meta: {
      promptVersion: version,
      model: result.model,
      tokensUsed: result.tokensUsed,
      estimatedCostUsd: logRow.estimated_cost_usd,
    },
  };
}
