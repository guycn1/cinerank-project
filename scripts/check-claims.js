#!/usr/bin/env node
/**
 * check-claims.js — the fifth commit gate (CLAUDE.md § Version Control Workflow).
 *
 * WHY THIS EXISTS. On 2026-09-15 the user found README.md claiming
 * docs/MERGE-READINESS.md read "four met, one open" sixteen hours after that file
 * had flipped to MERGE-READY — and found it by accident. A sweep the day before
 * had edited BOTH files in one commit and still missed it, because a staleness
 * sweep reads each document forwards ("is what this file says about itself still
 * true") and cannot see a claim ABOUT ANOTHER FILE that the other file has since
 * falsified. Reading 30k lines by eye does not scale and proves nothing.
 *
 * WHAT IT CHECKS is the class of claim that POINTS AT SOMETHING resolvable: a
 * path, a script, a decision entry, a commit, a line number, an identifier, a
 * capture, or a phrase the project has retired. Every one of those can be
 * resolved against the thing it names, so drift in them is a fact, not a matter
 * of taste.
 *
 * WHAT IT DELIBERATELY DOES NOT CHECK, so nobody mistakes a green run for proof
 * the prose is true: a sentence with no referent. "The glow reads as lopsided"
 * or "this is the strongest image in the set" cannot be resolved by any harness.
 * Those stay the reader's job, and a pass here says nothing about them.
 *
 * Exit 0 clean, 1 on any failure. No network, no git writes.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.git', '.idea']);

/** Every file we are willing to read, as repo-relative POSIX-ish paths. */
function walk(dir = root, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(relative(root, full).split('\\').join('/'));
  }
  return out;
}

const all = walk();
const TEXT = /\.(md|js|css|html|sql|yaml|yml|json|example)$/;
// .env.example is in here on purpose: it carried the retired "name some films"
// wording for a day after a sweep that claimed to be repo-wide, because that
// sweep was scoped to *.md and *.js and a config template is neither.
const read = (f) => readFileSync(join(root, f), 'utf8');
const corpus = all.filter((f) => TEXT.test(f) || basename(f) === '.env.example')
  .map((f) => [f, read(f)]);
const md = corpus.filter(([f]) => f.endsWith('.md'));
const sourceText = corpus.filter(([f]) => /\.(js|css|html)$/.test(f))
  .map(([, s]) => s).join('\n');

const fail = [];
const add = (check, detail) => fail.push(`${check}: ${detail}`);

/** 1. Any path a document names must exist. */
function checkPaths() {
  const re = /\b((?:docs|scripts|server|public|test|db|prompts)\/[A-Za-z0-9._/-]*[A-Za-z0-9_-]\.(?:js|md|css|html|sql|png|svg))/g;
  for (const [f, s] of corpus) {
    for (const [, p] of s.matchAll(re)) {
      if (!existsSync(join(root, p))) add('path', `${f} names missing ${p}`);
    }
  }
}

/** This file necessarily quotes the patterns it hunts for, so it never scans itself. */
const SELF = 'scripts/check-claims.js';

/**
 * The decision log is a PRESERVED record, never a maintained one (CLAUDE.md §
 * Decision Logging). Its entries quote superseded wording and retired function
 * names on purpose — that quotation is the evidence. Checking it for staleness
 * would demand the destruction of exactly the history it exists to protect, so
 * the two checks that hunt outdated language skip it by name rather than by
 * accident. Everything else about it is still checked: its paths, its cited
 * SHAs, its line references and its own D-0NN numbering.
 */
const PRESERVED = 'docs/DECISIONS.md';

/** 2. Any script invocation a document names must be a real package.json script. */
function checkNpmScripts() {
  const defined = Object.keys(JSON.parse(read('package.json')).scripts || {});
  for (const [f, s] of corpus) {
    if (f === SELF) continue;
    for (const [, name] of s.matchAll(/npm run ([a-z][a-z0-9-]*)/g)) {
      if (!defined.includes(name)) add('npm-script', `${f} names missing "npm run ${name}"`);
    }
  }
}

