/**
 * @file CineRank — taste-verdict UI debug harness. DEV ONLY.
 *
 * LOADED BY THE PAGE ON draft, for now: a <script> tag at the bottom of
 * public/index.html and a route in server/index.js that serves this file
 * (scripts/ is outside the static root). Both are marked TEMPORARY and come out
 * in the last commit before the next draft -> main merge; this file stays, and
 * can then be pasted into the console instead, as scripts/debug-recs.js is.
 * On the deployed host it refuses to install at all.
 *
 * Use it from the browser console:
 *
 *     debugVerdict(10)   // "New verdict" now yields the first 10 words of lorem ipsum
 *     debugVerdict(60)   // ...or 60. Any whole number from 1 up.
 *
 * Calling it again, with no reload in between, just changes the word count for
 * the next click. Reload the page to stop: the harness starts every page load
 * DISARMED, and loading this file only defines `debugVerdict`. Nothing is
 * intercepted until you call it, and nothing is written anywhere.
 *
 * WHY IT EXISTS. Judging the verdict banner's layout (line breaks, hyphenation,
 * the typing effect, the meta footer's wrap) needs many runs at many widths and
 * lengths, and every real run is a paid call to the verdict model.
 *
 * WHAT IT COSTS: nothing. No OpenRouter call and no row in taste_verdict_logs,
 * so nothing appears in the AI call log: the request never leaves the browser.
 *
 * HOW IT WORKS. It replaces `window.fetch` and answers `POST /api/taste-verdict`
 * itself, after a 2–3 second pause, with a body shaped exactly like the real
 * route's `{ verdict, meta }`. Everything downstream runs for real and
 * unmodified: the busy button and "Consulting the critics…", the ring's busy
 * glint, setVerdictText()'s typing effect and hyphenation, and the meta footer.
 * Every other request goes to the real fetch untouched, the same approach as
 * scripts/debug-recs.js.
 *
 * TWO DIFFERENCES FROM A REAL VERDICT, on purpose:
 * - The text is not passed through the server's tidyVerdict(), so it is never
 *   cut at its 450-character ceiling. A real verdict is 2–3 sentences, about
 *   35–60 words, and that ceiling cuts one at about 80 words of its prose; ask
 *   for more to stress the layout beyond anything the model can produce.
 * - It ends wherever the Nth word ends, mid-sentence and without a full stop,
 *   exactly as lorem ipsum falls.
 *
 * PREREQUISITE: the button's own gate still applies. "New verdict" is enabled
 * only with at least two rated films in the real database, because
 * `GET /api/movies` is not intercepted.
 *
 * Not a Node script despite living beside some: it only ever runs in a browser.
 */
(() => {
  if (location.hostname.endsWith('onrender.com')) {
    console.info('debug-verdict: not installing on the deployed host.');
    return;
  }

  // Wrap the fetch as it stands when this file runs, once, so loading the file
  // twice cannot wrap an already-wrapped fetch.
  if (window.__debugVerdictInstalled) return;
  window.__debugVerdictInstalled = true;
  const realFetch = window.fetch.bind(window);

  /** The standard lorem ipsum passage, 69 words; longer requests cycle it. */
  const LOREM = (
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor ' +
    'incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud ' +
    'exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure ' +
    'dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. ' +
    'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt ' +
    'mollit anim id est laborum.'
  ).split(' ');

  const state = { on: false, words: 10 };

  /**
   * The first `n` words of lorem ipsum, cycling the passage when `n` is longer.
   *
   * @param {number} n
   * @returns {string}
   */
  const lorem = (n) => Array.from({ length: n }, (_, i) => LOREM[i % LOREM.length]).join(' ');

  /**
   * A plausible meta block for a verdict of `words` words that took
   * `durationMs`. The prompt side is the seed list's real verdict prompt, 1,385
   * tokens, and the reply runs two tokens a word, as the real verdicts on that
   * list do, both priced at the verdict model's rates: a 45-word verdict comes
   * to 1,475 tokens and 0.37¢, in line with the real ones.
   *
   * @param {number} words
   * @param {number} durationMs
   * @returns {{promptVersion: string, model: string, tokensUsed: number, estimatedCostUsd: number, durationMs: number}}
   */
  function meta(words, durationMs) {
    const promptTokens = 1385;
    const replyTokens = words * 2;
    return {
      promptVersion: 'taste_verdict_v7',
      model: 'anthropic/claude-sonnet-5',
      tokensUsed: promptTokens + replyTokens,
      estimatedCostUsd: promptTokens * 0.000002 + replyTokens * 0.00001,
      durationMs,
    };
  }

  /**
   * A JSON Response built in the browser, standing in for the server's.
   *
   * @param {unknown} data
   * @returns {Response}
   */
  const json = (data) =>
    new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });

  /**
   * The patched fetch. While armed it answers POST /api/taste-verdict itself;
   * every other request, and every request while disarmed, goes to the real
   * fetch untouched.
   *
   * @param {RequestInfo | URL} input
   * @param {RequestInit} [init]
   * @returns {Promise<Response>}
   */
  window.fetch = async (input, init) => {
    const url = String(input && input.url ? input.url : input);
    const method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    if (state.on && method === 'POST' && url.includes('/api/taste-verdict')) {
      // A real verdict takes a few seconds, and everything worth judging about
      // the busy state happens while the request is in flight.
      const durationMs = 2000 + Math.round(Math.random() * 1000);
      await new Promise((r) => setTimeout(r, durationMs));
      return json({ verdict: lorem(state.words), meta: meta(state.words, durationMs) });
    }
    return realFetch(input, init);
  };

  /**
   * Arm the harness: from now until a reload, "New verdict" yields the first
   * `n` words of lorem ipsum. Calling it again sets a new count.
   *
   * @param {number} [n=10]  How many words, a whole number from 1 up. Anything
   *   else is refused with a console error and changes nothing.
   */
  window.debugVerdict = (n = 10) => {
    const words = Number(n);
    if (!Number.isInteger(words) || words < 1) {
      console.error('debugVerdict(n): n must be a whole number of words, 1 or more.');
      return;
    }
    state.on = true;
    state.words = words;
    const button = document.querySelector('#verdict-refresh');
    const locked = button && button.disabled && button.getAttribute('aria-busy') !== 'true';
    console.log(
      `debugVerdict: "New verdict" will now yield ${words} word${words === 1 ? '' : 's'} of lorem ipsum` +
        ' after 2–3 seconds. No OpenRouter call, no log row. Reload the page to stop.' +
        (locked ? ' The button is locked: it needs at least two rated films.' : '')
    );
  };

  console.log('debugVerdict available (idle: nothing is intercepted yet). Try debugVerdict(10).');
})();
