import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';
import type { NoteItem } from '../services/mockDb';
import { Plus, Trash2, X, Save } from 'lucide-react';
import { RichTextEditor } from '../components/RichTextEditor';

const LONG_PRESS_MS = 500;

export const Notes = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'SHARED' | 'PRIVATE'>('SHARED');
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');

  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);

  // Track long-press timer per note
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const load = () => setNotes(mockDb.getNotes());
    load();
    window.addEventListener('db_updated', load);
    return () => window.removeEventListener('db_updated', load);
  }, []);

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
    setTimeout(() => setIsSyncing(false), 1500); // Visual feedback
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

  // Long-press handlers
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
    <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>

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

      {isAdding ? (
        <form onSubmit={handleAdd} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ color: 'var(--color-primary-dark)' }}>Neue Notiz {!user?.isChild && `(${activeTab === 'SHARED' ? 'Gemeinsam' : 'Privat'})`}</h3>
          <input
            type="text"
            placeholder="Überschrift (optional)"
            className="input-field"
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
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Speichern</button>
          </div>
        </form>
      ) : (
        <button onClick={() => setIsAdding(true)} className="btn btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <Plus size={20} /> {isSyncing ? 'Wird synchronisiert...' : 'Notiz hinzufügen'}
        </button>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, overflowY: 'auto' }}>
        {displayedNotes.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: '2rem' }}>Keine Notizen vorhanden.</p>
        ) : (
          displayedNotes.map(note => {
            const author = mockDb.getUsers().find(u => u.id === note.createdBy);

            // Edit mode (triggered by long press)
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

                  {/* Footer with meta info in edit mode */}
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {activeTab === 'SHARED' && (
                      <>
                        <span style={{ fontWeight: 500 }}>{author?.id || note.createdBy}</span>
                        <span>&bull;</span>
                      </>
                    )}
                    <span>{new Date(note.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={handleCancelEdit} className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                      <X size={16} /> Abbrechen
                    </button>
                    <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>
                      <Save size={16} /> Speichern
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(note.id)}
                    style={{ color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: 'var(--font-sm)', alignSelf: 'flex-start' }}
                  >
                    <Trash2 size={16} /> Löschen
                  </button>
                </form>
              );
            }

            // Normal view — no icons, no footer
            return (
              <div
                key={note.id}
                className="glass-panel"
                style={{ padding: '0.75rem 1.25rem 0.5rem 1.25rem', userSelect: 'none', cursor: 'default' }}
                onMouseDown={() => startPress(note)}
                onMouseUp={cancelPress}
                onMouseLeave={cancelPress}
                onTouchStart={() => startPress(note)}
                onTouchEnd={cancelPress}
                onTouchMove={cancelPress}
                onContextMenu={e => e.preventDefault()}
              >
                {note.title && (
                  <div style={{ fontWeight: 700, fontSize: 'var(--font-lg)', color: 'var(--color-text)', marginBottom: '0.5rem' }}>
                    {note.title}
                  </div>
                )}
                <div
                  className="rich-text-content"
                  style={{ color: 'var(--color-text)', overflowWrap: 'break-word' }}
                  dangerouslySetInnerHTML={{ __html: note.content }}
                />
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
