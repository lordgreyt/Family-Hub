import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { mockDb } from '../services/mockDb';
import type { TaskItem, User, RewardRequest } from '../services/mockDb';
import { AvatarEmoji } from '../components/AvatarEmoji';
import {
  Star, Wallet, TrendingUp, TrendingDown, Calculator, Check, ClipboardList, GraduationCap, Gift, Euro, CreditCard, Languages,
  Home as HomeIcon, ChevronRight, ChevronDown, History, ListChecks,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { HERO_GRADIENT, GREEN, GREEN_TEXT, ORANGE, PINK, PINK_TEXT, PRIMARY, BLUE, CARD, sectionTitle, iconChip } from '../components/SurgeryFinance/theme';
import { TaskRow, todayIso } from '../components/TaskParts';
import { getRecentActivity, relativeTime } from '../utils/activity';
import type { ActivityEvent, ActivityKind } from '../utils/activity';

const chipWhite = {
  display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem', borderRadius: '999px',
  background: 'rgba(255,255,255,0.2)', color: 'white', fontSize: 'var(--font-xs)', fontWeight: 700, lineHeight: 1.3,
} as const;

const softLink = {
  display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.45rem 0.9rem', borderRadius: '999px',
  background: '#ECE8FF', color: PRIMARY, fontSize: 'var(--font-xs)', fontWeight: 800, textDecoration: 'none', flexShrink: 0,
} as const;

const KIND_STYLE: Record<ActivityKind, { icon: LucideIcon; color: string }> = {
  expense: { icon: TrendingDown, color: PINK },
  income: { icon: TrendingUp, color: GREEN },
  budget: { icon: Calculator, color: ORANGE },
  task_done: { icon: Check, color: GREEN },
  task_new: { icon: ClipboardList, color: PRIMARY },
  grade: { icon: GraduationCap, color: BLUE },
  stars_earned: { icon: Star, color: ORANGE },
  stars_request: { icon: Gift, color: PINK },
  holiday: { icon: Euro, color: BLUE },
  depot: { icon: CreditCard, color: PRIMARY },
  vocab: { icon: Languages, color: BLUE },
};

const fmtAmount = (n: number) =>
  `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const sectionHeader = (icon: React.ReactNode, color: string, title: string, right?: React.ReactNode) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.3rem' }}>
    <span style={iconChip(color, 38)}>{icon}</span>
    <h3 style={{ ...sectionTitle, flex: 1 }}>{title}</h3>
    {right}
  </div>
);

const TASKS_PREVIEW = 6;
const EVENTS_LIMIT = 5;

export const Dashboard = () => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [upcomingTasks, setUpcomingTasks] = useState<TaskItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [rewardRequests, setRewardRequests] = useState<RewardRequest[]>([]);
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState<string>('');
  const [expenseStats, setExpenseStats] = useState({ total: 0, topCategory: '' });
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [showAllTasks, setShowAllTasks] = useState(false);

  useEffect(() => {
    const loadData = () => {
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
      setEvents(getRecentActivity(user, EVENTS_LIMIT));

      try {
        const currentMonthStr = new Date().toISOString().slice(0, 7);
        const allExpenses = mockDb.getExpenses() || [];
        const monthlyExpenses = allExpenses.filter(e => {
          if (!e || e.type !== 'EXPENSE') return false;
          const eMonth = e.budgetMonth || e.date?.substring(0, 7);
          return eMonth === currentMonthStr;
        });
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

  const handleToggleTask = (task: TaskItem) => {
    if (user?.isChild) return;
    const points = settings.prioPoints[task.priority] || 0;
    mockDb.toggleTask(task.id, points);
  };

  const isChild = !!user?.isChild;
  const today = todayIso();
  const overdueCount = upcomingTasks.filter(t => t.dueDate && t.dueDate.slice(0, 10) < today).length;
  const todayCount = upcomingTasks.filter(t => t.dueDate && t.dueDate.slice(0, 10) === today).length;
  const dateText = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

  const filteredTasks = upcomingTasks.filter(t =>
    !taskAssigneeFilter ||
    t.assignedTo?.includes(taskAssigneeFilter) ||
    (t.isShared && (!t.assignedTo || t.assignedTo.length === 0))
  );
  const visibleTasks = showAllTasks ? filteredTasks : filteredTasks.slice(0, TASKS_PREVIEW);
  const now = Date.now();

  const moreButton = (open: boolean, hidden: number, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%', marginTop: '0.3rem', padding: '0.7rem', border: 'none', borderTop: '1px solid var(--color-border)',
        background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: PRIMARY, fontSize: 'var(--font-sm)', fontWeight: 800,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
      }}
    >
      {open ? 'Weniger anzeigen' : `${hidden} weitere anzeigen`}
      <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
    </button>
  );

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
      {/* Hero */}
      <div style={{ background: HERO_GRADIENT, borderRadius: 'var(--radius-xl)', padding: '1.3rem 1.25rem', color: 'white', boxShadow: '0 12px 28px rgba(63,52,196,0.28)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <HomeIcon size={19} />
          </span>
          <div>
            <div style={{ fontSize: 'var(--font-base)', fontWeight: 800 }}>Home</div>
            <div style={{ fontSize: 'var(--font-xs)', opacity: 0.85, fontWeight: 600 }}>{dateText}</div>
          </div>
        </div>

        <div style={{ marginTop: '1.1rem', fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', opacity: 0.85 }}>OFFENE AUFGABEN</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.2rem' }}>
          <span style={{ fontSize: '2.6rem', fontWeight: 800, lineHeight: 1.1 }}>{upcomingTasks.length}</span>
          <span style={{ fontSize: 'var(--font-base)', fontWeight: 700, opacity: 0.8 }}>in den nächsten 4 Wochen</span>
        </div>

        <div style={{ marginTop: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
          {overdueCount > 0 && <span style={chipWhite}>{overdueCount} überfällig</span>}
          {todayCount > 0 && <span style={chipWhite}>{todayCount} heute fällig</span>}
          {!isChild && rewardRequests.length > 0 && (
            <span style={chipWhite}><Star size={13} fill="currentColor" /> {rewardRequests.length} {rewardRequests.length === 1 ? 'Anfrage' : 'Anfragen'}</span>
          )}
          {!isChild && <span style={chipWhite}><Wallet size={13} /> {expenseStats.total.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € im Monat</span>}
          {overdueCount === 0 && todayCount === 0 && upcomingTasks.length === 0 && <span style={chipWhite}><Check size={13} /> Alles erledigt</span>}
        </div>
      </div>

      {/* Offene Belohnungs-Anfragen — nur für Eltern */}
      {!isChild && rewardRequests.length > 0 && (
        <div style={{ ...CARD, display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem' }}>
          <span style={iconChip(ORANGE, 42)}><Star size={20} fill="currentColor" /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--font-sm)', fontWeight: 800 }}>
              {rewardRequests.length} offene {rewardRequests.length === 1 ? 'Anfrage' : 'Anfragen'}
            </div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>Belohnungen warten auf Freigabe</div>
          </div>
          <Link to="/rewards" style={softLink}>Prüfen <ChevronRight size={14} /></Link>
        </div>
      )}

      {/* Ausgaben diesen Monat — nur für Eltern */}
      {user && !isChild && (
        <div style={{ ...CARD, display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem' }}>
          <span style={iconChip(PINK, 42)}><Wallet size={20} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>AUSGABEN DIESEN MONAT</div>
            <div style={{ fontSize: 'var(--font-xl)', fontWeight: 800, lineHeight: 1.25, whiteSpace: 'nowrap' }}>
              {expenseStats.total.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Top: {expenseStats.topCategory}
            </div>
          </div>
          <Link to="/expenses" aria-label="Ausgaben öffnen" style={{ ...softLink, width: '36px', height: '36px', padding: 0, justifyContent: 'center' }}><ChevronRight size={18} /></Link>
        </div>
      )}

      {/* Letzte Ereignisse */}
      <div style={CARD}>
        {sectionHeader(<History size={18} />, GREEN_TEXT, 'Letzte Ereignisse')}
        {events.length === 0 ? (
          <div style={{ padding: '1.5rem 0 0.5rem', textAlign: 'center', fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', marginTop: '0.5rem' }}>
            Noch keine Aktivität – sobald etwas eingetragen wird, erscheint es hier.
          </div>
        ) : (
          events.map(ev => {
            const { icon: Icon, color } = KIND_STYLE[ev.kind];
            const who = ev.userId ? users.find(u => u.id === ev.userId) : undefined;
            return (
              <Link
                key={ev.id}
                to={ev.link}
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0', borderTop: '1px solid var(--color-border)', textDecoration: 'none', color: 'inherit' }}
              >
                <span style={iconChip(color, 38)}><Icon size={18} {...(ev.kind === 'stars_earned' ? { fill: 'currentColor' } : {})} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{ev.title}</div>
                  <div style={{ marginTop: '0.1rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                    {who && (
                      <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: who.avatarColor || PRIMARY, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                        <AvatarEmoji emoji={who.avatar} size={16} />
                      </span>
                    )}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {who ? `${who.id} · ` : ''}{ev.subtitle}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {ev.amount !== undefined && (
                    <div style={{ fontSize: 'var(--font-sm)', fontWeight: 800, color: ev.amount >= 0 ? GREEN_TEXT : PINK_TEXT }}>{fmtAmount(ev.amount)}</div>
                  )}
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>{relativeTime(ev.at, now)}</div>
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* Aufgaben */}
      {upcomingTasks.length > 0 && (
        <div style={CARD}>
          {sectionHeader(
            <ListChecks size={18} />, PRIMARY, 'Aufgaben',
            <span style={{ padding: '2px 10px', borderRadius: '999px', background: PRIMARY + '1F', color: PRIMARY, fontSize: 'var(--font-xs)', fontWeight: 800, whiteSpace: 'nowrap' }}>4 Wochen</span>,
          )}

          {/* Filter */}
          <div style={{ display: 'flex', gap: '0.45rem', margin: '0.5rem 0 0.35rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
            {[{ id: '', label: 'Alle', user: undefined as User | undefined }, ...users.map(u => ({ id: u.id, label: u.id, user: u as User | undefined }))].map(opt => {
              const active = taskAssigneeFilter === opt.id;
              return (
                <button
                  key={opt.id || 'all'}
                  type="button"
                  onClick={() => { setTaskAssigneeFilter(opt.id); setShowAllTasks(false); }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0, cursor: 'pointer', fontFamily: 'inherit',
                    padding: opt.user ? '0.25rem 0.8rem 0.25rem 0.25rem' : '0.4rem 0.9rem', borderRadius: '999px', border: 'none',
                    fontSize: 'var(--font-xs)', fontWeight: 800, transition: 'all 0.15s',
                    background: active ? 'linear-gradient(135deg, #3F34C4 0%, #6D5DF0 100%)' : 'var(--color-surface-muted)',
                    color: active ? 'white' : 'var(--color-text-muted)',
                    boxShadow: active ? '0 4px 12px rgba(63,52,196,0.3)' : 'none',
                  }}
                >
                  {opt.user && (
                    <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: opt.user.avatarColor || PRIMARY, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      <AvatarEmoji emoji={opt.user.avatar} size={24} />
                    </span>
                  )}
                  {opt.label}
                </button>
              );
            })}
          </div>

          {filteredTasks.length === 0 ? (
            <div style={{ padding: '1.1rem 0 0.5rem', textAlign: 'center', fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)' }}>
              Keine Aufgaben für diese Auswahl
            </div>
          ) : (
            visibleTasks.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                assignees={task.assignedTo?.length ? users.filter(u => task.assignedTo!.includes(u.id)) : []}
                points={settings.prioPoints[task.priority] || 0}
                canToggle={!isChild}
                onToggle={handleToggleTask}
              />
            ))
          )}
          {filteredTasks.length > TASKS_PREVIEW && moreButton(showAllTasks, filteredTasks.length - TASKS_PREVIEW, () => setShowAllTasks(v => !v))}
          <Link to="/tasks" style={{ ...softLink, display: 'flex', justifyContent: 'center', marginTop: '0.6rem', padding: '0.65rem' }}>
            Alle Aufgaben öffnen <ChevronRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
};
