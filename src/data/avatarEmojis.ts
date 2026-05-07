// All emoji categories available for avatar selection.
// Also imported by scripts/download-emojis.ts to know which GIFs to download.
export const AVATAR_CATEGORIES: { label: string; icon: string; emojis: string[] }[] = [
  { label: 'Menschen', icon: '👤', emojis: ['👨', '👩', '👦', '👧', '👴', '👵', '🧑', '👶', '👱', '👲', '👳', '🧔', '👷', '💂', '🕵️', '👩‍🚀', '👩‍🍳', '👩‍🏫', '👩‍🎨', '🧑‍💻'] },
  { label: 'Tiere', icon: '🐾', emojis: ['🐱', '🐶', '🦊', '🐻', '🐼', '🦁', '🐯', '🐰', '🐵', '🐸', '🐨', '🐮', '🐷', '🐙', '🦋', '🐢', '🦜', '🐳', '🦖', '🐉'] },
  { label: 'Fantasy', icon: '✨', emojis: ['🤖', '👻', '👽', '🦄', '🧙‍♂️', '🧚', '🧛', '🧜‍♀️', '🧝', '🧞', '🧟', '🐲', '🦹', '🦸', '👾', '🤡', '💀', '🎃'] },
  { label: 'Aktiv', icon: '🎯', emojis: ['⚽', '🎮', '🎸', '🎨', '🚀', '🚲', '🏄', '🎭', '🔧', '🎵', '📚', '🌍', '💡', '🎪', '🏆', '🎲', '🧩', '🪁'] },
  { label: 'Natur', icon: '🌿', emojis: ['🌻', '🌈', '⭐', '🌙', '☀️', '🌊', '🔥', '🍀', '🌵', '🌸', '🍕', '🎂', '⚡', '💎', '🌹', '🍄', '🌴', '❄️'] },
];

// Emojis used for first-time login avatar setup
export const LOGIN_EMOJI_OPTIONS = ['👨', '👩', '👦', '👧', '👴', '👵', '🤖', '👻', '👽', '🦄'];

// All emojis that might need animated GIFs downloaded
export function getAllEmojis(): string[] {
  const set = new Set(LOGIN_EMOJI_OPTIONS);
  for (const cat of AVATAR_CATEGORIES) {
    for (const e of cat.emojis) {
      set.add(e);
    }
  }
  return Array.from(set);
}
