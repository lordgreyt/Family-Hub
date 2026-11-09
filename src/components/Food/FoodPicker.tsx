import { useMemo, useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { Modal } from './Modal';
import { FOOD_CATALOG, FOOD_CATEGORIES, getCategory, searchCatalog } from '../../data/foodCatalog';
import type { CatalogItem } from '../../data/foodCatalog';

interface FoodPickerProps {
  title?: string;
  onPick: (item: CatalogItem) => void;
  onCustom: (name: string) => void;
  onClose: () => void;
}

// Katalog-Auswahl mit Suche und Kategorie-Filter; freie Eingabe als Fallback.
export const FoodPicker = ({ title = 'Artikel wählen', onPick, onCustom, onClose }: FoodPickerProps) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('alle');

  const results = useMemo(() => {
    if (query.trim()) return searchCatalog(query, 60);
    if (category === 'alle') return FOOD_CATALOG;
    return FOOD_CATALOG.filter(c => c.category === category);
  }, [query, category]);

  const exact = results.some(r => r.name.toLowerCase() === query.trim().toLowerCase());

  const chip = (active: boolean) => ({
    padding: '0.3rem 0.6rem', fontSize: '0.78rem', borderRadius: '20px', border: '1px solid',
    borderColor: active ? 'var(--color-primary)' : 'var(--color-border)',
    backgroundColor: active ? 'var(--color-primary)' : 'var(--color-surface)',
    color: active ? 'white' : 'var(--color-text-muted)',
    cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600, flexShrink: 0,
  } as const);

  return (
    <Modal title={title} onClose={onClose} maxWidth={520}>
      <div style={{ position: 'relative', marginBottom: '0.6rem' }}>
        <Search size={16} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
        <input
          className="input-field" autoFocus placeholder="Suchen oder eigenen Artikel eingeben…"
          value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && query.trim() && results.length === 0) onCustom(query.trim()); }}
          style={{ width: '100%', paddingLeft: '2.1rem', fontSize: 'var(--font-sm)' }}
        />
      </div>

      {!query.trim() && (
        <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
          <button type="button" style={chip(category === 'alle')} onClick={() => setCategory('alle')}>Alle</button>
          {FOOD_CATEGORIES.filter(c => c.id !== 'sonstiges').map(c => (
            <button key={c.id} type="button" style={chip(category === c.id)} onClick={() => setCategory(c.id)}>
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      )}

      {query.trim() && !exact && (
        <button
          type="button" onClick={() => onCustom(query.trim())} className="btn btn-secondary"
          style={{ width: '100%', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
        >
          <Plus size={15} /> „{query.trim()}“ als eigenen Artikel anlegen
        </button>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: '0.5rem', maxHeight: '48vh', overflowY: 'auto' }}>
        {results.map(item => (
          <button
            key={item.id} type="button" onClick={() => onPick(item)}
            title={getCategory(item.category).label}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
              padding: '0.6rem 0.3rem', borderRadius: 'var(--radius-md)', cursor: 'pointer',
              border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)',
            }}
          >
            <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>{item.emoji}</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, textAlign: 'center', lineHeight: 1.15, wordBreak: 'break-word' }}>{item.name}</span>
          </button>
        ))}
        {results.length === 0 && (
          <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '1rem 0' }}>
            Nichts gefunden. Mit Enter oder dem Button oben als eigenen Artikel anlegen.
          </p>
        )}
      </div>
    </Modal>
  );
};
