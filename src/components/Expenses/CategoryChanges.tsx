import React, { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronDown, Minus, Sparkles, Tag } from 'lucide-react';
import type { ExpenseItem } from '../../services/mockDb';
import { CATEGORY_ICONS } from './ExpenseForm';

type Baseline = 'AVG' | 'PREV';
type Status = 'up' | 'down' | 'new' | 'gone' | 'flat';

interface Change {
  category: string;
  current: number;
  base: number;
  delta: number;
  pct: number | null;
  status: Status;
}

interface Props {
  expenses: ExpenseItem[];
  currentMonth: string; // YYYY-MM
  card: React.CSSProperties;
  categoryColor: (name: string) => string;
}

const UP = '#F27A9B';
const UP_TEXT = '#D4416E';
const DOWN = '#4FC3A1';
const DOWN_TEXT = '#1E9A78';
const NEUTRAL = '#8E87B8';
const VISIBLE = 5;

const monthOf = (e: ExpenseItem) => e.budgetMonth || e.date.substring(0, 7);

const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
};

const fmt0 = (v: number) => `${Math.round(v).toLocaleString('de-DE')}€`;
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt0(Math.abs(v))}`;

const STATUS_LABEL: Record<Status, string> = { up: 'mehr', down: 'weniger', new: 'neu', gone: 'entfallen', flat: 'gleich' };

export const CategoryChanges = ({ expenses, currentMonth, card, categoryColor }: Props) => {
  const [baseline, setBaseline] = useState<Baseline>('AVG');
  const [showAll, setShowAll] = useState(false);
  const [openCat, setOpenCat] = useState<string | null>(null);

  const analysis = useMemo(() => {
    const now = new Date();
    const nowMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    // Läuft der Monat noch, werden die Vormonate nur bis zum selben Tag verglichen.
    const cutoffDay = currentMonth === nowMonth ? now.getDate() : null;

    const outgoing = expenses.filter(e => e.type === 'EXPENSE');
    const currentItems = outgoing.filter(e => monthOf(e) === currentMonth);

    const baseMonths = baseline === 'AVG' ? [1, 2, 3].map(i => shiftMonth(currentMonth, -i)) : [shiftMonth(currentMonth, -1)];
    const inPeriod = (e: ExpenseItem) => {
      if (cutoffDay === null) return true;
      return (parseInt(e.date.substring(8, 10), 10) || 1) <= cutoffDay;
    };
    const baseItems = outgoing.filter(e => baseMonths.includes(monthOf(e)) && inPeriod(e));
    // Nur Monate mit Ausgaben zählen – leere Monate (App noch nicht genutzt) verfälschen den Schnitt sonst.
    const monthsWithData = new Set(baseItems.map(monthOf)).size;

    const sum = (items: ExpenseItem[]) => items.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);
    const currentBy = sum(currentItems);
    const baseTotals = sum(baseItems);

    const changes: Change[] = [];
    new Set([...Object.keys(currentBy), ...Object.keys(baseTotals)]).forEach(category => {
      const current = currentBy[category] || 0;
      const base = monthsWithData > 0 ? (baseTotals[category] || 0) / monthsWithData : 0;
      const delta = current - base;
      const pct = base > 0 ? (delta / base) * 100 : null;
      let status: Status;
      if (base === 0 && current > 0) status = 'new';
      else if (current === 0 && base > 0) status = 'gone';
      else if (Math.abs(delta) < 1 || (pct !== null && Math.abs(pct) < 5)) status = 'flat';
      else status = delta > 0 ? 'up' : 'down';
      changes.push({ category, current, base, delta, pct, status });
    });
    changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    const totalCurrent = Object.values(currentBy).reduce((s, v) => s + v, 0);
    const totalBase = monthsWithData > 0 ? Object.values(baseTotals).reduce((s, v) => s + v, 0) / monthsWithData : 0;
    const more = changes.filter(c => c.delta > 0).reduce((s, c) => s + c.delta, 0);
    const less = changes.filter(c => c.delta < 0).reduce((s, c) => s + Math.abs(c.delta), 0);
    return { changes, totalCurrent, totalBase, more, less, monthsWithData, cutoffDay, currentItems };
  }, [expenses, currentMonth, baseline]);

  const { changes, totalCurrent, totalBase, more, less, monthsWithData, cutoffDay, currentItems } = analysis;
  if (totalCurrent === 0) return null;
  if (monthsWithData === 0 && baseline === 'AVG') return null;

  const shown = changes.filter(c => c.status !== 'flat');
  const flatCount = changes.length - shown.length;
  const list = showAll ? shown : shown.slice(0, VISIBLE);
  const maxAbs = Math.max(...shown.map(c => Math.abs(c.delta)), 1);

  const net = totalCurrent - totalBase;
  const netPct = totalBase > 0 ? (net / totalBase) * 100 : null;
  const netTone = Math.abs(net) < 1 ? NEUTRAL : net > 0 ? UP_TEXT : DOWN_TEXT;
  const driver = shown.find(c => c.delta > 0);
  const saver = shown.find(c => c.delta < 0);

  const baseLabel = baseline === 'AVG'
    ? `${monthsWithData === 1 ? '1 Vormonat' : `${monthsWithData}-Monats-Ø`}`
    : 'Vormonat';
  const periodNote = cutoffDay !== null ? ` · jeweils bis zum ${cutoffDay}.` : '';

  const than = baseline === 'AVG' ? 'als sonst' : 'als im Vormonat';
  const headline = Math.abs(net) < 1
    ? (baseline === 'AVG' ? 'Genau im Schnitt' : 'Wie im Vormonat')
    : net > 0 ? `${fmt0(net)} mehr ${than}` : `${fmt0(Math.abs(net))} weniger ${than}`;

  const toggleBtn = (key: Baseline): React.CSSProperties => ({
    flex: 1, border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '0.4rem 0.75rem', borderRadius: '999px',
    fontSize: 'var(--font-xs)', fontWeight: 800,
    background: baseline === key ? 'var(--color-surface)' : 'transparent',
    color: baseline === key ? 'var(--color-primary)' : 'var(--color-text-muted)',
    boxShadow: baseline === key ? 'var(--shadow-sm)' : 'none',
  });

  const chip = (color: string): React.CSSProperties => ({
    width: '38px', height: '38px', borderRadius: '50%', flex: 'none', background: color + '26', color,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  });

  const toneOf = (c: Change) => (c.delta > 0 ? { bar: UP, text: UP_TEXT } : { bar: DOWN, text: DOWN_TEXT });

  return (
    <div style={card}>
      <div style={{ marginBottom: '0.9rem' }}>
        <div style={{ minWidth: 0, marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--font-sm)', fontWeight: 800, color: 'var(--color-text)' }}>Größte Veränderungen</h3>
          <p style={{ margin: '0.15rem 0 0 0', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', fontWeight: 500 }}>
            gegenüber {baseLabel}{periodNote}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.15rem', padding: '0.2rem', borderRadius: '999px', background: 'var(--color-surface-muted)' }}>
          <button type="button" style={toggleBtn('AVG')} onClick={() => setBaseline('AVG')}>3-Monats-Ø</button>
          <button type="button" style={toggleBtn('PREV')} onClick={() => setBaseline('PREV')}>Vormonat</button>
        </div>
      </div>

      {monthsWithData === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)', margin: '1.25rem 0' }}>
          Im Vormonat gab es keine Ausgaben zum Vergleichen.
        </p>
      ) : (
        <>
          {/* Gesamtbild */}
          <div style={{ padding: '0.95rem 1rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface-hover)', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={chip(Math.abs(net) < 1 ? NEUTRAL : net > 0 ? UP : DOWN)}>
                {Math.abs(net) < 1 ? <Minus size={18} /> : net > 0 ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--font-base)', fontWeight: 800, color: netTone }}>{headline}</div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  {fmt0(totalCurrent)} jetzt · {fmt0(totalBase)} {baseline === 'AVG' ? 'sonst' : 'zuvor'}
                </div>
              </div>
              {netPct !== null && Math.abs(net) >= 1 && (
                <span style={{ flex: 'none', padding: '0.25rem 0.6rem', borderRadius: '999px', background: netTone + '1F', color: netTone, fontSize: 'var(--font-xs)', fontWeight: 800 }}>
                  {netPct > 0 ? '+' : '−'}{Math.abs(Math.round(netPct))}%
                </span>
              )}
            </div>

            {(more > 0 || less > 0) && (
              <div style={{ marginTop: '0.85rem' }}>
                <div style={{ display: 'flex', height: '8px', borderRadius: '999px', overflow: 'hidden', gap: '2px', background: 'var(--color-surface-muted)' }}>
                  {less > 0 && <div style={{ flex: less, background: DOWN, borderRadius: '999px' }} />}
                  {more > 0 && <div style={{ flex: more, background: UP, borderRadius: '999px' }} />}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '11px', fontWeight: 800 }}>
                  <span style={{ color: DOWN_TEXT }}>↓ {fmt0(less)} gespart</span>
                  <span style={{ color: UP_TEXT }}>↑ {fmt0(more)} mehr</span>
                </div>
              </div>
            )}

            {(driver || saver) && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginTop: '0.8rem', paddingTop: '0.8rem', borderTop: '1px solid var(--color-border)' }}>
                <Sparkles size={15} style={{ flex: 'none', marginTop: '2px', color: 'var(--color-primary)' }} />
                <p style={{ margin: 0, fontSize: 'var(--font-xs)', lineHeight: 1.5, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  {driver && (
                    <>
                      <strong style={{ color: 'var(--color-text)' }}>{driver.category}</strong>{' '}
                      {driver.status === 'new' ? 'kam neu dazu' : 'treibt die Mehrausgaben'}
                      {more > 0 && ` (${signed(driver.delta)}, ${Math.round((driver.delta / more) * 100)}% aller Anstiege)`}.
                    </>
                  )}
                  {driver && saver && ' '}
                  {saver && (
                    <>
                      Am meisten gespart bei <strong style={{ color: 'var(--color-text)' }}>{saver.category}</strong> ({signed(saver.delta)}).
                    </>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Kategorien */}
          {shown.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)', margin: '1rem 0' }}>
              Alle Kategorien liegen im gewohnten Rahmen.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 800, letterSpacing: '0.05em', color: 'var(--color-text-tertiary)', margin: '0 0 0.4rem 0', padding: '0 0.15rem' }}>
                <span>← WENIGER</span><span>MEHR →</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                {list.map(c => {
                  const Icon = CATEGORY_ICONS[c.category] || Tag;
                  const color = categoryColor(c.category);
                  const tone = toneOf(c);
                  const isOpen = openCat === c.category;
                  const width = (Math.abs(c.delta) / maxAbs) * 50;
                  const bookings = isOpen
                    ? currentItems.filter(e => e.category === c.category).sort((a, b) => b.amount - a.amount).slice(0, 3)
                    : [];
                  const compareMax = Math.max(c.current, c.base, 1);
                  const badge = c.status === 'new' ? 'neu' : c.status === 'gone' ? (cutoffDay !== null ? 'noch offen' : 'entfällt') : c.pct !== null ? `${c.pct > 0 ? '+' : '−'}${Math.abs(Math.round(c.pct))}%` : '';
                  return (
                    <div key={c.category} style={{ borderRadius: 'var(--radius-md)', background: isOpen ? 'var(--color-surface-hover)' : 'transparent', transition: 'background 0.2s ease' }}>
                      <button
                        type="button"
                        onClick={() => setOpenCat(isOpen ? null : c.category)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', padding: '0.55rem 0.4rem', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--color-text)', textAlign: 'left' }}
                      >
                        <span style={chip(color)}><Icon size={18} /></span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
                            <span style={{ fontSize: 'var(--font-sm)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.category}</span>
                            <span style={{ fontSize: 'var(--font-sm)', fontWeight: 800, color: tone.text, whiteSpace: 'nowrap' }}>{signed(c.delta)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginTop: '1px', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                            <span style={{ whiteSpace: 'nowrap' }}>{fmt0(c.current)} · {baseline === 'AVG' ? 'Ø' : 'zuvor'} {fmt0(c.base)}</span>
                            {badge && <span style={{ fontWeight: 800, color: tone.text, whiteSpace: 'nowrap' }}>{badge}</span>}
                          </div>
                          <div style={{ position: 'relative', height: '8px', marginTop: '7px', borderRadius: '999px', background: 'var(--color-surface-muted)' }}>
                            <div style={{
                              position: 'absolute', top: 0, bottom: 0, borderRadius: '999px', background: tone.bar,
                              width: `${Math.max(width, 2)}%`,
                              ...(c.delta > 0 ? { left: '50%' } : { right: '50%' }),
                              transition: 'width 0.4s ease',
                            }} />
                            <div style={{ position: 'absolute', left: '50%', top: '-2px', bottom: '-2px', width: '2px', marginLeft: '-1px', borderRadius: '2px', background: 'var(--color-text-tertiary)', opacity: 0.55 }} />
                          </div>
                        </div>
                        <ChevronDown size={16} style={{ flex: 'none', color: 'var(--color-text-tertiary)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                      </button>

                      {isOpen && (
                        <div style={{ padding: '0.1rem 0.75rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.7rem', animation: 'fadeIn 0.2s ease' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {[
                              { label: 'Dieser Monat', value: c.current, fill: color },
                              { label: baseline === 'AVG' ? 'Ø Vormonate' : 'Vormonat', value: c.base, fill: 'var(--color-text-tertiary)' },
                            ].map(row => (
                              <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <span style={{ width: '5.4rem', flex: 'none', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)' }}>{row.label}</span>
                                <div style={{ flex: 1, height: '8px', borderRadius: '999px', background: 'var(--color-surface-muted)', overflow: 'hidden' }}>
                                  <div style={{ width: `${(row.value / compareMax) * 100}%`, height: '100%', borderRadius: '999px', background: row.fill, opacity: row.label === 'Dieser Monat' ? 1 : 0.45 }} />
                                </div>
                                <span style={{ width: '3.6rem', flex: 'none', textAlign: 'right', fontSize: 'var(--font-xs)', fontWeight: 800 }}>{fmt0(row.value)}</span>
                              </div>
                            ))}
                          </div>

                          {bookings.length > 0 && (
                            <div>
                              <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.05em', color: 'var(--color-text-tertiary)', marginBottom: '0.35rem' }}>GRÖSSTE BUCHUNGEN</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                {bookings.map(b => (
                                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontSize: 'var(--font-xs)' }}>
                                    <span style={{ color: 'var(--color-text-muted)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {new Date(b.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                                      {b.description ? ` · ${b.description}` : ''}
                                    </span>
                                    <span style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>−{fmt0(b.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {c.status === 'gone' && (
                            <p style={{ margin: 0, fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                              In diesem Monat noch keine Ausgaben in dieser Kategorie – {STATUS_LABEL.gone}.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {(shown.length > VISIBLE || flatCount > 0) && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginTop: '0.75rem' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-tertiary)' }}>
                    {flatCount > 0 ? `${flatCount} ${flatCount === 1 ? 'Kategorie' : 'Kategorien'} unverändert` : ''}
                  </span>
                  {shown.length > VISIBLE && (
                    <button
                      type="button"
                      onClick={() => setShowAll(v => !v)}
                      style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '0.35rem 0.8rem', whiteSpace: 'nowrap', flex: 'none', borderRadius: '999px', background: 'var(--color-surface-muted)', color: 'var(--color-primary)', fontSize: 'var(--font-xs)', fontWeight: 800 }}
                    >
                      {showAll ? 'Weniger anzeigen' : `Alle ${shown.length} anzeigen`}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};
