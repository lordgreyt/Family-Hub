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
      paddingBottom: '90px', 
      overflowY: 'auto'
    }}>
      {/* Content Area */}
      <div style={{ flex: 1, padding: '1rem' }}>
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

      {/* Bottom Navigation */}
      <nav style={{
        position: 'fixed',
        bottom: '1.5rem',
        left: '1rem',
        right: '1rem',
        height: '70px',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(20px)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
        border: '1px solid rgba(255, 255, 255, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1rem',
        zIndex: 1000,
        maxWidth: '568px',
        margin: '0 auto'
      }}>
        {/* Left Tabs */}
        <div style={{ display: 'flex', flex: 1, justifyContent: 'space-around' }}>
          {tabs.slice(0, 2).map(({ id, label, icon: Icon }) => (
            <NavButton 
              key={id} 
              active={activeTab === id} 
              onClick={() => setActiveTab(id as Tab)} 
              icon={Icon} 
              label={label} 
            />
          ))}
        </div>

        {/* Central Plus Button */}
        <button
          onClick={() => setShowBookingForm(true)}
          style={{
            width: '64px',
            height: '64px',
            flexShrink: 0,
            backgroundColor: 'var(--color-primary)',
            color: 'white',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '-40px',
            boxShadow: '0 8px 24px rgba(79, 70, 229, 0.4)',
            border: '4px solid #fff',
            cursor: 'pointer',
            transition: 'transform 0.2s ease',
          }}
          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'}
          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <Plus size={32} strokeWidth={3} />
        </button>

        {/* Right Tabs */}
        <div style={{ display: 'flex', flex: 1, justifyContent: 'space-around' }}>
          {tabs.slice(2).map(({ id, label, icon: Icon }) => (
            <NavButton 
              key={id} 
              active={activeTab === id} 
              onClick={() => setActiveTab(id as Tab)} 
              icon={Icon} 
              label={label} 
            />
          ))}
        </div>
      </nav>
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
      {/* Metrics Row */}
      <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
        <div className="glass-panel" style={{ 
          flex: 1, minWidth: 0, padding: '1.25rem', 
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))', 
          color: 'white', border: 'none' 
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
          backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: 'var(--color-primary)', fontSize: 'var(--font-xs)', fontWeight: 600, marginBottom: '0.4rem' }}>
            {surplus !== null && surplus >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} ÜBERSCHUSS
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: surplus !== null && surplus >= 0 ? 'var(--color-success)' : 'var(--color-danger)', whiteSpace: 'nowrap' }}>
            {surplus !== null ? `${surplus.toLocaleString('de-DE', { minimumFractionDigits: 0 })}€` : '...'}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
        <div className="glass-panel" style={{ flex: 1, minWidth: 0, padding: '1rem', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textAlign: 'center', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Monatl. Einzahlung</h3>
          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', marginBottom: '0.5rem' }}>
            <span>{depots.reduce((s, d) => s + (d.monthlyAmount || 0), 0).toLocaleString('de-DE')}€</span>
            <span style={{ fontSize: '9px', fontWeight: 500, color: 'var(--color-text-muted)', opacity: 0.8 }}>{depots.length} Depots</span>
          </div>
          <div style={{ height: '110px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <PieChart data={depotData} size={110} />
          </div>
        </div>
        <div className="glass-panel" style={{ flex: 1, minWidth: 0, padding: '1rem', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textAlign: 'center', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Buchungen (Ausgaben)</h3>
          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-danger)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', marginBottom: '0.5rem' }}>
            <span>{Math.abs(monthTransactions.reduce((s, t) => s + t.amount, 0)).toLocaleString('de-DE')}€</span>
            <span style={{ fontSize: '9px', fontWeight: 500, color: 'var(--color-text-muted)', opacity: 0.8 }}>{monthTransactions.length} Buchungen</span>
          </div>
          <div style={{ height: '110px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <PieChart data={bookingData} size={110} />
          </div>
        </div>
      </div>

      {/* Depot Balance Chart */}
      <DepotBalanceChart depots={depots} calculateBalance={calculateBalance} />

      {/* Monthly Expenses Chart */}
      <div className="glass-panel" style={{ padding: '1.25rem', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ausgaben Übersicht</h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 500 }}>Monatliche Ausgaben im Jahr {currentYear}</p>
          </div>
          <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-danger)' }}>
            Ø {Math.round(yearlyData.reduce((s, d) => s + d.value, 0) / (new Date().getMonth() + 1)).toLocaleString('de-DE')}€
          </div>
        </div>
        <div style={{ height: '160px', width: '100%', marginTop: '0.5rem' }}>
          <BarChart data={yearlyData} />
        </div>
      </div>
    </div>
  );
};

const DepotsView = ({ depots, calculateBalance, onDelete, onAdd, onEdit }: { depots: Depot[], calculateBalance: (d: Depot) => number, onDelete: (id: string) => void, onAdd: () => void, onEdit: (d: Depot) => void }) => {
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
          onDelete={onDelete} 
          onEdit={() => onEdit(depot)} 
        />
      ))}
    </div>
  );
};

