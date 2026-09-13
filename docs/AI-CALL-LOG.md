# The AI call log — how it works, and what will break if you change it

**Audience:** someone who did not build this component and now has to change it.
You can read the code. What you cannot read is which of its apparently arbitrary
choices are load-bearing.

**This document exists because almost every hard-won rule here is invisible in
the finished result.** The sticky totals row looks like it could be a sticky
`<tfoot>`. The divider under it looks like it could be a border. The reveal
panel's fade looks like it could live on `::details-content`. Each of those is
the version that was built first, and each failed. A description of what the
component *does* would be entirely accurate and would not save you from any of
them.

Commissioned by [`BRIEFS.md`](BRIEFS.md) § 2.

## 1. What it is and why it exists

A modal dialog, opened from the footer, listing every call this application has
made to OpenRouter — both AI features, successes and failures together, with
prompt version, model, token split, duration, status and estimated cost per row.

It is two claims made visible:

* **`SPEC.md` § 7.2's "not a wrapper" proof.** Anyone can assert their app logs
  its AI usage. This is the assertion rendered, in the product, for the person
  being asked to trust the output — not for someone with database access.
* **The answer to OWASP `ASI09`, Human-Agent Trust Exploitation**, in
  [`SECURITY.md`](SECURITY.md). A user cannot calibrate trust in a system that
  will not say what it did. This is what saying looks like.

Cost logging is a hard requirement of the course rather than a nice-to-have, and
this dialog is where that requirement is discharged in public.

## 2. Where the data comes from

`GET /api/ai-log` (`server/routes/aiLog.js`) reads **two tables** —
`recommendation_logs` and `taste_verdict_logs` — normalises them into one row
shape, merges, sorts by `created_at` descending, and returns the newest 60 with a
totals object.

**It shows the 60 most recent calls, not all of them.** Each table is queried with
`.limit(60)`, the merged set is sliced to 60, and the footer totals are computed
over *that slice*. Once the two tables hold more than 60 rows between them, the
`Total · N calls` figure pins at 60 and each new call pushes the oldest out.

That cap is deliberate and is documented at the query. **If you change it, change
the two strings in `public/index.html` that describe the dialog with it** — the
blurb inside it and the footer panel that opens it. Those two said "every
OpenRouter call CineRank has made" for the entire life of the feature, which
stopped being true the day the cap first bit; see `D-069`.

### What the route sends structured, and why it matters

The Result column has exactly three shapes — a recommendation's verified title
list, a verdict's text, or either feature's error message. An earlier version
flattened all three into one `summary` string server-side.

**The route now sends `suggested_titles`, `verdict_text` and `error_text`
separately**, and the client decides how to render each. That is what makes the
Result column collapsible at all: you cannot put a pre-flattened sentence behind
a `<details>` and reveal a list.

**`suggested_titles` holds what the user was SHOWN, not what the model named.**
Titles the model invented that TMDB could not confirm, films already owned, and
duplicates within one run are all dropped before this column is written. An audit
row recording what was *asked for* rather than what was *delivered* would be worse
than none, and a test asserts exactly this.

## 3. The scrolling and pinning model

**State this as one mechanism, because the pieces are meaningless apart.**

**The dialog is the single scroller.** `.log-dialog` carries
`overflow: auto; max-height: 88vh`. `.log-scroll` — despite the name — is
`overflow: visible; flex: 0 0 auto` and scrolls nothing.

> **What failed first.** The table scrolled inside a flex-sized `.log-scroll`. On
> a short viewport that box collapsed to nothing and the table vanished.

Consequences, all of which look like free choices and are not:

* **Only `thead th` pins at the top.** The "AI call log" heading and the Close
  button scroll away with everything else. Scroll back up, or press Escape.
* **`.log-dialog` has no vertical padding** (`padding: 0 1.5rem`; its `header`
  carries the top space) so the pinned `thead` sits flush against the dialog's
  top edge instead of floating below a gap.
* **`.log-scroll` must stay `overflow: visible`.** It is not the scroller, and
  clipping would round the sticky header and footer cell *fills* against their
  square backgrounds — a curved border with square cell backgrounds inside it,
  which reads as broken. Its corners are square for the same reason.

### `.log-curtain` — why a sticky `<tfoot>` is not enough

The totals row pins to the bottom. A sticky `<tfoot>` **cannot reach the dialog's
bottom edge**: it is clamped by its own containing block, the table. Table rows
therefore peeked underneath it mid-scroll.

`.log-curtain` is an opaque `--bg-raised` band that is a **direct child of the
dialog**, so its containing block is the dialog and it is never clamped. It pins
at `bottom: 0` with `z-index: 2`. The totals row pins at
`bottom: var(--log-curtain-h)` with `z-index: 3` — exactly on top of it.

Together they form one solid block from the row down to the dialog's edge.
Scrolled to the end, both un-pin and the curtain is simply the empty gap below
the table.

**The table's closing rule is the curtain's `border-top`**, not a border on the
table. It is the only element adjacent to the totals row in *both* states, pinned
and at rest, so it cannot go missing mid-scroll or double up at rest.

> **If you make the totals row taller, change `--log-curtain-h` with it.** That
> custom property is both the curtain's height and the row's pin offset. Change
> the row alone and a gap opens at the dialog's bottom edge.

### The totals divider is painted as backgrounds, not drawn as a border

The 2px rule above the totals row, and the 1px separators between its cells, are
`linear-gradient` backgrounds:

```css
background-image:
  linear-gradient(var(--line-total), var(--line-total)),  /* 100% × 1.5px, top   */
  linear-gradient(var(--line-faint), var(--line-faint));  /*   1px × 100%, right */
```

