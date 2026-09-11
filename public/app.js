// CineRank frontend. Vanilla ES module (SPEC § 4.1).
// Security: all user-supplied / model-supplied text is written via textContent or
// createTextNode — never innerHTML — so a review or verdict can't inject markup
// (CLAUDE.md § Security & Secrets #4). The taste verdict is plain text by design.

const $ = (sel) => document.querySelector(sel);

const el = {
  verdict: $('#verdict'),
  verdictText: $('#verdict-text'),
  verdictRefresh: $('#verdict-refresh'),
  searchForm: $('#search-form'),
  searchInput: $('#search-input'),
  searchResults: $('#search-results'),
  searchBtn: $('#search-btn'),
  rankedList: $('#ranked-list'),
  rankedCount: $('#ranked-count'),
  rankedEmpty: $('#ranked-empty'),
  recsTrigger: $('#recs-trigger'),
  recsHint: $('#recs-hint'),
  recsGrid: $('#recs-grid'),
  recsHead: $('#recs-head'), // R27's scroll target — see renderRecommendations
  recsMeta: $('#recs-meta'), // the AI meta footer's slot, outside the grid (R29)
  rateDialog: $('#rate-dialog'),
  rateForm: $('#rate-form'),
  rateTitle: $('#rate-title'),
  rateRange: $('#rate-range'),
  rateOutput: $('#rate-output'),
  rateReview: $('#rate-review'),
  rateCancel: $('#rate-cancel'),
  rateSave: $('#rate-save'),
  rateError: $('#rate-error'),
  confirmDialog: $('#confirm-dialog'),
  confirmTitle: $('#confirm-title'),
  confirmBody: $('#confirm-body'),
  confirmOk: $('#confirm-ok'),
  openLog: $('#open-log'),
  logDialog: $('#log-dialog'),
  logClose: $('#log-close'),
  logBody: $('#log-body'),
  logFoot: $('#log-foot'),
  toast: $('#toast'),
  noposterIcon: $('#noposter-icon'),
};

const state = {
  movies: [],
  cfg: { minRatedForRecommendations: 3, minRatedForVerdict: 2, topN: 5 },
  ownedTmdbIds: new Set(),
  // Which reviews the user has expanded, by movie id (backlog #14). It lives
  // here and NOT in the DOM because renderRanked() rebuilds every card on every
  // render, and a class on a <p> cannot outlive that <p> — so expanding one
  // review and then rating a DIFFERENT film silently collapsed it again.
  // Lifting the state out is the fix; keeping the elements alive instead is the
  // element-reuse rewrite D-031 rejected, and it stays rejected (D-040).
  // Session-only by choice: a reading state is not worth persisting to storage.
  expandedReviews: new Set(),
  editing: null,
  editingIsNew: false, // the rate dialog is for a film added seconds ago
  // Does #recs-hint currently belong to a RUN (busy / "Based on:" / no-picks /
  // error) rather than to the availability sync? Without this,
  // syncRecommendationsAvailability() reassigned that element unconditionally
  // and wiped every one of those in the same tick they were written — the run's
  // own `finally` calls the sync (backlog R1). The verdict solves the identical
  // problem with `el.verdict.dataset.generated`; this is the same guard, kept on
  // `state` because the hint is one long-lived element with two owners, not a
  // node that gets rebuilt.
  recsHintFromRun: false,
};

/* ---------- helpers ------------------------------------------------------- */
async function api(path, options) {
  let res;
  try {
    res = await fetch(path, options);
  } catch {
    // fetch only rejects on a network-level failure — server down, DNS, or the
    // browser offline. Its message is engine-specific ("Failed to fetch" in
    // Chromium, "NetworkError when attempting to fetch resource" in Firefox)
    // and reads like a stack trace, so it never reaches the UI. An HTTP error
    // response is a different thing and keeps the server's own wording below.
    const err = new Error('Couldn’t reach CineRank. Check your connection and try again.');
    // A COMPOSABLE form of the same fact, for the sinks that put a context in
    // front of it — see failureText(). The long form above is a complete
    // sentence with its own subject AND its own advice, so prefixing it produced
    // "Couldn’t load the log: Couldn’t reach CineRank. Check your connection…":
    // two subjects and two "couldn’t"s for one failure.
    err.short = 'CineRank is unreachable';
    throw err;
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || `Request failed (${res.status})`);
    // Optional and absent from nearly every response: a route sends `short` only
    // when its own message is too self-contained to sit after a context prefix.
    // Purely additive — an endpoint that omits it behaves exactly as before,
    // because failureText() falls back to the full message.
    if (body.short) err.short = body.short;
    // Same shape, same reasons: optional, additive, and absent from nearly every
    // response. It says a failure of ours was written to an AI log table, so a UI
    // may offer the log without promising a row that does not exist (R9).
    if (body.logged) err.logged = true;
    throw err;
  }
  return body;
}

/**
 * Compose a failure message: what the user was trying to do, then why it failed.
 *
 * Backlog #16(c). The two action toasts used to show the cause ALONE, so a failed
 * add or remove named no film — with three cards on screen, nothing said which
 * one had not been removed. The obvious fix, pasting the context in front of
 * whatever came back, breaks on causes that are already complete sentences:
 * "Couldn’t load the log: Couldn’t reach CineRank. Check your connection and try
 * again." That is not unpredictability to be defended against — there are two
 * kinds of message here and the client knows which it has. It either fabricated
 * the cause itself (api()'s transport failure) or the server told it, so the
 * short form is attached at the source and this only has to prefer it.
 *
 * A cause with no `short` is passed through whole, which is right for the terse
 * ones: "Couldn’t remove “Dune” — Something went wrong." reads correctly,
 * because that message says nothing about WHAT failed and the context is the
 * only specific thing in the sentence.
 *
 * Used by every sink that adds a context, so the rule cannot be applied four
 * different ways — the same reason busyButton() and displayedRanking() exist.
 * Sinks that are already surrounded by their own context (the search note, the
 * verdict banner, the rate dialog's inline error) deliberately do NOT use this:
 * there the operation is obvious from where the message appears.
 */
function failureText(context, err) {
  const cause = err.short ?? err.message;
  // Terminal punctuation is normalised HERE rather than trusted from the cause.
  // The causes are inconsistent and most of them are not ours to edit: the 409
  // reads "Already in your list" with no stop, the 500 reads "Something went
  // wrong." with one. Left alone, the same toast would end with a full stop or
  // without one depending on which failure produced it — the exact defect the
  // verdict's missing "for details." was.
  return `${context} — ${/[.!?…]$/.test(cause) ? cause : `${cause}.`}`;
}

let toastTimer;
function toast(message, isError = false) {
  el.toast.textContent = message;
  el.toast.hidden = false;
  el.toast.classList.toggle('err', isError);
  requestAnimationFrame(() => el.toast.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.toast.classList.remove('show');
    setTimeout(() => (el.toast.hidden = true), 300);
  }, 3200);
}

/**
 * How many ranked posters load eagerly (backlog #17).
 *
 * A JUDGEMENT CALL, not a measurement, and it must not be re-derived as one:
 * there is nothing here to solve against the way D-030's numeral width was.
 * A desktop fold fits roughly three or four cards below the header and search
 * box; card mode fits fewer, but its posters are 68px rather than 92px and cost
 * proportionally less. Three is inside the fold at every width, and the cost of
 * being wrong is at most one image request that was not needed yet.
 *
 * Do NOT replace this with a measured fold. That means reading layout during the
 * render — the very thing syncReviewToggles() is structured in three batched
 * passes to avoid — to save a single request.
 */
const EAGER_POSTERS = 3;

/**
 * `eager` is opt-IN, so the two callers that render only after a click (search
 * rows, recommendation cards) keep `lazy` without being touched: neither is ever
 * part of the first paint, which is the only place the distinction matters.
 */
/**
 * The AI sparkle, cloned from its `<template>` (see index.html).
 *
 * Cloned rather than written into each button, because it now appears on BOTH
 * AI triggers and two copies of a generated path is the shape that gets
 * regenerated in one place and not the other. Same reason `.noposter` is a
 * template — and the same reason `<use href>`, the usual sprite answer, is not
 * used here: `<use>` puts its content in a shadow tree that document CSS cannot
 * select into, and only the LARGE star is meant to twinkle. A clone is real DOM,
 * so `.sparkle-major` still matches.
 */
function sparkleNode() {
  return $('#ai-sparkle').content.firstElementChild.cloneNode(true);
}

function posterNode(url, title, { eager = false } = {}) {
  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = `${title} — poster`;
    // `lazy` defers the request until the browser knows the image is near the
    // viewport, which it cannot know before layout — so a poster that is ALREADY
    // on screen at first paint is delayed for nothing. These images are built in
    // JS after /api/movies returns, so the preload scanner was never going to
    // see them either way; the win is a layout pass on the first few cards, not
    // a dramatic one. It is worth having because the poster is this design's
    // primary visual anchor (CLAUDE.md § Frontend Design Notes) and the top of
    // the ranked list is what a reader looks at first.
    img.loading = eager ? 'eager' : 'lazy';
    return img;
  }
  const ph = document.createElement('div');
  ph.className = 'noposter';
  ph.setAttribute('role', 'img');
  ph.setAttribute('aria-label', `${title} — no poster available`);
  // Cloned from the <template> in index.html rather than built here: SVG needs
  // createElementNS to produce real elements, and the icon reads better as
  // markup next to the page's other two (D-027).
  ph.append(el.noposterIcon.content.cloneNode(true));
  return ph;
}

function spinnerNode() {
  const s = document.createElement('span');
  s.className = 'spinner';
  s.setAttribute('aria-hidden', 'true');
  return s;
}

/**
 * Put an AI trigger button into its "Thinking…" state; returns a restore fn.
 * Shared by both triggers so their busy behaviour can't drift apart.
 */
function busyButton(btn, busyLabel = 'Thinking…') {
  const label = [...btn.childNodes]; // keep the nodes — a label may be wrapped in a <span>
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  // Lock the current width first: the busy label is usually shorter, so without
  // this the button visibly shrinks. Measured rather than a hardcoded min-width,
  // so it follows the label, font and padding automatically.
  // (`* { box-sizing: border-box }` means min-width and rect.width agree.)
  btn.style.minWidth = `${btn.getBoundingClientRect().width}px`;
  // The label goes in a span rather than a bare text node so a narrow
  // breakpoint can hide it and leave the spinner standing alone (see the
  // icon-only Search button under 500px).
  const busy = document.createElement('span');
  busy.className = 'busy-label';
  // NON-BREAKING space, so the spinner can never be orphaned from its word.
  // A spinner, a checkmark and a plus are GLYPHS, not words: a label may wrap
  // between real words on a narrow screen, but "⟳ / Adding…" split across two
  // lines is never acceptable. Done here rather than per button because every
  // busy label in the app is built by this one line.
  busy.textContent = '\u00A0' + busyLabel;
  btn.replaceChildren(spinnerNode(), busy);
  // Ends the busy state. With no argument the button goes back exactly as it
  // was, enabled. Pass text to settle on a new label instead and stay disabled —
  // for an action that cannot be repeated ("✓ Added", "In your list").
  return (settledLabel) => {
    btn.removeAttribute('aria-busy');
    btn.style.minWidth = '';
    if (settledLabel === undefined) {
      btn.disabled = false;
      btn.replaceChildren(...label);
    } else {
      btn.replaceChildren(document.createTextNode(settledLabel));
    }
  };
}

const ratedCount = () => state.movies.filter((m) => m.rating != null).length;

/**
 * The subtitle beside "Your ranking": the film count always, the outstanding
 * work only when there is any.
 *
 * It used to be `N films · N rated` (backlog #16). Three things were wrong with
 * that. It restated the first number in the app's STEADY state — once everything
 * is rated, "5 films · 5 rated" is one fact wearing two hats — so it was longest
 * exactly when it had least to say. It made the reader subtract to reach the one
 * actionable fact, how many still need rating. And the `·` joined a set to its
 * own SUBSET, where every other use of that separator in this app joins peer
 * facts (`2023 · TMDB 7.2` in a search row, the AI meta footer, `Total · 3
 * calls`) — which is why "5 films · 3 rated" reads as two tallies rather than
 * "3 of the 5".
 *
 * Silence is the "all rated" signal. The clause exists to flag outstanding work,
 * so nothing outstanding means nothing to say; unrated cards carry their own
 * "Not rated yet" chip, so the fact is still on screen.
 *
 * `none rated yet` and not `N not rated yet` when nothing is rated at all —
 * otherwise both numbers are equal again and the doubling is back. That branch
 * is also what settled the wording against the shorter "N unrated", which reads
 * better after a numeral but would need a SECOND vocabulary here, since
 * "5 unrated" is the doubling this exists to remove. One phrasing covers both
 * cases, and "yet" keeps the pending sense D-033 built the chip around.
 */
