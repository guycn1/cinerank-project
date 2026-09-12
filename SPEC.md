# SPEC.md — CineRank

**Authors:** Guy Cohen \& Michael Chernyak · **Course:** LLM-Augmented Software Practice (ASE-26)

**Status:** Live specification — currently in the **third** turn of the co-evolution spiral. Annotated in place, never silently rewritten; see the next section.


## Specification status — the co-evolution spiral (Module 10)

A specification is the opening turn of a spiral rather than a fixed contract:
requirements emerge from attempted solutions, so the document has to be allowed to
learn. This section records the turns this one has actually been through, and the
commits that pinned each. It is written from `git log` — a record of what happened,
not a plan for what will.

**The convention this document follows, and why.** Where the built app diverged from
what § 1 to § 7 promised, the original text **stays exactly as written** and the
correction is added beside it as an italic parenthetical. Nothing is quietly edited to
agree with the code: a spec revised into agreement with its own implementation can no
longer show where the two ever differed, which is the one thing it is uniquely able to
show. Seven such annotations are in place — § 2.2, § 2.3, § 4.5, § 5.1, § 5.3, § 6
and § 7.2.

### Turn 1 — frame, build, pin (2026-09-04 to 2026-09-05)

Commit points: `aadaf18` to `0525b8e`.

The first turn ran fast and end to end — schema and versioned prompts (`baab823`), the
Express API with isolated service modules (`d5e9702`), then the frontend (`aee82b4`).
This document and `CLAUDE.md` were committed at `aadaf18`, **after** that first pass
rather than before it: the turn was exploratory, and the spec pinned what it
established. It closed at `0525b8e`, whose message reads "functionally complete against
SPEC" — the stopping condition § 7.1 defines had been reached.

### Turn 2 — the interface requirement emerged from use (2026-09-06 to 2026-09-12)

Commit points: `49738c2` to `d47c960`, sixteen merges to `main`.

§ 3.2 deliberately declined to prescribe the visual treatment, leaving layout, motion
and typography to design judgement. Using the finished app is what turned that open
brief into concrete requirements — a requirement that could not have been written
before a solution was attempted. The work it produced is tracked in `CLAUDE.md` rather
than here, because that is working state and this is intent: a 20-item ranked-list
overhaul, a 30-item recommendations audit (R1 to R30), seven polish items, and a
narrow-viewport pass closed against an agreed ~350px target.

**This turn holds the clearest co-evolution point in the project.** At `2a1800c`,
§ 2.2 step 4's promise that every suggestion is "cross-checked against TMDB" was
measured against live TMDB across 30 probe titles — and found to claim more than the
code delivers. The alternative was tightening the matcher until it met the promise;
that was designed, costed against the measurements, and rejected on the numbers.
**The specification was corrected and the code was left alone** (`docs/DECISIONS.md`
D-054).

### Turn 3 — the trail itself became the deliverable (2026-09-12 to open)

Commit points: `83a5da5` onward.

A staleness sweep across every markdown file and code comment (`83a5da5`) found claims
that had quietly stopped being true. Following it, both this file and `CLAUDE.md` were
found to be **rendering wrong on GitHub** — a fault invisible in the source and never
caught by eye. That produced a new verification gate, `npm run check-markdown`
(`d1dd505`), since proved in both directions across 57 cases, together with the
authoring rules it enforces in `CLAUDE.md` § Markdown Authoring Rules.

This turn is open. Its remaining scope is under "Pre-submission blockers" in
`CLAUDE.md`, and § 7.1's acceptance checkboxes below are to be ticked as part of
closing it.


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
  4. Each suggested title is **cross-checked against TMDB** to confirm it's a real movie and to pull its real poster/year/overview — the AI never gets to invent poster URLs or years; it only picks titles, TMDB supplies the facts *(as built, this confirms the card shows **a real film**, not that it shows **the** film the model meant: a title TMDB returns nothing for is dropped, while a near-miss resolves to TMDB's closest result, which is occasionally a different movie. Tightening the match was measured against live TMDB and deliberately rejected — see `docs/DECISIONS.md` D-054. The second half of this clause is exact as written: every fact on a card comes from TMDB, never from the model. The requirement stays as written, annotated, rather than being quietly rewritten to match the code)*.
  5. Suggestions already in the user's list are filtered out before being shown.
* Every recommendation run is **logged to the database** (prompt version, model used, input movie titles, raw output, token usage) — see § 5.2. This turns "the AI said something" into an auditable record, which matters for grading and for debugging.
* Recommendations are a **snapshot, not live** — they don't regenerate automatically when new movies are rated; the user explicitly re-triggers when they want fresh ones.

### 2.3 Taste Verdict Banner (the fun, low-stakes AI touch)

