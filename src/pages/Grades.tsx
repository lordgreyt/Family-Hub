import { useEffect, useId, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Archive, BarChart3, BookOpen, ChevronRight, Plus, Save, Settings, Star, Trash2, TrendingDown, TrendingUp, X } from 'lucide-react';
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

const SUBJECT_COLORS = ['#6D5DF0', '#F27A9B', '#F5A06B', '#4FC3A1', '#4B8DFF', '#A68BF0'];
const HERO_GRADIENT = 'linear-gradient(135deg, #3F34C4 0%, #6D5DF0 55%, #F2A9BE 130%)';
const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

function gradeColor(value: number) {
  if (value <= 2.5) return '#4FC3A1';
  if (value <= 4.5) return '#6D5DF0';
  return '#F27A9B';
}

const iconChip = (color: string): CSSProperties => ({
  width: '38px',
  height: '38px',
  borderRadius: '50%',
  background: color + '26',
  color,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
});

type SortMode = 'name' | 'best' | 'worst' | 'recent';

const SORT_OPTIONS: Array<{ id: SortMode; label: string }> = [
  { id: 'name', label: 'A–Z' },
  { id: 'best', label: 'Beste' },
  { id: 'worst', label: 'Schlechteste' },
  { id: 'recent', label: 'Zuletzt' },
];

