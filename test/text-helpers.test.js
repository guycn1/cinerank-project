import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseModelJson, tidyReason } from '../server/services/recommendations.js';
import { tidyVerdict } from '../server/services/tasteVerdict.js';
import { estimateCostUsd } from '../server/config.js';

// These are the pure helpers where every past truncation bug lived
// (see docs/DECISIONS.md D-011..D-014). No network, no DB.

test('parseModelJson: accepts a clean JSON array', () => {
  const out = parseModelJson('[{"title":"Brazil","reason":"you like bold, strange visions"}]');
  assert.equal(out.length, 1);
  assert.equal(out[0].title, 'Brazil');
  assert.match(out[0].reason, /bold/);
});

test('parseModelJson: tolerates a single ```json fence', () => {
  const out = parseModelJson('```json\n[{"title":"Akira","reason":"animation with real teeth"}]\n```');
  assert.equal(out[0].title, 'Akira');
});

test('parseModelJson: drops entries missing a string title or reason', () => {
  const out = parseModelJson(
    '[{"title":"Dune","reason":"ok"},{"title":123,"reason":"x"},{"title":"No reason"}]'
  );
  assert.deepEqual(out.map((x) => x.title), ['Dune']);
});

test('parseModelJson: caps at 6 suggestions', () => {
  const many = JSON.stringify(
    Array.from({ length: 10 }, (_, i) => ({ title: `M${i}`, reason: 'r' }))
  );
  assert.equal(parseModelJson(many).length, 6);
});

test('parseModelJson: throws on non-JSON and on non-array JSON', () => {
  assert.throws(() => parseModelJson('here are some picks: ...'), /valid JSON/);
  assert.throws(() => parseModelJson('{"title":"x"}'), /not an array/);
});

test('tidyReason: leaves a short reason untouched', () => {
  const s = 'this has the same slow-burn dread you rated highly in Whiplash';
  assert.equal(tidyReason(s), s);
});

test('tidyReason: strips markdown emphasis', () => {
  assert.equal(tidyReason('you love **bold** _weird_ `swings`'), 'you love bold weird swings');
});

test('tidyReason: never cuts mid-word when over the ceiling', () => {
  const long = 'word '.repeat(60).trim();
  const out = tidyReason(long);
  assert.ok(out.length <= 131);
  assert.ok(!/\bwor$/.test(out), 'should not end on a fragment');
  assert.match(out, /(word|…)$/);
});

test('tidyVerdict: leaves a compliant 2-3 sentence verdict intact', () => {
  const v =
    'You chase the swing-for-the-fences stuff and forgive a lot when the vision is bold. ' +
    'Tidy blockbusters lose you fast. You would rather a film overreach than play it safe.';
  assert.equal(tidyVerdict(v), v);
});

test('tidyVerdict: over the 450-char ceiling, ends on a sentence boundary not mid-word', () => {
  const v = ('This is a full sentence about your taste. ').repeat(20).trim();
  const out = tidyVerdict(v);
  assert.ok(out.length <= 451);
  assert.match(out, /[.!?]$|…$/);
});

test('estimateCostUsd: known model, unknown model, zero tokens', () => {
  assert.equal(estimateCostUsd('anthropic/claude-haiku-4.5', 1_000_000), 3);
  assert.equal(estimateCostUsd('some/unknown-model', 1000), null);
  assert.equal(estimateCostUsd('anthropic/claude-haiku-4.5', 0), null);
});
