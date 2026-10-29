import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { getNavItems } from '../../utils/navigation';
import { useAuth } from '../../context/AuthContext';
import { mockDb } from '../../services/mockDb';
import { useVictron } from '../../context/VictronContext';
import { auth } from '../../services/firebase';
import { AvatarEmoji } from '../AvatarEmoji';
import { X, Camera, Check, Menu, Zap, CheckCircle2, Trophy, Star, Mail } from 'lucide-react';
import { AVATAR_CATEGORIES } from '../../data/avatarEmojis';

const AVATAR_COLORS = [
  '#6D5DF0', '#3F34C4', '#F27A9B', '#F5A06B', '#4FC3A1',
  '#4B8DFF', '#C7B6F7', '#FFD9C2', '#ec4899', '#14b8a6',
  '#f59e0b', '#8b5cf6',
];

const chip = (color: string): React.CSSProperties => ({
  width: '36px', height: '36px', borderRadius: '50%', flex: 'none', background: color + '26', color,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
});
const sectionLabel: React.CSSProperties = {
  margin: '0 0 0.5rem', fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)',
};

export const TopBar = ({ onMenuClick }: { onMenuClick: () => void }) => {
  const { user, updateUser } = useAuth();
  const location = useLocation();
  const { state: victron } = useVictron();
  const [showProfile, setShowProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editAvatarColor, setEditAvatarColor] = useState(AVATAR_COLORS[0]);
  const [avatarCategory, setAvatarCategory] = useState(0);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    if (showProfile && user) {
      setEditName(user.id);
      setEditAvatar(user.avatar);
      setEditAvatarColor(user.avatarColor || AVATAR_COLORS[0]);
      setSaveMessage('');
    }
  }, [showProfile, user]);

  // Profile-Statistiken
  const stats = useMemo(() => {
    if (!user) return null;
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);

    const tasks = mockDb.getTasks();
    const tasksThisWeek = tasks.filter(t => t.isDone && t.completedAt && t.completedAt >= weekStart.getTime()).length;
    const tasksTotal = tasks.filter(t => t.isDone).length;

    const leaderboard = mockDb.getLeaderboard();
    const myEntry = leaderboard.find((e: any) => e.userId === user.id);
    const stars = myEntry ? (myEntry.total || myEntry.stars || myEntry.points || 0) : 0;

    return { tasksThisWeek, tasksTotal, stars };
  }, [user]);

  if (!user) return null;

  const pageTitle = getNavItems(user, true, true).find(i => i.to === location.pathname && i.to !== '/')?.label || 'Family Hub';

  const handleSaveProfile = () => {
    if (!editName.trim()) return;

    const currentDbUser = mockDb.getUsers().find(u => u.id === user.id);
    if (!currentDbUser) return;

    const updatedUser = { ...currentDbUser, id: editName.trim(), avatar: editAvatar, avatarColor: editAvatarColor };
    
    // If name changed, we need to delete old and add new (since id is the key)
    if (editName.trim() !== user.id) {
      // Check if name already exists
      const existingUser = mockDb.getUsers().find(u => u.id === editName.trim());
      if (existingUser) {
        setSaveMessage('Dieser Name ist bereits vergeben.');
        return;
      }
      mockDb.deleteUser(user.id);
      mockDb.addUser(updatedUser);
    } else {
      mockDb.updateUser(updatedUser);
    }

    // Update the auth session
    updateUser(updatedUser);
    setSaveMessage('Profil gespeichert!');
    setTimeout(() => {
      setShowProfile(false);
      setSaveMessage('');
    }, 1000);
  };

  return (
    <>
      <header className="app-header">
        <div className="app-header-row">
          <button className="glass-btn" onClick={onMenuClick} aria-label="Menü öffnen">
            <Menu size={22} />
          </button>
          <h1 className="app-header-title">{pageTitle}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 'none' }}>
            {user && !user.isChild && (
              <Zap
                size={18}
                color="white"
                fill={victron.state === 2 ? 'white' : 'none'}
                aria-label="Victron-Status"
                style={{
                  transition: 'all 0.3s ease',
                  opacity: victron.isConnected ? 1 : 0.5
                }}
              />
            )}
            <button
              className="app-avatar-btn"
              onClick={() => setShowProfile(true)}
              aria-label={`Profil von ${user.id} bearbeiten`}
              style={{
                background: user.avatarColor || AVATAR_COLORS[0],
              }}
            >
              <AvatarEmoji emoji={user.avatar} size={40} />
            </button>
          </div>
        </div>
      </header>

      {/* Profil-Sheet */}
      {showProfile && createPortal(
        <div
          onClick={() => setShowProfile(false)}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(23,20,58,0.5)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 2000,
            animation: 'profileFade 0.2s ease',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '500px', maxHeight: '94vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
              borderRadius: '28px 28px 0 0', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)',
              boxShadow: '0 -12px 40px rgba(63,52,196,0.25)', animation: 'profileSheetUp 0.28s ease',
            }}
          >
            {/* Hero */}
            <div style={{ flex: 'none', position: 'relative', padding: '1.5rem 1.25rem 1.25rem', color: 'white', textAlign: 'center', background: 'linear-gradient(160deg, #3A2FC0 0%, #6D5DF0 60%, #9B86F4 100%)' }}>
              <div style={{ position: 'absolute', top: '0.6rem', left: '50%', transform: 'translateX(-50%)', width: '44px', height: '5px', borderRadius: '999px', background: 'rgba(255,255,255,0.45)' }} />
              <button className="glass-btn" onClick={() => setShowProfile(false)} aria-label="Schließen" style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
                <X size={20} />
              </button>
              <div style={{ position: 'relative', width: '92px', height: '92px', margin: '0.6rem auto 0.75rem' }}>
                <div style={{
                  width: '100%', height: '100%', borderRadius: '50%', backgroundColor: editAvatarColor, overflow: 'hidden',
                  border: '3px solid rgba(255,255,255,0.85)', boxShadow: '0 8px 20px rgba(23,20,58,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.2s',
                }}>
                  <AvatarEmoji emoji={editAvatar} size={86} />
                </div>
                <span style={{ position: 'absolute', right: '-2px', bottom: '-2px', width: '28px', height: '28px', borderRadius: '50%', background: 'white', color: '#3F34C4', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(23,20,58,0.25)' }}>
                  <Camera size={14} />
                </span>
              </div>
              <h2 style={{ margin: 0, fontSize: 'var(--font-xl)', fontWeight: 800, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {editName.trim() || 'Mein Profil'}
              </h2>
              <p style={{ margin: '0.15rem 0 0', fontSize: 'var(--font-xs)', fontWeight: 600, opacity: 0.85 }}>Mein Profil</p>
            </div>

            {/* Inhalt */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1rem 1.25rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  {[
                    { icon: CheckCircle2, color: '#4FC3A1', value: stats.tasksThisWeek, label: 'diese Woche' },
                    { icon: Trophy, color: '#6D5DF0', value: stats.tasksTotal, label: 'Tasks gesamt' },
                    { icon: Star, color: '#F5A06B', value: stats.stars, label: 'Sterne' },
                  ].map(tile => (
                    <div key={tile.label} style={{ padding: '0.75rem 0.4rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface-hover)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                      <span style={chip(tile.color)}><tile.icon size={17} /></span>
                      <span style={{ fontSize: 'var(--font-lg)', fontWeight: 800, lineHeight: 1 }}>{tile.value}</span>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textAlign: 'center' }}>{tile.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Name */}
              <div>
                <p style={sectionLabel}>Anzeigename</p>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="input-field"
                  placeholder="Dein Name"
                  style={{ width: '100%' }}
                />
              </div>

              {/* Profilbild */}
              <div>
                <p style={sectionLabel}>Profilbild</p>
                <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.75rem', overflowX: 'auto', paddingBottom: '2px' }}>
                  {AVATAR_CATEGORIES.map((cat, i) => (
                    <button
                      key={cat.label}
                      onClick={() => setAvatarCategory(i)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.8rem', borderRadius: '999px', border: 'none', flex: 'none',
                        background: avatarCategory === i ? 'linear-gradient(135deg, #3F34C4, #6D5DF0)' : 'var(--color-surface-muted)',
                        color: avatarCategory === i ? 'white' : 'var(--color-text-muted)',
                        fontFamily: 'inherit', fontSize: 'var(--font-xs)', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
                      }}
                    >
                      <span style={{ fontSize: '0.9rem' }}>{cat.icon}</span>
                      {cat.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.45rem', maxHeight: '190px', overflowY: 'auto', padding: '2px' }}>
                  {AVATAR_CATEGORIES[avatarCategory].emojis.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => setEditAvatar(emoji)}
                      style={{
                        padding: '0.25rem', borderRadius: '16px', cursor: 'pointer', aspectRatio: '1',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: editAvatar === emoji ? '#ECE8FF' : 'var(--color-surface-hover)',
                        border: editAvatar === emoji ? '2px solid #6D5DF0' : '2px solid transparent',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <AvatarEmoji emoji={emoji} size={36} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Farbe */}
              <div>
                <p style={sectionLabel}>Hintergrundfarbe</p>
                <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
                  {(AVATAR_COLORS.includes(editAvatarColor) ? AVATAR_COLORS : [editAvatarColor, ...AVATAR_COLORS.slice(0, -1)]).map(clr => (
                    <button
                      key={clr}
                      onClick={() => setEditAvatarColor(clr)}
                      aria-label={`Farbe ${clr}`}
                      style={{
                        width: '34px', height: '34px', borderRadius: '50%', backgroundColor: clr, cursor: 'pointer', padding: 0,
                        border: '3px solid var(--color-surface)',
                        boxShadow: editAvatarColor === clr ? `0 0 0 2.5px ${clr}` : '0 0 0 1px var(--color-border)',
                        transform: editAvatarColor === clr ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.12s, box-shadow 0.12s',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Account */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface-hover)' }}>
                <span style={chip('#6D5DF0')}><Mail size={17} /></span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ ...sectionLabel, margin: 0 }}>Account</p>
                  <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, wordBreak: 'break-all' }}>
                    {auth.currentUser?.email || 'Nicht mit E-Mail verknüpft'}
                  </div>
                </div>
              </div>

              {saveMessage && (
                <div style={{
                  padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', fontWeight: 700, textAlign: 'center',
                  color: saveMessage.includes('vergeben') ? '#D4416E' : '#1E9A78',
                  background: saveMessage.includes('vergeben') ? '#FDE8EF' : '#E3F6EF',
                }}>
                  {saveMessage}
                </div>
              )}
            </div>

            {/* Speichern */}
            <div style={{ flex: 'none', padding: '0.75rem 1.25rem calc(1rem + env(safe-area-inset-bottom))', boxShadow: '0 -10px 18px -14px rgba(63,52,196,0.25)' }}>
              <button
                onClick={handleSaveProfile}
                style={{
                  width: '100%', height: '50px', border: 'none', borderRadius: '999px', cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  background: 'linear-gradient(135deg, #3F34C4 0%, #6D5DF0 100%)', color: 'white',
                  fontSize: 'var(--font-base)', fontWeight: 800, boxShadow: '0 8px 20px rgba(63,52,196,0.3)',
                }}
              >
                <Check size={18} /> Speichern
              </button>
            </div>
          </div>
          <style>{`
            @keyframes profileFade { from { opacity: 0; } to { opacity: 1; } }
            @keyframes profileSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          `}</style>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
};
