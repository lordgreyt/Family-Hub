import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';
import type { BudgetItem } from '../services/mockDb';
import { Plus, Trash2, Save, X } from 'lucide-react';

export const Budget = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [pressTimer, setPressTimer] = useState<any>(null);

  useEffect(() => {
    const load = () => {
      setItems(mockDb.getBudgetItems());
      setDepots(mockDb.getDepots());
    };
    load();
    window.addEventListener('db_updated', load);
    return () => window.removeEventListener('db_updated', load);
  }, []);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount || !user) return;
    
    mockDb.addBudgetItem({
      title,
      amount: parseFloat(amount),
      type,
      createdBy: user.id,
    });
    
    setTitle('');
    setAmount('');
  };

  const handleDelete = (id: string) => {
    mockDb.deleteBudgetItem(id);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    mockDb.updateBudgetItem(editingItem);
    setEditingItem(null);
  };

  const startPress = (item: BudgetItem) => {
    const timer = setTimeout(() => {
      setEditingItem({ ...item });
      if ('vibrate' in navigator) navigator.vibrate(50);
    }, 600);
    setPressTimer(timer);
  };

  const cancelPress = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
  };

  const incomes = items.filter(i => i.type === 'INCOME');
  const expenses = items.filter(i => i.type === 'EXPENSE');

  const fixedDepotAmount = depots.reduce((sum, d) => sum + (d.monthlyAmount || 0), 0);

  const totalIncome = incomes.reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = expenses.reduce((acc, curr) => acc + curr.amount, 0) + fixedDepotAmount;
  const excess = totalIncome - totalExpense;

  const renderList = (list: BudgetItem[], title: string, total: number, color: string, isExpense = false) => (
    <div style={{ flex: 1, minWidth: '280px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: `2px solid ${color}`, paddingBottom: '0.5rem' }}>
        <h3 style={{ color: 'var(--color-text)' }}>{title}</h3>
        <strong style={{ color }}>{total.toFixed(2)} €</strong>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {isExpense && fixedDepotAmount > 0 && (
          <div className="glass-panel" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-surface-hover)' }}>
            <div>
              <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                N26 Sparplan <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-primary)' }}>(Auto)</span>
              </div>
              <div style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)' }}>{fixedDepotAmount.toFixed(2)} €</div>
            </div>
            <div style={{ padding: '0.5rem' }}>
              {/* Optional Lock Icon or Leave Empty */}
            </div>
          </div>
        )}
        {list.map(item => {
          const author = mockDb.getUsers().find(u => u.id === item.createdBy);
          const isEditing = editingItem?.id === item.id;

          if (isEditing) {
            return (
              <form key={item.id} onSubmit={handleUpdate} className="glass-panel" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', border: '2px solid var(--color-primary)', animation: 'fadeIn 0.2s' }}>
                <input 
                  className="input-field" 
                  value={editingItem.title} 
                  onChange={e => setEditingItem({ ...editingItem, title: e.target.value })}
                  autoFocus
                  required
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="input-field" 
                    style={{ flex: 1 }}
                    value={editingItem.amount} 
                    onChange={e => setEditingItem({ ...editingItem, amount: parseFloat(e.target.value) || 0 })}
                    required
                  />
                  <button type="button" onClick={() => setEditingItem(null)} className="btn btn-secondary" style={{ padding: '0.5rem' }}><X size={18} /></button>
                  <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem' }}><Save size={18} /></button>
                </div>
              </form>
            );
          }

          return (
            <div 
              key={item.id} 
              className="glass-panel" 
              style={{ 
                padding: '0.75rem', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                cursor: 'pointer',
                userSelect: 'none',
                WebkitTouchCallout: 'none'
              }}
              onPointerDown={() => startPress(item)}
              onPointerUp={cancelPress}
              onPointerLeave={cancelPress}
              onPointerCancel={cancelPress}
            >
              <div>
                <div style={{ fontWeight: 500 }}>{item.title} <span title={item.createdBy} style={{ fontSize: '0.8em' }}>{author?.avatar}</span></div>
                <div style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)' }}>{item.amount.toFixed(2)} €</div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} style={{ color: 'var(--color-danger)', padding: '0.5rem', background: 'none', border: 'none' }}>
                <Trash2 size={18} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      <div className="glass-panel" style={{ 
        padding: '1rem', // Reduzierte Höhe
        textAlign: 'center',
        background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))',
        color: 'white',
        boxShadow: 'var(--shadow-lg)'
      }}>
        <h2 style={{ fontSize: 'var(--font-sm)', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Jetziger Überschuss
        </h2>
        <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 800, marginTop: '0.25rem' }}>
          {excess.toFixed(2)} €
        </div>
      </div>

      <form onSubmit={handleAdd} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ color: 'var(--color-primary-dark)', marginBottom: '0.5rem' }}>Eintrag hinzufügen</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            type="button" 
            className={`btn ${type === 'INCOME' ? 'btn-primary' : 'btn-secondary'}`} 
            style={{ flex: 1, backgroundColor: type === 'INCOME' ? 'var(--color-success)' : undefined, border: 'none', color: type === 'INCOME' ? 'white' : 'inherit' }}
            onClick={() => setType('INCOME')}
          >
            Einnahme
          </button>
          <button 
            type="button" 
            className={`btn ${type === 'EXPENSE' ? 'btn-primary' : 'btn-secondary'}`} 
            style={{ flex: 1, backgroundColor: type === 'EXPENSE' ? 'var(--color-danger)' : undefined, border: 'none', color: type === 'EXPENSE' ? 'white' : 'inherit' }}
            onClick={() => setType('EXPENSE')}
          >
            Ausgabe
          </button>
        </div>
        <input 
          type="text" 
          placeholder="Titel (z.B. Miete)" 
          className="input-field" 
          value={title} 
          onChange={e => setTitle(e.target.value)} 
          required 
        />
        <input 
          type="number" 
          step="0.01" 
          placeholder="Betrag in €" 
          className="input-field" 
          value={amount} 
          onChange={e => setAmount(e.target.value)} 
          required 
        />
        <button type="submit" className="btn btn-primary" style={{ border: 'none' }}>
          <Plus size={20} /> Hinzufügen
        </button>
      </form>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
        {renderList(incomes, 'Monatliche Einnahmen', totalIncome, 'var(--color-success)', false)}
        {renderList(expenses, 'Monatliche Ausgaben', totalExpense, 'var(--color-danger)', true)}
      </div>

    </div>
  );
};
