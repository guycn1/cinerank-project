/**
 * The recommendation routes, mounted at /api/recommendations: trigger a run,
 * and read back the narrower per-feature history.
 *
 * @module server/routes/recommendations
 */
import { Router } from 'express';
import { supabase } from '../supabase.js';
import { generateRecommendations, RecommendationError } from '../services/recommendations.js';

/** The router server/index.js mounts at /api/recommendations. */
export const recommendationsRouter = Router();

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
 * POST /api/recommendations — trigger a run (SPEC § 2.2). Snapshot, not live:
 * only ever runs on this explicit request.
 *
 * Responds 200 with the run as generateRecommendations() returns it:
 * `{ suggestions, emptyReason, meta }`. Every RecommendationError becomes a 422
 * with `{ error }`: the service's own message when it is user-facing, otherwise
 * a fixed sentence, plus `logged: true` when a log row exists to point at.
 */
recommendationsRouter.post(
  '/',
  wrap(async (_req, res) => {
    try {
      res.json(await generateRecommendations());
    } catch (err) {
      if (err instanceof RecommendationError) {
        // This used to be `Couldn’t generate recommendations: ${err.message}`
        // under a comment claiming "never a raw dump" — which is exactly what it
        // was. The causes are internal: "OpenRouter unreachable (TimeoutError)",
        // "OpenRouter responded 401", "Model did not return valid JSON",
        // "DB read failed: <postgres text>". That names our vendor and a JS error
        // class to someone who wanted a film suggestion, and it is nothing like
        // the movie path's "Couldn’t reach the movie database. Try again in a
        // moment." (backlog R8).
        //
        // One cause survives verbatim: not enough rated films is the answer to
        // the user's question, not a fault report. It is flagged at the throw
        // site rather than pattern-matched here, so the two cannot drift.
        if (err.userFacing) return res.status(422).json({ error: err.message });

        // Everything else: a calm sentence, and the technical cause goes only to
        // the log row's error_text. `logged` is ADDITIVE metadata in the D-042
        // sense — it says whether a recommendation_logs row exists for this
        // failure, so the client can offer the AI call log WITHOUT ever promising
        // a row that was never written (R9). A failed DB read, an unmet threshold
        // and a failed log write all produce no row.
        return err.logged
          ? res.status(422).json({
              error: 'Couldn’t generate recommendations right now.',
              logged: true,
            })
          : res.status(422).json({
              error: 'Couldn’t generate recommendations right now. Try again in a moment.',
            });
      }
      throw err;
    }
  })
);

/**
 * GET /api/recommendations/history — the NARROWER per-feature log view
 * (SPEC § 4.5). Not the primary audit surface: GET /api/ai-log is, and it is the
 * only one the UI calls. This returns recommendation runs only, 25 of them,
 * with seven of ai-log's twelve columns. Kept deliberately rather than deleted
 * (D-017, confirmed D-077); its two tests are in test/routes.test.js, which is
 * what closed the gap that kept making it a deletion candidate.
 *
 * Responds 200 with `{ history }`, newest first. A database error reaches the
 * central handler as a 500.
 */
recommendationsRouter.get(
  '/history',
  wrap(async (_req, res) => {
    const { data, error } = await supabase
      .from('recommendation_logs')
      .select('id, created_at, prompt_version, model_used, tokens_used, estimated_cost_usd, suggested_titles')
      .order('created_at', { ascending: false })
      .limit(25);
    if (error) throw new Error(error.message);
    res.json({ history: data });
  })
);
