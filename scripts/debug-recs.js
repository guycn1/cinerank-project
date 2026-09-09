/**
 * CineRank — recommendation UI debug harness. DEV ONLY.
 *
 * This file is never loaded by the app. Open the CineRank page, paste the whole
 * file into the browser console, then:
 *
 *     debugRecs(4)                     // "Get recommendations" renders 4 dummy cards
 *     debugRecs(6)                     // ...or 6. Valid range is 1–6.
 *     debugRecs(2, { posters: false }) // exercise the .noposter placeholder instead
 *     debugRecs(3, { delayMs: 2500 })  // a longer fake round trip
 *
 * Six really is the ceiling: parseModelJson() ends in `.slice(0, 6)`, so no
 * response can ever carry more than six suggestions.
 *
 * WHY IT EXISTS. Judging the grid's column split, the entrance stagger, the
 * scroll and the hover glow needs many runs at many window widths, and every one
 * of those spent real OpenRouter credit on an answer nobody read.
 *
 * WHAT IT COSTS: nothing. No OpenRouter call, no TMDB verification, and no row
 * in recommendation_logs — the request never leaves the browser.
 *
 * HOW IT WORKS, and why it is done this way. It replaces `window.fetch` and
 * answers `POST /api/recommendations` itself, with a body shaped exactly like
 * the real route's. Everything downstream then runs for real and unmodified:
 * the busy button, the exit animation, renderRecommendations(), the balanced
 * column count, the centred last row, the per-card stagger, the scroll, the
 * metadata footer, the hint. That is the whole point — a harness that reached
 * into the render would be testing itself rather than the app. Nothing else is
 * intercepted, so the ranked list, search and the AI call log stay live.
 *
 * TO STOP: reload the page. Nothing is written to localStorage or anywhere else.
 *
 * Not a Node script despite living beside one — it is only ever pasted into a
 * browser console, so package.json's "type": "module" never applies to it.
 */
(() => {
  // Survives a second paste: capture the ORIGINAL fetch once, so re-pasting
  // cannot wrap an already-wrapped one.
  window.__debugRecsRealFetch = window.__debugRecsRealFetch || window.fetch.bind(window);
  const realFetch = window.__debugRecsRealFetch;

  const TITLES = [
    // Deliberately uneven: a very short title, a very long one, and four
    // ordinary ones — title wrapping is part of what the grid work is about.
    { title: 'Solaris Drift', year: 1997 },
    { title: 'The Unremembered Winter of Halloway House', year: 2016 },
    { title: 'Nine', year: 1971 },
    { title: 'Cold Harbour', year: 2009 },
    { title: 'A Perfectly Ordinary Catastrophe', year: 2022 },
    { title: 'Vantage', year: 1984 },
  ];

  // 8–16 words each, second person — the shape recommend_v3 actually asks for,
  // so the 5-line clamp on .reason is exercised the way it will be in real use.
  const REASONS = [
    'You reward films that trust silence, and this one barely raises its voice.',
    'Your highest scores lean bleak and procedural; this is both, with far better weather.',
    'Short, mean and structural — the register your top ratings keep coming back to.',
    'You liked the slow builds, and this one holds its nerve for ninety minutes.',
    'A comedy that shares your taste for disaster observed from much too close.',
    'Genre furniture rearranged with real care, which is what you keep scoring highest.',
  ];

  // A data URI, not a TMDB image: it needs no network at all, cannot 404 mid-test,
  // and carries the card's index — which makes the entrance stagger readable at a
  // glance. Same 2/3 aspect ratio as a real poster, so the layout is identical.
  const poster = (n) => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600">' +
      '<rect width="400" height="600" fill="#14141b"/>' +
      '<rect x="14" y="14" width="372" height="572" fill="none" stroke="#26262f" stroke-width="2"/>' +
      '<text x="200" y="345" text-anchor="middle" font-family="Georgia, serif" ' +
      'font-size="200" fill="#f5c15b" opacity="0.8">' + n + '</text>' +
      '<text x="200" y="430" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" ' +
      'font-size="24" fill="#8d8a83" letter-spacing="3">DUMMY</text>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };

  const state = { count: 6, posters: true, delayMs: 900 };

  function body() {
    return {
      suggestions: Array.from({ length: state.count }, (_, i) => ({
        // NEGATIVE ids, deliberately: TMDB ids are positive, so a dummy can never
        // collide with a real film, can never look "already owned", and is
        // trivially recognisable in the Add interception below.
        tmdb_id: -(i + 1),
        title: TITLES[i].title,
        year: TITLES[i].year,
        poster_url: state.posters ? poster(i + 1) : null,
        reason: REASONS[i],
      })),
      // Null whenever there are cards — the client only reads it in the empty
      // branch, and this harness never produces one.
      emptyReason: null,
      meta: {
        promptVersion: 'recommend_v3',
        model: 'anthropic/claude-haiku-4.5',
        tokensUsed: 1284,
        estimatedCostUsd: 0.00042,
        durationMs: 3140,
        // Five, because topN is 5 — the "Based on: …" line's real length matters
        // to the layout being judged.
        basedOn: ['Saw 3D', 'Saw II', 'Cat People', 'Suspiria', 'The Thing'],
      },
    };
  }

  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  window.fetch = async (input, init) => {
    const url = String(input && input.url ? input.url : input);
    const method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();

    if (method === 'POST' && url.includes('/api/recommendations')) {
      // A real run takes seconds. Answering instantly would hide the busy button,
      // the spinner, the progress hint and the exit animation — all of which
      // happen while the request is in flight.
      await new Promise((r) => setTimeout(r, state.delayMs));
      // The availability check in the run's `finally` re-disables the trigger
      // when fewer than 3 films are rated. Harmless in normal use; here it would
      // let you press the button exactly once. A macrotask runs after that whole
      // synchronous tail, so this puts it back.
      setTimeout(() => {
        const t = document.querySelector('#recs-trigger');
        if (t && t.getAttribute('aria-busy') !== 'true') t.disabled = false;
      }, 0);
      return json(body());
    }

    // Adding a dummy card would POST a negative tmdb_id to the real server, which
    // would go looking for it on TMDB. Refused here instead, with a message that
    // says why — the button's busy → error path still runs, and the database is
    // never touched.
    if (method === 'POST' && url.includes('/api/movies')) {
      let payload = {};
      try { payload = JSON.parse((init && init.body) || '{}'); } catch { /* not ours */ }
      if (Number(payload.tmdb_id) < 0) {
        return json({ error: 'This is a debugRecs dummy card, so nothing was saved.' }, 400);
      }
    }

    return realFetch(input, init);
  };

  window.debugRecs = (n = 6, options = {}) => {
    const count = Math.trunc(Number(n));
    if (!Number.isFinite(count) || count < 1 || count > 6) {
      console.error('debugRecs(n): n must be 1–6 (parseModelJson slices at 6).');
      return;
    }
    state.count = count;
    if (options.posters !== undefined) state.posters = !!options.posters;
    if (options.delayMs !== undefined) state.delayMs = Number(options.delayMs) || 0;

    const trigger = document.querySelector('#recs-trigger');
    if (trigger) trigger.disabled = false;

    console.log(
      `debugRecs: "Get recommendations" will now render ${count} dummy card${count === 1 ? '' : 's'}` +
        ` after ${state.delayMs}ms, with ${state.posters ? 'placeholder posters' : 'no posters'}.` +
        ' No OpenRouter call, no TMDB call, no log row. Reload the page to stop.'
    );
  };

  console.log('debugRecs installed. Try debugRecs(4), then resize the window.');
})();
