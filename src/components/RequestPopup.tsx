import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';
import type { MealPlanItem, RewardRequest, User, MealTemplate } from '../services/mockDb';
import { Utensils, Star, Check, X, Bell } from 'lucide-react';

export const RequestPopup = () => {
  const { user } = useAuth();
  const [mealRequests, setMealRequests] = useState<MealPlanItem[]>([]);
  const [starRequests, setStarRequests] = useState<RewardRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    if (!user || user.isChild) return;

    const loadData = () => {
      setMealRequests(mockDb.getMealPlanItems().filter(i => i.status === 'PENDING'));
      setStarRequests(mockDb.getRewardRequests().filter(r => r.status === 'PENDING'));
      setUsers(mockDb.getUsers());
      setTemplates(mockDb.getMealTemplates());
    };

    loadData();
    window.addEventListener('db_updated', loadData);
    return () => window.removeEventListener('db_updated', loadData);
  }, [user]);

  const allRequests = useMemo(() => {
    return [
      ...mealRequests.map(r => ({ ...r, type: 'meal' as const })),
      ...starRequests.map(r => ({ ...r, type: 'star' as const }))
    ].sort((a, b) => b.createdAt - a.createdAt);
  }, [mealRequests, starRequests]);

  if (!user || user.isChild || allRequests.length === 0 || isHidden) return null;

  const handleApproveMeal = (req: MealPlanItem) => {
    mockDb.updateMealPlanItem({ ...req, status: 'APPROVED' });
  };

  const handleRejectMeal = (req: MealPlanItem) => {
    mockDb.deleteMealPlanItem(req.id);
  };

  const handleApproveStar = (req: RewardRequest) => {
    mockDb.updateRewardRequest({ ...req, status: 'APPROVED' });
  };

  const handleRejectStar = (req: RewardRequest) => {
    mockDb.updateRewardRequest({ ...req, status: 'REJECTED' });
  };

  const getDayName = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (d.getTime() === today.getTime()) return 'Heute';
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (d.getTime() === tomorrow.getTime()) return 'Morgen';

    return d.toLocaleDateString('de-DE', { weekday: 'long' });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(8px)',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '450px',
        width: '100%',
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        overflow: 'hidden',
        border: '1px solid var(--color-border)',
        animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        <div style={{
          padding: '1.25rem',
          backgroundColor: 'var(--color-primary)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.2)', 
              borderRadius: '50%', 
              width: '32px', 
              height: '32px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <Bell size={18} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Neue Anfragen ({allRequests.length})</h3>
          </div>
          <button 
            onClick={() => setIsHidden(true)}
            style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.8 }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ 
          padding: '1.25rem', 
          maxHeight: '60vh', 
          overflowY: 'auto', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1rem' 
        }}>
          {allRequests.map((req) => {
            const reqUser = users.find(u => u.id === (req.type === 'meal' ? (req as MealPlanItem).requestedBy : (req as RewardRequest).childId));
            
            if (req.type === 'meal') {
              const mealReq = req as MealPlanItem;
              const template = templates.find(t => t.id === mealReq.templateId);
              if (!template) return null;

              return (
                <div key={req.id} style={{ 
                  backgroundColor: 'var(--color-surface-hover)', 
                  padding: '1rem', 
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                     <span style={{ fontSize: '1.5rem' }}>{reqUser?.avatar || '👤'}</span>
                     <div style={{ display: 'flex', flexDirection: 'column' }}>
                       <span style={{ fontWeight: 700, fontSize: 'var(--font-sm)' }}>{reqUser?.id}</span>
                       <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Mahlzeiten-Anfrage</span>
                     </div>
                  </div>
                  
                  <div style={{ 
                    padding: '0.75rem', 
                    backgroundColor: 'var(--color-surface)', 
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}>
                    <span style={{ fontSize: '1.75rem' }}>{template.emoji}</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 'var(--font-md)' }}>{template.title}</div>
                      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-primary)' }}>Für {getDayName(mealReq.date)}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                    <button 
                      onClick={() => handleRejectMeal(mealReq)}
                      className="btn btn-secondary" 
                      style={{ flex: 1, padding: '0.6rem', color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                    >
                      <X size={16} /> Ablehnen
                    </button>
                    <button 
                      onClick={() => handleApproveMeal(mealReq)}
                      className="btn btn-primary" 
                      style={{ flex: 1, padding: '0.6rem', display: 'flex', gap: '0.4rem', justifyContent: 'center' }}
                    >
                      <Check size={16} /> Bestätigen
                    </button>
                  </div>
                </div>
              );
            } else {
              const starReq = req as RewardRequest;
              return (
                <div key={req.id} style={{ 
                  backgroundColor: 'rgba(245, 158, 11, 0.05)', 
                  padding: '1rem', 
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                     <span style={{ fontSize: '1.5rem' }}>{reqUser?.avatar || '👤'}</span>
                     <div style={{ display: 'flex', flexDirection: 'column' }}>
                       <span style={{ fontWeight: 700, fontSize: 'var(--font-sm)' }}>{reqUser?.id}</span>
                       <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Medienzeit / Sterne</span>
                     </div>
                  </div>

                  <div style={{ 
                    padding: '0.75rem', 
                    backgroundColor: 'var(--color-surface)', 
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem',
                    color: '#f59e0b'
                  }}>
                    <Star size={24} fill="#f59e0b" />
                    <span style={{ fontSize: '1.5rem', fontWeight: 900 }}>{starReq.stars} Sterne</span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                    <button 
                      onClick={() => handleRejectStar(starReq)}
                      className="btn btn-secondary" 
                      style={{ flex: 1, padding: '0.6rem', color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                    >
                      <X size={16} /> Ablehnen
                    </button>
                    <button 
                      onClick={() => handleApproveStar(starReq)}
                      className="btn btn-primary" 
                      style={{ flex: 1, padding: '0.6rem', backgroundColor: '#f59e0b', color: 'white', border: 'none', display: 'flex', gap: '0.4rem', justifyContent: 'center' }}
                    >
                      <Check size={16} /> Bestätigen
                    </button>
                  </div>
                </div>
              );
            }
          })}
        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};
