/**
 * Converts an emoji character to its animated GIF URL.
 * Uses locally bundled GIFs from public/emojis/ (downloaded via scripts/download-emojis.mjs).
 * Falls back to null if the emoji can't be converted, so callers can render the
 * static emoji character as text instead.
 */
export function getAnimatedEmojiUrl(emoji: string): string | null {
  if (!emoji) return null;

  const codePoint = getEmojiCodePoint(emoji);
  if (!codePoint) return null;

  return `/emojis/${codePoint}.gif`;
}

/**
 * Extracts the hex code point(s) of an emoji character.
 * For simple emojis: "😀" → "1f600"
 * For compound emojis with ZWJ: "👨‍👩‍👧" → "1f468-200d-1f469-200d-1f467"
 * For variation selectors: Strips fe0f
 * Returns lowercase hex without "U+" prefix.
 */
function getEmojiCodePoint(emoji: string): string | null {
  if (!emoji || emoji.length === 0) return null;

  const points: string[] = [];

  for (const char of emoji) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;

    const hex = code.toString(16).toLowerCase();

    // Skip variation selector (U+FE0F) — it's implicit in the image
    if (hex === 'fe0f') continue;

    points.push(hex);
  }

  if (points.length === 0) return null;

  return points.join('-');
}

/**
 * Checks if the given emoji has an animated representation we can fetch.
 * Simple heuristic: we can generate a URL for any emoji with valid code points.
 */
export function hasAnimatedVersion(emoji: string): boolean {
  return getAnimatedEmojiUrl(emoji) !== null;
}
