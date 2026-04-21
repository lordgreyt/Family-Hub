import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { auth } from '../services/firebase';
import { mockDb } from '../services/mockDb';
import type { User } from '../services/mockDb';

const EMOJI_OPTIONS = ['👨', '👩', '👦', '👧', '👴', '👵', '🤖', '👻', '👽', '🦄'];

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // For first-time setup
  const [selectedAvatar, setSelectedAvatar] = useState(EMOJI_OPTIONS[0]);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [tempUser, setTempUser] = useState<User | null>(null);

  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      if (user.isSetupComplete === false) {
        setNeedsSetup(true);
      } else {
        navigate('/');
      }
    }
  }, [user, loading, navigate]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoggingIn(true);
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      // The onAuthStateChanged in AuthContext will handle the user state.
      // But we need to check if user needs setup immediately for better UX.
      const hubUser = mockDb.getUsers().find(u => u.uid === firebaseUser.uid);
      
      if (hubUser && hubUser.isSetupComplete === false) {
        setTempUser(hubUser);
        setNeedsSetup(true);
      }
      // If hubUser is complete, useEffect will redirect.
      // If hubUser doesn't exist at all, we might need to create one, 
      // but for now we assume they are pre-linked.
    } catch (err: any) {
      console.error("Login error:", err);
      switch (err.code) {
        case 'auth/user-not-found':
          setError('Benutzer nicht gefunden.');
          break;
        case 'auth/wrong-password':
          setError('Falsches Passwort.');
          break;
        case 'auth/invalid-email':
          setError('Ungültige E-Mail Adresse.');
          break;
        case 'auth/invalid-credential':
          setError('E-Mail oder Passwort ist falsch.');
          break;
        default:
          setError('Anmeldung fehlgeschlagen. Bitte versuche es erneut.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSetupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user && !tempUser) return;
    
    const targetUser = user || tempUser;
    if (!targetUser) return;

    const updatedUser = { ...targetUser, avatar: selectedAvatar, isSetupComplete: true };
    mockDb.updateUser(updatedUser);
    
    // AuthContext will pick up the changes via the db_updated event 
    // or we can manually navigate since we know setup is done.
    navigate('/');
  };

  if (loading) return null;

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
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)' }}>Willkommen! Bitte wähle deinen Avatar aus.</p>
            
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
        ) : (
          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>E-Mail</label>
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-field" 
                placeholder="beispiel@mail.de"
                autoFocus
                required 
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Passwort</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-field" 
                placeholder="••••••••"
                required 
              />
            </div>

            {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.875rem', marginTop: '0.5rem' }}>{error}</p>}

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ marginTop: '1rem' }}
              disabled={isLoggingIn}
            >
              {isLoggingIn ? 'Anmeldung...' : 'Einloggen'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
