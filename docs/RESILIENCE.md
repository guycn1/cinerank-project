# Resilience — what CineRank does when something it depends on fails

This application depends on three things it does not control: **TMDB** for every
movie fact, **OpenRouter** for both AI features, and **Supabase** for storage. Any
of them can be down, and a fourth failure is possible too — the app's own server
being unreachable from a page already open in the browser.

`npm test` covers what the *server* does in each case: the status codes, the log
rows, the error shapes. **This document covers what the user sees**, which no test
can photograph. Sixteen states, twenty-four frames.

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

Each state has a recipe, kept as `RS-1` … `RS-16` in `CLAUDE.md` so that any of
them can be reproduced exactly. TMDB, OpenRouter and Supabase are all called
**server-side** — the browser never talks to any of them, so browser devtools
cannot simulate them: most recipes break the relevant key in `.env` and restart,
and three — `RS-9`, `RS-15` and `RS-16` — force a state no key can produce by
changing one line of a service and reverting it the moment the shot lands.
`RS-15` does it twice, once per half, which is why the number of such EDITS is
four and the number of such recipes is three.

**Five of them are order-dependent**, because getting the order wrong does not
produce a worse frame — it produces a different state entirely. Loading the page
*before* breaking the key is what leaves a control enabled to click; breaking it
first gives you `RS-7`. Every one of the five spells its sequence out step by
step, and three of them — `RS-2`, `RS-6` and the shared
`RS-11`/`RS-12`/`RS-13` recipe — flag it in bold before the steps begin;
`RS-10` and `RS-14` carry the order in the steps alone.

None of these are mock-ups. Every frame is the real application in the state
described. Not every one involves a broken dependency: in `RS-10` and `RS-15`
everything is reachable and working, and what fails is an assumption or a reply's
content.

**One behaviour in this application cannot be photographed at all**, and it is
worth naming rather than quietly omitting. Under `prefers-reduced-motion` the
interface takes a genuinely different path — the recommendation exit clears
instantly instead of animating, the verdict's typing effect is structurally
unreachable rather than merely suppressed, programmatic scrolling drops to
`auto`, and the logo's notch rests at twelve o'clock. **A still of nothing moving
is indistinguishable from a still of something about to move**, so no frame can
carry any of it. The reasoning is in `docs/DECISIONS.md` and the rules are in
`CLAUDE.md`; this document can only tell you the path exists.

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

**What makes this state worth capturing is that the AI call succeeded.**
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

**Two failed rows, adjacent:**

| Feature | Prompt | Model | Status |
|---|---|---|---|
| `TV` | `TV_v7` | `claude-sonnet-5` | `failed` |
| `R` | `R_v3` | `claude-haiku-4.5` | `failed` |

One image carrying two claims: the two features answer a failure identically, and
the deliberate two-model split (`D-053` — the verdict is the one call not on the
cheaper tier) holds in the **failure** path, not only in the successes.

**That second claim was false until the day this was shot.** A failed verdict was
logging the app-wide model rather than the one it had actually called. The bug was
found by looking at an earlier version of this very screenshot, fixed, covered by
a test per feature, and the wrong rows removed by hand (`D-070`).

## When the model returns nothing usable

Nothing is unreachable here. OpenRouter answers, TMDB answers, the database
answers, every key is valid. What goes wrong is the *content* of a reply that
arrived perfectly well — and there are two ways for that to happen, which the
application deliberately does not treat alike.

### RS-15 · Malformed output and empty output are not the same failure

![The recommendations section reading that there were no suggestions this time
because the model did not name any films, with a metadata footer beneath it
declaring the prompt version, model, token count, cost and
duration](screenshots/rs-15-nothing-usable-page.png)

**The empty case, as the user meets it.** The model honoured its contract and
returned a well-formed list with nothing in it. `SPEC` § 2.4's other clause — *"or
returns malformed output"* — is the case where it did not, and the two land in
different places.

