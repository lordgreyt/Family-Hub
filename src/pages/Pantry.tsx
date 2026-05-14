import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { mockDb } from '../services/mockDb';
import { lookupBarcode, type ProductInfo } from '../services/openFoodFacts';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { getNeonColor, getNeonCardStyle } from '../utils/neon';
import type { PantryItem, ShoppingItem } from '../services/mockDb';
import {
  Package, ShoppingCart, Plus, X, Save, Search,
  Trash2, Edit3, Check, AlertTriangle, ChevronDown, ChevronUp,
  Loader2, Barcode
} from 'lucide-react';

const PANTRY_CATEGORIES = [
  'Obst & Gemüse', 'Milchprodukte', 'Fleisch & Fisch', 'Backwaren',
  'Nudeln & Reis', 'Gewürze & Saucen', 'Süßwaren', 'Getränke',
  'Konserven', 'Tiefkühl', 'Sonstiges',
];

const COMMON_EMOJIS: Record<string, string> = {
  'Obst & Gemüse': '🥕',
  'Milchprodukte': '🥛',
  'Fleisch & Fisch': '🍗',
  'Backwaren': '🍞',
  'Nudeln & Reis': '🍝',
  'Gewürze & Saucen': '🫙',
  'Süßwaren': '🍫',
  'Getränke': '🧃',
  'Konserven': '🥫',
  'Tiefkühl': '❄️',
  'Sonstiges': '📦',
};

const UNITS = ['Stück', 'Packung', 'g', 'kg', 'ml', 'l', 'Dose', 'Flasche', 'Beutel'];

// --- Add/Edit Modal ---
interface ItemFormData {
  name: string;
  emoji: string;
  quantity: number;
  minQuantity: number;
  unit: string;
  category: string;
  expiryDate: string;
  notes: string;
  barcode: string;
}

const emptyForm: ItemFormData = {
  name: '', emoji: '📦', quantity: 1, minQuantity: 1,
  unit: 'Stück', category: 'Sonstiges', expiryDate: '', notes: '', barcode: '',
};

interface EditModalProps {
  form: ItemFormData;
  onChange: (f: ItemFormData) => void;
  onSave: () => void;
  onClose: () => void;
  title: string;
}

