import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';
import type { MoodEntry } from '../services/mockDb';
import { Calendar as CalendarIcon, TrendingUp, CheckCircle2, Brain, Activity, X } from 'lucide-react';

const MOOD_LEVELS = [
  { value: 1, emoji: '😠', color: '#ef4444', label: 'Sehr schlecht' },
  { value: 2, emoji: '🙁', color: '#f97316', label: 'Nicht so gut' },
  { value: 3, emoji: '😐', color: '#eab308', label: 'Neutral/Okay' },
  { value: 4, emoji: '🙂', color: '#84cc16', label: 'Gut' },
  { value: 5, emoji: '😄', color: '#22c55e', label: 'Sehr gut' },
];

// Weighted average: mental 2/3, physical 1/3
const getWeightedAverage = (mental: number, physical: number): number => {
  return Math.round((mental * 2 + physical * 1) / 3);
};

const getMoodColor = (avg: number): string => {
  return MOOD_LEVELS.find(m => m.value === avg)?.color || '#eab308';
};

export const EDiary = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [timeRange, setTimeRange] = useState<30 | 60>(30);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [editingEntry, setEditingEntry] = useState<MoodEntry | null>(null);
  const [editDate, setEditDate] = useState<string | null>(null);

  useEffect(() => {
    if (user && !user.isAdmin) {
      navigate('/');
    }
    loadData();
    window.addEventListener('db_updated', loadData);
    return () => window.removeEventListener('db_updated', loadData);
  }, [user, navigate]);

  const loadData = () => {
    setEntries(mockDb.getMoodEntries());
  };

  const handleMoodSelect = (mental: number, physical: number) => {
    const today = new Date().toISOString().split('T')[0];
    mockDb.addOrUpdateMoodEntry({ date: today, mentalMood: mental, physicalMood: physical });
    setToastMessage('Stimmung gespeichert!');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleEditSave = (mental: number, physical: number) => {
    if (!editDate) return;
    mockDb.addOrUpdateMoodEntry({ date: editDate, mentalMood: mental, physicalMood: physical });
    setEditDate(null);
    setEditingEntry(null);
    setToastMessage('Eintrag aktualisiert!');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const openEditDialog = useCallback((dateStr: string) => {
    const existing = entries.find(e => e.date === dateStr);
    setEditDate(dateStr);
    setEditingEntry(existing || null);
  }, [entries]);

  if (!user || !user.isAdmin) return null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem',
      padding: '1rem',
      paddingBottom: '90px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-primary)' }}>Gefühle-Tagebuch</h1>
      </div>

      {/* Evening Check-in Section */}
      <MoodCheckIn
        onSave={handleMoodSelect}
        existingEntry={entries.find(e => e.date === new Date().toISOString().split('T')[0])}
      />

      {/* Dashboard Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>Dashboard</h2>
        <div style={{ display: 'flex', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', padding: '0.2rem', border: '1px solid var(--color-border)' }}>
          <button
            onClick={() => setTimeRange(30)}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: timeRange === 30 ? 'var(--color-primary)' : 'transparent',
              color: timeRange === 30 ? 'white' : 'var(--color-text-muted)',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            30 Tage
          </button>
          <button
            onClick={() => setTimeRange(60)}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: timeRange === 60 ? 'var(--color-primary)' : 'transparent',
              color: timeRange === 60 ? 'white' : 'var(--color-text-muted)',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            60 Tage
          </button>
        </div>
      </div>

      {/* Calendar View */}
      <MoodCalendar entries={entries} onEditDay={openEditDialog} />

      {/* Trend Graph */}
      <MoodGraph entries={entries} days={timeRange} />

      {/* Edit Dialog */}
      {editDate && (
        <EditDialog
          date={editDate}
          existingEntry={editingEntry}
          onSave={handleEditSave}
          onClose={() => { setEditDate(null); setEditingEntry(null); }}
        />
      )}

      {/* Success Toast */}
      {showToast && (
        <div style={{
          position: 'fixed',
          top: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'var(--color-surface)',
          padding: '0.75rem 1.5rem',
          borderRadius: 'var(--radius-full)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          zIndex: 2000,
          border: '1px solid var(--color-border)',
          animation: 'slideDown 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}>
          <CheckCircle2 color="var(--color-success)" size={20} />
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)' }}>{toastMessage}</span>
        </div>
      )}

      <style>{`
        @keyframes slideDown {
          from { transform: translate(-50%, -100%); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

// --- Mood Check-In (Today) ---

const MoodCheckIn = ({ onSave, existingEntry }: { onSave: (mental: number, physical: number) => void, existingEntry?: MoodEntry }) => {
  const [mental, setMental] = useState<number>(existingEntry?.mentalMood || 0);
  const [physical, setPhysical] = useState<number>(existingEntry?.physicalMood || 0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (existingEntry) {
      setMental(existingEntry.mentalMood);
      setPhysical(existingEntry.physicalMood);
      setSaved(true);
    }
  }, [existingEntry]);

  const handleSave = () => {
    if (mental === 0 || physical === 0) return;
    onSave(mental, physical);
    setSaved(true);
  };

  const avg = mental > 0 && physical > 0 ? getWeightedAverage(mental, physical) : null;

  return (
    <div className="glass-panel" style={{
      padding: '1.5rem',
      backgroundColor: 'var(--color-surface)',
      borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--color-border)',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', textAlign: 'center' }}>
        Abend-Check-in
      </h2>
      <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.85rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
        Wie war dein Tag heute?
      </p>

      {/* Mental Health Row */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Brain size={18} color="var(--color-primary)" />
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)' }}>Mentale Gesundheit</span>
          {mental > 0 && (
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
              {MOOD_LEVELS.find(m => m.value === mental)?.label}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
          {MOOD_LEVELS.map(m => (
            <button
              key={`mental-${m.value}`}
              onClick={() => { setMental(m.value); setSaved(false); }}
              style={{
                flex: 1,
                aspectRatio: '1',
                borderRadius: '50%',
                border: mental === m.value ? '2px solid var(--color-primary)' : '2px solid transparent',
                background: mental === m.value ? 'var(--color-primary-light)' + '20' : 'var(--color-background)',
                fontSize: '2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'transform 0.15s, border-color 0.2s, background 0.2s',
                opacity: mental === m.value ? 1 : 0.7,
                transform: mental === m.value ? 'scale(1.08)' : 'scale(1)',
              }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
              onMouseUp={e => e.currentTarget.style.transform = mental === m.value ? 'scale(1.08)' : 'scale(1)'}
              onMouseLeave={e => e.currentTarget.style.transform = mental === m.value ? 'scale(1.08)' : 'scale(1)'}
            >
              {m.emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Physical Health Row */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Activity size={18} color="var(--color-primary)" />
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)' }}>Körperliche Gesundheit</span>
          {physical > 0 && (
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
              {MOOD_LEVELS.find(m => m.value === physical)?.label}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
          {MOOD_LEVELS.map(m => (
            <button
              key={`physical-${m.value}`}
              onClick={() => { setPhysical(m.value); setSaved(false); }}
              style={{
                flex: 1,
                aspectRatio: '1',
                borderRadius: '50%',
                border: physical === m.value ? '2px solid var(--color-primary)' : '2px solid transparent',
                background: physical === m.value ? 'var(--color-primary-light)' + '20' : 'var(--color-background)',
                fontSize: '2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'transform 0.15s, border-color 0.2s, background 0.2s',
                opacity: physical === m.value ? 1 : 0.7,
                transform: physical === m.value ? 'scale(1.08)' : 'scale(1)',
              }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
              onMouseUp={e => e.currentTarget.style.transform = physical === m.value ? 'scale(1.08)' : 'scale(1)'}
              onMouseLeave={e => e.currentTarget.style.transform = physical === m.value ? 'scale(1.08)' : 'scale(1)'}
            >
              {m.emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Save Button + Average Preview */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginTop: '0.5rem' }}>
        {avg !== null && !saved && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            <span>Gesamt:</span>
            <span style={{ fontSize: '1.2rem' }}>{MOOD_LEVELS.find(m => m.value === avg)?.emoji}</span>
            <span style={{ fontWeight: 600, color: getMoodColor(avg) }}>
              ({mental * 2 + physical * 1}/3 → {avg})
            </span>
          </div>
        )}
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={mental === 0 || physical === 0}
          style={{
            padding: '0.6rem 1.5rem',
            fontSize: '0.9rem',
            opacity: (mental === 0 || physical === 0) ? 0.5 : 1,
          }}
        >
          {saved ? '✓ Gespeichert' : 'Speichern'}
        </button>
      </div>
    </div>
  );
};

// --- Edit Dialog (for past days) ---

const EditDialog = ({ date, existingEntry, onSave, onClose }: {
  date: string;
  existingEntry: MoodEntry | null;
  onSave: (mental: number, physical: number) => void;
  onClose: () => void;
}) => {
  const [mental, setMental] = useState<number>(existingEntry?.mentalMood || 0);
  const [physical, setPhysical] = useState<number>(existingEntry?.physicalMood || 0);

  const dateObj = new Date(date + 'T00:00:00');
  const formattedDate = dateObj.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const handleSave = () => {
    if (mental === 0 || physical === 0) return;
    onSave(mental, physical);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 1500,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '600px',
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
        padding: '1.5rem',
        paddingBottom: '2rem',
        animation: 'slideUp 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '0.25rem' }}>
            <X size={22} />
          </button>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>
            {formattedDate}
          </h3>
          <div style={{ width: 22 }} />
        </div>

        {/* Mental Row */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Brain size={18} color="var(--color-primary)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>Mentale Gesundheit</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
            {MOOD_LEVELS.map(m => (
              <button
                key={`edit-mental-${m.value}`}
                onClick={() => setMental(m.value)}
                style={{
                  flex: 1,
                  aspectRatio: '1',
                  borderRadius: '50%',
                  border: mental === m.value ? '2px solid var(--color-primary)' : '2px solid transparent',
                  background: mental === m.value ? 'var(--color-primary-light)' + '20' : 'var(--color-background)',
                  fontSize: '2rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'transform 0.15s, border-color 0.2s',
                  opacity: mental === m.value ? 1 : 0.7,
                  transform: mental === m.value ? 'scale(1.08)' : 'scale(1)',
                }}
              >
                {m.emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Physical Row */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Activity size={18} color="var(--color-primary)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>Körperliche Gesundheit</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
            {MOOD_LEVELS.map(m => (
              <button
                key={`edit-physical-${m.value}`}
                onClick={() => setPhysical(m.value)}
                style={{
                  flex: 1,
                  aspectRatio: '1',
                  borderRadius: '50%',
                  border: physical === m.value ? '2px solid var(--color-primary)' : '2px solid transparent',
                  background: physical === m.value ? 'var(--color-primary-light)' + '20' : 'var(--color-background)',
                  fontSize: '2rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'transform 0.15s, border-color 0.2s',
                  opacity: physical === m.value ? 1 : 0.7,
                  transform: physical === m.value ? 'scale(1.08)' : 'scale(1)',
                }}
              >
                {m.emoji}
              </button>
            ))}
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={mental === 0 || physical === 0}
          style={{
            width: '100%',
            padding: '0.75rem',
            fontSize: '0.95rem',
            marginTop: '0.5rem',
            opacity: (mental === 0 || physical === 0) ? 0.5 : 1,
          }}
        >
          Speichern
        </button>

        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
};

// --- Calendar (with long-press to edit) ---

const MoodCalendar = ({ entries, onEditDay }: { entries: MoodEntry[], onEditDay: (dateStr: string) => void }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const firstDayIndex = firstDay === 0 ? 6 : firstDay - 1;

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayIndex }, (_, i) => i);

  const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const getDayInfo = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const entry = entries.find(e => e.date === dateStr);
    if (!entry) return { dateStr, color: 'var(--color-background)', avg: null, entry: null };
    const avg = getWeightedAverage(entry.mentalMood, entry.physicalMood);
    return { dateStr, color: getMoodColor(avg), avg, entry };
  };

  return (
    <div className="glass-panel" style={{
      padding: '1.25rem',
      backgroundColor: 'var(--color-surface)',
      borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--color-border)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CalendarIcon size={18} color="var(--color-primary)" />
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '0.2rem', fontSize: '1.1rem' }}
          >&lt;</button>
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '0.2rem', fontSize: '1.1rem' }}
          >&gt;</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '4px' }}>
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => (
          <div key={d} style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {blanks.map(b => (
          <div key={`blank-${b}`} style={{ aspectRatio: '1' }} />
        ))}
        {days.map(day => {
          const { dateStr, color, avg, entry } = getDayInfo(day);
          const hasEntry = avg !== null;
          const isToday = dateStr === todayStr;

          return (
            <CalendarDay
              key={day}
              day={day}
              color={color}
              hasEntry={hasEntry}
              isToday={isToday}
              entry={entry}
              onEdit={() => onEditDay(dateStr)}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Skala:</span>
        {MOOD_LEVELS.map(m => (
          <div key={m.value} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <span style={{ fontSize: '0.8rem' }}>{m.emoji}</span>
          </div>
        ))}
        <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginLeft: '0.5rem' }}>Tipp: Lange drücken zum Bearbeiten</span>
      </div>
    </div>
  );
};

// --- Calendar Day (with long-press support) ---

const CalendarDay = ({ day, color, hasEntry, isToday, entry, onEdit }: {
  day: number;
  color: string;
  hasEntry: boolean;
  isToday: boolean;
  entry: MoodEntry | null;
  onEdit: () => void;
}) => {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPressed, setIsPressed] = useState(false);

  const startPress = () => {
    setIsPressed(true);
    pressTimer.current = setTimeout(() => {
      onEdit();
      setIsPressed(false);
    }, 600);
  };

  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    setIsPressed(false);
  };

  return (
    <div
      onMouseDown={startPress}
      onMouseUp={cancelPress}
      onMouseLeave={cancelPress}
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
      onTouchMove={cancelPress}
      style={{
        aspectRatio: '1',
        backgroundColor: color,
        borderRadius: isToday ? 'var(--radius-md)' : 'var(--radius-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.75rem',
        fontWeight: hasEntry ? 700 : 500,
        color: hasEntry ? 'white' : 'var(--color-text-muted)',
        border: isToday ? '2px solid var(--color-primary)' : hasEntry ? 'none' : '1px solid var(--color-border)',
        opacity: hasEntry ? 0.9 : 0.6,
        cursor: 'pointer',
        transition: 'transform 0.1s, box-shadow 0.1s',
        transform: isPressed ? 'scale(0.92)' : 'scale(1)',
        boxShadow: isPressed ? 'inset 0 0 0 2px var(--color-primary)' : 'none',
        position: 'relative',
      }}
    >
      {day}
      {hasEntry && entry && (
        <div style={{
          position: 'absolute',
          bottom: '2px',
          display: 'flex',
          gap: '1px',
        }}>
          <span style={{ fontSize: '0.45rem', lineHeight: 1 }}>
            {MOOD_LEVELS.find(m => m.value === entry.mentalMood)?.emoji}
          </span>
          <span style={{ fontSize: '0.45rem', lineHeight: 1 }}>
            {MOOD_LEVELS.find(m => m.value === entry.physicalMood)?.emoji}
          </span>
        </div>
      )}
    </div>
  );
};

// --- Trend Graph (weighted average) ---

const MoodGraph = ({ entries, days }: { entries: MoodEntry[], days: number }) => {
  const chartData = useMemo(() => {
    const data = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const entry = entries.find(e => e.date === dateStr);
      const avg = entry ? getWeightedAverage(entry.mentalMood, entry.physicalMood) : null;
      data.push({
        date: dateStr,
        displayDate: `${d.getDate()}.${d.getMonth() + 1}.`,
        avg,
        entry,
      });
    }
    return data;
  }, [entries, days]);

  const height = 150;
  const paddingX = 20;
  const width = 300;

  const points = chartData.map((d, i) => {
    if (d.avg === null) return null;
    const x = paddingX + (i / (days - 1)) * (width - 2 * paddingX);
    const y = 130 - ((d.avg - 1) * (110 / 4));
    return { x, y, avg: d.avg, displayDate: d.displayDate, entry: d.entry };
  }).filter(Boolean) as { x: number, y: number, avg: number, displayDate: string, entry: MoodEntry }[];

  const pathD = points.length > 0
    ? `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`
    : '';

  return (
    <div className="glass-panel" style={{
      padding: '1.25rem',
      backgroundColor: 'var(--color-surface)',
      borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--color-border)'
    }}>
      <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <TrendingUp size={18} color="var(--color-primary)" />
        Trend ({days} Tage) — gewichteter Durchschnitt
      </h3>

      {points.length < 2 ? (
        <div style={{ height: `${height}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
          Nicht genug Daten für einen Trend.
        </div>
      ) : (
        <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', minWidth: '300px', height: `${height}px`, overflow: 'visible' }}>
            {/* Grid Lines */}
            {MOOD_LEVELS.map(m => {
              const y = 130 - ((m.value - 1) * (110 / 4));
              return (
                <g key={m.value}>
                  <line x1={0} y1={y} x2={width} y2={y} stroke="var(--color-border)" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
                  <text x={0} y={y + 3} fontSize="10" fill="var(--color-text-muted)" opacity="0.8">{m.emoji}</text>
                </g>
              );
            })}

            {/* Trend Line */}
            <path d={pathD} fill="none" stroke="var(--color-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

            {/* Data Points */}
            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="4" fill="var(--color-surface)" stroke="var(--color-primary)" strokeWidth="2" />
            ))}

            {/* X-Axis Labels */}
            {chartData.map((d, i) => {
              if (i % Math.ceil(days / 5) !== 0 && i !== days - 1) return null;
              const x = paddingX + (i / (days - 1)) * (width - 2 * paddingX);
              return (
                <text key={i} x={x} y={145} fontSize="9" fill="var(--color-text-muted)" textAnchor="middle">
                  {d.displayDate}
                </text>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
};
