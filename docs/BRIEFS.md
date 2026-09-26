# BRIEFS.md — the two directing documents (Module 8)

[Module 8](../DOSSIER.md#module-8-interface-design-and-app-documentation) asks
for two documents written to **direct an agent**, not to flatter a reader: an
interface brief for one screen, and a documentation brief for one component. Its
governing distinction is that agents produce *descriptive* documentation well —
what the code does, drawn from the code — and *explanatory* documentation badly,
because why a thing was built that way is not in the source to be read off.

Both briefs are below. The first already existed and is pointed at rather than
copied; the second is new.

## 1. Interface brief — the Home screen

**It lives in [`SPEC.md` § 3](../SPEC.md#3-interface-design-module-8) and stays
there.** It is not reproduced here, for the same reason the definition of done
is not reproduced in [`docs/FRAMING.md`](FRAMING.md#definition-of-done): a brief
held in two places drifts, and then neither is the brief.

It was written as a **governing document alongside the first scaffold** rather
than retrofitted to a UI, which is the only time an interface brief is worth
anything, and it breaks the screen into the four parts
[Module 8](../DOSSIER.md#module-8-interface-design-and-app-documentation)
names so each could be decided on purpose rather than absorbed from whatever the
training data treats as ordinary:

* **[§ 3.1 Flow](../SPEC.md#31-flow)** — Home to add to rate and back;
  recommendations as a secondary panel off Home, not a separate journey to hunt
  for.
* **[§ 3.2 Hierarchy](../SPEC.md#32-hierarchy)** — the ranked list is primary,
  the verdict banner is visible early but must not compete with it, the
  recommendations trigger stays deliberately secondary.
* **[§ 3.3 Interaction](../SPEC.md#33-interaction)** — what each control must
  make unambiguous.
* **[§ 3.4 Feedback](../SPEC.md#34-feedback-including-bad-states)** — loading,
  empty, not-enough-data, failure and duplicate states, each specified with the
  state it must not be confused with.

**What it deliberately did not fix, and what that cost.**
[§ 3.2](../SPEC.md#32-hierarchy) declines to prescribe layout, motion or
typography and says so in the text, so the openness could not be mistaken for an
omission. That was the right call for an instruction about *taste* — but it is
also why the real interface requirements emerged from using the built app rather
than from the brief, which is the whole of
[Turn 2 in `SPEC.md` § Specification status](../SPEC.md#turn-2--the-interface-requirement-emerged-from-use-2026-09-06-to-2026-09-12).
An interface brief can fix the hierarchy and the mental model. It cannot
anticipate that a hovered card drifts toward its upper neighbour, or that a flex
item's automatic minimum size will break a button label in two. Those needed a
running app and a human looking at it.

## 2. Documentation brief — the AI call log

**Status: commissioned here, and WRITTEN — [`AI-CALL-LOG.md`](AI-CALL-LOG.md),
2026-09-14.** This file is the brief; that file is the result, and the two are
worth reading in that order, because the brief is a specification for a document
and the document can be judged against it.

*(Written after the user, reading this brief during a pre-merge sweep, called
the missing document a real gap — which it was: the brief argues that this
component has the highest ratio of non-obvious decision to line of code in the
project, and those decisions were still undocumented.)*

### Audience

A developer — human or a future agent session — who did **not** build this
component and now has to change it without breaking it. They can read the code.
What they cannot read is which of its apparently arbitrary choices are load-bearing.

### Purpose

To stop the next change from silently undoing a fix. This component has the
highest ratio of non-obvious-decision to line-of-code in the project: 124
lines of route, five cell builders in [`public/app.js`](../public/app.js)
(`cell`, `abbrCell`, `modelCell`, `timeCell`, `resultCell`), about 160
stylesheet lines, and **nine decision-log entries** behind them —
[`D-003`](DECISIONS.md#d-003--cost-logging-is-structural-not-decorative), [`D-010`](DECISIONS.md#d-010--in-app-ai-call-log--failure-logging-migration-001), [`D-018`](DECISIONS.md#d-018--route--resilience-tests-without-touching-the-live-db), [`D-019`](DECISIONS.md#d-019--six-pre-migration-log-rows-deleted-rather-than-annotated-forever), [`D-020`](DECISIONS.md#d-020--the-ai-log-table-view-is-frozen-card-view-work-must-prove-it-cant-touch-it),
[`D-022`](DECISIONS.md#d-022--the-ai-log-total-row-rides-on-a-curtain-not-on-a-sticky-tfoot), [`D-047`](DECISIONS.md#d-047--a-failure-may-only-offer-the-ai-call-log-when-a-row-was-actually-written-r8-r9), [`D-069`](DECISIONS.md#d-069--the-ai-call-log-overclaimed-its-own-coverage-for-the-whole-life-of-the-feature-and-the-spec-had-it-right-all-along), [`D-070`](DECISIONS.md#d-070--log-rows-that-misnamed-their-model-were-deleted-by-hand-not-preserved-as-history). *(The route was given as "roughly 100" lines; it was 124 when this brief
was written and is 124 now. The nine are named rather than counted so the
figure can be checked, and so `check-claims` resolves each one.)*

Several of its rules look like they could be simplified and cannot.

### Why descriptive documentation is not enough here

An agent asked to "document the AI call log" will correctly describe a dialog
that shows merged rows from two tables with sticky headers and a totals row.
Every sentence would be true and the result would be useless, because **every
hard-won rule in this component is invisible in its final state.** The sticky
totals row looks like it could be a sticky `<tfoot>`. The divider looks like it
could be a border. The reveal panel's fade looks like it could live on
`::details-content`. Each of those is the version that was built first and failed.

### Required sections

1. **[What it is and why it exists](AI-CALL-LOG.md#1-what-it-is-and-why-it-exists)**
   — one paragraph. It is the
   [`SPEC.md` § 7.2](../SPEC.md#72-manual-demo-script) "not a wrapper" proof
   made visible in-app, and the audit surface
   [Module 17's ASI09 answer](SECURITY.md#asi09--human-agent-trust-exploitation)
   rests on.
2. **[Where the data comes from](AI-CALL-LOG.md#2-where-the-data-comes-from)** —
   `GET /api/ai-log` merging two tables, and what the route sends *structured*
   rather than flattened, and why that mattered.
3. **[The scrolling and pinning model](AI-CALL-LOG.md#3-the-scrolling-and-pinning-model)**
   — stated as one mechanism, because the pieces only make sense together.
4. **[The two view modes](AI-CALL-LOG.md#4-the-two-view-modes)** — table above
   ~850px, one card per call below, and what the boundary costs.
5. **[Traps](AI-CALL-LOG.md#5-traps)** — the
   [explicit list below](#the-decisions-the-text-must-explain), each with what
   breaks if it is undone.
6. **[What is safe to change](AI-CALL-LOG.md#6-what-is-safe-to-change)**, so the
   document does not read as "touch nothing".

### The decisions the text must explain

Not merely mention. For each, the alternative that was tried first and why it
failed:

* **The dialog is the single scroller, not the table.** An earlier version
  scrolled a flex-sized inner box, which collapsed to nothing on a short
  viewport.
* **`.log-curtain` exists because a sticky `<tfoot>` alone cannot reach the
  dialog's bottom edge** — it is clamped by its own containing block, so rows
  peeked under it mid-scroll.
* **The totals divider is painted as background gradients**, not a border (the
  collapsed-border layer leaves it behind on pin) and not a shadow (webkit does
  not paint outer shadows on cells; inset ones stop at the collapsed border).
* **The reveal panel's opacity animates on the panel, never on
  `::details-content`** — animating the pseudo made it a stacking context only
  while mid-fade, trapping the panel behind later rows.
* **`--reveal-fade` is one custom property read by two different elements**, and
  they must match or the panel is yanked mid-fade.
* **The Result column is a fixed width with an absolutely positioned panel**, so
  opening a row can never reflow the table or steal width from its neighbours.
* **`.log-scroll` must stay `overflow: visible`** — it is not the scroller, and
  clipping would round the sticky cell fills against square backgrounds.
* **Card view's two specificity fixes** (D-era, below 850px): a leftover desktop
  separator stacking into a vertical line, and a desktop `last-child` rule
  outranking the card rule and removing the final row's separator.
* **Six pre-migration-001 rows were deleted by hand
  ([D-019](DECISIONS.md#d-019--six-pre-migration-log-rows-deleted-rather-than-annotated-forever))**
  so the totals footer needs no partial-coverage markers. Anyone re-adding old
  rows re-opens that.

### Out of scope for the document

The AI services themselves, the prompt chain, and cost estimation. Those have
their own homes in [`docs/PROCESS.md`](PROCESS.md) and
[`docs/DECISIONS.md`](DECISIONS.md), and pulling them in would make this
document the thing nobody finishes reading.

### Where it goes, and how to tell it worked

[`AI-CALL-LOG.md`](AI-CALL-LOG.md), written 2026-09-14. The test is not length:
**hand it to someone who has never seen the component and ask them to make the
totals row taller.** If they change the curtain height with it, the document
worked. If they change only the row and leave a gap at the dialog's edge, it did
not. That test is restated as the written document's own
[closing section](AI-CALL-LOG.md#7-how-to-tell-this-document-worked), so it
travels with the thing being judged rather than only with the brief.