import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { mockDb } from '../../services/mockDb';
import { useVictron } from '../../context/VictronContext';
import { auth } from '../../services/firebase';
import { X, Camera, Check, Menu, Zap } from 'lucide-react';

const AVATAR_CATEGORIES: { label: string; icon: string; emojis: string[] }[] = [
  { label: 'Menschen', icon: '👤', emojis: ['👨', '👩', '👦', '👧', '👴', '👵', '🧑', '👶', '👱', '👲', '👳', '🧔', '👷', '💂', '🕵️', '👩‍🚀', '👩‍🍳', '👩‍🏫', '👩‍🎨', '🧑‍💻'] },
  { label: 'Tiere', icon: '🐾', emojis: ['🐱', '🐶', '🦊', '🐻', '🐼', '🦁', '🐯', '🐰', '🐵', '🐸', '🐨', '🐮', '🐷', '🐙', '🦋', '🐢', '🦜', '🐳', '🦖', '🐉'] },
  { label: 'Fantasy', icon: '✨', emojis: ['🤖', '👻', '👽', '🦄', '🧙‍♂️', '🧚', '🧛', '🧜‍♀️', '🧝', '🧞', '🧟', '🐲', '🦹', '🦸', '👾', '🤡', '💀', '🎃'] },
  { label: 'Aktiv', icon: '🎯', emojis: ['⚽', '🎮', '🎸', '🎨', '🚀', '🚲', '🏄', '🎭', '🔧', '🎵', '📚', '🌍', '💡', '🎪', '🏆', '🎲', '🧩', '🪁'] },
  { label: 'Natur', icon: '🌿', emojis: ['🌻', '🌈', '⭐', '🌙', '☀️', '🌊', '🔥', '🍀', '🌵', '🌸', '🍕', '🎂', '⚡', '💎', '🌹', '🍄', '🌴', '❄️'] },
];

const AVATAR_COLORS = [
  '#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#06b6d4',
  '#8b5cf6', '#ef4444', '#22c55e', '#3b82f6', '#f97316',
  '#a855f7', '#84cc16',
];

