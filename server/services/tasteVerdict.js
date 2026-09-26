/**
 * The taste-verdict feature (SPEC § 2.3): a short plain-text read of the
 * user's taste across every rated film, logged whatever its outcome. It is the
 * one call in the app that runs off the app-wide model (D-053).
 *
 * @module server/services/tasteVerdict
 */
import { supabase } from '../supabase.js';
import { config, estimateCostUsd } from '../config.js';
import { loadPrompt } from './promptLoader.js';
import { chat, OpenRouterError } from './openrouter.js';

const PROMPT_VERSION = 'taste_verdict_v7';
const MAX_LEN = 450; // safety ceiling; the prompt asks for 2–3 sentences (~35–60 words)

/**
 * The result of one successful verdict, sent to the client as it stands.
 *
 * @typedef {object} VerdictRun
 * @property {string} verdict  Already passed through tidyVerdict().
 * @property {object} meta
 * @property {string} meta.promptVersion
 * @property {string} meta.model
 * @property {number | null} meta.tokensUsed
 * @property {number | null} meta.estimatedCostUsd
 * @property {number} meta.durationMs
 */

/**
 * Belt-and-suspenders cleanup of the model's plain-text output:
 *  - strip markdown emphasis (v1 leaked "*Saw*" into the banner)
 *  - if still over the ceiling, cut at the last sentence end, else last word —
 *    never mid-word (SPEC § 2.3: length cap, but no ugly truncation)
 *
 * @param {string} raw  The model's reply.
 * @returns {string} Whitespace collapsed and `*`, `_` and backticks removed. At
 *   most 450 characters; a cut at a word boundary ends in "…".
 */
export function tidyVerdict(raw) {
  const v = raw.replace(/\s+/g, ' ').trim().replace(/[*_`]+/g, '');
  if (v.length <= MAX_LEN) return v;
  const head = v.slice(0, MAX_LEN);
  const lastSentence = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '));
  if (lastSentence > 120) return head.slice(0, lastSentence + 1);
  const lastSpace = head.lastIndexOf(' ');
  return (lastSpace > 0 ? head.slice(0, lastSpace) : head).replace(/[,;:—-]\s*$/, '') + '…';
}

/**
 * A verdict that failed, carrying the technical cause as its message and two
 * flags that tell the route what it may show.
 */
class TasteVerdictError extends Error {
  /**
   * Same two flags, same meanings, as RecommendationError — the two features
   * must answer a failure identically or the app has two error dialects (R23,
   * D-047).
   *
   * @param {string} message  The technical cause.
   * @param {object} [flags]
   * @param {boolean} [flags.userFacing=false]  This message IS the answer, so show it verbatim. True for
   *   exactly one case: not enough rated films.
   * @param {boolean} [flags.logged=false]  A taste_verdict_logs row was written for this failure, so a
   *   UI may point at the AI call log. **The invariant: every 'failed' row that
   *   reaches the table must arrive with this true.** Below, that holds because
   *   status only ever becomes 'failed' in one place and the throw that follows
   *   the successful insert is the only exit from it.
   */
  constructor(message, { userFacing = false, logged = false } = {}) {
    super(message);
    this.name = 'TasteVerdictError';
    this.userFacing = userFacing;
    this.logged = logged;
  }
}
export { TasteVerdictError };

/**
 * Format one rated film as a line of the prompt's data block. The review is
 * untrusted input, handled as in recommendations.js: collapsed to one line, cut
 * short, and quoted in `<<` `>>` inside the prompt's BEGIN/END block, which the
 * prompt declares to be untrusted data.
 *
 * @param {{ title: string, rating: number, review: string | null }} movie
 * @returns {string} e.g. `- "Heat" — 9/10; review: <<...>>`, the review cut at
 *   200 characters.
 */
function line(movie) {
  const review = (movie.review || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  const base = `- "${movie.title}" — ${movie.rating}/10`;
  return review ? `${base}; review: <<${review}>>` : base;
}

/**
 * Generate a fresh taste verdict (SPEC § 2.3). Lowest-stakes feature in the app:
 * output is opinion, shown as plain text, never rendered as HTML, length-capped.
 * Still logged with the same discipline as recommendations (§ 5.3).
 *
 * @returns {Promise<VerdictRun>}
 * @throws {TasteVerdictError} When the DB read fails, when fewer films are
 *   rated than `config.tasteVerdict.minRatedMovies` (`userFacing`), when the
 *   log row cannot be written, or when the AI call failed after its row was
 *   committed (`logged`). Any other error propagates unchanged.
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
      `Need at least ${config.tasteVerdict.minRatedMovies} rated movies`,
      // The one cause a user can act on. No AI call was made, so nothing is
      // logged and nothing may be advertised.
      { userFacing: true }
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
    result = await chat({
      system,
      user,
      maxTokens: 180,
      temperature: 0.85,
      // The only call in the app that does not use the app-wide model (D-053).
      model: config.tasteVerdict.model,
    });
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
    // THE FALLBACK MUST BE THIS FEATURE’S MODEL, NOT THE APP-WIDE ONE. On
    // success `result.model` is whatever OpenRouter echoed back; on FAILURE
    // there is no response to read, so the row falls back to a constant — and
    // the verdict is the one call in the app that does not use the app-wide
    // model (D-053, and the `chat()` call above says so).
    // This line read `config.openrouter.model` until 2026-09-13 and was
    // therefore logging FAILED verdicts as claude-haiku-4.5 while the call
    // that actually failed was claude-sonnet-5. The identical-looking line in
    // recommendations.js is correct there; do not "unify" the two.
    model_used: result?.model ?? config.tasteVerdict.model,
    tokens_used: result?.tokensUsed ?? null,
    prompt_tokens: result?.promptTokens ?? null,
    completion_tokens: result?.completionTokens ?? null,
    duration_ms: result?.durationMs ?? Date.now() - startedAt,
    status,
    error_text: errorText,
    estimated_cost_usd: estCost,
  };
  const { error: logError } = await supabase.from('taste_verdict_logs').insert(logRow);
  // The row did NOT land, so there is nothing to advertise — `logged` stays
  // false. This is the one branch that could produce a false NEGATIVE if it were
  // reordered below the throw beneath it, so leave the order alone.
  if (logError) {
    // Identical treatment to recommendations.js, and it must stay identical —
    // R23/D-047 exist because these two drifted into separate error dialects
    // once already. Composing the causes rather than replacing one with the
    // other is R5: an AI failure here had its `errorText` destroyed by the
    // insert's message, and with no row written that cause survived nowhere.
    const cause = errorText
      ? `${logError.message} (the AI call had already failed with: ${errorText})`
      : logError.message;
    // The only sink left once the log table is unreachable. Not shown to the
    // user — the route's calm sentence stands (R8/R23).
    console.error('[cinerank] taste verdict log write failed:', cause);
    throw new TasteVerdictError(`Taste verdict log write failed: ${cause}`);
  }

  // The row is committed and its status is 'failed', so this is the ONLY exit
  // that may advertise the AI call log — and, just as importantly, the only exit
  // reachable once a failed row exists. That is what makes "a failed row is
  // always advertised" true rather than merely usually true.
  if (status === 'failed') throw new TasteVerdictError(errorText, { logged: true });

  return {
    verdict,
    meta: {
      promptVersion: version,
      model: result.model,
      tokensUsed: result.tokensUsed,
      estimatedCostUsd: estCost,
      durationMs: result.durationMs,
    },
  };
}
