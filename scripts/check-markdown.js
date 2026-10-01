#!/usr/bin/env node
/**
 * @file Markdown render check (CLAUDE.md § Markdown Authoring Rules). Run before every
 * commit that touches a .md file, and before every draft -> main merge:
 *   npm run check-markdown
 *
 * WHY THIS EXISTS. On 2026-09-12 CLAUDE.md and SPEC.md were found to be rendering
 * wrong on GitHub -- 17 section separators showing as a literal "---" paragraph,
 * and technical identifiers in both files showing a backslash inside their
 * code chip (SUPABASE\_URL, recommendation\_logs, tmdb\_id, and so on,
 * including all four env var names in the Module 17 security section). The docs are a
 * graded deliverable here, so "it only looks wrong" is not a small problem, and a
 * rendering fault in a file this long is close to unfindable by eye.
 *
 * The rules below are the ones that were established by measuring every case
 * against GitHub's own Markdown API, not by assumption. See D-065. They are
 * numbered as CLAUDE.md § Markdown Authoring Rules numbers them, so RULES 2 and
 * 12 sit after the per-line pass: each needs a whole paragraph, not one line.
 *
 * Exits non-zero on a real rendering defect. Cosmetic-only findings are reported
 * and do NOT fail, so this can be wired into a hook without crying wolf.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TICK = String.fromCharCode(96);
const BS = String.fromCharCode(92);
const NL = String.fromCharCode(10);

/**
 * A fenced block opens with THREE OR MORE backticks or tildes. The tilde form was
 * a latent hole until the 2026-09-13 enumeration: the checker knew only backticks,
 * so a ~~~ block would have had its contents scanned as prose and flagged. No file
 * uses one today -- this is insurance, not a fix. Inline strikethrough (~~x~~) is
 * unaffected, because that is two tildes and this needs three.
 *
 * The same test opens and closes a fence; the callers track which by toggling.
 *
 * @param {string} line  One source line.
 * @returns {boolean} Whether the line is a fence delimiter.
 */
const isFence = (line) => /^[ \t]*(`{3,}|~{3,})/.test(line);

// Code-span contents where a backslash is REAL CONTENT, not a stray escape.
// Matched against the WHOLE span, so allowing the span "\_" cannot also allow
// "tmdb\_id". Add to this list only when the backslash is genuinely part of what
// is being shown, and say why.
const ALLOWED_SPANS = new Set([
  'D:' + BS + 'tmp',                                  // a real Windows path
  BS + 'S',                                           // a regex token (D-061)
  'text.replace(/(' + BS + 'S)(?=' + BS + 'S)/g, ' + "'$1\u00ad')", // regex (D-061)
  // NOTE: an entry here was REMOVED on 2026-09-13. It allowlisted the span
  // `* _ \` in D-011 as "the literal chars tidyVerdict() strips" -- but that
  // backslash was not content, it was a FAILED ESCAPE, and the allowlist was
  // therefore hiding a real defect from rule 1. The source now uses double
  // delimiters, which needs no exemption. Before adding an entry here, confirm
  // the backslash is genuinely part of what is being shown.
  // The rest are this project's own DOCUMENTATION of the escaping problem --
  // they have to show the sequence to describe it. Whole-span matches only.
  BS + '_', BS + '&', BS + '[', BS + '---', '1' + BS + '.', BS + '[ ]',
  '## 1' + BS + '. Test',                             // D-065's escaped-heading example
  // The other two thematic-break spellings, added 2026-09-13 when rules 3-5
  // learned about them and the docs had to quote them to explain them.
  BS + '***', BS + '___',
]);

// Markdown treats a backslash before one of these as an escape. Inside a code
// span nothing is parsed, so the backslash is PRINTED. Backslash before anything
// else (\S, \t) is ordinary content and is not flagged.
const ESCAPABLE = '!"#$%&' + "'" + '()*+,-./:;<=>?@[' + BS + ']^_`{|}~';

/**
 * Every .md file under a directory, skipping node_modules and .git.
 *
 * @param {string} dir  The directory to walk.
 * @param {string[]} [out]  Accumulator shared across the recursion.
 * @returns {string[]} Absolute paths; the same array as `out`, filled.
 */
function markdownFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) markdownFiles(p, out);
    else if (name.endsWith('.md')) out.push(p);
  }
  return out;
}

