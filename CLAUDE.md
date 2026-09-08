# CLAUDE.md — CineRank

This file governs how Claude (or Claude Code) should work in this repository. Refer to `SPEC.md` for the full functional/technical spec — this file is about *how to build it*, not *what to build*.

\---

## Project Context

CineRank is a personal movie-ranking app.

This project consists of:

* A real database layer (Supabase/Postgres).
* A genuinely polished, distinctive UI — not a generic default-component look.
* A genuine, narrow-scope AI feature (OpenRouter-based recommendations) that reads real stored data and writes a real audit log — not a general chatbot bolted onto the app.

Refer to SPEC.md §7 for the full acceptance checklist. In short: a user can search, add, rate, and rank movies via real TMDB data, and can trigger AI recommendations grounded in their own ratings, with every AI call logged.

\---

## Project Status — Living Log

**Keep this section current every working session.** It is the fast answer to
"where are we, what's broken, what's next". The detailed *why* behind each choice
lives in `docs/DECISIONS.md`; this is the *what / now*.

**Last updated:** 2026-09-09 (ranked-list backlog items **1-16 all done**, #17 is next; eleventh merge to main was bc67ff2; migrations 001-004 applied)

### Build status
* **Live at https://cinerank-g6lx.onrender.com** (Render free tier, deploys from
  `main` on every commit). Locally: `npm start` → http://localhost:3000. See the
  deploy entry under Pre-submission blockers for the service's exact settings.
* Supabase project is live; `db/schema.sql` + migrations `001` through `004`
  all applied.
* AI call log viewer confirmed working in-browser.
* `main` is at the latest settled UI milestone — currently "TMDB ratings
  persisted (#11) + tied ranks made honest (#13)" (2026-09-09,
  `bc67ff2`). **Eleven** merges so far;
  `git log --merges --oneline main` is the source of truth, do NOT increment a
  number in a doc without checking it (that is exactly how PROCESS.md drifted to
  a wrong count). The same number appears in `docs/PROCESS.md` §1 — update both.
  `draft` continues day to day.

### Implemented
* Movie CRUD: search (TMDB) → add → rate (0–10, review) → auto-ranked list. Dupe
  guard via `unique(tmdb_id)`. Each card also shows TMDB's own score beneath the
  user's, captured at ADD time and never refreshed (D-036). Add auto-opens the rate dialog ("Skip for now").
  Long reviews clamp to 3 lines above 900px and 2 at 900px and below, with a
  "view more…/show less" toggle (shown only when the text actually clips). The
  line count lives ONLY in CSS — the toggle is decided by measuring whether the
  text overflowed, never by counting lines.
* Recommendations: `POST /api/recommendations`, prompt `recommend_v3` (second-person
  reason voice, 8–16 words), server-side reason tidy, per-title TMDB verification,
  owned-titles filter. Card `.reason` clamps at 5 lines.
* Taste verdict: `POST /api/taste-verdict`, prompt `taste_verdict_v4` (2–3
  sentences, ~35–60 words, characterise the viewer — not recite ratings),
  `max_tokens` 180, server-side sentence-aware truncation (450-char ceiling) +
  markdown strip, explicit-trigger.
* AI call log: every call logged success **or** failure; `GET /api/ai-log` merges
  both tables; in-app viewer via the footer `.log-cta` button.
* Security: `.env` gitignored from commit 1, `npm run scan-secrets` pre-commit,
  anon key only, query-builder only, `textContent` only.
* Tests: `npm test` (Node built-in runner, 38 tests). Pure helpers
  (`parseModelJson`, `tidy*`, `estimateCostUsd`, `loadPrompt`) + route-level
  (`test/routes.test.js`): validation (400s), duplicate (409), TMDB-down (502),
  below-threshold (422), OpenRouter-down (422 **with** a `status='failed'`
  log row written), a row deleted mid-edit (404, not a 500), and the two
  `tmdb_rating` guards — that the value reaches the insert at all, and that
  TMDB's no-votes `0` is stored as `null` (D-037) — plus the two
  `review_requires_rating` guards (D-041): a check violation comes back as a
  400 with a usable message rather than a generic 500, and a violation of one of
  the table's OTHER check constraints is not dressed up as the review message.
  Supabase is swapped for an in-memory fake (`test/helpers.js`)
  so tests never touch the live DB; TMDB/OpenRouter stubbed via `globalThis.fetch`.
  `server/index.js` exports `app` and only `listen()`s when run directly.
* `GET /api/health` liveness probe for a future host.
* `docs/PROCESS.md` — the LLM-augmented workflow narrative (prompt v-chain,
  guardrails, Incident 1) for the course's process grade.
