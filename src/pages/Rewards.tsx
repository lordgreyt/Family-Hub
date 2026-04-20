import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';
import type { TaskItem, RewardRequest, ScoreEntry, User } from '../services/mockDb';
import { Star, Clock, Send, ShieldAlert, History, Gamepad2, Play, Trophy } from 'lucide-react';
import { SnakeGame } from '../components/SnakeGame';
import { MemoryGame } from '../components/MemoryGame';
import { FlappyGame } from '../components/FlappyGame';
import { WhackAMoleGame } from '../components/WhackAMoleGame';

export const Rewards = () => {
  const { user } = useAuth();
  
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [requests, setRequests] = useState<RewardRequest[]>([]);
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  const [exchangeAmount, setExchangeAmount] = useState<number | ''>('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [activeGame, setActiveGame] = useState<'SNAKE' | 'MEMORY' | 'FLAPPY' | 'WHACKAMO' | null>(null);

  useEffect(() => {
    const load = () => {
      setTasks(mockDb.getTasks());
      setRequests(mockDb.getRewardRequests());
      setLeaderboard(mockDb.getLeaderboard());
      setUsers(mockDb.getUsers());
    };
    load();
    window.addEventListener('db_updated', load);
    return () => window.removeEventListener('db_updated', load);
  }, []);

  if (!user || (!user.isChild && !user.isAdmin)) return null;

  // Calculate points
  const PRIO_STARS = { 1: 5, 2: 10, 3: 15 };
  
  const completedTasks = tasks.filter(t => t.isDone && t.assignedTo === user.id);
  
  const earnedStars = completedTasks.reduce((sum, t) => sum + PRIO_STARS[t.priority], 0);
  
  const myRequests = requests.filter(r => r.childId === user.id);
  const spentOrPendingStars = myRequests
    .filter(r => r.status !== 'REJECTED')
    .reduce((sum, r) => sum + r.stars, 0);

  const balance = earnedStars - spentOrPendingStars;

  const handleRequest = () => {
    if (exchangeAmount === '' || exchangeAmount <= 0) return;
    if (exchangeAmount > balance) return;
    setShowConfirm(true);
  };
  
  const confirmRequest = () => {
    mockDb.addRewardRequest({
      childId: user.id,
      stars: Number(exchangeAmount),
      status: 'PENDING'
    });
    setExchangeAmount('');
    setShowConfirm(false);
  };

  const deductPlayCost = () => {
    if (balance < 5) return false;
    mockDb.addRewardRequest({ childId: user.id, stars: 5, status: 'APPROVED' });
    return true;
  };

  const handlePlayGame = (gameId: 'SNAKE' | 'MEMORY' | 'FLAPPY' | 'WHACKAMO') => {
    if (deductPlayCost()) {
      setActiveGame(gameId);
    } else {
      alert("Nicht genug Sterne! Du brauchst 5 Sterne, um eine Runde zu spielen.");
    }
  };

  const handleReplay = () => {
    if (!deductPlayCost()) {
      alert("Nicht genug Sterne für eine weitere Runde!");
      setActiveGame(null);
    }
  };

  const handleSaveScore = (gameId: string, score: number, lowerIsBetter: boolean = false) => {
    mockDb.updateHighScore({ gameId, childId: user.id, score }, lowerIsBetter);
  };

  const getHighScore = (gameId: string, lowerIsBetter: boolean = false) => {
      const scores = leaderboard.filter(e => e.gameId === gameId);
      if (scores.length === 0) return 0;
      return lowerIsBetter 
        ? Math.min(...scores.map(s => s.score))
        : Math.max(...scores.map(s => s.score));
  };

  const renderLeaderboardRows = (gameId: string, lowerIsBetter: boolean = false) => {
      let scores = leaderboard.filter(e => e.gameId === gameId);
      if (scores.length === 0) return <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)' }}>Noch keine Rekorde.</p>;
      
      scores.sort((a, b) => lowerIsBetter ? a.score - b.score : b.score - a.score);
      
      return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {scores.map((s, idx) => {
                  const u = users.find(usr => usr.id === s.childId);
                  return (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-sm)' }}>
                          <span>{idx === 0 ? '👑 ' : ''}{u?.avatar || '👤'} {u?.id || s.childId}</span>
                          <span style={{ fontWeight: idx === 0 ? 'bold' : 'normal', color: idx === 0 ? '#f59e0b' : 'inherit' }}>{s.score}</span>
                      </div>
                  );
              })}
          </div>
      );
  };

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', overflowY: 'auto' }}>
      
      {activeGame === 'SNAKE' && <SnakeGame onExit={() => setActiveGame(null)} onReplay={handleReplay} onSaveScore={(s) => handleSaveScore('SNAKE', s)} highScore={getHighScore('SNAKE')} />}
      {activeGame === 'MEMORY' && <MemoryGame onExit={() => setActiveGame(null)} onReplay={handleReplay} onSaveScore={(s) => handleSaveScore('MEMORY', s, true)} highScore={getHighScore('MEMORY', true)} />}
      {activeGame === 'FLAPPY' && <FlappyGame onExit={() => setActiveGame(null)} onReplay={handleReplay} onSaveScore={(s) => handleSaveScore('FLAPPY', s)} highScore={getHighScore('FLAPPY')} />}
      {activeGame === 'WHACKAMO' && <WhackAMoleGame onExit={() => setActiveGame(null)} onReplay={handleReplay} onSaveScore={(s) => handleSaveScore('WHACKAMO', s)} highScore={getHighScore('WHACKAMO')} />}
      
      {/* Header / Balance */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'linear-gradient(135deg, rgba(255,193,7,0.2) 0%, rgba(255,152,0,0.1) 100%)' }}>
        <h2 style={{ fontSize: '1.2rem', color: 'var(--color-primary-dark)', marginBottom: '0.5rem' }}>Dein Sternenkonto</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '3rem', fontWeight: 800, color: '#f59e0b', textShadow: '0 2px 10px rgba(245, 158, 11, 0.3)' }}>
          <Star size={48} fill="#f59e0b" /> {balance}
        </div>
      </div>

      {/* Spielecke */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Gamepad2 size={20} /> Arcade-Halle
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          
          <div style={{ background: 'var(--color-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem' }}>🐍</div>
            <strong style={{ fontSize: 'var(--font-sm)' }}>Snake</strong>
            <button 
                onClick={() => handlePlayGame('SNAKE')} 
                className="btn btn-primary" 
                disabled={balance < 5}
                style={{ width: '100%', marginTop: 'auto', display: 'flex', gap: '0.25rem', justifyContent: 'center' }}
            >
                <Play size={14} /> 5 <Star size={12} fill="currentColor" />
            </button>
          </div>

          <div style={{ background: 'var(--color-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem' }}>🧩</div>
            <strong style={{ fontSize: 'var(--font-sm)' }}>Memory</strong>
            <button 
                onClick={() => handlePlayGame('MEMORY')} 
                className="btn btn-primary" 
                disabled={balance < 5}
                style={{ width: '100%', marginTop: 'auto', display: 'flex', gap: '0.25rem', justifyContent: 'center' }}
            >
                <Play size={14} /> 5 <Star size={12} fill="currentColor" />
            </button>
          </div>

          <div style={{ background: 'var(--color-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem' }}>🐦</div>
            <strong style={{ fontSize: 'var(--font-sm)' }}>Flappy</strong>
            <button 
                onClick={() => handlePlayGame('FLAPPY')} 
                className="btn btn-primary" 
                disabled={balance < 5}
                style={{ width: '100%', marginTop: 'auto', display: 'flex', gap: '0.25rem', justifyContent: 'center' }}
            >
                <Play size={14} /> 5 <Star size={12} fill="currentColor" />
            </button>
          </div>

          <div style={{ background: 'var(--color-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem' }}>🔨</div>
            <strong style={{ fontSize: 'var(--font-sm)' }}>Fangen</strong>
            <button 
                onClick={() => handlePlayGame('WHACKAMO')} 
                className="btn btn-primary" 
                disabled={balance < 5}
                style={{ width: '100%', marginTop: 'auto', display: 'flex', gap: '0.25rem', justifyContent: 'center' }}
            >
                <Play size={14} /> 5 <Star size={12} fill="currentColor" />
            </button>
          </div>

        </div>
        <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', marginTop: '1rem', textAlign: 'center' }}>
          Jede gespielte Runde kostet 5 Sterne.
        </p>
      </div>

      {/* Leaderboard */}
      <div className="glass-panel" style={{ padding: '1.5rem', backgroundColor: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
        <h3 style={{ marginBottom: '1rem', color: '#d97706', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Trophy size={20} /> Die Wall of Fame
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            
            <div style={{ background: 'var(--color-surface)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                <strong style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.5rem' }}>🐍 SNAKE</strong>
                {renderLeaderboardRows('SNAKE')}
            </div>

            <div style={{ background: 'var(--color-surface)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                <strong style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.5rem' }}>🧩 MEMORY</strong>
                {renderLeaderboardRows('MEMORY', true)}
            </div>

            <div style={{ background: 'var(--color-surface)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                <strong style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.5rem' }}>🐦 FLAPPY</strong>
                {renderLeaderboardRows('FLAPPY')}
            </div>

            <div style={{ background: 'var(--color-surface)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                <strong style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.5rem' }}>🔨 FANGEN</strong>
                {renderLeaderboardRows('WHACKAMO')}
            </div>

        </div>
      </div>

      {/* Exchange Form */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={20} /> Medienzeit eintauschen
        </h3>
        
        <div style={{ background: 'var(--color-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <strong style={{ fontSize: 'var(--font-sm)' }}>Umtausch-Formel:</strong>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-sm)', padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
            <span>15 <Star size={12} fill="#f59e0b" color="#f59e0b" style={{ display: 'inline' }}/></span>
            <span>= 5 Minuten</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-sm)', padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
            <span>30 <Star size={12} fill="#f59e0b" color="#f59e0b" style={{ display: 'inline' }}/></span>
            <span>= 10 Minuten</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-sm)', padding: '0.5rem' }}>
            <span>100 <Star size={12} fill="#f59e0b" color="#f59e0b" style={{ display: 'inline' }}/></span>
            <span>= 45 Minuten</span>
          </div>
        </div>

        {!showConfirm ? (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="number"
              className="input-field"
              placeholder="Anzahl Sterne..."
              value={exchangeAmount}
              onChange={(e) => setExchangeAmount(Number(e.target.value) || '')}
              min="1"
              max={balance}
              style={{ flex: 1 }}
            />
            <button 
              onClick={handleRequest} 
              className="btn btn-primary"
              disabled={!exchangeAmount || exchangeAmount <= 0 || exchangeAmount > balance}
            >
              Einlösen <Send size={16} />
            </button>
          </div>
        ) : (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-danger)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <ShieldAlert size={20} /> Sicher?
            </h4>
            <p style={{ fontSize: 'var(--font-sm)', marginBottom: '1rem' }}>
              Willst du wirklich {exchangeAmount} Sterne bei Papa/Mama anfragen?
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn" onClick={() => setShowConfirm(false)} style={{ flex: 1, backgroundColor: 'var(--color-surface)' }}>
                Abbrechen
              </button>
              <button className="btn btn-primary" onClick={confirmRequest} style={{ flex: 1 }}>
                Ja, anfragen!
              </button>
            </div>
          </div>
        )}
        
        {exchangeAmount !== '' && exchangeAmount > balance && (
          <p style={{ color: 'var(--color-danger)', fontSize: 'var(--font-xs)', marginTop: '0.5rem' }}>
            Du hast nicht genug Sterne dafür!
          </p>
        )}
      </div>
      
      {/* Pending Requests Info */}
      {myRequests.some(r => r.status === 'PENDING') && (
        <div className="glass-panel" style={{ padding: '1rem', border: '1px dashed var(--color-primary-light)' }}>
          <h4 style={{ color: 'var(--color-primary-dark)', marginBottom: '0.5rem', fontSize: 'var(--font-sm)' }}>⏳ Warte auf Mama/Papa</h4>
          {myRequests.filter(r => r.status === 'PENDING').map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-sm)', padding: '0.25rem 0' }}>
              <span>Anfrage über {r.stars} Sterne</span>
            </div>
          ))}
        </div>
      )}

      {/* History */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <History size={20} /> Erledigte Aufgaben
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {completedTasks.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>Noch keine Aufgaben erledigt.</p>
          ) : (
            completedTasks.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-surface)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: 'var(--font-sm)', flex: 1 }}>{t.content}</span>
                <span style={{ fontWeight: 600, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  +{PRIO_STARS[t.priority]} <Star size={14} fill="#f59e0b" />
                </span>
              </div>
            ))
          )}
        </div>
      </div>
      
      <div style={{ height: '4rem' }}></div>
    </div>
  );
};
