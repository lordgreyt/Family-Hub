import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Blinds,
  Check,
  FolderPlus,
  LayoutGrid,
  Lightbulb,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { mockDb, type SmartHomeLayout } from '../services/mockDb';
import {
  fetchSmartHomeDevices,
  sendSmartHomeDeviceAction,
  type HomeAssistantCoverDevice,
  type HomeAssistantDevice,
  type HomeAssistantLight,
  type SmartHomeDeviceActionPayload,
} from '../services/homeAssistant';
import {
  addSection,
  deleteSection,
  filterSmartHomeDevices,
  getAllPinnedEntityIds,
  moveEntityInSection,
  moveSection,
  normalizeLayout,
  removeEntityFromSection,
  renameSection,
  setSectionEntities,
  togglePinEntity,
  type DeviceDomainFilter,
} from './smartHomeLayout';
import { LightCard } from '../components/SmartHome/LightCard';
import { CoverCard } from '../components/SmartHome/CoverCard';
import { DevicePickerSheet } from '../components/SmartHome/DevicePickerSheet';
import { CARD, HERO_GRADIENT, PINK_TEXT, PRIMARY } from '../components/SurgeryFinance/theme';

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : 'Unbekannter Fehler.';
}

function formatUpdatedAt(value: string | null) {
  if (!value) return 'kein Status';
  return new Date(value).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export const SmartHome = () => {
  const { user, updateUser } = useAuth();
  const [covers, setCovers] = useState<HomeAssistantCoverDevice[]>([]);
  const [lights, setLights] = useState<HomeAssistantLight[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [deviceErrors, setDeviceErrors] = useState<Record<string, string | undefined>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Tabs & Katalog-Filter
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my');
  const [editMode, setEditMode] = useState(false);
  const [domainFilter, setDomainFilter] = useState<DeviceDomainFilter>('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Eigene Ansicht (pro User in Firebase RTDB gespeichert)
  const [layout, setLayout] = useState<SmartHomeLayout>(() => normalizeLayout(user?.smartHomeLayout));
  const [pickerSectionId, setPickerSectionId] = useState<string | null>(null);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [showNewSectionInput, setShowNewSectionInput] = useState(false);
  const [renamingSectionId, setRenamingSectionId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  // Sync layout whenever user profile updates from Firebase
  useEffect(() => {
    setLayout(normalizeLayout(user?.smartHomeLayout));
  }, [user?.smartHomeLayout]);

  const persistLayout = useCallback(
    (nextLayout: SmartHomeLayout) => {
      const normalized = normalizeLayout(nextLayout);
      setLayout(normalized);
      if (!user) return;
      const updatedUser = { ...user, smartHomeLayout: normalized };
      mockDb.updateUser(updatedUser);
      updateUser(updatedUser);
    },
    [user, updateUser]
  );

  const loadDevices = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const result = await fetchSmartHomeDevices();
      setCovers(result.covers);
      setLights(result.lights);
      setAreas(result.areas || []);
      setUpdatedAt(result.updated_at);
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.isChild) void loadDevices();
  }, [loadDevices, user?.isChild]);

  const allDevices = useMemo<HomeAssistantDevice[]>(
    () => [...lights, ...covers],
    [lights, covers]
  );

  const deviceById = useMemo(() => {
    const map = new Map<string, HomeAssistantDevice>();
    for (const device of allDevices) {
      map.set(device.entity_id, device);
    }
    return map;
  }, [allDevices]);

  const pinnedIds = useMemo(() => getAllPinnedEntityIds(layout), [layout]);

  const filteredCatalog = useMemo(
    () => filterSmartHomeDevices(allDevices, { domainFilter, areaFilter, query: searchQuery }),
    [allDevices, domainFilter, areaFilter, searchQuery]
  );

  const summary = useMemo(() => {
    const lightsOn = lights.filter(l => l.state === 'on').length;
    const lightsAvailable = lights.filter(l => l.state !== 'unavailable').length;
    const coversOpen = covers.filter(c => c.state !== 'unavailable' && c.position !== null && c.position > 0).length;
    const coversClosed = covers.filter(c => c.state !== 'unavailable' && c.position === 0).length;
    const coversMoving = covers.filter(c => c.state === 'opening' || c.state === 'closing').length;
    return { lightsOn, lightsAvailable, coversOpen, coversClosed, coversMoving };
  }, [lights, covers]);

  if (user?.isChild) {
    return <Navigate to="/" replace />;
  }

  const handleAction = async (payload: SmartHomeDeviceActionPayload) => {
    const id = payload.entity_id;
    setPending(prev => ({ ...prev, [id]: true }));
    setDeviceErrors(prev => ({ ...prev, [id]: undefined }));

    // Optimistisches UI-Update für Lampen, damit der Schalter sofort reagiert
    if (id.startsWith('light.')) {
      setLights(prev =>
        prev.map(l => {
          if (l.entity_id !== id) return l;
          if (payload.action === 'turn_off') {
            return { ...l, state: 'off', brightness_pct: null };
          }
          if (payload.action === 'turn_on') {
            return {
              ...l,
              state: 'on',
              brightness_pct:
                'brightness_pct' in payload && payload.brightness_pct !== undefined
                  ? payload.brightness_pct
                  : l.brightness_pct ?? 100,
              rgb_color:
                'rgb_color' in payload && payload.rgb_color !== undefined
                  ? payload.rgb_color
                  : l.rgb_color,
            };
          }
          return l;
        })
      );
    }

    try {
      await sendSmartHomeDeviceAction(payload);
      await loadDevices(true);
    } catch (err) {
      setDeviceErrors(prev => ({ ...prev, [id]: messageFromError(err) }));
      await loadDevices(true);
    } finally {
      setPending(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleGroupBatchAction = async (entityIds: string[], type: 'lights_off' | 'covers_close' | 'covers_open') => {
    const targets = entityIds
      .map(id => deviceById.get(id))
      .filter((d): d is HomeAssistantDevice => Boolean(d) && d.state !== 'unavailable');

    const payloads: SmartHomeDeviceActionPayload[] = [];
    for (const dev of targets) {
      if (type === 'lights_off' && dev.domain === 'light' && dev.state === 'on') {
        payloads.push({ entity_id: dev.entity_id, action: 'turn_off' });
      } else if (type === 'covers_close' && dev.domain === 'cover') {
        payloads.push({ entity_id: dev.entity_id, action: 'close' });
      } else if (type === 'covers_open' && dev.domain === 'cover') {
        payloads.push({ entity_id: dev.entity_id, action: 'open' });
      }
    }
    if (payloads.length === 0) return;

    setPending(prev => {
      const next = { ...prev };
      for (const p of payloads) next[p.entity_id] = true;
      return next;
    });

    try {
      await Promise.allSettled(payloads.map(p => sendSmartHomeDeviceAction(p)));
      await loadDevices(true);
    } finally {
      setPending(prev => {
        const next = { ...prev };
        for (const p of payloads) next[p.entity_id] = false;
        return next;
      });
    }
  };

  const pickerSection = pickerSectionId
    ? layout.sections.find(s => s.id === pickerSectionId) || null
    : null;

  const isBusy = loading || refreshing;

  const chipWhite = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.35rem 0.75rem',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.2)',
    color: 'white',
    fontSize: 'var(--font-xs)',
    fontWeight: 700,
    lineHeight: 1.3,
  } as const;

  const renderDeviceCard = (
    device: HomeAssistantDevice,
    opts?: {
      showPin?: boolean;
      sectionId?: string;
      indexInSection?: number;
      sectionLength?: number;
    }
  ) => {
    const commonProps = {
      pending: Boolean(pending[device.entity_id]),
      error: deviceErrors[device.entity_id],
      isPinned: pinnedIds.has(device.entity_id),
      showPinButton: opts?.showPin,
      editMode: Boolean(opts?.sectionId && editMode),
      canMoveUp: opts?.indexInSection !== undefined && opts.indexInSection > 0,
      canMoveDown:
        opts?.indexInSection !== undefined &&
        opts?.sectionLength !== undefined &&
        opts.indexInSection < opts.sectionLength - 1,
      onAction: (payload: SmartHomeDeviceActionPayload) => void handleAction(payload),
      onTogglePin: () => persistLayout(togglePinEntity(layout, device.entity_id)),
      onMoveUp: opts?.sectionId
        ? () => persistLayout(moveEntityInSection(layout, opts.sectionId!, device.entity_id, -1))
        : undefined,
      onMoveDown: opts?.sectionId
        ? () => persistLayout(moveEntityInSection(layout, opts.sectionId!, device.entity_id, 1))
        : undefined,
      onRemove: opts?.sectionId
        ? () => persistLayout(removeEntityFromSection(layout, opts.sectionId!, device.entity_id))
        : undefined,
    };

    if (device.domain === 'light') {
      return <LightCard key={device.entity_id} light={device} {...commonProps} />;
    }
    return <CoverCard key={device.entity_id} cover={device} {...commonProps} />;
  };

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2.5rem' }}>
      {/* Hero */}
      <div
        style={{
          background: HERO_GRADIENT,
          borderRadius: 'var(--radius-xl)',
          padding: '1.3rem 1.25rem',
          color: 'white',
          boxShadow: '0 12px 28px rgba(63,52,196,0.28)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.22)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Lightbulb size={20} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--font-base)', fontWeight: 800 }}>Smart Home</div>
            <div style={{ fontSize: 'var(--font-xs)', opacity: 0.86, fontWeight: 600 }}>
              {updatedAt ? `Home Assistant · Stand ${formatUpdatedAt(updatedAt)} Uhr` : 'Lampen & Rollläden steuern'}
            </div>
          </div>

          {activeTab === 'my' && (
            <button
              type="button"
              onClick={() => setEditMode(v => !v)}
              className="glass-btn"
              style={{
                padding: '0 0.85rem',
                width: 'auto',
                gap: '0.35rem',
                fontSize: '12px',
                fontWeight: 800,
                background: editMode ? '#FFFFFF' : undefined,
                color: editMode ? '#3F34C4' : '#FFFFFF',
              }}
            >
              {editMode ? <Check size={15} /> : <Pencil size={14} />}
              {editMode ? 'Fertig' : 'Anpassen'}
            </button>
          )}

          <button
            type="button"
            onClick={() => void loadDevices(true)}
            disabled={isBusy}
            title="Status neu laden"
            aria-label="Status neu laden"
            className="glass-btn"
            style={{ opacity: isBusy ? 0.7 : 1 }}
          >
            <RefreshCw className={isBusy ? 'smart-home-spin' : undefined} size={18} />
          </button>
        </div>

        {/* Live Overview Numbers */}
        <div style={{ marginTop: '1.05rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div style={{ padding: '0.7rem 0.85rem', borderRadius: '16px', background: 'rgba(255,255,255,0.14)' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 800, letterSpacing: '0.07em', opacity: 0.85, textTransform: 'uppercase' }}>
              Lampen an
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, lineHeight: 1.15, marginTop: '0.15rem', fontVariantNumeric: 'tabular-nums' }}>
              {summary.lightsOn}
              <span style={{ fontSize: '1rem', opacity: 0.75 }}> / {lights.length || '–'}</span>
            </div>
          </div>

          <div style={{ padding: '0.7rem 0.85rem', borderRadius: '16px', background: 'rgba(255,255,255,0.14)' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 800, letterSpacing: '0.07em', opacity: 0.85, textTransform: 'uppercase' }}>
              Rollläden offen
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, lineHeight: 1.15, marginTop: '0.15rem', fontVariantNumeric: 'tabular-nums' }}>
              {summary.coversOpen}
              <span style={{ fontSize: '1rem', opacity: 0.75 }}> / {covers.length || '–'}</span>
            </div>
          </div>
        </div>

        {allDevices.length > 0 && (
          <div style={{ marginTop: '0.8rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            <span style={chipWhite}>
              <Star size={12} fill="currentColor" /> {pinnedIds.size} in meiner Ansicht
            </span>
            <span style={chipWhite}>{summary.coversClosed} Rollläden zu</span>
            {summary.coversMoving > 0 && (
              <span style={chipWhite}>
                <RefreshCw size={12} className="smart-home-spin" /> {summary.coversMoving} in Bewegung
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main Mode Tabs: Meine Ansicht vs. Alle Geräte */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.4rem',
          padding: '0.32rem',
          borderRadius: '16px',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        {(
          [
            { id: 'my', label: 'Meine Ansicht', count: pinnedIds.size, Icon: Star },
            { id: 'all', label: 'Alle Geräte', count: allDevices.length, Icon: LayoutGrid },
          ] as const
        ).map(tab => {
          const active = activeTab === tab.id;
          const Icon = tab.Icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'all') setEditMode(false);
              }}
              style={{
                height: '42px',
                borderRadius: '12px',
                border: 'none',
                background: active ? 'linear-gradient(135deg, #3F34C4, #6D5DF0)' : 'transparent',
                color: active ? '#FFFFFF' : 'var(--color-text-muted)',
                fontSize: 'var(--font-sm)',
                fontWeight: 800,
                fontFamily: 'inherit',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
              }}
            >
              <Icon size={15} fill={tab.id === 'my' && active ? 'currentColor' : 'none'} />
              {tab.label}
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '0.1rem 0.45rem',
                  borderRadius: '999px',
                  background: active ? 'rgba(255,255,255,0.22)' : 'var(--color-surface-hover)',
                  color: active ? '#FFFFFF' : 'var(--color-text-muted)',
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div
          style={{
            padding: '0.9rem 1rem',
            borderRadius: 'var(--radius-lg)',
            background: '#FDE8EF',
            color: PINK_TEXT,
            display: 'flex',
            gap: '0.6rem',
            alignItems: 'flex-start',
            fontSize: 'var(--font-sm)',
            fontWeight: 700,
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ overflowWrap: 'anywhere' }}>{error}</span>
        </div>
      )}

      {loading ? (
        <div style={{ ...CARD, padding: '2.2rem 1.25rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <RefreshCw className="smart-home-spin" size={22} />
          <p style={{ margin: '0.75rem 0 0', fontSize: 'var(--font-sm)', fontWeight: 700 }}>
            Lädt alle Lampen & Rollläden aus Home Assistant…
          </p>
        </div>
      ) : activeTab === 'my' ? (
        /* ================= MEINE ANSICHT ================= */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Onboarding Empty State when nothing is pinned yet and not editing */}
          {pinnedIds.size === 0 && !editMode ? (
            <div
              style={{
                ...CARD,
                padding: '1.8rem 1.25rem',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.85rem',
              }}
            >
              <span
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '18px',
                  background: '#ECE8FF',
                  color: PRIMARY,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={26} />
              </span>
              <div>
                <h2 style={{ margin: 0, fontSize: 'var(--font-lg)', fontWeight: 800, color: 'var(--color-text)' }}>
                  Deine persönliche Ansicht
                </h2>
                <p
                  style={{
                    margin: '0.35rem auto 0',
                    maxWidth: '420px',
                    fontSize: 'var(--font-sm)',
                    fontWeight: 600,
                    color: 'var(--color-text-muted)',
                    lineHeight: 1.5,
                  }}
                >
                  Wähle genau die Lampen und Rollläden aus, die du täglich brauchst — gespeichert für dein Profil auf allen Geräten.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.2rem' }}>
                <button
                  type="button"
                  onClick={() => setPickerSectionId(layout.sections[0].id)}
                  style={{
                    height: '44px',
                    padding: '0 1.25rem',
                    borderRadius: '999px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #3F34C4, #6D5DF0)',
                    color: '#FFFFFF',
                    fontSize: 'var(--font-sm)',
                    fontWeight: 800,
                    fontFamily: 'inherit',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    cursor: 'pointer',
                    boxShadow: '0 8px 18px rgba(63, 52, 196, 0.28)',
                  }}
                >
                  <Plus size={17} /> Geräte auswählen
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  style={{
                    height: '44px',
                    padding: '0 1.1rem',
                    borderRadius: '999px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-hover)',
                    color: 'var(--color-text)',
                    fontSize: 'var(--font-sm)',
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  Alle {allDevices.length} Geräte ansehen
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Edit Mode Toolbar: Add new group */}
              {editMode && (
                <div
                  style={{
                    ...CARD,
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                    background: 'rgba(90, 75, 224, 0.06)',
                    border: '1.5px dashed rgba(90, 75, 224, 0.35)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 'var(--font-xs)', fontWeight: 800, color: PRIMARY }}>
                      Ansicht bearbeiten · Sortiere Geräte oder lege eigene Gruppen an
                    </span>
                    {!showNewSectionInput && (
                      <button
                        type="button"
                        onClick={() => setShowNewSectionInput(true)}
                        style={{
                          height: '32px',
                          padding: '0 0.8rem',
                          borderRadius: '999px',
                          border: 'none',
                          background: PRIMARY,
                          color: '#FFFFFF',
                          fontSize: '12px',
                          fontWeight: 800,
                          fontFamily: 'inherit',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          cursor: 'pointer',
                        }}
                      >
                        <FolderPlus size={14} /> Neue Gruppe
                      </button>
                    )}
                  </div>

                  {showNewSectionInput && (
                    <form
                      onSubmit={e => {
                        e.preventDefault();
                        if (!newSectionTitle.trim()) return;
                        persistLayout(addSection(layout, newSectionTitle));
                        setNewSectionTitle('');
                        setShowNewSectionInput(false);
                      }}
                      style={{ display: 'flex', gap: '0.45rem' }}
                    >
                      <input
                        type="text"
                        value={newSectionTitle}
                        onChange={e => setNewSectionTitle(e.target.value)}
                        placeholder="z. B. Wohnzimmer, Abendroutine, OG…"
                        className="input-field"
                        autoFocus
                        style={{ flex: 1, height: '38px', borderRadius: '10px', fontSize: 'var(--font-sm)' }}
                      />
                      <button
                        type="submit"
                        style={{
                          height: '38px',
                          padding: '0 0.9rem',
                          borderRadius: '10px',
                          border: 'none',
                          background: PRIMARY,
                          color: '#FFFFFF',
                          fontWeight: 800,
                          fontSize: '12.5px',
                          fontFamily: 'inherit',
                          cursor: 'pointer',
                        }}
                      >
                        Anlegen
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewSectionInput(false);
                          setNewSectionTitle('');
                        }}
                        style={{
                          height: '38px',
                          padding: '0 0.75rem',
                          borderRadius: '10px',
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-surface)',
                          color: 'var(--color-text-muted)',
                          fontWeight: 700,
                          fontSize: '12.5px',
                          fontFamily: 'inherit',
                          cursor: 'pointer',
                        }}
                      >
                        Abbrechen
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* User Sections */}
              {layout.sections.map((section, sectionIdx) => {
                const resolvedDevices = section.entityIds
                  .map(id => deviceById.get(id))
                  .filter((d): d is HomeAssistantDevice => Boolean(d));

                const hasLightsOn = resolvedDevices.some(d => d.domain === 'light' && d.state === 'on');
                const hasCovers = resolvedDevices.some(d => d.domain === 'cover' && d.state !== 'unavailable');

                if (!editMode && resolvedDevices.length === 0 && layout.sections.length > 1) {
                  return null;
                }

                return (
                  <section key={section.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {/* Section Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', padding: '0 0.2rem' }}>
                      {renamingSectionId === section.id ? (
                        <form
                          onSubmit={e => {
                            e.preventDefault();
                            persistLayout(renameSection(layout, section.id, renameDraft));
                            setRenamingSectionId(null);
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1 }}
                        >
                          <input
                            type="text"
                            value={renameDraft}
                            onChange={e => setRenameDraft(e.target.value)}
                            className="input-field"
                            autoFocus
                            style={{ height: '34px', maxWidth: '240px', borderRadius: '9px', fontSize: 'var(--font-sm)' }}
                          />
                          <button
                            type="submit"
                            style={{
                              height: '34px',
                              padding: '0 0.7rem',
                              borderRadius: '9px',
                              border: 'none',
                              background: PRIMARY,
                              color: '#FFFFFF',
                              fontWeight: 800,
                              fontSize: '12px',
                              fontFamily: 'inherit',
                              cursor: 'pointer',
                            }}
                          >
                            OK
                          </button>
                        </form>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <h2 style={{ margin: 0, fontSize: 'var(--font-base)', fontWeight: 800, color: 'var(--color-text)' }}>
                            {section.title}
                          </h2>
                          <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                            ({resolvedDevices.length})
                          </span>
                        </div>
                      )}

                      {editMode ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => setPickerSectionId(section.id)}
                            style={{
                              height: '32px',
                              padding: '0 0.75rem',
                              borderRadius: '999px',
                              border: 'none',
                              background: '#ECE8FF',
                              color: PRIMARY,
                              fontSize: '12px',
                              fontWeight: 800,
                              fontFamily: 'inherit',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              cursor: 'pointer',
                            }}
                          >
                            <Plus size={14} /> Geräte wählen
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingSectionId(section.id);
                              setRenameDraft(section.title);
                            }}
                            title="Gruppe umbenennen"
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '9px',
                              border: '1px solid var(--color-border)',
                              background: 'var(--color-surface)',
                              color: 'var(--color-text-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                            }}
                          >
                            <Pencil size={13} />
                          </button>
                          {layout.sections.length > 1 && (
                            <>
                              <button
                                type="button"
                                disabled={sectionIdx === 0}
                                onClick={() => persistLayout(moveSection(layout, section.id, -1))}
                                title="Gruppe nach oben"
                                style={{
                                  width: '30px',
                                  height: '32px',
                                  borderRadius: '9px',
                                  border: '1px solid var(--color-border)',
                                  background: 'var(--color-surface)',
                                  color: 'var(--color-text)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: sectionIdx > 0 ? 'pointer' : 'default',
                                  opacity: sectionIdx > 0 ? 1 : 0.35,
                                }}
                              >
                                <ArrowUp size={13} />
                              </button>
                              <button
                                type="button"
                                disabled={sectionIdx === layout.sections.length - 1}
                                onClick={() => persistLayout(moveSection(layout, section.id, 1))}
                                title="Gruppe nach unten"
                                style={{
                                  width: '30px',
                                  height: '32px',
                                  borderRadius: '9px',
                                  border: '1px solid var(--color-border)',
                                  background: 'var(--color-surface)',
                                  color: 'var(--color-text)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: sectionIdx < layout.sections.length - 1 ? 'pointer' : 'default',
                                  opacity: sectionIdx < layout.sections.length - 1 ? 1 : 0.35,
                                }}
                              >
                                <ArrowDown size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => persistLayout(deleteSection(layout, section.id))}
                                title="Gruppe löschen"
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '9px',
                                  border: 'none',
                                  background: '#FDE8EF',
                                  color: PINK_TEXT,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {hasLightsOn && (
                            <button
                              type="button"
                              onClick={() => void handleGroupBatchAction(section.entityIds, 'lights_off')}
                              style={{
                                height: '30px',
                                padding: '0 0.7rem',
                                borderRadius: '999px',
                                border: '1px solid rgba(245, 158, 11, 0.35)',
                                background: '#FEF3C7',
                                color: '#B45309',
                                fontSize: '11.5px',
                                fontWeight: 800,
                                fontFamily: 'inherit',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                cursor: 'pointer',
                              }}
                            >
                              <Power size={12} /> Lichter aus
                            </button>
                          )}
                          {hasCovers && (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleGroupBatchAction(section.entityIds, 'covers_open')}
                                style={{
                                  height: '30px',
                                  padding: '0 0.65rem',
                                  borderRadius: '999px',
                                  border: '1px solid var(--color-border)',
                                  background: 'var(--color-surface)',
                                  color: 'var(--color-text-muted)',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  fontFamily: 'inherit',
                                  cursor: 'pointer',
                                }}
                              >
                                Alle auf
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleGroupBatchAction(section.entityIds, 'covers_close')}
                                style={{
                                  height: '30px',
                                  padding: '0 0.65rem',
                                  borderRadius: '999px',
                                  border: '1px solid var(--color-border)',
                                  background: 'var(--color-surface)',
                                  color: 'var(--color-text-muted)',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  fontFamily: 'inherit',
                                  cursor: 'pointer',
                                }}
                              >
                                Alle zu
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Section Device Cards */}
                    {resolvedDevices.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => setPickerSectionId(section.id)}
                        style={{
                          padding: '1.1rem',
                          borderRadius: '16px',
                          border: '1.5px dashed var(--color-border)',
                          background: 'var(--color-surface)',
                          color: 'var(--color-text-muted)',
                          fontSize: 'var(--font-sm)',
                          fontWeight: 700,
                          fontFamily: 'inherit',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        <Plus size={16} /> Geräte zu „{section.title}“ hinzufügen
                      </button>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        {resolvedDevices.map((device, idx) =>
                          renderDeviceCard(device, {
                            sectionId: section.id,
                            indexInSection: idx,
                            sectionLength: resolvedDevices.length,
                          })
                        )}
                      </div>
                    )}
                  </section>
                );
              })}

              {/* Quick "+ Geräte auswählen" button at bottom when not in edit mode */}
              {!editMode && (
                <button
                  type="button"
                  onClick={() => setPickerSectionId(layout.sections[0].id)}
                  style={{
                    alignSelf: 'center',
                    height: '40px',
                    padding: '0 1.1rem',
                    borderRadius: '999px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    color: PRIMARY,
                    fontSize: 'var(--font-xs)',
                    fontWeight: 800,
                    fontFamily: 'inherit',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={15} /> Weitere Geräte hinzufügen
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        /* ================= ALLE GERÄTE (KATALOG) ================= */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Search & Filter Card */}
          <div style={{ ...CARD, padding: '0.85rem 0.95rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ position: 'relative' }}>
              <Search
                size={16}
                color="var(--color-text-muted)"
                style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Nach Lampe, Rollladen oder Raum suchen…"
                className="input-field"
                style={{ paddingLeft: '2.35rem', height: '42px', borderRadius: '12px', fontSize: 'var(--font-sm)' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {(
                [
                  { id: 'all', label: `Alle (${allDevices.length})`, Icon: LayoutGrid },
                  { id: 'light', label: `Lampen (${lights.length})`, Icon: Lightbulb },
                  { id: 'cover', label: `Rollläden (${covers.length})`, Icon: Blinds },
                  { id: 'active', label: `Aktiv (${summary.lightsOn + summary.coversOpen})`, Icon: Power },
                ] as const
              ).map(pill => {
                const active = domainFilter === pill.id;
                const Icon = pill.Icon;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setDomainFilter(pill.id)}
                    style={{
                      height: '34px',
                      padding: '0 0.8rem',
                      borderRadius: '999px',
                      border: active ? 'none' : '1px solid var(--color-border)',
                      background: active ? PRIMARY : 'var(--color-surface-hover)',
                      color: active ? '#FFFFFF' : 'var(--color-text)',
                      fontSize: '12px',
                      fontWeight: 800,
                      fontFamily: 'inherit',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      cursor: 'pointer',
                    }}
                  >
                    <Icon size={13} />
                    {pill.label}
                  </button>
                );
              })}
            </div>

            {areas.length > 0 && (
              <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.15rem' }}>
                {[{ id: 'all', label: 'Alle Räume' }, ...areas.map(a => ({ id: a, label: a }))].map(area => {
                  const active = areaFilter === area.id;
                  return (
                    <button
                      key={area.id}
                      type="button"
                      onClick={() => setAreaFilter(area.id)}
                      style={{
                        height: '30px',
                        padding: '0 0.7rem',
                        borderRadius: '999px',
                        border: active ? `1px solid ${PRIMARY}` : '1px solid var(--color-border)',
                        background: active ? '#ECE8FF' : 'var(--color-surface)',
                        color: active ? PRIMARY : 'var(--color-text-muted)',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        fontFamily: 'inherit',
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                      }}
                    >
                      {area.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Hint about 1-Click Pinning */}
          <div style={{ padding: '0 0.25rem', fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Star size={13} color="#D97706" fill="#FEF3C7" />
            Tippe auf den Stern, um ein Gerät direkt in „Meine Ansicht“ aufzunehmen.
          </div>

          {/* Filtered Devices */}
          {filteredCatalog.length === 0 ? (
            <div style={{ ...CARD, padding: '2rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)', fontWeight: 700 }}>
              Keine passenden Lampen oder Rollläden gefunden.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {filteredCatalog.map(device => renderDeviceCard(device, { showPin: true }))}
            </div>
          )}
        </div>
      )}

      {/* Device Picker Modal */}
      <DevicePickerSheet
        open={Boolean(pickerSection)}
        sectionTitle={pickerSection?.title || 'Meine Geräte'}
        devices={allDevices}
        areas={areas}
        selectedIds={pickerSection?.entityIds || []}
        onSave={entityIds => {
          if (!pickerSection) return;
          persistLayout(setSectionEntities(layout, pickerSection.id, entityIds));
        }}
        onClose={() => setPickerSectionId(null)}
      />

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