**The footer under that message is the part worth looking at.** A call was made,
it took 4,221 ms, it cost 0.20¢, and the page says so *on a run that produced no
cards at all*. It used to return before building that footer, so the one outcome
that charged the user money and showed them nothing was also the only outcome
that reported no cost anywhere (`R10`). An application that declares what it spent
only when things go well is not an audit trail.

![The AI call log with three rows in view: a success carrying real tokens and
cost above a failure carrying real tokens and cost, and further down a failure
whose tokens and cost are em dashes](screenshots/rs-15-nothing-usable-log.png)

**This is the whole argument in one image, and it rests on the top two rows being
adjacent.** Same feature, same prompt version, same model, 1,038 tokens against
1,057, 0.20¢ against 0.21¢, four seconds against under four — and one is `success`
while the other is `failed`.

| Row | Status | Tokens | Cost | What actually happened |
|---|---|---|---|---|
| 15:02:18 | `success` | 1,038 | 0.20¢ | Valid JSON, empty. The contract held; there was simply nothing in it |
| 14:58:59 | `failed` | 1,057 | 0.21¢ | Not JSON at all. `parseModelJson` threw, and the row carries the reason |
| 19:00:52 | `failed` | — | — | Rejected at auth in 85 ms. Nothing ran, so there is nothing to report |

**The line the application draws is the CONTRACT, not usefulness.** A reply that
keeps its shape and says nothing is a call that succeeded and produced nothing. A
reply that breaks its shape is a failure. Both were charged, both are in the
trail, and the trail distinguishes them — which is the only reason anyone could
later tell a quiet model from a broken one.

**And the third row is why the first two matter.** The em dash (`—`) standing in
the Tokens and Cost cells is not a formatting choice, it is a claim: *this call
never ran*. Rendering `0` there would be a lie the totals then sum. The rule is
that those cells go blank **only when the value is genuinely null**, and the two
failures in this one frame are what make the rule visible — identical red badges,
completely different data, because they died at different points in the pipeline.

The footer reads `Total · 60 calls`, which is the cap rather than the lifetime
figure; see `docs/AI-CALL-LOG.md` § 2 and `D-069`.

### RS-16 · The model named films that do not exist

![The recommendations section reading that none of the films it named could be
verified, with a metadata footer declaring the prompt version, model, tokens,
cost and duration](screenshots/rs-16-unverifiable-picks.png)

The third way a reply can leave you with nothing, and the one the architecture was
designed around. `RS-15` covers a reply that broke its contract and one that kept
it while saying nothing. Here the model returned a well-formed list of confident,
plausible titles — and **TMDB had never heard of any of them.**

**This is `SPEC.md` § 2.2 step 4 and § 6 doing the job they exist for.** Both rest
their argument on the same sentence: the application never trusts the model's
output as fact, and every suggested title is cross-checked before a user sees it.
A title TMDB returns nothing for is dropped rather than rendered as a broken card.
This frame is that guard firing on every pick at once.

**It is not a rare path.** Measured against live TMDB across thirty probe titles
(`D-054`), **seven of twelve realistic invented titles returned zero results** and
were dropped exactly this way. The drop is the common outcome, not the exotic one.

**"Unverifiable" is narrower than the word sounds, and the narrowing matters.** It
does not mean *TMDB was unsure*. `verifyTitle()` keeps TMDB's top result when
nothing matches title-for-title, so a near-miss — a missing "The", a hyphen in the
wrong place — resolves to a neighbouring real film rather than being dropped
(`D-054`, deliberately kept). Reaching this state means TMDB returned **nothing at
all** for every title, which is what a genuinely invented title looks like.

**And the message says which of the five things went wrong.** Before `R28` this
sentence read "the model only named films already in your list" for *every* empty
run — it would have been a flat lie here. The five causes are now tallied per
title and resolved to one reason, so a hallucinated set, an owned set, an empty
reply and a TMDB outage each get their own sentence. `RS-3`, `RS-9`, `RS-15` and
this frame are four of the five.

