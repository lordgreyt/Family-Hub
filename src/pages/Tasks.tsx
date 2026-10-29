import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { mockDb } from '../services/mockDb';
import type { TaskItem, User } from '../services/mockDb';
import { Plus, X, Check, CheckSquare, Star, Trash2, ClipboardList } from 'lucide-react';
import { AvatarEmoji } from '../components/AvatarEmoji';
import { HERO_GRADIENT, GREEN, PINK_TEXT, PRIMARY, CARD, sectionTitle, fieldLabel, iconChip } from '../components/SurgeryFinance/theme';
import { TaskRow, PRIO_COLOR, todayIso } from '../components/TaskParts';
import type { Priority } from '../components/TaskParts';

interface Draft {
  id?: string;
  content: string;
  dueDate: string;
  priority: Priority;
  assignedTo: string[];
}

const chipWhite = {
  display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem', borderRadius: '999px',
  background: 'rgba(255,255,255,0.2)', color: 'white', fontSize: 'var(--font-xs)', fontWeight: 700, lineHeight: 1.3,
} as const;

export const Tasks = () => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState<'SHARED' | 'PRIVATE'>('SHARED');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [sheet, setSheet] = useState<Draft | null>(null);

  useEffect(() => {
    const load = () => {
      setTasks(mockDb.getTasks());
      setUsers(mockDb.getUsers());
    };
    load();
    window.addEventListener('db_updated', load);
    return () => window.removeEventListener('db_updated', load);
  }, []);

  const isChild = !!user?.isChild;
  const assignableUsers = users.filter(u => isChild ? (u.id === user?.id || u.isChild) : true);

  const inTab = (t: TaskItem, tab: 'SHARED' | 'PRIVATE') =>
    tab === 'SHARED' ? t.isShared : !t.isShared && t.createdBy === user?.id;

  const displayedTasks = tasks
    .filter(t => {
      if (isChild) {
        if (!t.assignedTo || t.assignedTo.length === 0) return true;
        return t.assignedTo.some(id => {
          if (id === user?.id) return true;
          const u = users.find(usr => usr.id === id);
          return u?.isChild;
        });
      }
      return inTab(t, activeTab);
    })
    .sort((a, b) => {
      if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
      if (a.dueDate && b.dueDate) {
        const dA = new Date(a.dueDate).getTime();
        const dB = new Date(b.dueDate).getTime();
        if (dA !== dB) return dA - dB;
      }
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      if (a.priority !== b.priority) return b.priority - a.priority;
      return b.createdAt - a.createdAt;
    });

  const openTasks = displayedTasks.filter(t => !t.isDone);
  const doneTasks = displayedTasks.filter(t => t.isDone);
  const today = todayIso();
  const overdueCount = openTasks.filter(t => t.dueDate && t.dueDate.slice(0, 10) < today).length;
  const todayCount = openTasks.filter(t => t.dueDate && t.dueDate.slice(0, 10) === today).length;
  const openPoints = openTasks.reduce((sum, t) => sum + (settings.prioPoints[t.priority] || 0), 0);
  const progress = displayedTasks.length > 0 ? doneTasks.length / displayedTasks.length : 0;
  const openCountFor = (tab: 'SHARED' | 'PRIVATE') => tasks.filter(t => !t.isDone && inTab(t, tab)).length;

  const openAdd = () => {
    setSheet({ content: '', dueDate: '', priority: 1, assignedTo: isChild && user ? [user.id] : [] });
  };

  const openEdit = (task: TaskItem) => {
    if (isChild) return;
    setSheet({
      id: task.id,
      content: task.content,
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
      priority: task.priority,
      assignedTo: task.assignedTo ? [...task.assignedTo] : [],
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheet || !user || !sheet.content.trim()) return;
    const assigned = isChild && sheet.assignedTo.length === 0 ? [user.id] : sheet.assignedTo;

    if (sheet.id) {
      const original = tasks.find(t => t.id === sheet.id);
      if (original) {
        mockDb.updateTask({
          ...original,
          content: sheet.content.trim(),
          dueDate: sheet.dueDate || undefined,
          priority: sheet.priority,
          assignedTo: assigned.length > 0 ? assigned : undefined,
        });
      }
    } else {
      mockDb.addTask({
        content: sheet.content.trim(),
        dueDate: sheet.dueDate || undefined,
        priority: sheet.priority,
        assignedTo: assigned.length > 0 ? assigned : undefined,
        isShared: activeTab === 'SHARED',
        createdBy: user.id,
      });
    }
    setSheet(null);
  };

  const handleDelete = () => {
    if (!sheet?.id) return;
    const task = tasks.find(t => t.id === sheet.id);
    if (!task) return;
    if (!window.confirm(`„${task.content}“ löschen?`)) return;
    mockDb.deleteTask(task.id);
    setSheet(null);
  };

  const handleToggle = (task: TaskItem) => {
    if (isChild) return;
    mockDb.toggleTask(task.id, settings.prioPoints[task.priority] || 0);
  };

  const renderRow = (task: TaskItem) => (
    <TaskRow
      key={task.id}
      task={task}
      assignees={task.assignedTo?.length ? users.filter(u => task.assignedTo!.includes(u.id)) : []}
      points={settings.prioPoints[task.priority] || 0}
      canToggle={!isChild}
      onToggle={handleToggle}
      onOpen={isChild ? undefined : openEdit}
    />
  );

  const sectionHeader = (icon: React.ReactNode, color: string, title: string, count: number) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.3rem' }}>
      <span style={iconChip(color, 38)}>{icon}</span>
      <h3 style={{ ...sectionTitle, flex: 1 }}>{title}</h3>
      <span style={{ padding: '2px 10px', borderRadius: '999px', background: color + '1F', color, fontSize: 'var(--font-xs)', fontWeight: 800 }}>{count}</span>
    </div>
  );

  const heroTitle = isChild ? 'Meine Aufgaben' : activeTab === 'SHARED' ? 'Gemeinsame Aufgaben' : 'Private Aufgaben';

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
      {/* Hero */}
      <div style={{ background: HERO_GRADIENT, borderRadius: 'var(--radius-xl)', padding: '1.3rem 1.25rem', color: 'white', boxShadow: '0 12px 28px rgba(63,52,196,0.28)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CheckSquare size={19} />
          </span>
          <div>
            <div style={{ fontSize: 'var(--font-base)', fontWeight: 800 }}>Aufgaben</div>
            <div style={{ fontSize: 'var(--font-xs)', opacity: 0.85, fontWeight: 600 }}>{heroTitle}</div>
          </div>
        </div>

        <div style={{ marginTop: '1.1rem', fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', opacity: 0.85 }}>NOCH OFFEN</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.2rem' }}>
          <span style={{ fontSize: '2.6rem', fontWeight: 800, lineHeight: 1.1 }}>{openTasks.length}</span>
          <span style={{ fontSize: 'var(--font-lg)', fontWeight: 700, opacity: 0.8 }}>/ {displayedTasks.length}</span>
        </div>

        <div style={{ marginTop: '0.9rem', height: '8px', borderRadius: '999px', background: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
          <div style={{ width: `${progress * 100}%`, height: '100%', borderRadius: '999px', background: 'white', transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ marginTop: '0.45rem', fontSize: '11px', fontWeight: 600, opacity: 0.85 }}>
          {displayedTasks.length === 0
            ? 'Noch keine Aufgaben angelegt'
            : openTasks.length === 0
              ? 'Alles erledigt – super!'
              : `${Math.round(progress * 100)} % erledigt`}
        </div>

        <div style={{ marginTop: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
          {overdueCount > 0 && <span style={chipWhite}>{overdueCount} überfällig</span>}
          {todayCount > 0 && <span style={chipWhite}>{todayCount} heute fällig</span>}
          <span style={chipWhite}><Check size={13} /> {doneTasks.length} erledigt</span>
          {openPoints > 0 && <span style={chipWhite}><Star size={13} fill="currentColor" /> {openPoints} zu holen</span>}
        </div>
      </div>

      {/* Gemeinsam / Privat */}
      {!isChild && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', padding: '4px', borderRadius: '999px', background: 'var(--color-surface-muted)' }}>
          {([['SHARED', 'Gemeinsam'], ['PRIVATE', 'Privat']] as const).map(([value, label]) => {
            const active = activeTab === value;
            const count = openCountFor(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => setActiveTab(value)}
                style={{
                  height: '42px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem',
                  fontSize: 'var(--font-sm)', fontWeight: 800, transition: 'all 0.15s',
                  background: active ? 'linear-gradient(135deg, #3F34C4 0%, #6D5DF0 100%)' : 'transparent',
                  color: active ? 'white' : 'var(--color-text-muted)',
                  boxShadow: active ? '0 4px 12px rgba(63,52,196,0.3)' : 'none',
                }}
              >
                {label}
                {count > 0 && (
                  <span style={{ minWidth: '20px', padding: '0 6px', borderRadius: '999px', fontSize: '11px', lineHeight: '20px', background: active ? 'rgba(255,255,255,0.25)' : '#ECE8FF', color: active ? 'white' : PRIMARY }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Neue Aufgabe */}
      <button
        type="button"
        onClick={openAdd}
        style={{
          width: '100%', height: '50px', border: 'none', borderRadius: '999px', cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          background: 'linear-gradient(135deg, #3F34C4 0%, #6D5DF0 100%)', color: 'white',
          fontSize: 'var(--font-base)', fontWeight: 800, boxShadow: '0 8px 20px rgba(63,52,196,0.3)',
        }}
      >
        <Plus size={19} /> Neue Aufgabe
      </button>

      {/* Offen */}
      {displayedTasks.length === 0 ? (
        <div style={{ ...CARD, textAlign: 'center', padding: '2rem 1.25rem' }}>
          <span style={{ ...iconChip(PRIMARY, 52), margin: '0 auto 0.7rem' }}><ClipboardList size={24} /></span>
          <div style={{ fontSize: 'var(--font-base)', fontWeight: 800 }}>Keine Aufgaben vorhanden</div>
          <div style={{ marginTop: '0.25rem', fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)' }}>Lege die erste Aufgabe mit „Neue Aufgabe" an.</div>
        </div>
      ) : (
        <>
          {openTasks.length > 0 && (
            <div style={CARD}>
              {sectionHeader(<ClipboardList size={18} />, PRIMARY, 'Offen', openTasks.length)}
              {openTasks.map(renderRow)}
            </div>
          )}
          {doneTasks.length > 0 && (
            <div style={CARD}>
              {sectionHeader(<Check size={18} />, GREEN, 'Erledigt', doneTasks.length)}
              {doneTasks.map(renderRow)}
            </div>
          )}
          {!isChild && (
            <p style={{ margin: 0, textAlign: 'center', fontSize: '11px', color: 'var(--color-text-muted)' }}>
              Tipp: Den Kreis antippen zum Abhaken, den Text zum Bearbeiten oder Löschen.
            </p>
          )}
        </>
      )}

      {/* Sheet: Neu / Bearbeiten */}
      {sheet && createPortal(
        <div
          onClick={() => setSheet(null)}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(23,20,58,0.5)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 2000, animation: 'tasksFade 0.2s ease',
          }}
        >
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={handleSave}
            style={{
              width: '100%', maxWidth: '500px', maxHeight: '94vh', overflowY: 'auto', borderRadius: '28px 28px 0 0',
              backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', boxShadow: '0 -12px 40px rgba(63,52,196,0.25)',
              padding: '0.75rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom))', animation: 'tasksSheetUp 0.28s ease',
              display: 'flex', flexDirection: 'column', gap: '1rem',
            }}
          >
            <div style={{ width: '44px', height: '5px', borderRadius: '999px', background: 'var(--color-border)', alignSelf: 'center' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 'var(--font-lg)', fontWeight: 800 }}>{sheet.id ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}</h2>
                {!sheet.id && !isChild && (
                  <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                    {activeTab === 'SHARED' ? 'Wird als gemeinsame Aufgabe angelegt' : 'Wird als private Aufgabe angelegt'}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSheet(null)}
                aria-label="Schließen"
                style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', cursor: 'pointer', background: PRIMARY + '1F', color: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label style={fieldLabel} htmlFor="task-content">Aufgabe</label>
              <input
                id="task-content"
                className="input-field"
                style={{ width: '100%' }}
                placeholder="Was ist zu tun?"
                value={sheet.content}
                onChange={e => setSheet({ ...sheet, content: e.target.value })}
                autoFocus
              />
            </div>

            <div>
              <span style={fieldLabel}>Priorität</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {([1, 2, 3] as const).map(p => {
                  const active = sheet.priority === p;
                  const color = PRIO_COLOR[p];
                  const pts = settings.prioPoints[p] || 0;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSheet({ ...sheet, priority: p })}
                      style={{
                        padding: '0.55rem 0.25rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', transition: 'all 0.15s',
                        border: `2px solid ${active ? color : 'transparent'}`,
                        background: active ? color : color + '1F',
                        color: active ? 'white' : color,
                        boxShadow: active ? `0 4px 12px ${color}66` : 'none',
                      }}
                    >
                      <span style={{ fontSize: 'var(--font-sm)', fontWeight: 800 }}>Prio {p}</span>
                      {pts > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 700, opacity: 0.9 }}>
                          <Star size={11} fill="currentColor" /> {pts}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span style={fieldLabel}>Zuständig</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                {assignableUsers.map(u => {
                  const selected = sheet.assignedTo.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setSheet({
                        ...sheet,
                        assignedTo: selected ? sheet.assignedTo.filter(id => id !== u.id) : [...sheet.assignedTo, u.id],
                      })}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.8rem 0.3rem 0.3rem',
                        borderRadius: '999px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--font-sm)', fontWeight: 700,
                        transition: 'all 0.15s',
                        border: `2px solid ${selected ? PRIMARY : 'transparent'}`,
                        background: selected ? '#ECE8FF' : 'var(--color-surface-muted)',
                        color: selected ? PRIMARY : 'var(--color-text-muted)',
                      }}
                    >
                      <span style={{ width: '26px', height: '26px', borderRadius: '50%', background: u.avatarColor || '#6366f1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                        <AvatarEmoji emoji={u.avatar} size={26} />
                      </span>
                      {u.id}
                      {selected && <Check size={14} strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
              {sheet.assignedTo.length === 0 && !isChild && (
                <div style={{ marginTop: '0.4rem', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Ohne Auswahl wird die Aufgabe an alle verteilt.</div>
              )}
            </div>

            <div>
              <label style={fieldLabel} htmlFor="task-due">Fällig am</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  id="task-due"
                  type="date"
                  className="input-field"
                  style={{ flex: 1, minWidth: 0, color: sheet.dueDate ? 'var(--color-text)' : 'var(--color-text-muted)' }}
                  value={sheet.dueDate}
                  onChange={e => setSheet({ ...sheet, dueDate: e.target.value })}
                />
                {sheet.dueDate && (
                  <button
                    type="button"
                    onClick={() => setSheet({ ...sheet, dueDate: '' })}
                    aria-label="Datum entfernen"
                    style={{ width: '44px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', background: 'var(--color-surface-muted)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={!sheet.content.trim()}
              style={{
                width: '100%', height: '50px', border: 'none', borderRadius: '999px', fontFamily: 'inherit',
                cursor: sheet.content.trim() ? 'pointer' : 'default', opacity: sheet.content.trim() ? 1 : 0.5,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                background: 'linear-gradient(135deg, #3F34C4 0%, #6D5DF0 100%)', color: 'white',
                fontSize: 'var(--font-base)', fontWeight: 800, boxShadow: '0 8px 20px rgba(63,52,196,0.3)',
              }}
            >
              <Check size={18} /> {sheet.id ? 'Speichern' : 'Hinzufügen'}
            </button>

            {sheet.id && (
              <button
                type="button"
                onClick={handleDelete}
                style={{
                  width: '100%', height: '44px', border: 'none', borderRadius: '999px', cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                  background: '#FDE8EF', color: PINK_TEXT, fontSize: 'var(--font-sm)', fontWeight: 800,
                }}
              >
                <Trash2 size={16} /> Aufgabe löschen
              </button>
            )}
          </form>
          <style>{`
            @keyframes tasksFade { from { opacity: 0; } to { opacity: 1; } }
            @keyframes tasksSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          `}</style>
        </div>,
        document.body
      )}
    </div>
  );
};
