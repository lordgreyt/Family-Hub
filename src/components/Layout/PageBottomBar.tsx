import { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';

/** Einhängepunkt am unteren Rand der App-Hülle (wird von MainLayout bereitgestellt) */
export const BottomBarSlotContext = createContext<HTMLElement | null>(null);

export interface BottomBarItem {
  key: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  onClick: () => void;
}

interface PageBottomBarProps {
  left: BottomBarItem[];
  right: BottomBarItem[];
  fab: { label: string; icon: LucideIcon; onClick: () => void };
}

/**
 * Tab-Leiste mit Bogen um den runden Mittelknopf.
 * Nur Seiten, die unten eine Leiste brauchen, rendern sie – sie erscheint dann über dem weißen Blatt,
 * sodass im Bogen der Seiteninhalt zu sehen ist.
 */
export const PageBottomBar = ({ left, right, fab }: PageBottomBarProps) => {
  const slot = useContext(BottomBarSlotContext);
  if (!slot) return null;

  const FabIcon = fab.icon;

  const renderTab = ({ key, label, icon: Icon, active, onClick }: BottomBarItem) => (
    <button
      key={key}
      type="button"
      className={`tab${active ? ' tab--on' : ''}`}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
    >
      <span className="tab-pill"><Icon size={20} strokeWidth={2.2} /></span>
      <span className="tab-label">{label}</span>
    </button>
  );

  return createPortal(
    <nav className="tabbar-wrap" aria-label="Seitennavigation">
      <div className="tabbar">
        <div className="tabbar-bg" aria-hidden="true">
          <div className="tabbar-side" />
          <svg width="100" height="84" viewBox="0 0 100 84">
            <path d="M0 0H1.01A10 10 0 0 1 10.81 8A40 40 0 0 0 89.19 8A10 10 0 0 1 98.99 0H100V84H0Z" fill="#FFFFFF" />
          </svg>
          <div className="tabbar-side" />
        </div>

        {left.map(renderTab)}

        <div className="tabbar-gap">
          <button type="button" className="tab-fab" onClick={fab.onClick} aria-label={fab.label}>
            <FabIcon size={30} strokeWidth={2.6} />
          </button>
        </div>

        {right.map(renderTab)}
      </div>
      <div className="tabbar-safe" />
    </nav>,
    slot
  );
};
