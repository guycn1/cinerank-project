/**
 * Low-level OpenRouter transport only. Feature logic (which prompt, how to parse,
 * what to log) stays in recommendations.js / tasteVerdict.js so either feature can
 * be mocked or stripped without touching the other or the core CRUD
 * (CLAUDE.md § Coding Conventions).
 *
 * @module server/services/openrouter
 */
import { config } from '../config.js';

/**
 * Any failure to get a usable reply out of OpenRouter. The message is
 * technical and log-only: the routes replace it with a calm sentence before a
 * user sees anything (R8, D-047).
 */
class OpenRouterError extends Error {
  /**
   * @param {string} message  The technical cause, e.g. "OpenRouter responded 401".
   */
  constructor(message) {
    super(message);
    this.name = 'OpenRouterError';
  }
}
export { OpenRouterError };

/**
 * What one successful call returns. Every usage figure is null when
 * OpenRouter's response leaves it out.
 *
 * @typedef {object} ChatResult
 * @property {string} text  The model's reply, trimmed. Never empty.
 * @property {number | null} tokensUsed  Prompt plus completion tokens.
 * @property {number | null} promptTokens
 * @property {number | null} completionTokens
 * @property {number | null} costUsd  OpenRouter's exact `usage.cost`, to six
 *   decimals. Null sends the caller to the estimate table in config.js.
 * @property {string} model  The model OpenRouter reports having run, else the
 *   app-wide default.
 * @property {number} durationMs  Wall-clock time of the request, measured here.
 */

/**
 * One OpenRouter call. `model` defaults to the app-wide model and is overridden
 * per FEATURE, not per call site whim — see config.tasteVerdict.model and D-053.
 *
 * @param {object} request
 * @param {string} request.system  The system prompt.
 * @param {string} request.user  The user message.
 * @param {number} [request.maxTokens=500]
 * @param {number} [request.temperature=0.7]
 * @param {string} [request.model]  Defaults to `config.openrouter.model`.
 * @returns {Promise<ChatResult>}
 * @throws {OpenRouterError} When OpenRouter is unreachable or the 20s timeout
 *   fires, when it answers with a non-2xx status, or when the reply has no content.
 */
export async function chat({ system, user, maxTokens = 500, temperature = 0.7, model = config.openrouter.model }) {
  const startedAt = Date.now();
  let res;
  try {
    res = await fetch(config.openrouter.base, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openrouter.apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'CineRank',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        // Ask OpenRouter to return the exact USD cost of this call in usage.cost.
        usage: { include: true },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    // `err.cause.code` first, because `err.name` is almost always the useless
    // answer here: every connection-level failure in Node's fetch surfaces as
    // TypeError("fetch failed") and puts the real reason — ECONNREFUSED,
    // ENOTFOUND, UND_ERR_CONNECT_TIMEOUT — on `cause`. The user hit exactly this
    // while testing a bogus key: a 401 and an "unreachable (TypeError)" appeared
    // in the same log, and only the 401 had anything to do with the key.
    // Falls back to `name`, which is what the 20s cap above produces: an
    // AbortSignal.timeout aborts with a TimeoutError and no `cause` (both
    // verified against this Node build, not assumed).
    // Log-only either way — the route replaces all of this with a calm sentence
    // before the user sees it (R8, D-047).
    throw new OpenRouterError(`OpenRouter unreachable (${err.cause?.code ?? err.name})`);
  }

  if (!res.ok) {
    throw new OpenRouterError(`OpenRouter responded ${res.status}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new OpenRouterError('OpenRouter returned no content');

  const usage = data?.usage || {};
  return {
    text,
    tokensUsed: usage.total_tokens ?? null,
    promptTokens: usage.prompt_tokens ?? null,
    completionTokens: usage.completion_tokens ?? null,
    // Exact cost from OpenRouter when present; null → caller falls back to the
    // per-model estimate table in config.js.
    costUsd: typeof usage.cost === 'number' ? Number(usage.cost.toFixed(6)) : null,
    model: data?.model || config.openrouter.model,
    durationMs: Date.now() - startedAt,
  };
}
