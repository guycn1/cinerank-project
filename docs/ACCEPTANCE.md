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
| 2 | Duplicate add is blocked with a clear message | not yet | — |
| 3 | Delete and re-rank at 0, 1 and many | not yet | — |
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
