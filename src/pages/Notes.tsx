import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { mockDb } from '../services/mockDb';
import type { NoteItem, User } from '../services/mockDb';
import { Plus, Trash2, X, Save } from 'lucide-react';
import { AvatarEmoji } from '../components/AvatarEmoji';
import { RichTextEditor } from '../components/RichTextEditor';
import { getNeonColor, getNeonCardStyle } from '../utils/neon';

const LONG_PRESS_MS = 500;

export const Notes = () => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState<'SHARED' | 'PRIVATE'>('SHARED');
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');

  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const load = () => {
      setNotes(mockDb.getNotes());
      setUsers(mockDb.getUsers().map(u => ({ ...u, avatarColor: settings.designMode === 'neon' ? (u.avatarColorNeon || getNeonColor(u.id).color) : u.avatarColor })));
    };
    load();
    window.addEventListener('db_updated', load);
    return () => window.removeEventListener('db_updated', load);
  }, [settings.designMode]);

  useEffect(() => {
    if (user?.isChild) {
      setActiveTab('PRIVATE');
    }
  }, [user]);

  const displayedNotes = notes.filter(n => {
    if (activeTab === 'SHARED') return n.isShared;
    return !n.isShared && n.createdBy === user?.id;
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content || !user) return;

    setIsSyncing(true);
    mockDb.addNote({
      title: title.trim() || undefined,
      content,
      isShared: user.isChild ? false : activeTab === 'SHARED',
      createdBy: user.id,
    });

    setContent('');
    setTitle('');
    setIsAdding(false);
    setTimeout(() => setIsSyncing(false), 1500);
  };

  const handleDelete = (id: string) => {
    if (confirm('Notiz wirklich löschen?')) {
      mockDb.deleteNote(id);
      setEditingNote(null);
    }
  };

  const handleCancelEdit = () => setEditingNote(null);

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote || !editingNote.content.trim()) return;
    mockDb.updateNote(editingNote);
    setEditingNote(null);
  };

  // Long-press → edit
  const startPress = (note: NoteItem) => {
    pressTimer.current = setTimeout(() => {
      setEditingNote({ ...note });
    }, LONG_PRESS_MS);
  };

  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>

      {/* Tab-Umschalter */}
      {!user?.isChild && (
        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--color-surface)', padding: '0.5rem', borderRadius: 'var(--radius-lg)' }}>
          <button
            className={`btn ${activeTab === 'SHARED' ? 'btn-primary' : ''}`}
            style={{ flex: 1, backgroundColor: activeTab !== 'SHARED' ? 'transparent' : undefined, color: activeTab !== 'SHARED' ? 'var(--color-text)' : undefined }}
            onClick={() => setActiveTab('SHARED')}
          >
            Gemeinsam
          </button>
          <button
            className={`btn ${activeTab === 'PRIVATE' ? 'btn-primary' : ''}`}
            style={{ flex: 1, backgroundColor: activeTab !== 'PRIVATE' ? 'transparent' : undefined, color: activeTab !== 'PRIVATE' ? 'var(--color-text)' : undefined }}
            onClick={() => setActiveTab('PRIVATE')}
          >
            Privat
          </button>
        </div>
      )}

      {/* Add form or button */}
      {isAdding ? (
        <form onSubmit={handleAdd} className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
            Neue Notiz {!user?.isChild && `(${activeTab === 'SHARED' ? 'Gemeinsam' : 'Privat'})`}
          </h3>
          <input
            type="text"
            placeholder="Überschrift (optional)"
            className="input-field"
            style={{ fontSize: 'var(--font-sm)' }}
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <RichTextEditor
            placeholder="Schreibe eine Notiz..."
            value={content}
            onChange={setContent}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={() => setIsAdding(false)} className="btn btn-secondary" style={{ flex: 1 }}>Abbrechen</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={!content.trim()}>Speichern</button>
          </div>
        </form>
      ) : (
        <button onClick={() => setIsAdding(true)} className="btn btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <Plus size={20} /> {isSyncing ? 'Wird synchronisiert...' : 'Notiz hinzufügen'}
        </button>
      )}

      {/* Notizen-Liste */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', flex: 1, overflowY: 'auto' }}>
        {displayedNotes.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: '2rem' }}>Keine Notizen vorhanden.</p>
        ) : (
          displayedNotes.map(note => {
            const author = users.find(u => u.id === note.createdBy);

            // Edit mode (long press)
            if (editingNote?.id === note.id) {
              return (
                <form
                  key={note.id}
                  onSubmit={handleSaveEdit}
                  className="glass-panel"
                  style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '2px solid var(--color-primary)' }}
                >
                  <input
                    type="text"
                    placeholder="Überschrift (optional)"
                    className="input-field"
                    value={editingNote.title || ''}
                    onChange={e => setEditingNote({ ...editingNote, title: e.target.value || undefined })}
                  />
                  <RichTextEditor
                    placeholder="Notiz bearbeiten..."
                    value={editingNote.content}
                    initialValue={editingNote.content}
                    onChange={val => setEditingNote({ ...editingNote, content: val })}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={handleCancelEdit} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: 'var(--font-sm)' }}>
                      <X size={16} /> Abbrechen
                    </button>
                    <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: 'var(--font-sm)' }}>
                      <Save size={16} /> Speichern
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(note.id)}
                    style={{ color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: 'var(--font-sm)', alignSelf: 'flex-start', fontWeight: 500 }}
                  >
                    <Trash2 size={16} /> Löschen
                  </button>
                </form>
              );
            }

            // Normal view — TaskCard style
            return (() => {
              const isNeon = settings.designMode === 'neon';
              const ncs = isNeon ? getNeonCardStyle(note.id) : null;
              return (
              <div
                key={note.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.75rem 0.85rem',
                  borderRadius: 'var(--radius-lg)',
                  cursor: 'pointer',
                  userSelect: 'none',
                  ...(ncs ? {
                    backgroundImage: ncs.backgroundImage,
                    backgroundOrigin: ncs.backgroundOrigin,
                    backgroundClip: ncs.backgroundClip,
                    border: ncs.border,
                    boxShadow: ncs.boxShadow,
                  } : {
                    background: 'var(--color-surface)',
                    boxShadow: 'var(--shadow-md)',
                    border: '1px solid var(--color-border)',
                  }),
                }}
                onMouseDown={() => startPress(note)}
                onMouseUp={cancelPress}
                onMouseLeave={cancelPress}
                onTouchStart={() => startPress(note)}
                onTouchEnd={cancelPress}
                onTouchMove={cancelPress}
                onContextMenu={e => e.preventDefault()}
              >
                {/* Author avatar */}
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: author?.avatarColor || 'var(--color-primary)',
                  flexShrink: 0,
                  overflow: 'hidden',
                  boxShadow: ncs ? `0 0 10px ${ncs.color1}88, 0 0 22px ${ncs.color2}44` : 'none',
                }}>
                  {author?.avatar ? <AvatarEmoji emoji={author.avatar} size={42} /> : '📝'}
                </span>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {note.title && (
                    <span style={{
                      fontSize: 'var(--font-xs)',
                      fontWeight: 700,
                      color: 'var(--color-text)',
                      lineHeight: 1.3,
                    }}>
                      {note.title}
                    </span>
                  )}
                  <div
                    className="rich-text-content"
                    style={{
                      color: 'var(--color-text-muted)',
                      fontSize: 'var(--font-xs)',
                      lineHeight: 1.4,
                      overflowWrap: 'break-word',
                    }}
                    dangerouslySetInnerHTML={{ __html: note.content }}
                  />
                </div>
              </div>
              );
            })();
          })
        )}
      </div>

    </div>
  );
};
