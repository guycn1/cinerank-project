#!/usr/bin/env node
/**
 * @file check-claims.js — the fifth commit gate (CLAUDE.md § Version Control Workflow).
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
 * capture, an RS key, a phrase the project has retired (a passage narrating
 * its own earlier wording among them), or an invisible character that no
 * reviewer can see. Every one of those can be resolved against
 * the thing it names, so drift in them is a fact, not a matter of taste.
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
import { Linter } from 'eslint';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.git', '.idea']);

/**
 * Every file outside the skipped directories, as repo-relative POSIX-ish paths.
 * Binary files are listed too; `corpus` below narrows this to the text we read.
 *
 * @param {string} [dir]  The directory to walk; defaults to the repo root.
 * @param {string[]} [out]  Accumulator shared across the recursion.
 * @returns {string[]} The same array as `out`, filled.
 */
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
/**
 * @param {string} f  A repo-relative path.
 * @returns {string} The file's contents as UTF-8.
 */
const read = (f) => readFileSync(join(root, f), 'utf8');
const corpus = all.filter((f) => TEXT.test(f) || basename(f) === '.env.example')
  .map((f) => [f, read(f)]);
const md = corpus.filter(([f]) => f.endsWith('.md'));
const sourceText = corpus.filter(([f]) => /\.(js|css|html)$/.test(f))
  .map(([, s]) => s).join('\n');

const fail = [];

/**
 * Record one claim that did not resolve. The run exits 1 at the end if any were
 * recorded.
 *
 * @param {string} check  The check's short name, e.g. "path".
 * @param {string} detail  Which file says what, and why it does not hold.
 * @returns {number} How many failures are now recorded.
 */
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

/** Words that mark a mention as explicitly historical; see checkIdentifiers(). */
const HISTORICAL = /\bGONE\b|renamed from|retired|used to|no longer|removed|deleted|is now|when this was written/i;
/**
 * 6. An identifier a document names in backticks must exist in the source.
 *
 * Explicitly-historical mentions are exempt: the convention (CLAUDE.md §
 * Decision Logging) is that a record of a past state is PRESERVED, not
 * maintained, so "`setRecsHintOwner()` is GONE" must not fail this check.
 *
 * Only a lowercase name written as a call, in backticks, in a markdown file is
 * matched, and docs/DECISIONS.md is skipped as preserved. The line above and
 * the line below count as context, because prose wraps.
 */
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

/**
 * Parse every JS file once, with ESLint's own parser, for check 6b. A regex
 * cannot tell a comment from a string or a regex literal that happens to
 * contain `//`; the parser can.
 *
 * @returns {{ known: Set<string>, commentLines: Map<string, Map<number, string>> }}
 *   Every identifier and keyword in the CODE, comments excluded, and each
 *   file's comment text keyed by line number. debug-recs.js is parsed as a
 *   classic script, as eslint.config.js parses it.
 */
function indexJavaScript() {
  const linter = new Linter();
  const known = new Set();
  const commentLines = new Map();
  for (const [f, s] of corpus) {
    if (!f.endsWith('.js')) continue;
    const sourceType = f === 'scripts/debug-recs.js' ? 'script' : 'module';
    const fatal = linter
      .verify(s, [{ languageOptions: { ecmaVersion: 2024, sourceType } }], f)
      .find((m) => m.fatal);
    if (fatal) {
      add('comment-identifier', `${f} does not parse: ${fatal.message}`);
      continue;
    }
    const code = linter.getSourceCode();
    for (const t of code.ast.tokens) {
      if (t.type === 'Identifier' || t.type === 'Keyword') known.add(t.value);
    }
    const lines = new Map();
    for (const c of code.getAllComments()) {
      c.value.split('\n').forEach((text, i) => lines.set(c.loc.start.line + i, text));
    }
    commentLines.set(f, lines);
  }
  return { known, commentLines };
}

let jsIndex;
/**
 * indexJavaScript(), run once: checks 6b and 10b both read it.
 *
 * @returns {ReturnType<typeof indexJavaScript>}
 */
const javaScriptIndex = () => (jsIndex ??= indexJavaScript());

/**
 * 6b. A function a CODE COMMENT names must exist in the code.
 *
 * Check 6 reads markdown only, so for most of this project's life a name in a
 * comment was checked by nothing — and two comments named functions that had
 * never existed at all. This resolves against the code TOKENS rather than the
 * raw text, because in the raw text a name that appears only in a comment
 * would vouch for itself.
 *
 * `name()` is matched with or without backticks, since comments rarely use
 * them, but not `obj.name()`: a method on something else, most often the DOM,
 * is not this repository's to resolve. A word in index.html or styles.css
 * counts as known too, since a comment may point at either. HISTORICAL exempts
 * a retired name exactly as in check 6, over the same three-line window.
 */
