/**
 * The AI call log route, mounted at /api/ai-log: both features' log tables
 * merged into one list for the in-app viewer.
 *
 * @module server/routes/aiLog
 */
import { Router } from 'express';
import { supabase } from '../supabase.js';

/**
 * One AI call as the viewer receives it: the columns both log tables share,
 * plus the one feature-specific field that fills the Result cell.
 *
 * @typedef {object} AiLogRow
 * @property {string} id
 * @property {'Recommendation' | 'Taste verdict'} feature
 * @property {string} created_at  ISO timestamp.
 * @property {string} prompt_version
 * @property {string | null} model_used
 * @property {number | null} tokens_used
 * @property {number | null} prompt_tokens
 * @property {number | null} completion_tokens
 * @property {number | null} duration_ms
 * @property {'success' | 'failed'} status
 * @property {number | null} estimated_cost_usd
 * @property {string | null} error_text  Set only on a failed call, falling back
 *   to "failed" when the row has no text.
 * @property {string[]} [suggested_titles]  Recommendation rows only.
 * @property {string | null} [verdict_text]  Taste-verdict rows only.
 */

/** The router server/index.js mounts at /api/ai-log. */
export const aiLogRouter = Router();

/**
 * Let an async handler fail properly under Express 4, which does not await a
 * handler: a rejected promise is passed to `next()`, so it reaches the central
 * error handler in server/index.js.
 *
 * @param {import('express').RequestHandler} fn  An async route handler.
 * @returns {import('express').RequestHandler}
 */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * GET /api/ai-log — the audit trail of AI calls, both features merged, newest
 * first, and capped at the newest 60 (THE 60-ROW CAP, below). Powers the in-app
 * "AI call log" viewer. Read-only.
 *
 * Responds 200 with `{ rows: AiLogRow[], totals }`, where `totals` sums the
 * rows returned: `calls`, `tokens`, `cost`, `promptTokens`, `completionTokens`,
 * `durationMs`, and the `detailed` and `timed` counts explained below. A
 * database error on either table reaches the central handler as a 500.
 */
aiLogRouter.get(
  '/',
  wrap(async (_req, res) => {
    // THE 60-ROW CAP: `.limit(60)` on each table, then `.slice(0, 60)` on the
    // merged set below, and `totals` reduces over THAT — so the footer sums the
    // 60 calls shown, not every call ever made. Once the tables hold more than
    // 60 rows between them the count pins at 60 and each new call pushes the
    // oldest out of the window.
    //
    // It arrived undeliberated in b3e3446 (2026-09-04) with the viewer itself,
    // and is KEPT: it bounds a payload and a client-side render that would
    // otherwise grow without limit, SPEC.md documents the endpoint as "newest
    // 60", and D-019 reasons from the window existing when it justified
    // deleting the six pre-migration rows rather than building permanent
    // partial-coverage markers.
    //
    // What was WRONG for the whole life of the feature was the UI copy, not
    // this: the dialog said "Every OpenRouter call CineRank has made" and the
    // footer panel said "Every OpenRouter call", both of which stopped being
    // true the moment the cap bit. Fixed 2026-09-13 (D-069) — the viewer now
    // says 60 and moves the every-call claim onto persistence, which is where
    // it is actually true. If this number ever changes, those two strings in
    // public/index.html and the SPEC line change with it.
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

    /**
     * The "Result" cell has exactly three shapes, so send it structured and let
     * the frontend render/reveal it: a recommendation's verified title list, a
     * verdict's text, or (either feature) the error message on a failed call.
     *
     * @param {object} row  One row from either log table.
     * @param {AiLogRow['feature']} feature  The label the viewer shows.
     * @param {{ suggested_titles: string[] } | { verdict_text: string | null }} extra
     *   The table's own Result field.
     * @returns {AiLogRow}
     */
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
