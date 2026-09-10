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

**Last updated:** 2026-09-09 (ranked-list backlog **COMPLETE — all 20 done**; the mobile-keypad fix — step 1 of the agreed order — is also done; the recommendations section was then AUDITED into a sub-backlog under step 2 — now R1–R30, with TWENTY-SIX done, R20 withdrawn as incorrect and three open; the per-item statuses there are the source of truth, do not summarise them from memory; fourteenth merge to main was 8103f97; migrations 001-004 all applied, 004 confirmed by the user 2026-09-09; the next-session backlog was reset the same day — six steps, see "Agreed order of work from here")

### Build status
* **Live at https://cinerank-g6lx.onrender.com** (Render free tier, deploys from
  `main` on every commit). Locally: `npm start` → http://localhost:3000. See the
  deploy entry under Pre-submission blockers for the service's exact settings.
* Supabase project is live; `db/schema.sql` + migrations `001` through `004`
  all applied.
* AI call log viewer confirmed working in-browser.
* `main` is at the latest settled UI milestone — currently "recommendations
  overhaul, second pass — the rec-card motion, hover and balanced grid" (2026-09-09,
  `8103f97`). **Fourteen** merges so far;
  `git log --merges --oneline main` is the source of truth, do NOT increment a
  number in a doc without checking it (that is exactly how PROCESS.md drifted to
  a wrong count). The same number appears in `docs/PROCESS.md` §1 — update both.
  `draft` continues day to day.

### Implemented
* Movie CRUD: search (TMDB) → add → rate (0–10, review) → auto-ranked list. Dupe
  guard via `unique(tmdb_id)`. Each card also shows TMDB's own score beneath the
  user's, captured at ADD time and never refreshed (D-036). Add auto-opens the rate dialog ("Skip for now").
  Long reviews clamp to 3 lines above 900px and 2 at 900px and below, with a
  "show more/show less" toggle (shown only when the text actually clips). The
  line count lives ONLY in CSS — the toggle is decided by measuring whether the
  text overflowed, never by counting lines.
* Recommendations: `POST /api/recommendations`, prompt `recommend_v3` (second-person
  reason voice, 8–16 words), server-side reason tidy, per-title TMDB verification,
  owned-titles filter. Card `.reason` clamps at 5 lines. A run that returns cards
  scrolls `.recs__head` to the top of the viewport, waits 400ms, then plays the
  cards in 0.75s each, 120ms apart; regenerating closes the previous set first,
  one card at a time, like pages of a book (R27, R14, R30, D-048). Nothing
  animates or scrolls on an empty or failed run.
  The grid's column count is chosen in JS rather than by `auto-fill`, so a row is
  never left holding one lonely card: four cards where three fit render 2 + 2,
  five where four fit render 3 + 2, and six where four fit render 3 + 3, with a
  short last row centred on a half-column offset (off-backlog, user-raised
  2026-09-09; D-050 and D-051).
  **A card's size never depends on how many came back** (R29, D-051): the width
  comes from the widest packing the viewport allows, the count from the
  balancing, and the grid is capped to what that many cards need and centred —
  so one recommendation is one normal-sized card with the slack split evenly
  either side. The AI metadata footer sits in its own slot BELOW the grid, not
  inside it, so it stays full width whatever the cards do.
