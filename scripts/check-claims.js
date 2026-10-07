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
 * path or a link's target, a script, a decision entry, a commit or a span of
 * commits, a line number, an identifier, a capture, an RS key, a section (a
 * link's `#anchor` or a prose `§ 4.5` / `§ Title`), a phrase the project has
 * retired (a passage narrating its own earlier wording among them), or an
 * invisible character that no reviewer can see. Every one of those can be resolved against the
 * thing it names, so drift in them is a fact, not a matter of taste.
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
import { join, relative, basename, posix } from 'node:path';
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
const TEXT = /\.(md|js|css|html|sql|yaml|yml|json|example|svg)$/;
// .env.example is in here on purpose: it carried the retired "name some films"
// wording for a day after a sweep that claimed to be repo-wide, because that
// sweep was scoped to *.md and *.js and a config template is neither.
// svg for the same reason: favicon.svg's comment block cites files, a step and
// a decision entry. The two git dotfiles have no extension to match, so they
// are named; .gitignore cites a CLAUDE.md section.
const DOTFILES = new Set(['.env.example', '.gitignore', '.gitattributes']);
/**
 * Read a tracked file from the repository root.
 *
 * @param {string} f  A repo-relative path.
 * @returns {string} The file's contents as UTF-8.
 */
const read =(f) => readFileSync(join(root, f), 'utf8');
const corpus = all.filter((f) => TEXT.test(f) || DOTFILES.has(basename(f)))
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

/** The browser files kept in scripts/, which eslint.config.js parses as classic
 *  scripts rather than modules. Keep the two lists in step. */
const CLASSIC_SCRIPTS = new Set(['scripts/debug-recs.js', 'scripts/debug-verdict.js', 'scripts/layout-probe.js']);

/** This file necessarily quotes the patterns it hunts for, so it never scans itself. */
const SELF = 'scripts/check-claims.js';

/**
 * The decision log is a PRESERVED record, never a maintained one (CLAUDE.md §
 * Decision Logging). Its entries quote superseded wording and retired function
 * names on purpose — that quotation is the evidence. Checking it for staleness
 * would demand the destruction of exactly the history it exists to protect, so
 * the two checks that hunt outdated language skip it by name rather than by
 * accident. Everything else about it is still checked: its paths, links and
 * section references, the scripts, D-0NN entries, SHAs, line numbers, captures
 * and RS keys it cites, any invisible character, and any passage narrating its
 * own earlier wording.
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

/**
 * The documents CLAUDE.md § Every document reference is a link applies to:
 * every markdown file except CLAUDE.md, DOSSIER.md and the prompts.
 *
 * @param {string} f  A repo-relative path.
 * @returns {boolean} Whether the linking rule covers it.
 */
const linkedDoc = (f) => f.endsWith('.md') && f !== 'CLAUDE.md' && f !== 'DOSSIER.md' &&
  !f.startsWith('prompts/');

const commitCache = new Map();
/**
 * The full hash of the commit a hash names, or null when it names none.
 *
 * @param {string} sha  A hash of any length git accepts.
 * @returns {string|null} The 40-character hash, or null.
 */
function commitOf(sha) {
  if (!commitCache.has(sha)) {
    let full = null;
    try {
      full = execFileSync('git', ['rev-parse', '--verify', '--quiet', `${sha}^{commit}`],
        { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
    } catch { /* not a commit */ }
    commitCache.set(sha, full);
  }
  return commitCache.get(sha);
}

/**
 * 4b. A commit link points at a real commit by its full hash, and a link
 * labelled with a hash points at that same commit. A label that is prose (a
 * date, a description of the change) cannot be checked against its target, so
 * only its target is resolved. In the documents the linking rule covers, a
 * commit hash outside a link fails too: every hash there is a link (the user's
 * rule, 2026-10-01). Fenced code, headings (rule 9) and image alt text are
 * exempt, since none of them can hold a link. A link to a span of commits, a
 * compare page or a commit history, is resolved too, in every document.
 */
function checkCommitLinks() {
  const link = /\[((?:[^\]\\]|\\.)*)\]\((https:\/\/github\.com\/guycn1\/cinerank-project\/commit\/([0-9a-z]+))\)/g;
  for (const [f, s] of md) {
    for (const m of s.matchAll(link)) {
      const [, label, , sha] = m;
      const full = commitOf(sha);
      if (sha.length !== 40 || full !== sha) {
        add('commit', `${f} links commit ${sha}, which is not the full hash of a commit`);
        continue;
      }
      const named = label.replace(/`/g, '').trim();
      if (/^[0-9a-f]{7,40}$/.test(named) && !sha.startsWith(named)) {
        add('commit', `${f} labels a link ${named} but it points at ${sha.slice(0, 7)}`);
      }
    }
    // A span of commits links a compare page, base...head, or the history up
    // to a commit (or `main`). Both ends must be full hashes of real commits,
    // and the base must be an ancestor of the head, or the page lists the
    // wrong commits.
    const span = /\]\(https:\/\/github\.com\/guycn1\/cinerank-project\/(compare|commits)\/([^)\s]+)\)/g;
    for (const [, kind, ref] of s.matchAll(span)) {
      const ends = kind === 'compare' ? ref.split('...') : [ref];
      if (kind === 'commits' && ref === 'main') continue;
      if (ends.length !== (kind === 'compare' ? 2 : 1) ||
          ends.some((e) => e.length !== 40 || commitOf(e) !== e)) {
        add('commit', `${f} links ${kind}/${ref}, which is not made of full commit hashes`);
        continue;
      }
      if (kind === 'compare') {
        try {
          execFileSync('git', ['merge-base', '--is-ancestor', ends[0], ends[1]], { cwd: root });
        } catch {
          add('commit', `${f} links compare/${ref}, whose base is not an ancestor of its head`);
        }
      }
    }
    if (!linkedDoc(f)) continue;
    let fence = false;
    let alt = false;
    s.split('\n').forEach((line, i) => {
      if (/^\s*(```|~~~)/.test(line)) { fence = !fence; return; }
      if (fence || /^#{1,6}\s/.test(line)) return;
      if (alt) { if (line.includes('](')) alt = false; return; }
      if (/!\[[^\]]*$/.test(line)) { alt = true; return; }
      const prose = line.replace(/!?\[(?:[^\]\\]|\\.)*\]\([^)]*\)/g, ' ');
      for (const [, sha] of prose.matchAll(/(?<![\w/#.-])`?([0-9a-f]{7,40})`?(?![\w])/g)) {
        if (commitOf(sha)) add('commit', `${f}:${i + 1} quotes commit ${sha} without linking it`);
      }
    });
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
 *   file's comment text keyed by line number. The browser files in scripts/
 *   are parsed as classic scripts, as eslint.config.js parses them.
 */
function indexJavaScript() {
  const linter = new Linter();
  const known = new Set();
  const commentLines = new Map();
  for (const [f, s] of corpus) {
    if (!f.endsWith('.js')) continue;
    const sourceType = CLASSIC_SCRIPTS.has(f) ? 'script' : 'module';
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
  new RegExp(`${UNQUOTED}\\b(this|that)\\s+${PASSAGE}\\s+(said|read)\\s+["“]`, 'gi'),
  new RegExp(`${UNQUOTED}\\bthis\\s+(said|read)\\s+["“]`, 'gi'),
  new RegExp(`${UNQUOTED}\\bthis\\s+(said|read|listed|claimed)\\b[^.]{0,120}?\\buntil\\s+20\\d\\d-\\d\\d-\\d\\d`, 'gi'),
  /\(\s*This\s+(said|read|listed|claimed)\b/g,
  new RegExp(`${UNQUOTED}\\bthis\\s+pointed\\s+at\\b`, 'gi'),
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
 * Only the unambiguous forms are matched — "This said", "This read" or "that
 * sentence read" before a quotation, "this entry used to…", "this pointed at", "an earlier version of
 * this note", "rather than preserved". The rule's real line is semantic: history of the
 * APP or the CODE stays, history of the WORDING goes, and no pattern can tell
 * "this line read X" about a code line from the same words about a comment.
 * That judgement stays a reading job; this catches the phrasing that is only
 * ever self-narration.
 *
 * Covers the markdown, except DOSSIER.md (the course's own text) and prompts/
 * (versioned text the model reads, D-084), and every comment in the JS, CSS and
 * HTML. A run of consecutive comment lines is read as one passage, so a phrase
 * that wraps is still seen.
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

/*
 * 11. Every section reference resolves: a link's `#fragment` must be a heading
 * anchor in the file it points at (11a), and a prose `§ 4.5` or `§ Title` must
 * name a heading in the file it refers to (11b). A renamed or renumbered
 * heading used to break every link and reference to it silently; the one-off
 * audits of 2026-09-19 found them by hand, and nothing kept them found. 11c,
 * further down, resolves the file each link points at.
 * Sources exempt from all three: this file (it quotes the patterns), prompts/
 * (versioned text the model reads, D-084) and DOSSIER.md (the course's own
 * text). They are still valid TARGETS.
 */

/**
 * GitHub's anchor for a heading's text: markdown removed, lower-cased, every
 * character that is not a letter, mark, number, `_`, `-` or space dropped,
 * each space turned into a hyphen. So "5. Data model (Supabase / Postgres)"
 * becomes `5-data-model-supabase--postgres`. Checked against GitHub's own
 * rendering of every heading in this repository before this check went in.
 *
 * @param {string} text  The heading's source text, after the `#` marks.
 * @returns {string}
 */
function headingSlug(text) {
  return plainHeading(text).toLowerCase().replace(/[^\p{L}\p{M}\p{N}_\- ]/gu, '').replace(/ /g, '-');
}

/**
 * A heading's text as it renders: code spans and links keep their text,
 * emphasis markers, inline HTML and backslash escapes go.
 *
 * @param {string} text
 * @returns {string}
 */
function plainHeading(text) {
  // Code spans render their text literally, `<tfoot>` included, so only the
  // text between them is treated as markdown.
  return text.split(/(`[^`]*`)/).map((part) => (part.startsWith('`') ? part.slice(1, -1)
    : part.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/<[^>]+>/g, '').replace(/\\(.)/g, '$1').replace(/\*/g, '')))
    .join('').trim();
}

/** @type {Map<string, {slugs: Set<string>, headings: Map<string, string>, titles: string[]}>} */
const headingCache = new Map();

/**
 * Every heading of a markdown file: its anchors (with GitHub's -1, -2 suffixes
 * for repeats, plus any `<a id>` / `<a name>`), and its rendered texts.
 *
 * @param {string} file  A repo-relative .md path.
 * @returns {{slugs: Set<string>, headings: Map<string, string>, titles: string[]}}
 */
function headingsOf(file) {
  if (headingCache.has(file)) return headingCache.get(file);
  const slugs = new Set(); const headings = new Map(); const titles = []; const seen = new Map();
  let fenced = false;
  for (const line of read(file).split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; continue; }
    if (fenced) continue;
    for (const [, id] of line.matchAll(/<a\s+(?:id|name)="([^"]+)"/g)) slugs.add(id);
    const m = line.match(/^#{1,6}\s+(.*?)\s*#*\s*$/);
    if (!m) continue;
    const base = headingSlug(m[1]);
    const n = seen.get(base) || 0; seen.set(base, n + 1);
    const slug = n ? `${base}-${n}` : base;
    slugs.add(slug); headings.set(slug, plainHeading(m[1])); titles.push(plainHeading(m[1]));
  }
  const entry = { slugs, headings, titles };
  headingCache.set(file, entry);
  return entry;
}

/**
 * Whether checks 11a to 11c skip a file as a SOURCE: this file, DOSSIER.md and
 * prompts/, for the reasons in check 11's header. Each is still a valid target.
 *
 * @param {string} f  A repo-relative path.
 * @returns {boolean} True when neither its links nor its § references are checked.
 */
const SECTION_EXEMPT = (f) => f === SELF || f === 'DOSSIER.md' || f.startsWith('prompts/');

/**
 * Where a link points inside this repository, or null for anything external.
 * Absolute links to a file on this repository's GitHub blob view count too,
 * because docs/SECURITY.md has to use them (CLAUDE.md, Markdown rule 8).
 *
 * @param {string} from  The file the link is in.
 * @param {string} href  The link target before the `#`.
 * @returns {string|null}
 */
function linkTarget(from, href) {
  if (!href) return from;
  const blob = href.match(/^https:\/\/github\.com\/[^/]+\/[^/]+\/blob\/[^/]+\/(.+)$/);
  if (blob) return decodeURIComponent(blob[1]);
  if (/^[a-z]+:/i.test(href)) return null;
  return posix.normalize(posix.join(posix.dirname(from), decodeURIComponent(href)));
}

/** 11a. Every link fragment names a real heading, and a "§ N" label its number. */
function checkLinkFragments() {
  for (const [f, s] of md) {
    if (SECTION_EXEMPT(f)) continue;
    // The whole file, not line by line: a wrapped paragraph often splits a
    // link's label across two lines.
    for (const m of s.matchAll(/\[((?:[^\][]|\[[^\]]*\])*)\]\(([^)\s#]*)#([^)\s]+)\)/g)) {
      const [, label, href, frag] = m;
      const target = linkTarget(f, href);
      if (!target || !corpus.some(([c]) => c === target)) continue;
      const where = `${f}:${s.slice(0, m.index).split('\n').length}`;
      if (!target.endsWith('.md')) {
        const l = frag.match(/^L(\d+)/);
        if (!l || Number(l[1]) > read(target).split('\n').length) add('section', `${where} links ${target}#${frag}, which is not a line in it`);
        continue;
      }
      const { slugs, headings } = headingsOf(target);
      const anchor = decodeURIComponent(frag).toLowerCase();
      if (!slugs.has(anchor)) { add('section', `${where} links ${target}#${frag}, which is no heading there`); continue; }
      const num = label.match(/§\s*(\d+(?:\.\d+)*)/);
      if (num && !new RegExp(`^${num[1].replace(/\./g, '\\.')}[.\\s]`).test(headings.get(anchor) || '')) {
        add('section', `${where} labels a link "§ ${num[1]}" but it goes to "${headings.get(anchor)}"`);
      }
    }
  }
}

/**
 * 11c. Every link and image in a document points at something that exists.
 *
 * Check 1 finds a path only when it starts with a known top-level directory,
 * and 11a moves past a fragment link whose target file is missing, so a
 * relative link inside docs/ to a misspelt file passed both. This resolves each
 * link's target the way GitHub does, relative to the file it sits in, and
 * accepts any existing file or directory. Fenced blocks and code spans are
 * blanked first, since link syntax quoted there is not a link.
 */
function checkLinkTargets() {
  for (const [f, s] of md) {
    if (SECTION_EXEMPT(f)) continue;
    const text = s
      .replace(/^[ \t]*(```|~~~)[\s\S]*?^[ \t]*\1.*$/gm, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/(`+)[\s\S]*?\1/g, (m) => m.replace(/[^\n]/g, ' '));
    for (const m of text.matchAll(/\[(?:[^\][]|\[[^\]]*\])*\]\(([^)\s#]*)(?:#[^)\s]*)?\)/g)) {
      const href = m[1];
      if (!href) continue;
      const target = linkTarget(f, href);
      if (!target || existsSync(join(root, target))) continue;
      add('link', `${f}:${text.slice(0, m.index).split('\n').length} links ${href}, which does not exist`);
    }
  }
}

const FILE_ALIASES = { SPEC: 'SPEC.md', CLAUDE: 'CLAUDE.md', README: 'README.md', DOSSIER: 'DOSSIER.md' };

/**
 * The markdown file a name in prose means: an alias such as SPEC, or a path
 * or bare file name matched against the repository's markdown.
 *
 * @param {string} name
 * @returns {string|null}
 */
function mdFileNamed(name) {
  if (FILE_ALIASES[name]) return FILE_ALIASES[name];
  const files = md.map(([m]) => m);
  return files.find((m) => m === name) ?? files.find((m) => m.endsWith(`/${name}`)) ?? null;
}

/**
 * Does a file have a heading this reference names? A number must open a
 * heading ("4.5" matches "4.5 API Endpoints"); a title must agree with a
 * heading's leading words, with the heading's own numbering and a trailing
 * parenthetical ignored, in either direction, since prose stops a title
 * wherever the sentence goes on.
 *
 * @param {string} file
 * @param {string} ref  The text after the `§`.
 * @returns {boolean|null} null when the text is not a section reference at all.
 */
function hasSection(file, ref) {
  const { titles } = headingsOf(file);
  const num = ref.match(/^(\d+(?:\.\d+)*)/);
  if (num) return titles.some((t) => new RegExp(`^${num[1].replace(/\./g, '\\.')}[.\\s]`).test(t));
  if (!/^[A-Z]/.test(ref)) return null;
  const words = (t) => t.toLowerCase().split(/\s+/).filter(Boolean);
  const wanted = words(ref.split(/[)\],.;:—–]| #| \(/)[0]);
  if (!wanted.length) return null;
  return titles.some((t) => {
    const core = words(t.replace(/^\d+(\.\d+)*\.?\s+/, '').replace(/\s*\(.*\)\s*$/, ''));
    let same = 0;
    while (same < core.length && same < wanted.length && core[same] === wanted[same]) same += 1;
    // The whole heading named, or the prose's whole title a prefix of it...
    if (same && (same === core.length || same === wanted.length)) return true;
    // ...or prose running straight on past a title ("§ Button labels was
    // found…"), which must agree on at least two CONTENT words: "Security &"
    // is one word, not two, and alone it would match "Security & Scope".
    return core.slice(0, same).filter((w) => !TITLE_FILLER.has(w)).length >= 2;
  });
}

/** Words that do not identify a heading on their own. */
const TITLE_FILLER = new Set(['&', 'and', 'of', 'the', 'a', 'an', 'for', 'to', 'in', 'on', 'with', 'or']);

/**
 * The text a file's prose lives in, one entry per blank-line-separated block,
 * with comment markers blanked and newlines turned to spaces so a reference
 * that wraps is read whole. Lengths are preserved, so an index still maps to
 * its line. Links are blanked too: 11a already checks them.
 *
 * @param {string} s
 * @returns {{text: string, raw: string, line: number}[]}
 */
function proseBlocks(s) {
  const blocks = []; let line = 1;
  for (const raw of s.split(/\n[ \t]*\n/)) {
    const text = raw
      .replace(/\[(?:[^\][]|\[[^\]]*\])*\]\([^)\s]*\)/g, (m) => ' '.repeat(m.length))
      .replace(/`[^`\n]*§[^`\n]*`/g, (m) => ' '.repeat(m.length)) // `§7.2` is an example, not a reference
      .replace(/`/g, ' ').replace(/\\(.)/g, ' $1')
      .replace(/(^|\n)[ \t]*(\/\/+|\*|#|--|<!--)?/g, (m) => ' '.repeat(m.length));
    blocks.push({ text, raw, line });
    line += raw.split('\n').length + 1;
  }
  return blocks;
}

/**
 * The files a "§" at `idx` may mean. A file named right before it is the only
 * candidate. A bare one may mean the file last named in the same block (as in
 * "SPEC.md § 4.5 … and § 5"), the file it sits in, SPEC.md or CLAUDE.md; it
 * resolves if any of them has the heading, and a renamed heading has it in none.
 *
 * @param {string} text  The block, as proseBlocks() returns it.
 * @param {number} idx   Where the `§` is.
 * @param {string} f     The file the block is in.
 * @param {string|null} lastNamed
 * @returns {{named: string|null, candidates: string[]}}
 */
function sectionCandidates(text, idx, f, lastNamed) {
  const before = text.slice(Math.max(0, idx - 80), idx).match(/((?:[\w-]+\/)*[\w-]+\.md|\bSPEC|\bCLAUDE|\bREADME|\bDOSSIER)\s*$/);
  const named = before ? mdFileNamed(before[1].replace(/^\b/, '')) : null;
  if (named) return { named, candidates: [named] };
  const pool = [lastNamed, f.endsWith('.md') ? f : null, 'SPEC.md', 'CLAUDE.md'];
  return { named: null, candidates: [...new Set(pool.filter(Boolean))] };
}

/** 11b. Every prose "§ 4.5" or "§ Title" names a heading in the file it means. */
function checkSectionReferences() {
  for (const [f, s] of corpus) {
    if (SECTION_EXEMPT(f)) continue;
    for (const { text, raw, line } of proseBlocks(s)) {
      let lastNamed = null;
      for (const m of text.matchAll(/§§?/g)) {
        const rest = text.slice(m.index + m[0].length, m.index + m[0].length + 80).split('§')[0].trim();
        const { named, candidates } = sectionCandidates(text, m.index, f, lastNamed);
        if (named) lastNamed = named;
        if (/^\S*\s*[^.]{0,40}\b(does not|doesn’t|doesn't|never) exist/.test(rest)) continue; // a reference TO a missing heading, on purpose
        const results = candidates.map((c) => hasSection(c, rest));
        if (results.includes(null) || results.includes(true)) continue;
        const at = line + raw.slice(0, m.index).split('\n').length - 1;
        add('section', `${f}:${at} cites ${candidates.join(' / ')} § ${rest.slice(0, 40)}, which is no heading there`);
      }
    }
  }
}

for (const check of [checkPaths, checkNpmScripts, checkDecisions, checkShas, checkCommitLinks,
  checkLineRefs, checkIdentifiers, checkCommentIdentifiers, checkCaptures, checkResilienceKeys,
  checkInvisibleCharacters,
  checkRetiredPhrasing, checkEditHistory, checkLinkFragments, checkLinkTargets,
  checkSectionReferences]) {
  check();
}

if (fail.length) {
  console.error(`\u2717 check-claims: ${fail.length} claim(s) no longer resolve\n`);
  for (const f of fail) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`\u2713 check-claims: every claim it resolves checks out (${corpus.length} files)`);
