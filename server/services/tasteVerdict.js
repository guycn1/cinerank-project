import { supabase } from '../supabase.js';
import { config, estimateCostUsd } from '../config.js';
import { loadPrompt } from './promptLoader.js';
import { chat, OpenRouterError } from './openrouter.js';

const PROMPT_VERSION = 'taste_verdict_v3';
const MAX_LEN = 350; // safety ceiling; the prompt asks for one 20–30 word sentence (~200 chars)

// Belt-and-suspenders cleanup of the model's plain-text output:
//  - strip markdown emphasis (v1 leaked "*Saw*" into the banner)
//  - if still over the ceiling, cut at the last sentence end, else last word —
//    never mid-word (SPEC § 2.3: length cap, but no ugly truncation)
function tidyVerdict(raw) {
  let v = raw.replace(/\s+/g, ' ').trim().replace(/[*_`]+/g, '');
  if (v.length <= MAX_LEN) return v;
  const head = v.slice(0, MAX_LEN);
  const lastSentence = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '));
  if (lastSentence > 120) return head.slice(0, lastSentence + 1);
  const lastSpace = head.lastIndexOf(' ');
  return (lastSpace > 0 ? head.slice(0, lastSpace) : head).replace(/[,;:—-]\s*$/, '') + '…';
}

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

  // An AI call happens now, so a row is ALWAYS written — success or failure.
  const startedAt = Date.now();
  let result = null;
  let verdict = null;
  let status = 'success';
  let errorText = null;

  try {
    result = await chat({ system, user, maxTokens: 100, temperature: 0.85 });
    // Plain text only — the frontend renders this via textContent, never innerHTML.
    verdict = tidyVerdict(result.text);
  } catch (err) {
    if (err instanceof OpenRouterError) {
      status = 'failed';
      errorText = err.message;
    } else {
      throw err;
    }
  }

  const estCost = result
    ? result.costUsd ?? estimateCostUsd(result.model, result.tokensUsed)
    : null;

  const logRow = {
    prompt_version: version,
    input_movie_ids: rated.map((m) => m.id),
    verdict_text: verdict,
    model_used: result?.model ?? config.openrouter.model,
    tokens_used: result?.tokensUsed ?? null,
    prompt_tokens: result?.promptTokens ?? null,
    completion_tokens: result?.completionTokens ?? null,
    duration_ms: result?.durationMs ?? Date.now() - startedAt,
    status,
    error_text: errorText,
    estimated_cost_usd: estCost,
  };
  const { error: logError } = await supabase.from('taste_verdict_logs').insert(logRow);
  if (logError) throw new TasteVerdictError(`Taste verdict log write failed: ${logError.message}`);

  if (status === 'failed') throw new TasteVerdictError(errorText);

  return {
    verdict,
    meta: {
      promptVersion: version,
      model: result.model,
      tokensUsed: result.tokensUsed,
      estimatedCostUsd: estCost,
    },
  };
}
