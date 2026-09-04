SPEC.md — CineRank
**Authors:** Guy Cohen \& Michael Chernyak
**Course:** LLM-Augmented Software Practice (ASE-26)
**Status:** Draft v1

\---

## 1\. Overview \& Problem Statement

Most "movie list" student projects stop at CRUD: add a movie, rate it, see a list sorted by rating. That's a fine skeleton but not a project — there's no real logic, no meaningful use of stored data beyond display.

**CineRank adds a real reason to have a database and a real reason to call an LLM:**

* The **database** doesn't just store movies — it tracks a growing taste profile (your rated movies + reviews) that gets read back later to ground AI recommendations, and it logs every AI recommendation ever generated (so recommendations are auditable, not throwaway).
* The **AI (OpenRouter)** isn't answering open questions — it has exactly one narrow job: given your top-rated movies, suggest similar movies you haven't added yet, with a short reason per pick. It's a small, well-scoped feature, not the engine of the app.
* The **UI** should be genuinely polished and visually engaging — real typography, motion, and thoughtful visual hierarchy, not a generic default-component look. This project wants a fair amount of eye-candy; specific layout and visual choices are left open — see § 3 for priorities rather than a fixed look.

**Out of scope for v1 (explicit exclusions):**

* No user accounts / multi-user support — single personal movie list (see CLAUDE.md § Security \& Scope for why this isn't a security gap).
* No social features (sharing lists, following other users, public rankings).
* No editing/moderating AI suggestions beyond accepting or dismissing them.

\---

## 2\. Functional Requirements

### 2.1 Core Movie Management (the CRUD, but done right)

* Search for a movie by title → results pulled live from **TMDB Search API**.
* Select a result → full details (poster, year, overview, TMDB rating) fetched from **TMDB Movie Details API** and saved to Supabase.
* Rate a saved movie (0–10, one decimal) and optionally write a short personal review.
* Edit or delete any saved movie at any time.
* Movies are auto-ranked by your rating, highest first, recalculated on every view (not stored as a stale rank).

### 2.2 AI-Powered Recommendations (the non-wrapper part)

* A "Get Recommendations" action is available once the user has rated **at least 3 movies** (below that, there isn't enough taste signal — the button is disabled with an explanation, not silently broken).
* On trigger:

  1. The app pulls the user's **top N rated movies** (N=5 by default) from Supabase.
  2. Sends a **structured, versioned prompt** (see § 6) to OpenRouter containing those titles + the user's own review text as taste signal.
  3. The model returns a **structured list** (title + one-sentence reason per suggestion) — not free-form prose the app has to parse with regex.
  4. Each suggested title is **cross-checked against TMDB** to confirm it's a real movie and to pull its real poster/year/overview — the AI never gets to invent poster URLs or years; it only picks titles, TMDB supplies the facts.
  5. Suggestions already in the user's list are filtered out before being shown.
* Every recommendation run is **logged to the database** (prompt version, model used, input movie titles, raw output, token usage) — see § 5.2. This turns "the AI said something" into an auditable record, which matters for grading and for debugging.
* Recommendations are a **snapshot, not live** — they don't regenerate automatically when new movies are rated; the user explicitly re-triggers when they want fresh ones.

### 2.3 Taste Verdict Banner (the fun, low-stakes AI touch)

* A banner on the Home view where an AI agent gives a short, playful one-or-two-sentence "verdict" on the user's movie taste, based on their currently rated movies (titles + ratings, and optionally review text).
* Distinct from the recommendation feature in § 2.2 — this is commentary, not suggestions. Tone should be light/teasing, not generic praise ("Five 10/10 action movies and zero dramas — you watch films to turn your brain off, and honestly? Respect.").
* Available once **at least 2 movies are rated** (lower bar than recommendations — this is just banter, it doesn't need much signal).
* Regenerated only on explicit user action (a small "New verdict" refresh button on the banner) — never silently regenerated on every page load, to avoid burning OpenRouter credit on an unrequested repeat call.
* Same DB-logging and TMDB-independent discipline as § 2.2: every verdict call is logged (§ 5.3), and a failed/unreachable call shows a quiet fallback message on the banner ("Couldn't come up with a verdict right now") — it never blocks or breaks the rest of the page, since it's the lowest-stakes feature in the app.

### 2.4 Resilience Requirements

* If TMDB is unreachable: search/add flow shows a clear inline error; already-saved movies and their ratings remain fully usable.
* If OpenRouter is unreachable or returns malformed output (for either recommendations or the taste verdict banner): the affected panel shows a specific fallback message — the core rating/ranking flow is never blocked by either AI feature.

\---

## 3\. Interface Design (Module 8)

### 3.1 Flow

**Home (ranked list) → Add movie (search → pick result → rate) → back to Home.** Recommendations live as a secondary panel/tab off the Home view, not a separate flow the user has to hunt for.

### 3.2 Hierarchy

On the Home view, the **ranked list of movies is the primary focus** — it should read as the main content of the page, genuinely polished rather than a generic default look. The **Taste Verdict Banner should be visible early** (near the top, before the ranked list), set a fun tone, and stay compact enough that it doesn't compete with the ranked list for primary attention. The "Get Recommendations" action should remain visually secondary to the ranked list — present and easy to find, but not the first thing that draws the eye.

Beyond this priority order, the specific visual treatment — layout, styling, animation, typography — is left to design judgment. **Lean toward a genuinely polished, eye-catching look — motion, color, and detail are welcome and encouraged, not something to play safe on.** This section deliberately avoids prescribing exact effects or components; treat it as an opportunity to make good, opinionated design choices rather than a checklist to follow line-by-line.

### 3.3 Interaction

* Search results should help the user recognize the right movie quickly (e.g. showing posters alongside titles/years) rather than a bare text list — exact presentation is a design choice.
* Rating uses a clear numeric input or slider (0–10, one decimal) — no ambiguity about what "your rating" means.
* Recommendation suggestions should feel visually consistent with the rest of the app, with a clear "Add to my list" action per suggestion and a subtle marker that these are AI-suggested and not yet rated — the exact card/list treatment is a design choice.

### 3.4 Feedback (including bad states)

* **Loading:** search results and recommendation generation both show a lightweight loading state — recommendation generation especially, since an LLM call can take a few seconds and a frozen button reads as broken.
* **Empty state:** a brand-new list shows "No movies yet — search for one to get started," not a blank page.
* **Not-enough-data state:** fewer than 3 rated movies → "Rate at least 3 movies to unlock recommendations" shown directly on the disabled recommendations action, not just a disabled button with no explanation. Similarly, the Taste Verdict Banner shows "Rate at least 2 movies to get a verdict" before that threshold, rather than an empty or broken banner.
* **Failure state:** TMDB or OpenRouter failures produce a specific, calm inline message (see § 2.3) — never a raw error dump or a silently broken button.
* **Duplicate handling:** attempting to add a movie already in the list shows a clear "Already in your list" message instead of a duplicate entry or a raw DB constraint error.

\---

## 4\. Technical Architecture

### 4.1 Stack

* **Backend:** Node.js + Express.
* **Database:** Supabase (Postgres) — see § 5 for schema.
* **Frontend:** HTML/CSS/JS — no framework required; the UI quality bar is met through deliberate design choices, not a generic component-library default look (see § 3.2 and CLAUDE.md's frontend-design notes).
* **External API #1 (movie data):** TMDB (The Movie Database) — free tier, requires a free API key signup (instant approval, no review wait).
* **External API #2 (AI):** OpenRouter, using the existing $5-credit account.

### 4.2 Why TMDB

Free, well-documented, instant key approval, huge catalog, provides posters/overviews/years in one call.

### 4.3 Why Supabase

A real relational Postgres database supports the recommendation-log tables relationally (foreign keys to movies), and works from both local dev and any future deployment.

### 4.4 High-Level Data Flow

```
User searches title → Express route → TMDB Search API → results shown
User picks result → Express route → TMDB Details API → insert into Supabase `movies`
User rates movie → update `movies` row (rating, review)
User requests recommendations → Express route → 
  read top-N from Supabase → build versioned prompt → OpenRouter call →
  parse structured output → cross-check each title against TMDB →
  insert row into `recommendation\_logs` → return enriched suggestions to frontend
```

### 4.5 API Endpoints (draft)

|Method|Route|Purpose|
|-|-|-|
|GET|`/api/movies`|List all saved movies, sorted by rating desc|
|GET|`/api/movies/search?q=`|Proxy to TMDB search|
|POST|`/api/movies`|Save a movie (from a TMDB result)|
|PATCH|`/api/movies/:id`|Update rating/review|
|DELETE|`/api/movies/:id`|Remove a movie|
|POST|`/api/recommendations`|Trigger a new AI recommendation run|
|GET|`/api/recommendations/history`|(optional) view past recommendation runs|
|POST|`/api/taste-verdict`|Generate a new taste verdict banner message|

\---

## 5\. Data Model (Supabase / Postgres)

### 5.1 `movies`

|Column|Type|Notes|
|-|-|-|
|id|uuid, PK||
|tmdb\_id|integer|TMDB's own movie id, for dedup checks|
|title|text||
|year|integer||
|description|text|TMDB overview|
|poster\_url|text||
|rating|numeric(3,1)|nullable until rated|
|review|text|nullable|
|created\_at|timestamptz|default now()|

Unique constraint on `tmdb\_id` — prevents adding the same movie twice, gives a clean DB-level answer to the "duplicate handling" UX requirement in § 3.4.

### 5.2 `recommendation\_logs`

|Column|Type|Notes|
|-|-|-|
|id|uuid, PK||
|created\_at|timestamptz|default now()|
|prompt\_version|text|e.g. `"v1"` — see § 6|
|input\_movie\_ids|uuid\[]|the top-N movies used as taste signal|
|raw\_model\_output|jsonb|exactly what the model returned, unmodified|
|suggested\_titles|text\[]|parsed titles, post-validation|
|model\_used|text|e.g. `"anthropic/claude-..."` via OpenRouter|
|tokens\_used|integer|from the OpenRouter response|
|estimated\_cost\_usd|numeric(10,6)|logged per call, per course requirement on cost tracking|

This table is the real DB payoff of the AI feature — it's not just "call the API and show the answer," it's "call the API and keep a real, queryable record of every call," which is a meaningfully different (and gradeable) thing.

### 5.3 `taste\_verdict\_logs`

|Column|Type|Notes|
|-|-|-|
|id|uuid, PK||
|created\_at|timestamptz|default now()|
|prompt\_version|text|e.g. `"v1"` — its own prompt file, versioned independently of recommendations|
|input\_movie\_ids|uuid\[]|all rated movies used as input (not just top-N — the verdict is about overall taste, not favorites)|
|verdict\_text|text|the model's one/two-sentence output, stored as-is|
|model\_used|text|e.g. `"anthropic/claude-..."` via OpenRouter|
|tokens\_used|integer|from the OpenRouter response|
|estimated\_cost\_usd|numeric(10,6)|same cost-logging discipline as recommendations|

Smaller/lighter than § 5.2 by design — this is a low-stakes feature, but it still gets the same auditability treatment, not a shortcut.

\---

## 6\. AI Features — Prompt Discipline

Applies to **both** AI features (§2.2 Recommendations, §2.3 Taste Verdict Banner) equally:

* Each feature has its **own versioned prompt file** — `prompts/recommend\_v1.md` and `prompts/taste\_verdict\_v1.md` — never inlined as strings in application code, never sharing one file.
* The recommendation prompt requires **structured JSON output** (array of `{title, reason}` objects) — the app must not depend on regex-parsing free-form prose.
* The taste verdict prompt requires a **short plain-text output** (one or two sentences) — no JSON needed here since there's nothing structured to extract, but a max-length instruction is included in the prompt so the banner can't get a five-paragraph response.
* The recommendation prompt explicitly instructs the model to suggest only real, existing movies — but the app **never trusts this claim**; every suggestion is verified against TMDB before being shown (§ 2.2, step 4). This is the concrete guard against the model hallucinating a title that doesn't exist. The taste verdict feature has no equivalent fact-check need since it's pure opinion/commentary, not a factual claim.
* See CLAUDE.md § Prompt Injection for how user-supplied review text (which feeds into *both* prompts) is handled safely.

\---

## 7\. Testing \& Acceptance Criteria

### 7.1 Must Pass Before Submission

* \[ ] Searching a real movie title returns real TMDB results with posters.
* \[ ] Adding a movie already in the list is blocked with a clear message, not a duplicate row.
* \[ ] Deleting and re-ranking works correctly with 0, 1, and many movies (edge cases, not just the happy path).
* \[ ] Recommendation action is disabled with an explanation below 3 rated movies.
* \[ ] A full recommendation run produces a logged row in `recommendation\_logs` with real token/cost data, and shown suggestions have real, TMDB-verified posters — not AI-invented ones.
* \[ ] The Taste Verdict Banner is disabled/shows an explanation below 2 rated movies, and a triggered verdict produces a logged row in `taste\_verdict\_logs` with real token/cost data.
* \[ ] Killing network access to TMDB and to OpenRouter (independently) each produce a graceful inline error, not a broken page — this includes the banner falling back gracefully, not breaking the whole Home page.
* \[ ] `.gitignore` excludes `.env` from the first commit; `git log` confirms no key ever appears in history (see CLAUDE.md § Security \& Secrets).

### 7.2 Manual Demo Script (for grading)

1. Show an empty list → add 3-4 real movies via TMDB search, rate them.
2. Show the ranked list re-sorting live as ratings change, and the Taste Verdict Banner generating a fresh one-liner about the taste profile so far.
3. Trigger a recommendation run, narrate what's happening (top-N pulled → prompt sent → TMDB cross-check → logged).
4. Open both the `recommendation\_logs` and `taste\_verdict\_logs` tables in Supabase directly, show the token/cost/prompt-version columns — this is the moment that proves it's not "just a ChatGPT wrapper."
5. Try adding a duplicate movie, try triggering recommendations with only 1 rated movie — show both graceful failure states.

