# Resilience — what CineRank does when something it depends on fails

This application depends on three things it does not control: **TMDB** for every
movie fact, **OpenRouter** for both AI features, and **Supabase** for storage. Any
of them can be down, and a fourth failure is possible too — the app's own server
being unreachable from a page already open in the browser.

`npm test` covers what the *server* does in each case: the status codes, the log
rows, the error shapes. **This document covers what the user sees**, which no test
can photograph. Fourteen states, twenty-one frames.

## What "graceful" is taken to mean here

Four claims, and every capture below is measured against them:

1. **The app says what happened, in plain language.** No stack traces, no HTTP
   status codes, no library wording leaking into the interface.
2. **One dependency failing does not take the page with it.** In every state but
   one the ranked list is still on screen and still correct. The exception is
   `RS-7`, where the list itself is what broke. *(This was written as a count —
   "eight of the nine" — and had gone stale twice by the time it was noticed. A
   count of a set that grows is a maintenance burden the sentence did not need.)*
3. **The failure is recorded where a failure belongs.** An AI call that failed
   still writes a row carrying the model, the prompt version, the duration and the
   real technical cause — which is the half the user never sees.
4. **Work in progress survives a failure that had nothing to do with it.** A
   write that fails leaves what the user typed exactly where they left it, so
   recovering costs a click rather than retyping. This claim was added on
   2026-09-14, when `RS-10` and `RS-14` turned out to evidence something the
   first three did not mention.

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

### RS-11 · Neither AI feature offers a log that was never written

![The taste verdict banner reading that it could not come up with a verdict and
to try again in a moment, with no link of any kind, above a ranked list still
rendering normally](screenshots/rs-11-no-log-offered-verdict.png)

![The recommendations section reading that it could not generate recommendations
and to try again in a moment, with no link and no cost
footer](screenshots/rs-11-no-log-offered-recs.png)

**This is `R23`'s invariant running in the direction nothing else photographs.**
`RS-4` and `RS-5` show its positive half: OpenRouter fails, a `status='failed'`
row is written, and the message offers the log. Here the database is what is
gone, so the read fails *before any AI call is made* — no row exists, and neither
feature offers a log it knows cannot help.

The difference is one word in the response. Both services throw without a
`logged` flag when the read fails (`server/services/tasteVerdict.js`,
`server/services/recommendations.js`), the routes answer with the
"Try again in a moment." variant instead of the bare sentence, and
`public/app.js` branches on `err.logged` to decide whether to build a link at
all. Set the flag and the link appears; that is the whole mechanism.

**Two frames because the rule is shared, not because the claim is split.** One
feature alone reads as incidental. Both, side by side, saying different sentences
with the same ending and the same absence, reads as a rule — which is what it is,
and what a test asserts as a loop over both features so they cannot drift apart
again.

### RS-12 · The audit surface fails honestly too

![The AI call log dialog open, its heading, description and nine column headers
all rendering, with a single row reading that the log could not be
loaded](screenshots/rs-12-log-cannot-load.png)

The log reads from the same database, so it goes down with it — and this is the
dead end `RS-11` exists to keep users out of.

**What it must not do is come back empty.** An empty table and an unreachable one
look alike and mean opposite things: *no AI calls have ever been made* against
*we cannot tell you what was made*. The first would be a lie here. `public/app.js`
writes a different sentence in each case, in the same slot — the failure reads
"Couldn’t load the log — Something went wrong.", while a genuinely empty log reads
"No AI calls logged yet — run a recommendation or a taste verdict." That is
`D-033`'s rule, the one `RS-1` and `RS-8` argue in Search, holding on a third
surface.

Everything around the body still renders: the heading, the Close button, the
description naming both log tables, and all nine column headers. Only the part
that needs the database is missing.

> **The honest blemish.** The cause it can show is `Something went wrong.` — the
> generic `500`, and the least informative message in the application. This is
> the one frame in this document where the app genuinely cannot say what broke,
> because the central handler is what answers when Supabase vanishes mid-request.
> It is recorded here rather than quietly framed as a success.

### RS-13 · A write fails and says which film it was about

![A toast reading that Shrek could not be removed because something went wrong,
with the film still in the ranked list above
it](screenshots/rs-13-write-fails-remove.png)

