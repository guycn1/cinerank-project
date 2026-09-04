import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const promptsDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'prompts');

// Prompts are never inlined in code (CLAUDE.md § Prompt Versioning). Each file has
// a leading HTML comment (dev notes), then a "# System" section and a "# User"
// section. We load at call time so editing a prompt needs no code change.

/**
 * @param {string} version  e.g. "recommend_v1" (also the string logged to the DB)
 * @param {Record<string,string>} vars  {{PLACEHOLDER}} substitutions
 * @returns {{ system: string, user: string, version: string }}
 */
export async function loadPrompt(version, vars = {}) {
  const raw = await readFile(join(promptsDir, `${version}.md`), 'utf8');
  const body = raw.replace(/^<!--[\s\S]*?-->\s*/, '');

  const sysMatch = body.match(/#\s*System\s*([\s\S]*?)#\s*User\s*([\s\S]*)$/i);
  if (!sysMatch) throw new Error(`Prompt ${version} missing # System / # User sections`);

  let [, system, user] = sysMatch;
  for (const [key, value] of Object.entries(vars)) {
    const token = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    system = system.replace(token, value);
    user = user.replace(token, value);
  }
  return { system: system.trim(), user: user.trim(), version };
}