* Accessibility: per-item `aria-label`s (Rate/Edit/Remove/Add-to-list name the
  film, not just the verb), live regions on search results / recs hint / verdict
  text, `aria-busy` on the two async trigger buttons, `aria-expanded`/
  `aria-controls` on the review "view more" toggle, dialogs `aria-labelledby`,
  poster `alt` text (`"{title} — poster"` / labelled placeholder), rec-card
  heading fixed h4→h3 (correct nesting under the section's h2), decorative
  spinners `aria-hidden`, **one app-wide `:focus-visible` ring** (2026-09-08,
  backlog #10 — a bare selector, so anything focusable added later is covered
  without being remembered; `.search input` is the one deliberate exception, see
  the ranked-list bullets), and the destructive-action confirm's
  `role="alertdialog"` + `aria-describedby` (the consequence is announced, not
  just the title) with `autofocus` on Cancel so a stray Enter is the safe choice.

### Front-end overhaul (in progress — started 2026-09-05)
* The two modal `<dialog>`s that existed at the time (rate, AI call log) were
  re-centred: the global `* { margin: 0 }` reset had killed the UA stylesheet's
  `dialog { margin: auto }`, so they rendered at top-left. Fixed with an explicit
  `margin: auto` on `.rate-dialog` / `.log-dialog`. There are **three** dialogs
  now — `.confirm-dialog` gets the same `margin: auto` by sharing that rule.
* AI call log entry point promoted from a `.linkish` link buried in a footer
  sentence to a `.log-cta` panel with a solid amber button (`#open-log` id
  unchanged) + one-line description — it's the SPEC §7.2 "not a wrapper" proof,
  so it should read as a real action. `.linkish` removed (was its only use).
* Fixed a pre-existing glitch: the `.grain` film-grain overlay (`inset: 0`) is
  translated up to 3% by its animation, which briefly exposed a flickering dark
  strip at the right/top edge. Now `inset: -8%` so it overhangs the viewport.
* Grain dialled up a touch (barely visible before): `opacity` 0.035 → 0.06,
  animation 0.6s → 0.5s. Still subtle.
* AI call log dialog scrolling: **the dialog itself is the single scroller**
  (`.log-dialog { overflow: auto; max-height: 88vh }`, `.log-scroll` is
  `overflow: visible; flex: 0 0 auto`). An earlier version had the table scroll
  inside a flex-sized `.log-scroll` — but on a short viewport that box collapsed
  to nothing. Header + blurb + whole table scroll together; **only `thead th`
  pins** (`position: sticky; top: 0; z-index: 3`) — the "AI call log" heading and
  Close scroll away (scroll back up / Esc). `.log-dialog` has **no top/bottom
  padding** (`padding: 0 1.5rem`; `header` carries `padding-top`) so the thead
  pins flush at the top.
  **Total row (took several tries — don't "simplify" this):** a sticky `<tfoot>`
  alone never works, because it's clamped by its own containing block (the table)
  and can't reach the dialog's bottom edge — table rows always peeked underneath
  it mid-scroll. The fix is `.log-curtain`: an opaque `--bg-raised` band that is a
  **direct child of the dialog** (containing block = the dialog, so it's never
  clamped), `position: sticky; bottom: 0`, `z-index: 2`. The Total row pins at
  `bottom: var(--log-curtain-h)` with `z-index: 3` — exactly on top of it. The two
  form one solid block down to the dialog edge, so nothing shows underneath.
  Scrolled to the end both un-pin and the curtain is just the gap below the
  table (hence `.log-dialog` has no bottom padding). The table's closing rule is
  the curtain's `border-top` — the only element adjacent to the Total row in
  BOTH states, so it can't go missing mid-scroll or double up at rest.
  `.log-scroll` is therefore open at the bottom, and **fully square**: it must
  stay `overflow: visible` (the dialog is the scroller) so it can't clip the
  sticky thead/tfoot cell fills to a radius — a rounded border with square cell
  backgrounds looked broken. Card mode
  pins the whole `tr.log-total` (per-cell sticky would stack three boxes).
  `.log-dialog[open]` carries
  `display: flex`; a bare rule overrides the UA `dialog:not([open])` hide → never
  closes. `body:has(dialog[open]) { overflow: hidden }` freezes the page.
* AI call log table — narrowing it column by column to kill the horizontal
  scroll. Done so far:
  - all `th`/`td` content centred (h + v); `.num` right-align dropped.
  - table font trimmed ~10% (`.log-table` 0.86→0.77rem; header/sub/badge → `em`).
  - faint full-height column separators (`border-right: 1px solid var(--line-faint)`,
    `--line-faint` = white 0.035). A short "floating tick" variant was tried to
    make the row/column hierarchy clearer and reverted — user preferred the plain
    hairline; hierarchy parked.
  - **Model** column shows only the part after the vendor `/`
    (`claude-haiku-4.5`), wrapped in `<abbr title="…">` (dotted underline + help
    cursor) so the full slug is one hover away. `modelCell()` in app.js.
  - **Time** column: forced `en-GB` format (`04/09/2026, 15:39:46`) regardless
    of browser locale, split onto two lines (date / clock) via `timeCell()`.
    Still rendered in the viewer's local timezone. `.log-time` 0.9em to match.
  - **Result** column collapsed. `/api/ai-log` now sends structured data
    (`suggested_titles` / `verdict_text` / `error_text`) instead of a flattened
    `summary` string. `resultCell()` renders: failed → error inline; recommendation
    → "N suggestions" `<details>` revealing a `<ul>`; verdict → "view verdict"
    `<details>` revealing the text. `<details name="ai-log-result">` so opening
    one closes the others. The column is pinned to a fixed width (9.5rem
    originally, 8rem now) and the
    revealed content is `position: absolute` (a small floating panel, 0.8em
    font) — opening a row can never widen/reflow the table or steal width from
    other columns. (An early caveat about the last row's panel being clipped is
    obsolete twice over: `.log-scroll` is `overflow: visible` so it clips nothing,
    and the panel now flips above its trigger when there is no room below.)
    Table text also toned down (`.log-table` color `#e0dcd3`, was `--ink`).
  - **Feature / Prompt / Model** cells abbreviated via `<abbr title>`:
    Recommendation→`R`, Taste verdict→`TV`, `recommend_v3`→`R_v3`,
    `taste_verdict_v1`→`TV_v1`, model→slug after the `/`. `abbrCell()` +
    `shortPromptVersion()` in app.js; `.log-table abbr` = dotted underline.
    Feature has exactly two values (verified in `routes/aiLog.js`).
  - cell padding trimmed `0.6rem 0.8rem` → `0.45rem 0.45rem`; Result column
    `9.5rem` → `8rem`.
  - **Responsive**: full table down to **~850px** (card `@media` breakpoint),
    helped by a mid-range `@media (max-width: 1040px)` that tightens cell padding
    `0.45→0.28rem`, dialog padding `1.5→0.85rem`, and the Result column
    `8→7rem`. No horizontal scrollbar at any width ≥ ~300px. < 850px → one card
    per call (label/value rows via `td::before { content: attr(data-label) }`;
    `thead` hidden; abbreviations swapped back to full text via
    `abbr::after { content: attr(title) }`). Reveal panels flow inline in card mode. A document click listener collapses an open
    reveal panel on any click outside it (clicks on its own text keep it open so
    it stays selectable). Reveal panels fade (`::details-content` +
    `@starting-style`).
  - **Sticky rows.** The whole dialog is the single scroller; only `thead`
    (top) and the `<tfoot>` Total row (bottom) pin. A sticky `<tfoot>` alone
    can't reach the dialog edge (clamped by the table), so `.log-curtain` — an
    opaque `--bg-raised` band, a *direct child of the dialog* — pins under it;
    the two form one solid block so no row shows through. Curtain's `border-top`
    is the table's closing rule (only element adjacent to Total in both
    states); `.log-scroll` is square (can't clip its sticky children to a
    radius while it's `overflow: visible`).
  - **Total-row divider.** Can't be a real border (collapsed-border layer
    leaves it behind on pin) or a shadow (webkit outer shadows aren't painted
    on cells; inset ones stop at the collapsed column border → gaps). Painted
    as two `background` gradients (1.5px top rule in `--line-total` — warm, so
    it's not mistaken for the cool-grey scrollbar; 1px right separators),
    collapsed borders removed from the row so the rule is continuous. Footer
    is `0.8em` (keeps its summed figures from widening the columns) with
    trimmed vertical padding; label spans 3 cols so it's `1.1em`.
  - **Failed rows.** `status` badge goes red; error text in a `.log-error`
    span at `0.7em` with `white-space: normal` + `overflow-wrap: anywhere` so
    it wraps and never widens the pinned Result column. Missing Tokens/Cost
    render `—` in `--ink-faint` (a `log-empty-val` class, only when null).
  - **Totals** sum the in/out split and durations; nulls on failed rows count
    as 0. `(summed model latency, not elapsed time)` note fills the trailing
    gap. Six pre-migration-001 rows (no split/duration) were deleted by hand
    (D-019) so the footer needs no partial-coverage markers.
  - **Reveal panel** polish: caret pointing at its trigger (direction +
    `--arrow-x` follow the flip); flips *above* the trigger when there's no
    room below (measured in JS on `toggle`, kept on close so it doesn't jump
    mid-fade); open trigger lights `--amber-bright`; white-glow shadow,
    eased on hover; outside-click dismiss. (NOT Esc: `<details>` has no Esc
    behaviour and no handler was ever written for one. Esc closes the whole
    log dialog, which takes the panel with it — not the same thing.)
* All three modal `<dialog>`s + backdrops fade in/out 250ms (`--dialog-fade`; `opacity` +
  `display`/`overlay` `allow-discrete` + `@starting-style`). Engines without
  `@starting-style`/`::details-content` just snap; `prefers-reduced-motion` off.
* Themed scrollbars **globally**, split by `@supports selector(::-webkit-scrollbar)`
  so each engine sees only its own props — recent Chromium ignores
  `::-webkit-scrollbar` once `scrollbar-width`/`scrollbar-color` is set (and those
  inherit, so a `* {}` rule poisons every scroller). Firefox branch: `scrollbar-width:
  thin` + `scrollbar-color`. Chromium/Safari branch: `::-webkit-scrollbar-*` —
  `--line-strong` pill thumb (`background-clip: padding-box` + transparent border),
  `~#565462` hover / `--amber-deep` active, 12px page / 9px `.log-dialog`, track
  `--bg-raised` page / transparent in the dialog. Chrome Fluent still widens the
  thumb on hover — not CSS-controllable.
* Reveal panel fade: the opacity animation + `@starting-style` live on the panel
  (`.log-reveal ul/p`) — it's already `position:absolute`+`z-index` so a stable
  stacking context at any opacity. Animating opacity on `::details-content`
  instead made *that pseudo* a stacking context only while 0<opacity<1, trapping
  the panel behind later rows mid-fade (and a `z-index` on `.log-reveal` — a
  table-cell SC — didn't lift past later `<tr>`s at all). `::details-content` now
  only transitions `content-visibility` (`allow-discrete`) to stay rendered
  through the close. The panel-opacity duration and the `::details-content`
  content-visibility duration are on different elements but MUST match (else the
  panel is yanked mid-fade-out) — both read one custom prop, `--reveal-fade`
  (250ms) on `.log-reveal`. That's the single knob for the fade speed.
* **AI call log dialog — COMPLETE** (desktop table + mobile card view). One
  later fix (2026-09-07, during the ranked-list pass): an open reveal panel's
  flip side and caret were measured only on open, so resizing the window while
  one was open left both stale. The measurement is now re-run from the shared
  page resize pass, guarded on the dialog being open AND the panel being open.
  Done as conservatively as possible — the measurement body was lifted into a
  closure over its existing variables and is **byte-identical**, so the
  open path is provably unchanged; nothing about the table's layout is touched.
  The
  card-view pass touched only `styles.css`, three hunks, all strictly inside
  `@media (max-width: 850px)` — the desktop table view is provably unchanged
  since the last `main` merge (49738c2). Card fixes:
  - Leftover desktop column separator (`td:not(:last-child)` border-right,
    specificity 0,2,1) was stacking into a faint vertical line down each card —
    cleared at matching specificity, card-scoped.
  - Last card had no row separators: the desktop `tbody tr:last-child td` rule
    (0,3,1 — kills the border so it doesn't double the table's closing rule)
    outranked the card rule. Restored at (0,4,1), card-scoped.
  - Tokens label sat high (a float pins to the top of a two-line value) —
    `td:has(.sub)` switches to a 2-col grid, label spans both rows +
    `align-items: center`.
  - Reveal trigger wrapped below the label when the panel opened
    (`inline-block` shrink-wrapped wide). `.log-reveal` is now `display: block`
    in card view; summary stays on the label line, panel is a full-width block
    with `clear: left`. Side effect: rec `<ul>` and verdict `<p>` are now the
    same width in card view (desktop `12rem`/`16rem` untouched, outside the query).
* **Taste verdict section — DONE** (2026-09-07).
  - "New verdict" gets the same busy state as "Get recommendations": disabled,
    spinner + "Thinking…", `cursor: not-allowed`, hover suppressed via
    `:hover:not(:disabled)`. Both buttons lock their width for the duration —
    measured with `getBoundingClientRect()`, not a hardcoded `min-width`, so it
    follows the label and font. The whole dance lives in ONE `busyButton()`
    helper both handlers call, because the two buttons had already drifted
    apart twice.
  - Verdict text: `1.05rem → 1rem` (all states), and the real verdict alone
    gets `--ink-soft` (#e8e5de, a half-step below `--ink`) + `0.1px` tracking
    via `.verdict__text:not(.is-muted)`. `is-muted` marks every placeholder and
    the error fallback; the initial "Reading the room…" now ships with it too.
  - Copy: "(probably unflattering)" → "a candid read" — the old parenthetical
    contradicted `taste_verdict_v4.md`, which says "never mean-spirited".
  - **Shared meta footer** under both a generated verdict AND the recs:
    `Prompt: … · Model: … · N tokens · C¢ · N ms` then a link into the log.
    One `aiMetaFooter()` builder + one `.ai-meta` CSS block; only placement
    differs (grid-column in the recs grid, flex row in the verdict banner).
    Both services now return `meta.durationMs` (always measured in
    `openrouter.js`, just never surfaced).
  - The log link is inline after the metadata, joined by "·", and drops to its
    own line as a whole unit when tight (it is `inline-block`, which cannot
    break internally). CSS has no "did this wrap" selector, so
    `syncMetaSeparator()` compares the separator's and link's box tops and
    hides the "·" with **`visibility`, never `display`** — `display: none`
    changes layout, so the link would then fit, so the "·" would come back, so
    it would wrap again… an infinite oscillation. Re-run on window resize via
    one page-level listener (a ResizeObserver per footer would leak, since
    footers are replaced on every generation).
  - Verdict error fallback now reads "…See the AI call log for details" with
    the log link inline. `.log-link` (renamed from `.ai-meta__link`, which was
    a BEM element name for a class now serving two unrelated blocks) is built
    by a shared `logLink()` factory.
* **Search section — DONE** (2026-09-07). Behaviour first, then chrome.
  - Seven fixes in one pass: a dead `row` click handler whose body was only a
    guarded early return; `.result-row`'s `cursor: pointer`, which promised a
    click the row never had; open results going stale after an add (one
    `setAddButtonState()` now renders the states and `syncSearchResultButtons()`
    re-applies it to every row from `loadMovies()`, so removals re-open the
    offer too); Search + Add gaining the shared `busyButton()` treatment; the
    last inline `element.style` writes in app.js replaced by `searchNote()` +
    `.search-note`; the panel gaining an Escape dismissal; and an empty query,
    which used to be a silent no-op, now saying so and focusing the input.
  - **The panel is persistent, not a dropdown (D-024).** Outside-click dismissal
    and close-on-add were both built and then removed: `.search-results` is in
    normal flow and obscures nothing, so there is nothing to get out of the way
    of, and every auto-dismissal cost a TMDB round-trip to undo. Close-on-add
    was also self-defeating — it ran in the same tick as the "✓ Added" settle,
    so that state could never be painted, and it left no rows for the sync to
    update. Escape closes it; a new search replaces it.
  - Add button states: `+ Add` → `⟳ Adding…` → `✓ Added`, or `In your list` for
    something already owned. **"✓ Added" is sticky (D-026)** via
    `dataset.justAdded` — saving a rating used to run `loadMovies()` again and
    quietly reset it, while skipping did not. All three states are `disabled`,
    so one `:disabled` rule covers them.
  - **Icons: inline SVG or plain characters, never emoji (D-027).** The `+` is
    U+002B (inherits `currentColor`, so it follows hover and the disabled dim);
    the magnifier under 500px is an inline SVG, because `⌕` (U+2315) sits
    outside the Inter subset the page downloads and would render as tofu. Its
    orientation is deliberate and is NOT the emoji's — see D-027, do not flip.
    `.search button` is `flex-shrink: 0`; a flex item's automatic minimum size
    is unreliable on a `<button>`, and shrinking is what clipped the label.
  - Browser's native `type="search"` clear × hidden (D-025): styling it would
    still leave Firefox (which draws none) different, and it only half-worked —
    it cleared the input but left the results panel populated.
  - **Graceful degradation, all four paths hand-tested:** TMDB down on search,
    TMDB down on add, CineRank itself unreachable, and the *non*-error empty
    state. `api()` now catches the network-level fetch rejection so the
    browser's own engine-specific wording ("Failed to fetch") never reaches the
    UI, while an HTTP error response still surfaces the server's user-facing
    message. "No matches" moved from `makeError` to the muted `searchNote` — an
    empty result set is not a failure and should not be crimson.
  - `.search button:disabled` no longer relies on opacity. It is the only FILLED
    button; amber at 55% still composites to an unmistakably amber ~#8c6f39, so
    it read as active for the whole second it said "Searching…". The fill now
    leaves the amber family (`--bg-card` / `--ink-dim`). The two OUTLINE buttons
    keep opacity, where it works.
* **Ranked list — in progress.** Claude's audit produced items 1–17 and the user
  added 18–20; **16 of the 20 are done** and the canonical table with every
  status is further down this section. Done so far:
  - Only a rated film earns a rank number; unrated cards show a faint `?`, and
    the #1 crown moved off `:first-child` onto a class (D-029).
  - Poster no longer overflows its column below 620px — the width was declared
    twice, now one `--poster-w` the grid track and the image both read.
  - Card buttons stay bottom-right on unrated cards in card mode
    (`space-between` puts a *lone* child at the start; an auto margin does not).
  - Three-digit rank numerals capped so the poster can't eat a digit (D-030),
    sized from a **measured** 0.66em figure width after two wrong estimates.
  - Ranked list re-sorts with a **View Transition**, and the staggered entrance
    animation now runs on first paint only (D-031). `.recs` / `.site-foot` carry
    `view-transition-name`s so they slide rather than ghost when the list
    shortens; the `sync*()` calls run BEFORE the transition so nothing outside
    the list differs between snapshots.
  - Off-list, found while testing: custom scrollbars ballooned under browser
    zoom (now `clamp()` with a `vw` guard — no CSS unit is zoom-immune, but zoom
    shrinks the viewport proportionally so `vw` holds a constant physical size).
  - Review "view more…" toggles are re-measured on resize (and on zoom, and
    after a late webfont swap), not once per render. They used to go stale in
    both directions — narrowing clipped a review whose toggle stayed hidden, so
    the text became unreachable. `hidden` is now assigned both ways. The pass
    measures the CLAMPED state always, collapsing/reading/restoring in one
    frame: a first attempt skipped expanded reviews (they are
    `overflow: visible`, so they always measure as "fits") and that just moved
    the staleness to a lingering "show less". A review that no longer clips is
    left collapsed, and `setReviewExpanded()` is the single writer for the
    class, the label and `aria-expanded` so the three cannot drift.
  - **The rate dialog now outlives its own save.** The form is
    `method="dialog"`, so submitting used to close it *before* the PATCH ran:
    the write went out invisibly and a failure produced an error toast about a
    dialog that was already gone, with the typed review destroyed and no way to
    retry. Save now `preventDefault()`s, shows the shared `busyButton()` state,
    and closes only once the write has succeeded; on failure the dialog stays
    open with the rating and review exactly as typed. Cancel is disabled for the
    duration (Esc still works). Remove gained a busy state too — spinner only,
    no label, since `busyButton()` locks the width as a min-width and
    "Removing…" would grow the button and shove its neighbour. Both also gained
    the `:disabled` styling they never had: opacity for the outline buttons,
    a fill swap out of the amber family for the filled `.primary`, per the rule
    the Search button settled. The failure is reported **inline in the dialog**,
    not by the toast (D-032): a modal `<dialog>` is in the top layer, so no
    `z-index` can lift a toast above it and the `::backdrop` dims it anyway —
    and inline is what search, the verdict and recs already do.
  - **Poster placeholder is an inline SVG film strip**, not the 🎬 emoji it
    replaced (D-027: an emoji ignores `color`, carries its own baseline metrics
    and looks different on every platform). Cloned from a `<template>` in
    `index.html` so it reads as markup and avoids `createElementNS` — note
    `document.createElement('svg')` does NOT make a real SVG element. Centred
    with `inset: 0; margin: auto`, deliberately not `top/left: 50%`: a
    percentage `top` resolves against the parent's HEIGHT, and
    `.rec-card .noposter` gets its height from `aspect-ratio`, where that is not
    reliable. Also `display: grid` on `.noposter` would have lost to
    `.rec-card .noposter { display: block }` at higher specificity — positioning
    sidesteps both problems. Size is now proportional (`40%`, capped) instead of
    a flat `1.4rem` that was identical in a 46px search row and a ~190px rec
    card. **No emoji remain in rendered output anywhere** — the only ones left in
    the source are inside comments explaining why they were rejected.

  - **The unrated line is a chip, not crimson prose** (D-033). `Not rated yet`
    is now an amber pill borrowing `.rec-card::before`'s exact vocabulary — that
    marker already reads 'AI pick · not yet rated', so the two sides of the list
    describe the same state the same way — with the instruction beside it in
    `--ink-dim`, wrapping below on a narrow card. Crimson is the error colour and
    nothing has failed; but the obvious correction, muting it the way 'No matches'
    was muted in Search, would have left it identical to a review in colour,
    weight AND position. Shape carries the distinction so colour needn't shout.
    The rank slot's `?` stays faint on purpose (D-029) — one marker, in the body,
    beside the button that resolves it.

  - **Remove is confirmed by the app's own dialog, not `window.confirm()`** —
    the last piece of native browser chrome in the UI, and the one modal that
    ignored the whole design language. The new `.confirm-dialog` shares the rate
    dialog's shell, backdrop, fade, Fraunces heading and button row by being
    ADDED to those selector lists rather than by copying their declarations:
    adding a selector to a list cannot change what the other selectors match, so
    the rate dialog is provably untouched (it was not to be re-tested), and the
    two cannot drift. Only the crimson `.danger` fill, the tighter heading and
    the consequence line are its own. Copy names what is actually lost — built
    from the film's real state, so it never promises to delete a review that was
    never written — and says the deletion cannot be undone, which after Incident
    1 is literal: the free tier has no point-in-time recovery. `role="alertdialog"`
    + `aria-describedby` so the consequence is announced, `autofocus` on Cancel
    so a stray Enter is the safe choice, and `returnValue` is reset before every
    open so "confirmed" is reachable ONLY by clicking the button — engines
    disagree about what Escape leaves behind.
    **None of the three dialogs light-dismisses, and that is on purpose.** A
    native `<dialog>` does NOT close on a backdrop click — the behaviour has to
    be added (a click handler comparing `event.target === dialog`, or the newer
    `closedby="any"`), and none of them has it. Cancel/Close and Esc are the
    only exits. Do not add it to one alone: for the rate dialog in particular, a
    stray outside click discarding a typed review is exactly the failure #6
    existed to fix.

  - **Every confirmation toast names its film, in one shape** (2026-09-08,
    user-raised, part of #16). `“Dune” added — rate it any time.` / `“Dune”
    saved.` / `“Dune” removed.` Two of the three named no film at all, and the
    three had three different shapes. `— ranking updated` is now CHECKED rather
    than assumed (D-034): a signature of the ranking as displayed is compared
    before and after the reload, and the clause appears only when it really
    differs. It was briefly deleted outright; the user pushed back correctly —
    every save DOES recompute the ranking, so the claim was never false — and
    the surviving objection was only that it reads as a claim about the outcome.
    **The signature is now id + displayed RANK + tie state, computed by the one
    `displayedRanking()` the renderer itself uses (D-039).** It was id + rated,
    which missed four cases — including the reported one: break a tie for first
    place by lowering the film already drawn second and nothing moves, yet it
    goes from `1 tied` to `2`. The fix was deleting the second copy of the
    ranking rule, not writing a cleverer fingerprint: an approximation of a rule
    goes stale the moment the rule changes, which is exactly what D-038 did to
    it. Same failure mode `busyButton()` was extracted for. The two
    ERROR toasts were deliberately left alone: they pass the server's own
    wording through, and prefixing it client-side would produce doublings like
    `Couldn’t remove “Dune” — Couldn’t reach CineRank…`. Still listed under #16.

  - **One focus ring for the whole app, and the dialog buttons finally react**
    (#10). A bare `:focus-visible { outline: 2px solid var(--amber);
    outline-offset: 3px }` replaces the two identical per-control rules that
    were the only designed focus styling in the file — everything else fell back
    to the browser's own ring, which IS drawn but is engine-coloured, so the app
    showed two different focus indicators depending on what you tabbed to. Bare,
    not a selector list, so anything focusable added later is covered without
    being remembered. `:focus-visible` never `:focus`, so a pointer user sees no
    change at all. **One control it deliberately does not reach:** `.search
    input:focus` sets `outline: none` at higher specificity and keeps its amber
    border instead.
    Rate/Confirm buttons (Cancel, Save, Remove) gained hover + press states —
    they were the only controls in the app that did not react at all. Existing
    vocabulary, not new: outline buttons go amber (as `.log-dialog .ghost`
    already did), filled buttons darken their fill.
    **Remove's colours were then re-derived by measurement, not eye (D-035).**
    Its label failed WCAG AA on hover (3.59:1) and its rest→hover step read as
    too subtle. A DARK label imposes a floor on how dark a fill may go, and
    `--crimson` sat barely above it — so "darker on hover" and "readable label"
    were in direct conflict, and five candidate labels were measured with none
    passing both states. The fills had to move: `--danger-fill` /
    `--danger-fill-hover` (role-named, because `--crimson` is the error TEXT
    colour and is too light to carry a label as a fill) with `--ink` on top —
    4.54:1 at rest, 6.71:1 on hover, step 0.683 → 0.572. Save keeps its dark
    `#1a1205` because amber is ~2.5x brighter and measures 11.18/7.66. The two
    buttons differ on purpose. `--crimson-deep` is retired.
    **Every one is `:not(:disabled)`.** Auditing that guard against every
    button that can actually be disabled found a REAL pre-existing bug:
    `.rec-card__body button:hover` had no guard while carrying a `:disabled`
    rule, and the two set different properties (`background` vs `opacity`) at
    equal specificity, so both applied — a dead `✓ Added` card still darkened
    under the cursor. Now guarded. The only two unguarded hover rules left
    (`.log-cta__btn`, `.log-dialog .ghost`) are on buttons nothing ever
    disables — verified against every `disabled =` assignment in app.js.

  - **Desktop card alignment** (2026-09-09, user-raised, off-backlog). The grid
    is `align-items: center`, so on >620px a short title floated in the middle
    of the 138px poster and the score column sat centred as one block. Now the
    body is `align-self: start` (plus a `0.3rem` margin-top — flush to the very
    top read as too tight; it is on the BODY ALONE so the rating stays pinned to
    the true top) and the score column is `align-self: stretch` with the rating
    at the top and the buttons pushed down by `margin-top: auto`. The rating
    then gets a hair of its own (`0.06rem`, on `.score-badge` rather than on the
    column, so only the rating shifts and the buttons stay pinned). It is NOT a
    fraction of the body's margin and must not be re-derived as one: the rating
    is 1.5rem to the title's 1.15rem at the same line-height, so more
    half-leading already sits above its glyphs and it starts lower in its own
    box. Set to 0.15rem first and that visibly over-shot, dropping the rating
    below the title's line.
    **All four desktop-only properties are reset inside the existing 620px
    query**, so card mode is untouched; `align-self: stretch` needs no reset
    because the score moves to its own grid row there, sized by itself, where
    stretch and center are the same box.
    Top vs centred was settled by a side-by-side screenshot: centring made each
    title's distance from the card's top edge depend on its review length, so
    the titles stopped forming a straight column to scan — which matters because
    this is a ranked LIST. Top-aligning also pairs the title and the score on one
    header line. Its one weakness, a void under a review-less card, is what
    backlog **#20** fills, so #20 is now worth more, not less. **An auto margin, NOT `justify-content: space-between`**
    — the same trap the 620px block already documents in the other axis: an
    unrated card has no score badge, and space-between parks a LONE child at the
    START, which would put the buttons at the TOP. The rank numeral stays
    centred on purpose (a large display figure, balanced against the poster;
    not part of the request). Card mode is untouched — both properties are
    reset inside the existing 620px query rather than fenced off behind a new
    `min-width`, which would leave a gap at fractional viewport widths.

  - **TMDB's own score now persists and is shown** (#11, D-036). The number was
    always fetched by `shapeMovie()` and always shown in search rows, then
    dropped on insert because no column existed. Migration 002 adds
    `tmdb_rating numeric(3,1)` with a check constraint mirroring the user's own
    `rating_range`; the insert stores it; the ranked card shows it faintly under
    the amber figure as `TMDB 7.2`.
    **A snapshot, not a live value** — written once at add time, never
    refreshed. Refreshing would cost one TMDB call per film per page load, make
    the ranked list depend on TMDB being up (it currently renders fine when TMDB
    is down, which is a resilience state being screenshotted), and make the
    comparison meaningless by drifting. Do not add a refresh; read D-036 first.
    Shown on unrated cards too — it is labelled `TMDB`, so it cannot be misread
    as the user's own score. Rendered from `!= null`, never truthiness.
    **Follow-up the same day (D-037): TMDB's `vote_average: 0` means NO VOTES,
    not a score of zero** — its vote scale starts at 0.5. `shapeMovie()` passed
    it through, so an unvoted title stored a literal 0 and the card read
    "TMDB 0.0". The search row hid it only because it used truthiness, so the two
    surfaces disagreed about the same film — one right by accident, one wrong on
    purpose. Fixed at the SOURCE (`vote_count` when present, `avg > 0` as a
    fallback) rather than by making a renderer test `> 0`, so "no rating" has one
    representation everywhere. Migration 003 nulls the rows already written. Do
    not simplify `shapeMovie()` back to a bare `typeof avg === 'number'`.
    The card then SAYS so rather than showing nothing: a muted italic
    `No TMDB rating`, reusing the `is-muted` vocabulary `.verdict__text` already
    uses for placeholders (and that #20 will use for a missing review). An empty
    slot is indistinguishable from one that failed to load, and it would have
    been emptiest on exactly the obscure titles where a reader wonders most.
    The rating and this caption sit in one `.score-block` wrapper so the score
    column still has exactly TWO children — the block and the buttons — which is
    what its `margin-top: auto` bottom-pinning depends on.
    On an UNRATED card the caption leads the block, and `:first-child` is the
    test for that — the badge is appended before it whenever a rating exists. It
    gets `0.45rem` there, far more than the badge's `0.06rem`, because the badge's
    tall 1.5rem line box already insets its own glyphs while a 0.72rem caption at
    line-height 1.3 starts flush against the card's top edge. Reset in card mode.

  - **Tied films share a rank number, and say so** (#13, D-038). Two films the
    user scored 8.0 showed as #3 and #4, ordered by `created_at` — which was
    added more recently — so the numbers asserted a ranking the data does not
    contain. Now **competition ranking** (1, 2, 2, 4; the skipped number is the
    point) plus a muted `tied` caption under the numeral, because two adjacent
    identical numbers otherwise read as a rendering fault.
    **Zero layout change, and that took the non-obvious route.** The caption
    must not move the numeral — the cell is grid-centred, so a taller cell
    shifts its numeral up while untied neighbours stay put. `position: relative`
    + an absolute caption was rejected: it moves the cell into the positioned
    paint layer, so the poster would paint UNDER an overflowing numeral instead
    of over it, reversing what the `.is-wide` note describes. Instead
    `.movie-card__rank` gets `height: 1em` — which `line-height: 1` already made
    true, so it is a **no-op on every card without a caption** — and the caption
    overflows it. `em`, so it tracks the clamp and both `.is-unranked` and
    `.is-wide`.
    Not `=2` in the numeral (the chart convention): that widens the glyph into
    the figure-width budget D-030 solved by measurement. A tie at the top crowns
    BOTH films, which is correct — D-029 defines the crown as *your top-rated
    film*, and if two are scored the same then both are.

  - **An expanded review stays expanded across a re-render** (#14, D-040).
    `renderRanked()` rebuilds every card, so the `expanded` class died with the
    node it was on: expanding one review and then rating a DIFFERENT film
    collapsed it. The expansion is now a `Set` of movie ids on `state`, seeded
    back into each rebuilt card.
    **The backlog row for #14 claimed only D-031's element-reuse rewrite could
    fix this. That was wrong** — it filed a state-persistence problem beside the
    element-identity ones (animation churn, poster churn) that the rewrite was
    designed for. The rewrite stays rejected, and its original argument is now
    STRONGER: a missed field on a reused card yields a stale card that still
    looks right, and `renderRanked()` has since taken on the tie logic (D-038)
    and the TMDB score column (D-036/D-037), so there is more to get wrong.
    **It adds no rule to item #5's machinery** — the trickiest code in this
    section, settled over four commits. `syncReviewToggles()` already collapses,
    measures and restores on a rAF after every render, so seeding the class at
    build time makes it treat a rebuilt card exactly as it treats a resize; its
    `it.clips && it.wasExpanded` rule then does the right thing unaided. The
    three-pass measurement, the both-ways `hidden`, and the deliberate absence of
    any line count in JS are byte-identical.
    **The `Set` is written by `setReviewExpanded()`, never by the click handler**
    — that function is already the single writer for the class, the label and
    `aria-expanded`, and the `Set` is a fourth facet of the same fact. The click
    handler is NOT the only thing that changes the state: the resize pass
    collapses a review that no longer clips, and an unrecorded collapse would
    desync the DOM and the `Set` on the next render. Its first pass still
    collapses with a bare `classList.remove()` on purpose — that one is a
    measuring fixture, not a state change; do not route it through the writer.

  - **A rating-less review is now impossible, rather than invisible** (#15,
    D-041, migration 004). `renderRanked()` branches `if (!isRated) … else if
    (m.review)`, so an unrated film's review was never drawn — the text sat in
    the table and no screen showed it. **Claude proposed splitting the branch so
    both render; the user replaced that with the better question** — the UI
    already refuses to create this state, so should the state exist at all? The
    rating is the required part and the review the optional one, and that rule
    was written down nowhere except in the shape of the rate dialog. It now
    lives in the schema: `check (review is null or rating is not null)`.
    **Enforced in the DB and not in the route because the rule is about the
    RESULTING ROW, not the patch:** `PATCH {review}` alone is valid when the film
    is already rated, so the route would need an extra read to judge it, while
    Postgres already knows. The route's job is only to turn the resulting `23514`
    into a 400 with a usable message instead of a generic 500 — matched on the
    constraint NAME, since the table carries two range constraints as well.
    Verified before shipping: the state was **unreachable from the UI** (POST
    writes neither column; Save always sends a number from a range input), and a
    pre-check found zero existing rows to migrate. So #15 was latent, not live.
    **The `else if` is now provably exhaustive — do not split it into two
    independent `if`s**, which would add a branch for a state the schema forbids.
    One-directional on purpose: a rating with NO review stays valid, which is
    what #20 labels.

  - **The ranked-list subtitle stops restating itself** (#16 part b). `5 films ·
    5 rated` said one fact twice in the app's steady state, was longest exactly
    when it had least to say, and made the reader subtract to reach the only
    actionable number. The `·` also joined a set to its own SUBSET, where every
    other use of that separator in the app joins peer facts. Now `5 films` when
    everything is rated (silence IS the all-rated signal — the clause exists to
    flag outstanding work, and unrated cards still carry their own chip),
    `5 films · 2 not rated yet` when some are, and `5 films · none rated yet`
    when none are. That last branch is not cosmetic: `5 not rated yet` would put
    both equal numbers back. It is also what settled the wording against the
    shorter `2 unrated` — which reads better after a numeral, and the user asked
    why not — because "unrated" would need a SECOND vocabulary for the
    nothing-rated branch, and "yet" keeps the pending sense D-033 built the chip
    around. Built as `rankedCountLabel()` so the three branches are readable.

  - **A failure message is a context plus a cause** (#16(c), D-042). The add and
    remove toasts showed the cause ALONE, so a failed add or remove named no
    film. Prefixing the context was known to double — "Couldn’t remove “Dune” —
    Couldn’t reach CineRank. Check your connection…" — and **the user's hand
    testing of ten failure scenarios showed the doubling was already live** at
    two sinks that do prefix (the boot toast and the AI log cell), not merely a
    risk of the proposed fix as Claude had claimed.
    Not unpredictable, though: there are exactly TWO kinds of message here and
    the client always knows which it has, because it either fabricated the cause
    (`api()`'s transport failure) or the server sent it. So a **`short` form is
    attached at the source** and one `failureText(context, err)` prefers it —
    used by all four context-adding sinks so the rule cannot be applied four
    ways. Sinks that already sit inside their own context (search note, verdict
    banner, rate dialog) deliberately do NOT compose; the user tested all three
    and found them correct, and they are untouched.
    **The server half is purely ADDITIVE, because the user capped the risk** ("as
    long as it does not make this change noticeably riskier"): a new `short` key
    beside `error`, and not one existing message edited. Nothing that reads
    `body.error` can observe a new sibling key. That rule also parked a real
    finding — the server carries the same straight-apostrophe inconsistency, but
    a test asserts one of those messages verbatim, so the sweep would have broken
    a test for a cosmetic gain. **Still open, deliberately.**
    `failureText()` also normalises the terminal full stop, since the causes
    disagree ("Already in your list" has none, "Something went wrong." does) and
    most are not ours to edit. Two incidental fixes came out of the same testing:
    the verdict fallback had **no full stop**, and "couldn’t" was spelled three
    ways in app.js (curly, straight, and "Could not").

#### Ranked-list backlog — THE canonical list, worked in numeric order

Claude audited the section on 2026-09-07 and produced items 1–17; the user added
18–20. **This list is the source of truth** — it previously existed only in chat
and would have been lost to a compact. Keep the statuses current as items land,
and do not renumber: the numbers are how the user refers to them.

| # | Item | Status |
|---|---|---|
| 1 | Unrated films got a rank number, contradicting their own "rate it to place it" caption; the gold #1 was `:first-child`, so it could crown an unrated film | **done** — D-029 |
| 2 | Poster overflowed its column below 620px (width declared twice) | **done** |
| 3 | Multi-digit rank numerals: 2-digit fine everywhere, 3-digit ran under the poster | **done** — D-030 |
| 4 | The whole list replayed its staggered entrance on every add/rate/remove | **done** — D-031 |
| 5 | "view more…" toggle measured once per render, never on resize/zoom/font-swap | **done** (+ the expanded-review follow-up) |
| 6 | Remove/Save had no busy state or double-click guard; Save closed the dialog *before* its PATCH ran | **done** — D-032 |
| 7 | `.noposter` used the 🎬 emoji, against D-027 | **done** |
| 8 | "Not rated yet" is `--crimson` — an error colour on a non-error state. Same mistake corrected in Search when "No matches" left `makeError` for the muted `searchNote` | **done** — D-033 |
| 9 | `confirm()` for Remove is the last native modal in the app; it also does not warn that the rating and review go with it (cf. Incident 1) | **done** |
| 10 | No `:focus-visible` on any ranked-list control (Rate/Edit, Remove, review toggle). The stylesheet has only three focus rules, all added recently | **done** — one global rule, app-wide |
| 11 | `tmdb_rating` is fetched by `shapeMovie()` and shown in search rows, then dropped on insert — no column exists. "Your 8.5 vs TMDB 7.2" is one migration (002) away | **done** — D-036/D-037; migrations 002 + 003 applied |
| 12 | No re-sort animation, though the README demo script promises "re-sorting live" | **done** — delivered by #4 / D-031 |
| 13 | Ties are invisible: two films at 8.0 show as #3 and #4 with no sign the order between them is arbitrary (it falls back to `created_at`) | **done** — D-038 |
| 14 | Expanded reviews collapse on any unrelated re-render | **done** — D-040. This row used to say only D-031's element-reuse rewrite could fix it. **That was wrong when written**: #14 is a state-persistence problem, not an element-identity one. Lifting the state into `state.expandedReviews` fixes it in 8 lines; the rewrite stays rejected |
| 15 | A review with no rating is silently hidden: `if (!isRated) … else if (m.review)`. The PATCH endpoint permits that state | **done** — D-041, migration 004. Fixed by FORBIDDING the state, not rendering it: the rating is required, the review optional. The `else if` is now provably exhaustive — do not split it |
| 16 | Copy inconsistencies. Worked in three parts, **all done**. **(a) Confirmation toasts** (2026-09-08, user-raised): all three now read `“Title” added/saved/removed`, one shape, film first — two named no film at all, and `— ranking updated` is now conditional on the ranking actually differing (D-034). **(b) The `5 films · 5 rated` subtitle** (2026-09-09): now `5 films` when all are rated, `5 films · 2 not rated yet` when not, `5 films · none rated yet` when none are. **(c) The two ERROR toasts** (2026-09-09): a failed add/remove now names its film via one `failureText()` composer, and the causes carry a `short` form so a context prefix cannot double them (D-042). Also fixed en route: the verdict fallback had no full stop, and "couldn’t" was spelled three ways | **done** — D-042 |
| 17 | `loading="lazy"` on above-the-fold posters delays the first few cards | open — **next** |
| 18 | Discuss the "view more…" vs "show less" wording discrepancy | open — user-added |
| 19 | Add a grow-on-hover effect to each ranked-list item | open — user-added |
| 20 | A rated film with no review shows nothing at all where a review would be. Say so — an italic, muted `No review yet — edit to add one` (wording TBD) — so the slot is never silently empty. Inverse of #15 | open — user-added |

##### Agreed order of work from here (set by the user, 2026-09-08, session end)

Work this top to bottom. It is the user's own sequencing, not Claude's
suggestion — do not re-prioritise it, and do not start further down because
something looks quicker.

1. **#11** — the `tmdb_rating` scope call. The user flagged it as "big yet
   important" and deliberately chose to start a fresh session on it rather than
   begin it tired. It needs **migration 002** (a new column), so it is the only
   remaining backlog item that touches the schema. Ship the migration as a
   numbered, re-runnable file in `db/migrations/` AND fold it into
   `db/schema.sql`, per the conventions above; it is applied by hand in the
   Supabase SQL editor.
2. **#13 → #20** in numeric order. Note **#12 is already done** (delivered by
   #4 / D-031) — the user said "#12 through #20" at session end, so say so
   rather than silently skipping it. **#16 is partly done**: only the two error
   toasts and the `5 films · 5 rated` string remain.
3. **"What to watch next" (recommendations) overhaul.** Carries the known
   swallowed-error bug listed under Open issues — the handler writes
   `err.message` into `#recs-hint` and its own `finally` overwrites it in the
   same tick, so a failed run shows the user nothing — and a label inconsistent
   with Search ("Add to my list" vs "+ Add").
4. **Everything still open under Pre-submission blockers**, plus the leftovers
   in Open issues.


* Then: recommendations, then the rate dialog. The recs section carries a known
  open bug (its error message is overwritten by its own `finally` — see Open
  issues) and a label inconsistent with the Search one ("Add to my list" vs
  "+ Add"). User is driving this.

### Open issues / TODO
(Submission-readiness gaps are consolidated under **Pre-submission blockers**
below — this list is the smaller stuff.)
* [x] Migration 001 applied.
* [x] **Migration 002 (`tmdb_rating`) applied 2026-09-09, backfill run.** It was
  a prerequisite rather than a follow-up: until the column existed PostgREST
  rejected the insert with PGRST204 and adding any film failed. A nullable
  column is backward compatible with the code on `main`, so applying it early
  was safe for the live site.
* [x] **Migration 003 (`tmdb_rating = 0` → NULL) applied 2026-09-09.** TMDB
  reports `vote_average: 0` for a title nobody has voted on, so 002 + the
  backfill wrote a literal 0 for those and the card read "TMDB 0.0", i.e. worst
  film imaginable (D-037). `shapeMovie()` now nulls it at the source so no NEW
  row can get one; 003 fixed the rows already written.
  **Both are applied to the single live Supabase project, which is the same
  database the deployed app uses — there is no separate prod DB to migrate at
  release time.**
* [x] **Migration 004 (`review_requires_rating`) applied 2026-09-09.** A `check`
  constraint forbidding a review on an unrated film (#15, D-041) — the rating is
  the required part, the review the optional one, and until now only the UI knew
  that. A pre-check confirmed **zero** existing rows violated it before it went
  on. Adding it to a live DB is safe in a way 002 was not: it forbids a state
  nothing in the app produces, so no code path on `main` can start failing.
* [x] Tests: pure helpers, prompt loader, route validation, duplicate handling,
  TMDB/OpenRouter-down resilience, and the `tmdb_rating` and
  `review_requires_rating` guards all covered by `npm test` (38).
* [x] `/api/recommendations/history` vs `/api/ai-log` — decided to keep both
  (D-017): `/api/ai-log` is the primary audit surface, `/history` stays as the
  narrower per-feature JSON view per SPEC §4.5. Post-submission cleanup candidate.
* [ ] **Recommendations swallow their error message.** `renderRecommendations`'s
  handler writes `err.message` into `#recs-hint` on failure, but its `finally`
  then calls `syncRecommendationsAvailability()`, which unconditionally does
  `classList.remove('err')` + overwrites `textContent` with the standard hint —
  so the error is wiped in the same tick and the user sees nothing at all. The
  server side is correct and tested (422 + a `status='failed'` log row); this is
  purely the UI half of SPEC §7.1, and it would show up badly in the resilience
  screenshots. Fix when the recommendations section gets its overhaul pass; the
  verdict side already does this properly (points at the AI call log).
* [x] **Apostrophe consistency across ALL user-facing copy — done 2026-09-09.**
  The client's three offenders went with #16(c); the four server-side ones (the
  two TMDB 502s, the PATCH 404, the recommendations 422) followed in their own
  commit, together with the one test assertion that quotes a message verbatim —
  which is why it was a separate change rather than folded into #16(c). Every
  user-facing contraction in `server/`, `public/app.js` and `public/index.html`
  now uses the curly `’`. Code COMMENTS deliberately still use straight ones;
  they are not UI copy.
* [ ] User re-adding lost movies (see Incident 1) — moot once the demo seed list
  exists.
* [x] **Rank numerals ≥ 100 ran under the poster — fixed** (D-030). Two-digit
  ranks were fine at every width (checked at ~350px with numerals forced to 20+,
  so the narrow `1` couldn't flatter the test). Three were not: the font clamps
  at `3.4rem` = 54.4px and Fraunces Black figures measure **0.66em**, so "250"
  painted ~110px against a ~99px budget (64px track + the 17.6px padding and
  19.2px gap it may legitimately spill into), and the poster — later in DOM
  order — covered the last digit. `renderRanked()` now marks 100+ with
  `is-wide` → `clamp(1.5rem, 4vw, 2.4rem)`, **solved** against that measured
  figure width; clears by ≥10.8px on desktop and ≥12.3px in card mode. Two earlier
  values were *estimated* and both wrong (0.63em too low, then 0.8em
  over-corrected) — re-measure with `Range.getBoundingClientRect()`, never
  re-tune this by eye. **The trap, if this is ever
  revisited: do NOT auto-size the rank track (`minmax(64px, auto)`)** — it would
  misalign every poster's left edge down the list, trading a rare problem for a
  permanent one. 1000+ is unhandled by choice.
* [ ] **Demo seed list for lecturer submission.** Ship with 3–4 pre-rated movies
  (not empty) so the ranked list, both AI features, and the call log all work on
  first open. Blueprint agreed with user:
  1. One deliberate taste persona — a specific sensibility (e.g. "bold,
     stranger-than-fiction swings; bored by safe blockbusters"), not a generic
     spread, so the verdict + recs land.
  2. Rating spread: a couple high, one mid, one low "guilty pleasure /
     disappointment" outlier for contrast.
  3. 2–3 real reviews with actual voice — feeds the prompts as taste signal and
     demos the "view more" toggle + injection-safe handling.
  4. Recommendation headroom: likely AI picks not already in the list, real
     enough to pass TMDB verification cleanly (no silently-dropped cards).
  5. Dry-run the verdict a few times pre-submission; adjust the seed set if the
     output is flat.
  Build it as a small repeatable seed helper (hits the app's own
  `POST /api/movies` + `PATCH /:id`, tagged as the demo set) so we can wipe and
  re-seed while tuning; final state must be exactly what the normal UI flow
  produces. Not started — user will kick this off later.
  **One hard constraint on that helper, from migration 004 (D-041): rating and
  review must go in the SAME `PATCH`.** A review-only patch on a film that is not
  yet rated now violates `review_requires_rating` and comes back as a 400 ("A
  review needs a rating"). This is deliberate — it fails loudly in the seed run
  rather than silently storing a review no screen would ever display — but it
  will look like a mystery if it is met without knowing why.

### Pre-submission blockers — DO NOT call the project a wrap until these are done

The code is functionally complete against SPEC §2–§6, but the submission is
**not** ready. These are the known gaps. The user is deferring all
screenshot/evidence capture to right before submission, in a dedicated session,
so the shots match the finished UI rather than a mid-overhaul one. That is a
deliberate schedule choice, restated more than once — do NOT push to capture
them early.

**But DO keep this list growing as the work happens.** The user is explicitly
relying on this file instead of their own memory. Whenever a change creates
something demo-able or provable — a new failure state, a guardrail worth
showing, a before/after worth contrasting — append it here the moment it
appears, unprompted. *Capturing* is deferred to the end; *noticing* is not.

* [x] **Deployed to Render** (2026-09-07) — **https://cinerank-g6lx.onrender.com**
  URL is at the very top of the README. Web service created through the Render
  dashboard rather than from `render.yaml`, so the blueprint is documentation
  only; the live service's settings are: branch `main`, build `npm ci`, start
  `npm start`, health check `/api/health`, auto-deploy **on commit** (the repo
  has no CI, so "after CI checks pass" would wait forever). All four secrets are
  set in Render's Environment tab; `PORT` deliberately is not — Render injects
  it. Verified live: health probe, ranked list (Supabase), search (TMDB), and
  recommendations/verdict (OpenRouter). Free tier sleeps after ~15 min idle, so
  the first hit takes anywhere from a few seconds to a minute while the instance
  wakes — a minute is the observed worst case, not the typical one. Open the link
  shortly before demoing.
  Node resolves to whatever is newest (`engines` says `>=20`; the live build
  picked 26.8.1) because the dashboard service ignores `render.yaml`'s
  `NODE_VERSION` pin. Working fine; pin it in the dashboard if a future deploy
  ever breaks on a new Node.
* [ ] **Put the live URL on the project sheet** —
  https://cinerank-g6lx.onrender.com. This used to be a "still to do" line
  *inside* the ticked deploy item above, where it did not show up as an open
  checkbox and could be missed on a skim. It is its own task: deploying and
  submitting the address are two different things, and the second is what makes
  the first count.
* [ ] **Demo seed list** loaded via the normal UI flow (see the blueprint above).
* [ ] **Resilience screenshots** — the calm inline UI states for: TMDB down on
  search, TMDB down on add, OpenRouter down on recommendations, OpenRouter down
  on the verdict (that fallback now links into the AI call log — the shot should
  show it), **CineRank itself unreachable** (stop `npm start`, then search:
  "Couldn't reach CineRank…"), and the *non*-error empty state ("No matches",
  muted rather than crimson — worth one shot to show the two are distinguished).
  All with the ranked list still working. Server side is tested (`npm test`);
  the *visual* evidence for SPEC §7.1 is still missing. Put them in `docs/`.
  How to force each: bogus `TMDB_API_KEY` / `OPENROUTER_API_KEY` in `.env` +
  restart. TMDB and OpenRouter are called SERVER-side, so DevTools offline and
  request-blocking do not simulate them.
  **Added 2026-09-08: the database being unreachable is a fifth state, and it
  is the one nobody had tried.** Bogus `SUPABASE_URL` / `SUPABASE_ANON_KEY` in
  `.env` + restart; the ranked list then fails to load and the toast reads
  "Could not load your movies: …". Note this is the ONE resilience shot where
  the ranked list is legitimately NOT working — it is the thing that broke — so
  it does not belong in the "all with the ranked list still working" set above.
  Finding it is what caught the central 500 handler claiming "on our side" for a
  failure that was neither a bug nor on the server's side.
* [ ] **Prompt-injection screenshot** — a demo movie whose review is an injection
  attempt, showing the verdict + recs staying on-topic (Module 17 evidence).
* [ ] **README screenshots + architecture diagram** — currently text-only.
* [ ] **Joint-project registration** — email `mail+ASE26003@mgorsky.net` (both
  names) and both add cross-referencing comments to the project sheet.
* [ ] Final `draft → main` merge once the above land (needs explicit user OK).

### Incident log
* **Incident 1 (2026-09-04) — user movie data deleted.** During AI-path testing
  Claude ran "delete all movies" as cleanup; the second run also removed the
  Marvel/superhero films the user had added (ratings + reviews lost, not
  recoverable — free tier has no PITR/backups; logs kept only dead movie ids).
  Also: Claude's `Get-Process node | Stop-Process` killed the user's running dev
  server. Both are process failures, not code bugs. Mitigations below are now
  binding.

### Working agreements (binding — added after Incident 1)
* **Never run destructive operations against the live Supabase data.** No
  "delete all", no truncate, no bulk delete. If test rows are unavoidable, tag
  them (e.g. `review = "__CLAUDE_TEST__"`) and delete only rows matching that
  exact tag and created in the same script — never "all ids".
* **Never kill node processes broadly.** No `Get-Process node | Stop-Process`, no
  `pkill node`. Kill only a PID this session started, and run any test server on a
  non-default port so the user's `npm start` is untouched.
* Prefer not to touch the user's DB at all for testing; ask them to run a check or
  use a throwaway when a real round-trip is genuinely needed.

\---

## Tech Stack

* **Backend:** Node.js + Express
* **Database:** Supabase (Postgres) — see SPEC.md §5 for schema
* **Frontend:** HTML/CSS/JS (vanilla). No framework required — the UI quality bar is met through actual design decisions (typography, motion, hierarchy), not through pulling in a component library. See the frontend-design conventions below.
* **External API #1 (movie data):** TMDB — requires a free API key from themoviedb.org (instant approval). Store as `TMDB\_API\_KEY` in `.env`.
* **External API #2 (AI):** OpenRouter, using the existing account/`.env` key. Keep these calls isolated in their own modules (e.g. `services/recommendations.js` and `services/tasteVerdict.js`) so either can be mocked/stripped without touching core movie CRUD logic.

\---

## Coding Conventions

* Keep TMDB calls and OpenRouter calls in separate service modules — never inline `fetch()` calls directly inside route handlers.
* All Supabase reads/writes go through the Supabase JS client's query builder (`.select()`, `.insert()`, `.eq()`, etc.) — never hand-built SQL strings.
* The recommendation and taste-verdict prompts are never hardcoded inline in a `.js` file — each lives in its own file under `prompts/` (see § Prompt Versioning below) and is loaded at call time.
* Every OpenRouter call, for **either** feature, must capture and store token usage and estimated cost in its respective log table (`recommendation\_logs` or `taste\_verdict\_logs`) — this is a hard requirement, not a nice-to-have (course grading emphasis on cost logging). A row is written whether the call **succeeds or fails** (`status` column) — a failed/degenerate AI call belongs in the audit trail too. The in-app "AI call log" viewer (`GET /api/ai-log`, footer button) surfaces both tables merged; the exact cost comes from OpenRouter's `usage.cost` with a per-model estimate table as fallback.
* Do not add authentication/multi-user support unless explicitly asked — SPEC.md marks this as v1 out-of-scope.

\---

## Frontend Design Notes

The explicit goal is a genuinely polished, distinctive look — not a generic default-component appearance. Concretely:

* Real typography choices (not default system font stack sizes) for the movie title/ranking numbers.
* Good-locking CSS effects and animations.
* Poster images treated as the primary visual anchor of each card — layout should be built around the poster, not squeeze it in as an afterthought.
* Consistent card language between the main ranked list and the AI recommendation panel, with a clear but subtle visual marker distinguishing "AI-suggested, not yet rated" from "already in your ranked list."

\---

## Prompt Versioning \& AI Call Discipline

* Prompt files live under `prompts/`, named `recommend\_v1.md`, `taste\_verdict\_v1.md`, etc. — never overwrite an existing version; bump the version number when a prompt's logic changes. The two features are versioned independently of each other. **Current:** recommendations use `recommend\_v3` (second-person, 8–16-word reason); taste verdict uses `taste\_verdict\_v4` (2–3 sentences, ~35–60 words, characterising the viewer — not reciting ratings). The active version string is a single `PROMPT\_VERSION` const at the top of each service module.
* Schema changes ship as numbered, re-runnable files in `db/migrations/` (and are also folded into `db/schema.sql` for fresh installs). Apply them by hand in the Supabase SQL editor.
* Every call to OpenRouter, for either feature, must record which prompt version was used, in its respective log table row (SPEC.md §5.2, §5.3) — this makes every past recommendation or verdict traceable to the exact prompt that produced it.
* The recommendation prompt must instruct the model to return **structured JSON only** (`\[{title, reason}, ...]`) — no free-form prose that needs regex parsing.
* The taste-verdict prompt must instruct the model to return **short plain text only** (one or two sentences, with an explicit length cap) — this is intentionally the lighter-weight of the two prompts.
* The app must **never trust the model's output as fact** for recommendations — every suggested title is cross-checked against TMDB before being shown to the user (SPEC.md §2.2 step 4). If a suggested title doesn't match any real TMDB movie, it is silently dropped, not shown as a broken/empty card. The taste-verdict output has no factual claim to check — it's opinion/commentary by design, so it's shown as-is (still subject to the length cap and injection mitigations below).

\---

## Security \& Secrets (Module 17)

1. **Never write a secret into source code.** `SUPABASE\_URL`, `SUPABASE\_ANON\_KEY`, `TMDB\_API\_KEY`, and `OPENROUTER\_API\_KEY` live only in `.env`, which must be in `.gitignore` from the very first commit.
2. **Never build a database query by concatenating strings.** Use the Supabase JS client's query builder for all reads/writes.
3. **Frontend uses only the Supabase anon key, never the service role key.** This is the concrete least-privilege demonstration for this project (see § Security \& Scope below) — the anon key respects Row Level Security and limits blast radius even if it were somehow exposed.
4. **Escape/encode any user-provided text before rendering it in the DOM** (movie reviews especially — this is free-text user input) to prevent stored XSS.
5. **Prompt injection awareness:** the user's own review text is included in **both** AI prompts as taste signal (SPEC.md §2.2, §2.3). This is untrusted input flowing into a prompt. Mitigations:

   * The prompt structure clearly delimits "user review text" from "instructions" so a review like "ignore previous instructions and..." is treated as quoted data, not as a new instruction.
   * The recommendation model's output is constrained to structured JSON and cross-checked against TMDB (§ Prompt Versioning above) — even if injection partially succeeds, the blast radius is limited to "a weird movie suggestion," not code execution or data exfiltration, because the output only ever drives a title lookup.
   * The taste-verdict output is length-capped and displayed as plain text (never rendered as HTML) — even if injection partially succeeds, the worst case is a nonsensical or off-tone banner message, not an executable payload or a leaked system prompt beyond commentary text.
6. **Before every commit, scan the diff for anything that looks like a key or credential**, ideally before committing rather than after.

### Security \& Scope (why no accounts ≠ no security story)

This is a single-user app by design (SPEC.md §1), but Module 17's actual topics — injection, secrets, prompt injection, least privilege — are all fully demonstrable without multi-user auth. Least privilege here means: the frontend key can only do what RLS allows, not "there are multiple people with different permissions." Don't add accounts to manufacture a least-privilege demo; the anon-vs-service-role key split already is one.

\---

## Decision Logging (non-negotiable)

**Claude records non-obvious decisions in `docs/DECISIONS.md` proactively — the
user should never have to ask.** The course grades *process* (Module 8), and a
reason is only recoverable at the moment it is made. This has had to be asked for
twice; treat it as a standing obligation, not a task.

**The test.** A decision belongs in the log only if ALL THREE hold:

1. **It was actually deliberated.** Options were weighed, or the user pushed
   back, or it took more than one exchange to settle. A single instruction
   carried out and never revisited is not a decision, however deliberate the
   instruction was.
2. **A real fork was taken** — the obvious or first-tried option was rejected.
3. **The reason is not visible in the code**, so someone later (including a
   future Claude session) could plausibly pick the rejected option again.

**Not decisions**, no matter how carefully made: "use a slightly more subtle
colour here" → done → never mentioned again; a padding, opacity or breakpoint
tuned by eye; a bug with one obviously correct fix. All of these are recoverable
by reading the file, and logging them buries the entries that matter.

**Decisions**, by contrast, look like: several viable approaches enumerated and
compared, one of them settled by a finding (D-025 — style the native `×`, hide
it, or leave it, decided by Firefox drawing none at all); three separate
questions resolving to one principle (D-024); an obvious approach rejected for a
non-obvious reason (D-027's `⌕`); a reported symptom whose diagnosis turned
out backwards (D-026).

**When in doubt, leave it out.** A log padded with tweaks is as useless as an
empty one — the point is that a reader can find the handful of choices that
would otherwise be silently undone.

**What the entry must contain**, beyond the choice itself:

* The alternatives considered and *why each was rejected* — the rejected paths
  are the content; "we chose X" alone is worthless a month later.
* **The user's pushback, and Claude's counter-argument.** Where the user
  overruled Claude, or Claude talked the user out of something, say so plainly.
  That exchange *is* the LLM-augmented workflow the course is assessing.
* **Where Claude was wrong, say that too** — a reversed diagnosis, a false claim
  the user caught, an approach built and then removed. A log that only records
  wins is not evidence of process.
* Any trap that follows from the decision ("do not flip this", "these two
  durations must stay tied to one custom property").

**A commit message or a code comment is not a substitute.** A commit explains a
diff, a comment explains a line; only the decision log explains a *choice between
alternatives*, and it is the only one of the three anybody reads before
undoing something.

**Timing and placement:** at the moment the decision is made, ideally in the same
commit as the change it explains. Newest first — a new entry goes at the TOP of
`docs/DECISIONS.md`. Numbers are sequential by *when recorded*; a decision written
up after the fact says so in its own text. `CLAUDE.md`'s living log stays the
*what / now*; `docs/DECISIONS.md` is the *why*.

**Historical records are not maintained — they are preserved.** A `docs/DECISIONS.md`
entry, or a code comment that explicitly narrates a past state ("this used to be
X; changed because Y"), describes what was true *at the time*. Do **not** edit it
to match the present during a staleness sweep — that destroys the only thing it
exists for. D-010 still says the AI call log is reachable from a "footer link";
it was, when D-010 was written, and it stays.

The line to apply when sweeping: **does the text claim to describe current
reality, or does it describe a past decision?** Living-log bullets, README prose
and comments on live code claim the present and get corrected. Decision entries
and explicitly-past narration do not. When a decision is genuinely superseded,
write a NEW entry that says so and references the old number — never rewrite the
old one.

**One exception: a claim that was WRONG when written gets corrected**, because it
was never a valid record — the merge count that had drifted, or the magnifier
orientation Claude asserted backwards. Fix the fact and say in the commit message
that it is a correction, not an update.

\---

## Version Control Workflow (non-negotiable)

* **Repo:** https://github.com/guycn1/cinerank-project.git (repo name: `cinerank-project`)
* **Working branch:** `draft` — all day-to-day work happens here.
* **`main` is the repo's default branch, but treated as protected in practice:** nothing gets pushed to `main` directly, ever.
* **Every modification inside this project's folder must be followed by a commit + push to `draft`.** Commit at natural checkpoints (a feature working, a bug fixed), not just once at the end of a session.
* **Merging `draft` → `main` only happens at a notable, settled milestone** — a UI milestone or a backend milestone believed to be genuinely complete, not a small incremental change. **Claude must ask the user for explicit confirmation before merging to `main`.** Never merge automatically, even if the milestone seems obviously done.
* **Git authoring:** never hardcode a commit author name/email. Always use whatever `user.name`/`user.email` are already configured in the local git installation Claude Code is running on. Do not set or override git config identity values.
* Commit messages should include a summary of what actually changed.

### Environment & tooling traps (all of these have actually bitten here)

Windows, Git Bash for POSIX commands, `"type": "module"` in `package.json`.
Each of the following cost real time at least once — they are recorded so the
next session does not rediscover them.

* **Never put backticks inside a double-quoted `git commit -m "…"`.** Bash runs
  them as command substitution and silently deletes the word. This mangled
  `619ed64`, where "they share a `` `name` ``" was committed as "they share a".
  The message was already pushed and was left as-is rather than force-pushing a
  history rewrite over it. Use plain quotes in commit messages, or single-quote
  the whole `-m` argument. The same applies to `$` and `!`.
* **`git merge -F -` does not read from stdin.** Use repeated `-m` flags for a
  multi-paragraph merge message.
* **Temporary helper scripts must be `.cjs`.** `package.json` sets
  `"type": "module"`, so a stray `.js` file is parsed as an ES module and
  `require` throws. Delete them when done; never leave one in the repo.
* **Do not write temp files to `/tmp`.** Git Bash and Windows Node resolve it
  differently (`D:\tmp`), and `$TMPDIR` is unset. Use the session scratchpad, or
  a repo-relative file that is deleted in the same command.
* **The UI copy uses curly apostrophes** (`’`, e.g. "Couldn’t reach CineRank").
  An edit anchored on a straight `'` will not match. Copy the exact character
  out of the file rather than retyping it.

\---

## Out of Scope (v1)

* User accounts / authentication / multi-user support (see § Security \& Scope above for why this doesn't create a security gap).
* Social features — sharing rankings, following other users, public lists.
* Editing an AI suggestion's reason text or re-ranking suggestions manually before adding.
* Automatic/background re-generation of recommendations or taste verdicts — both are always explicitly user-triggered, never regenerated silently on page load.

