import { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Delete, ArrowRight, Utensils, Gift, HeartPulse, Hammer, Home, 
  PawPrint, Droplets, Baby, Shirt, Zap, ShoppingBasket, FileText, 
  PiggyBank, Dumbbell, Film, Car, Trees 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { mockDb } from '../../services/mockDb';

interface ExpenseFormProps {
  type: 'INCOME' | 'EXPENSE';
  currentMonth: string;
  onClose: () => void;
}

const TILE_COLORS = ['#6D5DF0', '#F27A9B', '#F5A06B', '#4FC3A1', '#4B8DFF', '#A68BF0'];

export const CATEGORIES = [
  'Essen gehen', 'Geschenke', 'Gesundheit', 'Handwerk', 'Haus', 'Hund', 
  'Hygiene', 'Kinder', 'Kleidung', 'Korrektur', 'Lebensmittel', 
  'Rechnungen', 'Sparen', 'Sport', 'Unterhaltung', 'Verkehr', 'Waki'
];

export const CATEGORY_ICONS: Record<string, any> = {
  'Essen gehen': Utensils,
  'Geschenke': Gift,
  'Gesundheit': HeartPulse,
  'Handwerk': Hammer,
  'Haus': Home,
  'Hund': PawPrint,
  'Hygiene': Droplets,
  'Kinder': Baby,
  'Kleidung': Shirt,
  'Korrektur': Zap,
  'Lebensmittel': ShoppingBasket,
  'Rechnungen': FileText,
  'Sparen': PiggyBank,
  'Sport': Dumbbell,
  'Unterhaltung': Film,
  'Verkehr': Car,
  'Waki': Trees
};

export const ExpenseForm = ({ type, currentMonth, onClose }: ExpenseFormProps) => {
  const { user } = useAuth();
  const [amount, setAmount] = useState('0');
  const [description, setDescription] = useState('');
  const [showCategories, setShowCategories] = useState(false);

  const handleKeyPress = (key: string) => {
    setAmount(prev => {
      if (prev === '0' && key !== '.') return key;
      if (key === '.' && prev.includes('.')) return prev;
      return prev + key;
    });
  };

  const handleBackspace = () => {
    setAmount(prev => {
      if (prev.length <= 1) return '0';
      return prev.slice(0, -1);
    });
  };

  const handleSave = (category: string) => {
    const val = parseFloat(amount.replace(',', '.'));
    if (isNaN(val) || val <= 0) return;

    mockDb.addExpense({
      amount: val,
      category,
      date: new Date().toISOString().split('T')[0],
      budgetMonth: currentMonth,
      type,
      description,
      createdBy: user?.id || 'Unknown'
    });

    onClose();
  };

  const isExpense = type === 'EXPENSE';
  const accent = isExpense ? '#6D5DF0' : '#2FB36B';
  const accentGradient = isExpense
    ? 'linear-gradient(135deg, #3F34C4 0%, #6D5DF0 55%, #F2A9BE 130%)'
    : 'linear-gradient(135deg, #1F9D5C 0%, #43C773 60%, #A8E6BF 130%)';
  const accentShadow = isExpense ? 'rgba(63,52,196,0.3)' : 'rgba(47,179,107,0.3)';

  const KeypadButton = ({ label, action, icon: Icon }: { label?: string, action: () => void, icon?: any }) => (
    <button
      type="button"
      onClick={action}
      style={{
        height: '58px',
        fontSize: '1.45rem',
        fontWeight: 700,
        fontFamily: 'inherit',
        backgroundColor: 'var(--color-surface-muted)',
        border: 'none',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: 'var(--color-text)'
      }}
    >
      {Icon ? <Icon size={24} /> : label}
    </button>
  );

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(23,20,58,0.5)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 2000
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '500px',
          maxHeight: '94vh',
          overflowY: 'auto',
          padding: '0.75rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom))',
          borderRadius: '28px 28px 0 0',
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text)',
          boxShadow: '0 -12px 40px rgba(63,52,196,0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          animation: 'slideUp 0.28s ease'
        }}
      >
        <div style={{ width: '44px', height: '5px', borderRadius: '999px', background: 'var(--color-border)', alignSelf: 'center' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--font-lg)', fontWeight: 800, color: 'var(--color-text)' }}>
            {isExpense ? 'Neue Ausgabe' : 'Neue Einnahme'}
          </h3>
          <button
            onClick={onClose}
            aria-label="Schließen"
            style={{
              width: '36px', height: '36px', borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'var(--color-surface-muted)', color: 'var(--color-text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Amount Display */}
        <div style={{
          textAlign: 'center',
          padding: '1.4rem 1rem',
          borderRadius: 'var(--radius-xl)',
          background: accentGradient,
          color: 'white',
          boxShadow: `0 10px 24px ${accentShadow}`
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', opacity: 0.85, marginBottom: '0.3rem' }}>
            {isExpense ? 'AUSGABE' : 'EINNAHME'}
          </div>
          <span style={{ fontSize: '3.2rem', fontWeight: 800, lineHeight: 1 }}>
            {amount}€
          </span>
        </div>

        {/* Note Field */}
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Notiz hinzufügen..."
          style={{
            textAlign: 'center',
            fontSize: 'var(--font-base)',
            backgroundColor: 'var(--color-surface-muted)',
            border: '2px solid transparent',
            borderRadius: '999px',
            padding: '0.85rem 1rem',
            color: 'var(--color-text)',
            fontWeight: 600,
            outline: 'none',
            width: '100%',
            fontFamily: 'inherit',
            boxSizing: 'border-box'
          }}
        />

        {!showCategories ? (
          <>
            {/* Number Pad */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                <KeypadButton key={num} label={num} action={() => handleKeyPress(num)} />
              ))}
              <KeypadButton label="." action={() => handleKeyPress('.')} />
              <KeypadButton label="0" action={() => handleKeyPress('0')} />
              <KeypadButton icon={Delete} action={handleBackspace} />
            </div>

            <button
              onClick={() => setShowCategories(true)}
              style={{
                height: '56px',
                fontSize: 'var(--font-base)',
                fontWeight: 800,
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.6rem',
                background: accentGradient,
                color: 'white',
                border: 'none',
                borderRadius: '999px',
                cursor: 'pointer',
                boxShadow: `0 8px 20px ${accentShadow}`
              }}
            >
              Kategorie wählen <ArrowRight size={20} />
            </button>
          </>
        ) : (
          <div style={{ animation: 'fadeIn 0.2s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: 'var(--font-xs)', fontWeight: 800, letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>KATEGORIE AUSWÄHLEN</span>
              <button
                onClick={() => setShowCategories(false)}
                style={{ background: 'none', border: 'none', color: accent, fontSize: 'var(--font-sm)', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Zurück zum Betrag
              </button>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.5rem',
              maxHeight: '340px',
              overflowY: 'auto',
              padding: '0.1rem'
            }}>
              {CATEGORIES.map((cat, i) => {
                const Icon = CATEGORY_ICONS[cat];
                const color = TILE_COLORS[i % TILE_COLORS.length];
                return (
                  <button
                    key={cat}
                    onClick={() => handleSave(cat)}
                    style={{
                      height: '84px',
                      backgroundColor: 'var(--color-surface-hover)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-lg)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      fontFamily: 'inherit',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      cursor: 'pointer',
                      color: 'var(--color-text)'
                    }}
                  >
                    <span style={{ width: '36px', height: '36px', borderRadius: '50%', background: color + '26', color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {Icon && <Icon size={19} />}
                    </span>
                    <span style={{ textAlign: 'center' }}>{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>,
    document.body
  );
};
