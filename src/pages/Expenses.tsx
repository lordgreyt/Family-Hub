import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, Minus, Calculator, Wallet, TrendingDown, TrendingUp, Check, X, Menu, LayoutGrid, PieChart, Tag, ChevronDown, CalendarPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';
import type { ExpenseItem, ExpenseBudget } from '../services/mockDb';
import { ExpenseForm, CATEGORIES } from '../components/Expenses/ExpenseForm';

const LONG_PRESS_MS = 600;

export const Expenses = () => {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [showForm, setShowForm] = useState<{ show: boolean, type: 'INCOME' | 'EXPENSE' }>({ show: false, type: 'EXPENSE' });
  const [expenses, setExpenses] = useState<ExpenseItem[]>(mockDb.getExpenses());
  const [budgets, setBudgets] = useState(mockDb.getExpenseBudgets());
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [tempBudget, setTempBudget] = useState('');
  const [viewMode, setViewMode] = useState<'CHART' | 'DAILY' | 'CATEGORY'>('CHART');
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
    const budgetProgress = stats.budgetUsed / 100;

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

  // SVG Pie Chart Logic
  const chartData = Object.entries(stats.byCategory).map(([name, value]) => ({ name, value }));
  const totalCategoryVal = chartData.reduce((sum, d) => sum + d.value, 0);
  
  let cumulativePercent = 0;
  const colors = [
    '#6366f1', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', 
    '#8b5cf6', '#64748b', '#14b8a6', '#f472b6', '#3b82f6',
    '#6366f1', '#ec4899', '#10b981', '#f59e0b', '#06b6d4'
  ];

  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  return (
    <div style={{ paddingBottom: '8rem' }}>
      {/* Success Banner */}
      {successMessage && (
        <div className="glass-panel" style={{
          marginBottom: '0.75rem',
          padding: '0.65rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          animation: 'fadeIn 0.3s ease',
        }}>
          <span style={{ fontSize: '1.2rem' }}>{successMessage.emoji}</span>
          <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--color-text)', flex: 1 }}>
            {successMessage.text}
          </span>
        </div>
      )}

      {/* Header with Navigation */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '0.75rem',
        padding: '0 0.5rem'
      }}>
        <button className="btn-icon" onClick={handlePrevMonth}><ChevronLeft size={24} /></button>
        <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-primary)' }}>{formatDate(currentMonth)}</h2>
        <button className="btn-icon" onClick={handleNextMonth}><ChevronRight size={24} /></button>
      </div>

      {/* Main Stats Card */}
      <div className="glass-panel" style={{ padding: '0.75rem 1.25rem', textAlign: 'center', marginBottom: '1rem' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.65rem', marginBottom: '0.1rem', fontWeight: 600, letterSpacing: '0.05em' }}>FIXBETRAG</p>
        
        {isEditingBudget ? (
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
            <button className="btn-icon" onClick={() => setIsEditingBudget(false)} style={{ color: 'var(--color-text-muted)' }}>
              <X size={18} />
            </button>
            <input 
              type="number" 
              value={tempBudget} 
              onChange={e => setTempBudget(e.target.value)}
              className="input-field"
              style={{ maxWidth: '90px', textAlign: 'center', fontSize: '1rem', padding: '0.3rem' }}
              autoFocus
            />
            <button className="btn-icon" onClick={handleSaveBudget} style={{ color: 'var(--color-success)' }}>
              <Check size={22} />
            </button>
          </div>
        ) : (
          <div 
            onMouseDown={() => startPress(() => { setTempBudget(currentBudget.toString()); setIsEditingBudget(true); })}
            onMouseUp={cancelPress}
            onMouseLeave={cancelPress}
            onTouchStart={() => startPress(() => { setTempBudget(currentBudget.toString()); setIsEditingBudget(true); })}
            onTouchEnd={cancelPress}
            style={{ 
              display: 'inline-block',
              cursor: 'pointer',
              userSelect: 'none',
              padding: '0.1rem 0.5rem',
              borderRadius: 'var(--radius-md)',
              transition: 'background-color 0.2s'
            }}
          >
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
              {currentBudget.toFixed(2)}€
            </h2>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
          <div style={{ padding: '0.4rem', backgroundColor: 'var(--color-primary)', borderRadius: 'var(--radius-md)', border: 'none' }}>
            <p style={{ margin: 0, fontSize: '0.6rem', color: 'white', fontWeight: 700, opacity: 0.9 }}>AUSGABEN</p>
            <p style={{ margin: '0', fontSize: '0.9rem', fontWeight: 700 }}>-{stats.totalOut.toFixed(2)}€</p>
          </div>
          <div style={{ padding: '0.4rem', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
            <p style={{ margin: 0, fontSize: '0.6rem', color: 'var(--color-text-muted)', fontWeight: 700, opacity: 0.7 }}>EINNAHMEN</p>
            <p style={{ margin: '0', fontSize: '0.9rem', fontWeight: 700 }}>+{stats.totalIn.toFixed(2)}€</p>
          </div>
        </div>

        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem', marginBottom: '0.5rem', fontWeight: 500 }}>BUDGET</p>

          {/* Budget Progress Ring */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
            <button
              onClick={() => setViewMode(viewMode === 'CHART' ? 'DAILY' : 'CHART')}
              style={{ color: 'var(--color-text-muted)', padding: '0.5rem', opacity: 0.6, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <Menu size={18} />
            </button>

            <div style={{ position: 'relative', width: '140px', height: '140px' }}>
              <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                {/* Background circle */}
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--color-border)" strokeWidth="4.5" />
                {/* Progress arc */}
                <circle
                  cx="18" cy="18" r="15.5" fill="none"
                  stroke="var(--color-primary)"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeDasharray={`${Math.min(stats.budgetUsed, 100) * 0.974} 97.4`}
                  style={{ transition: 'stroke-dasharray 0.6s ease' }}
                />
                {/* Milestone dots */}
                {[25, 50, 75, 100].map(pct => {
                  const angle = (pct / 100) * 2 * Math.PI - Math.PI / 2;
                  const dotX = 18 + 15.5 * Math.cos(angle);
                  const dotY = 18 + 15.5 * Math.sin(angle);
                  const passed = stats.budgetUsed >= pct;
                  return (
                    <circle key={pct} cx={dotX} cy={dotY} r="2"
                      fill={passed ? 'var(--color-primary)' : 'var(--color-border)'}
                      style={{ transition: 'fill 0.4s ease' }}
                    />
                  );
                })}
              </svg>
              {/* Center text */}
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{
                  fontSize: '1.4rem', fontWeight: 800,
                  color: 'var(--color-primary)',
                  lineHeight: 1,
                }}>
                  {Math.round(stats.budgetUsed)}%
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  {stats.balance >= 0 ? `+${stats.balance.toFixed(0)}€` : `${stats.balance.toFixed(0)}€`}
                </span>
                {underBudgetStreak >= 3 && (
                  <span style={{ fontSize: '0.8rem', marginTop: '1px' }}>🔥</span>
                )}
              </div>
            </div>

            <button
              onClick={() => {
                if (viewMode === 'CHART') setViewMode('DAILY');
                else if (viewMode === 'DAILY') setViewMode('CATEGORY');
                else setViewMode('CHART');
              }}
              style={{ color: 'var(--color-text-muted)', padding: '0.5rem', opacity: 0.6, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {viewMode === 'CHART' ? <Menu size={18} /> : viewMode === 'DAILY' ? <Tag size={18} /> : <PieChart size={18} />}
            </button>
          </div>
          {underBudgetStreak >= 3 && (
            <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.6rem', fontWeight: 600, color: 'var(--color-success)', textAlign: 'center' }}>
              {underBudgetStreak} Monate in Folge im Plus!
            </p>
          )}
        </div>
      </div>

      {/* Dynamic View Content */}
      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
        {viewMode === 'CHART' && (
          <>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
              <TrendingDown size={18} color="var(--color-danger)" /> Ausgaben nach Kategorien
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {[...chartData].sort((a,b) => b.value - a.value).map((d, i) => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: colors[chartData.indexOf(d) % colors.length] }} />
                  <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</span>
                  <span style={{ fontWeight: 600 }}>{(Number(d.value) || 0).toFixed(0)}€</span>
                </div>
              ))}
            </div>
          </>
        )}

        {viewMode === 'DAILY' && (
          <div>
            <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
              Tägliche Übersicht
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {groupedByDay.length > 0 ? groupedByDay.map(([date, items]) => (
                <div key={date}>
                  <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '0.5rem', borderLeft: '3px solid var(--color-primary)', paddingLeft: '0.5rem' }}>
                    {new Date(date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {items.map(item => (
                      <div 
                        key={item.id} 
                        onMouseDown={() => startPress(() => setItemToDelete(item))}
                        onMouseUp={cancelPress}
                        onMouseLeave={cancelPress}
                        onTouchStart={() => startPress(() => setItemToDelete(item))}
                        onTouchEnd={cancelPress}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}
                      >
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 600, display: 'block' }}>{item.category}</span>
                          {item.description && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{item.description}</span>}
                        </div>
                        <span style={{ 
                          fontWeight: 700, 
                          color: item.type === 'INCOME' ? 'var(--color-success)' : 'var(--color-text)',
                          whiteSpace: 'nowrap'
                        }}>
                          {item.type === 'INCOME' ? '+' : '-'}{item.amount.toFixed(2)}€
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )) : (
                <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '2rem' }}>Keine Buchungen vorhanden</p>
              )}
            </div>
          </div>
        )}

        {viewMode === 'CATEGORY' && (
          <div>
            <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
              Ausgaben nach Kategorien
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {chartData.length > 0 ? chartData.sort((a,b) => b.value - a.value).map((d, index) => {
                const isExpanded = expandedCategory === d.name;
                const categoryItems = monthExpenses.filter(e => e.category === d.name);
                
                return (
                  <div key={d.name} style={{ borderBottom: '1px solid var(--color-border-hover)', paddingBottom: '0.5rem' }}>
                    <div 
                      onClick={() => setExpandedCategory(isExpanded ? null : d.name)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.75rem', 
                        padding: '0.5rem 0',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ 
                        width: '28px', 
                        height: '28px', 
                        borderRadius: '6px', 
                        backgroundColor: colors[index % colors.length] + '20',
                        color: colors[index % colors.length],
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}>
                        {index + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{d.name}</span>
                          <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{d.value.toFixed(2)}€</span>
                        </div>
                        <div style={{ width: '100%', height: '3px', backgroundColor: 'var(--color-border)', borderRadius: '2px', marginTop: '4px', position: 'relative' }}>
                          <div style={{ 
                            width: `${(d.value / totalCategoryVal) * 100}%`, 
                            height: '100%', 
                            backgroundColor: colors[index % colors.length],
                            borderRadius: '2px'
                          }} />
                        </div>
                      </div>
                      <ChevronDown 
                        size={16} 
                        style={{ 
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', 
                          transition: 'transform 0.2s',
                          color: 'var(--color-text-muted)'
                        }} 
                      />
                    </div>
                    
                    {isExpanded && (
                      <div style={{ 
                        marginTop: '0.5rem', 
                        padding: '0.5rem', 
                        backgroundColor: 'var(--color-surface-hover)', 
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        animation: 'fadeIn 0.2s ease'
                      }}>
                        {categoryItems.map(item => (
                          <div 
                            key={item.id} 
                            onMouseDown={() => startPress(() => setItemToDelete(item))}
                            onMouseUp={cancelPress}
                            onMouseLeave={cancelPress}
                            onTouchStart={() => startPress(() => setItemToDelete(item))}
                            onTouchEnd={cancelPress}
                            style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', cursor: 'pointer', userSelect: 'none' }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span>{new Date(item.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</span>
                              {item.description && <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>{item.description}</span>}
                            </div>
                            <span style={{ fontWeight: 600 }}>{item.type === 'INCOME' ? '+' : '-'}{item.amount.toFixed(2)}€</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }) : (
                <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '2rem' }}>Keine Daten für diesen Monat</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Category Trend Arrows — Top 5 by change */}
      {categoryTrends.filter(t => Math.abs(t.changePct) >= 5).length > 0 && (
        <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--color-text)' }}>
            <TrendingDown size={16} color="var(--color-primary)" /> Größte Veränderungen
            <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 400, marginLeft: '0.25rem' }}>(vs. 3-Monats-Schnitt)</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {categoryTrends.filter(t => Math.abs(t.changePct) >= 5).slice(0, 5).map(t => {
              const isDown = t.changePct < 0;
              return (
                <div key={t.category} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.45rem 0',
                  borderBottom: '1px solid var(--color-border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: '0.15rem',
                      fontSize: '0.75rem', fontWeight: 700,
                      color: isDown ? 'var(--color-success)' : 'var(--color-danger)',
                    }}>
                      {isDown ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                      {Math.abs(Math.round(t.changePct))}%
                    </span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-text)' }}>{t.category}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      {t.current.toFixed(0)}€
                    </span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', marginLeft: '0.3rem' }}>
                      Ø {t.avg.toFixed(0)}€
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fixed Footer with Buttons */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--color-primary-gradient)',
        height: '40px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.4)',
        zIndex: 100,
        paddingBottom: 'calc(0.5rem + safe-area-inset-bottom)'
      }}>
        <button
          onClick={handleNewMonth}
          style={{
            position: 'absolute',
            left: '1.25rem',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
          }}>
          <CalendarPlus size={16} />
          <span style={{ fontSize: '0.55rem', fontWeight: 600 }}>NEUER MONAT</span>
        </button>

        <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '1.5rem' }}>
          <button
            onClick={() => setShowForm({ show: true, type: 'INCOME' })}
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              border: '4px solid var(--color-background)',
              boxShadow: '0 8px 24px rgba(79, 70, 229, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'transform 0.2s ease',
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <Plus size={32} strokeWidth={3} />
          </button>
          <button
            onClick={() => setShowForm({ show: true, type: 'EXPENSE' })}
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              border: '4px solid var(--color-background)',
              boxShadow: '0 8px 24px rgba(79, 70, 229, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'transform 0.2s ease',
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <Minus size={32} strokeWidth={3} />
          </button>
        </div>
      </div>

      {showForm.show && (
        <ExpenseForm 
          type={showForm.type} 
          currentMonth={currentMonth}
          onClose={() => setShowForm({ ...showForm, show: false })} 
        />
      )}

      {itemToDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2rem', textAlign: 'center', animation: 'fadeIn 0.2s ease' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', marginBottom: '1rem' }}>Eintrag löschen?</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
              Möchtest du diesen Eintrag von <strong>{itemToDelete.amount.toFixed(2)}€</strong> wirklich unwiderruflich löschen?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button 
                className="btn" 
                onClick={() => {
                  mockDb.deleteExpense(itemToDelete.id);
                  setItemToDelete(null);
                }}
                style={{ backgroundColor: 'var(--color-danger)', color: 'white', border: 'none', height: '48px', fontWeight: 600, cursor: 'pointer' }}
              >
                Endgültig löschen
              </button>
              <button 
                className="btn" 
                onClick={() => setItemToDelete(null)}
                style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', height: '48px', cursor: 'pointer' }}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmNewMonth && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2rem', textAlign: 'center', animation: 'fadeIn 0.2s ease' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', marginBottom: '1rem' }}>Neuer Monat?</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Möchtest du wirklich zum nächsten Monat wechseln? 
            </p>
            
            {stats.balance > 0 && (
              <div style={{ 
                backgroundColor: 'var(--color-primary-light)', 
                color: 'var(--color-primary)', 
                padding: '1rem', 
                borderRadius: 'var(--radius-md)', 
                marginBottom: '2rem',
                fontSize: '0.85rem',
                fontWeight: 600
              }}>
                Der Überschuss von <strong>{stats.balance.toFixed(2)}€</strong> wird automatisch übernommen.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button 
                className="btn" 
                onClick={executeNewMonth}
                style={{ backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', height: '48px', fontWeight: 600, cursor: 'pointer' }}
              >
                Ja, jetzt wechseln
              </button>
              <button 
                className="btn" 
                onClick={() => setShowConfirmNewMonth(false)}
                style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', height: '48px', cursor: 'pointer' }}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
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
