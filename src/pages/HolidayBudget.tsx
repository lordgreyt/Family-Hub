import { useState, useEffect, useId, useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';
import type { HolidayBudgetData, HolidayBudgetEntry } from '../services/mockDb';
import { Plus, X, RotateCcw, Plane, Settings, Save, ChevronDown, TrendingUp, TrendingDown, Trash2, Wallet } from 'lucide-react';

// ─── Datums-Helfer ───
function toDate(s: string): Date {
  return new Date(s + 'T00:00');
}
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function fmtDateShort(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}`;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
const DAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function fmtEUR(n: number): string {
  // Geschütztes Leerzeichen (U+00A0) zwischen Zahl und € → kein Umbruch möglich
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
function fmtEURShort(n: number): string {
  return Math.round(n).toLocaleString('de-DE') + ' €';
}

const HERO_GRADIENT = 'linear-gradient(135deg, #3F34C4 0%, #6D5DF0 55%, #F2A9BE 130%)';
const GREEN = '#4FC3A1';
const ORANGE = '#F5A06B';
const PINK = '#F27A9B';
const PRIMARY = '#6D5DF0';

// Ampelfarbe: grün = im Ziel, orange = bis 25 % drüber, pink = deutlich drüber
function ampelColor(spent: number, goal: number): string {
  if (goal <= 0 || spent <= goal) return GREEN;
  if (spent <= goal * 1.25) return ORANGE;
  return PINK;
}

const EMPTY: HolidayBudgetData = { settings: { startDate: '', days: 0, dailyGoal: 0 }, entries: [] };

const iconChip = (color: string, size = 38): CSSProperties => ({
  width: `${size}px`,
  height: `${size}px`,
  borderRadius: '50%',
  background: color + '26',
  color,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
});

const fieldLabel: CSSProperties = {
  margin: '0 0 0.35rem 0.2rem',
  fontSize: '11px',
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
  display: 'block',
};

const sectionLabel: CSSProperties = {
  margin: 0,
  fontSize: '11px',
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
};

// ─── Bottom Sheet ───
interface SheetProps {
  title: string;
  icon: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

const Sheet = ({ title, icon, onClose, children }: SheetProps) => createPortal(
  <div
    onClick={onClose}
    style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(23,20,58,0.5)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 2000,
    }}
  >
    <div
      onClick={event => event.stopPropagation()}
      style={{
        width: '100%', maxWidth: '500px', maxHeight: '92vh', overflowY: 'auto',
        padding: '0.75rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom))',
        borderRadius: '28px 28px 0 0', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)',
        boxShadow: '0 -12px 40px rgba(63,52,196,0.25)', display: 'flex', flexDirection: 'column', gap: '1rem',
        animation: 'holidaySheetUp 0.28s ease',
      }}
    >
      <div style={{ width: '44px', height: '5px', borderRadius: '999px', background: 'var(--color-border)', alignSelf: 'center', flexShrink: 0 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <span style={iconChip(PRIMARY)}>{icon}</span>
        <h3 style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 'var(--font-lg)', fontWeight: 800 }}>{title}</h3>
        <button
          onClick={onClose}
          aria-label="Schließen"
          style={{
            width: '36px', height: '36px', borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
            background: 'var(--color-surface-muted)', color: 'var(--color-text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </div>
    <style>{`@keyframes holidaySheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
  </div>,
  document.body,
);

// ─── Einstellungen ───
interface SettingsForm {
  startDate: string;
  days: string;
  dailyGoal: string;
}

interface SettingsSheetProps {
  settings: HolidayBudgetData['settings'];
  onSave: (s: HolidayBudgetData['settings']) => void;
  onReset: () => void;
  onClose: () => void;
}

