import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AlertCircle, Blinds, ChevronDown, ChevronUp, Pause, RefreshCw, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  fetchHomeAssistantCovers,
  sendHomeAssistantCoverAction,
  type CoverAction,
  type CoverState,
  type HomeAssistantCover,
} from '../services/homeAssistant';
import {
  HERO_GRADIENT, GREEN, GREEN_TEXT, ORANGE, PINK, PINK_TEXT, PRIMARY, BLUE, CARD,
} from '../components/SurgeryFinance/theme';

const STATUS_META: Record<CoverState, { label: string; color: string; text: string }> = {
  open: { label: 'Offen', color: GREEN, text: GREEN_TEXT },
  closed: { label: 'Geschlossen', color: PRIMARY, text: PRIMARY },
  opening: { label: 'Öffnet', color: BLUE, text: BLUE },
  closing: { label: 'Schließt', color: ORANGE, text: '#C26A2E' },
  unavailable: { label: 'Nicht erreichbar', color: PINK, text: PINK_TEXT },
};

const QUICK_POSITIONS = [0, 50, 100] as const;

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : 'Unbekannter Fehler.';
}

function formatUpdatedAt(value: string | null) {
  if (!value) return 'kein Status';
  return new Date(value).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

// Kleines Fenster-Symbol: je geschlossener der Rollladen, desto weiter ist er von oben heruntergefahren
const BlindGlyph = ({ position, color }: { position: number | null; color: string }) => {
  const covered = position === null ? 0 : 100 - Math.max(0, Math.min(100, position));
  return (
    <div style={{
      width: '44px', height: '52px', borderRadius: '12px', flexShrink: 0, position: 'relative', overflow: 'hidden',
      background: '#ECE8FF', border: `2px solid ${color}55`,
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: `${covered}%`, transition: 'height 0.4s ease',
        background: `repeating-linear-gradient(180deg, ${color} 0 4px, ${color}99 4px 6px)`,
      }} />
      {position === null && (
        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontWeight: 800, fontSize: '16px' }}>?</span>
      )}
    </div>
  );
};

