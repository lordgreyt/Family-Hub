import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Plus, Minus, TrendingDown, TrendingUp, Check, X, Tag, ChevronDown, CalendarPlus, Flame } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';
import type { ExpenseItem } from '../services/mockDb';
import { ExpenseForm, CATEGORY_ICONS } from '../components/Expenses/ExpenseForm';
import { PageBottomBar } from '../components/Layout/PageBottomBar';

const LONG_PRESS_MS = 600;

type ViewMode = 'CATEGORY' | 'TREND' | 'DAILY';

const CHART_COLORS = ['#6D5DF0', '#F27A9B', '#F5A06B', '#4FC3A1', '#4B8DFF', '#C7B6F7'];
const CHART_REST_COLOR = '#CFC7F5';

export const Expenses = () => {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [showForm, setShowForm] = useState<{ show: boolean, type: 'INCOME' | 'EXPENSE' }>({ show: false, type: 'EXPENSE' });
  const [expenses, setExpenses] = useState<ExpenseItem[]>(mockDb.getExpenses());
  const [budgets, setBudgets] = useState(mockDb.getExpenseBudgets());
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [tempBudget, setTempBudget] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('CATEGORY');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<ExpenseItem | null>(null);
  const [showConfirmNewMonth, setShowConfirmNewMonth] = useState(false);
  
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const load = () => {
      setExpenses(mockDb.getExpenses());
      setBudgets(mockDb.getExpenseBudgets());
    };
    window.addEventListener('db_updated', load);
    return () => window.removeEventListener('db_updated', load);
  }, []);

  const monthExpenses = useMemo(() => {
    return expenses.filter(e => {
      const eMonth = e.budgetMonth || e.date.substring(0, 7);
      return eMonth === currentMonth;
    });
  }, [expenses, currentMonth]);

  const currentBudget = useMemo(() => {
    const existing = budgets.find(b => b.month === currentMonth);
    if (existing) return existing.amount;
    
    // Fallback to the most recent budget if the selected month has no specific budget yet
    if (budgets.length > 0) {
      const sorted = [...budgets].sort((a, b) => b.month.localeCompare(a.month));
      return sorted[0].amount;
    }
    
    return 0;
  }, [budgets, currentMonth]);

  const stats = useMemo(() => {
    const totalOut = monthExpenses.filter(e => e.type === 'EXPENSE').reduce((sum, e) => sum + e.amount, 0);
    const totalIn = monthExpenses.filter(e => e.type === 'INCOME').reduce((sum, e) => sum + e.amount, 0);
    const byCategory = monthExpenses
      .filter(e => e.type === 'EXPENSE')
      .reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount;
        return acc;
      }, {} as Record<string, number>);

    const balance = (Number(currentBudget) || 0) + (Number(totalIn) || 0) - (Number(totalOut) || 0);
    const budgetUsed = (Number(currentBudget) || 0) > 0 ? (totalOut / Number(currentBudget)) * 100 : 0;
    return { totalOut, totalIn, byCategory, balance, budgetUsed };
  }, [monthExpenses, currentBudget]);

  // --- Gamification: 3-Monats-Durchschnitt pro Kategorie ---
  const categoryTrends = useMemo(() => {
    const [y, m] = currentMonth.split('-').map(Number);
    const prevMonths: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(y, m - 1, 1);
      d.setMonth(d.getMonth() - i);
      prevMonths.push(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`);
    }

    const prevExpenses = expenses.filter(e => {
      const eMonth = e.budgetMonth || e.date.substring(0, 7);
      return prevMonths.includes(eMonth) && e.type === 'EXPENSE';
    });

    const prevByCategory: Record<string, { total: number; months: number }> = {};
    prevExpenses.forEach(e => {
      if (!prevByCategory[e.category]) prevByCategory[e.category] = { total: 0, months: 0 };
      prevByCategory[e.category].total += e.amount;
    });
    // Count distinct months each category appeared in
    const catMonths = new Set<string>();
    prevExpenses.forEach(e => {
      const eMonth = e.budgetMonth || e.date.substring(0, 7);
      catMonths.add(`${e.category}::${eMonth}`);
    });
    catMonths.forEach(key => {
      const [cat] = key.split('::');
      if (prevByCategory[cat]) prevByCategory[cat].months++;
    });

    const trends: { category: string; current: number; avg: number; change: number; changePct: number }[] = [];
    Object.entries(stats.byCategory).forEach(([cat, current]) => {
      const prev = prevByCategory[cat];
      const avgMonths = prev?.months || 3;
      const avg = prev ? prev.total / Math.max(avgMonths, 1) : current;
      const change = current - avg;
      const changePct = avg > 0 ? (change / avg) * 100 : 0;
      trends.push({ category: cat, current, avg, change, changePct });
    });

    trends.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    return trends;
  }, [expenses, currentMonth, stats.byCategory]);

  // --- Gamification: Erfolgsmeldung ---
  const successMessage = useMemo(() => {
    const messages: { text: string; emoji: string; color: string }[] = [];

    // Budget-Auslastung check (based on day of month progress)
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayProgress = now.getDate() / daysInMonth;

    if (stats.budgetUsed <= 50 && dayProgress > 0.5) {
      messages.push({ text: `Erst ${Math.round(stats.budgetUsed)}% vom Budget verbraucht — und der Monat ist schon halb rum!`, emoji: '🔥', color: 'var(--color-success)' });
    } else if (stats.budgetUsed <= 75 && dayProgress > 0.6) {
      messages.push({ text: `Gut im Plan: ${Math.round(stats.budgetUsed)}% Budget verbraucht bei ${Math.round(dayProgress * 100)}% des Monats.`, emoji: '👍', color: 'var(--color-primary)' });
    } else if (stats.budgetUsed >= 90 && dayProgress < 0.8) {
      messages.push({ text: `Achtung: Schon ${Math.round(stats.budgetUsed)}% des Budgets aufgebraucht.`, emoji: '⚠️', color: 'var(--color-orange)' });
    }

    // Beste Kategorie-Trends (positive = weniger ausgegeben)
    const bestTrend = categoryTrends.find(t => t.changePct < -10 && t.current > 0);
    if (bestTrend) {
      messages.push({ text: `"${bestTrend.category}": ${Math.abs(Math.round(bestTrend.changePct))}% weniger als im Schnitt!`, emoji: '📉', color: 'var(--color-success)' });
    }

    // Fallback
    if (messages.length === 0 && stats.balance > 0) {
      messages.push({ text: `Noch ${stats.balance.toFixed(0)}€ verfügbar diesen Monat.`, emoji: '💰', color: 'var(--color-primary)' });
    } else if (messages.length === 0) {
      messages.push({ text: `Weiter so — jeder Eintrag hilft, den Überblick zu behalten.`, emoji: '📊', color: 'var(--color-text-muted)' });
    }

    // Return the best (first positive) message
    const positive = messages.find(m => m.color === 'var(--color-success)');
    return positive || messages[0];
  }, [stats, categoryTrends]);

  // --- Gamification: Consecutive months under budget ---
  const underBudgetStreak = useMemo(() => {
    const [y, m] = currentMonth.split('-').map(Number);
    const currentDate = new Date(y, m - 1, 1);
    let streak = stats.balance >= 0 ? 0 : -1;
    if (streak === -1) return 0;

    for (let i = 0; i < 12; i++) {
      const checkDate = new Date(currentDate);
      checkDate.setMonth(checkDate.getMonth() - i);
      const checkMonth = `${checkDate.getFullYear()}-${(checkDate.getMonth() + 1).toString().padStart(2, '0')}`;

      const monthExps = expenses.filter(e => {
        const eMonth = e.budgetMonth || e.date.substring(0, 7);
        return eMonth === checkMonth;
      });
      const out = monthExps.filter(e => e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0);
      const inc = monthExps.filter(e => e.type === 'INCOME').reduce((s, e) => s + e.amount, 0);
      const b = budgets.find(b => b.month === checkMonth);
      const bAmount = b ? b.amount : (budgets.length > 0 ? budgets.sort((a, b2) => b2.month.localeCompare(a.month))[0].amount : 0);
      const bal = bAmount + inc - out;

      if (bal >= 0 && i === streak) {
        streak++;
      } else if (bal < 0 && i === 0) {
        return 0;
      } else {
        break;
      }
    }
    return streak;
  }, [expenses, budgets, currentMonth, stats.balance]);

  const handlePrevMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number);
    const date = new Date(y, m - 1, 1);
    date.setMonth(date.getMonth() - 1);
    setCurrentMonth(`${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number);
    const date = new Date(y, m - 1, 1);
    date.setMonth(date.getMonth() + 1);
    setCurrentMonth(`${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`);
  };

  const handleNewMonth = () => {
    setShowConfirmNewMonth(true);
  };

  const executeNewMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    const nextMonthStr = `${nextDate.getFullYear()}-${(nextDate.getMonth() + 1).toString().padStart(2, '0')}`;
    
    if (stats.balance > 0) {
      mockDb.addExpense({
        amount: stats.balance,
        category: 'Korrektur',
        date: `${nextMonthStr}-01`,
        type: 'INCOME',
        description: `Übertrag aus ${formatDate(currentMonth)}`,
        createdBy: user?.id || 'System'
      });
    }
    
    setCurrentMonth(nextMonthStr);
    
    // Smooth scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setShowConfirmNewMonth(false);
  };

  const handleSaveBudget = () => {
    const val = parseFloat(tempBudget);
    if (!isNaN(val)) {
      mockDb.setExpenseBudget({ month: currentMonth, amount: val });
      setIsEditingBudget(false);
    }
  };

  const groupedByDay = useMemo(() => {
    const groups: Record<string, ExpenseItem[]> = {};
    monthExpenses.forEach(e => {
      if (!groups[e.date]) groups[e.date] = [];
      groups[e.date].push(e);
    });
    return Object.entries(groups).sort((a,b) => b[0].localeCompare(a[0]));
  }, [monthExpenses]);

  const startPress = (action: () => void) => {
    pressTimer.current = setTimeout(() => {
      action();
      if (window.navigator.vibrate) window.navigator.vibrate(50);
    }, LONG_PRESS_MS);
  };

  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso + '-01');
    return d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  };

  const fmt0 = (v: number) => `${Math.round(v).toLocaleString('de-DE')}€`;
  const fmt2 = (v: number) => `${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`;

  const pressHandlers = (action: () => void) => ({
    onMouseDown: () => startPress(action),
    onMouseUp: cancelPress,
    onMouseLeave: cancelPress,
    onTouchStart: () => startPress(action),
    onTouchEnd: cancelPress,
  });

  const categoryList = useMemo(() => {
    return Object.entries(stats.byCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .map((d, i) => ({ ...d, color: i < CHART_COLORS.length - 1 ? CHART_COLORS[i] : CHART_REST_COLOR }));
  }, [stats.byCategory]);
  const totalCategoryVal = categoryList.reduce((s, d) => s + d.value, 0);

  const trend = useMemo(() => {
    const [y, m] = currentMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const now = new Date();
    const isCurrent = now.getFullYear() === y && now.getMonth() + 1 === m;
    const isFuture = new Date(y, m - 1, 1) > now;
    const lastDay = isFuture ? 0 : isCurrent ? now.getDate() : daysInMonth;
    const perDay: number[] = Array(daysInMonth).fill(0);
    monthExpenses.filter(e => e.type === 'EXPENSE').forEach(e => {
      const d = Math.min(Math.max(parseInt(e.date.substring(8, 10), 10) || 1, 1), daysInMonth);
      perDay[d - 1] += e.amount;
    });
    const cumulative: number[] = [];
    let acc = 0;
    for (let i = 0; i < Math.max(lastDay, Math.min(daysInMonth, perDay.reduce((l, v, idx) => (v > 0 ? idx + 1 : l), 0))); i++) {
      acc += perDay[i];
      cumulative.push(acc);
    }
    return { y, m, daysInMonth, perDay, cumulative };
  }, [monthExpenses, currentMonth]);

  const peakDay = trend.perDay.reduce((best, v, i) => (v > trend.perDay[best] ? i : best), 0);
  const activeDay = selectedDay !== null && selectedDay < trend.daysInMonth ? selectedDay : peakDay;

  const limit = (Number(currentBudget) || 0) + stats.totalIn;
  const overBudget = stats.budgetUsed > 100;

  const CARD: React.CSSProperties = { padding: '1.25rem', marginBottom: '1rem', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' };
  const cardTitle: React.CSSProperties = { margin: 0, fontSize: 'var(--font-sm)', fontWeight: 800, color: 'var(--color-text)' };
  const cardSub: React.CSSProperties = { margin: '0.15rem 0 0 0', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', fontWeight: 500 };
  const pill = (color: string): React.CSSProperties => ({ flex: 'none', padding: '0.3rem 0.7rem', borderRadius: '999px', background: 'var(--color-surface-muted)', color, fontSize: 'var(--font-xs)', fontWeight: 800 });
  const iconChip = (color: string): React.CSSProperties => ({ width: '38px', height: '38px', borderRadius: '50%', flex: 'none', background: color + '26', color, display: 'flex', alignItems: 'center', justifyContent: 'center' });

  const categoryColor = (name: string) => categoryList.find(c => c.name === name)?.color || CHART_REST_COLOR;

  const renderItemRow = (item: ExpenseItem, color: string, withDate = false) => {
    const Icon = CATEGORY_ICONS[item.category] || Tag;
    const sub = [withDate ? new Date(item.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : '', item.description || ''].filter(Boolean).join(' · ');
    return (
      <div
        key={item.id}
        {...pressHandlers(() => setItemToDelete(item))}
        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={iconChip(color)}><Icon size={18} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--color-text)' }}>{item.category}</div>
          {sub && (
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
          )}
        </div>
        <span style={{ fontWeight: 800, fontSize: 'var(--font-sm)', whiteSpace: 'nowrap', color: item.type === 'INCOME' ? 'var(--color-success)' : 'var(--color-text)' }}>
          {item.type === 'INCOME' ? '+' : '−'}{fmt2(item.amount)}
        </span>
      </div>
    );
  };

  /* Donut */
  const R = 38;
  const C = 2 * Math.PI * R;
  const GAP = categoryList.length > 1 ? 1.6 : 0;
  let donutOffset = 0;
  const activeSlice = activeCategory ? categoryList.find(c => c.name === activeCategory) : null;

  /* Verlauf */
  const TW = 300, TH = 120, TPAD = 6;
  const lastCum = trend.cumulative[trend.cumulative.length - 1] || 0;
  const yMax = Math.max(limit, lastCum, 1) * 1.08;
  const xAt = (i: number) => TPAD + (i / Math.max(trend.daysInMonth - 1, 1)) * (TW - TPAD * 2);
  const yAt = (v: number) => TH - TPAD - (v / yMax) * (TH - TPAD * 2);
  const linePts = trend.cumulative.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`);
  const linePath = linePts.length > 0 ? `M${linePts.join(' L')}` : '';
  const areaPath = linePts.length > 0 ? `${linePath} L${xAt(trend.cumulative.length - 1).toFixed(1)},${TH - TPAD} L${xAt(0).toFixed(1)},${TH - TPAD} Z` : '';
  const maxDay = Math.max(...trend.perDay, 1);

  const statChip: React.CSSProperties = { flex: 1, minWidth: 0, padding: '0.55rem 0.7rem', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.18)', textAlign: 'left' };
  const statLabel: React.CSSProperties = { margin: 0, fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', opacity: 0.85 };
  const statValue: React.CSSProperties = { margin: '0.1rem 0 0 0', fontSize: 'var(--font-sm)', fontWeight: 800, whiteSpace: 'nowrap' };
  const monthBtn: React.CSSProperties = { background: 'var(--color-surface-muted)', borderColor: 'transparent', color: 'var(--color-primary)' };
  const miniBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'white', padding: '0.2rem', display: 'flex', cursor: 'pointer' };

  const modalBackdrop: React.CSSProperties = { position: 'fixed', inset: 0, backgroundColor: 'rgba(23,20,58,0.5)', backdropFilter: 'blur(6px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' };
  const modalCard: React.CSSProperties = { width: '100%', maxWidth: '400px', padding: '1.75rem 1.5rem', textAlign: 'center', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-xl)', animation: 'fadeIn 0.2s ease' };
  const modalPrimaryBtn: React.CSSProperties = { height: '50px', border: 'none', borderRadius: '999px', fontWeight: 800, fontSize: 'var(--font-base)', color: 'white', cursor: 'pointer', fontFamily: 'inherit' };
  const modalSecondaryBtn: React.CSSProperties = { height: '50px', border: 'none', borderRadius: '999px', fontWeight: 700, fontSize: 'var(--font-base)', color: 'var(--color-text-muted)', background: 'var(--color-surface-muted)', cursor: 'pointer', fontFamily: 'inherit' };

  const segments: { key: ViewMode; label: string }[] = [
    { key: 'CATEGORY', label: 'Kategorien' },
    { key: 'TREND', label: 'Verlauf' },
    { key: 'DAILY', label: 'Buchungen' },
  ];

  const visibleTrends = categoryTrends.filter(t => Math.abs(t.changePct) >= 5).slice(0, 5);

  return (
    <div style={{ paddingBottom: '8rem' }}>
      {/* Monats-Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
        <button className="glass-btn" style={monthBtn} onClick={handlePrevMonth} aria-label="Vorheriger Monat"><ChevronLeft size={22} /></button>
        <h2 style={{ margin: 0, fontSize: 'var(--font-lg)', fontWeight: 800, color: 'var(--color-text)' }}>{formatDate(currentMonth)}</h2>
        <button className="glass-btn" style={monthBtn} onClick={handleNextMonth} aria-label="Nächster Monat"><ChevronRight size={22} /></button>
      </div>

      {/* Hero */}
      <div style={{
        padding: '1.25rem', marginBottom: '1rem', borderRadius: 'var(--radius-xl)', color: 'white',
        background: 'linear-gradient(135deg, #3F34C4 0%, #6D5DF0 55%, #F2A9BE 130%)',
        boxShadow: '0 12px 28px rgba(63,52,196,0.28)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', opacity: 0.85 }}>NOCH VERFÜGBAR</p>
            <div style={{ fontSize: '2.1rem', fontWeight: 800, lineHeight: 1.15, margin: '0.2rem 0 0.35rem 0', whiteSpace: 'nowrap' }}>
              {stats.balance < 0 ? '−' : ''}{fmt0(Math.abs(stats.balance))}
            </div>
            {underBudgetStreak >= 3 ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.6rem', borderRadius: '999px', background: 'rgba(255,255,255,0.2)', fontSize: '11px', fontWeight: 700 }}>
                <Flame size={12} /> {underBudgetStreak} Monate im Plus
              </span>
            ) : (
              <span style={{ fontSize: 'var(--font-xs)', opacity: 0.85, fontWeight: 600 }}>von {fmt0(limit)}</span>
            )}
          </div>

          <div style={{ position: 'relative', width: '104px', height: '104px', flex: 'none' }}>
            <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="4" />
              <circle
                cx="18" cy="18" r="15.5" fill="none"
                stroke={overBudget ? '#FFE0A3' : 'white'}
                strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${Math.min(stats.budgetUsed, 100) * 0.974} 97.4`}
                style={{ transition: 'stroke-dasharray 0.6s ease' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '1.35rem', fontWeight: 800, lineHeight: 1 }}>{Math.round(stats.budgetUsed)}%</span>
              <span style={{ fontSize: '10px', fontWeight: 600, opacity: 0.85, marginTop: '2px' }}>verbraucht</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          {isEditingBudget ? (
            <div style={{ ...statChip, display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.3rem 0.4rem' }}>
              <button style={miniBtn} onClick={() => setIsEditingBudget(false)}><X size={16} /></button>
              <input
                type="number"
                value={tempBudget}
                onChange={e => setTempBudget(e.target.value)}
                autoFocus
                style={{ width: '100%', minWidth: 0, border: 'none', outline: 'none', borderRadius: '8px', padding: '0.25rem', textAlign: 'center', fontSize: 'var(--font-sm)', fontWeight: 800, color: 'var(--color-text)' }}
              />
              <button style={miniBtn} onClick={handleSaveBudget}><Check size={18} /></button>
            </div>
          ) : (
            <div
              {...pressHandlers(() => { setTempBudget(currentBudget.toString()); setIsEditingBudget(true); })}
              style={{ ...statChip, cursor: 'pointer', userSelect: 'none' }}
            >
              <p style={statLabel}>FIXBETRAG</p>
              <p style={statValue}>{fmt0(Number(currentBudget) || 0)}</p>
            </div>
          )}
          <div style={statChip}>
            <p style={statLabel}>AUSGABEN</p>
            <p style={statValue}>−{fmt0(stats.totalOut)}</p>
          </div>
          <div style={statChip}>
            <p style={statLabel}>EINNAHMEN</p>
            <p style={statValue}>+{fmt0(stats.totalIn)}</p>
          </div>
        </div>
      </div>

      {/* Erfolgsmeldung */}
      {successMessage && (
        <div style={{ ...CARD, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', animation: 'fadeIn 0.3s ease' }}>
          <span style={{ width: '36px', height: '36px', flex: 'none', borderRadius: '50%', background: 'var(--color-surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>{successMessage.emoji}</span>
          <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--color-text)', flex: 1 }}>{successMessage.text}</span>
        </div>
      )}

      {/* Umschalter */}
      <div style={{ display: 'flex', gap: '0.25rem', padding: '0.25rem', marginBottom: '1rem', borderRadius: '999px', background: 'var(--color-surface-muted)' }}>
        {segments.map(s => (
          <button
            key={s.key}
            type="button"
            onClick={() => setViewMode(s.key)}
            style={{
              flex: 1, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              padding: '0.55rem 0.5rem', borderRadius: '999px',
              fontSize: 'var(--font-sm)', fontWeight: 800,
              background: viewMode === s.key ? 'var(--color-surface)' : 'transparent',
              color: viewMode === s.key ? 'var(--color-primary)' : 'var(--color-text-muted)',
              boxShadow: viewMode === s.key ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Kategorien */}
      {viewMode === 'CATEGORY' && (
        <div style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <h3 style={cardTitle}>Ausgaben nach Kategorien</h3>
              <p style={cardSub}>{categoryList.length} Kategorien</p>
            </div>
            <span style={pill('var(--color-primary)')}>{fmt0(totalCategoryVal)}</span>
          </div>

          {categoryList.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)', margin: '1.5rem 0' }}>Keine Daten für diesen Monat</p>
          ) : (
            <>
              <div style={{ position: 'relative', width: '190px', height: '190px', margin: '0 auto 1.25rem' }}>
                <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                  <circle cx="50" cy="50" r={R} fill="none" stroke="var(--color-surface-muted)" strokeWidth="13" />
                  {categoryList.map(s => {
                    const len = (s.value / totalCategoryVal) * C;
                    const dash = Math.max(len - GAP, 0.5);
                    const isActive = activeCategory === s.name;
                    const el = (
                      <circle
                        key={s.name}
                        cx="50" cy="50" r={R} fill="none"
                        stroke={s.color}
                        strokeWidth={isActive ? 16 : 13}
                        strokeDasharray={`${dash} ${C - dash}`}
                        strokeDashoffset={-donutOffset}
                        onClick={() => setActiveCategory(isActive ? null : s.name)}
                        style={{ cursor: 'pointer', transition: 'stroke-width 0.2s ease, opacity 0.2s ease', opacity: !activeCategory || isActive ? 1 : 0.35 }}
                      />
                    );
                    donutOffset += len;
                    return el;
                  })}
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 36px', pointerEvents: 'none' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeSlice ? activeSlice.name : 'Gesamt'}
                  </span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1.15, color: activeSlice ? activeSlice.color : 'var(--color-text)' }}>
                    {fmt0(activeSlice ? activeSlice.value : totalCategoryVal)}
                  </span>
                  {activeSlice && <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>{Math.round((activeSlice.value / totalCategoryVal) * 100)} %</span>}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {categoryList.map(d => {
                  const isExpanded = expandedCategory === d.name;
                  const categoryItems = monthExpenses.filter(e => e.category === d.name).sort((a, b) => b.date.localeCompare(a.date));
                  const Icon = CATEGORY_ICONS[d.name] || Tag;
                  return (
                    <div key={d.name}>
                      <div
                        onClick={() => { setExpandedCategory(isExpanded ? null : d.name); setActiveCategory(isExpanded ? null : d.name); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', cursor: 'pointer' }}
                      >
                        <span style={iconChip(d.color)}><Icon size={18} /></span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
                            <span style={{ fontSize: 'var(--font-sm)', fontWeight: 700 }}>{d.name}</span>
                            <span style={{ fontSize: 'var(--font-sm)', fontWeight: 800 }}>{fmt2(d.value)}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '5px' }}>
                            <div style={{ flex: 1, height: '6px', borderRadius: '999px', background: 'var(--color-surface-muted)', overflow: 'hidden' }}>
                              <div style={{ width: `${(d.value / totalCategoryVal) * 100}%`, height: '100%', borderRadius: '999px', background: d.color }} />
                            </div>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', minWidth: '28px', textAlign: 'right' }}>{Math.round((d.value / totalCategoryVal) * 100)}%</span>
                          </div>
                        </div>
                        <ChevronDown size={16} style={{ flex: 'none', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--color-text-tertiary)' }} />
                      </div>
                      {isExpanded && (
                        <div style={{ margin: '0.25rem 0 0.5rem', padding: '0.75rem', background: 'var(--color-surface-hover)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '0.65rem', animation: 'fadeIn 0.2s ease' }}>
                          {categoryItems.map(item => renderItemRow(item, d.color, true))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Verlauf */}
      {viewMode === 'TREND' && (
        <>
          <div style={CARD}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <h3 style={cardTitle}>Budget-Verlauf</h3>
                <p style={cardSub}>Summe der Ausgaben im Monat</p>
              </div>
              <span style={pill(overBudget ? 'var(--color-danger)' : 'var(--color-primary)')}>{fmt0(lastCum)}</span>
            </div>
            <svg viewBox={`0 0 ${TW} ${TH}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
              <defs>
                <linearGradient id="exp-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6D5DF0" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#F2A9BE" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map(f => (
                <line key={f} x1={TPAD} x2={TW - TPAD} y1={TH - TPAD - f * (TH - TPAD * 2)} y2={TH - TPAD - f * (TH - TPAD * 2)} stroke="var(--color-border)" strokeWidth="0.6" />
              ))}
              {limit > 0 && (
                <>
                  <line x1={TPAD} x2={TW - TPAD} y1={yAt(limit)} y2={yAt(limit)} stroke="#F27A9B" strokeWidth="1" strokeDasharray="4 3" />
                  <text x={TW - TPAD} y={yAt(limit) - 3} textAnchor="end" fontSize="8" fontWeight="700" fill="#F27A9B">Budget {fmt0(limit)}</text>
                </>
              )}
              {areaPath && <path d={areaPath} fill="url(#exp-area)" />}
              {linePath && <path d={linePath} fill="none" stroke="#6D5DF0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}
              {linePts.length > 0 && (
                <circle cx={xAt(trend.cumulative.length - 1)} cy={yAt(lastCum)} r="3.6" fill="white" stroke="#6D5DF0" strokeWidth="2" />
              )}
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem', fontSize: '10px', fontWeight: 600, color: 'var(--color-text-tertiary)' }}>
              <span>1.</span><span>{Math.round(trend.daysInMonth / 2)}.</span><span>{trend.daysInMonth}.</span>
            </div>
          </div>

          <div style={CARD}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <h3 style={cardTitle}>Tagesausgaben</h3>
                <p style={cardSub}>
                  {new Date(trend.y, trend.m - 1, activeDay + 1).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
              <span style={pill('var(--color-primary)')}>{fmt0(trend.perDay[activeDay] || 0)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '96px' }}>
              {trend.perDay.map((v, i) => {
                const isActive = i === activeDay;
                return (
                  <div
                    key={i}
                    onClick={() => setSelectedDay(i)}
                    style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', cursor: 'pointer' }}
                  >
                    <div style={{
                      width: '100%', height: `${Math.max((v / maxDay) * 100, v > 0 ? 6 : 3)}%`,
                      borderRadius: '999px',
                      background: isActive ? 'linear-gradient(180deg, #6D5DF0, #3F34C4)' : v > 0 ? 'linear-gradient(180deg, #C7B6F7, #E0D8FA)' : 'var(--color-surface-muted)',
                      transition: 'background 0.2s ease',
                    }} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem', fontSize: '10px', fontWeight: 600, color: 'var(--color-text-tertiary)' }}>
              <span>1.</span><span>{Math.round(trend.daysInMonth / 2)}.</span><span>{trend.daysInMonth}.</span>
            </div>
          </div>
        </>
      )}

      {/* Buchungen */}
      {viewMode === 'DAILY' && (
        <div style={CARD}>
          <h3 style={{ ...cardTitle, marginBottom: '1rem' }}>Buchungen</h3>
          {groupedByDay.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {groupedByDay.map(([date, items]) => {
                const dayOut = items.filter(i => i.type === 'EXPENSE').reduce((s, i) => s + i.amount, 0);
                return (
                  <div key={date}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                      <span style={{ fontSize: 'var(--font-xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {new Date(date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                      </span>
                      {dayOut > 0 && <span style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-text-tertiary)' }}>−{fmt0(dayOut)}</span>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {items.map(item => renderItemRow(item, item.type === 'INCOME' ? '#43C773' : categoryColor(item.category)))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)', margin: '1.5rem 0' }}>Keine Buchungen vorhanden</p>
          )}
        </div>
      )}

      {/* Größte Veränderungen */}
      {visibleTrends.length > 0 && (
        <div style={CARD}>
          <h3 style={cardTitle}>Größte Veränderungen</h3>
          <p style={{ ...cardSub, marginBottom: '0.9rem' }}>im Vergleich zum 3-Monats-Schnitt</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            {visibleTrends.map(t => {
              const isDown = t.changePct < 0;
              const tone = isDown ? '#43C773' : '#F04444';
              const Icon = CATEGORY_ICONS[t.category] || Tag;
              return (
                <div key={t.category} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={iconChip('#6D5DF0')}><Icon size={18} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700 }}>{t.category}</div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>{fmt0(t.current)} · Ø {fmt0(t.avg)}</div>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.25rem 0.6rem', borderRadius: '999px', background: tone + '1F', color: tone, fontSize: 'var(--font-xs)', fontWeight: 800 }}>
                    {isDown ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                    {Math.abs(Math.round(t.changePct))}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <PageBottomBar
        left={[{ key: 'new-month', label: 'Neuer Monat', icon: CalendarPlus, onClick: handleNewMonth }]}
        right={[{ key: 'income', label: 'Einnahme', icon: Plus, onClick: () => setShowForm({ show: true, type: 'INCOME' }) }]}
        fab={{ label: 'Neue Ausgabe', icon: Minus, onClick: () => setShowForm({ show: true, type: 'EXPENSE' }) }}
      />

      {showForm.show && (
        <ExpenseForm
          type={showForm.type}
          currentMonth={currentMonth}
          onClose={() => setShowForm({ ...showForm, show: false })}
        />
      )}

      {itemToDelete && createPortal(
        <div style={modalBackdrop} onClick={() => setItemToDelete(null)}>
          <div style={modalCard} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: 'var(--font-xl)', fontWeight: 800 }}>Eintrag löschen?</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-base)', margin: '0 0 1.5rem 0' }}>
              Möchtest du diesen Eintrag von <strong>{fmt2(itemToDelete.amount)}</strong> wirklich unwiderruflich löschen?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <button
                onClick={() => { mockDb.deleteExpense(itemToDelete.id); setItemToDelete(null); }}
                style={{ ...modalPrimaryBtn, background: 'var(--color-danger)' }}
              >
                Endgültig löschen
              </button>
              <button onClick={() => setItemToDelete(null)} style={modalSecondaryBtn}>Abbrechen</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showConfirmNewMonth && createPortal(
        <div style={modalBackdrop} onClick={() => setShowConfirmNewMonth(false)}>
          <div style={modalCard} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: 'var(--font-xl)', fontWeight: 800 }}>Neuer Monat?</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-base)', margin: '0 0 1.25rem 0' }}>
              Möchtest du wirklich zum nächsten Monat wechseln?
            </p>
            {stats.balance > 0 && (
              <div style={{ background: 'var(--color-surface-muted)', color: 'var(--color-primary)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontSize: 'var(--font-sm)', fontWeight: 600 }}>
                Der Überschuss von <strong>{fmt2(stats.balance)}</strong> wird automatisch übernommen.
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <button onClick={executeNewMonth} style={{ ...modalPrimaryBtn, background: 'linear-gradient(135deg, #6D5DF0, #3F34C4)' }}>
                Ja, jetzt wechseln
              </button>
              <button onClick={() => setShowConfirmNewMonth(false)} style={modalSecondaryBtn}>Abbrechen</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};
