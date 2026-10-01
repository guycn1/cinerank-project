# SPEC.md — CineRank

**Authors:** Guy Cohen \& Michael Chernyak · **Course:** [LLM-Augmented Software Practice (ASE-26)](DOSSIER.md)

**Status:** Live specification — annotated in place, never silently rewritten. The work runs as a co-evolution spiral; [the next section](#specification-status--the-co-evolution-spiral-module-10) records both units it can honestly be counted in.


## Specification status — the co-evolution spiral (Module 10)

A specification is the opening turn of a spiral rather than a fixed contract:
requirements emerge from attempted solutions, so the document has to be allowed to
learn. This section records the turns this one has actually been through, and the
commits that pinned each. It is written from `git log` — a record of what happened,
not a plan for what will.

**The convention this document follows, and why.** Where the built app diverged from
what [§ 1](#1-overview--problem-statement) to [§ 7](#7-testing--acceptance-criteria)
promised, the original text **stays exactly as written** and the correction is added
beside it as an italic parenthetical. Nothing is quietly edited to agree with the
code: a spec revised into agreement with its own implementation can no longer show
where the two ever differed, which is the one thing it is uniquely able to show.

**Eleven sections carry such an annotation**, named rather than counted so the
list cannot quietly go short as the spiral adds more:
[§ 1](#1-overview--problem-statement),
[§ 2.2](#22-ai-powered-recommendations-the-non-wrapper-part),
[§ 2.3](#23-taste-verdict-banner-the-fun-low-stakes-ai-touch),
[§ 3.4](#34-feedback-including-bad-states), [§ 4.3](#43-why-supabase),
[§ 4.5](#45-api-endpoints-draft), [§ 5.1](#51-movies),
[§ 5.2](#52-recommendation_logs), [§ 5.3](#53-taste_verdict_logs),
[§ 6](#6-ai-features--prompt-discipline) and [§ 7.2](#72-manual-demo-script).
**[§ 7.1](#71-must-pass-before-submission) is deliberately not among them:** its
italic note records that the eight criteria were MET and where the evidence
sits, which is a status rather than a place the build diverged from the spec.
Do not add it to round the list up.

**On counting turns, because there are two honest units and neither is wrong.**
[Module 10](DOSSIER.md#module-10-specifications-and-co-evolution-spiral) describes a spiral that runs fast inside a turn and pins
intent at named
commit points between turns. **In this repository the commit points are the merges
to `main`** — the first twenty-one each follow a milestone that was framed, built,
settled and then locked, after a working session of its own and dozens of commits on
`draft`. (Merges 22 to 30, which follow [`0cdc4ec`](https://github.com/guycn1/cinerank-project/commit/0cdc4eca14207a889af0fe1f7a10d6c099344b2e), the final planned one, are not
milestones. Merges 22 to 29 were defect fixes, the second of the three grounds
[`CLAUDE.md`](CLAUDE.md#version-control-workflow-non-negotiable) states, and the
[30th](https://github.com/guycn1/cinerank-project/commit/c330a2cdb88d8a9731566b783cda51ee0be73e53) was the close-out sync at the course's final assessment deadline on
2026-10-01, the third ground, and carried defect fixes too. Nothing here counts a merge as
a turn, so none of them touches the argument either way.)
Counted that way the project has been through as many turns as it has merges, and
`git log --merges main` is the authority on that number. It is deliberately not
repeated here: the same count already lives in
[`CLAUDE.md`](CLAUDE.md#build-status),
[`docs/PROCESS.md` § 1](docs/PROCESS.md#1-working-method) and
[`docs/MERGE-READINESS.md` § 5](docs/MERGE-READINESS.md#5-full-auditability--met),
and has drifted once before.

**[All three are now complete](https://github.com/guycn1/cinerank-project/commit/b1a08b604e1fc8d3f3d32962ab9ff9920fb96e5a)**, which is the form
[the course's requirement](DOSSIER.md#how-each-third-is-graded) takes:
a commit history across at least three *full* turns of the spiral. It holds under
the conservative reading deliberately — the three narratives below are whole, with
their own problem shifts, and none of the merges to `main` is being counted
as a turn in its own right. The merge-based count would satisfy the same
requirement many times over and is the weaker claim, because a merge is a commit
point rather than a change in the understanding of the problem.

The three turns below are a **coarser grouping** — by the moments when the
understanding of the PROBLEM changed, rather than by every point at which intent
was pinned. It is the more conservative unit, and it is used because three
narratives are more legible than a list of merges. Neither reading is the
authority over the other. The merges are the record; the three are the story.

**The three turns do not overlap.** Each is a range of commits that ends at a
merge to `main`, and the next turn starts with the first commit after that merge:

| Turn | Commits | Commit points (merges to `main`) |
|---|---|---|
| 1 | from the root commit [`a93326c`](https://github.com/guycn1/cinerank-project/commit/a93326c78b06b538b0dc91751862fdebbbfebaf3) through [`0525b8e`](https://github.com/guycn1/cinerank-project/commit/0525b8e7619d1b62d644d752a76c25369fd2cedf) — [23](https://github.com/guycn1/cinerank-project/commits/0525b8e7619d1b62d644d752a76c25369fd2cedf) | [`00932c2`](https://github.com/guycn1/cinerank-project/commit/00932c24a360227ecbe0025d3aa649d445d8c6b3), [`4a6b183`](https://github.com/guycn1/cinerank-project/commit/4a6b18335ce36ea9ed02ff047b98613852b011cf), [`0525b8e`](https://github.com/guycn1/cinerank-project/commit/0525b8e7619d1b62d644d752a76c25369fd2cedf) |
| 2 | after [`0525b8e`](https://github.com/guycn1/cinerank-project/commit/0525b8e7619d1b62d644d752a76c25369fd2cedf), through [`d47c960`](https://github.com/guycn1/cinerank-project/commit/d47c9601777e5d1f3759a986ba34a6f77bfb56c1) — [401](https://github.com/guycn1/cinerank-project/compare/0525b8e7619d1b62d644d752a76c25369fd2cedf...d47c9601777e5d1f3759a986ba34a6f77bfb56c1) | [`49738c2`](https://github.com/guycn1/cinerank-project/commit/49738c2d2c413815fa7877216553794049c6de95) to [`d47c960`](https://github.com/guycn1/cinerank-project/commit/d47c9601777e5d1f3759a986ba34a6f77bfb56c1), sixteen merges |
| 3 | after [`d47c960`](https://github.com/guycn1/cinerank-project/commit/d47c9601777e5d1f3759a986ba34a6f77bfb56c1), through [`0cdc4ec`](https://github.com/guycn1/cinerank-project/commit/0cdc4eca14207a889af0fe1f7a10d6c099344b2e) — [93](https://github.com/guycn1/cinerank-project/compare/d47c9601777e5d1f3759a986ba34a6f77bfb56c1...0cdc4eca14207a889af0fe1f7a10d6c099344b2e) | [`ba702c2`](https://github.com/guycn1/cinerank-project/commit/ba702c266d3ac7829f2c1d75b0230cbf86e0998d) and [`0cdc4ec`](https://github.com/guycn1/cinerank-project/commit/0cdc4eca14207a889af0fe1f7a10d6c099344b2e) |

*(Counted with `git rev-list --count` over each range, merges included:
23 + 401 + 93 = 517, the whole history up to [`0cdc4ec`](https://github.com/guycn1/cinerank-project/commit/0cdc4eca14207a889af0fe1f7a10d6c099344b2e).)*

### Turn 1 — frame, build, pin (2026-09-04 to 2026-09-05)

Commit points: [`00932c2`](https://github.com/guycn1/cinerank-project/commit/00932c24a360227ecbe0025d3aa649d445d8c6b3) to [`0525b8e`](https://github.com/guycn1/cinerank-project/commit/0525b8e7619d1b62d644d752a76c25369fd2cedf) — three merges to `main`.

[The first turn](https://github.com/guycn1/cinerank-project/commits/0525b8e7619d1b62d644d752a76c25369fd2cedf) ran fast and end to end — schema and versioned prompts ([`baab823`](https://github.com/guycn1/cinerank-project/commit/baab82343ffea42ba0818350ed9f0a5a9a37509f)),
the Express API with isolated service modules ([`d5e9702`](https://github.com/guycn1/cinerank-project/commit/d5e9702e7d84105e58d58616b51224b0c4f31e49)), the frontend
([`aee82b4`](https://github.com/guycn1/cinerank-project/commit/aee82b41557c1eb55e3425fdca2c01a80564ef0b)), and this document and [`CLAUDE.md`](CLAUDE.md) ([`aadaf18`](https://github.com/guycn1/cinerank-project/commit/aadaf188132b461cbfefedd1fa00d2c513029f41)). It closed at
[`0525b8e`](https://github.com/guycn1/cinerank-project/commit/0525b8e7619d1b62d644d752a76c25369fd2cedf), whose message reads "functionally complete against SPEC" — the stopping
condition [§ 7.1](#71-must-pass-before-submission) defines had been reached.

### Turn 2 — the interface requirement emerged from use (2026-09-05 to 2026-09-12)

Commit points: [`49738c2`](https://github.com/guycn1/cinerank-project/commit/49738c2d2c413815fa7877216553794049c6de95) to [`d47c960`](https://github.com/guycn1/cinerank-project/commit/d47c9601777e5d1f3759a986ba34a6f77bfb56c1) — both of them merges to `main`, with
fourteen more between them. The last, [`d47c960`](https://github.com/guycn1/cinerank-project/commit/d47c9601777e5d1f3759a986ba34a6f77bfb56c1), is the merge that completed the
front-end overhaul.

[§ 3.2](#32-hierarchy) deliberately declined to prescribe the visual treatment,
leaving layout, motion and typography to design judgement. Using the finished app is
what turned that open brief into concrete requirements — a requirement that could
not have been written before a solution was attempted. The work it produced is
tracked in [`CLAUDE.md` § Front-end overhaul](CLAUDE.md#front-end-overhaul-started-2026-09-05--complete-as-of-2026-09-12) rather than here, because that is working state
and this is intent: the [search](CLAUDE.md#search-section) and
[taste-verdict](CLAUDE.md#taste-verdict-section) sections reworked, a
[20-item ranked-list overhaul](CLAUDE.md#ranked-list), a 30-item recommendations
audit ([R1 to R30](CLAUDE.md#step-2--the-recommendations-sub-backlog-r1r30)), the
[mobile keypad fix](CLAUDE.md#step-1--the-mobile-keypad),
[links to the repository](CLAUDE.md#step-3--github-links),
[a favicon](CLAUDE.md#step-4--the-favicon),
[seven polish items](CLAUDE.md#step-4b--seven-polish-items), and a
[narrow-viewport pass](CLAUDE.md#step-5--the-portrait-overhaul) closed against an
agreed ~350px target.

**This turn holds a clear co-evolution point.** At [`2a1800c`](https://github.com/guycn1/cinerank-project/commit/2a1800c5790bfe96cdbd105578b4a4b7a1516c11),
[§ 2.2](#22-ai-powered-recommendations-the-non-wrapper-part) step 4's promise that
every suggestion is "cross-checked against TMDB" was measured against live TMDB
across 30 probe titles — and found to claim more than the code delivers. The
alternative was tightening the matcher until it met the promise; that was designed,
costed against the measurements, and rejected on the numbers. **The specification
was corrected and the code was left alone**
([`docs/DECISIONS.md` D-054](docs/DECISIONS.md#d-054--the-tmdb-verification-claim-was-softened-instead-of-the-matcher-being-tightened)).

### Turn 3 — the trail itself became the deliverable (2026-09-12 to 2026-09-14)

Commit points: [`ba702c2`](https://github.com/guycn1/cinerank-project/commit/ba702c266d3ac7829f2c1d75b0230cbf86e0998d) and [`0cdc4ec`](https://github.com/guycn1/cinerank-project/commit/0cdc4eca14207a889af0fe1f7a10d6c099344b2e) — **[93 commits](https://github.com/guycn1/cinerank-project/compare/d47c9601777e5d1f3759a986ba34a6f77bfb56c1...0cdc4eca14207a889af0fe1f7a10d6c099344b2e)** over three days, from
[`d1aba00`](https://github.com/guycn1/cinerank-project/commit/d1aba00ec865630c747f2692e8d3f10e2d9c3c42), the first commit after [`d47c960`](https://github.com/guycn1/cinerank-project/commit/d47c9601777e5d1f3759a986ba34a6f77bfb56c1), to [`0cdc4ec`](https://github.com/guycn1/cinerank-project/commit/0cdc4eca14207a889af0fe1f7a10d6c099344b2e), the final planned
merge, which pinned the turn.

It opened on the documents themselves: both this file and
[`CLAUDE.md`](CLAUDE.md) were found to be **rendering wrong on GitHub** — a fault
invisible in the source and never caught by eye. That produced a new verification
gate, [`npm run check-markdown`](scripts/check-markdown.js) ([`d1dd505`](https://github.com/guycn1/cinerank-project/commit/d1dd505cd101add3763036edf612bc2b96cdf94b)), [proved in both directions on 2026-09-13](https://github.com/guycn1/cinerank-project/commit/646307a2378a3c1d44291c017b69a09c6f6178f1)
across 57 cases, together with the authoring rules it enforces in
[`CLAUDE.md` § Markdown Authoring Rules](CLAUDE.md#markdown-authoring-rules-binding--every-md-file-in-this-repo).

**[This turn is closed.](https://github.com/guycn1/cinerank-project/commit/b1a08b604e1fc8d3f3d32962ab9ff9920fb96e5a)** Its stated closing conditions were the pre-submission
blocker list in
[`CLAUDE.md`](CLAUDE.md#pre-submission-blockers--all-ticked-as-of-2026-09-14) and
[§ 7.1](#71-must-pass-before-submission)'s acceptance checkboxes below; both were
met on 2026-09-14, and [`docs/MERGE-READINESS.md`](docs/MERGE-READINESS.md) reads
MET on all five of [Module 16](DOSSIER.md#module-16-review-and-quality-legacy-onboarding)'s criteria as a result.

What closed it is what the turn was about. The problem had stopped being "does the
application work" — it demonstrably did, deployed and green — and had become
"can any of that be shown to someone who was not here". Answering it produced two
evidence documents, [`docs/ACCEPTANCE.md`](docs/ACCEPTANCE.md) and
[`docs/RESILIENCE.md`](docs/RESILIENCE.md); the three
[the course's grading brief](DOSSIER.md#grading-rules) called for, [`docs/FRAMING.md`](docs/FRAMING.md),
[`docs/SECURITY.md`](docs/SECURITY.md) and
[`docs/MERGE-READINESS.md`](docs/MERGE-READINESS.md); [thirty-seven captures across
four families](docs/screenshots/README.md); and
[an architecture diagram](README.md#architecture). **It also produced
[three real defects and three untested happy paths](docs/MERGE-READINESS.md#what-changed-on-2026-09-13)**, none of which [the test suite](test/), [the linter](eslint.config.js) or
[the render audits](CLAUDE.md#when-a-change-is-structural-render-it-and-diff-the-html) had revealed, because each of those inspects structure and none of
them puts the application into a state and looks at it.

**[Merging to `main`](https://github.com/guycn1/cinerank-project/commit/0cdc4eca14207a889af0fe1f7a10d6c099344b2e) pins this turn rather than closing it** — it was closed by its
scope being complete, which is the distinction [Module 10](DOSSIER.md#module-10-specifications-and-co-evolution-spiral) draws between a commit
point and a turn boundary.


## 1\. Overview \& Problem Statement

Most "movie list" student projects stop at CRUD: add a movie, rate it, see a list sorted by rating. That's a fine skeleton but not a project — there's no real logic, no meaningful use of stored data beyond display.

**CineRank adds a real reason to have a database and a real reason to call an LLM:**

* The **database** doesn't just store movies — it tracks a growing taste profile (your rated movies + reviews) that gets read back later to ground AI recommendations, and it logs every AI recommendation ever generated (so recommendations are auditable, not throwaway). *(As built, a run whose log write fails is discarded rather than shown, and its cause goes to the server's stderr.)*
* The **AI (OpenRouter)** isn't answering open questions — it has exactly one narrow job: given your top-rated movies, suggest similar movies you haven't added yet, with a short reason per pick. It's a small, well-scoped feature, not the engine of the app. *(Well-scoped is exactly right and stays. "Small" undersells what that one job turned out to involve: the run reads the whole list, infers a sensibility from the top five rated films AND the review text attached to them, excludes everything already in the list, and compresses the justification for each pick into one second-person sentence of 8–16 words that has to point at a specific rating or a pattern across them — see [`prompts/recommend_v3.md`](prompts/recommend_v3.md). The scoping claim was never the problem; the size adjective was. The taste verdict of [§ 2.3](#23-taste-verdict-banner-the-fun-low-stakes-ai-touch) is a second narrow call beside this one.)*
* The **UI** should be genuinely polished and visually engaging — real typography, motion, and thoughtful visual hierarchy, not a generic default-component look. This project wants a fair amount of eye-candy; specific layout and visual choices are left open — see [§ 3](#3-interface-design-module-8) for priorities rather than a fixed look.

**Out of scope for v1 (explicit exclusions):**

* No user accounts / multi-user support — single personal movie list (see [CLAUDE.md § Security \& Scope](CLAUDE.md#security--scope-why-no-accounts--no-security-story) for why this isn't a security gap).
* No social features (sharing lists, following other users, public rankings).
* No editing/moderating AI suggestions beyond accepting or dismissing them.

*([Reconciled 2026-09-13](https://github.com/guycn1/cinerank-project/commit/d74e655a78f805670486bd2ac41ca6f29454e79b): [`CLAUDE.md` § Out of Scope](CLAUDE.md#out-of-scope-v1) carried a FOURTH exclusion this list never
had — no automatic or background regeneration of recommendations or verdicts. The
consolidated list, with the reason each one is there, is [`docs/FRAMING.md` § Out of
scope](docs/FRAMING.md#out-of-scope), which is now the authority. The three above stay as written rather than
being silently extended.)*


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
  2. Sends a **structured, versioned prompt** (see [§ 6](#6-ai-features--prompt-discipline)) to OpenRouter containing those titles + the user's own review text as taste signal.
  3. The model returns a **structured list** (title + one-sentence reason per suggestion) — not free-form prose the app has to parse with regex.
  4. Each suggested title is **cross-checked against TMDB** to confirm it's a real movie and to pull its real poster/year/overview — the AI never gets to invent poster URLs or years; it only picks titles, TMDB supplies the facts *(as built, this confirms every card shows **a real film**: a title TMDB returns nothing for is dropped, and a near-miss resolves to TMDB's top result, which rescues real films the model named imprecisely and now and then lands on a neighbouring one. A stricter match was [measured against live TMDB and deliberately not adopted](https://github.com/guycn1/cinerank-project/commit/2a1800c5790bfe96cdbd105578b4a4b7a1516c11) — see [`docs/DECISIONS.md` D-054](docs/DECISIONS.md#d-054--the-tmdb-verification-claim-was-softened-instead-of-the-matcher-being-tightened). The second half of this clause is exact as written: every fact on a card comes from TMDB, never from the model. The requirement stays as written, annotated, rather than being quietly rewritten to match the code)*.
  5. Suggestions already in the user's list are filtered out before being shown.
* Every recommendation run is **logged to the database** (prompt version, model used, input movie titles, raw output, token usage) — see [§ 5.2](#52-recommendation_logs) *(the column is `input_movie_ids` and holds ids, not titles: § 5.2 specifies `uuid[]`, so this bullet and the data model it points at disagreed from the start, and the build followed § 5.2. Every other item in this list is stored literally as named. The titles behind a run's ids are recoverable for films still in the list; what the user was actually SHOWN is stored as text in `suggested_titles` either way. And as built, a run whose log write fails is discarded rather than shown, with its cause sent to the server's stderr)*. This turns "the AI said something" into an auditable record, which matters for auditing what the AI actually did, and for debugging.
* Recommendations are a **snapshot, not live** — they don't regenerate automatically when new movies are rated; the user explicitly re-triggers when they want fresh ones.

### 2.3 Taste Verdict Banner (the fun, low-stakes AI touch)

* A banner on the Home view where an AI agent gives a short, playful one-or-two-sentence "verdict" on the user's movie taste *(as built this settled at **2–3 sentences, ~35–60 words** — [`taste_verdict_v3`](prompts/taste_verdict_v3.md) followed this line literally and produced a terse paraphrase of the ratings, so [v4](prompts/taste_verdict_v4.md) gave the room back; see [`docs/DECISIONS.md` D-014](docs/DECISIONS.md#d-014--taste-verdict-over-corrected--taste_verdict_v4). The requirement as written stays, annotated, rather than being quietly rewritten to match the code)*, based on their currently rated movies (titles + ratings, and optionally review text).
* Distinct from the recommendation feature in [§ 2.2](#22-ai-powered-recommendations-the-non-wrapper-part) — this is commentary, not suggestions. Tone should be light/teasing, not generic praise ("Five 10/10 action movies and zero dramas — you watch films to turn your brain off, and honestly? Respect.").
* Available once **at least 2 movies are rated** (lower bar than recommendations — this is just banter, it doesn't need much signal).
* Regenerated only on explicit user action (a small "New verdict" refresh button on the banner) — never silently regenerated on every page load, to avoid burning OpenRouter credit on an unrequested repeat call.
* Same DB-logging and TMDB-independent discipline as [§ 2.2](#22-ai-powered-recommendations-the-non-wrapper-part): every verdict call is logged ([§ 5.3](#53-taste_verdict_logs)) *(as built, a verdict whose log write fails is discarded rather than shown, with its cause sent to the server's stderr)*, and a failed/unreachable call shows a quiet fallback message on the banner ("Couldn't come up with a verdict right now") — it never blocks or breaks the rest of the page, since it's the lowest-stakes feature in the app.

### 2.4 Resilience Requirements

* If TMDB is unreachable: search/add flow shows a clear inline error; already-saved movies and their ratings remain fully usable.
* If OpenRouter is unreachable or returns malformed output (for either recommendations or the taste verdict banner): the affected panel shows a specific fallback message — the core rating/ranking flow is never blocked by either AI feature.


## 3\. Interface Design (Module 8)

**This section is the [Module 8](DOSSIER.md#module-8-interface-design-and-app-documentation)
interface brief itself**, not a summary of one —
[`docs/BRIEFS.md` § 1](docs/BRIEFS.md#1-interface-brief--the-home-screen)
nominates it and deliberately does not reproduce it, because a brief held in two
places drifts.

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
* **Failure state:** TMDB or OpenRouter failures produce a specific, calm inline message (see [§ 2.4](#24-resilience-requirements), the resilience requirements) — never a raw error dump or a silently broken button.
* **Duplicate handling:** attempting to add a movie already in the list shows a clear "Already in your list" message instead of a duplicate entry or a raw DB constraint error.

*A SIXTH feedback state exists as built and is not in the list above: submitting an EMPTY
search. It answers with the muted note "Type a film title to search." and returns the caret
to the input, rather than the silent no-op it was [until 2026-09-07](https://github.com/guycn1/cinerank-project/commit/fb3e017aa654be9e00a82a307c41c6c9ab592596). It is the nearest sibling
of Duplicate handling — a user-input mistake answered inline rather than ignored — and it is
absent here because it emerged from using the app rather than from this specification. What it
does, and the `400` `Missing search query` it makes unreachable, are in [`docs/RESILIENCE.md` under the errors the interface cannot
reach](docs/RESILIENCE.md#error-paths-the-interface-cannot-reach). Deliberately annotated rather than added as a
sixth bullet: a new bullet would read as though it had been specified all along, and where the
spec and the build diverged is what this document exists to keep readable.*


## 4\. Technical Architecture (Module 7)

**[Module 7](DOSSIER.md#module-7-modern-web-application-architecture) is about
holding the whole request cycle in mind rather than the details of any one
framework**, which is why [§ 4.4](#44-high-level-data-flow) traces a
recommendation run hop by hop rather than stopping at a list of parts. The hops
are where an agent's work has to be reviewed, so that trace is the part of this
section that gets used; [§ 4.1](#41-stack) to [§ 4.3](#43-why-supabase) name the
pieces it passes through.

### 4.1 Stack

* **Backend:** Node.js + Express.
* **Database:** Supabase (Postgres) — see [§ 5](#5-data-model-supabase--postgres) for schema.
* **Frontend:** HTML/CSS/JS — no framework required; the UI quality bar is met through deliberate design choices, not a generic component-library default look (see [§ 3.2](#32-hierarchy) and [CLAUDE.md's frontend-design notes](CLAUDE.md#frontend-design-notes)).
* **External API #1 (movie data):** TMDB (The Movie Database) — free tier, requires a free API key signup (instant approval, no review wait).
* **External API #2 (AI):** OpenRouter, using the existing $5-credit account.

### 4.2 Why TMDB

Free, well-documented, instant key approval, huge catalog, provides posters/overviews/years in one call.

### 4.3 Why Supabase

A real relational Postgres database supports the recommendation-log tables relationally (foreign keys to movies), and works from both local dev and any future deployment.

*There are **no foreign keys** in [`db/schema.sql`](db/schema.sql), and there never could have been: [§ 5.2](#52-recommendation_logs) and [§ 5.3](#53-taste_verdict_logs) both specify `input_movie_ids` as `uuid[]`, and Postgres has no per-element foreign key for an array column. So this parenthetical contradicted the data model in the same document from the day both were written — the build followed [§ 5](#5-data-model-supabase--postgres), which is the more specific of the two. The reference is by id and a join back to [`movies`](#51-movies) is a query rather than a constraint. Incident 1 ([CLAUDE.md § Incident log](CLAUDE.md#incident-log)) is the accidental argument for it: when films were deleted, the log rows survived holding ids that no longer resolve. A cascading foreign key would have destroyed exactly the audit trail those tables exist to keep. The requirement stays as written, annotated, rather than being quietly rewritten to match the code. The deployment it anticipates [happened on 2026-09-07](https://github.com/guycn1/cinerank-project/commit/1ab515febbf960d751596fdd50e1017fbb425178), and the same database serves the live app.*

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

*Three more endpoints exist as built, listed here rather than in the table above, which brings this section to all eleven: `GET /api/ai-log` (both log tables merged, newest 60 — the primary audit surface, and what the [in-app viewer](docs/AI-CALL-LOG.md) reads), `GET /api/config` (the two rated-film thresholds and the top-N count, so the server stays the single source of those numbers; the client's own copies are only a fallback for this request failing) and `GET /api/health` (liveness probe, used by Render). `/api/recommendations/history` [was kept alongside `/api/ai-log`](https://github.com/guycn1/cinerank-project/commit/bdfee8a27639cf4d4a2b64834d2e9b80adec1fb3) rather than dropped — see [`docs/DECISIONS.md` D-017](docs/DECISIONS.md#d-017--keep-apirecommendationshistory-rather-than-delete-it) — and is kept for good, [with two tests of its own](https://github.com/guycn1/cinerank-project/commit/596febecfb252a272075260d9fadb2a71b5043a7), since [D-077](docs/DECISIONS.md#d-077--apirecommendationshistory-is-kept-for-good-and-its-coverage-gap-is-closed-with-a-test-rather-than-a-deletion).*


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
|tmdb\_rating|numeric(3,1)|*[added later](https://github.com/guycn1/cinerank-project/commit/0b3864c59c1d13fb0c3987a4a8c19463dde202e3), [migration 002](db/migrations/002_tmdb_rating.sql).* TMDB's own score, captured once at ADD time and never refreshed ([D-036](docs/DECISIONS.md#d-036--tmdbs-rating-is-a-snapshot-taken-at-add-time-not-a-live-figure)). `vote_average: 0` means "no votes" on TMDB's scale, so it is stored as `null` rather than as a score of zero ([D-037](docs/DECISIONS.md#d-037--tmdbs-vote_average-0-is-an-absence-not-a-score), [migration 003](db/migrations/003_tmdb_rating_zero_is_null.sql))|
|review|text|nullable *(and, [since](https://github.com/guycn1/cinerank-project/commit/f7f904620f2e1b24fe080ef8dbdeeb20f04b4b9e) [migration 004](db/migrations/004_review_requires_rating.sql), only permitted on a rated film — see the constraint note below)*|
|created\_at|timestamptz|default now()|

Unique constraint on `tmdb_id` — prevents adding the same movie twice, gives a clean DB-level answer to the "duplicate handling" UX requirement in [§ 3.4](#34-feedback-including-bad-states).

*Three check constraints exist as built, two of them added after this spec was written: `rating_range` and `tmdb_rating_range` (both 0–10), and `review_requires_rating` ([migration 004](db/migrations/004_review_requires_rating.sql), [D-041](docs/DECISIONS.md#d-041--a-rating-less-review-is-forbidden-by-the-database-not-displayed-by-the-renderer)) — a review may not exist on an unrated film, because the rating is the required half and the review the optional one. That rule previously lived only in the shape of the rate dialog. [`db/schema.sql`](db/schema.sql) is the canonical, current definition; this table is the spec's original design plus the annotations above.*

### 5.2 `recommendation_logs`

|Column|Type|Notes|
|-|-|-|
|id|uuid, PK||
|created\_at|timestamptz|default now()|
|prompt\_version|text|e.g. `"v1"` — see [§ 6](#6-ai-features--prompt-discipline)|
|input\_movie\_ids|uuid\[]|the top-N movies used as taste signal|
|raw\_model\_output|jsonb|exactly what the model returned, unmodified *(as built: `{ text, parsed, verification }` — the reply as received, the picks parsed from it, and the per-title verification tally; null when no reply arrived)*|
|suggested\_titles|text\[]|parsed titles, post-validation|
|model\_used|text|e.g. `"anthropic/claude-..."` via OpenRouter|
|tokens\_used|integer|from the OpenRouter response|
|estimated\_cost\_usd|numeric(10,6)|logged per call, per course requirement on cost tracking|

*Five more columns were [added](https://github.com/guycn1/cinerank-project/commit/b3e3446c13622f825f682b62b9465d172529d345) by [migration 001](db/migrations/001_ai_log_details.sql) and are live: `prompt_tokens` and `completion_tokens` (the in/out split behind `tokens_used`), `duration_ms`, `status` (`'success'` | `'failed'`, default `'success'`) and `error_text` (populated only on a failure). They are what makes the "a row is written whether the call succeeds or fails" rule in [§ 4 of `docs/PROCESS.md`](docs/PROCESS.md#4-making-failure-visible-module-13) expressible; a run whose log write fails is discarded rather than shown, with its cause sent to the server's stderr. [`db/schema.sql`](db/schema.sql) is canonical.*

This table is the real DB payoff of the AI feature — it's not just "call the API and show the answer," it's "call the API and keep a real, queryable record of every call," which is a meaningfully different thing.

### 5.3 `taste_verdict_logs`

|Column|Type|Notes|
|-|-|-|
|id|uuid, PK||
|created\_at|timestamptz|default now()|
|prompt\_version|text|e.g. `"v1"` — its own prompt file, versioned independently of recommendations|
|input\_movie\_ids|uuid\[]|all rated movies used as input (not just top-N — the verdict is about overall taste, not favorites)|
|verdict\_text|text|the model's one/two-sentence output, stored as-is *(2–3 sentences as shipped — see the annotation on [§ 2.3](#23-taste-verdict-banner-the-fun-low-stakes-ai-touch))*|
|model\_used|text|e.g. `"anthropic/claude-..."` via OpenRouter|
|tokens\_used|integer|from the OpenRouter response|
|estimated\_cost\_usd|numeric(10,6)|same cost-logging discipline as recommendations|

*Carries the same five [migration-001](db/migrations/001_ai_log_details.sql) columns as [§ 5.2](#52-recommendation_logs) — `prompt_tokens`, `completion_tokens`, `duration_ms`, `status`, `error_text` — deliberately identical, so the two features cannot drift into two different audit shapes. [`db/schema.sql`](db/schema.sql) is canonical.*

Smaller/lighter than [§ 5.2](#52-recommendation_logs) by design — this is a low-stakes feature, but it still gets the same auditability treatment, not a shortcut.


## 6\. AI Features — Prompt Discipline

Applies to **both** AI features ([§2.2](#22-ai-powered-recommendations-the-non-wrapper-part) Recommendations, [§2.3](#23-taste-verdict-banner-the-fun-low-stakes-ai-touch) Taste Verdict Banner) equally:

* Each feature has its **own versioned prompt file** — [`prompts/recommend_v1.md`](prompts/recommend_v1.md) and [`prompts/taste_verdict_v1.md`](prompts/taste_verdict_v1.md) — never inlined as strings in application code, never sharing one file. *(Those two names are the pattern, and both files still exist untouched. The chains have since run to [`recommend_v3`](prompts/recommend_v3.md) and [`taste_verdict_v7`](prompts/taste_verdict_v7.md), which are the live versions; every superseded file is kept, and [`docs/PROCESS.md` § 2](docs/PROCESS.md#2-prompt-engineering-as-version-control) tabulates what each bump fixed.)*
* The recommendation prompt requires **structured JSON output** (array of `{title, reason}` objects) — the app must not depend on regex-parsing free-form prose.
* The taste verdict prompt requires a **short plain-text output** (one or two sentences as specified; 2–3 as shipped, see [§ 2.3](#23-taste-verdict-banner-the-fun-low-stakes-ai-touch)) — no JSON needed here since there's nothing structured to extract, but a max-length instruction is included in the prompt so the banner can't get a five-paragraph response.
* The recommendation prompt explicitly instructs the model to suggest only real, existing movies — but the app **never trusts this claim**; every suggestion is verified against TMDB before being shown ([§ 2.2](#22-ai-powered-recommendations-the-non-wrapper-part), step 4). This is the concrete guard against the model hallucinating a title that doesn't exist *(and it does catch that case — an invented title returns nothing from TMDB and is dropped, which measurement confirmed is the common outcome rather than the rare one. What it does not promise is that the film shown is the one the model had in mind; see the annotation on § 2.2 step 4 and [`docs/DECISIONS.md` D-054](docs/DECISIONS.md#d-054--the-tmdb-verification-claim-was-softened-instead-of-the-matcher-being-tightened))*. The taste verdict feature has no equivalent fact-check need since it's pure opinion/commentary, not a factual claim.
* See [CLAUDE.md § Security \& Secrets](CLAUDE.md#security--secrets-module-17), item 5 ("Prompt injection awareness"), for how user-supplied review text — which feeds into *both* prompts — is handled safely. **The guard is also demonstrated rather than only described: [`docs/screenshots/pi-1` … `pi-5`](docs/screenshots/README.md#pi---prompt-injection) capture a seeded film whose review is a real injection attempt, with both features unaffected and the app's own "Based on:" line confirming the attack text reached the prompt. Mapped against [OWASP ASI01 in `docs/SECURITY.md`](docs/SECURITY.md#asi01--agent-goal-hijack).**


## 7\. Testing \& Acceptance Criteria

### 7.1 Must Pass Before Submission

***All eight were [ticked on 2026-09-14](https://github.com/guycn1/cinerank-project/commit/4d433d135d4cefc7b1db9c0fc739082a4c1dee30) by the authors, against the evidence assembled in [`docs/ACCEPTANCE.md`](docs/ACCEPTANCE.md) — which walks each criterion one at a time, classifies its evidence by strength, and stops short of ticking, because that claim is the authors’ to make and not the agent’s.*** *Server behaviour for these is covered by [`npm test`](test/). What a user SEES in each failing case is captured and analysed in [`docs/RESILIENCE.md`](docs/RESILIENCE.md) — sixteen states, twenty-four frames — and the prompt-injection evidence is in [`docs/SECURITY.md` under ASI01](docs/SECURITY.md#asi01--agent-goal-hijack). [`docs/screenshots/README.md`](docs/screenshots/README.md) indexes every capture in the repository.*

* \[x] Searching a real movie title returns real TMDB results with posters.
* \[x] Adding a movie already in the list is blocked with a clear message, not a duplicate row.
* \[x] Deleting and re-ranking works correctly with 0, 1, and many movies (edge cases, not just the happy path).
* \[x] Recommendation action is disabled with an explanation below 3 rated movies.
* \[x] A full recommendation run produces a logged row in [`recommendation_logs`](#52-recommendation_logs) with real token/cost data, and shown suggestions have real, TMDB-verified posters — not AI-invented ones.
* \[x] The Taste Verdict Banner is disabled/shows an explanation below 2 rated movies, and a triggered verdict produces a logged row in [`taste_verdict_logs`](#53-taste_verdict_logs) with real token/cost data.
* \[x] Killing network access to TMDB and to OpenRouter (independently) each produce a graceful inline error, not a broken page — this includes the banner falling back gracefully, not breaking the whole Home page. *(Captured and analysed in [`docs/RESILIENCE.md`](docs/RESILIENCE.md): TMDB down across three surfaces as [RS-1](docs/RESILIENCE.md#rs-1--searching), [RS-2](docs/RESILIENCE.md#rs-2--adding-a-film) and [RS-3](docs/RESILIENCE.md#rs-3--verifying-recommendations); OpenRouter down across both AI features as [RS-4](docs/RESILIENCE.md#rs-4--recommendations) and [RS-5](docs/RESILIENCE.md#rs-5--the-taste-verdict). Two further states go beyond what this criterion asks — the database unreachable, [RS-7](docs/RESILIENCE.md#rs-7--supabase-down), and the app’s own server unreachable from an already-open page, [RS-6](docs/RESILIENCE.md#rs-6--the-apps-own-server-is-gone).)*
* \[x] [`.gitignore`](.gitignore) excludes `.env` from the first commit; `git log` confirms no key ever appears in history (see [CLAUDE.md § Security \& Secrets](CLAUDE.md#security--secrets-module-17)).

### 7.2 Manual Demo Script

*Four steps below have been overtaken by what got built, and the script in [`README.md`](README.md#demo-script) is the one to actually follow. Step 1's empty list is no longer where the app opens: it ships with a seven-film demo list ([`docs/DECISIONS.md` D-068](docs/DECISIONS.md#d-068--the-demo-seed-list-needs-a-two-axis-persona-because-a-one-axis-one-starves-both-ai-features-at-once)), so the README's script starts from that, and an empty list is shown in [`docs/ACCEPTANCE.md`](docs/ACCEPTANCE.md#3--deleting-and-re-ranking-works-correctly-with-0-1-and-many-movies) instead. Step 2's "one-liner" is 2–3 sentences as shipped (see the annotation on [§ 2.3](#23-taste-verdict-banner-the-fun-low-stakes-ai-touch)). Step 4 no longer needs Supabase at all: the app has an in-app [**AI call log**](docs/AI-CALL-LOG.md) viewer behind the footer button, showing both tables merged with prompt version, model, token split, duration, status and per-call cost — which is a stronger demonstration of the same point, and works in front of an audience without opening the database console. Opening the Supabase tables still works and remains a fair way to show the rows are real. Step 5's two states are refused before any request is sent: an Add button for a film already in the list is disabled and reads `In your list`, and below the threshold the recommendation trigger is disabled with the reason beside it, which are the graceful states to show.*

1. Show an empty list → add 3-4 real movies via TMDB search, rate them.
2. Show the ranked list re-sorting live as ratings change, and the Taste Verdict Banner generating a fresh one-liner about the taste profile so far.
3. Trigger a recommendation run, narrate what's happening (top-N pulled → prompt sent → TMDB cross-check → logged).
4. Open both the [`recommendation_logs`](#52-recommendation_logs) and [`taste_verdict_logs`](#53-taste_verdict_logs) tables in Supabase directly, show the token/cost/prompt-version columns — this is the moment that proves it's not "just a ChatGPT wrapper."
5. Try adding a duplicate movie, try triggering recommendations with only 1 rated movie — show both graceful failure states.

