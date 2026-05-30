import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';
import type { MoodEntry, TagOption } from '../services/mockDb';
import { Calendar as CalendarIcon, TrendingUp, CheckCircle2, Brain, Activity, X, Tag, Bell, BellOff, Download, List } from 'lucide-react';

const MOOD_LEVELS = [
  { value: 1, emoji: '😠', color: '#ef4444', label: 'Sehr schlecht' },
  { value: 2, emoji: '🙁', color: '#f97316', label: 'Nicht so gut' },
  { value: 3, emoji: '😐', color: '#eab308', label: 'Neutral/Okay' },
  { value: 4, emoji: '🙂', color: '#84cc16', label: 'Gut' },
  { value: 5, emoji: '😄', color: '#22c55e', label: 'Sehr gut' },
];

// Weighted average: mental 2/3, physical 1/3 — raw float for granular colors
const getWeightedAverage = (mental: number, physical: number): number => {
  return (mental * 2 + physical * 1) / 3;
};

// Smooth color interpolation across the full 1.0–5.0 range
const getMoodColor = (avg: number): string => {
  const t = (avg - 1) / 4; // 0 to 1
  const stops = [
    { t: 0,    r: 0xef, g: 0x44, b: 0x44 }, // rot
    { t: 0.25, r: 0xf9, g: 0x73, b: 0x16 }, // orange
    { t: 0.5,  r: 0xea, g: 0xb3, b: 0x08 }, // gelb
    { t: 0.75, r: 0x84, g: 0xcc, b: 0x16 }, // limette
    { t: 1,    r: 0x22, g: 0xc5, b: 0x5e }, // grün
  ];

  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].t && t <= stops[i + 1].t) { lo = stops[i]; hi = stops[i + 1]; break; }
  }
  if (t < 0) { lo = stops[0]; hi = stops[0]; }
  if (t > 1) { lo = stops[stops.length - 1]; hi = stops[stops.length - 1]; }

  const range = hi.t - lo.t || 1;
  const f = (t - lo.t) / range;
  const r = Math.round(lo.r + (hi.r - lo.r) * f);
  const g = Math.round(lo.g + (hi.g - lo.g) * f);
  const b = Math.round(lo.b + (hi.b - lo.b) * f);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