function checkCommentIdentifiers() {
  const { known, commentLines } = javaScriptIndex();
  for (const f of ['public/index.html', 'public/styles.css']) {
    for (const [word] of read(f).matchAll(/[A-Za-z_$][\w$-]*/g)) known.add(word);
  }
  for (const [f, lines] of commentLines) {
    if (f === SELF) continue;
    for (const [n, text] of lines) {
      const window = [lines.get(n - 1) ?? '', text, lines.get(n + 1) ?? ''].join(' ');
      if (HISTORICAL.test(window)) continue;
      for (const [, name] of text.matchAll(/(?<![\w$.#-])([A-Za-z_$][\w$]*)\(\)/g)) {
        if (!known.has(name)) add('comment-identifier', `${f}:${n} names ${name}() which is not in the code`);
      }
    }
  }
}

/** The spelled-out capture counts checkCaptures() can read. */
const WORDS = { 'thirty-five': 35, 'thirty-six': 36, 'thirty-seven': 37, 'thirty-eight': 38 };
/** 7. Every capture on disk is indexed, and every stated capture count is right. */
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
      if (Number.isFinite(claimed) && claimed !== pngs.length) {
        add('capture-count', `${f} says ${n} captures; there are ${pngs.length}`);
      }
    }
  }
}

/**
 * 8. Every RS-n cited in prose must have at least one capture on disk.
 *
 * Narrow on purpose. The tempting neighbour — "does every 'N states' claim match
 * the real count" — was considered and REJECTED, because "two states that look
 * like failures and are not" is a perfectly good sentence that such a rule would
 * flag. A check that cries wolf buries the ones that matter (CLAUDE.md §
 * Markdown Authoring Rules makes the same argument for what the markdown checker
 * deliberately skips). Scope drift inside a prose claim — "all nine" surviving
 * until the set reached sixteen — stays a reading job, and is named here so
 * nobody assumes a green run covered it.
 */
function checkResilienceKeys() {
  const pngs = readdirSync(join(root, 'docs/screenshots'));
  const cited = new Set();
  for (const [, s] of corpus) {
    for (const [, n] of s.matchAll(/\bRS-(\d{1,2})\b/g)) cited.add(n);
  }
  for (const n of cited) {
    if (!pngs.some((p) => p.startsWith(`rs-${n}-`))) {
      add('resilience-key', `RS-${n} is cited but has no rs-${n}-*.png capture`);
    }
  }
}

/**
 * 9. No invisible characters anywhere in the repository.
 *
 * A standing rule (CLAUDE.md § Button labels) says the non-breaking space that
 * glues a glyph to its word is written as an ESCAPE in the string, never as a
 * literal character — and the tooling trap under § Environment & tooling traps
 * records
 * that escape being collapsed into a literal twice while people tried to write
 * it down. On 2026-09-15 the user found a third: the sentence STATING the rule
 * contained a literal U+00A0 inside its own code span, so the document forbidding
 * the character demonstrated it with one, and rendered as an empty chip.
 *
 * `public/app.js` was clean throughout — the code always obeyed the rule; only
 * the prose describing it did not. Checked here rather than trusted, because an
 * invisible character cannot be reviewed by eye and the repo-wide count is zero,
 * so this can never cry wolf. Zero-width and BOM characters ride along: they are
 * the same hazard, arrive the same way (a paste), and are equally unreviewable.
 *
 * The characters themselves are the values of `INVISIBLE`, directly below,
 * keyed by their code points; checkInvisibleCharacters() runs the check.
 */
const INVISIBLE = { 'U+00A0': ' ', 'U+200B': '​', 'U+FEFF': '﻿', 'U+2028': ' ' };
/**
 * 9. The check described above `INVISIBLE`: any of its characters, in any file
 * but this one, is a failure.
 */
function checkInvisibleCharacters() {
  for (const [f, s] of corpus) {
    if (f === SELF) continue;
    for (const [name, ch] of Object.entries(INVISIBLE)) {
      const n = s.split(ch).length - 1;
      if (n) add('invisible-char', `${f} contains ${n} literal ${name}`);
    }
  }
}

/**
 * Each retired phrase, and the pattern that marks a line as merely quoting it
 * while explaining the retirement. See checkRetiredPhrasing().
 */
const RETIRED = [
  { phrase: 'name some films', unless: /dismissive/i },
  { phrase: 'cheap tier', unless: /dismissive|inaccurate/i },
];
/**
 * 10. Retired phrasing must not come back.
 *
 * "name some films" undersold the recommendation run (it reads the whole list,
 * infers a taste from the top five rated films and their reviews, excludes every
 * title already in it, and justifies each pick);
 * "cheap tier" was both dismissive AND inaccurate, since Haiku is a PAID tier and
 * OpenRouter has free models this project never uses. "Cheaper" is the honest
 * comparative against the Sonnet the verdict runs on. A line may still quote the
 * retired wording while explaining that it was retired.
 */
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

