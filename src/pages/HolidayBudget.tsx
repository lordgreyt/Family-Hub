import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { mockDb } from '../services/mockDb';
import type { HolidayBudgetData, HolidayBudgetEntry } from '../services/mockDb';
import { getNeonCardStyle } from '../utils/neon';
import { Plus, X, RotateCcw, Euro, Settings2, Save, Pencil, CalendarDays } from 'lucide-react';

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
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
const DAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DAY_NAMES_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function fmtEUR(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// Ampelfarbe: grün = im Ziel, gelb = bis 25 % drüber, rot = deutlich drüber
function ampel(spent: number, goal: number): 'green' | 'yellow' | 'red' {
  if (goal <= 0 || spent <= goal) return 'green';
  if (spent <= goal * 1.25) return 'yellow';
  return 'red';
}

const EMPTY: HolidayBudgetData = { settings: { startDate: '', days: 0, dailyGoal: 0 }, entries: [] };

// ─── Einstellungs-Formular ───
interface SettingsForm {
  startDate: string;
  days: string;
  dailyGoal: string;
}

const SettingsPanel = ({ settings, onSave }: { settings: HolidayBudgetData['settings']; onSave: (s: HolidayBudgetData['settings']) => void }) => {
  const [editing, setEditing] = useState(!settings.startDate || !settings.days || !settings.dailyGoal);
  const [form, setForm] = useState<SettingsForm>({
    startDate: settings.startDate || formatDate(new Date()),
    days: settings.days ? String(settings.days) : '7',
    dailyGoal: settings.dailyGoal ? String(settings.dailyGoal) : '100',
  });

  const days = Math.max(1, parseInt(form.days) || 0);
  const goal = Math.max(0, parseFloat(form.dailyGoal.replace(',', '.')) || 0);
  const total = days * goal;
  const valid = form.startDate && days > 0 && goal > 0;

  const submit = () => {
    if (!valid) return;
    onSave({ startDate: form.startDate, days, dailyGoal: goal });
    setEditing(false);
  };

  if (!editing) {
    const endDate = addDays(toDate(settings.startDate), settings.days - 1);
    return (
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <CalendarDays size={18} /> {formatDate(toDate(settings.startDate))} – {formatDate(endDate)}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              {settings.days} Tage · {fmtEUR(settings.dailyGoal)}/Tag
            </span>
          </div>
          <button onClick={() => setEditing(true)} className="btn btn-secondary" style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Pencil size={14} /> Einstellungen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: '1.25rem' }}>
      <h3 style={{ margin: 0, marginBottom: '1rem', fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)' }}>
        <Settings2 size={18} style={{ verticalAlign: '-3px', marginRight: '0.3rem' }} /> Urlaub einstellen
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem', display: 'block' }}>Startdatum</label>
          <input type="date" className="input-field" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} style={{ width: '100%', fontSize: 'var(--font-sm)' }} />
        </div>
        <div>
          <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem', display: 'block' }}>Tage</label>
          <input type="number" min={1} className="input-field" value={form.days} onChange={e => setForm(f => ({ ...f, days: e.target.value }))} style={{ width: '100%', fontSize: 'var(--font-sm)' }} />
        </div>
        <div>
          <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem', display: 'block' }}>Ziel pro Tag (€)</label>
          <input type="number" min={0} step={5} className="input-field" value={form.dailyGoal} onChange={e => setForm(f => ({ ...f, dailyGoal: e.target.value }))} style={{ width: '100%', fontSize: 'var(--font-sm)' }} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-primary)' }}>
          Gesamtbudget: {valid ? fmtEUR(total) : '—'}
        </span>
        <button onClick={submit} className="btn btn-primary" disabled={!valid} style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Save size={15} /> Speichern
        </button>
      </div>
    </div>
  );
};

// ─── Eintrag-Modal ───
interface EntryModalProps {
  initialDate: string;
  editing: HolidayBudgetEntry | null;
  onSave: (date: string, amount: number, note: string, keepOpen: boolean) => void;
  onClose: () => void;
}

