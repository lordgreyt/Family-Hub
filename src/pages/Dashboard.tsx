import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { mockDb } from '../services/mockDb';
import type { NoteItem, TaskItem, User, RewardRequest } from '../services/mockDb';
import { AvatarEmoji } from '../components/AvatarEmoji';
import { Filter, Star, X, Save, Trash2, Wallet, TrendingDown } from 'lucide-react';
import { RichTextEditor } from '../components/RichTextEditor';
import { TaskCard } from '../components/TaskCard';

const LONG_PRESS_MS = 500;

export const Dashboard = () => {
  const { user } = useAuth();
  const { settings } = useSettings();
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
      const allNotes = mockDb.getNotes().filter(note => note.isShared);
      setRecentNotes(allNotes.slice(0, 3));

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
  }, [user]);

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

  const handleToggleTask = (task: TaskItem) => {
    const points = settings.prioPoints[task.priority] || 0;
    mockDb.toggleTask(task.id, points);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Offene Belohnungs-Anfragen — nur für Eltern */}
      {!user?.isChild && rewardRequests.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #FFF7ED, #FFFBEB)',
          border: '1px solid #FCD34D',
          borderRadius: 'var(--radius-lg)',
          padding: '1rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              backgroundColor: '#FEF3C7',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Star size={20} fill="#F59E0B" color="#F59E0B" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 'var(--font-sm)', fontWeight: 600, color: '#92400E' }}>
                {rewardRequests.length} offene {rewardRequests.length === 1 ? 'Anfrage' : 'Anfragen'}
              </p>
              <p style={{ margin: '0.1rem 0 0 0', fontSize: 'var(--font-xs)', color: '#A16207' }}>
                Belohnungen warten auf Freigabe
              </p>
            </div>
          </div>
          <a
            href="/rewards"
            className="btn btn-primary"
            style={{ padding: '0.5rem 1rem', fontSize: 'var(--font-xs)', textDecoration: 'none' }}
          >
            Prüfen
          </a>
        </div>
      )}

      {/* Ausgaben diesen Monat — nur für Eltern */}
      {user && !user.isChild && (
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              backgroundColor: 'var(--color-primary-transparent)',
              borderRadius: 'var(--radius-md)',
              width: '48px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Wallet size={24} color="var(--color-primary)" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{
                margin: 0,
                fontSize: 'var(--font-xs)',
                color: 'var(--color-text-muted)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>
                Ausgaben diesen Monat
              </p>
              <p style={{
                margin: '0.15rem 0',
                fontSize: 'var(--font-2xl)',
                fontWeight: 700,
                color: 'var(--color-text)',
              }}>
                {expenseStats.total.toFixed(2)}€
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                <TrendingDown size={12} color="var(--color-danger)" />
                Top: {expenseStats.topCategory}
              </div>
            </div>
            <a
              href="/expenses"
              className="btn btn-secondary"
              style={{ padding: '0.5rem 1rem', fontSize: 'var(--font-xs)', textDecoration: 'none' }}
            >
              Details
            </a>
          </div>
        </div>
      )}

      {/* Aufgaben */}
      {upcomingTasks.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 700 }}>
              Aufgaben
            </h3>
            <span style={{
              fontSize: 'var(--font-xs)',
              color: 'var(--color-text-muted)',
              fontWeight: 600,
              background: 'var(--color-surface-muted)',
              padding: '0.2rem 0.6rem',
              borderRadius: 'var(--radius-full)',
            }}>
              nächste 4 Wochen
            </span>
          </div>

          {/* Filter Chips */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
            <button
              onClick={() => setTaskAssigneeFilter('')}
              className={taskAssigneeFilter === '' ? 'chip chip-active' : 'chip'}
            >
              <Filter size={12} />
              Alle
            </button>
            {users.map(u => (
              <button
                key={u.id}
                onClick={() => setTaskAssigneeFilter(u.id)}
                className={taskAssigneeFilter === u.id ? 'chip chip-active' : 'chip'}
              >
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: u.avatarColor || 'var(--color-primary)',
                  overflow: 'hidden',
                }}><AvatarEmoji emoji={u.avatar} size={20} /></span>
                {u.id}
              </button>
            ))}
          </div>

          {/* Task Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {upcomingTasks
              .filter(t =>
                !taskAssigneeFilter ||
                t.assignedTo?.includes(taskAssigneeFilter) ||
                (t.isShared && (!t.assignedTo || t.assignedTo.length === 0))
              )
              .map(task => {
                const assigneeId = task.assignedTo?.[0] || task.createdBy;
                const assignee = users.find(u => u.id === assigneeId);
                return (
                  <TaskCard
                    key={task.id}
                    task={task}
                    assignee={assignee}
                    showToggle
                    canToggle={!user?.isChild}
                    onToggle={handleToggleTask}
                  />
                );
              })}
          </div>
        </div>
      )}

      {/* Letzte Notizen */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 700 }}>
            Letzte Notizen
          </h3>
          {recentNotes.length > 0 && (
            <a
              href="/notes"
              style={{
                fontSize: 'var(--font-xs)',
                color: 'var(--color-primary)',
                fontWeight: 600,
              }}
            >
              Alle ansehen
            </a>
          )}
        </div>

        {recentNotes.length === 0 ? (
          <div className="glass-panel" style={{ padding: '2rem 1.25rem', textAlign: 'center' }}>
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
              Noch keine geteilten Notizen.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {recentNotes.map(note => {
              const author = mockDb.getUsers().find(u => u.id === note.createdBy);
              const isExpanded = expandedNotes.has(note.id);

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
                      style={{ fontSize: 'var(--font-sm)' }}
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
                      <span style={{ fontWeight: 600 }}>{author?.id || note.createdBy}</span>
                      <span>&bull;</span>
                      <span>{new Date(note.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => setEditingNote(null)} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: 'var(--font-sm)' }}>
                        <X size={16} /> Abbrechen
                      </button>
                      <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: 'var(--font-sm)' }}>
                        <Save size={16} /> Speichern
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteNote(note.id)}
                      style={{
                        color: 'var(--color-danger)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: 'var(--font-sm)',
                        alignSelf: 'flex-start',
                        fontWeight: 500,
                      }}
                    >
                      <Trash2 size={16} /> Löschen
                    </button>
                  </form>
                );
              }

              return (
                <div
                  key={note.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#FFFFFF',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-md)',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                  onMouseDown={() => startPress(note)}
                  onMouseUp={e => {
                    cancelPress();
                    setExpandedNotes(prev => {
                      const next = new Set(prev);
                      if (next.has(note.id)) { next.delete(note.id); } else { next.add(note.id); }
                      return next;
                    });
                  }}
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
                    backgroundColor: author?.avatarColor || 'var(--color-primary)',
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}>
                    {author?.avatar ? <AvatarEmoji emoji={author.avatar} size={42} /> : '📝'}
                  </span>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
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
                        ...(isExpanded ? {} : {
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical' as const,
                        })
                      }}
                      dangerouslySetInnerHTML={{ __html: note.content }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
