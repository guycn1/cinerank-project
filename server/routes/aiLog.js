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

    // `detailed` / `timed` count how many calls actually carry a token split
    // and a duration, so a caller can tell whether the sums below cover every
    // row or only some of them.
    //
    // TWO THINGS THIS COMMENT USED TO GET WRONG, both corrected here rather than
    // left, because it described behaviour that does not exist:
    //   1. It said "the viewer says so". It does not. `renderLogTotals()` in
    //      public/app.js deliberately does NOT surface either count — see D-018
    //      — it only uses `detailed` as a truthiness test for whether to draw the
    //      in/out sub-line at all, and `timed` the same way for the duration.
    //   2. It said rows written before migration 001 "have neither", present
    //      tense. Those six rows were deleted by hand once, for presentation
    //      (D-019), so no row in the table is missing a split or a duration
    //      today and neither count can currently come back short.
    // Both fields are kept anyway: they cost nothing, and they are what stops a
    // future partial-coverage row from silently showing an in/out split that
    // does not add up to the token total.
    const totals = rows.reduce(
      (acc, r) => {
        acc.calls += 1;
        acc.tokens += r.tokens_used || 0;
        acc.cost += r.estimated_cost_usd || 0;
        if (r.prompt_tokens != null || r.completion_tokens != null) {
          acc.promptTokens += r.prompt_tokens || 0;
          acc.completionTokens += r.completion_tokens || 0;
          acc.detailed += 1;
        }
        if (r.duration_ms != null) {
          acc.durationMs += r.duration_ms;
          acc.timed += 1;
        }
        return acc;
      },
      {
        calls: 0, tokens: 0, cost: 0,
        promptTokens: 0, completionTokens: 0, detailed: 0,
        durationMs: 0, timed: 0,
      }
    );
    totals.cost = Number(totals.cost.toFixed(6));

    res.json({ rows, totals });
  })
);