export const TopBar = ({ onMenuClick }: { onMenuClick: () => void }) => {
  const { user, updateUser } = useAuth();
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

    const entries = mockDb.getMoodEntries(user.id);
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      if (entries.find(e => e.date === ds)) streak++;
      else break;
    }

    return { tasksThisWeek, tasksTotal, stars, streak };
  }, [user]);

  if (!user) return null;

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
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem',
        backgroundColor: 'var(--color-primary)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={onMenuClick}
            style={{
              padding: '0.25rem',
              color: 'white',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex'
            }}
          >
            <Menu size={24} />
          </button>
          <h1 style={{ fontSize: 'var(--font-xl)', margin: 0, color: 'white' }}>
            Family Hub
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {user && !user.isChild && (
            <Zap
              size={18}
              color="white"
              fill={victron.state === 2 ? 'white' : 'none'}
              style={{
                transition: 'all 0.3s ease',
                opacity: victron.isConnected ? 1 : 0.4
              }}
            />
          )}
          <button
            onClick={() => setShowProfile(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'rgba(255,255,255,0.18)',
              padding: '0.25rem 0.75rem',
              borderRadius: 'var(--radius-xl)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              color: 'white',
            }}
          >
            <span style={{
              width: '28px', height: '28px', borderRadius: '50%',
              backgroundColor: user.avatarColor || AVATAR_COLORS[0],
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem',
            }}>
              {user.avatar}
            </span>
            <span style={{ fontWeight: 500 }}>{user.id}</span>
          </button>
        </div>
      </header>

      {/* Profile Edit Modal */}
      {showProfile && (
        <div 
          onClick={() => setShowProfile(false)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              width: '100%',
              maxWidth: '400px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              animation: 'slideUp 0.3s ease',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexShrink: 0 }}>
              <h2 style={{ fontSize: 'var(--font-xl)', color: 'var(--color-text)', margin: 0 }}>Mein Profil</h2>
              <button
                onClick={() => setShowProfile(false)}
                style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '0.25rem' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingRight: '0.25rem' }}>

            {/* Avatar Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: editAvatarColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.5rem',
                position: 'relative',
                border: `3px solid ${editAvatarColor}`,
                marginBottom: '0.5rem',
                transition: 'background-color 0.2s, border-color 0.2s',
              }}>
                {editAvatar}
                <div style={{
                  position: 'absolute',
                  bottom: '-2px',
                  right: '-2px',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Camera size={12} color="white" />
                </div>
              </div>
            </div>

            {/* Avatar Selection */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                Profilbild wählen
              </label>

              {/* Category Tabs */}
              <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.75rem', overflowX: 'auto' }}>
                {AVATAR_CATEGORIES.map((cat, i) => (
                  <button
                    key={cat.label}
                    onClick={() => setAvatarCategory(i)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      padding: '0.35rem 0.6rem',
                      borderRadius: 'var(--radius-full)',
                      border: 'none',
                      backgroundColor: avatarCategory === i ? 'var(--color-primary)' : 'var(--color-surface-hover)',
                      color: avatarCategory === i ? 'white' : 'var(--color-text-muted)',
                      fontSize: '0.7rem',
                      fontWeight: avatarCategory === i ? 600 : 400,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: '0.85rem' }}>{cat.icon}</span>
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Emoji Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '0.4rem',
                maxHeight: '180px',
                overflowY: 'auto',
                paddingRight: '0.25rem',
              }}>
                {AVATAR_CATEGORIES[avatarCategory].emojis.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => setEditAvatar(emoji)}
                    style={{
                      fontSize: '1.5rem',
                      padding: '0.4rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: editAvatar === emoji ? 'var(--color-primary-light)' : 'var(--color-surface-hover)',
                      border: editAvatar === emoji ? '2px solid var(--color-primary)' : '2px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      aspectRatio: '1',
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Avatar Color Picker */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                Avatar-Farbe
              </label>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {AVATAR_COLORS.map(clr => (
                  <button
                    key={clr}
                    onClick={() => setEditAvatarColor(clr)}
                    style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      backgroundColor: clr,
                      border: editAvatarColor === clr ? '3px solid var(--color-text)' : '3px solid transparent',
                      cursor: 'pointer', transition: 'transform 0.1s',
                      transform: editAvatarColor === clr ? 'scale(1.15)' : 'scale(1)',
                      outline: 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Statistics */}
            {stats && (
              <div style={{ marginBottom: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
                <label style={{ display: 'block', fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
                  Statistiken
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div style={{ padding: '0.5rem', backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>{stats.tasksThisWeek}</div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)' }}>Tasks diese Woche</div>
                  </div>
                  <div style={{ padding: '0.5rem', backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>{stats.tasksTotal}</div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)' }}>Tasks insgesamt</div>
                  </div>
                  <div style={{ padding: '0.5rem', backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>⭐ {stats.stars}</div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)' }}>Sterne gesammelt</div>
                  </div>
                  <div style={{ padding: '0.5rem', backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>🔥 {stats.streak}</div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)' }}>Tagebuch-Serie</div>
                  </div>
                </div>
              </div>
            )}

            {/* Account Info */}
            <div style={{ marginBottom: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
              <label style={{ display: 'block', fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                Account
              </label>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text)', padding: '0.5rem', backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-md)', wordBreak: 'break-all' }}>
                {auth.currentUser?.email || 'Nicht mit E-Mail verknüpft'}
              </div>
            </div>

            {/* Name Input */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                Anzeigename
              </label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="input-field"
                placeholder="Dein Name"
              />
            </div>

            {/* Save Message */}
            {saveMessage && (
              <div style={{
                padding: '0.5rem',
                marginBottom: '0.75rem',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-sm)',
                textAlign: 'center',
                color: saveMessage.includes('vergeben') ? 'var(--color-danger)' : 'var(--color-success)',
                backgroundColor: saveMessage.includes('vergeben') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
              }}>
                {saveMessage}
              </div>
            )}

            </div>{/* End Scrollable Content */}

            {/* Save Button — fixed at bottom */}
            <div style={{ flexShrink: 0, paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
            <button
              onClick={handleSaveProfile}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Check size={18} />
              Speichern
            </button>
            </div>
          </div>
        </div>
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
