# Decision log — the *why*

Started at project conception, not bolted on afterwards (course Module 8: the
reasons behind a choice are clearest at the moment it's made, and the agent can't
recover them later). **Newest first — a new entry goes at the TOP of this
file, directly under this header.**

---

## D-027 · Icons are inline SVG or plain characters — never emoji
Three icon choices in the Search section landed on the same rule, so it is
written once here.

**Emoji are rejected outright.** A colour emoji is a fixed full-colour image: it
ignores `color`, so it cannot go amber on hover or dim under a `:disabled`
opacity the way its neighbouring text does; it ignores `font-weight`; and it
carries its own metrics, so it sits off the baseline next to Inter. It also
renders differently on every platform — the opposite of the consistency it is
usually reached for.

- **"+ Add"** uses a plain `+` (U+002B), not the heavy-plus emoji. It is
  `currentColor`, so it follows hover and the disabled dim for free, and it
  matches the text-glyph checkmark already in "Added".
- **The Search button's magnifier is an inline SVG**, not the magnifier emoji and
  not the text glyph `⌕`. `⌕` looks like the right answer and is a trap: it lives
  in Miscellaneous Technical (its actual Unicode name is TELEPHONE RECORDER),
  which is *outside the Inter subset this page downloads*. It would fall through
  to whatever the OS happens to have, or render as tofu — worse device
  consistency than the emoji, not better. Forcing text presentation with VS15 is
  ignored by Chrome and Android. An SVG is our own vector: identical everywhere,
  and `stroke="currentColor"` follows every state. Same pattern as
  `.log-cta__icon`.

**Its orientation is deliberate: lens upper-left, handle down-right** — the
Material / Feather / Heroicons convention, which users recognise
pre-attentively. Do not flip it. Note this is *not* the orientation of the emoji
it replaced: `&#128270;` is U+1F50E "MAGNIFYING GLASS TILTED **RIGHT**", the
mirrored variant (lens upper-right, handle lower-left); the conventional one is
U+1F50D. The naming is counterintuitive — "tilted left" describes the lens
rotating leftward, which swings the handle right — and it was misread once
already, so the switch to SVG quietly *corrected* the orientation rather than
preserving it. Mirroring is standard only in RTL locales, which this
single-locale `lang="en"` app is not.

Mechanically the button carries both a `.search-btn__label` and the SVG, and the
500px breakpoint swaps which displays — cleaner than a `::after`, and
`busyButton()` stashes and restores both for free. `busyButton()` wraps its own
label in a `.busy-label` span for the same reason, so the breakpoint can hide it
and leave the spinner standing alone. Separately, `.search button` is
`flex-shrink: 0`: a flex item's automatic minimum size is not reliable on a
`<button>` across engines, and shrinking is what clipped the label to begin with.

## D-026 · A sync must not stomp a deliberate state ("Added" is sticky)
Reported as "skipping the rate dialog does not sync the search results". It was
the reverse — skipping was correct, and **saving** was the bug. Saving a rating
runs `loadMovies()` a second time, whose `syncSearchResultButtons()`
unconditionally reset every owned button to "In your list", wiping the "Added"
confirmation set moments earlier. Skipping runs nothing, so it kept it. One
state, two labels, decided by an unrelated round-trip.

Decision: make the "Added" confirmation **sticky** (a `dataset.justAdded` flag
honoured by `setAddButtonState`) rather than make skipping reset it. It is the
more informative of the two labels — it marks what *you* just added versus what
was already in the list, which matters when adding several films from one result
set — and it is the state D-024 went out of its way to keep visible. Removing the
film clears the flag, so the row offers "+ Add" again.

**The pattern is what matters here, because this is the third instance:** a sync
function that runs unconditionally will silently overwrite a deliberate transient
state set moments earlier.

1. The recommendations error message, written into `#recs-hint` and then wiped by
   `syncRecommendationsAvailability()` in the handler's own `finally` — still
   open, see CLAUDE.md.
