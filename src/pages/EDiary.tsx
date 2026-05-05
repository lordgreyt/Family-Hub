import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';
import type { MoodEntry } from '../services/mockDb';
import { Calendar as CalendarIcon, TrendingUp, CheckCircle2 } from 'lucide-react';

const MOODS = [
  { value: 1, emoji: '😠', color: '#ef4444', label: 'Wütend/Schlecht' },
  { value: 2, emoji: '🙁', color: '#f97316', label: 'Traurig/Nicht so gut' },
  { value: 3, emoji: '😐', color: '#eab308', label: 'Neutral/Okay' },
  { value: 4, emoji: '🙂', color: '#84cc16', label: 'Gut/Zufrieden' },
  { value: 5, emoji: '😄', color: '#22c55e', label: 'Glücklich/Super' },
];

export const EDiary = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [timeRange, setTimeRange] = useState<30 | 60>(30);
  const [showToast, setShowToast] = useState(false);

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

  const handleMoodSelect = (mood: number) => {
    const today = new Date().toISOString().split('T')[0];
    mockDb.addOrUpdateMoodEntry({ date: today, mood });
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

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
      <div className="glass-panel" style={{
        padding: '1.5rem',
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <h2 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', textAlign: 'center' }}>
          Abend-Check-in
        </h2>
        <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.85rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
          Wie war dein Tag heute?
        </p>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {MOODS.map(m => (
            <button
              key={m.value}
              onClick={() => handleMoodSelect(m.value)}
              style={{
                flex: 1,
                aspectRatio: '1',
                borderRadius: '50%',
                border: 'none',
                background: 'var(--color-background)',
                fontSize: '2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
              }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.9)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1.1)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {m.emoji}
            </button>
          ))}
        </div>
      </div>

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
      <MoodCalendar entries={entries} />

      {/* Trend Graph */}
      <MoodGraph entries={entries} days={timeRange} />

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
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)' }}>Stimmung gespeichert!</span>
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

// --- Subcomponents ---

const MoodCalendar = ({ entries }: { entries: MoodEntry[] }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  // Adjust so Monday is 0
  const firstDayIndex = firstDay === 0 ? 6 : firstDay - 1;

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayIndex }, (_, i) => i);

  const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

  const getMoodColor = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const entry = entries.find(e => e.date === dateStr);
    if (!entry) return 'var(--color-background)';
    return MOODS.find(m => m.value === entry.mood)?.color || 'var(--color-background)';
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
            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '0.2rem' }}
          >&lt;</button>
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '0.2rem' }}
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
          const color = getMoodColor(day);
          const hasEntry = color !== 'var(--color-background)';
          return (
            <div
              key={day}
              style={{
                aspectRatio: '1',
                backgroundColor: color,
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: hasEntry ? 700 : 500,
                color: hasEntry ? 'white' : 'var(--color-text-muted)',
                border: hasEntry ? 'none' : '1px solid var(--color-border)',
                opacity: hasEntry ? 0.9 : 0.6
              }}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MoodGraph = ({ entries, days }: { entries: MoodEntry[], days: number }) => {
  const chartData = useMemo(() => {
    const data = [];
    const today = new Date();
    // Generate dates for the last 'days' amount
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const entry = entries.find(e => e.date === dateStr);
      data.push({
        date: dateStr,
        displayDate: `${d.getDate()}.${d.getMonth() + 1}.`,
        mood: entry ? entry.mood : null
      });
    }
    return data;
  }, [entries, days]);

  const height = 150;
  // Let's reserve some horizontal padding
  const paddingX = 20;
  // Let's assume a fixed viewBox width for calculation
  const width = 300;

  // Filter out nulls to connect the line only between existing data points
  const points = chartData.map((d, i) => {
    if (d.mood === null) return null;
    const x = paddingX + (i / (days - 1)) * (width - 2 * paddingX);
    // Y-Axis: Mood 5 = 20, Mood 1 = 130
    const y = 130 - ((d.mood - 1) * (110 / 4));
    return { x, y, mood: d.mood, displayDate: d.displayDate };
  }).filter(Boolean) as { x: number, y: number, mood: number, displayDate: string }[];

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
        Trend ({days} Tage)
      </h3>

      {points.length < 2 ? (
        <div style={{ height: `${height}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
          Nicht genug Daten für einen Trend.
        </div>
      ) : (
        <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', minWidth: '300px', height: `${height}px`, overflow: 'visible' }}>
            {/* Grid Lines */}
            {[1, 2, 3, 4, 5].map(m => {
              const y = 130 - ((m - 1) * (110 / 4));
              return (
                <g key={m}>
                  <line x1={0} y1={y} x2={width} y2={y} stroke="var(--color-border)" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
                  <text x={0} y={y + 3} fontSize="10" fill="var(--color-text-muted)" opacity="0.8">{MOODS.find(mood => mood.value === m)?.emoji}</text>
                </g>
              );
            })}

            {/* Trend Line */}
            <path d={pathD} fill="none" stroke="var(--color-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

            {/* Data Points */}
            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="4" fill="var(--color-surface)" stroke="var(--color-primary)" strokeWidth="2" />
            ))}

            {/* X-Axis Labels (show ~5 labels to not crowd) */}
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
