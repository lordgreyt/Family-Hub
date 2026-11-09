import { useEffect, useMemo, useState } from 'react';
import { ShoppingCart, Plus, Check, ChevronDown, ChevronRight, Pencil, Trash2, Refrigerator } from 'lucide-react';
import { mockDb } from '../services/mockDb';
import type { ShoppingItem, ShoppingList, PantryItem } from '../services/mockDb';
import { useAuth } from '../context/AuthContext';
import {
  FOOD_CATEGORIES, FOOD_UNITS, SHOPPING_LIST_PRESETS, categoryOrder, getCategory, guessCatalogItem, searchCatalog,
} from '../data/foodCatalog';
import type { CatalogItem } from '../data/foodCatalog';
import {
  addPantryItemToList, addToShoppingList, checkOffAndStock, findPantryMatch, formatQty, getRestockCandidates, newId,
  restockQuantity, uncheckAndUnstock,
} from '../utils/pantry';
import { Modal } from '../components/Food/Modal';
import { fieldLabelStyle } from '../components/Food/styles';
import { QtyStepper } from '../components/Food/QtyStepper';

const ACTIVE_KEY = 'family_hub_shopping_active_list';

const readActive = (): string => {
  try { return localStorage.getItem(ACTIVE_KEY) || ''; } catch { return ''; }
};

const chipStyle = (active: boolean) => ({
  padding: '0.4rem 0.8rem', fontSize: '0.85rem', borderRadius: '20px', border: '1px solid',
  borderColor: active ? 'var(--color-primary)' : 'var(--color-border)',
  backgroundColor: active ? 'var(--color-primary)' : 'var(--color-surface)',
  color: active ? 'white' : 'var(--color-text)',
  cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 700, flexShrink: 0,
  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
} as const);

// „2 Milch“, „3x Äpfel“ → Menge + Name
const parseEntry = (raw: string): { name: string; quantity: number } => {
  const m = raw.trim().match(/^(\d+(?:[.,]\d+)?)\s*[x×]?\s+(.+)$/i);
  if (m) return { quantity: Number(m[1].replace(',', '.')), name: m[2].trim() };
  return { quantity: 1, name: raw.trim() };
};

