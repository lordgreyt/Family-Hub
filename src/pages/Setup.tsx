import React, { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';
import { LogOut, Palette, Type, Users, Trash2, Plus, Lock } from 'lucide-react';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '../services/firebase';

import { createUserWithEmailAndPassword } from 'firebase/auth';
import { secondaryAuth } from '../services/firebase';

export const Setup = () => {
  const { settings, updateSettings } = useSettings();
  const { user, logout } = useAuth();
  
  const [dbUsers, setDbUsers] = useState(mockDb.getUsers());
  const [newUserId, setNewUserId] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUserIsChild, setNewUserIsChild] = useState(false);
  const [lastCreatedUser, setLastCreatedUser] = useState<{ id: string, pass: string } | null>(null);
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [oldPassword, setOldPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [pwMessage, setPwMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const load = () => setDbUsers(mockDb.getUsers());
    window.addEventListener('db_updated', load);
    return () => window.removeEventListener('db_updated', load);
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setIsCreating(true);

    if (!newUserId.trim() || !newEmail.trim() || !newPassword.trim()) {
      setCreateError('Alle Felder müssen ausgefüllt sein.');
      setIsCreating(false);
      return;
    }

    if (newPassword.length < 6) {
      setCreateError('Das Passwort muss mindestens 6 Zeichen lang sein.');
      setIsCreating(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      setCreateError('Bitte gib eine gültige E-Mail-Adresse ein.');
      setIsCreating(false);
      return;
    }
    
    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newEmail, newPassword);
      const uid = userCredential.user.uid;
      
      const profileData = { 
        id: newUserId.trim(), 
        avatar: '❓',
        isSetupComplete: false,
        isChild: newUserIsChild,
        uid
      };
      
      await mockDb.saveProfile(uid, profileData);
      
      setLastCreatedUser({ id: profileData.id, pass: 'Erfolgreich erstellt!' });
      setNewUserId('');
      setNewEmail('');
      setNewPassword('');
      setNewUserIsChild(false);
    } catch (err: any) {
      console.error("User creation error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setCreateError('Diese E-Mail-Adresse wird bereits verwendet.');
      } else if (err.code === 'auth/weak-password') {
        setCreateError('Das Passwort ist zu schwach.');
      } else {
        setCreateError('Fehler beim Erstellen des Nutzers (Firebase).');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleChild = (targetUser: any) => {
    mockDb.updateUser({ ...targetUser, isChild: !targetUser.isChild });
  };

  const handleDeleteUser = (id: string) => {
    if (user?.id === id) return;
    if (confirm(`Möchtest du den Nutzer ${id} wirklich löschen?`)) {
       mockDb.deleteUser(id);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !user) return;
    
    if (newPassword.length < 6) {
      setPwMessage({ type: 'error', text: 'Das neue Passwort muss mindestens 6 Zeichen lang sein.' });
      return;
    }
    
    if (newPassword !== newPasswordConfirm) {
      setPwMessage({ type: 'error', text: 'Die neuen Passwörter stimmen nicht überein.' });
      return;
    }

    try {
      if (auth.currentUser.email) {
        const credential = EmailAuthProvider.credential(auth.currentUser.email, oldPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await updatePassword(auth.currentUser, newPassword);
        setPwMessage({ type: 'success', text: 'Passwort erfolgreich geändert!' });
        setOldPassword('');
        setNewPassword('');
        setNewPasswordConfirm('');
      } else {
        setPwMessage({ type: 'error', text: 'Keine E-Mail-Adresse für diesen Account hinterlegt.' });
      }
    } catch (err: any) {
      console.error("Password change error:", err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setPwMessage({ type: 'error', text: 'Das aktuelle Passwort ist falsch.' });
      } else {
        setPwMessage({ type: 'error', text: 'Fehler beim Ändern des Passworts. Bitte erneut anmelden.' });
      }
    }
    
    setTimeout(() => setPwMessage({ type: '', text: '' }), 5000);
  };
  
  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettings({ themeColor: e.target.value as any });
  };
  
  const handleFontSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettings({ fontSize: e.target.value as any });
  };

  return (
    <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--color-text)' }}>
          <Palette size={20} /> Design & Darstellung
        </h3>
        
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
            Design-Farben
          </label>
          <select value={settings.themeColor} onChange={handleThemeChange} className="input-field">
            <option value="indigo">Indigo (Standard)</option>
            <option value="rose">Rose</option>
            <option value="emerald">Smaragd (Emerald)</option>
            <option value="amber">Bernstein (Amber)</option>
            <option value="cyan">Cyan</option>
            <option value="violet">Violett</option>
            <option value="slate">Schiefergrau (Slate)</option>
            <option value="teal">Petrol (Teal)</option>
            <option value="pink">Pink</option>
          </select>
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
            <Type size={16} /> Schriftgröße
          </label>
          <select value={settings.fontSize} onChange={handleFontSizeChange} className="input-field">
            <option value="small">Klein</option>
            <option value="base">Normal</option>
            <option value="large">Groß</option>
          </select>
        </div>
      </div>

      {(user?.isAdmin || user?.id === 'Falko') && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--color-text)' }}>
            <Users size={20} /> Nutzerverwaltung
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
            {dbUsers.map(u => (
              <div key={u.id} style={{ padding: '0.75rem', margin: 0, backgroundColor: 'var(--color-surface-hover)', borderRadius: 'var(--radius-md)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>{u.avatar}</span>
                  <strong>{u.id}</strong>
                  {(u.isAdmin || u.id === 'Falko') && <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-primary)' }}>(Admin)</span>}
                  {u.isChild && <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-primary-dark)', backgroundColor: 'var(--color-primary-light)', padding: '0.1rem 0.4rem', borderRadius: '4px', opacity: 0.8, whiteSpace: 'nowrap' }}>Kindermodus</span>}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginLeft: 'auto' }}>
                  {u.id !== user!.id && u.id !== 'Falko' && !u.isAdmin && (
                    <button 
                      onClick={() => handleToggleChild(u)} 
                      className="btn" 
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      {u.isChild ? 'Erwachsene' : 'Kind'}
                    </button>
                  )}
                  {u.id !== user!.id && (
                    <button onClick={() => handleDeleteUser(u.id)} style={{ color: 'var(--color-danger)', border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}>
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h4 style={{ color: 'var(--color-text)', fontSize: '1rem' }}>Neuen Nutzer anlegen</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input 
                type="text" 
                value={newUserId}
                onChange={e => setNewUserId(e.target.value)}
                className="input-field" 
                placeholder="Anzeigename (z.B. Anna)" 
                required 
              />
              <input 
                type="email" 
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                className="input-field" 
                placeholder="E-Mail Adresse" 
                required 
              />
              <input 
                type="password" 
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="input-field" 
                placeholder="Initiales Passwort (min. 6 Zeichen)" 
                required 
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-sm)', color: 'var(--color-text)' }}>
              <input 
                type="checkbox" 
                checked={newUserIsChild} 
                onChange={e => setNewUserIsChild(e.target.checked)} 
              />
              Als Kinderaccount anlegen (eingeschränkte Sicht)
            </label>

            {createError && (
              <p style={{ color: 'var(--color-danger)', fontSize: 'var(--font-sm)' }}>{createError}</p>
            )}

            <button type="submit" className="btn btn-primary" disabled={isCreating} style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              {isCreating ? 'Wird erstellt...' : <><Plus size={20} /> Nutzer Account erstellen</>}
            </button>

            {lastCreatedUser && (
              <div style={{ padding: '1rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-success)', fontSize: 'var(--font-sm)', lineHeight: 1.5 }}>
                Profil <strong>{lastCreatedUser.id}</strong> erfolgreich angelegt!<br/>
                Der Nutzer kann sich nun mit seiner E-Mail anmelden.
              </div>
            )}
          </form>
        </div>
      )}

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h4 style={{ color: 'var(--color-text)', fontSize: '1rem' }}>Konto-Profileinstellungen</h4>
          
          {!user?.isChild && (
            <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border)' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
                Bevorzugte Startseite beim Öffnen
              </label>
              <select 
                value={user?.defaultPath || '/'} 
                onChange={(e) => {
                  if (user) {
                    mockDb.updateUser({ ...user, defaultPath: e.target.value });
                  }
                }} 
                className="input-field"
              >
                <option value="/">Dashboard (Home)</option>
                <option value="/expenses">Ausgaben</option>
                <option value="/tasks">Aufgaben</option>
                <option value="/notes">Notizen</option>
                <option value="/meals">Mahlzeit</option>
                <option value="/rewards">Sterne</option>
              </select>
              <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.4rem' }}>
                Wähle aus, auf welcher Seite du nach dem Login landen möchtest.
              </p>
            </div>
          )}

          <h4 style={{ color: 'var(--color-text)', fontSize: '1rem' }}>Passwort ändern</h4>
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
              Aktuelles Passwort (zur Bestätigung)
            </label>
            <input 
              type="password" 
              value={oldPassword}
              onChange={e => setOldPassword(e.target.value)}
              className="input-field" 
              required 
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
              Neues Passwort
            </label>
            <input 
              type="password" 
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="input-field" 
              required 
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
              Neues Passwort bestätigen
            </label>
            <input 
              type="password" 
              value={newPasswordConfirm}
              onChange={e => setNewPasswordConfirm(e.target.value)}
              className="input-field" 
              required 
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', marginTop: '0.5rem' }}>
            Passwort in Firebase aktualisieren
          </button>
          
          {pwMessage.text && (
            <div style={{ marginTop: '0.5rem', fontSize: 'var(--font-sm)', color: pwMessage.type === 'error' ? 'var(--color-danger)' : 'var(--color-success)' }}>
              {pwMessage.text}
            </div>
          )}
        </form>
      </div>

      <button onClick={logout} className="btn" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}>
        <LogOut size={20} /> Abmelden ({user?.id})
      </button>

    </div>
  );
};