/** 3. Every D-0NN cited must be an entry in the decision log. */
function checkDecisions() {
  const defined = new Set(
    [...read('docs/DECISIONS.md').matchAll(/^## (D-\d+)/gm)].map((m) => m[1])
  );
  for (const [f, s] of corpus) {
    for (const [, n] of s.matchAll(/\bD-(\d{3})\b/g)) {
      if (!defined.has(`D-${n}`)) add('decision', `${f} cites undefined D-${n}`);
    }
  }
}

/** 4. Every quoted short SHA must resolve to a commit in this repository. */
function checkShas() {
  const seen = new Set();
  for (const [, s] of corpus) {
    for (const [, sha] of s.matchAll(/`([0-9a-f]{7})`/g)) seen.add(sha);
  }
  for (const sha of seen) {
    try {
      const type = execFileSync('git', ['cat-file', '-t', sha], { cwd: root, encoding: 'utf8' });
      if (type.trim() !== 'commit') add('sha', `${sha} is not a commit`);
    } catch {
      add('sha', `${sha} does not resolve`);
    }
  }
}

/** 5. A file:line reference must be inside that file. */
function checkLineRefs() {
  // Uppercase initial REQUIRED too: the first version of this regex matched only
  // [a-z], so an uppercase filename with a line number sailed past it — caught
  // by the negative test, not by reading. Six digits: these files are long.
  const re = /\b([A-Za-z][A-Za-z0-9_/.-]*\.(?:js|css|html|md)):(\d{1,6})\b/g;
  const lineCount = new Map();
  for (const [f, s] of corpus) lineCount.set(f, s.split('\n').length);
  for (const [f, s] of corpus) {
    for (const [, path, num] of s.matchAll(re)) {
      // Exact match MUST win over a suffix match, or docs/screenshots/README.md
      // shadows the root README.md and every line number is judged against the
      // wrong file. Array.find takes the first hit, so the two passes are ordered.
      const keys = [...lineCount.keys()];
      const hit = keys.find((k) => k === path) ?? keys.find((k) => k.endsWith(`/${path}`));
      if (hit && Number(num) > lineCount.get(hit)) {
        add('line-ref', `${f} cites ${path}:${num} but it has ${lineCount.get(hit)} lines`);
      }
    }
  }
}

/**
 * 6. An identifier a document names in backticks must exist in the source.
 *
 * Explicitly-historical mentions are exempt: the convention (CLAUDE.md §
 * Decision Logging) is that a record of a past state is PRESERVED, not
 * maintained, so "`setRecsHintOwner()` is GONE" must not fail this check.
 */
const HISTORICAL = /\bGONE\b|renamed from|retired|used to|no longer|removed|deleted|is now|when this was written/i;
function checkIdentifiers() {
  for (const [f, s] of md) {
    if (f === PRESERVED) continue;
    const lines = s.split('\n');
    lines.forEach((line, i) => {
      // Prose wraps, so "is now `x()`" can land a line after the name it retires.
      const window = lines.slice(Math.max(0, i - 1), i + 2).join(' ');
      if (HISTORICAL.test(window)) return;
      for (const [, name] of line.matchAll(/`([a-z][A-Za-z0-9_]{2,})\(\)`/g)) {
        if (!new RegExp(`\\b${name}\\b`).test(sourceText)) {
          add('identifier', `${f}:${i + 1} cites ${name}() which is not in the source`);
        }
      }
    });
  }
}

/** 7. Every capture on disk is indexed, and every stated capture count is right. */
const WORDS = { 'thirty-five': 35, 'thirty-six': 36, 'thirty-seven': 37, 'thirty-eight': 38 };
function checkCaptures() {
  const dir = 'docs/screenshots';
  const pngs = readdirSync(join(root, dir)).filter((f) => f.endsWith('.png'));
  const index = read(`${dir}/README.md`);
  for (const p of pngs) {
    if (!index.includes(p)) add('capture', `${p} is not named in ${dir}/README.md`);
  }
  for (const [f, s] of corpus) {
    for (const [, n] of s.matchAll(/([0-9]{2}|thirty-[a-z]+) captures/gi)) {
      const claimed = WORDS[n.toLowerCase()] ?? Number(n);
      if (Number.isFinite(claimed) && claimed !== pngs.length && !/until 2026-|read "/.test(s)) {
        add('capture-count', `${f} says ${n} captures; there are ${pngs.length}`);
      }
    }
  }
}

/**
 * 8. Retired phrasing must not come back.
 *
 * "name some films" undersold the recommendation run (it reads every rated film
 * and review, infers a taste, excludes owned titles and justifies each pick);
 * "cheap tier" was both dismissive AND inaccurate, since Haiku is a PAID tier and
 * OpenRouter has free models this project never uses. "Cheaper" is the honest
 * comparative against the Sonnet the verdict runs on. A line may still quote the
 * retired wording while explaining that it was retired.
 */
const RETIRED = [
  { phrase: 'name some films', unless: /dismissive/i },
  { phrase: 'cheap tier', unless: /dismissive|inaccurate/i },
];
function checkRetiredPhrasing() {
  for (const [f, s] of corpus) {
    if (f === SELF || f === PRESERVED) continue;
    s.split('\n').forEach((line, i) => {
      for (const { phrase, unless } of RETIRED) {
        if (line.toLowerCase().includes(phrase) && !unless.test(line)) {
          add('retired-phrase', `${f}:${i + 1} uses retired wording "${phrase}"`);
        }
      }
    });
  }
}

for (const check of [checkPaths, checkNpmScripts, checkDecisions, checkShas,
  checkLineRefs, checkIdentifiers, checkCaptures, checkRetiredPhrasing]) {
  check();
}

if (fail.length) {
  console.error(`\u2717 check-claims: ${fail.length} claim(s) no longer resolve\n`);
  for (const f of fail) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`\u2713 check-claims: every resolvable claim checks out (${corpus.length} files)`);