2. `syncSearchResultButtons()` writing `textContent` into a button that was still
   mid-request, destroying its spinner. Fixed by skipping anything with
   `aria-busy`.
3. This one.

Before adding a sync call, check which deliberate states it can reach.

## D-025 · Hide the browser's search clear button rather than theme it
`<input type="search">` makes Chromium/Safari draw their own clear "×" inside the
field. On a near-black amber panel it renders as an unthemed blue glyph — the most
literal instance of the "generic default-component appearance" CLAUDE.md's design
notes rule out.

The obvious fix is to style it via `::-webkit-search-cancel-button`. Rejected:
**Firefox draws no clear button at all**, so styling leaves the browsers still
disagreeing — just with a nicer × in two of them. Hiding it is the only option
that renders identically everywhere, and cross-browser sameness matters more here
than a prettier glyph for a submission opened on a browser we do not control.

It was also only half-wired: the native × clears the input but leaves
`.search-results` showing matches for a query no longer in the box. Keeping it
honestly would have meant extra JS to close the panel, for a control much of the
audience never sees. `type="search"` stays — the semantics and the mobile
keyboard's Search key are unaffected; only the chrome goes.

## D-024 · The search results panel is a persistent surface, not a dropdown
Three separate questions — should an outside click dismiss it, should adding a
film dismiss it, should it get its own "×" — all resolve to one distinction:

**A floating layer must be dismissible; an in-flow one need not be.** The AI-log
reveal panels are `position: absolute` and sit ON TOP of table rows, so they have
to get out of the way, and they earn their outside-click handler.
`.search-results` is in normal flow. It pushes the page down and obscures
nothing, so there is nothing to get out of the way of.

Both auto-dismissals were built and then removed:
- **Outside click** (33ad1ec) — pattern-matched from the reveal panels without
  checking whether the reason applied. A stray click cost the user a re-typed
  query and another TMDB round-trip.
- **Close on add** (fdf7ec6) — worse, it was self-defeating. It ran in the same
  tick as `settle('✓ Added')`, so that confirmation could never be painted, and
  it cancelled out `syncSearchResultButtons()`, which exists precisely to update
  the OTHER open rows after an add. Keeping the panel open serves the real flow:
  search once, add two films.

**No "×" either**, declined for a second reason: `type="search"` already renders
a native × a few pixels away (see D-025), and the two would do *different* things
— native clears the input, ours would close the results. Adjacent identical
glyphs with different meanings is a trap. Escape closes it; a new search replaces
it; otherwise it stays.

## D-023 · The reveal-panel fade animates the panel, never `::details-content`
*Recorded retroactively — decided 2026-09-05 over commits bfafeb2, 1476446,
de244d7.*

The obvious place to animate a `<details>` open/close is `::details-content`,
which is what the pseudo exists for. Doing that made the panel flicker BEHIND
later table rows mid-fade.

Cause: `0 < opacity < 1` creates a stacking context, `opacity: 1` does not. So
animating opacity on `::details-content` made *that pseudo* a transient stacking
context only while the fade was running, trapping the panel underneath rows that
come later in paint order. Raising `z-index` on `.log-reveal` did not help — it
is a table-cell stacking context and cannot lift past later `<tr>`s at all.

Decision: the opacity transition and `@starting-style` live on the panel itself
(`.log-reveal ul/p`), which is already `position: absolute` + `z-index` and so a
*stable* stacking context at every opacity. `::details-content` transitions only
`content-visibility` (`allow-discrete`), to keep the panel rendered through the
close.

The trap that follows: those two durations live on different elements but MUST
match, or the panel is yanked mid-fade-out. Both read one custom property,
`--reveal-fade` on `.log-reveal` — the single knob. Do not split them.

