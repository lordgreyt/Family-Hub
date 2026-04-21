import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';
import type { NoteItem, TaskItem, User, RewardRequest } from '../services/mockDb';
import { Calendar, AlertTriangle, Filter, Star, Check, X, Save, Trash2, Wallet, TrendingDown } from 'lucide-react';
import { RichTextEditor } from '../components/RichTextEditor';

const LONG_PRESS_MS = 500;

export const Dashboard = () => {
  const { user } = useAuth();
  const [recentNotes, setRecentNotes] = useState<NoteItem[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<TaskItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [rewardRequests, setRewardRequests] = useState<RewardRequest[]>([]);
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState<string>('');
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [expenseStats, setExpenseStats] = useState({ total: 0, topCategory: '' });

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loadData = () => {
      // Notes
      const allNotes = mockDb.getNotes().filter(note => note.isShared);
      setRecentNotes(allNotes.slice(0, 3));

      // Tasks
      const fourWeeksFromNow = new Date();
      fourWeeksFromNow.setDate(fourWeeksFromNow.getDate() + 28);
      fourWeeksFromNow.setHours(23, 59, 59, 999);

      const tasks = mockDb.getTasks().filter(t => {
        const hasAccess = t.isShared || t.createdBy === user?.id;
        if (!hasAccess || t.isDone) return false;
        if (!t.dueDate) return true;
        const due = new Date(t.dueDate);
        return due <= fourWeeksFromNow;
      }).sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority;
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });

      setUpcomingTasks(tasks);
      setUsers(mockDb.getUsers());
      setRewardRequests(mockDb.getRewardRequests().filter(r => r.status === 'PENDING'));

      // Expenses
      try {
        const currentMonthStr = new Date().toISOString().slice(0, 7);
        const allExpenses = mockDb.getExpenses() || [];
        const monthlyExpenses = allExpenses.filter(e => e && e.date && e.date.startsWith(currentMonthStr) && e.type === 'EXPENSE');
        const total = monthlyExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        
        const byCat = monthlyExpenses.reduce((acc, e) => {
          if (e.category) {
            acc[e.category] = (acc[e.category] || 0) + (Number(e.amount) || 0);
          }
          return acc;
        }, {} as Record<string, number>);
        
        const topEntry = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
        setExpenseStats({ 
          total, 
          topCategory: topEntry ? `${topEntry[0]} (${topEntry[1].toFixed(0)}€)` : 'Keine Ausgaben' 
        });
      } catch (err) {
        console.error("Error loading expense stats:", err);
      }
    };

    loadData();
    window.addEventListener('db_updated', loadData);
    return () => window.removeEventListener('db_updated', loadData);
  }, []);

  const startPress = (note: NoteItem) => {
    pressTimer.current = setTimeout(() => {
      setEditingNote({ ...note });
      setExpandedNotes(prev => { const n = new Set(prev); n.delete(note.id); return n; });
    }, LONG_PRESS_MS);
  };

  const cancelPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote || !editingNote.content.trim()) return;
    mockDb.updateNote(editingNote);
    setEditingNote(null);
  };

  const handleDeleteNote = (id: string) => {
    if (confirm('Notiz wirklich löschen?')) {
      mockDb.deleteNote(id);
      setEditingNote(null);
    }
  };

  return (
    <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Offene Belohnungs-Anfragen Info (nur für Eltern) */}
      {!user?.isChild && rewardRequests.length > 0 && (
        <div className="glass-panel" style={{ padding: '0.75rem 1rem', border: '1px solid #f59e0b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#d97706' }}>
            <Star size={20} fill="#f59e0b" />
            <strong style={{ fontSize: 'var(--font-sm)' }}>
              {rewardRequests.length} offene {rewardRequests.length === 1 ? 'Anfrage' : 'Anfragen'}
            </strong>
          </div>
          <a href="/rewards" style={{ fontSize: 'var(--font-xs)', color: 'var(--color-primary)', fontWeight: 600, padding: '0.25rem 0.5rem', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
            Ansehen
          </a>
        </div>
      )}


      {upcomingTasks.length > 0 && (
        <div>
          {/* Tägliche Ausgaben Summary (nur Eltern) */}
          {user && !user.isChild && (
            <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid var(--color-border-hover)' }}>
              <div style={{ backgroundColor: 'var(--color-primary-light)', padding: '0.75rem', borderRadius: 'var(--radius-md)', color: 'var(--color-primary)' }}>
                <Wallet size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Ausgaben diesen Monat</p>
                <h4 style={{ margin: '0.1rem 0', fontSize: '1.25rem', color: 'var(--color-text)' }}>{expenseStats.total.toFixed(2)}€</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                  <TrendingDown size={12} color="var(--color-danger)" /> Top: {expenseStats.topCategory}
                </div>
              </div>
              <a href="/expenses" className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: 'var(--font-xs)', background: 'var(--color-primary)', color: 'white' }}>Details</a>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: 'var(--font-lg)', color: 'var(--color-primary-dark)' }}>
              Aufgaben (Top 4 Wochen)
            </h3>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
            <button
              onClick={() => setTaskAssigneeFilter('')}
              style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px',
                border: '1px solid var(--color-border)',
                backgroundColor: taskAssigneeFilter === '' ? 'var(--color-primary)' : 'var(--color-surface)',
                color: taskAssigneeFilter === '' ? 'white' : 'var(--color-text)',
                fontSize: 'var(--font-sm)',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              <Filter size={14} /> Alle Profile
            </button>
            {users.map(u => (
              <button
                key={u.id}
                onClick={() => setTaskAssigneeFilter(u.id)}
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '9999px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: taskAssigneeFilter === u.id ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: taskAssigneeFilter === u.id ? 'white' : 'var(--color-text)',
                  fontSize: 'var(--font-sm)',
                  whiteSpace: 'nowrap'
                }}
              >
                {u.avatar} {u.id}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {upcomingTasks.filter(t => !taskAssigneeFilter || t.assignedTo === taskAssigneeFilter).map(task => {
              const overdue = task.dueDate ? new Date(task.dueDate) < new Date(new Date().setHours(0,0,0,0)) : false;
              return (
                <div key={task.id} className="glass-panel" style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ fontWeight: task.priority === 3 ? 600 : 400 }}>{task.content}</div>
                    {task.assignedTo && (
                      <div style={{ fontSize: '0.9rem', opacity: 0.8, color: 'var(--color-text-muted)' }} title={`Zugewiesen an ${task.assignedTo}`}>
                        ({task.assignedTo})
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: 'var(--font-xs)' }}>
                    <span style={{ color: task.priority === 3 ? 'var(--color-danger)' : task.priority === 2 ? 'var(--color-primary-light)' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      <AlertTriangle size={12} /> {task.priority}
                    </span>
                    {task.dueDate ? (
                      <span style={{ color: overdue ? 'var(--color-danger)' : 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        <Calendar size={12} /> {new Date(task.dueDate).toLocaleDateString('de-DE')}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        <Calendar size={12} /> Zeitlich flexibel
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {upcomingTasks.filter(t => !taskAssigneeFilter || t.assignedTo === taskAssigneeFilter).length === 0 && (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)', fontStyle: 'italic' }}>
                Keine Aufgaben für diese Zuordnung gefunden.
              </p>
            )}
          </div>
        </div>
      )}

      <div>
        <h3 style={{ marginBottom: '1rem', fontSize: 'var(--font-lg)', color: 'var(--color-primary-dark)' }}>
          Letzte gemeinsame Notizen
        </h3>
        {recentNotes.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>Noch keine Notizen.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {recentNotes.map(note => {
              const author = mockDb.getUsers().find(u => u.id === note.createdBy);
              const isExpanded = expandedNotes.has(note.id);

              // Edit mode
              if (editingNote?.id === note.id) {
                return (
                  <form
                    key={note.id}
                    onSubmit={handleSaveEdit}
                    className="glass-panel"
                    style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '2px solid var(--color-primary)' }}
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
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 500 }}>{author?.id || note.createdBy}</span>
                      <span>&bull;</span>
                      <span>{new Date(note.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => setEditingNote(null)} className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                        <X size={16} /> Abbrechen
                      </button>
                      <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>
                        <Save size={16} /> Speichern
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteNote(note.id)}
                      style={{ color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: 'var(--font-sm)', alignSelf: 'flex-start' }}
                    >
                      <Trash2 size={16} /> Löschen
                    </button>
                  </form>
                );
              }

              // Normal view — no footer, long-press to edit, tap to expand
              return (
                <div
                  key={note.id}
                  className="glass-panel"
                  style={{ padding: '1rem 1rem 0.75rem 1rem', userSelect: 'none', cursor: 'default' }}
                  onMouseDown={() => startPress(note)}
                  onMouseUp={e => {
                    cancelPress();
                    // simple click = toggle expand
                    setExpandedNotes(prev => {
                      const next = new Set(prev);
                      if (next.has(note.id)) { next.delete(note.id); } else { next.add(note.id); }
                      return next;
                    });
                  }}
                  onMouseLeave={cancelPress}
                  onTouchStart={() => startPress(note)}
                  onTouchEnd={e => {
                    cancelPress();
                  }}
                  onTouchMove={cancelPress}
                  onContextMenu={e => e.preventDefault()}
                >
                  {note.title && (
                    <div style={{ fontWeight: 700, fontSize: 'var(--font-base)', color: 'var(--color-text)', marginBottom: '0.25rem' }}>
                      {note.title}
                    </div>
                  )}
                  <div
                    className="rich-text-content"
                    style={{
                      color: 'var(--color-text-muted)',
                      fontSize: 'var(--font-sm)',
                      ...(isExpanded ? {} : { overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const })
                    }}
                    dangerouslySetInnerHTML={{ __html: note.content }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
