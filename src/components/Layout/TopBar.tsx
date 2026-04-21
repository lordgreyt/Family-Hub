import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { mockDb } from '../../services/mockDb';
import { X, Camera, Check, Menu } from 'lucide-react';

const EMOJI_OPTIONS = ['👨', '👩', '👦', '👧', '👴', '👵', '🤖', '👻', '👽', '🦄', '🐱', '🐶', '🦊', '🐻', '🐼', '🦁', '🐯', '🐰', '🐵', '🐸'];

export const TopBar = ({ onMenuClick }: { onMenuClick: () => void }) => {
  const { user, login } = useAuth();
  const [showProfile, setShowProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    if (showProfile && user) {
      setEditName(user.id);
      setEditAvatar(user.avatar);
      setSaveMessage('');
    }
  }, [showProfile, user]);

  if (!user) return null;

  const handleSaveProfile = () => {
    if (!editName.trim()) return;
    
    const currentDbUser = mockDb.getUsers().find(u => u.id === user.id);
    if (!currentDbUser) return;

    const updatedUser = { ...currentDbUser, id: editName.trim(), avatar: editAvatar };
    
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
    login(updatedUser);
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
        backgroundColor: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            onClick={onMenuClick}
            style={{
              padding: '0.25rem',
              color: 'var(--color-text)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex'
            }}
          >
            <Menu size={24} />
          </button>
          <h1 style={{ fontSize: 'var(--font-xl)', margin: 0, color: 'var(--color-primary)' }}>
            Family Hub
          </h1>
        </div>
        <button 
          onClick={() => setShowProfile(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: 'var(--color-surface-hover)',
            padding: '0.25rem 0.75rem',
            borderRadius: 'var(--radius-xl)',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <span style={{ fontSize: '1.25rem' }}>{user.avatar}</span>
          <span style={{ fontWeight: 500 }}>{user.id}</span>
        </button>
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
              padding: '2rem',
              width: '100%',
              maxWidth: '400px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              animation: 'slideUp 0.3s ease',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: 'var(--font-xl)', color: 'var(--color-text)', margin: 0 }}>Mein Profil</h2>
              <button 
                onClick={() => setShowProfile(false)} 
                style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '0.25rem' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Avatar Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.5rem',
                position: 'relative',
                border: '3px solid var(--color-primary)',
                marginBottom: '0.5rem',
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
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(5, 1fr)', 
                gap: '0.4rem',
              }}>
                {EMOJI_OPTIONS.map(emoji => (
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
                marginBottom: '1rem', 
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-sm)',
                textAlign: 'center',
                color: saveMessage.includes('vergeben') ? 'var(--color-danger)' : 'var(--color-success)',
                backgroundColor: saveMessage.includes('vergeben') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
              }}>
                {saveMessage}
              </div>
            )}

            {/* Save Button */}
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