function rankedCountLabel(count, rated) {
  const films = `${count} film${count === 1 ? '' : 's'}`;
  const unrated = count - rated;
  if (unrated === 0) return films;
  if (unrated === count) return `${films} · none rated yet`;
  return `${films} · ${unrated} not rated yet`;
}

/**
 * The ranking AS DISPLAYED: for every film, the number its card shows (null
 * when unrated) and whether it shares that number with another film.
 *
 * ONE function, used by both renderRanked() and rankSignature(), because the
 * two must never disagree about what "the ranking" is — and they did. This
 * logic lived only in the renderer, so the detector had to approximate it, and
 * the approximation was wrong in a way nobody would guess: see rankSignature().
 *
 * Competition ranking (1, 2, 2, 4). `position` is where a film sits and always
 * increments; `shown` repeats across a tie, then jumps to the next position.
 * Deliberately NOT the array index — only a rated film has a rank, so an
 * unrated one must not consume a number (D-029).
 *
 * `shared` is counted up front rather than by peeking at neighbours: adjacency
 * would also work (the list arrives sorted by rating) but would have to
 * special-case the first and last film. Keyed by the rating NUMBER — the column
 * is numeric(3,1), so 8.0 and 8.0 are exactly equal and 8.0 vs 8.1 are exactly
 * not.
 */
function displayedRanking(movies) {
  const shared = new Map();
  for (const m of movies) {
    if (m.rating == null) continue;
    shared.set(m.rating, (shared.get(m.rating) ?? 0) + 1);
  }
  let position = 0;
  let shown = 0;
  let prevRating = null;
  return movies.map((m) => {
    if (m.rating == null) return { id: m.id, rank: null, tied: false };
    position++;
    if (m.rating !== prevRating) shown = position;
    prevRating = m.rating;
    return { id: m.id, rank: shown, tied: shared.get(m.rating) > 1 };
  });
}

/**
 * A fingerprint of the ranking as displayed, for telling a save that changed
 * the ranking from one that did not.
 *
 * Built from displayedRanking() rather than from the raw list, because
 * "the ranking changed" is not the same as "the order changed", and the two
 * come apart in at least three ways:
 *
 *  - Rate the only unrated film and it may keep its POSITION (unrated films
 *    already sort last, so a low rating can leave it exactly where it was)
 *    while its slot changes from "?" to a number.
 *  - Break a tie for first place by lowering the LOWER-placed of the two, and
 *    nothing moves at all — it was already drawn second — yet it goes from
 *    "1 tied" to "2". This one shipped broken: the signature was id + rated,
 *    so it saw no change and the toast said only "saved".
 *  - A tie forming or dissolving changes the caption without changing the
 *    number.
 *
 * Hence id + displayed rank + tie state: literally what the card shows.
 * Compared as a string rather than element-by-element — the array is small, and
 * one !== is harder to get subtly wrong than a hand-rolled loop.
 */
const rankSignature = () =>
  displayedRanking(state.movies)
    .map((r) => `${r.id}:${r.rank ?? '?'}:${r.tied}`)
    .join('|');

/**
 * Run a DOM update inside a View Transition, so a re-sorted list animates to
 * its new order instead of teleporting.
 *
 * The API snapshots the WHOLE document before and after `update()` and morphs
 * between the two. It cannot be scoped to one section — so the discipline is on
 * the caller: put ONLY the thing that should animate inside `update()`, and let
 * everything else already be settled before this is called. Anything unchanged
 * and unmoved cross-fades against an identical copy of itself, which is
 * invisible by construction.
 *
 * Falls straight through to a plain call when unsupported or when the user asks
 * for reduced motion — an unsupported browser gets exactly the old behaviour,
 * which is what makes this safe. (Baseline: Chrome/Edge 111, Firefox 144,
 * Safari 18.)
 */
function withViewTransition(update) {
  if (
    typeof document.startViewTransition !== 'function' ||
    matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    update();
    return;
  }
  const t = document.startViewTransition(update);
  // A transition superseded by a newer one rejects `ready`. That is normal
  // here (click Remove twice quickly) and must not surface as an unhandled
  // rejection in the console.
  t.ready.catch(() => {});
  t.finished.catch(() => {});
}

/* ---------- ranked list ------------------------------------------------- */
// Has the list been painted at least once? The first paint is an ENTRANCE (the
// staggered `card-enter`, nothing to morph from); every later one is a CHANGE to
// a list already on screen, and gets the transition instead. Running both at
// once made cards play their entrance while the transition simultaneously
// cross-faded them, which just looked muddy.
let rankedPainted = false;

/** Re-render the ranked list, animating the difference when there is one. */
function refreshRanked() {
  if (!rankedPainted) return renderRanked();
  withViewTransition(renderRanked);
}

function renderRanked() {
  const entering = !rankedPainted;
  rankedPainted = true;
  el.rankedList.replaceChildren();
  const count = state.movies.length;
  el.rankedCount.textContent = count ? rankedCountLabel(count, ratedCount()) : '';
  el.rankedEmpty.hidden = count > 0;

  // Computed ONCE, by the same function rankSignature() uses, so what is drawn
  // and what counts as "the ranking changed" cannot drift apart. Films the user
  // scored identically must not be told apart by a number — the order between
  // them is only `created_at` ascending, i.e. the order they were added in,
  // which has nothing to do with taste (backlog #13).
  const ranking = displayedRanking(state.movies);

  state.movies.forEach((m, i) => {
    const li = document.createElement('li');
    li.className = 'movie-card';
    if (entering) {
      li.classList.add('is-entering');
      // Step 4b, tuned twice. 45ms -> 70ms was still "almost all at once", and
      // the reason is a RATIO rather than a number: what decides whether a
      // stagger reads as a cascade is how many cards are mid-animation at the
      // same instant, which is duration / stagger. At 70ms against a 600ms card
      // that was 8.6 cards in flight -- they overlap into one blob and the
      // stagger has nothing left to separate. 180ms took it to 3.3 and overshot
      // ("almost too slow"); 125ms sits at 4.8, each arrival still its own event
      // with the list still brisk. Walked 45 -> 70 -> 180 -> 135 -> 125 by eye,
      // which is worth knowing -- the useful band is narrow and nowhere near
      // where the value started, so do not retune it in small steps from here.
      // So tune this AGAINST the duration on .movie-card.is-entering, never on
      // its own: raising that duration without raising this walks straight back
      // into the same blur.
      // The cap STAYS, and must: this list is unbounded. It bites at card 10 now
      // (10 * 125 > 1200), so a long list still assembles in 1.8s rather than
      // growing without limit -- a clump at the tail is the accepted cost of
      // that, and it is invisible on the list lengths this app actually holds.
      li.style.animationDelay = `${Math.min(i * 125, 1200)}ms`;
    }
    // Pairs this card's before/after snapshots so the browser morphs it from
    // its old position to its new one. The name must be a valid CSS ident and
    // unique across the document, hence the prefix — a bare UUID can start with
    // a digit, and a duplicate aborts the whole transition.
    li.style.viewTransitionName = `movie-${m.id}`;

    // `!= null`, never truthiness: 0.0 is a rating the user deliberately gave,
    // and `0` is falsy — `m.rating ? …` would silently demote a 0.0 film to
    // "unrated", losing its rank, its score badge and its Edit label at once.
    const isRated = m.rating != null;

    const rank = document.createElement('div');
    rank.className = 'movie-card__rank';
    if (isRated) {
      // 1, 2, 2, 4 — the skipped 3 is the point, not a bug: two films are
      // jointly 2nd, so nothing is 3rd.
      rank.append(document.createTextNode(String(ranking[i].rank)));
      // The #1 crown is applied HERE, not by a `:first-child` CSS rule. "First
      // in the list" and "your top-rated film" are different facts, and they
      // come apart the moment the list holds an unrated film — with nothing
      // rated yet, the positional rule crowned a film with no rating at all.
      // A tie at the very top crowns BOTH films, which is correct rather than a
      // side effect: D-029 defines this as "your top-rated film", and if two are
      // scored the same then both are.
      if (ranking[i].rank === 1) rank.classList.add('is-top');
      // Three digits are wider than the rank gutter can hold at the desktop
      // font size — "250" overran the gap and the poster painted over its last
      // digit. CSS cannot count characters, so the digit count is marked here
      // and the size capped in `.movie-card__rank.is-wide`. Threshold is 99,
      // not 9: two digits were measured and fit fine at every width.
      if (ranking[i].rank > 99) rank.classList.add('is-wide');
      // Says the repeated number is deliberate. Without it two adjacent cards
      // showing "2" read as a rendering fault. Deliberately NOT baked into the
      // numeral as "=2", the UK chart convention: that would widen the glyph and
      // walk straight into the measured figure-width budget D-030 solved.
      // It is also readable text rather than an aria-label — a label on a
      // generic <div> is not reliably exposed, so a screen reader is left with
      // "2 tied", which is exactly right anyway.
      if (ranking[i].tied) {
        const tie = document.createElement('span');
        tie.className = 'rank-tie';
        tie.textContent = 'tied';
        rank.append(tie);
      }
    } else {
      // No rank to show. Same "no value here" glyph vocabulary as the AI call
      // log's empty Tokens/Cost cells, so the absence reads as an absence.
      // aria-hidden: the "Not rated yet" line below already says this, and the
      // <ol> still counts every <li>, so a reader would otherwise be told a
      // position this card is explicitly not claiming.
      rank.classList.add('is-unranked');
      rank.textContent = '?';
      rank.setAttribute('aria-hidden', 'true');
    }

    const poster = posterNode(m.poster_url, m.title, { eager: i < EAGER_POSTERS });
    poster.classList.add('movie-card__poster');

    const body = document.createElement('div');
    body.className = 'movie-card__body';
    const h3 = document.createElement('h3');
    h3.append(document.createTextNode(m.title + ' '));
    const yr = document.createElement('span');
    yr.className = 'year';
    yr.textContent = m.year ? `(${m.year})` : '';
    h3.append(yr);
    body.append(h3);
    if (!isRated) {
      // Two parts, not one sentence: a STATUS and an instruction, which want
      // different weights. The status is a chip — a shape no review or title
      // ever takes — so the line cannot be mistaken for prose even before its
      // colour registers; the instruction stays quiet beside it. The em dash
      // that used to join them is gone; the chip's edge is the separator now.
      const u = document.createElement('p');
      u.className = 'unrated';
      const badge = document.createElement('span');
      badge.className = 'unrated__badge';
      badge.textContent = 'Not rated yet';
      const hint = document.createElement('span');
      hint.className = 'unrated__hint';
      hint.textContent = 'Rate it to place it in the ranking.';
      u.append(badge, hint);
      body.append(u);
      // `else if`, and it is EXHAUSTIVE rather than merely convenient: the
      // `review_requires_rating` constraint (migration 004, D-041) makes a
      // review on an unrated film unwritable, so this branch cannot be hiding
      // one. Backlog #15 was that it could — the fix was to forbid the state in
      // the database, not to render it here, because the rating is the required
      // part and the review the optional one. Do NOT "fix" this into two
      // independent `if`s: that would add a branch for a state the schema
      // guarantees cannot exist. If the constraint is ever dropped, this comment
      // is the thing that stops being true.
    } else if (m.review) {
      const r = document.createElement('p');
      r.className = 'review';
      r.id = `review-${m.id}`;
      // Set BEFORE the first setReviewExpanded() below, which reads it back out
      // to record the state. `movies.id` is a uuid, so it is already a string
      // and dataset's stringification cannot make the Set's keys disagree with
      // the `m.id` looked up here — a numeric id would need String() at both
      // ends to avoid has(5) missing "5".
      r.dataset.movieId = m.id;
      r.textContent = m.review;
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'review-toggle';
      toggle.hidden = true; // shown after layout only if the text actually clips
      toggle.setAttribute('aria-controls', r.id);
      // Seeded from the Set, not hardcoded to false: this card may be a rebuild
      // of one the user had already expanded. The toggle is still hidden here —
      // the rAF'd syncReviewToggles() below reveals it if the text actually
      // clips, and collapses this again if it no longer does. That pass reads
      // the class we just set as its `wasExpanded`, so restoring here is exactly
      // what makes it treat a rebuilt card like one that never went away.
      setReviewExpanded(r, toggle, state.expandedReviews.has(m.id));
      toggle.addEventListener('click', () => {
        setReviewExpanded(r, toggle, !r.classList.contains('expanded'));
      });
      body.append(r, toggle);
    } else {
      // Backlog #20, the inverse of #15: a RATED film with no review used to
      // show nothing at all where a review would be, and since the body is
      // top-aligned on desktop that left a visible void under the title.
      // Correctly scoped by the `else` alone — this branch is reachable only
      // when `isRated` is true and there is no review, because the two
      // conditions above have already taken the other cases. An unrated card
      // must NOT get this: it already says "Not rated yet", and stacking a
      // second placeholder under the first reads as nagging.
      // Class is `no-review`, deliberately NOT `review`: syncReviewToggles()
      // selects `.review` to measure for clamping, and this line must never
      // enter that pass.
      const none = document.createElement('p');
      none.className = 'no-review';
      none.textContent = 'No review yet — edit to add one.';
      body.append(none);
    }

    const score = document.createElement('div');
    score.className = 'movie-card__score';
    // The rating and TMDB's score go in ONE wrapper, not straight into the score
    // column. The column's two children are the block and the buttons, and the
    // buttons hang off `margin-top: auto` to reach the bottom — adding a third
    // sibling would put the column's 0.5rem gap between the rating and its own
    // sub-line, which is far too much for a caption. Inside the block the
    // spacing is set on its own terms, and the column keeps exactly the two
    // children its layout was built around.
    const scoreBlock = document.createElement('div');
    scoreBlock.className = 'score-block';
    if (isRated) {
      const badge = document.createElement('div');
      badge.className = 'score-badge';
      badge.append(document.createTextNode(m.rating.toFixed(1) + ' '));
      const s = document.createElement('small');
      s.textContent = '/10';
      badge.append(s);
      scoreBlock.append(badge);
    }
    // Always rendered — with the score when TMDB has one, and as an explicit
    // "No TMDB rating" when it does not. Saying so beats an empty slot: an
    // absent line is indistinguishable from a line that failed to load, and the
    // slot would otherwise be silently empty on exactly the obscure titles where
    // the reader is most likely to wonder.
    // Shown on unrated cards too: it is explicitly labelled "TMDB", so it cannot
    // be read as the user's own score, and it is the one number a film has
    // before you have rated it.
    // `!= null` and not truthiness. A 0 can no longer reach here — shapeMovie()
    // maps TMDB's no-votes zero to null at the source (D-037) — but truthiness
    // would be the wrong test to leave behind for the next value that comes
    // through, and it is the same trap `isRated` above documents.
    const t = document.createElement('div');
    t.className = 'score-tmdb';
    if (m.tmdb_rating != null) {
      t.textContent = `TMDB ${m.tmdb_rating.toFixed(1)}`;
      // The visible text already reads "TMDB 7.2", which is terse next to the
      // user's own big amber number; spell the comparison out for a screen
      // reader, where there is no visual grouping to make it obvious.
      t.setAttribute('aria-label', `TMDB rating ${m.tmdb_rating.toFixed(1)} out of 10`);
    } else {
      // No aria-label: "No TMDB rating" already reads correctly aloud, and a
      // label would only override it with a paraphrase.
      t.classList.add('is-muted');
      t.textContent = 'No TMDB rating';
    }
    scoreBlock.append(t);
    score.append(scoreBlock);
    const actions = document.createElement('div');
    actions.className = 'card-actions';
    const rateBtn = document.createElement('button');
    rateBtn.type = 'button';
    rateBtn.textContent = isRated ? 'Edit' : 'Rate';
    rateBtn.setAttribute('aria-label', `${isRated ? 'Edit rating for' : 'Rate'} ${m.title}`);
    rateBtn.addEventListener('click', () => openRate(m));
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'danger';
    delBtn.textContent = 'Remove';
    delBtn.setAttribute('aria-label', `Remove ${m.title} from your ranking`);
    delBtn.addEventListener('click', () => removeMovie(m, delBtn));
    actions.append(rateBtn, delBtn);
    score.append(actions);

    li.append(rank, poster, body, score);
    el.rankedList.append(li);
  });

  // Measured after layout, not during: the cards were only just appended.
  requestAnimationFrame(syncReviewToggles);
}

