#!/usr/bin/env node
/**
 * @file Pre-commit secret scan (CLAUDE.md § Security & Secrets #6). Run before every
 * commit:  npm run scan-secrets
 * Scans the staged diff for strings shaped like the credentials this project
 * uses, and a few common others: the patterns below are the whole list. Exits
 * non-zero (blocking the commit if wired as a git hook) when one matches.
 *
 * Only ADDED lines are scanned, never the whole tree. Exit codes: 0 when
 * nothing is found, 1 when a line matches a credential pattern, 2 when the
 * staged diff cannot be read at all.
 */

import { execSync } from 'node:child_process';

const PATTERNS = [
  { name: 'OpenAI-style key', re: /sk-[a-zA-Z0-9]{20,}/ },
  // OpenRouter keys read `sk-or-v1-` and then hex, so the hyphens after `sk-`
  // keep the pattern above from ever reaching the long run it needs.
  { name: 'OpenRouter key', re: /sk-or-v1-[a-zA-Z0-9]{20,}/ },
  // A TMDB v3 key is 32 lowercase hex characters with nothing around them.
  // Git SHAs are 40 or 7, so the bounds keep them out.
  { name: 'TMDB v3 API key', re: /(?<![0-9a-zA-Z])[0-9a-f]{32}(?![0-9a-zA-Z])/ },
  { name: 'Supabase service_role JWT', re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'TMDB v4 bearer token', re: /eyJhbGciOiJIUzI1NiJ9/ },
  { name: 'Generic API key assignment', re: /(api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"\s]{16,}['"]/i },
  { name: 'AWS access key id', re: /AKIA[0-9A-Z]{16}/ },
];

// Only inspect added lines in the staged diff.
let diff = '';
try {
  diff = execSync('git diff --cached --unified=0', { encoding: 'utf8' });
} catch {
  console.error('scan-secrets: could not read staged diff (is this a git repo?)');
  process.exit(2);
}

const findings = [];
let currentFile = '';
for (const line of diff.split('\n')) {
  const header = line.match(/^diff --git a\/(.+?) b\//);
  if (header) { currentFile = header[1]; continue; }
  if (!line.startsWith('+') || line.startsWith('+++')) continue;
  // This scanner defines the patterns it looks for; don't flag its own source.
  if (currentFile === 'scripts/scan-secrets.js') continue;
  // .env.example placeholders and regex-literal definitions are fine.
  if (/your-|YOUR-|example/i.test(line)) continue;
  if (/\bre:\s*\/|new RegExp\(/.test(line)) continue;
  for (const { name, re } of PATTERNS) {
    if (re.test(line)) findings.push({ name, file: currentFile, line: line.slice(1, 120) });
  }
}

if (findings.length) {
  console.error('\n✖ scan-secrets: possible credential in staged changes\n');
  for (const f of findings) console.error(`  [${f.name}] ${f.file}:  ${f.line}`);
  console.error('\nUnstage it and move the value into .env before committing.\n');
  process.exit(1);
}

console.log('✓ scan-secrets: no credentials found in staged changes');