const EntryModal = ({ initialDate, editing, onSave, onClose }: EntryModalProps) => {
  const [date, setDate] = useState(editing?.date || initialDate);
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [note, setNote] = useState(editing?.note || '');
  const amt = parseFloat(amount.replace(',', '.')) || 0;
  const valid = date && amt > 0;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
    }}>
      <div className="glass-panel" style={{
        maxWidth: '380px', width: '100%', padding: '1.25rem',
        borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
            {editing ? 'Ausgabe bearbeiten' : 'Ausgabe eintragen'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem', display: 'block' }}>Datum</label>
            <input type="date" className="input-field" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%', fontSize: 'var(--font-sm)' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem', display: 'block' }}>Betrag (€)</label>
            <input
              type="text" inputMode="decimal" className="input-field" placeholder="z.B. 45,50"
              value={amount} onChange={e => setAmount(e.target.value)}
              style={{ width: '100%', fontSize: 'var(--font-sm)' }} autoFocus
            />
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem', display: 'block' }}>Notiz (optional)</label>
            <input
              type="text" className="input-field" placeholder="z.B. Tanken"
              value={note} onChange={e => setNote(e.target.value)}
              style={{ width: '100%', fontSize: 'var(--font-sm)' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <button
              type="button" onClick={() => onSave(date, amt, note.trim(), false)}
              className="btn btn-primary" disabled={!valid}
              style={{ flex: 1, padding: '0.6rem', display: 'flex', justifyContent: 'center', gap: '0.4rem' }}
            >
              <Save size={16} /> Speichern
            </button>
            {!editing && (
              <button
                type="button" onClick={() => onSave(date, amt, note.trim(), true)}
                className="btn btn-primary" disabled={!valid}
                style={{ flex: 1, padding: '0.6rem', display: 'flex', justifyContent: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
              >
                <Plus size={14} /> Weiter
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Hauptseite ───
export const HolidayBudget = () => {
  const { user } = useAuth();
  const { settings: appSettings } = useSettings();
  const [data, setData] = useState<HolidayBudgetData>(EMPTY);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<HolidayBudgetEntry | null>(null);
  const [entryDate, setEntryDate] = useState(formatDate(new Date()));

  const [confirmReset, setConfirmReset] = useState(false);

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

  if (!user || user.isChild || !dataLoaded) return null;

  const { settings, entries } = data;
  const isNeon = appSettings.designMode === 'neon';

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
      setShowEntryModal(false);
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
        // Modal bleibt offen — Formular zurücksetzen über key im Modal
      } else {
        setShowEntryModal(false);
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
    setShowEntryModal(true);
  };

  const openEdit = (e: HolidayBudgetEntry) => {
    setEditingEntry(e);
    setEntryDate(e.date);
    setShowEntryModal(true);
  };

  const resetAll = () => {
    if (!confirm('Urlaubsbudget komplett zurücksetzen? Alle Einträge UND die Einstellungen (Datum, Tage, Tagesziel) werden gelöscht.')) return;
    persist({ settings: { startDate: '', days: 0, dailyGoal: 0 }, entries: [] });
    setConfirmReset(false);
  };

  const configuredSpan = spent / totalBudget;
  const budgetBarPct = totalBudget > 0 ? Math.min(100, (spent / totalBudget) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Euro size={24} /> Urlaubsbudget
        </h1>
        {configured && (
          <button
            onClick={() => setConfirmReset(true)}
            className="btn btn-secondary"
            style={{ padding: '0.45rem 0.7rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
          >
            <RotateCcw size={15} /> Zurücksetzen
          </button>
        )}
      </div>

      {confirmReset && (
        <div style={{
          padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-danger)', backgroundColor: 'rgba(220,38,38,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>
            Komplett zurücksetzen? Alle Einträge und Einstellungen werden gelöscht.
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setConfirmReset(false)} className="btn btn-secondary" style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem' }}>
              Abbrechen
            </button>
            <button onClick={resetAll} className="btn btn-primary" style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem' }}>
              <RotateCcw size={14} /> Zurücksetzen
            </button>
          </div>
        </div>
      )}

      {/* Einstellungen */}
      <SettingsPanel settings={settings} onSave={saveSettings} />

      {!configured ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <Euro size={40} style={{ opacity: 0.4 }} />
          <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text)' }}>
            Noch kein Urlaubsbudget eingestellt
          </p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)', maxWidth: '360px' }}>
            Trage oben Startdatum, Anzahl Tage und dein Tagesziel ein — dann siehst du hier die Soll-Ist-Übersicht.
          </p>
        </div>
      ) : (
        <>
          {/* Gesamtübersicht */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem' }}>Gesamtbudget</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text)' }}>{fmtEUR(totalBudget)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem' }}>Ausgegeben</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-primary)' }}>{fmtEUR(spent)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem' }}>Noch verfügbar</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: remaining >= 0 ? '#10B981' : '#DC2626' }}>
                  {fmtEUR(remaining)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem' }}>Prognose</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: projectionDiff >= 0 ? '#10B981' : '#DC2626' }}>
                  {projectionDiff >= 0 ? `+${fmtEUR(projectionDiff)} übrig` : `${fmtEUR(Math.abs(projectionDiff))} drüber`}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
                  bei {restDays} verbleibenden Tag{restDays === 1 ? '' : 'en'} à {fmtEUR(settings.dailyGoal)}
                </div>
              </div>
            </div>

            {/* Gesamtbalken Soll vs Ist */}
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem' }}>
              Budget verbraucht: {Math.round(budgetBarPct)} % ({fmtEUR(spent)} von {fmtEUR(totalBudget)})
            </div>
            <div style={{ height: '14px', borderRadius: '20px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${budgetBarPct}%`, borderRadius: '20px',
                background: configuredSpan <= 0.75 ? 'linear-gradient(90deg, #10B981, #34D399)' : configuredSpan <= 1 ? 'linear-gradient(90deg, #F59E0B, #FBBF24)' : 'linear-gradient(90deg, #DC2626, #EF4444)',
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>

          {/* Kumulierte Soll-Ist-Grafik */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3 style={{ margin: 0, marginBottom: '0.9rem', fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)' }}>
              Soll vs. Ist (kumuliert)
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {daysList.map((day, i) => {
                const dateStr = formatDate(day);
                const soll = settings.dailyGoal * (i + 1);
                const ist = daysList.slice(0, i + 1).reduce((s, d) => s + (entriesByDate[formatDate(d)] || []).reduce((x, e) => x + e.amount, 0), 0);
                const pctSoll = totalBudget > 0 ? (soll / totalBudget) * 100 : 0;
                const pctIst = totalBudget > 0 ? Math.min(100, (ist / totalBudget) * 100) : 0;
                const over = ist > soll;

                return (
                  <div key={dateStr} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: '78px', flexShrink: 0, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                      {DAY_NAMES[day.getDay()]} {day.getDate()}.
                    </span>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {/* Soll-Linie */}
                      <div style={{ position: 'relative', height: '5px', borderRadius: '4px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pctSoll}%`, backgroundColor: 'rgba(148,163,184,0.35)' }} />
                      </div>
                      {/* Ist-Balken */}
                      <div style={{ position: 'relative', height: '9px', borderRadius: '4px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                        <div style={{
                          position: 'absolute', left: 0, top: 0, height: '100%', width: `${pctIst}%`,
                          borderRadius: '4px',
                          backgroundColor: over ? '#DC2626' : (ist > 0 ? '#10B981' : 'transparent'),
                          transition: 'width 0.3s ease',
                        }} />
                      </div>
                    </div>
                    <span style={{ width: '72px', flexShrink: 0, textAlign: 'right', fontSize: '0.72rem', fontWeight: 700, color: over ? '#DC2626' : 'var(--color-text-muted)' }}>
                      {fmtEUR(ist)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: '14px', height: '6px', borderRadius: '3px', backgroundColor: 'rgba(148,163,184,0.35)', display: 'inline-block' }} /> Soll (Plan)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: '14px', height: '6px', borderRadius: '3px', backgroundColor: '#10B981', display: 'inline-block' }} /> Ist (tatsächlich)
              </span>
            </div>
          </div>

          {/* Tagesliste */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {daysList.map((day, i) => {
              const dateStr = formatDate(day);
              const dayEntries = entriesByDate[dateStr] || [];
              const daySpent = dayEntries.reduce((s, e) => s + e.amount, 0);
              const isToday = sameDay(day, today);
              const col = ampel(daySpent, settings.dailyGoal);
              const ncs = isNeon ? getNeonCardStyle(dateStr) : undefined;
              const dayPct = settings.dailyGoal > 0 ? Math.min(100, (daySpent / settings.dailyGoal) * 100) : 0;

              return (
                <div
                  key={dateStr}
                  style={{
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: isToday ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                    backgroundColor: isToday ? 'var(--color-primary-transparent)' : 'var(--color-surface)',
                    ...(isNeon && ncs && !isToday ? {
                      backgroundImage: ncs.backgroundImage,
                      backgroundOrigin: ncs.backgroundOrigin as any,
                      backgroundClip: ncs.backgroundClip,
                      border: ncs.border,
                      boxShadow: ncs.boxShadow,
                    } : {}),
                  }}
                >
                  {/* Tageskopf */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: dayEntries.length ? '0.5rem' : 0 }}>
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '44px' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>Tag {i + 1}</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: isToday ? 'var(--color-primary)' : 'var(--color-text)' }}>
                        {DAY_NAMES_LONG[day.getDay()].slice(0, 2)} {day.getDate()}.
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-text)' }}>{fmtEUR(daySpent)}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>von {fmtEUR(settings.dailyGoal)}</span>
                        <span
                          style={{
                            fontSize: '0.68rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: '20px',
                            backgroundColor: col === 'green' ? 'rgba(16,185,129,0.15)' : col === 'yellow' ? 'rgba(245,158,11,0.15)' : 'rgba(220,38,38,0.15)',
                            color: col === 'green' ? '#10B981' : col === 'yellow' ? '#D97706' : '#DC2626',
                          }}
                        >
                          {col === 'green' ? '✓ im Ziel' : col === 'yellow' ? '~ leicht drüber' : '! deutlich drüber'}
                        </span>
                      </div>
                      <div style={{ height: '7px', borderRadius: '4px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${dayPct}%`, borderRadius: '4px',
                          backgroundColor: col === 'green' ? '#10B981' : col === 'yellow' ? '#F59E0B' : '#DC2626',
                          transition: 'width 0.3s ease',
                        }} />
                      </div>
                    </div>
                    <button
                      onClick={() => openAdd(dateStr)}
                      className="btn btn-secondary"
                      style={{ padding: '0.35rem 0.55rem', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem', flexShrink: 0 }}
                    >
                      <Plus size={14} /> Eintrag
                    </button>
                  </div>

                  {/* Tageseinträge */}
                  {dayEntries.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.4rem' }}>
                      {dayEntries.map(e => (
                        <div
                          key={e.id}
                          onClick={() => openEdit(e)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            padding: '0.35rem 0.5rem', borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'rgba(99,102,241,0.06)', border: '1px solid var(--color-border)',
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)', flexShrink: 0 }}>{fmtEUR(e.amount)}</span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {e.note || '—'}
                          </span>
                          <button
                            onClick={ev => { ev.stopPropagation(); deleteEntry(e.id); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', opacity: 0.55, display: 'flex', padding: '0.2rem', flexShrink: 0 }}
                            title="Eintrag löschen"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modals */}
      {showEntryModal && (
        <EntryModal
          key={editingEntry ? editingEntry.id : `new-${entryDate}-${Date.now()}`}
          initialDate={entryDate}
          editing={editingEntry}
          onSave={saveEntry}
          onClose={() => { setShowEntryModal(false); setEditingEntry(null); }}
        />
      )}
    </div>
  );
};
