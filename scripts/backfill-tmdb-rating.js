#!/usr/bin/env node
// One-off backfill for migration 002: fills `movies.tmdb_rating` for rows that
// were added before the column existed.
//
//   npm run backfill-tmdb-rating           # dry run — prints, writes nothing
//   npm run backfill-tmdb-rating -- --write
//
// SAFETY (CLAUDE.md § Working agreements). This script is deliberately built so
// that the worst case is "nothing happened":
//   - It only ever runs UPDATE, never DELETE and never a bulk operation.
//   - It writes exactly ONE column, `tmdb_rating`, which migration 002 has just
//     created and which is therefore empty everywhere. No pre-existing value —
//     no rating, no review, no title — can be overwritten by it.
//   - It targets rows one at a time BY ID, never "all ids".
//   - It skips any row that already has a value, so re-running is a no-op.
//   - It is dry-run by default. Writing takes an explicit --write flag.
// Read the printed plan first, then re-run with --write.

import 'dotenv/config';
import { supabase } from '../server/supabase.js';
import { getMovieDetails } from '../server/services/tmdb.js';

const WRITE = process.argv.includes('--write');

// TMDB's free tier is rate-limited; the list is small and this is a one-off, so
// a plain serial loop with a small pause is the right shape. No concurrency.
const PAUSE_MS = 250;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { data: movies, error } = await supabase
  .from('movies')
  .select('id, tmdb_id, title, tmdb_rating')
  .is('tmdb_rating', null)
  .order('created_at', { ascending: true });

if (error) {
  console.error('Could not read movies:', error.message);
  console.error('If this says the column does not exist, apply db/migrations/002_tmdb_rating.sql first.');
  process.exit(1);
}

if (!movies.length) {
  console.log('Nothing to do — every movie already has a tmdb_rating.');
  process.exit(0);
}

console.log(`${movies.length} movie(s) with no tmdb_rating.`);
console.log(WRITE ? 'Mode: WRITE\n' : 'Mode: dry run (pass --write to apply)\n');

let filled = 0;
let noValue = 0;
let failed = 0;

for (const m of movies) {
  let details;
  try {
    details = await getMovieDetails(m.tmdb_id);
  } catch (err) {
    console.log(`  ✗ ${m.title} — TMDB lookup failed (${err.message})`);
    failed++;
    await sleep(PAUSE_MS);
    continue;
  }

  // `!= null`, not truthiness: 0.0 is a real TMDB score for a title with votes
  // averaging zero, and it is falsy.
  if (details.tmdb_rating == null) {
    console.log(`  – ${m.title} — TMDB has no rating for this title; leaving NULL`);
    noValue++;
    await sleep(PAUSE_MS);
    continue;
  }

  if (!WRITE) {
    console.log(`  → ${m.title} — would set tmdb_rating = ${details.tmdb_rating}`);
    filled++;
    await sleep(PAUSE_MS);
    continue;
  }

  // By id, one row, one column. `.is('tmdb_rating', null)` is belt-and-braces:
  // it makes the write a no-op if something else filled the value between the
  // read above and here.
  const { error: upErr } = await supabase
    .from('movies')
    .update({ tmdb_rating: details.tmdb_rating })
    .eq('id', m.id)
    .is('tmdb_rating', null);

  if (upErr) {
    console.log(`  ✗ ${m.title} — update failed (${upErr.message})`);
    failed++;
  } else {
    console.log(`  ✓ ${m.title} — tmdb_rating = ${details.tmdb_rating}`);
    filled++;
  }
  await sleep(PAUSE_MS);
}

console.log(
  `\n${WRITE ? 'Wrote' : 'Would write'} ${filled}, skipped ${noValue} with no TMDB rating, ${failed} failed.`
);
if (!WRITE && filled) console.log('Re-run with --write to apply.');