## D-022 · The AI-log Total row rides on a curtain, not on a sticky `<tfoot>`
*Recorded retroactively — decided 2026-09-05 after four attempts (842fe03,
6c08db4, 188b6bf, 58f787b).*

Pinning the Total row to the bottom of the log dialog looks like a one-liner and
is not. What failed, in order:

1. **`position: sticky` on the `<tfoot>` alone.** A sticky element can never be
   positioned outside its own containing block, and the tfoot's is the `<table>`.
   It therefore cannot reach the dialog's bottom edge, and table rows peeked
   underneath it mid-scroll.
2. **An absolutely-positioned bar toggled by an IntersectionObserver.** Floated
   mid-content instead of pinning.
3. **A sticky tfoot plus a non-sticky spacer row.** Same clamping problem.

What works — and the reason to keep it: `.log-curtain`, an opaque `--bg-raised`
band that is a **direct child of the dialog**, so its containing block is the
dialog and it is never clamped. It is `position: sticky; bottom: 0; z-index: 2`;
the Total row pins at `bottom: var(--log-curtain-h)` with `z-index: 3`, exactly
on top of it. The two form one solid block down to the dialog edge, so nothing
shows underneath.

The curtain's `border-top` is also the table's closing rule, because the curtain
is the only element adjacent to the Total row in BOTH states (pinned and at
rest) — anywhere else the rule goes missing mid-scroll or doubles up at rest.

**This is why `.log-scroll` is square.** It must stay `overflow: visible` (the
dialog is the single scroller), so it cannot clip its sticky children to a
radius; a rounded border around square cell fills looked broken. "Round it when
the row sits naturally, square when stuck" has no CSS expression — there is no
is-stuck selector — so it would need a scroll listener or a sentinel observer.
Not worth it. Do not "simplify" any of this.

## D-021 · The two AI features share one UI vocabulary, enforced by shared builders
Recommendations and the taste verdict are separate services with separate
prompts, but to a user they are the same kind of thing: press a button, wait,
read a generated result, see what it cost. Their UI had drifted anyway — the
"New verdict" button was missing the busy state entirely, then had the wrong
cursor, then kept its hover while disabled. Each was reported separately.

Decision: the shared surfaces are built by shared functions rather than
reimplemented per feature — `busyButton()` (disable, spinner + "Thinking…",
lock the width, restore), `aiMetaFooter()` (the prompt/model/tokens/cost/duration
line plus a link into the log), `logLink()` (the link-styled button that opens
the log dialog). One CSS block each, with only *placement* differing per host.
A third feature would get the same treatment for free, and neither existing one
can drift again without the other following.

Two implementation notes worth keeping:

- **The busy width lock is measured, not declared.** `getBoundingClientRect()`
  at click time, cleared on restore. A hardcoded `min-width` silently goes wrong
  the moment a label or font changes, and the two buttons have different labels.
- **`visibility`, never `display`, for the wrapped-separator fix.** The log link
  sits inline after the metadata joined by a "·", and must drop to its own line
  as a whole unit when short of room. CSS has no "did this wrap" selector, so
  `syncMetaSeparator()` measures. Hiding the "·" with `display: none` changes
  layout, so the link would then fit, so the "·" would return, so it would wrap
  again — an infinite oscillation. `visibility: hidden` keeps the box, so the
  hide cannot alter the thing it is reacting to.

## D-020 · The AI-log table view is frozen; card-view work must prove it can't touch it
The desktop/table view of the AI call log took ~100 commits of screenshot-driven
polish to settle (sticky thead/tfoot via `.log-curtain`, the collapsed-border
divider painted as gradients, the reveal panel's caret + flip, themed
scrollbars). It is done and it is fragile — several of those rules are the only
CSS expression of a hard-won layout fact.