Removing a film with the database gone. The toast is a **context plus a cause**
(`D-042`): `failureText()` composes the app's own context with whatever the
server sent, and the film is named. The two error toasts used to show the cause
alone, so a failed add or remove named no film at all.

The card is still there, which is worth stating precisely rather than
overselling: `removeMovie()` has **no optimistic removal** — it awaits the
`DELETE`, then reloads. The film survives because nothing ever removed it. The
frame evidences the absence of a risky pattern, not the success of a rollback.

**One outage, three sentences, and that is the point of grouping these.** The
same unreachable database produces "Try again in a moment." from both AI features
and "— Something went wrong." from the CRUD and log routes, because the AI routes
catch their own errors and answer calmly while the others fall through to the
central handler. Not one of the four leaks a `PGRST` code or a Postgres string.

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

### RS-14 · A save that fails while the server is gone, and the retry that works

![The rate dialog open on Knives Out, rating 8.2, a typed review in the box, and
a crimson line reading that CineRank could not be reached; behind the dimmed page
the same film's card still reads No review
yet](screenshots/rs-14-failed-save-input-kept.png)

Same outage as `RS-6`, opposite direction: that one is a failed **read**, this is
a failed **write** with unsaved work in hand. It is the only frame in this
document where a failure could have cost the user something.

**What it must not do is close.** The form is `method="dialog"`, so submitting
closes it *by default* — and this application shipped that way once: the write
went out invisibly, a failure produced an error toast about a dialog that was
already gone, and the typed review was destroyed with no way to retry. The save
handler now prevents the default, and reports **inline** rather than through the
toast, because a modal `<dialog>` sits in the top layer where no `z-index` can
lift a toast above it and the `::backdrop` dims it anyway (`D-032`).

There is **no log link**, and that is `R9`/`D-047` again: nothing reached the
server, so no row was committed, so nothing may be offered. The message itself is
fabricated client-side — `api()` catches the network-level rejection so that
"Failed to fetch" and "NetworkError when attempting to fetch resource" never
reach a user.

**Look at the card behind the dimmed page.** Knives Out at `#3` still reads *"No
review yet — edit to add one."* The write genuinely did not land.

![The same ranked list with the dialog gone, Knives Out now carrying that exact
review text, and a toast reading that Knives Out was
saved](screenshots/rs-14-failed-save-retry-succeeds.png)

Then the server came back and **Save was pressed again** — no retyping, no reload,
the dialog never closed. The card now carries the same sentence that was sitting
in the box.

**This is what separates it from `RS-10`, which also keeps the typed text.** There
the row had been deleted, so the save could never succeed and the message says
*refresh*; keeping the text was a courtesy. Here the failure is **transient and
the work is recoverable**, which is the difference between losing an evening's
review and pressing a button twice.

> One detail worth reading in the second frame: the toast says `“Knives Out”
> saved.` and **not** "— ranking updated." The rating never changed, so the
> ranking did not either, and that clause is checked against a signature of the
> displayed ranking rather than assumed (`D-034`). It was briefly deleted
> outright and the user pushed back correctly — every save does recompute the
> ranking, so the claim was never false; the objection was that it reads as a
> claim about the outcome.

## When the data changes underneath you

Every dependency here is healthy. Nothing is unplugged, no key is broken, and the
request below reaches a working server and a working database. What fails is an
assumption — that the row a dialog opened is still there by the time the dialog is
finished with it.

### RS-10 · A row deleted while it was being edited

![One browser showing two independent views of the app side by side. In the left
view a rate dialog is open on Titanic with a review typed and not yet saved; both
views list eight films with Titanic ranked
first](screenshots/rs-10-row-deleted-mid-edit-before.png)

The baseline, and it is worth establishing: at the moment that review was typed
the two views agreed. Eight films, Titanic at `#1`, in both.

![The same two views. The right one has removed Titanic and still shows its
confirmation toast, and now lists seven films with Mad Max first. The left one
still lists eight with Titanic first, and its dialog now carries a crimson line
reading that the film could not be
found](screenshots/rs-10-row-deleted-mid-edit-after.png)

The right view removed the film — its `“Titanic” removed.` toast is still on
screen and its count has dropped to seven. **The left view has not noticed.** Its
ranked list still shows Titanic at `#1` and still says eight films, because
nothing re-fetches while a dialog is open: `app.js` carries no `visibilitychange`
handler, no `focus` handler and no polling timer. Pressing Save from that stale
view is what produces the `404`.