/** Not preceded by a quotation mark: a quoted form is someone citing it, as rule 10 does. */
const UNQUOTED = '(?<!["“\'`])';
/**
 * The phrasings that are only ever a passage narrating its own earlier wording.
 * "said" and "read" count only before a quotation: "this row read too tall"
 * is about how something LOOKED, and is fine.
 */
const PASSAGE = '(comment|note|paragraph|sentence|entry|bullet|row|item|clause|caption|parenthetical|pointer|block)';
const SELF_NARRATION = [
  new RegExp(`${UNQUOTED}\\bthis\\s+${PASSAGE}\\s+(used\\s+to|once\\s+(said|read|claimed)|claimed|listed|was\\s+(missing|missed))\\b`, 'gi'),
  new RegExp(`${UNQUOTED}\\bthis\\s+${PASSAGE}\\s+(said|read)\\s+["“]`, 'gi'),
  new RegExp(`${UNQUOTED}\\bthis\\s+(said|read)\\s+["“]`, 'gi'),
  new RegExp(`${UNQUOTED}\\bthis\\s+(said|read|listed|claimed)\\b[^.]{0,120}?\\buntil\\s+20\\d\\d-\\d\\d-\\d\\d`, 'gi'),
  /\(\s*This\s+(said|read|listed|claimed)\b/g,
  new RegExp(`${UNQUOTED}\\ban?\\s+earlier\\s+version\\s+of\\s+this\\s+(note|entry|comment|paragraph|sentence|line|rule)\\b`, 'gi'),
  new RegExp(`${UNQUOTED}\\brather\\s+than\\s+preserved\\b`, 'gi'),
];

/**
 * Report every self-narrating phrase in one passage.
 *
 * @param {string} f  The file, for the report.
 * @param {string} text  The passage, line breaks kept so a hit can be located.
 * @param {number} [firstLine=1]  The file line the passage starts on.
 */
function reportSelfNarration(f, text, firstLine = 1) {
  for (const re of SELF_NARRATION) {
    for (const m of text.matchAll(re)) {
      const line = firstLine + (text.slice(0, m.index).match(/\n/g)?.length ?? 0);
      add('edit-history', `${f}:${line} narrates its own earlier wording: "${m[0].replace(/\s+/g, ' ')}"`);
    }
  }
}

/**
 * 10b. No passage narrates its own earlier wording (CLAUDE.md § Markdown
 * Authoring Rules, rule 10). What a document or a comment USED TO SAY belongs
 * in the commit message, not in the file.
 *
 * Only the unambiguous forms are matched — "This said", "This read" before a
 * quotation, "this entry used to…", "an earlier version of this note",
 * "rather than preserved". The rule's real line is semantic: history of the
 * APP or the CODE stays, history of the WORDING goes, and no pattern can tell
 * "this line read X" about a code line from the same words about a comment.
 * That judgement stays a reading job; this catches the phrasing that is only
 * ever self-narration.
 *
 * Covers the markdown, except DOSSIER.md (the course's own text) and prompts/
 * (versioned and never edited), and every comment in the JS, CSS and HTML. A
 * run of consecutive comment lines is read as one passage, so a phrase that
 * wraps is still seen.
 */
function checkEditHistory() {
  for (const [f, s] of md) {
    if (f !== 'DOSSIER.md' && !f.startsWith('prompts/')) reportSelfNarration(f, s);
  }
  for (const [f, lines] of javaScriptIndex().commentLines) {
    if (f === SELF) continue;
    let run = [];
    let start = 0;
    for (const n of [...lines.keys()].sort((a, b) => a - b)) {
      if (run.length && n !== start + run.length) {
        reportSelfNarration(f, run.join('\n'), start);
        run = [];
      }
      if (!run.length) start = n;
      run.push(lines.get(n).replace(/^\s*\*?\s?/, ''));
    }
    if (run.length) reportSelfNarration(f, run.join('\n'), start);
  }
  for (const [f, s] of corpus) {
    if (!/\.(css|html)$/.test(f)) continue;
    for (const m of s.matchAll(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g)) {
      reportSelfNarration(f, m[0], s.slice(0, m.index).split('\n').length);
    }
  }
}

for (const check of [checkPaths, checkNpmScripts, checkDecisions, checkShas,
  checkLineRefs, checkIdentifiers, checkCommentIdentifiers, checkCaptures, checkResilienceKeys,
  checkInvisibleCharacters,
  checkRetiredPhrasing, checkEditHistory]) {
  check();
}

if (fail.length) {
  console.error(`\u2717 check-claims: ${fail.length} claim(s) no longer resolve\n`);
  for (const f of fail) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`\u2713 check-claims: every resolvable claim checks out (${corpus.length} files)`);