Decision: once the table view was signed off, **every** subsequent AI-log change
(the mobile card view, and anything later) must be provably unable to affect it.
Concretely: card-view CSS lives only inside `@media (max-width: 850px)`, and each
change is verified with `git diff <last-merge>..HEAD` showing (a) the only file
touched is `styles.css` — no shared JS/HTML — and (b) every hunk falls between
the `@media (max-width: 850px) {` line and its matching close. A browser never
applies those rules above 850px, so the table view is unaffected by construction,
not by inspection.

Corollary: the card view's own bugs are fixed *in place* at matching-or-higher
CSS specificity (the shared `.log-table` rules use `:last-child` /
`:not(:last-child)` selectors at 0,2,1–0,3,1 that keep winning into card mode),
never by refactoring the shared rules — that would put the table view back in
scope.

## D-019 · Six pre-migration log rows deleted, rather than annotated forever
The six oldest AI-log rows predate migration 001, so they carry no token split
and no duration — the columns simply did not exist when they were written. The
footer's summed `in / out` and total duration therefore covered only a subset,
and showing that honestly meant a `· 13/19` marker plus tooltips in the Total
row. That was a permanent piece of UI complexity paying for a temporary data
gap: the viewer only ever shows the 60 most recent calls, so those rows will
fall out of the window on their own after ~47 more calls.

Decision: delete those six rows and drop the coverage markers. The predicate is
self-describing — `prompt_tokens is null and completion_tokens is null and
duration_ms is null` matches exactly the pre-migration rows and can never match
a new one (every post-migration write records a duration, success or failure).

**This is a deliberate exception, recorded because the log's whole argument is
that it is an append-only audit trail.** Six rows were removed from it by hand,
once, for presentation reasons — not by any code path. The app itself still has
no way to delete a log row. `totals.detailed` / `totals.timed` stay in the
`/api/ai-log` response (and under test) so the partial-coverage case is still
handled correctly if it ever recurs; it is just not surfaced in the UI.

## D-018 · Route + resilience tests without touching the live DB
Added `test/routes.test.js` covering the SPEC §7.1 checklist items that the pure
-helper tests couldn't: validation 400s, duplicate 409, TMDB-down 502,
below-threshold 422, and OpenRouter-down 422 **with** a `status='failed'` row
written (the Module 13 "make failure visible" contract, now enforced). The
constraint was the binding working agreement to never touch the user's Supabase
data — so the client is replaced with an in-memory fake query builder
(`test/helpers.js`, keyed by `"<table>:<op>"`, recording writes so a test can
assert "a log row was written"), and TMDB/OpenRouter are stubbed via
`globalThis.fetch`. `server/index.js` now `export`s `app` and guards `listen()`
behind an is-this-the-entrypoint check so a test can run it on an ephemeral port.
No runtime behaviour changed. Chose Node's `--experimental-test-module-mocks`
(built-in, no dependency) over adding `supertest`/`sinon`.

## D-017 · Keep `/api/recommendations/history` rather than delete it
`/api/ai-log` (added in D-010) is a strict superset of `/history` for the
recommendation side — both tables, failure status, token split, duration,
totals — and it's the only log endpoint the UI calls. `/history` is unused and
untested, so code-hygiene says delete it. Decided to **keep** it: it's listed in
SPEC §4.5 (as optional), removing it is a SPEC-table deviation that buys nothing
on the impression/creativity axes and only a marginal workflow point, and a
pre-submission deletion carries dangling-reference risk. Instead: one sentence in
`docs/PROCESS.md` frames `/api/ai-log` as the primary audit surface and
`/history` as the narrower per-feature JSON view. Revisit as post-submission
cleanup.

