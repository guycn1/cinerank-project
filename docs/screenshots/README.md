# Screenshots — index

Twenty-eight captures, in four families. Every one is the real application in the
state described; none is a mock-up or an annotated composite.

**Nothing here is marked up.** No arrows, no highlight boxes, no captions burnt
into the pixels. Where a particular row or line matters, the surrounding prose
says which — an unedited capture is stronger evidence than one a reader has to
take on trust.

| Family | Count | What it is | Discussed in |
|---|---|---|---|
| `rs-*` | 15 | Ten resilience and non-error states | [`../RESILIENCE.md`](../RESILIENCE.md) |
| `pi-*` | 5 | Prompt-injection attempt and both features resisting it | [`../SECURITY.md`](../SECURITY.md) § ASI01 |
| `readme-*` | 3 | Product showcase | [`../../README.md`](../../README.md) |
| `ac-*` | 5 | Evidence for a `SPEC.md` § 7.1 acceptance criterion | [`../ACCEPTANCE.md`](../ACCEPTANCE.md) |

## `rs-*` — resilience and state

Recipes for reproducing each of these are in `CLAUDE.md` as `RS-1` … `RS-10`.
Five states need two frames. For four of them the claim is split between what the
user sees and what the audit trail records; for `RS-10` it is split across time,
because the state is a race and a single still cannot show one.

| File | State | What it establishes |
|---|---|---|
| [`rs-1-tmdb-down-on-search.png`](rs-1-tmdb-down-on-search.png) | TMDB down, searching | Plain-language error; ranked list intact; stored TMDB scores still render |
| [`rs-2-tmdb-down-on-add.png`](rs-2-tmdb-down-on-add.png) | TMDB down, adding | The failure message names the film it is about |
| [`rs-3-tmdb-down-during-recs.png`](rs-3-tmdb-down-during-recs.png) | TMDB down mid-run | A charged AI call that produced nothing, and says why accurately |
| [`rs-3-tmdb-down-during-recs-log.png`](rs-3-tmdb-down-during-recs-log.png) | …its log row | `success`, real cost, zero suggestions |
| [`rs-4-openrouter-down-recs.png`](rs-4-openrouter-down-recs.png) | OpenRouter down, recommendations | Calm sentence, no technical detail, no cost footer |
| [`rs-4-openrouter-down-recs-log.png`](rs-4-openrouter-down-recs-log.png) | …its log row | `failed` with the real cause, `OpenRouter responded 401` |
| [`rs-5-openrouter-down-verdict.png`](rs-5-openrouter-down-verdict.png) | OpenRouter down, verdict | The second feature failing in the same words as the first |
| [`rs-5-openrouter-down-verdict-log.png`](rs-5-openrouter-down-verdict-log.png) | …its log row | Two failures adjacent, two features, two models |
| [`rs-6-cinerank-unreachable.png`](rs-6-cinerank-unreachable.png) | The app's own server stopped | `fetch` itself rejects; engine wording never surfaces; list survives |
| [`rs-7-database-unreachable.png`](rs-7-database-unreachable.png) | Supabase down | The one state where an empty list is correct; both AI triggers locked |
| [`rs-8-search-no-matches.png`](rs-8-search-no-matches.png) | No matches (**not** a failure) | Muted, not crimson — compare directly with `rs-1` |
| [`rs-9-zero-recommendations.png`](rs-9-zero-recommendations.png) | Nothing to suggest (**not** a failure) | Cost still declared for a run that returned nothing |
| [`rs-9-zero-recommendations-log.png`](rs-9-zero-recommendations-log.png) | …its log row | Near-identical to `rs-3`'s row, opposite meaning |
| [`rs-10-row-deleted-mid-edit-before.png`](rs-10-row-deleted-mid-edit-before.png) | A row deleted mid-edit — before | Two independent views agree: eight films, the film being edited at #1 |
| [`rs-10-row-deleted-mid-edit-after.png`](rs-10-row-deleted-mid-edit-after.png) | …after | One view deleted it; the other has not noticed, and its save returns 404 with the typed review intact |

