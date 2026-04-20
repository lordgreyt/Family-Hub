import { useAuth } from '../../context/AuthContext';

export const TopBar = () => {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '1rem',
      backgroundColor: 'var(--color-surface)',
      borderBottom: '1px solid var(--color-border)',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>
      <h1 style={{ fontSize: 'var(--font-xl)', margin: 0, color: 'var(--color-primary)' }}>
        Family Hub
      </h1>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        backgroundColor: 'var(--color-surface-hover)',
        padding: '0.25rem 0.75rem',
        borderRadius: 'var(--radius-xl)'
      }}>
        <span style={{ fontSize: '1.25rem' }}>{user.avatar}</span>
        <span style={{ fontWeight: 500 }}>{user.id}</span>
      </div>
    </header>
  );
};
