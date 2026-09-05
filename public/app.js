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
};

/* ---------- helpers ------------------------------------------------------- */
async function api(path, options) {
  const res = await fetch(path, options);
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
  syncRecommendationsAvailability();
  syncVerdictAvailability();
}

/* ---------- search + add ---------------------------------------------- */
el.searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = el.searchInput.value.trim();
  if (!q) return;
  el.searchResults.hidden = false;
  el.searchResults.replaceChildren(makeLoading('Searching…'));
  try {
    const { results } = await api(`/api/movies/search?q=${encodeURIComponent(q)}`);
    renderSearchResults(results);
  } catch (err) {
    el.searchResults.replaceChildren(makeError(err.message));
  }
});

function makeLoading(label) {
  const d = document.createElement('div');
  d.style.padding = '1rem';
  d.style.color = 'var(--ink-dim)';
  d.append(spinnerNode(), document.createTextNode(' ' + label));
  return d;
}
function makeError(msg) {
  const d = document.createElement('div');
  d.style.padding = '1rem';
  d.style.color = 'var(--crimson)';
  d.textContent = msg;
  return d;
}

function renderSearchResults(results) {
  el.searchResults.replaceChildren();
  if (!results.length) {
    el.searchResults.append(makeError('No matches — try a different title.'));
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
    const owned = state.ownedTmdbIds.has(r.tmdb_id);
    btn.textContent = owned ? 'In your list' : 'Add';
    btn.setAttribute('aria-label', owned ? `${r.title} is already in your list` : `Add ${r.title} to your list`);
    btn.disabled = owned;
    btn.addEventListener('click', () => addMovie(r.tmdb_id, btn));
    row.append(poster, meta, btn);
    row.addEventListener('click', (e) => { if (e.target === btn) return; });
    el.searchResults.append(row);
  }
}

async function addMovie(tmdbId, btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Adding…'; }
  try {
    const { movie } = await api('/api/movies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tmdb_id: tmdbId }),
    });
    await loadMovies();
    if (btn) btn.textContent = 'Added ✓';
    // Prompt to rate the movie right away; "Skip for now" leaves it unrated.
    const fresh = state.movies.find((m) => m.id === movie.id);
    if (fresh) openRate(fresh, { isNew: true });
  } catch (err) {
    toast(err.message, true); // "Already in your list" surfaces here (SPEC § 3.4)
    if (btn) { btn.disabled = err.message.includes('Already'); btn.textContent = err.message.includes('Already') ? 'In your list' : 'Add'; }
  }
}

/* ---------- rate / remove ------------------------------------------- */
function openRate(movie, { isNew = false } = {}) {
  state.editing = movie;
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
  if (action !== 'save') return;
  const movie = state.editing;
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
  el.recsTrigger.disabled = true;
  el.recsTrigger.setAttribute('aria-busy', 'true');
  const original = el.recsTrigger.textContent;
  el.recsTrigger.replaceChildren(spinnerNode(), document.createTextNode(' Thinking…'));
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
    el.recsTrigger.disabled = false;
    el.recsTrigger.removeAttribute('aria-busy');
    el.recsTrigger.textContent = original;
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
  const foot = document.createElement('div');
  foot.className = 'recs__meta';
  foot.textContent =
    `Logged to recommendation_logs · prompt ${meta.promptVersion} · model ${meta.model} · ` +
    `${meta.tokensUsed ?? '?'} tokens · ~$${meta.estimatedCostUsd ?? '?'}`;
  el.recsGrid.append(foot);
}

/* ---------- taste verdict ---------------------------------------- */
function syncVerdictAvailability() {
  const need = state.cfg.minRatedForVerdict;
  const have = ratedCount();
  if (have < need) {
    el.verdictRefresh.hidden = true;
    el.verdictText.classList.add('is-muted');
    el.verdictText.textContent = `Rate at least ${need} movies to get a verdict (you have ${have}).`;
  } else {
    el.verdictRefresh.hidden = false;
    if (!el.verdict.dataset.generated) {
      el.verdictText.classList.add('is-muted');
      el.verdictText.textContent = 'Tap “New verdict” for a (probably unflattering) read on your taste.';
    }
  }
}

