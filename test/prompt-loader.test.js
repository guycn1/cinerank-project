/**
 * @file promptLoader reads the real files in prompts/ — this is the guard that the
 * versioned prompt files stay well-formed and that {{PLACEHOLDER}} substitution
 * and the # System / # User split keep working (CLAUDE.md § Prompt Versioning).
 *
 * Two behaviours cannot be exercised through the real files, so they are also
 * run against one in-memory FIXTURE prompt. The dev-comment strip never matters
 * for a real prompt, whose comment ends before `# System` and never names a
 * section, so the section regex skips it unaided; and no real prompt repeats a
 * placeholder inside one section, so a substitution that replaced only the first
 * occurrence would pass against all of them. `node:fs/promises` is mocked to
 * serve the fixture for its one version name and the real file for every other.
 *
 * The fixture also carries the entities a prompt file writes so GitHub can
 * display it (`&lt;` and the like): they must reach the model as the plain
 * characters, decoded once, and never in text substituted into the prompt.
 */
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFile as realReadFile } from 'node:fs/promises';

const FIXTURE_VERSION = '__fixture_loader_v0';

// The comment names both section headings, which is exactly what makes the strip
// load-bearing: without it, the section regex would match inside the comment.
const FIXTURE = `<!--
Dev notes: edit the # System and # User sections below; {{X}} is filled in.
-->

# System
Sys {{X}} &lt;end&gt; &amp;lt;

# User
First {{X}}, then {{ X }} again.
`;

mock.module('node:fs/promises', {
  namedExports: {
    readFile: async (path, encoding) =>
      String(path).endsWith(`${FIXTURE_VERSION}.md`) ? FIXTURE : realReadFile(path, encoding),
  },
});

const { loadPrompt } = await import('../server/services/promptLoader.js');

test('loadPrompt: splits system/user and strips the leading dev comment', async () => {
  const { system, user, version } = await loadPrompt('recommend_v3', {
    TASTE_PROFILE: '- "Whiplash" (2014) — rated 10/10',
  });
  assert.equal(version, 'recommend_v3');
  assert.ok(system.length > 0 && user.length > 0);
  assert.ok(!system.includes('<!--'), 'dev comment must be stripped');
  assert.ok(!system.includes('# User'), 'sections must be split, not concatenated');

  // Exact equality, not "contains no <!--": an unstripped comment that names
  // "# System" makes the regex split INSIDE the comment, leaving a system prompt
  // that holds no comment marker at all — just the wrong text.
  // The entities decode to the characters, once: `&amp;lt;` is `&lt;`, not `<`.
  const fixture = await loadPrompt(FIXTURE_VERSION, { X: 'MARK' });
  assert.equal(fixture.system, 'Sys MARK <end> &lt;');
  assert.equal(fixture.user, 'First MARK, then MARK again.');

  // What the model receives from the real files: each recommendation prompt's
  // output contract carries its placeholders in angle brackets, written in the
  // file as entities so GitHub displays them.
  for (const v of ['recommend_v1', 'recommend_v2', 'recommend_v3']) {
    const p = await loadPrompt(v, { TASTE_PROFILE: 'P' });
    assert.ok(p.system.includes('[{ "title": "<movie title>", "reason": "<'), `${v} contract`);
    assert.doesNotMatch(p.system + p.user, /&(lt|gt|amp);/, `${v} reaches the model with no entity`);
  }
});

test('loadPrompt: substitutes every placeholder occurrence', async () => {
  const { user } = await loadPrompt('recommend_v3', { TASTE_PROFILE: 'MARKER_123' });
  assert.ok(user.includes('MARKER_123'));
  assert.ok(!user.includes('{{TASTE_PROFILE}}'), 'no placeholder left unsubstituted');

  // The fixture's User section carries the placeholder TWICE, the second time
  // with inner spaces; every real prompt carries its one placeholder once, in
  // its User section.
  const fixture = await loadPrompt(FIXTURE_VERSION, { X: 'MARK' });
  assert.equal(fixture.user.match(/MARK/g)?.length, 2, 'both occurrences in one section');
  assert.ok(!fixture.user.includes('{{'), 'no placeholder left unsubstituted');

  // A substituted value is the user's own text, so an entity in it is left
  // exactly as written: the decoding belongs to the prompt file alone.
  const review = await loadPrompt(FIXTURE_VERSION, { X: '&lt;3 &amp; more' });
  assert.equal(review.user, 'First &lt;3 &amp; more, then &lt;3 &amp; more again.');

  // Every `$` sequence that String.replace() treats as special in a string
  // replacement, and two it does not: each must reach the model as typed.
  const dollars = "$& $' $` $$ $5 $1";
  const raw = await loadPrompt(FIXTURE_VERSION, { X: dollars });
  assert.equal(raw.user, `First ${dollars}, then ${dollars} again.`);
});

test('loadPrompt: taste_verdict_v7 keeps its RATED_MOVIES slot and injection markers', async () => {
  const { user } = await loadPrompt('taste_verdict_v7', { RATED_MOVIES: 'SEED_LIST' });
  assert.ok(user.includes('SEED_LIST'));
  assert.match(user, /BEGIN RATED MOVIES/);
  assert.match(user, /END RATED MOVIES/);
});

test('loadPrompt: throws a clear error for a missing version', async () => {
  await assert.rejects(() => loadPrompt('does_not_exist_v9'), /ENOENT|no such file/i);
});
