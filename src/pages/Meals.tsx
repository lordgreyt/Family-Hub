import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';
import type { MealTemplate, MealPlanItem, User } from '../services/mockDb';
import { Plus, Check, X, Calendar, Utensils, Trash2 } from 'lucide-react';

export const Meals = () => {
  const { user } = useAuth();
  
  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [planItems, setPlanItems] = useState<MealPlanItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Add Template State
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MealTemplate | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newEmoji, setNewEmoji] = useState('🍽️');

  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  const isLongPress = React.useRef(false);

  // Request Flow State
  const [selectedTemplate, setSelectedTemplate] = useState<MealTemplate | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');

  useEffect(() => {
    const load = () => {
      setTemplates(mockDb.getMealTemplates());
      setPlanItems(mockDb.getMealPlanItems());
      setUsers(mockDb.getUsers());
    };
    load();
    window.addEventListener('db_updated', load);
    return () => window.removeEventListener('db_updated', load);
  }, []);

  const isChild = user?.isChild || false;

  // Next 7 days
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d;
  });

  const formatDate = (d: Date) => {
    // Correctly format string using local timezone
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const getDayName = (d: Date, withDate = false) => {
    const isToday = d.getTime() === today.getTime();
    if (isToday) return 'Heute';
    const dayName = d.toLocaleDateString('de-DE', { weekday: 'long' });
    if (withDate) return `${dayName}, ${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`;
    return dayName;
  };

  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !user) return;
    mockDb.addMealTemplate({
      title: newTitle.trim(),
      emoji: newEmoji,
      createdBy: user.id,
    });
    setNewTitle('');
    setNewEmoji('🍽️');
    setIsAddingTemplate(false);
  };

  const handleUpdateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate || !newTitle.trim()) return;
    mockDb.updateMealTemplate({
      ...editingTemplate,
      title: newTitle.trim(),
      emoji: newEmoji,
    });
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = () => {
    if (editingTemplate) {
      mockDb.deleteMealTemplate(editingTemplate.id);
      setEditingTemplate(null);
    }
  };

  const startPress = (t: MealTemplate) => {
    isLongPress.current = false;
    timerRef.current = setTimeout(() => {
      isLongPress.current = true;
      setEditingTemplate(t);
      setNewTitle(t.title);
      setNewEmoji(t.emoji);
      setIsAddingTemplate(false);
      setSelectedTemplate(null);
    }, 600);
  };

  const cancelPress = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleClickTemplate = (e: React.MouseEvent, t: MealTemplate) => {
    cancelPress();
    e.preventDefault();
    if (isLongPress.current) return;
    
    setSelectedTemplate(t);
    setSelectedDate('');
    setEditingTemplate(null);
    setIsAddingTemplate(false);
  };

  const handleSubmitRequest = () => {
    if (!selectedTemplate || !selectedDate || !user) return;
    
    mockDb.addMealPlanItem({
      templateId: selectedTemplate.id,
      date: selectedDate,
      status: isChild ? 'PENDING' : 'APPROVED',
      requestedBy: user.id
    });

    setSelectedTemplate(null);
    setSelectedDate('');
  };

  const pendingRequests = planItems.filter(item => item.status === 'PENDING');

  const handleApprove = (item: MealPlanItem) => {
    mockDb.updateMealPlanItem({ ...item, status: 'APPROVED' });
  };

  const handleDeleteItem = (id: string) => {
    mockDb.deleteMealPlanItem(id);
  };

  return (
    <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflowY: 'auto' }}>
      
      {/* Pending Requests for Adults */}
      {!isChild && pendingRequests.length > 0 && (
        <div className="glass-panel" style={{ padding: '1rem', border: '2px solid var(--color-primary)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--color-primary-dark)' }}>
            <Utensils size={20} /> Offene Mahlzeiten-Anfragen
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pendingRequests.map(req => {
              const reqUser = users.find(u => u.id === req.requestedBy);
              const template = templates.find(t => t.id === req.templateId);
              const d = new Date(req.date);
              if (!template) return null;

              return (
                <div key={req.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <strong>{reqUser?.avatar} {reqUser?.id}</strong> wünscht sich <span style={{ fontSize: '1.2rem' }}>{template.emoji}</span> <strong>{template.title}</strong> am {getDayName(d)}.
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => handleDeleteItem(req.id)} className="btn btn-secondary" style={{ padding: '0.5rem', color: 'var(--color-danger)' }}>
                      <X size={16} />
                    </button>
                    <button onClick={() => handleApprove(req)} className="btn btn-primary" style={{ padding: '0.5rem' }}>
                      <Check size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Meal Templates */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--color-text)' }}>Gerichte auswählen</h3>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          {templates.map(t => (
            <button
              key={t.id}
              onClick={(e) => handleClickTemplate(e, t)}
              onMouseDown={() => startPress(t)}
              onMouseUp={cancelPress}
              onMouseLeave={cancelPress}
              onTouchStart={() => startPress(t)}
              onTouchEnd={cancelPress}
              onContextMenu={(e) => { e.preventDefault(); cancelPress(); }}
              className="btn"
              style={{
                backgroundColor: selectedTemplate?.id === t.id ? 'var(--color-primary)' : 'var(--color-surface-hover)',
                color: selectedTemplate?.id === t.id ? 'white' : 'var(--color-text)',
                padding: '0.5rem 1rem',
                border: selectedTemplate?.id === t.id ? '2px solid var(--color-primary-dark)' : '1px solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.25rem',
                minWidth: '80px',
                userSelect: 'none',
                WebkitUserSelect: 'none'
              }}
            >
              <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{t.emoji}</span>
              <span style={{ fontSize: 'var(--font-xs)', fontWeight: 500 }}>{t.title}</span>
            </button>
          ))}
          
          <button 
            onClick={() => { setIsAddingTemplate(!isAddingTemplate); setEditingTemplate(null); setNewTitle(''); setNewEmoji('🍽️'); }} 
            className="btn"
            style={{ padding: '0.5rem 1rem', border: '1px dashed var(--color-border)', flexDirection: 'column', color: 'var(--color-text-muted)', minWidth: '80px', backgroundColor: 'transparent' }}
          >
            <Plus size={24} />
            <span style={{ fontSize: 'var(--font-xs)' }}>Neu</span>
          </button>
        </div>

        {(isAddingTemplate || editingTemplate) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--color-surface)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ color: 'var(--color-text)', margin: 0, display: 'flex', justifyContent: 'space-between' }}>
              <span>{editingTemplate ? 'Gericht bearbeiten' : 'Neues Gericht anlegen'}</span>
              <button 
                onClick={() => { setIsAddingTemplate(false); setEditingTemplate(null); }} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                <X size={16} />
              </button>
            </h4>
            <form onSubmit={editingTemplate ? handleUpdateTemplate : handleCreateTemplate} style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                className="input-field" 
                placeholder="🍔" 
                value={newEmoji} 
                onChange={e => setNewEmoji(e.target.value)}
                style={{ width: '60px', padding: '0.5rem', textAlign: 'center', fontSize: '1.2rem' }} 
                maxLength={3}
              />
              <input 
                type="text" 
                className="input-field" 
                placeholder="Titel (z.B. Burger)" 
                value={newTitle} 
                onChange={e => setNewTitle(e.target.value)}
                style={{ flex: 1, padding: '0.5rem' }} 
                required
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }} disabled={!newTitle.trim()}>
                <Check size={16} />
              </button>
              {editingTemplate && (
                <button type="button" onClick={handleDeleteTemplate} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', color: 'var(--color-danger)' }}>
                  <Trash2 size={16} />
                </button>
              )}
            </form>

            <div>
              <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Oder Symbol hier direkt auswählen:</p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', maxHeight: '120px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                {['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶', '🌽', '🥕', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🧆', '🌮', '🌯', '🥗', '🥘', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🥛', '🍼', '☕', '🍵', '🧃', '🥤', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊'].map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setNewEmoji(emoji)}
                    style={{
                      background: newEmoji === emoji ? 'var(--color-primary-transparent)' : 'var(--color-surface-hover)',
                      border: newEmoji === emoji ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '1.25rem',
                      padding: '0.25rem',
                      cursor: 'pointer',
                      minWidth: '40px',
                      display: 'flex',
                      justifyContent: 'center'
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Request Flow Form */}
        {selectedTemplate && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--color-surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <h4 style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--color-text)' }}>
              <span>Wann gibt es <span style={{ fontSize: '1.2rem' }}>{selectedTemplate.emoji}</span> {selectedTemplate.title}?</span>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                {!isChild && (
                  <button 
                    title="Gericht endgültig löschen" 
                    onClick={() => {
                      if (confirm(`Möchtest du das Gericht "${selectedTemplate.title}" wirklich aus der Liste löschen?`)) {
                        mockDb.deleteMealTemplate(selectedTemplate.id);
                        setSelectedTemplate(null);
                      }
                    }} 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', display: 'flex', alignItems: 'center' }}
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                <button title="Abbrechen" onClick={() => setSelectedTemplate(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}>
                  <X size={20} />
                </button>
              </div>
            </h4>
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'none' }}>
              {next7Days.map(d => {
                const dateStr = formatDate(d);
                const isSel = selectedDate === dateStr;
                return (
                  <button 
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`btn ${isSel ? 'btn-primary' : ''}`}
                    style={{ 
                      flexShrink: 0, 
                      padding: '0.5rem 1rem',
                      backgroundColor: !isSel ? 'var(--color-surface)' : undefined,
                      color: !isSel ? 'var(--color-text)' : undefined,
                      border: !isSel ? '1px solid var(--color-border)' : undefined
                    }}
                  >
                    {getDayName(d)}
                  </button>
                );
              })}
            </div>
            
            {selectedDate && (
              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={handleSubmitRequest} className="btn btn-primary" style={{ width: '100%', padding: '0.75rem' }}>
                  {isChild ? 'Papa/Mama anfragen' : 'Eintragen'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 7-Days Timeline */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text)' }}>
          <Calendar size={20} /> Die nächsten 7 Tage
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {next7Days.map((d, idx) => {
            const dateStr = formatDate(d);
            const dayItems = planItems.filter(i => i.date === dateStr);
            const isToday = idx === 0;

            return (
              <div key={dateStr} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', paddingBottom: '1rem', borderBottom: idx < 6 ? '1px solid var(--color-border)' : 'none' }}>
                <div style={{ minWidth: '80px' }}>
                  <strong style={{ display: 'block', color: isToday ? 'var(--color-primary)' : 'var(--color-text)' }}>{getDayName(d)}</strong>
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>{d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</span>
                </div>
                
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {dayItems.length === 0 ? (
                    <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: 'var(--font-sm)', padding: '0.25rem 0' }}>Noch nichts geplant</span>
                  ) : (
                    dayItems.map(item => {
                      const template = templates.find(t => t.id === item.templateId);
                      const reqUser = users.find(u => u.id === item.requestedBy);
                      const isPending = item.status === 'PENDING';
                      
                      if (!template) return null;

                      // Display logic
                      const canDelete = !isChild || (isChild && isPending && item.requestedBy === user?.id);

                      return (
                        <div key={item.id} style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          background: 'var(--color-surface-hover)', 
                          padding: '0.5rem 0.75rem', 
                          borderRadius: 'var(--radius-md)',
                          opacity: isPending ? 0.5 : 1,
                          border: isPending ? '1px dashed var(--color-text-muted)' : '1px solid transparent'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{template.emoji}</span>
                            <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{template.title}</span>
                            {isPending && <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', marginLeft: '0.5rem' }}>(Anfrage von {reqUser?.avatar})</span>}
                          </div>
                          
                          {canDelete && (
                            <button title="Löschen" onClick={() => handleDeleteItem(item.id)} style={{ color: 'var(--color-danger)', border: 'none', background: 'none', cursor: 'pointer', padding: '0.25rem', display: 'flex' }}>
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Bottom padding for mobile nav */}
      <div style={{ height: '4rem' }}></div>
      
    </div>
  );
};
