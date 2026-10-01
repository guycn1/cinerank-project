/**
 * @file Unit tests for the server's pure text and cost helpers: parseModelJson(),
 * tidyReason(), tidyVerdict() and estimateCostUsd().
 *
 * These are the pure helpers where every past truncation bug lived
 * (see docs/DECISIONS.md D-011..D-014). No network, no DB.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseModelJson, tidyReason } from '../server/services/recommendations.js';
import { tidyVerdict } from '../server/services/tasteVerdict.js';
import { estimateCostUsd } from '../server/config.js';

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

/**
 * Assert that `out` is `input` cut at a WORD BOUNDARY and marked with "…": the
 * text before the ellipsis must be a prefix of the input that stops right before
 * a space. Checking the ending alone cannot work, because every cutting path ends
 * in "…" whether it cut mid-word or not.
 *
 * @param {string} out  The tidied text.
 * @param {string} input  What it was made from.
 * @param {number} ceiling  The most characters allowed before the ellipsis.
 */
function assertCutAtWordBoundary(out, input, ceiling) {
  assert.ok(out.endsWith('…'), 'a cut is marked with an ellipsis');
  const kept = out.slice(0, -1);
  assert.ok(kept.length <= ceiling, `${kept.length} characters kept, ceiling ${ceiling}`);
  assert.ok(input.startsWith(kept), 'the kept text is the start of the input');
  assert.equal(input[kept.length], ' ', `cut mid-word: "${kept.slice(-12)}|${input.slice(kept.length, kept.length + 8)}"`);
}

// Seven-character words, so that the 130-character ceiling falls INSIDE a word
// (130 = 18 x 7 + 4). With 'word ' it fell exactly on a space, and a naive cut
// at the ceiling passed.
test('tidyReason: never cuts mid-word when over the ceiling', () => {
  const long = 'cinema '.repeat(30).trim();
  assertCutAtWordBoundary(tidyReason(long), long, 130);
});

test('tidyVerdict: leaves a compliant 2-3 sentence verdict intact', () => {
  const v =
    'You chase the swing-for-the-fences stuff and forgive a lot when the vision is bold. ' +
    'Tidy blockbusters lose you fast. You would rather a film overreach than play it safe.';
  assert.equal(tidyVerdict(v), v);
});

// Two inputs, one per cutting path. The first has sentence ends in reach, so the
// verdict must stop on the last WHOLE sentence that fits (ten of them, 419
// characters) with no ellipsis. The second has none, so it falls back to a word
// boundary and says so with "…".
test('tidyVerdict: over the 450-char ceiling, ends on a sentence boundary not mid-word', () => {
  const sentence = 'This is a full sentence about your taste. ';
  const out = tidyVerdict(sentence.repeat(20).trim());
  assert.equal(out, sentence.repeat(10).trim());

  const words = 'cinema '.repeat(80).trim();
  assertCutAtWordBoundary(tidyVerdict(words), words, 450);
});

test('estimateCostUsd: known model, unknown model, zero tokens', () => {
  assert.equal(estimateCostUsd('anthropic/claude-haiku-4.5', 1_000_000), 3);
  assert.equal(estimateCostUsd('some/unknown-model', 1000), null);
  assert.equal(estimateCostUsd('anthropic/claude-haiku-4.5', 0), null);
});
