const NEON_COLORS = [
  '#00D9FF', // Cyan
  '#FF2BD6', // Magenta
  '#7A3CFF', // Violet
  '#B6FF3D', // Lime
  '#FF66E3', // Pink
  '#168BFF', // Blue
  '#39FF88', // Green
  '#FF9F1C', // Amber
];

/** The three-card palette for the gradient-border neon card effect */
const NEON_CARD_COLORS = [
  '#ff00de', // Pink
  '#00f2ff', // Cyan
  '#2cff05', // Neon Green
];

const NEON_CARD_ANGLES = ['45deg', '135deg', '225deg', '315deg'];

/**
 * Returns deterministic neon styling for a card ID.
 * Produces: gradient outline, multi-color glow shadows, and a tinted background.
 */
export function getNeonColor(id: string): {
  color: string;
  color2: string;
  borderColor: string;
  boxShadow: string;
  background: string;
} {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % NEON_COLORS.length;
  const color = NEON_COLORS[idx];
  // Second color for gradient blend — next in palette
  const color2 = NEON_COLORS[(idx + 1) % NEON_COLORS.length];

  // Gradient border: use the primary color as solid border,
  // surround with multi-color glow shadows that "bleed" into each other
  const borderColor = color;
  const boxShadow = [
    `0 0 6px ${color}1A`,           // subtle outer halo
    `0 0 14px ${color}14`,          // mid glow
    `0 0 28px ${color2}0D`,         // secondary color blending in
    `inset 0 0 32px ${color}0F`,    // inner glow from edges
    `0 0 2px ${color}30`,           // tight outline glow
  ].join(', ');

  // Background: subtle top-to-bottom glow in the card's neon color
  const background = `linear-gradient(180deg, ${color}10 0%, ${color}05 35%, transparent 100%), var(--color-surface)`;

  return { color, color2, borderColor, boxShadow, background };
}

/**
 * Returns a neon card style using the background-clip gradient border technique.
 * Uses a deterministic random pair from {pink, cyan, neon-green} for each card.
 */
export function getNeonCardStyle(id: string): {
  color1: string;
  color2: string;
  backgroundImage: string;
  backgroundOrigin: 'border-box';
  backgroundClip: string;
  border: string;
  boxShadow: string;
} {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  const abs = Math.abs(hash);
  const idx1 = abs % NEON_CARD_COLORS.length;
  const idx2 = (idx1 + 1 + (abs >> 4) % (NEON_CARD_COLORS.length - 1)) % NEON_CARD_COLORS.length;
  const angle = NEON_CARD_ANGLES[(abs >> 8) % NEON_CARD_ANGLES.length];
  const color1 = NEON_CARD_COLORS[idx1];
  const color2 = NEON_CARD_COLORS[idx2];

  return {
    color1,
    color2,
    backgroundImage: `linear-gradient(var(--color-surface), var(--color-surface)), linear-gradient(${angle}, ${color1}, ${color2})`,
    backgroundOrigin: 'border-box',
    backgroundClip: 'padding-box, border-box',
    border: '2px solid transparent',
    boxShadow: `0 0 5px ${color1}80, 0 0 15px ${color2}4D`,
  };
}
