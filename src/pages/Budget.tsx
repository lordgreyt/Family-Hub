import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';
import type { BudgetItem, Depot } from '../services/mockDb';
import { Calculator, Plus, Pencil, Trash2, X, Check, TrendingUp, TrendingDown, PiggyBank, Wallet } from 'lucide-react';
import {
  HERO_GRADIENT, GREEN, GREEN_TEXT, PINK, PINK_TEXT, PRIMARY, iconChip, CARD, sectionTitle, fieldLabel,
} from '../components/SurgeryFinance/theme';

const fmt = (value: number) =>
  `${value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const parseAmount = (value: string): number | null => {
  const n = parseFloat(value.trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};

type SheetState = { id: string | null; type: 'INCOME' | 'EXPENSE'; title: string; amount: string } | null;

const iconBtn = (color: string) => ({
  width: '34px', height: '34px', borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
  background: color + '1F', color, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
}) as const;

export const Budget = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = () => {
      setItems(mockDb.getBudgetItems());
      setDepots(mockDb.getDepots());
    };
    load();
    window.addEventListener('db_updated', load);
    return () => window.removeEventListener('db_updated', load);
  }, []);

  const incomes = items.filter(i => i.type === 'INCOME');
  const expenses = items.filter(i => i.type === 'EXPENSE');

  const fixedDepotAmount = depots.reduce((sum, d) => sum + (d.monthlyAmount || 0), 0);

  const totalIncome = incomes.reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = expenses.reduce((acc, curr) => acc + curr.amount, 0) + fixedDepotAmount;
  const excess = totalIncome - totalExpense;

  useEffect(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const budgets = mockDb.getExpenseBudgets();
    const existingCurrent = budgets.find(b => b.month === currentMonth);

    // 1. Wenn für den aktuellen Monat noch KEIN Budget gesetzt wurde (z.B. am 1. des Monats), setzen wir es.
    // Wenn es schon existiert, lassen wir es unangetastet (damit es gelockt bleibt).
    if (!existingCurrent) {
      mockDb.setExpenseBudget({ month: currentMonth, amount: excess });
    }

    // 2. Wir schreiben jede Änderung am Budget automatisch in den NÄCHSTEN Monat.
    // So wirken sich Änderungen während des Monats erst im Folgemonat aus.
    const [y, m] = currentMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    const nextMonthStr = `${nextDate.getFullYear()}-${(nextDate.getMonth() + 1).toString().padStart(2, '0')}`;

    mockDb.setExpenseBudget({ month: nextMonthStr, amount: excess });
  }, [excess]);

  const openAdd = (type: 'INCOME' | 'EXPENSE') => {
    setError('');
    setSheet({ id: null, type, title: '', amount: '' });
  };

  const openEdit = (item: BudgetItem) => {
    setError('');
    setSheet({ id: item.id, type: item.type, title: item.title, amount: String(item.amount).replace('.', ',') });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheet || !user) return;
    const title = sheet.title.trim();
    const amount = parseAmount(sheet.amount);
    if (!title) return setError('Bitte einen Titel eingeben.');
    if (amount === null) return setError('Bitte einen gültigen Betrag eingeben.');

    if (sheet.id) {
      const existing = items.find(i => i.id === sheet.id);
      if (existing) mockDb.updateBudgetItem({ ...existing, title, amount, type: sheet.type });
    } else {
      mockDb.addBudgetItem({ title, amount, type: sheet.type, createdBy: user.id });
    }
    setSheet(null);
  };

  const handleDelete = (item: BudgetItem) => {
    if (!window.confirm(`„${item.title}“ löschen?`)) return;
    mockDb.deleteBudgetItem(item.id);
    setSheet(null);
  };

  const positive = excess >= 0;
  const spendRatio = totalIncome > 0 ? Math.min(totalExpense / totalIncome, 1) : totalExpense > 0 ? 1 : 0;
  const savingsRate = totalIncome > 0 ? Math.round((excess / totalIncome) * 100) : 0;

  const chipWhite = {
    display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem', borderRadius: '999px',
    background: 'rgba(255,255,255,0.2)', color: 'white', fontSize: 'var(--font-xs)', fontWeight: 700, lineHeight: 1.3,
  } as const;

  const renderRow = (item: BudgetItem, color: string, Icon: typeof TrendingUp, base: number) => {
    const share = base > 0 ? Math.round((item.amount / base) * 100) : 0;
    return (
      <div
        key={item.id}
        onClick={() => openEdit(item)}
        role="button"
        aria-label={`${item.title} bearbeiten`}
        style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.7rem 0', borderTop: '1px solid var(--color-border)', cursor: 'pointer' }}
      >
        <span style={iconChip(color, 36)}><Icon size={17} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--color-text)', overflowWrap: 'anywhere' }}>{item.title}</div>
          <div style={{ marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <div style={{ flex: 1, height: '5px', borderRadius: '999px', background: color + '26', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(share, 100)}%`, height: '100%', borderRadius: '999px', background: color }} />
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', minWidth: '30px', textAlign: 'right' }}>{share} %</span>
          </div>
        </div>
        <span style={{ fontSize: 'var(--font-sm)', fontWeight: 800, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>{fmt(item.amount)}</span>
        <Pencil size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
      </div>
    );
  };

  const emptyHint = (text: string) => (
    <p style={{ margin: 0, padding: '0.9rem 0 0.2rem', borderTop: '1px solid var(--color-border)', fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)', textAlign: 'center' }}>{text}</p>
  );

  const addPill = (type: 'INCOME' | 'EXPENSE', color: string) => (
    <button
      onClick={() => openAdd(type)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.8rem', borderRadius: '999px', border: 'none', cursor: 'pointer',
        background: color + '1F', color, fontFamily: 'inherit', fontSize: 'var(--font-xs)', fontWeight: 800,
      }}
    >
      <Plus size={14} /> Hinzufügen
    </button>
  );

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
      {/* Hero */}
      <div style={{ background: HERO_GRADIENT, borderRadius: 'var(--radius-xl)', padding: '1.3rem 1.25rem', color: 'white', boxShadow: '0 12px 28px rgba(63,52,196,0.28)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Calculator size={19} />
          </span>
          <div>
            <div style={{ fontSize: 'var(--font-base)', fontWeight: 800 }}>Budget</div>
            <div style={{ fontSize: 'var(--font-xs)', opacity: 0.85, fontWeight: 600 }}>Monatliche Einnahmen & Ausgaben</div>
          </div>
        </div>

        <div style={{ marginTop: '1.1rem', fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', opacity: 0.85 }}>
          {positive ? 'JETZIGER ÜBERSCHUSS' : 'JETZIGES DEFIZIT'}
        </div>
        <div style={{ fontSize: '2.6rem', fontWeight: 800, lineHeight: 1.1, marginTop: '0.2rem', overflowWrap: 'anywhere' }}>{fmt(excess)}</div>

        <div style={{ marginTop: '1rem', height: '8px', borderRadius: '999px', background: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
          <div style={{ width: `${spendRatio * 100}%`, height: '100%', borderRadius: '999px', background: 'white', transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ marginTop: '0.45rem', fontSize: '11px', fontWeight: 600, opacity: 0.85 }}>
          {totalIncome > 0 ? `${Math.round(spendRatio * 100)} % der Einnahmen sind verplant` : 'Noch keine Einnahmen eingetragen'}
        </div>

        <div style={{ marginTop: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
          <span style={chipWhite}><TrendingUp size={13} /> Einnahmen {fmt(totalIncome)}</span>
          <span style={chipWhite}><TrendingDown size={13} /> Ausgaben {fmt(totalExpense)}</span>
          {totalIncome > 0 && <span style={chipWhite}><PiggyBank size={13} /> Sparquote {savingsRate} %</span>}
        </div>
      </div>

      {/* Einnahmen */}
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.6rem' }}>
          <span style={iconChip(GREEN, 38)}><Wallet size={18} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={sectionTitle}>Einnahmen</h3>
            <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: GREEN_TEXT }}>{fmt(totalIncome)}</div>
          </div>
          {addPill('INCOME', GREEN_TEXT)}
        </div>
        {incomes.length === 0
          ? emptyHint('Noch keine Einnahmen – füge z. B. Gehalt hinzu.')
          : incomes.map(item => renderRow(item, GREEN, TrendingUp, totalIncome))}
      </div>

      {/* Ausgaben */}
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.6rem' }}>
          <span style={iconChip(PINK, 38)}><TrendingDown size={18} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={sectionTitle}>Ausgaben</h3>
            <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: PINK_TEXT }}>{fmt(totalExpense)}</div>
          </div>
          {addPill('EXPENSE', PINK_TEXT)}
        </div>
        {fixedDepotAmount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.7rem 0', borderTop: '1px solid var(--color-border)' }}>
            <span style={iconChip(PRIMARY, 36)}><PiggyBank size={17} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--color-text)' }}>N26 Sparplan</div>
              <div style={{ marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{ padding: '1px 8px', borderRadius: '999px', background: '#ECE8FF', color: PRIMARY, fontSize: '10px', fontWeight: 800 }}>AUTO</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                  {totalIncome > 0 ? `${Math.round((fixedDepotAmount / totalIncome) * 100)} %` : '–'}
                </span>
              </div>
            </div>
            <span style={{ fontSize: 'var(--font-sm)', fontWeight: 800, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>{fmt(fixedDepotAmount)}</span>
          </div>
        )}
        {expenses.length === 0 && fixedDepotAmount === 0
          ? emptyHint('Noch keine Ausgaben – füge z. B. Miete hinzu.')
          : expenses.map(item => renderRow(item, PINK, TrendingDown, totalIncome))}
      </div>

      <p style={{ margin: 0, textAlign: 'center', fontSize: '11px', color: 'var(--color-text-muted)' }}>
        Tipp: Einen Eintrag antippen zum Bearbeiten oder Löschen. Änderungen wirken sich ab dem nächsten Monat aufs Haushaltsbudget aus.
      </p>

      {/* Sheet: Hinzufügen / Bearbeiten */}
      {sheet && createPortal(
        <div
          onClick={() => setSheet(null)}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(23,20,58,0.5)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 2000, animation: 'budgetFade 0.2s ease',
          }}
        >
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={handleSave}
            style={{
              width: '100%', maxWidth: '500px', maxHeight: '94vh', overflowY: 'auto', borderRadius: '28px 28px 0 0',
              backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', boxShadow: '0 -12px 40px rgba(63,52,196,0.25)',
              padding: '0.75rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom))', animation: 'budgetSheetUp 0.28s ease',
              display: 'flex', flexDirection: 'column', gap: '1rem',
            }}
          >
            <div style={{ width: '44px', height: '5px', borderRadius: '999px', background: 'var(--color-border)', alignSelf: 'center' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: 'var(--font-lg)', fontWeight: 800 }}>{sheet.id ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}</h2>
              <button type="button" onClick={() => setSheet(null)} aria-label="Schließen" style={{ ...iconBtn(PRIMARY), width: '36px', height: '36px' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', padding: '4px', borderRadius: '999px', background: 'var(--color-surface-muted)' }}>
              {([['INCOME', 'Einnahme', GREEN], ['EXPENSE', 'Ausgabe', PINK]] as const).map(([value, label, color]) => {
                const active = sheet.type === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSheet({ ...sheet, type: value })}
                    style={{
                      height: '40px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: 'var(--font-sm)', fontWeight: 800, transition: 'all 0.15s',
                      background: active ? color : 'transparent', color: active ? 'white' : 'var(--color-text-muted)',
                      boxShadow: active ? `0 4px 12px ${color}66` : 'none',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div>
              <label style={fieldLabel} htmlFor="budget-title">Titel</label>
              <input
                id="budget-title"
                className="input-field"
                style={{ width: '100%' }}
                placeholder="z. B. Miete"
                value={sheet.title}
                onChange={e => { setSheet({ ...sheet, title: e.target.value }); setError(''); }}
              />
            </div>

            <div>
              <label style={fieldLabel} htmlFor="budget-amount">Betrag pro Monat</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="budget-amount"
                  className="input-field"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={sheet.amount}
                  onChange={e => { setSheet({ ...sheet, amount: e.target.value }); setError(''); }}
                  style={{ width: '100%', paddingRight: '2.5rem', fontSize: 'var(--font-xl)', fontWeight: 800 }}
                />
                <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: 'var(--color-text-muted)' }}>€</span>
              </div>
            </div>

            {error && (
              <div style={{ padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-md)', background: '#FDE8EF', color: PINK_TEXT, fontSize: 'var(--font-sm)', fontWeight: 700, textAlign: 'center' }}>{error}</div>
            )}

            <button
              type="submit"
              style={{
                width: '100%', height: '50px', border: 'none', borderRadius: '999px', cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                background: 'linear-gradient(135deg, #3F34C4 0%, #6D5DF0 100%)', color: 'white',
                fontSize: 'var(--font-base)', fontWeight: 800, boxShadow: '0 8px 20px rgba(63,52,196,0.3)',
              }}
            >
              <Check size={18} /> {sheet.id ? 'Speichern' : 'Hinzufügen'}
            </button>

            {sheet.id && (
              <button
                type="button"
                onClick={() => { const item = items.find(i => i.id === sheet.id); if (item) handleDelete(item); }}
                style={{
                  width: '100%', height: '44px', border: 'none', borderRadius: '999px', cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                  background: '#FDE8EF', color: PINK_TEXT, fontSize: 'var(--font-sm)', fontWeight: 800,
                }}
              >
                <Trash2 size={16} /> Eintrag löschen
              </button>
            )}
          </form>
          <style>{`
            @keyframes budgetFade { from { opacity: 0; } to { opacity: 1; } }
            @keyframes budgetSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          `}</style>
        </div>,
        document.body
      )}
    </div>
  );
};
