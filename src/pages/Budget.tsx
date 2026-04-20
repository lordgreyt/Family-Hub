import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';
import type { BudgetItem } from '../services/mockDb';
import { Plus, Trash2 } from 'lucide-react';

let cachedFixedDepotAmount: number | null = null;

export const Budget = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [fixedDepotAmount, setFixedDepotAmount] = useState<number | null>(cachedFixedDepotAmount);

  useEffect(() => {
    const load = () => setItems(mockDb.getBudgetItems());
    load();
    window.addEventListener('db_updated', load);

    if (cachedFixedDepotAmount === null) {
      const fetchMonatlicheSumme = async () => {
      try {
        const response = await fetch('https://api.jsonbin.io/v3/b/69a943e4d0ea881f40f0fe2b/latest', {
          headers: { 'X-Access-Key': '$2a$10$xgHBK5MaCPjGBZmwI8srg.C9IPVMC989QP7Lh2pZmr3IIRargWOcm' }
        });
        
        if (!response.ok) throw new Error("Netzwerkfehler");
        const data = await response.json();
        
        let summe = 0;
        const zielArray = data.record?.depots;
        
        if (zielArray && Array.isArray(zielArray)) {
          summe = zielArray.reduce((acc: number, curr: any) => {
            const wert = parseFloat(String(curr.betrag).replace(',', '.'));
            return acc + (isNaN(wert) ? 0 : wert);
          }, 0);
        }
        
        cachedFixedDepotAmount = summe;
        setFixedDepotAmount(summe);
      } catch (error) {
        console.error("Fehler beim Abrufen der JSONBin Daten:", error);
      }
    };

    fetchMonatlicheSumme();
    }

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

  const incomes = items.filter(i => i.type === 'INCOME');
  const expenses = items.filter(i => i.type === 'EXPENSE');

  const totalIncome = incomes.reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = expenses.reduce((acc, curr) => acc + curr.amount, 0) + (fixedDepotAmount || 0);
  const excess = totalIncome - totalExpense;

  const renderList = (list: BudgetItem[], title: string, total: number, color: string, isExpense = false) => (
    <div style={{ flex: 1, minWidth: '280px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: `2px solid ${color}`, paddingBottom: '0.5rem' }}>
        <h3 style={{ color: 'var(--color-text)' }}>{title}</h3>
        <strong style={{ color }}>{total.toFixed(2)} €</strong>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {isExpense && fixedDepotAmount !== null && (
          <div className="glass-panel" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-surface-hover)' }}>
            <div>
              <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Nebenkosten <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-primary)' }}>(Auto)</span>
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
          return (
            <div key={item.id} className="glass-panel" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 500 }}>{item.title} <span title={item.createdBy} style={{ fontSize: '0.8em' }}>{author?.avatar}</span></div>
                <div style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)' }}>{item.amount.toFixed(2)} €</div>
              </div>
              <button onClick={() => handleDelete(item.id)} style={{ color: 'var(--color-danger)', padding: '0.5rem' }}>
                <Trash2 size={18} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
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
            style={{ flex: 1, backgroundColor: type === 'INCOME' ? 'var(--color-success)' : undefined }}
            onClick={() => setType('INCOME')}
          >
            Einnahme
          </button>
          <button 
            type="button" 
            className={`btn ${type === 'EXPENSE' ? 'btn-primary' : 'btn-secondary'}`} 
            style={{ flex: 1, backgroundColor: type === 'EXPENSE' ? 'var(--color-danger)' : undefined }}
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
        <button type="submit" className="btn btn-primary">
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
