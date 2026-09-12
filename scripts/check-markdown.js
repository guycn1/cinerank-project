#!/usr/bin/env node
// Markdown render check (CLAUDE.md § Markdown Authoring Rules). Run before every
// commit that touches a .md file:  npm run check-markdown
//
// WHY THIS EXISTS. On 2026-09-12 CLAUDE.md and SPEC.md were found to be rendering
// wrong on GitHub -- 17 section separators showing as a literal "---" paragraph,
// and every technical identifier in both files showing a backslash inside its
// code chip (SUPABASE\_URL, recommendation\_logs, tmdb\_id, and so on, including
// all four env var names in the Module 17 security section). The docs are a
// graded deliverable here, so "it only looks wrong" is not a small problem, and a
// rendering fault in a 3,300-line file is close to unfindable by eye.
//
// The rules below are the ones that were established by measuring every case
// against GitHub's own Markdown API, not by assumption. See D-065.
//
// Exits non-zero on a real rendering defect. Cosmetic-only findings are reported
// and do NOT fail, so this can be wired into a hook without crying wolf.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TICK = String.fromCharCode(96);
const BS = String.fromCharCode(92);

// Code-span contents where a backslash is REAL CONTENT, not a stray escape.
// Matched against the WHOLE span, so allowing the span "\_" cannot also allow
// "tmdb\_id". Add to this list only when the backslash is genuinely part of what
// is being shown, and say why.
const ALLOWED_SPANS = new Set([
  'D:' + BS + 'tmp',                                  // a real Windows path
  BS + 'S',                                           // a regex token (D-061)
  'text.replace(/(' + BS + 'S)(?=' + BS + 'S)/g, ' + "'$1\u00ad')", // regex (D-061)
  '* _ ' + BS,                                        // the literal chars tidyVerdict() strips
  // The rest are this project's own DOCUMENTATION of the escaping problem --
  // they have to show the sequence to describe it. Whole-span matches only.
  BS + '_', BS + '&', BS + '[', BS + '---', '1' + BS + '.', BS + '[ ]',
]);

// Markdown treats a backslash before one of these as an escape. Inside a code
// span nothing is parsed, so the backslash is PRINTED. Backslash before anything
// else (\S, \t) is ordinary content and is not flagged.
const ESCAPABLE = '!"#$%&' + "'" + '()*+,-./:;<=>?@[' + BS + ']^_`{|}~';

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

  lines.forEach((line, i) => {
    const n = i + 1;
    if (line.trim().startsWith(TICK + TICK + TICK)) { inFence = !inFence; return; }

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

    // --- RULE 2: no escaped thematic break ------------------------------------
    if (!inFence && line.trim() === BS + '---') {
      errors.push(`${rel}:${n}  ` + BS + '--- renders as a literal "---" paragraph, not a rule');
    }

    // --- RULE 3: a bare --- under a text line is a SETEXT HEADING -------------
    // Silently promotes the line above to an <h2>. The reason the 2026-09-12 fix
    // DELETED the separators instead of unescaping them.
    if (!inFence && line.trim() === '---' && n > 1) {
      const prev = lines[i - 1];
      if (prev !== undefined && prev.trim() !== '') {
        errors.push(`${rel}:${n}  --- directly under text silently makes that line an <h2>`);
      }
    }

    // --- RULE 4: no separator immediately before a heading --------------------
    // GitHub rules every h1/h2 itself, so one here draws two lines around the
    // heading. This was briefly dropped from the checker because it fired 38
    // times on docs/DECISIONS.md -- and then the user looked at how those
    // actually rendered and had them removed, which is what makes the rule
    // enforceable: there is not one left in the repo, so it can never cry wolf
    // and any hit is a real regression. A --- that is NOT before a heading is
    // untouched by this rule; thematic breaks mid-section are fine.
    if (!inFence && line.trim() === '---' && n > 1) {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j += 1;
      if (lines[j] !== undefined && /^#{1,6}\s/.test(lines[j].trim())) {
        errors.push(`${rel}:${n}  separator before a heading: GitHub already rules every h1/h2`);
      }
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
