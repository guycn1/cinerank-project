import { supabase } from '../supabase.js';
import { config, estimateCostUsd } from '../config.js';
import { loadPrompt } from './promptLoader.js';
import { chat, OpenRouterError } from './openrouter.js';
import { verifyTitle } from './tmdb.js';

const PROMPT_VERSION = 'recommend_v3';
const REASON_MAX = 130; // safety ceiling; the prompt asks for 8–16 words

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

export function parseModelJson(text) {
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
    .map((x) => ({ title: x.title.trim(), reason: tidyReason(x.reason) }))
    .slice(0, 6);
}

// Belt-and-suspenders: strip markdown, and if the model overshoots the word
// budget cut at the last sentence end (else last word), never mid-word.
export function tidyReason(raw) {
  let r = raw.replace(/\s+/g, ' ').trim().replace(/[*_`]+/g, '');
  if (r.length <= REASON_MAX) return r;
  const head = r.slice(0, REASON_MAX);
  const dot = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '));
  if (dot > 40) return head.slice(0, dot + 1);
  const space = head.lastIndexOf(' ');
  return (space > 0 ? head.slice(0, space) : head).replace(/[,;:—-]\s*$/, '') + '…';
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

  // From here on an AI call happens, so a row is ALWAYS written — success or a
  // handled model/parse failure. Failures matter in the audit trail as much as
  // successes (Module 13: make a failure visible, never a silent result).
  const startedAt = Date.now();
  let result = null;
  let picks = [];
  const verified = [];
  let status = 'success';
  let errorText = null;

  try {
    result = await chat({ system, user, maxTokens: 600, temperature: 0.8 });
    picks = parseModelJson(result.text);

    // Cross-check every title against TMDB; TMDB supplies all facts (SPEC § 2.2
    // #4). Unverifiable or already-owned titles are silently dropped (§ 2.2 #5).
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
  } catch (err) {
    if (err instanceof OpenRouterError || err instanceof RecommendationError) {
      status = 'failed';
      errorText = err.message;
    } else {
      throw err; // unexpected — don't swallow
    }
  }

  const estCost = result
    ? result.costUsd ?? estimateCostUsd(result.model, result.tokensUsed)
    : null;

  const logRow = {
    prompt_version: version,
    input_movie_ids: topN.map((m) => m.id),
    raw_model_output: result ? { text: result.text, parsed: picks } : null,
    suggested_titles: verified.map((v) => v.title),
    model_used: result?.model ?? config.openrouter.model,
    tokens_used: result?.tokensUsed ?? null,
    prompt_tokens: result?.promptTokens ?? null,
    completion_tokens: result?.completionTokens ?? null,
    duration_ms: result?.durationMs ?? Date.now() - startedAt,
    status,
    error_text: errorText,
    estimated_cost_usd: estCost,
  };
  const { error: logError } = await supabase.from('recommendation_logs').insert(logRow);
  if (logError) {
    // Logging is a hard requirement — surface the failure rather than hide it.
    throw new RecommendationError(`Recommendation log write failed: ${logError.message}`);
  }

  if (status === 'failed') throw new RecommendationError(errorText);

  return {
    suggestions: verified,
    meta: {
      promptVersion: version,
      model: result.model,
      tokensUsed: result.tokensUsed,
      estimatedCostUsd: estCost,
      basedOn: topN.map((m) => m.title),
    },
  };
}
