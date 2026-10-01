/**
 * Loads a versioned prompt file from prompts/ and fills in its placeholders.
 *
 * Prompts are never inlined in code (CLAUDE.md § Prompt Versioning). Each file has
 * a leading HTML comment (dev notes), then a "# System" section and a "# User"
 * section. Keeping prompts in files keeps their text out of the code; loading
 * at call time means an edited file takes effect without a server restart.
 *
 * @module server/services/promptLoader
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const promptsDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'prompts');

/**
 * The three entities a prompt file may use, and the characters the model gets.
 * A prompt is also a markdown file GitHub renders, and GitHub drops what looks
 * like an HTML tag: a literal `"<movie title>"` displays there as `""`. So the
 * file writes `&lt;movie title&gt;`, and this turns it back into exactly the
 * characters the model has always received.
 */
const PROMPT_ENTITIES = { lt: '<', gt: '>', amp: '&' };

/**
 * Read `prompts/<version>.md`, drop its leading dev-notes comment, decode
 * `&lt;`, `&gt;` and `&amp;`, split it into its System and User sections, and
 * substitute every `{{KEY}}` placeholder whose KEY is in `vars`, in both. The
 * file is read on every call; nothing is cached.
 *
 * The decoding comes BEFORE the substitution on purpose: it applies to the
 * prompt's own text only, so a review that happens to contain `&lt;` reaches
 * the model exactly as the user wrote it. It is one pass, so `&amp;lt;` becomes
 * `&lt;` and is not decoded a second time.
 *
 * @param {string} version  e.g. "recommend_v1" (also the string logged to the DB)
 * @param {Record<string,string>} [vars]  {{PLACEHOLDER}} substitutions
 * @returns {Promise<{ system: string, user: string, version: string }>} Both
 *   sections trimmed, and `version` echoed back for the log row.
 * @throws {Error} When the file lacks a "# System" or "# User" section. A
 *   missing file rejects with the filesystem's own ENOENT error.
 */
export async function loadPrompt(version, vars = {}) {
  const raw = await readFile(join(promptsDir, `${version}.md`), 'utf8');
  const body = raw
    .replace(/^<!--[\s\S]*?-->\s*/, '')
    .replace(/&(lt|gt|amp);/g, (_, name) => PROMPT_ENTITIES[name]);

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