const SettingsSheet = ({ settings, onSave, onReset, onClose }: SettingsSheetProps) => {
  const configured = Boolean(settings.startDate && settings.days > 0 && settings.dailyGoal > 0);
  const [form, setForm] = useState<SettingsForm>({
    startDate: settings.startDate || formatDate(new Date()),
    days: settings.days ? String(settings.days) : '7',
    dailyGoal: settings.dailyGoal ? String(settings.dailyGoal) : '100',
  });

  const days = Math.max(1, parseInt(form.days) || 0);
  const goal = Math.max(0, parseFloat(form.dailyGoal.replace(',', '.')) || 0);
  const valid = Boolean(form.startDate) && days > 0 && goal > 0;

  const submit = () => {
    if (!valid) return;
    onSave({ startDate: form.startDate, days, dailyGoal: goal });
    onClose();
  };

  return (
    <Sheet title="Urlaub einstellen" icon={<Settings size={19} />} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={fieldLabel}>Startdatum</label>
          <input type="date" className="input-field" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
        </div>
        <div>
          <label style={fieldLabel}>Tage</label>
          <input type="number" min={1} inputMode="numeric" className="input-field" value={form.days} onChange={e => setForm(f => ({ ...f, days: e.target.value }))} />
        </div>
        <div>
          <label style={fieldLabel}>Ziel pro Tag (€)</label>
          <input type="number" min={0} step={5} inputMode="decimal" className="input-field" value={form.dailyGoal} onChange={e => setForm(f => ({ ...f, dailyGoal: e.target.value }))} />
        </div>
      </div>

      <div style={{ padding: '0.85rem 1rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div>
          <p style={sectionLabel}>Gesamtbudget</p>
          <p style={{ margin: '0.1rem 0 0 0', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
            {valid ? `${days} Tage · bis ${fmtDateShort(addDays(toDate(form.startDate), days - 1))}` : 'Bitte alle Felder ausfüllen'}
          </p>
        </div>
        <strong style={{ fontSize: 'var(--font-xl)', fontWeight: 800, color: 'var(--color-primary)' }}>
          {valid ? fmtEUR(days * goal) : '—'}
        </strong>
      </div>

      <button
        onClick={submit}
        className="btn btn-primary"
        disabled={!valid}
        style={{ width: '100%', padding: '0.8rem', opacity: valid ? 1 : 0.5 }}
      >
        <Save size={17} /> Speichern
      </button>

      {configured && (
        <button
          onClick={() => { onReset(); onClose(); }}
          style={{
            alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            background: 'none', border: 'none', cursor: 'pointer', color: PINK, fontWeight: 700,
            fontSize: 'var(--font-sm)', fontFamily: 'inherit', padding: '0.25rem 0.5rem',
          }}
        >
          <RotateCcw size={15} /> Alles zurücksetzen
        </button>
      )}
    </Sheet>
  );
};

// ─── Eintrag ───
interface EntrySheetProps {
  initialDate: string;
  editing: HolidayBudgetEntry | null;
  onSave: (date: string, amount: number, note: string, keepOpen: boolean) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const EntrySheet = ({ initialDate, editing, onSave, onDelete, onClose }: EntrySheetProps) => {
  const [date, setDate] = useState(editing?.date || initialDate);
  const [amount, setAmount] = useState(editing ? String(editing.amount).replace('.', ',') : '');
  const [note, setNote] = useState(editing?.note || '');
  const amt = parseFloat(amount.replace(',', '.')) || 0;
  const valid = Boolean(date) && amt > 0;

  return (
    <Sheet title={editing ? 'Ausgabe bearbeiten' : 'Ausgabe eintragen'} icon={<Wallet size={19} />} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div>
          <label style={fieldLabel}>Betrag (€)</label>
          <input
            type="text" inputMode="decimal" className="input-field" placeholder="z.B. 45,50"
            value={amount} onChange={e => setAmount(e.target.value)}
            style={{ fontSize: 'var(--font-xl)', fontWeight: 800, padding: '0.7rem 1rem' }} autoFocus
          />
        </div>
        <div>
          <label style={fieldLabel}>Notiz (optional)</label>
          <input type="text" className="input-field" placeholder="z.B. Tanken" value={note} onChange={e => setNote(e.target.value)} />
        </div>
        <div>
          <label style={fieldLabel}>Datum</label>
          <input type="date" className="input-field" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.6rem' }}>
        <button
          type="button" onClick={() => onSave(date, amt, note.trim(), false)}
          className="btn btn-primary" disabled={!valid}
          style={{ flex: 1, padding: '0.8rem', opacity: valid ? 1 : 0.5 }}
        >
          <Save size={17} /> Speichern
        </button>
        {!editing && (
          <button
            type="button" onClick={() => onSave(date, amt, note.trim(), true)}
            className="btn btn-secondary" disabled={!valid}
            style={{ padding: '0.8rem 1.1rem', opacity: valid ? 1 : 0.5 }}
          >
            <Plus size={16} /> Weiter
          </button>
        )}
      </div>

      {editing && (
        <button
          onClick={() => { onDelete(editing.id); onClose(); }}
          style={{
            alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            background: 'none', border: 'none', cursor: 'pointer', color: PINK, fontWeight: 700,
            fontSize: 'var(--font-sm)', fontFamily: 'inherit', padding: '0.25rem 0.5rem',
          }}
        >
          <Trash2 size={15} /> Ausgabe löschen
        </button>
      )}
    </Sheet>
  );
};

// ─── Soll-Ist-Verlauf ───
interface CumulativeChartProps {
  days: Date[];
  dailyGoal: number;
  totalBudget: number;
  entriesByDate: Record<string, HolidayBudgetEntry[]>;
  elapsed: number;
}

const CumulativeChart = ({ days, dailyGoal, totalBudget, entriesByDate, elapsed }: CumulativeChartProps) => {
  const gradientId = useId();

  const sollPoints = days.map((_, i) => dailyGoal * (i + 1));
  let running = 0;
  const istPoints = days.map(day => {
    running += (entriesByDate[formatDate(day)] || []).reduce((s, e) => s + e.amount, 0);
    return running;
  });

  // Ist-Linie nur bis heute bzw. bis zum letzten Tag mit Eintrag
  let lastIdx = elapsed - 1;
  days.forEach((day, i) => {
    if ((entriesByDate[formatDate(day)] || []).length > 0) lastIdx = Math.max(lastIdx, i);
  });

  const width = 340;
  const height = 170;
  const padL = 44;
  const padR = 12;
  const padT = 14;
  const padB = 24;
  const maxY = Math.max(totalBudget, ...istPoints) * 1.06 || 1;
  const x = (i: number) => padL + (days.length <= 1 ? 0 : (i / (days.length - 1)) * (width - padL - padR));
  const y = (v: number) => padT + (1 - v / maxY) * (height - padT - padB);

  const sollPath = sollPoints.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const istSlice = lastIdx >= 0 ? istPoints.slice(0, lastIdx + 1) : [];
  const istPath = istSlice.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const areaPath = istSlice.length > 0
    ? `${istPath} L${x(istSlice.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`
    : '';

  const lastIst = istSlice.length > 0 ? istSlice[istSlice.length - 1] : 0;
  const lastSoll = lastIdx >= 0 ? sollPoints[lastIdx] : 0;
  const diff = lastIst - lastSoll;
  const over = diff > 0;
  const ticks = [0, totalBudget / 2, totalBudget];
  const xLabelIdx = days.length > 2 ? [0, Math.floor((days.length - 1) / 2), days.length - 1] : days.map((_, i) => i);

  return (
    <div className="glass-panel" style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <p style={sectionLabel}>Soll vs. Ist</p>
        {lastIdx >= 0 && (
          <span style={{
            padding: '0.2rem 0.65rem', borderRadius: '999px', fontWeight: 800, fontSize: 'var(--font-xs)', whiteSpace: 'nowrap',
            background: (over ? PINK : GREEN) + '26', color: over ? '#D4416E' : '#1E9A78',
          }}>
            {Math.abs(diff) < 0.5 ? 'genau im Plan' : over ? `${fmtEURShort(diff)} über Plan` : `${fmtEURShort(-diff)} unter Plan`}
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Kumulierte Ausgaben gegen Plan" style={{ width: '100%', display: 'block' }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PRIMARY} stopOpacity="0.32" />
            <stop offset="100%" stopColor={PRIMARY} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map(tick => (
          <g key={tick}>
            <line x1={padL} x2={width - padR} y1={y(tick)} y2={y(tick)} stroke="var(--color-border)" strokeWidth="1" strokeDasharray={tick === 0 ? undefined : '3 4'} />
            <text x={padL - 6} y={y(tick) + 3.5} textAnchor="end" fontSize="10" fontWeight="700" fill="var(--color-text-tertiary)">
              {Math.round(tick).toLocaleString('de-DE')}
            </text>
          </g>
        ))}
        {xLabelIdx.map(i => (
          <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === days.length - 1 ? 'end' : 'middle'} fontSize="10" fontWeight="700" fill="var(--color-text-tertiary)">
            {DAY_NAMES[days[i].getDay()]} {days[i].getDate()}.
          </text>
        ))}
        <path d={sollPath} fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" />
        {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
        {istPath && <path d={istPath} fill="none" stroke={PRIMARY} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
        {istSlice.length > 0 && (
          <circle cx={x(istSlice.length - 1)} cy={y(lastIst)} r="5" fill={over ? PINK : PRIMARY} stroke="var(--color-surface)" strokeWidth="2.5" />
        )}
      </svg>

      <div style={{ display: 'flex', gap: '1rem', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: '16px', height: 0, borderTop: '2px dashed var(--color-text-tertiary)', display: 'inline-block' }} /> Plan
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: '16px', height: '3px', borderRadius: '2px', backgroundColor: PRIMARY, display: 'inline-block' }} /> Tatsächlich
        </span>
      </div>
    </div>
  );
};

// ─── Hauptseite ───
export const HolidayBudget = () => {
  const { user } = useAuth();
  const [data, setData] = useState<HolidayBudgetData>(EMPTY);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [showEntrySheet, setShowEntrySheet] = useState(false);
  const [editingEntry, setEditingEntry] = useState<HolidayBudgetEntry | null>(null);
  const [entryDate, setEntryDate] = useState(formatDate(new Date()));

  const [showAllDays, setShowAllDays] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!user || user.isChild) return;
    const load = () => {
      setData(mockDb.getHolidayBudget());
      setDataLoaded(true);
    };
    load();
    window.addEventListener('db_updated', load);
    return () => window.removeEventListener('db_updated', load);
  }, [user]);

  // Hooks müssen VOR jedem bedingten Return stehen (React-Hooks-Regel)
  const daysList = useMemo(() => {
    const s = data.settings;
    if (!s.startDate || s.days <= 0 || s.dailyGoal <= 0) return [];
    const list: Date[] = [];
    for (let i = 0; i < s.days; i++) list.push(addDays(toDate(s.startDate), i));
    return list;
  }, [data.settings.startDate, data.settings.days, data.settings.dailyGoal]);

  const entriesByDate = useMemo(() => {
    const map: Record<string, HolidayBudgetEntry[]> = {};
    data.entries.forEach(e => {
      (map[e.date] = map[e.date] || []).push(e);
    });
    return map;
  }, [data.entries]);

  // Standardansicht: nur „heute" (bzw. erster Tag, falls noch nicht im Urlaub) + letzter Tag;
  // „Alle Tage" nur wenn ausgeklappt
  const displayedDays = useMemo(() => {
    if (showAllDays) return daysList;
    if (daysList.length === 0) return [];
    const last = daysList[daysList.length - 1];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const todayStr = formatDate(now);
    const todayIdx = daysList.findIndex(d => formatDate(d) === todayStr);
    if (todayIdx >= 0) {
      return todayIdx === daysList.length - 1 ? [daysList[todayIdx]] : [daysList[todayIdx], last];
    }
    return daysList.length > 1 ? [daysList[0], last] : [daysList[0]];
  }, [showAllDays, daysList]);

  if (!user || user.isChild || !dataLoaded) return null;

  const { settings, entries } = data;

  // ── Berechnungen ──
  const totalBudget = settings.days * settings.dailyGoal;
  const spent = entries.reduce((sum, e) => sum + e.amount, 0);
  const remaining = totalBudget - spent;
  const configured = Boolean(settings.startDate && settings.days > 0 && settings.dailyGoal > 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Verbrauchte Tage (bis heute, begrenzt auf Urlaubslänge) für die Prognose
  const start = configured ? toDate(settings.startDate) : today;
  const elapsed = configured ? Math.min(settings.days, Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86400000) + 1)) : 0;
  const restDays = Math.max(0, settings.days - elapsed);
  const projection = spent + restDays * settings.dailyGoal;
  const projectionDiff = totalBudget - projection;

  const budgetPct = totalBudget > 0 ? (spent / totalBudget) * 100 : 0;
  const barPct = Math.min(100, budgetPct);
  const overBudget = remaining < 0;
  const projectionGood = projectionDiff >= 0;

  // Standard-Tag für „Ausgabe eintragen": heute, falls im Urlaub, sonst erster Tag
  const quickDate = daysList.find(d => sameDay(d, today)) ?? daysList[0];

  // ── Mutationen ──
  const persist = (next: HolidayBudgetData) => mockDb.saveHolidayBudget(next);

  const saveSettings = (s: HolidayBudgetData['settings']) => {
    persist({ ...data, settings: s });
  };

  const saveEntry = (date: string, amount: number, note: string, keepOpen: boolean) => {
    if (editingEntry) {
      persist({
        ...data,
        entries: data.entries.map(e => e.id === editingEntry.id ? { ...e, date, amount, note: note || undefined } : e),
      });
      setShowEntrySheet(false);
      setEditingEntry(null);
    } else {
      const newEntry: HolidayBudgetEntry = {
        id: crypto.randomUUID(),
        date,
        amount,
        note: note || undefined,
        createdAt: Date.now(),
        createdBy: user.id,
      };
      persist({ ...data, entries: [...data.entries, newEntry] });
      if (keepOpen) {
        setEntryDate(date);
        setEditingEntry(null);
        // Sheet bleibt offen — Formular zurücksetzen über key im Sheet
      } else {
        setShowEntrySheet(false);
        setEditingEntry(null);
      }
    }
  };

  const deleteEntry = (id: string) => {
    persist({ ...data, entries: data.entries.filter(e => e.id !== id) });
  };

  const openAdd = (date: string) => {
    setEditingEntry(null);
    setEntryDate(date);
    setShowEntrySheet(true);
  };

  const openEdit = (e: HolidayBudgetEntry) => {
    setEditingEntry(e);
    setEntryDate(e.date);
    setShowEntrySheet(true);
  };

  const resetAll = () => {
    if (!confirm('Urlaubsbudget komplett zurücksetzen? Alle Einträge UND die Einstellungen (Datum, Tage, Tagesziel) werden gelöscht.')) return;
    persist({ settings: { startDate: '', days: 0, dailyGoal: 0 }, entries: [] });
  };

  const subtitle = configured
    ? `${settings.days} Tage · ${fmtDateShort(start)} – ${fmtDateShort(addDays(start, settings.days - 1))} · ${fmtEURShort(settings.dailyGoal)}/Tag`
    : 'Noch nicht eingerichtet';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Hero */}
      <div style={{
        background: HERO_GRADIENT,
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 12px 28px rgba(63,52,196,0.28)',
        padding: '1.3rem 1.25rem',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.9rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Plane size={20} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 'var(--font-lg)', fontWeight: 800, color: 'white' }}>Urlaubsbudget</h1>
            <p style={{ margin: '0.1rem 0 0 0', opacity: 0.85, fontSize: 'var(--font-xs)' }}>{subtitle}</p>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            title="Urlaub einstellen"
            aria-label="Urlaub einstellen"
            style={{
              width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.22)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <Settings size={19} />
          </button>
        </div>

        {configured && (
          <>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', opacity: 0.85 }}>
                {overBudget ? 'ÜBERZOGEN' : 'NOCH VERFÜGBAR'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '2.6rem', fontWeight: 800, lineHeight: 1.05, whiteSpace: 'nowrap' }}>
                  {fmtEUR(Math.abs(remaining))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.2rem' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.65rem', borderRadius: '999px',
                    background: 'rgba(255,255,255,0.92)', color: projectionGood ? '#1E9A78' : '#D4416E', fontWeight: 800,
                    fontSize: 'var(--font-xs)', whiteSpace: 'nowrap',
                  }}>
                    {projectionGood ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    {projectionGood ? `${fmtEURShort(projectionDiff)} übrig` : `${fmtEURShort(-projectionDiff)} drüber`}
                  </span>
                  <span style={{ fontSize: '10px', opacity: 0.85, fontWeight: 700 }}>Prognose</span>
                </div>
              </div>
            </div>

            <div>
              <div style={{ height: '10px', borderRadius: '999px', background: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${barPct}%`, borderRadius: '999px',
                  background: overBudget ? '#FFC2D2' : 'white', transition: 'width 0.3s ease',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginTop: '0.4rem', fontSize: 'var(--font-xs)', fontWeight: 700 }}>
                <span style={{ whiteSpace: 'nowrap' }}>{fmtEUR(spent)} von {fmtEURShort(totalBudget)}</span>
                <span style={{ opacity: 0.85, whiteSpace: 'nowrap' }}>{Math.round(budgetPct)} % verbraucht</span>
              </div>
            </div>
          </>
        )}
      </div>

      {!configured ? (
        <div className="glass-panel" style={{ padding: '2rem 1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <span style={iconChip(PRIMARY, 56)}><Plane size={26} /></span>
          <p style={{ margin: 0, fontSize: 'var(--font-base)', fontWeight: 800 }}>Noch kein Urlaubsbudget eingestellt</p>
          <p style={{ margin: 0, fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)', maxWidth: '320px' }}>
            Trage Startdatum, Anzahl Tage und dein Tagesziel ein — dann siehst du hier die Soll-Ist-Übersicht.
          </p>
          <button onClick={() => setShowSettings(true)} className="btn btn-primary" style={{ padding: '0.7rem 1.4rem' }}>
            <Settings size={17} /> Urlaub einstellen
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={() => openAdd(formatDate(quickDate ?? today))}
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.85rem' }}
          >
            <Plus size={18} /> Ausgabe eintragen
          </button>

          {/* Tagesliste (Standard: heute + letzter Tag, ausklappbar) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <p style={sectionLabel}>Tage</p>
              <button
                onClick={() => setShowAllDays(v => !v)}
                className="chip"
                style={{ fontFamily: 'inherit' }}
              >
                {showAllDays ? 'Weniger anzeigen' : `Alle ${daysList.length} Tage`}
                <ChevronDown size={14} style={{ transition: 'transform 0.2s', transform: showAllDays ? 'rotate(180deg)' : 'rotate(0deg)' }} />
              </button>
            </div>

            {displayedDays.map(day => {
              const dateStr = formatDate(day);
              const dayNumber = daysList.findIndex(d => formatDate(d) === dateStr) + 1;
              const dayEntries = entriesByDate[dateStr] || [];
              const daySpent = dayEntries.reduce((s, e) => s + e.amount, 0);
              const isToday = sameDay(day, today);
              const color = ampelColor(daySpent, settings.dailyGoal);
              const dayPct = settings.dailyGoal > 0 ? Math.min(100, (daySpent / settings.dailyGoal) * 100) : 0;
              const dayOver = daySpent > settings.dailyGoal;

              return (
                <div
                  key={dateStr}
                  className="glass-panel"
                  style={{
                    padding: '0.8rem',
                    display: 'flex', flexDirection: 'column', gap: '0.6rem',
                    border: isToday ? '2px solid var(--color-primary)' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                    <div style={{
                      width: '50px', height: '54px', borderRadius: '16px', flexShrink: 0,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.15,
                      background: isToday ? HERO_GRADIENT : 'var(--color-surface-muted)',
                      color: isToday ? 'white' : 'var(--color-text)',
                    }}>
                      <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.04em', opacity: isToday ? 0.9 : 0.6 }}>
                        {DAY_NAMES[day.getDay()].toUpperCase()}
                      </span>
                      <span style={{ fontSize: '1.15rem', fontWeight: 800 }}>{day.getDate()}.</span>
                    </div>

                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: 'var(--font-base)', fontWeight: 800, color: dayOver ? '#D4416E' : 'var(--color-text)', whiteSpace: 'nowrap' }}>
                          {fmtEUR(daySpent)}
                        </strong>
                        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                          von {fmtEURShort(settings.dailyGoal)} · Tag {dayNumber}
                        </span>
                      </div>
                      <div style={{ height: '8px', borderRadius: '999px', background: 'var(--color-surface-muted)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${dayPct}%`, borderRadius: '999px', background: color, transition: 'width 0.3s ease' }} />
                      </div>
                    </div>

                    <button
                      onClick={() => openAdd(dateStr)}
                      aria-label={`Ausgabe für ${DAY_NAMES[day.getDay()]} ${day.getDate()}. eintragen`}
                      style={{
                        width: '38px', height: '38px', borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
                        background: 'var(--color-surface-muted)', color: 'var(--color-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Plus size={20} />
                    </button>
                  </div>

                  {dayEntries.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {dayEntries.map(e => (
                        <button
                          key={e.id}
                          onClick={() => openEdit(e)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%', textAlign: 'left',
                            padding: '0.3rem 0.7rem', borderRadius: '12px', border: 'none', cursor: 'pointer',
                            background: 'var(--color-surface-hover)', color: 'var(--color-text)', fontFamily: 'inherit', fontSize: 'var(--font-sm)',
                            lineHeight: 1.3,
                          }}
                        >
                          <span style={{ flex: 1, minWidth: 0, color: e.note ? 'var(--color-text)' : 'var(--color-text-tertiary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {e.note || 'Ohne Notiz'}
                          </span>
                          <strong style={{ flexShrink: 0, whiteSpace: 'nowrap', fontWeight: 800 }}>{fmtEUR(e.amount)}</strong>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <CumulativeChart
            days={daysList}
            dailyGoal={settings.dailyGoal}
            totalBudget={totalBudget}
            entriesByDate={entriesByDate}
            elapsed={elapsed}
          />
        </>
      )}

      {showSettings && (
        <SettingsSheet settings={settings} onSave={saveSettings} onReset={resetAll} onClose={() => setShowSettings(false)} />
      )}
      {showEntrySheet && (
        <EntrySheet
          key={editingEntry ? editingEntry.id : `new-${entryDate}-${entries.length}`}
          initialDate={entryDate}
          editing={editingEntry}
          onSave={saveEntry}
          onDelete={deleteEntry}
          onClose={() => { setShowEntrySheet(false); setEditingEntry(null); }}
        />
      )}
    </div>
  );
};
