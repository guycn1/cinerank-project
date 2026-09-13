# Acceptance — `SPEC.md` § 7.1, criterion by criterion

`SPEC.md` § 7.1 lists eight things that must pass before submission. This document
walks them one at a time and attaches the evidence for each, so that ticking a box
is a review of something written down rather than a recollection.

**Ticking an acceptance criterion is a claim that it was verified.** That claim
belongs to the authors, not to the agent that helped build the thing — so this
file assembles the evidence and stops there. The boxes in `SPEC.md` are ticked by
hand.

## How evidence is classified here

Not all evidence is the same strength, and saying which kind each criterion rests
on is more useful than a uniform tick:

| Kind | What it means |
|---|---|
| **Automated** | An assertion in `npm test` that fails if the behaviour regresses. The strongest kind, because it keeps being true. |
| **Captured** | A screenshot of the real application in the state described. Proves it happened once, on a real dependency. |
| **Repeatable command** | Something anyone can re-run and read the output of. |
| **Hand-verified** | Someone used the application and saw it. Weakest, and stated as such where it is all there is. |

**Where a criterion is only partly covered, this document says so.** A mapping
that claimed uniform coverage would be worth less than the criteria themselves.

## Status

| # | Criterion (abbreviated) | Assessed | Evidence |
|---|---|---|---|
| 1 | Search returns real TMDB results with posters | **yes** | Automated + captured + repeatable |
| 2 | Duplicate add is blocked with a clear message | **yes** | Automated + captured, three layers |
| 3 | Delete and re-rank at 0, 1 and many | **yes** | Automated + captured at all three sizes |
| 4 | Recommendations disabled below 3 rated films | not yet | — |
| 5 | A full recommendation run: logged row, verified posters | not yet | — |
| 6 | Verdict disabled below 2 rated films, logged row | not yet | — |
| 7 | TMDB and OpenRouter killed independently, graceful each time | not yet | — |
| 8 | `.env` gitignored from commit 1, no key in history | not yet | — |

Entries are added as each is worked through. A criterion marked *not yet* means
nobody has assembled its evidence, **not** that it fails.

## 1 · Searching a real movie title returns real TMDB results with posters

**Assessed 2026-09-13. Three independent kinds of evidence.**

### Captured

![The search panel showing four real TMDB results for the query "avatar", each
with a poster, year and TMDB score](screenshots/ac-1-search-real-results.png)

A live search for `avatar` returning four real TMDB titles — *Avatar* (2009),
*Avatar: Fire and Ash* (2025), *Avatar Aang: The Last Airbender* (2026) and
*Avatar: The Way of Water* (2022) — each with its real poster, its year and TMDB's
own score. The Add buttons sit in their resting state because none is in the list.

The fourth row clipping at the panel edge is the results panel's height cap doing
its job, not a cropping artefact; the scrollbar shows more results below.

### Automated

`test/routes.test.js` — *"GET /api/movies/search returns shaped TMDB results,
posters included"*. It asserts the whole shaped contract rather than a truthy
response, because every field is depended on downstream:

| Field | Asserted |
|---|---|
| `tmdb_id` | the id the add path posts back |
| `title` | passed through |
| `year` | a **number** sliced from `release_date`, not the raw date string |
| `poster_url` | an **absolute** URL built from the image base, not TMDB's bare path |
| `tmdb_rating` | rounded to one decimal |
| `description` | present |

A second fixture result deliberately carries **no** `poster_path`, because TMDB
genuinely omits it for some titles and the client draws its own placeholder
(`D-027`). The shaped value must be `null` — not an empty string, and not a URL
ending in the word "null".

**Verified load-bearing rather than merely green.** Removing the null guard in
`toPosterUrl()` fails this test. Returning `year` as a string instead of a number
fails it too, and incidentally fails an existing recommendations test — a useful
signal that the field travels further than this route.

**This test was written on 2026-09-13, while assembling this document.** Until
then the suite had exactly two search tests, both failure paths: the 400 for a
missing query and the 502 for TMDB being unreachable. `MATRIX_TMDB`, the one
fixture carrying a poster, was used only by the *add* tests. So the single
behaviour this criterion asserts was the one search behaviour nothing checked —
which is the sort of thing a mapping exercise is for.

### Repeatable command

```
npm run seed-demo
```

A dry run resolves every seed film through `/api/movies/search` and prints what
came back — eight films, eight exact title-and-year matches, each with its TMDB
id. It writes nothing. Anyone can re-run it and read the output.

### Verdict

**Satisfied.** Automated coverage that fails on regression, a capture of the real
application against live TMDB, and a command anyone can re-run. This is currently
the best-evidenced of the eight.

## 2 · Adding a movie already in the list is blocked with a clear message, not a duplicate row

**Assessed 2026-09-13. Satisfied at three independent layers**, which is worth
stating separately because the criterion makes two claims — that the attempt is
*blocked with a clear message*, and that no *duplicate row* results — and they are
guaranteed by different things.

### Captured

![A search for "Mad Max" where the film already in the list shows a disabled "In
your list" button while three others offer "+ Add", with that film also visible at
rank 1 below](screenshots/ac-2-duplicate-add-blocked.png)

One query, four results, and the contrast is the evidence:

* **Mad Max: Fury Road** — already in the list. The button reads **"In your
  list"** and is **disabled**. The action is not offered.
