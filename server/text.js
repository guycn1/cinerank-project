/**
 * One text helper the server shares between the routes and the AI services.
 *
 * @module server/text
 */

/**
 * Cut `text` to at most `max` UTF-16 code units, never between the two halves
 * of a surrogate pair.
 *
 * `String.slice()` counts code units, and most emoji take two, so a plain slice
 * whose end falls inside one keeps its first half: an unpaired surrogate, which
 * is not a character at all. A review cut that way reached the AI prompts with
 * half an emoji in it. This drops the whole emoji instead, so the result is one
 * unit shorter in exactly that case and identical to `text.slice(0, max)` in
 * every other.
 *
 * Deliberately code points, not graphemes: a cut that separates the parts of a
 * flag or a family emoji leaves whole, valid characters, and is left as
 * `slice()` would leave it.
 *
 * @param {string} text
 * @param {number} max  The most UTF-16 code units the result may hold.
 * @returns {string}
 */
export function cutText(text, max) {
  if (text.length <= max) return text;
  const high = text.charCodeAt(max - 1);
  const low = text.charCodeAt(max);
  const splitsPair = high >= 0xd800 && high <= 0xdbff && low >= 0xdc00 && low <= 0xdfff;
  return text.slice(0, splitsPair ? max - 1 : max);
}
