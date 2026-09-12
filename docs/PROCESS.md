# How CineRank was built — the LLM-augmented workflow

This is the *process* companion to `docs/DECISIONS.md` (which records the *why*
behind each technical choice). The course is about practising software
development with an LLM in the loop, so this file is a first-class deliverable,
not an afterthought.

**Authors:** Guy Cohen & Michael Chernyak · **Course:** LLM-Augmented Software
Practice (ASE-26)


## 1. Working method

The app was built in a pair-with-an-agent loop: a human sets the goal and the
acceptance bar, the agent drafts code and prompts, the human reviews every diff
and runs the app, and each checkpoint is committed with a message that explains
the reasoning. Rules that keep this honest live in `CLAUDE.md`:

- **Everything on `draft`; `main` only at a settled milestone, only with explicit
  human sign-off.** Nineteen merges to `main` so far (verify with
  `git log --merges --oneline main`), each a deliberate decision.
- **Secrets never enter code.** `.env` gitignored from commit 1; a pre-commit
  `npm run scan-secrets` scans the staged diff for key-shaped strings. The same
  rule shaped the deploy: `render.yaml` declares the four secrets as
  `sync: false`, so Render prompts for them in its dashboard and no value ever
  enters the committed file.
- **Dependency advisories get diagnosed, not force-fixed.** The first Render
  build flagged moderate advisories in `qs`, Express's query-string parser —
  **two of them**, `GHSA-x5fp-wj9c-mxmx` (array-limit bypass) and
  `GHSA-4mjr-xmp4-gh2g` (DoS via `isBuffer`), both named in `package.json` beside
  the override. `npm audit fix` did nothing — and neither did `--force`, which is
  the point where it would have been easy to either shrug or reach for a major
  upgrade. The actual cause was that Express 4 pins `qs` to *exactly* the
  vulnerable `6.15.3`, leaving npm no semver room, so the only move it could see
  was Express 5 and its breaking changes. An `overrides` entry lifting `qs` to
  the patched `6.16.0` — a minor bump — cleared both, with the route tests
  covering exactly the surface involved (query strings, JSON bodies). Recorded in
  `package.json` next to the override, because an unexplained override is the
  kind of thing a later reader deletes. `npm audit` now reports zero across every
  severity, and `qs` resolves to a single `6.16.0` install that both `express`
  and `body-parser` share.
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
| Taste verdict | `taste_verdict_v1` → `v2` → `v3` → `v4` → `v5` → `v6` → `v7` | v1 cut mid-word and leaked `*markdown*` → v2 "finish the sentence, no markdown" → v3 over-corrected to one terse line that just parroted the numbers → v4 gave room back (2–3 sentences) and redirected it to *characterise the viewer*, not recite ratings → v5 changed the REGISTER and nothing else: v4 asked for "light and teasing" and got teasing in a literary voice, so v5 asks for plain spoken English — everyday words, contractions, sentences you could say out loud — with a worked example of the too-fancy version to steer away from → v6 because v5 half-landed in a way worth recording: it fixed the sentence SHAPE ("you hit a wall fast", "Basically") and left the critic vocabulary sitting inside those sentences ("gratuitously grim", "suffering played for shock value"), and used a semicolon v5 had asked it to split. v6 applies the out-loud test to every PHRASE rather than the sentence, bans semicolons outright instead of advising against them, and adds a rewrite table plus a third rejected example lifted from v5's own output — concrete sentences to steer away from have moved this prompt further than any adjective → **v7 threw that conclusion out.** v6 did not improve the register either, and counting the chain showed why: negative instructions went 16 → 30 → 37 while worked examples of the TARGET voice stayed at exactly one, and the file doubled in size for no visible gain. v6 had accidentally proved the split — its structural ban ("no semicolons, ever") landed in the very next verdict, its vocabulary bans did nothing. A ban removes an option and supplies no replacement, so the model obeys it and falls back to its own default voice for the words it does choose. v7 deletes the rewrite table, both rejected examples and the banned-word list, keeps the structural rules, and carries FOUR worked verdicts instead of one — shorter than v6 and than v5. Register is a sample, not a rule → **and v7 was the worst of the lot, which is where the honest finding is.** It still said "gratuitous" and it broke a rule every version since v4 has held: 4 sentences against a stated 2–3. Rolled back to v6. Three structurally different prompts — bans, more bans, examples — produced the same register, so the prompt was never the lever; what is left is the model (the cheapest tier, where register control is weakest), the 0.85 temperature, or real few-shot as example TURNS rather than prose. Recorded because a v-chain that only shows successful iterations would misrepresent what prompt engineering is actually like: three of these seven cost real money and moved nothing. **The fix was the MODEL, and v7 works on it unchanged** — same prompt, `claude-sonnet-5`, register landed and the sentence count came back into bounds on the first call. The verdict is now the one feature not on the cheap tier (D-053) |

