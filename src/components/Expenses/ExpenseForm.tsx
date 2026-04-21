import React, { useState } from 'react';
import { 
  X, Delete, ArrowRight, Utensils, Gift, HeartPulse, Hammer, Home, 
  PawPrint, Droplets, Baby, Shirt, Zap, ShoppingBasket, FileText, 
  PiggyBank, Dumbbell, Film, Car, Trees 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { mockDb } from '../../services/mockDb';

interface ExpenseFormProps {
  type: 'INCOME' | 'EXPENSE';
  onClose: () => void;
}

export const CATEGORIES = [
  'Essen gehen', 'Geschenke', 'Gesundheit', 'Handwerk', 'Haus', 'Hund', 
  'Hygiene', 'Kinder', 'Kleidung', 'Korrektur', 'Lebensmittel', 
  'Rechnungen', 'Sparen', 'Sport', 'Unterhaltung', 'Verkehr', 'Waki'
];

const CATEGORY_ICONS: Record<string, any> = {
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

export const ExpenseForm = ({ type, onClose }: ExpenseFormProps) => {
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
      type,
      description,
      createdBy: user?.id || 'Unknown'
    });

    onClose();
  };

  const KeypadButton = ({ label, action, icon: Icon }: { label?: string, action: () => void, icon?: any }) => (
    <button 
      type="button"
      onClick={action}
      style={{
        height: '60px',
        fontSize: '1.5rem',
        fontWeight: 600,
        backgroundColor: type === 'EXPENSE' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.03)',
        border: `1px solid ${type === 'EXPENSE' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: 'inherit'
      }}
    >
      {Icon ? <Icon size={24} /> : label}
    </button>
  );

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      zIndex: 2000
    }}>
      <div 
        style={{
          width: '100%',
          maxWidth: '500px',
          padding: '1.5rem',
          borderRadius: 'var(--radius-xl)',
          backgroundColor: type === 'EXPENSE' ? 'var(--color-primary)' : '#ffffff',
          backgroundImage: type === 'EXPENSE' ? 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))' : 'none',
          color: type === 'EXPENSE' ? '#ffffff' : '#000000',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          border: type === 'EXPENSE' ? '1px solid rgba(255,255,255,0.2)' : '1px solid #e5e7eb',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          zIndex: 2100,
          position: 'relative',
          opacity: type === 'EXPENSE' ? 0.98 : 1,
          backdropFilter: 'blur(10px)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ 
            margin: 0, 
            color: 'inherit', 
            fontSize: '0.9rem', 
            fontWeight: 700, 
            letterSpacing: '0.05em',
            opacity: 0.9
          }}>
            {type === 'INCOME' ? 'EINNAHME HINZUFÜGEN' : 'AUSGABE HINZUFÜGEN'}
          </h3>
          <button 
            onClick={onClose} 
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'inherit', 
              cursor: 'pointer',
              opacity: 0.7 
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Amount Display */}
        <div style={{ 
          textAlign: 'center', 
          padding: '1.5rem', 
          backgroundColor: type === 'EXPENSE' ? 'rgba(255,255,255,0.15)' : '#f3f4f6', 
          borderRadius: 'var(--radius-lg)',
          border: `1px solid ${type === 'EXPENSE' ? 'rgba(255,255,255,0.3)' : '#000000'}`,
        }}>
          <span style={{ 
            fontSize: '3.5rem', 
            fontWeight: 900, 
            color: 'inherit',
            lineHeight: 1
          }}>
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
            fontSize: '1.1rem',
            backgroundColor: type === 'EXPENSE' ? 'rgba(255,255,255,0.1)' : '#ffffff',
            border: `2px solid ${type === 'EXPENSE' ? 'rgba(255,255,255,0.3)' : '#000000'}`,
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
            color: 'inherit',
            fontWeight: 700,
            outline: 'none',
            width: '100%'
          }}
        />

        {!showCategories ? (
          <>
            {/* Number Pad */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)', 
              gap: '0.5rem',
              marginTop: '0.5rem'
            }}>
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
                marginTop: '1rem',
                height: '60px',
                fontSize: '1.1rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                backgroundColor: type === 'EXPENSE' ? 'white' : 'black',
                color: type === 'EXPENSE' ? 'var(--color-primary)' : 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer'
              }}
            >
              KATEGORIE WÄHLEN <ArrowRight size={20} />
            </button>
          </>
        ) : (
          <div style={{ animation: 'fadeIn 0.2s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'inherit', opacity: 0.7 }}>KATEGORIE AUSWÄHLEN</span>
              <button 
                onClick={() => setShowCategories(false)}
                style={{ background: 'none', border: 'none', color: 'inherit', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Zurück zum Betrag
              </button>
            </div>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)', 
              gap: '0.5rem',
              maxHeight: '350px',
              overflowY: 'auto',
              padding: '0.25rem'
            }}>
              {CATEGORIES.map(cat => {
                const Icon = CATEGORY_ICONS[cat];
                return (
                  <button
                    key={cat}
                    onClick={() => handleSave(cat)}
                    style={{
                      height: '80px',
                      backgroundColor: type === 'EXPENSE' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.02)',
                      border: `1px solid ${type === 'EXPENSE' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}`,
                      borderRadius: 'var(--radius-lg)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                      color: 'inherit',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {Icon && <Icon size={24} style={{ color: 'inherit', opacity: 0.9 }} />}
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
    </div>
  );
};
