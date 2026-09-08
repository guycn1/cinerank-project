# How CineRank was built — the LLM-augmented workflow

This is the *process* companion to `docs/DECISIONS.md` (which records the *why*
behind each technical choice). The course is about practising software
development with an LLM in the loop, so this file is a first-class deliverable,
not an afterthought.

**Authors:** Guy Cohen & Michael Chernyak · **Course:** LLM-Augmented Software
Practice (ASE-26)

---

## 1. Working method

The app was built in a pair-with-an-agent loop: a human sets the goal and the
acceptance bar, the agent drafts code and prompts, the human reviews every diff
and runs the app, and each checkpoint is committed with a message that explains
the reasoning. Rules that keep this honest live in `CLAUDE.md`:

- **Everything on `draft`; `main` only at a settled milestone, only with explicit
  human sign-off.** Ten merges to `main` so far (verify with
  `git log --merges --oneline main`), each a deliberate decision.
- **Secrets never enter code.** `.env` gitignored from commit 1; a pre-commit
  `npm run scan-secrets` scans the staged diff for key-shaped strings. The same
  rule shaped the deploy: `render.yaml` declares the four secrets as
  `sync: false`, so Render prompts for them in its dashboard and no value ever
  enters the committed file.
- **Dependency advisories get diagnosed, not force-fixed.** The first Render
  build reported three moderate advisories in `qs`, Express's query-string
  parser. `npm audit fix` did nothing — and neither did `--force`, which is the
  point where it would have been easy to either shrug or reach for a major
  upgrade. The actual cause was that Express 4 pins `qs` to *exactly* the
  vulnerable `6.15.3`, leaving npm no semver room, so the only move it could see
  was Express 5 and its breaking changes. An `overrides` entry lifting `qs` to
  the patched `6.16.0` — a minor bump — cleared all three, with the route tests
  covering exactly the surface involved (query strings, JSON bodies). Recorded in
  `package.json` next to the override, because an unexplained override is the
  kind of thing a later reader deletes.
- **Every commit says why**, and design decisions go to the top of
  `docs/DECISIONS.md` (newest first) at the moment they're made (Module 8: the
  reasons are clearest then and can't be reconstructed later). Entries record the
  alternatives rejected, the human pushback that changed the outcome, and the
  times the agent was wrong — a log of only wins is not evidence of process.

The UI polish phase leans hard on this loop. The AI call log dialog alone took
~100 small commits — the human runs the app, screenshots what looks off (a
border that doesn't line up mid-scroll, a caret nub, a scrollbar-coloured line
mistaken for a stray scrollbar), the agent explains the cause and fixes it, the
human re-checks. Several rounds caught regressions the agent introduced
(specificity conflicts leaking a desktop rule into the mobile card view, a
`::details-content` stacking-context trap). The screenshot-in / explanation-out
rhythm *is* the method for visual work — prose specs can't anticipate these.

## 2. Prompt engineering as version control

Neither AI feature's prompt is inlined in code — each is a numbered file under
`prompts/`, never overwritten, and every log row records which version produced
it. The iteration history *is* the evidence of prompt engineering:

| Feature | Versions | What each change fixed |
|---|---|---|
| Recommendations | `recommend_v1` → `v2` → `v3` | v1 read like a plot blurb → v2 second-person voice tied to the user's own ratings → v3 tightened to one 8–16-word sentence after reasons kept getting clamped in the card |
| Taste verdict | `taste_verdict_v1` → `v2` → `v3` → `v4` | v1 cut mid-word and leaked `*markdown*` → v2 "finish the sentence, no markdown" → v3 over-corrected to one terse line that just parroted the numbers → v4 gave room back (2–3 sentences) and redirected it to *characterise the viewer*, not recite ratings |

Each prompt file carries a "Change from vN" header explaining the delta. Server
-side `tidyReason()` / `tidyVerdict()` are belt-and-suspenders: even a
non-compliant model response is cleaned and truncated on a word boundary before
it reaches the DOM.

## 3. Guardrails against the model

- **Facts come from TMDB, never the model.** The recommendation prompt returns
  *titles only*; every title is looked up on TMDB, which supplies poster / year /
  overview. An unverifiable title is silently dropped, not shown as a broken card.
- **Structured output, not prose parsing.** Recommendations must be a JSON array;
  `parseModelJson()` tolerates exactly one markdown fence and nothing looser.
- **Prompt injection.** User review text feeds both prompts as untrusted data,
  length-capped and wrapped in `BEGIN/END` markers, with the prompt telling the
  model the block is data. Worst case for recommendations is a weird title (then
  TMDB-filtered); worst case for the verdict is an off-tone banner line, rendered
  via `textContent`, never `innerHTML`.
