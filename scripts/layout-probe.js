/**
 * @file The in-page half of `scripts/layout-check.js`. That tool's fixture
 * server injects this into the app's page; nothing in the app loads it, and
 * nothing serves it outside that tool.
 *
 * It resizes its own iframe through the widths it is given, measures the real
 * layout, and POSTs the result back. Classic script, not a module, wrapped in
 * one function so it adds no globals to the page it measures.
 *
 * ADAPTING IT to a UI change: the selector lists directly below define what
 * counts as a card or component for the containment and overlap checks. A new
 * kind of card or banner belongs in them.
 */
(function layoutProbe() {
  /** A line of text must stay inside the nearest of these, horizontally. */
  const CONTAINERS = '.movie-card, .result-row, .rec-card, .verdict, .ranked__head, .recs__head, .site-head, .log-cta, .site-foot, .search, .log-dialog';
  /** No two children of any of these may overlap: a card's top-level parts,
   *  and the parts inside its body and score column. */
  const COMPONENTS = '.movie-card, .result-row, .rec-card, .verdict__inner, .site-head, .ranked__head, .recs__head, .log-cta, .site-foot__credit, .search, '
    + '.movie-card__body, .movie-card__score, .score-block, .card-actions, .rec-card__body, .result-row .meta, .ai-meta';
  /** Every element that shows softHyphenate()'s output. */
  const HYPHENATED = '.movie-card__body h3, .movie-card__body .review, .result-row .meta strong, .rec-card__body h3, .rec-card__body .reason, .verdict__typed';
  /** Regions compared element by element in diff mode. */
  const REGIONS = ['.site-head', 'main', '.site-foot', '.log-dialog'];
  /** Anything that is not layout: overlays, decoration, hidden dialogs. */
  const IGNORED = 'script, style, .grain, .verdict__sheen, .sr-only, dialog:not([open])';
  const TOL = 1;

  const SHY = String.fromCharCode(0xad);
  const run = new URLSearchParams(location.search).get('run');
  const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const out = { counts: {}, samples: {}, widths: [], errors: [] };
  addEventListener('error', (e) => out.errors.push(String(e.message)));
  addEventListener('unhandledrejection', (e) => out.errors.push(`rejection: ${e.reason}`));

  /** Wait a fixed time. @param {number} ms @returns {Promise<void>} */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  /** Wait two animation frames, so layout has settled. @returns {Promise<void>} */
  const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  /** Split text into user-perceived characters. @param {string} s @returns {string[]} */
  const graphemes = (s) => [...seg.segment(s)].map((x) => x.segment);
  /** Whether a grapheme is whitespace. @param {string} g @returns {boolean} */
  const isWs = (g) => /\s/.test(g);

  /**
   * Record one finding under a category, keeping a few samples.
   *
   * @param {string} category  `ok:` and `note:` categories are not failures.
   * @param {string} [sample]
   * @returns {void}
   */
  function bump(category, sample) {
    out.counts[category] = (out.counts[category] || 0) + 1;
    const s = (out.samples[category] = out.samples[category] || []);
    if (sample && s.length < 12) s.push(sample);
  }

  /**
   * Resize the iframe this page lives in, and let the app's own resize
   * handlers run.
   *
   * @param {number} w
   * @returns {Promise<void>}
   */
  async function setWidth(w) {
    window.frameElement.width = w;
    window.frameElement.style.width = `${w}px`;
    await frames(); await sleep(120); await frames();
    // A heartbeat: the tool abandons a run that goes quiet (see --stall).
    fetch(`/__probe/progress?run=${run}&w=${w}`).catch(() => {});
  }

  /**
   * Poll until a condition holds or the time runs out.
   *
   * @param {() => boolean} test
   * @param {number} [ms]
   * @returns {Promise<boolean>}
   */
  async function waitFor(test, ms = 20000) {
    for (let t = 0; t < ms; t += 50) { if (test()) return true; await sleep(50); }
    return false;
  }

  /**
   * A short name for an element, for samples.
   *
   * @param {Element} el
   * @returns {string}
   */
  function label(el) {
    const cls = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : '';
    return `${el.tagName.toLowerCase()}${cls}`;
  }

  /**
   * Is this element, or an ancestor, animating forever (a spinner, a
   * twinkle)? Its box changes from frame to frame, which is not layout.
   *
   * @param {Element} el
   * @returns {boolean}
   */
  function animated(el) {
    for (let a = el; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.animationName !== 'none' && cs.animationIterationCount === 'infinite') return true;
    }
    return false;
  }

  /* ---------- putting every surface on screen ----------------------------- */

  /**
   * The line each visible grapheme of an element sits on.
   *
   * @param {Element} el
   * @returns {number[]}
   */
  function linesOf(el) {
    const lines = []; const r = document.createRange(); let top = null, li = 0;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      let off = 0;
      for (const g of graphemes(n.data)) {
        if (g !== SHY && !isWs(g)) {
          r.setStart(n, off); r.setEnd(n, off + g.length);
          const rc = r.getClientRects(); const rect = rc[rc.length - 1];
          if (rect) { if (top !== null && rect.top > top + 6) li++; top = rect.top; }
          lines.push(li);
        }
        off += g.length;
      }
    }
    return lines;
  }

  /**
   * Generate a verdict at 360px, where soft hyphens are on, and watch it type:
   * a letter must never move back up a line.
   *
   * @returns {Promise<void>}
   */
  async function typeVerdict() {
    await setWidth(360);
    const vt = document.getElementById('verdict-text');
    let ticks = 0, jumps = 0, prev = null;
    const mo = new MutationObserver(() => {
      const span = vt.querySelector('.verdict__typed'); if (!span) return;
      ticks += 1; const lines = linesOf(span);
      if (prev && lines.some((l, i) => i < prev.length && l < prev[i])) jumps += 1;
      prev = lines;
    });
    mo.observe(vt, { childList: true, subtree: true, characterData: true });
    document.getElementById('verdict-refresh').click();
    await waitFor(() => { const s = vt.querySelector('.verdict__typed'); return ticks > 5 && s && !s.classList.contains('is-typing'); }, 60000);
    mo.disconnect();
    out.typing = { ticks, jumps };
    if (jumps) bump('typing: a letter jumped back up a line while the verdict typed', `${jumps} time(s)`);
  }

  /**
   * Put recommendations and search results on screen, after the verdict.
   *
   * @returns {Promise<void>}
   */
  async function fillSurfaces() {
    document.getElementById('recs-trigger').click();
    await waitFor(() => document.querySelectorAll('.rec-card').length > 0);
    await sleep(3000); // lead-in, stagger and entrance
    const input = document.querySelector('.search input');
    input.value = 'layout'; input.form.requestSubmit();
    await waitFor(() => document.querySelectorAll('.result-row').length > 0);
    await sleep(800);
    out.setup = { ranked: document.querySelectorAll('.movie-card').length, search: document.querySelectorAll('.result-row').length, recs: document.querySelectorAll('.rec-card').length };
  }

  /**
   * Open the AI call log and wait for every row.
   *
   * @returns {Promise<void>}
   */
  async function openLog() {
    document.getElementById('open-log').click();
    await waitFor(() => document.querySelectorAll('.log-table td.log-result').length >= 60);
    await sleep(600);
    out.setup.logRows = document.querySelectorAll('.log-table tbody tr').length;
  }

  /* ---------- clipboard ----------------------------------------------------- */

  const INVISIBLE = new RegExp(`[${SHY}${String.fromCharCode(0x200b, 0x200c, 0x200e, 0x200f, 0x2060, 0xfeff)}]`); // not U+200D: it joins emoji

  /**
   * What the app's copy handler puts on the clipboard for a selection.
   *
   * @param {Range} range
   * @returns {{selected: string, payload: string}}
   */
  function copyOf(range) {
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
    const dt = new DataTransfer();
    const ev = new ClipboardEvent('copy', { clipboardData: dt, bubbles: true, cancelable: true });
    document.dispatchEvent(ev);
    const store = ev.clipboardData || dt;
    return { selected: sel.toString(), payload: ev.defaultPrevented ? store.getData('text/plain') : sel.toString() };
  }

  /**
   * Copied text carries no invisible character, and the verdict copies once.
   *
   * @returns {void}
   */
  function clipboard() {
    for (const el of document.querySelectorAll(HYPHENATED)) {
      const r = document.createRange(); r.selectNodeContents(el);
      const c = copyOf(r);
      if (INVISIBLE.test(c.payload)) bump('clip: an invisible character reached the clipboard', c.payload.slice(0, 40));
    }
    const vt = document.getElementById('verdict-text');
    const heard = vt.querySelector('.sr-only');
    const r = document.createRange(); r.selectNodeContents(vt);
    const c = copyOf(r);
    if (heard && c.payload.trim() !== heard.textContent) bump('clip: the verdict did not copy exactly once', `${c.payload.length} chars for a ${heard.textContent.length}-char verdict`);
    getSelection().removeAllRanges();
  }

  /* ---------- health checks ---------------------------------------------------- */

  /**
   * Every line break between two visible graphemes of one word, classified
   * against softHyphenate()'s rules.
   *
   * @param {Element} el
   * @param {number} w
   * @param {object} rules
   * @returns {void}
   */
  function hyphenationIn(el, w, rules) {
    // A dash ends a word here whatever app.js's separator says, so D-081 is
    // checked independently of the code under test. The letter rule (D-085)
    // keeps a soft hyphen off a dash by itself, so a separator that lost its
    // dashes would otherwise surface only as breaks in short words, counted by
    // that same separator, and pass.
    const isSep = (g) => rules.separatorRe.test(g) || /\p{Pd}/u.test(g);
    const items = []; const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) { let off = 0; for (const g of graphemes(n.data)) { items.push({ n, off, g }); off += g.length; } }
    const vis = []; items.forEach((it, idx) => { if (it.g !== SHY) vis.push({ ...it, idx }); });
    const r = document.createRange(); let prevTop = null, prev = -1;
    for (let i = 0; i < vis.length; i++) {
      if (isWs(vis[i].g)) continue;
      r.setStart(vis[i].n, vis[i].off); r.setEnd(vis[i].n, vis[i].off + vis[i].g.length);
      const rc = r.getClientRects(); const rect = rc[rc.length - 1]; if (!rect) continue;
      if (prevTop !== null && rect.top > prevTop + 6 && prev === i - 1) classifyBreak(vis, i, w, rules, isSep, el);
      prevTop = rect.top; prev = i;
    }
  }

  /**
   * Classify one break inside a word.
   *
   * @param {object[]} vis  The element's visible graphemes.
   * @param {number} i      Index of the first grapheme after the break.
   * @param {number} w
   * @param {object} rules
   * @param {(g: string) => boolean} isSep
   * @param {Element} el
   * @returns {void}
   */
  function classifyBreak(vis, i, w, rules, isSep, el) {
    const shy = vis[i].idx - vis[i - 1].idx > 1;
    const before = vis[i - 1].g, after = vis[i].g;
    let s = i - 1; while (s > 0 && !isSep(vis[s - 1].g)) s--;
    let e = i; while (e + 1 < vis.length && !isSep(vis[e + 1].g)) e++;
    let ts = i - 1; while (ts > 0 && !isWs(vis[ts - 1].g)) ts--;
    let te = i; while (te + 1 < vis.length && !isWs(vis[te + 1].g)) te++;
    const at = `${w}px ${vis.slice(ts, i).map((x) => x.g).join('')}|${vis.slice(i, te + 1).map((x) => x.g).join('')}`;
    if (w > rules.threshold) return classifyAboveThreshold({ vis, ts, te, shy, before, after, at, el, rules });
    if (shy) {
      const fault = softHyphenFault(vis, i, s, e, rules);
      return fault ? bump(fault, at) : bump('ok: hyphenated inside a long word');
    }
    if (/\p{Pd}/u.test(before)) return bump('ok: after a dash (the browser’s own break)');
    return bump('note: broken without a hyphen (a break Unicode allows, or overflow-wrap)', at);
  }

  /**
   * Which of softHyphenate()'s rules a break at a soft hyphen breaks, if any: a
   * dash beside it (D-081), anything but a letter beside it, or a word too
   * short or a break too near its edge, both counted in letters (D-080, D-085).
   *
   * @param {object[]} vis  The element's visible graphemes.
   * @param {number} i      Index of the first grapheme after the break.
   * @param {number} s      Index of the word's first grapheme.
   * @param {number} e      Index of the word's last grapheme.
   * @param {object} rules
   * @returns {string|null} The failing category, or null when the break is legal.
   */
  function softHyphenFault(vis, i, s, e, rules) {
    const before = vis[i - 1].g, after = vis[i].g;
    if (/\p{Pd}/u.test(before) || /\p{Pd}/u.test(after)) return 'hyph: soft hyphen next to a dash';
    const isLetter = (g) => rules.letterRe.test(g);
    if (!isLetter(before) || !isLetter(after)) return 'hyph: soft hyphen beside a non-letter';
    let L = 0, k = 0; // the word's letters, and those before the break
    for (let j = s; j <= e; j++) if (isLetter(vis[j].g)) { L++; if (j < i) k++; }
    if (L < rules.minWord || k < rules.minEdge || L - k < rules.minEdge) return 'hyph: short word or too near an edge';
    return null;
  }

  /**
   * Above the threshold soft hyphens are off, so a break inside a word is only
   * legitimate when the whole word cannot fit a line of its column.
   *
   * @param {{vis: object[], ts: number, te: number, shy: boolean, before: string, after: string, at: string, el: Element, rules: object}} b
   * @returns {void}
   */
  function classifyAboveThreshold({ vis, ts, te, shy, before, after, at, el, rules }) {
    // Beside a dash on either side is a break the browser allows by itself:
    // after a hyphen, and before or after an em dash.
    if (/\p{Pd}/u.test(before) || /\p{Pd}/u.test(after)) return bump('ok: beside a dash (the browser’s own break)');
    // Only a break AT a soft hyphen can be hyphenation; anywhere else it is a
    // break Unicode allows (between two emoji, say) or overflow-wrap.
    if (!shy) return bump('note: broken without a hyphen (a break Unicode allows, or overflow-wrap)', at);
    const word = document.createRange();
    word.setStart(vis[ts].n, vis[ts].off); word.setEnd(vis[te].n, vis[te].off + vis[te].g.length);
    const wordW = [...word.getClientRects()].reduce((n, x) => n + x.width, 0);
    const cs = getComputedStyle(el);
    const room = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return wordW > room - TOL ? bump('note: word wider than its column, broken by overflow-wrap', at)
      : bump(`hyph: a word broke above ${rules.threshold}px, where soft hyphens are off`, at);
  }

  /**
   * The line boxes of every text node under a scope, skipping ignored and
   * invisible text.
   *
   * @param {Element} scope
   * @returns {{rc: DOMRect, node: Text}[]}
   */
  function textRects(scope) {
    const rects = []; const r = document.createRange();
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.data.trim() || n.parentElement.closest(IGNORED)) continue;
      if (getComputedStyle(n.parentElement).visibility === 'hidden') continue;
      r.selectNodeContents(n);
      for (const rc of r.getClientRects()) if (rc.width > 0.5 && rc.height > 0.5) rects.push({ rc, node: n });
    }
    return rects;
  }

  /**
   * Cut a text box down to what its clipping ancestors actually show (a
   * line-clamped review keeps its hidden lines' boxes).
   *
   * @param {DOMRect} rc
   * @param {Text} node
   * @returns {{left: number, right: number, top: number, bottom: number}|null}
   */
  function visiblePart(rc, node) {
    let l = rc.left, r = rc.right, t = rc.top, b = rc.bottom;
    for (let a = node.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const bb = a.getBoundingClientRect(); const L = bb.left + a.clientLeft, T = bb.top + a.clientTop;
      l = Math.max(l, L); r = Math.min(r, L + a.clientWidth); t = Math.max(t, T); b = Math.min(b, T + a.clientHeight);
      if (r - l <= 0.5 || b - t <= 0.5) return null;
    }
    return { left: l, right: r, top: t, bottom: b };
  }

  /**
   * Every line of text inside the viewport, its container, and every box that
   * clips it.
   *
   * @param {Element} scope
   * @param {number} w
   * @returns {void}
   */
  function containment(scope, w) {
    for (const { rc, node } of textRects(scope)) {
      const text = node.data.trim().split(SHY).join('').slice(0, 30);
      if (rc.left < -TOL || rc.right > innerWidth + TOL) bump('contain: text outside the viewport', `${w}px "${text}"`);
      const box = node.parentElement.closest(CONTAINERS);
      if (box) {
        const b = box.getBoundingClientRect();
        if (rc.left < b.left - TOL || rc.right > b.right + TOL) bump('contain: text outside its card or component', `${w}px ${label(box)} "${text}"`);
      }
      for (let a = node.parentElement; a && a !== document.body; a = a.parentElement) {
        if (getComputedStyle(a).overflowX === 'visible') continue;
        const b = a.getBoundingClientRect(); const left = b.left + a.clientLeft;
        if (rc.left < left - TOL || rc.right > left + a.clientWidth + TOL) { bump('contain: text cut off by a clipping box', `${w}px ${label(a)} "${text}"`); break; }
      }
    }
  }

  /**
   * The boxes one child of a component occupies: its buttons, images and
   * icons, and the visible part of its text.
   *
   * @param {Element} child
   * @returns {object[]}
   */
  function boxesOf(child) {
    const SOLID = 'button, input, img, svg, .noposter';
    if (child.matches(SOLID)) return [child.getBoundingClientRect()];
    const boxes = [];
    for (const el of child.querySelectorAll(SOLID)) {
      if ((el.closest('button') && el.closest('button') !== el) || el.closest(IGNORED)) continue;
      const rc = el.getBoundingClientRect(); if (rc.width > 0.5 && rc.height > 0.5) boxes.push(rc);
    }
    for (const { rc, node } of textRects(child)) { if (node.parentElement.closest('button')) continue; const v = visiblePart(rc, node); if (v) boxes.push(v); }
    return boxes;
  }

  /**
   * No two children of a component overlap.
   *
   * @param {number} w
   * @returns {void}
   */
  function collisions(w) {
    for (const root of document.querySelectorAll(COMPONENTS)) {
      if (root.closest(IGNORED)) continue;
      const kids = [...root.children].filter((c) => !c.closest(IGNORED) && getComputedStyle(c).display !== 'none');
      const sets = kids.map(boxesOf);
      for (let a = 0; a < kids.length; a++) {
        for (let b = a + 1; b < kids.length; b++) {
          const hit = sets[a].some((p) => sets[b].some((q) => Math.min(p.right, q.right) - Math.max(p.left, q.left) > TOL && Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > TOL));
          if (hit) bump('collide: two parts of a component overlap', `${w}px ${label(root)}: ${label(kids[a])} × ${label(kids[b])}`);
        }
      }
    }
  }

  /**
   * Nothing scrolls sideways: not the page, not any box in it.
   *
   * @param {number} w
   * @returns {void}
   */
  function sideways(w) {
    if (document.documentElement.scrollWidth > innerWidth + TOL) bump('scroll: the page is wider than the viewport', `${w}px ${document.documentElement.scrollWidth}px`);
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest(IGNORED)) continue;
      const ox = getComputedStyle(el).overflowX;
      if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + TOL) bump('scroll: a box scrolls sideways', `${w}px ${label(el)} ${el.scrollWidth}>${el.clientWidth}`);
    }
  }

  /**
   * Health mode: every check at every width, then the log dialog.
   *
   * @param {object} cfg
   * @returns {Promise<{allExact: boolean}>} Whether every width came out exact.
   */
  async function health(cfg) {
    const rules = { ...cfg.rules, separatorRe: new RegExp(cfg.rules.separator, 'u'), letterRe: new RegExp(cfg.rules.letter, 'u') };
    await typeVerdict();
    await fillSurfaces();
    clipboard();
    let allExact = true;
    for (const w of cfg.widths) {
      await setWidth(w);
      allExact = allExact && innerWidth === w;
      for (const el of document.querySelectorAll(HYPHENATED)) hyphenationIn(el, w, rules);
      containment(document.body, w); collisions(w); sideways(w);
      out.widths.push(w);
    }
    await openLog();
    for (const w of cfg.widths) { await setWidth(w); containment(document.querySelector('.log-dialog'), w); sideways(w); }
    return { allExact };
  }

  /* ---------- diff mode ---------------------------------------------------------- */

  /**
   * Every element's box, relative to its region; fixed-position boxes relative
   * to the viewport. Hidden and forever-animating elements are left out.
   *
   * @param {string[]} [regions]
   * @returns {Map<string, object>}
   */
  function snapshot(regions = REGIONS) {
    const res = new Map();
    for (const sel of regions) {
      const root = document.querySelector(sel); if (!root || root.closest(IGNORED)) continue;
      const rb = root.getBoundingClientRect();
      res.set(sel, { region: sel, cls: sel, x: 0, y: 0, w: rb.width, h: rb.height });
      root.querySelectorAll('*').forEach((el, i) => {
        if (el.closest(IGNORED) || animated(el)) return;
        const b = el.getBoundingClientRect(); if (b.width === 0 && b.height === 0) return;
        const fixed = getComputedStyle(el).position === 'fixed';
        res.set(`${sel}#${i}`, { region: sel, cls: label(el) + (fixed ? '(fixed)' : ''), x: b.left - (fixed ? 0 : rb.left), y: b.top - (fixed ? 0 : rb.top), w: b.width, h: b.height });
      });
    }
    return res;
  }

  /**
   * Compare two snapshots.
   *
   * @param {Map<string, object>} a
   * @param {Map<string, object>} b
   * @returns {object}
   */
  function compare(a, b) {
    const s = { compared: a.size, changed: 0, maxShift: 0, appeared: [], disappeared: [], byRegion: {}, samples: [] };
    for (const [k, p] of a) {
      const q = b.get(k);
      if (!q) { s.disappeared.push(p.cls); continue; }
      const d = Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y), Math.abs(p.w - q.w), Math.abs(p.h - q.h));
      if (d <= 0.5) continue;
      s.changed += 1; s.maxShift = Math.max(s.maxShift, d);
      s.byRegion[p.region] = (s.byRegion[p.region] || 0) + 1;
      if (s.samples.length < 30) s.samples.push(`${p.cls} Δ${d.toFixed(1)} [${[p.x, p.y, p.w, p.h].map((v) => v.toFixed(1))}]→[${[q.x, q.y, q.w, q.h].map((v) => v.toFixed(1))}]`);
    }
    for (const [k, q] of b) if (!a.has(k)) s.appeared.push(q.cls);
    return s;
  }

  /**
   * Diff mode: the baseline and candidate stylesheets, swapped in the same
   * page so data, fonts and DOM are identical.
   *
   * @param {object} cfg
   * @returns {Promise<{same: object[], reference: object|null}>}
   */
  async function diff(cfg) {
    document.querySelector('link[rel="stylesheet"][href="styles.css"]').disabled = true;
    const sheet = document.createElement('style'); document.head.append(sheet);
    const use = async (css) => { sheet.textContent = css; window.dispatchEvent(new Event('resize')); await frames(); await sleep(150); await frames(); };
    await use(cfg.candidateCss);
    await typeVerdict(); await fillSurfaces(); await openLog();
    window.scrollTo(0, 0); await sleep(1500);
    const same = [];
    for (const w of cfg.widths) {
      await setWidth(w);
      await use(cfg.baselineCss); const a = snapshot();
      await use(cfg.candidateCss); const b = snapshot();
      same.push({ w, ...compare(a, b) });
    }
    if (!cfg.referenceWidth) return { same, reference: null };
    // The page regions only: a dialog sized in `vw` reaches a given width at a
    // different window width, so the page's reference width is not its own.
    const page = REGIONS.filter((r) => r !== '.log-dialog');
    await setWidth(cfg.referenceWidth); await use(cfg.baselineCss);
    const ref = snapshot(page);
    const results = [];
    for (const w of cfg.widths.filter((x) => x > cfg.referenceWidth)) {
      await setWidth(w); await use(cfg.candidateCss);
      results.push({ w, ...compare(ref, snapshot(page)) });
    }
    return { same, reference: { width: cfg.referenceWidth, results } };
  }

  /**
   * Load the configuration, run the mode, and report back to the tool.
   *
   * @returns {Promise<void>}
   */
  async function main() {
    const cfg = await (await fetch('/__probe/config')).json();
    await waitFor(() => document.querySelectorAll('.movie-card').length > 0);
    await document.fonts.ready;
    // Scrollbars overlay the page, as on a phone, so none takes layout width.
    const noBars = document.createElement('style');
    noBars.textContent = 'html,*{scrollbar-width:none!important}::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}';
    document.head.append(noBars);
    await setWidth(1280); await sleep(2500); // the first-paint entrance settles
    const result = cfg.mode === 'diff' ? await diff(cfg) : await health(cfg);
    await fetch(`/__probe/done?run=${run}`, { method: 'POST', body: JSON.stringify({ ...out, ...result }) });
  }

  main().catch((e) => fetch(`/__probe/done?run=${run}`, { method: 'POST', body: JSON.stringify({ fatal: String((e && e.stack) || e) }) }));
})();
