import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AlertCircle, ChevronDown, ChevronUp, Pause, RefreshCw, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  fetchHomeAssistantCovers,
  sendHomeAssistantCoverAction,
  type CoverAction,
  type CoverState,
  type HomeAssistantCover,
} from '../services/homeAssistant';

const STATUS_META: Record<CoverState, { label: string; color: string; background: string }> = {
  open: { label: 'open', color: 'var(--color-success)', background: 'rgba(67, 199, 115, 0.12)' },
  closed: { label: 'closed', color: 'var(--color-primary)', background: 'var(--color-primary-transparent)' },
  opening: { label: 'opening', color: 'var(--color-blue)', background: 'rgba(75, 141, 255, 0.12)' },
  closing: { label: 'closing', color: 'var(--color-orange)', background: 'rgba(255, 159, 45, 0.12)' },
  unavailable: { label: 'unavailable', color: 'var(--color-danger)', background: 'rgba(240, 68, 68, 0.10)' },
};

const QUICK_POSITIONS = [0, 50, 100] as const;

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : 'Unbekannter Fehler.';
}

function formatUpdatedAt(value: string | null) {
  if (!value) return 'kein Status';
  return new Date(value).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-primary-gradient)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <SlidersHorizontal size={24} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 'var(--font-xl)' }}>Rollläden</h2>
          <p style={{ margin: '0.2rem 0 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
            {summary.available}/{covers.length || 11} erreichbar
            {summary.moving > 0 ? ` · ${summary.moving} in Bewegung` : ''}
            {updatedAt ? ` · ${formatUpdatedAt(updatedAt)}` : ''}
          </p>
        </div>
        <button
          onClick={() => void loadCovers(true)}
          disabled={isBusy}
          title="Status neu laden"
          aria-label="Status neu laden"
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-surface-hover)',
            color: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isBusy ? 0.6 : 1,
          }}
        >
          <RefreshCw className={isBusy ? 'smart-home-spin' : undefined} size={18} />
        </button>
      </div>

      {error && (
        <div className="glass-panel" style={{
          padding: '0.9rem 1rem',
          borderColor: 'rgba(240, 68, 68, 0.35)',
          background: 'rgba(240, 68, 68, 0.08)',
          color: 'var(--color-danger)',
          display: 'flex',
          gap: '0.6rem',
          alignItems: 'flex-start',
          fontSize: 'var(--font-sm)',
          fontWeight: 700,
        }}>
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="glass-panel" style={{ padding: '2rem 1.25rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <RefreshCw className="smart-home-spin" size={22} />
          <p style={{ margin: '0.75rem 0 0 0', fontSize: 'var(--font-sm)', fontWeight: 700 }}>Lädt Status...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {covers.map((cover) => {
            const meta = STATUS_META[cover.state];
            const pendingAction = pending[cover.entity_id];
            const unavailable = cover.state === 'unavailable';
            const targetPosition = targetPositions[cover.entity_id] ?? cover.position ?? 50;

            return (
              <div
                key={cover.entity_id}
                className="glass-panel"
                style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: 'var(--font-lg)', wordBreak: 'break-word' }}>{cover.name}</h3>
                    <p style={{ margin: '0.25rem 0 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)' }}>
                      Position: {cover.position === null ? 'unbekannt' : `${cover.position}%`} · {formatUpdatedAt(cover.updated_at)}
                    </p>
                  </div>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.35rem 0.6rem',
                    borderRadius: 'var(--radius-full)',
                    background: meta.background,
                    color: meta.color,
                    fontSize: 'var(--font-xs)',
                    fontWeight: 800,
                    whiteSpace: 'nowrap',
                  }}>
                    {unavailable && <ShieldAlert size={13} />}
                    {meta.label}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                  <button
                    className="btn btn-secondary"
                    disabled={Boolean(pendingAction) || unavailable}
                    onClick={() => void handleAction(cover, 'open')}
                    style={{ padding: '0.65rem 0.45rem', borderRadius: 'var(--radius-md)', opacity: pendingAction || unavailable ? 0.55 : 1 }}
                  >
                    <ChevronUp size={16} />
                    Öffnen
                  </button>
                  <button
                    className="btn btn-secondary"
                    disabled={Boolean(pendingAction) || unavailable}
                    onClick={() => void handleAction(cover, 'stop')}
                    style={{ padding: '0.65rem 0.45rem', borderRadius: 'var(--radius-md)', opacity: pendingAction || unavailable ? 0.55 : 1 }}
                  >
                    <Pause size={16} />
                    Stop
                  </button>
                  <button
                    className="btn btn-secondary"
                    disabled={Boolean(pendingAction) || unavailable}
                    onClick={() => void handleAction(cover, 'close')}
                    style={{ padding: '0.65rem 0.45rem', borderRadius: 'var(--radius-md)', opacity: pendingAction || unavailable ? 0.55 : 1 }}
                  >
                    <ChevronDown size={16} />
                    Schließen
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={targetPosition}
                      disabled={Boolean(pendingAction) || unavailable}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setTargetPositions((current) => ({ ...current, [cover.entity_id]: next }));
                      }}
                      style={{ flex: 1, minWidth: 0 }}
                    />
                    <span style={{ minWidth: '3rem', textAlign: 'right', fontSize: 'var(--font-sm)', fontWeight: 800 }}>
                      {targetPosition}%
                    </span>
                    <button
                      className="btn btn-primary"
                      disabled={Boolean(pendingAction) || unavailable}
                      onClick={() => void handleAction(cover, 'set_position', targetPosition)}
                      style={{ padding: '0.55rem 0.85rem', borderRadius: 'var(--radius-md)', opacity: pendingAction || unavailable ? 0.55 : 1 }}
                    >
                      Setzen
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                    {QUICK_POSITIONS.map((position) => (
                      <button
                        key={position}
                        className="chip"
                        disabled={Boolean(pendingAction) || unavailable}
                        onClick={() => void handleAction(cover, 'set_position', position)}
                        style={{
                          justifyContent: 'center',
                          opacity: pendingAction || unavailable ? 0.55 : 1,
                        }}
                      >
                        {position}%
                      </button>
                    ))}
                  </div>
                </div>

                {pendingAction && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: 'var(--color-primary)',
                    fontSize: 'var(--font-xs)',
                    fontWeight: 800,
                  }}>
                    <RefreshCw className="smart-home-spin" size={14} />
                    Aktion läuft...
                  </div>
                )}

                {coverErrors[cover.entity_id] && (
                  <div style={{
                    padding: '0.65rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(240, 68, 68, 0.08)',
                    color: 'var(--color-danger)',
                    fontSize: 'var(--font-xs)',
                    fontWeight: 700,
                    display: 'flex',
                    gap: '0.45rem',
                    alignItems: 'flex-start',
                  }}>
                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                    <span>{coverErrors[cover.entity_id]}</span>
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
