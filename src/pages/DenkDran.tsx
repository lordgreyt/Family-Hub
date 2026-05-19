import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { mockDb } from '../services/mockDb';
import { getNeonColor, getNeonCardStyle } from '../utils/neon';
import { AvatarEmoji } from '../components/AvatarEmoji';
import type { Reminder, User } from '../services/mockDb';
import { ChevronLeft, ChevronRight, Plus, X, Trash2, RefreshCw, Calendar, Save } from 'lucide-react';

const DAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DAY_NAMES_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

/** Liefert den Montag 00:00 der Woche, die `date` enthält */
function getMonday(d: Date): Date {
  const m = new Date(d);
  const day = m.getDay(); // 0=So
  const diff = day === 0 ? -6 : 1 - day;
  m.setDate(m.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ─── Edit-Modal ───
interface EditModalProps {
  form: { text: string; childId: string; isRecurring: boolean; dayOfWeek: number; date: string };
  onChange: (f: EditModalProps['form']) => void;
  onSave: () => void;
  onClose: () => void;
  children: User[];
}

const EditModal = ({ form, onChange, onSave, onClose, children }: EditModalProps) => {
  const update = (patch: Partial<EditModalProps['form']>) => onChange({ ...form, ...patch });

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
    }}>
      <div className="glass-panel" style={{
        maxWidth: '400px', width: '100%', padding: '1.25rem',
        borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Erinnerung</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Child selector */}
          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem', display: 'block' }}>Kind</label>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {children.map(c => {
                const active = form.childId === c.id;
                const cGlow = getNeonColor(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => update({ childId: c.id })}
                    className="btn"
                    style={{
                      padding: '0.3rem 0.6rem', fontSize: '0.8rem', borderRadius: '20px',
                      border: '1px solid', borderColor: active ? 'var(--color-primary)' : 'var(--color-border)',
                      backgroundColor: active ? 'var(--color-primary-light)' : 'var(--color-surface)',
                      color: active ? 'white' : 'var(--color-text-muted)',
                      display: 'flex', alignItems: 'center', gap: '4px',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '50%', background: c.avatarColor || '#6366f1', flexShrink: 0, overflow: 'hidden' }}>
                      <AvatarEmoji emoji={c.avatar} size={18} />
                    </span>
                    {c.id}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text */}
          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem', display: 'block' }}>Text</label>
            <input
              type="text" className="input-field" placeholder="z.B. Sportsachen mitnehmen"
              value={form.text} onChange={e => update({ text: e.target.value })}
              style={{ width: '100%', fontSize: 'var(--font-sm)' }} autoFocus
            />
          </div>

          {/* Recurring toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', userSelect: 'none' }}>
              <input type="checkbox" checked={form.isRecurring} onChange={e => update({ isRecurring: e.target.checked })} />
              Wiederholt sich jede Woche
            </label>
          </div>

          {/* Day of week */}
          {form.isRecurring ? (
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem', display: 'block' }}>Wochentag</label>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                {[1, 2, 3, 4, 5, 6, 0].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => update({ dayOfWeek: d })}
                    className="btn"
                    style={{
                      flex: 1, padding: '0.4rem 0.25rem', fontSize: '0.7rem', fontWeight: 700,
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid', borderColor: form.dayOfWeek === d ? 'var(--color-primary)' : 'var(--color-border)',
                      backgroundColor: form.dayOfWeek === d ? 'var(--color-primary-light)' : 'var(--color-surface)',
                      color: form.dayOfWeek === d ? 'white' : 'var(--color-text-muted)',
                    }}
                  >
                    {DAY_NAMES[d]}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem', display: 'block' }}>Datum</label>
              <input
                type="date" className="input-field"
                value={form.date} onChange={e => update({ date: e.target.value })}
                style={{ width: '100%', fontSize: 'var(--font-sm)' }}
              />
              {form.date && (
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.3rem' }}>
                  {DAY_NAMES_LONG[new Date(form.date + 'T00:00').getDay()]}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <button
              type="button"
              onClick={() => onSave(false)}
              className="btn btn-primary"
              disabled={!form.text.trim() || !form.childId || (!form.isRecurring && !form.date)}
              style={{ flex: 1, padding: '0.6rem', display: 'flex', justifyContent: 'center', gap: '0.4rem' }}
            >
              <Save size={16} /> Speichern
            </button>
            <button
              type="button"
              onClick={() => onSave(true)}
              className="btn btn-primary"
              disabled={!form.text.trim() || !form.childId || (!form.isRecurring && !form.date)}
              style={{ flex: 1, padding: '0.6rem', display: 'flex', justifyContent: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
            >
              <Save size={16} /> <Plus size={14} /> Weiter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ───
export const DenkDran = () => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Week navigation
  const [monday, setMonday] = useState(() => getMonday(new Date()));

  // Edit state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ text: '', childId: '', isRecurring: true, dayOfWeek: 1, date: '' });

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Reminder | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user || user.isChild) return;
    const load = () => {
      setReminders(mockDb.getReminders());
      setUsers(mockDb.getUsers().map(u => ({
        ...u,
        avatarColor: settings.designMode === 'neon' ? (u.avatarColorNeon || getNeonColor(u.id).color) : u.avatarColor,
      })));
      setDataLoaded(true);
    };
    load();
    window.addEventListener('db_updated', load);
    return () => window.removeEventListener('db_updated', load);
  }, [user, settings.designMode]);

  const children = useMemo(() => users.filter(u => u.isChild), [users]);

  // Days of current week
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  }, [monday]);

  // Build lookup: day index (0-6) → reminders for that day
  const remindersByDay = useMemo(() => {
    const map: Record<string, Reminder[]> = {};
    for (let i = 0; i < 7; i++) {
      const d = weekDays[i];
      const key = formatDate(d);
      const dow = d.getDay(); // 0-6

      const matching = reminders.filter(r => {
        if (r.isRecurring) return r.dayOfWeek === dow;
        return r.date === key;
      });

      map[key] = matching;
    }
    return map;
  }, [reminders, weekDays]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const prevWeek = () => {
    const prev = new Date(monday);
    prev.setDate(prev.getDate() - 7);
    setMonday(prev);
  };
  const nextWeek = () => {
    const next = new Date(monday);
    next.setDate(next.getDate() + 7);
    setMonday(next);
  };
  const goToday = () => setMonday(getMonday(new Date()));

  // Open add modal for a specific day
  const openAdd = (dayIndex: number, dateStr: string) => {
    setEditForm({ text: '', childId: children[0]?.id || '', isRecurring: false, dayOfWeek: dayIndex, date: dateStr });
    setEditingId(null);
    setShowModal(true);
  };

  // Open edit modal
  const openEdit = (r: Reminder) => {
    setEditForm({
      text: r.text,
      childId: r.childId,
      isRecurring: r.isRecurring,
      dayOfWeek: r.dayOfWeek,
      date: r.date || '',
    });
    setEditingId(r.id);
    setShowModal(true);
  };

  // Save
  const handleSave = (keepOpen = false) => {
    if (!user || !editForm.text.trim() || !editForm.childId) return;

    if (editingId) {
      const existing = reminders.find(r => r.id === editingId);
      if (!existing) return;
      mockDb.updateReminder({
        ...existing,
        text: editForm.text.trim(),
        childId: editForm.childId,
        isRecurring: editForm.isRecurring,
        dayOfWeek: editForm.isRecurring ? editForm.dayOfWeek : new Date(editForm.date + 'T00:00').getDay(),
        date: editForm.isRecurring ? undefined : editForm.date,
      });
      setShowModal(false);
      setEditingId(null);
    } else {
      mockDb.addReminder({
        text: editForm.text.trim(),
        childId: editForm.childId,
        isRecurring: editForm.isRecurring,
        dayOfWeek: editForm.isRecurring ? editForm.dayOfWeek : new Date(editForm.date + 'T00:00').getDay(),
        date: editForm.isRecurring ? undefined : editForm.date,
        createdBy: user.id,
      });

      if (keepOpen) {
        // Text leeren, Kind und Datum beibehalten für schnelles Weiter-Hinzufügen
        setEditForm(f => ({ ...f, text: '' }));
      } else {
        setShowModal(false);
        setEditingId(null);
      }
    }
  };

  const handleDelete = (id: string) => {
    mockDb.deleteReminder(id);
    setDeleteTarget(null);
  };

  // Long-press handlers
  const startLongPress = useCallback((r: Reminder) => {
    longPressTimer.current = setTimeout(() => {
      setDeleteTarget(r);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 600);
  }, []);
  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  if (!user || user.isChild || !dataLoaded) return null;

  const isNeon = settings.designMode === 'neon';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary)' }}>Denk dran</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={prevWeek} className="btn btn-secondary" style={{ padding: '0.4rem 0.5rem' }}>
            <ChevronLeft size={18} />
          </button>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', minWidth: '100px', textAlign: 'center' }}>
            KW {(() => { const jan1 = new Date(monday.getFullYear(), 0, 1); return Math.ceil(((monday.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7); })()}
          </span>
          <button onClick={nextWeek} className="btn btn-secondary" style={{ padding: '0.4rem 0.5rem' }}>
            <ChevronRight size={18} />
          </button>
          <button onClick={goToday} className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}>
            Heute
          </button>
        </div>
      </div>

      {/* Week rows */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        gap: '0.5rem',
        flex: 1,
        overflowY: 'auto',
      }}>
        {weekDays.map((day) => {
          const dateStr = formatDate(day);
          const dayReminders = remindersByDay[dateStr] || [];
          const isToday = sameDay(day, today);
          const ncs = isNeon ? getNeonCardStyle(dateStr) : undefined;
          const dayLabel = `${DAY_NAMES_LONG[day.getDay()]}, ${day.getDate()}.${day.getMonth() + 1}.`;

          return (
            <div
              key={dateStr}
              style={{
                display: 'flex',
                gap: '0.75rem',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                border: isToday ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                backgroundColor: isToday ? 'var(--color-primary-transparent)' : 'var(--color-surface)',
                minHeight: '54px',
                transition: 'border-color 0.15s, background 0.15s',
                ...(isNeon && ncs && !isToday ? {
                  backgroundImage: ncs.backgroundImage,
                  backgroundOrigin: ncs.backgroundOrigin as any,
                  backgroundClip: ncs.backgroundClip,
                  border: ncs.border,
                  boxShadow: ncs.boxShadow,
                } : {}),
              }}
            >
              {/* Day label + add button */}
              <div
                onClick={() => openAdd(day.getDay(), dateStr)}
                style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: '0.2rem',
                  width: '52px', flexShrink: 0,
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <div style={{
                  fontSize: '0.7rem', fontWeight: 700,
                  color: isToday ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  whiteSpace: 'nowrap',
                }}>
                  {DAY_NAMES[day.getDay()]}
                </div>
                <div style={{
                  fontSize: '1.1rem', fontWeight: 800,
                  color: isToday ? 'var(--color-primary)' : 'var(--color-text)',
                  lineHeight: 1,
                }}>
                  {day.getDate()}
                </div>
                <Plus size={14} style={{ color: 'var(--color-text-muted)', opacity: 0.4 }} />
              </div>

              {/* Reminders */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem', justifyContent: 'center' }}>
                {dayReminders.length === 0 ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', opacity: 0.5 }}>Keine Einträge</span>
                ) : (
                  dayReminders.map(r => {
                    const child = users.find(u => u.id === r.childId);
                    return (
                      <div
                        key={r.id}
                        onTouchStart={() => startLongPress(r)}
                        onTouchEnd={cancelLongPress}
                        onTouchMove={cancelLongPress}
                        onMouseDown={() => startLongPress(r)}
                        onMouseUp={cancelLongPress}
                        onMouseLeave={cancelLongPress}
                        onContextMenu={e => { e.preventDefault(); setDeleteTarget(r); }}
                        onClick={() => openEdit(r)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.5rem',
                          padding: '0.35rem 0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: r.isRecurring ? 'rgba(99,102,241,0.08)' : 'rgba(245,158,11,0.08)',
                          borderLeft: `3px solid ${r.isRecurring ? '#6366f1' : '#f59e0b'}`,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                      >
                        <span style={{ fontSize: '1rem', flexShrink: 0, width: '24px', textAlign: 'center' }}>
                          {child?.avatar || '👤'}
                        </span>
                        <span style={{
                          flex: 1, minWidth: 0,
                          color: 'var(--color-text)',
                          lineHeight: 1.3,
                        }}>
                          {r.text}
                        </span>
                        {r.isRecurring ? (
                          <RefreshCw size={12} style={{ color: '#6366f1', flexShrink: 0, opacity: 0.6 }} />
                        ) : (
                          <Calendar size={12} style={{ color: '#f59e0b', flexShrink: 0, opacity: 0.6 }} />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
        }}>
          <div className="glass-panel" style={{
            maxWidth: '340px', width: '100%', padding: '1.25rem',
            borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)',
            textAlign: 'center',
          }}>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: 'var(--color-text)' }}>
              Eintrag <strong>„{deleteTarget.text}"</strong> löschen?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteTarget(null)}
                style={{ flex: 1, padding: '0.5rem' }}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleDelete(deleteTarget.id)}
                style={{ flex: 1, padding: '0.5rem', backgroundColor: 'var(--color-danger)', color: 'white', border: 'none' }}
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {showModal && (
        <EditModal
          form={editForm}
          onChange={setEditForm}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingId(null); }}
          children={children}
        />
      )}
    </div>
  );
};