**Three things this establishes, and the third is the one that needed a picture.**

1. **It is a `404`, not a `500`.** The route tests `PGRST116` explicitly and
   answers with a message about the film rather than letting the central handler
   blame the server for something that is not its fault
   (`server/routes/movies.js`). Asserted by
   `PATCH /api/movies/:id for a row that no longer exists → 404, not 500`.
2. **The message names both the cause and the remedy** — *“Couldn’t find that
   film — it may have been removed. Refresh and try again.”* It is the only error
   in the application that tells the user what happened to their data and what to
   do about it, because it is the only one where the app knows.
3. **The typed review survived.** It is still in the box, word for word, and the
   rating is still at 9.5. A modal `<dialog>` submits and closes by default, which
   would have taken the text with it; the save handler prevents that and reports
   inline instead (`D-032`) — so the failure is recoverable by pressing Save
   again once the cause is gone, rather than by retyping.

**Why this state gets two frames of one moment, rather than two surfaces.** Every
other pair in this document splits a claim between the page and the audit trail.
This claim is *temporal* — it is about an order of events — and the honest way to
evidence that in still images is a before and an after. The second frame happens
to carry the whole story on its own, since the left view's stale `8 films` sits
beside the right view's `7 films`; the first is what licenses a reader to read
that as staleness rather than as two views that never matched.

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

## Error paths the interface cannot reach

The states above are every failure a user can put this application into. They are
not every error its server can return. **Six more exist, and none of them has a
frame** — because in each case the interface refuses the state before a request is
ever sent.

They are written down rather than left implicit for two reasons. The first is that
an evidence set should say where its own edges are: a reader who counts nine
states is entitled to ask whether that is all of them. The second matters more.
**Each of these is unreachable only because of one specific client-side guard**,
and the table's left column is therefore a constraint on the client, not a
description of it.

| Server error | The guard that makes it unreachable | Test that proves it is handled anyway |
|---|---|---|
| `400` `Missing search query` | The submit handler returns before any request when the trimmed query is empty, showing `Type a film title to search.` and putting the caret back in the input | `GET /api/movies/search with no query → 400` |
| `400` `tmdb_id (integer) is required` | `addMovie()` has exactly two call sites — a search row and a recommendation card — and both pass an integer that came from TMDB. The value is never typed by anyone | `POST /api/movies with no tmdb_id → 400`, plus the non-integer case |
| `400` `Your rating must be between 0 and 10.` | The rating control is `<input type="range" min="0" max="10" step="0.1">`, so the browser cannot emit an out-of-range value | `PATCH /api/movies/:id with rating out of range → 400`, plus the non-numeric case |
| `400` `Nothing to update` | Save always sends both `rating` and `review`, so the body is never empty | `PATCH /api/movies/:id with an empty body → 400 (nothing to update)` |
| `400` `A review needs a rating — rate the film first.` | The same line: a rating is always present. `POST` writes neither column, so a film cannot be created carrying a review either | `PATCH /api/movies/:id writing a review onto an unrated film → 400, not 500` |
| `422` `Need at least 3 rated movies` | The trigger ships `disabled` in the markup and is enabled only at or above the threshold the server owns | `POST /api/recommendations below the rated-movie threshold → 422, nothing logged` |

**The guards are client-side and the tests are server-side, and that division is
the whole point.** The guard is why no user meets the error; the test is why
meeting it would be handled correctly regardless. Remove a guard — loosen the
slider's bounds, let an empty query through, make the review field savable on its
own — and an error moves from unreachable to reachable **while every test still
passes**, because none of them exercises the client. Nothing in this repository
would flag that.

Exactly one of the six was ever *verified* unreachable rather than assumed. Before
migration 004 added `review_requires_rating`, the state it forbids was traced
through the interface and then checked against the live table, which held **zero**
rows in it (`D-041`). The other five rest on reading the code, which is weaker,
and is said here plainly rather than dressed up.

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

* Recipes for every state, as `RS-1` … `RS-14`: `CLAUDE.md`, under Pre-submission
  blockers.
* Server-side behaviour for the same cases: `npm test`, `test/routes.test.js`.
* The acceptance criteria these satisfy: `SPEC.md` § 7.1.
* OWASP mapping, including the prompt-injection evidence: `docs/SECURITY.md`.
* An index of every capture in the repository: `docs/screenshots/README.md`.