export const Shopping = () => {
  const { user } = useAuth();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [activeId, setActiveId] = useState<string>(readActive);
  const [text, setText] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [checking, setChecking] = useState<ShoppingItem | null>(null);
  const [checkQty, setCheckQty] = useState(1);
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [listModal, setListModal] = useState<{ list: ShoppingList | null } | null>(null);
  const [listName, setListName] = useState('');
  const [listEmoji, setListEmoji] = useState('🛒');
  const [confirmListDelete, setConfirmListDelete] = useState(false);

  useEffect(() => {
    const load = () => {
      setLists(mockDb.getShoppingLists());
      setItems(mockDb.getShoppingItems());
      setPantry(mockDb.getPantry());
    };
    load();
    window.addEventListener('db_updated', load);
    return () => window.removeEventListener('db_updated', load);
  }, []);

  const active = lists.find(l => l.id === activeId) || lists[0];
  const selectList = (id: string) => {
    setActiveId(id);
    try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* optional */ }
  };

  const listItems = useMemo(() => (active ? items.filter(i => i.listId === active.id) : []), [items, active]);
  const open = useMemo(
    () => listItems.filter(i => !i.checked).sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category) || a.createdAt - b.createdAt),
    [listItems],
  );
  const done = useMemo(() => listItems.filter(i => i.checked).sort((a, b) => (b.checkedAt || 0) - (a.checkedAt || 0)), [listItems]);
  const groups = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>();
    open.forEach(i => map.set(i.category, [...(map.get(i.category) || []), i]));
    return Array.from(map.entries());
  }, [open]);

  const restock = active ? getRestockCandidates(active.id) : [];

  const suggestions = useMemo<CatalogItem[]>(() => {
    const { name } = parseEntry(text);
    if (name.length < 2) return [];
    return searchCatalog(name, 6).filter(c => !open.some(i => i.name.toLowerCase() === c.name.toLowerCase()));
  }, [text, open]);

  const addEntry = (raw: string, catalog?: CatalogItem) => {
    if (!active || !raw.trim()) return;
    const { name, quantity } = parseEntry(raw);
    if (!name) return;
    const c = catalog || guessCatalogItem(name);
    const stock = findPantryMatch(pantry, { catalogId: c?.id, name });
    addToShoppingList(active.id, {
      name: catalog ? catalog.name : name,
      emoji: c?.emoji, category: c?.category, unit: c?.unit ?? stock?.unit, quantity,
      catalogId: c?.id, pantryId: stock?.id,
    }, user?.id);
    setText('');
  };

  const startCheck = (item: ShoppingItem) => {
    setChecking(item);
    setCheckQty(item.quantity);
  };

  const confirmCheck = (stock: boolean) => {
    if (!checking) return;
    checkOffAndStock(checking, stock ? checkQty : 0, user?.id);
    setChecking(null);
  };

  const openListModal = (list: ShoppingList | null) => {
    setListModal({ list });
    setListName(list?.name || '');
    setListEmoji(list?.emoji || '🛒');
    setConfirmListDelete(false);
  };

  const saveList = () => {
    const name = listName.trim();
    if (!name || !listModal) return;
    const list: ShoppingList = listModal.list
      ? { ...listModal.list, name, emoji: listEmoji || '🛒' }
      : { id: newId(), name, emoji: listEmoji || '🛒', createdAt: Date.now() };
    mockDb.saveShoppingList(list);
    if (!listModal.list) selectList(list.id);
    setListModal(null);
  };

  const deleteList = () => {
    if (!listModal?.list) return;
    const id = listModal.list.id;
    mockDb.deleteShoppingList(id);
    if (activeId === id) selectList('');
    setListModal(null);
  };

  const saveEdit = () => {
    if (!editing || !editing.name.trim()) return;
    mockDb.saveShoppingItem({ ...editing, name: editing.name.trim() });
    setEditing(null);
  };

  const stockOf = (item: ShoppingItem) => findPantryMatch(pantry, { pantryId: item.pantryId, catalogId: item.catalogId, name: item.name });

  const unusedPresets = SHOPPING_LIST_PRESETS.filter(p => !lists.some(l => l.name.toLowerCase() === p.name.toLowerCase()));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShoppingCart size={24} /> Einkaufsliste
        </h1>
        {active && (
          <button onClick={() => openListModal(active)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', padding: '0.45rem 0.7rem' }}>
            <Pencil size={14} /> Liste
          </button>
        )}
      </div>

      {/* Listen-Tabs */}
      <div style={{ display: 'flex', gap: '0.45rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
        {lists.map(l => {
          const count = items.filter(i => i.listId === l.id && !i.checked).length;
          return (
            <button key={l.id} style={chipStyle(active?.id === l.id)} onClick={() => selectList(l.id)}>
              <span>{l.emoji}</span> {l.name}
              {count > 0 && (
                <span style={{ background: active?.id === l.id ? 'rgba(255,255,255,0.25)' : 'var(--color-surface-muted)', borderRadius: '10px', padding: '0 0.4rem', fontSize: '0.72rem' }}>{count}</span>
              )}
            </button>
          );
        })}
        <button style={{ ...chipStyle(false), borderStyle: 'dashed' }} onClick={() => openListModal(null)}>
          <Plus size={14} /> Neue Liste
        </button>
      </div>

      {!active ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '2.5rem' }}>🛒</span>
          <div style={{ fontWeight: 700 }}>Lege deine erste Einkaufsliste an</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Zum Beispiel je eine Liste pro Laden.</div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {SHOPPING_LIST_PRESETS.slice(0, 4).map(p => (
              <button
                key={p.name} style={chipStyle(false)}
                onClick={() => {
                  const list: ShoppingList = { id: newId(), name: p.name, emoji: p.emoji, createdAt: Date.now() };
                  mockDb.saveShoppingList(list);
                  selectList(list.id);
                }}
              >
                {p.emoji} {p.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Artikel hinzufügen */}
          <div className="glass-panel" style={{ padding: '0.8rem' }}>
            <form onSubmit={e => { e.preventDefault(); addEntry(text); }} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                className="input-field" value={text} onChange={e => setText(e.target.value)}
                placeholder={`Zu „${active.name}“ hinzufügen – z. B. 2 Milch`}
                style={{ flex: 1, fontSize: 'var(--font-sm)' }}
              />
              <button type="submit" className="btn btn-primary" disabled={!text.trim()} aria-label="Hinzufügen" style={{ display: 'flex', alignItems: 'center' }}>
                <Plus size={18} />
              </button>
            </form>
            {suggestions.length > 0 && (
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                {suggestions.map(c => (
                  <button key={c.id} type="button" onClick={() => addEntry(text.trim().match(/^\d+(?:[.,]\d+)?\s*[x×]?\s+/) ? `${parseEntry(text).quantity} ${c.name}` : c.name, c)} style={{ ...chipStyle(false), fontWeight: 600, fontSize: '0.8rem' }}>
                    {c.emoji} {c.name}
                  </button>
                ))}
              </div>
            )}
            {restock.length > 0 && (
              <button
                onClick={() => restock.forEach(p => addPantryItemToList(active.id, p, user?.id))}
                className="btn btn-secondary"
                style={{ marginTop: '0.6rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
              >
                <Refrigerator size={15} /> {restock.length} Artikel mit niedrigem Vorrat ergänzen
                <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>
                  ({restock.slice(0, 3).map(p => `${restockQuantity(p)}× ${p.name}`).join(', ')}{restock.length > 3 ? ' …' : ''})
                </span>
              </button>
            )}
          </div>

          {/* Offene Artikel */}
          {open.length === 0 ? (
            <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              {done.length > 0 ? '🎉 Alles erledigt!' : 'Die Liste ist leer.'}
            </div>
          ) : (
            groups.map(([categoryId, list]) => {
              const cat = getCategory(categoryId);
              return (
                <div key={categoryId} className="glass-panel" style={{ padding: '0.9rem 1rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {cat.emoji} {cat.label}
                  </div>
                  {list.map(item => {
                    const stock = stockOf(item);
                    return (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.5rem 0', borderTop: '1px solid var(--color-border)' }}>
                        <button
                          onClick={() => startCheck(item)} aria-label={`${item.name} abhaken`}
                          style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--color-primary-light)', background: 'transparent', cursor: 'pointer', flexShrink: 0 }}
                        />
                        <button
                          onClick={() => setEditing(item)}
                          style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--color-text)', padding: 0 }}
                        >
                          <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{item.emoji}</span>
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: 'block', fontWeight: 700, fontSize: '0.92rem' }}>{item.name}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                              {stock ? `Vorrat: ${formatQty(stock.quantity)} ${stock.unit}` : 'nicht im Vorrat'}
                              {item.auto ? ' · Mindestbestand' : ''}
                              {item.note ? ` · ${item.note}` : ''}
                            </span>
                          </span>
                        </button>
                        <span style={{ fontWeight: 800, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>{formatQty(item.quantity)} <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{item.unit}</span></span>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}

          {/* Erledigt */}
          {done.length > 0 && (
            <div className="glass-panel" style={{ padding: '0.8rem 1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <button onClick={() => setShowDone(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  {showDone ? <ChevronDown size={16} /> : <ChevronRight size={16} />} Erledigt ({done.length})
                </button>
                <button onClick={() => mockDb.deleteShoppingItems(done.map(i => i.id))} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>
                  Aufräumen
                </button>
              </div>
              {showDone && done.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.45rem 0', borderTop: '1px solid var(--color-border)', opacity: 0.7 }}>
                  <button
                    onClick={() => uncheckAndUnstock(item, user?.id)} aria-label={`${item.name} wieder öffnen`}
                    title={item.stockedQty ? `Abhaken rückgängig (nimmt ${formatQty(item.stockedQty)} aus dem Vorrat)` : 'Abhaken rückgängig'}
                    style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--color-success)', background: 'var(--color-success)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  >
                    <Check size={15} />
                  </button>
                  <span style={{ fontSize: '1.3rem' }}>{item.emoji}</span>
                  <span style={{ flex: 1, textDecoration: 'line-through', fontSize: '0.88rem' }}>{item.name}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {item.stockedQty ? `+${formatQty(item.stockedQty)} im Vorrat` : 'nicht gebucht'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Abhaken: Menge abfragen und Vorrat auffüllen */}
      {checking && (
        <Modal title={`${checking.emoji} ${checking.name}`} onClose={() => setChecking(null)} maxWidth={360}>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Wie viele hast du in den Wagen gelegt?</div>
            <QtyStepper size="lg" value={checkQty} onChange={setCheckQty} unit={checking.unit} />
            {(() => {
              const stock = stockOf(checking);
              return (
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  {stock
                    ? `Vorrat: ${formatQty(stock.quantity)} → ${formatQty(stock.quantity + checkQty)} ${stock.unit}`
                    : 'Wird neu im Vorrat angelegt.'}
                </div>
              );
            })()}
            <button onClick={() => confirmCheck(true)} disabled={checkQty <= 0} className="btn btn-primary" style={{ width: '100%' }}>
              In den Vorrat buchen
            </button>
            <button onClick={() => confirmCheck(false)} className="btn btn-secondary" style={{ width: '100%', fontSize: '0.85rem' }}>
              Nur abhaken (nicht im Vorrat führen)
            </button>
          </div>
        </Modal>
      )}

      {/* Artikel bearbeiten */}
      {editing && (
        <Modal title="Artikel bearbeiten" onClose={() => setEditing(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <div style={{ width: '4.2rem' }}>
                <label style={fieldLabelStyle}>Icon</label>
                <input className="input-field" value={editing.emoji} maxLength={4} onChange={e => setEditing({ ...editing, emoji: e.target.value })} style={{ width: '100%', textAlign: 'center', fontSize: '1.4rem', padding: '0.3rem' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={fieldLabelStyle}>Name</label>
                <input className="input-field" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} style={{ width: '100%', fontSize: 'var(--font-sm)' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <label style={fieldLabelStyle}>Menge</label>
                <QtyStepper value={editing.quantity} min={1} onChange={v => setEditing({ ...editing, quantity: v })} />
              </div>
              <div style={{ flex: 1, minWidth: '6rem' }}>
                <label style={fieldLabelStyle}>Einheit</label>
                <select className="input-field" value={editing.unit} onChange={e => setEditing({ ...editing, unit: e.target.value })} style={{ width: '100%', fontSize: 'var(--font-sm)' }}>
                  {FOOD_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <div style={{ flex: 1 }}>
                <label style={fieldLabelStyle}>Kategorie</label>
                <select className="input-field" value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })} style={{ width: '100%', fontSize: 'var(--font-sm)' }}>
                  {FOOD_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={fieldLabelStyle}>Liste</label>
                <select className="input-field" value={editing.listId} onChange={e => setEditing({ ...editing, listId: e.target.value })} style={{ width: '100%', fontSize: 'var(--font-sm)' }}>
                  {lists.map(l => <option key={l.id} value={l.id}>{l.emoji} {l.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={fieldLabelStyle}>Notiz (z. B. Marke, Größe)</label>
              <input className="input-field" value={editing.note || ''} onChange={e => setEditing({ ...editing, note: e.target.value })} style={{ width: '100%', fontSize: 'var(--font-sm)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
              <button onClick={() => { mockDb.deleteShoppingItems([editing.id]); setEditing(null); }} className="btn btn-secondary" style={{ color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Trash2 size={15} /> Entfernen
              </button>
              <button onClick={saveEdit} disabled={!editing.name.trim()} className="btn btn-primary">Speichern</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Liste anlegen / bearbeiten */}
      {listModal && (
        <Modal title={listModal.list ? 'Liste bearbeiten' : 'Neue Liste'} onClose={() => setListModal(null)} maxWidth={380}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {!listModal.list && unusedPresets.length > 0 && (
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {unusedPresets.map(p => (
                  <button key={p.name} type="button" style={{ ...chipStyle(listName === p.name), fontSize: '0.8rem' }} onClick={() => { setListName(p.name); setListEmoji(p.emoji); }}>
                    {p.emoji} {p.name}
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <div style={{ width: '4.2rem' }}>
                <label style={fieldLabelStyle}>Icon</label>
                <input className="input-field" value={listEmoji} maxLength={4} onChange={e => setListEmoji(e.target.value)} style={{ width: '100%', textAlign: 'center', fontSize: '1.4rem', padding: '0.3rem' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={fieldLabelStyle}>Name (z. B. Laden)</label>
                <input className="input-field" value={listName} autoFocus onChange={e => setListName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveList(); }} style={{ width: '100%', fontSize: 'var(--font-sm)' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
              {listModal.list ? (
                confirmListDelete ? (
                  <button onClick={deleteList} className="btn" style={{ background: 'var(--color-danger)', color: 'white', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Trash2 size={15} /> Liste samt Artikeln löschen
                  </button>
                ) : (
                  <button onClick={() => setConfirmListDelete(true)} className="btn btn-secondary" style={{ color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Trash2 size={15} /> Löschen
                  </button>
                )
              ) : <span />}
              <button onClick={saveList} disabled={!listName.trim()} className="btn btn-primary">{listModal.list ? 'Speichern' : 'Anlegen'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
