import { useEffect, useMemo, useState } from 'react';
import { ScanBarcode, Search, Trash2, Sparkles } from 'lucide-react';
import { mockDb } from '../../services/mockDb';
import type { PantryItem, UnknownBarcode } from '../../services/mockDb';
import { changeStock, formatQty } from '../../utils/pantry';
import { lookupBarcode } from '../../utils/openFoodFacts';
import { relativeTime } from '../../utils/activity';
import { Modal } from './Modal';

interface Props {
  userId?: string;
  onCreate: (entry: UnknownBarcode) => void;
  onNotify: (message: string) => void;
}

// Barcodes, die der Küchenscanner nicht kannte: benennen, einem Artikel zuordnen oder verwerfen.
export const UnknownBarcodes = ({ userId, onCreate, onNotify }: Props) => {
  const [entries, setEntries] = useState<UnknownBarcode[]>([]);
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [assigning, setAssigning] = useState<UnknownBarcode | null>(null);
  const [query, setQuery] = useState('');
  const [looking, setLooking] = useState<string | null>(null);

  useEffect(() => {
    const load = () => {
      setEntries(mockDb.getUnknownBarcodes());
      setPantry(mockDb.getPantry());
    };
    load();
    window.addEventListener('db_updated', load);
    return () => window.removeEventListener('db_updated', load);
  }, []);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pantry
      .filter(p => !q || p.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
      .slice(0, 40);
  }, [pantry, query]);

  const suggest = async (entry: UnknownBarcode) => {
    setLooking(entry.id);
    const found = await lookupBarcode(entry.barcode);
    setLooking(null);
    if (!found) {
      onNotify('Kein Treffer bei Open Food Facts');
      return;
    }
    mockDb.saveUnknownBarcode({ ...entry, name: found.name, brand: found.brand });
  };

  const assign = (entry: UnknownBarcode, p: PantryItem) => {
    mockDb.savePantryItem({ ...p, barcode: entry.barcode });
    if (entry.pendingQty > 0) {
      changeStock(p.id, entry.pendingQty, { userId, source: 'inbox', note: 'Scan zugeordnet' });
    }
    mockDb.deleteUnknownBarcode(entry.id);
    setAssigning(null);
    setQuery('');
    onNotify(`${entry.barcode} → ${p.name}`);
  };

  if (entries.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        <div style={{ fontSize: '2rem' }}>📭</div>
        <div style={{ fontWeight: 700, color: 'var(--color-text)', marginTop: '0.4rem' }}>Keine unbekannten Barcodes</div>
        <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
          Scannt der Küchenscanner etwas, das noch keinem Artikel zugeordnet ist, landet es hier.
        </div>
      </div>
    );
  }

  return (
    <>
      {entries.map(e => (
        <div key={e.id} className="glass-panel" style={{ padding: '0.9rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ScanBarcode size={22} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                {e.name ? `${e.name}${e.brand ? ` · ${e.brand}` : ''}` : e.barcode}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                {e.name ? `${e.barcode} · ` : ''}{e.count}× gescannt
                {e.pendingQty > 0 ? ` · ${formatQty(e.pendingQty)} warten auf Einlagerung` : ''}
                {' · '}{relativeTime(e.lastSeenAt)}{e.deviceId ? ` · ${e.deviceId}` : ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => onCreate(e)}>
              Neuer Artikel
            </button>
            <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => { setAssigning(e); setQuery(e.name || ''); }}>
              Vorhandenem zuordnen
            </button>
            <button
              className="btn btn-secondary" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              disabled={looking === e.id} onClick={() => suggest(e)}
            >
              <Sparkles size={14} /> {looking === e.id ? 'Suche…' : 'Name suchen'}
            </button>
            <button
              className="btn btn-secondary" aria-label="Verwerfen" title="Verwerfen"
              style={{ color: 'var(--color-danger)', marginLeft: 'auto' }} onClick={() => mockDb.deleteUnknownBarcode(e.id)}
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      ))}

      {assigning && (
        <Modal title="Barcode zuordnen" onClose={() => setAssigning(null)}>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.6rem' }}>
            {assigning.barcode}
            {assigning.pendingQty > 0 ? ` · ${formatQty(assigning.pendingQty)} werden eingelagert` : ''}
          </div>
          <div style={{ position: 'relative', marginBottom: '0.6rem' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              className="input-field" placeholder="Artikel im Vorrat suchen…" value={query} autoFocus
              onChange={ev => setQuery(ev.target.value)} style={{ width: '100%', paddingLeft: '2.1rem', fontSize: 'var(--font-sm)' }}
            />
          </div>
          {candidates.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Kein Artikel gefunden – lege ihn über „Neuer Artikel“ an.</p>
          ) : (
            candidates.map(p => (
              <button
                key={p.id} onClick={() => assign(assigning, p)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%', padding: '0.5rem 0', background: 'none', border: 'none', borderTop: '1px solid var(--color-border)', cursor: 'pointer', color: 'var(--color-text)', textAlign: 'left' }}
              >
                <span style={{ fontSize: '1.4rem' }}>{p.emoji}</span>
                <span style={{ flex: 1, fontWeight: 600 }}>{p.name}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{p.barcode ? `Code: ${p.barcode}` : `${formatQty(p.quantity)} ${p.unit}`}</span>
              </button>
            ))
          )}
        </Modal>
      )}
    </>
  );
};
