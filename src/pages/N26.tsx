import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Landmark, History, Settings,
  Plus, Trash2, X, Delete, ArrowRight, Calendar, FileText, ChevronRight,
  TrendingDown, TrendingUp, PieChart as PieChartIcon
} from 'lucide-react';
import { mockDb } from '../services/mockDb';
import type { Depot, DepotTransaction, ExpenseItem } from '../services/mockDb';
import { PageBottomBar } from '../components/Layout/PageBottomBar';

type Tab = 'dashboard' | 'depots' | 'historie' | 'settings';

export const N26 = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showAddDepotForm, setShowAddDepotForm] = useState(false);
  const [editingDepot, setEditingDepot] = useState<Depot | null>(null);
  
  // Data State
  const [depots, setDepots] = useState<Depot[]>([]);
  const [transactions, setTransactions] = useState<DepotTransaction[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [budgetSurplus, setBudgetSurplus] = useState<number | null>(null);

  useEffect(() => {
    if (user && user.id !== 'Falko') {
      navigate('/');
    }
    loadData();
    
    // Auto-booking check
    const settings = mockDb.getN26Settings();
    if (settings.autoBookingEnabled) {
      const now = new Date();
      const currentDay = now.getDate();
      const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      if (currentDay >= settings.bookingDay && settings.lastAutoBookingMonth !== currentMonthStr) {
        mockDb.executeMonthlyBookings(new Date().toISOString().split('T')[0], true);
        loadData(); // Reload to show new bookings
      }
    }

    // Jan 1st Year Closing Check (Automatic)
    const now = new Date();
    if (now.getMonth() === 0 && now.getDate() === 1) {
      const prevYear = now.getFullYear() - 1;
      const closedYears = settings.closedYears || [];
      if (!closedYears.includes(prevYear)) {
        mockDb.closeYear(prevYear);
        loadData();
      }
    }

    window.addEventListener('db_updated', loadData);
    return () => window.removeEventListener('db_updated', loadData);
  }, [user, navigate]);

  const loadData = () => {
    setDepots(mockDb.getDepots());
    setTransactions(mockDb.getDepotTransactions());
    setExpenses(mockDb.getExpenses());
    updateBudgetSurplus();
  };

  const updateBudgetSurplus = () => {
    const localDepots = mockDb.getDepots();
    const fixedDepotAmount = localDepots.reduce((sum, d) => sum + (d.monthlyAmount || 0), 0);

    const budgetItems = mockDb.getBudgetItems();
    const totalIncome = budgetItems.filter(i => i.type === 'INCOME').reduce((t, i) => t + i.amount, 0);
    const totalExpense = budgetItems.filter(i => i.type === 'EXPENSE').reduce((t, i) => t + i.amount, 0) + fixedDepotAmount;
    setBudgetSurplus(totalIncome - totalExpense);
  };

  const calculateBalance = (depot: Depot) => {
    const depotTxs = transactions.filter(t => t.depotId === (depot?.id || ''));
    const txSum = depotTxs.reduce((sum, t) => sum + t.amount, 0);
    return (depot?.startBalance || 0) + txSum;
  };

  if (!user || user.id !== 'Falko') {
    return null;
  }

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'depots', label: 'Depots', icon: Landmark },
    { id: 'historie', label: 'Historie', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      position: 'relative',
      paddingBottom: 'calc(var(--tabbar-height) + 1.5rem)', 
      overflowY: 'auto'
    }}>
      {/* Content Area */}
      <div style={{ flex: 1 }}>
        {activeTab === 'dashboard' && (
          <DashboardView 
            depots={depots} 
            calculateBalance={calculateBalance} 
            surplus={budgetSurplus}
            transactions={transactions}
          />
        )}
        {activeTab === 'depots' && (
          <DepotsView
            depots={depots}
            transactions={transactions}
            calculateBalance={calculateBalance}
            onDelete={(id) => mockDb.deleteDepot(id)}
            onAdd={() => setShowAddDepotForm(true)}
            onEdit={(depot) => setEditingDepot(depot)}
          />
        )}
        {activeTab === 'historie' && (
          <HistorieView 
            transactions={transactions} 
            depots={depots} 
            onDelete={(id) => mockDb.deleteDepotTransaction(id)} 
          />
        )}
        {activeTab === 'settings' && <SettingsView transactions={transactions} />}
      </div>

      {/* Booking Form Overlay */}
      {showBookingForm && (
        <BookingForm 
          depots={depots} 
          onClose={() => setShowBookingForm(false)} 
          onSave={(data) => {
            if (Array.isArray(data)) {
              data.forEach(tx => mockDb.addDepotTransaction(tx));
            } else {
              mockDb.addDepotTransaction(data);
            }
            setShowBookingForm(false);
          }}
        />
      )}

      {/* Depot Form Overlay (Add/Edit) */}
      {(showAddDepotForm || editingDepot) && (
        <DepotForm 
          initialDepot={editingDepot || undefined}
          onClose={() => {
            setShowAddDepotForm(false);
            setEditingDepot(null);
          }}
          onSave={(name, monthly, start) => {
            if (editingDepot) {
              mockDb.updateDepot({ ...editingDepot, name, monthlyAmount: monthly, startBalance: start });
            } else {
              mockDb.addDepot({ name, monthlyAmount: monthly, startBalance: start });
            }
            setShowAddDepotForm(false);
            setEditingDepot(null);
          }}
        />
      )}

      <PageBottomBar
        left={tabs.slice(0, 2).map(({ id, label, icon }) => ({
          key: id, label, icon, active: activeTab === id, onClick: () => setActiveTab(id as Tab),
        }))}
        right={tabs.slice(2).map(({ id, label, icon }) => ({
          key: id, label, icon, active: activeTab === id, onClick: () => setActiveTab(id as Tab),
        }))}
        fab={{ label: 'Neue Buchung', icon: Plus, onClick: () => setShowBookingForm(true) }}
      />
    </div>
  );
};

