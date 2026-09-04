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

function posterNode(url, alt) {
  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = alt;
    img.loading = 'lazy';
    return img;
  }
  const ph = document.createElement('div');
  ph.className = 'noposter';
  return ph;
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
      r.textContent = m.review;
      body.append(r);
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
    rateBtn.textContent = m.rating == null ? 'Rate' : 'Edit';
    rateBtn.addEventListener('click', () => openRate(m));
    const delBtn = document.createElement('button');
    delBtn.className = 'danger';
    delBtn.textContent = 'Remove';
    delBtn.addEventListener('click', () => removeMovie(m));
    actions.append(rateBtn, delBtn);
    score.append(actions);

    li.append(rank, poster, body, score);
    el.rankedList.append(li);
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
  const s = document.createElement('span');
  s.className = 'spinner';
  d.append(s, document.createTextNode(' ' + label));
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
    btn.className = 'add-btn';
    const owned = state.ownedTmdbIds.has(r.tmdb_id);
    btn.textContent = owned ? 'In your list' : 'Add';
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
  const original = el.recsTrigger.textContent;
  el.recsTrigger.innerHTML = '<span class="spinner"></span> Thinking…';
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
    const h4 = document.createElement('h4');
    h4.append(document.createTextNode(s.title + ' '));
    const yr = document.createElement('span');
    yr.className = 'year';
    yr.textContent = s.year ? `(${s.year})` : '';
    h4.append(yr);
    const reason = document.createElement('p');
    reason.className = 'reason';
    reason.textContent = s.reason;
    const btn = document.createElement('button');
    btn.textContent = 'Add to my list';
    btn.addEventListener('click', () => addMovie(s.tmdb_id, btn));
    body.append(h4, reason, btn);
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
  }
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
