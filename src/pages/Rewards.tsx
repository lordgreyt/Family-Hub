import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { mockDb } from '../services/mockDb';
import type { TaskItem, RewardRequest, ScoreEntry, User } from '../services/mockDb';
import { Star, Clock, Send, ShieldAlert, History, Gamepad2, Play, Trophy, Check, X, Plus, Minus, Medal, Video, Lock, Unlock } from 'lucide-react';
import { SnakeGame } from '../components/SnakeGame';
import { MemoryGame } from '../components/MemoryGame';
import { FlappyGame } from '../components/FlappyGame';
import { WhackAMoleGame } from '../components/WhackAMoleGame';

export const Rewards = () => {
  const { user } = useAuth();
  const { settings } = useSettings();
  
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [requests, setRequests] = useState<RewardRequest[]>([]);
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  const [exchangeAmount, setExchangeAmount] = useState<number | ''>('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [activeGame, setActiveGame] = useState<'SNAKE' | 'MEMORY' | 'FLAPPY' | 'WHACKAMO' | null>(null);
  
  const [adjustments, setAdjustments] = useState<Record<string, number | ''>>({});
  const [unlockedVideos, setUnlockedVideos] = useState<string[]>([]);
  const [dynamicVideos, setDynamicVideos] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const DEFAULT_GUSTAF_VIDEOS = [
    { id: 'MCRqhNQ1OFA', title: 'Minecraft in den BACKROOMS', duration: 66 },
    { id: 'n36zDjj4tYk', title: 'Minecraft, aber SCHLAFEN ist OP', duration: 31 },
    { id: 'pHCshmwpfO8', title: 'Wenn Minecraft MOBS sich RÄCHEN', duration: 19 },
    { id: '2Mq6nFaVe44', title: 'Minecraft in einem VULKAN', duration: 44 },
    { id: 'W9M4yxaCpOM', title: 'Alles mit GLÜCK verzaubern', duration: 29 },
    { id: 'V7vERR-0QTQ', title: 'FUSSBALL in Minecraft', duration: 19 },
    { id: 'NFoEZ8V2Wto', title: '10 TAGE auf einer BOHRINSEL', duration: 40 },
    { id: 'UUNZSJKT-PY', title: 'Minecraft, aber KEINE BLÖCKE', duration: 28 },
    { id: 'q3hdc69W9bM', title: 'REALISTISCHE FARM gebaut', duration: 36 },
    { id: '72tQV-gX4eo', title: '48 SELTSAME Minecraft MYTHEN', duration: 31 }
  ];

  const displayVideos = dynamicVideos.length > 0 ? dynamicVideos : DEFAULT_GUSTAF_VIDEOS;

  const fetchLatestVideos = async () => {
    if (!settings.youtubeApiKey) {
      alert("Bitte hinterlege erst einen YouTube API Key in den Einstellungen (Setup), um die Liste zu aktualisieren.");
      return;
    }

    setIsRefreshing(true);
    try {
      const channelId = 'UC0v5B9o2Z-z_S0hX_C6Sj_g';
      // 1. Get latest 10 videos
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=10&order=date&type=video&key=${settings.youtubeApiKey}`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();

      if (searchData.error) throw new Error(searchData.error.message);

      const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');

      // 2. Get durations
      const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${videoIds}&key=${settings.youtubeApiKey}`;
      const videoRes = await fetch(videoUrl);
      const videoData = await videoRes.json();

      const parseDuration = (duration: string) => {
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return 10;
        const h = parseInt(match[1] || '0');
        const m = parseInt(match[2] || '0');
        const s = parseInt(match[3] || '0');
        return h * 60 + m + s / 60;
      };

      const newVideos = videoData.items.map((item: any) => ({
        id: item.id,
        title: item.snippet.title,
        duration: parseDuration(item.contentDetails.duration)
      }));

      mockDb.setCustomVideos(newVideos);
      setDynamicVideos(newVideos);
    } catch (err: any) {
      console.error("YouTube Fetch Error:", err);
      alert("Fehler beim Laden der YouTube-Videos: " + err.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const load = () => {
      setTasks(mockDb.getTasks());
      setRequests(mockDb.getRewardRequests());
      setLeaderboard(mockDb.getLeaderboard());
      setUsers(mockDb.getUsers());
      setUnlockedVideos(mockDb.getUnlockedVideos());
      setDynamicVideos(mockDb.getCustomVideos());
    };
    load();
    window.addEventListener('db_updated', load);
    return () => window.removeEventListener('db_updated', load);
  }, []);

  if (!user) return null;

  const PRIO_STARS = settings.prioPoints;

  // Leaderboard common rendering
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

  const wallOfFame = (
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
  );

  const videoRewardsSection = (
    <div className="glass-panel" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(255,0,0,0.05) 0%, rgba(255,0,0,0.1) 100%)', border: '1px solid rgba(255,0,0,0.2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h3 style={{ margin: 0, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Video size={20} /> Gustaf-Kino 🍿
        </h3>
        {!user.isChild && (
          <button 
            onClick={fetchLatestVideos} 
            disabled={isRefreshing}
            className="btn"
            style={{ padding: '0.25rem 0.5rem', fontSize: '10px', background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', border: '1px solid #dc2626' }}
          >
            {isRefreshing ? 'Lädt...' : 'Liste aktualisieren'}
          </button>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' }}>
        {displayVideos.map(vid => {
          const isUnlocked = unlockedVideos.includes(vid.id);
          const cost = Math.ceil(vid.duration) * settings.videoCostPerMinute;
          
          return (
            <div key={vid.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', aspectRatio: '16/9', backgroundColor: '#000', boxShadow: 'var(--shadow-md)' }}>
                {isUnlocked ? (
                  <iframe 
                    width="100%" 
                    height="100%" 
                    src={`https://www.youtube-nocookie.com/embed/${vid.id}`}
                    title={vid.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen
                  ></iframe>
                ) : (
                  <div 
                    onClick={() => {
                      if (balance >= cost) {
                        if (confirm(`Möchtest du dieses Video für ${cost} Sterne freischalten?`)) {
                          mockDb.addRewardRequest({
                            id: `video-${vid.id}`,
                            childId: user.id,
                            stars: cost,
                            status: 'APPROVED'
                          });
                          mockDb.unlockVideo(vid.id);
                        }
                      } else {
                        alert(`Du brauchst ${cost} Sterne, um dieses Video freizuschalten! Du hast nur ${balance}.`);
                      }
                    }}
                    style={{ cursor: 'pointer', height: '100%', width: '100%' }}
                  >
                    <img 
                      src={`https://i.ytimg.com/vi/${vid.id}/hqdefault.jpg`} 
                      alt={vid.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}
                    />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', color: 'white' }}>
                      <Lock size={24} style={{ marginBottom: '0.25rem' }} />
                      <div style={{ fontSize: 'var(--font-xs)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        {cost} <Star size={10} fill="currentColor" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {vid.title}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>
                Dauer: {Math.floor(vid.duration)} Min.
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // === ADULT VIEW ===
  if (!user.isChild) {
    const childAccounts = users.filter(u => u.isChild);
    const pendingRequests = requests.filter(r => r.status === 'PENDING');

    const handleManualAdjustment = (childId: string, isAdd: boolean) => {
      const amountStr = adjustments[childId];
      if (!amountStr || amountStr <= 0) return;
      const amount = Number(amountStr);
      
      // isAdd = true means parent adds stars. To add balance, spentOrPendingStars should DECREASE. So stars must be negative.
      // isAdd = false means parent removes stars. To reduce balance, spentOrPendingStars should INCREASE. So stars must be positive.
      const dbStars = isAdd ? -amount : amount;

      mockDb.addRewardRequest({
        childId: childId,
        stars: dbStars,
        status: 'APPROVED'
      });
      setAdjustments(prev => ({ ...prev, [childId]: '' }));
    };

    return (
      <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflowY: 'auto' }}>
        
        {/* Punktestände aller Kinder */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Star size={20} fill="var(--color-primary-dark)" /> Sternen-Übersicht
          </h2>
          {childAccounts.length === 0 ? (
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)' }}>Keine Kinder-Accounts angelegt.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.75rem' }}>
              {childAccounts.map(child => {
                const childBalance = requests
                  .filter(r => r.childId === child.id && r.status !== 'REJECTED')
                  .reduce((sum, r) => sum - r.stars, 0);
                
                return (
                  <div key={child.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>{child.avatar}</span>
                        <strong style={{ fontSize: '1.1rem' }}>{child.id}</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '1.2rem', fontWeight: 'bold', color: '#f59e0b' }}>
                        {childBalance} <Star size={20} fill="#f59e0b" />
                      </div>
                    </div>
                    {/* Manual Adjustment Field */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <input 
                        type="number"
                        className="input-field"
                        placeholder="Menge..."
                        value={adjustments[child.id] || ''}
                        onChange={(e) => setAdjustments(prev => ({ ...prev, [child.id]: Number(e.target.value) || '' }))}
                        min="1"
                        style={{ flex: 1, padding: '0.5rem' }}
                      />
                      <button 
                        onClick={() => handleManualAdjustment(child.id, true)} 
                        className="btn btn-secondary" 
                        style={{ padding: '0.5rem 0.75rem', color: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                        disabled={!adjustments[child.id]}
                        title="Sterne gutschreiben"
                      >
                        <Plus size={18} />
                      </button>
                      <button 
                        onClick={() => handleManualAdjustment(child.id, false)} 
                        className="btn btn-secondary" 
                        style={{ padding: '0.5rem 0.75rem', color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                        disabled={!adjustments[child.id]}
                        title="Sterne abziehen"
                      >
                        <Minus size={18} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Offene Anfragen */}
        {pendingRequests.length > 0 && (
          <div className="glass-panel" style={{ padding: '1rem', border: '2px solid #f59e0b' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#d97706' }}>
              <Star size={20} fill="#f59e0b" /> Offene Anfragen
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {pendingRequests.map(req => {
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

        {wallOfFame}
        {videoRewardsSection}
        <div style={{ height: '4rem' }}></div>
      </div>
    );
  }

  // === CHILD VIEW ===
  const myRequests = requests.filter(r => r.childId === user.id);
  const balance = myRequests
    .filter(r => r.status !== 'REJECTED')
    .reduce((sum, r) => sum - r.stars, 0);

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
    if (balance < 2) return false;
    const gameId = `game-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    mockDb.addRewardRequest({ id: gameId, childId: user.id, stars: 2, status: 'APPROVED' });
    return true;
  };

  const handlePlayGame = (gameId: 'SNAKE' | 'MEMORY' | 'FLAPPY' | 'WHACKAMO') => {
    if (deductPlayCost()) {
      setActiveGame(gameId);
    } else {
      alert("Nicht genug Sterne! Du brauchst 2 Sterne, um eine Runde zu spielen.");
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

  // Newly approved requests that haven't been acknowledged (excluding games)
  const newApprovals = myRequests.filter(r => 
    r.status === 'APPROVED' && 
    !r.acknowledged && 
    !r.id.startsWith('game-')
  );

  const acknowledgeApproval = (req: RewardRequest) => {
    mockDb.updateRewardRequest({ ...req, acknowledged: true });
  };

  return (
    <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflowY: 'auto' }}>
      
      {activeGame === 'SNAKE' && <SnakeGame onExit={() => setActiveGame(null)} onReplay={handleReplay} onSaveScore={(s) => handleSaveScore('SNAKE', s)} highScore={getHighScore('SNAKE')} />}
      {activeGame === 'MEMORY' && <MemoryGame onExit={() => setActiveGame(null)} onReplay={handleReplay} onSaveScore={(s) => handleSaveScore('MEMORY', s, true)} highScore={getHighScore('MEMORY', true)} />}
      {activeGame === 'FLAPPY' && <FlappyGame onExit={() => setActiveGame(null)} onReplay={handleReplay} onSaveScore={(s) => handleSaveScore('FLAPPY', s)} highScore={getHighScore('FLAPPY')} />}
      {activeGame === 'WHACKAMO' && <WhackAMoleGame onExit={() => setActiveGame(null)} onReplay={handleReplay} onSaveScore={(s) => handleSaveScore('WHACKAMO', s)} highScore={getHighScore('WHACKAMO')} />}
      
      {/* Approval Notifications */}
      {newApprovals.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {newApprovals.map(req => (
            <div key={req.id} className="glass-panel" style={{ padding: '1rem', border: '2px solid var(--color-success)', background: 'rgba(16, 185, 129, 0.1)', animation: 'slideIn 0.3s ease-out' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <Check size={20} /> Genehmigt!
                  </h4>
                  <p style={{ fontSize: 'var(--font-sm)', lineHeight: 1.4 }}>
                    Deine Anfrage über <strong>{req.stars > 0 ? req.stars : Math.abs(req.stars)} Sterne</strong> wurde {req.stars < 0 ? 'gutgeschrieben' : 'genehmigt und abgezogen'}. Viel Spaß!
                  </p>
                </div>
                <button onClick={() => acknowledgeApproval(req)} style={{ background: 'none', border: 'none', color: 'var(--color-success)', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'linear-gradient(135deg, rgba(255,193,7,0.2) 0%, rgba(255,152,0,0.1) 100%)' }}>
        <h2 style={{ fontSize: '1.2rem', color: 'var(--color-primary-dark)', marginBottom: '0.5rem' }}>Dein Sternenkonto</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '3rem', fontWeight: 800, color: '#f59e0b', textShadow: '0 2px 10px rgba(245, 158, 11, 0.3)' }}>
          <Star size={48} fill="#f59e0b" /> {balance}
        </div>
      </div>

      {/* Podium (Ranking) */}
      {(() => {
        const rankings = users
          .filter(u => u.isChild)
          .map(child => {
            const balance = requests
              .filter(r => r.childId === child.id && r.status !== 'REJECTED')
              .reduce((sum, r) => sum - r.stars, 0);
            return { ...child, balance };
          })
          .sort((a, b) => b.balance - a.balance);

        if (rankings.length < 1) return null;

        return (
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1.5rem', color: 'var(--color-text-muted)' }}>Siegertreppchen</h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '0.5rem', height: '140px', marginTop: '1rem', width: '100%' }}>
              {/* 2nd Place */}
              {rankings[1] && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '30%' }}>
                  <div style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>{rankings[1].avatar}</div>
                  <div style={{ 
                    width: '100%', 
                    height: '50px', 
                    background: 'linear-gradient(to bottom, #94a3b8, #64748b)', 
                    borderRadius: '8px 8px 0 0', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    position: 'relative',
                    color: 'white',
                    boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
                  }}>
                    <Medal size={16} color="#e2e8f0" fill="#e2e8f0" style={{ position: 'absolute', top: '-10px' }} />
                    <span style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.1rem' }}>
                      {rankings[1].balance} <Star size={10} fill="currentColor" />
                    </span>
                  </div>
                  <span style={{ fontSize: '0.7rem', marginTop: '0.4rem', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{rankings[1].id}</span>
                </div>
              )}

              {/* 1st Place */}
              {rankings[0] && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '35%' }}>
                  <div style={{ fontSize: '1.6rem', marginBottom: '0.2rem' }}>{rankings[0].avatar}</div>
                  <div style={{ 
                    width: '100%', 
                    height: '90px', 
                    background: 'linear-gradient(to bottom, #f59e0b, #d97706)', 
                    borderRadius: '8px 8px 0 0', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    position: 'relative',
                    color: 'white',
                    boxShadow: '0 -4px 15px rgba(245, 158, 11, 0.2)'
                  }}>
                    <Trophy size={20} color="#fef3c7" fill="#fef3c7" style={{ position: 'absolute', top: '-14px' }} />
                    <span style={{ fontWeight: 'bold', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      {rankings[0].balance} <Star size={14} fill="currentColor" />
                    </span>
                  </div>
                  <span style={{ fontSize: '0.8rem', marginTop: '0.4rem', fontWeight: 800, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{rankings[0].id}</span>
                </div>
              )}

              {/* 3rd Place */}
              {rankings[2] && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '30%' }}>
                  <div style={{ fontSize: '1rem', marginBottom: '0.2rem' }}>{rankings[2].avatar}</div>
                  <div style={{ 
                    width: '100%', 
                    height: '35px', 
                    background: 'linear-gradient(to bottom, #b45309, #78350f)', 
                    borderRadius: '8px 8px 0 0', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    position: 'relative',
                    color: 'white',
                    boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
                  }}>
                    <Medal size={14} color="#fde68a" fill="#b45309" style={{ position: 'absolute', top: '-8px' }} />
                    <span style={{ fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.1rem' }}>
                      {rankings[2].balance} <Star size={10} fill="currentColor" />
                    </span>
                  </div>
                  <span style={{ fontSize: '0.7rem', marginTop: '0.4rem', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{rankings[2].id}</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

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
                disabled={balance < 2}
                style={{ width: '100%', marginTop: 'auto', display: 'flex', gap: '0.25rem', justifyContent: 'center' }}
            >
                <Play size={14} /> 2 <Star size={12} fill="currentColor" />
            </button>
          </div>
          <div style={{ background: 'var(--color-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem' }}>🧩</div>
            <strong style={{ fontSize: 'var(--font-sm)' }}>Memory</strong>
            <button 
                onClick={() => handlePlayGame('MEMORY')} 
                className="btn btn-primary" 
                disabled={balance < 2}
                style={{ width: '100%', marginTop: 'auto', display: 'flex', gap: '0.25rem', justifyContent: 'center' }}
            >
                <Play size={14} /> 2 <Star size={12} fill="currentColor" />
            </button>
          </div>
          <div style={{ background: 'var(--color-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem' }}>🐦</div>
            <strong style={{ fontSize: 'var(--font-sm)' }}>Flappy</strong>
            <button 
                onClick={() => handlePlayGame('FLAPPY')} 
                className="btn btn-primary" 
                disabled={balance < 2}
                style={{ width: '100%', marginTop: 'auto', display: 'flex', gap: '0.25rem', justifyContent: 'center' }}
            >
                <Play size={14} /> 2 <Star size={12} fill="currentColor" />
            </button>
          </div>
          <div style={{ background: 'var(--color-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem' }}>🔨</div>
            <strong style={{ fontSize: 'var(--font-sm)' }}>Fangen</strong>
            <button 
                onClick={() => handlePlayGame('WHACKAMO')} 
                className="btn btn-primary" 
                disabled={balance < 2}
                style={{ width: '100%', marginTop: 'auto', display: 'flex', gap: '0.25rem', justifyContent: 'center' }}
            >
                <Play size={14} /> 2 <Star size={12} fill="currentColor" />
            </button>
          </div>
        </div>
        <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', marginTop: '1rem', textAlign: 'center' }}>
          Jede gespielte Runde kostet 2 Sterne.
        </p>
      </div>

      {wallOfFame}
      {videoRewardsSection}

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
          <History size={20} /> Sterne-Historie
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Earnings (Tasks & Bonuses) */}
          <div>
            <h4 style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Verdienst & Gutschriften</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {myRequests.filter(r => r.stars < 0 && r.status === 'APPROVED').length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)', fontStyle: 'italic' }}>Noch keine Sterne verdient.</p>
              ) : (
                myRequests.filter(r => r.stars < 0 && r.status === 'APPROVED')
                  .sort((a,b) => b.createdAt - a.createdAt)
                  .map(r => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-surface)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 'var(--font-sm)' }}>{r.description || 'Gutschrift'}</span>
                      <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>{new Date(r.createdAt).toLocaleDateString('de-DE')}</span>
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: 'var(--font-sm)' }}>
                      +{Math.abs(r.stars)} <Star size={12} fill="var(--color-success)" />
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Spendings (Approved Requests & Games) */}
          <div>
            <h4 style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Eintausch & Abzüge</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {myRequests.filter(r => r.stars > 0 && r.status === 'APPROVED').length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)', fontStyle: 'italic' }}>Noch nichts eingetauscht.</p>
              ) : (
                myRequests.filter(r => r.stars > 0 && r.status === 'APPROVED')
                  .sort((a,b) => b.createdAt - a.createdAt)
                  .map(r => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-surface)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 'var(--font-sm)' }}>{r.id.startsWith('game-') ? 'Gespielt' : 'Medienzeit'}</span>
                      <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>{new Date(r.createdAt).toLocaleDateString('de-DE')}</span>
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: 'var(--font-sm)' }}>
                      -{Math.abs(r.stars)} <Star size={12} fill="currentColor" />
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div style={{ height: '4rem' }}></div>
    </div>
  );
};