const errors = [];
const notes = [];

for (const file of markdownFiles(root)) {
  const rel = relative(root, file).split(BS).join('/');
  const lines = readFileSync(file, 'utf8').split('\n');
  let inFence = false;
  let pipeRun = [];
  let pipeStart = 0;

  lines.forEach((line, i) => {
    const n = i + 1;
    if (isFence(line)) { inFence = !inFence; return; }

    // --- RULE 1: an escape inside a code span always renders literally --------
    // This is the one that is genuinely invisible when writing and obvious when
    // rendered, and it is how the \[{title, reason}, ...] defect survived a first
    // pass that had already checked the same character in two other contexts.
    if (!inFence) {
      line.split(TICK).forEach((part, k) => {
        if (k % 2 === 0 || !part.includes(BS)) return;
        if (ALLOWED_SPANS.has(part)) return;
        for (let c = 0; c < part.length - 1; c += 1) {
          if (part[c] === BS && ESCAPABLE.includes(part[c + 1])) {
            errors.push(`${rel}:${n}  escape inside a code span renders literally: ` +
                        TICK + part + TICK);
            return;
          }
        }
      });
    }

    // --- RULE 3: no escaped thematic break ------------------------------------
    // All THREE spellings. CommonMark's thematic break is 3+ of -, * or _, so an
    // escaped one is debris whichever character was used. The 2026-09-13 audit
    // found the checker only knew the hyphen spelling: \*** rendered as a literal
    // "***" paragraph and passed clean.
    if (!inFence && /^(-{3,}|\*{3,}|_{3,})$/.test(line.trim().slice(1)) && line.trim()[0] === BS) {
      errors.push(`${rel}:${n}  ` + BS + line.trim().slice(1, 4) +
                  ' renders as a literal paragraph, not a rule');
    }

    // --- RULE 4: a bare rule under a text line is a SETEXT HEADING -------------
    // Silently promotes the line above to a heading. The reason the 2026-09-12
    // fix DELETED the separators instead of unescaping them.
    //
    // BOTH underline characters, and they make DIFFERENT headings: - gives an h2,
    // = gives an h1. The = case was a false negative until the 2026-09-13 audit
    // rendered it and watched a plain paragraph become an <h1>. * and _ are NOT
    // setext underlines, so they are correctly absent here.
    if (!inFence && n > 1 && /^(-+|=+)$/.test(line.trim())) {
      const prev = lines[i - 1];
      if (prev !== undefined && prev.trim() !== '') {
        const level = line.trim()[0] === '=' ? 'h1' : 'h2';
        errors.push(`${rel}:${n}  a rule directly under text silently makes that line an <${level}>`);
      }
    }

    // --- RULE 5: no separator immediately before a heading --------------------
    // GitHub rules every h1/h2 itself, so one here draws two lines around the
    // heading. This was briefly dropped from the checker because it fired 38
    // times on docs/DECISIONS.md -- and then the user looked at how those
    // actually rendered and had them removed, which is what makes the rule
    // enforceable: there is not one left in the repo, so it can never cry wolf
    // and any hit is a real regression. A separator that is NOT before a heading
    // is untouched by this rule; thematic breaks mid-section are fine.
    //
    // All three spellings, for the same reason as rule 3: *** and ___ produce the
    // identical <hr> and were false negatives until 2026-09-13.
    if (!inFence && n > 1 && /^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j += 1;
      if (lines[j] !== undefined && /^#{1,6}[ \t]/.test(lines[j].trim())) {
        errors.push(`${rel}:${n}  separator before a heading: GitHub already rules every h1/h2`);
      }
    }

    // --- RULE 6: a table needs its separator row -------------------------------
    // Two or more consecutive pipe lines whose SECOND line is not |---|---| is not
    // a table at all: GitHub renders the whole block as one paragraph full of pipe
    // characters. Found by the 2026-09-13 audit, which rendered it to be sure --
    // many of the repo's markdown files carry tables, so the blast radius is real.
    if (!inFence && /^[ \t]*\|/.test(line)) {
      if (!pipeRun.length) pipeStart = n;
      pipeRun.push(line);
    } else if (pipeRun.length) {
      if (pipeRun.length >= 2 && !/^[ \t]*\|?[\s|:-]+\|?[ \t]*$/.test(pipeRun[1])) {
        errors.push(`${rel}:${pipeStart}  table has no |---| separator row, so it renders as a paragraph of pipes`);
      }
      pipeRun = [];
    }

    // --- RULE 11: no line starts with a plus and a space ----------------------
    // That is a bullet-list marker, and a bullet list may interrupt a paragraph,
    // so a sentence re-wrapped to put an arithmetic "+" at the start of a line
    // turns its tail into a list item. SPEC.md's turn-count footnote shipped that
    // way: "23 + 401" ended one line and "+ 93 = 517" began the next, which split
    // the footnote's italic across two blocks so both asterisks printed too.
    // Only the plus: no file here uses + as a bullet, so any hit is a wrapped
    // operator, while a - or * after a line of text is usually a real list.
    if (!inFence && /^[ \t]*\+([ \t]|$)/.test(line)) {
      errors.push(`${rel}:${n}  a line starting with "+ " renders as a bullet item; ` +
                  're-wrap so the + is not first on the line');
    }

    // --- COSMETIC: an escape in plain text is noise, not a defect -------------
    if (!inFence) {
      const plain = line.split(TICK).filter((_, k) => k % 2 === 0).join('');
      for (let c = 0; c < plain.length - 1; c += 1) {
        if (plain[c] === BS && '_&[.'.includes(plain[c + 1])) {
          notes.push(`${rel}:${n}  needless escape in plain text (renders fine, just noise)`);
          break;
        }
      }
    }
  });
  // A table running to the last line of the file never hits the else branch above.
  if (pipeRun.length >= 2 && !/^[ \t]*\|?[\s|:-]+\|?[ \t]*$/.test(pipeRun[1])) {
    errors.push(`${rel}:${pipeStart}  table has no |---| separator row, so it renders as a paragraph of pipes`);
  }

  // --- RULE 2: a code span that is opened and never closed ------------------
  // Per-LINE checks cannot see this: a code span may legally wrap across lines,
  // so an odd backtick count on one line is normal and proves nothing. The unit
  // is the PARAGRAPH, and the test is CommonMark's own rule -- an opening run of
  // N backticks is closed by the next run of EXACTLY N.
  //
  // Found by the 2026-09-13 audit, which is the only reason this rule exists.
  // docs/DECISIONS.md D-011 carried `* _ `` -- an attempt to show the three
  // characters tidyVerdict() strips, using a backslash to escape the backtick.
  // Escapes do not work in a code span (rule 1), so the run never closed, and the
  // renderer swallowed the rest of the sentence into the code element. It had
  // been in the file for nine days. The fix is DOUBLE delimiters plus padding
  // spaces, which this rule correctly accepts.
  {
    let para = [];
    let paraStart = 0;
    let fence = false;
    /**
     * Judge the paragraph gathered in `para` for an unclosed code span, record
     * any defect against `paraStart`, and clear it for the next paragraph.
     * Does nothing when no paragraph is pending.
     */
    const check = () => {
      if (!para.length) return;
      const text = para.join(NL);
      const runs = text.match(new RegExp(TICK + "+", "g")) || [];
      // CommonMark matching, and the naive version is wrong: an opener is closed
      // by the NEXT run of EXACTLY its own length, scanning forward -- not by a
      // stack pop. Runs of a different length in between are CONTENT, which is
      // what makes ``  * _ `  `` a legal way to show a literal backtick.
      const lens = runs.map((r) => r.length);
      const unmatched = [];
      let i = 0;
      while (i < lens.length) {
        let j = i + 1;
        while (j < lens.length && lens[j] !== lens[i]) j += 1;
        if (j < lens.length) { i = j + 1; } else { unmatched.push(lens[i]); i += 1; }
      }
      if (unmatched.length) {
        errors.push(`${rel}:${paraStart}  code span opened with ` +
          `${unmatched[0]} backtick(s) and never closed in this paragraph`);
      }
      para = [];
    };
    lines.forEach((line, i) => {
      if (isFence(line)) { check(); fence = !fence; return; }
      if (fence) return;
      if (line.trim() === "") { check(); return; }
      if (!para.length) paraStart = i + 1;
      para.push(line);
    });
    check();
  }

  // --- RULE 12: no raw HTML tag in prose -------------------------------------
  // GitHub's renderer treats anything shaped like an HTML tag as HTML. One it
  // does not allow is either escaped or DROPPED, and nothing in the source says
  // which: the RS-8 recipe's “<query>” displayed as an empty pair of quotes,
  // while “<Title>” two recipes away happened to survive, and the recommendation
  // prompts' "<movie title>" displayed as "". Found only by reading GitHub's own
  // rendering (2026-10-01). So no raw tag at all, allowed or not: write a literal
  // angle bracket as &lt; / &gt;, or put the text in a code span. No file is
  // exempt. The prompts write entities too, and loadPrompt() decodes them, so
  // the model still receives the plain characters.
  //
  // Paragraph by paragraph, like rule 2, because a code span may wrap across
  // lines. HTML comments are blanked first, keeping their newlines, so a line
  // number still points at its line; so are code spans, matched by CommonMark's
  // run-length rule. A backslash-escaped `<` is text, and an autolink such as
  // <https://…> is not tag-shaped, so neither is flagged.
  //
  // One deliberate false positive: a 4-space INDENTED code block is read as
  // prose, so a tag inside one is flagged. Telling it apart from a list item's
  // indented continuation needs list context, and a wrong guess there would
  // miss a real tag. No file here uses one; fence code instead.
  {
    const text = lines.join(NL).replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
    const plain = text.split(NL);
    let para = [];
    let paraStart = 0;
    let fence = false;
    /**
     * Blank every code span in `s` (delimiters included), keeping its length
     * and newlines, so what remains is the paragraph's prose.
     *
     * @param {string} s  One paragraph.
     * @returns {string}
     */
    const blankCodeSpans = (s) => {
      const runs = [...s.matchAll(new RegExp(TICK + '+', 'g'))].map((m) => [m.index, m[0].length]);
      const out = s.split('');
      let i = 0;
      while (i < runs.length) {
        let j = i + 1;
        while (j < runs.length && runs[j][1] !== runs[i][1]) j += 1;
        if (j >= runs.length) { i += 1; continue; }
        for (let k = runs[i][0]; k < runs[j][0] + runs[j][1]; k += 1) if (out[k] !== NL) out[k] = ' ';
        i = j + 1;
      }
      return out.join('');
    };
    /**
     * Report every raw tag in the paragraph gathered in `para`, then clear it.
     */
    const check = () => {
      if (!para.length) return;
      const prose = blankCodeSpans(para.join(NL));
      for (const m of prose.matchAll(/(?<!\\)<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>/g)) {
        const n = paraStart + (prose.slice(0, m.index).match(/\n/g) || []).length;
        errors.push(`${rel}:${n}  raw HTML tag ${m[0].slice(0, 40)} in prose: GitHub may drop it; ` +
                    'write &lt;…&gt; or put it in a code span');
      }
      para = [];
    };
    plain.forEach((line, i) => {
      if (isFence(line)) { check(); fence = !fence; return; }
      if (fence) return;
      if (line.trim() === '') { check(); return; }
      if (!para.length) paraStart = i + 1;
      para.push(line);
    });
    check();
  }
}

for (const e of errors) console.error('  DEFECT  ' + e);
if (notes.length) {
  const shown = notes.slice(0, 12);
  for (const m of shown) console.log('  note    ' + m);
  if (notes.length > shown.length) console.log(`  note    ... and ${notes.length - shown.length} more`);
}

if (errors.length) {
  console.error(`\n\u2717 check-markdown: ${errors.length} rendering defect(s). ` +
                'See CLAUDE.md \u00a7 Markdown Authoring Rules.');
  process.exit(1);
}
console.log(`\u2713 check-markdown: no rendering defects` +
            (notes.length ? ` (${notes.length} cosmetic note(s), not blocking)` : ''));
