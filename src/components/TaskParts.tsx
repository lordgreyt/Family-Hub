import { CalendarDays, Check, Star } from 'lucide-react';
import type { TaskItem, User } from '../services/mockDb';
import { AvatarEmoji } from './AvatarEmoji';
import { GREEN, ORANGE, PINK, PINK_TEXT, PRIMARY, BLUE } from './SurgeryFinance/theme';

export type Priority = 1 | 2 | 3;

export const PRIO_COLOR: Record<Priority, string> = { 1: BLUE, 2: ORANGE, 3: PINK };

const pad = (n: number) => String(n).padStart(2, '0');
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const dueInfo = (iso?: string): { label: string; color: string; bg: string } | null => {
  if (!iso) return null;
  const day = iso.slice(0, 10);
  const date = new Date(`${day}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date(`${todayIso()}T12:00:00`);
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  const short = date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }).replace('.', '');
  if (diff < 0) return { label: `Überfällig · ${short}`, color: PINK_TEXT, bg: '#FDE8EF' };
  if (diff === 0) return { label: 'Heute', color: '#C9702F', bg: '#FDEBDD' };
  if (diff === 1) return { label: 'Morgen', color: PRIMARY, bg: '#ECE8FF' };
  return { label: short, color: 'var(--color-text-muted)', bg: 'var(--color-surface-muted)' };
};

export const metaChip = (color: string, bg: string) => ({
  display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '2px 8px', borderRadius: '999px',
  background: bg, color, fontSize: '11px', fontWeight: 800, lineHeight: 1.4, whiteSpace: 'nowrap',
}) as const;

export const Avatars = ({ users }: { users: User[] }) => {
  if (users.length === 0) return null;
  const size = users.length === 1 ? 34 : 28;
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      {users.slice(0, 3).map((u, i) => (
        <span
          key={u.id}
          title={u.id}
          style={{
            width: `${size}px`, height: `${size}px`, borderRadius: '50%', background: u.avatarColor || 'var(--color-text-tertiary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            marginLeft: i > 0 ? '-10px' : 0, border: users.length > 1 ? '2px solid var(--color-surface)' : 'none', zIndex: users.length - i,
          }}
        >
          <AvatarEmoji emoji={u.avatar} size={size} />
        </span>
      ))}
      {users.length > 3 && <span style={{ marginLeft: '4px', fontSize: '11px', fontWeight: 800, color: 'var(--color-text-muted)' }}>+{users.length - 3}</span>}
    </div>
  );
};

interface TaskRowProps {
  task: TaskItem;
  assignees: User[];
  points: number;
  canToggle: boolean;
  onToggle: (task: TaskItem) => void;
  onOpen?: (task: TaskItem) => void;
}

export const TaskRow = ({ task, assignees, points, canToggle, onToggle, onOpen }: TaskRowProps) => {
  const due = task.isDone ? null : dueInfo(task.dueDate);
  const color = PRIO_COLOR[task.priority];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 0', borderTop: '1px solid var(--color-border)', opacity: task.isDone ? 0.62 : 1 }}>
      <button
        type="button"
        onClick={() => onToggle(task)}
        disabled={!canToggle}
        aria-label={task.isDone ? 'Als unerledigt markieren' : 'Als erledigt markieren'}
        style={{
          width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0, padding: 0, fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canToggle ? 'pointer' : 'default',
          border: task.isDone ? 'none' : `2.5px solid ${color}`,
          background: task.isDone ? GREEN : color + '14',
          color: 'white', transition: 'all 0.15s',
        }}
      >
        {task.isDone && <Check size={17} strokeWidth={3} />}
      </button>

      <div
        onClick={onOpen ? () => onOpen(task) : undefined}
        role={onOpen ? 'button' : undefined}
        style={{ flex: 1, minWidth: 0, cursor: onOpen ? 'pointer' : 'default' }}
      >
        <div style={{
          fontSize: 'var(--font-sm)', fontWeight: 700, lineHeight: 1.35, overflowWrap: 'anywhere',
          color: task.isDone ? 'var(--color-text-muted)' : 'var(--color-text)',
          textDecoration: task.isDone ? 'line-through' : 'none',
        }}>
          {task.content}
        </div>
        <div style={{ marginTop: '0.35rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem' }}>
          {due && <span style={metaChip(due.color, due.bg)}><CalendarDays size={11} /> {due.label}</span>}
          <span style={metaChip(color, color + '1F')}>Prio {task.priority}</span>
          {points > 0 && (
            <span style={metaChip('#B9791B', '#FFF2D6')}><Star size={11} fill="currentColor" /> {points}</span>
          )}
        </div>
      </div>

      <Avatars users={assignees} />
    </div>
  );
};
