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
  rateDialog: $('#rate-dialog'),
  rateForm: $('#rate-form'),
  rateTitle: $('#rate-title'),
  rateRange: $('#rate-range'),
  rateOutput: $('#rate-output'),
  rateReview: $('#rate-review'),
  rateCancel: $('#rate-cancel'),
  openLog: $('#open-log'),
  logDialog: $('#log-dialog'),
  logClose: $('#log-close'),
  logBody: $('#log-body'),
  logFoot: $('#log-foot'),
  toast: $('#toast'),
};

const state = {
  movies: [],
  cfg: { minRatedForRecommendations: 3, minRatedForVerdict: 2, topN: 5 },
  ownedTmdbIds: new Set(),
  editing: null,
  editingIsNew: false, // the rate dialog is for a film added seconds ago
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
    throw new Error('Couldn’t reach CineRank. Check your connection and try again.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
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

function posterNode(url, title) {
  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = `${title} — poster`;
    img.loading = 'lazy';
    return img;
  }
  const ph = document.createElement('div');
  ph.className = 'noposter';
  ph.setAttribute('role', 'img');
  ph.setAttribute('aria-label', `${title} — no poster available`);
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
  busy.textContent = ' ' + busyLabel;
  btn.replaceChildren(spinnerNode(), busy);
  // Ends the busy state. With no argument the button goes back exactly as it
  // was, enabled. Pass text to settle on a new label instead and stay disabled —
  // for an action that cannot be repeated ("Added ✓", "In your list").
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

/* ---------- ranked list ------------------------------------------------- */
function renderRanked() {
  el.rankedList.replaceChildren();
  const count = state.movies.length;
  el.rankedCount.textContent = count ? `${count} film${count === 1 ? '' : 's'} · ${ratedCount()} rated` : '';
  el.rankedEmpty.hidden = count > 0;

  state.movies.forEach((m, i) => {
    const li = document.createElement('li');
    li.className = 'movie-card';
    li.style.animationDelay = `${Math.min(i * 45, 400)}ms`;

    const rank = document.createElement('div');
    rank.className = 'movie-card__rank';
    rank.textContent = String(i + 1);

    const poster = posterNode(m.poster_url, m.title);
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
    if (m.rating == null) {
      const u = document.createElement('p');
      u.className = 'unrated';
      u.textContent = 'Not rated yet — rate it to place it in the ranking.';
      body.append(u);
    } else if (m.review) {
      const r = document.createElement('p');
      r.className = 'review';
      r.id = `review-${m.id}`;
      r.textContent = m.review;
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'review-toggle';
      toggle.hidden = true; // shown after layout only if the text actually clips
      toggle.textContent = 'view more…';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', r.id);
      toggle.addEventListener('click', () => {
        const expanded = r.classList.toggle('expanded');
        toggle.textContent = expanded ? 'show less' : 'view more…';
        toggle.setAttribute('aria-expanded', String(expanded));
      });
      body.append(r, toggle);
    }

    const score = document.createElement('div');
    score.className = 'movie-card__score';
    if (m.rating != null) {
      const badge = document.createElement('div');
      badge.className = 'score-badge';
      badge.append(document.createTextNode(m.rating.toFixed(1) + ' '));
      const s = document.createElement('small');
      s.textContent = '/10';
      badge.append(s);
      score.append(badge);
    }
    const actions = document.createElement('div');
    actions.className = 'card-actions';
    const rateBtn = document.createElement('button');
    rateBtn.type = 'button';
    rateBtn.textContent = m.rating == null ? 'Rate' : 'Edit';
    rateBtn.setAttribute('aria-label', `${m.rating == null ? 'Rate' : 'Edit rating for'} ${m.title}`);
    rateBtn.addEventListener('click', () => openRate(m));
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'danger';
    delBtn.textContent = 'Remove';
    delBtn.setAttribute('aria-label', `Remove ${m.title} from your ranking`);
    delBtn.addEventListener('click', () => removeMovie(m));
    actions.append(rateBtn, delBtn);
    score.append(actions);

    li.append(rank, poster, body, score);
    el.rankedList.append(li);
  });

  // Reveal a "view more" toggle only for reviews whose text is actually clipped.
  requestAnimationFrame(() => {
    el.rankedList.querySelectorAll('.review').forEach((p) => {
      const toggle = p.nextElementSibling;
      if (toggle?.classList.contains('review-toggle') && p.scrollHeight - p.clientHeight > 4) {
        toggle.hidden = false;
      }
    });
  });
}

async function loadMovies() {
  const { movies } = await api('/api/movies');
  state.movies = movies;
  state.ownedTmdbIds = new Set(movies.map((m) => m.tmdb_id));
  renderRanked();
  syncSearchResultButtons();
  syncRecommendationsAvailability();
  syncVerdictAvailability();
}

/* ---------- search + add ---------------------------------------------- */
/** Hide and empty the results panel — it should not outlive its query. */
function closeSearchResults() {
  el.searchResults.hidden = true;
  el.searchResults.replaceChildren();
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
  const settle = busyButton(el.searchBtn, 'Searching…');
  el.searchResults.replaceChildren(makeLoading('Searching…'));
  try {
    const { results } = await api(`/api/movies/search?q=${encodeURIComponent(q)}`);
    renderSearchResults(results);
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
  btn.textContent = !owned ? '+ Add' : btn.dataset.justAdded ? '✓ Added' : 'In your list';
  btn.setAttribute(
    'aria-label',
    owned ? `${title} is already in your list` : `Add ${title} to your list`,
  );
  btn.disabled = owned;
}

// Results already on screen go stale the moment the list changes: adding one
// film used to update only the button that was clicked, leaving every other
// row still offering "Add" for something now owned. Called from loadMovies(),
// so removals re-open the offer too. No-op when the panel is closed.
function syncSearchResultButtons() {
  el.searchResults.querySelectorAll('.add-btn[data-tmdb-id]').forEach((btn) => {
    // Skip a button mid-request: addMovie() awaits loadMovies(), which calls
    // this, so writing textContent here would wipe the spinner out of the very
    // button that is still waiting on its own response.
    if (btn.getAttribute('aria-busy') === 'true') return;
    setAddButtonState(btn, state.ownedTmdbIds.has(Number(btn.dataset.tmdbId)));
  });
}

function renderSearchResults(results) {
  el.searchResults.replaceChildren();
  if (!results.length) {
    // searchNote, not makeError: a search that matched nothing is an empty
    // state, not a failure, and crimson said otherwise.
    el.searchResults.append(searchNote('No matches — try a different title.'));
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
    span.textContent = [r.year, r.tmdb_rating ? `TMDB ${r.tmdb_rating}` : null].filter(Boolean).join(' · ');
    meta.append(strong, span);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'add-btn';
    btn.dataset.tmdbId = r.tmdb_id; // so syncSearchResultButtons() can find it
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
    settle?.('✓ Added');
    // The panel deliberately STAYS open. Closing it here made "✓ Added"
    // impossible to ever see, and made syncSearchResultButtons() pointless —
    // there would be no other rows left on screen to re-sync. Keeping it lets
    // you add a second film from the same results instead of re-searching.
    // Prompt to rate the movie right away; "Skip for now" leaves it unrated.
    const fresh = state.movies.find((m) => m.id === movie.id);
    if (fresh) openRate(fresh, { isNew: true });
  } catch (err) {
    toast(err.message, true); // "Already in your list" surfaces here (SPEC § 3.4)
    // Already owned is not retryable, so settle there; anything else is, so
    // restore the button as it was (enabled, reading "Add").
    settle?.(err.message.includes('Already') ? 'In your list' : undefined);
  }
}

/* ---------- rate / remove ------------------------------------------- */
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
    if (state.editingIsNew) toast(`Added “${movie.title}” — rate it any time.`);
    return;
  }
  try {
    await api(`/api/movies/${movie.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rating: Number(el.rateRange.value),
        review: el.rateReview.value.trim(),
      }),
    });
    await loadMovies();
    toast(`Saved — ranking updated.`);
  } catch (err) {
    toast(err.message, true);
  }
});

async function removeMovie(movie) {
  if (!confirm(`Remove “${movie.title}” from your ranking?`)) return;
  try {
    await api(`/api/movies/${movie.id}`, { method: 'DELETE' });
    await loadMovies();
    toast('Removed.');
  } catch (err) {
    toast(err.message, true);
  }
}

/* ---------- recommendations --------------------------------------- */
function syncRecommendationsAvailability() {
  const need = state.cfg.minRatedForRecommendations;
  const have = ratedCount();
  const ok = have >= need;
  el.recsTrigger.disabled = !ok;
  el.recsHint.classList.remove('err');
  el.recsHint.textContent = ok
    ? `Uses your top ${state.cfg.topN} rated films as taste signal. Every pick is verified against TMDB.`
    : `Rate at least ${need} movies to unlock recommendations (you have ${have}).`;
}

el.recsTrigger.addEventListener('click', async () => {
  const restoreTrigger = busyButton(el.recsTrigger);
  el.recsHint.classList.remove('err');
  el.recsHint.textContent = 'Pulling your top films → sending a versioned prompt → cross-checking each pick against TMDB…';
  el.recsGrid.replaceChildren();
  try {
    const data = await api('/api/recommendations', { method: 'POST' });
    renderRecommendations(data);
  } catch (err) {
    el.recsHint.classList.add('err');
    el.recsHint.textContent = err.message; // calm inline message (SPEC § 3.4)
  } finally {
    restoreTrigger();
    syncRecommendationsAvailability();
  }
});

function renderRecommendations({ suggestions, meta }) {
  el.recsGrid.replaceChildren();
  if (!suggestions.length) {
    el.recsHint.textContent = 'No new suggestions this time — the model only named films already in your list.';
    return;
  }
  el.recsHint.textContent = `Based on: ${meta.basedOn.join(', ')}.`;
  suggestions.forEach((s, i) => {
    const card = document.createElement('div');
    card.className = 'rec-card';
    card.style.animationDelay = `${i * 60}ms`;
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
    btn.textContent = 'Add to my list';
    btn.setAttribute('aria-label', `Add ${s.title} to my list`);
    btn.addEventListener('click', () => addMovie(s.tmdb_id, btn));
    body.append(h3, reason, btn);
    card.append(poster, body);
    el.recsGrid.append(card);
  });
  el.recsGrid.append(aiMetaFooter(meta));
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
      el.verdictText.textContent = 'Tap “New verdict” for a candid read on your taste.';
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
    // Quiet fallback (SPEC § 2.3) — but the failed call IS in the log, so say
    // where to look. Built from nodes, never innerHTML (CLAUDE.md § Security 4).
    el.verdictText.replaceChildren(
      document.createTextNode('Couldn’t come up with a verdict right now. See the '),
      logLink('AI call log'),
      document.createTextNode(' for details')
    );
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

// One listener for the page rather than an observer per footer — there are at
// most two on screen and they only need re-checking when the width changes.
window.addEventListener('resize', () => {
  document.querySelectorAll('.ai-meta').forEach(syncMetaSeparator);
});

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
  details.addEventListener('toggle', () => {
    // On close, keep whichever side it is on so it fades out in place —
    // clearing the class here would snap it back down mid-fade.
    if (!details.open) return;
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
    const td = cell(`Couldn't load the log: ${err.message}`, 'log-empty');
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

/* ---------- boot ------------------------------------------------- */
(async function init() {
  try {
    state.cfg = await api('/api/config');
  } catch { /* keep defaults */ }
  try {
    await loadMovies();
  } catch (err) {
    toast('Could not load your movies: ' + err.message, true);
  }
})();
