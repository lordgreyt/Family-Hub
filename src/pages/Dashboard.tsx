import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';
import type { NoteItem, TaskItem, User, RewardRequest } from '../services/mockDb';
import { Calendar, AlertTriangle, Filter, Star, Check, X } from 'lucide-react';

export const Dashboard = () => {
  const { user } = useAuth();
  const [recentNotes, setRecentNotes] = useState<NoteItem[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<TaskItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [rewardRequests, setRewardRequests] = useState<RewardRequest[]>([]);
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState<string>('');

  useEffect(() => {
    const loadData = () => {
      const allNotes = mockDb.getNotes().filter(note => note.isShared);
      setRecentNotes(allNotes.slice(0, 3)); // Get top 3

      // Calculate upcoming tasks (4 weeks)
      const fourWeeksFromNow = new Date();
      fourWeeksFromNow.setDate(fourWeeksFromNow.getDate() + 28);
      fourWeeksFromNow.setHours(23, 59, 59, 999);

      const tasks = mockDb.getTasks().filter(t => {
        // Show shared tasks or personal tasks
        const hasAccess = t.isShared || t.createdBy === user?.id;
        if (!hasAccess || t.isDone) return false;
        if (!t.dueDate) return true; // Keep tasks without due date
        
        const due = new Date(t.dueDate);
        return due <= fourWeeksFromNow;
      }).sort((a, b) => {
        // Sort by priority first
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        
        // Inside same priority group:
        if (!a.dueDate && !b.dueDate) return 0;
        // Items without due date go to the bottom of their priority group
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        
        // Both have due date, sort ascending by date
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
      
      setUpcomingTasks(tasks);
      setUsers(mockDb.getUsers());
      setRewardRequests(mockDb.getRewardRequests().filter(r => r.status === 'PENDING'));
    };
    
    loadData();
    window.addEventListener('db_updated', loadData);
    return () => window.removeEventListener('db_updated', loadData);
  }, []);

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Offene Belohnungs-Anfragen (nur für Eltern) */}
      {!user?.isChild && rewardRequests.length > 0 && (
        <div className="glass-panel" style={{ padding: '1rem', border: '2px solid #f59e0b' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#d97706' }}>
            <Star size={20} fill="#f59e0b" /> Offene Sternen-Anfragen
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {rewardRequests.map(req => {
              const reqUser = users.find(u => u.id === req.childId);
              return (
                <div key={req.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <strong>{reqUser?.avatar} {reqUser?.id}</strong> möchte <strong>{req.stars} Sterne</strong> einlösen.
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => mockDb.updateRewardRequest({ ...req, status: 'REJECTED' })} className="btn btn-secondary" style={{ padding: '0.5rem', color: 'var(--color-danger)' }}>
                      <X size={16} /> Abweisen
                    </button>
                    <button onClick={() => mockDb.updateRewardRequest({ ...req, status: 'APPROVED' })} className="btn btn-primary" style={{ padding: '0.5rem', backgroundColor: '#f59e0b', color: 'white', border: 'none' }}>
                      <Check size={16} /> Bestätigen
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {upcomingTasks.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: 'var(--font-lg)', color: 'var(--color-primary-dark)' }}>
              Aufgaben (Top 4 Wochen)
            </h3>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
            <button
              onClick={() => setTaskAssigneeFilter('')}
              style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px',
                border: '1px solid var(--color-border)',
                backgroundColor: taskAssigneeFilter === '' ? 'var(--color-primary)' : 'var(--color-surface)',
                color: taskAssigneeFilter === '' ? 'white' : 'var(--color-text)',
                fontSize: 'var(--font-sm)',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              <Filter size={14} /> Alle Profile
            </button>
            {users.map(u => (
              <button
                key={u.id}
                onClick={() => setTaskAssigneeFilter(u.id)}
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '9999px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: taskAssigneeFilter === u.id ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: taskAssigneeFilter === u.id ? 'white' : 'var(--color-text)',
                  fontSize: 'var(--font-sm)',
                  whiteSpace: 'nowrap'
                }}
              >
                {u.avatar} {u.id}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {upcomingTasks.filter(t => !taskAssigneeFilter || t.assignedTo === taskAssigneeFilter).map(task => {
              const overdue = task.dueDate ? new Date(task.dueDate) < new Date(new Date().setHours(0,0,0,0)) : false;
              return (
                <div key={task.id} className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ fontWeight: task.priority === 3 ? 600 : 400 }}>{task.content}</div>
                    {task.assignedTo && (
                      <div style={{ fontSize: '1rem', opacity: 0.8 }} title={`Zugewiesen an ${task.assignedTo}`}>
                        {users.find(u => u.id === task.assignedTo)?.avatar}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: 'var(--font-xs)' }}>
                    <span style={{ color: task.priority === 3 ? 'var(--color-danger)' : task.priority === 2 ? 'var(--color-primary-light)' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      <AlertTriangle size={12} /> {task.priority}
                    </span>
                    {task.dueDate ? (
                      <span style={{ color: overdue ? 'var(--color-danger)' : 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        <Calendar size={12} /> {new Date(task.dueDate).toLocaleDateString('de-DE')}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        <Calendar size={12} /> Zeitlich flexibel
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {upcomingTasks.filter(t => !taskAssigneeFilter || t.assignedTo === taskAssigneeFilter).length === 0 && (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)', fontStyle: 'italic' }}>
                Keine Aufgaben für diese Zuordnung gefunden.
              </p>
            )}
          </div>
        </div>
      )}

      <div>
        <h3 style={{ marginBottom: '1rem', fontSize: 'var(--font-lg)', color: 'var(--color-primary-dark)' }}>
          Letzte gemeinsame Notizen
        </h3>
        {recentNotes.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>Noch keine Notizen.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {recentNotes.map(note => {
              const author = mockDb.getUsers().find(u => u.id === note.createdBy);
              return (
                <div key={note.id} className="glass-panel" style={{ padding: '1rem 1rem 0.5rem 1rem' }}>
                  <div 
                    className="rich-text-content"
                    style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', paddingBottom: '0.25rem' }}
                    dangerouslySetInnerHTML={{ __html: note.content }} 
                  />
                  <div style={{ marginTop: '0.25rem', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                    <span style={{ fontSize: '1rem', lineHeight: 1 }}>{author?.avatar}</span>
                    <span style={{ fontWeight: 500 }}>{author?.id || note.createdBy}</span>
                    <span>&bull;</span>
                    <span>{new Date(note.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
