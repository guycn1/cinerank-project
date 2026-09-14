# Acceptance — `SPEC.md` § 7.1, criterion by criterion

`SPEC.md` § 7.1 lists eight things that must pass before submission. This document
walks them one at a time and attaches the evidence for each, so that ticking a box
is a review of something written down rather than a recollection.

**Ticking an acceptance criterion is a claim that it was verified.** That claim
belongs to the authors, not to the agent that helped build the thing — so this
file assembles the evidence and stops there. The boxes in `SPEC.md` are ticked by
hand.

**They were ticked on 2026-09-14**, by the authors, against what is written
below. This document is the basis for that decision rather than a record of it:
it was complete, and every criterion read a clean `yes`, before any box was
marked.

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
| 4 | Recommendations disabled below 3 rated films | **yes** | Automated + captured |
| 5 | A full recommendation run: logged row, verified posters | **yes** | Automated + captured |
| 6 | Verdict disabled below 2 rated films, logged row | **yes** | Automated + captured |
| 7 | TMDB and OpenRouter killed independently, graceful each time | **yes** | Automated + 13 captures |
| 8 | `.env` gitignored from commit 1, no key in history | **yes** | Repeatable commands + captured |

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

## 4 · The recommendation action is disabled with an explanation below 3 rated movies

**Assessed 2026-09-13.** The criterion has two halves — *disabled*, and *with an
explanation* — and both are visible in one frame.

### Captured