// --- Sub-Views ---

// --- Sub-Views ---

const DashboardView = ({ depots, calculateBalance, surplus, transactions }: { depots: Depot[], calculateBalance: (d: Depot) => number, surplus: number | null, transactions: DepotTransaction[] }) => {
  const totalBalance = depots.reduce((sum, d) => sum + (calculateBalance(d) || 0), 0);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentYear = new Date().getFullYear();
  
  const monthTransactions = transactions.filter(t => t.date.startsWith(currentMonth) && t.amount < 0);
  
  const bookingData = useMemo(() => {
    const grouped: Record<string, number> = {};
    monthTransactions.forEach(t => {
      const depot = depots.find(d => d.id === t.depotId);
      const name = depot?.name || 'Unbekannt';
      grouped[name] = (grouped[name] || 0) + Math.abs(t.amount);
    });
    return Object.entries(grouped).map(([label, value]) => ({ label, value }));
  }, [monthTransactions, depots]);

  const depotData = useMemo(() => {
    return depots.map(d => ({ label: d.name, value: d.monthlyAmount })).filter(d => d.value > 0);
  }, [depots]);

  const yearlyData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    return months.map((month, i) => {
      const monthStr = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
      const sum = transactions
        .filter(t => t.date.startsWith(monthStr) && t.amount < 0)
        .reduce((s, t) => s + Math.abs(t.amount), 0);
      return { label: month, value: sum };
    });
  }, [transactions, currentYear]);

  const depotBalanceData = useMemo(() => {
    return depots.map(d => ({
      label: d.name,
      value: calculateBalance(d)
    }));
  }, [depots, transactions]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Monthly Expenses Chart */}
      <div className="glass-panel" style={{ ...chartCardStyle, }}>
        <ChartHeader
          title="Ausgaben Übersicht"
          subtitle={`Monatliche Ausgaben im Jahr ${currentYear}`}
          right={<Pill color="var(--color-danger)">Ø {Math.round(yearlyData.reduce((s, d) => s + d.value, 0) / (new Date().getMonth() + 1)).toLocaleString('de-DE')}€</Pill>}
        />
        <BarChart data={yearlyData} />
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
        <div className="glass-panel" style={{ 
          flex: 1, minWidth: 0, padding: '1.25rem', 
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #3F34C4 0%, #6D5DF0 55%, #F2A9BE 130%)', 
          color: 'white', border: 'none', boxShadow: '0 10px 24px rgba(63, 52, 196, 0.28)' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', opacity: 0.8, fontSize: 'var(--font-xs)', fontWeight: 600, marginBottom: '0.4rem' }}>
            <Landmark size={12} /> RÜCKLAGEN
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'inherit', whiteSpace: 'nowrap' }}>
            {totalBalance.toLocaleString('de-DE', { minimumFractionDigits: 0 })}€
          </div>
        </div>
        <div className="glass-panel" style={{
          flex: 1, minWidth: 0, padding: '1.25rem',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: 'var(--color-primary)', fontSize: 'var(--font-xs)', fontWeight: 600, marginBottom: '0.4rem' }}>
            {surplus !== null && surplus >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} ÜBERSCHUSS
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: surplus !== null && surplus >= 0 ? 'var(--color-success)' : 'var(--color-danger)', whiteSpace: 'nowrap' }}>
            {surplus !== null ? `${surplus.toLocaleString('de-DE', { minimumFractionDigits: 0 })}€` : '...'}
          </div>
        </div>
      </div>

      {/* Depot Balance Chart */}
      <DepotBalanceChart depots={depots} calculateBalance={calculateBalance} />

      {/* Buchungen */}
      <DonutCard
        title="Buchungen (Ausgaben)"
        subtitle={`${monthTransactions.length} Buchungen in diesem Monat`}
        pill={`${Math.abs(monthTransactions.reduce((s, t) => s + t.amount, 0)).toLocaleString('de-DE')}€`}
        data={bookingData}
      />

      {/* Monatliche Einzahlung */}
      <DonutCard
        title="Monatliche Einzahlung"
        subtitle={`${depots.length} Depots`}
        pill={`${depots.reduce((s, d) => s + (d.monthlyAmount || 0), 0).toLocaleString('de-DE')}€`}
        data={depotData}
      />
    </div>
  );
};

const DepotsView = ({ depots, transactions, calculateBalance, onDelete, onAdd, onEdit }: { depots: Depot[], transactions: DepotTransaction[], calculateBalance: (d: Depot) => number, onDelete: (id: string) => void, onAdd: () => void, onEdit: (d: Depot) => void }) => {
  const [sortBy, setSortBy] = useState<'name' | 'balance' | 'monthly'>('name');
  const [isAsc, setIsAsc] = useState(true);

  const sortedDepots = useMemo(() => {
    return [...depots].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = (a.name || '').localeCompare(b.name || '');
      } else if (sortBy === 'balance') {
        comparison = calculateBalance(a) - calculateBalance(b);
      } else if (sortBy === 'monthly') {
        comparison = (a.monthlyAmount || 0) - (b.monthlyAmount || 0);
      }
      return isAsc ? comparison : -comparison;
    });
  }, [depots, sortBy, isAsc, calculateBalance]);

  const toggleSort = (key: 'name' | 'balance' | 'monthly') => {
    if (sortBy === key) {
      setIsAsc(!isAsc);
    } else {
      setSortBy(key);
      setIsAsc(true);
    }
  };

  const SortChip = ({ id, label }: { id: 'name' | 'balance' | 'monthly', label: string }) => {
    const active = sortBy === id;
    return (
      <button
        onClick={() => toggleSort(id)}
        style={{
          padding: '0.4rem 0.8rem',
          borderRadius: '20px',
          fontSize: '11px',
          fontWeight: 700,
          border: '1px solid',
          borderColor: active ? 'var(--color-primary)' : 'var(--color-border)',
          backgroundColor: active ? 'var(--color-primary-light)' : 'var(--color-surface)',
          color: active ? 'white' : 'var(--color-text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          whiteSpace: 'nowrap'
        }}
      >
        {label}
        {active && (isAsc ? <TrendingUp size={12} /> : <TrendingDown size={12} />)}
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-primary)', margin: 0 }}>Meine Depots</h2>
        <button 
          onClick={onAdd}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.4rem', 
            padding: '0.5rem 1rem', 
            backgroundColor: 'var(--color-primary)', 
            color: 'white', 
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-xs)',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <Plus size={14} /> NEU
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', WebkitOverflowScrolling: 'touch' }}>
        <SortChip id="name" label="Alphabetisch" />
        <SortChip id="balance" label="Guthaben" />
        <SortChip id="monthly" label="Sparbetrag" />
      </div>

      {sortedDepots.map(depot => (
        <DepotCard
          key={depot.id}
          depot={depot}
          balance={calculateBalance(depot)}
          transactions={transactions}
          onDelete={onDelete}
          onEdit={() => onEdit(depot)}
        />
      ))}
    </div>
  );
};

