import { Router } from 'express';
import { generateTasteVerdict, TasteVerdictError } from '../services/tasteVerdict.js';

export const tasteVerdictRouter = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// POST /api/taste-verdict — generate a fresh banner line (SPEC § 2.3).
// Only ever on explicit user action; never regenerated on page load.
tasteVerdictRouter.post(
  '/',
  wrap(async (_req, res) => {
    try {
      res.json(await generateTasteVerdict());
    } catch (err) {
      if (err instanceof TasteVerdictError) {
        // Quiet fallback — the banner is the lowest-stakes feature and must
        // never block the Home page (SPEC § 2.3, § 2.4).
        //
        // Shaped exactly like the recommendations route (R8/R9, D-047), because
        // the client used to ignore this message entirely and print its own fixed
        // fallback — which offered the AI call log for EVERY failure, including
        // CineRank being unreachable, where the log cannot load either (R23).
        // The message is now real and the offer is conditional.
        if (err.userFacing) return res.status(422).json({ error: err.message });
        return err.logged
          ? res.status(422).json({
              error: 'Couldn’t come up with a verdict right now.',
              logged: true,
            })
          : res.status(422).json({
              error: 'Couldn’t come up with a verdict right now. Try again in a moment.',
            });
      }
      throw err;
    }
  })
);
