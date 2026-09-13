# Resilience — what CineRank does when something it depends on fails

This application depends on three things it does not control: **TMDB** for every
movie fact, **OpenRouter** for both AI features, and **Supabase** for storage. Any
of them can be down, and a fourth failure is possible too — the app's own server
being unreachable from a page already open in the browser.

`npm test` covers what the *server* does in each case: the status codes, the log
rows, the error shapes. **This document covers what the user sees**, which no test
can photograph. Nine states, thirteen frames.

## What "graceful" is taken to mean here

Three claims, and every capture below is measured against them:

1. **The app says what happened, in plain language.** No stack traces, no HTTP
   status codes, no library wording leaking into the interface.
2. **One dependency failing does not take the page with it.** In eight of the nine
   states the ranked list is still on screen and still correct. The ninth is the
   one where the list itself is what broke.
3. **The failure is recorded where a failure belongs.** An AI call that failed
   still writes a row carrying the model, the prompt version, the duration and the
   real technical cause — which is the half the user never sees.

## How these were produced

Each state has a recipe, kept as `RS-1` … `RS-9` in `CLAUDE.md` so that any of
them can be reproduced exactly. TMDB and OpenRouter are called **server-side**, so
browser devtools cannot simulate them: the recipes break the relevant key in
`.env` and restart. Two are order-dependent and say so.

None of these are mock-ups. Every frame is the real application against a real
broken dependency.

## When TMDB is unreachable

TMDB supplies every movie fact in the app — titles, years, posters, its own
audience score. Three different surfaces have to cope with losing it.

### RS-1 · Searching

![The search panel showing a connection error, with the ranked list rendering
normally below it](screenshots/rs-1-tmdb-down-on-search.png)

> Couldn't reach the movie database. Try again in a moment.

Crimson, inside the results panel. The ranked list underneath is untouched.

**The detail worth noticing is the `TMDB 7.6` on the card.** TMDB is unreachable,
and each film's TMDB score still renders — because that number is a **snapshot
written when the film was added**, never re-fetched. That was a deliberate design
decision (`docs/DECISIONS.md` D-036), taken partly so an outage could not empty
the ranked list. This frame is that decision paying off.

### RS-2 · Adding a film

![A toast reading that the film could not be added because TMDB is unreachable,
above the search results](screenshots/rs-2-tmdb-down-on-add.png)

> Couldn't add "Heat" — TMDB is unreachable.

**The film's name in that sentence is the point, not decoration.** The server
sends a short machine-readable cause; the client prefixes the context it already
knows. Before that mechanism (`D-042`) a failed add named no film at all, and a
naive fix produced doubled messages like "Couldn't add 'Heat' — Couldn't reach the
movie database". The two halves compose exactly once.

This state is only reachable *at all* because the search results panel is
persistent rather than a dropdown (`D-024`) — with TMDB down, a fresh search
returns nothing to click, so the rows must have survived from before the outage.

### RS-3 · Verifying recommendations

![The recommendations section reporting that none of the suggestions could be
checked, with the call cost shown](screenshots/rs-3-tmdb-down-during-recs.png)

> Couldn't check any of the suggestions — the movie database is unreachable. Try
> again in a moment.

**This is the most interesting state in the set, because the AI call succeeded.**
The model was reached, it answered, it was charged for. TMDB then could not
confirm a single title, so nothing could be shown. The metadata footer declares
the real cost of a run that produced nothing.

![The AI call log showing that run as a success with zero suggestions
returned](screenshots/rs-3-tmdb-down-during-recs-log.png)

The log row is the other half: **green `success`, real tokens, real cost, and "no
suggestions".** A run can be simultaneously successful, charged, and empty.

**Before this was fixed, this state lied.** Every empty run reported "the model
only named films already in your list" — one of four possible causes, and not this
one. Because a verification failure still logs as a success, that sentence was the
only thing a user would ever see, and a TMDB outage disappeared entirely.
`emptyReasonFor()` now ranks an unreachable TMDB above every other cause precisely
because it is the only one the user can neither see nor act on.

## When OpenRouter is unreachable

Both AI features share one transport, and both must fail the same way. They did
not always: they had drifted into two different error dialects, and the verdict's
was worse — it offered the AI call log for *every* failure, including ones where
that log could not load either.

### RS-4 · Recommendations

![The recommendations section reporting that it could not generate anything, with
a link to the AI call log](screenshots/rs-4-openrouter-down-recs.png)

> Couldn't generate recommendations right now. See the AI call log for details.

**Two absences are the substance.** There is no technical detail in the message —
before `R8`, the route wrapped every cause into the user-facing text, so people
saw `OpenRouter responded 401`, and worse, `DB read failed:` followed by raw
Postgres output. And there is **no cost footer**, because nothing succeeded. That
is the exact inverse of RS-3, where a call *did* succeed and its cost is shown.

**The log link is conditional**, which is the subtle half: it appears only because
a `recommendation_logs` row was really committed. The server sends a flag saying
so. Of six places this function can fail, only one qualifies.

![The AI call log showing a failed row with the real cause, OpenRouter responded
401](screenshots/rs-4-openrouter-down-recs-log.png)

> OpenRouter responded 401

Red `failed`, with em dashes in Tokens and Cost — a call that never completed has
nothing to report, and `0` would be a lie. The 74 ms duration says *where* it
died: rejected at authentication, never reaching inference.

**Put the two frames side by side and the claim is complete:** the user got a calm
sentence, the audit trail got the real cause. Neither frame alone shows that the
split was deliberate.

### RS-5 · The taste verdict

