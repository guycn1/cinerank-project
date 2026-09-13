/**
 * ESLint flat config — the static-analysis half of the Merge-Readiness Pack's
 * "SE hygiene" criterion (docs/MERGE-READINESS.md, course Module 16).
 *
 * Deliberately NOT a style linter. Prettier-style formatting rules are left out
 * entirely: this codebase was written by one agent under one set of conventions,
 * so reformatting it would produce a large diff that proves nothing and buries
 * the real history. What is enabled is the set of rules that can catch a DEFECT
 * — an unused binding, a shadowed variable, a promise nobody awaited, a `case`
 * that falls through — plus a complexity ceiling, because Module 16 names
 * complexity checks explicitly alongside linting.
 *
 * Three environments, because this repo ships code to two runtimes and a third
 * file that is loaded by the browser but lives outside the static root:
 *   - Node ES modules: server/, test/, and the three real scripts/ tools
 *   - Browser ES module: public/app.js (index.html loads it as type="module")
 *   - Browser CLASSIC script: scripts/debug-recs.js, loaded by a bare <script>
 *     tag, so it is parsed as a script and not as a module. Getting this wrong
 *     makes ESLint report phantom parse errors.
 */

import globals from 'globals';

/** Rules that can catch a real defect, applied everywhere. */
const defectRules = {
  'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
  'no-shadow': 'error',
  'no-undef': 'error',
  'no-implicit-globals': 'error',
  'no-fallthrough': 'error',
  'no-unreachable': 'error',
  'no-constant-condition': ['error', { checkLoops: false }],
  'no-dupe-keys': 'error',
  'no-duplicate-imports': 'error',
  'no-self-compare': 'error',
  'no-unmodified-loop-condition': 'error',
  'require-atomic-updates': 'error',
  'no-await-in-loop': 'off', // deliberate: TMDB verification is sequential on purpose
  eqeqeq: ['error', 'always', { null: 'ignore' }], // `!= null` is the project's idiom
  'no-var': 'error',
  'prefer-const': 'error',

  // Module 16 names complexity checks alongside linting. These are ceilings, not
  // targets — they exist to flag a function that has quietly grown past the point
  // where a reviewer can hold it in their head.
  complexity: ['warn', 20],
  'max-depth': ['warn', 5],
};

export default [
  {
    ignores: ['node_modules/**', 'package-lock.json'],
  },

  // Node ES modules — the server, the tests, and the real tooling scripts.
  {
    files: ['server/**/*.js', 'test/**/*.js', 'eslint.config.js', 'scripts/*.js'],
    ignores: ['scripts/debug-recs.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: defectRules,
  },

  // The browser ES module.
  {
    files: ['public/**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: defectRules,
  },

  // The browser CLASSIC script. index.html loads it with a bare <script> tag, so
  // it must be parsed as a script; parsing it as a module hides nothing but
  // reports nonsense. It also deliberately defines one global, which is the whole
  // point of a console harness — hence no-implicit-globals is off here only.
  {
    files: ['scripts/debug-recs.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'script',
      globals: { ...globals.browser },
    },
    rules: { ...defectRules, 'no-implicit-globals': 'off' },
  },
];