![The recommendations section with its trigger greyed out and a line reading "Rate
at least 3 movies to unlock recommendations (you have 1)"](screenshots/ac-3-ranking-one-film.png)

*(The same capture appears under criterion 3, where it evidences ranking at a list
length of one. It is embedded again here rather than cross-referenced, because an
entry a reader has to leave in order to see its own evidence is doing half a job.)*

Look at the **"What to watch next"** section:

* **"Get recommendations" is greyed out** — and its sparkle icon is dimmed with it,
  because the disabled rule is written as `button:disabled .ai-sparkle`. A locked
  control that still twinkles invites a click that does nothing.
* **The explanation names both numbers**: *"Rate at least 3 movies to unlock
  recommendations (you have 1)."* Not just the requirement — the distance from it.
* **The grid beneath is empty.** No stale cards from a previous run sit under a
  message saying the feature is locked. That is `R16`: the section must not
  contradict itself.

### Automated

`test/routes.test.js` — *"POST /api/recommendations below the rated-movie threshold
→ 422, nothing logged"*. Three assertions, and the third is the interesting one:

| Asserted | Why it matters |
|---|---|
| Status is **422** | Not a 500 — this is a state the user can act on, not a fault |
| The body matches `/at least 3/` | The explanation reaches the client, rather than a bare status |
| **No `recommendation_logs` row was written** | The guard fires *before* any AI call, so a row here would mean the application recorded a call it never made |

`GET /api/config` is separately tested to serve the threshold numbers, which is
what lets the client display the rule without hardcoding it. The server is the
single source of truth for the number; the literals in the client are a documented
fallback for that one request failing, not a second definition (`R20`).

### Defence in depth, and one honest consequence

The same shape as criterion 2: the **client prevents** (a disabled button cannot
be clicked) and the **server refuses** (422 with a usable message). The server half
is therefore not normally reachable through the interface — it exists for a direct
API call, or a client that got its state wrong.

That message is one of exactly two in the application flagged `userFacing` and
passed to the user verbatim rather than replaced with a calm sentence. `R8`
established the general rule — technical causes go to the log, not the screen — and
this is a deliberate exception, because *"Need at least 3 rated movies"* is the
answer to the question the user just asked, not a fault report.

### Verdict

**Satisfied.** Both halves captured in one frame, the server contract asserted
including the absence of a spurious log row, and the threshold itself served from
one place rather than duplicated.

## 5 · A full recommendation run logs a row with real token/cost data, and every shown suggestion is TMDB-verified

**Assessed 2026-09-13.** Two claims: the run is **logged with real figures**, and
the films shown are **real** rather than invented by the model.

### Captured — what the user sees

![Four recommended films as cards with real posters, above a footer declaring the
call's prompt version, model, tokens, cost and duration](screenshots/readme-2-recommendations.png)

Four films, each with a **real TMDB poster** — which is the point. The poster,
year and id come from TMDB’s own record, not from the model, because each title
the model names is looked up before a card is drawn and dropped if TMDB has never
heard of it.

The **"Based on:"** line names the five films that fed the prompt, and the footer
declares `recommend_v3`, the model, the token count, the cost and the duration.

### Captured — what the audit trail holds

![The AI call log showing recommendation rows with token splits, per-call cost and
status](screenshots/readme-3-ai-call-log.png)

The same run, recorded: prompt version, model, tokens split in and out, cost,
duration and status — beside rows for the other feature and rows that failed.

### Automated

Two tests carry this, and both were probed by deletion rather than trusted:

**"POST /api/recommendations logs a success row holding exactly the shown titles"**
asserts `status: success`, a null `error_text`, the real `estimated_cost_usd`
taken from **OpenRouter’s own `usage.cost`** rather than the estimate table, the
token count, and `prompt_version`. Its sharpest assertion is that
`suggested_titles` holds **exactly what was shown** — three titles the model named
and that were then dropped must not appear in the row. An audit trail recording
what was asked for rather than what was delivered would be worse than none.

**"POST /api/recommendations drops unverifiable, already-owned and duplicate
picks"** is the verification claim. One run exercises all three drops: a title
TMDB cannot confirm, a film the user already owns, and two picks resolving to the
same film. Only the verified, unowned, non-duplicate one survives — and its year
and `tmdb_id` come from TMDB, not from the model.

**Both were verified load-bearing by deleting each of the three `continue` guards
in turn; every deletion fails exactly these tests.**

### Verdict

**Satisfied.** The logged figures are asserted against OpenRouter’s own reported
cost, and the "real, not invented" claim is enforced by a lookup the tests prove
is load-bearing.

## 6 · The verdict is disabled with an explanation below 2 rated movies, and a triggered verdict logs a row with real token/cost data

**Assessed 2026-09-13.** Two halves again — the locked state, and the logged run.

### Captured — locked below the threshold

![The verdict banner reading "Rate at least 2 movies to get a verdict (you have
1)" with its button greyed out](screenshots/ac-3-ranking-one-film.png)

*(Third appearance of this capture — it is embedded rather than cross-referenced
for the same reason as under criterion 4.)*

The banner reads **"Rate at least 2 movies to get a verdict (you have 1)."** and
**"New verdict" is greyed**, its sparkle dimmed with it.

**The button is disabled rather than hidden, and that was a decision.** Below the
threshold it used to be removed from the page entirely, so a new user saw a banner
with a sentence and no sign anything would ever appear there. Every other locked
control in the application is disabled rather than absent, so this is consistency
rather than new design — and the greyed control shows *what* is locked while the
sentence beside it explains *why*.

### Captured — a real verdict, with its cost

![The verdict banner holding generated text, with a footer declaring prompt
version, model, tokens, cost and duration](screenshots/readme-1-hero-ranked-list.png)

A generated verdict with `taste_verdict_v7`, `claude-sonnet-5`, its token count,
its cost in cents and its duration declared directly beneath it. The verdict rows
in `screenshots/readme-3-ai-call-log.png` are the same figures in the audit trail.

### Automated

* **"POST /api/taste-verdict below the rated-movie threshold → 422"** — the locked
  half, asserting the status and that the message names the requirement.
* **"POST /api/taste-verdict logs a success row with real token and cost data"** —
  the logged half. `status: success`, no error, the stored verdict text, the cost
  from OpenRouter’s `usage.cost`, the token count, `taste_verdict_v7`, and
  `model_used` as `claude-sonnet-5`.

**That second test was written on 2026-09-13 while assembling this entry, because
it did not exist.** Every `taste_verdict_logs` assertion in the suite was a failure
path. The one verdict behaviour this criterion names was the one nothing checked.
Verified load-bearing: making the service ignore OpenRouter’s reported cost and
fall back to the estimate table fails it.

Its `model_used` assertion also closes the other half of `D-070`, where a **failed**
verdict recorded the app-wide model instead of the one it called. Both halves of
that column are now pinned.

### Verdict

**Satisfied**, and better evidenced than it was this morning.

## 7 · Killing network access to TMDB and to OpenRouter (independently) each produce a graceful inline error

**Assessed 2026-09-13.** This criterion has its own document:
**[`RESILIENCE.md`](RESILIENCE.md)** — thirteen states, nineteen captures, each
measured against a stated definition of "graceful". Three are embedded here; the
rest are there.

*(Only three, deliberately. Embedding all thirteen under one checkbox would bury
the criterion in its own evidence.)*

### TMDB unreachable

![The search panel showing a connection error while the ranked list below renders
normally](screenshots/rs-1-tmdb-down-on-search.png)

A plain-language message inside the results panel, and **the ranked list carries
on** — including each film’s stored TMDB score, which survives the outage because
it is a snapshot written at add time rather than a live call. `RESILIENCE.md`
covers two further TMDB surfaces: adding a film, and verification failing
mid-recommendation.

### OpenRouter unreachable — recommendations

![The recommendations section reporting it could not generate anything, with a link
to the AI call log](screenshots/rs-4-openrouter-down-recs.png)

A calm sentence with no technical detail, and **no cost footer**, because nothing
succeeded. The technical cause goes to the log row instead.

### OpenRouter unreachable — the verdict banner

![The verdict banner reporting it could not produce a verdict, with a link to the
AI call log](screenshots/rs-5-openrouter-down-verdict.png)

This is the criterion’s explicit sub-clause — *"this includes the banner falling
back gracefully, not breaking the whole Home page"*. The banner reports the failure
in the **same words** the recommendations section uses, and the page around it is
untouched.

### Automated

* `GET /api/movies/search` with TMDB unreachable → **502** with a calm message.
* `POST /api/movies` with TMDB unreachable → **502**, and no database write.
* `POST /api/recommendations` with OpenRouter unreachable → **422 and a
  `status: failed` row is written**.
* An invariant written as a loop over **both** features: a logged failure is always
  advertised to the interface, and a failure with no row never is.

### Verdict

**Satisfied, and exceeded.** The criterion asks for two dependencies; the captures
cover four — TMDB, OpenRouter, Supabase, and the application’s own server
unreachable from an already-open page — plus two states that resemble failures and
are not.

## 8 · `.gitignore` excludes `.env` from the first commit; `git log` confirms no key ever appears in history

**Assessed 2026-09-13. Satisfied.**

Most of the evidence here is **commands** rather than pictures. A screenshot of a
terminal proves less than the command itself, which anyone can re-run against this
repository and check.

### Has `.env` ever been committed?

```
git log --all --diff-filter=A --name-only --format="" | grep -x "\.env"
```

**No output.** `.env` appears in no commit’s file list, on any branch, at any point
in history — **including the first commit**. It has never been tracked.

### Does any key-shaped string appear in any blob?

Every commit was scanned for an OpenRouter key prefix and for a JWT-shaped string,
which is the form a Supabase anon key takes:

```
git rev-list --all | while read c; do
  git grep -I -l -E "(sk-or-v1-[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{30,})" "$c" --
done
```

**No output.** No blob in any commit contains a string of either shape.

### What the first commit actually contained

![GitHub showing commit a93326c: zero parents, one file changed, README.md with a
single added line](screenshots/ac-8-first-commit.png)

`a93326c` — **`0 parents`**, so it is demonstrably the root commit — **one file
changed**, `README.md`, **one line added**: `# cinerank-project`.

That is GitHub’s repository-creation commit. It contains no code, no configuration
and no `.env`. **There was nothing there for a secret to be in.**

`.gitignore` arrives in the very next commit, `103c4be`, with `.env` on its second
line and `.env.example` alongside it — the first commit that contains any project
content at all:

```
# Secrets — never commit (CLAUDE.md § Security & Secrets #1)
.env
.env.local
*.local
```

**So the criterion reads cleanly**: from the first commit onward, `.env` is
excluded and no key is present. The root commit needs no exemption from the scans
above — it passes them, because it holds a single line of README.

### Ongoing enforcement

A clean history is a fact about the past. `npm run scan-secrets` runs before every
commit and inspects the **staged diff**, so the property is maintained rather than
merely observed. It is one of four commit gates, alongside `npm test`,
`npm run lint` and `npm run check-markdown`.

### Verdict

**Satisfied.** `.env` has never been tracked in any commit, no key-shaped string
exists in any blob in any commit, the root commit is shown to have held a single
line of README, and the ignore rule has been in place since the first commit that
contained anything to ignore.