**Two pairs are meant to be read against each other.** `rs-1` and `rs-8` are the
same panel in the same position, one crimson because something failed and one
muted because nothing did. `rs-3`'s log row and `rs-9`'s are nearly
indistinguishable — both `success`, both charged, both empty — and mean opposite
things, which the application tells apart correctly on the page.

## `pi-*` — prompt injection

A seeded film (*The Room*) whose review is itself an attack: instruction override,
system-prompt exfiltration and output hijack in one string. Added with
`npm run seed-demo -- --with-injection`, captured, then removed.

| File | What it establishes |
|---|---|
| [`pi-1-injection-review-stored.png`](pi-1-injection-review-stored.png) | The attack stored and rendered as inert plain text — `textContent`, never `innerHTML` |
| [`pi-2-verdict-resists.png`](pi-2-verdict-resists.png) | The taste verdict entirely on topic, real cost declared |
| [`pi-3-recommendations-resist.png`](pi-3-recommendations-resist.png) | Four real TMDB-verified films — and the "Based on:" line proving the attack reached the prompt |
| [`pi-4-verdict-with-input.png`](pi-4-verdict-with-input.png) | Attack and verdict in one frame (full page) |
| [`pi-5-recommendations-with-input.png`](pi-5-recommendations-with-input.png) | Attack and recommendations in one frame (full page) |

**`pi-3` carries the load.** Its "Based on:" line names *The Room* among the five
films whose reviews fed that prompt. Without it a reader would have to take on
trust that the injection was ever delivered, and a system resisting something it
was never sent proves nothing.

## `ac-*` — acceptance criteria

Evidence for the numbered criteria in `SPEC.md` § 7.1. The number in the
filename is the criterion it belongs to, and each is embedded beneath that
criterion's entry in [`../ACCEPTANCE.md`](../ACCEPTANCE.md).

| File | Criterion | What it establishes |
|---|---|---|
| [`ac-1-search-real-results.png`](ac-1-search-real-results.png) | 1 | A live search for a real title returning real TMDB results, each with a poster, year and score |
| [`ac-2-duplicate-add-blocked.png`](ac-2-duplicate-add-blocked.png) | 2 | A film already in the list showing a disabled "In your list" button beside live "+ Add" rows — with that film visible in the ranking below |
| [`ac-3-ranking-one-film.png`](ac-3-ranking-one-film.png) | 3, 4, 6 | A single rated film: rank 1, a `1 film` subtitle, and both AI features locked with their thresholds explained |
| [`ac-3-ranking-empty.png`](ac-3-ranking-empty.png) | 3 | An empty list: the empty-state line, and deliberately no subtitle |
| [`ac-8-first-commit.png`](ac-8-first-commit.png) | 8 | The repository root commit on GitHub: 0 parents, one file, one line of README — nothing a secret could hide in |

## `readme-*` — product showcase

| File | What it shows |
|---|---|
| [`readme-1-hero-ranked-list.png`](readme-1-hero-ranked-list.png) | The whole product in one glance, with a live verdict above the list |
| [`readme-2-recommendations.png`](readme-2-recommendations.png) | Four recommendations, grounded in a named taste profile, cost declared |
| [`readme-3-ai-call-log.png`](readme-3-ai-call-log.png) | The audit trail: prompt version, model, token split, duration, status, cost |

`readme-1` is self-proving and worth a second look: the verdict's phrases *"real
trucks in a real desert"* and *"Elphaba belting her lungs out"* are both lifted
from film reviews visible **in the same image**, so the grounding can be checked
without leaving the frame.

## A note on file sizes

These are full-resolution captures, deliberately. Several exceed 3 MB. They are
evidence, and re-encoding evidence to save bandwidth would mean the committed
image is no longer the one that came off the screen.
