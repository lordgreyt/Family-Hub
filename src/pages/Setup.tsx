import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';
import { LogOut, Palette, Type, Users, Trash2, Plus, Database, Cloud, CloudOff, HardDrive, RotateCw, Settings, Eye, KeyRound, Star, Check, X, Pencil, Sparkles, Shield, Volume2, Gift } from 'lucide-react';
import { AvatarEmoji } from '../components/AvatarEmoji';
import { ProfileSheet } from '../components/ProfileSheet';
import { extractInitials, STUDIO_GRADIENTS } from '../data/avatars';
import {
  DEFAULT_MODELS,
  PROVIDER_LABELS,
  detectProviderFromKey,
  loadVocabAiStatus,
  saveVocabAiKeySecurely,
} from '../services/vocabOcr';
import type { VocabAiProvider, VocabAiStatus } from '../services/vocabOcr';
import {
  OPENAI_VOICES,
  getLastTtsError,
  loadTtsStatus,
  saveTtsConfigSecurely,
  speakText,
} from './speech';
import type { EnglishAccent, OpenAiVoice, TtsStatus } from './speech';
import type { VocabGamificationSettings, VocabGamificationState, VocabShopReward } from './vocabGamification';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '../services/firebase';

import { createUserWithEmailAndPassword } from 'firebase/auth';
import { secondaryAuth } from '../services/firebase';

import { isDriveConnected, requestAccessToken, disconnectDrive, getGoogleClientId, setGoogleClientId } from '../services/googleDrive';
import { runBackup, getLastBackupInfo, isBackupDue, fetchDriveBackups, restoreFromDrive } from '../services/backupService';

import { getNavItems } from '../utils/navigation';
import { HERO_GRADIENT, GREEN, GREEN_TEXT, ORANGE, PINK, PINK_TEXT, PRIMARY, BLUE, LILAC, iconChip, CARD, sectionTitle, fieldLabel } from '../components/SurgeryFinance/theme';

const Section = ({ icon: Icon, color, title, subtitle, children }: { icon: typeof Palette; color: string; title: string; subtitle?: string; children: React.ReactNode }) => (
  <div style={CARD}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '1rem' }}>
      <span style={iconChip(color, 38)}><Icon size={18} /></span>
      <div style={{ minWidth: 0 }}>
        <h3 style={sectionTitle}>{title}</h3>
        {subtitle && <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>{subtitle}</div>}
      </div>
    </div>
    {children}
  </div>
);

const Toggle = ({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint?: string }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.7rem 0', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: 'var(--color-text)' }}
  >
    <span style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 'var(--font-sm)', fontWeight: 700 }}>{label}</span>
      {hint && <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{hint}</span>}
    </span>
    <span style={{ width: '48px', height: '28px', borderRadius: '999px', flexShrink: 0, position: 'relative', background: checked ? 'linear-gradient(135deg, #3F34C4, #6D5DF0)' : 'var(--color-border)', transition: 'background 0.2s' }}>
      <span style={{ position: 'absolute', top: '3px', left: checked ? '23px' : '3px', width: '22px', height: '22px', borderRadius: '50%', background: 'white', boxShadow: '0 2px 6px rgba(23,20,58,0.3)', transition: 'left 0.2s' }} />
    </span>
  </button>
);


