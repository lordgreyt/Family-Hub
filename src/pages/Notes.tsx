import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';
import type { NoteItem } from '../services/mockDb';
import { Plus, Trash2 } from 'lucide-react';
import { RichTextEditor } from '../components/RichTextEditor';

export const Notes = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'SHARED' | 'PRIVATE'>('SHARED');
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [content, setContent] = useState('');

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
    return !n.isShared && n.createdBy === user?.id; // strict privacy
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content || !user) return;
    
    mockDb.addNote({
      content,
      isShared: user.isChild ? false : activeTab === 'SHARED',
      createdBy: user.id,
    });
    
    setContent('');
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    mockDb.deleteNote(id);
  };

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
      
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
        <button onClick={() => setIsAdding(true)} className="btn btn-primary" style={{ width: '100%' }}>
          <Plus size={20} /> Notiz hinzufügen
        </button>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, overflowY: 'auto' }}>
        {displayedNotes.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: '2rem' }}>Keine Notizen vorhanden.</p>
        ) : (
          displayedNotes.map(note => {
            const author = mockDb.getUsers().find(u => u.id === note.createdBy);
            return (
              <div key={note.id} className="glass-panel" style={{ padding: '1.25rem 1.25rem 0.5rem 1.25rem', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                  <button onClick={() => handleDelete(note.id)} style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
                <div 
                  className="rich-text-content"
                  style={{ color: 'var(--color-text)', overflowWrap: 'break-word', paddingBottom: '0.25rem' }}
                  dangerouslySetInnerHTML={{ __html: note.content }} 
                />
                <div style={{ marginTop: '0.25rem', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                  {activeTab === 'SHARED' && (
                    <>
                      <span style={{ fontSize: '1rem', lineHeight: 1 }}>{author?.avatar}</span>
                      <span style={{ fontWeight: 500 }}>{author?.id || note.createdBy}</span>
                      <span>&bull;</span>
                    </>
                  )}
                  <span>
                    {new Date(note.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
