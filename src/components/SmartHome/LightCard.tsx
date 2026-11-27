import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Lightbulb,
  Palette,
  Power,
  RefreshCw,
  ShieldAlert,
  Star,
  Sun,
  X,
} from 'lucide-react';
import type { HomeAssistantLight, SmartHomeDeviceActionPayload } from '../../services/homeAssistant';
import { CARD, ORANGE, PINK, PINK_TEXT, PRIMARY } from '../SurgeryFinance/theme';

const KELVIN_PRESETS = [
  { label: 'Warm', kelvin: 2700, swatch: '#FFB76B' },
  { label: 'Neutral', kelvin: 4000, swatch: '#FFF1D6' },
  { label: 'Tageslicht', kelvin: 5500, swatch: '#E3F0FF' },
] as const;

const COLOR_PRESETS: { label: string; rgb: [number, number, number]; hex: string }[] = [
  { label: 'Warmweiß', rgb: [255, 200, 130], hex: '#FFC882' },
  { label: 'Bernstein', rgb: [255, 145, 55], hex: '#FF9137' },
  { label: 'Pfirsich', rgb: [255, 120, 140], hex: '#FF788C' },
  { label: 'Violett', rgb: [155, 110, 255], hex: '#9B6EFF' },
  { label: 'Himmel', rgb: [90, 175, 255], hex: '#5AAFFF' },
  { label: 'Smaragd', rgb: [65, 210, 145], hex: '#41D291' },
];

const QUICK_BRIGHTNESS = [25, 60, 100] as const;