const DepotCard = ({ depot, balance, onDelete, onEdit }: { depot: Depot, balance: number, onDelete: (id: string) => void, onEdit: () => void }) => {
  const [isPressing, setIsPressing] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startPress = () => {
    setIsPressing(true);
    timerRef.current = setTimeout(() => {
      onEdit();
      setIsPressing(false);
    }, 600); // 600ms long press
  };

  const cancelPress = () => {
    setIsPressing(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  return (
    <div 
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      style={{ 
        padding: '0.75rem 1.25rem', 
        backgroundColor: 'var(--color-surface)', 
        borderRadius: 'var(--radius-lg)', 
        border: '1px solid',
        borderColor: isPressing ? 'var(--color-primary)' : 'var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        boxShadow: 'var(--shadow-sm)',
        position: 'relative',
        transition: 'all 0.2s ease',
        transform: isPressing ? 'scale(0.98)' : 'scale(1)',
        cursor: 'pointer',
        userSelect: 'none'
      }}
    >
      {/* Top Row: Name and Balance */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{depot.name || 'Unbekannt'}</h3>
        </div>
        <span style={{ fontSize: '15px', fontWeight: 800, color: balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {balance.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
        </span>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '0.25rem 0', opacity: 0.5 }} />
      
      {/* Bottom Row: Monthly Payment */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
          MTL. Einzahlung
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>
            {(depot.monthlyAmount || 0).toLocaleString('de-DE')} €
          </span>
          <button 
            onClick={(e) => { e.stopPropagation(); if(confirm(`Depot "${depot.name}" wirklich löschen?`)) onDelete(depot.id); }}
            style={{ 
              color: 'var(--color-danger)', 
              opacity: 0.3, 
              padding: '0.2rem', 
              background: 'none', 
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer'
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
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
              <div key={tx.id} style={{ 
                padding: '0.75rem 1.25rem', 
                backgroundColor: 'var(--color-surface)', 
                borderRadius: 'var(--radius-lg)', 
                border: '1px solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                boxShadow: 'var(--shadow-sm)',
                opacity: (tx.isAutomated || tx.note?.includes('Sparrate')) ? 0.7 : 1
              }}>
                {/* Top Row: Depot Name and Amount */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '15px' }}>{depot?.name || 'Unbekannt'}</span>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: tx.amount >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                  </span>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '0.25rem 0', opacity: 0.5 }} />
                
                {/* Bottom Row: Note and Date/Delete */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tx.note || 'Buchung'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                      {new Date(tx.date).toLocaleDateString('de-DE')}
                    </span>
                    <button 
                      onClick={() => { if(confirm('Diese Buchung wirklich löschen?')) onDelete(tx.id); }}
                      style={{ 
                        color: 'var(--color-danger)', 
                        opacity: 0.3, 
                        padding: '0.2rem', 
                        background: 'none', 
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
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
            cursor: 'pointer', opacity: isManualBookingLoading ? 0.7 : 1
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

const NavButton = ({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
      color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
      padding: '8px',
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'transparent',
      transition: 'all 0.2s ease',
      border: 'none',
      flex: 1,
      cursor: 'pointer'
    }}
  >
    <Icon size={22} strokeWidth={active ? 2.5 : 2} />
    <span style={{ fontSize: '9px', fontWeight: active ? 700 : 500, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{label}</span>
  </button>
);

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


const PieChart = ({ data, size = 80 }: { data: { label: string, value: number }[], size?: number }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  
  if (total === 0 || isNaN(total)) return <div style={{ color: 'var(--color-text-muted)', fontSize: '8px' }}>N/A</div>;

  let cumulativePercent = 0;
  const colors = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

  return (
    <div style={{ position: 'relative', width: `${size}px`, height: `${size}px`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="-1.1 -1.1 2.2 2.2" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%', overflow: 'visible', cursor: 'pointer' }}>
        {data.map((slice, i) => {
          const slicePercent = slice.value / total;
          const [startX, startY] = [Math.cos(2 * Math.PI * cumulativePercent), Math.sin(2 * Math.PI * cumulativePercent)];
          cumulativePercent += slicePercent;
          const [endX, endY] = [Math.cos(2 * Math.PI * cumulativePercent), Math.sin(2 * Math.PI * cumulativePercent)];
          const largeArcFlag = slicePercent > 0.5 ? 1 : 0;
          const isActive = activeIndex === i;
          
          const pathData = [`M ${startX} ${startY}`, `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`, `L 0 0`].join(' ');
          
          return (
            <path 
              key={slice.label} 
              d={pathData} 
              fill={colors[i % colors.length]} 
              stroke="#fff" 
              strokeWidth="0.02"
              onClick={(e) => { e.stopPropagation(); setActiveIndex(isActive ? null : i); }}
              style={{ transition: 'all 0.3s ease', transform: isActive ? 'scale(1.1)' : 'scale(1)', transformOrigin: 'center', opacity: activeIndex === null || isActive ? 1 : 0.6 }}
            />
          );
        })}
        <circle cx="0" cy="0" r="0.65" fill="#fff" />
      </svg>
      {activeIndex !== null && (
        <div style={{ position: 'absolute', textAlign: 'center', width: '70%', display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: '7px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', lineHeight: 1, WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', display: '-webkit-box', overflow: 'hidden' }}>{data[activeIndex].label}</span>
          <span style={{ fontSize: '10px', fontWeight: 900, color: colors[activeIndex % colors.length] }}>{Math.round(data[activeIndex].value)}€</span>
        </div>
      )}
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
const BarChart = ({ data }: { data: { label: string, value: number }[] }) => {
  const maxVal = Math.max(...data.map(d => d.value), 100);
  const currentMonthIdx = new Date().getMonth();

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '4px', paddingBottom: '20px', position: 'relative' }}>
      {data.map((item, i) => {
        const heightPercent = (item.value / maxVal) * 100;
        const isCurrent = i === currentMonthIdx;
        const isFuture = i > currentMonthIdx;

        return (
          <div key={item.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
            <div 
              title={`${item.label}: ${item.value.toFixed(2)}€`}
              style={{ 
                width: '100%', 
                height: `${Math.max(heightPercent, 2)}%`, 
                background: isCurrent 
                  ? 'linear-gradient(to top, var(--color-danger), #ff8080)' 
                  : isFuture ? 'var(--color-border)' : 'rgba(239, 68, 68, 0.15)',
                borderRadius: '4px 4px 0 0',
                transition: 'all 0.4s ease',
                cursor: 'help',
                position: 'relative'
              }} 
            >
              {item.value > 0 && item.value > maxVal * 0.2 && (
                <div style={{ 
                  position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)', 
                  fontSize: '8px', fontWeight: 700, color: isCurrent ? 'var(--color-danger)' : 'var(--color-text-muted)' 
                }}>
                  {Math.round(item.value)}
                </div>
              )}
            </div>
            <span style={{ 
              position: 'absolute', bottom: '0', fontSize: '9px', fontWeight: 600, 
              color: isCurrent ? 'var(--color-danger)' : 'var(--color-text-muted)',
              opacity: isFuture ? 0.4 : 1
            }}>
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const DepotBalanceChart = ({ depots, calculateBalance }: { depots: Depot[], calculateBalance: (d: Depot) => number }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const balanceData = useMemo(() => {
    return depots.map(d => ({
      id: d.id,
      name: d.name,
      balance: calculateBalance(d)
    })).sort((a, b) => b.balance - a.balance);
  }, [depots, calculateBalance]);

  const maxAbsBalance = Math.max(...balanceData.map(d => Math.abs(d.balance)), 100);
  const selectedDepot = balanceData.find(d => d.id === selectedId);

  return (
    <div className="glass-panel" style={{ padding: '1.25rem', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Depotübersicht</h3>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 500 }}>Alle Depotstände im Vergleich</p>
        </div>
        {selectedDepot && (
          <div style={{ textAlign: 'right', animation: 'fadeIn 0.2s ease' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)' }}>{selectedDepot.name}</div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: selectedDepot.balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {selectedDepot.balance.toLocaleString('de-DE')}€
            </div>
          </div>
        )}
      </div>

      <div style={{ height: '140px', width: '100%', display: 'flex', alignItems: 'center', position: 'relative', gap: '2px' }}>
        {/* Zero Line */}
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', backgroundColor: 'var(--color-border)', opacity: 0.5, zIndex: 1 }} />
        
        {balanceData.map(d => {
          const heightPercent = (Math.abs(d.balance) / maxAbsBalance) * 50;
          const isPositive = d.balance >= 0;
          const isSelected = selectedId === d.id;

          return (
            <div 
              key={d.id} 
              onClick={() => setSelectedId(isSelected ? null : d.id)}
              style={{ 
                flex: 1, 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: isPositive ? 'flex-end' : 'flex-start',
                cursor: 'pointer',
                position: 'relative',
                zIndex: 2
              }}
            >
              <div 
                style={{ 
                  width: '100%', 
                  height: `${Math.max(heightPercent, 2)}%`, 
                  backgroundColor: isPositive ? 'var(--color-success)' : 'var(--color-danger)',
                  opacity: isSelected ? 1 : 0.6,
                  borderRadius: isPositive ? '2px 2px 0 0' : '0 0 2px 2px',
                  transition: 'all 0.3s ease',
                  marginTop: isPositive ? 0 : '1px', // Account for zero line
                  transform: isSelected ? 'scaleX(1.5)' : 'scaleX(1)',
                  boxShadow: isSelected ? `0 0 12px ${isPositive ? 'var(--color-success)' : 'var(--color-danger)'}` : 'none'
                }} 
              />
              {/* Invisible touch target extension */}
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: '-2px', right: '-2px' }} />
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};
