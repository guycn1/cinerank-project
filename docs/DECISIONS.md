# Decision log — the *why*

Started at project conception, not bolted on afterwards (course Module 8: the
reasons behind a choice are clearest at the moment it's made, and the agent can't
recover them later). **Newest first — a new entry goes at the TOP of this
file, directly under this header.**

---

## D-034 · "ranking updated" is checked before it is claimed
The three confirmation toasts had three different shapes and two named no film
at all (`Added “X” — rate it any time.` / `Saved — ranking updated.` /
`Removed.`). The user asked for one shape with the film first, which is what
they now are: `“X” added…` / `“X” saved…` / `“X” removed.`

The interesting part is the second clause of the save toast, which took three
passes.

**First pass — deleted it.** The reasoning was that editing only a review does
not change the ranking, so the clause was an unverified claim of the same kind
as the central 500 handler's "on our side" (removed the same afternoon on the
user's own principle: a vaguer message that is true beats a specific one that is
not).

**The user pushed back, and was right.** Every save calls `loadMovies()`, which
re-fetches the entire list server-sorted and re-renders it — so a ranking update
really is triggered on every save, unconditionally. The claim was never false,
and backlog #16's original wording ("claims a ranking change even when only the
review was edited") was unfair on the same count. Recorded plainly: the argument
for deleting the clause was overstated.

**What survived the pushback** is a narrower objection. "Ranking updated" reads
as a claim about the OUTCOME, not about an internal recompute. When the film
stays at #3 the user goes looking for a change that is not there. That is a
wording problem, not a truth problem — which makes it the user's call, not a
correctness fix to be made unilaterally.

**Settled on: say it only when it is observably true.** A signature of the
ranking as displayed is captured before the write and compared after the reload.
Costs one comparison, and the sentence becomes true in the strong sense — the
app claims only what it verified. The two rejected options are both defensible
and are one line each: restore the clause unconditionally (true, per the
pushback above) or leave it off permanently (never wrong, and the re-sort
animation already shows a move).

**The trap, and Claude got this wrong first.** The obvious signature is the list
of ids in order — and it is not sufficient. Unrated films already sort last, so
rating the only unrated film with a low score can leave it in exactly the same
POSITION while its rank slot changes from `?` to a real number: a visible
ranking change with no reordering. `rankSignature()` therefore pairs each id
with whether the film is rated. Do not "simplify" it back to positions.

**Not changed: the two error toasts.** They pass the server's own wording
through by design, and prefixing it client-side produces doublings like
`Couldn’t remove “Dune” — Couldn’t reach CineRank…`. Fixing that means changing
the messages at the source; it stays on backlog #16.

---

