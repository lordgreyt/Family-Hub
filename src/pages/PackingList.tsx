import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { mockDb } from '../services/mockDb';
import type { PackCategory, PackItem, PacklistData } from '../services/mockDb';
import { getNeonColor, getNeonCardStyle } from '../utils/neon';
import { AvatarEmoji } from '../components/AvatarEmoji';
import { Plus, X, Trash2, RotateCcw, Luggage, List, LayoutGrid } from 'lucide-react';

const EMPTY: PacklistData = { categories: [], items: [] };

// ─── Modal für neuen/bearbeiteten Eintrag ───
interface ItemForm {
  text: string;
  categoryId: string;
  quantity: string;
  packedBy: string;
}

interface ItemModalProps {
  form: ItemForm;
  categories: PackCategory[];
  people: { id: string; avatar: string; avatarColor?: string }[];
  isEdit: boolean;
  onChange: (f: ItemForm) => void;
  onSave: (keepOpen: boolean) => void;
  onClose: () => void;
}

const ItemModal = ({ form, categories, people, isEdit, onChange, onSave, onClose }: ItemModalProps) => {
  const update = (patch: Partial<ItemForm>) => onChange({ ...form, ...patch });
  const valid = form.text.trim() && form.categoryId;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
    }}>
      <div className="glass-panel" style={{
        maxWidth: '400px', width: '100%', padding: '1.25rem',
        borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
            {isEdit ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem', display: 'block' }}>Kategorie</label>
            <select
              className="input-field"
              value={form.categoryId}
              onChange={e => update({ categoryId: e.target.value })}
              style={{ width: '100%', fontSize: 'var(--font-sm)' }}
            >
              {categories.length === 0 && <option value="">— zuerst Kategorie anlegen —</option>}
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem', display: 'block' }}>Was muss mit?</label>
            <input
              type="text" className="input-field" placeholder="z.B. Zahnbürsten"
              value={form.text} onChange={e => update({ text: e.target.value })}
              style={{ width: '100%', fontSize: 'var(--font-sm)' }} autoFocus
            />
          </div>

          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem', display: 'block' }}>Menge (optional)</label>
            <input
              type="number" min={1} className="input-field"
              placeholder="z.B. 5"
              value={form.quantity} onChange={e => update({ quantity: e.target.value })}
              style={{ width: '100%', fontSize: 'var(--font-sm)' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem', display: 'block' }}>Wer packt ein? (optional)</label>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => update({ packedBy: '' })}
                className="btn"
                style={{
                  padding: '0.3rem 0.6rem', fontSize: '0.8rem', borderRadius: '20px',
                  border: '1px solid', borderColor: !form.packedBy ? 'var(--color-primary)' : 'var(--color-border)',
                  backgroundColor: !form.packedBy ? 'var(--color-primary-light)' : 'var(--color-surface)',
                  color: !form.packedBy ? 'white' : 'var(--color-text-muted)',
                }}
              >
                Egal
              </button>
              {people.map(p => {
                const active = form.packedBy === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => update({ packedBy: active ? '' : p.id })}
                    className="btn"
                    style={{
                      padding: '0.3rem 0.6rem', fontSize: '0.8rem', borderRadius: '20px',
                      border: '1px solid', borderColor: active ? 'var(--color-primary)' : 'var(--color-border)',
                      backgroundColor: active ? 'var(--color-primary-light)' : 'var(--color-surface)',
                      color: active ? 'white' : 'var(--color-text-muted)',
                      display: 'flex', alignItems: 'center', gap: '4px',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '50%', background: p.avatarColor || '#6366f1', flexShrink: 0, overflow: 'hidden' }}>
                      <AvatarEmoji emoji={p.avatar} size={18} />
                    </span>
                    {p.id}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <button
              type="button"
              onClick={() => onSave(false)}
              className="btn btn-primary"
              disabled={!valid}
              style={{ flex: 1, padding: '0.6rem', display: 'flex', justifyContent: 'center', gap: '0.4rem' }}
            >
              Speichern
            </button>
            {!isEdit && (
              <button
                type="button"
                onClick={() => onSave(true)}
                className="btn btn-primary"
                disabled={!valid}
                style={{ flex: 1, padding: '0.6rem', display: 'flex', justifyContent: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
              >
                <Plus size={14} /> Weiter
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Kategorie-Modal ───
interface CategoryModalProps {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onClose: () => void;
}

const CategoryModal = ({ value, onChange, onSave, onClose }: CategoryModalProps) => (
  <div style={{
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1rem', backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
  }}>
    <div className="glass-panel" style={{
      maxWidth: '360px', width: '100%', padding: '1.25rem',
      borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Neue Kategorie</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
          <X size={20} />
        </button>
      </div>
      <input
        type="text" className="input-field" placeholder="z.B. Hygiene"
        value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', fontSize: 'var(--font-sm)', marginBottom: '1rem' }} autoFocus
        onKeyDown={e => { if (e.key === 'Enter' && value.trim()) onSave(); }}
      />
      <button
        type="button"
        onClick={onSave}
        className="btn btn-primary"
        disabled={!value.trim()}
        style={{ width: '100%', padding: '0.6rem', display: 'flex', justifyContent: 'center', gap: '0.4rem' }}
      >
        <Plus size={16} /> Kategorie anlegen
      </button>
    </div>
  </div>
);

// ─── Hauptseite ───
export const PackingList = () => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [data, setData] = useState<PacklistData>(EMPTY);
  const [users, setUsers] = useState<{ id: string; avatar: string; avatarColor?: string }[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [showItemModal, setShowItemModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>({ text: '', categoryId: '', quantity: '', packedBy: '' });

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryName, setCategoryName] = useState('');

  // Reset-Bestätigung
  const [confirmReset, setConfirmReset] = useState(false);
  const [compactView, setCompactView] = useState(false);

  useEffect(() => {
    if (!user || user.isChild) return;
    const load = () => {
      setData(mockDb.getPacklist());
      setUsers(mockDb.getUsers()
        .filter(u => !u.isChild)
        .map(u => ({
          id: u.id,
          avatar: u.avatar,
          avatarColor: settings.designMode === 'neon' ? (u.avatarColorNeon || getNeonColor(u.id).color) : u.avatarColor,
        })));
      setDataLoaded(true);
    };
    load();
    window.addEventListener('db_updated', load);
    return () => window.removeEventListener('db_updated', load);
  }, [user, settings.designMode]);

  const people = useMemo(() => users, [users]);

  if (!user || user.isChild || !dataLoaded) return null;

  const isNeon = settings.designMode === 'neon';

  // ── Mutationen ──
  const persist = (next: PacklistData) => mockDb.savePacklist(next);

  const addCategory = () => {
    if (!categoryName.trim()) return;
    const cat: PackCategory = { id: crypto.randomUUID(), name: categoryName.trim(), createdAt: Date.now(), createdBy: user.id };
    persist({ ...data, categories: [...data.categories, cat] });
    setCategoryName('');
    setShowCategoryModal(false);
  };

  const deleteCategory = (catId: string, catName: string) => {
    if (!confirm(`Kategorie „${catName}" inkl. aller Einträge löschen?`)) return;
    persist({
      categories: data.categories.filter(c => c.id !== catId),
      items: data.items.filter(i => i.categoryId !== catId),
    });
  };

  const openAddItem = (categoryId: string) => {
    setEditingId(null);
    setItemForm({ text: '', categoryId, quantity: '', packedBy: '' });
    setShowItemModal(true);
  };

  const openEditItem = (item: PackItem) => {
    setEditingId(item.id);
    setItemForm({
      text: item.text,
      categoryId: item.categoryId,
      quantity: item.quantity ? String(item.quantity) : '',
      packedBy: item.packedBy || '',
    });
    setShowItemModal(true);
  };

  const saveItem = (keepOpen = false) => {
    if (!itemForm.text.trim() || !itemForm.categoryId) return;
    const qty = itemForm.quantity.trim();
    const quantity = qty ? Math.max(1, parseInt(qty) || 1) : undefined;

    if (editingId) {
      const existing = data.items.find(i => i.id === editingId);
      if (!existing) return;
      persist({
        ...data,
        items: data.items.map(i => i.id === editingId ? {
          ...existing,
          text: itemForm.text.trim(),
          categoryId: itemForm.categoryId,
          quantity,
          packedBy: itemForm.packedBy || undefined,
        } : i),
      });
      setShowItemModal(false);
      setEditingId(null);
    } else {
      const newItem: PackItem = {
        id: crypto.randomUUID(),
        text: itemForm.text.trim(),
        categoryId: itemForm.categoryId,
        quantity,
        isPacked: false,
        packedBy: itemForm.packedBy || undefined,
        createdAt: Date.now(),
        createdBy: user.id,
      };
      persist({ ...data, items: [...data.items, newItem] });
      if (keepOpen) {
        setItemForm(f => ({ ...f, text: '', quantity: '', packedBy: '' }));
      } else {
        setShowItemModal(false);
        setEditingId(null);
      }
    }
  };

  const toggleItem = (item: PackItem) => {
    persist({
      ...data,
      items: data.items.map(i => i.id === item.id ? { ...i, isPacked: !i.isPacked } : i),
    });
  };

  const deleteItem = (id: string) => {
    persist({ ...data, items: data.items.filter(i => i.id !== id) });
  };

  const resetAll = () => {
    if (!confirm('Alle Häkchen zurücksetzen? Die Einträge und Kategorien bleiben erhalten.')) return;
    persist({
      ...data,
      items: data.items.map(i => ({ ...i, isPacked: false, packedBy: undefined })),
    });
    setConfirmReset(false);
  };

  const totalItems = data.items.length;
  const packedCount = data.items.filter(i => i.isPacked).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Luggage size={24} /> Packliste
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {totalItems > 0 && (
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
              {packedCount}/{totalItems}
            </span>
          )}
          <button
            onClick={() => setCompactView(v => !v)}
            className="btn btn-secondary"
            disabled={totalItems === 0}
            style={{ padding: '0.45rem 0.7rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            title={compactView ? 'Zurück zur Kategorien-Ansicht' : 'Alle Einträge als kompakte Liste anzeigen'}
          >
            {compactView ? <LayoutGrid size={15} /> : <List size={15} />} {compactView ? 'Kategorien' : 'Liste'}
          </button>
          <button
            onClick={() => setShowCategoryModal(true)}
            className="btn btn-secondary"
            style={{ padding: '0.45rem 0.7rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
          >
            <Plus size={15} /> Kategorie
          </button>
          <button
            onClick={() => setConfirmReset(true)}
            className="btn btn-secondary"
            disabled={packedCount === 0}
            style={{ padding: '0.45rem 0.7rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
          >
            <RotateCcw size={15} /> Reset
          </button>
        </div>
      </div>

      {confirmReset && (
        <div style={{
          padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-danger)', backgroundColor: 'rgba(220,38,38,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>
            Alle Häkchen zurücksetzen? Einträge & Kategorien bleiben erhalten.
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setConfirmReset(false)} className="btn btn-secondary" style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem' }}>
              Abbrechen
            </button>
            <button onClick={resetAll} className="btn btn-primary" style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem' }}>
              <RotateCcw size={14} /> Zurücksetzen
            </button>
          </div>
        </div>
      )}

      {/* Ansicht: kompakte Gesamtliste ODER Kategorien */}
      {compactView && totalItems > 0 ? (
        <div className="glass-panel" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.6rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <List size={16} /> Alles auf einen Blick
            </h3>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
              {packedCount}/{totalItems}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {[...data.items].sort((a, b) => Number(a.isPacked) - Number(b.isPacked)).map(item => {
              const packer = people.find(p => p.id === item.packedBy);
              return (
                <div
                  key={item.id}
                  onClick={() => openEditItem(item)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.3rem 0.4rem', borderRadius: 'var(--radius-sm)',
                    backgroundColor: item.isPacked ? 'rgba(16,185,129,0.08)' : 'transparent',
                    cursor: 'pointer', userSelect: 'none',
                  }}
                >
                  <button
                    onClick={e => { e.stopPropagation(); toggleItem(item); }}
                    style={{
                      width: '22px', height: '22px', flexShrink: 0,
                      borderRadius: '6px', border: '2px solid',
                      borderColor: item.isPacked ? '#10B981' : 'var(--color-border)',
                      backgroundColor: item.isPacked ? '#10B981' : 'transparent',
                      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', fontSize: '12px', fontWeight: 800,
                    }}
                    title={item.isPacked ? 'Abhaken (nicht eingepackt)' : 'Als eingepackt markieren'}
                  >
                    {item.isPacked ? '✓' : ''}
                  </button>
                  <span style={{
                    flex: 1, minWidth: 0, fontSize: '0.85rem', fontWeight: 600,
                    color: item.isPacked ? 'var(--color-text-muted)' : 'var(--color-text)',
                    textDecoration: item.isPacked ? 'line-through' : 'none',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.text}
                  </span>
                  {item.quantity && item.quantity > 0 && (
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-muted)',
                      backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
                      padding: '0.05rem 0.4rem', borderRadius: '20px', flexShrink: 0, whiteSpace: 'nowrap',
                    }}>
                      ×{item.quantity}
                    </span>
                  )}
                  {packer && (
                    <span
                      title={`${item.packedBy} packt ein`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '3px',
                        fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-muted)',
                        backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
                        padding: '0.05rem 0.4rem 0.05rem 0.1rem', borderRadius: '20px', flexShrink: 0, whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '14px', height: '14px', borderRadius: '50%', background: packer.avatarColor || '#6366f1', overflow: 'hidden' }}>
                        <AvatarEmoji emoji={packer.avatar} size={14} />
                      </span>
                      {item.packedBy}
                    </span>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); deleteItem(item.id); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', opacity: 0.55, display: 'flex', padding: '0.15rem', flexShrink: 0 }}
                    title="Eintrag löschen"
                  >
                    <X size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : data.categories.length === 0 ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <Luggage size={40} style={{ opacity: 0.4 }} />
          <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text)' }}>
            Noch keine Kategorien vorhanden
          </p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            Lege zuerst eine Kategorie an (z.B. Kleidung, Hygiene, Kinder, Elektronik) und fülle sie mit Einträgen.
          </p>
          <button
            onClick={() => setShowCategoryModal(true)}
            className="btn btn-primary"
            style={{ padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus size={16} /> Erste Kategorie anlegen
          </button>
        </div>
      ) : (
        data.categories.map(cat => {
          // Offene Einträge zuerst, abgehakte nach unten (stabile Sortierung behält Einfüge-Reihenfolge)
          const catItems = [...data.items.filter(i => i.categoryId === cat.id)].sort((a, b) => Number(a.isPacked) - Number(b.isPacked));
          const catPacked = catItems.filter(i => i.isPacked).length;
          const done = catItems.length > 0 && catPacked === catItems.length;
          const ncs = isNeon ? getNeonCardStyle(cat.id) : undefined;

          return (
            <div
              key={cat.id}
              className="glass-panel"
              style={{
                padding: '1rem',
                ...(isNeon && ncs ? {
                  backgroundImage: ncs.backgroundImage,
                  backgroundOrigin: ncs.backgroundOrigin as any,
                  backgroundClip: ncs.backgroundClip,
                  border: ncs.border,
                  boxShadow: ncs.boxShadow,
                } : {}),
              }}
            >
              {/* Kategorie-Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cat.name}
                </h3>
                {catItems.length > 0 && (
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '20px',
                    backgroundColor: done ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                    color: done ? '#10B981' : '#D97706',
                  }}>
                    {done ? '✓ komplett' : `${catPacked}/${catItems.length}`}
                  </span>
                )}
                <button
                  onClick={() => openAddItem(cat.id)}
                  className="btn btn-secondary"
                  style={{ padding: '0.35rem 0.55rem', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem' }}
                  title="Eintrag hinzufügen"
                >
                  <Plus size={14} /> Eintrag
                </button>
                <button
                  onClick={() => deleteCategory(cat.id, cat.name)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', opacity: 0.7, display: 'flex', padding: '0.25rem' }}
                  title="Kategorie löschen"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Items */}
              {catItems.length === 0 ? (
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', opacity: 0.6, padding: '0.25rem 0' }}>
                  Keine Einträge — füge den ersten hinzu.
                </span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {catItems.map(item => {
                    const packer = people.find(p => p.id === item.packedBy);
                    return (
                      <div
                        key={item.id}
                        onClick={() => openEditItem(item)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.6rem',
                          padding: '0.45rem 0.6rem',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: item.isPacked ? 'rgba(16,185,129,0.10)' : 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          cursor: 'pointer',
                          userSelect: 'none',
                          transition: 'background 0.15s',
                        }}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={e => { e.stopPropagation(); toggleItem(item); }}
                          style={{
                            width: '26px', height: '26px', flexShrink: 0,
                            borderRadius: '7px', border: '2px solid',
                            borderColor: item.isPacked ? '#10B981' : 'var(--color-border)',
                            backgroundColor: item.isPacked ? '#10B981' : 'transparent',
                            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', fontSize: '14px', fontWeight: 800,
                          }}
                          title={item.isPacked ? 'Abhaken (nicht eingepackt)' : 'Als eingepackt markieren'}
                        >
                          {item.isPacked ? '✓' : ''}
                        </button>

                        {/* Text */}
                        <span style={{
                          flex: 1, minWidth: 0, fontSize: '0.9rem', fontWeight: 600,
                          color: item.isPacked ? 'var(--color-text-muted)' : 'var(--color-text)',
                          textDecoration: item.isPacked ? 'line-through' : 'none',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {item.text}
                        </span>

                        {/* Menge */}
                        {item.quantity && item.quantity > 0 && (
                          <span style={{
                            fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)',
                            backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
                            padding: '0.1rem 0.45rem', borderRadius: '20px', flexShrink: 0,
                          }}>
                            ×{item.quantity}
                          </span>
                        )}

                        {/* Wer */}
                        {packer && (
                          <span
                            title={`${item.packedBy} packt ein`}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '3px',
                              fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)',
                              backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
                              padding: '0.1rem 0.45rem 0.1rem 0.15rem', borderRadius: '20px', flexShrink: 0,
                            }}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', borderRadius: '50%', background: packer.avatarColor || '#6366f1', overflow: 'hidden' }}>
                              <AvatarEmoji emoji={packer.avatar} size={16} />
                            </span>
                            {item.packedBy}
                          </span>
                        )}

                        {/* Löschen */}
                        <button
                          onClick={e => { e.stopPropagation(); deleteItem(item.id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', opacity: 0.55, display: 'flex', padding: '0.2rem', flexShrink: 0 }}
                          title="Eintrag löschen"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Modals */}
      {showItemModal && (
        <ItemModal
          form={itemForm}
          categories={data.categories}
          people={people}
          isEdit={editingId !== null}
          onChange={setItemForm}
          onSave={saveItem}
          onClose={() => { setShowItemModal(false); setEditingId(null); }}
        />
      )}
      {showCategoryModal && (
        <CategoryModal
          value={categoryName}
          onChange={setCategoryName}
          onSave={addCategory}
          onClose={() => { setShowCategoryModal(false); setCategoryName(''); }}
        />
      )}
    </div>
  );
};
