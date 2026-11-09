import { useEffect, useMemo, useState } from 'react';
import { mockDb } from '../../services/mockDb';
import type { PantryLogEntry } from '../../services/mockDb';
import { formatQty } from '../../utils/pantry';
import { relativeTime } from '../../utils/activity';

const SOURCE_LABEL: Record<PantryLogEntry['source'], string> = {
  app: 'App',
  shopping: 'Einkauf',
  device: 'Scanner',
  inbox: 'Neu gescannt',
};

const STATUS_LABEL: Record<string, string> = {
  not_in_stock: 'nicht auf Lager – nicht gebucht',
  unknown_product: 'unbekannter Barcode – nicht gebucht',
};

const dayLabel = (at: number): string => {
  const d = new Date(at);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Gestern';
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
};

export const PantryHistory = () => {
  const [log, setLog] = useState<PantryLogEntry[]>([]);

  useEffect(() => {
    const load = () => setLog(mockDb.getPantryLog());
    load();
    window.addEventListener('db_updated', load);
    return () => window.removeEventListener('db_updated', load);
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, PantryLogEntry[]>();
    log.forEach(e => {
      const label = dayLabel(e.at);
      map.set(label, [...(map.get(label) || []), e]);
    });
    return Array.from(map.entries());
  }, [log]);

  if (log.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        <div style={{ fontSize: '2rem' }}>📒</div>
        <div style={{ fontWeight: 700, color: 'var(--color-text)', marginTop: '0.4rem' }}>Noch keine Buchungen</div>
        <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
          Hier erscheint jede Änderung am Vorrat – aus der App, vom Einkauf und vom Küchenscanner.
        </div>
      </div>
    );
  }

  return (
    <>
      {groups.map(([label, entries]) => (
        <div key={label} className="glass-panel" style={{ padding: '0.9rem 1rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            {label}
          </div>
          {entries.map(e => {
            const rejected = !!e.status && e.status !== 'ok';
            const color = rejected ? 'var(--color-text-muted)' : e.delta > 0 ? 'var(--color-success, #16a34a)' : 'var(--color-danger)';
            const who = e.source === 'device' ? e.deviceId || 'Scanner' : e.userId;
            return (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0', borderTop: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{e.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                    {SOURCE_LABEL[e.source]}{who ? ` · ${who}` : ''} · {relativeTime(e.at)}
                    {e.note ? ` · ${e.note}` : ''}
                    {rejected ? ` · ${STATUS_LABEL[e.status as string] || e.status}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, color }}>
                    {rejected ? '–' : `${e.delta > 0 ? '+' : '−'}${formatQty(Math.abs(e.delta))} ${e.unit}`}
                  </div>
                  {!rejected && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                      jetzt {formatQty(e.quantityAfter)} {e.unit}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
};