/**
 * Show each review's "show more" toggle only when the text is actually clipped.
 *
 * (The two "view more…" mentions further down are PAST-TENSE and stay: the label
 * really was that when those bugs happened. #18 renamed it — see
 * setReviewExpanded().)
 *
 * `-webkit-line-clamp` hides the overflow silently and CSS has no "did this
 * overflow?" selector, so it has to be measured. The important part is that it
 * must be measured AGAIN whenever the layout changes: this used to run once per
 * render and never on resize, so narrowing the window clipped a review that had
 * fitted while its toggle stayed hidden — the text became unreachable, with no
 * cue that anything was missing. Widening produced the mirror image: a
 * "view more…" that expanded nothing.
 *
 * Hence `hidden` is ASSIGNED both ways here. An earlier version only ever set it
 * to false, which is why a wrong state could never recover.
 *
 * An expanded review is `overflow: visible`, so it always measures as "fits" —
 * the first attempt at this therefore SKIPPED expanded reviews, which just moved
 * the staleness: expand at a narrow width, widen until the text fits in two
 * lines, and a "show less" lingered over an unclipped review. The fix is to
 * measure the CLAMPED state always, by collapsing, reading, and restoring within
 * one frame. Only the clamped state answers the question "is a toggle needed at
 * all", so it is the only state worth measuring.
 */
function syncReviewToggles() {
  const items = [...el.rankedList.querySelectorAll('.review')]
    .map((p) => ({ p, toggle: p.nextElementSibling }))
    .filter(({ toggle }) => toggle?.classList.contains('review-toggle'));
  if (!items.length) return;

  // Three passes, not one loop: reading geometry straight after a class change
  // forces a synchronous layout, so interleaving write/read per item would cost
  // one layout PER REVIEW. Batching costs one for the whole pass. Nothing is
  // painted in between — the browser cannot render until this returns.
  for (const it of items) {
    it.wasExpanded = it.p.classList.contains('expanded');
    // Deliberately a bare classList.remove() and NOT setReviewExpanded(): this
    // collapse is a measuring fixture, not a state change. Routing it through
    // the single writer would rewrite the label and aria-expanded on every
    // resize frame, and would clear the movie's entry in state.expandedReviews
    // before pass three has decided whether to put it back. Pass three is where
    // this pass's one real decision gets written.
    if (it.wasExpanded) it.p.classList.remove('expanded');
  }
  for (const it of items) it.clips = it.p.scrollHeight - it.p.clientHeight > 4;
  for (const it of items) {
    it.toggle.hidden = !it.clips;
    // `it.clips && it.wasExpanded`, so a review that no longer clips is left
    // COLLAPSED rather than restored. Both states render identically when the
    // text fits within the clamp, so nothing moves — but leaving `expanded` set
    // would mean the next narrowing showed the full text with no toggle at all,
    // which is the original unreachable-text bug wearing a different hat.
    setReviewExpanded(it.p, it.toggle, it.clips && it.wasExpanded);
  }
}

/**
 * The single writer for a review's expanded state. The class, the button label,
 * `aria-expanded` and the entry in `state.expandedReviews` describe one fact and
 * must never disagree — the first three drifted once already, when the toggle's
 * label was updated on click but never by the resize pass.
 *
 * The Set is written HERE and not in the click handler precisely because this is
 * not the only place the state changes: syncReviewToggles() collapses a review
 * that no longer clips, and if that collapse were not recorded, the DOM and the
 * Set would disagree from the very next render onwards.
 */
function setReviewExpanded(p, toggle, expanded) {
  p.classList.toggle('expanded', expanded);
  // One verb, both directions (backlog #18). It was "view more…" / "show less":
  // two verbs for one control, and an ellipsis on only one half. The ellipsis is
  // gone rather than balanced, because the clamp draws its OWN — `.review` is a
  // -webkit-box with -webkit-line-clamp, so the browser already ends the clipped
  // line in "…" and the label repeated it one line below. "show", not "view",
  // because within-control consistency beats matching the log's "view verdict"
  // on another surface, and "view less" is the weaker half of that pair.
  toggle.textContent = expanded ? 'show less' : 'show more';
  toggle.setAttribute('aria-expanded', String(expanded));
  if (expanded) state.expandedReviews.add(p.dataset.movieId);
  else state.expandedReviews.delete(p.dataset.movieId);
}

async function loadMovies() {
  const { movies } = await api('/api/movies');
  state.movies = movies;
  state.ownedTmdbIds = new Set(movies.map((m) => m.tmdb_id));
  // Forget expansion state for anything that no longer has a review to expand —
  // the film was removed, or its review was cleared by an edit. Without this,
  // clearing a review and later writing a new one would render the new text
  // pre-expanded, having inherited a decision the user made about different
  // text. Ids are uuids, so a re-added film gets a fresh one and cannot inherit
  // a stale entry either way.
  const withReview = new Set(movies.filter((m) => m.review).map((m) => m.id));
  for (const id of state.expandedReviews) {
    if (!withReview.has(id)) state.expandedReviews.delete(id);
  }
  // The syncs run BEFORE the render, deliberately. A View Transition snapshots
  // the whole document, so anything these three touch (the recs hint, the
  // verdict placeholder, the search-result buttons) would cross-fade too.
  // Settling them first leaves the ranked list as the only difference between
  // the two snapshots. None of them reads DOM that renderRanked() builds — they
  // read `state`, which is already updated above — so the order is free.
  syncAddButtons();
  syncRecCardBadges();
  syncRecommendationsAvailability();
  syncVerdictAvailability();
  refreshRanked();
}

/* ---------- search + add ---------------------------------------------- */
/** Hide and empty the results panel — it should not outlive its query. */
function closeSearchResults() {
  el.searchResults.hidden = true;
  el.searchResults.replaceChildren();
}

/**
 * Drop focus from the search input so a phone's soft keyboard closes.
 *
 * The form calls `preventDefault()`, so it never navigates and the input keeps
 * focus — and with it the keyboard, which then covers the results the search
 * just produced. Nothing else in the app blurs anything, so this was the whole
 * mechanism. Pressing the keyboard's own Go/Search key is the case that needs
 * it: tapping the Search BUTTON moves focus off the input by itself.
 *
 * Gated on `(hover: none)` — a capability query, exactly as the hover rules in
 * styles.css are, never a width. On a pointer device there is no soft keyboard
 * to close, so a blur would only cost the user their caret and reset the tab
 * order to the top of the document; desktop is provably unchanged. A device
 * with a real pointer AND a touch screen keeps focus, which is the right call
 * for the pointer it reports as primary.
 *
 * The submit handler calls this only AFTER its empty-query early return. That
 * path focuses the input on purpose: nothing was searched, so the caret belongs
 * where the fix goes, and the keyboard is what the user still needs.
 */
function dismissSoftKeyboard() {
  if (matchMedia('(hover: none)').matches) el.searchInput.blur();
}

el.searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = el.searchInput.value.trim();
  el.searchResults.hidden = false;
  if (!q) {
    // Was a silent no-op. Say why nothing happened and put the caret where the
    // user needs it, rather than letting the button look broken.
    el.searchResults.replaceChildren(searchNote('Type a film title to search.'));
    el.searchInput.focus();
    return;
  }
  dismissSoftKeyboard();
  const settle = busyButton(el.searchBtn, 'Searching…');
  el.searchResults.replaceChildren(makeLoading('Searching…'));
  try {
    const { results } = await api(`/api/movies/search?q=${encodeURIComponent(q)}`);
    renderSearchResults(results, q);
  } catch (err) {
    el.searchResults.replaceChildren(makeError(err.message));
  } finally {
    settle();
  }
});

