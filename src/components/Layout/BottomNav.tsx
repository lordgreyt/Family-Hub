import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Home, Calculator, BookOpen, Settings, CheckSquare, Utensils, Star } from 'lucide-react';

export const BottomNav = () => {
  const { user } = useAuth();
  const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    ...(!user?.isChild ? [{ to: '/budget', icon: Calculator, label: 'Budget' }] : []),
    { to: '/tasks', icon: CheckSquare, label: 'Aufgaben' },
    { to: '/notes', icon: BookOpen, label: 'Notizen' },
    { to: '/meals', icon: Utensils, label: 'Mahlzeit' },
    { to: '/rewards', icon: Star, label: 'Sterne' },
    { to: '/setup', icon: Settings, label: 'Setup' },
  ];

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'var(--color-surface)',
      borderTop: '1px solid var(--color-border)',
      display: 'flex',
      justifyContent: 'space-around',
      padding: '0.75rem 0',
      paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))', // For iOS
      zIndex: 10,
    }}>
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.25rem',
            color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
            textDecoration: 'none',
            fontSize: 'var(--font-xs)',
            transition: 'color 0.2s',
          })}
        >
          {({ isActive }) => (
            <>
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              <span style={{ fontWeight: isActive ? 600 : 400 }}>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
};