const DepotCard = ({ depot, balance, transactions, onDelete, onEdit }: { depot: Depot, balance: number, transactions: DepotTransaction[], onDelete: (id: string) => void, onEdit: () => void }) => {
  const [isPressing, setIsPressing] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const wasLongPress = useRef(false);

  const recentTransactions = useMemo(() => {
    return transactions
      .filter(t => t.depotId === depot.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [transactions, depot.id]);

  const startPress = () => {
    wasLongPress.current = false;
    setIsPressing(true);
    timerRef.current = setTimeout(() => {
      wasLongPress.current = true;
      setShowActions(true);
      setIsPressing(false);
    }, 500);
  };

  const endPress = () => {
    setIsPressing(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleClick = () => {
    if (wasLongPress.current) return;
    if (showActions) {
      setShowActions(false);
      return;
    }
    setExpanded(v => !v);
  };

  // Close popover on outside click
  useEffect(() => {
    if (!showActions) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setShowActions(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [showActions]);

  const handleEdit = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setShowActions(false);
    onEdit();
  };

  const handleDelete = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setShowActions(false);
    if (confirm(`Depot "${depot.name}" wirklich löschen?`)) onDelete(depot.id);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  return (
    <div ref={cardRef} style={{ position: 'relative' }}>
      {/* Action Popover */}
      {showActions && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: '1rem',
          marginTop: '0.25rem',
          zIndex: 50,
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
          animation: 'slideDown 0.15s ease',
          minWidth: '160px',
        }}>
          <button
            onClick={handleEdit}
            onTouchEnd={handleEdit}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem',
              width: '100%', padding: '0.7rem 1rem',
              border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 'var(--font-sm)', fontWeight: 500,
              color: 'var(--color-text)',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            Bearbeiten
          </button>
          <button
            onClick={handleDelete}
            onTouchEnd={handleDelete}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem',
              width: '100%', padding: '0.7rem 1rem',
              border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 'var(--font-sm)', fontWeight: 500,
              color: 'var(--color-danger)',
            }}
          >
            Löschen
          </button>
        </div>
      )}

      <div
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onClick={handleClick}
        style={{
          padding: '0.75rem 1.25rem',
          backgroundColor: 'var(--color-surface)',
          borderRadius: expanded ? 'var(--radius-lg) var(--radius-lg) 0 0' : 'var(--radius-lg)',
          border: '1px solid',
          borderColor: isPressing || expanded ? 'var(--color-primary)' : 'var(--color-border)',
          borderBottom: expanded ? 'none' : undefined,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
          boxShadow: 'var(--shadow-sm)',
          transition: 'all 0.2s ease',
          transform: isPressing ? 'scale(0.98)' : 'scale(1)',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {/* Top Row: Name and Balance */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '0.5rem' }}>{depot.name || 'Unbekannt'}</h3>
          <span style={{ fontSize: '15px', fontWeight: 800, color: balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)', flexShrink: 0 }}>
            {balance.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
          </span>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '0.25rem 0', opacity: 0.5 }} />

        {/* Bottom Row: Count + Monthly Payment */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', opacity: 0.6, minWidth: '3.5rem' }}>
              {recentTransactions.length > 0 ? `${recentTransactions.length} Buch.` : '0 Buch.'}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              MTL. Einzahlung
            </span>
          </div>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>
            {(depot.monthlyAmount || 0).toLocaleString('de-DE')} €
          </span>
        </div>
      </div>

      {/* Expanded Transactions */}
      {expanded && recentTransactions.length > 0 && (
        <div style={{
          backgroundColor: 'var(--color-background)',
          borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
          border: '1px solid var(--color-primary)',
          borderTop: 'none',
          overflow: 'hidden',
          animation: 'slideDown 0.2s ease',
        }}>
          {recentTransactions.map((tx, i) => (
            <div
              key={tx.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.55rem 1.25rem',
                borderBottom: i < recentTransactions.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text)' }}>
                  {tx.note || 'Buchung'}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                  {formatDate(tx.date)}
                  {tx.isAutomated && (
                    <span style={{ marginLeft: '0.4rem', color: 'var(--color-primary)', fontWeight: 600 }}>Auto</span>
                  )}
                </span>
              </div>
              <span style={{
                fontSize: '13px',
                fontWeight: 700,
                color: tx.amount >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
              }}>
                {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
              </span>
            </div>
          ))}
        </div>
      )}

      {expanded && recentTransactions.length === 0 && (
        <div style={{
          backgroundColor: 'var(--color-background)',
          borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
          border: '1px solid var(--color-primary)',
          borderTop: 'none',
          padding: '1rem',
          textAlign: 'center',
          fontSize: '12px',
          color: 'var(--color-text-muted)',
          animation: 'slideDown 0.2s ease',
        }}>
          Noch keine Buchungen
        </div>
      )}
    </div>
  );
};



const HistorieView = ({ transactions, depots, onDelete }: { transactions: DepotTransaction[], depots: Depot[], onDelete: (id: string) => void }) => {
  const [showAutomated, setShowAutomated] = useState(false);
  const settings = mockDb.getN26Settings();
  const closedYears = settings.closedYears || [];
  
  const groupedByYear = useMemo(() => {
    const grouped: Record<number, DepotTransaction[]> = {};
    transactions.forEach(tx => {
      const year = new Date(tx.date).getFullYear();
      if (!showAutomated && (tx.isAutomated || tx.note?.includes('Sparrate'))) return;
      if (!grouped[year]) grouped[year] = [];
      grouped[year].push(tx);
    });
    
    // Sort transactions within years
    Object.keys(grouped).forEach(year => {
      grouped[Number(year)].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });
    
    return grouped;
  }, [transactions, showAutomated]);

  const years = Object.keys(groupedByYear).map(Number).sort((a, b) => b - a);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-primary)', margin: 0 }}>Buchungshistorie</h2>
        <button
          onClick={() => setShowAutomated(!showAutomated)}
          style={{
            padding: '0.4rem 0.8rem',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: 700,
            border: '1px solid',
            borderColor: !showAutomated ? 'var(--color-primary)' : 'var(--color-border)',
            backgroundColor: !showAutomated ? 'var(--color-primary-light)' : 'var(--color-surface)',
            color: !showAutomated ? 'white' : 'var(--color-text-muted)',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          {showAutomated ? 'Filter Aus' : 'Filter Ein'}
        </button>
      </div>

      {years.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>Keine Buchungen vorhanden.</div>
      ) : (
        years.map(year => (
          <YearGroup 
            key={year} 
            year={year} 
            isClosed={closedYears.includes(year)} 
            transactions={groupedByYear[year]} 
            depots={depots}
            onDelete={onDelete}
          />
        ))
      )}
    </div>
  );
};

const TransactionCard = ({ tx, depot, onDelete }: { tx: DepotTransaction, depot?: Depot, onDelete: (id: string) => void }) => {
  const [isPressing, setIsPressing] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const startPress = () => {
    setIsPressing(true);
    timerRef.current = setTimeout(() => {
      setShowActions(true);
      setIsPressing(false);
    }, 500);
  };
  const cancelPress = () => {
    setIsPressing(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  };
  useEffect(() => {
    if (!showActions) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) setShowActions(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [showActions]);

  const handleDelete = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setShowActions(false);
    if (confirm('Diese Buchung wirklich löschen?')) onDelete(tx.id);
  };

  return (
    <div ref={cardRef} style={{ position: 'relative' }}>
      {showActions && (
        <div style={{
          position: 'absolute', top: '100%', right: '1rem', marginTop: '0.25rem', zIndex: 50,
          backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)', border: '1px solid var(--color-border)',
          overflow: 'hidden', animation: 'slideDown 0.15s ease', minWidth: '160px',
        }}>
          <button
            onClick={handleDelete}
            onTouchEnd={handleDelete}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem',
              width: '100%', padding: '0.7rem 1rem', border: 'none', background: 'none',
              cursor: 'pointer', fontSize: 'var(--font-sm)', fontWeight: 500, color: 'var(--color-danger)',
            }}
          >
            Löschen
          </button>
        </div>
      )}
      <div
        onPointerDown={startPress}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        onClick={() => showActions && setShowActions(false)}
        style={{
          padding: '0.75rem 1.25rem', backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)', border: '1px solid',
          borderColor: isPressing ? 'var(--color-primary)' : 'var(--color-border)',
          display: 'flex', flexDirection: 'column', gap: '0.25rem',
          boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s ease',
          transform: isPressing ? 'scale(0.98)' : 'scale(1)',
          cursor: 'pointer', userSelect: 'none',
          opacity: (tx.isAutomated || tx.note?.includes('Sparrate')) ? 0.7 : 1,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '15px' }}>{depot?.name || 'Unbekannt'}</span>
          <span style={{ fontSize: '15px', fontWeight: 800, color: tx.amount >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
          </span>
        </div>
        <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '0.25rem 0', opacity: 0.5 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tx.note || 'Buchung'}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
            {new Date(tx.date).toLocaleDateString('de-DE')}
          </span>
        </div>
      </div>
    </div>
  );
};

