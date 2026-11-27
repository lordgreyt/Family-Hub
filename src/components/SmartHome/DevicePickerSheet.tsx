import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Blinds, Check, Lightbulb, Search, X } from 'lucide-react';
import type { HomeAssistantDevice } from '../../services/homeAssistant';
import { filterSmartHomeDevices, type DeviceDomainFilter } from '../../pages/smartHomeLayout';
import { PRIMARY } from '../SurgeryFinance/theme';

interface DevicePickerSheetProps {
  open: boolean;
  sectionTitle: string;
  devices: HomeAssistantDevice[];
  areas: string[];
  selectedIds: string[];
  onSave: (entityIds: string[]) => void;
  onClose: () => void;
}

export const DevicePickerSheet: React.FC<DevicePickerSheetProps> = ({
  open,
  sectionTitle,
  devices,
  areas,
  selectedIds,
  onSave,
  onClose,
}) => {
  const [draftIds, setDraftIds] = useState<string[]>(selectedIds);
  const [query, setQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState<DeviceDomainFilter>('all');
  const [areaFilter, setAreaFilter] = useState('all');

  React.useEffect(() => {
    if (open) {
      setDraftIds(selectedIds);
      setQuery('');
      setDomainFilter('all');
      setAreaFilter('all');
    }
  }, [open, selectedIds]);

  const filtered = useMemo(
    () => filterSmartHomeDevices(devices, { domainFilter, areaFilter, query }),
    [devices, domainFilter, areaFilter, query]
  );

  if (!open) return null;

  const selectedSet = new Set(draftIds);
  const toggleId = (entityId: string) => {
    setDraftIds(prev => (prev.includes(entityId) ? prev.filter(id => id !== entityId) : [...prev, entityId]));
  };

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(15, 23, 42, 0.56)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0.75rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '640px',
          maxHeight: '86vh',
          borderRadius: '24px',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.32)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.15rem 0.85rem',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: PRIMARY }}>
              Ansicht zusammenbauen
            </div>
            <h2 style={{ margin: '0.15rem 0 0', fontSize: 'var(--font-lg)', fontWeight: 800, color: 'var(--color-text)' }}>
              {sectionTitle}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface-hover)',
              color: 'var(--color-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Search & Filters */}
        <div style={{ padding: '0.8rem 1.15rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              color="var(--color-text-muted)"
              style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Lampe, Rollladen oder Raum suchen…"
              className="input-field"
              style={{ paddingLeft: '2.35rem', height: '42px', borderRadius: '12px', fontSize: 'var(--font-sm)' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {(
              [
                { id: 'all', label: 'Alle' },
                { id: 'light', label: 'Lampen' },
                { id: 'cover', label: 'Rollläden' },
              ] as const
            ).map(tab => {
              const active = domainFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDomainFilter(tab.id)}
                  style={{
                    height: '32px',
                    padding: '0 0.8rem',
                    borderRadius: '999px',
                    border: active ? 'none' : '1px solid var(--color-border)',
                    background: active ? PRIMARY : 'var(--color-surface-hover)',
                    color: active ? '#FFFFFF' : 'var(--color-text)',
                    fontSize: '12px',
                    fontWeight: 800,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}

            {areas.length > 0 && (
              <select
                value={areaFilter}
                onChange={e => setAreaFilter(e.target.value)}
                aria-label="Raum filtern"
                style={{
                  height: '32px',
                  padding: '0 0.7rem',
                  borderRadius: '999px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  fontSize: '12px',
                  fontWeight: 700,
                  fontFamily: 'inherit',
                }}
              >
                <option value="all">Alle Räume</option>
                {areas.map(area => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Device List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1.15rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)', fontWeight: 600 }}>
              Keine passenden Geräte gefunden.
            </div>
          ) : (
            filtered.map(device => {
              const checked = selectedSet.has(device.entity_id);
              const isLight = device.domain === 'light';
              return (
                <button
                  key={device.entity_id}
                  type="button"
                  onClick={() => toggleId(device.entity_id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.7rem',
                    padding: '0.68rem 0.8rem',
                    borderRadius: '14px',
                    border: checked ? `1.5px solid ${PRIMARY}` : '1px solid var(--color-border)',
                    background: checked ? 'rgba(90, 75, 224, 0.08)' : 'var(--color-surface-hover)',
                    color: 'var(--color-text)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <span
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '10px',
                      background: isLight ? '#FEF3C7' : '#ECE8FF',
                      color: isLight ? '#D97706' : PRIMARY,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {isLight ? <Lightbulb size={17} /> : <Blinds size={17} />}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--font-sm)', fontWeight: 800, overflowWrap: 'anywhere' }}>
                      {device.name}
                    </div>
                    <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                      {isLight ? 'Lampe' : 'Rollladen'}
                      {device.area ? ` · ${device.area}` : ''}
                    </div>
                  </div>

                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '8px',
                      border: checked ? 'none' : '2px solid var(--color-border)',
                      background: checked ? PRIMARY : 'var(--color-surface)',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {checked && <Check size={15} strokeWidth={3} />}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.85rem 1.15rem',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            background: 'var(--color-surface)',
          }}
        >
          <span style={{ fontSize: 'var(--font-xs)', fontWeight: 800, color: 'var(--color-text-muted)' }}>
            {draftIds.length} {draftIds.length === 1 ? 'Gerät' : 'Geräte'} ausgewählt
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: '40px',
                padding: '0 1rem',
                borderRadius: '999px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-hover)',
                color: 'var(--color-text)',
                fontWeight: 700,
                fontSize: 'var(--font-sm)',
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={() => {
                onSave(draftIds);
                onClose();
              }}
              style={{
                height: '40px',
                padding: '0 1.25rem',
                borderRadius: '999px',
                border: 'none',
                background: 'linear-gradient(135deg, #3F34C4, #6D5DF0)',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: 'var(--font-sm)',
                fontFamily: 'inherit',
                cursor: 'pointer',
                boxShadow: '0 6px 16px rgba(63, 52, 196, 0.28)',
              }}
            >
              Übernehmen
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