The footer declares the cost of a run that produced nothing — `R10` again, and the
same point `RS-15` makes: the model was paid whether or not its answer survived
verification.

> **Forced, and the caption says so rather than implying otherwise.** The state
> cannot be produced from `.env`, so the verification call is skipped for one run
> (`CLAUDE.md`, `RS-16`) and reverted immediately. The OpenRouter call is real and
> was billed; what is simulated is TMDB's verdict, not the model's reply.

## When the database is unreachable

### RS-7 · Supabase down

![The app with an empty ranked list, an explanatory toast, and both AI buttons
greyed out](screenshots/rs-7-database-unreachable.png)

> Couldn't load your movies — Something went wrong.

**This is the one state IN THIS DOCUMENT where an empty ranked list is correct** —
the list is what broke. The scope matters: an empty list is also correct when the
user simply has not added a film yet, which is a healthy state rather than a
failure and is captured separately as `ac-3-ranking-empty.png`.

**The two are told apart by what sits under the empty list, and the difference is
not cosmetic.** A genuinely empty list shows "No movies yet — search for one above
to get started."; this frame shows NOTHING there. `loadMovies()` destructures on
its first line, so a failed `/api/movies` throws before `refreshRanked()` can
unhide that line — and that is the right outcome, because the user may have a full
list the app simply cannot reach. Unhiding it here would assert something false.

Both AI triggers are greyed, because the rated-film count comes from data
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
Both are fixed, and this frame is the fixed state: the trigger is greyed, and the
banner reads **"Couldn’t read the room — your movies didn’t load."** — an admission
rather than a promise, and checkable against the picture rather than taken on
trust.

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

**The other half of that pair deliberately has no frame.** Reaching the genuinely
empty state means emptying both log tables, and deleting rows wholesale from the
live database is precisely what the working agreements in `CLAUDE.md` forbid after
Incident 1. The sentence is quoted above rather than photographed, and the branch
that writes it sits ten lines from the one that writes the failure in
`public/app.js` — close enough to read both at once.

> **The honest blemish.** The cause it can show is `Something went wrong.` — the
> generic `500`, and the least informative message in the application. Wherever
> the central handler answers, the app genuinely cannot say what broke: `RS-7`
> and `RS-13` carry the same string for the same reason, because that handler is
> what replies when Supabase vanishes mid-request. It is recorded here rather
> than quietly framed as a success.

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
a failed **write** with unsaved work in hand.

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
not every error its server can return. **Seven more exist and none of them has a
frame** — six because the interface refuses the state before a request is ever
sent, and a seventh because the server never produces the response it handles.

They are written down rather than left implicit for two reasons. The first is that
an evidence set should say where its own edges are: a reader who counts the
sixteen states above is entitled to ask whether that is all of them. The second matters more.
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

**The seventh inverts that division, which is why it sits outside the table.**
`api()` falls back to `Request failed (<status>)` when a response is not OK and
carries no `error` in its body (`public/app.js`). No route in this application
produces that shape — every error response sets `error`, the central handler
included, checked by walking each `status(4xx|5xx)` call and its body rather than
by counting — so the fallback exists for a server that is not this one. The
one way to reach it is an unknown `/api/*` path, which falls through to Express's
built-in finalhandler and answers with HTML rather than JSON; the client never
requests such a path, and a test (`unknown route → 404`) covers the behaviour
regardless. Here the guard is server-side and the fallback is client-side —
exactly the opposite arrangement to the six above, and a reason to keep the
fallback rather than delete it as dead code.

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

* Recipes for every state, as `RS-1` … `RS-16`: `CLAUDE.md`, under Pre-submission
  blockers.
* Server-side behaviour for the same cases: `npm test`, `test/routes.test.js`.
* The acceptance criteria these satisfy: `SPEC.md` § 7.1.
* OWASP mapping, including the prompt-injection evidence: `docs/SECURITY.md`.
* An index of every capture in the repository: `docs/screenshots/README.md`.