## D-016 · Accessibility pass
Per-item action buttons (Rate/Edit/Remove, rec cards' Add) got name-specific
`aria-label`s so a screen reader in a 20-row list hears which film, not just
"Remove, button" repeated. Added live regions (`role="status" aria-live="polite"`)
on search results, the recs hint, and the verdict text so async results and
errors are announced, not just visually swapped. `aria-busy` on the two AI
trigger buttons while a call is in flight. The review "view more" toggle got
`aria-expanded`/`aria-controls`. Both `<dialog>`s got `aria-labelledby` (native
`showModal()`/`.close()` already handles focus trap and return-focus, so no JS
needed there). Poster `<img alt>` now reads "{title} — poster"; the no-poster
placeholder is `role="img"` with a labelled fallback instead of decorative-only.
Fixed a real heading-hierarchy bug: recommendation cards used `<h4>` directly
under the section's `<h2>` (skipping `<h3>`) — now `<h3>`, matching the ranked
list's card headings. Decorative spinners are `aria-hidden`. No visual change.

## D-015 · Test suite, health probe, process doc
Added `npm test` on Node's built-in runner (no new dependency) covering the pure
helpers where every truncation bug actually lived — `parseModelJson`,
`tidyReason`, `tidyVerdict`, `estimateCostUsd` — plus `loadPrompt` against the
real `prompts/` files, so a malformed prompt version fails the suite. Those four
helpers were made `export`-ed for testability; no behaviour change. `GET
/api/health` added for a future Node host. `docs/PROCESS.md` collects the
LLM-augmented workflow story (the recommend v1→v3 / taste_verdict v1→v4 prompt
chains as prompt-engineering evidence, the model guardrails, Incident 1 and the
binding agreement it produced) — the course grades process, so it's a
deliverable, not a note. Route-level and resilience tests remain manual.

## D-014 · Taste verdict over-corrected → `taste_verdict_v4`
v3's "ONE sentence, 20–30 words" landed, but the output degenerated into a bare
ratings-paraphrase ("Matt Murdock's darkness scores higher than Superman's
earnestness") — a readout, not a verdict, and too terse (user: "shouldn't go this
far with being short"). v4 gives the room back — 2–3 finished sentences, ~35–60
words — and redirects the content: characterise the person as a viewer (what they
chase, what bores them, what kind of moviegoer that makes them), name a film only
as evidence, never just recite the numbers. `max_tokens` 100 → 180, server
truncation ceiling 350 → 450. Tone + injection guard unchanged. New prompt file;
v1–v3 untouched.

## D-013 · Taste verdict still too long → `taste_verdict_v3`
v2's "one or two sentences, ~260 chars" still produced ~330-char run-ons
(em-dashes splicing three clauses). v3 is blunt: ONE sentence, 20–30 words, no
dash/semicolon/"yet/while" clause-chaining, "cut detail not the sentence". Also
`max_tokens` 160 → 100 so a rambler is physically bounded, and the server
truncation ceiling 300 → 350 (user request) so a marginally-long verdict still
shows in full. New prompt file; v1/v2 untouched.

## D-012 · Recommendation reason length → `recommend_v3`
v2 reasons ran 25–30 words and got clamped in the card ("…delivers that same…").
Two-sided fix: v3 prompt tightens to one short sentence, 8–16 words, no
clause-splicing dashes/semicolons; `tidyReason()` in the service strips markdown
and truncates at a sentence/word boundary past a 130-char ceiling; and the card
`.reason` clamp goes 3 → 5 lines so a compliant reason never clips. New prompt
file; v1/v2 untouched.

## D-011 · Taste verdict truncation + markdown → `taste_verdict_v2`
v1 output was hard-sliced at 240 chars, cutting mid-word ("…over c"), and the
model leaked markdown emphasis (`*Saw*`) that the plain-text banner rendered
literally. v2 prompt: explicit "finish the sentence", ban asterisks/markdown/
title-quotes, target ~260 chars. Service: `tidyVerdict()` strips `* _ \``, and
if still over a 300-char ceiling truncates at the last sentence end (else last
word + "…"), never mid-word. `max_tokens` 120 → 160 for headroom. New prompt
file; `taste_verdict_v1.md` untouched.

## D-010 · In-app AI call log + failure logging (migration 001)
Added `GET /api/ai-log` (both log tables merged, newest first, with totals) and a
wide modal viewer reachable from a footer link — so the audit trail can be shown
in the browser during the demo, not only in the Supabase table editor (SPEC § 7.2
step 4). Migration 001 adds `prompt_tokens`, `completion_tokens`, `duration_ms`,
`status`, `error_text` to both tables. The services were restructured so that once
an AI call is attempted a row is **always** written — a handled model/parse/network
failure logs `status='failed'` with the message, then re-throws for the calm inline
UI error. Pre-call guards (not enough rated movies, DB read failure) still throw
without logging — those aren't AI calls.

## D-009 · Recommendation reason voice → `recommend_v2`
The v1 reason read like a plot blurb ("A crime thriller about a bank robbery").
v2 asks for a second-person line tied to the user's own ratings/reviews
("You rated Whiplash a 10 — this has the same slow-burn dread"). Logic change, so
a new prompt file per CLAUDE.md § Prompt Versioning; `recommend_v1.md` is kept
untouched and every past `recommendation_logs` row still names the exact prompt
that produced it. `taste_verdict_v1` is unaffected — versioned independently.

## D-008 · Taste verdict never auto-runs
The banner shows a threshold message or a "tap for a verdict" prompt on load, and
only calls OpenRouter on the explicit "New verdict" click — no burning credit on
an unrequested repeat call every page load (SPEC § 2.3).

## D-007 · Ranking is derived, never stored
`GET /api/movies` returns movies ordered by `rating desc nulls last`; the
frontend numbers them 1..N on render. No stale `rank` column (SPEC § 2.1).

## D-006 · Frontend: vanilla, but not plain
No framework. The "polished, distinctive" bar (SPEC § 3) is met with deliberate
choices: poster as the anchor of every card, Fraunces display numerals for rank,
a marquee-amber accent on near-black, film grain, motion on hover/entry, a
gradient-sheen verdict banner. AI-suggested cards reuse the card language but
carry a quiet "AI pick · not yet rated" marker (SPEC § 3.3).

## D-005 · Prompt-injection posture
Review text is untrusted user input flowing into both prompts. Mitigations, in
layers: (1) the text is length-capped and wrapped in explicit BEGIN/END data
markers; (2) each prompt tells the model the block is data and to ignore embedded
instructions; (3) recommendation output is constrained to a JSON array and every
title is TMDB-verified, so a partial injection yields at worst a strange
suggestion; (4) the verdict is length-capped server-side and rendered as
`textContent`, so at worst it's an off-tone banner line.

## D-004 · Model choice: cheap by default
`anthropic/claude-3.5-haiku` via OpenRouter. The tasks are small (pick 3–6 titles;
write one teasing sentence). Module 9: match the model to the task's difficulty;
the biggest cost lever is model choice. Overridable via `OPENROUTER_MODEL`.

## D-003 · Cost logging is structural, not decorative
`recommendation_logs` and `taste_verdict_logs` store `tokens_used` and
`estimated_cost_usd` per call. `config.estimateCostUsd` uses a small per-model
price table; unknown models log `null` rather than a wild guess. A log-write
failure is surfaced as an error, not swallowed — the audit record is the point.

## D-002 · The AI is a component, not the product
Two narrow LLM features (recommendations, taste verdict), each in its own service
module, each with its own versioned prompt file. Either can be mocked or removed
without touching movie CRUD. The model never supplies a fact shown to the user:
recommendations return *titles only*, and TMDB supplies poster/year/overview after
a cross-check. This is the concrete guard against hallucinated movies.

## D-001 · Scope: single-user, no auth — and why that isn't a security hole
The app is one person's movie list. Module 17's real topics — injection, secrets,
prompt injection, least privilege — are all demonstrable without multi-user auth.
Least privilege here = the frontend/back-end use the Supabase **anon key**, which
is RLS-bounded, never the `service_role` key. Adding accounts would be
manufacturing a demo the app doesn't need.
