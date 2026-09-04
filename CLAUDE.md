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
* Every OpenRouter call, for **either** feature, must capture and store token usage and estimated cost in its respective log table (`recommendation\_logs` or `taste\_verdict\_logs`) — this is a hard requirement, not a nice-to-have (course grading emphasis on cost logging).
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

* Prompt files live under `prompts/`, named `recommend\_v1.md`, `taste\_verdict\_v1.md`, etc. — never overwrite an existing version; bump the version number when a prompt's logic changes. The two features are versioned independently of each other.
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

