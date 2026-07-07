import { useEffect, useMemo, useState } from 'react';
import { Archive, BarChart3, BookOpen, ChevronDown, ChevronRight, Plus, Save, Settings, Star, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';
import type { GradeArchivedYear, GradeChildRecord, GradeChildSettings, GradeEntry, GradeSubject, User } from '../services/mockDb';

const CHILDREN = ['Lennart', 'Oskar', 'Lotta'] as const;
const CURRENT_YEAR_ID = 'current';

type ChildId = typeof CHILDREN[number];

interface GradeDraft {
  value: string;
  date: string;
  weight: string;
}

interface GradeYearView {
  id: string;
  label: string;
  subjects: GradeSubject[];
  settings: GradeChildSettings;
  isCurrent: boolean;
  archivedAt?: number;
}

interface GradeYearSummary {
  id: string;
  label: string;
  isCurrent: boolean;
  overall: number | null;
  subjectAverages: Array<{ name: string; average: number | null }>;
}

interface ChartPoint {
  label: string;
  value: number | null;
}

interface SettingsModalProps {
  record: GradeChildRecord;
  archiveCount: number;
  onClose: () => void;
  onSave: (record: GradeChildRecord) => void;
  onStartNewSchoolYear: (record: GradeChildRecord) => void;
}

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function createId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function currentSchoolYearLabel() {
  const now = new Date();
  const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}/${String(startYear + 1).slice(-2)}`;
}

function nextSchoolYearLabel(label: string) {
  const match = label.match(/^(\d{4})/);
  if (!match) return currentSchoolYearLabel();
  const nextStart = Number(match[1]) + 1;
  return `${nextStart}/${String(nextStart + 1).slice(-2)}`;
}

function schoolYearStart(label: string) {
  const match = label.match(/^(\d{4})/);
  return match ? Number(match[1]) : 0;
}

function cloneSettings(settings: GradeChildSettings): GradeChildSettings {
  return {
    isSecondarySchool: settings.isSecondarySchool,
    majorSubjectIds: [...settings.majorSubjectIds],
  };
}

function cloneSubjects(subjects: GradeSubject[], withGrades = true): GradeSubject[] {
  return subjects.map(subject => ({
    ...subject,
    grades: withGrades ? subject.grades.map(grade => ({ ...grade })) : [],
  }));
}

function weightedAverage(grades: GradeEntry[]) {
  const valid = grades.filter(grade => Number.isFinite(grade.value) && Number.isFinite(grade.weight) && grade.weight > 0);
  const weightSum = valid.reduce((sum, grade) => sum + grade.weight, 0);
  if (!valid.length || weightSum <= 0) return null;
  return valid.reduce((sum, grade) => sum + grade.value * grade.weight, 0) / weightSum;
}

function formatAverage(value: number | null) {
  return value === null ? '-' : value.toFixed(2).replace('.', ',');
}

function overallAverage(year: Pick<GradeYearView, 'subjects' | 'settings'>) {
  const subjectValues = year.subjects
    .map(subject => ({ subject, average: weightedAverage(subject.grades) }))
    .filter((item): item is { subject: GradeSubject; average: number } => item.average !== null);

  if (!subjectValues.length) return null;

  let sum = 0;
  let count = 0;

  subjectValues.forEach(({ subject, average }) => {
    const multiplier = year.settings.isSecondarySchool && year.settings.majorSubjectIds.includes(subject.id) ? 2 : 1;
    sum += average * multiplier;
    count += multiplier;
  });

  return count > 0 ? sum / count : null;
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatDateTime(timestamp?: number) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function sortArchivedYears(years: GradeArchivedYear[]) {
  return [...years].sort((a, b) => schoolYearStart(b.label) - schoolYearStart(a.label) || b.archivedAt - a.archivedAt);
}

function currentYearView(record: GradeChildRecord): GradeYearView {
  return {
    id: CURRENT_YEAR_ID,
    label: record.currentSchoolYear,
    subjects: record.subjects,
    settings: record.settings,
    isCurrent: true,
  };
}

function archivedYearView(year: GradeArchivedYear): GradeYearView {
  return {
    id: year.id,
    label: year.label,
    subjects: year.subjects,
    settings: year.settings,
    isCurrent: false,
    archivedAt: year.archivedAt,
  };
}

function selectedYearView(record: GradeChildRecord, selectedYearId: string): GradeYearView {
  if (selectedYearId === CURRENT_YEAR_ID) return currentYearView(record);
  const archived = record.archivedYears.find(year => year.id === selectedYearId);
  return archived ? archivedYearView(archived) : currentYearView(record);
}

function buildYearSummaries(record: GradeChildRecord): GradeYearSummary[] {
  const archived = [...record.archivedYears].sort((a, b) => schoolYearStart(a.label) - schoolYearStart(b.label) || a.archivedAt - b.archivedAt);
  const years = [...archived.map(archivedYearView), currentYearView(record)];

  return years.map(year => ({
    id: year.id,
    label: year.label,
    isCurrent: year.isCurrent,
    overall: overallAverage(year),
    subjectAverages: year.subjects.map(subject => ({
      name: subject.name,
      average: weightedAverage(subject.grades),
    })),
  }));
}

function GradeTrendLine({ points, compact = false }: { points: ChartPoint[]; compact?: boolean }) {
  const width = 340;
  const height = compact ? 92 : 132;
  const paddingX = 26;
  const paddingTop = 12;
  const paddingBottom = compact ? 22 : 30;
  const chartHeight = height - paddingTop - paddingBottom;
  const chartWidth = width - paddingX * 2;
  const positioned = points.map((point, index) => {
    const x = points.length <= 1 ? width / 2 : paddingX + (chartWidth * index) / (points.length - 1);
    const clamped = point.value === null ? null : Math.min(6, Math.max(1, point.value));
    const y = clamped === null ? null : paddingTop + ((clamped - 1) / 5) * chartHeight;
    return { ...point, x, y };
  });
  const valid = positioned.filter((point): point is ChartPoint & { x: number; y: number } => point.y !== null);
  const polyline = valid.map(point => `${point.x},${point.y}`).join(' ');

  if (!points.length || !valid.length) {
    return (
      <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
        Noch keine Jahresdaten.
      </p>
    );
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Notenverlauf" style={{ width: '100%', height: compact ? '92px' : '132px', display: 'block' }}>
      {[1, 2, 3, 4, 5, 6].map(value => {
        const y = paddingTop + ((value - 1) / 5) * chartHeight;
        return (
          <g key={value}>
            <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="var(--color-border)" strokeWidth="1" />
            {!compact && (
              <text x="4" y={y + 4} fill="var(--color-text-muted)" fontSize="10" fontWeight="700">
                {value}
              </text>
            )}
          </g>
        );
      })}
      {valid.length > 1 && (
        <polyline points={polyline} fill="none" stroke="var(--color-primary)" strokeWidth={compact ? 3 : 4} strokeLinecap="round" strokeLinejoin="round" />
      )}
      {valid.map(point => (
        <g key={`${point.label}-${point.x}`}>
          <circle cx={point.x} cy={point.y} r={compact ? 4 : 5} fill="var(--color-primary)" />
          {!compact && (
            <text x={point.x} y={Math.max(12, point.y - 8)} textAnchor="middle" fill="var(--color-primary)" fontSize="11" fontWeight="900">
              {formatAverage(point.value)}
            </text>
          )}
        </g>
      ))}
      {positioned.map(point => (
        <text key={point.label} x={point.x} y={height - 5} textAnchor="middle" fill="var(--color-text-muted)" fontSize={compact ? 9 : 10} fontWeight="800">
          {point.label}
        </text>
      ))}
    </svg>
  );
}

function GradeAnalytics({ record }: { record: GradeChildRecord }) {
  const summaries = useMemo(() => buildYearSummaries(record), [record]);
  const subjectNames = useMemo(() => {
    const names = new Set<string>();
    summaries.forEach(summary => {
      summary.subjectAverages.forEach(subject => names.add(subject.name));
    });
    return [...names].sort((a, b) => a.localeCompare(b, 'de'));
  }, [summaries]);
  const hasValues = summaries.some(summary => summary.overall !== null || summary.subjectAverages.some(subject => subject.average !== null));

  return (
    <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--color-primary-transparent)',
          color: 'var(--color-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <BarChart3 size={20} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 'var(--font-lg)' }}>Auswertung</h2>
          <p style={{ margin: '0.15rem 0 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)' }}>
            {summaries.length} Schuljahre
          </p>
        </div>
      </div>

      {!hasValues ? (
        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
          Sobald Noten eingetragen sind, erscheint hier der Verlauf.
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <h3 style={{ margin: 0, fontSize: 'var(--font-base)' }}>Gesamtschnitt</h3>
            <GradeTrendLine points={summaries.map(summary => ({ label: summary.label, value: summary.overall }))} />
          </div>

          {subjectNames.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--font-base)' }}>Fächer</h3>
              {subjectNames.map(name => {
                const points = summaries.map(summary => ({
                  label: summary.label,
                  value: summary.subjectAverages.find(subject => subject.name === name)?.average ?? null,
                }));
                const latest = [...points].reverse().find(point => point.value !== null)?.value ?? null;
                return (
                  <div key={name} style={{
                    padding: '0.8rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-background)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <strong style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</strong>
                      <span style={{ color: 'var(--color-primary)', fontWeight: 900 }}>{formatAverage(latest)}</span>
                    </div>
                    <GradeTrendLine points={points} compact />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SettingsModal({ record, archiveCount, onClose, onSave, onStartNewSchoolYear }: SettingsModalProps) {
  const [draft, setDraft] = useState<GradeChildRecord>(() => ({
    ...record,
    subjects: cloneSubjects(record.subjects),
    settings: cloneSettings(record.settings),
    archivedYears: record.archivedYears.map(year => ({
      ...year,
      subjects: cloneSubjects(year.subjects),
      settings: cloneSettings(year.settings),
    })),
  }));
  const [newSubject, setNewSubject] = useState('');

  const updateSettings = (patch: Partial<GradeChildRecord['settings']>) => {
    setDraft(current => ({
      ...current,
      settings: {
        ...current.settings,
        ...patch,
      },
    }));
  };

  const addSubject = () => {
    const name = newSubject.trim();
    if (!name) return;
    setDraft(current => ({
      ...current,
      subjects: [...current.subjects, { id: createId(), name, grades: [] }],
    }));
    setNewSubject('');
  };

  const renameSubject = (subjectId: string, name: string) => {
    setDraft(current => ({
      ...current,
      subjects: current.subjects.map(subject => subject.id === subjectId ? { ...subject, name } : subject),
    }));
  };

  const removeSubject = (subjectId: string) => {
    setDraft(current => ({
      ...current,
      subjects: current.subjects.filter(subject => subject.id !== subjectId),
      settings: {
        ...current.settings,
        majorSubjectIds: current.settings.majorSubjectIds.filter(id => id !== subjectId),
      },
    }));
  };

  const toggleMajorSubject = (subjectId: string) => {
    setDraft(current => {
      const isActive = current.settings.majorSubjectIds.includes(subjectId);
      return {
        ...current,
        settings: {
          ...current.settings,
          majorSubjectIds: isActive
            ? current.settings.majorSubjectIds.filter(id => id !== subjectId)
            : [...current.settings.majorSubjectIds, subjectId],
        },
      };
    });
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '1.25rem',
        paddingTop: 'max(1.25rem, env(safe-area-inset-top))',
        backgroundColor: 'rgba(0,0,0,0.48)',
        backdropFilter: 'blur(6px)',
        overflowY: 'auto',
      }}
    >
      <div
        className="glass-panel"
        onClick={event => event.stopPropagation()}
        style={{ width: '100%', maxWidth: '440px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 'var(--font-lg)' }}>{record.childId} Einstellungen</h2>
            <p style={{ margin: '0.2rem 0 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)' }}>
              {record.currentSchoolYear} · {archiveCount} im Archiv
            </p>
          </div>
          <button onClick={onClose} aria-label="Schließen" style={{ color: 'var(--color-text-muted)', display: 'flex', padding: '0.25rem' }}>
            <X size={20} />
          </button>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: 'var(--font-sm)', fontWeight: 700 }}>
          <input
            type="checkbox"
            checked={draft.settings.isSecondarySchool}
            onChange={event => updateSettings({
              isSecondarySchool: event.target.checked,
              majorSubjectIds: event.target.checked ? draft.settings.majorSubjectIds : [],
            })}
          />
          Weiterführende Schule
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          <label style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)', fontWeight: 800, textTransform: 'uppercase' }}>
            Fächer
          </label>
          {draft.subjects.length === 0 && (
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
              Noch keine Fächer angelegt.
            </p>
          )}
          {draft.subjects.map(subject => {
            const isMajor = draft.settings.majorSubjectIds.includes(subject.id);
            return (
              <div key={subject.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.45rem', alignItems: 'center' }}>
                <input
                  className="input-field"
                  value={subject.name}
                  onChange={event => renameSubject(subject.id, event.target.value)}
                  placeholder="Fach"
                  style={{ fontSize: 'var(--font-sm)' }}
                />
                <button
                  type="button"
                  title="Hauptfach"
                  aria-label="Hauptfach"
                  disabled={!draft.settings.isSecondarySchool}
                  onClick={() => toggleMajorSubject(subject.id)}
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isMajor ? 'white' : 'var(--color-text-muted)',
                    background: isMajor ? 'var(--color-primary)' : 'var(--color-surface-hover)',
                    opacity: draft.settings.isSecondarySchool ? 1 : 0.45,
                  }}
                >
                  <Star size={16} fill={isMajor ? 'white' : 'none'} />
                </button>
                <button
                  type="button"
                  title="Fach löschen"
                  aria-label="Fach löschen"
                  onClick={() => removeSubject(subject.id)}
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-danger)',
                    background: 'rgba(240, 68, 68, 0.08)',
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', alignItems: 'center' }}>
            <input
              className="input-field"
              value={newSubject}
              onChange={event => setNewSubject(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addSubject();
                }
              }}
              placeholder="Neues Fach"
              style={{ fontSize: 'var(--font-sm)' }}
            />
            <button type="button" className="btn btn-secondary" onClick={addSubject} style={{ padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)' }}>
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingTop: '0.25rem', borderTop: '1px solid var(--color-border)' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onStartNewSchoolYear(draft)}
            style={{ justifyContent: 'center', borderRadius: 'var(--radius-md)' }}
          >
            <Archive size={17} />
            Neues Schuljahr beginnen
          </button>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)', lineHeight: 1.4 }}>
            {record.currentSchoolYear} wird archiviert, das nächste Schuljahr startet mit leeren Noten.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => onSave(draft)} style={{ justifyContent: 'center' }}>
          <Save size={17} />
          Speichern
        </button>
      </div>
    </div>
  );
}

export const Grades = () => {
  const { user } = useAuth();
  const [activeChild, setActiveChild] = useState<ChildId>('Lennart');
  const [users, setUsers] = useState<User[]>([]);
  const [record, setRecord] = useState<GradeChildRecord>(() => mockDb.getGradeChild('Lennart'));
  const [selectedYearId, setSelectedYearId] = useState(CURRENT_YEAR_ID);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addingSubjectId, setAddingSubjectId] = useState<string | null>(null);
  const [gradeDraft, setGradeDraft] = useState<GradeDraft>({ value: '', date: todayIso(), weight: '100' });

  useEffect(() => {
    if (!user) return;
    const load = () => {
      setUsers(mockDb.getUsers());
      const nextRecord = mockDb.getGradeChild(activeChild);
      setRecord(nextRecord);
      setSelectedYearId(current => current === CURRENT_YEAR_ID || nextRecord.archivedYears.some(year => year.id === current) ? current : CURRENT_YEAR_ID);
      setExpandedSubjects(current => {
        if (current.size > 0) return current;
        return new Set(nextRecord.subjects.slice(0, 1).map(subject => subject.id));
      });
    };
    load();
    window.addEventListener('db_updated', load);
    return () => window.removeEventListener('db_updated', load);
  }, [activeChild, user]);

  const selectedYear = useMemo(() => selectedYearView(record, selectedYearId), [record, selectedYearId]);
  const archivedYears = useMemo(() => sortArchivedYears(record.archivedYears), [record.archivedYears]);
  const childUser = users.find(item => item.id === activeChild);
  const totalAverage = useMemo(() => overallAverage(selectedYear), [selectedYear]);

  if (!user) return null;
  const canManage = !user.isChild;
  const canEdit = canManage && selectedYear.isCurrent;

  const saveRecord = (nextRecord: GradeChildRecord) => {
    if (!canManage) return;
    setRecord(nextRecord);
    mockDb.saveGradeChild(nextRecord);
  };

  const saveSettings = (nextRecord: GradeChildRecord) => {
    if (!canManage) return;
    saveRecord(nextRecord);
    setSelectedYearId(CURRENT_YEAR_ID);
    setSettingsOpen(false);
    setExpandedSubjects(current => {
      const subjectIds = new Set(nextRecord.subjects.map(subject => subject.id));
      return new Set([...current].filter(id => subjectIds.has(id)));
    });
  };

  const startNewSchoolYear = (baseRecord: GradeChildRecord) => {
    if (!canManage) return;
    const nextLabel = nextSchoolYearLabel(baseRecord.currentSchoolYear);
    const confirmed = window.confirm(`Schuljahr ${baseRecord.currentSchoolYear} archivieren und ${nextLabel} beginnen?`);
    if (!confirmed) return;

    const archived: GradeArchivedYear = {
      id: createId(),
      label: baseRecord.currentSchoolYear,
      subjects: cloneSubjects(baseRecord.subjects),
      settings: cloneSettings(baseRecord.settings),
      startedAt: baseRecord.startedAt,
      archivedAt: Date.now(),
    };

    const nextRecord: GradeChildRecord = {
      ...baseRecord,
      currentSchoolYear: nextLabel,
      startedAt: Date.now(),
      subjects: cloneSubjects(baseRecord.subjects, false),
      settings: cloneSettings(baseRecord.settings),
      archivedYears: [archived, ...record.archivedYears],
    };

    saveRecord(nextRecord);
    setSelectedYearId(CURRENT_YEAR_ID);
    setSettingsOpen(false);
    setAddingSubjectId(null);
    setExpandedSubjects(new Set(nextRecord.subjects.slice(0, 1).map(subject => subject.id)));
  };

  const toggleSubject = (subjectId: string) => {
    setExpandedSubjects(current => {
      const next = new Set(current);
      if (next.has(subjectId)) {
        next.delete(subjectId);
      } else {
        next.add(subjectId);
      }
      return next;
    });
  };

  const startAddGrade = (subjectId: string) => {
    if (!canEdit) return;
    setAddingSubjectId(subjectId);
    setGradeDraft({ value: '', date: todayIso(), weight: '100' });
    setExpandedSubjects(current => new Set([...current, subjectId]));
  };

  const addGrade = (subjectId: string) => {
    if (!canEdit) return;
    const value = Number(gradeDraft.value.replace(',', '.'));
    const weight = Number(gradeDraft.weight.replace(',', '.'));
    if (!Number.isFinite(value) || value < 1 || value > 6 || !Number.isFinite(weight) || weight <= 0 || weight > 100 || !gradeDraft.date) {
      return;
    }

    const newGrade: GradeEntry = {
      id: createId(),
      value: Math.round(value * 10) / 10,
      weight: Math.round(weight),
      date: gradeDraft.date,
      createdAt: Date.now(),
    };

    saveRecord({
      ...record,
      subjects: record.subjects.map(subject => subject.id === subjectId ? { ...subject, grades: [...subject.grades, newGrade] } : subject),
    });
    setAddingSubjectId(null);
  };

  const deleteGrade = (subjectId: string, gradeId: string) => {
    if (!canEdit) return;
    saveRecord({
      ...record,
      subjects: record.subjects.map(subject => subject.id === subjectId
        ? { ...subject, grades: subject.grades.filter(grade => grade.id !== gradeId) }
        : subject),
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-primary-gradient)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <BookOpen size={24} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 'var(--font-xl)' }}>Noten</h1>
          <p style={{ margin: '0.2rem 0 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
            {selectedYear.subjects.length} Fächer · {selectedYear.label} · {selectedYear.settings.isSecondarySchool ? 'Weiterführende Schule' : 'Grundschule'}
          </p>
        </div>
        {canManage && selectedYear.isCurrent && (
          <button
            onClick={() => setSettingsOpen(true)}
            title="Einstellungen"
            aria-label="Einstellungen"
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-surface-hover)',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Settings size={19} />
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
        {CHILDREN.map(childId => {
          const isActive = activeChild === childId;
          return (
            <button
              key={childId}
              onClick={() => {
                setActiveChild(childId);
                setSelectedYearId(CURRENT_YEAR_ID);
                setExpandedSubjects(new Set());
                setAddingSubjectId(null);
              }}
              className={isActive ? 'chip chip-active' : 'chip'}
              style={{ justifyContent: 'center', padding: '0.65rem 0.45rem' }}
            >
              {childId}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.05rem' }}>
        <button
          onClick={() => {
            setSelectedYearId(CURRENT_YEAR_ID);
            setAddingSubjectId(null);
            setExpandedSubjects(new Set(record.subjects.slice(0, 1).map(subject => subject.id)));
          }}
          className={selectedYearId === CURRENT_YEAR_ID ? 'chip chip-active' : 'chip'}
          style={{ flex: '0 0 auto' }}
        >
          Aktuell {record.currentSchoolYear}
        </button>
        {archivedYears.map(year => (
          <button
            key={year.id}
            onClick={() => {
              setSelectedYearId(year.id);
              setAddingSubjectId(null);
              setExpandedSubjects(new Set(year.subjects.slice(0, 1).map(subject => subject.id)));
            }}
            className={selectedYearId === year.id ? 'chip chip-active' : 'chip'}
            style={{ flex: '0 0 auto' }}
          >
            {year.label}
          </button>
        ))}
      </div>

      <div className="glass-panel" style={{
        padding: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        background: 'var(--color-primary-transparent)',
      }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)', fontWeight: 800, textTransform: 'uppercase' }}>
            Gesamtschnitt
          </p>
          <h2 style={{ margin: '0.15rem 0 0 0', fontSize: '2.4rem', color: 'var(--color-primary)', lineHeight: 1 }}>
            {formatAverage(totalAverage)}
          </h2>
        </div>
        <div style={{ textAlign: 'right', color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)', lineHeight: 1.45 }}>
          <strong style={{ color: 'var(--color-text)' }}>{childUser?.id || activeChild}</strong>
          <br />
          {selectedYear.isCurrent ? selectedYear.label : `Archiv ${formatDateTime(selectedYear.archivedAt)}`}
          <br />
          {selectedYear.settings.isSecondarySchool ? 'Hauptfächer zählen doppelt' : 'Alle Fächer gleich'}
        </div>
      </div>

      {selectedYear.subjects.length === 0 ? (
        <div className="glass-panel" style={{ padding: '2rem 1.25rem', textAlign: 'center' }}>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
            {canEdit ? `Lege zuerst über das Zahnrad die Fächer für ${activeChild} an.` : `Für ${activeChild} sind in diesem Schuljahr noch keine Fächer angelegt.`}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {selectedYear.subjects.map(subject => {
            const isOpen = expandedSubjects.has(subject.id);
            const subjectAverage = weightedAverage(subject.grades);
            const isMajor = selectedYear.settings.isSecondarySchool && selectedYear.settings.majorSubjectIds.includes(subject.id);

            return (
              <div key={subject.id} className="glass-panel" style={{ overflow: 'hidden' }}>
                <button
                  onClick={() => toggleSubject(subject.id)}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr auto auto',
                    alignItems: 'center',
                    gap: '0.65rem',
                    color: 'var(--color-text)',
                  }}
                >
                  {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  <span style={{ fontWeight: 800, textAlign: 'left', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {subject.name}
                  </span>
                  {isMajor && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      color: 'var(--color-primary)',
                      fontSize: 'var(--font-xs)',
                      fontWeight: 800,
                    }}>
                      <Star size={12} fill="var(--color-primary)" />
                      HF
                    </span>
                  )}
                  <span style={{
                    minWidth: '3.4rem',
                    textAlign: 'right',
                    color: subjectAverage === null ? 'var(--color-text-muted)' : 'var(--color-primary)',
                    fontWeight: 900,
                  }}>
                    {formatAverage(subjectAverage)}
                  </span>
                </button>

                {isOpen && (
                  <div style={{ padding: '0 1rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {subject.grades.length === 0 ? (
                      <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>Noch keine Noten.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                        {[...subject.grades].sort((a, b) => b.date.localeCompare(a.date)).map(grade => (
                          <div
                            key={grade.id}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: canEdit ? '1fr auto auto auto' : '1fr auto auto',
                              gap: '0.55rem',
                              alignItems: 'center',
                              padding: '0.55rem 0.65rem',
                              borderRadius: 'var(--radius-md)',
                              backgroundColor: 'var(--color-background)',
                              fontSize: 'var(--font-sm)',
                            }}
                          >
                            <span style={{ color: 'var(--color-text-muted)' }}>
                              {formatDate(grade.date)}
                            </span>
                            <strong>{String(grade.value).replace('.', ',')}</strong>
                            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)', minWidth: '2.6rem', textAlign: 'right' }}>
                              {grade.weight}%
                            </span>
                            {canEdit && (
                              <button
                                onClick={() => deleteGrade(subject.id, grade.id)}
                                title="Note löschen"
                                aria-label="Note löschen"
                                style={{ color: 'var(--color-danger)', display: 'flex', padding: '0.2rem' }}
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {canEdit && (
                      addingSubjectId === subject.id ? (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.45rem',
                        }}>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0, 1fr) minmax(74px, 0.65fr) auto auto',
                            gap: '0.45rem',
                            alignItems: 'center',
                          }}>
                            <input
                              className="input-field"
                              type="number"
                              min="1"
                              max="6"
                              step="0.1"
                              inputMode="decimal"
                              value={gradeDraft.value}
                              onChange={event => setGradeDraft(current => ({ ...current, value: event.target.value }))}
                              placeholder="Note"
                              aria-label="Note"
                              style={{ fontSize: 'var(--font-sm)', minWidth: 0 }}
                            />
                            <input
                              className="input-field"
                              type="number"
                              min="1"
                              max="100"
                              step="1"
                              inputMode="numeric"
                              value={gradeDraft.weight}
                              onChange={event => setGradeDraft(current => ({ ...current, weight: event.target.value }))}
                              placeholder="%"
                              aria-label="Gewichtung in Prozent"
                              style={{ fontSize: 'var(--font-sm)', minWidth: 0 }}
                            />
                            <button className="btn btn-primary" onClick={() => addGrade(subject.id)} style={{ padding: '0.65rem 0.8rem', borderRadius: 'var(--radius-md)' }}>
                              <Save size={16} />
                            </button>
                            <button className="btn btn-secondary" onClick={() => setAddingSubjectId(null)} style={{ padding: '0.65rem 0.8rem', borderRadius: 'var(--radius-md)' }}>
                              <X size={16} />
                            </button>
                          </div>
                          <input
                            className="input-field"
                            type="date"
                            value={gradeDraft.date}
                            onChange={event => setGradeDraft(current => ({ ...current, date: event.target.value }))}
                            aria-label="Datum"
                            style={{ fontSize: 'var(--font-sm)', width: '100%' }}
                          />
                        </div>
                      ) : (
                        <button
                          className="btn btn-secondary"
                          onClick={() => startAddGrade(subject.id)}
                          style={{ alignSelf: 'flex-start', padding: '0.55rem 0.85rem', borderRadius: 'var(--radius-md)' }}
                        >
                          <Plus size={16} />
                          Note
                        </button>
                      )
                    )}

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: '0.25rem',
                      borderTop: '1px solid var(--color-border)',
                      color: 'var(--color-text-muted)',
                      fontSize: 'var(--font-sm)',
                      fontWeight: 800,
                    }}>
                      <span>Fachschnitt</span>
                      <span style={{ color: 'var(--color-primary)' }}>{formatAverage(subjectAverage)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <GradeAnalytics record={record} />

      {settingsOpen && canManage && (
        <SettingsModal
          record={record}
          archiveCount={record.archivedYears.length}
          onClose={() => setSettingsOpen(false)}
          onSave={saveSettings}
          onStartNewSchoolYear={startNewSchoolYear}
        />
      )}
    </div>
  );
};
