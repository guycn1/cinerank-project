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
Sys {{X}} end.

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
  const fixture = await loadPrompt(FIXTURE_VERSION, { X: 'MARK' });
  assert.equal(fixture.system, 'Sys MARK end.');
  assert.equal(fixture.user, 'First MARK, then MARK again.');
});

test('loadPrompt: substitutes every placeholder occurrence', async () => {
  const { user } = await loadPrompt('recommend_v3', { TASTE_PROFILE: 'MARKER_123' });
  assert.ok(user.includes('MARKER_123'));
  assert.ok(!user.includes('{{TASTE_PROFILE}}'), 'no placeholder left unsubstituted');

  // The fixture's User section carries the placeholder TWICE, the second time
  // with inner spaces; every real prompt carries each one once per section.
  const fixture = await loadPrompt(FIXTURE_VERSION, { X: 'MARK' });
  assert.equal(fixture.user.match(/MARK/g)?.length, 2, 'both occurrences in one section');
  assert.ok(!fixture.user.includes('{{'), 'no placeholder left unsubstituted');
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
