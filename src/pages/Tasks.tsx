import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';
import type { TaskItem, User } from '../services/mockDb';
import { Plus, Trash2, CheckCircle2, Circle, Calendar, AlertTriangle, User as UserIcon, Edit2, X, Save } from 'lucide-react';

export const Tasks = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'SHARED' | 'PRIVATE'>('SHARED');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [content, setContent] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<1 | 2 | 3>(1);
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [users, setUsers] = useState<User[]>([]);
  
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);

  useEffect(() => {
    const load = () => {
      setTasks(mockDb.getTasks());
      setUsers(mockDb.getUsers());
    };
    load();
    window.addEventListener('db_updated', load);
    return () => window.removeEventListener('db_updated', load);
  }, []);

  const isChild = user?.isChild;
  const assignableUsers = users.filter(u => isChild ? (u.id === user.id || u.isChild) : true);

  useEffect(() => {
    if (isChild && !assignedTo) {
      setAssignedTo(user.id);
    }
  }, [user, isChild, assignedTo]);

  const displayedTasks = tasks
    .filter(t => {
      // KINDERMODUS
      if (isChild) {
        if (!t.assignedTo) return false;
        const assignedUser = users.find(u => u.id === t.assignedTo);
        if (!assignedUser) return false;
        if (assignedUser.id !== user.id && !assignedUser.isChild) return false;
      }

      if (activeTab === 'SHARED') return t.isShared;
      return !t.isShared && t.createdBy === user?.id;
    })
    .sort((a, b) => {
      if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
      
      // Sort by due date (ascending)
      if (a.dueDate && b.dueDate) {
        const dA = new Date(a.dueDate).getTime();
        const dB = new Date(b.dueDate).getTime();
        if (dA !== dB) return dA - dB;
      }
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;

      // Sort by priority (descending, 3=high)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }

      return b.createdAt - a.createdAt;
    });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !user) return;
    
    mockDb.addTask({
      content: content.trim(),
      dueDate: dueDate || undefined,
      priority,
      assignedTo: assignedTo || undefined,
      isShared: activeTab === 'SHARED',
      createdBy: user.id,
    });
    
    setContent('');
    setDueDate('');
    setPriority(1);
    setAssignedTo('');
  };

  const handleDelete = (id: string) => {
    mockDb.deleteTask(id);
  };

  const handleToggle = (id: string) => {
    mockDb.toggleTask(id);
  };

  const handleStartEdit = (task: TaskItem) => {
    setEditingTask({ ...task });
  };

  const handleCancelEdit = () => {
    setEditingTask(null);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editingTask.content.trim()) return;
    
    mockDb.updateTask({ ...editingTask, content: editingTask.content.trim() });
    setEditingTask(null);
  };

  return (
    <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      
      <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--color-surface)', padding: '0.5rem', borderRadius: 'var(--radius-lg)' }}>
        <button 
          className={`btn ${activeTab === 'SHARED' ? 'btn-primary' : ''}`} 
          style={{ flex: 1, backgroundColor: activeTab !== 'SHARED' ? 'transparent' : undefined, color: activeTab !== 'SHARED' ? 'var(--color-text)' : undefined }}
          onClick={() => setActiveTab('SHARED')}
        >
          Gemeinsam
        </button>
        <button 
          className={`btn ${activeTab === 'PRIVATE' ? 'btn-primary' : ''}`} 
          style={{ flex: 1, backgroundColor: activeTab !== 'PRIVATE' ? 'transparent' : undefined, color: activeTab !== 'PRIVATE' ? 'var(--color-text)' : undefined }}
          onClick={() => setActiveTab('PRIVATE')}
        >
          Privat
        </button>
      </div>

      <form onSubmit={handleAdd} className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <input 
          type="text" 
          placeholder="Aufgabe..." 
          className="input-field" 
          value={content} 
          onChange={e => setContent(e.target.value)} 
        />
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <select 
            value={priority} 
            onChange={e => setPriority(Number(e.target.value) as 1|2|3)}
            className="input-field"
            style={{ flex: 1, minWidth: '100px', padding: '0.5rem' }}
          >
            <option value={1}>1 - Hat Zeit</option>
            <option value={2}>2 - Normal</option>
            <option value={3}>3 - Sofort!</option>
          </select>

          <select 
            value={assignedTo} 
            onChange={e => setAssignedTo(e.target.value)}
            className="input-field"
            style={{ flex: 1, minWidth: '120px', padding: '0.5rem' }}
          >
            {!isChild && <option value="">An Alle</option>}
            {assignableUsers.map(u => (
              <option key={u.id} value={u.id}>{u.avatar} {u.id}</option>
            ))}
          </select>

          <input 
            type="date" 
            className="input-field" 
            value={dueDate} 
            onChange={e => setDueDate(e.target.value)} 
            style={{ flex: 1, minWidth: '120px', color: dueDate ? 'var(--color-text)' : 'var(--color-text-muted)', padding: '0.5rem' }}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }} disabled={!content.trim()}>
            <Plus size={20} />
          </button>
        </div>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, overflowY: 'auto' }}>
        {displayedTasks.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: '2rem' }}>Keine Aufgaben vorhanden.</p>
        ) : (
          displayedTasks.map(task => {
            const author = mockDb.getUsers().find(u => u.id === task.createdBy);
            
            if (editingTask?.id === task.id) {
              return (
                <form 
                  key={task.id} 
                  onSubmit={handleSaveEdit} 
                  className="glass-panel" 
                  style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '2px solid var(--color-primary)' }}
                >
                  <input 
                    type="text" 
                    className="input-field" 
                    value={editingTask.content} 
                    onChange={e => setEditingTask({ ...editingTask, content: e.target.value })} 
                    autoFocus
                    required
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <select 
                      value={editingTask.priority} 
                      onChange={e => setEditingTask({ ...editingTask, priority: Number(e.target.value) as 1|2|3 })}
                      className="input-field"
                      style={{ flex: 1, minWidth: '100px', padding: '0.5rem' }}
                    >
                      <option value={1}>1 - Hat Zeit</option>
                      <option value={2}>2 - Normal</option>
                      <option value={3}>3 - Sofort!</option>
                    </select>

                    <select 
                      value={editingTask.assignedTo || ''} 
                      onChange={e => setEditingTask({ ...editingTask, assignedTo: e.target.value || undefined })}
                      className="input-field"
                      style={{ flex: 1, minWidth: '120px', padding: '0.5rem' }}
                    >
                      {!isChild && <option value="">An Alle</option>}
                      {assignableUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.avatar} {u.id}</option>
                      ))}
                    </select>

                    <input 
                      type="date" 
                      className="input-field" 
                      value={editingTask.dueDate || ''} 
                      onChange={e => setEditingTask({ ...editingTask, dueDate: e.target.value || undefined })} 
                      style={{ flex: 1, minWidth: '120px', padding: '0.5rem' }}
                    />
                    
                    <button type="button" onClick={handleCancelEdit} className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                      <X size={20} />
                    </button>
                    <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }} disabled={!editingTask.content.trim()}>
                      <Save size={20} />
                    </button>
                  </div>
                </form>
              );
            }

            return (
              <div 
                key={task.id} 
                className="glass-panel" 
                style={{ 
                  padding: '1rem 1rem 0.5rem 1rem', 
                  display: 'flex', 
                  flexDirection: 'column',
                  gap: '0.5rem',
                  opacity: task.isDone ? 0.6 : 1,
                  transition: 'opacity 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button 
                    onClick={!isChild ? () => handleToggle(task.id) : undefined} 
                    style={{ 
                      color: task.isDone ? 'var(--color-success)' : 'var(--color-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0.25rem',
                      cursor: !isChild ? 'pointer' : 'default',
                      opacity: !isChild ? 1 : 0.8
                    }}
                  >
                    {task.isDone ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                  </button>
                  
                  <div style={{ 
                    flex: 1, 
                    textDecoration: task.isDone ? 'line-through' : 'none',
                    color: task.isDone ? 'var(--color-text-muted)' : 'var(--color-text)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}>
                    <span style={{ fontWeight: task.priority === 3 && !task.isDone ? 600 : 400 }}>{task.content}</span>
                  </div>

                  {!isChild && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.25rem' }}>
                      <button onClick={() => handleStartEdit(task)} style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', padding: '0.25rem', cursor: 'pointer' }} title="Bearbeiten">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(task.id)} style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', padding: '0.25rem', cursor: 'pointer' }} title="Löschen">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '0.25rem', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.25rem',
                      color: task.priority === 3 ? 'var(--color-danger)' : task.priority === 2 ? 'var(--color-primary-light)' : 'inherit'
                    }}>
                      <AlertTriangle size={12} /> Prio {task.priority}
                    </span>
                    {task.dueDate && (
                      <span style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.25rem',
                        color: task.isDone ? 'inherit' : (new Date(task.dueDate) < new Date(new Date().setHours(0,0,0,0)) ? 'var(--color-danger)' : 'var(--color-primary)')
                      }}>
                        <Calendar size={12} /> Bis: {new Date(task.dueDate).toLocaleDateString('de-DE')}
                      </span>
                    )}
                    {task.assignedTo && (
                      <span style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.25rem',
                        color: 'var(--color-text)',
                      }}>
                        <UserIcon size={12} /> {task.assignedTo}
                      </span>
                    )}
                  </div>


                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
