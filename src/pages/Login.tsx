import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';
import type { User } from '../services/mockDb';

const EMOJI_OPTIONS = ['👨', '👩', '👦', '👧', '👴', '👵', '🤖', '👻', '👽', '🦄'];

export const Login = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  // For first-time setup
  const [selectedAvatar, setSelectedAvatar] = useState(EMOJI_OPTIONS[0]);
  const [needsSetup, setNeedsSetup] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setUsers(mockDb.getUsers());
  }, []);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!selectedUser) return;
    
    if (selectedUser.password && selectedUser.password !== password) {
      setError('Falsches Passwort');
      return;
    }
    
    if (selectedUser.isSetupComplete === false) {
      setNeedsSetup(true);
    } else {
      login(selectedUser);
      navigate('/');
    }
  };

  const handleSetupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    
    const updatedUser = { ...selectedUser, avatar: selectedAvatar, isSetupComplete: true };
    mockDb.updateUser(updatedUser);
    login(updatedUser);
    navigate('/');
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      padding: '2rem',
      backgroundColor: 'var(--color-primary)'
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2rem', textAlign: 'center' }}>
        <h1 style={{ marginBottom: '0.5rem', color: 'var(--color-text)' }}>Willkommen</h1>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>Family Hub PWA</p>

        {needsSetup ? (
          <form onSubmit={handleSetupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--color-text)' }}>Erster Login - Setup</h2>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)' }}>Willkommen {selectedUser?.id}! Bitte wähle deinen Avatar aus.</p>
            
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
                {EMOJI_OPTIONS.map(emoji => (
                  <button
                    type="button"
                    key={emoji}
                    onClick={() => setSelectedAvatar(emoji)}
                    style={{
                      fontSize: '2rem',
                      padding: '0.5rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: selectedAvatar === emoji ? 'var(--color-primary-light)' : 'var(--color-surface)',
                      border: `1px solid ${selectedAvatar === emoji ? 'var(--color-primary)' : 'var(--color-border)'}`
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className="btn btn-primary">
              Fertigstellen & Starten
            </button>
          </form>
        ) : !selectedUser ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {users.map(user => (
              <button
                key={user.id}
                onClick={() => setSelectedUser(user)}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '1rem' }}
              >
                <span style={{ fontSize: '1.5rem', opacity: user.isSetupComplete === false ? 0.5 : 1 }}>
                  {user.isSetupComplete === false ? '❓' : user.avatar}
                </span>
                <span style={{ fontSize: '1.125rem' }}>{user.id}</span>
              </button>
            ))}
            {users.length === 0 && <p>Keine Nutzer gefunden.</p>}
          </div>
        ) : (
          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', padding: '0.5rem', backgroundColor: 'var(--color-surface-hover)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: '1.5rem', opacity: selectedUser.isSetupComplete === false ? 0.5 : 1 }}>
                {selectedUser.isSetupComplete === false ? '❓' : selectedUser.avatar}
              </span>
              <span style={{ fontWeight: 600 }}>{selectedUser.id}</span>
              <button type="button" onClick={() => { setSelectedUser(null); setPassword(''); setError(''); }} style={{ marginLeft: 'auto', fontSize: '0.875rem', color: 'var(--color-primary)' }}>Ändern</button>
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Passwort</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-field" 
                autoFocus
                required 
              />
              {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.875rem', marginTop: '0.5rem' }}>{error}</p>}
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
              Einloggen
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
