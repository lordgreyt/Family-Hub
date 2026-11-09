import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
}

export const Modal = ({ title, onClose, children, maxWidth = 420 }: ModalProps) => (
  <div
    onClick={onClose}
    style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
    }}
  >
    <div
      className="glass-panel"
      onClick={e => e.stopPropagation()}
      style={{
        maxWidth: `${maxWidth}px`, width: '100%', maxHeight: '90vh', overflowY: 'auto',
        padding: '1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', gap: '0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>{title}</h3>
        <button
          onClick={onClose}
          aria-label="Schließen"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </div>
  </div>
);
