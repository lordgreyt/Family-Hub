import { Minus, Plus } from 'lucide-react';
import { formatQty } from '../../utils/pantry';

interface QtyStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
  unit?: string;
  size?: 'sm' | 'lg';
}

export const QtyStepper = ({ value, onChange, min = 0, step = 1, unit, size = 'sm' }: QtyStepperProps) => {
  const dim = size === 'lg' ? 44 : 32;
  const btn = {
    width: dim, height: dim, borderRadius: '50%', border: '1px solid var(--color-border)',
    background: 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  } as const;
  const set = (n: number) => onChange(Math.max(min, Math.round(n * 100) / 100));

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: size === 'lg' ? '0.9rem' : '0.4rem' }}>
      <button type="button" style={btn} onClick={() => set(value - step)} disabled={value <= min} aria-label="Weniger">
        <Minus size={size === 'lg' ? 20 : 15} />
      </button>
      <span style={{ minWidth: size === 'lg' ? '4.5rem' : '2.6rem', textAlign: 'center', fontWeight: 800, fontSize: size === 'lg' ? '1.6rem' : '0.95rem' }}>
        {formatQty(value)}
        {unit && <span style={{ fontSize: size === 'lg' ? '0.85rem' : '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', marginLeft: '0.2rem' }}>{unit}</span>}
      </span>
      <button type="button" style={btn} onClick={() => set(value + step)} aria-label="Mehr">
        <Plus size={size === 'lg' ? 20 : 15} />
      </button>
    </div>
  );
};
