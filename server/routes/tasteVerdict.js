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
        return res.status(422).json({ error: err.message });
      }
      throw err;
    }
  })
);
