import { Router } from 'express';
import { supabase } from '../supabase.js';
import { generateRecommendations, RecommendationError } from '../services/recommendations.js';

export const recommendationsRouter = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// POST /api/recommendations — trigger a run (SPEC § 2.2). Snapshot, not live:
// only ever runs on this explicit request.
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

// GET /api/recommendations/history — the audit trail, surfaced (SPEC § 4.5)
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
