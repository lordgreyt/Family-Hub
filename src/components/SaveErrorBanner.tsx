import { useEffect, useState } from 'react';
import { RefreshCw, X, CloudOff } from 'lucide-react';

/**
 * Zeigt einen Hinweis, wenn ein Schreibvorgang in die Cloud abgelehnt wurde
 * (z. B. weil die App-Version veraltet ist oder die Firebase-Rules den Pfad
 * nicht erlauben). Ohne diesen Hinweis verschwinden Änderungen still.
 */
export const SaveErrorBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let hideTimer: number | undefined;

    const onFail = () => {
      setVisible(true);
      if (hideTimer) window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setVisible(false), 20000);
    };

    window.addEventListener('db_write_failed', onFail);
    return () => {
      window.removeEventListener('db_write_failed', onFail);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      role="alert"
      style={{
        position: 'fixed', left: '50%', transform: 'translateX(-50%)',
        bottom: 'calc(var(--tabbar-height, 76px) + 1rem)',
        zIndex: 60, width: 'min(94vw, 460px)',
        display: 'flex', alignItems: 'center', gap: '0.6rem',
        padding: '0.7rem 0.85rem',
        background: 'var(--color-danger)', color: 'white',
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
        fontSize: 'var(--font-sm)', fontWeight: 700, lineHeight: 1.3,
      }}
    >
      <CloudOff size={18} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        Speichern in der Cloud fehlgeschlagen – die Änderung ist nicht gesichert.
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0,
          background: 'rgba(255,255,255,0.18)', border: 'none', color: 'white',
          borderRadius: '999px', padding: '0.35rem 0.7rem', fontWeight: 800,
          fontSize: 'var(--font-xs)', fontFamily: 'inherit', cursor: 'pointer',
        }}
      >
        <RefreshCw size={13} /> Neu laden
      </button>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Hinweis schließen"
        style={{ background: 'none', border: 'none', color: 'white', display: 'flex', cursor: 'pointer', flexShrink: 0 }}
      >
        <X size={16} />
      </button>
    </div>
  );
};