function SubjectGradeChart({ chartId, grades, yearLabel, average, isCurrent }: {
  chartId: string;
  grades: GradeEntry[];
  yearLabel: string;
  average: number | null;
  isCurrent: boolean;
}) {
  const sorted = [...grades]
    .filter(grade => Number.isFinite(grade.value) && grade.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) return null;

  const width = 340;
  const height = 190;
  const left = 24;
  const right = 14;
  const top = 18;
  const bottom = 26;
  const plotW = width - left - right;
  const plotH = height - top - bottom;

  const time = (date: string) => new Date(`${date}T00:00:00`).getTime();
  const startYear = schoolYearStart(yearLabel);
  let rangeStart = startYear ? new Date(startYear, 7, 1).getTime() : time(sorted[0].date);
  let rangeEnd = startYear ? new Date(startYear + 1, 6, 31).getTime() : time(sorted[sorted.length - 1].date) + 86400000 * 30;
  rangeStart = Math.min(rangeStart, time(sorted[0].date));
  rangeEnd = Math.max(rangeEnd, time(sorted[sorted.length - 1].date));
  const span = Math.max(rangeEnd - rangeStart, 1);

  const xOf = (ms: number) => left + ((ms - rangeStart) / span) * plotW;
  const yOf = (value: number) => top + ((Math.min(6, Math.max(1, value)) - 1) / 5) * plotH;

  const points = sorted.map(grade => ({ grade, x: xOf(time(grade.date)), y: yOf(grade.value) }));
  const line = points.map(point => `${point.x},${point.y}`).join(' ');
  const last = points[points.length - 1];
  const areaPath = points.length > 1
    ? `M ${points[0].x} ${top} L ${points.map(point => `${point.x} ${point.y}`).join(' L ')} L ${last.x} ${top} Z`
    : '';

  const ticks: Array<{ x: number; label: string }> = [];
  const cursor = new Date(rangeStart);
  cursor.setDate(1);
  if (cursor.getTime() < rangeStart) cursor.setMonth(cursor.getMonth() + 1);
  const monthSpan = (rangeEnd - rangeStart) / (86400000 * 30);
  const step = monthSpan > 8 ? 2 : 1;
  for (let i = 0; cursor.getTime() <= rangeEnd && i < 24; i += 1) {
    if (i % step === 0) ticks.push({ x: xOf(cursor.getTime()), label: MONTH_NAMES[cursor.getMonth()] });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const now = Date.now();
  const showToday = isCurrent && now >= rangeStart && now <= rangeEnd;
  const averageY = average === null ? null : yOf(average);

  return (
    <div style={{
      background: 'var(--color-surface-hover)',
      borderRadius: 'var(--radius-lg)',
      padding: '0.8rem 0.6rem 0.4rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.4rem 0.2rem', gap: '0.5rem' }}>
        <span style={{ fontSize: 'var(--font-xs)', fontWeight: 800, color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}>
          NOTEN IM SCHULJAHR {yearLabel}
        </span>
        {average !== null && (
          <span style={{ padding: '0.15rem 0.6rem', borderRadius: '999px', background: 'white', color: '#F27A9B', fontSize: 'var(--font-xs)', fontWeight: 800, whiteSpace: 'nowrap', flexShrink: 0 }}>
            Ø {formatAverage(average)}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Notenverlauf im Schuljahr" style={{ width: '100%', display: 'block' }}>
        <defs>
          <linearGradient id={`${chartId}-area`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F2A9BE" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#6D5DF0" stopOpacity="0.35" />
          </linearGradient>
        </defs>

        {[1, 2, 3, 4, 5, 6].map(value => {
          const y = yOf(value);
          return (
            <g key={value}>
              <line x1={left} y1={y} x2={width - right} y2={y} stroke="var(--color-border)" strokeWidth="1" />
              <text x={left - 8} y={y + 3.5} textAnchor="end" fill="var(--color-text-tertiary)" fontSize="10" fontWeight="700">{value}</text>
            </g>
          );
        })}

        {ticks.map(tick => (
          <text key={`${tick.label}-${tick.x}`} x={tick.x} y={height - 8} textAnchor="middle" fill="var(--color-text-tertiary)" fontSize="9.5" fontWeight="700">
            {tick.label}
          </text>
        ))}

        {showToday && (
          <line x1={xOf(now)} y1={top} x2={xOf(now)} y2={top + plotH} stroke="#CFC7F5" strokeWidth="1.2" strokeDasharray="2 3" />
        )}

        {averageY !== null && (
          <line x1={left} y1={averageY} x2={width - right} y2={averageY} stroke="#F27A9B" strokeWidth="1.4" strokeDasharray="5 4" />
        )}

        {areaPath && <path d={areaPath} fill={`url(#${chartId}-area)`} />}
        {points.length > 1 && (
          <polyline points={line} fill="none" stroke="#6D5DF0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {points.map(point => (
          <g key={point.grade.id}>
            <circle cx={point.x} cy={point.y} r="5.5" fill="white" stroke={gradeColor(point.grade.value)} strokeWidth="2.4" />
            <text
              x={Math.min(Math.max(point.x, left + 8), width - right - 8)}
              y={point.y < top + 14 ? point.y + 18 : point.y - 9}
              textAnchor="middle"
              fill={gradeColor(point.grade.value)}
              fontSize="10.5"
              fontWeight="800"
              stroke="var(--color-surface-hover)"
              strokeWidth="3"
              paintOrder="stroke"
            >
              {String(point.grade.value).replace('.', ',')}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function smoothPath(points: Array<{ x: number; y: number }>) {
  let d = `M${points[0].x},${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const midX = (from.x + to.x) / 2;
    d += ` C${midX},${from.y} ${midX},${to.y} ${to.x},${to.y}`;
  }
  return d;
}

function GradeTrendLine({ points, compact = false, color = '#6D5DF0' }: { points: ChartPoint[]; compact?: boolean; color?: string }) {
  const gradientId = `trend-${useId().replace(/:/g, '')}`;
  const width = 340;
  const height = compact ? 40 : 160;
  const paddingX = compact ? 8 : 30;
  const paddingTop = compact ? 7 : 22;
  const paddingBottom = compact ? 7 : 26;
  const chartHeight = height - paddingTop - paddingBottom;
  const chartWidth = width - paddingX * 2;
  const values = points.flatMap(point => point.value === null ? [] : [Math.min(6, Math.max(1, point.value))]);

  if (!points.length || !values.length) {
    return (
      <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
        Noch keine Jahresdaten.
      </p>
    );
  }

  // Zoom the axis to the data (with a little air) so small changes stay visible; 1 stays on top.
  const low = Math.max(1, Math.floor(Math.min(...values) - 0.5));
  const high = Math.min(6, Math.max(low + 2, Math.ceil(Math.max(...values) + 0.5)));
  const yOf = (value: number) => paddingTop + ((Math.min(high, Math.max(low, value)) - low) / (high - low)) * chartHeight;
  const positioned = points.map((point, index) => ({
    ...point,
    x: points.length <= 1 ? width / 2 : paddingX + (chartWidth * index) / (points.length - 1),
    y: point.value === null ? null : yOf(point.value),
  }));
  const valid = positioned.filter((point): point is ChartPoint & { x: number; y: number } => point.y !== null);
  const baseline = height - paddingBottom;
  const line = valid.length > 1 ? smoothPath(valid) : '';
  const area = line ? `${line} L${valid[valid.length - 1].x},${baseline} L${valid[0].x},${baseline} Z` : '';
  const ticks = Array.from({ length: high - low + 1 }, (_, index) => low + index);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Notenverlauf" style={{ width: '100%', height: `${height}px`, display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {!compact && ticks.map(value => {
        const y = yOf(value);
        return (
          <g key={value}>
            <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="var(--color-border)" strokeWidth="1" strokeDasharray="3 5" />
            <text x="6" y={y + 4} fill="var(--color-text-muted)" fontSize="10" fontWeight="700">{value}</text>
          </g>
        );
      })}
      {area && <path d={area} fill={`url(#${gradientId})`} />}
      {line && <path d={line} fill="none" stroke={color} strokeWidth={compact ? 2.2 : 3} strokeLinecap="round" strokeLinejoin="round" />}
      {valid.map((point, index) => {
        const isLast = index === valid.length - 1;
        return (
          <g key={`${point.label}-${point.x}`}>
            {!compact && isLast && <circle cx={point.x} cy={point.y} r="11" fill={color} opacity="0.16" />}
            <circle cx={point.x} cy={point.y} r={compact ? (isLast ? 3.4 : 0) : (isLast ? 5.5 : 4.5)} fill={isLast ? color : 'white'} stroke={color} strokeWidth={isLast ? 2 : 2.4} />
            {!compact && (
              <text x={point.x} y={Math.max(11, point.y - 12)} textAnchor="middle" fill={isLast ? color : 'var(--color-text-muted)'} fontSize="11" fontWeight="900">
                {formatAverage(point.value)}
              </text>
            )}
          </g>
        );
      })}
      {!compact && positioned.map(point => (
        <text key={point.label} x={point.x} y={height - 6} textAnchor="middle" fill="var(--color-text-muted)" fontSize="10" fontWeight="800">
          {point.label}
        </text>
      ))}
    </svg>
  );
}

// Lower is better in the German system, so a falling average is an improvement.
function TrendDelta({ delta, light = false, size = 13 }: { delta: number | null; light?: boolean; size?: number }) {
  if (delta === null) return null;
  const flat = Math.abs(delta) < 0.005;
  const improved = delta < 0;
  const tone = flat ? 'var(--color-text-muted)' : improved ? '#2E9E80' : '#E0567A';
  const Icon = improved ? TrendingUp : TrendingDown;
  return (
    <span
      title={flat ? 'Unverändert' : improved ? 'Verbessert' : 'Verschlechtert'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.15rem 0.45rem', borderRadius: '999px',
        background: light ? 'rgba(255,255,255,0.9)' : tone + '1F', color: tone, fontSize: 'var(--font-xs)', fontWeight: 800, flexShrink: 0,
      }}
    >
      {!flat && <Icon size={size} />}
      {flat ? '±0' : Math.abs(delta).toFixed(2).replace('.', ',')}
    </span>
  );
}

const analyticsLabel: CSSProperties = {
  margin: 0, fontSize: 'var(--font-xs)', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)',
};

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
  const [openName, setOpenName] = useState<string | null>(null);
  const yearViews = useMemo(
    () => [currentYearView(record), ...sortArchivedYears(record.archivedYears).map(archivedYearView)],
    [record],
  );
  const openColor = SUBJECT_COLORS[Math.max(0, subjectNames.indexOf(openName ?? '')) % SUBJECT_COLORS.length];
  const openYears = openName === null ? [] : yearViews.flatMap(year => {
    const subject = year.subjects.find(item => item.name === openName);
    return subject && subject.grades.length > 0 ? [{ year, subject, average: weightedAverage(subject.grades) }] : [];
  });
  const openTrend = openName === null ? [] : summaries.map(summary => ({
    label: summary.label,
    value: summary.subjectAverages.find(subject => subject.name === openName)?.average ?? null,
  }));
  const closeSheet = () => setOpenName(null);

  const withOverall = summaries.filter(summary => summary.overall !== null);
  const latest = withOverall[withOverall.length - 1] ?? null;
  const previous = withOverall[withOverall.length - 2] ?? null;
  const overallDelta = latest && previous ? (latest.overall as number) - (previous.overall as number) : null;
  const ranked = (latest?.subjectAverages ?? [])
    .flatMap(subject => subject.average === null ? [] : [{ name: subject.name, average: subject.average }])
    .sort((a, b) => a.average - b.average);
  const best = ranked.length > 1 ? ranked[0] : null;
  const weakest = ranked.length > 1 ? ranked[ranked.length - 1] : null;

  return (
    <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ background: HERO_GRADIENT, color: 'white', padding: '1.1rem 1.1rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
          <div style={{ ...iconChip('#FFFFFF'), background: 'rgba(255,255,255,0.22)', color: 'white' }}>
            <BarChart3 size={19} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 'var(--font-lg)', color: 'white' }}>Auswertung</h2>
            <p style={{ margin: '0.15rem 0 0 0', color: 'rgba(255,255,255,0.8)', fontSize: 'var(--font-xs)' }}>
              {summaries.length} {summaries.length === 1 ? 'Schuljahr' : 'Schuljahre'}
            </p>
          </div>
        </div>
        {latest && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem', flexShrink: 0 }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1 }}>{formatAverage(latest.overall)}</span>
            <TrendDelta delta={overallDelta} light />
            {previous && overallDelta !== null && (
              <span style={{ fontSize: '10px', opacity: 0.85, fontWeight: 700 }}>zu {previous.label}</span>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        {!hasValues ? (
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
            Sobald Noten eingetragen sind, erscheint hier der Verlauf.
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <p style={analyticsLabel}>Gesamtschnitt pro Schuljahr</p>
              <GradeTrendLine points={summaries.map(summary => ({ label: summary.label, value: summary.overall }))} />
            </div>

            {best && weakest && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.6rem' }}>
                {[
                  { label: 'Bestes Fach', entry: best, color: '#2E9E80' },
                  { label: 'Schwächstes Fach', entry: weakest, color: '#E0567A' },
                ].map(({ label, entry, color }) => (
                  <div key={label} style={{ padding: '0.75rem', borderRadius: 'var(--radius-lg)', background: color + '14', display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color }}>{label}</span>
                    <span style={{ fontSize: 'var(--font-xl)', fontWeight: 800, lineHeight: 1.1, color }}>{formatAverage(entry.average)}</span>
                    <span style={{ fontSize: 'var(--font-sm)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
                  </div>
                ))}
              </div>
            )}

            {subjectNames.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <p style={analyticsLabel}>Fächer im Verlauf</p>
                {subjectNames.map((name, index) => {
                  const color = SUBJECT_COLORS[index % SUBJECT_COLORS.length];
                  const points = summaries.map(summary => ({
                    label: summary.label,
                    value: summary.subjectAverages.find(subject => subject.name === name)?.average ?? null,
                  }));
                  const filled = points.filter(point => point.value !== null);
                  const current = filled[filled.length - 1]?.value ?? null;
                  const before = filled[filled.length - 2]?.value ?? null;
                  const delta = current !== null && before !== null ? current - before : null;
                  return (
                    <button
                      key={name}
                      onClick={() => setOpenName(name)}
                      style={{
                        padding: '0.55rem 0.75rem', minHeight: '3.6rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--color-surface-hover)',
                        display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%', border: 'none', cursor: 'pointer',
                        fontFamily: 'inherit', color: 'var(--color-text)', textAlign: 'left',
                      }}
                    >
                      <span style={{ ...iconChip(color), width: '30px', height: '30px', fontWeight: 800, fontSize: 'var(--font-sm)' }}>
                        {name.trim().charAt(0).toUpperCase() || '?'}
                      </span>
                      <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 'var(--font-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                      {filled.length > 1 && (
                        <div style={{ width: '84px', flexShrink: 0 }}>
                          <GradeTrendLine points={points} compact color={color} />
                        </div>
                      )}
                      <div style={{ width: '3.6rem', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                        <span style={{ fontWeight: 800, fontSize: 'var(--font-base)', lineHeight: 1 }}>{formatAverage(current)}</span>
                        <TrendDelta delta={delta} size={11} />
                      </div>
                      <ChevronRight size={16} color="var(--color-text-tertiary)" style={{ flexShrink: 0 }} />
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {openName !== null && createPortal(
        <div
          onClick={closeSheet}
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
              animation: 'gradesSheetUp 0.28s ease',
            }}
          >
            <div style={{ width: '44px', height: '5px', borderRadius: '999px', background: 'var(--color-border)', alignSelf: 'center', flexShrink: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ ...iconChip(openColor), fontWeight: 800, fontSize: 'var(--font-base)' }}>
                {openName.trim().charAt(0).toUpperCase() || '?'}
              </span>
              <h3 style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 'var(--font-lg)', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {openName}
              </h3>
              <button
                onClick={closeSheet}
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

            {openTrend.filter(point => point.value !== null).length > 1 && (
              <div style={{ padding: '0.9rem 0.9rem 0.6rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface-hover)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <p style={analyticsLabel}>Schnitt pro Schuljahr</p>
                <GradeTrendLine points={openTrend} color={openColor} />
              </div>
            )}

            {openYears.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>Noch keine Noten.</p>
            ) : openYears.map(({ year, subject, average }) => (
              <div key={year.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <p style={analyticsLabel}>
                    {year.isCurrent ? `${year.label} · aktuell` : `${year.label} · Archiv`}
                  </p>
                  <span style={{ padding: '0.2rem 0.65rem', borderRadius: '999px', fontWeight: 800, fontSize: 'var(--font-sm)', background: openColor + '26', color: openColor }}>
                    Ø {formatAverage(average)}
                  </span>
                </div>
                {[...subject.grades].sort((a, b) => b.date.localeCompare(a.date)).map(grade => (
                  <div
                    key={grade.id}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.55rem', alignItems: 'center',
                      padding: '0.55rem 0.65rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-surface-hover)', fontSize: 'var(--font-sm)',
                    }}
                  >
                    <span style={{ color: 'var(--color-text-muted)' }}>{formatDate(grade.date)}</span>
                    <strong style={{ minWidth: '2.6rem', textAlign: 'center', padding: '0.15rem 0.5rem', borderRadius: '999px', background: gradeColor(grade.value) + '26', color: gradeColor(grade.value) }}>
                      {String(grade.value).replace('.', ',')}
                    </strong>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)', minWidth: '2.6rem', textAlign: 'right' }}>{grade.weight}%</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <style>{`@keyframes gradesSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
        </div>,
        document.body
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
        backgroundColor: 'rgba(23,20,58,0.5)',
        backdropFilter: 'blur(6px)',
        overflowY: 'auto',
      }}
    >
      <div
        className="glass-panel"
        onClick={event => event.stopPropagation()}
        style={{ width: '100%', maxWidth: '440px', padding: '1.25rem', borderRadius: 'var(--radius-xl)', display: 'flex', flexDirection: 'column', gap: '1rem' }}
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
  const [openSubjectId, setOpenSubjectId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('name');
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
    };
    load();
    window.addEventListener('db_updated', load);
    return () => window.removeEventListener('db_updated', load);
  }, [activeChild, user]);

  const selectedYear = useMemo(() => selectedYearView(record, selectedYearId), [record, selectedYearId]);
  const archivedYears = useMemo(() => sortArchivedYears(record.archivedYears), [record.archivedYears]);
  const childUser = users.find(item => item.id === activeChild);
  const totalAverage = useMemo(() => overallAverage(selectedYear), [selectedYear]);
  // In-year trend: overall average now vs. before the latest third of all grades (needs at least 2 grades).
  const yearDelta = useMemo(() => {
    const dated = selectedYear.subjects
      .flatMap(subject => subject.grades)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
    if (dated.length < 2 || totalAverage === null) return null;
    const kept = new Set(dated.slice(0, dated.length - Math.ceil(dated.length / 3)).map(grade => grade.id));
    const before = overallAverage({
      settings: selectedYear.settings,
      subjects: selectedYear.subjects.map(subject => ({ ...subject, grades: subject.grades.filter(grade => kept.has(grade.id)) })),
    });
    return before === null ? null : totalAverage - before;
  }, [selectedYear, totalAverage]);

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
    setOpenSubjectId(null);
  };

  const startAddGrade = (subjectId: string) => {
    if (!canEdit) return;
    setAddingSubjectId(subjectId);
    setGradeDraft({ value: '', date: todayIso(), weight: '100' });
    setOpenSubjectId(subjectId);
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

  const entries = selectedYear.subjects.map((subject, index) => ({
    subject,
    average: weightedAverage(subject.grades),
    color: SUBJECT_COLORS[index % SUBJECT_COLORS.length],
    isMajor: selectedYear.settings.isSecondarySchool && selectedYear.settings.majorSubjectIds.includes(subject.id),
    lastDate: subject.grades.reduce((max, grade) => grade.date > max ? grade.date : max, ''),
  }));
  const byName = (a: { subject: GradeSubject }, b: { subject: GradeSubject }) => a.subject.name.localeCompare(b.subject.name, 'de');
  const sortedEntries = [...entries].sort((a, b) => {
    if (sortMode === 'name') return byName(a, b);
    if (sortMode === 'recent') return b.lastDate.localeCompare(a.lastDate) || byName(a, b);
    if (a.average === null && b.average === null) return byName(a, b);
    if (a.average === null) return 1;
    if (b.average === null) return -1;
    return (sortMode === 'best' ? a.average - b.average : b.average - a.average) || byName(a, b);
  });
  const openEntry = entries.find(entry => entry.subject.id === openSubjectId) ?? null;

  const renderSubjectBody = (subject: GradeSubject, subjectAverage: number | null) => (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {subject.grades.length === 0 ? (
                      <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>Noch keine Noten.</p>
                    ) : (
                      <>
                      <SubjectGradeChart
                        chartId={`gc-${subject.id.replace(/[^a-zA-Z0-9_-]/g, '')}`}
                        grades={subject.grades}
                        yearLabel={selectedYear.label}
                        average={subjectAverage}
                        isCurrent={selectedYear.isCurrent}
                      />
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
                              backgroundColor: 'var(--color-surface-hover)',
                              fontSize: 'var(--font-sm)',
                            }}
                          >
                            <span style={{ color: 'var(--color-text-muted)' }}>
                              {formatDate(grade.date)}
                            </span>
                            <strong style={{
                              minWidth: '2.6rem',
                              textAlign: 'center',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '999px',
                              background: gradeColor(grade.value) + '26',
                              color: gradeColor(grade.value),
                            }}>
                              {String(grade.value).replace('.', ',')}
                            </strong>
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
                      </>
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
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
            <BookOpen size={20} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 'var(--font-lg)', fontWeight: 800, color: 'white' }}>Noten</h1>
            <p style={{ margin: '0.1rem 0 0 0', opacity: 0.85, fontSize: 'var(--font-xs)' }}>
              {selectedYear.subjects.length} Fächer · {selectedYear.label} · {selectedYear.settings.isSecondarySchool ? 'Weiterführende Schule' : 'Grundschule'}
            </p>
          </div>
          {canManage && selectedYear.isCurrent && (
            <button
              onClick={() => setSettingsOpen(true)}
              title="Einstellungen"
              aria-label="Einstellungen"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.22)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <Settings size={19} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', opacity: 0.85 }}>GESAMTSCHNITT</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1.05 }}>{formatAverage(totalAverage)}</div>
              {yearDelta !== null && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.2rem' }}>
                  <TrendDelta delta={yearDelta} light />
                  <span style={{ fontSize: '10px', opacity: 0.85, fontWeight: 700 }}>im Jahr</span>
                </div>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-end' }}>
            <span style={{ padding: '0.3rem 0.75rem', borderRadius: '999px', background: 'rgba(255,255,255,0.22)', fontSize: 'var(--font-xs)', fontWeight: 800 }}>
              {childUser?.id || activeChild}
            </span>
            <span style={{ fontSize: 'var(--font-xs)', opacity: 0.85, lineHeight: 1.4 }}>
              {selectedYear.isCurrent ? selectedYear.label : `Archiv ${formatDateTime(selectedYear.archivedAt)}`}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.25rem', padding: '0.25rem', borderRadius: '999px', background: 'var(--color-surface-muted)' }}>
        {CHILDREN.map(childId => {
          const isActive = activeChild === childId;
          return (
            <button
              key={childId}
              onClick={() => {
                setActiveChild(childId);
                setSelectedYearId(CURRENT_YEAR_ID);
                setOpenSubjectId(null);
                setAddingSubjectId(null);
              }}
              style={{
                padding: '0.6rem 0.4rem',
                borderRadius: '999px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 'var(--font-sm)',
                fontWeight: 800,
                background: isActive ? 'white' : 'transparent',
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
              }}
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
            setOpenSubjectId(null);
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
              setOpenSubjectId(null);
            }}
            className={selectedYearId === year.id ? 'chip chip-active' : 'chip'}
            style={{ flex: '0 0 auto' }}
          >
            {year.label}
          </button>
        ))}
      </div>

      {selectedYear.subjects.length === 0 ? (
        <div className="glass-panel" style={{ padding: '2rem 1.25rem', textAlign: 'center', borderRadius: 'var(--radius-xl)' }}>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
            {canEdit ? `Lege zuerst über das Zahnrad die Fächer für ${activeChild} an.` : `Für ${activeChild} sind in diesem Schuljahr noch keine Fächer angelegt.`}
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.2rem', padding: '0.2rem', borderRadius: '999px', background: 'var(--color-surface-muted)' }}>
            {SORT_OPTIONS.map(option => {
              const isActive = sortMode === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => setSortMode(option.id)}
                  style={{
                    padding: '0.5rem 0.2rem', borderRadius: '999px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 'var(--font-xs)', fontWeight: 800, whiteSpace: 'nowrap',
                    background: isActive ? 'white' : 'transparent',
                    color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {sortedEntries.map(({ subject, average, isMajor }) => {
              // Each subject is one full-width bar, filled by its average: 1,0 = full, 6,0 = nearly empty.
              const fill = average === null ? 0 : Math.max(0.04, Math.min(1, (6 - average) / 5));
              const barColor = average === null ? 'var(--color-border)' : gradeColor(average);
              return (
                <button
                  key={subject.id}
                  onClick={() => setOpenSubjectId(subject.id)}
                  style={{
                    position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '0.5rem', textAlign: 'left',
                    height: '2.6rem', padding: '0 0.9rem', borderRadius: 'var(--radius-lg)', border: 'none', cursor: 'pointer',
                    fontFamily: 'inherit', color: 'var(--color-text)', background: 'var(--color-surface-muted)', width: '100%',
                  }}
                >
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${fill * 100}%`, background: barColor, opacity: 0.38, borderRadius: 'inherit' }} />
                  <span style={{ position: 'relative', flex: 1, minWidth: 0, fontWeight: 700, fontSize: 'var(--font-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {subject.name}
                  </span>
                  {isMajor && <Star size={12} fill="var(--color-primary)" color="var(--color-primary)" style={{ position: 'relative', flexShrink: 0 }} />}
                  <span style={{ position: 'relative', flexShrink: 0, fontSize: 'var(--font-base)', fontWeight: 800, color: average === null ? 'var(--color-text-tertiary)' : 'var(--color-text)' }}>
                    {formatAverage(average)}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <GradeAnalytics record={record} />

      {openEntry && createPortal(
        <div
          onClick={() => { setOpenSubjectId(null); setAddingSubjectId(null); }}
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
              animation: 'gradesSheetUp 0.28s ease',
            }}
          >
            <div style={{ width: '44px', height: '5px', borderRadius: '999px', background: 'var(--color-border)', alignSelf: 'center', flexShrink: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ ...iconChip(openEntry.color), fontWeight: 800, fontSize: 'var(--font-base)' }}>
                {openEntry.subject.name.trim().charAt(0).toUpperCase() || '?'}
              </span>
              <h3 style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 'var(--font-lg)', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {openEntry.subject.name}
              </h3>
              {openEntry.isMajor && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.2rem 0.5rem', borderRadius: '999px', background: 'var(--color-surface-muted)', color: 'var(--color-primary)', fontSize: 'var(--font-xs)', fontWeight: 800 }}>
                  <Star size={11} fill="var(--color-primary)" /> HF
                </span>
              )}
              <span style={{
                padding: '0.25rem 0.7rem', borderRadius: '999px', fontWeight: 800, fontSize: 'var(--font-sm)',
                background: openEntry.average === null ? 'var(--color-surface-muted)' : openEntry.color + '26',
                color: openEntry.average === null ? 'var(--color-text-muted)' : openEntry.color,
              }}>
                {formatAverage(openEntry.average)}
              </span>
              <button
                onClick={() => { setOpenSubjectId(null); setAddingSubjectId(null); }}
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
            {renderSubjectBody(openEntry.subject, openEntry.average)}
          </div>
          <style>{`@keyframes gradesSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
        </div>,
        document.body
      )}


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