// Escape puts the panel away — but only when no <dialog> is open, where the
// key belongs to the dialog.
//
// Deliberately NOT dismissed by an outside click, unlike the AI-log reveal
// panels. Those are position:absolute and sit ON TOP of table rows, so they
// have to get out of the way. This panel is in normal flow — it pushes the
// page down and obscures nothing, so there is nothing to get out of the way
// of. Dismissing it on a stray click would just cost the user a re-typed
// query and another TMDB round-trip to add the second film they had found.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || el.searchResults.hidden) return;
  if (document.querySelector('dialog[open]')) return;
  closeSearchResults();
});

// A line inside the search-results panel: loading, "no matches", an error, or
// the nudge for an empty query. Class-driven — these were the only inline
// element.style writes left in this file.
function searchNote(text, kind) {
  const d = document.createElement('div');
  d.className = kind ? `search-note ${kind}` : 'search-note';
  if (text) d.textContent = text;
  return d;
}
function makeLoading(label) {
  const d = searchNote();
  d.append(spinnerNode(), document.createTextNode(' ' + label));
  return d;
}
const makeError = (msg) => searchNote(msg, 'err');

/** The two states an Add button can rest in. */
function setAddButtonState(btn, owned) {
  const title = btn.dataset.title;
  // Three labels, not two. "✓ Added" is stickier than it looks: once set it
  // survives every later sync, so it still reads "✓ Added" after the rate
  // dialog closes by EITHER route. Without the flag, saving a rating ran
  // loadMovies() again and quietly reset it to "In your list", while skipping
  // did not — the same state wearing two labels depending on an unrelated
  // round-trip. It marks what YOU just added versus what was already there.
  // Removing the film clears the flag, so the row can offer "+ Add" again.
  if (!owned) delete btn.dataset.justAdded;
  // A plain "+" (U+002B), not the ➕ emoji: it inherits currentColor, so it
  // goes amber on hover and dims with the :disabled opacity, and it matches
  // the text-glyph ✓ in "✓ Added". An emoji would do none of those.
  // The glyph is glued to its word with a non-breaking space. `.add-btn` is
  // `white-space: nowrap` so the search row never wraps anyway — but the SAME
  // strings are rendered on the recommendation card, whose button has no such
  // rule, so the guard has to live in the string rather than in one stylesheet.
  // "In your list" is left breakable on purpose: those are real words.
  // The UNOWNED label is read off the button, because the two surfaces disagree
  // about it: a search row rests at "+ Add", a recommendation card at "Add to my
  // list". The owned labels are shared, so both surfaces settle identically.
  // Which of the two resting labels should move is still an open decision (R7) —
  // routing rec cards through this function must not silently make that decision
  // by relabelling them, hence the override rather than one hardcoded string.
  const addLabel = btn.dataset.addLabel || '+\u00A0Add';
  btn.textContent = !owned ? addLabel : btn.dataset.justAdded ? '✓\u00A0Added' : 'In your list';
  btn.setAttribute(
    'aria-label',
    owned ? `${title} is already in your list` : `Add ${title} to your list`,
  );
  btn.disabled = owned;
}

/**
 * Keep every rec card's badge true (R17).
 *
 * `.rec-card::before` reads "AI pick · not yet rated", and the second half stops
 * being true as soon as the user acts on the card: adding from a rec card opens
 * the rate dialog, so the very flow the button invites is the one that falsifies
 * the badge behind it. The card then contradicted the ranked list, where the
 * same film now showed a score.
 *
 * Rated-ness is read from `state.movies`, not from `state.ownedTmdbIds` — owned
 * and rated are different questions, and conflating them is exactly the bug R2
 * fixed on the server. A film can be added and left unrated indefinitely
 * ("Skip for now"), and the badge is correct for that whole time.
 */
function syncRecCardBadges() {
  const rated = new Set(
    state.movies.filter((m) => m.rating != null).map((m) => m.tmdb_id),
  );
  el.recsGrid.querySelectorAll('.rec-card').forEach((card) => {
    card.classList.toggle('is-rated', rated.has(Number(card.dataset.tmdbId)));
  });
}

/**
 * Re-state every Add button on the page from `state.ownedTmdbIds`.
 *
 * Buttons already on screen go stale the moment the list changes: adding one
 * film used to update only the button that was clicked, leaving every other one
 * still offering "Add" for something now owned. Called from loadMovies(), so
 * removals re-open the offer too.
 *
 * **It queries the whole document, not one panel.** It used to be
 * `syncAddButtons()` and looked only inside `.search-results`, so the
 * sync ran in exactly ONE direction: adding from a REC CARD refreshed the search
 * rows, because they sat in the panel it swept — while adding the same film from
 * a SEARCH ROW left the rec card still offering it, and removing a film left the
 * rec card stuck on a disabled "Added" for something no longer in the list. Never
 * a data bug: the duplicate add was refused correctly by the 409. The button
 * simply lied about what it would do. Reported by the user, 2026-09-09 (R3).
 *
 * Both surfaces are found by ONE selector — `.add-btn[data-tmdb-id]` — rather
 * than by sweeping two named containers, so a third surface that renders an Add
 * button is covered the day it is written instead of the day somebody remembers
 * this function exists.
 */
function syncAddButtons() {
  document.querySelectorAll('.add-btn[data-tmdb-id]').forEach((btn) => {
    // Skip a button mid-request: addMovie() awaits loadMovies(), which calls
    // this, so writing textContent here would wipe the spinner out of the very
    // button that is still waiting on its own response.
    if (btn.getAttribute('aria-busy') === 'true') return;
    setAddButtonState(btn, state.ownedTmdbIds.has(Number(btn.dataset.tmdbId)));
  });
}

function renderSearchResults(results, query) {
  el.searchResults.replaceChildren();
  if (!results.length) {
    // searchNote, not makeError: a search that matched nothing is an empty
    // state, not a failure, and crimson said otherwise.
    //
    // Echo the query back. The app cannot detect a typo and deliberately does
    // not try (D-028) — but quoting what was actually typed makes one
    // self-evident, and "check the spelling" is honest about the two possible
    // causes where the old "try a different title" implied only one.
    // Capped so a pasted essay can't blow the message out. Safe to echo raw
    // input: searchNote builds with textContent, never innerHTML.
    const shown = query.length > 40 ? query.slice(0, 40) + '…' : query;
    el.searchResults.append(
      searchNote(`No matches for “${shown}”. Check the spelling, or try a different title.`)
    );
    return;
  }
  for (const r of results) {
    const row = document.createElement('div');
    row.className = 'result-row';
    const poster = posterNode(r.poster_url, r.title);
    const meta = document.createElement('div');
    meta.className = 'meta';
    const strong = document.createElement('strong');
    strong.textContent = r.title;
    const span = document.createElement('span');
    // `!= null`, not truthiness, and `toFixed(1)` so this row and the ranked
    // card state the same number the same way. Truthiness happened to hide
    // TMDB's "no votes" zero here while the ranked card showed it as "TMDB 0.0"
    // — the two surfaces disagreed about the same film. That zero is now null
    // at the source (shapeMovie), so both are absent for the same reason.
    // NON-BREAKING space between the label and the number, written as an escape
    // rather than a literal so it cannot be mistaken for an ordinary space and
    // "tidied" away. The whole line is ONE text node, so the browser may break
    // it at any space in it — including the one inside "TMDB 7.0", which is the
    // one place it must not. At ~340px and below that produced "2013 · TMDB"
    // with a stranded "7.0" on the next line, reading as a rendering fault.
    // Gluing only this pair leaves the break around " · " available, so a narrow
    // row wraps as "2013 ·" / "TMDB 7.0" instead.
    // Invisible on any width where the line already fits: U+00A0 renders
    // identically to U+0020 and only removes a break OPPORTUNITY, so no layout
    // that is not currently breaking here can change.
    // The ranked card needs no equivalent — `.score-tmdb` is `white-space:
    // nowrap`, which already forbids the break outright.
    const tmdb = r.tmdb_rating != null ? `TMDB\u00A0${r.tmdb_rating.toFixed(1)}` : null;
    span.textContent = [r.year, tmdb].filter(Boolean).join(' · ');
    meta.append(strong, span);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'add-btn';
    btn.dataset.tmdbId = r.tmdb_id; // so syncAddButtons() can find it
    btn.dataset.title = r.title;
    setAddButtonState(btn, state.ownedTmdbIds.has(r.tmdb_id));
    btn.addEventListener('click', () => addMovie(r.tmdb_id, btn));
    row.append(poster, meta, btn);
    el.searchResults.append(row);
  }
}

async function addMovie(tmdbId, btn) {
  // Same busy treatment as every other trigger: disabled, spinner, held width.
  const settle = btn ? busyButton(btn, 'Adding…') : null;
  try {
    const { movie } = await api('/api/movies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tmdb_id: tmdbId }),
    });
    // Refreshes state.ownedTmdbIds, and with it every other open result row.
    await loadMovies();
    // Marked before settling so every later sync keeps showing "✓ Added".
    if (btn) btn.dataset.justAdded = '1';
    settle?.('✓\u00A0Added');
    // The panel deliberately STAYS open. Closing it here made "✓ Added"
    // impossible to ever see, and made syncAddButtons() pointless —
    // there would be no other rows left on screen to re-sync. Keeping it lets
    // you add a second film from the same results instead of re-searching.
    // Prompt to rate the movie right away; "Skip for now" leaves it unrated.
    const fresh = state.movies.find((m) => m.id === movie.id);
    if (fresh) openRate(fresh, { isNew: true });
  } catch (err) {
    // The film's title comes off the BUTTON, not from `movie` — the add failed,
    // so there is no saved row to read it from, and `movie` is not even in scope
    // here. renderResults() stamps `dataset.title` on every add button for
    // syncAddButtons(), and it is the only title available at this
    // point. `btn` is optional in this function's signature, hence the fallback.
    const title = btn?.dataset.title;
    // "Already in your list" surfaces here (SPEC § 3.4), and reads correctly
    // after a context: 'Couldn’t add “Dune” — Already in your list.'
    toast(failureText(title ? `Couldn’t add “${title}”` : 'Couldn’t add that film', err), true);
    // Already owned is not retryable, so settle there; anything else is, so
    // restore the button as it was (enabled, reading "Add"). Reads err.message
    // and NOT the composed text on purpose: the composed string carries a title
    // that could itself contain the word "Already".
    settle?.(err.message.includes('Already') ? 'In your list' : undefined);
  }
}

/* ---------- rate / remove ------------------------------------------- */
/** Show or clear the rate dialog's inline error. Empty string clears it. */
function setRateError(message) {
  el.rateError.textContent = message;
  el.rateError.hidden = !message;
}

