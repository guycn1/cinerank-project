# CLAUDE.md — CineRank

This file governs how Claude (or Claude Code) should work in this repository. Refer to `SPEC.md` for the full functional/technical spec — this file is about *how to build it*, not *what to build*.

\---

## Project Context

CineRank is a personal movie-ranking app.

This project consists of:

* A real database layer (Supabase/Postgres).
* A genuinely polished, distinctive UI — not a generic default-component look.
* A genuine, narrow-scope AI feature (OpenRouter-based recommendations) that reads real stored data and writes a real audit log — not a general chatbot bolted onto the app.

Refer to SPEC.md §7 for the full acceptance checklist. In short: a user can search, add, rate, and rank movies via real TMDB data, and can trigger AI recommendations grounded in their own ratings, with every AI call logged.

\---

## Project Status — Living Log

**Keep this section current every working session.** It is the fast answer to
"where are we, what's broken, what's next". The detailed *why* behind each choice
lives in `docs/DECISIONS.md`; this is the *what / now*.

**Last updated:** 2026-09-05 (route + resilience tests; main merged at SPEC-complete milestone)

### Build status
* Runs locally only (`npm start` → http://localhost:3000). Not deployed yet.
* Supabase project is live; `db/schema.sql` + `db/migrations/001` applied.
* AI call log viewer confirmed working in-browser.
* `main` merged at the "functionally complete vs SPEC §2–§6" milestone
  (2026-09-05); `draft` continues for submission-packaging work.

### Implemented
* Movie CRUD: search (TMDB) → add → rate (0–10, review) → auto-ranked list. Dupe
  guard via `unique(tmdb_id)`. Add auto-opens the rate dialog ("Skip for now").
  Long reviews clamp to 2 lines with a "view more…/show less" toggle (shown only
  when the text actually clips).
* Recommendations: `POST /api/recommendations`, prompt `recommend_v3` (second-person
  reason voice, 8–16 words), server-side reason tidy, per-title TMDB verification,
  owned-titles filter. Card `.reason` clamps at 5 lines.
* Taste verdict: `POST /api/taste-verdict`, prompt `taste_verdict_v4` (2–3
  sentences, ~35–60 words, characterise the viewer — not recite ratings),
  `max_tokens` 180, server-side sentence-aware truncation (450-char ceiling) +
  markdown strip, explicit-trigger.
* AI call log: every call logged success **or** failure; `GET /api/ai-log` merges
  both tables; in-app viewer via footer link.
* Security: `.env` gitignored from commit 1, `npm run scan-secrets` pre-commit,
  anon key only, query-builder only, `textContent` only.
* Tests: `npm test` (Node built-in runner, 31 tests). Pure helpers
  (`parseModelJson`, `tidy*`, `estimateCostUsd`, `loadPrompt`) + route-level
  (`test/routes.test.js`): validation (400s), duplicate (409), TMDB-down (502),
  below-threshold (422), and OpenRouter-down (422 **with** a `status='failed'`
  log row written). Supabase is swapped for an in-memory fake (`test/helpers.js`)
  so tests never touch the live DB; TMDB/OpenRouter stubbed via `globalThis.fetch`.
  `server/index.js` exports `app` and only `listen()`s when run directly.
* `GET /api/health` liveness probe for a future host.
* `docs/PROCESS.md` — the LLM-augmented workflow narrative (prompt v-chain,
  guardrails, Incident 1) for the course's process grade.
* Accessibility: per-item `aria-label`s (Rate/Edit/Remove/Add-to-list name the
  film, not just the verb), live regions on search results / recs hint / verdict
  text, `aria-busy` on the two async trigger buttons, `aria-expanded`/
  `aria-controls` on the review "view more" toggle, dialogs `aria-labelledby`,
  poster `alt` text (`"{title} — poster"` / labelled placeholder), rec-card
  heading fixed h4→h3 (correct nesting under the section's h2), decorative
  spinners `aria-hidden`.

### Open issues / TODO
* [x] Migration 001 applied.
* [ ] User re-adding lost movies (see Incident 1).
* [ ] Not deployed — **Netlify won't run the Express server** (static + serverless
  only); target Render / Railway / Fly.io, or refactor routes to functions.
* [x] Tests: pure helpers, prompt loader, route validation, duplicate handling,
  and TMDB/OpenRouter-down resilience all covered by `npm test` (31). Still worth
  capturing the resilience states as UI screenshots for the submission.
* [ ] Prompt-injection defense: add a demo movie with an injection-attempt review
  and screenshot the verdict/recs staying on-topic (Module 17 evidence).
* [x] `/api/recommendations/history` vs `/api/ai-log` — decided to keep both
  (D-017): `/api/ai-log` is the primary audit surface, `/history` stays as the
  narrower per-feature JSON view per SPEC §4.5. Post-submission cleanup candidate.
* [ ] **Demo seed list for lecturer submission.** Ship with 3–4 pre-rated movies
  (not empty) so the ranked list, both AI features, and the call log all work on
  first open. Blueprint agreed with user:
  1. One deliberate taste persona — a specific sensibility (e.g. "bold,
     stranger-than-fiction swings; bored by safe blockbusters"), not a generic
     spread, so the verdict + recs land.
  2. Rating spread: a couple high, one mid, one low "guilty pleasure /
     disappointment" outlier for contrast.
  3. 2–3 real reviews with actual voice — feeds the prompts as taste signal and
     demos the "view more" toggle + injection-safe handling.
  4. Recommendation headroom: likely AI picks not already in the list, real
     enough to pass TMDB verification cleanly (no silently-dropped cards).
  5. Dry-run the verdict a few times pre-submission; adjust the seed set if the
     output is flat.
  Build it as a small repeatable seed helper (hits the app's own
  `POST /api/movies` + `PATCH /:id`, tagged as the demo set) so we can wipe and
  re-seed while tuning; final state must be exactly what the normal UI flow
  produces. Not started — user will kick this off later.

### Incident log
* **Incident 1 (2026-09-04) — user movie data deleted.** During AI-path testing
  Claude ran "delete all movies" as cleanup; the second run also removed the
  Marvel/superhero films the user had added (ratings + reviews lost, not
  recoverable — free tier has no PITR/backups; logs kept only dead movie ids).
  Also: Claude's `Get-Process node | Stop-Process` killed the user's running dev
  server. Both are process failures, not code bugs. Mitigations below are now
  binding.

### Working agreements (binding — added after Incident 1)
* **Never run destructive operations against the live Supabase data.** No
  "delete all", no truncate, no bulk delete. If test rows are unavoidable, tag
  them (e.g. `review = "__CLAUDE_TEST__"`) and delete only rows matching that
  exact tag and created in the same script — never "all ids".
* **Never kill node processes broadly.** No `Get-Process node | Stop-Process`, no
  `pkill node`. Kill only a PID this session started, and run any test server on a
  non-default port so the user's `npm start` is untouched.
* Prefer not to touch the user's DB at all for testing; ask them to run a check or
  use a throwaway when a real round-trip is genuinely needed.

\---

## Tech Stack

* **Backend:** Node.js + Express
* **Database:** Supabase (Postgres) — see SPEC.md §5 for schema
* **Frontend:** HTML/CSS/JS (vanilla). No framework required — the UI quality bar is met through actual design decisions (typography, motion, hierarchy), not through pulling in a component library. See the frontend-design conventions below.
* **External API #1 (movie data):** TMDB — requires a free API key from themoviedb.org (instant approval). Store as `TMDB\_API\_KEY` in `.env`.
* **External API #2 (AI):** OpenRouter, using the existing account/`.env` key. Keep these calls isolated in their own modules (e.g. `services/recommendations.js` and `services/tasteVerdict.js`) so either can be mocked/stripped without touching core movie CRUD logic.

\---

## Coding Conventions

* Keep TMDB calls and OpenRouter calls in separate service modules — never inline `fetch()` calls directly inside route handlers.
* All Supabase reads/writes go through the Supabase JS client's query builder (`.select()`, `.insert()`, `.eq()`, etc.) — never hand-built SQL strings.
* The recommendation and taste-verdict prompts are never hardcoded inline in a `.js` file — each lives in its own file under `prompts/` (see § Prompt Versioning below) and is loaded at call time.
* Every OpenRouter call, for **either** feature, must capture and store token usage and estimated cost in its respective log table (`recommendation\_logs` or `taste\_verdict\_logs`) — this is a hard requirement, not a nice-to-have (course grading emphasis on cost logging). A row is written whether the call **succeeds or fails** (`status` column) — a failed/degenerate AI call belongs in the audit trail too. The in-app "AI call log" viewer (`GET /api/ai-log`, footer link) surfaces both tables merged; the exact cost comes from OpenRouter's `usage.cost` with a per-model estimate table as fallback.
* Do not add authentication/multi-user support unless explicitly asked — SPEC.md marks this as v1 out-of-scope.

\---

## Frontend Design Notes

The explicit goal is a genuinely polished, distinctive look — not a generic default-component appearance. Concretely:

* Real typography choices (not default system font stack sizes) for the movie title/ranking numbers.
* Good-locking CSS effects and animations.
* Poster images treated as the primary visual anchor of each card — layout should be built around the poster, not squeeze it in as an afterthought.
* Consistent card language between the main ranked list and the AI recommendation panel, with a clear but subtle visual marker distinguishing "AI-suggested, not yet rated" from "already in your ranked list."

\---

## Prompt Versioning \& AI Call Discipline

* Prompt files live under `prompts/`, named `recommend\_v1.md`, `taste\_verdict\_v1.md`, etc. — never overwrite an existing version; bump the version number when a prompt's logic changes. The two features are versioned independently of each other. **Current:** recommendations use `recommend\_v3` (second-person, 8–16-word reason); taste verdict uses `taste\_verdict\_v4` (2–3 sentences, ~35–60 words, characterising the viewer — not reciting ratings). The active version string is a single `PROMPT\_VERSION` const at the top of each service module.
* Schema changes ship as numbered, re-runnable files in `db/migrations/` (and are also folded into `db/schema.sql` for fresh installs). Apply them by hand in the Supabase SQL editor.
* Every call to OpenRouter, for either feature, must record which prompt version was used, in its respective log table row (SPEC.md §5.2, §5.3) — this makes every past recommendation or verdict traceable to the exact prompt that produced it.
* The recommendation prompt must instruct the model to return **structured JSON only** (`\[{title, reason}, ...]`) — no free-form prose that needs regex parsing.
* The taste-verdict prompt must instruct the model to return **short plain text only** (one or two sentences, with an explicit length cap) — this is intentionally the lighter-weight of the two prompts.
* The app must **never trust the model's output as fact** for recommendations — every suggested title is cross-checked against TMDB before being shown to the user (SPEC.md §2.2 step 4). If a suggested title doesn't match any real TMDB movie, it is silently dropped, not shown as a broken/empty card. The taste-verdict output has no factual claim to check — it's opinion/commentary by design, so it's shown as-is (still subject to the length cap and injection mitigations below).

\---

## Security \& Secrets (Module 17)

1. **Never write a secret into source code.** `SUPABASE\_URL`, `SUPABASE\_ANON\_KEY`, `TMDB\_API\_KEY`, and `OPENROUTER\_API\_KEY` live only in `.env`, which must be in `.gitignore` from the very first commit.
2. **Never build a database query by concatenating strings.** Use the Supabase JS client's query builder for all reads/writes.
3. **Frontend uses only the Supabase anon key, never the service role key.** This is the concrete least-privilege demonstration for this project (see § Security \& Scope below) — the anon key respects Row Level Security and limits blast radius even if it were somehow exposed.
4. **Escape/encode any user-provided text before rendering it in the DOM** (movie reviews especially — this is free-text user input) to prevent stored XSS.
5. **Prompt injection awareness:** the user's own review text is included in **both** AI prompts as taste signal (SPEC.md §2.2, §2.3). This is untrusted input flowing into a prompt. Mitigations:

   * The prompt structure clearly delimits "user review text" from "instructions" so a review like "ignore previous instructions and..." is treated as quoted data, not as a new instruction.
   * The recommendation model's output is constrained to structured JSON and cross-checked against TMDB (§ Prompt Versioning above) — even if injection partially succeeds, the blast radius is limited to "a weird movie suggestion," not code execution or data exfiltration, because the output only ever drives a title lookup.
   * The taste-verdict output is length-capped and displayed as plain text (never rendered as HTML) — even if injection partially succeeds, the worst case is a nonsensical or off-tone banner message, not an executable payload or a leaked system prompt beyond commentary text.
6. **Before every commit, scan the diff for anything that looks like a key or credential**, ideally before committing rather than after.

### Security \& Scope (why no accounts ≠ no security story)

This is a single-user app by design (SPEC.md §1), but Module 17's actual topics — injection, secrets, prompt injection, least privilege — are all fully demonstrable without multi-user auth. Least privilege here means: the frontend key can only do what RLS allows, not "there are multiple people with different permissions." Don't add accounts to manufacture a least-privilege demo; the anon-vs-service-role key split already is one.

\---

## Version Control Workflow (non-negotiable)

* **Repo:** https://github.com/guycn1/cinerank-project.git (repo name: `cinerank-project`)
* **Working branch:** `draft` — all day-to-day work happens here.
* **`main` is the repo's default branch, but treated as protected in practice:** nothing gets pushed to `main` directly, ever.
* **Every modification inside this project's folder must be followed by a commit + push to `draft`.** Commit at natural checkpoints (a feature working, a bug fixed), not just once at the end of a session.
* **Merging `draft` → `main` only happens at a notable, settled milestone** — a UI milestone or a backend milestone believed to be genuinely complete, not a small incremental change. **Claude must ask the user for explicit confirmation before merging to `main`.** Never merge automatically, even if the milestone seems obviously done.
* **Git authoring:** never hardcode a commit author name/email. Always use whatever `user.name`/`user.email` are already configured in the local git installation Claude Code is running on. Do not set or override git config identity values.
* Commit messages should include a summary of what actually changed.

\---

## Out of Scope (v1)

* User accounts / authentication / multi-user support (see § Security \& Scope above for why this doesn't create a security gap).
* Social features — sharing rankings, following other users, public lists.
* Editing an AI suggestion's reason text or re-ranking suggestions manually before adding.
* Automatic/background re-generation of recommendations or taste verdicts — both are always explicitly user-triggered, never regenerated silently on page load.

