/**
 * Downloads animated emoji GIFs from Google Noto Emoji CDN into public/emojis/
 * Run: node scripts/download-emojis.mjs
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'public', 'emojis');
const CDN_BASE = 'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/animated';

// All emojis used in the app (same list as in src/data/avatarEmojis.ts)
const AVATAR_CATEGORIES = [
  { emojis: ['👨', '👩', '👦', '👧', '👴', '👵', '🧑', '👶', '👱', '👲', '👳', '🧔', '👷', '💂', '🕵️', '👩‍🚀', '👩‍🍳', '👩‍🏫', '👩‍🎨', '🧑‍💻'] },
  { emojis: ['🐱', '🐶', '🦊', '🐻', '🐼', '🦁', '🐯', '🐰', '🐵', '🐸', '🐨', '🐮', '🐷', '🐙', '🦋', '🐢', '🦜', '🐳', '🦖', '🐉'] },
  { emojis: ['🤖', '👻', '👽', '🦄', '🧙‍♂️', '🧚', '🧛', '🧜‍♀️', '🧝', '🧞', '🧟', '🐲', '🦹', '🦸', '👾', '🤡', '💀', '🎃'] },
  { emojis: ['⚽', '🎮', '🎸', '🎨', '🚀', '🚲', '🏄', '🎭', '🔧', '🎵', '📚', '🌍', '💡', '🎪', '🏆', '🎲', '🧩', '🪁'] },
  { emojis: ['🌻', '🌈', '⭐', '🌙', '☀️', '🌊', '🔥', '🍀', '🌵', '🌸', '🍕', '🎂', '⚡', '💎', '🌹', '🍄', '🌴', '❄️'] },
];
const LOGIN_EMOJIS = ['👨', '👩', '👦', '👧', '👴', '👵', '🤖', '👻', '👽', '🦄'];

// Meal template emojis (used on Meals page)
const MEAL_EMOJIS = ['🍕', '🍝', '🥞', '🍽️', '🥗', '🍔', '🌮', '🍜', '🥘', '🧇'];

function getCodePoint(emoji) {
  const points = [];
  for (const char of emoji) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;
    const hex = code.toString(16).toLowerCase();
    if (hex === 'fe0f') continue; // skip variation selector
    points.push(hex);
  }
  return points.length > 0 ? points.join('-') : null;
}

async function downloadEmoji(emoji, codePoint) {
  // GitHub uses UPPERCASE hex with underscores: emoji_u1F600.gif
  const ghCodePoint = codePoint.replace(/-/g, '_').toUpperCase();
  const url = `${CDN_BASE}/emoji_u${ghCodePoint}.gif`;
  const filePath = join(OUTPUT_DIR, `${codePoint}.gif`);

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`  ⚠️  ${emoji} (${codePoint}) — HTTP ${res.status}, skipping`);
      return;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(filePath, buf);
    console.log(`  ✅ ${emoji} (${codePoint}) — ${(buf.length / 1024).toFixed(1)} KB`);
  } catch (err) {
    console.log(`  ❌ ${emoji} (${codePoint}) — ${err.message}`);
  }
}

async function main() {
  // Collect all unique emojis
  const all = new Set(LOGIN_EMOJIS);
  for (const cat of AVATAR_CATEGORIES) {
    for (const e of cat.emojis) all.add(e);
  }
  for (const e of MEAL_EMOJIS) all.add(e);

  const emojis = Array.from(all);
  console.log(`Downloading ${emojis.length} animated emoji GIFs to ${OUTPUT_DIR}...\n`);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  let success = 0, skipped = 0;
  for (const emoji of emojis) {
    const cp = getCodePoint(emoji);
    if (!cp) {
      console.log(`  ⚠️  ${emoji} — could not determine codepoint`);
      skipped++;
      continue;
    }
    await downloadEmoji(emoji, cp);
    success++;
  }

  console.log(`\nDone: ${success} processed, ${skipped} skipped.`);
}

main();