* A banner on the Home view where an AI agent gives a short, playful one-or-two-sentence "verdict" on the user's movie taste *(as built this settled at **2–3 sentences, ~35–60 words** — `taste_verdict_v3` followed this line literally and produced a terse paraphrase of the ratings, so v4 gave the room back; see `docs/DECISIONS.md` D-014. The requirement as written stays, annotated, rather than being quietly rewritten to match the code)*, based on their currently rated movies (titles + ratings, and optionally review text).
* Distinct from the recommendation feature in § 2.2 — this is commentary, not suggestions. Tone should be light/teasing, not generic praise ("Five 10/10 action movies and zero dramas — you watch films to turn your brain off, and honestly? Respect.").
* Available once **at least 2 movies are rated** (lower bar than recommendations — this is just banter, it doesn't need much signal).
* Regenerated only on explicit user action (a small "New verdict" refresh button on the banner) — never silently regenerated on every page load, to avoid burning OpenRouter credit on an unrequested repeat call.
* Same DB-logging and TMDB-independent discipline as § 2.2: every verdict call is logged (§ 5.3), and a failed/unreachable call shows a quiet fallback message on the banner ("Couldn't come up with a verdict right now") — it never blocks or breaks the rest of the page, since it's the lowest-stakes feature in the app.

### 2.4 Resilience Requirements

* If TMDB is unreachable: search/add flow shows a clear inline error; already-saved movies and their ratings remain fully usable.
* If OpenRouter is unreachable or returns malformed output (for either recommendations or the taste verdict banner): the affected panel shows a specific fallback message — the core rating/ranking flow is never blocked by either AI feature.


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
* **Failure state:** TMDB or OpenRouter failures produce a specific, calm inline message (see § 2.4, the resilience requirements — this pointed at § 2.3, which specifies only the verdict banner's own fallback) — never a raw error dump or a silently broken button.
* **Duplicate handling:** attempting to add a movie already in the list shows a clear "Already in your list" message instead of a duplicate entry or a raw DB constraint error.


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
  insert row into `recommendation_logs` → return enriched suggestions to frontend
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

*Three more endpoints exist as built and are not in the draft above: `GET /api/ai-log` (both log tables merged, newest 60 — the primary audit surface, and what the in-app viewer reads), `GET /api/config` (the three public threshold numbers, so the client never hardcodes a rule the server owns) and `GET /api/health` (liveness probe, used by Render). `/api/recommendations/history` was kept alongside `/api/ai-log` rather than dropped — see `docs/DECISIONS.md` D-017.*


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
|tmdb\_rating|numeric(3,1)|*added later, migration 002.* TMDB's own score, captured once at ADD time and never refreshed (D-036). `vote_average: 0` means "no votes" on TMDB's scale, so it is stored as `null` rather than as a score of zero (D-037, migration 003)|
|review|text|nullable *(and, since migration 004, only permitted on a rated film — see the constraint note below)*|
|created\_at|timestamptz|default now()|

Unique constraint on `tmdb_id` — prevents adding the same movie twice, gives a clean DB-level answer to the "duplicate handling" UX requirement in § 3.4.

*Three check constraints exist as built, two of them added after this spec was written: `rating_range` and `tmdb_rating_range` (both 0–10), and `review_requires_rating` (migration 004, D-041) — a review may not exist on an unrated film, because the rating is the required half and the review the optional one. That rule previously lived only in the shape of the rate dialog. `db/schema.sql` is the canonical, current definition; this table is the spec's original design plus the annotations above.*

### 5.2 `recommendation_logs`

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

*Five more columns were added by migration 001 and are live: `prompt_tokens` and `completion_tokens` (the in/out split behind `tokens_used`), `duration_ms`, `status` (`'success'` | `'failed'`, default `'success'`) and `error_text` (populated only on a failure). They are what makes the "a row is written whether the call succeeds or fails" rule in § 4 of `docs/PROCESS.md` expressible. `db/schema.sql` is canonical.*

This table is the real DB payoff of the AI feature — it's not just "call the API and show the answer," it's "call the API and keep a real, queryable record of every call," which is a meaningfully different (and gradeable) thing.

### 5.3 `taste_verdict_logs`

|Column|Type|Notes|
|-|-|-|
|id|uuid, PK||
|created\_at|timestamptz|default now()|
|prompt\_version|text|e.g. `"v1"` — its own prompt file, versioned independently of recommendations|
|input\_movie\_ids|uuid\[]|all rated movies used as input (not just top-N — the verdict is about overall taste, not favorites)|
|verdict\_text|text|the model's one/two-sentence output, stored as-is *(2–3 sentences as shipped — see the annotation on § 2.3)*|
|model\_used|text|e.g. `"anthropic/claude-..."` via OpenRouter|
|tokens\_used|integer|from the OpenRouter response|
|estimated\_cost\_usd|numeric(10,6)|same cost-logging discipline as recommendations|

*Carries the same five migration-001 columns as § 5.2 — `prompt_tokens`, `completion_tokens`, `duration_ms`, `status`, `error_text` — deliberately identical, so the two features cannot drift into two different audit shapes. `db/schema.sql` is canonical.*

Smaller/lighter than § 5.2 by design — this is a low-stakes feature, but it still gets the same auditability treatment, not a shortcut.


## 6\. AI Features — Prompt Discipline

Applies to **both** AI features (§2.2 Recommendations, §2.3 Taste Verdict Banner) equally:

* Each feature has its **own versioned prompt file** — `prompts/recommend_v1.md` and `prompts/taste_verdict_v1.md` — never inlined as strings in application code, never sharing one file. *(Those two names are the pattern, and both files still exist untouched. The chains have since run to `recommend_v3` and `taste_verdict_v7`, which are the live versions; every superseded file is kept, and `docs/PROCESS.md` § 2 tabulates what each bump fixed.)*
* The recommendation prompt requires **structured JSON output** (array of `{title, reason}` objects) — the app must not depend on regex-parsing free-form prose.
* The taste verdict prompt requires a **short plain-text output** (one or two sentences as specified; 2–3 as shipped, see § 2.3) — no JSON needed here since there's nothing structured to extract, but a max-length instruction is included in the prompt so the banner can't get a five-paragraph response.
* The recommendation prompt explicitly instructs the model to suggest only real, existing movies — but the app **never trusts this claim**; every suggestion is verified against TMDB before being shown (§ 2.2, step 4). This is the concrete guard against the model hallucinating a title that doesn't exist *(and it does catch that case — an invented title returns nothing from TMDB and is dropped, which measurement confirmed is the common outcome rather than the rare one. What it does not promise is that the film shown is the one the model had in mind; see the annotation on § 2.2 step 4 and `docs/DECISIONS.md` D-054)*. The taste verdict feature has no equivalent fact-check need since it's pure opinion/commentary, not a factual claim.
* See CLAUDE.md § Security \& Secrets, item 5 ("Prompt injection awareness"), for how user-supplied review text — which feeds into *both* prompts — is handled safely. *(This pointed at a § Prompt Injection heading that does not exist in CLAUDE.md.)*


## 7\. Testing \& Acceptance Criteria

### 7.1 Must Pass Before Submission

* \[ ] Searching a real movie title returns real TMDB results with posters.
* \[ ] Adding a movie already in the list is blocked with a clear message, not a duplicate row.
* \[ ] Deleting and re-ranking works correctly with 0, 1, and many movies (edge cases, not just the happy path).
* \[ ] Recommendation action is disabled with an explanation below 3 rated movies.
* \[ ] A full recommendation run produces a logged row in `recommendation_logs` with real token/cost data, and shown suggestions have real, TMDB-verified posters — not AI-invented ones.
* \[ ] The Taste Verdict Banner is disabled/shows an explanation below 2 rated movies, and a triggered verdict produces a logged row in `taste_verdict_logs` with real token/cost data.
* \[ ] Killing network access to TMDB and to OpenRouter (independently) each produce a graceful inline error, not a broken page — this includes the banner falling back gracefully, not breaking the whole Home page.
* \[ ] `.gitignore` excludes `.env` from the first commit; `git log` confirms no key ever appears in history (see CLAUDE.md § Security \& Secrets).

### 7.2 Manual Demo Script (for grading)

*Two steps below have been overtaken by what got built, and the script in `README.md` is the one to actually follow. Step 2's "one-liner" is 2–3 sentences as shipped (see the annotation on § 2.3). Step 4 no longer needs Supabase at all: the app has an in-app **AI call log** viewer behind the footer button, showing both tables merged with prompt version, model, token split, duration, status and per-call cost — which is a stronger demonstration of the same point, and works in front of an audience without opening the database console. Opening the Supabase tables still works and remains a fair way to show the rows are real.*

1. Show an empty list → add 3-4 real movies via TMDB search, rate them.
2. Show the ranked list re-sorting live as ratings change, and the Taste Verdict Banner generating a fresh one-liner about the taste profile so far.
3. Trigger a recommendation run, narrate what's happening (top-N pulled → prompt sent → TMDB cross-check → logged).
4. Open both the `recommendation_logs` and `taste_verdict_logs` tables in Supabase directly, show the token/cost/prompt-version columns — this is the moment that proves it's not "just a ChatGPT wrapper."
5. Try adding a duplicate movie, try triggering recommendations with only 1 rated movie — show both graceful failure states.

