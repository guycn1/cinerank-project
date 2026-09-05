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
  human sign-off.** Two merges to `main` so far, each a deliberate decision.
- **Secrets never enter code.** `.env` gitignored from commit 1; a pre-commit
  `npm run scan-secrets` scans the staged diff for key-shaped strings.
- **Every commit says why**, and design decisions are appended to
  `docs/DECISIONS.md` at the moment they're made (Module 8: the reasons are
  clearest then and can't be reconstructed later).

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
inline message in the UI. The in-app "AI call log" viewer (footer link) shows
both log tables merged, so the audit trail is demonstrable in the browser, not
only in the Supabase table editor.

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

`npm test` (Node's built-in runner, no dependency) covers the pure helpers where
every truncation bug actually lived — `parseModelJson`, `tidyReason`,
`tidyVerdict`, `estimateCostUsd` — plus `loadPrompt` against the real prompt
files, so a malformed prompt version fails the suite.

## 7. Known gaps / next

- Not yet deployed. **Note:** the current Express `app.listen` server does not run
  on Netlify as-is (static + serverless only) — target Render / Railway / Fly, or
  refactor routes to serverless functions.
- Resilience (TMDB down, OpenRouter down) is implemented but should be captured as
  screenshots for the submission.
- The prompt-injection defense should be shown with a concrete demo movie whose
  review is an injection attempt.
