import { useCallback, useEffect, useMemo, useState } from 'react';
import { Refrigerator, Plus, Search, ShoppingCart, ScanBarcode, Trash2, TriangleAlert, Clock } from 'lucide-react';
import { mockDb } from '../services/mockDb';
import type { PantryItem, ShoppingList, UnknownBarcode } from '../services/mockDb';
import { useAuth } from '../context/AuthContext';
import {
  FOOD_CATEGORIES, FOOD_UNITS, STORAGE_LOCATIONS, categoryOrder, getCategory, getLocation,
} from '../data/foodCatalog';
import type { CatalogItem } from '../data/foodCatalog';
import {
  addPantryItemToList, changeStock, daysUntilExpiry, ensureDefaultList, formatQty, isExpiringSoon, isLowStock, newId,
  savePantryWithRules,
} from '../utils/pantry';
import { Modal } from '../components/Food/Modal';
import { fieldLabelStyle } from '../components/Food/styles';
import { QtyStepper } from '../components/Food/QtyStepper';
import { FoodPicker } from '../components/Food/FoodPicker';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { PantryHistory } from '../components/Food/PantryHistory';
import { UnknownBarcodes } from '../components/Food/UnknownBarcodes';

type Filter = 'alle' | 'wenig' | 'mhd' | string;
type Tab = 'bestand' | 'verlauf' | 'neu';

interface Draft {
  id: string;
  isNew: boolean;
  name: string;
  emoji: string;
  category: string;
  unit: string;
  quantity: number;
  minQuantity: string;
  location: string;
  expiryDate: string;
  barcode: string;
  notes: string;
  catalogId?: string;
  restockListId?: string;
  inboxId?: string; // kommt aus „Neu gescannt“ – der Eintrag wird beim Speichern entfernt
  createdAt: number;
}

const chipStyle = (active: boolean) => ({
  padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderRadius: '20px', border: '1px solid',
  borderColor: active ? 'var(--color-primary)' : 'var(--color-border)',
  backgroundColor: active ? 'var(--color-primary)' : 'var(--color-surface)',
  color: active ? 'white' : 'var(--color-text-muted)',
  cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600, flexShrink: 0,
} as const);

const toDraft = (p: PantryItem): Draft => ({
  id: p.id, isNew: false, name: p.name, emoji: p.emoji, category: p.category, unit: p.unit,
  quantity: p.quantity, minQuantity: p.minQuantity === undefined ? '' : String(p.minQuantity),
  location: p.location, expiryDate: p.expiryDate || '', barcode: p.barcode || '', notes: p.notes || '',
  catalogId: p.catalogId, restockListId: p.restockListId, createdAt: p.createdAt,
});

const draftFromCatalog = (c: CatalogItem): Draft => ({
  id: newId(), isNew: true, name: c.name, emoji: c.emoji, category: c.category, unit: c.unit, quantity: 1,
  minQuantity: '', location: c.location || getCategory(c.category).location, expiryDate: '', barcode: '',
  notes: '', catalogId: c.id, createdAt: Date.now(),
});

const draftCustom = (name: string): Draft => {
  const cat = getCategory('sonstiges');
  return {
    id: newId(), isNew: true, name, emoji: cat.emoji, category: cat.id, unit: 'Stk', quantity: 1,
    minQuantity: '', location: cat.location, expiryDate: '', barcode: '', notes: '', createdAt: Date.now(),
  };
};

const formatDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}.${m}.${y}` : iso;
};

export const Pantry = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('alle');
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [scanning, setScanning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('bestand');
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [unknownCount, setUnknownCount] = useState(0);

  useEffect(() => {
    const load = () => {
      setItems(mockDb.getPantry());
      setLists(mockDb.getShoppingLists());
      setUnknownCount(mockDb.getUnknownBarcodes().length);
    };
    load();
    window.addEventListener('db_updated', load);
    return () => window.removeEventListener('db_updated', load);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const lowCount = items.filter(isLowStock).length;
  const expiringCount = items.filter(isExpiringSoon).length;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter(p => !q || p.name.toLowerCase().includes(q) || (p.barcode || '').includes(q))
      .filter(p => {
        if (filter === 'alle') return true;
        if (filter === 'wenig') return isLowStock(p) || p.quantity === 0;
        if (filter === 'mhd') return isExpiringSoon(p);
        return p.location === filter;
      })
      .sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category) || a.name.localeCompare(b.name, 'de'));
  }, [items, search, filter]);

  const groups = useMemo(() => {
    const map = new Map<string, PantryItem[]>();
    visible.forEach(p => map.set(p.category, [...(map.get(p.category) || []), p]));
    return Array.from(map.entries());
  }, [visible]);

  const saveDraft = () => {
    if (!draft || !draft.name.trim()) return;
    const min = draft.minQuantity.trim() === '' ? undefined : Math.max(0, Number(draft.minQuantity.replace(',', '.')));
    const now = Date.now();
    const restockList = savePantryWithRules({
      id: draft.id,
      name: draft.name.trim(),
      emoji: draft.emoji || getCategory(draft.category).emoji,
      category: draft.category,
      unit: draft.unit,
      quantity: draft.quantity,
      minQuantity: Number.isFinite(min) ? min : undefined,
      location: draft.location,
      expiryDate: draft.expiryDate || undefined,
      barcode: draft.barcode.trim() || undefined,
      catalogId: draft.catalogId,
      notes: draft.notes.trim() || undefined,
      createdAt: draft.createdAt,
      restockListId: draft.restockListId || undefined,
      updatedAt: now,
      createdBy: user?.id,
    }, user?.id);
    if (draft.inboxId) mockDb.deleteUnknownBarcode(draft.inboxId);
    if (restockList) setToast(`${draft.name.trim()} → ${restockList.name} (Mindestbestand)`);
    setDraft(null);
    setConfirmDelete(false);
  };

  const changeQty = (p: PantryItem, value: number) => {
    const { restockList } = changeStock(p.id, value - p.quantity, { userId: user?.id });
    if (restockList) setToast(`${p.name} → ${restockList.name} (Mindestbestand)`);
  };

  const createFromInbox = (entry: UnknownBarcode) => {
    const base = draftCustom(entry.name || '');
    setDraft({ ...base, barcode: entry.barcode, quantity: entry.pendingQty > 0 ? entry.pendingQty : 1, inboxId: entry.id });
    setTab('bestand');
  };

  const removeDraft = () => {
    if (!draft) return;
    mockDb.deletePantryItem(draft.id);
    setDraft(null);
    setConfirmDelete(false);
  };

  const addToList = (p: PantryItem) => {
    const list = ensureDefaultList();
    addPantryItemToList(list.id, p, user?.id);
    setToast(`${p.name} → ${list.name}`);
  };

  const setField = (patch: Partial<Draft>) => setDraft(d => (d ? { ...d, ...patch } : d));
  // Stabile Callbacks: BarcodeScanner startet die Kamera bei jeder neuen onScan-Referenz neu.
  const onScanned = useCallback((code: string) => {
    setDraft(d => (d ? { ...d, barcode: code } : d));
    setScanning(false);
  }, []);
  const closeScanner = useCallback(() => setScanning(false), []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Refrigerator size={24} /> Vorrat
        </h1>
        <button
          onClick={() => setPicking(true)} className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}
        >
          <Plus size={16} /> Artikel
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto' }}>
        <button style={chipStyle(tab === 'bestand')} onClick={() => setTab('bestand')}>Bestand</button>
        <button style={chipStyle(tab === 'verlauf')} onClick={() => setTab('verlauf')}>Verlauf</button>
        <button style={chipStyle(tab === 'neu')} onClick={() => setTab('neu')}>
          Neu gescannt{unknownCount > 0 ? ` (${unknownCount})` : ''}
        </button>
      </div>

      {tab === 'verlauf' && <PantryHistory />}
      {tab === 'neu' && <UnknownBarcodes userId={user?.id} onCreate={createFromInbox} onNotify={setToast} />}

      {tab === 'bestand' && (
        <>
      {/* Kennzahlen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
        {[
          { label: 'Artikel', value: items.length, color: 'var(--color-primary)', onClick: () => setFilter('alle') },
          { label: 'Wenig / leer', value: lowCount, color: lowCount ? 'var(--color-danger)' : 'var(--color-text-muted)', onClick: () => setFilter('wenig') },
          { label: 'MHD bald', value: expiringCount, color: expiringCount ? '#d97706' : 'var(--color-text-muted)', onClick: () => setFilter('mhd') },
        ].map(s => (
          <button
            key={s.label} onClick={s.onClick} className="glass-panel"
            style={{ padding: '0.7rem', textAlign: 'center', cursor: 'pointer', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          >
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{s.label}</div>
          </button>
        ))}
      </div>

      {/* Suche + Filter */}
      <div style={{ position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
        <input
          className="input-field" placeholder="Vorrat durchsuchen (Name oder Barcode)…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ width: '100%', paddingLeft: '2.1rem', fontSize: 'var(--font-sm)' }}
        />
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
        <button style={chipStyle(filter === 'alle')} onClick={() => setFilter('alle')}>Alle</button>
        {STORAGE_LOCATIONS.map(l => (
          <button key={l.id} style={chipStyle(filter === l.id)} onClick={() => setFilter(l.id)}>{l.emoji} {l.label}</button>
        ))}
        <button style={chipStyle(filter === 'wenig')} onClick={() => setFilter('wenig')}>⚠️ Wenig</button>
        <button style={chipStyle(filter === 'mhd')} onClick={() => setFilter('mhd')}>⏳ MHD bald</button>
      </div>

      {/* Liste */}
      {items.length === 0 ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '2.5rem' }}>🧺</span>
          <div style={{ fontWeight: 700 }}>Noch nichts im Vorrat</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', maxWidth: '28rem' }}>
            Lege Artikel aus dem Katalog an oder hake sie später auf der Einkaufsliste ab – dann landen sie automatisch hier.
          </div>
          <button onClick={() => setPicking(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Plus size={16} /> Ersten Artikel anlegen
          </button>
        </div>
      ) : groups.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Keine Treffer.</p>
      ) : (
        groups.map(([categoryId, list]) => {
          const cat = getCategory(categoryId);
          return (
            <div key={categoryId} className="glass-panel" style={{ padding: '0.9rem 1rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {cat.emoji} {cat.label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {list.map(p => {
                  const low = isLowStock(p) || p.quantity === 0;
                  const days = daysUntilExpiry(p);
                  const expired = days !== null && days < 0;
                  const soon = isExpiringSoon(p);
                  return (
                    <div
                      key={p.id}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0', borderTop: '1px solid var(--color-border)' }}
                    >
                      <button
                        onClick={() => { setDraft(toDraft(p)); setConfirmDelete(false); }}
                        style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--color-text)', padding: 0 }}
                      >
                        <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>{p.emoji}</span>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'block', fontWeight: 700, fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                          <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', fontSize: '0.7rem', color: 'var(--color-text-muted)', alignItems: 'center' }}>
                            <span>{getLocation(p.location).emoji} {getLocation(p.location).label}</span>
                            {low && (
                              <span style={{ color: 'var(--color-danger)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
                                <TriangleAlert size={11} /> {p.quantity === 0 ? 'leer' : 'wenig'}
                              </span>
                            )}
                            {p.expiryDate && (
                              <span style={{ color: expired ? 'var(--color-danger)' : soon ? '#d97706' : undefined, fontWeight: expired || soon ? 700 : 500, display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
                                <Clock size={11} /> {expired ? 'abgelaufen' : `MHD ${formatDate(p.expiryDate)}`}
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                      {low && (
                        <button
                          onClick={() => addToList(p)} title="Auf die Einkaufsliste setzen" aria-label="Auf die Einkaufsliste setzen"
                          style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-primary)', flexShrink: 0 }}
                        >
                          <ShoppingCart size={15} />
                        </button>
                      )}
                      <QtyStepper value={p.quantity} unit={p.unit} onChange={v => changeQty(p, v)} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

        </>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)', zIndex: 10000,
          padding: '0.6rem 1rem', borderRadius: '20px', background: 'var(--color-text)', color: 'var(--color-surface)',
          fontSize: '0.85rem', fontWeight: 600, boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
        }}>
          🛒 {toast}
        </div>
      )}

      {picking && (
        <FoodPicker
          title="Artikel zum Vorrat hinzufügen"
          onClose={() => setPicking(false)}
          onPick={c => {
            const existing = items.find(p => p.catalogId === c.id || p.name.toLowerCase() === c.name.toLowerCase());
            setPicking(false);
            setDraft(existing ? toDraft(existing) : draftFromCatalog(c));
          }}
          onCustom={name => { setPicking(false); setDraft(draftCustom(name)); }}
        />
      )}

      {draft && (
        <Modal title={draft.isNew ? 'Neuer Artikel' : 'Artikel bearbeiten'} onClose={() => { setDraft(null); setConfirmDelete(false); }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <div style={{ width: '4.2rem' }}>
                <label style={fieldLabelStyle}>Icon</label>
                <input
                  className="input-field" value={draft.emoji} maxLength={4}
                  onChange={e => setField({ emoji: e.target.value })}
                  style={{ width: '100%', textAlign: 'center', fontSize: '1.4rem', padding: '0.3rem' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={fieldLabelStyle}>Name</label>
                <input
                  className="input-field" value={draft.name} autoFocus={draft.isNew}
                  onChange={e => setField({ name: e.target.value })} style={{ width: '100%', fontSize: 'var(--font-sm)' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <label style={fieldLabelStyle}>Bestand</label>
                <QtyStepper value={draft.quantity} onChange={v => setField({ quantity: v })} />
              </div>
              <div style={{ flex: 1, minWidth: '6rem' }}>
                <label style={fieldLabelStyle}>Einheit</label>
                <select className="input-field" value={draft.unit} onChange={e => setField({ unit: e.target.value })} style={{ width: '100%', fontSize: 'var(--font-sm)' }}>
                  {FOOD_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <div style={{ flex: 1 }}>
                <label style={fieldLabelStyle}>Kategorie</label>
                <select className="input-field" value={draft.category} onChange={e => setField({ category: e.target.value })} style={{ width: '100%', fontSize: 'var(--font-sm)' }}>
                  {FOOD_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={fieldLabelStyle}>Lagerort</label>
                <select className="input-field" value={draft.location} onChange={e => setField({ location: e.target.value })} style={{ width: '100%', fontSize: 'var(--font-sm)' }}>
                  {STORAGE_LOCATIONS.map(l => <option key={l.id} value={l.id}>{l.emoji} {l.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <div style={{ flex: 1 }}>
                <label style={fieldLabelStyle}>Mindestbestand (löst Nachkauf aus)</label>
                <input
                  type="number" min={0} className="input-field" placeholder="z. B. 2" value={draft.minQuantity}
                  onChange={e => setField({ minQuantity: e.target.value })} style={{ width: '100%', fontSize: 'var(--font-sm)' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={fieldLabelStyle}>MHD (optional)</label>
                <input
                  type="date" className="input-field" value={draft.expiryDate}
                  onChange={e => setField({ expiryDate: e.target.value })} style={{ width: '100%', fontSize: 'var(--font-sm)' }}
                />
              </div>
            </div>

            {draft.minQuantity.trim() !== '' && lists.length > 1 && (
              <div>
                <label style={fieldLabelStyle}>Bei Unterschreiten auf Liste</label>
                <select
                  className="input-field" value={draft.restockListId || ''}
                  onChange={e => setField({ restockListId: e.target.value || undefined })} style={{ width: '100%', fontSize: 'var(--font-sm)' }}
                >
                  <option value="">{lists[0].emoji} {lists[0].name} (Standard)</option>
                  {lists.slice(1).map(l => <option key={l.id} value={l.id}>{l.emoji} {l.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label style={fieldLabelStyle}>Barcode (optional)</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  className="input-field" inputMode="numeric" placeholder="EAN, z. B. vom Küchenscanner" value={draft.barcode}
                  onChange={e => setField({ barcode: e.target.value.replace(/\s/g, '') })} style={{ flex: 1, fontSize: 'var(--font-sm)' }}
                />
                <button type="button" onClick={() => setScanning(true)} className="btn btn-secondary" aria-label="Barcode scannen" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <ScanBarcode size={16} /> Scannen
                </button>
              </div>
            </div>

            <div>
              <label style={fieldLabelStyle}>Notiz (optional)</label>
              <input className="input-field" value={draft.notes} onChange={e => setField({ notes: e.target.value })} style={{ width: '100%', fontSize: 'var(--font-sm)' }} />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', marginTop: '0.25rem', flexWrap: 'wrap' }}>
              {!draft.isNew ? (
                confirmDelete ? (
                  <button onClick={removeDraft} className="btn" style={{ background: 'var(--color-danger)', color: 'white', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Trash2 size={15} /> Wirklich löschen
                  </button>
                ) : (
                  <button onClick={() => setConfirmDelete(true)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--color-danger)' }}>
                    <Trash2 size={15} /> Löschen
                  </button>
                )
              ) : <span />}
              <button onClick={saveDraft} disabled={!draft.name.trim()} className="btn btn-primary">
                {draft.isNew ? `Hinzufügen (${formatQty(draft.quantity)} ${draft.unit})` : 'Speichern'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {scanning && (
        <BarcodeScanner onScan={onScanned} onClose={closeScanner} />
      )}
    </div>
  );
};