el.verdictRefresh.addEventListener('click', async () => {
  el.verdictRefresh.disabled = true;
  el.verdictRefresh.setAttribute('aria-busy', 'true');
  el.verdictText.classList.add('is-muted');
  el.verdictText.textContent = 'Consulting the critics…';
  try {
    const { verdict } = await api('/api/taste-verdict', { method: 'POST' });
    el.verdictText.classList.remove('is-muted');
    el.verdictText.textContent = verdict; // plain text, textContent only
    el.verdict.dataset.generated = '1';
  } catch (err) {
    el.verdictText.classList.add('is-muted');
    el.verdictText.textContent = 'Couldn’t come up with a verdict right now.'; // quiet fallback (SPEC § 2.3)
  } finally {
    el.verdictRefresh.disabled = false;
    el.verdictRefresh.removeAttribute('aria-busy');
  }
});

/* ---------- AI call log ----------------------------------------- */
const fmtCost = (usd) => (usd == null ? '—' : `${(usd * 100).toFixed(2)}¢`);
const fmtDur = (ms) =>
  ms == null ? '—' : ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
const fmtTokens = (n) => (n == null ? '—' : n.toLocaleString());

function cell(text, className, label) {
  const td = document.createElement('td');
  if (className) td.className = className;
  if (label) td.dataset.label = label; // shown as the field label in the narrow card layout
  td.textContent = text;
  return td;
}

// Model slugs are long ("anthropic/claude-haiku-4.5"). Show just the part after
// the vendor "/", wrapped in <abbr> so the full string is one hover away and the
// dotted underline signals it's shortened.
function modelCell(model) {
  const td = document.createElement('td');
  td.className = 'log-model';
  if (!model) {
    td.textContent = '—';
    return td;
  }
  const slash = model.indexOf('/');
  const abbr = document.createElement('abbr');
  abbr.textContent = slash === -1 ? model : model.slice(slash + 1);
  abbr.title = model;
  td.append(abbr);
  return td;
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
  return details;
}

function resultCell(r) {
  const td = document.createElement('td');
  td.className = 'log-result';

  if (r.status === 'failed') {
    td.classList.add('log-result--error');
    td.textContent = r.error_text || 'failed';
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

    tr.append(cell(r.feature, 'log-feature', 'Feature'));
    tr.append(cell(r.prompt_version || '—', null, 'Prompt'));

    const mdl = modelCell(r.model_used);
    mdl.dataset.label = 'Model';
    tr.append(mdl);

    const tok = document.createElement('td');
    tok.className = 'num';
    tok.dataset.label = 'Tokens';
    tok.textContent = fmtTokens(r.tokens_used);
    if (r.prompt_tokens != null || r.completion_tokens != null) {
      const sub = document.createElement('span');
      sub.className = 'sub';
      sub.textContent = `${r.prompt_tokens ?? '?'} in / ${r.completion_tokens ?? '?'} out`;
      tok.append(sub);
    }
    tr.append(tok);

    tr.append(cell(fmtCost(r.estimated_cost_usd), 'num', 'Cost'));
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

  const footRow = document.createElement('tr');
  footRow.className = 'log-total';
  const label = cell(`Total · ${data.totals.calls} call(s)`, 'log-total__label');
  label.colSpan = 3;
  footRow.append(label);
  footRow.append(cell(fmtTokens(data.totals.tokens), 'num', 'Total tokens'));
  footRow.append(cell(fmtCost(data.totals.cost), 'num', 'Total cost'));
  const rest = document.createElement('td');
  rest.colSpan = 4;
  rest.className = 'log-total__pad';
  footRow.append(rest);
  el.logFoot.append(footRow);
}

el.openLog.addEventListener('click', () => {
  el.logDialog.showModal();
  renderAiLog();
});
el.logClose.addEventListener('click', () => el.logDialog.close());

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
