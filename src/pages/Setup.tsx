import React, { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';
import { LogOut, Palette, Type, Users, Trash2, Plus, Database, Cloud, CloudOff, HardDrive, RotateCw } from 'lucide-react';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '../services/firebase';

import { createUserWithEmailAndPassword } from 'firebase/auth';
import { secondaryAuth } from '../services/firebase';

import { isDriveConnected, requestAccessToken, disconnectDrive, getGoogleClientId, setGoogleClientId } from '../services/googleDrive';
import { runBackup, getLastBackupInfo, isBackupDue, fetchDriveBackups, restoreFromDrive } from '../services/backupService';

import { getNavItems } from '../utils/navigation';

export const Setup = () => {
  const { settings, updateSettings } = useSettings();
  const { user, logout } = useAuth();
  
  const navItems = getNavItems(user);
  
  const [dbUsers, setDbUsers] = useState(mockDb.getUsers());

  const [newUserId, setNewUserId] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUserIsChild, setNewUserIsChild] = useState(false);
  const [lastCreatedUser, setLastCreatedUser] = useState<{ id: string, pass: string } | null>(null);
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [changePwOld, setChangePwOld] = useState('');
  const [changePwNew, setChangePwNew] = useState('');
  const [changePwConfirm, setChangePwConfirm] = useState('');
  const [isChangingPw, setIsChangingPw] = useState(false);

  // Google Drive State
  const [driveConnected, setDriveConnected] = useState(isDriveConnected());
  const [googleClientId, setGoogleClientIdLocal] = useState(getGoogleClientId());
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [driveError, setDriveError] = useState('');
  const [driveSuccess, setDriveSuccess] = useState('');
  const [isRunningBackup, setIsRunningBackup] = useState(false);
  const lastBackup = getLastBackupInfo();

  // Restore Dialog State
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [driveBackups, setDriveBackups] = useState<{ id: string; name: string; createdTime: string }[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [restoreError, setRestoreError] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);

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
    
    if (changePwNew.length < 6) {
      alert('Das neue Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }
    
    if (changePwNew !== changePwConfirm) {
      alert('Die neuen Passwörter stimmen nicht überein.');
      return;
    }

    setIsChangingPw(true);

    try {
      if (auth.currentUser.email) {
        const credential = EmailAuthProvider.credential(auth.currentUser.email, changePwOld);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await updatePassword(auth.currentUser, changePwNew);
        
        alert('Passwort erfolgreich geändert!');
        
        setChangePwOld('');
        setChangePwNew('');
        setChangePwConfirm('');
      } else {
        alert('Fehler: Keine E-Mail-Adresse für diesen Account hinterlegt.');
      }
    } catch (err: any) {
      console.error("Password change error:", err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        alert('Passwort ändern fehlgeschlagen: Das aktuelle Passwort ist falsch.');
      } else {
        alert('Passwort ändern fehlgeschlagen: Bitte logge dich einmal neu ein und versuche es erneut.');
      }
    } finally {
      setIsChangingPw(false);
    }
  };

  const handleConnectDrive = async () => {
    setIsConnectingDrive(true);
    setDriveError('');
    setDriveSuccess('');
    try {
      const token = await requestAccessToken();
      if (token) {
        setDriveConnected(true);
        setDriveSuccess('Google Drive erfolgreich verbunden!');
        setTimeout(() => setDriveSuccess(''), 4000);
      }
    } catch (err: any) {
      setDriveError(err.message || 'Verbindung fehlgeschlagen');
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const handleDisconnectDrive = () => {
    disconnectDrive();
    setDriveConnected(false);
    setDriveSuccess('');
  };

  const handleSaveClientId = () => {
    if (!googleClientId.trim()) return;
    setGoogleClientId(googleClientId.trim());
    setDriveSuccess('Client ID gespeichert. Du kannst dich jetzt verbinden.');
    setTimeout(() => setDriveSuccess(''), 4000);
  };

  const handleManualBackup = async () => {
    setIsRunningBackup(true);
    setDriveError('');
    setDriveSuccess('');
    try {
      const result = await runBackup();
      if (result.success) {
        setDriveSuccess(`Backup gespeichert: ${result.fileName}`);
        setTimeout(() => setDriveSuccess(''), 4000);
      } else {
        setDriveError(result.error || 'Backup fehlgeschlagen');
      }
    } catch (err: any) {
      setDriveError(err.message || 'Backup fehlgeschlagen');
    } finally {
      setIsRunningBackup(false);
    }
  };

  const handleOpenRestore = async () => {
    setShowRestoreDialog(true);
    setRestoreError('');
    setDriveBackups([]);
    setIsLoadingBackups(true);
    try {
      const backups = await fetchDriveBackups(5);
      setDriveBackups(backups);
    } catch (err: any) {
      setRestoreError(err.message || 'Backups konnten nicht geladen werden');
    } finally {
      setIsLoadingBackups(false);
    }
  };

  const handleRestoreBackup = async (fileId: string, fileName: string) => {
    if (!confirm(`Möchtest du wirklich ALLE Family Hub Daten mit dem Backup "${fileName}" überschreiben? Dies kann nicht rückgängig gemacht werden.`)) {
      return;
    }
    setIsRestoring(true);
    setRestoreError('');
    try {
      const result = await restoreFromDrive(fileId, fileName);
      if (result.success) {
        setDriveSuccess(`${result.restoredCount} Datenbereiche aus "${fileName}" wiederhergestellt!`);
        setTimeout(() => setDriveSuccess(''), 6000);
        setShowRestoreDialog(false);
      } else {
        setRestoreError(result.error || 'Restore fehlgeschlagen');
      }
    } catch (err: any) {
      setRestoreError(err.message || 'Restore fehlgeschlagen');
    } finally {
      setIsRestoring(false);
    }
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

        {(user?.isAdmin || user?.id === 'Falko') && (
          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--color-text)', fontSize: 'var(--font-sm)', fontWeight: 600 }}>
              Aufgaben-Punkte (Sterne)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              {[1, 2, 3].map((prio) => (
                <div key={prio}>
                  <label style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Prio {prio}</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={settings.prioPoints[prio]} 
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      updateSettings({ prioPoints: { ...settings.prioPoints, [prio]: val } });
                    }}
                    style={{ padding: '0.5rem', textAlign: 'center' }}
                  />
                </div>
              ))}
            </div>
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '0.75rem' }}>
              Lege fest, wie viele Sterne die Kinder für jede Aufgaben-Priorität erhalten.
            </p>
          </div>
        )}

        {(user?.isAdmin || user?.id === 'Falko') && (
          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--color-text)', fontSize: 'var(--font-sm)', fontWeight: 600 }}>
              Video-Belohnungen
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Sterne pro Videominute</label>
                <input 
                  type="number" 
                  className="input-field" 
                  value={settings.videoCostPerMinute} 
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    updateSettings({ videoCostPerMinute: val });
                  }}
                  style={{ padding: '0.5rem', textAlign: 'center' }}
                />
              </div>
              <div style={{ flex: 2, fontSize: '11px', color: 'var(--color-text-muted)' }}>
                Kosten für das Freischalten von Videos (EinfachGustaf). 
                Ein 5-Minuten-Video kostet bei 2 Sternen/Min also 10 Sterne.
              </div>
            </div>
            <div style={{ marginTop: '1rem' }}>
              <label style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>YouTube API Key (optional für Updates)</label>
              <input 
                type="password" 
                className="input-field" 
                value={settings.youtubeApiKey || ''} 
                onChange={(e) => updateSettings({ youtubeApiKey: e.target.value })}
                placeholder="AIzaSy..."
                style={{ padding: '0.5rem' }}
              />
              <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                Wird benötigt, um die neuesten Videos automatisch direkt in der App zu laden.
              </p>
            </div>
          </div>
        )}
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
                {navItems.map(item => (
                  <option key={item.to} value={item.to}>
                    {item.label} {item.to === '/' ? '(Home)' : ''}
                  </option>
                ))}
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
              value={changePwOld}
              onChange={e => setChangePwOld(e.target.value)}
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
              value={changePwNew}
              onChange={e => setChangePwNew(e.target.value)}
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
              value={changePwConfirm}
              onChange={e => setChangePwConfirm(e.target.value)}
              className="input-field" 
              required 
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={isChangingPw} style={{ alignSelf: 'flex-start', marginTop: '0.5rem' }}>
            {isChangingPw ? 'Wird aktualisiert...' : 'Passwort in Firebase aktualisieren'}
          </button>
        </form>
      </div>

      {(user?.isAdmin || user?.id === 'Falko') && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--color-text)' }}>
            <Database size={20} /> System & Backup
          </h3>

          {/* Google Drive Verbindung */}
          <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--color-border)' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', marginBottom: '0.75rem', color: 'var(--color-text)' }}>
              <HardDrive size={18} /> Google Drive Backup
            </h4>

            {!driveConnected ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                    Google OAuth 2.0 Client ID
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      className="input-field"
                      value={googleClientId}
                      onChange={e => setGoogleClientIdLocal(e.target.value)}
                      placeholder="123456789-xxx.apps.googleusercontent.com"
                      style={{ padding: '0.5rem', fontSize: '0.8rem' }}
                    />
                    <button onClick={handleSaveClientId} className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      Speichern
                    </button>
                  </div>
                  <p style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                    Erstelle eine OAuth 2.0 Client ID in der Google Cloud Console (Webanwendung). Authorized origins: http://localhost:5173
                  </p>
                </div>

                <button
                  onClick={handleConnectDrive}
                  disabled={!googleClientId.trim() || isConnectingDrive}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: !googleClientId.trim() ? 0.5 : 1 }}
                >
                  <Cloud size={18} /> {isConnectingDrive ? 'Verbinde...' : 'Mit Google Drive verbinden'}
                </button>
              </div>
            ) : (
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.6rem 0.75rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  marginBottom: '0.75rem',
                }}>
                  <Cloud size={18} color="var(--color-success)" />
                  <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--color-success)' }}>Google Drive verbunden</span>
                  <button onClick={handleDisconnectDrive} style={{ marginLeft: 'auto', color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}>
                    <CloudOff size={14} /> Trennen
                  </button>
                </div>

                {lastBackup && (
                  <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
                    Letztes Backup: {new Date(lastBackup.timestamp).toLocaleString('de-DE')}
                    {isBackupDue() && <span style={{ color: 'var(--color-primary)', marginLeft: '0.5rem' }}>– Neues Backup fällig</span>}
                  </p>
                )}

                <button
                  onClick={handleManualBackup}
                  disabled={isRunningBackup}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                >
                  <RotateCw size={16} style={isRunningBackup ? { animation: 'spin 1s linear infinite' } : {}} />
                  {isRunningBackup ? 'Läuft...' : 'Jetzt Backup durchführen'}
                </button>
              </div>
            )}

            {driveError && (
              <p style={{ color: 'var(--color-danger)', fontSize: '0.75rem', marginTop: '0.5rem' }}>{driveError}</p>
            )}
            {driveSuccess && (
              <p style={{ color: 'var(--color-success)', fontSize: '0.75rem', marginTop: '0.5rem' }}>{driveSuccess}</p>
            )}
          </div>

          {/* Restore aus Google Drive */}
          <div>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem', color: 'var(--color-text)' }}>Backup wiederherstellen</h4>
            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', margin: '0 0 0.75rem 0' }}>
              Wähle eines der letzten 5 Backups aus Google Drive zum Wiederherstellen aus.
            </p>

            <button
              onClick={handleOpenRestore}
              disabled={!driveConnected}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', width: '100%', opacity: driveConnected ? 1 : 0.5 }}
            >
              <Database size={18} /> {driveConnected ? 'Backup aus Google Drive wiederherstellen' : 'Nicht mit Drive verbunden'}
            </button>

            {/* Restore Dialog */}
            {showRestoreDialog && (
              <div style={{
                position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
                alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000
              }} onClick={() => setShowRestoreDialog(false)}>
                <div style={{
                  backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
                  width: '100%', maxWidth: '500px', maxHeight: '70vh', overflow: 'auto', padding: '1.5rem'
                }} onClick={e => e.stopPropagation()}>
                  <h4 style={{ color: 'var(--color-text)', marginBottom: '1rem' }}>Backup auswählen</h4>

                  {isLoadingBackups ? (
                    <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>
                      <RotateCw size={20} style={{ animation: 'spin 1s linear infinite' }} /> Backups werden geladen...
                    </p>
                  ) : restoreError ? (
                    <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>{restoreError}</p>
                  ) : driveBackups.length === 0 ? (
                    <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>
                      Keine Backups in Google Drive gefunden.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {driveBackups.map(backup => (
                        <button
                          key={backup.id}
                          onClick={() => handleRestoreBackup(backup.id, backup.name)}
                          disabled={isRestoring}
                          className="btn btn-secondary"
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '0.75rem 1rem', textAlign: 'left', width: '100%',
                            opacity: isRestoring ? 0.5 : 1
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text)' }}>{backup.name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
                              {new Date(backup.createdTime).toLocaleString('de-DE')}
                            </div>
                          </div>
                          {isRestoring && <RotateCw size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => setShowRestoreDialog(false)}
                    className="btn"
                    style={{ marginTop: '1rem', width: '100%', padding: '0.75rem', backgroundColor: 'var(--color-surface-hover)' }}
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <button onClick={logout} className="btn" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}>
        <LogOut size={20} /> Abmelden ({user?.id})
      </button>

    </div>
  );
};