function openRate(movie, { isNew = false } = {}) {
  state.editing = movie;
  state.editingIsNew = isNew;
  el.rateTitle.textContent = isNew ? `Rate “${movie.title}”` : movie.title;
  // On a fresh add, closing without saving just leaves the movie unrated —
  // make that an explicit "later" choice, not a dead-end "Cancel".
  el.rateCancel.textContent = isNew ? 'Skip for now' : 'Cancel';
  el.rateRange.value = movie.rating ?? 7;
  el.rateOutput.textContent = Number(el.rateRange.value).toFixed(1);
  el.rateReview.value = movie.review ?? '';
  setRateError('');
  el.rateDialog.showModal();
}
el.rateRange.addEventListener('input', () => {
  el.rateOutput.textContent = Number(el.rateRange.value).toFixed(1);
});
el.rateForm.addEventListener('submit', async (e) => {
  const action = e.submitter?.value;
  const movie = state.editing;
  if (action !== 'save') {
    // "Skip for now" saves nothing, so there is no "Saved" to report — but the
    // add itself had no confirmation of its own, which left this path silent.
    // Say what actually happened instead of nothing (or, worse, "Saved").
    // No preventDefault: nothing is being written, so `method="dialog"` closing
    // it immediately is exactly right here.
    if (state.editingIsNew) toast(`“${movie.title}” added — rate it any time.`);
    return;
  }

  // Stop `method="dialog"` from closing the form. The dialog must OUTLIVE the
  // request: it used to close on submit and the PATCH then ran invisibly, so a
  // failure produced an error toast about a dialog that was already gone — with
  // the user's typed review destroyed and no way to retry it. Now it closes
  // only after the write is known to have succeeded.
  e.preventDefault();
  setRateError(''); // a retry starts clean
  const settleSave = busyButton(el.rateSave, 'Saving…');
  // Cancel is disabled for the duration too: mid-write it can neither undo the
  // request nor be trusted to mean "discard". Esc still closes the dialog, so
  // there is always a way out if the request hangs.
  el.rateCancel.disabled = true;
  // Captured BEFORE the request, because loadMovies() replaces state.movies
  // wholesale and there is no "previous" left to compare against afterwards.
  const rankingBefore = rankSignature();
  try {
    await api(`/api/movies/${movie.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rating: Number(el.rateRange.value),
        review: el.rateReview.value.trim(),
      }),
    });
    // Closed BEFORE the reload, not after, so the ranked list's re-sort
    // animation happens on a visible page rather than behind the backdrop —
    // a rating change is the main thing that reorders the list, so it is the
    // one place that animation earns its keep.
    el.rateDialog.close();
    await loadMovies();
    // "ranking updated" is CHECKED, not assumed. Every save does recompute the
    // ranking (loadMovies re-fetches the whole list, server-sorted), so the old
    // unconditional wording was never false — but it reads as a claim about the
    // OUTCOME, and editing only a review, or re-rating without crossing a
    // neighbour, leaves the ranking looking identical. Then the user goes
    // hunting for a change that is not there. Saying it only when it is
    // observably true costs one comparison.
    const reordered = rankSignature() !== rankingBefore;
    toast(`“${movie.title}” saved${reordered ? ' — ranking updated.' : '.'}`);
  } catch (err) {
    // Deliberately leaves the dialog open with the rating and review exactly as
    // typed, so Save can simply be pressed again. Reported INLINE rather than as
    // a toast: this dialog is modal, so it is in the top layer and its
    // ::backdrop dims the page — a toast fired here is behind it and greyed
    // out, which is exactly how it looked before this changed.
    setRateError(err.message);
  } finally {
    settleSave();
    el.rateCancel.disabled = false;
  }
});

/**
 * The app's own confirm, replacing window.confirm(). Resolves true only if the
 * user pressed the confirming button; Cancel and Escape both resolve false, so
 * every ambiguous exit is the safe one.
 *
 * Those are the only two ways out, and that is deliberate. A native <dialog>
 * does NOT close on a backdrop click — that behaviour has to be added, and
 * neither of the other two dialogs has it either. Do not add it here alone:
 * the newest dialog would become the one that behaves differently.
 *
 * `returnValue` is reset before opening rather than trusted: it persists on the
 * element between opens, and engines disagree on whether an Escape dismissal
 * clears it. Resetting makes "true" reachable ONLY through a real click on the
 * confirming button, whatever the browser does with Escape.
 *
 * The `close` event is the single resolution point — it fires for the buttons
 * (via `method="dialog"`, which sets returnValue from the submitter) and for
 * Escape alike, so there is no dismissal path that leaves the promise pending.
 */
function confirmAction({ title, body, confirmLabel = 'Remove' }) {
  el.confirmTitle.textContent = title;
  el.confirmBody.textContent = body;
  el.confirmOk.textContent = confirmLabel;
  el.confirmDialog.returnValue = '';
  return new Promise((resolve) => {
    el.confirmDialog.addEventListener(
      'close',
      () => resolve(el.confirmDialog.returnValue === 'confirm'),
      { once: true },
    );
    el.confirmDialog.showModal();
  });
}

async function removeMovie(movie, btn) {
  // Name what actually goes with it. Incident 1 is the reason this is spelled
  // out rather than left to "are you sure?": a rating and a review are typed
  // once and gone for good — the free tier has no point-in-time recovery, so
  // "this can't be undone" is literal, not boilerplate.
  // Built from what this film really has, never assumed: a film can be rated
  // with no review, and (the PATCH endpoint permits it — backlog #15) reviewed
  // with no rating. Promising to delete a review that was never written would
  // be its own small lie.
  const lost = [];
  if (movie.rating != null) lost.push(`your ${movie.rating.toFixed(1)} rating`);
  if (movie.review) lost.push('your review');
  const body = lost.length
    ? `${lost.join(' and ')} will go with it — this can’t be undone.`
    : 'This can’t be undone.';
  const confirmed = await confirmAction({
    title: `Remove “${movie.title}”?`,
    body: body[0].toUpperCase() + body.slice(1),
  });
  if (!confirmed) return;
  // Spinner only, no busy LABEL: busyButton locks the button's current width as
  // a min-width, and "Removing…" is far wider than "Remove", so a label would
  // grow the button and shove its neighbour sideways mid-request. The card
  // buttons are small enough that a spinner in a disabled button reads clearly
  // on its own, and the aria-label still names the film.
  const settle = btn ? busyButton(btn, '') : null;
  try {
    await api(`/api/movies/${movie.id}`, { method: 'DELETE' });
    await loadMovies();
    toast(`“${movie.title}” removed.`);
    // No settle() on success — loadMovies() has already destroyed this button
    // along with its card.
  } catch (err) {
    toast(failureText(`Couldn’t remove “${movie.title}”`, err), true);
    settle?.();
  }
}

/* ---------- recommendations --------------------------------------- */
/**
 * Keep the trigger and the idle hint in step with how many films are rated.
 *
 * #recs-hint has TWO owners: this function writes the availability text, and a
 * run writes its own progress, result or failure into the same element. This
 * used to reassign it unconditionally — and since the run's `finally` calls this
 * function, every message a run wrote was wiped in the same tick. Not just the
 * error: `Based on: …` and the no-suggestions line were dead too, so a failed
 * run, a successful run and a page that had never run looked identical apart
 * from the cards (R1).
 *
 * The guard is the one `syncVerdictAvailability()` already uses, ported rather
 * than reinvented: below the threshold the availability text always wins — the
 * section is unavailable, so whatever a past run said about it is moot — and
 * above it, the idle hint is only written when no run owns the element.
 */
/**
 * Single writer for #recs-hint's content AND its weight.
 *
 * `caption: true` means this line INTRODUCES content that is on screen or about
 * to be — the busy line, and "Based on: …" above the cards. Those are fine print
 * over the real thing, so they stay --ink-faint. Everything else is the only
 * thing the section is showing: the two availability sentences, a failure, and
 * the zero-result line. Those read at full --ink-dim weight.
 *
 * **This supersedes R26's `.from-run` class**, which tied the weight to WHO wrote
 * the line. That held until the user looked at a zero-result run: "No new
 * suggestions this time…" is written by a run, yet it is persistent and it is the
 * only thing in the section, so it belongs with the availability sentences and
 * not with the two captions. Who wrote it was a good proxy for the real question
 * and not the same question. `state.recsHintFromRun` still exists and still means
 * exactly what R1 made it mean — may the sync overwrite this? — it just no longer
 * pretends to answer this one too.
 */
function setRecsHint(content, { caption = false } = {}) {
  el.recsHint.classList.toggle('is-caption', caption);
  if (typeof content === 'string') el.recsHint.textContent = content;
  else el.recsHint.replaceChildren(...content);
}

function syncRecommendationsAvailability() {
  const need = state.cfg.minRatedForRecommendations;
  const have = ratedCount();
  const ok = have >= need;
  // Never re-enable a button mid-request. `loadMovies()` calls this function, and
  // it can run DURING a recs call — add a film from the search panel while one is
  // generating — which used to hand the busy trigger back to the user. Same
  // guard, and the same reason, as the `aria-busy` skip in
  // syncAddButtons(). The run's own `finally` restores the button
  // before calling this, so the correct state is never missed.
  if (el.recsTrigger.getAttribute('aria-busy') !== 'true') el.recsTrigger.disabled = !ok;
  if (!ok) {
    state.recsHintFromRun = false; // availability takes the element back (R1)
    el.recsHint.classList.remove('err');
    setRecsHint(`Rate at least ${need} movies to unlock recommendations (you have ${have}).`);
    // R16. Remove rated films until the count falls under the threshold and the
    // section locks — but the previous run's cards used to stay on screen, so
    // "Rate at least 3 movies to unlock recommendations" sat directly above six
    // recommendations. The section has exactly ONE message channel (this hint),
    // and the availability text has just taken it, so there is no room to
    // caption the cards as a past run without either overloading the single
    // writer or inventing a second element. Clearing them is what makes the
    // locked section look locked, which is the state a first-time user sees.
    //
    // NOT because they went stale — that would be a different rule and a wrong
    // one. Recs go stale on ANY rating change, and we deliberately leave them
    // alone then; what is being fixed here is a section contradicting itself.
    // The metadata footer goes too: it describes a run whose inputs no longer
    // clear the bar.
    el.recsGrid.replaceChildren();
    el.recsMeta.replaceChildren();
  } else if (!state.recsHintFromRun) {
    el.recsHint.classList.remove('err');
    setRecsHint(`Uses your top ${state.cfg.topN} rated films as taste signal. Every pick is verified against TMDB.`);
  }
}

el.recsTrigger.addEventListener('click', async () => {
  const restoreTrigger = busyButton(el.recsTrigger);
  // From here until the next availability change, the hint belongs to this run.
  state.recsHintFromRun = true;
  el.recsHint.classList.remove('err');
  // caption: the cards this describes are coming, and it is replaced either way.
  setRecsHint('Pulling your top films → sending a versioned prompt → cross-checking each pick against TMDB…', { caption: true });
  // Phase one of R27's two-phase render. This used to be a bare
  // `el.recsGrid.replaceChildren()`, which dropped the previous run's cards in a
  // single frame with no transition at all.
  exitRecCards();
  try {
    const data = await api('/api/recommendations', { method: 'POST' });
    renderRecommendations(data);
  } catch (err) {
    el.recsHint.classList.add('err');
    // Inline, never the toast — the same call the rate dialog makes (D-032): this
    // message belongs beside the control that produced it.
    //
    // The log pointer is conditional, and that is the whole point. The verdict's
    // fallback offers it unconditionally, so when CineRank itself is unreachable
    // it sends the user to a log that cannot load either (recorded as R23, not
    // fixed here). This only offers it when the server said a row was actually
    // written — a failed DB read, an unmet threshold, and CineRank being down
    // entirely all leave nothing to read.
    if (err.logged) {
      setRecsHint([
        document.createTextNode(`${err.message} See the `),
        logLink('AI call log'),
        document.createTextNode(' for details.'),
      ]);
    } else {
      setRecsHint(err.message);
    }
  } finally {
    restoreTrigger();
    syncRecommendationsAvailability();
  }
});

/**
 * Why a run came back with nothing, in the user's words. The server decides
 * WHICH — only it knows — and this maps it to copy.
 *
 * There used to be one hardcoded sentence here claiming the model had named only
 * films already in the list. That is one of four possible causes, and asserting
 * it for all four was wrong three times out of four. The bad case is
 * `tmdb-unreachable`: the AI call really did succeed and really was charged, so
 * the run logs 'success' and nothing else in the app mentions TMDB — the false
 * sentence was the only thing the user would ever see (user-raised, 2026-09-09).
 *
 * `mixed` is deliberately vague: several causes at once, and naming one would be
 * the original mistake again. It also backstops an unknown value, so a server
 * that learns a new reason before this map does degrades to something true.
 */
const EMPTY_REASON_TEXT = {
  'all-owned': 'No new suggestions this time — the model only named films already in your list.',
  'none-named': 'No suggestions this time — the model didn’t name any films. Try again.',
  'tmdb-unreachable':
    'Couldn’t check any of the suggestions — the movie database is unreachable. Try again in a moment.',
  unverifiable: 'No new suggestions this time — none of the films it named could be verified.',
  mixed: 'No new suggestions this time.',
};

/* ---------- rec-card enter / exit (R27) ----------------------------------
 * The user's sequence, given after watching a run and stated as
 * non-negotiable: cards arrive → SCROLL → wait a beat → entrance animation.
 * The beat was specified as ~200ms and doubled to 400ms after the user watched
 * it, which also means a browser's smooth scroll has typically finished before
 * the first card moves — closer to the literal reading of the sequence.
 * All of it AFTER the response has landed, and none of it on a run that
 * produced no cards.
 *
 * Firing the scroll on the click instead was considered and rejected by the
 * user: at click time the app knows none of the three things that make the
 * scroll worth doing — how long the call will take, how many cards will come
 * back, or whether it will succeed at all. The scroll is a reward for a result,
 * so it waits for one.
 */
const RECS_LEAD_IN_MS = 400; // the beat between the scroll and the first card
const RECS_STAGGER_MS = 120; // was 60, which the user found "way too fast"
// Raised 55ms -> 120ms after the user reported the cards were "exiting at the
// same time". The stagger was real; it was just too small to see against a
// 340ms animation, and the easing was hiding the rest of it (see the
// `.rec-card.is-leaving` comment — `--ease` front-loads 67% of the move into
// the first fifth). Now the same value as the entrance's stagger, which is not
// a coincidence worth collapsing into one constant: the two should stay
// independently tunable, because the entrance is the half the user asked to be
// able to watch and the exit only has to be legible.
// Six cards come to 0.34s + 5x120ms = 0.94s, still inside any real AI call.
const RECS_EXIT_STAGGER_MS = 120;
// Must match the `animation` duration on `.rec-card.is-leaving`. Read only by
// the removal backstop below, which needs to know when the last card is done —
// the animation itself is driven entirely by CSS.
const RECS_EXIT_MS = 340;

/**
 * How many cards per row, so the last row is never left nearly empty.
 *
 * `auto-fill` fills each row as far as it will go and strands whatever is left:
 * four cards where three fit render 3 + 1, five cards where four fit render
 * 4 + 1. Both look broken at widths where 2 + 2 and 3 + 2 fit perfectly well
 * (user-raised, 2026-09-09).
 *
 * The fix is the standard balanced-rows formula: how many rows does the widest
 * layout need, then spread the cards evenly over exactly that many. It can never
 * make the grid TALLER, since the row count comes from the widest layout. Where
 * nothing better exists it changes nothing — 5 cards in a 2-column viewport
 * stays 2 + 2 + 1, 3 cards in a 2-column one stays 2 + 1.
 *
 * A CARD'S SIZE NEVER DEPENDS ON HOW MANY CAME BACK (R29). That is why this
 * returns a width as well as a count: the width comes from `fit`, the widest
 * packing the viewport allows, and the count comes from the balancing. One
 * recommendation on a four-wide viewport is one card of the SAME size as any
 * other, centred, with the slack split evenly either side — not one card
 * stretched across the whole column with a poster taller than the window, which
 * is what filling the tracks produced (user-raised, with a screenshot).
 *
 * That decoupling is also what let the balancing lose an earlier restraint.
 * It used to run only when the widest layout would strand a SINGLE card, so
 * six cards where four fit stayed 4 + 2 rather than 3 + 3 — because balancing
 * it then made every card ~36% wider. It no longer can, so 3 + 3 is free and
 * the restraint is gone. See D-051.
 *
 * Reads `--rec-min` and the real `column-gap` off the element instead of
 * repeating them here. The stylesheet owns both numbers; a copy in JS is the
 * shape that goes stale the first time someone changes the CSS.
 */
function balancedLayout(count, grid) {
  const cs = getComputedStyle(grid);
  const gap = parseFloat(cs.columnGap) || 0;
  const min = parseFloat(cs.getPropertyValue('--rec-min')) || 190;
  const max = parseFloat(cs.getPropertyValue('--rec-max')) || 250;
  const avail = grid.parentElement.clientWidth;
  // The +gap on both sides is the standard "n items need n-1 gaps" rearrangement:
  // n*min + (n-1)*gap <= W  ⇔  n <= (W + gap) / (min + gap).
  const fit = Math.max(1, Math.floor((avail + gap) / (min + gap)));
  // The card size, fixed by the viewport alone. Measured off the PARENT, never
  // off the grid itself: the grid's own width is what this function sets, so
  // reading it back would feed the last answer into the next one and ratchet the
  // cards smaller on every resize frame.
  //
  // The cap is what stops a card growing TALL, which is the form the problem
  // actually takes: the poster is `aspect-ratio: 2/3`, so every pixel of extra
  // width costs 1.5 of height. Each time `fit` drops by one the surviving cards
  // inherit the space, and at one-per-row that put a ~585px poster on an 869px
  // window (user-raised, with screenshots either side of all three boundaries).
  // Capping only ever SHRINKS a card, so it can never let more of them fit and
  // `fit` above stays correct.
  const width = Math.min((avail - (fit - 1) * gap) / fit, max);
  const cols = Math.ceil(count / Math.ceil(count / Math.min(count, fit)));
  return { cols, width };
}

/**
 * Set the column count and centre a short last row. Safe to re-run: it clears
 * its own previous placement first, which is what makes it usable from the
 * resize pass as well as from a render.
 */
function layoutRecsGrid() {
  const cards = [...el.recsGrid.querySelectorAll('.rec-card')];
  if (!cards.length) return;
  const { cols, width } = balancedLayout(cards.length, el.recsGrid);
  const gap = parseFloat(getComputedStyle(el.recsGrid).columnGap) || 0;
  el.recsGrid.style.setProperty('--rec-tracks', cols * 2);
  // Cap the grid to exactly the room `cols` cards need, and let its auto margins
  // centre what is left over. Capping the CONTAINER rather than sizing each
  // track keeps `1fr` doing the arithmetic: the tracks divide a width that is
  // already correct, so the doubled-track/half-column machinery is untouched.
  el.recsGrid.style.setProperty('--rec-width', `${cols * width + (cols - 1) * gap}px`);

  // Tracks are doubled (see the CSS), so a card starting one track late is
  // offset by HALF a card — which is exactly what centring a short row needs.
  // A last row of m cards in a k-column grid has k - m columns spare, so it
  // starts (k - m) half-columns in and ends with the same slack on the right.
  // Placing only the FIRST card is enough: the rest auto-place after it.
  cards.forEach((c) => { c.style.gridColumnStart = ''; });
  const inLastRow = cards.length % cols || cols;
  cards[cards.length - inLastRow].style.gridColumnStart = cols - inLastRow + 1;
}

/**
 * Phase one of the two-phase render: fade the previous run's cards out.
 *
 * An exit animation cannot run on a node that has already been removed, so the
 * swap has to happen in two steps rather than one `replaceChildren()`.
 *
 * Deliberately NOT a View Transition, though the backlog entry suggested one and
 * the ranked list uses one for its re-sort (D-031). A View Transition animates
 * ONE atomic old→new swap; here the old cards leave on the click and the new
 * ones arrive seconds later, on the far side of an AI call. Wrapping that gap
 * would hold a snapshot of the whole page frozen for the length of the request,
 * and it could express neither the scroll, the lead-in nor the per-card stagger
 * the user asked for. See D-048.
 *
 * Every child leaves, not only `.rec-card`: the metadata footer describes the
 * run that is being replaced, so it is just as stale.
 */
function exitRecCards() {
  // The metadata footer leaves with the cards — it describes the run being
  // replaced — but it no longer lives in the grid (R29), so it is swept from its
  // own slot rather than falling out of `el.recsGrid.children` for free.
  const leaving = [...el.recsGrid.children, ...el.recsMeta.children];
  if (!leaving.length) return;
  // The reduced-motion block sets `animation: none !important`, so no animation
  // runs and `animationend` NEVER fires — a listener-driven removal would leave
  // the old cards on screen for good. These users get the instant clear that
  // everyone got before this function existed, which is the honest answer
  // anyway: no motion asked for, no motion given.
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.recsGrid.replaceChildren();
    el.recsMeta.replaceChildren();
    return;
  }
  // EVERY NODE IS REMOVED TOGETHER, WHEN THE LAST ANIMATION ENDS — never one at
  // a time as each finishes, which is what this did first and what made the
  // whole thing read as flashing.
  //
  // A `transform` does not affect layout, so a card that is mid-close still
  // occupies its grid cell and nothing moves. Removing it DOES: the grid
  // re-flows, every surviving card slides into the cell before it, and when the
  // count crosses a row boundary the grid loses a row and everything below jumps
  // up by a whole card height. With a stagger that happens five times in under a
  // second, so the cards still closing are being yanked between positions while
  // they close. A screenshot mid-exit showed card 3 alone in the top row while 4,
  // 5 and 6 sat a full row lower, all at different scales — six cards animating
  // in place, on a layout that would not hold still underneath them.
  // Batching the removal makes the exit layout-static from first frame to last.
  let pending = leaving.length;
  const removeAll = () => { for (const n of leaving) n.remove(); };
  for (const node of leaving) {
    node.classList.add('is-leaving');
    node.addEventListener('animationend', (e) => {
      // `animationend` bubbles. Nothing inside a card fires one today (an Add
      // button's spinner is `infinite`, and infinite animations never end), but
      // a child animation added later must not take the whole card with it.
      if (e.target !== node) return;
      if (--pending === 0) removeAll();
    });
  }
  // The cards close one after another, in the order they arrived (R30).
  //
  // WRITING THIS DELAY IS NOT OPTIONAL, even for a zero stagger. Every card is
  // still carrying the INLINE `animationDelay` its entrance was given — up to
  // 400 + 5x120 = 1000ms — and `animation-delay` is one property shared by
  // whichever animation is running. Leave it alone and the last card sits
  // untouched for a second before it starts to close, which looks like a hang
  // rather than a bug and would be miserable to track down.
  //
  // Only the cards are staggered. The footer fades from the same instant, so
  // the section's metadata is already going while the first card is still
  // closing — it describes the run being replaced, not any one card.
  el.recsGrid.querySelectorAll('.rec-card').forEach((card, i) => {
    card.style.animationDelay = `${i * RECS_EXIT_STAGGER_MS}ms`;
  });
  el.recsMeta.querySelectorAll('.ai-meta').forEach((f) => { f.style.animationDelay = '0ms'; });
  // ONE backstop, and batching is what earns it. While each node removed itself,
  // an animation that never ended stranded that node alone; now it would strand
  // the whole set, because the count would never reach zero. This is a safety
  // net rather than the mechanism — it is not cancelled and does not need to be,
  // since `remove()` on an already-detached node is a no-op, which is also what
  // happens when the response lands first and renderRecommendations'
  // `replaceChildren()` gets there before the animations do.
  const longest = (leaving.length - 1) * RECS_EXIT_STAGGER_MS + RECS_EXIT_MS;
  setTimeout(removeAll, longest + 250);
}

function renderRecommendations({ suggestions, emptyReason, meta }) {
  el.recsGrid.replaceChildren();
  if (!suggestions.length) {
    // NOT a caption: nothing follows it, so it is the whole of what this section
    // is saying and reads at full weight (user-raised, 2026-09-09).
    setRecsHint(EMPTY_REASON_TEXT[emptyReason] ?? EMPTY_REASON_TEXT.mixed);
    // R10. The call was really made, really cost money and really is in the audit
    // log, so its metadata belongs on screen exactly as it does after a run that
    // produced cards. Returning before this was the one AI outcome in the app
    // that showed no cost, tokens or duration anywhere.
    // It also carries logLink() already, which is why the message above does NOT
    // get a log link of its own — that would put two on one line.
    el.recsMeta.replaceChildren(aiMetaFooter(meta));
    return;
  }
  // caption: the cards are right underneath it.
  //
  // R22. `#recs-hint` is this section's only live region, so it is the whole of
  // what a screen reader hears about a run. Re-checked once R1 stopped the
  // availability sync wiping it, and the three outcomes were not equal: a
  // FAILURE announces its message and an EMPTY run announces why it was empty,
  // but a SUCCESS announced "Based on: Dune, Heat, Arrival." and never mentioned
  // that six recommendations had arrived. The one outcome that produced content
  // was the one that described only its input.
  // The count goes in a visually-hidden span rather than into the visible copy,
  // which the user settled and which reads correctly for someone who can see the
  // cards. Announcing the CARDS instead was rejected: six live-region updates
  // per run is noise, and the hint is already the established channel.
  const shown = suggestions.length;
  const heard = document.createElement('span');
  heard.className = 'sr-only';
  heard.textContent = ` ${shown} recommendation${shown === 1 ? '' : 's'} below.`;
  setRecsHint(
    [document.createTextNode(`Based on: ${meta.basedOn.join(', ')}.`), heard],
    { caption: true },
  );
  suggestions.forEach((s, i) => {
    // `li`, not `div` (R21) — the grid is a `ul` now. Nothing else about the
    // card changes: a list item is still a grid item, and every rule targets
    // `.rec-card` rather than the tag.
    const card = document.createElement('li');
    card.className = 'rec-card';
    // Stamped on the CARD as well as its button, so syncRecCardBadges() can tell
    // whether this film is rated without depending on the button still being
    // there or still carrying the id (R17).
    card.dataset.tmdbId = s.tmdb_id;
    // The lead-in lives in `animationDelay`, NOT in a setTimeout — there is no
    // timer to leak or cancel if a second run starts. This works only because
    // the CSS fill is `backwards`: each card holds the from-state (invisible,
    // offset) through its whole delay instead of sitting at full opacity and
    // then jumping. That is D-043's mechanism doing real work here, and one more
    // reason the fill must never go back to `both`.
    card.style.animationDelay = `${RECS_LEAD_IN_MS + i * RECS_STAGGER_MS}ms`;
    const poster = posterNode(s.poster_url, s.title);
    const body = document.createElement('div');
    body.className = 'rec-card__body';
    const h3 = document.createElement('h3');
    h3.append(document.createTextNode(s.title + ' '));
    const yr = document.createElement('span');
    yr.className = 'year';
    yr.textContent = s.year ? `(${s.year})` : '';
    h3.append(yr);
    const reason = document.createElement('p');
    reason.className = 'reason';
    reason.textContent = s.reason;
    const btn = document.createElement('button');
    btn.type = 'button';
    // The same three dataset stamps a search row carries, so this button is
    // findable by syncAddButtons() (R3) and so a failed add can name its film in
    // the toast (R4) — addMovie()'s catch reads dataset.title, and without it a
    // rec-card failure fell back to "Couldn't add that film" while the identical
    // failure from a search row named it. `.add-btn` carries no styling here:
    // every rule for that class is scoped to `.result-row`.
    btn.className = 'add-btn';
    btn.dataset.tmdbId = s.tmdb_id;
    btn.dataset.title = s.title;
    // R7, settled by the user: keep the longer wording and prepend the glyph, so
    // the rec card reads "+ Add to my list" against the search row's "+ Add".
    // The two surfaces now share a vocabulary instead of speaking three — rest
    // "+ Add…", busy "⟳ Adding…", settled "✓ Added" / "In your list".
    // THE NBSP IS THE RULE, NOT A DETAIL (CLAUDE.md § Button labels): the plus is
    // glued to "Add" with \u00A0 as an ESCAPE, never a literal character, so it
    // cannot be mistaken for an ordinary space and tidied away. Written in the
    // STRING because the same label renders on two surfaces and only one of them
    // is `white-space: nowrap`. "to my list" may wrap on its spaces — that is
    // explicitly allowed; "+" leaving "Add" is not.
    btn.dataset.addLabel = '+\u00A0Add to my list';
    // Not a hardcoded label: an owned film gets the owned state immediately, and
    // the aria-label now comes from the one place that writes it.
    setAddButtonState(btn, state.ownedTmdbIds.has(s.tmdb_id));
    btn.addEventListener('click', () => addMovie(s.tmdb_id, btn));
    body.append(h3, reason, btn);
    card.append(poster, body);
    el.recsGrid.append(card);
  });
  el.recsMeta.replaceChildren(aiMetaFooter(meta));
  // Cards are built in the not-yet-rated state, which is correct by construction
  // today — R2's owned filter means a film already in the list can never be
  // recommended back, rated or not. Called anyway so the badge's accuracy rests
  // on `state.movies` alone rather than on a server-side filter staying correct.
  syncRecCardBadges();
  // Same synchronous task as the appends above, so the browser never paints a
  // frame at the CSS fallback column count.
  layoutRecsGrid();
  // Gated on there being cards, structurally: the empty branch returns above
  // this line, so a zero-result run can never yank the page to a section with
  // nothing new in it. Every placeholder and every failure gets no scroll and no
  // entrance animation — the user's words, they "shall have no business with any
  // entrance animation".
  //
  // `.recs__head` and not `.recs` or the grid: it is the first thing in the
  // section, so `block: 'start'` lands the heading AND the trigger at the top of
  // the viewport with the hint and the animating cards flowing in below. The
  // grid as a target would push both off-screen. `.recs` resolves to nearly the
  // same place, but only via margin-collapse reasoning — the head says it
  // outright and cannot drift if the section ever gains padding or a border.
  // `start` is also the robust alignment: the content below the target GROWS as
  // the cards render, and a top alignment is unaffected by growth below it,
  // where `center` or `nearest` would drift mid-animation.
  //
  // No `behavior: 'smooth'` — `html { scroll-behavior: smooth }` already says so
  // in CSS, which is precisely what lets the reduced-motion block turn it off.
  el.recsHead.scrollIntoView({ block: 'start' });
}

/* ---------- taste verdict ---------------------------------------- */
/** Drop the meta footer under the verdict (there's no current call to describe). */
function clearVerdictMeta() {
  el.verdict.querySelector('.ai-meta')?.remove();
}

function syncVerdictAvailability() {
  const need = state.cfg.minRatedForVerdict;
  const have = ratedCount();
  if (have < need) {
    el.verdictRefresh.hidden = true;
    clearVerdictMeta();
    el.verdictText.classList.add('is-muted');
    el.verdictText.textContent = `Rate at least ${need} movies to get a verdict (you have ${have}).`;
  } else {
    el.verdictRefresh.hidden = false;
    if (!el.verdict.dataset.generated) {
      el.verdictText.classList.add('is-muted');
      el.verdictText.textContent = 'Tap “New verdict” for an AI-generated read on your taste.';
    }
  }
}

el.verdictRefresh.addEventListener('click', async () => {
  const restoreRefresh = busyButton(el.verdictRefresh);
  clearVerdictMeta(); // the old footer describes the previous call
  el.verdictText.classList.add('is-muted');
  el.verdictText.textContent = 'Consulting the critics…';
  try {
    const { verdict, meta } = await api('/api/taste-verdict', { method: 'POST' });
    el.verdictText.classList.remove('is-muted');
    el.verdictText.textContent = verdict; // plain text, textContent only
    el.verdict.dataset.generated = '1';
    el.verdict.querySelector('.verdict__inner').append(aiMetaFooter(meta));
  } catch (err) {
    el.verdictText.classList.add('is-muted');
    // Quiet fallback (SPEC § 2.3). The log is offered only when the server says a
    // row was actually written — this used to be unconditional, and it also
    // discarded `err.message`, so CineRank being unreachable produced "See the AI
    // call log for details" pointing at a log that could not load either, with
    // the real cause thrown away (R23, D-047).
    // Built from nodes, never innerHTML (CLAUDE.md § Security 4).
    if (err.logged) {
      el.verdictText.replaceChildren(
        document.createTextNode(`${err.message} See the `),
        logLink('AI call log'),
        document.createTextNode(' for details.')
      );
    } else {
      el.verdictText.textContent = err.message;
    }
  } finally {
    restoreRefresh();
  }
});

/* ---------- AI call log ----------------------------------------- */
const fmtCost = (usd) => (usd == null ? '—' : `${(usd * 100).toFixed(2)}¢`);
const fmtDur = (ms) =>
  ms == null ? '—' : ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
const fmtTokens = (n) => (n == null ? '—' : n.toLocaleString());

/**
 * The footer under a generated AI result: one line of call metadata, then a
 * link into the full log. Shared by BOTH features so they can't drift apart.
 * Hoisted, so renderRecommendations (defined earlier) can call it.
 */
/**
 * A link-styled button that opens the AI call log. A button, not an <a>: it
 * performs an action (opens a dialog) rather than navigating anywhere.
 */
function logLink(text) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'log-link';
  b.textContent = text;
  b.addEventListener('click', openAiLog);
  return b;
}

function aiMetaFooter(meta) {
  const foot = document.createElement('div');
  foot.className = 'ai-meta';

  const text = [
    `Prompt: ${meta.promptVersion}`,
    `Model: ${meta.model}`,
    `${fmtTokens(meta.tokensUsed)} tokens`,
    fmtCost(meta.estimatedCostUsd),
    meta.durationMs == null ? '—' : `${meta.durationMs.toLocaleString()} ms`,
  ].join(' · ');

  // Its own element so it can be hidden when the link drops to a new line.
  const sep = document.createElement('span');
  sep.className = 'ai-meta__sep';
  sep.textContent = ' · ';

  // .log-link is inline-block, so it can never break mid-phrase — it moves to
  // the next line as one whole unit.
  const link = logLink('View more details in the AI call log »');

  foot.append(document.createTextNode(text), sep, link);
  // Layout-dependent, so it can only run once the footer is in the document.
  requestAnimationFrame(() => syncMetaSeparator(foot));
  return foot;
}

/**
 * The log link sits inline after the metadata, joined by a "·". When there is
 * no room it drops to its own line (as a whole unit — it is inline-block), and
 * that "·" would be left dangling at the end of the line above. Compare the two
 * boxes' tops to spot it: on one line they share a top, a wrap puts the link a
 * full line lower. CSS has no "did this wrap" selector, hence the measurement.
 *
 * Hidden with visibility, never display: visibility keeps the box, so hiding
 * the separator cannot itself change where the link wraps. With display:none it
 * would oscillate — hide, link now fits, show, link wraps again, hide...
 */
function syncMetaSeparator(foot) {
  const sep = foot.querySelector('.ai-meta__sep');
  const link = foot.querySelector('.log-link');
  if (!sep || !link) return;
  // A few px of tolerance: the inline-block button and the text sit on the same
  // line without necessarily sharing an exact top. A real wrap is a line-height.
  const wrapped = link.getBoundingClientRect().top - sep.getBoundingClientRect().top > 4;
  sep.style.visibility = wrapped ? 'hidden' : 'visible';
}

// One listener for every layout-dependent measurement on the page, rather than
// an observer per element. All of them read geometry (getBoundingClientRect /
// scrollHeight / clientWidth), which forces layout, and `resize` fires
// continuously while a window is dragged — so the work is throttled to at most
// once per frame. rAF
// rather than a debounce on purpose: a debounce would leave both measurements
// visibly stale for the whole drag, where this keeps them live and still does
// the reads only once per painted frame.
//
// Browser zoom fires `resize` too (it changes the CSS viewport), so this covers
// zooming as well as dragging.
let relayoutQueued = false;
window.addEventListener('resize', () => {
  if (relayoutQueued) return;
  relayoutQueued = true;
  requestAnimationFrame(() => {
    relayoutQueued = false;
    document.querySelectorAll('.ai-meta').forEach(syncMetaSeparator);
    syncReviewToggles();
    // How many cards fit is a function of the grid's width, so the balanced
    // split has to be recomputed as the window changes — otherwise a layout
    // chosen at 900px stays put at 400px. Returns immediately when the grid is
    // empty, which is most of the time.
    layoutRecsGrid();
    // An open AI-log reveal panel was positioned for the geometry it opened in,
    // so a resize leaves its side and caret stale. Guarded twice, deliberately:
    //   - only while the dialog is actually OPEN. A closed <dialog> is
    //     `display: none`, so every rect reads zero and the caret would be
    //     written as a nonsense offset.
    //   - only for panels that are themselves OPEN. A closed one must keep its
    //     side so it fades out in place (see the toggle handler).
    // At most one can be open — they share a `name` — so this is one element.
    // Inert below 850px, where the panel is `position: static` and the carets
    // are `display: none`.
    if (el.logDialog.open) {
      document.querySelectorAll('.log-reveal[open]').forEach((d) => d.repositionPanel?.());
    }
  });
});

// A late webfont swap re-flows every review, which can invalidate a measurement
// taken against the fallback face. `display=swap` makes that a real possibility
// on a slow connection, and it resolves immediately when the fonts are already
// cached, so it costs nothing in the common case.
document.fonts?.ready.then(syncReviewToggles);

function cell(text, className, label) {
  const td = document.createElement('td');
  if (className) td.className = className;
  if (label) td.dataset.label = label; // shown as the field label in the narrow card layout
  td.textContent = text;
  return td;
}

// A cell whose short form is an <abbr> carrying the full text in its title
// (dotted underline + hover). In the narrow card layout CSS swaps in the full
// text — there's width for it there.
function abbrCell(short, full, className, label) {
  const td = document.createElement('td');
  if (className) td.className = className;
  if (label) td.dataset.label = label;
  if (!full || short === full) {
    td.textContent = short || '—';
    return td;
  }
  const abbr = document.createElement('abbr');
  abbr.textContent = short;
  abbr.title = full;
  td.append(abbr);
  return td;
}

const FEATURE_ABBR = { Recommendation: 'R', 'Taste verdict': 'TV' };

// "recommend_v3" -> "R_v3", "taste_verdict_v1" -> "TV_v1"
function shortPromptVersion(pv) {
  const m = /^(.+)_v(\d+)$/.exec(pv || '');
  if (!m) return pv || '—';
  const initials = m[1].split('_').map((w) => w[0].toUpperCase()).join('');
  return `${initials}_v${m[2]}`;
}

// Model slugs are long ("anthropic/claude-haiku-4.5") — drop the vendor prefix.
function modelCell(model) {
  if (!model) return abbrCell('—', null, 'log-model', 'Model');
  const slash = model.indexOf('/');
  const short = slash === -1 ? model : model.slice(slash + 1);
  return abbrCell(short, model, 'log-model', 'Model');
}

// Timestamp cell: forced European format (dd/mm/yyyy, 24h) regardless of the
// browser locale, with the date and clock on separate lines to keep the column
// narrow.
function timeCell(iso) {
  const td = document.createElement('td');
  td.className = 'log-time';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    td.textContent = '—';
    return td;
  }
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const dateLine = document.createElement('span');
  dateLine.textContent = `${date},`;
  const timeLine = document.createElement('span');
  timeLine.textContent = time;
  td.append(dateLine, timeLine);
  return td;
}

// Result cell — three shapes (see routes/aiLog.js):
//   failed call      -> the error message, shown inline (short, and you want it
//                       visible when scanning for problems)
//   recommendation   -> "N suggestions", click to reveal the verified title list
//   taste verdict    -> "view verdict", click to reveal the full text
// The reveal is a native <details> so it's keyboard-accessible with no JS; the
// `name` makes the open one close its siblings, keeping the table compact.
function revealDetails(summaryText, bodyNode) {
  const details = document.createElement('details');
  details.className = 'log-reveal';
  details.name = 'ai-log-result';
  const summary = document.createElement('summary');
  summary.textContent = summaryText;
  details.append(summary, bodyNode);

  // The panel normally drops below its trigger; near the bottom of the dialog
  // there isn't room, so flip it above instead. Measured on open rather than
  // done in CSS because the panel's height depends on its content.
  // The measurement, unchanged, lifted out of the handler so the resize pass can
  // re-run it: a panel positioned for the geometry it opened in keeps a stale
  // side and caret if the window is resized while it is open.
  //
  // It stays a closure over the SAME `details` / `summary` / `bodyNode` it always
  // used, and is stashed on the element rather than re-derived from the DOM
  // elsewhere. Re-deriving would have been tidier and is the thing not worth
  // risking here — this way the open path runs byte-identical code on identical
  // variables, so opening a panel cannot behave differently than before.
  const positionPanel = () => {
    details.classList.remove('log-reveal--above');
    const trigger = summary.getBoundingClientRect();
    const view = el.logDialog.getBoundingClientRect();
    const needed = bodyNode.offsetHeight + 12; // panel + the 0.35rem offset
    const below = view.bottom - trigger.bottom;
    const above = trigger.top - view.top;
    // Only flip if below genuinely can't hold it AND above is roomier.
    if (below < needed && above > below) details.classList.add('log-reveal--above');

    // Point the caret at the trigger's centre. The panel is right-aligned and
    // wider than its cell, so this can't be a fixed percentage. Clamped so it
    // never lands on a rounded corner.
    const panel = bodyNode.getBoundingClientRect();
    const centre = trigger.left + trigger.width / 2 - panel.left;
    const x = Math.min(Math.max(centre, 14), panel.width - 14);
    details.style.setProperty('--arrow-x', `${x}px`);
  };
  details.repositionPanel = positionPanel;

  details.addEventListener('toggle', () => {
    // On close, keep whichever side it is on so it fades out in place —
    // clearing the class here would snap it back down mid-fade.
    if (!details.open) return;
    positionPanel();
  });

  return details;
}

function resultCell(r) {
  const td = document.createElement('td');
  td.className = 'log-result';

  if (r.status === 'failed') {
    td.classList.add('log-result--error');
    const err = document.createElement('span');
    err.className = 'log-error';
    err.textContent = r.error_text || 'failed';
    td.append(err);
    return td;
  }

  if (r.feature === 'Recommendation') {
    const titles = r.suggested_titles || [];
    if (!titles.length) {
      td.textContent = 'no suggestions';
      return td;
    }
    const ul = document.createElement('ul');
    for (const t of titles) {
      const li = document.createElement('li');
      li.textContent = t;
      ul.append(li);
    }
    td.append(revealDetails(`${titles.length} suggestion${titles.length === 1 ? '' : 's'}`, ul));
    return td;
  }

  // Taste verdict
  const p = document.createElement('p');
  p.textContent = r.verdict_text || '—';
  td.append(revealDetails('view verdict', p));
  return td;
}

async function renderAiLog() {
  el.logBody.replaceChildren();
  el.logFoot.replaceChildren();
  const loading = document.createElement('tr');
  const ld = document.createElement('td');
  ld.colSpan = 9;
  ld.className = 'log-empty';
  ld.append(spinnerNode(), document.createTextNode(' Loading…'));
  loading.append(ld);
  el.logBody.append(loading);

  let data;
  try {
    data = await api('/api/ai-log');
  } catch (err) {
    el.logBody.replaceChildren();
    const tr = document.createElement('tr');
    const td = cell(failureText('Couldn’t load the log', err), 'log-empty');
    td.colSpan = 9;
    tr.append(td);
    el.logBody.append(tr);
    return;
  }

  el.logBody.replaceChildren();
  if (!data.rows.length) {
    const tr = document.createElement('tr');
    const td = cell('No AI calls logged yet — run a recommendation or a taste verdict.', 'log-empty');
    td.colSpan = 9;
    tr.append(td);
    el.logBody.append(tr);
    return;
  }

  for (const r of data.rows) {
    const tr = document.createElement('tr');

    tr.append(abbrCell(FEATURE_ABBR[r.feature] || r.feature, r.feature, 'log-feature', 'Feature'));
    tr.append(abbrCell(shortPromptVersion(r.prompt_version), r.prompt_version || '—', 'log-prompt', 'Prompt'));
    tr.append(modelCell(r.model_used));

    const tok = document.createElement('td');
    tok.className = r.tokens_used == null ? 'num log-empty-val' : 'num';
    tok.dataset.label = 'Tokens';
    tok.textContent = fmtTokens(r.tokens_used);
    if (r.prompt_tokens != null || r.completion_tokens != null) {
      const sub = document.createElement('span');
      sub.className = 'sub';
      sub.textContent = `${r.prompt_tokens ?? '?'} in / ${r.completion_tokens ?? '?'} out`;
      tok.append(sub);
    }
    tr.append(tok);

    tr.append(cell(fmtCost(r.estimated_cost_usd),
      r.estimated_cost_usd == null ? 'num log-empty-val' : 'num', 'Cost'));
    tr.append(cell(fmtDur(r.duration_ms), 'num', 'Duration'));

    const st = document.createElement('td');
    st.dataset.label = 'Status';
    const badge = document.createElement('span');
    badge.className = `log-badge ${r.status === 'failed' ? 'fail' : 'ok'}`;
    badge.textContent = r.status;
    st.append(badge);
    tr.append(st);

    const rc = resultCell(r);
    rc.dataset.label = 'Result';
    tr.append(rc);

    const tc = timeCell(r.created_at);
    tc.dataset.label = 'Time';
    tr.append(tc);

    el.logBody.append(tr);
  }

  const t = data.totals;
  const footRow = document.createElement('tr');
  footRow.className = 'log-total';
  const label = cell(`Total · ${t.calls} call${t.calls === 1 ? '' : 's'}`, 'log-total__label');
  label.colSpan = 3;
  footRow.append(label);

  // Totals mirror a data row: tokens with the in/out split beneath, then cost
  // and total duration. `totals.detailed` / `.timed` are still returned by the
  // API but deliberately not surfaced — see docs/DECISIONS.md D-018.
  const tokTotal = document.createElement('td');
  tokTotal.className = 'num';
  tokTotal.dataset.label = 'Total tokens';
  tokTotal.textContent = fmtTokens(t.tokens);
  if (t.detailed) {
    const sub = document.createElement('span');
    sub.className = 'sub';
    sub.textContent = `${fmtTokens(t.promptTokens)} in / ${fmtTokens(t.completionTokens)} out`;
    tokTotal.append(sub);
  }
  footRow.append(tokTotal);

  footRow.append(cell(fmtCost(t.cost), 'num', 'Total cost'));
  footRow.append(cell(t.timed ? fmtDur(t.durationMs) : '—', 'num', 'Total duration'));

  // Fills the trailing gap and says what the Duration total actually is: the
  // sum of per-call round trips to OpenRouter, which is a small fraction of the
  // elapsed time between the first and last call.
  const rest = document.createElement('td');
  rest.colSpan = 3;
  rest.className = 'log-total__pad';
  rest.textContent = '(summed model latency, not elapsed time)';
  footRow.append(rest);
  el.logFoot.append(footRow);
}

function openAiLog() {
  el.logDialog.showModal();
  renderAiLog();
}
el.openLog.addEventListener('click', openAiLog);
el.logClose.addEventListener('click', () => el.logDialog.close());

// A reveal panel stays open until you click outside it — clicking its own text
// keeps it up (so it can be selected/copied); a click anywhere else collapses it.
document.addEventListener('click', (e) => {
  el.logDialog
    .querySelectorAll('details.log-reveal[open]')
    .forEach((d) => {
      if (!d.contains(e.target)) d.open = false;
    });
});

/* ---------- the verdict ring's glint ------------------------------ */
// Pause the sheen while the banner is off-screen.
//
// The glint animates `stroke-dashoffset` across twenty layered dashes, and that
// is a PAINT property -- it cannot be handed to the compositor the way a
// transform can, so every frame re-rasterises those strokes and the halo filter
// on top of them. Measured cost is nil on ordinary hardware and small even on
// heavily throttled software rendering (the figures are recorded at
// `.verdict__sheen rect` in styles.css), so this is not fixing a reported
// problem. It is that the banner sits at the very top of a page whose actual
// content is the ranked list below it, so anyone scrolled down is paying for an
// animation they cannot see -- battery and thermals on a phone, mostly.
//
// `animation-play-state: paused` FREEZES the dash where it is and resumes from
// there, so scrolling back finds the band where it left off. That matters more
// than it sounds: the twenty layers are kept in register by phase offsets
// (negative `animation-delay`), so anything that restarted them independently
// would pull the taper apart. Pausing cannot, because it stops and starts them
// all together.
//
// threshold 0, so it pauses only once the banner is COMPLETELY out of view --
// never while a sliver of it is still on screen.
//
// Feature-detected. An engine without IntersectionObserver keeps the animation
// running, which is exactly today's behaviour, so the fallback is the status quo
// rather than a broken state. The observer is deliberately never disconnected:
// it watches one element that lives as long as the document, so there is nothing
// to leak and nothing to tear down.
function pauseSheenOffscreen() {
  const banner = document.getElementById('verdict');
  if (!banner || typeof IntersectionObserver !== 'function') return;
  new IntersectionObserver(
    ([entry]) => banner.classList.toggle('is-offscreen', !entry.isIntersecting),
    { threshold: 0 },
  ).observe(banner);
}

/* ---------- boot ------------------------------------------------- */
(async function init() {
  // Both AI triggers get the sparkle. Injected here, before anything can put a
  // button into its busy state: `busyButton()` snapshots `childNodes` and
  // restores them on settle, so the icon has to already be there when that
  // snapshot is taken or it would not come back.
  el.recsTrigger.prepend(sparkleNode());
  el.verdictRefresh.prepend(sparkleNode());
  pauseSheenOffscreen();
  try {
    state.cfg = await api('/api/config');
  } catch { /* keep defaults */ }
  try {
    await loadMovies();
  } catch (err) {
    toast(failureText('Couldn’t load your movies', err), true);
  }
})();