- **Cost is logged, not estimated away.** `openrouter.js` sends
  `usage.include=true` and stores the exact `usage.cost`; a per-model price table
  in `config.js` is only the fallback. Unknown model → `null`, never a guess.

## 4. Making failure visible (Module 13)

Once an AI call is attempted, a log row is **always** written — success *or*
failure — with `status`, `error_text`, token split and duration. A handled
model/parse/network failure logs `status='failed'` and then re-throws for a calm
inline message in the UI. The in-app "AI call log" viewer (footer button) shows
both log tables merged, so the audit trail is demonstrable in the browser, not
only in the Supabase table editor.

`GET /api/ai-log` is the primary audit surface: both features, successes and
failures, token split, duration, per-call cost, and totals. `GET
/api/recommendations/history` (SPEC §4.5) is deliberately kept as the narrower
per-feature JSON view — recommendation runs only — but nothing in the UI depends
on it; the merged log is what the app and the demo use.

One honest caveat: six of the earliest log rows predated the migration that
added the token split and duration columns, so they showed blanks in those
fields. They were deleted by hand once, for presentation, rather than left to
age out of the 60-row window. That is the only time anything has been removed
from the audit trail, and no code path in the app can delete a log row — see
`docs/DECISIONS.md` D-019.

## 5. Incident 1 — and the guardrail it produced

During AI-path testing the agent ran a "delete all movies" cleanup step; a second
run also deleted real films the user had added (ratings + reviews, unrecoverable
— the Supabase free tier has no point-in-time recovery). A separate
`Get-Process node | Stop-Process` also killed the user's running dev server.

Both were process failures, not code bugs. The response is recorded in
`CLAUDE.md` as **binding working agreements**: never run destructive operations
against live data, never bulk-kill processes, tag any unavoidable test rows and
delete only those. Documenting the failure and the resulting rule is itself part
of the practice.

## 6. Tests

`npm test` (Node's built-in runner, no dependency, 35 tests) covers:

- **Pure helpers** where every truncation bug actually lived — `parseModelJson`,
  `tidyReason`, `tidyVerdict`, `estimateCostUsd` — plus `loadPrompt` against the
  real prompt files, so a malformed prompt version fails the suite.
- **Routes** (`test/routes.test.js`): input validation (the 400s), duplicate add
  (409), `GET /api/config` / `/api/health`, TMDB-unreachable (502), the
  below-threshold guards (422), and — the one that matters most — OpenRouter
  unreachable returning 422 *and* still writing a `status='failed'` row to
  `recommendation_logs`. That's the "make failure visible" contract under test.
- **Regression guards**, each added the day the bug was found and each checked to
  fail without its fix: a film deleted in another tab returning 404 rather than a
  500, TMDB's own rating actually reaching the insert, and TMDB's "no votes"
  `vote_average: 0` being stored as `null` instead of as a real score of zero.

To keep the live database untouched (§5), the Supabase client is swapped for a
small in-memory fake (`test/helpers.js`); TMDB and OpenRouter are stubbed through
`globalThis.fetch`. `server/index.js` exports `app` and only starts listening
when run directly, so a test can drive it on an ephemeral port.

Still manual: the resilience *UI* states (the calm inline messages) — worth a few
screenshots for the submission even though the server side is now tested.

## 7. Known gaps / next

- ~~Not yet deployed.~~ **Deployed 2026-09-07 to Render:
  https://cinerank-g6lx.onrender.com** — no application changes were needed,
  which is the point: the `start` script, `engines`, `process.env.PORT` handling
  and the `/api/health` probe had all been in place since before there was
  anywhere to deploy to. Netlify was ruled out from the beginning and stayed
  ruled out (static files + serverless functions only; this is a long-lived
  `app.listen` server). Free tier, so it sleeps after ~15 minutes idle and the
  first request then takes anywhere from a few seconds to a minute while the
  instance wakes; every load after that is immediate.
- Resilience (TMDB down, OpenRouter down) is implemented but should be captured as
  screenshots for the submission. Deliberately deferred to a dedicated
  pre-submission session, so the shots match the finished UI rather than a
  mid-overhaul one.
- **The recommendations error state is written and then immediately overwritten**
  by the availability-sync that runs in the same `finally`, so a failed run shows
  the user nothing. The server side is correct and under test (422 plus a
  `status='failed'` log row); this is the UI half of SPEC §7.1 and is fixed when
  that section gets its overhaul pass. The verdict side already does it properly
  — its fallback links straight into the AI call log.
- The prompt-injection defense should be shown with a concrete demo movie whose
  review is an injection attempt.