const EditModal = ({ form, onChange, onSave, onClose, title }: EditModalProps) => {
  const [showMore, setShowMore] = useState(false);
  const update = (patch: Partial<ItemFormData>) => onChange({ ...form, ...patch });

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
    }}>
      <div className="glass-panel" style={{
        maxWidth: '420px', width: '100%', padding: '1.25rem',
        borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)',
        maxHeight: '85vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Name + Emoji */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-surface-hover)', border: '1px solid var(--color-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem',
              cursor: 'pointer', flexShrink: 0,
            }} onClick={() => {
              const e = prompt('Emoji:', form.emoji);
              if (e) update({ emoji: e });
            }}>
              {form.emoji}
            </div>
            <input
              type="text" placeholder="Produktname" className="input-field"
              value={form.name} onChange={e => update({ name: e.target.value })}
              style={{ flex: 1, fontSize: 'var(--font-sm)' }}
              autoFocus
            />
          </div>

          {/* Quantity + Unit */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem', display: 'block' }}>Menge</label>
              <input
                type="number" className="input-field" min={0}
                value={form.quantity} onChange={e => update({ quantity: parseInt(e.target.value) || 0 })}
                style={{ width: '100%', fontSize: 'var(--font-sm)' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem', display: 'block' }}>Einheit</label>
              <select
                className="input-field"
                value={form.unit} onChange={e => update({ unit: e.target.value })}
                style={{ width: '100%', fontSize: 'var(--font-sm)' }}
              >
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* Category */}
          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem', display: 'block' }}>Kategorie</label>
            <select
              className="input-field"
              value={form.category} onChange={e => {
                const cat = e.target.value;
                update({ category: cat, emoji: COMMON_EMOJIS[cat] || '📦' });
              }}
              style={{ width: '100%', fontSize: 'var(--font-sm)' }}
            >
              {PANTRY_CATEGORIES.map(c => <option key={c} value={c}>{COMMON_EMOJIS[c]} {c}</option>)}
            </select>
          </div>

          {/* Show more toggle */}
          <button
            type="button"
            onClick={() => setShowMore(!showMore)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-text-muted)', fontSize: '0.8rem',
              display: 'flex', alignItems: 'center', gap: '0.3rem', padding: 0,
            }}
          >
            {showMore ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Details {showMore ? 'ausblenden' : 'einblenden'}
          </button>

          {showMore && (
            <>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem', display: 'block' }}>Mindestbestand</label>
                <input
                  type="number" className="input-field" min={0}
                  value={form.minQuantity} onChange={e => update({ minQuantity: parseInt(e.target.value) || 0 })}
                  style={{ width: '100%', fontSize: 'var(--font-sm)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem', display: 'block' }}>MHD / Ablaufdatum</label>
                <input
                  type="date" className="input-field"
                  value={form.expiryDate} onChange={e => update({ expiryDate: e.target.value })}
                  style={{ width: '100%', fontSize: 'var(--font-sm)', color: form.expiryDate ? 'var(--color-text)' : 'var(--color-text-muted)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem', display: 'block' }}>Barcode</label>
                <input
                  type="text" className="input-field" placeholder="EAN-13 Nummer"
                  value={form.barcode} onChange={e => update({ barcode: e.target.value })}
                  style={{ width: '100%', fontSize: 'var(--font-sm)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem', display: 'block' }}>Notizen</label>
                <input
                  type="text" className="input-field" placeholder="Notizen..."
                  value={form.notes} onChange={e => update({ notes: e.target.value })}
                  style={{ width: '100%', fontSize: 'var(--font-sm)' }}
                />
              </div>
            </>
          )}

          <button
            onClick={onSave}
            className="btn btn-primary"
            disabled={!form.name.trim() || form.quantity <= 0}
            style={{ padding: '0.6rem', marginTop: '0.25rem', display: 'flex', justifyContent: 'center', gap: '0.4rem', width: '100%' }}
          >
            <Save size={18} /> Speichern
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Expiry Badge ---
const expiryBadge = (dateStr: string) => {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  const diff = Math.ceil((d.getTime() - now.getTime()) / (86400000));

  if (diff < 0) return { label: 'Abgelaufen', color: 'var(--color-danger)', bg: 'rgba(239,68,68,0.1)' };
  if (diff === 0) return { label: 'Heute', color: 'var(--color-orange)', bg: 'rgba(245,158,11,0.1)' };
  if (diff <= 3) return { label: `${diff} Tage`, color: 'var(--color-orange)', bg: 'rgba(245,158,11,0.1)' };
  if (diff <= 7) return { label: `${diff} Tage`, color: '#ca8a04', bg: 'rgba(250,204,21,0.08)' };
  return null;
};

// --- Main Page ---
export const Pantry = () => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState<'PANTRY' | 'SHOPPING'>('PANTRY');
  const [items, setItems] = useState<PantryItem[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<ProductInfo | null>(null);
  const [notFoundBarcode, setNotFoundBarcode] = useState<string>('');

  // Edit state
  const [editForm, setEditForm] = useState<ItemFormData>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Shopping edit state
  const [shopForm, setShopForm] = useState({ name: '', emoji: '🛒', quantity: 1, unit: 'Stück', category: 'Sonstiges', notes: '' });

  // Search/filter
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    const load = () => {
      setItems(mockDb.getPantryItems());
      setShoppingItems(mockDb.getShoppingItems());
      setDataLoaded(true);
    };
    load();
    window.addEventListener('db_updated', load);
    return () => window.removeEventListener('db_updated', load);
  }, [user]);

  const isNeon = settings.designMode === 'neon';

  // --- Pantry mutations ---
  const handleAddPantry = () => {
    if (!user || !editForm.name.trim()) return;
    mockDb.addPantryItem({
      name: editForm.name.trim(),
      emoji: editForm.emoji,
      quantity: editForm.quantity,
      minQuantity: editForm.minQuantity,
      unit: editForm.unit,
      category: editForm.category,
      expiryDate: editForm.expiryDate || undefined,
      barcode: editForm.barcode || undefined,
      notes: editForm.notes || undefined,
      createdBy: user.id,
    });
    setShowEditModal(false);
    setEditForm(emptyForm);
    setEditingId(null);
  };

  const handleEditPantry = (item: PantryItem) => {
    setEditForm({
      name: item.name, emoji: item.emoji, quantity: item.quantity,
      minQuantity: item.minQuantity, unit: item.unit, category: item.category,
      expiryDate: item.expiryDate || '', notes: item.notes || '', barcode: item.barcode || '',
    });
    setEditingId(item.id);
    setShowEditModal(true);
  };

  const handleSaveEdit = () => {
    if (!editingId || !editForm.name.trim()) return;
    const existing = items.find(i => i.id === editingId);
    if (!existing) return;
    mockDb.updatePantryItem({
      ...existing,
      name: editForm.name.trim(),
      emoji: editForm.emoji,
      quantity: editForm.quantity,
      minQuantity: editForm.minQuantity,
      unit: editForm.unit,
      category: editForm.category,
      expiryDate: editForm.expiryDate || undefined,
      barcode: editForm.barcode || undefined,
      notes: editForm.notes || undefined,
    });
    setShowEditModal(false);
    setEditForm(emptyForm);
    setEditingId(null);
  };

  const handleDeletePantry = (id: string) => {
    mockDb.deletePantryItem(id);
  };

  // --- Shopping mutations ---
  const handleAddShopping = () => {
    if (!user || !shopForm.name.trim()) return;
    mockDb.addShoppingItem({
      name: shopForm.name.trim(),
      emoji: shopForm.emoji,
      quantity: shopForm.quantity,
      unit: shopForm.unit,
      category: shopForm.category,
      notes: shopForm.notes || undefined,
      createdBy: user.id,
    });
    setShopForm({ name: '', emoji: '🛒', quantity: 1, unit: 'Stück', category: 'Sonstiges', notes: '' });
  };

  const handleToggleShopping = (id: string) => {
    mockDb.toggleShoppingItem(id);
  };

  const handleDeleteShopping = (id: string) => {
    mockDb.deleteShoppingItem(id);
  };

  const handleClearCompleted = () => {
    mockDb.deleteCompletedShoppingItems();
  };

  // Auto-populate shopping list from low-stock pantry items
  const handleAutoFillShopping = () => {
    if (!user) return;
    const lowStock = items.filter(i => i.quantity < i.minQuantity);
    const existingNames = new Set(shoppingItems.filter(s => !s.isDone).map(s => s.name.toLowerCase()));
    lowStock.forEach(item => {
      if (!existingNames.has(item.name.toLowerCase())) {
        mockDb.addShoppingItem({
          name: item.name,
          emoji: item.emoji,
          quantity: item.minQuantity - item.quantity,
          unit: item.unit,
          category: item.category,
          notes: `Auto: Bestand ${item.quantity}/${item.minQuantity} ${item.unit}`,
          createdBy: user.id,
        });
      }
    });
  };

  // --- Barcode handling ---
  const handleBarcodeScan = async (barcode: string) => {
    setShowScanner(false);
    setScanning(true);
    setScannedProduct(null);
    setNotFoundBarcode('');

    // Check if already in pantry
    const existing = items.find(i => i.barcode === barcode);
    if (existing) {
      mockDb.updatePantryItem({ ...existing, quantity: existing.quantity + 1 });
      setScanning(false);
      return;
    }

    const product = await lookupBarcode(barcode);
    setScanning(false);

    if (product) {
      setScannedProduct(product);
      setEditForm({
        name: product.name, emoji: product.emoji, quantity: 1, minQuantity: 1,
        unit: 'Stück', category: product.category, expiryDate: '', notes: '', barcode: product.barcode,
      });
      setEditingId(null);
      setShowEditModal(true);
    } else {
      // Product not found in database — show notice with option to add manually
      setNotFoundBarcode(barcode);
    }
  };

  // --- Filtered items ---
  const filteredItems = useMemo(() => {
    let result = items;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(i => i.name.toLowerCase().includes(q) || i.barcode?.includes(q));
    }
    if (categoryFilter) result = result.filter(i => i.category === categoryFilter);
    return result.sort((a, b) => {
      // Low stock first
      const aLow = a.quantity < a.minQuantity ? 1 : 0;
      const bLow = b.quantity < b.minQuantity ? 1 : 0;
      if (aLow !== bLow) return bLow - aLow;
      // Then by expiry (closest first)
      if (a.expiryDate && b.expiryDate) return a.expiryDate.localeCompare(b.expiryDate);
      if (a.expiryDate) return -1;
      if (b.expiryDate) return 1;
      return b.createdAt - a.createdAt;
    });
  }, [items, search, categoryFilter]);

  const openItems = useMemo(() => shoppingItems.filter(s => !s.isDone), [shoppingItems]);
  const doneItems = useMemo(() => shoppingItems.filter(s => s.isDone), [shoppingItems]);

  if (!user || !dataLoaded) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--color-surface)', padding: '0.5rem', borderRadius: 'var(--radius-lg)' }}>
        <button
          className={`btn ${activeTab === 'PANTRY' ? 'btn-primary' : ''}`}
          style={{ flex: 1, backgroundColor: activeTab !== 'PANTRY' ? 'transparent' : undefined, color: activeTab !== 'PANTRY' ? 'var(--color-text)' : undefined, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
          onClick={() => setActiveTab('PANTRY')}
        >
          <Package size={18} /> Vorratsschrank
        </button>
        <button
          className={`btn ${activeTab === 'SHOPPING' ? 'btn-primary' : ''}`}
          style={{ flex: 1, backgroundColor: activeTab !== 'SHOPPING' ? 'transparent' : undefined, color: activeTab !== 'SHOPPING' ? 'var(--color-text)' : undefined, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
          onClick={() => setActiveTab('SHOPPING')}
        >
          <ShoppingCart size={18} /> Einkaufsliste
          {openItems.length > 0 && <span style={{
            background: 'var(--color-danger)', color: 'white', borderRadius: '50%',
            minWidth: '18px', height: '18px', fontSize: '0.65rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
          }}>{openItems.length}</span>}
        </button>
      </div>

      {/* === VORRATSSCHRANK === */}
      {activeTab === 'PANTRY' && (
        <>
          {/* Top bar: search + scanner + add */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                type="text" className="input-field" placeholder="Suchen..." value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: '2rem', fontSize: 'var(--font-sm)', width: '100%' }}
              />
            </div>
            <button
              className="btn"
              onClick={() => setShowScanner(true)}
              style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
            >
              <Barcode size={16} /> Scan
            </button>
            <button
              className="btn btn-primary"
              onClick={() => { setEditForm(emptyForm); setEditingId(null); setShowEditModal(true); }}
              style={{ padding: '0.5rem 0.75rem' }}
            >
              <Plus size={18} />
            </button>
          </div>

          {/* Category filter chips */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {PANTRY_CATEGORIES.map(cat => {
              const active = categoryFilter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(active ? '' : cat)}
                  className="btn"
                  style={{
                    padding: '0.3rem 0.6rem', fontSize: '0.7rem', borderRadius: '20px',
                    border: '1px solid', borderColor: active ? 'var(--color-primary)' : 'var(--color-border)',
                    backgroundColor: active ? 'var(--color-primary-light)' : 'var(--color-surface)',
                    color: active ? 'white' : 'var(--color-text-muted)', fontWeight: 600,
                  }}
                >
                  {COMMON_EMOJIS[cat]} {cat}
                </button>
              );
            })}
          </div>

          {/* Item grid */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {filteredItems.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: '2rem' }}>
                {items.length === 0
                  ? 'Noch keine Produkte im Vorratsschrank. Füge welche hinzu oder scanne einen Barcode.'
                  : 'Keine Treffer für diesen Filter.'}
              </p>
            ) : (
              filteredItems.map(item => {
                const isLow = item.quantity < item.minQuantity;
                const expBadge = item.expiryDate ? expiryBadge(item.expiryDate) : null;
                const ncs = isNeon ? getNeonCardStyle(item.id) : undefined;
                const nColor = isNeon ? getNeonColor(item.id) : null;

                return (
                  <div key={item.id} className="glass-panel" style={{
                    padding: '0.75rem', borderRadius: 'var(--radius-md)',
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    ...(isNeon && ncs ? {
                      backgroundImage: ncs.backgroundImage,
                      backgroundOrigin: ncs.backgroundOrigin as any,
                      backgroundClip: ncs.backgroundClip,
                      border: ncs.border,
                      boxShadow: ncs.boxShadow,
                    } : {}),
                    ...(isLow ? {
                      borderLeft: isNeon ? ncs?.border : '3px solid var(--color-orange)',
                      backgroundColor: isNeon ? undefined : 'rgba(245,158,11,0.05)',
                    } : {}),
                  }}>
                    {/* Emoji */}
                    <span style={{
                      fontSize: '1.75rem', width: '44px', height: '44px',
                      borderRadius: 'var(--radius-md)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      backgroundColor: 'var(--color-surface-hover)', flexShrink: 0,
                    }}>
                      {item.emoji}
                    </span>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 'var(--font-sm)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {item.name}
                        {isLow && <AlertTriangle size={14} style={{ color: 'var(--color-orange)', flexShrink: 0 }} />}
                      </div>
                      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        <span style={{
                          color: isLow ? 'var(--color-orange)' : undefined,
                          fontWeight: isLow ? 700 : undefined,
                        }}>
                          {item.quantity} {item.unit}
                          {item.minQuantity > 0 && ` (Min: ${item.minQuantity})`}
                        </span>
                        {item.category && <span>· {item.category}</span>}
                        {expBadge && (
                          <span style={{ color: expBadge.color, backgroundColor: expBadge.bg, padding: '0.1rem 0.4rem', borderRadius: '10px', fontWeight: 600 }}>
                            {expBadge.label}
                          </span>
                        )}
                      </div>
                      {item.notes && <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{item.notes}</div>}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flexShrink: 0 }}>
                      <button
                        onClick={() => handleEditPantry(item)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', padding: '0.2rem' }}
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        onClick={() => handleDeletePantry(item.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '0.2rem' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* === EINKAUFSLISTE === */}
      {activeTab === 'SHOPPING' && (
        <>
          {/* Quick-add form */}
          <form
            onSubmit={e => { e.preventDefault(); handleAddShopping(); }}
            className="glass-panel"
            style={{ padding: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
          >
            <input
              type="text" className="input-field" placeholder="Produktname..."
              value={shopForm.name} onChange={e => setShopForm({ ...shopForm, name: e.target.value })}
              style={{ flex: 1, fontSize: 'var(--font-sm)' }}
            />
            <input
              type="number" className="input-field" min={1}
              value={shopForm.quantity} onChange={e => setShopForm({ ...shopForm, quantity: parseInt(e.target.value) || 1 })}
              style={{ width: '50px', fontSize: 'var(--font-sm)', textAlign: 'center' }}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem' }} disabled={!shopForm.name.trim()}>
              <Plus size={18} />
            </button>
          </form>

          {/* Action row */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn btn-secondary"
              onClick={handleAutoFillShopping}
              style={{ flex: 1, fontSize: '0.75rem', padding: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
            >
              <Package size={14} /> Aus Vorrat auffüllen
            </button>
            {doneItems.length > 0 && (
              <button
                className="btn btn-secondary"
                onClick={handleClearCompleted}
                style={{ fontSize: '0.75rem', padding: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
              >
                <Trash2 size={14} /> Erledigte löschen
              </button>
            )}
          </div>

          {/* Shopping list */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {shoppingItems.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: '2rem' }}>
                Einkaufsliste ist leer. Füge Produkte hinzu oder fülle automatisch aus dem Vorratsschrank auf.
              </p>
            ) : (
              <>
                {/* Open items */}
                {openItems.map(item => (
                  <div key={item.id} className="glass-panel" style={{
                    padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-md)',
                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                  }}>
                    <button
                      onClick={() => handleToggleShopping(item.id)}
                      style={{
                        width: '24px', height: '24px', borderRadius: '6px',
                        border: '2px solid var(--color-border)',
                        backgroundColor: 'transparent', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, padding: 0,
                      }}
                    />
                    <span style={{ fontSize: '1.2rem' }}>{item.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{item.name}</div>
                      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                        {item.quantity} {item.unit}
                        {item.notes && ` · ${item.notes}`}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteShopping(item.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '0.2rem' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}

                {/* Done items (collapsed, muted) */}
                {doneItems.length > 0 && (
                  <details style={{ marginTop: '0.5rem' }}>
                    <summary style={{
                      cursor: 'pointer', fontSize: '0.75rem', color: 'var(--color-text-muted)',
                      fontWeight: 600, padding: '0.3rem 0',
                    }}>
                      Erledigt ({doneItems.length})
                    </summary>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.4rem' }}>
                      {doneItems.map(item => (
                        <div key={item.id} style={{
                          padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)',
                          display: 'flex', alignItems: 'center', gap: '0.6rem',
                          opacity: 0.5, textDecoration: 'line-through',
                          backgroundColor: 'var(--color-surface-hover)',
                        }}>
                          <button
                            onClick={() => handleToggleShopping(item.id)}
                            style={{
                              width: '24px', height: '24px', borderRadius: '6px',
                              border: '2px solid var(--color-primary)',
                              backgroundColor: 'var(--color-primary)', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0, padding: 0, color: 'white',
                            }}
                          >
                            <Check size={14} />
                          </button>
                          <span style={{ fontSize: '1.2rem' }}>{item.emoji}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{item.name}</div>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                              {item.quantity} {item.unit}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteShopping(item.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '0.2rem' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Scanning overlay */}
      {scanning && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          color: 'white', gap: '1rem',
        }}>
          <Loader2 size={40} style={{ animation: 'spin 1s linear infinite' }} />
          <span>Produkt wird gesucht...</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Scanner */}
      {showScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Edit modal */}
      {showEditModal && (
        <EditModal
          form={editForm}
          onChange={setEditForm}
          onSave={editingId ? handleSaveEdit : handleAddPantry}
          onClose={() => { setShowEditModal(false); setEditingId(null); }}
          title={editingId ? 'Produkt bearbeiten' : 'Neues Produkt'}
        />
      )}

      {/* Product not found notice */}
      {notFoundBarcode && !showScanner && !scanning && (
        <div style={{
          position: 'fixed', bottom: '4rem', left: '1rem', right: '1rem',
          zIndex: 9998, display: 'flex', justifyContent: 'center',
        }}>
          <div className="glass-panel" style={{
            padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            maxWidth: '400px', width: '100%',
          }}>
            <span style={{ fontSize: '1.5rem' }}>🔍</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-sm)' }}>Produkt nicht gefunden</div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                Barcode {notFoundBarcode} nicht in der Datenbank.
              </div>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => {
                setEditForm({ ...emptyForm, barcode: notFoundBarcode });
                setEditingId(null);
                setShowEditModal(true);
                setNotFoundBarcode('');
              }}
              style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
            >
              Manuell anlegen
            </button>
            <button
              onClick={() => setNotFoundBarcode('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '0.2rem' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
