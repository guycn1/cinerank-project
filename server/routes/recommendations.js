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
        // Calm, specific message — never a raw dump (SPEC § 3.4)
        return res.status(422).json({ error: `Couldn't generate recommendations: ${err.message}` });
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