export const EDiary = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [editingEntry, setEditingEntry] = useState<MoodEntry | null>(null);
  const [editDate, setEditDate] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    localStorage.getItem('ediary_notifications') === 'true' && Notification.permission === 'granted'
  );
  const [customTags, setCustomTags] = useState<TagOption[]>([]);
  const [showTagManager, setShowTagManager] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  useEffect(() => {
    if (!user) return;
    loadData();
    window.addEventListener('db_updated', loadData);
    return () => window.removeEventListener('db_updated', loadData);
  }, [user, navigate]);

  const loadData = () => {
    if (!user) return;
    setEntries(mockDb.getMoodEntries(user.id));
    setCustomTags(mockDb.getCustomTags(user.id));
  };

  const handleMoodSelect = (mental: number, physical: number, tags: string[], comment: string) => {
    const today = new Date().toISOString().split('T')[0];
    if (!user) return;
    mockDb.addOrUpdateMoodEntry({ date: today, userId: user.id, mentalMood: mental, physicalMood: physical, tags, comment: comment.trim() || undefined });
    setToastMessage('Stimmung gespeichert!');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleEditSave = (mental: number, physical: number, tags: string[], comment: string) => {
    if (!editDate) return;
    if (!user) return;
    mockDb.addOrUpdateMoodEntry({ date: editDate, userId: user.id, mentalMood: mental, physicalMood: physical, tags, comment: comment.trim() || undefined });
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

  const toggleNotifications = async () => {
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      localStorage.setItem('ediary_notifications', 'false');
    } else {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        setNotificationsEnabled(true);
        localStorage.setItem('ediary_notifications', 'true');
      }
    }
  };

  const handleAddTag = (emoji: string, label: string) => {
    if (!emoji.trim() || !label.trim()) return;
    const id = label.toLowerCase().replace(/[^a-z0-9äöüß]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (customTags.some(t => t.id === id)) return;
    const newTags = [...customTags, { id, emoji: emoji.trim(), label: label.trim() }];
    setCustomTags(newTags);
    if (user) mockDb.saveCustomTags(user.id, newTags);
  };

  const handleDeleteTag = (tagId: string) => {
    const newTags = customTags.filter(t => t.id !== tagId);
    setCustomTags(newTags);
    if (user) mockDb.saveCustomTags(user.id, newTags);
  };

  const handleExportImage = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 600;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(0, 0, 500, 600);

    // Title
    ctx.fillStyle = '#a5b4fc';
    ctx.font = 'bold 22px Inter, sans-serif';
    ctx.fillText('Stimmungstagebuch', 30, 50);
    ctx.fillStyle = '#e0e7ff';
    ctx.font = '14px Inter, sans-serif';
    ctx.fillText('Family Hub', 30, 72);

    // Date
    const now = new Date();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText(`Export: ${now.toLocaleDateString('de-DE')}`, 30, 100);

    // Stats
    const filtered = entries.filter(e => {
      const d = new Date(e.date + 'T00:00:00');
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      return d >= cutoff && d <= new Date();
    });

    const avgs = filtered.map(e => getWeightedAverage(e.mentalMood, e.physicalMood));
    const totalAvg = avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : 0;
    const best = avgs.length > 0 ? Math.max(...avgs) : 0;
    const worst = avgs.length > 0 ? Math.min(...avgs) : 0;

    ctx.fillStyle = '#e0e7ff';
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.fillText('Letzte 30 Tage', 30, 135);

    ctx.font = '13px Inter, sans-serif';
    const drawStat = (label: string, value: string, y: number, color: string) => {
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(label, 30, y);
      ctx.fillStyle = color;
      ctx.fillText(value, 180, y);
    };

    drawStat('Einträge:', `${filtered.length}`, 165, '#e0e7ff');
    drawStat('Durchschnitt:', totalAvg.toFixed(1), 185, getMoodColor(totalAvg));
    drawStat('Bester Tag:', best > 0 ? MOOD_LEVELS[Math.round(best) - 1]?.emoji + ' ' + best.toFixed(1) : '-', 205, '#22c55e');
    drawStat('Schlechtester Tag:', worst > 0 ? MOOD_LEVELS[Math.round(worst) - 1]?.emoji + ' ' + worst.toFixed(1) : '-', 225, '#ef4444');

    // Draw mini bar chart of last 14 days
    const recent14 = filtered.slice(-14);
    if (recent14.length > 0) {
      ctx.fillStyle = '#e0e7ff';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.fillText('Letzte 14 Tage', 30, 265);

      const barWidth = 28;
      const chartY = 350;
      const maxBarH = 120;
      const startX = 30;

      recent14.forEach((e, i) => {
        const avg = getWeightedAverage(e.mentalMood, e.physicalMood);
        const barH = ((avg - 1) / 4) * maxBarH;
        const x = startX + i * (barWidth + 4);
        const y = chartY - barH;

        ctx.fillStyle = getMoodColor(avg);
        ctx.fillRect(x, y, barWidth, barH);

        // Date label
        const d = new Date(e.date + 'T00:00:00');
        ctx.fillStyle = '#64748b';
        ctx.font = '9px Inter, sans-serif';
        ctx.fillText(`${d.getDate()}.${d.getMonth() + 1}`, x + 2, chartY + 12);
      });
    }

    // Download
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stimmungstagebuch-${now.toISOString().slice(0, 10)}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  if (!user) return null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-primary)' }}>Stimmung</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setShowTagManager(true)}
            title="Tags verwalten"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '0.4rem',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
            }}
          >
            <Tag size={18} />
          </button>
          <button
            onClick={toggleNotifications}
            title={notificationsEnabled ? 'Erinnerung deaktivieren' : 'Tägliche Erinnerung aktivieren'}
            style={{
              background: notificationsEnabled ? 'rgba(16, 185, 129, 0.1)' : 'var(--color-surface)',
              border: notificationsEnabled ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '0.4rem',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              color: notificationsEnabled ? 'var(--color-success)' : 'var(--color-text-muted)',
            }}
          >
            {notificationsEnabled ? <Bell size={18} /> : <BellOff size={18} />}
          </button>
          <button
            onClick={handleExportImage}
            title="Als Bild exportieren"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '0.4rem',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
            }}
          >
            <Download size={18} />
          </button>
        </div>
      </div>

      {/* Evening Check-in Section */}
      <MoodCheckIn
        onSave={handleMoodSelect}
        existingEntry={entries.find(e => e.date === new Date().toISOString().split('T')[0])}
        customTags={customTags}
      />

      {/* Calendar / List View Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>Dashboard</h2>
        <div style={{ display: 'flex', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', padding: '0.2rem', border: '1px solid var(--color-border)' }}>
          <button
            onClick={() => setViewMode('calendar')}
            style={{
              padding: '0.4rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: viewMode === 'calendar' ? 'var(--color-primary)' : 'transparent',
              color: viewMode === 'calendar' ? 'white' : 'var(--color-text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.2s'
            }}
            title="Kalenderansicht"
          >
            <CalendarIcon size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            style={{
              padding: '0.4rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: viewMode === 'list' ? 'var(--color-primary)' : 'transparent',
              color: viewMode === 'list' ? 'white' : 'var(--color-text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.2s'
            }}
            title="Listenansicht"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Calendar / List View */}
      {viewMode === 'calendar' ? (
        <MoodCalendar entries={entries} onEditDay={openEditDialog} customTags={customTags} />
      ) : (
        <MoodListView entries={entries} onEditDay={openEditDialog} customTags={customTags} days={30} />
      )}

      {/* Analysis */}
      <MoodAnalysis entries={entries} days={30} />

      {/* Trend Graph */}
      <MoodGraph entries={entries} days={30} />

      {/* Edit Dialog */}
      {editDate && (
        <EditDialog
          date={editDate}
          existingEntry={editingEntry}
          onSave={handleEditSave}
          onClose={() => { setEditDate(null); setEditingEntry(null); }}
          customTags={customTags}
        />
      )}

      {/* Tag Manager Dialog */}
      {showTagManager && <TagManagerDialog tags={customTags} onAdd={handleAddTag} onDelete={handleDeleteTag} onClose={() => setShowTagManager(false)} />}

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