* Taste verdict: `POST /api/taste-verdict`, prompt `taste_verdict_v7` **on `anthropic/claude-sonnet-5` — the one feature not
  on the cheap tier (D-053)** (2–3
  sentences, ~35–60 words, characterise the viewer — not recite ratings — in
  plain spoken English rather than review prose; v5–v7 changed the REGISTER
  only. **v7 is the one that matters as a lesson: v5 and v6 tried to get there
  by BANNING phrases and the register did not move — negative instructions went
  16 → 30 → 37 across the chain while worked examples of the target voice stayed
  at exactly ONE. v7 deletes the bans and carries four examples instead.** The
  split v6 proved by accident: a STRUCTURAL ban lands at once (it said "no
  semicolons, ever" and the semicolon vanished from the next verdict), a
  VOCABULARY ban does nearly nothing — it removes an option and supplies no
  replacement, so the model obeys it and falls back to its own default voice for
  the words it does pick. Register is a sample, not a rule.
  **And then v7 failed too, which is the actual finding.** Four worked examples
  in place of the bans produced the worst verdict of the chain: still
  "gratuitous", plus 4 sentences where every version since v4 has said 2–3 — a
  measurable rule break, not a matter of taste, and probably caused by four
  blockquotes pushing the Rules section down and the model matching the
  examples' clipped rhythm by adding a sentence. Rolled back to v6, which at
  least keeps its own rules.
  **THREE STRUCTURALLY DIFFERENT PROMPTS — bans, more bans, examples — PRODUCED
  THE SAME REGISTER, so the prompt was never the lever. THE MODEL WAS**, and it
  worked first try on the same v7 prompt: the register landed AND the sentence
  count came back into bounds, the second symptom resolving with the first.
  Do not write v8; if the verdict ever reads wrong again, look at the model
  before the wording. **Trap: v7 is the version that FAILED on Haiku** — if the
  verdict is ever moved back down a tier, move the prompt back to v6 with it,
  because v7's four examples dilute the rules underneath them on a small model.
  `temperature: 0.85` and real few-shot (example TURNS rather than prose) were
  never needed and stay untried.),
  `max_tokens` 180, server-side sentence-aware truncation (450-char ceiling) +
  markdown strip, explicit-trigger.
* AI call log: every call logged success **or** failure; `GET /api/ai-log` merges
  both tables; in-app viewer via the footer `.log-cta` button.
* Security: `.env` gitignored from commit 1, `npm run scan-secrets` pre-commit,
  anon key only, query-builder only, `textContent` only.
* Tests: `npm test` (Node built-in runner, 53 tests). Pure helpers
  (`parseModelJson`, `tidy*`, `estimateCostUsd`, `loadPrompt`) + route-level
  (`test/routes.test.js`): validation (400s), duplicate (409), TMDB-down (502),
  below-threshold (422), OpenRouter-down (422 **with** a `status='failed'`
  log row written), a row deleted mid-edit (404, not a 500), and the two
  `tmdb_rating` guards — that the value reaches the insert at all, and that
  TMDB's no-votes `0` is stored as `null` (D-037) — plus the two
  `review_requires_rating` guards (D-041): a check violation comes back as a
  400 with a usable message rather than a generic 500, and a violation of one of
  the table's OTHER check constraints is not dressed up as the review message.
  **Plus, as of 2026-09-09, the recommendation SUCCESS path (R19)** — which had no
  coverage at all, so every rule deciding what a user actually sees was unproven.
  One run exercises all three: a pick TMDB cannot confirm is dropped, a pick the
  user already owns is dropped, and two picks resolving to the same film collapse
  to one. A second test asserts the success log row carries `status='success'`,
  OpenRouter's own `usage.cost`, and exactly the titles that were SHOWN — not the
  three the model named and lost. Both were verified load-bearing by deleting each
  of the three service rules in turn: every deletion fails exactly these two tests.
  Three more groups landed the same day, each probed the same way: **R2**'s guard
  that an unrated film already in the list is never recommended back; **R23**'s
  invariant, written as a loop over BOTH AI features so they cannot drift, that a
  `status='failed'` row is always advertised to the UI and a failure with no row
  never is; and **R28**'s five, one per reason a run can come back empty —
  including the one that matters, that an unreachable TMDB is reported as such
  rather than as "the model only named films already in your list".
  Supabase is swapped for an in-memory fake (`test/helpers.js`)
  so tests never touch the live DB; TMDB/OpenRouter stubbed via `globalThis.fetch`.
  `server/index.js` exports `app` and only `listen()`s when run directly.
* **`scripts/debug-recs.js` — a console harness for the recommendations UI**
  (2026-09-09, user-asked). The client has no test harness, so every judgement
  about the recs grid, the entrance stagger, the scroll or the hover glow costs a
  real OpenRouter call, and the user ran their paid quota down doing exactly
  that. **The page loads it temporarily**, so `debugRecs(4)` is available in the
  console straight away and makes "Get recommendations" render four dummy cards.
  1–6 (`parseModelJson` slices at 6);
  `{ posters: false }` exercises the `.noposter` placeholder, `{ delayMs }` the
  latency.
  **It patches `window.fetch` and answers `POST /api/recommendations` in the
  browser** — so no OpenRouter call, no TMDB verification and NO
  `recommendation_logs` row, while everything downstream (busy button, exit
  animation, `renderRecommendations`, column balancing, stagger, scroll, meta
  footer) runs unmodified. Intercepting the transport rather than reaching into
  the render is the point: a harness that called the renderer directly would be
  testing itself. Dummy `tmdb_id`s are NEGATIVE, so they can never collide with a
  real film, and `POST /api/movies` for one is refused in the browser — pressing
  Add on a dummy card cannot reach the database. Reload to stop; nothing is
  persisted. Never run by Node.
  **It starts every page load DISARMED and is armed only by calling
  `debugRecs()`.** That flag is not decoration: the fetch patch installs the
  moment the file runs, which was harmless while pasting into a console WAS the
  arming, and became a trap the day the page started loading the file on every
  request — the app spent a day answering its own recommendation calls with six
  dummy cards, through hard refreshes and a cleared cache, because nothing was
  cached wrongly and the tag was doing exactly what it said.
  **Two lines make it load, and both are temporary** — the
  `<script src="/debug-recs.js">` at the bottom of `public/index.html` and the
  route serving it in `server/index.js` (the file lives in `scripts/`, which is
  deliberately outside the static root). The FILE stays; only those two go. See
  the checkbox under Pre-submission blockers. The harness also refuses to install
  itself when the hostname ends in `onrender.com`, so the live site is protected
  even if the removal is forgotten — a belt to that braces, not a substitute.
* `GET /api/health` liveness probe for a future host.
* `docs/PROCESS.md` — the LLM-augmented workflow narrative (prompt v-chain,
  guardrails, Incident 1) for the course's process grade.
* Accessibility: per-item `aria-label`s (Rate/Edit/Remove/Add-to-list name the
  film, not just the verb), live regions on search results / recs hint / verdict
  text, `aria-busy` on the two async trigger buttons, `aria-expanded`/
  `aria-controls` on the review "show more" toggle, dialogs `aria-labelledby`,
  poster `alt` text (`"{title} — poster"` / labelled placeholder), rec-card
  heading fixed h4→h3 (correct nesting under the section's h2), the recs grid a
  `<ul>` of `<li>`s with an explicit `role="list"` on it and on the ranked `<ol>`
  (R21 — `list-style: none` makes Safari/VoiceOver drop list semantics), a
  `.sr-only` span in the recs hint naming how many recommendations arrived, since
  that live region is all a screen reader hears about a run (R22), decorative
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
* **Search section — overhauled 2026-09-07, then REOPENED and worked again on
  2026-09-08/09**, so this is not a closed section. The 2026-09-07 pass below is
  behaviour first, then chrome. The 2026-09-08/09 round was narrow-viewport work
  and is recorded in the ranked-list bullets further down, since it came out of
  the same whole-app sweep: the Add button breaking in two, the input refusing to
  yield, the `TMDB 7.0` line splitting, the panel's fixed height, titles breaking
  mid-word, and the new sub-500px grid layout. **More is scheduled:** step 5 of
  the agreed order is a complete overhaul of the portrait view under 500px, which
  lands here again.
  - Seven fixes in one pass: a dead `row` click handler whose body was only a
    guarded early return; `.result-row`'s `cursor: pointer`, which promised a
    click the row never had; open results going stale after an add (one
    `setAddButtonState()` now renders the states and a sync pass re-applies it
    from `loadMovies()`, so removals re-open the offer too — that pass was
    `syncSearchResultButtons()` when this was written and is now the document-wide
    `syncAddButtons()`, see R3); Search + Add gaining the shared `busyButton()` treatment; the
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
    **The add button needed the identical fix and did not get it until
    2026-09-08**, found by the user on an Android phone in portrait (and
    reproducible on a narrowed desktop window). `.result-row .add-btn` could
    shrink below its content, so a row with a LONG TITLE squeezed the button
    instead and "+ Add" broke at its space into two lines. It looks like a width
    bug and is not — it depends on the neighbouring title's length, which is why
    narrowing the window spoils more rows one at a time rather than all at once,
    and why almost every button breaks on a phone, where almost every title
    wraps. Now `flex-shrink: 0` (the button keeps its content width; `.meta`
    absorbs the pressure, which it can, since it wraps) plus
    `white-space: nowrap`, because the longest label this button ever shows is
    not "+ Add" but "In your list". **No width threshold anywhere**, per the
    user's explicit ask.
    **And the search INPUT needed `min-width: 0`** (2026-09-08, same user, same
    phone): the Search button was clipped clean off the right edge at 311px.
    `flex: 1` is not enough on an `<input>`, because a flex item's automatic
    minimum size resolves to min-content and an input's min-content is its
    INTRINSIC size — roughly the 20 characters of its default `size` attribute,
    not its text. So the input refused to shrink, the row overflowed, and the
    button (correctly `flex-shrink: 0`) was pushed out of view. **Three
    consecutive bugs, one root cause:** this, the add button, and the ranked
    card's blown-out `1fr` track (D-045) are all the automatic minimum size of a
    flex or grid item. When something will not shrink, look there first.
    **Two sweep findings were examined and DELIBERATELY NOT FIXED.** They were
    settled in conversation, so they are written here or a later session will
    rediscover them, "fix" them, and undo a decision:
    * **The Add button changes width across its four states** (68 / 104 / 85 /
      95px, measured). Since it is `flex-shrink: 0`, the growth during
      `⟳ Adding…` comes out of `.meta`, which can re-wrap the title mid-request.
      Real, but transient (200–500ms), needs a title whose wrap point falls in
      that window, and the user could not reproduce it. **Do not "fix" it by
      reserving the widest label's width** — that costs every row width all the
      time to remove a flicker nobody can see, and it makes the crushed-title
      problem worse. The sub-500px grid layout also gives the button its own line
      now, so there is slack where it used to matter.
    * **`.search button .busy-label { display: none }` is scoped to the search
      form only**, so the Add button keeps its full "Adding…" label at every
      width. Cosmetic asymmetry, not a defect: its only consequence was the item
      above. Fixing it needs a 500px threshold and leaves a bare spinner in a
      pill, and there is a fair argument the SEARCH button is the odd one out,
      since the ranked list's Remove button also goes spinner-only. Left alone.
    **The row's `year · TMDB score` line no longer breaks mid-value.** It is one
    text node, so the browser could break at ANY space in it — including the one
    inside "TMDB 7.0", stranding "7.0" on its own line below "2013 · TMDB" at
    ~340px and under. A NON-BREAKING space now glues the label to its number,
    written as a ` ` ESCAPE rather than a literal character so it cannot be
    mistaken for an ordinary space and tidied away. The break around " · " is
    deliberately left, so a narrow row wraps as "2013 ·" / "TMDB 7.0".
    **Provably invisible at any width that is not already breaking there:** U+00A0
    renders identically to U+0020 and only removes a break OPPORTUNITY. The
    ranked card needs no equivalent — `.score-tmdb` is `white-space: nowrap`,
    which forbids the break outright.
    **And the row now STACKS rather than crushing its title column.** At 283px
    the middle column was down to ~29px and a title fragmented into
    "Pap / a / Oba / ma" — `overflow-wrap: anywhere` doing its last-resort job in
    a column that should never have been that narrow. `.result-row` is
    `flex-wrap: wrap` and `.meta` is `flex: 1 1 5rem`, so below a threshold the
    button drops to its own line and the title gets the full row.
    **No media query and no number encodes the threshold** — flex line breaking
    compares hypothetical sizes, so the browser derives it from the button's REAL
    width, and it self-adjusts per row. **Thresholds MEASURED, not estimated**
    (the user ran the button widths in the console: 68 / 104 / 85 / 95px):
    "+ Add" 289px, "✓ Added" 306px, "In your list" 316px, mid-add 325px. Below
    those the title column would be 53–79px — the crushed state this prevents.
    An earlier note here said 332/284px from estimated button widths; "In your
    list" is 95px, not the 111px guessed, so it stacks LATER than first written. Common widths (360/390/412px) are untouched.
  - **Search results get their own layout under 500px** (user-designed,
    2026-09-09). The Add button moves from the right-hand column to directly
    UNDER the year/TMDB line, in the title's column, and subtle row separators
    make it unambiguous which button belongs to which film.
    **Grid, not flex.** The button has to land in the SECOND column beneath the
    meta; flex can only push it onto a new line spanning the whole row, which
    puts it under the POSTER with nothing tying it to the film — which is what
    the user called sloppy. The poster spans both grid rows, so auto-placement
    drops the meta at 2/1 and the button at 2/2. `margin-left: auto` has to be
    cleared, or the grid cell shoves the button back to the far edge.
    **This supersedes the flex stacking below 500px.** That wrapping was tuned to
    fire at ~289–316px, entirely inside this query, so it no longer triggers. The
    flex rules are KEPT rather than deleted: they are the behaviour at 500px and
    up, and the fallback if this breakpoint ever moves down.
    Separators are scoped to this query deliberately — above 500px the button
    sits beside its film and proximity already says so. `--line` rather than
    `--line-faint`, since it has to stay visible through the hover tint.

    **Follow-up the same day, on the user's "never break mid-word at >=250px":**
    once the row stacks the title column is the viewport minus the poster —
    124px at 250px, about 14 characters at 1rem, so a 15-letter word would still
    have been broken by `overflow-wrap: anywhere`. A `@media (max-width: 300px)`
    block drops `.result-row .meta strong` to 0.9rem, giving ~16 characters,
    which covers every word length that occurs in real film titles. **A hard
    cutoff, not a `clamp()`** — a fluid size would have to start shrinking
    hundreds of pixels earlier to reach 0.9rem by 300px and would visibly touch
    the wide views; 301px and up is provably unchanged.
    `.result-row`'s `gap` was also split into `column-gap` / `row-gap`. The row
    gap applies ONLY once the row has wrapped, and at 0.9rem it left the stacked
    button floating clear of its film — the "sloppy" the user reported. Now
    0.4rem; an unwrapped row has no second line, so nothing there can move.
    **The `5rem` basis is load-bearing, not decoration.** Without it `.meta`
    keeps `flex-basis: auto`, whose hypothetical size is MAX-CONTENT, and
    `flex-wrap` would then push the button onto its own line at ANY width the
    moment a title got long. Visually inert above the threshold: the free space
    moves from the button's `margin-left: auto` to `.meta`'s `flex-grow`, and
    since grow is resolved before auto margins see the space, the button still
    ends at the right edge.
    **The results panel's height cap is viewport-aware** (sweep finding E). It
    was a bare `max-height: 340px` — the app's only fixed-pixel height cap, while
    the AI log dialog already used `88vh`. On a short viewport (a phone in
    landscape, a small desktop window) 340px is most of the screen, so the panel
    buried the page. Now `min(340px, 60svh)` with a `60vh` line above it as the
    fallback, since a lone unsupported `svh` would invalidate the declaration and
    leave NO cap at all. `svh` and not `dvh` so it does not resize mid-scroll as
    a mobile URL bar collapses.
    **Strictly shrinking, so nothing comfortable today can change:** `min()`
    cannot return more than 340px. Viewports 640px tall and up are byte-identical;
    only 500px and below see a smaller panel (300px at 500 tall, 216px at 360).
    **Two more one-line guards from the same sweep** (findings 7 and 8). The
    rate dialog's heading shows a film title exactly as the confirm dialog's
    does, but only the confirm dialog carried `overflow-wrap: anywhere` — the
    reasoning had been written down once and applied to one of the two. The
    declaration is now on the SHARED `.rate-dialog h3, .confirm-dialog h3` rule
    and removed from the confirm-only block, rather than duplicated: the same
    property in two rules is the shape that later gets changed in one of them.
    Identical for the confirm dialog — both rules are (0,1,1) and nothing
    competes, so the value just arrives from the shared rule instead. The toast
    got the same guard: `max-width: 90vw` caps the BOX, so an unbreakable word
    did not wrap, it spilled out of the rounded panel.
    **Both are provably inert above ~300px**, which was the user's bar:
    `overflow-wrap` only creates break opportunities that are used when a word
    cannot fit a line by itself, and no realistic title or server message comes
    near that. The only cases either can affect are ones already rendering
    broken.
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
  - **Submitting a search closes a phone's soft keyboard** (2026-09-09, step 1
    of the agreed order). It stayed up over the results because the handler
    `preventDefault()`s — the form never navigates — and nothing in the app ever
    called `.blur()`. `dismissSoftKeyboard()` now does, from the submit handler,
    **after the empty-query early return** so that path's deliberate
    `el.searchInput.focus()` still runs. Gated on `matchMedia('(hover: none)')`:
    a capability query like the CSS hover gates, never a width. Blurring on a
    pointer device would close no keyboard and would cost the caret plus the tab
    order (focus lands on `<body>`, so the next Tab restarts from the top of the
    document), so desktop is provably unchanged. The case it fixes is the
    keyboard's own Go/Search key, which submits without moving focus — tapping
    the Search button already blurred the input by itself.
* **Ranked list — all 20 backlog items DONE** (2026-09-08), but the section is
  NOT closed: the user is still raising off-backlog refinements and bugs found
  by using it ("a few more things to settle before calling the whole ranked-list
  overhaul a wrap"). Do not treat the empty backlog as the finish line.
  Claude's audit produced items 1–17 and the user
  added 18–20; **all 20 are done** and the canonical table with every
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
  - Review "show more" toggles are re-measured on resize (and on zoom, and
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

  - **Desktop card alignment** (2026-09-08, user-raised, off-backlog). The grid
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
    user scored 8.0 showed as #3 and #4, ordered by `created_at` descending —
    i.e. by which was added more recently, **the direction that has since been
    flipped to ascending, see the tie-break bullet below** — so the numbers asserted a ranking the data does not
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
    a test for a cosmetic gain. It was parked at the time and then **closed the
    same day in its own commit** (`a124934`), together with the one test
    assertion that quotes a message verbatim — which is exactly why it needed a
    separate commit rather than being folded in here.
    `failureText()` also normalises the terminal full stop, since the causes
    disagree ("Already in your list" has none, "Something went wrong." does) and
    most are not ours to edit. Two incidental fixes came out of the same testing:
    the verdict fallback had **no full stop**, and "couldn’t" was spelled three
    ways in app.js (curly, straight, and "Could not").

  - **The first three ranked posters load eagerly** (#17). Every poster was
    `loading="lazy"`, which is right for #20 and wrong for the cards already on
    screen: the browser cannot decide "is this near the viewport" before layout,
    so an in-view poster is deferred for nothing. `posterNode()` now takes an
    opt-IN `{ eager }`, so the two callers that render only after a click (search
    rows, rec cards) keep `lazy` untouched — neither is ever part of the first
    paint, which is the only place the distinction matters.
    **Honest about the size:** these images are built in JS after `/api/movies`
    returns, so the preload scanner was never going to see them either way. The
    win is a layout pass on the first few cards, not a dramatic one; it is worth
    having because the poster is the design's primary visual anchor and the top
    of the list is what a reader looks at first. **`EAGER_POSTERS = 3` is a
    judgement call, not a measurement** — three is inside the fold at every
    width, and being wrong costs one unneeded request. Do not "improve" it by
    measuring the real fold: that reads layout during the render, which is
    exactly what `syncReviewToggles()`'s three batched passes exist to avoid.

  - **The review toggle uses one verb in both directions** (#18, user-raised).
    It read `view more…` / `show less` — two verbs for one control, and an
    ellipsis on only one half. **Not a considered pairing:** both strings landed
    together in `93bd6d3`, whose message only narrates them, and no decision
    entry ever discussed the wording. Now `show more` / `show less`.
    **The ellipsis is dropped rather than balanced, for a checkable reason:**
    `.review` is a `-webkit-box` with `-webkit-line-clamp`, so the browser
    already ends the clipped line in "…" — the label repeated it one line below.
    `show` and not `view`, even though the AI log's reveal summary says
    `view verdict`: consistency WITHIN one control beats matching a different
    surface, and "view less" is the weaker half of that pair. No accessibility
    consequence — the toggle carries `aria-expanded`, so the state is announced
    independently of the label.
    Past-tense mentions of `view more…` in `syncReviewToggles()`'s JSDoc and in
    `docs/DECISIONS.md` are LEFT ALONE: the label really was that when those
    bugs happened, and rewriting them would be maintaining history rather than
    preserving it.

  - **Grow-on-hover — and the bug it uncovered** (#19, user-raised, D-043). The
    user asked for something more pronounced, saying the old effect was "too
    subtle - I can only notice it on the poster". That was literally true twice
    over. The card never scaled at all (only `translateY(-3px)`) — **and even
    that lift did nothing on a freshly loaded page.** `.movie-card.is-entering`
    used `animation: … both`, the class is added on first paint and NEVER
    removed, and a forwards-filling animation keeps applying its last keyframe —
    which **outranks normal author declarations in the cascade.** `fade-slide`
    ends at `transform: none`, so every first-paint card was pinned there for the
    life of the page, silently beating `:hover`. It worked again after any
    add/rate/remove, because those rebuild cards without the class — which is
    what made it read as *subtle* rather than *broken*.
    Fixed with `both` → `backwards`, not by removing the class in JS: `backwards`
    keeps the half that is needed (holding the from-state through the stagger
    delay) and drops the half that caused it, with no listener to leak and no
    failure mode when the animation never runs. Provably no visual change at
    rest — the final keyframe already equals the card's resting state.
    `.rec-card` carried the same `both` and was fixed with it; nothing was
    visibly broken there, but adding a hover transform later would have silently
    done nothing.
    The second half was that **`box-shadow` was neither transitioned nor changed
    on hover**, so the card rose against a static shadow — a lift with no
    elevation cue. Now it deepens, and the user chose the option that adds a
    faint amber rim.
    **The lift itself was then removed, same day, on the user's report.** A
    `translateY(-5px)` is directional: it shrank the gap ABOVE the card by 5px
    and opened the one below, so a hovered card drifted toward its upper
    neighbour — measured at 10px above vs 20px below, a 2:1 split the user
    spotted straight away. In a vertical list of identical siblings that
    asymmetry is the most visible thing about the effect. The card now scales
    only (`scale(1.02)`, raised from 1.012 to keep it pronounced), which grows
    from the centre and opens both gaps equally — 14.3px each. Elevation is still
    expressed, by the downward-offset shadow alone, which is what sells depth
    anyway. **A lift cannot be made symmetric** — that is what `translateY`
    means — so do not restore one without re-reading this.
    **Then the shadow was rebuilt out of light, not black** (D-044, user-raised:
    "barely visible against the dark background"). It led with a black drop
    shadow, and the page is `--bg: #0b0b0f` — a black shadow darkens what is
    behind it, and there was nothing left to darken, so that layer did almost no
    work at any opacity. It is REMOVED rather than reduced, and the amber carries
    the effect: a lit edge, an inner glow and a wide halo.
    **All three layers have a zero Y-offset, and that is a rule.** The middle
    one shipped as `0 16px …` — a downward "pool", the drop-shadow idiom — and
    the user spotted within minutes that the glow was far bigger below the card
    than above it. A shadow is CAST and pools away from the light; a glow is
    EMITTED and radiates evenly, so any offset only makes it lopsided. That was
    the **second** time in this one item that a drop-shadow habit produced an
    asymmetry a glow should not have — the `translateY` lift was the first. Do
    not give these layers a Y-offset.
    **Spotlight (user-raised, same item): hovering one card dims every other**
    (`opacity: 0.55`), so the list recedes and only the card under the pointer is
    at full strength. Two things make it work and neither is obvious.
    **`:has()`, not `.ranked__list:hover .movie-card:not(:hover)`** — the list
    has a 1rem `gap` that belongs to the list but to no card, so the shorter form
    dims EVERYTHING while the pointer crosses a gap, and sliding down the list
    would strobe. **And `z-index: 1` on the hovered card is required, not
    decoration:** `opacity < 1` creates a stacking context, promoting every
    dimmed sibling into the same paint step as the transformed hovered card,
    where DOM order decides — so the card below would paint over the hovered
    card's glow and clip it. Grid items take `z-index` with no `position`.
    It also **only works because D-043 changed the entrance fill to
    `backwards`**: `fade-slide` ends at `opacity: 1`, and a forwards fill would
    have pinned every first-paint card there and silently refused to dim — the
    same bug as the hover transform, one property over.
    **This supersedes D-043's own trap**, which said to hold the amber at
    0.10–0.12 alpha so hover could not be mistaken for keyboard focus. Followed
    literally, that is what made the effect invisible. What actually separates
    them is SHAPE: `:focus-visible` is a crisp, fully opaque 2px solid outline
    held 3px off the element, while the hover glow is translucent, diffuse and
    attached to the edge. Those differ at any brightness. The revised rule: the
    glow may be as bright as it likes, but must never become a hard-edged opaque
    amber line at an offset — that, not brightness, is where the two converge.
    Older note, still true of the OTHER amber uses: it must not be confusable with the
    `:focus-visible` ring, which is the same colour but a crisp 2px solid. Hover
    rules are gated on `@media (hover: hover)` (NOT a width query) so a tap on a
    phone cannot park a card in the grown state, and `prefers-reduced-motion`
    now drops the transform while keeping the colour response.

  - **A rated film with no review says so** (#20, the last item, user-added).
    `No review yet — edit to add one.`, italic and a step fainter than a real
    review (`--ink-faint` against its `--ink-dim`) — the same vocabulary
    `No TMDB rating` already uses, so an absence reads as an absence rather than
    as content. It fills the void that top-aligning the body (2026-09-08) left
    under a review-less card, which is why that entry says #20 became worth more,
    not less.
    **Scoped by the branch's structure, not by a new test.** It is the final
    `else` after `if (!isRated)` and `else if (m.review)`, so it is reachable
    only when the film IS rated and has no review. An unrated card must never
    get it — that card already says "Not rated yet", and a second placeholder
    beneath the first reads as nagging. This is the scoping #15 flagged in
    advance.
    **Class `no-review`, deliberately NOT a `.review` modifier:**
    `syncReviewToggles()` selects `.review` to measure for clamping, and a
    one-line placeholder has no business entering the pass item #5 took four
    commits to settle.

  - **No user text can widen a card** (off-backlog, user-found, D-045). A review
    of ~400 unbroken `f`s widened the card, the section and then the whole page,
    with no scrollbar to reveal what had been pushed off. The card's `1fr` track
    is `minmax(auto, 1fr)`, and that `auto` minimum is the **min-content width** —
    for one unbreakable word, the entire word. `.review`'s `overflow: hidden`
    from the line clamp did nothing, because clipping governs PAINTING, not the
    intrinsic size a track is measured from.
    **`overflow-wrap: anywhere`, and `break-word` would NOT have fixed it.** The
    two render identically — spaces first, mid-word only when a word cannot fit a
    line alone — but `break-word`'s break opportunities are ignored when
    min-content is calculated, so the track would still have been sized to the
    unbroken word. `anywhere` counts them, so min-content collapses to about one
    character. Same appearance, different arithmetic; do not simplify it.
    It inherits, so one declaration covers the title, review, #20's placeholder
    and the unrated hint. `min-width: 0` sits beside it as the structural half,
    since `overflow-wrap` governs text only.
    `.rec-card__body` and `.result-row` got the same guard **defensively** and are
    labelled as such in the CSS; only the ranked card was actually broken at the
    time. `.result-row` still carries TMDB titles and is still defensive.
    **`.rec-card__body`'s is no longer defensive** (corrected 2026-09-09): its
    justification was that the recs grid had a FIXED `minmax(190px, …)` minimum
    and so could not be pushed open, and D-050 replaced those tracks with plain
    `1fr` — `minmax(auto, 1fr)` — which puts the automatic minimum back in play.
    The same sweep found the gap that left: **`.rec-card` itself is the grid item
    and never carried `min-width: 0`**, so a poster's intrinsic width (TMDB
    serves w342) could push the track open and give a phone a horizontal
    scrollbar. Fixed. **Fifth appearance of one root cause** — the search input,
    the add button, the ranked card's `1fr` track, `.recs__trigger`, and now
    this. When something will not shrink, look at the automatic minimum size
    first.

  - **Equal ratings now read oldest-first** (off-backlog, user-raised
    2026-09-09). `GET /api/movies` broke ties with
    `.order('created_at', { ascending: false })`, so a newly added film jumped
    ABOVE everything it tied with: add two films and the second one appeared
    above the first, rate two films 4.0 and the second sat above the first. Every
    unrated film is tied with every other by definition, so the whole unrated
    block was newest-first too. Now ascending — adding to a list appends to it.
    **The tie-break carries no meaning either way, and that is exactly why it
    should not surprise.** D-038 is the whole point: a tie draws ONE shared rank
    number and a muted `tied` caption precisely because the order within it is
    arbitrary. This changes which arbitrary order it is, not whether it means
    anything.
    Nothing else moves. `displayedRanking()` computes competition ranking from
    RATINGS, so no rank number changes; the #1 crown still lands on the top-rated
    (both films, when the top is tied); and `rankSignature()` compares id + rank +
    tie state, none of which this touches. The client never re-sorts — verified,
    `app.js` has no `.sort()` at all — so the API's order is the displayed order
    and this is a one-line change in one place.
    **Not covered by a test, and cannot be:** the fake Supabase builder's
    `.order()` is a no-op like its `.not()` was (see the comment in
    `test/helpers.js`), so a test asserting this order would pass no matter which
    direction the route asked for.

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
| 16 | Copy inconsistencies. Worked in three parts, **all done**. **(a) Confirmation toasts** (2026-09-08, user-raised): all three now read `“Title” added/saved/removed`, one shape, film first — two named no film at all, and `— ranking updated` is now conditional on the ranking actually differing (D-034). **(b) The `5 films · 5 rated` subtitle** (2026-09-08): now `5 films` when all are rated, `5 films · 2 not rated yet` when not, `5 films · none rated yet` when none are. **(c) The two ERROR toasts** (2026-09-08): a failed add/remove now names its film via one `failureText()` composer, and the causes carry a `short` form so a context prefix cannot double them (D-042). Also fixed en route: the verdict fallback had no full stop, and "couldn’t" was spelled three ways | **done** — D-042 |
| 17 | `loading="lazy"` on above-the-fold posters delays the first few cards | **done** — the first `EAGER_POSTERS` (3) ranked posters load eagerly; `lazy` stays the default, so search rows and rec cards are untouched |
| 18 | Discuss the "view more…" vs "show less" wording discrepancy | **done** — now `show more` / `show less`: one verb both ways, and the ellipsis dropped because the clamp already draws its own |
| 19 | Add a grow-on-hover effect to each ranked-list item | **done** — D-043. Uncovered that the OLD lift was being cancelled outright by the entrance animation fill |
| 20 | A rated film with no review shows nothing at all where a review would be. Say so — an italic, muted `No review yet — edit to add one` (wording TBD) — so the slot is never silently empty. Inverse of #15 | **done** — a `.no-review` line in the final `else` of the body branch, reachable only when rated AND review-less. Wording kept as proposed; `.no-review`, never a `.review` modifier |

##### Agreed order of work from here (set by the user, 2026-09-09)

Work this top to bottom. It is the user's own sequencing, not Claude's — do not
re-prioritise it, and do not start further down because something looks quicker.
This list REPLACES the 2026-09-08 one, whose steps are all done or folded in.

1. **Mobile keypad does not close when a search is submitted — DONE
   2026-09-09.** The mechanism was as traced: the submit handler calls
   `e.preventDefault()` so the form never navigates, and nothing in `app.js` ever
   called `.blur()`, so the input kept focus and the keyboard with it. A
   `dismissSoftKeyboard()` helper now blurs the input, called from the submit
   handler **after** its empty-query early return, so the deliberate
   `el.searchInput.focus()` on that path is untouched.
   **Gated on `matchMedia('(hover: none)')`, not applied unconditionally.** A
   capability query, the same shape as the `@media (hover: hover)` gate on the
   card hover rules and never a width. A pointer device has no soft keyboard to
   close, so a blur there buys nothing and costs two things: the caret, and the
   tab order — `blur()` moves focus to `<body>`, so the next Tab restarts from
   the top of the document instead of continuing past the input. Desktop is
   provably unchanged. A touch laptop reports `hover: hover` and keeps focus,
   which is right for the pointer it calls primary.
   The case that actually needed it is the keyboard's own **Go/Search** key,
   which submits without moving focus; tapping the Search BUTTON already blurred
   the input by itself.

2. **Recommendations overhaul — THE canonical sub-backlog.** Claude audited the
   whole path on 2026-09-09 (markup, client, CSS, route, service, prompt, tests)
   and produced R1–R22 below; R23–R25 were added later, from findings made while
   fixing R9 and from the user working the verdict banner alongside it. R29–R30 were raised by the user on 2026-09-09 after
   seeing R27 and D-050 run. R1–R4, R8–R14,
   R7, R15, R16, R17, R19, R21, R22 and R23–R30 are done and R20 was WITHDRAWN as incorrect — every
   status is on the item itself. The user's original seed items are folded in and
   marked **(user)**. The groups are ordered by severity. **Do not renumber** —
   these are how the items get referred to. Keep the statuses current as they
   land.

   **Group A — functional bugs**

   * **R1. DONE 2026-09-09 — recs messages survive the run that wrote them.**
     `#recs-hint` has TWO owners: `syncRecommendationsAvailability()` writes the
     availability text, and a run writes its progress, result or failure into the
     same element. The sync reassigned it unconditionally, and the run's own
     `finally` calls the sync — so every message a run wrote was wiped in the same
     tick. **Not just the error, which is all the old Open-issues entry claimed:**
     `Based on: …` (which the README demo script tells the presenter to narrate)
     and `No new suggestions this time…` were dead too, so a failed run, a
     successful run and a page that had never run all looked identical apart from
     the cards.
     Fixed with the guard `syncVerdictAvailability()` already uses, ported not
     reinvented: `state.recsHintFromRun` is set when a run starts and the sync
     writes the idle hint only when it is false. Below the threshold the
     availability text still always wins and clears the flag — the section is
     unavailable, so what a past run said about it is moot.
     **A second, latent bug in the same function went with it:** the sync also
     reassigned `el.recsTrigger.disabled` unconditionally, so adding a film from
     the search panel WHILE a recs call was in flight handed the busy button back
     to the user. It now skips that write when the button is `aria-busy`, the same
     guard and the same reason as the skip in `syncAddButtons()`.
     **Not covered by a test — the client has no test harness at all**, so this one
     was verified by reading and by tracing all eleven paths (boot above/below
     threshold, success, failure, zero-suggestions, an unrelated add/rate/remove
     after each, and both mid-flight races). Worth a browser pass before the
     resilience screenshots, which this fix is what makes possible.
   * **R2. DONE 2026-09-09 (D-046) — the server half of the owned filter.** The
     answer to the user's "verify the owned filter holds end to end" was **no**:
     `generateRecommendations()` built `ownedTmdbIds` from the SAME query feeding
     the taste profile, which was filtered `.not('rating', 'is', null)`, so the
     owned set held only RATED films and anything added-but-not-yet-rated was
     invisible to it.
     Fixed by dropping the SQL filter entirely: ONE unfiltered read, then `rated`
     and the owned set derived from it two lines apart. **Not** the second query
     the audit first proposed — see D-046 for why, and for the trap that settled
     it: the first version of the test PASSED against the buggy code, because
     every filter method on the fake Supabase builder is a no-op, so the fake
     ignored the very `.not()` that caused the bug. That no-op is now commented at
     itself in `test/helpers.js`.
     **Do not push the filter back into the query** and **do not rebuild the owned
     set from `rated`** — either one restores the bug, and the second fails
     exactly one test (verified by doing it).
     **R3 is the still-open client half**: rec cards never re-sync their Add
     button, so the UI can still offer a film the list already has.
   * **R3. DONE 2026-09-09 — the Add-button sync now runs in every direction.**
     Reported live by the user, who found BOTH directions of it. The sync swept
     only `.search-results`, so: adding from a REC CARD refreshed the search rows
     (they were in the panel it swept), but adding the same film from a SEARCH ROW
     left the rec card still offering it, **and** removing a film from the ranked
     list left the rec card stuck on a disabled "✓ Added" for something no longer
     in the list. Never a data bug — the duplicate add was refused correctly by
     the 409, as the user confirmed — the button just lied about what it would do.
     `syncSearchResultButtons()` is now `syncAddButtons()` and queries the whole
     document for `.add-btn[data-tmdb-id]`, so a THIRD surface with an Add button
     is covered the day it is written rather than the day someone remembers the
     function exists. Rec-card buttons gained the class and the `tmdbId` stamp
     that make them findable.
     **The shared `setAddButtonState()` did not get to decide R7 on the way
     through.** Its unowned label is now read from `btn.dataset.addLabel` (default
     `+ Add`), so the rec card kept `Add to my list` until the wording was
     settled — R7 has since done that, as `+ Add to my list`. The OWNED labels are shared, which is right: both surfaces
     should settle identically. Note the rec card's `aria-label` moved from "to my
     list" to the shared "to your list". R7 looked at that and LEFT it: each voice is
     right where it appears — "my list" on a button the user presses, "your list"
     when the app addresses them.
     This was the UI half of the user's duplicate-safeguard item **(user)**; the DB
     (`unique(tmdb_id)`) and API (23505 → 409) halves were already correct.
   * **R4. DONE 2026-09-09, with R3.** `addMovie()`'s catch reads
     `btn?.dataset.title`, which search rows stamped and rec-card buttons did not,
     so a failed add from a rec card said `Couldn’t add that film — …` while the
     identical failure from a search row said `Couldn’t add “Dune” — …`. The rec
     card now carries the same three stamps a search row does, which is what R3
     needed anyway.
   * **R5. A log-write failure destroys the real error.** In
     `generateRecommendations()`, if the `recommendation_logs` insert fails the
     function throws `Recommendation log write failed: …`, discarding the
     `errorText` already captured from an AI failure. Related and DELIBERATE, but
     written down so it is not "fixed" by accident: a SUCCESSFUL, already-paid-for
     run is also discarded if its log write fails. That is the right call for a
     course that grades the audit trail — the log is the point — but the user
     should see something better than a bare 422.

   **Group B — the strength of the "verified against TMDB" claim**

   * **R6. `verifyTitle()` falls back to `results[0]`, so almost nothing is ever
     actually dropped.** It looks for a case-insensitive exact match and, failing
     that, returns TMDB's first result for the query. TMDB search is fuzzy, so a
     hallucinated title usually resolves to SOME real film, which is then shown
     with the model's reason still describing the film that does not exist.
     SPEC §2.2 #4 and the README both say unverifiable titles are dropped; in
     practice that drop path is nearly unreachable.
     **Do not simply tighten it to exact-match-only** — that would silently drop
     legitimate picks over punctuation and diacritics (`Amelie` vs `Amélie`,
     `The Lord of the Rings: Fellowship…` vs `…: The Fellowship…`) and shrink
     every run. Decide the matching rule deliberately (normalise case, accents and
     punctuation, then require equality or strong containment) and state what it
     costs. The blast-radius claim in CLAUDE.md § Security 5 is NOT affected: the
     output still only ever drives a title lookup.

   **Group C — copy and consistency**

   * **R7. DONE 2026-09-11 — the rec card now reads `+ Add to my list`.** It
     rested at `Add to my list` against the search row's `+ Add`, and the two
     CONVERGED after action — both settle to the glyph-glued labels via the
     shared `addMovie()` — so the card's one button spoke three vocabularies.
     **The user settled it by keeping the longer wording and prepending the
     glyph**, rather than shortening the card to match the row. Both surfaces now
     share one vocabulary at every stage: rest `+ Add…`, busy `⟳ Adding…`,
     settled `✓ Added` / `In your list`.
     **The non-breaking space is the rule, not a detail** (§ Button labels): the
     plus is glued to "Add" with a `u00A0` ESCAPE (backslash-u), never a literal
     character, and in the STRING rather than in CSS because the label renders on
     two surfaces and only one is `white-space: nowrap`. "to my list" may wrap on
     its spaces — explicitly allowed; "+" leaving "Add" is not.
     **That escape was collapsed into a literal NBSP on the first attempt and had
     to be rebuilt without typing a backslash at all** — the tooling trap under
     § Environment traps, now hit twice. Verified after: zero literal U+00A0
     codepoints in `app.js`, and the label's second codepoint reads `A0` at
     runtime.
     **The my/your split is deliberate and stays.** The visible label says "my
     list" (the user's voice, on a button they press); the `aria-label`, written
     separately by `setAddButtonState()`, says `Add {title} to your list` (the
     app addressing them). Each is right for where it appears, and the glyph
     never reaches a screen reader.
   * **R8. DONE 2026-09-09 (D-047).** The route wrapped every cause as
     `Couldn’t generate recommendations: ${err.message}` under a comment claiming
     "never a raw dump" — and the causes are `OpenRouter unreachable
     (TimeoutError)`, `OpenRouter responded 401`, `DB read failed: <postgres
     text>`. Now a calm sentence, with the technical cause going only to the log
     row's `error_text` (asserted by a test). **One cause survives verbatim:**
     "Need at least 3 rated movies" is the answer to the user's question, not a
     fault report — flagged `userFacing` at its throw site rather than
     pattern-matched in the route, so the two cannot drift.
   * **R9. DONE 2026-09-09 (D-047) — but NOT by copying the verdict, and that is
     the point.** This item told the next session to copy the verdict's shape.
     Reading it first showed the verdict offers the log **unconditionally**, so
     when CineRank itself is unreachable it sends the user to a log that cannot
     load either. Copying it would have propagated the bug.
     The offer is now conditional on a fact only the server knows: was a
     `recommendation_logs` row actually committed? Of six throw sites only one
     qualifies. It travels as `logged: true` beside `error` — exactly D-042's
     `short` mechanism, additive and invisible to anything reading only
     `body.error` — and `api()` carries it onto the thrown error the same way.
     **The verdict's own version of this is still wrong: see R23.**
   * **R10. DONE 2026-09-09.** The empty branch returned before `aiMetaFooter`,
     so a call that really was made, really cost money and really was logged
     showed no cost, tokens or duration anywhere on the page — the only AI outcome
     in the app that did not. It now appends the footer before returning. That
     footer already ends in `logLink()`, which is why the message beside it does
     NOT get a log link of its own; two on one line.
     Found and fixed live, with a deliberate temporary "return zero
     recommendations" line in the service so the state could actually be looked
     at — reverted before commit.

   **Group D — visual, and narrow viewports**

   * **R11. DONE 2026-09-09.** `.recs__trigger` had neither `flex-shrink: 0` nor
     `white-space: nowrap`, so a flex item's automatic minimum size let it shrink
     below its content and `Get recommendations` broke at its space onto two
     lines. Now both. The HEADING absorbs the pressure instead, which it can,
     because it wraps.
     **Fourth appearance of one root cause** — this, the add button, the search
     input, and the ranked card's blown-out `1fr` track (D-045). When something
     will not shrink, or shrinks when it should not, look at the automatic minimum
     size first.
     Note this is NOT the glyph/line-break rule being enforced: `Get
     recommendations` is that rule's one standing exemption. It is a separate fix
     that happens to make the exemption moot.
   * **R12. DONE 2026-09-09, with R11 — the two section heads are reunited.**
     `flex-wrap: wrap` moved onto the shared `.ranked__head, .recs__head` rule and
     the `.ranked__head`-only rule is gone, along with the comment explaining the
     split. The split existed so that wrapping the head could not mask R11; R11 is
     fixed, so it has served its purpose. **One LAYOUT rule, to be exact:**
     `.recs__head` picked up a selector of its own again with R27, for the
     `scroll-margin-top` its scroll target needs. Different concern, not this
     split creeping back — both places say so.
     The trigger now drops below "What to watch next" rather than both items
     squeezing. **No threshold is encoded, and the comment says not to add one:**
     flex line breaking compares HYPOTHETICAL sizes, so the browser derives the
     break point from the heading's real max-content width plus the button's real
     width, and re-derives it if either string or the type changes. The old
     comment's "~385px" came from an estimate and was removed rather than
     recomputed — estimated widths in this file have been wrong before.
   * **R13. DONE 2026-09-09 — the disabled rec-card button stopped looking
     clickable.** It dimmed a FILLED amber button with `opacity: 0.5`, which is
     the exact bug `.search button:disabled` exists to fix, and WORSE here: on the
     search button the wrong state lasted the second it said "Searching…", while
     on a rec card `✓ Added` / `In your list` is a PERMANENT resting state.
     Measured: amber at 0.5 over the card composites to **#876d3e** and still
     contrasts **3.57** against it — an unmistakably amber button that does
     nothing.
     **The search button's fix could not be copied verbatim**, which is the part
     worth remembering: its disabled fill is `--bg-card`, and `--bg-card` IS the
     rec card's own background, so the button would have vanished into the card
     completely. `--line` instead — a hair lighter than the card (1.16) so the
     button keeps its own edges, with `--ink-dim` at 5.56, clear of AA for
     16px/600 text. Those two figures are almost exactly the search button's own
     (1.12 shape, 6.48 label), so this MATCHES the established answer rather than
     inventing a second one: a disabled fill nearly dissolves and the label
     carries the readability. `cursor` also went `default` → `not-allowed`, which
     is what both `.result-row .add-btn:disabled` and `.search button:disabled`
     use for the identical labels.
     **The false comment that caused it is corrected.** `.search button:disabled`
     claimed "This is the only FILLED button" — never true, and it is why this one
     was left on opacity when that rule was written. Audited against every
     `disabled =` assignment in `app.js`: THREE amber-filled buttons can be
     disabled — the search button, `.rate-dialog button.primary` and this one —
     and all three now swap the fill. `.log-cta__btn` is amber-filled too but
     nothing ever disables it.
   * **R14. DONE 2026-09-09, with R27 (D-048) — grow-on-hover on `.rec-card`.**
     Done in the same pass as R27 on purpose: both land on this element, and both
     depend on the entrance fill staying `backwards`. A forwards fill pins
     `transform: none` from the final keyframe and outranks normal author
     declarations, which is exactly how the ranked card's hover was silently
     cancelled (D-043) — so a hover added here without R27 alongside it would
     have been one edit away from the same invisible bug.
     The ranked card's vocabulary ported verbatim: `scale(1.02)` and NO
     `translateY` (a lift is directional and drifts the card toward one
     neighbour — worse in a grid, where it has row-mates too), an amber border,
     and three glow layers at a **zero Y-offset** with no black layer, because on
     `--bg: #0b0b0f` a black shadow has nothing left to darken (D-044).
     Two deliberate differences. The glow is **wider** than the ranked card's
     (40/100px against 40/60px, plus a 1.5px lit edge and `scale(1.018)`) — those
     magnitudes were tuned by the user by eye, reversing Claude's first pass,
     which had gone one notch TIGHTER on the theory that a halo crossing the
     grid's 17.6px gap would read as two cards sharing one glow. The spotlight
     (D-049) landed between the two edits and settles it: with every other card
     at 0.7, a halo spilling across the gap falls on something already receding.
     A box-shadow is ink overflow, so no size here can produce a scrollbar.
     Second difference: `z-index: 3` rather
     than the ranked card's `1`, which is arithmetic — every `.rec-card::before`
     badge carries `z-index: 2` and resolves in the same stacking context, so at
     `1` a NEIGHBOUR's badge would paint over this card's glow.
     **The spotlight dimming IS ported, at `0.7` rather than the ranked list's
     `0.55`** (D-049). Claude argued against porting it at all and the user
     overruled that the same day — correctly: the objection was to the ranked
     list's STRENGTH, not to the idea, and 0.7 leaves every unhovered card
     perfectly readable while the section still recedes. `> *` and not
     `> .rec-card`, so the metadata footer dims with them instead of being left
     as the single brightest thing on screen; hovering the footer dims nothing,
     because the `:has()` tests for a hovered card. Do not re-tune 0.7 by eye
     without reading D-049 — the number is the whole of what was settled.
   * **R15. DONE 2026-09-11 — a sparkle on the trigger, and the emoji exemption
     went unused.** Two four-point stars as an inline SVG with
     `fill="currentColor"`, so the icon follows all three of the button's states
     for free: amber at rest, inverting to `#1a1205` on the amber hover fill, and
     dimming with the label at `opacity: 0.45` when disabled. The emoji would
     have done none of that — it is a fixed full-colour image (D-027), so it
     would have stayed bright while the label dimmed. The exemption the user
     granted in advance was not needed, and **"no emoji remain in rendered output
     anywhere" still holds**.
     **Tuned once on the user's "slightly bigger and more pronounced":** `1.05em`
     → `1.3em`, and separately the star ARMS were thickened — the waist control
     points moved from 1.9 out to 2.6 from centre, which is what decides whether
     it reads as a sparkle or as a thin cross at button size. Size and weight are
     two dials and the request needed both. The paths are GENERATED from a
     centre, a tip radius and a waist offset rather than hand-tuned, so
     re-generate rather than nudging a number. `vertical-align` scales with the
     size (-0.16em → -0.28em) or a taller icon rides high against the text.
     **Inline, NOT a flex container, and that is the non-obvious part.** The
     obvious build is `display: inline-flex; gap`, copying `.log-cta__btn`. It is
     wrong here because `busyButton()` swaps the contents for a spinner plus a
     label that ALREADY begins with a non-breaking space — a flex `gap` would sit
     on top of that and make the busy state wider than the resting one. The
     search button solved this before and this follows it: an inline icon sized
     in `em` with a `vertical-align` nudge.
     **`white-space: nowrap` on `.recs__trigger` is now load-bearing for a second
     reason.** R11 added it so the label could not break; the glyph rule now also
     depends on it, because everywhere else the glue is a non-breaking space
     inside the string, and an icon is an ELEMENT — no string can hold it to the
     words beside it. Both places say so.
     `aria-hidden="true"` + `focusable="false"`: the button already says "Get
     recommendations" in text, so a decorative mark would only add noise.
   * **R16. DONE 2026-09-11 — a locked section no longer shows its own output.**
     Remove rated films until the count falls under the threshold: the trigger
     correctly disabled and the hint correctly said "Rate at least 3 movies to
     unlock recommendations", directly above six recommendations. The grid and
     the metadata footer are now cleared in the same branch that writes that
     text.
     **Cleared rather than captioned as a past run, and the reason is
     structural:** the section has exactly ONE message channel — `#recs-hint` —
     and the availability text has just taken it (R1), so captioning would mean
     either overloading the single writer or inventing a second element, which is
     disproportionate for a state reached only by removing films below the bar.
     **NOT because the cards went stale — that would be a different rule and a
     wrong one.** Recs go stale on ANY rating change and we deliberately leave
     them alone then. What is fixed here is a section contradicting itself.
   * **R17. DONE 2026-09-11 — the badge stops asserting something it can no
     longer know.** `.rec-card::before` claims two things and only one survives
     being acted on: "AI pick" is true forever, "not yet rated" stops being true
     the moment the film is added and rated — and adding from a rec card OPENS
     the rate dialog, so the flow the button invites is the one that falsifies
     the badge behind it.
     The false half is dropped, not the whole badge: `.rec-card.is-rated::before`
     reads `AI pick`. The provenance marker is why the element exists (SPEC § 3.2
     asks for one) and it is still accurate.
     **Rated-ness is read from `state.movies`, never from `state.ownedTmdbIds`** —
     owned and rated are different questions, and conflating them is precisely
     the bug R2 fixed on the server. A film can sit added-but-unrated
     indefinitely via "Skip for now", and the badge is correct for all of it.
     `syncRecCardBadges()` runs from `loadMovies()` and again at the end of
     `renderRecommendations()` — the second call is redundant today, since R2's
     owned filter means a rated film can never be recommended back, and it is
     there so the badge rests on `state.movies` alone rather than on a
     server-side filter staying correct.
   * **R18. `.recs__hint { min-height: 1.2em }` reserves one line for messages
     that run to three or four on a phone**, so the grid jumps as the hint
     changes. Low severity: the busy string and the resting string are close in
     length, so the shift is real but small. Check it during the step-5 portrait
     pass rather than guessing at a number now.

   **Group E — structure and tests**

   * **R19. DONE 2026-09-09 — the success path is now covered.** It had none: the
     only recommendation tests were the below-threshold 422 and the OpenRouter-down
     422, so the owned-titles filter, the intra-run dedup and the TMDB
     verification drop — everything R2 and R6 are about — were unproven. Two tests
     now sit in `test/routes.test.js`: one asserts that of four model picks only
     the verified, unowned, non-duplicate one reaches the user (and that its year
     and tmdb_id come from TMDB, not the model), the other that the log row carries
     `status='success'` and exactly the SHOWN titles.
     **Verified load-bearing, not just green:** each of the three `continue` guards
     in `generateRecommendations()` was deleted in turn, and every deletion failed
     exactly these two tests. Deliberately written against CURRENT behaviour, so
     R2's unrated-owner case is NOT yet asserted — that assertion is what should
     fail before the R2 fix and pass after it.
   * **R20. WITHDRAWN — the audit was wrong here, and the number is kept only so
     the others do not shift.** It claimed the client hardcodes the thresholds the
     server owns. It does not: `init()` in `app.js` does
     `state.cfg = await api('/api/config')` at boot, `server/index.js` serves those
     three numbers straight out of `server/config.js`, and a route test already
     asserts the endpoint's shape. The literals in `state.cfg` are a documented
     FALLBACK for that one request failing (`catch { /* keep defaults */ }`), not a
     second source of truth — and when it fails, `loadMovies()` has failed too and
     the user is already looking at an error toast. The server is the single
     source of truth. **Found by grepping for `api/config` after writing the
     item** — the original claim came from grepping only `state.cfg`, which showed
     the reads and the literals but not the assignment that overwrites them.
   * **R21. DONE 2026-09-11 — the recs grid is a `<ul>` of `<li>`s.** It was a
     div of divs, so six cards announced as unstructured content while the ranked
     list beside it had always been a proper `<ol>`. Nothing else changed: a list
     item is still a grid item, and every rule targets `.rec-card` rather than
     the tag (checked — no selector in the stylesheet names a tag here).
     **`role="list"` is not redundant belt-and-braces.** `list-style: none` makes
     Safari/VoiceOver drop list semantics entirely, which is the exact
     combination this fix would otherwise land in.
     **The ranked list had the same latent gap and got the same attribute.** It
     is `list-style: none` too, so its `<ol>` was already losing the semantics it
     was chosen for. Out of scope on paper, but fixing one list and leaving the
     identical hole in the one next door would have been worse than not
     looking.
   * **R22. DONE 2026-09-11 — the one outcome that produced content was the one
     that described only its input.** Re-checked all three now that R1 has stopped
     the availability sync wiping the hint in the same tick. A FAILURE announces
     its message and an EMPTY run announces why it was empty — both fine. A
     SUCCESS announced `Based on: Dune, Heat, Arrival.` and never mentioned that
     six recommendations had arrived.
     Fixed by appending a `.sr-only` span to that hint: `N recommendation(s)
     below.` The visible copy is untouched, because it is what the user settled
     and it reads correctly for anyone who can see the cards.
     **Announcing the CARDS instead was rejected** — six live-region updates per
     run is noise, and the hint is the channel this section already has. A new
     `.sr-only` utility came with it (the app had none), using
     `clip-path: inset(50%)` and `white-space: nowrap` so no engine reads it a
     letter per line.

   **Group F — found while fixing the above (added 2026-09-09)**

   * **R28. DONE 2026-09-09 — the zero-result message told the user a specific
     lie.** It read "No new suggestions this time — the model only named films
     already in your list" for EVERY empty run, and the user asked the right
     question: is that necessarily what happened? No. There are four causes, and
     that sentence describes one:
     the model named nothing (`parseModelJson` returned `[]`); TMDB answered and
     had no such film; **TMDB was unreachable** (the per-pick `catch` set
     `movie = null`, indistinguishable from the previous case); or everything it
     named was already owned. The intra-run duplicate guard cannot empty the list
     on its own — the first occurrence always survives.
     **The third one is why this mattered.** A TMDB outage during verification
     leaves the run logging `status: 'success'` (the AI call did succeed and was
     charged), so nothing else in the app mentions TMDB — that false sentence was
     the only thing the user would ever see, and it hid an outage. It is also a
     state on the resilience-screenshot list.
     Fixed at the source: the service keeps a per-title tally
     (`named / tmdbErrors / unmatched / owned / duplicate`), `emptyReasonFor()`
     resolves it to one of `none-named | tmdb-unreachable | all-owned |
     unverifiable | mixed`, and it travels as a top-level `emptyReason` — null
     whenever there are cards, so it can never be read as a warning. The client
     maps it to copy, with `mixed` backstopping an unknown value so a server that
     learns a new reason first degrades to something true.
     **Order is load-bearing in `emptyReasonFor()`:** `tmdb-unreachable` outranks
     everything because it is the only cause the user can neither see nor act on
     otherwise. The tally is also written into the log row's `raw_model_output`
     (jsonb, and nothing reads that column — checked against `routes/aiLog.js`),
     so an empty `suggested_titles` now records whose fault it was.
     Five tests, probed twice: collapsing `tmdbErrors` back into `unmatched`
     fails one, and hardcoding `all-owned` fails three.

   * **R27. DONE 2026-09-09 (D-048) — the rec-card entrance and exit.**
     (user-raised, 2026-09-09.) The entrance half already existed and was tuned
     rather than rebuilt: `.rec-card` now carries its own
     `animation: rec-enter 0.75s var(--ease) backwards`, and the stagger went from
     `i * 60ms` to `400ms + i * 120ms` — a lead-in plus the slower per-card step
     the user asked for. Its own keyframe, not the shared `fade-slide`, because
     10px of travel under a ~300px poster card is a twitch and tuning it must not
     move the ranked list.
     The exit did not exist at all — `replaceChildren()` dropped six cards in one
     frame — and is now `exitRecCards()`: `.is-leaving` on every grid child (the
     metadata footer included, since it describes the run being replaced), each
     removed on its own `animationend`.
     **Built as two CSS phases, NOT as a View Transition, and this entry used to
     say the opposite.** It read "Prefer the View Transition route: it is the
     mechanism this codebase already chose for exactly this problem." That was
     wrong: a View Transition animates ONE atomic old→new swap, and here the two
     halves are seconds apart on opposite sides of an AI call. Wrapping the gap
     would hold a frozen snapshot of the whole page for the length of the
     request, and it can express neither the stagger, the lead-in, nor the scroll
     between them. Corrected rather than preserved, because it was advice about
     what to do next, not a record of a past state. Full reasoning in D-048.
     **The reduced-motion trap that reasoning turned up:** that block sets
     `animation: none !important`, so no animation runs and `animationend` never
     fires — a listener-driven removal would have left the old cards on screen
     permanently for exactly the users least able to tolerate it.
     `exitRecCards()` checks the media query first and clears instantly.
     `html { scroll-behavior: auto }` was added to the same block, as this entry
     already required below.

     **The user's spec for (a), given 2026-09-09 after watching it run:**
     * **60ms per card is far too fast.** Lengthen the per-card stagger. Six cards
       is the hard maximum (`parseModelJson` does `.slice(0, 6)`), so the total is
       bounded: at 120ms it is lead-in + 5x120ms + the per-card duration, which
       came to about 1.3s as first estimated against a 200ms lead-in and a 0.5s
       card, and is **1.75s as shipped** — the lead-in was doubled to 400ms and
       the card duration raised to 0.75s.
       **Three separate dials, and the user has tuned each one by watching it:**
       `RECS_LEAD_IN_MS` (the beat before the first card), `RECS_STAGGER_MS`
       (the gap between cards) and the DURATION on `.rec-card`'s `animation`
       (how fast one card drops). The third is the one that gets misattributed —
       "the cards appear too fast" is almost never the stagger, which the user
       explicitly confirmed was fine while asking for this.
     * **Scroll the section into view**, because the cards land below the fold and
       the user has to scroll down mid-animation and misses most of it.
       `scrollIntoView({ block: 'start' })`.
     * **THE EXACT SEQUENCE, and it is not negotiable** (user, 2026-09-09):
       cards arrive → **scroll** → wait **~200ms** → **entrance animation**. In
       that order, all of it after the response has landed.
       The ORDER is the non-negotiable part, not the figure: the user doubled the
       beat to **400ms** after watching it, which is the value in
       `RECS_LEAD_IN_MS`. A side effect worth knowing before it is tuned again —
       at 400ms a browser's smooth scroll has typically finished before the first
       card moves, so the sequence now reads literally rather than overlapping.
     * **Gated on `suggestions.length`. Nothing else animates or scrolls.** The
       "No new suggestions this time…" line, the error line and every placeholder
       get no entrance animation and no scroll at all — the user's words: they
       "shall have no business with any entrance animation". Today that falls out
       for free (those paths append no cards), but the SCROLL must be gated
       explicitly, or a zero-result run would yank the page to a section with
       nothing new in it.

     **Four things already checked, so the implementation does not rediscover
     them:**
     * `html { scroll-behavior: smooth }` **already exists** (styles.css, near the
       top). So `scrollIntoView({ block: 'start' })` is smooth WITHOUT passing
       `behavior: 'smooth'` — and passing the CSS property is what makes the
       reduced-motion fix below expressible in CSS rather than in JS.
     * **Was REQUIRED and missing; ADDED with this item.** The
       `prefers-reduced-motion` block kills `animation` and `transition` only, so
       a motion-sensitive user would still have got a smoothly animated page
       scroll. `html { scroll-behavior: auto; }` is now in that block. It had
       been latent — nothing in the app scrolled programmatically and there are
       no in-page anchors — and went live the moment this feature landed.
     * **The scroll target is `.recs__head`** — the user's call, and it is the
       right one. It is the first child of `.recs`, so `block: 'start'` lands the
       heading AND the trigger at the top of the viewport, with the hint and then
       the animating grid flowing in below. `el.recsGrid` would have pushed both
       the heading and the "Based on: …" line off-screen. `.recs` itself resolves
       to nearly the same place, but only via margin-collapse reasoning
       (`.recs__head` carries `margin: 3rem 0 1.25rem` that collapses through the
       section) — `.recs__head` says it outright and cannot drift if the section
       ever gains padding or a border.
       `start` is also the robust ALIGNMENT here, independently: the content below
       the target grows as cards render, and top alignment is unaffected by growth
       below it, where `center` or `nearest` would drift mid-animation.
       `block: 'start'` pins the element's top flush to the viewport top with no
       breathing room, so `.recs__head` carries `scroll-margin-top: 1rem` — that
       property is exactly what `scrollIntoView` honours, unlike `margin`. It is
       the one dial if the landing ever reads too tight or too loose. Not a
       reopening of the R12 head split: the layout rules stay on the shared
       `.ranked__head, .recs__head` rule.
     * **Put the lead-in in `animationDelay`, not a `setTimeout`** — no timer to
       leak or cancel if a second run starts. This works only because the fill is
       `backwards`: during the delay each card holds the from-state (opacity 0,
       `translateY(10px)`). With any other fill it would sit fully visible through
       the lead-in and then jump. That is D-043's mechanism doing real work here —
       one more reason it must never go back to `both`.

     **Firing the scroll on CLICK was considered and REJECTED by the user** — do
     not revisit it. At click time the app knows none of the three things that
     make the scroll worth doing: how long the call will take, how many
     recommendations will come back, or whether it will succeed at all. Scrolling
     then would move the page for a run that is about to fail, or that returns
     nothing, or that leaves the user staring at a spinner for ten seconds in a
     newly-scrolled position. The scroll is a reward for a result, so it waits for
     one.

   * **R25. DONE 2026-09-09 — the "New verdict" button was effectively
     borderless** (user-raised, and correctly diagnosed by them). Settled over
     three rounds of the user looking at it; the hover fill landed at 0.25. `border: 1px solid var(--line)`
     measures **1.22** contrast on the banner's `--bg-raised` ground — a border
     that is not, in practice, drawn. R24 had just made the prose beside it
     brighter, so the button receded further.
     Three changes: the border is now `rgba(245, 193, 91, 0.3)` (**2.08**, and
     WARM, so it foreshadows the amber hover — chosen over `--line-strong` at 1.85
     for near-identical weight with more meaning); the label went `--ink-dim` →
     `--ink` (**6.80 → 16.26**), which is where most of the visibility comes from,
     because a control must not be quieter than the sentence beside it; and
     `font-size` 0.85 → 0.88rem, as the user suggested.
     **Deliberately still far short of `.recs__trigger`'s full amber border
     (11.05)** — the verdict is the lowest-stakes feature (SPEC §2.3), and the
     hierarchy between the two triggers is carried by COLOUR (neutral vs amber),
     not by intensity alone. Do not "finish the job" by making this one amber too.
     **Hover, revised by the user after seeing it:** the border lights to amber,
     the interior takes `background: rgba(0, 0, 0, 0.25)`, and a glow appears —
     `0 0 16px -4px rgba(245, 193, 91, 0.4)`. The LABEL deliberately does NOT
     change; it is already `--ink` at rest, so there is nowhere brighter to go,
     and amber text inside an amber border flattened the button into one colour.
     The glow is made of light, not black, and takes a ZERO Y-offset (D-044) —
     the user flagged the dark-theme trap in the request itself.
     **The translucent BLACK fill is not a contradiction of D-044, and the CSS
     says so at the declaration.** D-044 is about SHADOWS, which darken what lies
     BEHIND an element — and on a `#0b0b0f` page there is nothing left to darken.
     A background darkens the button's OWN interior, a real surface at
     `--bg-raised` (#14141b → about #0f0f14). There is something to darken, so
     black works here and light would not. Do not "correct" it to a light fill by
     analogy with the shadow rule.
     **`.search button:hover` DOES use an offset amber pool and that is not an
     inconsistency either:** it is a FILLED button reading as a lit object casting
     light downward, which is a different thing from an outline lighting up. Do
     not unify them.

   * **R26. DONE 2026-09-09 — `#recs-hint` is coloured by ROLE**, and the rule
     was revised the same day. The two sentences
     `syncRecommendationsAvailability()` writes — "Uses your top 5 rated films as
     taste signal…" and "Rate at least 3 movies to unlock…" — are `--ink-dim`.
     **As first built, the rule was "who wrote the line": a `.from-run` class
     paired with `state.recsHintFromRun`, so a run's messages were all
     `--ink-faint`. R28 disproved that** — the user looked at a zero-result run and
     pointed out that "No new suggestions this time…" is written by a run yet is
     persistent and is the ONLY thing the section shows, so it belongs with the
     availability sentences. Who wrote a line was a good proxy for the real
     question and not the same question.
     **The rule now in force:** does the line INTRODUCE content that is present or
     imminent, or is it the only thing on screen? `.recs__hint.is-caption`
     (`--ink-faint`) is set on exactly two messages, the busy line and
     "Based on: …"; everything else takes the base `--ink-dim` — both availability
     sentences, a failure, and all five zero-result variants.
     `setRecsHint(content, { caption })` is the single writer for the element's
     content and its weight; `.from-run` and `setRecsHintOwner()` are GONE.
     `state.recsHintFromRun` survives, meaning only what R1 made it mean — may the
     sync overwrite this?
     `.recs__hint.err` restates the base value on purpose: it is a pin, so an
     error can never become fine print whatever `.is-caption` is later applied to.
     R24's comment was corrected in the same pass: it claimed `--ink-dim` made the
     error brighter than the resting hint, true when written and not once the base
     moved.

   * **R24. DONE 2026-09-09 — the recs error line is `--ink-dim`, not
     `--crimson`** (user-raised, after seeing R9's link land inside it). Not taste — measured: the
     amber link was **2.48x brighter** than the crimson around it (relative
     luminance 0.583 vs 0.235), so the pointer to details shouted louder than the
     statement of what broke; and the two hues sit **36 degrees** apart, close
     enough to read as almost-the-same rather than as a deliberate pair, while
     contrasting only 2.22 against each other. Claude proposed instead making the
     link inherit the crimson with an underline; **the user chose recolouring the
     line, which is better** — it reuses the verdict banner's proven amber-on-grey
     rather than inventing a second link treatment. `.verdict__text.is-muted` moved
     `--ink-faint` → `--ink-dim` in the same pass. Note the verdict's muted state
     is now one step brighter than the other muted-italic absences
     (`.score-tmdb.is-muted`, `.no-review`), which stay `--ink-faint`: the shared
     vocabulary is muted + italic, not one exact token.

   * **R23. DONE 2026-09-09, on the user's instruction, the same day it was
     found.** The verdict's catch offered the AI call log for EVERY failure —
     including CineRank being unreachable, where the log cannot load either — and
     discarded `err.message`, so the real cause was thrown away. It now carries
     the same `userFacing`/`logged` treatment as the recommendations route, so the
     two features answer a failure identically instead of in two dialects.
     **The user's requirement was zero FALSE NEGATIVES: a `failed` row must never
     be written without the message advertising the log.** That holds by
     construction, not just by test — in both services `status = 'failed'` is
     assigned in exactly ONE place, and between the successful log insert and the
     `{ logged: true }` throw there is no other exit. The three no-row cases (DB
     read failed, threshold unmet, log write failed) correctly advertise nothing.
     Five tests cover it, written as a loop over BOTH features so they cannot
     drift again, and probed three ways: dropping either service's flag, or making
     the verdict route advertise unconditionally, all fail.
     **One residual false negative is unfixable and is not a bug:** if the HTTP
     response never reaches the browser, the row exists and the client cannot know.
     It shows the transport message instead.

   * **R29. DONE 2026-09-10 (D-051) — a card's size no longer depends on how many
     came back** (user-raised 2026-09-09, with a screenshot). One recommendation
     on a viewport wide enough for four rendered as a single full-width card with
     a poster taller than the window; two was the same fault, less dramatically.
     The tracks are `1fr` and `balancedColumns()` returned `min(count, fit)` when
     everything fitted on one row, so the count decided the width. That was
     backwards.
     **The user's rule, in their words: "I do not believe that a card's size
     should ever depend on how many cards returned. A better fix for the ugly
     unoccupied space in a row is to just center it all — and screw the spaces in
     the side edges: an evenly distributed space to the right of the row AND to
     the [left] of it looks far less hideous than having all that space in one
     side, trust me."** So: side margins are ACCEPTED, and the alignment
     objection Claude raised against this shape earlier (that the grid would sit
     narrower than the heading above it) is overruled. Do not re-litigate it.
     **As built.** `balancedColumns()` is now `balancedLayout()` and returns a
     WIDTH as well as a count. The width comes from `fit`, the widest packing the
     viewport allows; the count comes from the balancing. The grid is then capped
     to exactly the room that many cards need (`--rec-width`) with
     `margin-inline: auto` doing the centring.
     **Capping the CONTAINER rather than sizing each track is what kept this
     small** — the `1fr` tracks divide a width that is already correct, so D-050's
     doubled-track/half-column machinery is untouched, and when the balanced count
     equals what fits, `--rec-width` IS the container width and the two new
     declarations do nothing at all.
     **One trap, and it would have been silent:** `balancedLayout()` measures
     `grid.parentElement.clientWidth`, never the grid's own. The grid's width is
     what this function SETS, so reading it back would feed each answer into the
     next and ratchet the cards smaller on every resize frame.
     **This also settled the 4 + 2 versus 3 + 3 question, as free.** The only cost
     of 3 + 3 was that filling tracks made every card ~36% wider; with the width
     fixed by `fit` it is the same card and the same two rows as 4 + 2. So
     `balancedColumns()`'s deliberate `> 1` restraint (D-050) is GONE — it existed
     only to avoid growth that can no longer happen. Six cards where four fit now
     render 3 + 3.
     Verified by simulating every count from one to six across 288/500/700/812/
     1000px: the card width is now constant per viewport in every column, and no
     layout gained a row.
     **A CARD ALSO HAS A MAXIMUM WIDTH, and the reason is HEIGHT** (`--rec-max`,
     250px; user-raised the same day with screenshots either side of all three
     column boundaries). Decoupling width from the count was not enough on its
     own: the width still comes from `fit`, so every time one fewer column fits,
     the survivors inherit the space — and the poster is `aspect-ratio: 2/3`, so
     a pixel of width costs 1.5 of height. At one card per row that was a 390px
     card with a **585px poster on an 869px window**. Capped, the poster never
     exceeds 375px. Measured at the three boundaries the user photographed:
     4→3 columns 258px → 250px (the "slightly reduced" they asked for), 3→2
     291px → 250px, 2→1 390px → 250px. Wide layouts are untouched, because a
     four-column card is 237px and already under the cap.
     `--rec-min` and `--rec-max` together are the card's allowed width band, both
     in the stylesheet, both read by `balancedLayout()`. Capping only ever
     shrinks, so it can never let more cards fit and `fit` stays correct.
     **The `.ai-meta` footer MOVED OUT OF THE GRID — settled 2026-09-09 before
     building, done 2026-09-10.** It was a grid child spanning `1 / -1`, so a centred,
     narrower track list would shrink the footer and its dashed rule to match,
     and a single-card run would leave it one card wide. The user ruled out
     accepting that and left the choice between spanning it to the container and
     taking it out of the grid to Claude, guessing the second was less risky.
     It is, and the deciding fact is not obvious: **`grid-column: 1 / -1` spans
     the TRACK LIST, not the container.** With `justify-content: center` the free
     space sits OUTSIDE the tracks, so "span it to the container" is not a
     one-liner at all — it needs a flexible gutter track at each end
     (`1fr repeat(2k, …) 1fr`), which shifts every column index by one, adds two
     more gaps to the width arithmetic, breaks the half-column offset that
     centres a short last row, and puts an auto-placed card into a gutter unless
     every card is explicitly positioned. That is a lot of new machinery in
     exactly the place the user was worried about: six card counts times every
     viewport width.
     Out of the grid it is a plain block under it, full width, always, coupled to
     nothing. Give it a stable slot in `index.html` (the way `#recs-hint` and
     `#recs-grid` are stable) rather than appending it to `.recs` and querying it
     back — an empty slot has no border, padding or content, so it costs no
     layout.
     **All four follow-on edits landed, and they were the whole of the work:**
     (1) `renderRecommendations()` appended the footer in TWO places — the empty
     branch and the success branch — and both now write to `#recs-meta`.
     (2) `exitRecCards()` swept the grid's children, which used to include the
     footer for free; it now sweeps both the grid and the slot, and the
     `.is-leaving` rule is anchored on `.recs` rather than on the grid.
     (3) **The sneaky one, and it was real.** The spotlight dimmed the footer
     ONLY because it was a grid child — that is the whole of D-049's `> *`
     rather than `> .rec-card`. The `:has()` anchor moved up to `.recs` and the
     rule is now two selectors, scoped so the VERDICT banner's own `.ai-meta` is
     untouched. Without that the footer would have been left the single
     brightest thing on screen at the moment attention is meant to be on a card.
     (4) The grid's `gap` no longer separates the footer from the cards, so
     `.recs__meta .ai-meta` carries `margin-top: 1.1rem` — on the FOOTER, not on
     the slot, so an empty slot still contributes nothing.
   * **R30. DONE 2026-09-10 — the cards now close like a book, one by one**
     (user-raised 2026-09-09). `rec-leave` ended at
     `translateY(6px) scale(0.97)`, and the uniform `scale()` read as the card
     sliding SIDEWAYS rather than leaving — the user's word was "stuttering".
     Both halves of the ask landed: the exit is staggered in arrival order, and
     the shrink is gone.
     `rec-close` runs `scale(1, 1)` → `scale(0, 0.1)` from `transform-origin:
     left center`, so the card swings shut on a spine instead of collapsing
     inward from both edges, and collapses toward a horizontal line on the way —
     the user's call, tried at 0.5 first and taken further. Not to 0 on that
     axis: something still has to be visibly closing rather than already gone. The opacity runs straight from 1 to 0 across the whole duration,
     so the fade and the close happen together.
     **Both of those were revised the same day, and the reason is one finding.**
     The first version staggered by 55ms, eased on `--ease`, and held the opacity
     back to 72% until the 60% mark — and the user reported the cards were
     "exiting at the same time". The stagger was real. `--ease` is
     `cubic-bezier(0.22, 1, 0.36, 1)`, a strong ease-OUT built for arrivals: 40%
     of the way by t=0.1 and **67% by t=0.2**, so each card did its entire
     visible move in the first ~70ms of a 340ms animation and six cards 55ms
     apart flashed through inside a few hundred milliseconds. The stagger had
     nothing left to separate, and the opacity hold had nothing to overlap.
     Fixed on both axes: stagger 55ms → 120ms, and `--ease` → **`ease-in`** (2%
     at t=0.1, 32% at t=0.5), which is the right shape for a departure anyway —
     things accelerate away and decelerate in. **This is the one animation in the
     app that does not use `--ease`, and that is deliberate.**
     **`transform-origin` is scoped to `.is-leaving`, and that is load-bearing.**
     On `.rec-card` it would silently move the hover `scale(1.02)` off centre —
     and that effect exists in its current form precisely because growing from
     the middle opens the gaps on both sides equally, which is the whole finding
     of D-043's lift removal. One property, two effects, only one wanting an
     offset origin.
     **The trap that would have cost real time, found while building it:** every
     card is still carrying the INLINE `animationDelay` its ENTRANCE was given —
     up to 400 + 5x120 = 1000ms — and `animation-delay` is one property shared by
     whichever animation is running. Writing the exit's own delay is therefore
     not optional even at a zero stagger; without it the last card sits untouched
     for a second before starting to close, which looks like a hang rather than
     a bug.
     Timing: 0.34s per card, `RECS_EXIT_STAGGER_MS` 120ms, so six cards come to
     0.94s. That is the ceiling of the budget and it is fine: the exit only ever
     runs while a request is in flight, and an AI call is seconds. The stagger
     now matches the entrance's, which is NOT a reason to collapse the two into
     one constant — they should stay independently tunable, since the entrance is
     the half the user asked to be able to watch and the exit only has to be
     legible. The footer is a line of TEXT, not a card, so it
     gets a plain `rec-fade` with no delay rather than a book-close that would
     just squash the words.
     **THE EXIT REMOVES EVERY NODE TOGETHER, WHEN THE LAST ANIMATION ENDS — never
     one at a time as each finishes.** That was the first shape, and it is what
     the user then reported as "blinking/flashing". A `transform` does not affect
     layout, so a card mid-close still occupies its grid cell and nothing moves;
     REMOVING it does. The grid re-flows, every surviving card slides into the
     cell before it, and when the count crosses a row boundary the grid loses a
     row and everything below jumps a whole card height. With a stagger that
     happens five times in under a second. A screenshot taken mid-exit is what
     showed it: card 3 alone in the top row while 4, 5 and 6 sat a full row
     lower, every one of them at a different scale — the animation was fine, the
     layout underneath it would not hold still. Batching makes the exit
     layout-static from first frame to last.
     One `setTimeout` backstop came with the batching and is worth keeping: while
     each node removed itself, an animation that never ended stranded that node
     alone; now it would strand the whole set, since the count would never reach
     zero. It is not cancelled and does not need to be — `remove()` on a detached
     node is a no-op. `RECS_EXIT_MS` exists only so that backstop knows the
     duration, and **must stay in step with the `animation` on
     `.rec-card.is-leaving`**; both places say so.
     **What happens when a response beats the exit — analysed 2026-09-10, and
     deliberately NOT changed.** The exit starts on the click and takes 0.94s for
     six cards; the request runs concurrently. If it comes back sooner,
     `renderRecommendations()` opens with `el.recsGrid.replaceChildren()`, so the
     cards still closing are detached mid-animation. Traced rather than guessed:
     * **Nothing is corrupted.** `leaving` is a snapshot array, so the batched
       removal and its backstop can only ever touch the OLD nodes — a stale
       backstop firing after the new cards exist calls `remove()` on detached
       nodes, which is a no-op. A detached element's animation stops, so
       `pending` never reaches zero and the backstop is what cleans up. No leak.
     * **Only a fast SUCCESS cuts anything.** The catch branch never touches the
       grid (verified), so a failure — including a fast one like the
       below-threshold 422 — leaves the cards to finish closing properly.
     * **The cost is visual and it is real.** At a 400ms response the first two
       cards are 100% and 73% closed, but cards 4–6 have barely started and blink
       out at full size in a single frame.
     **Left alone on purpose.** The alternative is making the render wait for the
     exit, and that inverts R27's own priority — the scroll and the entrance are
     the reward for a RESULT, so delaying a result to finish an animation about
     the previous one is the wrong trade. It also puts an await in front of the
     `finally` that restores the busy button. In production this is close to
     unreachable: the run is an AI call plus six TMDB verifications, seconds not
     milliseconds. It IS trivially reproducible with `debugRecs(6, { delayMs:
     300 })`, so if it is ever seen it will be seen there first, and this
     paragraph is why it is not a bug report.
     Also fixed in passing: the reduced-motion branch of `exitRecCards()` cleared
     the grid but not `#recs-meta`, so a motion-sensitive user kept the previous
     run's metadata footer on screen. That gap arrived with R29 an hour earlier.

   **Already done in this section, do NOT redo:** `.rec-card__body` carries
   `min-width: 0` + `overflow-wrap: anywhere` (D-045), the entrance animation fill
   was corrected `both` → `backwards` (D-043) and must STAY that way now that a
   hover transform (R14) and a delayed entrance (R27) both depend on it,
   `.rec-card__body button:hover`
   gained its missing `:not(:disabled)` guard (#10), the poster placeholder is the
   shared inline-SVG `.noposter` (D-027), and `.reason` clamps at 5 lines.

3. **Add GitHub link(s)** to the page — out to the public repo.

4. **Then discuss the favicon gap.** Its own step, after the link, at the user's
   request. State verified 2026-09-08: there is **no `<link rel="icon">` in
   `index.html`, no icon file in `public/`, and no server-side favicon route**,
   so every browser auto-requests `/favicon.ico`, misses the static middleware
   and lands on the 404 handler. That is the lone console error on a clean load,
   and it appears on the LIVE site too. Cosmetic, not a bug — discuss before
   building.

4b. **Three visual-polish items on the verdict banner and the logo** (user-raised
   2026-09-10). Slotted here, and NUMBERED 4b RATHER THAN 5 ON PURPOSE: the
   user asked for these "after the recs overhaul, before the narrow-portrait
   overhaul", and renumbering would silently break every reference to "step 5",
   including the enforcement rules in the memory file
   `recs-overhaul-known-issues.md`. Step 5 stays the portrait overhaul.

   * **A typing effect on the verdict as it appears**, like early ChatGPT.
     Read D-040's single-writer lesson before starting: `.verdict__text` is
     written by `syncVerdictAvailability()` (placeholders, threshold text) AND by
     a run, so a typewriter that animates into the same element needs to lose
     cleanly when the sync takes the element back mid-type — the exact shape of
     bug R1 was. Also: the element is `aria-live="polite"`, so typing it one
     character at a time would announce it one character at a time; set the final
     text for assistive tech and animate the visible layer, or the accessibility
     work already done here is undone. `prefers-reduced-motion` must skip it.
   * **The verdict banner's amber/crimson border should drift slowly.** Currently
     a static gradient border. Note the banner already carries a
     `view-transition-name`-free static treatment; an animated gradient usually
     means animating a `background-position` on a `border-image` or a masked
     pseudo-element, since `border-color` cannot hold a gradient. Keep it SLOW —
     this sits near the top of the page on every load, and D-044's rule about
     amber not becoming a hard-edged focus-ring lookalike still applies.
   * **Does the logo circle actually spin? — ANSWERED 2026-09-11, no
     investigation needed.** Yes, `animation: spin 8s linear infinite` is on
     `.mark__reel` and runs. It is invisible because **every part of it that you
     can see is rotationally symmetric**: the 3px amber border ring, and a
     `radial-gradient` that draws a concentric amber ring. The one asymmetric
     feature is a `conic-gradient` wedge covering the first 20% of the circle —
     and it is painted in `var(--bg)`, the page's own background colour, so it
     is invisible against the page behind it. The fix is not to the animation; it
     is to give that wedge a colour that differs from the page (a film-reel notch
     needs to be visible to read as one). Cheap, and it is the whole of this item.

5. **Complete overhaul of the portrait view under 500px.**
   **Plan and test against ~350px.** That is the target, not the floor.
   **THE TWO RULES BELOW ARE CLAUDE'S TO ENFORCE, NOT THE USER'S TO REMEMBER.**
   The user asked to be stopped, in advance, because the deadline is close:
   * **Below ~350px: "good enough" only.** Actively talk the user out of tuning
     these widths. The exceptions are narrow and specific — a fix that is safe,
     straightforward and quick, or a case where the ~350px layout is itself
     borderline and the narrow view is evidence of that. Anything else: say so
     and move on.
   * **Below ~290px: IGNORE COMPLETELY.** Do not investigate, do not measure, do
     not fix, and **stop the user if they start**. This is not a judgement call
     to re-litigate each time — it is a standing instruction, given deliberately
     with the submission deadline in view.

6. **All remaining documented pre-submission blockers**, plus the leftovers in
   Open issues.

**Note on numbering:** there is a step **4b** between 4 and 5. It was inserted
rather than renumbered because "step 5" is referenced by name outside this file —
including the two enforcement rules a memory file points at — and a silent
renumber would send a future session to the wrong list.

### Open issues / TODO
(Submission-readiness gaps are consolidated under **Pre-submission blockers**
below — this list is the smaller stuff.)
* [x] Migration 001 applied.
* [x] **Migration 002 (`tmdb_rating`) applied 2026-09-08, backfill run.** It was
  a prerequisite rather than a follow-up: until the column existed PostgREST
  rejected the insert with PGRST204 and adding any film failed. A nullable
  column is backward compatible with the code on `main`, so applying it early
  was safe for the live site.
* [x] **Migration 003 (`tmdb_rating = 0` → NULL) applied 2026-09-08.** TMDB
  reports `vote_average: 0` for a title nobody has voted on, so 002 + the
  backfill wrote a literal 0 for those and the card read "TMDB 0.0", i.e. worst
  film imaginable (D-037). `shapeMovie()` now nulls it at the source so no NEW
  row can get one; 003 fixed the rows already written.
  **Both are applied to the single live Supabase project, which is the same
  database the deployed app uses — there is no separate prod DB to migrate at
  release time.**
* [x] **Migration 004 (`review_requires_rating`) applied 2026-09-08.** A `check`
  constraint forbidding a review on an unrated film (#15, D-041) — the rating is
  the required part, the review the optional one, and until now only the UI knew
  that. A pre-check confirmed **zero** existing rows violated it before it went
  on. Adding it to a live DB is safe in a way 002 was not: it forbids a state
  nothing in the app produces, so no code path on `main` can start failing.
* [x] Tests: pure helpers, prompt loader, route validation, duplicate handling,
  TMDB/OpenRouter-down resilience, and the `tmdb_rating` and
  `review_requires_rating` guards all covered by `npm test` (53).
* [x] `/api/recommendations/history` vs `/api/ai-log` — decided to keep both
  (D-017): `/api/ai-log` is the primary audit surface, `/history` stays as the
  narrower per-feature JSON view per SPEC §4.5. Post-submission cleanup candidate.
* [x] **Recommendations swallow every message they write — FIXED 2026-09-09 (R1).**
  This checkbox is the tracker; the description lives in step 2's sub-backlog
  under **R1**, which is the entry being worked from. **The 2026-09-08 wording
  here understated it and is corrected rather than preserved, because it was
  wrong when written:** it said only the ERROR is wiped. The `finally` reassigns
  `#recs-hint` unconditionally, so the SUCCESS line (`Based on: …`) and the
  zero-result line are wiped by the same statement — a failed run, a successful
  run and a never-run page all look alike. The server side is correct and tested
  (422 + a `status='failed'` log row); this is purely the UI half of SPEC §7.1,
  and it would show up badly in the resilience screenshots.
* [x] **Apostrophe consistency across ALL user-facing copy — done 2026-09-08.**
  The client's three offenders went with #16(c); the four server-side ones (the
  two TMDB 502s, the PATCH 404, the recommendations 422) followed in their own
  commit, together with the one test assertion that quotes a message verbatim —
  which is why it was a separate change rather than folded into #16(c). Every
  user-facing contraction in `server/`, `public/app.js` and `public/index.html`
  now uses the curly `’`. Code COMMENTS deliberately still use straight ones;
  they are not UI copy.
* [x] **`--ink-faint` sits below WCAG AA deliberately — do NOT "fix" it** (D-052,
  2026-09-10). Settled at #7b766e (from #6b6760), which lifts it to 4.36:1 on the
  page and 3.87:1 on a card — both still short of 4.5. The AA-clearing value was
  built first (#868178) and sits too close to `--ink-dim`: what decides whether
  two type tiers read as two tiers is their contrast with EACH OTHER, and
  clearing AA cost nearly a third of it (2.09 → 1.44). This keeps 1.67.
  The mitigation is that R26 and D-051 moved every line that is the ONLY thing on
  its surface up to `--ink-dim` (7.28:1); what is left on faint always sits
  beside content that carries the meaning. A contrast audit will flag this. It is
  a decision, not an oversight.
  **One process note from the same exchange, in D-052:** the token and one of its
  consumers (the empty-list line, moved to `--ink-dim`) changed in the SAME
  commit, which destroyed the obvious way to eyeball the token and produced a
  confident false report that the two tiers were identical. When a token and one
  of its consumers move together, say what is left to compare against.
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
     demos the "show more" toggle + injection-safe handling.
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
* [ ] **Resilience & state screenshots — the visual evidence for SPEC §7.1, still
  missing.** Server behaviour is covered by `npm test`; these are the *pictures*.
  Put them in `docs/`.
  **Every state has a stable `RS-n` marker, so `grep "RS-" CLAUDE.md` returns the
  whole set and each line is self-contained enough to shoot from without reading
  the history.** Add new ones with the next free number and never renumber.
  **Tick each `RS-n` as it is captured** — the parent checkbox is done only when
  all nine are.
  **TMDB and OpenRouter are called SERVER-side**, so DevTools offline mode and
  request blocking do NOT simulate them. Forcing means editing `.env` and
  restarting, except where noted.
  **The ranked list must still be working in every shot except RS-7** — that is
  the point of most of them: one thing broke, the app did not.

  - [ ] **RS-1 · TMDB down on search.** Bogus `TMDB_API_KEY`, restart, search
    anything. Expect the crimson note inside the results panel:
    "Couldn’t reach the movie database. Try again in a moment."
  - [ ] **RS-2 · TMDB down on add.** **Order matters and is not obvious:** search
    FIRST with a good key so rows render, THEN swap in a bogus key, restart, and
    click Add on the rows still on screen. There is no other way in — with TMDB
    down, search itself fails and there is nothing to click. This works only
    because the results panel is persistent rather than a dropdown (D-024).
    Expect the toast: "Couldn’t add “<Title>” — TMDB is unreachable."
  - [ ] **RS-3 · TMDB unreachable DURING a recommendation run** (added by R28).
    Bogus `TMDB_API_KEY`, restart, 3+ rated films, click Get recommendations.
    Distinct from RS-1 and RS-2, and the most interesting of the set: **the AI
    call succeeds and is charged while the run still produces nothing.** Expect
    the hint "Couldn’t check any of the suggestions — the movie database is
    unreachable. Try again in a moment.", the metadata footer showing the real
    cost, and — in the AI call log — a green `success` row whose
    `suggested_titles` is empty. Before R28 this state claimed the model had only
    named films already in the list. Costs one real OpenRouter call.
  - [ ] **RS-4 · OpenRouter down on recommendations.** Bogus
    `OPENROUTER_API_KEY`, restart, 3+ rated films, click Get recommendations.
    Expect "Couldn’t generate recommendations right now. See the AI call log for
    details.", with **AI call log** as an amber link, and a red `failed` row in
    the log whose `error_text` names the real cause (e.g. `OpenRouter responded
    401`). The split is the point: calm sentence to the user, technical cause to
    the audit trail (R8/R9, D-047).
  - [ ] **RS-5 · OpenRouter down on the verdict.** Same key, 2+ rated films,
    click New verdict. Expect "Couldn’t come up with a verdict right now. See the
    AI call log for details." Shoot it beside RS-4 if possible — the two features
    answering identically is what R23 was for.
  - [ ] **RS-6 · CineRank itself unreachable.** **Load the page first, THEN stop
    `npm start`**, then search. Stopping the server first means the document never
    loads and there is no UI to photograph — this cost time once already. Expect
    "Couldn’t reach CineRank. Check your connection and try again." The ranked
    list keeps showing whatever it loaded before the server went away.
  - [ ] **RS-7 · Database unreachable.** Bogus `SUPABASE_URL` /
    `SUPABASE_ANON_KEY`, restart, reload. Expect the toast "Couldn’t load your
    movies — Something went wrong."
    **This is the ONE shot where the ranked list is legitimately empty** — it is
    the thing that broke — so it does not belong in the set above.
    Worth knowing why it earns a slot: finding this state is what caught the
    central 500 handler claiming a failure was "on our side" when it was neither
    a bug nor the server's fault.
  - [ ] **RS-8 · The non-error empty state.** Everything working; search a
    nonsense string. Expect the MUTED note (not crimson): "No matches for
    “<query>”. Check the spelling, or try a different title." One shot, purely to
    show that an empty result and a failure are visibly different — which is the
    whole of D-033's argument, applied in Search.
  - [ ] **RS-9 · A recommendation run that returns nothing.** Not a failure, and
    included deliberately: it is the clearest single frame proving the app reports
    an AI call it paid for even when that call yielded no cards — SPEC §7.2 "not a
    wrapper" evidence rather than §7.1 resilience.
    **The only one of the nine that needs a temporary code change**, because the
    state cannot be forced from `.env`. In `generateRecommendations()`, make every
    verified film look owned:
    `if (true || ownedTmdbIds.has(movie.tmdb_id)) { tally.owned += 1; continue; }`
    Expect "No new suggestions this time — the model only named films already in
    your list.", the metadata footer with its real cost and log link, and a
    `success` row in the log with empty `suggested_titles`.
    **Revert with `git checkout -- server/services/recommendations.js` the moment
    the shot is taken.** Four route tests fail while it is in place, which is
    expected and is not a reason to debug anything.
* [ ] **Prompt-injection screenshot** — a demo movie whose review is an injection
  attempt, showing the verdict + recs staying on-topic (Module 17 evidence).
* [ ] **README screenshots + architecture diagram** — currently text-only.
* [ ] **Joint-project registration** — email `mail+ASE26003@mgorsky.net` (both
  names) and both add cross-referencing comments to the project sheet.
* [ ] **Unload the recommendations debug harness.** Delete TWO lines and nothing
  else: the `<script src="/debug-recs.js">` tag at the bottom of
  `public/index.html`, and the `app.get('/debug-recs.js', …)` route in
  `server/index.js`. **`scripts/debug-recs.js` itself STAYS** — it is a real dev
  tool and still works by pasting it into the console, which is how it was
  written. Added 2026-09-09 at the user's request as a temporary but open-ended
  convenience while the recommendations UI is being worked; the user asked for
  the loading to be removed when that work is done, not the file.
  Both lines are commented as temporary and both name this checkbox. Low risk if
  missed — the harness declines to install on the `onrender.com` host — but a
  debug tool wired into a submitted build is its own kind of wrong.
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
* **External API #2 (AI):** OpenRouter, using the existing account/`.env` key.
  **Two models, on purpose (D-053):** recommendations run on the cheap
  `anthropic/claude-haiku-4.5`, the taste verdict alone on
  `anthropic/claude-sonnet-5` — four prompt versions could not get the cheap tier
  to write in a plain spoken register, and the model turned out to be the
  constraint rather than the wording. `chat()` takes an optional `model`
  defaulting to the app-wide one; `tasteVerdict.js` is the only caller that
  overrides it. Overridable per feature via `OPENROUTER_MODEL` and
  `OPENROUTER_VERDICT_MODEL`. Keep these calls isolated in their own modules (e.g. `services/recommendations.js` and `services/tasteVerdict.js`) so either can be mocked/stripped without touching core movie CRUD logic.

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

### Button labels and line breaks (the user's rule, 2026-09-09)

**A glyph is not a word.** A checkmark, a plus, a spinner and the like must NEVER
be separated from the word they belong to — a two-line `+ Add` or `✓ Added` is
unacceptable at **any** viewport width, however narrow.

**Real words may wrap on spaces** in exceptionally narrow viewports (roughly
under 400px) and the user does not mind. `In your list` breaking across two lines
is fine; `✓` on one line and `Added` on the next is not.

**How it is enforced:** the glyph is glued to its word with a non-breaking space
**in the string itself**, written as a ` ` escape, never as a literal
character. In the string and not in CSS because the same labels are rendered on
two surfaces — the search row and the recommendation card — and only one of them
has `white-space: nowrap`. A guard that travels with the text cannot be missed by
a stylesheet that was never updated. `busyButton()` does the same for every
spinner label in one line, since every busy label in the app is built there.

**One standing exception:** `Get recommendations` is out of scope for this rule
by the user's instruction — it is parked for the recommendations overhaul. Its
BUSY label is nonetheless covered, because that comes from the shared
`busyButton()`; only its resting label is exempt.

**And one case the in-string technique cannot cover at all** (found by R15, which
put a sparkle icon on that same trigger): an ICON is an element, not a character,
so no string can glue it to the words beside it. `white-space: nowrap` on the
button is the only mechanism available, which is why that declaration on
`.recs__trigger` is load-bearing for two independent reasons — R11's label break
and R15's glyph. The same applies to any future icon button: reach for nowrap,
not for a non-breaking space, and do not assume an unrelated cleanup can remove
it.

\---

## Prompt Versioning \& AI Call Discipline

* Prompt files live under `prompts/`, named `recommend\_v1.md`, `taste\_verdict\_v1.md`, etc. — never overwrite an existing version; bump the version number when a prompt's logic changes. The two features are versioned independently of each other. **Current:** recommendations use `recommend\_v3` (second-person, 8–16-word reason); taste verdict uses `taste\_verdict\_v7` (2–3 sentences, ~35–60 words, characterising the viewer — not reciting ratings — in plain spoken English). The active version string is a single `PROMPT\_VERSION` const at the top of each service module.
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