## D-033 · The unrated line is a chip, because muting it was the wrong correction
`.movie-card__body .unrated` — "Not rated yet — rate it to place it in the
ranking." — was `--crimson`, the app's error colour, on a state where nothing
has failed. That much was clear from the audit (backlog item #8).

**The obvious fix was to mute it, and it was rejected.** The precedent was
right there and was the one cited when the item was raised: the search panel's
"No matches" had already moved out of `makeError()` into the muted
`.search-note`, precisely because an empty result set is not a failure. Applying
the same move here — `--ink-dim`, review size — would have landed the line in
the same colour, the same weight and the same position as a review. The user
pushed back before it was built: an unrated film is a *pending* state the user
should stay aware of, and dropping it to the tone of body prose lets the
surrounding elements swallow it. The two cases only look alike. "No matches" is
transient text in a panel that is about to be replaced; "Not rated yet" is a
persistent property of a card that will sit in the list until acted on.

**So the correction is a demotion in urgency, not in prominence.** The line is
distinguished by **shape first, colour second**: `Not rated yet` became a chip,
which no review and no title ever is, so it reads as a status marker before its
colour registers at all. The instruction ("Rate it to place it in the ranking.")
stays beside it as quiet `--ink-dim` prose, and wraps below on a narrow card.
The em dash that joined them is gone — the chip's edge is the separator.

**Amber was not picked because it is the accent colour.** It was picked because
the app already has a marker for this exact idea: `.rec-card::before` renders
"AI pick · not yet rated" as an amber pill, which is the "clear but subtle
visual marker" CLAUDE.md's design notes call for. A film you added but haven't
rated is that same state on the other side of the list, so it should not invent
a second visual language for it. `.unrated__badge` therefore borrows that rule's
sizing, letter-spacing and radius on purpose — retune one and retune both.

Alternatives weighed and dropped:
- **Plain amber text, no chip.** One line of CSS, but amber alone is this app's
  *interactive* colour (`.review-toggle`, links, `.recs__trigger`), so a
  non-clickable amber sentence sitting directly above a "Rate" button invites a
  click that does nothing. The chip's `--amber-deep` border reads as a label,
  not a control, and the element is not focusable.
- **A left border / leading dot with muted text.** Distinguishes structurally
  without touching colour, but it is a shape the app uses nowhere else — the
  chip already exists in the vocabulary.
- **Making the rank slot's `?` amber too.** Rejected: D-029 sized and faded that
  `?` so it reads as an *absence* beside the ranking rather than competing with
  the rank numerals, and lighting it up would undo that. One marker, in the body,
  next to the button that resolves it.

Not changed: the `?`, the missing score badge, and the button reading "Rate"
instead of "Edit" are the card's other three unrated signals and are all correct
as they stand.

---

## D-032 · A failed save reports inside the rate dialog, not via the toast
Testing the save-failure path (throttled to Offline) showed the crimson toast
appearing *behind* the rate dialog and dimmed by its backdrop — legible only if
you already knew it was there.

**The obvious fix does not exist.** A modal `<dialog>` opened with `showModal()`
is in the **top layer**, which paints above every normal element *regardless of
`z-index`* — there is no value that lifts the toast above it, and the
`::backdrop` dims everything beneath as well. The only ways into the top layer
are another modal dialog or the Popover API. Converting the toast to a popover
would work, but it means fighting the UA's `[popover]` defaults (`position:
fixed; inset: 0; margin: auto; border: solid`) on a component every flow depends
on, hours before submission, to serve one call site.

Decision: report the failure **inline in the dialog**, above the buttons, and
leave the toast for confirmations. This is not a workaround — it is what the rest
of the app already does. Search failures render in the results panel via
`searchNote()`, the verdict's failure replaces the verdict text, the recs error
belongs in `#recs-hint`. **Errors go next to the thing that failed; the toast
reports things that succeeded.** The rate dialog was the one place breaking that
pattern, and the top-layer problem was the symptom rather than the cause.

**Trap: do not "fix" this later by making the toast a popover and reverting the
inline error.** That would restore a page-level error message for a failure whose
context is entirely inside the dialog, and it would put the rate dialog back out
of step with the other three sections.

Two toast calls still fire while a dialog is *closing* ("Added … — rate it any
time" on Skip, and "Saved — ranking updated"). Both are dimmed for the ~250ms of
the dialog's fade-out. Both are confirmations rather than errors and remain
readable for the other ~3s, so they are deliberately left alone.

---

## D-031 · The ranked list re-sorts with a View Transition, not a rewritten renderer
`renderRanked()` opens with `replaceChildren()`, so every render destroys and
rebuilds every card — and each card carried `animation: fade-slide` with a
staggered delay. Rating one film therefore replayed the *entire* list's entrance:
~850ms of the whole page shimmering because one number changed. Removing a film
was worse — the list vanished and re-entered. Meanwhile the README's demo script
promises "the ranked list **re-sorting live** as ratings change", and there was
no re-sorting to watch: the list blinked out and a new one faded in.

Four options were laid out:

* **A — animate first paint only** (~6 lines). Kills the churn, keeps the
  entrance on load. But the list still hard-swaps, and expanded reviews still
  collapse.
* **B — reuse card elements keyed by movie id** (~50 lines). The "proper" fix:
  fixes the churn, the collapsing reviews and the poster churn, and is the
  prerequisite for C.
* **C — B plus a FLIP transition** (~25 more lines). Cards visibly slide.
* **D — `document.startViewTransition()`** (~10 lines). The browser snapshots
  before and after and morphs between them, matching elements by
  `view-transition-name` — so it delivers C's effect *without* B's refactor,
  because it does not care that the elements were destroyed.

**Claude recommended B, then C. The user overruled it, correctly, on time and
risk.** With hours left before submission, B's failure mode is the wrong shape:
a missed field on a reused card produces a *stale card that still looks
correct*, which is the most expensive kind of bug to find under time pressure —
and B meant rewriting the function whose rated/unrated logic D-029 had just
settled. D's failure mode is the opposite: feature-detect, and an unsupported
browser gets exactly today's behaviour. Nothing half-renders.

**A and D ship together, not D alone.** D on its own would fight the existing
entrance: every rebuilt card still runs `fade-slide` *inside* a snapshot that is
simultaneously cross-fading it. Muddy. A is what makes D legible.

### The user's question that changed the design

Asked what a removal would look like after generating recommendations and a
verdict — and whether other sections would morph "just because something updated
in the ranked list". The answer required correcting the framing: **a View
Transition snapshots the whole document and cannot be scoped to one section.**
What follows from that is two cases, not one:

1. **Unchanged, unmoved content** (header, verdict, search) cross-fades against
   an identical copy of itself. `(1−t)·X + t·X = X` — invisible by construction,
   not by luck.
2. **Content that moved** is the real problem. Removing a card shortens the list,
   so `.recs` and the footer genuinely shift up — they do today too, instantly.
   Unnamed, they belong to the single `root` group, and cross-fading something
   that moved renders it as a **ghosted double image at both positions**. With
   four tall poster cards that would have been glaring.

Hence two mitigations that would not otherwise exist: `view-transition-name` on
`.recs` and `.site-foot` so they *morph* between positions instead of ghosting,
and — less obvious — **running the three `sync*()` calls BEFORE the transition
rather than inside it**, so the recs hint, verdict placeholder and search buttons
are already settled when the first snapshot is taken. That leaves the ranked list
as the only difference between the two frames, which is as close to "scoped" as
the API permits.

### Two Claude errors, both caught

* **Risk "the grain will double-composite" was wrong.** Both root snapshots are
  flattened images containing the same grain layer, so the cross-fade preserves
  it at constant strength; only the animation freezes for ~250ms, at
  `opacity: 0.06`. The user pushed back that the grain was not what worried them
  — the other *sections* were — and they were right that the analysis had aimed
  at the wrong target.
* **Firefox support was recalled as "~139".** MDN says **144** (Chrome/Edge 111,
  Safari 18). The user checked rather than taking it, and verified live in Edge
  152, Chrome 152 and Firefox 155. The recollection was close enough to be
  dangerous — the habit of verifying is what caught it.

### What this deliberately does NOT fix

Expanded reviews still collapse on any re-render, and posters still re-decode,
because the DOM is still rebuilt. Only option B addresses those; the review
collapse stays open as its own item. This is a chosen trade, not an oversight.

### Traps

* **Do not name `.ranked` itself.** Cards inside it are named individually, and
  nesting a named element inside another named one changes which snapshot owns
  what.
* **Keep the `sync*()` calls outside the transition callback.** Moving them in
  reintroduces cross-fading of unrelated text.
* **`view-transition-name` must be unique per document**, hence the `movie-`
  prefix on the UUID — a bare UUID can begin with a digit, which is not a valid
  CSS ident, and a duplicate aborts the entire transition.

---

## D-030 · Three-digit ranks are capped, not documented away
A forced test (ranks rewritten to 250+ in the console) showed three-digit
numerals running under the poster: the rank font clamps at `3.4rem` = 54.4px and
Fraunces Black figures measure 0.66em, so "250" paints ~109px. Its budget is ~99px
— the 64px track *plus* the 17.6px card padding and 19.2px gap it may
legitimately spill into — and the poster, later in DOM order, paints over the
overflow.

**Claude first recommended NOT fixing it**, and wrote that up as a measured
non-fix: unreachable below 100 films, demo seed list is 3–4, and each candidate
fix looked more expensive than the defect. **The user overruled it on grounds
Claude had not weighed** — that a grader reading an unchecked TODO box may not
read the paragraph under it, and will score "documented limitation" as "too lazy
to fix edge cases". That is a judgement about the audience, and the audience is
the point of the artefact. Recorded because the reasoning is invisible in the
diff: the code now contains a fix for a case nobody will hit, and a later reader
would reasonably wonder why.

The counter-argument Claude *did* win: the user proposed `scale: 0.5` for 100+,
calling it "ugly, sloppy, but better grading-wise". Both halves were pushed back
on and the user accepted:

* **0.5 is roughly twice the shrink needed.** The numeral does not have to fit
  the 64px track — it only has to avoid the card border and the poster, a ~99px
  budget, so something near 0.8× was argued to be enough (it was not — see the
  three sizing passes below; the *principle* held, the first number did not).
  A subtle step reads as typographic fitting where a halved numeral reads as a
  bug, and a visible hack grades worse than the honest TODO it was meant to
  replace.
* **`font-size`, not `scale`/`transform`.** A transform shrinks the absolute
  `1.5px -webkit-text-stroke` with the glyph, so the numeral would sit beside its
  two-digit neighbours with a visibly thinner, washed-out outline. Changing the
  font size leaves the stroke at its intended weight. Neither affects layout —
  the track is fixed and only the *text* ever overflowed — so posters stay
  aligned card to card either way.

CSS cannot count characters, so `renderRanked()` marks the digit count with an
`is-wide` class; the threshold is 99 and not 9 because two digits were measured
and fit at every width.

**The size took three passes, because the first two were estimated instead of
measured — this is the substantive lesson of the entry.** `2.75rem` was derived
from a guess that Fraunces Black's figures are ~0.63em; it still clipped.
`2.1rem` then over-corrected to a pessimistic ~0.8em, which cleared but made
#100 conspicuously smaller than #99 — sliding back toward the "ugly, sloppy"
look the fix existed to avoid. Only then was the value actually measured, with
`Range.getBoundingClientRect()` on a live `222`: **0.66em per digit** (66.5px at
a 33.6px font). Solving against that gives `clamp(1.5rem, 4vw, 2.4rem)` —
*larger* than the pass before it. A further pass then widened the card-mode
clearance again — 6.8px was mathematically sufficient but still read as cramped,
because the eye judges the gap against the 40px track beside it rather than
against zero. Final: ≥10.8px clear on desktop, ≥12.3px in card mode,
and a 0.71× step down from the two-digit size. **Re-measure, never re-tune by
eye.**

Two details that fall out of the real numbers. The binding side is the card's
**17.6px padding**, not the 19.2px gap, so the left edge is what constrains the
size. And the `4vw` middle term is load-bearing rather than decorative: it
brings the numeral to ~24.8px by the 620px breakpoint, where the track drops
64px → 40px and the budget collapses from 99px to 75px in a single step. Lower
the ceiling freely; do not raise that coefficient without re-checking the 620px
case, which is the one the whole clamp is shaped around.

**Three agent errors, all caught by the user.** (1) The first description of the
failure claimed the numeral "sits flush against the [card] border" and that
nothing clipped it — a screenshot showed it vanishing under the poster instead.
Corrected in place rather than preserved, per the "wrong when written"
exception. (2) The claim that the fix was a no-op in card mode, and that card
mode already cleared the poster on its own — both followed from the same bad
figure-width estimate; the 40px track is in fact *tighter* relative to its font
than the 64px one, so the clamp floor had to come down as well as the ceiling.
(3) The original audit flagged *two*-digit ranks as broken on mobile; they are
not, and the user disproved it with a sharper test than the one suggested —
forcing ranks to 20+ instead of 10+, so the narrow `1` could not flatter the
result.

**Do NOT "fix" this by auto-sizing the rank track** (`minmax(64px, auto)`). It is
the obvious move and it is wrong: cards with wider ranks get a wider first
column, so poster left edges stop aligning down the list — trading a problem
nobody reaches for one everybody sees. Ranks of 1000+ remain unhandled by choice.

---

## D-029 · Only a rated film earns a rank number — and the crown is not `:first-child`
The ranked list numbered every card `i + 1`, unrated films included. So an
unrated film was handed a rank, directly under its own caption saying "Not rated
yet — **rate it to place it in the ranking**." It had already been placed. The
second half was worse: the `#1` treatment (solid amber, glow) was
`.movie-card:first-child .movie-card__rank`, pure DOM position, so on a list
where nothing was rated yet the golden **#1** landed on a film with no rating at
all.

Four options were weighed:

* **Reword the caption** ("ranked last by default") — cheapest, and rejected.
  It fixes the sentence without fixing the claim: an unrated film genuinely has
  no rank, so "#7" stays false, just more carefully worded. It also leaves the
  crown bug standing.
* **Group unrated films into a labelled sub-section**, or **move them out of the
  ranked list entirely** — both rejected for the same reason: they fight the add
  flow. Adding a film opens the rate dialog with **"Skip for now"**, which is a
  deferral, not a rejection. The film should stay in the list you just added it
  to, quietly nagging. Relocating it makes "Skip for now" feel like the film went
  *somewhere else*.
* **Chosen: one list, but only rated films consume a number.** A counter
  (`rankNo`) that increments only when `m.rating != null`; unrated cards show a
  glyph in the rank slot instead.

**The glyph: `?`, not `—`.** Claude proposed `—` in `--ink-faint`, reusing the AI
call log's missing-Tokens/Cost vocabulary (D-021, shared UI vocabulary). The user
chose `?` instead. It is the better call: `—` means "this value does not exist",
which is what an empty log cell means, but an unrated film's rank is not absent —
it is *undetermined pending an action the user can take*. `?` says "unknown, ask
me" where `—` says "nothing here". Styled much smaller and faint so it reads as
an absence beside the ranking rather than an entry competing within it.

**Two traps this decision creates, both handled and both easy to undo later:**

1. `const isRated = m.rating != null` — **never truthiness.** `0` is falsy, and
   0.0 is a rating the user deliberately gave. A later "simplification" to
   `m.rating ? …` would silently strip a 0.0 film of its rank, its score badge
   and its Edit label in one move. The four sites that branch on rated-ness now
   all read the single `isRated` const so they cannot drift apart.
2. **`rankNo` must not be "simplified" back to the loop index `i`.** They agree
   today only because the server sorts `nulls last`, making rated films
   contiguous at the top — that is a coincidence of the sort order, not the rule.
   The counter states the rule; `i` merely happens to match it.

Screen readers: the `<ol>` still numbers every `<li>` implicitly, so an unrated
card could be announced as "list item 7" while showing `?`. The rank slot is
therefore `aria-hidden` on unrated cards and the "Not rated yet" line carries the
meaning. Splitting the list into two elements purely to fix the announcement was
considered and judged disproportionate.

Deliberately **not** changed: unrated films still sort to the very bottom, so on
a long list a just-skipped film is far out of sight. Raised with the user, who
chose to leave it — noted here so the omission reads as a decision rather than an
oversight.

---

## D-028 · Search stays typo-intolerant; the empty state explains instead
Search is strict: "obamma" returns nothing, "obama" returns plenty. First
established that this is **TMDB's** behaviour, not ours — `searchMovies()` passes
the query straight through with no filtering, TMDB's `/search/movie` has no
fuzzy or edit-distance parameter to enable, and TMDB's own website behaves the
same way. So there was nothing to un-break on our side.

**A local, no-AI spellcheck is not merely expensive, it is impossible here.**
Correction needs a corpus to correct *toward*, and we have none: the catalogue
lives at TMDB, we only ever see the twelve results of one query, and on a typo we
see zero. A generic dictionary would not help either — film titles are full of
proper nouns, invented words and stylised spellings. Nothing in this repo can
turn "obamma" into "obama".

That left one real fix — ask the model, then re-query TMDB — and it was
**rejected on scope**. It would actually fit the never-trust-the-model posture
perfectly (D-002/D-005: the model produces only a search string, TMDB still
supplies every fact, blast radius is a weird result). But it is a *third* AI
feature where SPEC scopes two, and CLAUDE.md requires every OpenRouter call to be
logged with tokens and cost — neither existing log table fits, so it needs
migration 002, a new service, a versioned prompt file and tests, days before
submission. Revisit post-submission if ever.

Decision: reword the empty state to echo the query back —
`No matches for "obamma". Check the spelling, or try a different title.` It
detects nothing; it just makes the typo self-evident, since after typing fast
you do not reliably recall what you typed. It also fixes a small dishonesty: the
old "try a different title" implied the film was absent, sending the user hunting
for a different film rather than checking their spelling, when both causes are
possible. The query is capped at 40 characters so a pasted block cannot blow the
message out, and echoing raw input is safe by construction because `searchNote()`
builds with `textContent`.

**Two agent errors worth recording, both caught by the user.** The options were
presented with a "~15 minutes" estimate for this one; it is two lines, and the
number was inflated to make three options feel more differentiated — which is
padding, not estimating. And a "full" and a "trimmed" variant were offered as if
they were different options when they were *identical code* with a different
sentence; the difference was the agent disagreeing with its own copywriting. The
user asked what the real implementation difference was, and there was none.

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