interface LightCardProps {
  light: HomeAssistantLight;
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

export const LightCard: React.FC<LightCardProps> = ({
  light,
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
  const isOn = light.state === 'on';
  const unavailable = light.state === 'unavailable';
  const disabled = Boolean(pending) || unavailable;

  const [sliderValue, setSliderValue] = useState<number>(light.brightness_pct ?? 80);
  const [showColorTools, setShowColorTools] = useState(false);

  useEffect(() => {
    if (light.brightness_pct !== null) {
      setSliderValue(light.brightness_pct);
    }
  }, [light.brightness_pct]);

  const activeAccent =
    isOn && light.rgb_color
      ? `rgb(${light.rgb_color[0]}, ${light.rgb_color[1]}, ${light.rgb_color[2]})`
      : '#F59E0B';

  const commitBrightness = (pct: number) => {
    const clamped = Math.max(1, Math.min(100, Math.round(pct)));
    setSliderValue(clamped);
    onAction({
      entity_id: light.entity_id,
      action: 'turn_on',
      brightness_pct: clamped,
    });
  };

  return (
    <div
      style={{
        ...CARD,
        padding: '0.95rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        border: isOn ? '1.5px solid rgba(245, 158, 11, 0.42)' : '1px solid var(--color-border)',
        background: isOn
          ? 'linear-gradient(135deg, rgba(255, 249, 235, 0.92), var(--color-surface))'
          : 'var(--color-surface)',
        transition: 'border-color 0.2s ease, background 0.2s ease',
      }}
    >
      {/* Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAction({ entity_id: light.entity_id, action: isOn ? 'turn_off' : 'turn_on' })}
          aria-label={`${light.name} ${isOn ? 'ausschalten' : 'einschalten'}`}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '14px',
            border: 'none',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: disabled ? 'default' : 'pointer',
            background: unavailable
              ? `${PINK}24`
              : isOn
                ? `radial-gradient(circle at 35% 30%, #FFF7D6 0%, ${activeAccent} 100%)`
                : 'var(--color-surface-hover)',
            color: unavailable ? PINK_TEXT : isOn ? '#FFFFFF' : 'var(--color-text-muted)',
            boxShadow: isOn ? `0 6px 16px ${activeAccent}55` : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          {pending ? (
            <RefreshCw size={18} className="smart-home-spin" />
          ) : unavailable ? (
            <ShieldAlert size={18} />
          ) : (
            <Lightbulb size={20} strokeWidth={2.2} />
          )}
        </button>

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
              {light.name}
            </h3>
            {light.is_group && (
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
                color: unavailable ? PINK_TEXT : isOn ? '#B45309' : 'var(--color-text-muted)',
                fontWeight: 800,
              }}
            >
              {unavailable
                ? 'Nicht erreichbar'
                : isOn
                  ? light.brightness_pct !== null
                    ? `An · ${light.brightness_pct} %`
                    : 'An'
                  : 'Aus'}
            </span>
            {light.area && (
              <>
                <span style={{ opacity: 0.45 }}>·</span>
                <span>{light.area}</span>
              </>
            )}
          </div>
        </div>

        {/* Pin / Edit / Power Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
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

          {editMode ? (
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
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onAction({ entity_id: light.entity_id, action: isOn ? 'turn_off' : 'turn_on' })}
              style={{
                height: '38px',
                padding: '0 0.85rem',
                borderRadius: '999px',
                border: 'none',
                background: isOn
                  ? 'linear-gradient(135deg, #F59E0B, #EA580C)'
                  : '#ECE8FF',
                color: isOn ? '#FFFFFF' : PRIMARY,
                fontSize: 'var(--font-xs)',
                fontWeight: 800,
                fontFamily: 'inherit',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                boxShadow: isOn ? '0 5px 14px rgba(245, 158, 11, 0.35)' : 'none',
              }}
            >
              <Power size={14} />
              {isOn ? 'An' : 'Aus'}
            </button>
          )}
        </div>
      </div>

      {/* Brightness Slider & Color Controls (compact, only when not in edit mode) */}
      {!editMode && !unavailable && (light.supports_brightness || light.supports_color_temp || light.supports_color) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          {light.supports_brightness && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.5rem 0.7rem',
                borderRadius: '12px',
                background: 'var(--color-surface-hover)',
              }}
            >
              <Sun size={15} color={isOn ? ORANGE : 'var(--color-text-muted)'} style={{ flexShrink: 0 }} />
              <input
                type="range"
                min={1}
                max={100}
                step={1}
                value={sliderValue}
                disabled={disabled}
                onChange={e => setSliderValue(Number(e.target.value))}
                onPointerUp={() => commitBrightness(sliderValue)}
                onKeyUp={() => commitBrightness(sliderValue)}
                aria-label={`Helligkeit ${light.name}`}
                style={{ flex: 1, minWidth: 0, accentColor: isOn ? '#F59E0B' : PRIMARY }}
              />
              <span
                style={{
                  minWidth: '2.6rem',
                  textAlign: 'right',
                  fontSize: 'var(--font-xs)',
                  fontWeight: 800,
                  color: 'var(--color-text)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {sliderValue} %
              </span>
              {(light.supports_color_temp || light.supports_color) && (
                <button
                  type="button"
                  onClick={() => setShowColorTools(v => !v)}
                  title="Lichtfarbe anpassen"
                  aria-label="Lichtfarbe anpassen"
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '9px',
                    border: showColorTools ? `1px solid ${PRIMARY}` : '1px solid var(--color-border)',
                    background: showColorTools ? '#ECE8FF' : 'var(--color-surface)',
                    color: showColorTools ? PRIMARY : 'var(--color-text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <Palette size={14} />
                </button>
              )}
            </div>
          )}

          {!light.supports_brightness && (light.supports_color_temp || light.supports_color) && (
            <button
              type="button"
              onClick={() => setShowColorTools(v => !v)}
              style={{
                alignSelf: 'flex-start',
                height: '30px',
                padding: '0 0.7rem',
                borderRadius: '999px',
                border: '1px solid var(--color-border)',
                background: showColorTools ? '#ECE8FF' : 'var(--color-surface-hover)',
                color: showColorTools ? PRIMARY : 'var(--color-text-muted)',
                fontSize: '11.5px',
                fontWeight: 700,
                fontFamily: 'inherit',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: 'pointer',
              }}
            >
              <Palette size={13} /> Lichtfarbe
            </button>
          )}

          {showColorTools && (
            <div
              style={{
                padding: '0.65rem 0.75rem',
                borderRadius: '12px',
                background: 'var(--color-surface-hover)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.55rem',
              }}
            >
              {light.supports_brightness && (
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  {QUICK_BRIGHTNESS.map(pct => (
                    <button
                      key={pct}
                      type="button"
                      disabled={disabled}
                      onClick={() => commitBrightness(pct)}
                      style={{
                        flex: 1,
                        height: '30px',
                        borderRadius: '999px',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-surface)',
                        color: 'var(--color-text)',
                        fontSize: '11.5px',
                        fontWeight: 800,
                        fontFamily: 'inherit',
                        cursor: disabled ? 'default' : 'pointer',
                      }}
                    >
                      {pct} %
                    </button>
                  ))}
                </div>
              )}

              {light.supports_color_temp && (
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {KELVIN_PRESETS.map(preset => {
                    const kelvin = Math.max(
                      light.min_color_temp_kelvin,
                      Math.min(light.max_color_temp_kelvin, preset.kelvin)
                    );
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                          onAction({
                            entity_id: light.entity_id,
                            action: 'turn_on',
                            color_temp_kelvin: kelvin,
                          })
                        }
                        style={{
                          flex: 1,
                          minWidth: '84px',
                          height: '32px',
                          padding: '0 0.6rem',
                          borderRadius: '999px',
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-surface)',
                          color: 'var(--color-text)',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          fontFamily: 'inherit',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          cursor: disabled ? 'default' : 'pointer',
                        }}
                      >
                        <span
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: preset.swatch,
                            border: '1px solid rgba(0,0,0,0.12)',
                          }}
                        />
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {light.supports_color && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                  {COLOR_PRESETS.map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      disabled={disabled}
                      title={preset.label}
                      aria-label={`Farbe ${preset.label}`}
                      onClick={() =>
                        onAction({
                          entity_id: light.entity_id,
                          action: 'turn_on',
                          rgb_color: preset.rgb,
                        })
                      }
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        border: '2px solid var(--color-surface)',
                        background: preset.hex,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                        cursor: disabled ? 'default' : 'pointer',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
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
