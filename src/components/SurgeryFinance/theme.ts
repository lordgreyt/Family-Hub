import type { CSSProperties } from 'react';

export const HERO_GRADIENT = 'linear-gradient(135deg, #3F34C4 0%, #6D5DF0 55%, #F2A9BE 130%)';
export const GREEN = '#4FC3A1';
export const GREEN_TEXT = '#1E9A78';
export const ORANGE = '#F5A06B';
export const PINK = '#F27A9B';
export const PINK_TEXT = '#D4416E';
export const PRIMARY = '#6D5DF0';
export const BLUE = '#4B8DFF';
export const LILAC = '#C7B6F7';

// Feste Farben je Finanzierungsquelle, damit Balken, Legende und Chips zusammenpassen
const SOURCE_COLORS: Record<string, string> = {
  nebenkosten: ORANGE,
  bank: PRIMARY,
  bonus: GREEN,
  sparbuch: BLUE,
};
export const sourceColor = (id: string) => SOURCE_COLORS[id] || LILAC;

export const iconChip = (color: string, size = 38): CSSProperties => ({
  width: `${size}px`,
  height: `${size}px`,
  borderRadius: '50%',
  background: color + '26',
  color,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
});

export const CARD: CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  padding: '1.25rem',
  boxShadow: 'var(--shadow-sm)',
};

export const sectionTitle: CSSProperties = {
  margin: 0,
  fontSize: 'var(--font-base)',
  fontWeight: 800,
  color: 'var(--color-text)',
};

export const fieldLabel: CSSProperties = {
  display: 'block',
  marginBottom: '0.3rem',
  fontSize: '11px',
  fontWeight: 800,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
};

export const fmtEUR = (cents: number) =>
  `${(cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

// Ganze Euro ohne Nachkommastellen, sonst mit
export const fmtEURShort = (cents: number) => {
  const whole = cents % 100 === 0;
  return `${(cents / 100).toLocaleString('de-DE', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })} €`;
};

export const parseEuroCents = (value: string): number | null => {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [euros, cents = ''] = normalized.split('.');
  const total = Number(euros) * 100 + Number(cents.padEnd(2, '0'));
  return Number.isSafeInteger(total) ? total : null;
};

export const dateLabel = (iso: string) => {
  if (!iso) return '—';
  const date = new Date(`${iso}T12:00:00`);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
};

export const dateShort = (iso: string) => {
  if (!iso) return '—';
  const date = new Date(`${iso}T12:00:00`);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const monthLabel = (month: string) => {
  const date = new Date(`${month}-01T12:00:00`);
  return Number.isNaN(date.getTime()) ? month : date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
};

export const shiftMonth = (month: string, delta: number) => {
  const [year, mon] = month.split('-').map(Number);
  const date = new Date(year, mon - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};