export const SmartHome = () => {
  const { user } = useAuth();
  const [covers, setCovers] = useState<HomeAssistantCover[]>([]);
  const [targetPositions, setTargetPositions] = useState<Record<string, number>>({});
  const [pending, setPending] = useState<Record<string, CoverAction | 'refresh' | undefined>>({});
  const [coverErrors, setCoverErrors] = useState<Record<string, string | undefined>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const loadCovers = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      const result = await fetchHomeAssistantCovers();
      setCovers(result.covers);
      setUpdatedAt(result.updated_at);
      setTargetPositions((current) => {
        const next = { ...current };
        for (const cover of result.covers) {
          if (next[cover.entity_id] === undefined) {
            next[cover.entity_id] = cover.position ?? 50;
          }
        }
        return next;
      });
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.isChild) void loadCovers();
  }, [loadCovers, user?.isChild]);

  const summary = useMemo(() => ({
    available: covers.filter((cover) => cover.state !== 'unavailable').length,
    moving: covers.filter((cover) => cover.state === 'opening' || cover.state === 'closing').length,
    open: covers.filter((cover) => cover.state !== 'unavailable' && cover.position !== null && cover.position > 0).length,
    closed: covers.filter((cover) => cover.state !== 'unavailable' && cover.position === 0).length,
  }), [covers]);

  if (user?.isChild) {
    return <Navigate to="/" replace />;
  }

  const handleAction = async (cover: HomeAssistantCover, action: CoverAction, position?: number) => {
    setPending((current) => ({ ...current, [cover.entity_id]: action }));
    setCoverErrors((current) => ({ ...current, [cover.entity_id]: undefined }));

    try {
      await sendHomeAssistantCoverAction({ entity_id: cover.entity_id, action, position });
      await loadCovers(true);
    } catch (err) {
      setCoverErrors((current) => ({ ...current, [cover.entity_id]: messageFromError(err) }));
    } finally {
      setPending((current) => ({ ...current, [cover.entity_id]: undefined }));
    }
  };

  const isBusy = loading || refreshing;

  const chipWhite = {
    display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem', borderRadius: '999px',
    background: 'rgba(255,255,255,0.2)', color: 'white', fontSize: 'var(--font-xs)', fontWeight: 700, lineHeight: 1.3,
  } as const;

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
      {/* Hero */}
      <div style={{ background: HERO_GRADIENT, borderRadius: 'var(--radius-xl)', padding: '1.3rem 1.25rem', color: 'white', boxShadow: '0 12px 28px rgba(63,52,196,0.28)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Blinds size={19} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--font-base)', fontWeight: 800 }}>Smart Home</div>
            <div style={{ fontSize: 'var(--font-xs)', opacity: 0.85, fontWeight: 600 }}>
              {updatedAt ? `Stand ${formatUpdatedAt(updatedAt)} Uhr` : 'Rollläden steuern'}
            </div>
          </div>
          <button
            onClick={() => void loadCovers(true)}
            disabled={isBusy}
            title="Status neu laden"
            aria-label="Status neu laden"
            className="glass-btn"
            style={{ opacity: isBusy ? 0.7 : 1 }}
          >
            <RefreshCw className={isBusy ? 'smart-home-spin' : undefined} size={18} />
          </button>
        </div>

        <div style={{ marginTop: '1.1rem', fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', opacity: 0.85 }}>ROLLLÄDEN ERREICHBAR</div>
        <div style={{ fontSize: '2.6rem', fontWeight: 800, lineHeight: 1.1, marginTop: '0.2rem' }}>
          {summary.available}<span style={{ fontSize: '1.4rem', opacity: 0.75 }}> / {covers.length || '–'}</span>
        </div>

        {covers.length > 0 && (
          <div style={{ marginTop: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
            <span style={chipWhite}>{summary.open} offen</span>
            <span style={chipWhite}>{summary.closed} geschlossen</span>
            {summary.moving > 0 && <span style={chipWhite}><RefreshCw size={12} className="smart-home-spin" /> {summary.moving} in Bewegung</span>}
          </div>
        )}
      </div>

      {error && (
        <div style={{
          padding: '0.9rem 1rem', borderRadius: 'var(--radius-lg)', background: '#FDE8EF', color: PINK_TEXT,
          display: 'flex', gap: '0.6rem', alignItems: 'flex-start', fontSize: 'var(--font-sm)', fontWeight: 700,
        }}>
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ overflowWrap: 'anywhere' }}>{error}</span>
        </div>
      )}

      {loading ? (
        <div style={{ ...CARD, padding: '2rem 1.25rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <RefreshCw className="smart-home-spin" size={22} />
          <p style={{ margin: '0.75rem 0 0 0', fontSize: 'var(--font-sm)', fontWeight: 700 }}>Lädt Status...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {covers.map((cover) => {
            const meta = STATUS_META[cover.state];
            const pendingAction = pending[cover.entity_id];
            const unavailable = cover.state === 'unavailable';
            const disabled = Boolean(pendingAction) || unavailable;
            const targetPosition = targetPositions[cover.entity_id] ?? cover.position ?? 50;

            const actionBtn = (action: 'open' | 'stop' | 'close', Icon: typeof ChevronUp, label: string) => (
              <button
                disabled={disabled}
                onClick={() => void handleAction(cover, action)}
                style={{
                  height: '44px', borderRadius: '999px', border: 'none', cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
                  background: action === 'stop' ? 'var(--color-surface-muted)' : '#ECE8FF',
                  color: action === 'stop' ? 'var(--color-text-muted)' : PRIMARY,
                  fontSize: 'var(--font-sm)', fontWeight: 800, opacity: disabled ? 0.5 : 1,
                }}
              >
                <Icon size={16} /> {label}
              </button>
            );

            return (
              <div key={cover.entity_id} style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                  <BlindGlyph position={unavailable ? null : cover.position} color={meta.color} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: 'var(--font-base)', fontWeight: 800, color: 'var(--color-text)', overflowWrap: 'anywhere' }}>{cover.name}</h3>
                    <p style={{ margin: '0.2rem 0 0.45rem', color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)', fontWeight: 600 }}>
                      {cover.position === null ? 'Position unbekannt' : `${cover.position} % offen`} · {formatUpdatedAt(cover.updated_at)}
                    </p>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.65rem', borderRadius: '999px',
                      background: meta.color + '26', color: meta.text, fontSize: '11px', fontWeight: 800, whiteSpace: 'nowrap',
                    }}>
                      {unavailable && <ShieldAlert size={12} />}
                      {meta.label}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.8fr 1fr', gap: '0.45rem' }}>
                  {actionBtn('open', ChevronUp, 'Öffnen')}
                  {actionBtn('stop', Pause, 'Stop')}
                  {actionBtn('close', ChevronDown, 'Zu')}
                </div>

                <div style={{ padding: '0.85rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface-hover)', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={targetPosition}
                      disabled={disabled}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setTargetPositions((current) => ({ ...current, [cover.entity_id]: next }));
                      }}
                      style={{ flex: 1, minWidth: 0, accentColor: PRIMARY }}
                    />
                    <span style={{ minWidth: '3rem', textAlign: 'right', fontSize: 'var(--font-base)', fontWeight: 800, color: 'var(--color-text)' }}>
                      {targetPosition} %
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                    {QUICK_POSITIONS.map((position) => (
                      <button
                        key={position}
                        disabled={disabled}
                        onClick={() => void handleAction(cover, 'set_position', position)}
                        style={{
                          flex: 1, height: '38px', borderRadius: '999px', border: '1px solid var(--color-border)', cursor: disabled ? 'default' : 'pointer',
                          background: 'var(--color-surface)', color: 'var(--color-text)', fontFamily: 'inherit',
                          fontSize: 'var(--font-sm)', fontWeight: 800, opacity: disabled ? 0.5 : 1,
                        }}
                      >
                        {position} %
                      </button>
                    ))}
                    <button
                      disabled={disabled}
                      onClick={() => void handleAction(cover, 'set_position', targetPosition)}
                      style={{
                        flex: 1.3, height: '38px', borderRadius: '999px', border: 'none', cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
                        background: 'linear-gradient(135deg, #3F34C4, #6D5DF0)', color: 'white', fontSize: 'var(--font-sm)', fontWeight: 800,
                        boxShadow: '0 6px 14px rgba(63,52,196,0.28)', opacity: disabled ? 0.5 : 1,
                      }}
                    >
                      Setzen
                    </button>
                  </div>
                </div>

                {pendingAction && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: PRIMARY, fontSize: 'var(--font-xs)', fontWeight: 800 }}>
                    <RefreshCw className="smart-home-spin" size={14} />
                    Aktion läuft...
                  </div>
                )}

                {coverErrors[cover.entity_id] && (
                  <div style={{
                    padding: '0.65rem 0.75rem', borderRadius: 'var(--radius-md)', background: '#FDE8EF', color: PINK_TEXT,
                    fontSize: 'var(--font-xs)', fontWeight: 700, display: 'flex', gap: '0.45rem', alignItems: 'flex-start',
                  }}>
                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                    <span style={{ overflowWrap: 'anywhere' }}>{coverErrors[cover.entity_id]}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .smart-home-spin {
          animation: smart-home-spin 1s linear infinite;
        }

        @keyframes smart-home-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
