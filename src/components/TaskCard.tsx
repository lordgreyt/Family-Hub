import { useState, useRef, useEffect, useCallback } from 'react';
import { Check, CircleDashed } from 'lucide-react';
import type { TaskItem, User } from '../services/mockDb';

interface TaskCardProps {
  task: TaskItem;
  /** The user this task is assigned to (for avatar display). If multiple, shows first. Falls back to creator. */
  assignee?: User;
  /** Whether to show the done/undone toggle button on the right */
  showToggle?: boolean;
  /** Whether the user can toggle */
  canToggle?: boolean;
  onToggle?: (task: TaskItem) => void;
  onEdit?: (task: TaskItem) => void;
  onDelete?: (task: TaskItem) => void;
}

const LONG_PRESS_MS = 500;

export const TaskCard = ({
  task,
  assignee,
  showToggle = false,
  canToggle = false,
  onToggle,
  onEdit,
  onDelete,
}: TaskCardProps) => {
  const [showActions, setShowActions] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hasActions = !!(onEdit || onDelete);

  // Long-press handlers
  const startPress = useCallback(() => {
    if (!hasActions) return;
    pressTimer.current = setTimeout(() => {
      setShowActions(true);
    }, LONG_PRESS_MS);
  }, [hasActions]);

  const cancelPress = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  // Close actions when clicking outside
  useEffect(() => {
    if (!showActions) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setShowActions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showActions]);

  const handleCardClick = () => {
    if (showActions) {
      setShowActions(false);
      return;
    }
    // Card click does NOT toggle — only the status circle does
  };

  const handleEdit = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setShowActions(false);
    onEdit?.(task);
  };

  const handleDelete = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setShowActions(false);
    onDelete?.(task);
  };

  const handleToggle = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (showActions) { setShowActions(false); return; }
    if (canToggle && onToggle) onToggle(task);
  };

  return (
    <div ref={cardRef} style={{ position: 'relative' }}>
      {/* Action Popover (long press) */}
      {showActions && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: '1rem',
          marginTop: '0.25rem',
          zIndex: 50,
          backgroundColor: '#FFFFFF',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 24px rgba(20, 25, 50, 0.15)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
          animation: 'slideDown 0.15s ease',
          minWidth: '160px',
        }}>
          {onEdit && (
            <button
              onClick={handleEdit}
              onTouchEnd={handleEdit}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                width: '100%',
                padding: '0.7rem 1rem',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 'var(--font-sm)',
                fontWeight: 500,
                color: 'var(--color-text)',
                borderBottom: onDelete ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                <path d="m15 5 4 4"/>
              </svg>
              Bearbeiten
            </button>
          )}
          {onDelete && (
            <button
              onClick={handleDelete}
              onTouchEnd={handleDelete}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                width: '100%',
                padding: '0.7rem 1rem',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 'var(--font-sm)',
                fontWeight: 500,
                color: 'var(--color-danger)',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18"/>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
              Löschen
            </button>
          )}
        </div>
      )}

      {/* Main Card */}
      <div
        onClick={handleCardClick}
        onMouseDown={startPress}
        onMouseUp={cancelPress}
        onMouseLeave={cancelPress}
        onTouchStart={startPress}
        onTouchEnd={e => {
          cancelPress();
          if (showActions) e.preventDefault();
        }}
        onTouchMove={cancelPress}
        onContextMenu={e => e.preventDefault()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          width: '100%',
          minHeight: '64px',
          padding: '0.65rem 0.85rem',
          backgroundColor: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          cursor: hasActions ? 'pointer' : 'default',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          opacity: task.isDone ? 0.6 : 1,
          userSelect: 'none',
        }}
      >
        {/* Left: User avatar circle */}
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          backgroundColor: assignee?.avatarColor || 'var(--color-text-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: '1.1rem',
          lineHeight: 1,
        }}>
          {assignee?.avatar || (
            <CircleDashed size={20} color="#FFFFFF" strokeWidth={2} />
          )}
        </div>

        {/* Middle: Content */}
        <div style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.15rem',
        }}>
          <span style={{
            fontSize: 'var(--font-xs)',
            fontWeight: 600,
            color: task.isDone ? 'var(--color-text-muted)' : 'var(--color-text)',
            textDecoration: task.isDone ? 'line-through' : 'none',
            lineHeight: 1.35,
            wordBreak: 'break-word',
          }}>
            {task.content}
          </span>
          {/* Show name if assigned */}
          {assignee && (
            <span style={{
              fontSize: 'var(--font-xs)',
              fontWeight: 500,
              color: 'var(--color-text-muted)',
            }}>
              {assignee.id}
            </span>
          )}
        </div>

        {/* Right: Day + Month + Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          flexShrink: 0,
          marginLeft: '0.35rem',
        }}>
          {/* Day + Month column */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.05rem',
            minWidth: '22px',
          }}>
            {task.dueDate ? (
              <span style={{
                fontSize: 'var(--font-base)',
                fontWeight: 700,
                color: 'var(--color-text)',
                lineHeight: 1,
              }}>
                {new Date(task.dueDate).getDate()}
              </span>
            ) : (
              <span style={{ fontSize: 'var(--font-base)', fontWeight: 700, color: 'var(--color-text-tertiary)', lineHeight: 1 }}>—</span>
            )}
            {task.dueDate ? (
              <span style={{
                fontSize: '0.6rem',
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                lineHeight: 1,
              }}>
                {new Date(task.dueDate).toLocaleDateString('de-DE', { month: 'short' }).replace('.', '')}
              </span>
            ) : (
              <span style={{ fontSize: '0.6rem', color: 'var(--color-text-tertiary)', lineHeight: 1 }}>—</span>
            )}
          </div>

          {/* Status circle */}
          {showToggle && (
            <button
              onClick={handleToggle}
              onTouchEnd={handleToggle}
              onTouchStart={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
              style={{
                background: 'none',
                border: 'none',
                cursor: canToggle ? 'pointer' : 'default',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={task.isDone ? 'Als unerledigt markieren' : 'Als erledigt markieren'}
            >
              {task.isDone ? (
                <div style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-green)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Check size={13} color="#FFFFFF" strokeWidth={3} />
                </div>
              ) : (
                <div style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  border: '2px solid var(--color-border-hover)',
                }} />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