Each prompt file carries a "Change from vN" header explaining the delta. Server
-side `tidyReason()` / `tidyVerdict()` are belt-and-suspenders: even a
non-compliant model response is cleaned and truncated on a word boundary before
it reaches the DOM.

## 3. Guardrails against the model

- **Facts come from TMDB, never the model.** The recommendation prompt returns
  *titles only*; every title is looked up on TMDB, which supplies poster / year /
  overview. A title TMDB returns no result for is silently dropped, not shown as
  a broken card — measurement showed that is the common outcome for an invented
  title, not a rare one. The lookup keeps TMDB's best result when the titles do
  not match exactly, so it proves the card describes a real film rather than
  proving it is the film the model meant: a trade taken deliberately, with the
  numbers, in D-054.
- **Structured output, not prose parsing.** Recommendations must be a JSON array;
  `parseModelJson()` tolerates exactly one markdown fence and nothing looser.
- **Prompt injection.** User review text feeds both prompts as untrusted data,
  length-capped and wrapped in `BEGIN/END` markers, with the prompt telling the
  model the block is data. Worst case for recommendations is a weird title (then
  TMDB-filtered); worst case for the verdict is an off-tone banner line, rendered
  via `textContent`, never `innerHTML`.
- **Model choice is per feature, and it is a cost decision made in the open.**
  Recommendations run on `claude-haiku-4.5`; the taste verdict alone runs on
  `claude-sonnet-5`, after four prompt versions failed to move its register and
  the model turned out to be the constraint rather than the wording (D-053).
  OpenRouter's public model list was queried for the actual prices rather than
  guessed — $2/$10 per Mtok against Haiku's $1/$5, about 0.29¢ a verdict — and
  the call log renders the model per row, so the split is auditable rather than
  buried in config.
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

`npm test` (Node's built-in runner, no dependency, 54 tests) covers:

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
- **The recommendation SUCCESS path**, added 2026-09-09 — until then the only
  recommendation tests were its two failure paths, so every rule deciding what a
  user actually sees was unproven. One run now asserts that of four model picks
  only the verified, unowned, non-duplicate one survives; another that an unrated
  film already in the list is never recommended back; five more that a run which
  returns nothing reports WHY truthfully, rather than always blaming the model for
  naming films the user already had.
- **One invariant written as a loop over BOTH AI features**, so they cannot drift
  into two answers: whenever a `status='failed'` row reaches a log table the
  response must advertise the AI call log, and whenever no row was written it must
  not. Each of these was verified by breaking the code it guards and confirming
  the intended test — and only that test — fails.
- **Two failures at once**, added 2026-09-11 and also written as a loop over both
  features: when the AI call fails AND the log write then fails, there is no row
  to hold either cause, so stderr is the only surviving record and the test
  asserts both causes reach it. Probed the same way — dropping the composition
  loses the AI cause, dropping the `console.error` loses both.

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
  mid-overhaul one. **That precondition is now met** — the front-end overhaul
  finished on 2026-09-12 — so the shots can be taken against a settled UI
  whenever the authors choose to. Nine states are enumerated with their exact
  recipes in `CLAUDE.md` (greppable as `RS-1` through `RS-9`).
- ~~**The recommendations error state is written and then immediately
  overwritten** by the availability-sync that runs in the same `finally`, so a
  failed run shows the user nothing. The verdict side already does it properly —
  its fallback links straight into the AI call log.~~
  **Fixed 2026-09-09, and it was worse than written on both counts.** It was
  filed as an error-message bug; the `finally` reassigns the element
  unconditionally, so the SUCCESS line and the zero-result line died with it —
  a failed run, a successful run and a page that had never run were
  indistinguishable apart from the cards. And the verdict was *not* the model to
  copy: its fallback offered the AI call log for every failure, including
  CineRank itself being unreachable, where that log cannot load either. Reading
  the "good" implementation before copying it is what turned one fix into three
  (a guarded single-writer for the hint; a `logged` flag the server sets only
  when a row was really committed; the same treatment applied back to the
  verdict). D-047 has the reasoning.
- The prompt-injection defense should be shown with a concrete demo movie whose
  review is an injection attempt.