* **Mad Max** (1979), **Furiosa**, **Beyond Thunderdome** — not in the list. Live
  **"+ Add"** buttons.

**And the same frame proves the premise.** Fury Road is visible at rank 1 in the
ranking below, with its rating and review. A capture showing only the disabled
button would prove the message appears; this one also proves the film really is
already there, which is the other half of what the criterion asserts.

### Automated

`test/routes.test.js` — *"POST /api/movies for a movie already in the list → 409"*.
Asserts the status **and** that the body carries `Already in your list`, so a
regression to a bare 409, or to a generic 500, fails it.

### The three layers

| Layer | Mechanism | Which half of the criterion it guarantees |
|---|---|---|
| Database | `tmdb_id integer not null unique` (`db/schema.sql`) | **No duplicate row** — not discouraged, impossible |
| Route | Postgres `23505` mapped to **409** with `Already in your list` (`server/routes/movies.js`) | A clear message rather than a generic failure |
| Client | `setAddButtonState()` disables the button, labels it `In your list`, and sets an accessible name of *"{title} is already in your list"* | **Blocked** — the action is never offered |

**The layers are not redundant.** The client prevents, the route explains, and the
schema makes the bad outcome unreachable even if both were bypassed — by a direct
API call, say, or by two tabs racing each other.

### A note on what could not be captured

The **409 toast** itself is not photographed here, and reaching it from the
interface is genuinely awkward: the button is disabled, so it cannot normally be
clicked. It was reachable through a stale-button race — adding a film from the
search panel while a recommendation card still offered it — and `R3` closed that by
making the Add-button sync document-wide rather than panel-scoped.

So the path no camera caught is one the application no longer exposes. The route
test covers it, which is the right place for a state the interface is designed to
make unreachable.

### Verdict

**Satisfied.** Automated coverage of the server contract, a capture proving both
halves of the claim in one frame, and a schema constraint that makes the forbidden
outcome impossible rather than merely handled.

## 3 · Deleting and re-ranking works correctly with 0, 1, and many movies

**Assessed 2026-09-13.** This is the criterion that explicitly asks for *edge
cases, not just the happy path*, so the two edge sizes were produced deliberately
rather than waited for: the demo list was emptied one film at a time, captured at
one and at zero, and rebuilt from `scripts/seed-demo.js` afterwards.

### Captured — one film

![The application with a single rated film, showing rank 1, a "1 film" subtitle,
and both AI features locked](screenshots/ac-3-ranking-one-film.png)

The subtitle reads **"1 film"** — singular, and with no "not rated yet" clause,
because every film present is rated. That is `rankedCountLabel()`’s all-rated
branch, and getting the pluralisation right at exactly one is the kind of thing
that is only ever seen in this state.

The card holds rank **1** with no tie marker, which is `displayedRanking()`
behaving at a list length of one.

**This frame also evidences criteria 4 and 6**, and is referenced again there:
with one rated film both AI features are below threshold, so each shows a
disabled trigger beside an explanation naming the number required and the number
held.

### Captured — zero films

![The application with an empty list, showing the empty-state line and no
subtitle](screenshots/ac-3-ranking-empty.png)

*"No movies yet — search for one above to get started."*, and **no subtitle at
all** beside the heading.

**That absence is deliberate, and it was checked rather than assumed.**
`renderRanked()` guards the subtitle behind the count, because
`rankedCountLabel(0, 0)` would return `"0 films"` — which, sitting directly above
*"No movies yet"*, says nothing twice. The guard had no comment explaining itself
until this capture prompted the question, and now does, so a later tidy-up cannot
simplify it into an unconditional call and quietly restore the redundancy.

### Captured — many

Already evidenced by several existing frames rather than re-shot;
`screenshots/readme-1-hero-ranked-list.png` shows seven films with ranks 1 to 3
and the `7 films · 1 not rated yet` subtitle.

### Automated

`test/routes.test.js`, two tests, **both written on 2026-09-13 while assembling
this entry** — the endpoint had no coverage at all before:

* *"DELETE /api/movies/:id → 204 with no body"* — the status, an empty body, and
  that a delete reaches the movies table.
* *"DELETE /api/movies/:id when the database rejects it → 500, not a false 204"* —
  the failure shape that matters. Without the route’s error guard a failed delete
  would answer 204, telling the user a film is gone while it is still there.
  Verified load-bearing: removing that guard fails this test and nothing else.

**The gap was conspicuous once looked at.** `test/helpers.js` has defined a
`del()` client method since it was written, and nothing had ever called it.

### What is deliberately not asserted

Two limits, stated rather than papered over:

* **That the correct row was deleted.** The fake Supabase builder’s `.eq()` is a
  no-op, so an assertion about the id would pass whatever the route filtered on.
  That is the trap `D-046` records — a test that passed against buggy code because
  the fake ignored the filter causing the bug. Writing it would manufacture false
  confidence.
* **`displayedRanking()` has no unit test.** It lives in `public/app.js`, a browser
  script the Node runner cannot import, and the client has no test harness. Its
  behaviour at 0, 1 and many is evidenced by the captures above rather than by
  assertions.

### Verdict

**Satisfied.** Server-side deletion is covered by tests including its failure
shape; the ranking is captured at all three sizes the criterion names; and the two
places where evidence is observational rather than automated are named above
instead of being left for a reader to discover.