const YearGroup = ({ year, isClosed, transactions, depots, onDelete }: { year: number, isClosed: boolean, transactions: DepotTransaction[], depots: Depot[], onDelete: (id: string) => void }) => {
  const [isExpanded, setIsExpanded] = useState(!isClosed);
  const currentYear = new Date().getFullYear();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          width: '100%', padding: '0.5rem 0.25rem', background: 'none', border: 'none', cursor: 'pointer'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '14px', fontWeight: 800, color: isExpanded ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
            Jahr {year} {isClosed && <span style={{ fontSize: '10px', color: 'var(--color-success)', marginLeft: '4px', fontWeight: 600 }}>(Abgeschlossen)</span>}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
            {transactions.length} Einträge
          </span>
        </div>
        <div style={{ color: 'var(--color-text-muted)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          <ChevronRight size={16} />
        </div>
      </button>

      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {transactions.map(tx => {
            const depot = depots.find(d => d.id === tx.depotId);
            return (
              <TransactionCard key={tx.id} tx={tx} depot={depot} onDelete={onDelete} />
            );
          })}
        </div>
      )}
    </div>
  );
};

const SettingsView = ({ transactions }: { transactions: DepotTransaction[] }) => {
  const [settings, setSettings] = useState(mockDb.getN26Settings());
  const [isManualBookingLoading, setIsManualBookingLoading] = useState(false);

  const lastBookingDate = useMemo(() => {
    const routineTxs = transactions.filter(t => t.note?.includes('Sparrate'));
    if (routineTxs.length === 0) return null;
    const sorted = [...routineTxs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return sorted[0].date;
  }, [transactions]);

  const handleToggleAuto = () => {
    const newSettings = { ...settings, autoBookingEnabled: !settings.autoBookingEnabled };
    setSettings(newSettings);
    mockDb.saveN26Settings(newSettings);
  };

  const handleDayChange = (day: number) => {
    if (day < 1 || day > 28) return;
    const newSettings = { ...settings, bookingDay: day };
    setSettings(newSettings);
    mockDb.saveN26Settings(newSettings);
  };

  const handleManualBooking = () => {
    if (confirm('Sollen jetzt alle monatlichen Raten gebucht werden?')) {
      setIsManualBookingLoading(true);
      setTimeout(() => {
        mockDb.executeMonthlyBookings(new Date().toISOString().split('T')[0], false);
        setIsManualBookingLoading(false);
        alert('Alle Raten wurden erfolgreich gebucht!');
      }, 500);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-primary)', margin: 0 }}>Einstellungen</h2>
      
      {/* Automation Card */}
      <div className="glass-panel" style={{ padding: '1.5rem', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Auto-Buchung</h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '12px', color: 'var(--color-text-muted)' }}>Monatliche Raten automatisch buchen</p>
          </div>
          <button 
            onClick={handleToggleAuto}
            style={{ 
              width: '50px', height: '26px', borderRadius: '13px', border: '1px solid var(--color-border)',
              backgroundColor: settings.autoBookingEnabled ? 'var(--color-success)' : 'var(--color-border)',
              position: 'relative', cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            <div style={{ 
              width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'white',
              position: 'absolute', top: '2px', left: settings.autoBookingEnabled ? '26px' : '2px',
              transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>Tag im Monat (1-28)</span>
          <input 
            type="number" 
            min="1" 
            max="28" 
            value={settings.bookingDay} 
            onChange={(e) => handleDayChange(parseInt(e.target.value))}
            style={{ 
              width: '60px', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
              textAlign: 'center', fontSize: '14px', fontWeight: 700
            }}
          />
        </div>
      </div>

      {/* Manual Actions Card */}
      <div className="glass-panel" style={{ padding: '1.5rem', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '16px', fontWeight: 700 }}>Manuelle Aktionen</h3>
        <button
          onClick={handleManualBooking}
          disabled={isManualBookingLoading}
          style={{
            width: '100%', padding: '1rem', borderRadius: 'var(--radius-md)', border: 'none',
            backgroundColor: 'var(--color-primary)', color: 'white', fontWeight: 700, fontSize: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            cursor: 'pointer', opacity: isManualBookingLoading ? 0.7 : 1,
          }}
        >
          <History size={18} /> {isManualBookingLoading ? 'Buche...' : 'Monatliche Raten jetzt buchen'}
        </button>
        <p style={{ margin: '0.75rem 0 0 0', fontSize: '11px', color: 'var(--color-text-muted)', textAlign: 'center' }}>
          Dies bucht alle für diesen Monat hinterlegten Sparbeträge manuell.
        </p>
        {lastBookingDate && (
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '10px', color: 'var(--color-primary)', textAlign: 'center', fontWeight: 600 }}>
            Letzte Buchung am: {new Date(lastBookingDate).toLocaleDateString('de-DE')}
          </p>
        )}
      </div>

      {/* Closed Years History Card */}
      <div className="glass-panel" style={{ padding: '1.5rem', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '16px', fontWeight: 700 }}>Abgeschlossene Jahre</h3>
        {settings.closedYears && settings.closedYears.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {settings.closedYears.map(year => (
              <div 
                key={year} 
                style={{ 
                  padding: '0.4rem 0.75rem', 
                  backgroundColor: 'var(--color-success-light)', 
                  color: 'var(--color-success)',
                  borderRadius: '16px', 
                  fontSize: '12px', 
                  fontWeight: 700, 
                  border: '1px solid var(--color-success-light)'
                }}
              >
                Jahr {year} erledigt
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-muted)' }}>
            Noch keine archivierten Jahre vorhanden. Ein neues Jahr wird automatisch am 1. Januar eines Jahres archiviert.
          </p>
        )}
      </div>

      <div style={{ textAlign: 'center', padding: '1rem', opacity: 0.5 }}>
        <p style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
          Letzte automatische Buchung: {settings.lastAutoBookingMonth || 'Nie'}
        </p>
      </div>
    </div>
  );
};

// --- Sub-Components ---

const BookingForm = ({ depots, onClose, onSave }: { depots: Depot[], onClose: () => void, onSave: (data: any) => void }) => {
  const [type, setType] = useState<'deposit' | 'withdrawal' | 'transfer'>('deposit');
  const [amount, setAmount] = useState('0');
  const [selectedDepotId, setSelectedDepotId] = useState(depots[0]?.id || '');
  const [targetDepotId, setTargetDepotId] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [step, setStep] = useState(1); // 1: Type/Amount/Note, 2: Depot selection

  const handleKeyPress = (key: string) => {
    setAmount(prev => {
      if (prev === '0' && key !== '.') return key;
      if (key === '.' && prev.includes('.')) return prev;
      if (prev.includes('.') && prev.split('.')[1].length >= 2) return prev;
      return prev + key;
    });
  };

  const handleBackspace = () => {
    setAmount(prev => prev.length <= 1 ? '0' : prev.slice(0, -1));
  };

  const handleFinalSave = () => {
    const val = parseFloat(amount.replace(',', '.'));
    if (isNaN(val) || val === 0) return;

    if (type === 'transfer') {
      if (!selectedDepotId || !targetDepotId || selectedDepotId === targetDepotId) return;
      onSave([
        {
          depotId: selectedDepotId,
          amount: -val,
          date,
          note: `Umbuchung an ${depots.find(d => d.id === targetDepotId)?.name}: ${note.trim()}`
        },
        {
          depotId: targetDepotId,
          amount: val,
          date,
          note: `Umbuchung von ${depots.find(d => d.id === selectedDepotId)?.name}: ${note.trim()}`
        }
      ]);
    } else {
      if (!selectedDepotId) return;
      onSave({
        depotId: selectedDepotId,
        amount: type === 'withdrawal' ? -val : val,
        date,
        note: note.trim()
      });
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 2000
    }}>
      <div className="glass-panel" style={{
        width: '100%', maxWidth: '500px', padding: '1.5rem',
        borderTopLeftRadius: 'var(--radius-xl)', borderTopRightRadius: 'var(--radius-xl)',
        backgroundColor: 'var(--color-surface)', display: 'flex', flexDirection: 'column', gap: '1rem',
        animation: 'slideUp 0.3s ease-out'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--font-base)', fontWeight: 700 }}>BUCHUNG ERSTELLEN</h3>
          <button onClick={onClose} style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none' }}><X size={24} /></button>
        </div>

        {step === 1 ? (
          <>
            {/* Type Selector */}
            <div style={{ display: 'flex', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 'var(--radius-lg)', padding: '0.2rem' }}>
              {(['deposit', 'withdrawal', 'transfer'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  style={{
                    flex: 1, padding: '0.6rem', border: 'none', borderRadius: 'var(--radius-md)',
                    fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer',
                    transition: 'all 0.2s',
                    backgroundColor: type === t 
                      ? (t === 'deposit' ? 'var(--color-success)' : t === 'withdrawal' ? 'var(--color-danger)' : 'var(--color-primary)')
                      : 'transparent',
                    color: type === t ? 'white' : 'var(--color-text-muted)'
                  }}
                >
                  {t === 'deposit' ? 'Einzahlung' : t === 'withdrawal' ? 'Auszahlung' : 'Umbuchung'}
                </button>
              ))}
            </div>

            <div style={{ 
              textAlign: 'center', padding: '1.5rem', backgroundColor: 'var(--color-background)', 
              borderRadius: 'var(--radius-lg)', border: '2px solid',
              borderColor: type === 'deposit' ? 'var(--color-success-light)' : type === 'withdrawal' ? 'var(--color-danger-light)' : 'var(--color-primary-light)'
            }}>
              <span style={{ fontSize: '3rem', fontWeight: 900, color: type === 'deposit' ? 'var(--color-success)' : type === 'withdrawal' ? 'var(--color-danger)' : 'var(--color-primary)', lineHeight: 1 }}>
                {type === 'withdrawal' ? '-' : ''}{amount}€
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Calendar size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '14px' }} />
              </div>
              <div style={{ flex: 2, position: 'relative' }}>
                <FileText size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                <input type="text" placeholder="Notiz..." value={note} onChange={e => setNote(e.target.value)} style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '14px' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map(num => (
                <button key={num} onClick={() => handleKeyPress(num)} style={{ height: '55px', fontSize: '1.5rem', fontWeight: 600, backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 'var(--radius-md)', border: 'none' }}>{num}</button>
              ))}
              <button onClick={handleBackspace} style={{ height: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 'var(--radius-md)', border: 'none' }}><Delete size={24} /></button>
            </div>

            <button onClick={() => setStep(2)} disabled={parseFloat(amount) === 0} style={{ 
              height: '55px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', 
              fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              opacity: parseFloat(amount) === 0 ? 0.5 : 1
            }}>
              WEITER <ChevronRight size={20} />
            </button>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 'var(--font-sm)' }}>
                {type === 'transfer' ? 'Umbuchung Details' : 'Depot auswählen'}
              </span>
              <button onClick={() => setStep(1)} style={{ fontSize: 'var(--font-xs)', color: 'var(--color-primary)', fontWeight: 700, background: 'none', border: 'none' }}>Zurück</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto', padding: '2px' }}>
              {type === 'transfer' ? (
                <>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>VON (Quelle)</div>
                  <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.4rem' }}>
                    {depots.map(depot => (
                      <button
                        key={`source-${depot.id}`}
                        onClick={() => setSelectedDepotId(depot.id)}
                        style={{
                          padding: '0.8rem 1.2rem', whiteSpace: 'nowrap', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
                          backgroundColor: selectedDepotId === depot.id ? 'var(--color-danger)' : 'var(--color-surface)',
                          color: selectedDepotId === depot.id ? 'white' : 'inherit', fontWeight: 600, fontSize: '12px'
                        }}
                      >
                        {depot.name}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginTop: '0.5rem' }}>ZU (Ziel)</div>
                  <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.4rem' }}>
                    {depots.map(depot => (
                      <button
                        key={`target-${depot.id}`}
                        onClick={() => setTargetDepotId(depot.id)}
                        disabled={selectedDepotId === depot.id}
                        style={{
                          padding: '0.8rem 1.2rem', whiteSpace: 'nowrap', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
                          backgroundColor: targetDepotId === depot.id ? 'var(--color-success)' : 'var(--color-surface)',
                          color: targetDepotId === depot.id ? 'white' : 'inherit', fontWeight: 600, fontSize: '12px',
                          opacity: selectedDepotId === depot.id ? 0.3 : 1
                        }}
                      >
                        {depot.name}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                  {depots.map(depot => (
                    <button
                      key={depot.id}
                      onClick={() => setSelectedDepotId(depot.id)}
                      style={{
                        padding: '1rem 0.5rem', textAlign: 'center', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
                        backgroundColor: selectedDepotId === depot.id ? 'var(--color-primary)' : 'var(--color-surface)',
                        color: selectedDepotId === depot.id ? 'white' : 'inherit', fontWeight: 600, fontSize: '13px'
                      }}
                    >
                      {depot.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button 
              onClick={handleFinalSave} 
              disabled={type === 'transfer' ? (!selectedDepotId || !targetDepotId) : !selectedDepotId}
              style={{ 
                height: '55px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', 
                fontWeight: 700, marginTop: '0.5rem', opacity: (type === 'transfer' ? (!selectedDepotId || !targetDepotId) : !selectedDepotId) ? 0.5 : 1
              }}
            >
              BUCHUNG ABSCHLIESSEN
            </button>
          </div>
        )}
      </div>
      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
};


const DepotForm = ({ onClose, onSave, initialDepot }: { onClose: () => void, onSave: (name: string, monthly: number, start: number) => void, initialDepot?: Depot }) => {
  const [name, setName] = useState(initialDepot?.name || '');
  const [monthly, setMonthly] = useState(initialDepot?.monthlyAmount?.toString() || '');
  const [start, setStart] = useState(initialDepot?.startBalance?.toString() || '');

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem'
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', backgroundColor: 'var(--color-surface)' }}>
        <h3 style={{ margin: 0, fontSize: 'var(--font-xl)', color: 'var(--color-primary)' }}>
          {initialDepot ? 'Depot bearbeiten' : 'Depot anlegen'}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div><label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 600, marginBottom: '0.4rem' }}>NAME</label><input type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Strom" /></div>
          <div><label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 600, marginBottom: '0.4rem' }}>MONATLICHE EINZAHLUNG (€)</label><input type="number" className="input-field" value={monthly} onChange={e => setMonthly(e.target.value)} placeholder="0.00" /></div>
          <div><label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 600, marginBottom: '0.4rem' }}>STARTBETRAG (€)</label><input type="number" className="input-field" value={start} onChange={e => setStart(e.target.value)} placeholder="0.00" /></div>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Abbrechen</button>
          <button onClick={() => onSave(name, parseFloat(monthly) || 0, parseFloat(start) || 0)} className="btn btn-primary" style={{ flex: 1 }} disabled={!name}>Speichern</button>
        </div>
      </div>
    </div>
  );
};


/* ── Diagramme im Verlaufs-Design ── */
const CHART_COLORS = ['#6D5DF0', '#F27A9B', '#F5A06B', '#4FC3A1', '#4B8DFF', '#C7B6F7'];
const CHART_REST_COLOR = '#CFC7F5';
const fmtEuro = (v: number) => `${Math.round(v).toLocaleString('de-DE')}€`;

const chartCardStyle: React.CSSProperties = {
  padding: '1.25rem',
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
};

const ChartHeader = ({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem' }}>
    <div style={{ minWidth: 0 }}>
      <h3 style={{ margin: 0, fontSize: 'var(--font-sm)', fontWeight: 800, color: 'var(--color-text)' }}>{title}</h3>
      {subtitle && <p style={{ margin: '0.15rem 0 0 0', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', fontWeight: 500 }}>{subtitle}</p>}
    </div>
    {right}
  </div>
);

const Pill = ({ children, color = 'var(--color-primary)' }: { children: React.ReactNode; color?: string }) => (
  <span style={{ flex: 'none', padding: '0.3rem 0.7rem', borderRadius: '999px', background: 'var(--color-surface-muted)', color, fontSize: 'var(--font-xs)', fontWeight: 800, whiteSpace: 'nowrap' }}>
    {children}
  </span>
);

/** Ring-Diagramm mit Legende (die größten 5 Einträge, der Rest wird zusammengefasst) */
const DonutCard = ({ title, subtitle, pill, data, style }: {
  title: string;
  subtitle: string;
  pill: React.ReactNode;
  data: { label: string; value: number }[];
  style?: React.CSSProperties;
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const slices = useMemo(() => {
    const sorted = data.filter(d => d.value > 0).sort((a, b) => b.value - a.value);
    const top = sorted.slice(0, 5);
    const rest = sorted.slice(5);
    const result = top.map((d, i) => ({ ...d, color: CHART_COLORS[i] }));
    if (rest.length > 0) {
      result.push({ label: `Weitere (${rest.length})`, value: rest.reduce((s, d) => s + d.value, 0), color: CHART_REST_COLOR });
    }
    return result;
  }, [data]);

  const total = slices.reduce((s, d) => s + d.value, 0);
  const active = activeIndex !== null ? slices[activeIndex] : null;

  const R = 38;
  const C = 2 * Math.PI * R;
  const GAP = slices.length > 1 ? 1.6 : 0;
  let offset = 0;

  return (
    <div className="glass-panel" style={{ ...chartCardStyle, ...style }}>
      <ChartHeader title={title} subtitle={subtitle} right={<Pill>{pill}</Pill>} />
      {total === 0 ? (
        <p style={{ margin: '1rem 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>Keine Daten</p>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ position: 'relative', width: '104px', height: '104px', flex: 'none' }}>
            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r={R} fill="none" stroke="var(--color-surface-muted)" strokeWidth="13" />
              {slices.map((s, i) => {
                const len = (s.value / total) * C;
                const dash = Math.max(len - GAP, 0.5);
                const el = (
                  <circle
                    key={s.label}
                    cx="50" cy="50" r={R}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={activeIndex === i ? 16 : 13}
                    strokeDasharray={`${dash} ${C - dash}`}
                    strokeDashoffset={-offset}
                    onClick={() => setActiveIndex(activeIndex === i ? null : i)}
                    style={{ cursor: 'pointer', transition: 'stroke-width 0.2s ease, opacity 0.2s ease', opacity: activeIndex === null || activeIndex === i ? 1 : 0.35 }}
                  />
                );
                offset += len;
                return el;
              })}
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 20px', pointerEvents: 'none' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', lineHeight: 1.15, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {active ? active.label : 'Gesamt'}
              </span>
              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: active ? active.color : 'var(--color-text)', lineHeight: 1.2 }}>
                {fmtEuro(active ? active.value : total)}
              </span>
              {active && <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-muted)' }}>{Math.round((active.value / total) * 100)} %</span>}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {slices.map((s, i) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setActiveIndex(activeIndex === i ? null : i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%',
                  padding: '0.25rem 0.35rem', border: 'none', borderRadius: '999px', cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'inherit', fontSize: 'var(--font-xs)', color: 'var(--color-text)',
                  background: activeIndex === i ? 'var(--color-surface-muted)' : 'transparent',
                  opacity: activeIndex === null || activeIndex === i ? 1 : 0.55,
                }}
              >
                <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: s.color, flex: 'none' }} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{s.label}</span>
                <span style={{ fontWeight: 800 }}>{fmtEuro(s.value)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/** Monatliche Ausgaben als abgerundete Säulen */
const BarChart = ({ data }: { data: { label: string, value: number }[] }) => {
  const currentMonthIdx = new Date().getMonth();
  const [selected, setSelected] = useState<number>(currentMonthIdx);
  const maxVal = Math.max(...data.map(d => d.value), 100);
  const monthsSoFar = data.slice(0, currentMonthIdx + 1);
  const avg = monthsSoFar.reduce((s, d) => s + d.value, 0) / Math.max(monthsSoFar.length, 1);
  const sel = data[selected];
  const CHART_H = 150;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: 'var(--font-xl)', fontWeight: 800, color: 'var(--color-text)' }}>{fmtEuro(sel.value)}</span>
        <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>{sel.label}</span>
      </div>
      <div style={{ position: 'relative', height: `${CHART_H}px` }}>
        {[0, 0.5, 1].map(f => (
          <div key={f} style={{ position: 'absolute', left: 0, right: 0, bottom: `${f * 100}%`, borderTop: '1px dashed var(--color-border)' }} />
        ))}
        {avg > 0 && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${(avg / maxVal) * 100}%`, borderTop: '1.5px dashed #F27A9B', zIndex: 1, pointerEvents: 'none' }}>
            <span style={{ position: 'absolute', right: 0, top: '-16px', fontSize: '9px', fontWeight: 800, color: '#F27A9B', background: 'var(--color-surface)', padding: '0 4px', borderRadius: '999px' }}>Ø {fmtEuro(avg)}</span>
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: '4px', zIndex: 2 }}>
          {data.map((item, i) => {
            const isFuture = i > currentMonthIdx;
            const isSel = i === selected;
            const h = item.value > 0 ? Math.max((item.value / maxVal) * 100, 3) : 0;
            return (
              <button
                key={item.label}
                type="button"
                title={`${item.label}: ${item.value.toFixed(2)}€`}
                onClick={() => setSelected(i)}
                style={{ flex: 1, minWidth: 0, height: '100%', padding: 0, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
              >
                <div style={{
                  width: '100%', maxWidth: '22px', height: `${h}%`,
                  borderRadius: '999px 999px 6px 6px',
                  background: isSel
                    ? 'linear-gradient(180deg, #6D5DF0, #3F34C4)'
                    : isFuture ? 'var(--color-surface-muted)' : 'linear-gradient(180deg, #DCD3FA, #C7B6F7)',
                  boxShadow: isSel ? '0 6px 14px rgba(63, 52, 196, 0.35)' : 'none',
                  transition: 'all 0.3s ease',
                }} />
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '4px', marginTop: '0.4rem' }}>
        {data.map((item, i) => (
          <span key={item.label} style={{
            flex: 1, minWidth: 0, textAlign: 'center', fontSize: '9px',
            fontWeight: i === selected ? 800 : 600,
            color: i === selected ? 'var(--color-primary)' : 'var(--color-text-muted)',
            opacity: i > currentMonthIdx ? 0.45 : 1,
          }}>{item.label}</span>
        ))}
      </div>
    </div>
  );
};

/** Alle Depots kompakt auf einen Blick: Anteilsleiste + Zeilen mit Balken im Hintergrund */
const DepotBalanceChart = ({ depots, calculateBalance }: { depots: Depot[], calculateBalance: (d: Depot) => number }) => {

  const balanceData = useMemo(() => {
    return depots.map(d => ({
      id: d.id,
      name: d.name,
      balance: calculateBalance(d)
    })).sort((a, b) => b.balance - a.balance);
  }, [depots, calculateBalance]);

  const maxAbs = Math.max(...balanceData.map(d => Math.abs(d.balance)), 1);
  const total = balanceData.reduce((s, d) => s + d.balance, 0);
  const positiveTotal = balanceData.reduce((s, d) => s + Math.max(d.balance, 0), 0) || 1;
  const colorOf = (i: number) => CHART_COLORS[i % CHART_COLORS.length];

  return (
    <div className="glass-panel" style={chartCardStyle}>
      <ChartHeader title="Depotübersicht" subtitle={`${balanceData.length} Depots`} right={<Pill color={total >= 0 ? 'var(--color-primary)' : 'var(--color-danger)'}>{fmtEuro(total)}</Pill>} />

      {/* Anteilsleiste */}
      <div style={{ display: 'flex', height: '12px', borderRadius: '999px', overflow: 'hidden', gap: '2px', marginBottom: '1rem' }}>
        {balanceData.filter(d => d.balance > 0).map(d => {
          const i = balanceData.indexOf(d);
          return <div key={d.id} title={`${d.name}: ${fmtEuro(d.balance)}`} style={{ flex: d.balance / positiveTotal, minWidth: '2px', background: colorOf(i) }} />;
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {balanceData.map((d, i) => {
          const positive = d.balance >= 0;
          const pct = Math.max((Math.abs(d.balance) / maxAbs) * 100, 1.5);
          return (
            <div key={d.id} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.6rem', borderRadius: '10px', overflow: 'hidden', fontSize: 'var(--font-xs)' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: positive ? 'var(--color-surface-muted)' : 'rgba(242, 169, 190, 0.35)', borderRadius: '10px' }} />
              <span style={{ position: 'relative', width: '8px', height: '8px', borderRadius: '50%', flex: 'none', background: positive ? colorOf(i) : '#F27A9B' }} />
              <span style={{ position: 'relative', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--color-text)' }}>{d.name}</span>
              <span style={{ position: 'relative', fontWeight: 800, whiteSpace: 'nowrap', color: positive ? 'var(--color-text)' : 'var(--color-danger)' }}>{d.balance.toLocaleString('de-DE', { maximumFractionDigits: 0 })}€</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
