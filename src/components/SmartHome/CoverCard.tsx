import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Pause,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  Star,
  X,
} from 'lucide-react';
import type {
  CoverAction,
  CoverState,
  HomeAssistantCoverDevice,
  SmartHomeDeviceActionPayload,
} from '../../services/homeAssistant';
import { BLUE, CARD, GREEN, GREEN_TEXT, ORANGE, PINK, PINK_TEXT, PRIMARY } from '../SurgeryFinance/theme';

const STATUS_META: Record<CoverState, { label: string; color: string; text: string }> = {
  open: { label: 'Offen', color: GREEN, text: GREEN_TEXT },
  closed: { label: 'Geschlossen', color: PRIMARY, text: PRIMARY },
  opening: { label: 'Öffnet', color: BLUE, text: BLUE },
  closing: { label: 'Schließt', color: ORANGE, text: '#C26A2E' },
  unavailable: { label: 'Nicht erreichbar', color: PINK, text: PINK_TEXT },
};

const QUICK_POSITIONS = [0, 50, 100] as const;

const BlindGlyph = ({ position, color }: { position: number | null; color: string }) => {
  const covered = position === null ? 0 : 100 - Math.max(0, Math.min(100, position));
  return (
    <div
      style={{
        width: '40px',
        height: '46px',
        borderRadius: '11px',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        background: '#ECE8FF',
        border: `2px solid ${color}55`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: `${covered}%`,
          transition: 'height 0.4s ease',
          background: `repeating-linear-gradient(180deg, ${color} 0 4px, ${color}99 4px 6px)`,
        }}
      />
      {position === null && (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
            fontWeight: 800,
            fontSize: '15px',
          }}
        >
          ?
        </span>
      )}
    </div>
  );
};

interface CoverCardProps {
  cover: HomeAssistantCoverDevice;
  pending?: boolean;
  error?: string;
  isPinned?: boolean;
  showPinButton?: boolean;
  editMode?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onAction: (payload: SmartHomeDeviceActionPayload) => void;
  onTogglePin?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove?: () => void;
}

