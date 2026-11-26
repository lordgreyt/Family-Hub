import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { auth } from '../services/firebase';
import { AvatarEmoji } from '../components/AvatarEmoji';
import { mockDb } from '../services/mockDb';
import type { User } from '../services/mockDb';
import { ONBOARDING_AVATARS } from '../data/avatars';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // For first-time setup
  const [selectedAvatar, setSelectedAvatar] = useState(ONBOARDING_AVATARS[0]?.id || 'avatar:papa');
  const [selectedColor, setSelectedColor] = useState(ONBOARDING_AVATARS[0]?.accent || '#6D5DF0');
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
      const hubUser = mockDb.getUsers().find(u => u.uid === firebaseUser.uid);

      if (hubUser && hubUser.isSetupComplete === false) {
        setTempUser(hubUser);
        setNeedsSetup(true);
      }
    } catch (err: any) {
      console.error('Login error:', err);
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
    const targetUser = user || tempUser;
    if (!targetUser) return;

    const updatedUser = {
      ...targetUser,
      avatar: selectedAvatar,
      avatarColor: selectedColor,
      isSetupComplete: true,
    };
    mockDb.updateUser(updatedUser);
    navigate('/');
  };

  if (loading) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        padding: '1.5rem',
        background: 'var(--app-gradient)',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '2rem 1.75rem',
          textAlign: 'center',
          borderRadius: '28px',
          background: 'rgba(255, 255, 255, 0.94)',
          boxShadow: '0 24px 60px rgba(23, 20, 58, 0.22)',
        }}
      >
        <h1 style={{ marginBottom: '0.35rem', color: 'var(--color-text)', fontWeight: 800, letterSpacing: '-0.02em' }}>
          Willkommen
        </h1>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.75rem', fontWeight: 600 }}>
          Family Hub
        </p>

        {needsSetup ? (
          <form onSubmit={handleSetupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <div
                style={{
                  width: '84px',
                  height: '84px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  margin: '0 auto 0.75rem',
                  background: selectedColor,
                  border: '3px solid #FFFFFF',
                  boxShadow: '0 10px 24px rgba(63, 52, 196, 0.22)',
                }}
              >
                <AvatarEmoji emoji={selectedAvatar} size={84} />
              </div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                Profilbild wählen
              </h2>
              <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)', margin: '0.25rem 0 0' }}>
                Du kannst es später jederzeit im Profil-Studio ändern oder ein eigenes Foto hochladen.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.55rem' }}>
              {ONBOARDING_AVATARS.map(item => {
                const active = selectedAvatar === item.id;
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      setSelectedAvatar(item.id);
                      setSelectedColor(item.accent);
                    }}
                    title={item.label}
                    style={{
                      position: 'relative',
                      padding: '3px',
                      borderRadius: '50%',
                      aspectRatio: '1',
                      background: 'transparent',
                      border: active ? '2.5px solid #5A4BE0' : '2.5px solid transparent',
                      cursor: 'pointer',
                      transition: 'transform 0.14s ease, border-color 0.14s ease',
                      transform: active ? 'scale(1.06)' : 'scale(1)',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        background: item.accent,
                      }}
                    >
                      <AvatarEmoji emoji={item.id} size={56} />
                    </div>
                    {active && (
                      <span
                        style={{
                          position: 'absolute',
                          right: 0,
                          bottom: 0,
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: '#5A4BE0',
                          color: '#FFFFFF',
                          border: '2px solid #FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Check size={10} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="submit"
              style={{
                height: '50px',
                border: 'none',
                borderRadius: '999px',
                background: 'linear-gradient(135deg, #3F34C4 0%, #6D5DF0 100%)',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: 'var(--font-base)',
                fontFamily: 'inherit',
                cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(63, 52, 196, 0.3)',
              }}
            >
              Fertigstellen & Starten
            </button>
          </form>
        ) : (
          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.45rem', fontWeight: 700, fontSize: 'var(--font-sm)' }}>E-Mail</label>
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
              <label style={{ display: 'block', marginBottom: '0.45rem', fontWeight: 700, fontSize: 'var(--font-sm)' }}>Passwort</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
              />
            </div>

            {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.875rem', marginTop: '0.25rem', fontWeight: 600 }}>{error}</p>}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ marginTop: '0.75rem', height: '50px', borderRadius: '999px', fontWeight: 800 }}
              disabled={isLoggingIn}
            >
              {isLoggingIn ? 'Anmeldung…' : 'Einloggen'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
