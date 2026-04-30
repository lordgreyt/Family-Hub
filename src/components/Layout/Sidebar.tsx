import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { X, LogOut } from 'lucide-react';
import { getNavItems } from '../../utils/navigation';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const { user, logout } = useAuth();
  
  const navItems = getNavItems(user);


  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          onClick={onClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 900,
            animation: 'fadeIn 0.2s ease',
          }}
        />
      )}

      {/* Sidebar Panel */}
      <aside style={{
        position: 'fixed',
        top: 0,
        left: isOpen ? 0 : '-100%',
        width: '280px',
        height: '100%',
        backgroundColor: 'var(--color-surface)',
        boxShadow: isOpen ? '10px 0 30px rgba(0,0,0,0.1)' : 'none',
        zIndex: 1000,
        transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        padding: '1.5rem',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: 'var(--font-xl)', color: 'var(--color-primary)', margin: 0 }}>Menü</h2>
          <button onClick={onClose} style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '0.875rem 1rem',
                borderRadius: 'var(--radius-md)',
                color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
                backgroundColor: isActive ? 'var(--color-primary-light)' : 'transparent',
                textDecoration: 'none',
                fontWeight: isActive ? 600 : 500,
                transition: 'all 0.2s ease',
              })}
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer Info */}
        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div>
            <p style={{ margin: 0 }}>Angemeldet als <strong>{user?.id}</strong></p>
            <button 
              onClick={() => { logout(); onClose(); }}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.4rem', 
                background: 'none', 
                border: 'none', 
                color: 'var(--color-danger)', 
                cursor: 'pointer', 
                padding: '0.4rem 0',
                fontSize: '0.75rem',
                opacity: 0.8,
                fontWeight: 500,
                marginTop: '0.25rem'
              }}
            >
              <LogOut size={14} /> Abmelden
            </button>
          </div>
          <p style={{ margin: 0, opacity: 0.6 }}>Family Hub v1.1</p>
        </div>
      </aside>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
};