export const CoverCard: React.FC<CoverCardProps> = ({
  cover,
  pending,
  error,
  isPinned,
  showPinButton,
  editMode,
  canMoveUp,
  canMoveDown,
  onAction,
  onTogglePin,
  onMoveUp,
  onMoveDown,
  onRemove,
}) => {
  const meta = STATUS_META[cover.state];
  const unavailable = cover.state === 'unavailable';
  const disabled = Boolean(pending) || unavailable;

  const [targetPosition, setTargetPosition] = useState<number>(cover.position ?? 50);
  const [showPositionTools, setShowPositionTools] = useState(false);

  useEffect(() => {
    if (cover.position !== null) {
      setTargetPosition(cover.position);
    }
  }, [cover.position]);

  const triggerCover = (action: CoverAction, position?: number) => {
    onAction({ entity_id: cover.entity_id, action, position });
  };

  return (
    <div style={{ ...CARD, padding: '0.95rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Header Row */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <BlindGlyph position={unavailable ? null : cover.position} color={meta.color} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <h3
              style={{
                margin: 0,
                fontSize: 'var(--font-base)',
                fontWeight: 800,
                color: 'var(--color-text)',
                overflowWrap: 'anywhere',
              }}
            >
              {cover.name}
            </h3>
            {cover.is_group && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '0.12rem 0.45rem',
                  borderRadius: '999px',
                  background: '#ECE8FF',
                  color: PRIMARY,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Gruppe
              </span>
            )}
          </div>

          <div
            style={{
              marginTop: '0.2rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              flexWrap: 'wrap',
              fontSize: 'var(--font-xs)',
              fontWeight: 600,
              color: 'var(--color-text-muted)',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.12rem 0.5rem',
                borderRadius: '999px',
                background: `${meta.color}22`,
                color: meta.text,
                fontSize: '11px',
                fontWeight: 800,
              }}
            >
              {unavailable && <ShieldAlert size={11} />}
              {cover.position !== null && !unavailable ? `${cover.position} %` : meta.label}
            </span>
            {cover.area && <span>{cover.area}</span>}
          </div>
        </div>

        {/* Pin / Position Toggle / Edit Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
          {!editMode && cover.supports_position && !unavailable && (
            <button
              type="button"
              onClick={() => setShowPositionTools(v => !v)}
              title="Position genau einstellen"
              aria-label="Position genau einstellen"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '11px',
                border: showPositionTools ? `1px solid ${PRIMARY}` : '1px solid var(--color-border)',
                background: showPositionTools ? '#ECE8FF' : 'var(--color-surface-hover)',
                color: showPositionTools ? PRIMARY : 'var(--color-text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <SlidersHorizontal size={15} />
            </button>
          )}

          {showPinButton && onTogglePin && (
            <button
              type="button"
              onClick={onTogglePin}
              title={isPinned ? 'Aus meiner Ansicht entfernen' : 'Zu meiner Ansicht hinzufügen'}
              aria-label={isPinned ? 'Aus meiner Ansicht entfernen' : 'Zu meiner Ansicht hinzufügen'}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '11px',
                border: isPinned ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--color-border)',
                background: isPinned ? '#FEF3C7' : 'var(--color-surface-hover)',
                color: isPinned ? '#D97706' : 'var(--color-text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Star size={16} fill={isPinned ? 'currentColor' : 'none'} />
            </button>
          )}

          {editMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <button
                type="button"
                disabled={!canMoveUp}
                onClick={onMoveUp}
                aria-label="Nach oben"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-hover)',
                  color: 'var(--color-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: canMoveUp ? 'pointer' : 'default',
                  opacity: canMoveUp ? 1 : 0.35,
                }}
              >
                <ArrowUp size={15} />
              </button>
              <button
                type="button"
                disabled={!canMoveDown}
                onClick={onMoveDown}
                aria-label="Nach unten"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-hover)',
                  color: 'var(--color-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: canMoveDown ? 'pointer' : 'default',
                  opacity: canMoveDown ? 1 : 0.35,
                }}
              >
                <ArrowDown size={15} />
              </button>
              <button
                type="button"
                onClick={onRemove}
                aria-label="Aus Ansicht entfernen"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#FDE8EF',
                  color: PINK_TEXT,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={15} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Open / Stop / Close Row */}
      {!editMode && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.75fr 1fr', gap: '0.45rem' }}>
          {(
            [
              { action: 'open', Icon: ChevronUp, label: 'Auf' },
              { action: 'stop', Icon: Pause, label: 'Stop' },
              { action: 'close', Icon: ChevronDown, label: 'Zu' },
            ] as const
          ).map(({ action, Icon, label }) => (
            <button
              key={action}
              type="button"
              disabled={disabled}
              onClick={() => triggerCover(action)}
              style={{
                height: '40px',
                borderRadius: '999px',
                border: 'none',
                cursor: disabled ? 'default' : 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.3rem',
                background: action === 'stop' ? 'var(--color-surface-hover)' : '#ECE8FF',
                color: action === 'stop' ? 'var(--color-text-muted)' : PRIMARY,
                fontSize: 'var(--font-sm)',
                fontWeight: 800,
                opacity: disabled ? 0.5 : 1,
              }}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
      )}

      {/* Expandable Exact Position Controls */}
      {!editMode && showPositionTools && cover.supports_position && !unavailable && (
        <div
          style={{
            padding: '0.75rem',
            borderRadius: '14px',
            background: 'var(--color-surface-hover)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={targetPosition}
              disabled={disabled}
              onChange={e => setTargetPosition(Number(e.target.value))}
              aria-label={`Position ${cover.name}`}
              style={{ flex: 1, minWidth: 0, accentColor: PRIMARY }}
            />
            <span
              style={{
                minWidth: '2.8rem',
                textAlign: 'right',
                fontSize: 'var(--font-sm)',
                fontWeight: 800,
                color: 'var(--color-text)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {targetPosition} %
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            {QUICK_POSITIONS.map(pos => (
              <button
                key={pos}
                type="button"
                disabled={disabled}
                onClick={() => triggerCover('set_position', pos)}
                style={{
                  flex: 1,
                  height: '34px',
                  borderRadius: '999px',
                  border: '1px solid var(--color-border)',
                  cursor: disabled ? 'default' : 'pointer',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  fontFamily: 'inherit',
                  fontSize: 'var(--font-xs)',
                  fontWeight: 800,
                  opacity: disabled ? 0.5 : 1,
                }}
              >
                {pos} %
              </button>
            ))}
            <button
              type="button"
              disabled={disabled}
              onClick={() => triggerCover('set_position', targetPosition)}
              style={{
                flex: 1.25,
                height: '34px',
                borderRadius: '999px',
                border: 'none',
                cursor: disabled ? 'default' : 'pointer',
                fontFamily: 'inherit',
                background: 'linear-gradient(135deg, #3F34C4, #6D5DF0)',
                color: '#FFFFFF',
                fontSize: 'var(--font-xs)',
                fontWeight: 800,
                boxShadow: '0 4px 12px rgba(63,52,196,0.24)',
                opacity: disabled ? 0.5 : 1,
              }}
            >
              Setzen
            </button>
          </div>
        </div>
      )}

      {pending && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            color: PRIMARY,
            fontSize: 'var(--font-xs)',
            fontWeight: 800,
          }}
        >
          <RefreshCw className="smart-home-spin" size={13} />
          Wird ausgeführt…
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '0.55rem 0.7rem',
            borderRadius: '10px',
            background: '#FDE8EF',
            color: PINK_TEXT,
            fontSize: 'var(--font-xs)',
            fontWeight: 700,
            display: 'flex',
            gap: '0.4rem',
            alignItems: 'flex-start',
          }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ overflowWrap: 'anywhere' }}>{error}</span>
        </div>
      )}
    </div>
  );
};
