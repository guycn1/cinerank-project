import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadPrompt } from '../server/services/promptLoader.js';

// promptLoader reads the real files in prompts/ — this is the guard that the
// versioned prompt files stay well-formed and that {{PLACEHOLDER}} substitution
// and the # System / # User split keep working (CLAUDE.md § Prompt Versioning).

test('loadPrompt: splits system/user and strips the leading dev comment', async () => {
  const { system, user, version } = await loadPrompt('recommend_v3', {
    TASTE_PROFILE: '- "Whiplash" (2014) — rated 10/10',
  });
  assert.equal(version, 'recommend_v3');
  assert.ok(system.length > 0 && user.length > 0);
  assert.ok(!system.includes('<!--'), 'dev comment must be stripped');
  assert.ok(!system.includes('# User'), 'sections must be split, not concatenated');
});

test('loadPrompt: substitutes every placeholder occurrence', async () => {
  const { user } = await loadPrompt('recommend_v3', { TASTE_PROFILE: 'MARKER_123' });
  assert.ok(user.includes('MARKER_123'));
  assert.ok(!user.includes('{{TASTE_PROFILE}}'), 'no placeholder left unsubstituted');
});

test('loadPrompt: taste_verdict_v4 keeps its RATED_MOVIES slot and injection markers', async () => {
  const { user } = await loadPrompt('taste_verdict_v4', { RATED_MOVIES: 'SEED_LIST' });
  assert.ok(user.includes('SEED_LIST'));
  assert.match(user, /BEGIN RATED MOVIES/);
  assert.match(user, /END RATED MOVIES/);
});

test('loadPrompt: throws a clear error for a missing version', async () => {
  await assert.rejects(() => loadPrompt('does_not_exist_v9'), /ENOENT|no such file/i);
});