// --- Tag Manager Dialog ---

const TagManagerDialog = ({ tags, onAdd, onDelete, onClose }: {
  tags: TagOption[];
  onAdd: (emoji: string, label: string) => void;
  onDelete: (tagId: string) => void;
  onClose: () => void;
}) => {
  const [newEmoji, setNewEmoji] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const handleAdd = () => {
    if (!newEmoji.trim() || !newLabel.trim()) return;
    onAdd(newEmoji, newLabel);
    setNewEmoji('');
    setNewLabel('');
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1500,
    }} onClick={onClose}>
      <div style={{
        width: '100%', maxWidth: '500px', maxHeight: '70vh', overflow: 'auto',
        backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
        padding: '1.5rem', paddingBottom: '2rem',
        animation: 'slideUp 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '0.25rem' }}>
            <X size={22} />
          </button>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>Tags verwalten</h3>
          <div style={{ width: 22 }} />
        </div>

        {/* Neuen Tag hinzufügen */}
        <div style={{ marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
            Neuen Tag erstellen
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input
              type="text"
              value={newEmoji}
              onChange={e => setNewEmoji(e.target.value)}
              placeholder="😊"
              maxLength={4}
              className="input-field"
              style={{ width: '60px', padding: '0.5rem', textAlign: 'center', fontSize: '1.2rem' }}
            />
            <input
              type="text"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="Name (z.B. Lesen)"
              maxLength={20}
              className="input-field"
              style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
            />
            <button
              onClick={handleAdd}
              disabled={!newEmoji.trim() || !newLabel.trim()}
              className="btn btn-primary"
              style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', opacity: (!newEmoji.trim() || !newLabel.trim()) ? 0.5 : 1, whiteSpace: 'nowrap' }}
            >
              Hinzufügen
            </button>
          </div>
        </div>

        {/* Bestehende Tags */}
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
            {tags.length} Tags
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {tags.map(tag => (
              <div key={tag.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-background)',
                borderRadius: 'var(--radius-md)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>{tag.emoji}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text)' }}>{tag.label}</span>
                </div>
                <button
                  onClick={() => onDelete(tag.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '0.2rem', opacity: 0.6 }}
                  title="Tag löschen"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

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

// --- Mood Check-In (Today) ---

const MoodCheckIn = ({ onSave, existingEntry, customTags }: { onSave: (mental: number, physical: number, tags: string[], comment: string) => void, existingEntry?: MoodEntry, customTags: TagOption[] }) => {
  const [mental, setMental] = useState<number>(existingEntry?.mentalMood || 0);
  const [physical, setPhysical] = useState<number>(existingEntry?.physicalMood || 0);
  const [selectedTags, setSelectedTags] = useState<string[]>(existingEntry?.tags || []);
  const [comment, setComment] = useState<string>(existingEntry?.comment || '');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (existingEntry) {
      setMental(existingEntry.mentalMood);
      setPhysical(existingEntry.physicalMood);
      setSelectedTags(existingEntry.tags || []);
      setComment(existingEntry.comment || '');
      setSaved(true);
    }
  }, [existingEntry]);

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    );
    setSaved(false);
  };

  const handleSave = () => {
    if (mental === 0 || physical === 0) return;
    onSave(mental, physical, selectedTags, comment);
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
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)' }}>Mental</span>
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
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)' }}>Körperlich</span>
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

      {/* Tags */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
          <Tag size={14} color="var(--color-text-muted)" />
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Kontext (optional)</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          {customTags.map(tag => {
            const isActive = selectedTags.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                  padding: '0.3rem 0.55rem',
                  borderRadius: 'var(--radius-full)',
                  border: isActive ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                  background: isActive ? 'var(--color-primary-light)' : 'transparent',
                  fontSize: '0.7rem',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  opacity: isActive ? 1 : 0.7,
                }}
              >
                <span style={{ fontSize: '0.85rem' }}>{tag.emoji}</span>
                {tag.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Comment */}
      <div style={{ marginBottom: '1rem' }}>
        <textarea
          value={comment}
          onChange={e => { setComment(e.target.value); setSaved(false); }}
          placeholder="Kommentar (optional) — wird nur beim langen Drücken im Kalender angezeigt..."
          className="input-field"
          maxLength={500}
          rows={2}
          style={{
            width: '100%',
            padding: '0.6rem 0.75rem',
            fontSize: '0.8rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-background)',
            color: 'var(--color-text)',
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />
        {comment.length > 0 && (
          <div style={{ textAlign: 'right', fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
            {comment.length}/500
          </div>
        )}
      </div>

      {/* Save Button + Average Preview */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginTop: '0.5rem' }}>
        {avg !== null && !saved && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            <span>Gesamt:</span>
            <span style={{ fontSize: '1.2rem' }}>{MOOD_LEVELS[Math.round(avg) - 1]?.emoji}</span>
            <span style={{ fontWeight: 600, color: getMoodColor(avg) }}>
              ({mental}×2 + {physical}×1)/3 = {avg.toFixed(1)}
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

const EditDialog = ({ date, existingEntry, onSave, onClose, customTags }: {
  date: string;
  existingEntry: MoodEntry | null;
  onSave: (mental: number, physical: number, tags: string[], comment: string) => void;
  onClose: () => void;
  customTags: TagOption[];
}) => {
  const [mental, setMental] = useState<number>(existingEntry?.mentalMood || 0);
  const [physical, setPhysical] = useState<number>(existingEntry?.physicalMood || 0);
  const [selectedTags, setSelectedTags] = useState<string[]>(existingEntry?.tags || []);
  const [comment, setComment] = useState<string>(existingEntry?.comment || '');

  const dateObj = new Date(date + 'T00:00:00');
  const formattedDate = dateObj.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    );
  };

  const handleSave = () => {
    if (mental === 0 || physical === 0) return;
    onSave(mental, physical, selectedTags, comment);
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
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>Mental</span>
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
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>Körperlich</span>
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

        {/* Tags */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <Tag size={14} color="var(--color-text-muted)" />
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Kontext</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {customTags.map(tag => {
              const isActive = selectedTags.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    padding: '0.3rem 0.55rem',
                    borderRadius: 'var(--radius-full)',
                    border: isActive ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                    background: isActive ? 'var(--color-primary-light)' : 'transparent',
                    fontSize: '0.7rem',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    opacity: isActive ? 1 : 0.7,
                  }}
                >
                  <span style={{ fontSize: '0.85rem' }}>{tag.emoji}</span>
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Comment */}
        <div style={{ marginBottom: '1rem' }}>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Kommentar..."
            maxLength={500}
            rows={3}
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              fontSize: '0.8rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-background)',
              color: 'var(--color-text)',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
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

const MoodCalendar = ({ entries, onEditDay, customTags }: { entries: MoodEntry[], onEditDay: (dateStr: string) => void, customTags: TagOption[] }) => {
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
          const isFuture = dateStr > todayStr;

          return (
            <CalendarDay
              key={day}
              day={day}
              color={color}
              hasEntry={hasEntry}
              isToday={isToday}
              isFuture={isFuture}
              entry={entry}
              onEdit={() => onEditDay(dateStr)}
              customTags={customTags}
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
        <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginLeft: '0.5rem' }}>Tipp: Vergangene Tage lang drücken zum Bearbeiten</span>
      </div>
    </div>
  );
};

// --- Calendar Day (with long-press support) ---

const CalendarDay = ({ day, color, hasEntry, isToday, isFuture, entry, onEdit, customTags }: {
  day: number;
  color: string;
  hasEntry: boolean;
  isToday: boolean;
  isFuture: boolean;
  entry: MoodEntry | null;
  onEdit: () => void;
  customTags: TagOption[];
}) => {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPressed, setIsPressed] = useState(false);

  const startPress = () => {
    if (isFuture) return; // Future days cannot be edited
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
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: '12%',
        fontSize: '0.75rem',
        fontWeight: hasEntry ? 700 : 500,
        color: hasEntry ? 'white' : 'var(--color-text-muted)',
        border: isToday ? '2px solid var(--color-primary)' : hasEntry ? 'none' : '1px solid var(--color-border)',
        opacity: hasEntry ? 0.9 : 0.6,
        cursor: isFuture ? 'default' : 'pointer',
        transition: 'transform 0.1s, box-shadow 0.1s',
        transform: isPressed ? 'scale(0.92)' : 'scale(1)',
        boxShadow: isPressed ? 'inset 0 0 0 2px var(--color-primary)' : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <span style={{ position: 'relative', zIndex: 1, lineHeight: 1 }}>
        {day}
      </span>

      {hasEntry && entry && (
        <>
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '30%',
            display: 'flex',
          }}>
            <div style={{
              flex: 1,
              backgroundColor: MOOD_LEVELS.find(m => m.value === entry.mentalMood)?.color || '#888',
              opacity: 0.85,
            }} />
            <div style={{
              flex: 1,
              backgroundColor: MOOD_LEVELS.find(m => m.value === entry.physicalMood)?.color || '#888',
              opacity: 0.85,
            }} />
          </div>

          {entry.tags && entry.tags.length > 0 && (
            <div style={{
              position: 'absolute',
              bottom: '31%',
              display: 'flex',
              gap: '1px',
              zIndex: 2,
            }}>
              {entry.tags.slice(0, 3).map(tagId => {
                const tag = customTags.find(t => t.id === tagId);
                return tag ? <span key={tagId} style={{ fontSize: '0.4rem', lineHeight: 1, textShadow: '0 0 2px rgba(0,0,0,0.5)' }}>{tag.emoji}</span> : null;
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// --- List View (alternative to calendar, shows comments) ---

const MoodListView = ({ entries, onEditDay, customTags, days }: { entries: MoodEntry[], onEditDay: (dateStr: string) => void, customTags: TagOption[], days: number }) => {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Filter to last N days, then sort by date descending
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  const filteredEntries = entries.filter(e => new Date(e.date + 'T00:00:00') >= cutoff);
  const sortedEntries = [...filteredEntries].sort((a, b) => b.date.localeCompare(a.date));

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
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
          <List size={18} color="var(--color-primary)" />
          Einträge ({days} Tage)
        </h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          {sortedEntries.length} / {days} {days === 1 ? 'Tag' : 'Tage'}
        </span>
      </div>

      {sortedEntries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
          Noch keine Einträge.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {sortedEntries.map(entry => {
            const avg = getWeightedAverage(entry.mentalMood, entry.physicalMood);
            const moodColor = getMoodColor(avg);
            const isToday = entry.date === todayStr;

            return (
              <div
                key={entry.date}
                onClick={() => onEditDay(entry.date)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-background)',
                  borderRadius: 'var(--radius-md)',
                  borderLeft: `4px solid ${moodColor}`,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-surface)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--color-background)'}
              >
                {/* Mood indicator */}
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: moodColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.3rem',
                  flexShrink: 0,
                }}>
                  {MOOD_LEVELS[Math.round(avg) - 1]?.emoji}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      {formatDate(entry.date)}
                    </span>
                    {isToday && (
                      <span style={{
                        fontSize: '0.6rem',
                        fontWeight: 600,
                        padding: '0.1rem 0.4rem',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: 'var(--color-primary)',
                        color: 'white',
                      }}>
                        heute
                      </span>
                    )}
                    <span style={{ fontSize: '0.75rem', color: moodColor, fontWeight: 600, marginLeft: 'auto' }}>
                      {avg.toFixed(1)}
                    </span>
                  </div>

                  {/* Mental + Physical bars */}
                  <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.25rem' }}>
                    <div style={{ flex: 2, fontSize: '0.65rem', color: 'var(--color-primary)' }}>
                      🧠 Mental: {MOOD_LEVELS.find(m => m.value === entry.mentalMood)?.emoji}
                    </div>
                    <div style={{ flex: 1, fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
                      💪 {MOOD_LEVELS.find(m => m.value === entry.physicalMood)?.emoji}
                    </div>
                  </div>

                  {/* Tags */}
                  {entry.tags && entry.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.15rem' }}>
                      {entry.tags.map(tagId => {
                        const tag = customTags.find(t => t.id === tagId);
                        return tag ? (
                          <span key={tagId} style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)' }}>
                            {tag.emoji} {tag.label}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}

                  {/* Comment */}
                  {entry.comment && (
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'var(--color-text-muted)',
                      fontStyle: 'italic',
                      lineHeight: 1.4,
                      marginTop: '0.25rem',
                      padding: '0.4rem 0.5rem',
                      backgroundColor: 'var(--color-surface)',
                      borderRadius: 'var(--radius-sm)',
                      borderLeft: '3px solid var(--color-border)',
                    }}>
                      💬 {entry.comment}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// --- Analysis (weekday averages, trend, insights) ---

const MoodAnalysis = ({ entries, days }: { entries: MoodEntry[], days: number }) => {
  const analysis = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);

    const filtered = entries.filter(e => {
      const d = new Date(e.date + 'T00:00:00');
      return d >= cutoff;
    });

    if (filtered.length < 3) return null;

    const avgs = filtered.map(e => getWeightedAverage(e.mentalMood, e.physicalMood));
    const totalAvg = avgs.reduce((a, b) => a + b, 0) / avgs.length;

    // Weekday averages
    const weekdayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const weekdayData: { day: string; avg: number; count: number }[] = weekdayNames.map(day => ({ day, avg: 0, count: 0 }));
    filtered.forEach(e => {
      const d = new Date(e.date + 'T00:00:00');
      const wd = d.getDay();
      const avg = getWeightedAverage(e.mentalMood, e.physicalMood);
      weekdayData[wd].avg += avg;
      weekdayData[wd].count++;
    });
    const weekdayAvgs = weekdayData.map(w => ({
      day: w.day,
      avg: w.count > 0 ? w.avg / w.count : 0,
      count: w.count,
    }));

    // Trend direction (compare first half vs second half)
    const mid = Math.floor(filtered.length / 2);
    const firstHalf = avgs.slice(0, mid);
    const secondHalf = avgs.slice(mid);
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const diff = secondAvg - firstAvg;
    let trend: { label: string; icon: string; color: string };
    if (diff > 0.3) trend = { label: 'Aufwärtstrend', icon: '↗️', color: 'var(--color-success)' };
    else if (diff < -0.3) trend = { label: 'Abwärtstrend', icon: '↘️', color: 'var(--color-danger)' };
    else trend = { label: 'Stabil', icon: '➡️', color: 'var(--color-warning, #eab308)' };

    // Best & worst day
    let bestDay = filtered[0], worstDay = filtered[0];
    let bestAvg = getWeightedAverage(bestDay.mentalMood, bestDay.physicalMood);
    let worstAvg = bestAvg;
    filtered.forEach(e => {
      const a = getWeightedAverage(e.mentalMood, e.physicalMood);
      if (a > bestAvg) { bestAvg = a; bestDay = e; }
      if (a < worstAvg) { worstAvg = a; worstDay = e; }
    });

    // Entry streak
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      if (filtered.find(e => e.date === ds)) streak++;
      else break;
    }

    return { totalAvg, weekdayAvgs, trend, bestDay, bestAvg, worstDay, worstAvg, streak, count: filtered.length };
  }, [entries, days]);

  // Count entries in the time range for the fallback message
  const entryCountInRange = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);
    return entries.filter(e => new Date(e.date + 'T00:00:00') >= cutoff).length;
  }, [entries, days]);

  if (!analysis) {
    return (
      <div className="glass-panel" style={{
        padding: '1.25rem',
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-border)'
      }}>
        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={18} color="var(--color-primary)" />
          Analyse ({days} Tage)
        </h3>
        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
          {entryCountInRange === 0
            ? `Keine Einträge in den letzten ${days} Tagen.`
            : `Nur ${entryCountInRange} ${entryCountInRange === 1 ? 'Eintrag' : 'Einträge'} — mindestens 3 für eine Analyse nötig.`}
        </div>
      </div>
    );
  }

  const formatDate = (ds: string) => {
    const d = new Date(ds + 'T00:00:00');
    return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <div className="glass-panel" style={{
      padding: '1.25rem',
      backgroundColor: 'var(--color-surface)',
      borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--color-border)'
    }}>
      <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Activity size={18} color="var(--color-primary)" />
        Analyse ({days} Tage)
      </h3>

      {/* Trend + Stats Row */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{
          flex: '1 1 120px',
          padding: '0.75rem',
          backgroundColor: 'var(--color-background)',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{analysis.trend.icon}</div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: analysis.trend.color }}>{analysis.trend.label}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>Trend</div>
        </div>
        <div style={{
          flex: '1 1 120px',
          padding: '0.75rem',
          backgroundColor: 'var(--color-background)',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>
            {MOOD_LEVELS[Math.round(analysis.totalAvg) - 1]?.emoji}
          </div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: getMoodColor(analysis.totalAvg) }}>
            ⌀ {analysis.totalAvg.toFixed(1)}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>Durchschnitt</div>
        </div>
        <div style={{
          flex: '1 1 120px',
          padding: '0.75rem',
          backgroundColor: 'var(--color-background)',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🔥</div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)' }}>
            {analysis.streak} {analysis.streak === 1 ? 'Tag' : 'Tage'}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>Serie</div>
        </div>
      </div>

      {/* Best & Worst */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{
          flex: 1,
          padding: '0.6rem 0.75rem',
          backgroundColor: 'rgba(34, 197, 94, 0.06)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(34, 197, 94, 0.15)',
        }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginBottom: '0.15rem' }}>Bester Tag</div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: getMoodColor(analysis.bestAvg) }}>
            {formatDate(analysis.bestDay.date)} — {MOOD_LEVELS[Math.round(analysis.bestAvg) - 1]?.emoji} {analysis.bestAvg.toFixed(1)}
          </div>
        </div>
        <div style={{
          flex: 1,
          padding: '0.6rem 0.75rem',
          backgroundColor: 'rgba(239, 68, 68, 0.06)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(239, 68, 68, 0.15)',
        }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginBottom: '0.15rem' }}>Schlechtester Tag</div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: getMoodColor(analysis.worstAvg) }}>
            {formatDate(analysis.worstDay.date)} — {MOOD_LEVELS[Math.round(analysis.worstAvg) - 1]?.emoji} {analysis.worstAvg.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Weekday Averages */}
      <div>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
          Durchschnitt nach Wochentag
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '60px' }}>
          {analysis.weekdayAvgs.map(w => (
            <div key={w.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <div style={{
                width: '100%',
                height: w.avg > 0 ? `${(w.avg / 5) * 50}px` : '2px',
                backgroundColor: w.avg > 0 ? getMoodColor(w.avg) : 'var(--color-border)',
                borderRadius: '3px 3px 0 0',
                minHeight: '2px',
                transition: 'height 0.3s',
              }} />
              <span style={{ fontSize: '0.55rem', color: 'var(--color-text-muted)' }}>{w.day}</span>
            </div>
          ))}
        </div>
      </div>
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
        <div style={{ height: `${height}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem', gap: '0.25rem' }}>
          <span>Nicht genug Daten für einen Trend.</span>
          <span style={{ fontSize: '0.7rem' }}>{points.length} {points.length === 1 ? 'Eintrag' : 'Einträge'} in {days} Tagen — mindestens 2 nötig.</span>
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
