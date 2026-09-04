import { config } from '../config.js';

// Low-level OpenRouter transport only. Feature logic (which prompt, how to parse,
// what to log) stays in recommendations.js / tasteVerdict.js so either feature can
// be mocked or stripped without touching the other or the core CRUD
// (CLAUDE.md § Coding Conventions).

class OpenRouterError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OpenRouterError';
  }
}
export { OpenRouterError };

/**
 * @returns {{ text, tokensUsed, promptTokens, completionTokens, costUsd, model, durationMs }}
 */
export async function chat({ system, user, maxTokens = 500, temperature = 0.7 }) {
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
        model: config.openrouter.model,
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
    throw new OpenRouterError(`OpenRouter unreachable (${err.name})`);
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
