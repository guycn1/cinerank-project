# Decision log — the *why*

Started at project conception, not bolted on afterwards (course Module 8: the
reasons behind a choice are clearest at the moment it's made, and the agent can't
recover them later). Newest first.

---

## D-012 · Recommendation reason length → `recommend_v3`
v2 reasons ran 25–30 words and got clamped in the card ("…delivers that same…").
Two-sided fix: v3 prompt tightens to one short sentence, 8–16 words, no
clause-splicing dashes/semicolons; `tidyReason()` in the service strips markdown
and truncates at a sentence/word boundary past a 130-char ceiling; and the card
`.reason` clamp goes 3 → 5 lines so a compliant reason never clips. New prompt
file; v1/v2 untouched.

## D-011 · Taste verdict truncation + markdown → `taste_verdict_v2`
v1 output was hard-sliced at 240 chars, cutting mid-word ("…over c"), and the
model leaked markdown emphasis (`*Saw*`) that the plain-text banner rendered
literally. v2 prompt: explicit "finish the sentence", ban asterisks/markdown/
title-quotes, target ~260 chars. Service: `tidyVerdict()` strips `* _ \``, and
if still over a 300-char ceiling truncates at the last sentence end (else last
word + "…"), never mid-word. `max_tokens` 120 → 160 for headroom. New prompt
file; `taste_verdict_v1.md` untouched.

## D-010 · In-app AI call log + failure logging (migration 001)
Added `GET /api/ai-log` (both log tables merged, newest first, with totals) and a
wide modal viewer reachable from a footer link — so the audit trail can be shown
in the browser during the demo, not only in the Supabase table editor (SPEC § 7.2
step 4). Migration 001 adds `prompt_tokens`, `completion_tokens`, `duration_ms`,
`status`, `error_text` to both tables. The services were restructured so that once
an AI call is attempted a row is **always** written — a handled model/parse/network
failure logs `status='failed'` with the message, then re-throws for the calm inline
UI error. Pre-call guards (not enough rated movies, DB read failure) still throw
without logging — those aren't AI calls.

## D-009 · Recommendation reason voice → `recommend_v2`
The v1 reason read like a plot blurb ("A crime thriller about a bank robbery").
v2 asks for a second-person line tied to the user's own ratings/reviews
("You rated Whiplash a 10 — this has the same slow-burn dread"). Logic change, so
a new prompt file per CLAUDE.md § Prompt Versioning; `recommend_v1.md` is kept
untouched and every past `recommendation_logs` row still names the exact prompt
that produced it. `taste_verdict_v1` is unaffected — versioned independently.

## D-001 · Scope: single-user, no auth — and why that isn't a security hole
The app is one person's movie list. Module 17's real topics — injection, secrets,
prompt injection, least privilege — are all demonstrable without multi-user auth.
Least privilege here = the frontend/back-end use the Supabase **anon key**, which
is RLS-bounded, never the `service_role` key. Adding accounts would be
manufacturing a demo the app doesn't need.

## D-002 · The AI is a component, not the product
Two narrow LLM features (recommendations, taste verdict), each in its own service
module, each with its own versioned prompt file. Either can be mocked or removed
without touching movie CRUD. The model never supplies a fact shown to the user:
recommendations return *titles only*, and TMDB supplies poster/year/overview after
a cross-check. This is the concrete guard against hallucinated movies.

## D-003 · Cost logging is structural, not decorative
`recommendation_logs` and `taste_verdict_logs` store `tokens_used` and
`estimated_cost_usd` per call. `config.estimateCostUsd` uses a small per-model
price table; unknown models log `null` rather than a wild guess. A log-write
failure is surfaced as an error, not swallowed — the audit record is the point.

## D-004 · Model choice: cheap by default
`anthropic/claude-3.5-haiku` via OpenRouter. The tasks are small (pick 3–6 titles;
write one teasing sentence). Module 9: match the model to the task's difficulty;
the biggest cost lever is model choice. Overridable via `OPENROUTER_MODEL`.

## D-005 · Prompt-injection posture
Review text is untrusted user input flowing into both prompts. Mitigations, in
layers: (1) the text is length-capped and wrapped in explicit BEGIN/END data
markers; (2) each prompt tells the model the block is data and to ignore embedded
instructions; (3) recommendation output is constrained to a JSON array and every
title is TMDB-verified, so a partial injection yields at worst a strange
suggestion; (4) the verdict is length-capped server-side and rendered as
`textContent`, so at worst it's an off-tone banner line.

## D-006 · Frontend: vanilla, but not plain
No framework. The "polished, distinctive" bar (SPEC § 3) is met with deliberate
choices: poster as the anchor of every card, Fraunces display numerals for rank,
a marquee-amber accent on near-black, film grain, motion on hover/entry, a
gradient-sheen verdict banner. AI-suggested cards reuse the card language but
carry a quiet "AI pick · not yet rated" marker (SPEC § 3.3).

## D-007 · Ranking is derived, never stored
`GET /api/movies` returns movies ordered by `rating desc nulls last`; the
frontend numbers them 1..N on render. No stale `rank` column (SPEC § 2.1).

## D-008 · Taste verdict never auto-runs
The banner shows a threshold message or a "tap for a verdict" prompt on load, and
only calls OpenRouter on the explicit "New verdict" click — no burning credit on
an unrequested repeat call every page load (SPEC § 2.3).