![The verdict banner reporting that it could not produce a verdict, with a link to
the AI call log](screenshots/rs-5-openrouter-down-verdict.png)

> Couldn't come up with a verdict right now. See the AI call log for details.

**The resemblance to RS-4 is the entire point.** Two independent features, two
independent code paths, one vocabulary. That is what `R23` was for.

![The AI call log showing two failed rows, one per feature, on two different
models](screenshots/rs-5-openrouter-down-verdict-log.png)

**This is the strongest single frame in the set.** Two failed rows, adjacent:

| Feature | Prompt | Model | Status |
|---|---|---|---|
| `TV` | `TV_v7` | `claude-sonnet-5` | `failed` |
| `R` | `R_v3` | `claude-haiku-4.5` | `failed` |

One image carrying two claims: the two features answer a failure identically, and
the deliberate two-model split (`D-053` — the verdict is the one call not on the
cheap tier) holds in the **failure** path, not only in the successes.

**That second claim was false until the day this was shot.** A failed verdict was
logging the app-wide model rather than the one it had actually called. The bug was
found by looking at an earlier version of this very screenshot, fixed, covered by
a test per feature, and the wrong rows removed by hand (`D-070`).

## When the database is unreachable

### RS-7 · Supabase down

![The app with an empty ranked list, an explanatory toast, and both AI buttons
greyed out](screenshots/rs-7-database-unreachable.png)

> Couldn't load your movies — Something went wrong.

**This is the one state where an empty ranked list is correct** — the list is what
broke. Both AI triggers are greyed, because the rated-film count comes from data
that never arrived.

**Search is still live**, and that is not an oversight in the capture: search calls
TMDB, not Supabase. One dependency down while another works is exactly what the
interface should show.

**Shooting this frame found two real defects**, neither of which any test could
have caught. `loadMovies()` reads its response on its first line, so a failed
request throws before any of the four synchronisation functions below it can run —
and every element then keeps whatever the markup gave it. "Get recommendations"
had shipped without a `disabled` attribute and so rendered fully live above an
empty list. And the verdict's `Reading the room…` placeholder, meant to last a
fraction of a second, sat there for the life of the page still promising a verdict.
Both are fixed; this frame is the fixed state.

## When CineRank itself is unreachable

### RS-6 · The app's own server is gone

![The search panel reporting that CineRank cannot be reached, with all seven films
still listed below](screenshots/rs-6-cinerank-unreachable.png)

> Couldn't reach CineRank. Check your connection and try again.

**Different from RS-1 in the way that matters.** There, TMDB was down and the
*server* explained what had gone wrong. Here nothing answers at all — `fetch`
itself rejects. The client catches that specific case so the browser's own
engine-specific wording ("Failed to fetch", "NetworkError when attempting to fetch
resource") never reaches a user.

**All seven films are still on screen.** They loaded before the server died and
nothing re-fetches them. The app keeps showing what it has.

**There is deliberately no log link here.** Nothing reached the server, so no row
was written, so nothing may be offered. Pointing a user at an audit log that
cannot load either would be worse than saying nothing.

## Two states that are not failures at all

Both are included because an application that cannot tell "nothing found" apart
from "something broke" is failing at something more basic than uptime.

### RS-8 · A search with no matches

![The search panel showing a muted no-matches note, with the ranked list
below](screenshots/rs-8-search-no-matches.png)

> No matches for "zzzqwerty". Check the spelling, or try a different title.

**Muted grey, not crimson.** Compare it directly with RS-1 at the top of this
document: same panel, same position, same shape of message — one is a failure and
one is not, and they do not look alike. The query is echoed back so a typo becomes
self-evident, and it is escaped on the way (`textContent`, never `innerHTML`).

### RS-9 · A recommendation run with nothing to suggest

![The recommendations section reporting no new suggestions, with the real cost of
the call shown](screenshots/rs-9-zero-recommendations.png)

> No new suggestions this time — the model only named films already in your list.

Nothing is broken. Every key works, TMDB answers, the model performs — the run
simply had nothing new to offer, and **the cost is still accounted for.**

![The AI call log showing the run as a success with zero suggestions, alongside
earlier runs](screenshots/rs-9-zero-recommendations-log.png)

**Read this frame against RS-3's log row.** They are nearly identical — both
`success`, both charged about 0.20¢, both "no suggestions" — and they mean opposite
things. One is an outage the app could easily have hidden; one is an honest, boring
result. The app distinguishes them correctly on the page. Before `R28` it called
both of them the second thing.

An application that reports what it spent only when things go well is not an audit
trail.

## What shooting these actually found

Worth recording, because it is the argument for doing this work rather than
asserting the behaviour:

* A **failed taste verdict was logged against a model it never called** — the
  app-wide default instead of the verdict's own. Found by reading a log
  screenshot. `D-070`.
* **"Get recommendations" rendered fully enabled** above a ranked list that had
  failed to load.
* **The verdict placeholder never retired** when that load failed, leaving the
  banner promising a verdict indefinitely.

All three were invisible to the tests, the linter and the render audits — every
one of which inspects *structure*. None of them puts the application into a broken
state and looks at it. That is what this set is for.

## Where to find the rest

* Recipes for every state, as `RS-1` … `RS-9`: `CLAUDE.md`, under Pre-submission
  blockers.
* Server-side behaviour for the same cases: `npm test`, `test/routes.test.js`.
* The acceptance criteria these satisfy: `SPEC.md` § 7.1.
* OWASP mapping, including the prompt-injection evidence: `docs/SECURITY.md`.
* An index of every capture in the repository: `docs/screenshots/README.md`.
