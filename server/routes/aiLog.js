import { Router } from 'express';
import { supabase } from '../supabase.js';

export const aiLogRouter = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// GET /api/ai-log — the full audit trail of every AI call, both features merged,
// newest first. Powers the in-app "AI call log" viewer. Read-only.
aiLogRouter.get(
  '/',
  wrap(async (_req, res) => {
    const [recs, verdicts] = await Promise.all([
      supabase
        .from('recommendation_logs')
        .select(
          'id, created_at, prompt_version, model_used, tokens_used, prompt_tokens, completion_tokens, duration_ms, status, error_text, estimated_cost_usd, suggested_titles'
        )
        .order('created_at', { ascending: false })
        .limit(60),
      supabase
        .from('taste_verdict_logs')
        .select(
          'id, created_at, prompt_version, model_used, tokens_used, prompt_tokens, completion_tokens, duration_ms, status, error_text, estimated_cost_usd, verdict_text'
        )
        .order('created_at', { ascending: false })
        .limit(60),
    ]);
    if (recs.error) throw new Error(recs.error.message);
    if (verdicts.error) throw new Error(verdicts.error.message);

    // The "Result" cell has exactly three shapes, so send it structured and let
    // the frontend render/reveal it: a recommendation's verified title list, a
    // verdict's text, or (either feature) the error message on a failed call.
    const norm = (row, feature, extra) => ({
      id: row.id,
      feature,
      created_at: row.created_at,
      prompt_version: row.prompt_version,
      model_used: row.model_used,
      tokens_used: row.tokens_used,
      prompt_tokens: row.prompt_tokens,
      completion_tokens: row.completion_tokens,
      duration_ms: row.duration_ms,
      status: row.status,
      estimated_cost_usd: row.estimated_cost_usd,
      error_text: row.status === 'failed' ? row.error_text || 'failed' : null,
      ...extra,
    });

    const rows = [
      ...(recs.data || []).map((r) =>
        norm(r, 'Recommendation', { suggested_titles: r.suggested_titles || [] })
      ),
      ...(verdicts.data || []).map((v) =>
        norm(v, 'Taste verdict', { verdict_text: v.verdict_text || null })
      ),
    ]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 60);

    const totals = rows.reduce(
      (acc, r) => ({
        calls: acc.calls + 1,
        tokens: acc.tokens + (r.tokens_used || 0),
        cost: acc.cost + (r.estimated_cost_usd || 0),
      }),
      { calls: 0, tokens: 0, cost: 0 }
    );
    totals.cost = Number(totals.cost.toFixed(6));

    res.json({ rows, totals });
  })
);