> **Two failures preceded this.** A real `border-top` is painted by the
> collapsed-border layer, which **leaves it behind when the row pins** — the rule
> stayed put while the row travelled. A box-shadow does not work either: WebKit
> does not paint outer shadows on table cells at all, and an inset one stops at
> the collapsed column border, which segmented the rule into pieces.

Because the gradients are painted *by the cell*, they also stop at any collapsed
border — so the collapsed borders are removed from this row entirely
(`border-top: none; border-bottom: none`, and `td:not(:last-child)
{ border-right: none }`). The cells then sit flush, the divider runs unbroken, and
both rules travel with the cell when it pins.

The colour is `--line-total`, which is **warm** on purpose: a cool grey line at
the bottom of a scrolling area reads as a scrollbar.

## 4. The two view modes

**Above ~850px: the full table.** All nine columns, with a mid-range
`@media (max-width: 1040px)` that tightens cell padding and narrows the Result
column before the card breakpoint is reached.

**At 850px and below: one card per call.** `thead` is hidden; each `td` grows a
label via `td::before { content: attr(data-label) }`; the `<abbr>` shorthands
expand back to full words with `abbr::after { content: attr(title) }`; reveal
panels flow inline instead of floating.

**What the boundary costs is specificity.** Card view is a narrower media query,
not a separate stylesheet, so desktop rules keep applying inside it and several
out-rank the card rules on specificity alone. Two real defects came from exactly
this and are fixed in place rather than by refactoring the shared rules:

| Desktop rule | Specificity | What it did in card view | Fix |
|---|---|---|---|
| `.log-table td:not(:last-child)` | 0,2,1 | its `border-right` stacked into a faint vertical line down each card | cleared at matching specificity, card-scoped |
| `.log-table tbody tr:last-child td` | 0,3,1 | removed the last card's row separators | restored at 0,4,1, card-scoped |

**Fix card-view bugs inside the query, at matching or higher specificity.**
Refactoring the shared rule to be "cleaner" puts the desktop table back in scope
and it has to be re-verified.

## 5. Traps

Each of these looks like it could be simplified. Each cannot.

| Rule | What breaks if you undo it |
|---|---|
| **`.log-scroll` stays `overflow: visible`** | It becomes a second scroller, and clips the sticky cell fills to a radius against square backgrounds |
| **`.log-curtain` is a child of the *dialog*, not the table** | It gets clamped by the table and rows show under the pinned totals row mid-scroll |
| **`--log-curtain-h` is read twice** | Curtain height and totals-row pin offset diverge; a gap opens at the dialog's bottom edge |
| **The totals divider is a background, not a border or shadow** | A border is left behind when the row pins; a shadow is either not painted (WebKit, outer) or segmented at the collapsed border (inset) |
| **The reveal panel's opacity animates on the panel (`.log-reveal ul/p`), never on `::details-content`** | Animating the pseudo makes it a stacking context *only while* `0 < opacity < 1`, trapping the panel behind later rows mid-fade. A `z-index` on `.log-reveal` does not rescue it — that is a table cell, itself a stacking context |
| **`--reveal-fade` is one property read by two elements** | The panel's opacity transition and `::details-content`'s `content-visibility` duration must match, or the panel is yanked away mid-fade-out |
| **The Result column is a fixed `8rem` with an absolutely positioned panel** | Opening a row reflows the table and steals width from its neighbours |
| **`.log-dialog[open] { display: flex }` is a bare rule** | Without it the UA's `dialog:not([open])` hide is overridden and the dialog never closes |
| **Failed rows render `—` for tokens and cost, only when null** | A call that never completed reports `0`, which is a lie the totals then sum |
| **Six pre-migration-001 rows were deleted by hand (`D-019`)** | Re-adding rows with no token split or duration re-opens the partial-coverage problem the footer was simplified to avoid. `totals.detailed` / `totals.timed` still exist in the response to handle it, but nothing surfaces them |

## 6. What is safe to change

This document should not read as *touch nothing*.

* **Colours, spacing and type sizes**, with one caution: `.log-table`'s base
  `font-size` is in `rem` and everything below it is in `em`, so that one value
  scales the whole table. The footer is deliberately `0.8em` so its summed
  figures cannot set a wider max-content than the body rows and shift the
  columns.
* **`--reveal-fade`** — one number, both durations.
* **Column widths**, except the Result column's fixed `8rem`, which is structural.
* **The breakpoints** (850px, 1040px) — they were chosen by narrowing the window
  until the table stopped fitting, not derived.
* **Adding a column.** It flows through `norm()` in the route, the row builder in
  `public/app.js`, and a `data-label` for card view. Nothing about the pinning
  model needs to know.
* **The 60-row cap** — but change the two description strings with it (§ 2).

## 7. How to tell this document worked

The brief that commissioned it set the test, and it is a good one:

> Hand it to someone who has never seen the component and ask them to **make the
> totals row taller.**
>
> If they change `--log-curtain-h` along with the row, the document worked. If
> they change only the row and leave a gap at the dialog's bottom edge, it did
> not.

## Related

* [`BRIEFS.md`](BRIEFS.md) § 2 — the brief this answers
* [`DECISIONS.md`](DECISIONS.md) — `D-010`, `D-018`, `D-019`, `D-069` and the
  reveal-panel entries carry the reasoning in the form it was recorded
* [`SECURITY.md`](SECURITY.md) — `ASI09`, which this component answers
* `SPEC.md` § 5.2 and § 5.3 — the two log table schemas