export const Setup = () => {
  const { settings, updateSettings } = useSettings();
  const { user, logout } = useAuth();
  
  const navItems = getNavItems(user);
  
  const [dbUsers, setDbUsers] = useState(() => mockDb.getUsers());

  const [newUserId, setNewUserId] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUserIsChild, setNewUserIsChild] = useState(false);
  const [lastCreatedUser, setLastCreatedUser] = useState<{ id: string, pass: string } | null>(null);
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showProfileSheet, setShowProfileSheet] = useState(false);

  // KI Vokabelscanner API-Key (nur für Erwachsene sichtbar & nutzbar)
  const [vocabAiProvider, setVocabAiProvider] = useState<VocabAiProvider>('deepseek');
  const [vocabAiKey, setVocabAiKey] = useState('');
  const [vocabAiStatus, setVocabAiStatus] = useState<VocabAiStatus | null>(null);
  const [isSavingVocabAi, setIsSavingVocabAi] = useState(false);
  const [vocabAiFeedback, setVocabAiFeedback] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);

  // KI Sprachausgabe (OpenAI TTS — nur für Erwachsene konfigurierbar)
  const [ttsKey, setTtsKey] = useState('');
  const [ttsVoice, setTtsVoiceState] = useState<OpenAiVoice>('coral');
  const [ttsAccent, setTtsAccentState] = useState<EnglishAccent>('en-GB');
  const [ttsStatus, setTtsStatus] = useState<TtsStatus | null>(null);
  const [isSavingTts, setIsSavingTts] = useState(false);
  const [ttsFeedback, setTtsFeedback] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);

  // Vokabel-Gamification & Diamanten-Umtauschquote (nur für Erwachsene)
  const [vocabGamState, setVocabGamState] = useState<VocabGamificationState>(() => mockDb.getVocabGamification());
  const [gamDraft, setGamDraft] = useState<VocabGamificationSettings>(() => mockDb.getVocabGamification().settings);
  const [newShopEmoji, setNewShopEmoji] = useState('🎁');
  const [newShopTitle, setNewShopTitle] = useState('');
  const [newShopDiamonds, setNewShopDiamonds] = useState('25');
  const [gamFeedback, setGamFeedback] = useState<string>('');

  useEffect(() => {
    const syncGam = () => {
      const next = mockDb.getVocabGamification();
      setVocabGamState(next);
      setGamDraft(next.settings);
    };
    window.addEventListener('db_updated', syncGam);
    return () => window.removeEventListener('db_updated', syncGam);
  }, []);

  useEffect(() => {
    if (!user || user.isChild) return;
    let active = true;
    loadVocabAiStatus().then(status => {
      if (!active) return;
      setVocabAiStatus(status);
      setVocabAiProvider(status.provider);
    });
    loadTtsStatus().then(status => {
      if (!active) return;
      setTtsStatus(status);
      setTtsVoiceState(status.voice);
      setTtsAccentState(status.accent);
    });
    return () => { active = false; };
  }, [user]);

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
        avatar: `monogram:${extractInitials(newUserId.trim())}`,
        avatarColor: STUDIO_GRADIENTS[0].value,
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
      setShowCreate(false);
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
  
  const isAdmin = Boolean(user?.isAdmin || user?.id === 'Falko');
  const roleLabel = isAdmin ? 'Administrator' : user?.isChild ? 'Kind' : 'Erwachsener';

  const primaryBtn: React.CSSProperties = {
    width: '100%', height: '50px', border: 'none', borderRadius: '999px', cursor: 'pointer', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
    background: 'linear-gradient(135deg, #3F34C4 0%, #6D5DF0 100%)', color: 'white',
    fontSize: 'var(--font-base)', fontWeight: 800, boxShadow: '0 8px 20px rgba(63,52,196,0.3)',
  };
  const softBtn: React.CSSProperties = {
    width: '100%', height: '46px', border: 'none', borderRadius: '999px', cursor: 'pointer', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
    background: '#ECE8FF', color: '#3F34C4', fontSize: 'var(--font-sm)', fontWeight: 800,
  };
  const noteStyle: React.CSSProperties = { margin: '0.6rem 0 0', fontSize: '11px', lineHeight: 1.5, color: 'var(--color-text-muted)' };

  const sheetShell = (onClose: () => void, children: React.ReactNode) => createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(23,20,58,0.5)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 2000, animation: 'setupFade 0.2s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '500px', maxHeight: '94vh', overflowY: 'auto', borderRadius: '28px 28px 0 0',
          backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', boxShadow: '0 -12px 40px rgba(63,52,196,0.25)',
          padding: '0.75rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom))', animation: 'setupSheetUp 0.28s ease',
          display: 'flex', flexDirection: 'column', gap: '1rem',
        }}
      >
        <div style={{ width: '44px', height: '5px', borderRadius: '999px', background: 'var(--color-border)', alignSelf: 'center' }} />
        {children}
      </div>
    </div>,
    document.body
  );

  const sheetHeader = (title: string, onClose: () => void) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <h2 style={{ margin: 0, fontSize: 'var(--font-lg)', fontWeight: 800 }}>{title}</h2>
      <button type="button" onClick={onClose} aria-label="Schließen" style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#ECE8FF', color: '#3F34C4', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
        <X size={18} />
      </button>
    </div>
  );

  const message = (text: string, kind: 'error' | 'success') => (
    <div style={{
      marginTop: '0.75rem', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', fontWeight: 700,
      color: kind === 'error' ? PINK_TEXT : GREEN_TEXT, background: kind === 'error' ? '#FDE8EF' : '#E3F6EF', overflowWrap: 'anywhere',
    }}>
      {text}
    </div>
  );

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
      {/* Hero */}
      <div style={{ background: HERO_GRADIENT, borderRadius: 'var(--radius-xl)', padding: '1.3rem 1.25rem', color: 'white', boxShadow: '0 12px 28px rgba(63,52,196,0.28)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Settings size={19} />
          </span>
          <div>
            <div style={{ fontSize: 'var(--font-base)', fontWeight: 800 }}>Setup</div>
            <div style={{ fontSize: 'var(--font-xs)', opacity: 0.85, fontWeight: 600 }}>Einstellungen & System</div>
          </div>
        </div>
        <div style={{ marginTop: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
          <button
            type="button"
            onClick={() => setShowProfileSheet(true)}
            aria-label="Profil bearbeiten"
            style={{
              width: '66px', height: '66px', borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: user?.avatarColor || '#6D5DF0',
              border: '3px solid rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0, cursor: 'pointer', boxShadow: '0 8px 20px rgba(23,20,58,0.28)',
            }}
          >
            <AvatarEmoji emoji={user?.avatar || 'avatar:papa'} size={66} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--font-xl)', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.id}</div>
            <div style={{ fontSize: 'var(--font-xs)', opacity: 0.85, fontWeight: 600, overflowWrap: 'anywhere' }}>{auth.currentUser?.email || 'Nicht mit E-Mail verknüpft'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.45rem', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', padding: '0.24rem 0.65rem', borderRadius: '999px', background: 'rgba(255,255,255,0.2)', fontSize: '11px', fontWeight: 800 }}>
                {roleLabel}
              </span>
              <button
                type="button"
                onClick={() => setShowProfileSheet(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.24rem 0.7rem', borderRadius: '999px',
                  background: 'rgba(255,255,255,0.92)', color: '#3F34C4', border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: '11px', fontWeight: 800,
                }}
              >
                <Pencil size={11} /> Profil bearbeiten
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Darstellung */}
      <Section icon={Palette} color={PRIMARY} title="Design & Darstellung" subtitle="Schriftgröße und Sterne">
        <label style={fieldLabel}><Type size={12} style={{ verticalAlign: '-1px' }} /> Schriftgröße</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', padding: '4px', borderRadius: '999px', background: 'var(--color-surface-muted)' }}>
          {([['small', 'Klein'], ['base', 'Normal'], ['large', 'Groß']] as const).map(([value, label]) => {
            const active = settings.fontSize === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => updateSettings({ fontSize: value })}
                style={{
                  height: '38px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--font-sm)', fontWeight: 800,
                  background: active ? 'linear-gradient(135deg, #3F34C4, #6D5DF0)' : 'transparent', color: active ? 'white' : 'var(--color-text-muted)',
                  boxShadow: active ? '0 4px 12px rgba(63,52,196,0.3)' : 'none', transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {isAdmin && (
          <div style={{ marginTop: '1.25rem', paddingTop: '1.1rem', borderTop: '1px solid var(--color-border)' }}>
            <label style={fieldLabel}><Star size={12} style={{ verticalAlign: '-1px' }} /> Aufgaben-Punkte (Sterne)</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
              {[1, 2, 3].map((prio) => (
                <div key={prio} style={{ padding: '0.7rem 0.5rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface-hover)', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.05em', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Prio {prio}</div>
                  <input
                    type="number"
                    className="input-field"
                    value={settings.prioPoints[prio]}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      updateSettings({ prioPoints: { ...settings.prioPoints, [prio]: val } });
                    }}
                    style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 800, width: '100%', fontFamily: 'inherit' }}
                  />
                </div>
              ))}
            </div>
            <p style={noteStyle}>Lege fest, wie viele Sterne die Kinder für jede Aufgaben-Priorität erhalten.</p>
          </div>
        )}
      </Section>

      {/* Menü */}
      {isAdmin && (
        <Section icon={Eye} color={ORANGE} title="Menü & Sichtbarkeit" subtitle="Gilt global für alle Nutzer">
          <div style={{ margin: '-0.4rem 0' }}>
            <Toggle checked={settings.showPacklist} onChange={value => updateSettings({ showPacklist: value })} label="Packliste" hint="Im Menü anzeigen" />
            <div style={{ height: '1px', background: 'var(--color-border)' }} />
            <Toggle checked={settings.showHolidayBudget} onChange={value => updateSettings({ showHolidayBudget: value })} label="Urlaubsbudget" hint="Im Menü anzeigen" />
          </div>
          <p style={noteStyle}>Deaktivierte Bereiche werden im Menü ausgeblendet – z. B. außerhalb der Urlaubszeit. Die Daten bleiben erhalten.</p>
        </Section>
      )}

      {/* Nutzer */}
      {isAdmin && (
        <Section icon={Users} color={BLUE} title="Nutzerverwaltung" subtitle={`${dbUsers.length} Nutzer`}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {dbUsers.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0', borderTop: '1px solid var(--color-border)' }}>
                <span style={{
                  width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: u.avatarColor || '#6366f1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <AvatarEmoji emoji={u.avatar} size={40} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--font-sm)', fontWeight: 800, overflowWrap: 'anywhere' }}>{u.id}</div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                    {(u.isAdmin || u.id === 'Falko') ? 'Administrator' : u.isChild ? 'Kind' : 'Erwachsener'}
                  </div>
                  {u.id !== user!.id && u.id !== 'Falko' && !u.isAdmin && (
                    <button
                      onClick={() => handleToggleChild(u)}
                      style={{ marginTop: '0.4rem', height: '28px', padding: '0 0.7rem', borderRadius: '999px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: '#ECE8FF', color: '#3F34C4', fontSize: '11px', fontWeight: 800, whiteSpace: 'nowrap' }}
                    >
                      {u.isChild ? 'Zu Erwachsener ändern' : 'Zu Kind ändern'}
                    </button>
                  )}
                </div>
                {u.id !== user!.id && (
                  <button
                    onClick={() => handleDeleteUser(u.id)}
                    aria-label={`${u.id} löschen`}
                    style={{ width: '34px', height: '34px', borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#FDE8EF', color: PINK_TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {lastCreatedUser && message(`Profil ${lastCreatedUser.id} angelegt – der Nutzer kann sich nun mit seiner E-Mail anmelden.`, 'success')}

          <button onClick={() => { setCreateError(''); setShowCreate(true); }} style={{ ...softBtn, marginTop: '1rem' }}>
            <Plus size={18} /> Neuen Nutzer anlegen
          </button>
        </Section>
      )}

      {/* Konto */}
      <Section icon={KeyRound} color={GREEN} title="Mein Konto" subtitle="Startseite und Passwort">
        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {!user?.isChild && (
            <div style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--color-border)' }}>
              <label style={fieldLabel}>Startseite beim Öffnen</label>
              <select
                value={user?.defaultPath || '/'}
                onChange={(e) => {
                  if (user) {
                    mockDb.updateUser({ ...user, defaultPath: e.target.value });
                  }
                }}
                className="input-field"
                style={{ width: '100%' }}
              >
                {navItems.map(item => (
                  <option key={item.to} value={item.to}>
                    {item.label} {item.to === '/' ? '(Home)' : ''}
                  </option>
                ))}
              </select>
              <p style={noteStyle}>Wähle aus, auf welcher Seite du nach dem Login landen möchtest.</p>
            </div>
          )}

          <div style={{ fontSize: 'var(--font-sm)', fontWeight: 800 }}>Passwort ändern</div>

          <div>
            <label style={fieldLabel}>Aktuelles Passwort</label>
            <input type="password" value={changePwOld} onChange={e => setChangePwOld(e.target.value)} className="input-field" style={{ width: '100%' }} required />
          </div>
          <div>
            <label style={fieldLabel}>Neues Passwort</label>
            <input type="password" value={changePwNew} onChange={e => setChangePwNew(e.target.value)} className="input-field" style={{ width: '100%' }} required />
          </div>
          <div>
            <label style={fieldLabel}>Neues Passwort bestätigen</label>
            <input type="password" value={changePwConfirm} onChange={e => setChangePwConfirm(e.target.value)} className="input-field" style={{ width: '100%' }} required />
          </div>

          <button type="submit" disabled={isChangingPw} style={{ ...primaryBtn, opacity: isChangingPw ? 0.7 : 1 }}>
            <Check size={18} /> {isChangingPw ? 'Wird aktualisiert...' : 'Passwort aktualisieren'}
          </button>
        </form>
      </Section>

      {/* KI-Vokabelscanner — nur für Erwachsene, für Kinder unsichtbar & gesperrt */}
      {!user?.isChild && (
        <Section icon={Sparkles} color={PRIMARY} title="KI-Vokabelscanner" subtitle="DeepSeek, Gemini oder OpenAI · nur für Erwachsene">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {vocabAiStatus?.configured && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.7rem 0.85rem', borderRadius: 'var(--radius-lg)', background: '#E3F6EF' }}>
                <Shield size={17} color={GREEN_TEXT} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--font-sm)', fontWeight: 800, color: GREEN_TEXT }}>
                    {PROVIDER_LABELS[vocabAiStatus.provider]} aktiv ({vocabAiStatus.model})
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: GREEN_TEXT, opacity: 0.85 }}>
                    Key {vocabAiStatus.keyHint} · {vocabAiStatus.source === 'database' ? 'verschlüsselt gespeichert' : vocabAiStatus.source === 'env' ? 'Server-Variable' : 'lokal gespeichert'}
                  </div>
                </div>
                {vocabAiStatus.source !== 'env' && (
                  <button
                    type="button"
                    disabled={isSavingVocabAi}
                    onClick={async () => {
                      setIsSavingVocabAi(true);
                      setVocabAiFeedback(null);
                      try {
                        const next = await saveVocabAiKeySecurely(vocabAiProvider, '');
                        setVocabAiStatus(next);
                        setVocabAiKey('');
                        setVocabAiFeedback({ text: 'API-Key entfernt.', kind: 'success' });
                      } catch (err: unknown) {
                        setVocabAiFeedback({ text: err instanceof Error ? err.message : 'Fehler beim Entfernen.', kind: 'error' });
                      } finally {
                        setIsSavingVocabAi(false);
                      }
                    }}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: PINK_TEXT, fontFamily: 'inherit', fontSize: 'var(--font-xs)', fontWeight: 800 }}
                  >
                    Entfernen
                  </button>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', padding: '4px', borderRadius: '999px', background: 'var(--color-surface-muted)' }}>
              {([
                { id: 'deepseek', label: 'DeepSeek' },
                { id: 'gemini', label: 'Gemini' },
                { id: 'openai', label: 'OpenAI' },
              ] as const).map(opt => {
                const active = vocabAiProvider === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setVocabAiProvider(opt.id)}
                    style={{
                      height: '36px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--font-xs)', fontWeight: 800,
                      background: active ? 'linear-gradient(135deg, #3F34C4, #6D5DF0)' : 'transparent', color: active ? 'white' : 'var(--color-text-muted)',
                      boxShadow: active ? '0 4px 12px rgba(63,52,196,0.3)' : 'none',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <div>
              <label style={fieldLabel}>
                {PROVIDER_LABELS[vocabAiProvider]} API-Key ({DEFAULT_MODELS[vocabAiProvider]})
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="password"
                  className="input-field"
                  value={vocabAiKey}
                  onChange={e => {
                    const val = e.target.value;
                    setVocabAiKey(val);
                    const detected = detectProviderFromKey(val);
                    if (detected) setVocabAiProvider(detected);
                  }}
                  placeholder={
                    vocabAiStatus?.configured
                      ? 'Neuen Key zum Ersetzen eingeben…'
                      : vocabAiProvider === 'gemini'
                        ? 'AIzaSy…'
                        : 'sk-…'
                  }
                  autoComplete="off"
                  spellCheck={false}
                  style={{ flex: 1, minWidth: 0, padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                />
                <button
                  type="button"
                  disabled={isSavingVocabAi || !vocabAiKey.trim()}
                  onClick={async () => {
                    setIsSavingVocabAi(true);
                    setVocabAiFeedback(null);
                    try {
                      const next = await saveVocabAiKeySecurely(vocabAiProvider, vocabAiKey);
                      setVocabAiStatus(next);
                      setVocabAiProvider(next.provider);
                      setVocabAiKey('');
                      setVocabAiFeedback({
                        text: next.source === 'database'
                          ? `${PROVIDER_LABELS[next.provider]} API-Key verschlüsselt gespeichert.`
                          : `${PROVIDER_LABELS[next.provider]} API-Key lokal gespeichert.`,
                        kind: 'success',
                      });
                    } catch (err: unknown) {
                      setVocabAiFeedback({
                        text: err instanceof Error ? err.message : 'API-Key konnte nicht gespeichert werden.',
                        kind: 'error',
                      });
                    } finally {
                      setIsSavingVocabAi(false);
                    }
                  }}
                  style={{
                    height: '44px', padding: '0 1rem', borderRadius: '999px', border: 'none',
                    cursor: vocabAiKey.trim() && !isSavingVocabAi ? 'pointer' : 'default',
                    opacity: vocabAiKey.trim() && !isSavingVocabAi ? 1 : 0.5,
                    fontFamily: 'inherit', background: '#ECE8FF', color: '#3F34C4',
                    fontSize: 'var(--font-sm)', fontWeight: 800, whiteSpace: 'nowrap',
                  }}
                >
                  {isSavingVocabAi ? 'Speichere…' : 'Speichern'}
                </button>
              </div>
              <p style={noteStyle}>
                Wird verschlüsselt im geschützten Erwachsenen-Bereich gespeichert (im Live-Betrieb auf Vercel synchron für alle Eltern-Geräte). Kinder-Accounts haben weder Zugriff auf diese Einstellung noch auf den Kamera-Scanner.
              </p>
            </div>
            {vocabAiFeedback && message(vocabAiFeedback.text, vocabAiFeedback.kind)}
          </div>
        </Section>
      )}

      {/* KI-Sprachausgabe (OpenAI TTS) — nur für Erwachsene sichtbar */}
      {!user?.isChild && (
        <Section icon={Volume2} color={BLUE} title="KI-Sprachausgabe (OpenAI)" subtitle="Studio-Stimmen fürs Vokabeltraining · einmal hier hinterlegen, alle Familienmitglieder können vorlesen lassen">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {ttsStatus?.configured && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.7rem 0.85rem', borderRadius: 'var(--radius-lg)', background: '#E3F6EF' }}>
                <Shield size={17} color={GREEN_TEXT} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--font-sm)', fontWeight: 800, color: GREEN_TEXT }}>
                    OpenAI Studio-Stimme aktiv ({OPENAI_VOICES.find(v => v.id === ttsVoice)?.label || ttsVoice})
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: GREEN_TEXT, opacity: 0.85 }}>
                    Key {ttsStatus.keyHint} · {ttsStatus.source === 'database' ? 'verschlüsselt gespeichert' : ttsStatus.source === 'env' ? 'Server-Variable' : 'lokal gespeichert'}
                  </div>
                </div>
                {ttsStatus.source !== 'env' && (
                  <button
                    type="button"
                    disabled={isSavingTts}
                    onClick={async () => {
                      setIsSavingTts(true);
                      setTtsFeedback(null);
                      try {
                        const next = await saveTtsConfigSecurely({ voice: ttsVoice, accent: ttsAccent, remove: true });
                        setTtsStatus(next);
                        setTtsKey('');
                        setTtsFeedback({ text: 'OpenAI Sprach-Key entfernt.', kind: 'success' });
                      } catch (err: unknown) {
                        setTtsFeedback({ text: err instanceof Error ? err.message : 'Fehler beim Entfernen.', kind: 'error' });
                      } finally {
                        setIsSavingTts(false);
                      }
                    }}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: PINK_TEXT, fontFamily: 'inherit', fontSize: 'var(--font-xs)', fontWeight: 800 }}
                  >
                    Entfernen
                  </button>
                )}
              </div>
            )}

            <div>
              <label style={fieldLabel}>OpenAI API-Key (gpt-4o-mini-tts)</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="password"
                  className="input-field"
                  value={ttsKey}
                  onChange={e => setTtsKey(e.target.value)}
                  placeholder={ttsStatus?.configured ? 'Neuen OpenAI Key zum Ersetzen eingeben…' : 'sk-…'}
                  autoComplete="off"
                  spellCheck={false}
                  style={{ flex: 1, minWidth: 0, padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                />
                <button
                  type="button"
                  disabled={isSavingTts || (!ttsKey.trim() && !ttsStatus?.configured)}
                  onClick={async () => {
                    setIsSavingTts(true);
                    setTtsFeedback(null);
                    try {
                      const next = await saveTtsConfigSecurely({
                        apiKey: ttsKey.trim() || undefined,
                        voice: ttsVoice,
                        accent: ttsAccent,
                      });
                      setTtsStatus(next);
                      setTtsKey('');
                      setTtsFeedback({
                        text: next.source === 'database'
                          ? 'OpenAI Sprach-Key verschlüsselt gespeichert.'
                          : 'OpenAI Sprach-Key lokal gespeichert.',
                        kind: 'success',
                      });
                    } catch (err: unknown) {
                      setTtsFeedback({
                        text: err instanceof Error ? err.message : 'Key konnte nicht gespeichert werden.',
                        kind: 'error',
                      });
                    } finally {
                      setIsSavingTts(false);
                    }
                  }}
                  style={{
                    height: '44px', padding: '0 1rem', borderRadius: '999px', border: 'none',
                    cursor: (ttsKey.trim() || ttsStatus?.configured) && !isSavingTts ? 'pointer' : 'default',
                    opacity: (ttsKey.trim() || ttsStatus?.configured) && !isSavingTts ? 1 : 0.5,
                    fontFamily: 'inherit', background: '#ECE8FF', color: '#3F34C4',
                    fontSize: 'var(--font-sm)', fontWeight: 800, whiteSpace: 'nowrap',
                  }}
                >
                  {isSavingTts ? 'Speichere…' : 'Speichern'}
                </button>
              </div>
            </div>

            {/* Stimme & Englisch-Akzent */}
            <div>
              <label style={fieldLabel}>Standard-Stimme</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                {OPENAI_VOICES.map(v => {
                  const active = ttsVoice === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setTtsVoiceState(v.id);
                        if (ttsStatus?.configured) {
                          saveTtsConfigSecurely({ voice: v.id, accent: ttsAccent }).then(setTtsStatus).catch(() => {});
                        }
                      }}
                      style={{
                        padding: '0.5rem 0.4rem', borderRadius: '12px', cursor: 'pointer', fontFamily: 'inherit',
                        border: active ? '1.5px solid #5A4BE0' : '1px solid var(--color-border)',
                        background: active ? 'rgba(90, 75, 224, 0.1)' : 'var(--color-surface-hover)',
                        color: active ? PRIMARY : 'var(--color-text)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px',
                      }}
                    >
                      <span style={{ fontSize: '12.5px', fontWeight: 800 }}>{v.label}</span>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-muted)' }}>{v.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', padding: '3px', borderRadius: '999px', background: 'var(--color-surface-muted)', flex: '1 1 200px' }}>
                {([
                  { id: 'en-GB', label: 'Britisch (UK)' },
                  { id: 'en-US', label: 'Amerikanisch (US)' },
                ] as const).map(opt => {
                  const active = ttsAccent === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setTtsAccentState(opt.id);
                        if (ttsStatus?.configured) {
                          saveTtsConfigSecurely({ voice: ttsVoice, accent: opt.id }).then(setTtsStatus).catch(() => {});
                        }
                      }}
                      style={{
                        height: '32px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: '11.5px', fontWeight: active ? 800 : 600,
                        background: active ? 'var(--color-surface)' : 'transparent',
                        color: active ? PRIMARY : 'var(--color-text-muted)',
                        boxShadow: active ? '0 2px 6px rgba(23,20,58,0.08)' : 'none',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={!ttsStatus?.configured}
                onClick={() => {
                  setTtsFeedback(null);
                  speakText('Good morning! Let us practise vocabulary together.', 'Englisch', () => {
                    setTtsFeedback({ text: getLastTtsError() || 'Probehören fehlgeschlagen.', kind: 'error' });
                  }, { voice: ttsVoice, accent: ttsAccent });
                }}
                style={{
                  height: '38px', padding: '0 0.9rem', borderRadius: '999px', border: 'none',
                  background: '#ECE8FF', color: PRIMARY, fontSize: '12px', fontWeight: 800,
                  fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  cursor: ttsStatus?.configured ? 'pointer' : 'default', opacity: ttsStatus?.configured ? 1 : 0.45,
                }}
              >
                <Volume2 size={14} /> Probehören
              </button>
            </div>

            <p style={noteStyle}>
              Jedes vorgelesene Wort wird dauerhaft im Browser gecached (nur 1× erzeugt → Kosten unter 2 Cent pro Schuljahr). Kinder können die Studio-Stimme beim Lernen hören, haben aber keinen Zugriff auf den API-Key.
            </p>
            {ttsFeedback && message(ttsFeedback.text, ttsFeedback.kind)}
          </div>
        </Section>
      )}

      {/* Vokabel-Gamification & Diamanten-Umtausch (nur für Erwachsene) */}
      {!user?.isChild && (
        <Section icon={Gift} color={ORANGE} title="Vokabel-Diamanten & Schatztruhe" subtitle="Umtauschquote, Ziele & Anfragen">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            {/* Offene Kinder-Anfragen direkt hier freigeben */}
            {vocabGamState.exchangeRequests.filter(r => r.status === 'PENDING').length > 0 && (
              <div
                style={{
                  padding: '0.8rem 0.9rem',
                  borderRadius: '14px',
                  background: '#FEF3C7',
                  border: '1px solid rgba(245, 158, 11, 0.45)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.55rem',
                }}
              >
                <div style={{ fontSize: '12.5px', fontWeight: 900, color: '#B45309' }}>
                  💎 Offene Diamanten-Anfragen ({vocabGamState.exchangeRequests.filter(r => r.status === 'PENDING').length})
                </div>
                {vocabGamState.exchangeRequests
                  .filter(r => r.status === 'PENDING')
                  .map(req => (
                    <div
                      key={req.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                        padding: '0.55rem 0.7rem',
                        borderRadius: '10px',
                        background: 'var(--color-surface)',
                      }}
                    >
                      <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text)' }}>
                        <strong>{req.userName}</strong>: {req.diamonds} 💎 → {req.rewardLabel}
                        {req.note ? ` („${req.note}“)` : ''}
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button
                          type="button"
                          onClick={() => mockDb.resolveVocabDiamondExchange(req.id, 'APPROVED', user?.id || 'Eltern')}
                          style={{
                            height: '30px', padding: '0 0.7rem', borderRadius: '999px', border: 'none',
                            background: '#10B981', color: '#FFFFFF', fontSize: '11.5px', fontWeight: 800,
                            fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                          }}
                        >
                          <Check size={13} /> Einlösen
                        </button>
                        <button
                          type="button"
                          onClick={() => mockDb.resolveVocabDiamondExchange(req.id, 'REJECTED', user?.id || 'Eltern')}
                          style={{
                            height: '30px', padding: '0 0.65rem', borderRadius: '999px', border: 'none',
                            background: '#FDE8EF', color: PINK_TEXT, fontSize: '11.5px', fontWeight: 800,
                            fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                          }}
                        >
                          <X size={13} /> Ablehnen
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Umtauschquote */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '0.6rem' }}>
              <div>
                <label style={fieldLabel}>Diamanten pro Tausch</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  className="input-field"
                  value={gamDraft.exchangeDiamonds}
                  onChange={e => setGamDraft(prev => ({ ...prev, exchangeDiamonds: Math.max(1, Number(e.target.value) || 20) }))}
                  style={{ height: '42px', fontSize: 'var(--font-sm)', fontWeight: 800 }}
                />
              </div>
              <div>
                <label style={fieldLabel}>Gegenwert (z. B. Euro / Zeit)</label>
                <input
                  type="text"
                  maxLength={40}
                  className="input-field"
                  value={gamDraft.exchangeLabel}
                  onChange={e => setGamDraft(prev => ({ ...prev, exchangeLabel: e.target.value }))}
                  placeholder="z. B. 2,00 €"
                  style={{ height: '42px', fontSize: 'var(--font-sm)', fontWeight: 700 }}
                />
              </div>
            </div>

            {/* Truhen-Größe, Tagesziel & Wochenziel */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.55rem' }}>
              <div>
                <label style={fieldLabel}>Truhe (Wörter)</label>
                <input
                  type="number"
                  min={5}
                  max={200}
                  className="input-field"
                  value={gamDraft.chestSize}
                  onChange={e => setGamDraft(prev => ({ ...prev, chestSize: Math.max(5, Number(e.target.value) || 50) }))}
                  style={{ height: '40px', fontSize: 'var(--font-sm)', fontWeight: 800 }}
                />
              </div>
              <div>
                <label style={fieldLabel}>Tagesziel</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="input-field"
                  value={gamDraft.dailyGoal}
                  onChange={e => setGamDraft(prev => ({ ...prev, dailyGoal: Math.max(1, Number(e.target.value) || 30) }))}
                  style={{ height: '40px', fontSize: 'var(--font-sm)', fontWeight: 800 }}
                />
              </div>
              <div>
                <label style={fieldLabel}>Woche (Tage)</label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  className="input-field"
                  value={gamDraft.weeklyGoalDays}
                  onChange={e => setGamDraft(prev => ({ ...prev, weeklyGoalDays: Math.min(7, Math.max(1, Number(e.target.value) || 7)) }))}
                  style={{ height: '40px', fontSize: 'var(--font-sm)', fontWeight: 800 }}
                />
              </div>
            </div>

            {/* Wunsch-Tausch-Shop */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={fieldLabel}>Wunsch-Tausch-Shop (Karten für Kinder)</label>
              {gamDraft.shopItems.map(item => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '12px',
                    background: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <span style={{ fontSize: '18px' }}>{item.emoji}</span>
                  <span style={{ flex: 1, fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--color-text)' }}>
                    {item.title}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 900, color: '#0369A1' }}>{item.diamonds} 💎</span>
                  <button
                    type="button"
                    onClick={() =>
                      setGamDraft(prev => ({
                        ...prev,
                        shopItems: prev.shopItems.filter(s => s.id !== item.id),
                      }))
                    }
                    aria-label={`${item.title} entfernen`}
                    style={{
                      width: '28px', height: '28px', borderRadius: '8px', border: 'none',
                      background: '#FDE8EF', color: PINK_TEXT, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}

              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  maxLength={4}
                  value={newShopEmoji}
                  onChange={e => setNewShopEmoji(e.target.value)}
                  className="input-field"
                  aria-label="Emoji"
                  style={{ width: '52px', height: '38px', textAlign: 'center', fontSize: '16px', padding: '0 0.25rem' }}
                />
                <input
                  type="text"
                  maxLength={45}
                  value={newShopTitle}
                  onChange={e => setNewShopTitle(e.target.value)}
                  placeholder="Neue Belohnung (z. B. 30 Min. Switch)"
                  className="input-field"
                  style={{ flex: '1 1 160px', height: '38px', fontSize: '13px' }}
                />
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={newShopDiamonds}
                  onChange={e => setNewShopDiamonds(e.target.value)}
                  className="input-field"
                  aria-label="Diamanten"
                  style={{ width: '74px', height: '38px', fontSize: '13px', fontWeight: 800 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newShopTitle.trim()) return;
                    const reward: VocabShopReward = {
                      id: `shop_${Date.now().toString(36)}`,
                      emoji: newShopEmoji.trim() || '🎁',
                      title: newShopTitle.trim(),
                      diamonds: Math.max(1, Math.min(500, Number(newShopDiamonds) || 20)),
                    };
                    setGamDraft(prev => ({ ...prev, shopItems: [...prev.shopItems, reward] }));
                    setNewShopTitle('');
                  }}
                  style={{
                    height: '38px', padding: '0 0.85rem', borderRadius: '999px', border: 'none',
                    background: '#ECE8FF', color: PRIMARY, fontSize: '12px', fontWeight: 800,
                    fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                  }}
                >
                  <Plus size={14} /> Hinzufügen
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                mockDb.saveVocabGamificationSettings(gamDraft);
                setGamFeedback(`Gespeichert: ${gamDraft.exchangeDiamonds} 💎 = ${gamDraft.exchangeLabel} · Truhe alle ${gamDraft.chestSize} Wörter.`);
                window.setTimeout(() => setGamFeedback(''), 4000);
              }}
              style={primaryBtn}
            >
              <Check size={17} /> Gamification-Einstellungen speichern
            </button>

            {gamFeedback && message(gamFeedback, 'success')}
          </div>
        </Section>
      )}

      {/* Backup */}
      {isAdmin && (
        <Section icon={Database} color={LILAC} title="System & Backup" subtitle="Google Drive">
          {!driveConnected ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div>
                <label style={fieldLabel}>Google OAuth 2.0 Client ID</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="input-field"
                    value={googleClientId}
                    onChange={e => setGoogleClientIdLocal(e.target.value)}
                    placeholder="123456789-xxx.apps.googleusercontent.com"
                    style={{ flex: 1, minWidth: 0, padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}
                  />
                  <button onClick={handleSaveClientId} style={{ height: '44px', padding: '0 1rem', borderRadius: '999px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: '#ECE8FF', color: '#3F34C4', fontSize: 'var(--font-sm)', fontWeight: 800, whiteSpace: 'nowrap' }}>
                    Speichern
                  </button>
                </div>
                <p style={noteStyle}>Erstelle eine OAuth 2.0 Client ID in der Google Cloud Console (Webanwendung). Authorized origins: http://localhost:5173</p>
              </div>
              <button
                onClick={handleConnectDrive}
                disabled={!googleClientId.trim() || isConnectingDrive}
                style={{ ...primaryBtn, opacity: !googleClientId.trim() ? 0.5 : 1 }}
              >
                <Cloud size={18} /> {isConnectingDrive ? 'Verbinde...' : 'Mit Google Drive verbinden'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.7rem 0.85rem', borderRadius: 'var(--radius-lg)', background: '#E3F6EF' }}>
                <HardDrive size={18} color={GREEN_TEXT} />
                <span style={{ flex: 1, fontSize: 'var(--font-sm)', fontWeight: 800, color: GREEN_TEXT }}>Google Drive verbunden</span>
                <button onClick={handleDisconnectDrive} style={{ border: 'none', background: 'none', cursor: 'pointer', color: PINK_TEXT, display: 'flex', alignItems: 'center', gap: '0.25rem', fontFamily: 'inherit', fontSize: 'var(--font-xs)', fontWeight: 800 }}>
                  <CloudOff size={14} /> Trennen
                </button>
              </div>

              {lastBackup && (
                <p style={{ margin: 0, fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  Letztes Backup: {new Date(lastBackup.timestamp).toLocaleString('de-DE')}
                  {isBackupDue() && <span style={{ color: '#3F34C4', fontWeight: 800, marginLeft: '0.4rem' }}>– Neues Backup fällig</span>}
                </p>
              )}

              <button onClick={handleManualBackup} disabled={isRunningBackup} style={{ ...primaryBtn, opacity: isRunningBackup ? 0.7 : 1 }}>
                <RotateCw size={18} style={isRunningBackup ? { animation: 'spin 1s linear infinite' } : {}} />
                {isRunningBackup ? 'Läuft...' : 'Jetzt Backup durchführen'}
              </button>
            </div>
          )}

          {driveError && message(driveError, 'error')}
          {driveSuccess && message(driveSuccess, 'success')}

          <div style={{ marginTop: '1.25rem', paddingTop: '1.1rem', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 'var(--font-sm)', fontWeight: 800 }}>Backup wiederherstellen</div>
            <p style={{ ...noteStyle, marginTop: '0.2rem', marginBottom: '0.75rem' }}>Wähle eines der letzten 5 Backups aus Google Drive zum Wiederherstellen aus.</p>
            <button onClick={handleOpenRestore} disabled={!driveConnected} style={{ ...softBtn, opacity: driveConnected ? 1 : 0.5 }}>
              <Database size={17} /> {driveConnected ? 'Aus Google Drive wiederherstellen' : 'Nicht mit Drive verbunden'}
            </button>
          </div>
        </Section>
      )}

      <button
        onClick={logout}
        style={{
          width: '100%', height: '50px', borderRadius: '999px', border: `1.5px solid ${PINK}`, cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          background: 'var(--color-surface)', color: PINK_TEXT, fontSize: 'var(--font-base)', fontWeight: 800,
        }}
      >
        <LogOut size={19} /> Abmelden ({user?.id})
      </button>

      {/* Sheet: Nutzer anlegen */}
      {showCreate && sheetShell(() => setShowCreate(false), (
        <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {sheetHeader('Neuen Nutzer anlegen', () => setShowCreate(false))}
          <div>
            <label style={fieldLabel}>Anzeigename</label>
            <input type="text" value={newUserId} onChange={e => setNewUserId(e.target.value)} className="input-field" style={{ width: '100%' }} placeholder="z. B. Anna" required />
          </div>
          <div>
            <label style={fieldLabel}>E-Mail-Adresse</label>
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="input-field" style={{ width: '100%' }} placeholder="anna@example.com" required />
          </div>
          <div>
            <label style={fieldLabel}>Initiales Passwort</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="input-field" style={{ width: '100%' }} placeholder="min. 6 Zeichen" required />
          </div>
          <Toggle checked={newUserIsChild} onChange={setNewUserIsChild} label="Als Kinderaccount anlegen" hint="Kinder sehen nur ausgewählte Bereiche" />
          {createError && message(createError, 'error')}
          <button type="submit" disabled={isCreating} style={{ ...primaryBtn, opacity: isCreating ? 0.7 : 1 }}>
            {isCreating ? 'Wird erstellt...' : <><Plus size={18} /> Nutzer erstellen</>}
          </button>
        </form>
      ))}

      {/* Sheet: Restore */}
      {showRestoreDialog && sheetShell(() => setShowRestoreDialog(false), (
        <>
          {sheetHeader('Backup auswählen', () => setShowRestoreDialog(false))}
          {isLoadingBackups ? (
            <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '1.5rem 0', margin: 0, fontWeight: 700 }}>
              <RotateCw size={20} style={{ animation: 'spin 1s linear infinite', verticalAlign: '-4px' }} /> Backups werden geladen...
            </p>
          ) : restoreError ? (
            message(restoreError, 'error')
          ) : driveBackups.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '1.5rem 0', margin: 0 }}>Keine Backups in Google Drive gefunden.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {driveBackups.map(backup => (
                <button
                  key={backup.id}
                  onClick={() => handleRestoreBackup(backup.id, backup.name)}
                  disabled={isRestoring}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.8rem 0.9rem', width: '100%', textAlign: 'left',
                    borderRadius: 'var(--radius-lg)', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    background: 'var(--color-surface-hover)', color: 'var(--color-text)', opacity: isRestoring ? 0.5 : 1,
                  }}
                >
                  <span style={iconChip(LILAC, 36)}><Database size={17} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 'var(--font-sm)', fontWeight: 700, overflowWrap: 'anywhere' }}>{backup.name}</span>
                    <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{new Date(backup.createdTime).toLocaleString('de-DE')}</span>
                  </span>
                  {isRestoring && <RotateCw size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                </button>
              ))}
            </div>
          )}
        </>
      ))}

      <ProfileSheet isOpen={showProfileSheet} onClose={() => setShowProfileSheet(false)} />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes setupFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes setupSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
};
