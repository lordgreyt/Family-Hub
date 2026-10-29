import { useState, useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';
import type { RewardRequest, ScoreEntry, User } from '../services/mockDb';
import { AvatarEmoji } from '../components/AvatarEmoji';
import { Star, Clock, Send, ShieldAlert, History, Gamepad2, Play, Trophy, Check, X, Plus, Minus, Medal, Hourglass, Sparkles, PencilLine } from 'lucide-react';
import { SnakeGame } from '../components/SnakeGame';
import { MemoryGame } from '../components/MemoryGame';
import { FlappyGame } from '../components/FlappyGame';
import { WhackAMoleGame } from '../components/WhackAMoleGame';

type GameId = 'SNAKE' | 'MEMORY' | 'FLAPPY' | 'WHACKAMO';

const HERO_GRADIENT = 'linear-gradient(135deg, #3F34C4 0%, #6D5DF0 55%, #F2A9BE 130%)';
const STAR_COLOR = '#FF9F2D';

const QUICK_STARS = [5, 10, 15, 20, 30, 50];

const GAMES: Array<{ id: GameId; emoji: string; name: string; lowerIsBetter?: boolean }> = [
  { id: 'SNAKE', emoji: '🐍', name: 'Snake' },
  { id: 'MEMORY', emoji: '🧩', name: 'Memory', lowerIsBetter: true },
  { id: 'FLAPPY', emoji: '🐦', name: 'Flappy' },
  { id: 'WHACKAMO', emoji: '🔨', name: 'Fangen' },
];

const card: CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-sm)',
  padding: '1.1rem',
};

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

const pill = (color = 'var(--color-primary)'): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
  padding: '0.25rem 0.65rem',
  borderRadius: '999px',
  background: 'var(--color-surface-muted)',
  color,
  fontSize: 'var(--font-xs)',
  fontWeight: 800,
});

const roundBtn = (color: string): CSSProperties => ({
  width: '42px',
  height: '42px',
  borderRadius: '50%',
  background: color + '1F',
  color,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  border: 'none',
  cursor: 'pointer',
});

const pillInput: CSSProperties = {
  flex: 1,
  minWidth: 0,
  borderRadius: '999px',
  padding: '0.65rem 1rem',
  background: 'var(--color-surface-muted)',
  border: '1.5px solid transparent',
  fontWeight: 700,
};

const SectionTitle = ({ icon, color, children, right }: { icon: ReactNode; color: string; children: ReactNode; right?: ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.9rem' }}>
    <span style={iconChip(color)}>{icon}</span>
    <h3 style={{ margin: 0, flex: 1, fontSize: 'var(--font-lg)', fontWeight: 800 }}>{children}</h3>
    {right}
  </div>
);

const Avatar = ({ user, size }: { user?: User; size: number }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: `${size}px`, height: `${size}px`, borderRadius: '50%',
    background: user?.avatarColor || '#6D5DF0', flexShrink: 0, overflow: 'hidden',
    border: '2px solid white', boxShadow: '0 2px 6px rgba(63,52,196,0.18)',
  }}>
    {user?.avatar ? <AvatarEmoji emoji={user.avatar} size={size} /> : '👤'}
  </span>
);

export const Rewards = () => {
  const { user } = useAuth();

  const [requests, setRequests] = useState<RewardRequest[]>([]);
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [exchangeAmount, setExchangeAmount] = useState<number | ''>('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [activeGame, setActiveGame] = useState<GameId | null>(null);

  const [adjustments, setAdjustments] = useState<Record<string, number | ''>>({});
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState<string | null>(null);

  useEffect(() => {
    const load = () => {
      setRequests(mockDb.getRewardRequests());
      setLeaderboard(mockDb.getLeaderboard());
      setUsers(mockDb.getUsers());
    };
    load();
    window.addEventListener('db_updated', load);
    return () => window.removeEventListener('db_updated', load);
  }, []);

  if (!user) return null;

  const balanceOf = (childId: string) => requests
    .filter(r => r.childId === childId && r.status !== 'REJECTED')
    .reduce((sum, r) => sum - r.stars, 0);

  const getHighScore = (gameId: string, lowerIsBetter: boolean = false) => {
    const scores = leaderboard.filter(e => e.gameId === gameId);
    if (scores.length === 0) return 0;
    return lowerIsBetter
      ? Math.min(...scores.map(s => s.score))
      : Math.max(...scores.map(s => s.score));
  };

  // === ADULT VIEW ===
  if (!user.isChild) {
    const childAccounts = users.filter(u => u.isChild);
    const pendingRequests = requests.filter(r => r.status === 'PENDING');

    const handleQuickAdd = (childId: string, amount: number) => {
      // Negative stars in DB mean earning.
      mockDb.addRewardRequest({ childId, stars: -amount, status: 'APPROVED' });
    };

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Offene Anfragen */}
        {pendingRequests.length > 0 && (
          <div style={{ ...card, border: '1.5px solid ' + STAR_COLOR + '66', background: '#FFF8EE' }}>
            <SectionTitle icon={<Hourglass size={19} />} color={STAR_COLOR}>Offene Anfragen</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {pendingRequests.map(req => {
                const reqUser = users.find(u => u.id === req.childId);
                return (
                  <div key={req.id} style={{ background: 'var(--color-surface)', padding: '0.8rem', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '0.65rem', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <Avatar user={reqUser} size={32} />
                      <div style={{ fontSize: 'var(--font-sm)', lineHeight: 1.35 }}>
                        <strong>{reqUser?.id}</strong> möchte <strong style={{ color: STAR_COLOR }}>{req.stars} Sterne</strong> einlösen.
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <button onClick={() => mockDb.updateRewardRequest({ ...req, status: 'REJECTED' })} className="btn btn-secondary" style={{ color: 'var(--color-danger)', padding: '0.6rem' }}>
                        <X size={16} /> Abweisen
                      </button>
                      <button onClick={() => mockDb.updateRewardRequest({ ...req, status: 'APPROVED' })} className="btn btn-primary" style={{ padding: '0.6rem' }}>
                        <Check size={16} /> Bestätigen
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Punktestände aller Kinder */}
        <div style={card}>
          <SectionTitle icon={<Star size={19} fill={STAR_COLOR} />} color={STAR_COLOR}>Sternen-Übersicht</SectionTitle>
          {childAccounts.length === 0 ? (
            <p style={{ margin: 0, fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)' }}>Keine Kinder-Accounts angelegt.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {childAccounts.map(child => {
                const childBalance = balanceOf(child.id);
                const isHistoryOpen = expandedHistory === child.id;
                const isManualOpen = manualOpen === child.id;

                return (
                  <div key={child.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', padding: '0.9rem', backgroundColor: 'var(--color-surface-hover)', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
                        <Avatar user={child} size={32} />
                        <strong style={{ fontSize: 'var(--font-base)', marginRight: '0.05rem' }}>{child.id}</strong>
                        <button
                          onClick={() => setExpandedHistory(isHistoryOpen ? null : child.id)}
                          aria-label={isHistoryOpen ? 'Historie ausblenden' : 'Historie anzeigen'}
                          aria-expanded={isHistoryOpen}
                          title={isHistoryOpen ? 'Historie ausblenden' : 'Historie anzeigen'}
                          style={{
                            width: '28px', height: '28px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            background: isHistoryOpen ? 'var(--color-primary)' : 'white',
                            color: isHistoryOpen ? 'white' : 'var(--color-primary)',
                            boxShadow: 'var(--shadow-sm)',
                          }}
                        >
                          <History size={16} />
                        </button>
                        <button
                          onClick={() => setManualOpen(isManualOpen ? null : child.id)}
                          aria-label={isManualOpen ? 'Eigenen Betrag ausblenden' : 'Eigenen Betrag eingeben'}
                          aria-expanded={isManualOpen}
                          title={isManualOpen ? 'Eigenen Betrag ausblenden' : 'Eigenen Betrag eingeben'}
                          style={{
                            width: '28px', height: '28px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            background: isManualOpen ? 'var(--color-primary)' : 'white',
                            color: isManualOpen ? 'white' : 'var(--color-primary)',
                            boxShadow: 'var(--shadow-sm)',
                          }}
                        >
                          <PencilLine size={16} />
                        </button>
                      </div>
                      <div style={{ ...pill(STAR_COLOR), background: 'white', fontSize: 'var(--font-base)', padding: '0.3rem 0.7rem', flexShrink: 0 }}>
                        {childBalance} <Star size={17} fill={STAR_COLOR} />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
                      {QUICK_STARS.map(n => (
                        <button
                          key={n}
                          onClick={() => handleQuickAdd(child.id, n)}
                          aria-label={`${n} Sterne gutschreiben an ${child.id}`}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                            padding: '1rem 0', borderRadius: 'var(--radius-lg)', border: 'none', cursor: 'pointer',
                            background: 'white', color: '#2FB36B', fontWeight: 800, fontSize: 'var(--font-lg)',
                            fontFamily: 'inherit', boxShadow: 'var(--shadow-sm)',
                          }}
                        >
                          <Plus size={16} /> {n} <Star size={16} fill={STAR_COLOR} color={STAR_COLOR} />
                        </button>
                      ))}
                    </div>

                    {isManualOpen && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="number"
                        className="input-field"
                        placeholder="Menge..."
                        value={adjustments[child.id] || ''}
                        onChange={(e) => setAdjustments(prev => ({ ...prev, [child.id]: Number(e.target.value) || '' }))}
                        min="1"
                        style={{ ...pillInput, background: 'white' }}
                      />
                      <button
                        onClick={() => handleManualAdjustment(child.id, true)}
                        style={{ ...roundBtn('#2FB36B'), opacity: adjustments[child.id] ? 1 : 0.45 }}
                        disabled={!adjustments[child.id]}
                        title="Sterne gutschreiben"
                        aria-label="Sterne gutschreiben"
                      >
                        <Plus size={19} />
                      </button>
                      <button
                        onClick={() => handleManualAdjustment(child.id, false)}
                        style={{ ...roundBtn('#E5484D'), opacity: adjustments[child.id] ? 1 : 0.45 }}
                        disabled={!adjustments[child.id]}
                        title="Sterne abziehen"
                        aria-label="Sterne abziehen"
                      >
                        <Minus size={19} />
                      </button>
                    </div>
                    )}

                    {isHistoryOpen && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                        {(() => {
                          const childRequests = requests
                            .filter(r => r.childId === child.id && r.status === 'APPROVED')
                            .sort((a, b) => b.createdAt - a.createdAt)
                            .slice(0, 5);

                          if (childRequests.length === 0) {
                            return <p style={{ margin: 0, fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', textAlign: 'center' }}>Noch keine Historie vorhanden.</p>;
                          }

                          return childRequests.map(r => {
                            const isAddition = r.stars < 0; // Negative stars in DB mean earning
                            const absStars = Math.abs(r.stars);
                            const reason = r.description || (r.id.startsWith('game-') ? 'Arcade-Spiel' : (isAddition ? 'Manuelle Gutschrift' : 'Manuelle Einlösung / Medienzeit'));
                            const tone = isAddition ? 'var(--color-success)' : 'var(--color-danger)';

                            return (
                              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.55rem 0.75rem', background: 'white', borderRadius: 'var(--radius-md)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                  <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600 }}>{reason}</span>
                                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>{new Date(r.createdAt).toLocaleDateString('de-DE')} {new Date(r.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <span style={{ fontWeight: 800, color: tone, display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: 'var(--font-sm)' }}>
                                  {isAddition ? '+' : '-'}{absStars} <Star size={12} fill={isAddition ? 'var(--color-success)' : 'currentColor'} />
                                </span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // === CHILD VIEW ===
  const myRequests = requests.filter(r => r.childId === user.id);
  const balance = balanceOf(user.id);

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

  const handlePlayGame = (gameId: GameId) => {
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

  const rankings = users
    .filter(u => u.isChild)
    .map(child => ({ ...child, balance: balanceOf(child.id) }))
    .sort((a, b) => b.balance - a.balance);

  const maxBalance = Math.max(rankings[0]?.balance ?? 0, 1);
  const barHeight = (value: number) => value <= 0 ? 6 : Math.max(34, (value / maxBalance) * 96);

  const podiumSlots = [
    { index: 1, width: '30%', avatar: 32, fill: 'linear-gradient(to bottom, #CFC7F5, #A99BEA)', icon: <Medal size={16} color="#6D5DF0" fill="#ECE8FF" />, font: 'var(--font-base)', iconTop: '-11px' },
    { index: 0, width: '35%', avatar: 42, fill: HERO_GRADIENT, icon: <Trophy size={20} color="#FFD36B" fill="#FFD36B" />, font: '1.25rem', iconTop: '-15px' },
    { index: 2, width: '30%', avatar: 28, fill: 'linear-gradient(to bottom, #FAD2B6, #F5A06B)', icon: <Medal size={14} color="#C2682B" fill="#FDE7D6" />, font: 'var(--font-sm)', iconTop: '-9px' },
  ];

  const formula = [
    { stars: 15, minutes: 5 },
    { stars: 30, minutes: 10 },
    { stars: 100, minutes: 45 },
  ];

  const earnings = myRequests.filter(r => r.stars < 0 && r.status === 'APPROVED').sort((a, b) => b.createdAt - a.createdAt);
  const spendings = myRequests.filter(r => r.stars > 0 && r.status === 'APPROVED').sort((a, b) => b.createdAt - a.createdAt);
  const pendingMine = myRequests.filter(r => r.status === 'PENDING');

  const historyRow = (r: RewardRequest, label: string, positive: boolean) => (
    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-surface-hover)', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-md)' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>{new Date(r.createdAt).toLocaleDateString('de-DE')}</span>
      </div>
      <span style={{ fontWeight: 800, color: positive ? 'var(--color-success)' : 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: 'var(--font-sm)' }}>
        {positive ? '+' : '-'}{Math.abs(r.stars)} <Star size={12} fill="currentColor" />
      </span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {activeGame === 'SNAKE' && <SnakeGame onExit={() => setActiveGame(null)} onReplay={handleReplay} onSaveScore={(s) => handleSaveScore('SNAKE', s)} highScore={getHighScore('SNAKE')} />}
      {activeGame === 'MEMORY' && <MemoryGame onExit={() => setActiveGame(null)} onReplay={handleReplay} onSaveScore={(s) => handleSaveScore('MEMORY', s, true)} highScore={getHighScore('MEMORY', true)} />}
      {activeGame === 'FLAPPY' && <FlappyGame onExit={() => setActiveGame(null)} onReplay={handleReplay} onSaveScore={(s) => handleSaveScore('FLAPPY', s)} highScore={getHighScore('FLAPPY')} />}
      {activeGame === 'WHACKAMO' && <WhackAMoleGame onExit={() => setActiveGame(null)} onReplay={handleReplay} onSaveScore={(s) => handleSaveScore('WHACKAMO', s)} highScore={getHighScore('WHACKAMO')} />}

      {/* Approval Notifications */}
      {newApprovals.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {newApprovals.map(req => (
            <div key={req.id} style={{ ...card, border: '1.5px solid #2FB36B66', background: '#EFFAF3', animation: 'slideIn 0.3s ease-out', display: 'flex', gap: '0.7rem', alignItems: 'flex-start' }}>
              <span style={iconChip('#2FB36B')}><Check size={19} /></span>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0, color: 'var(--color-success)', fontWeight: 800 }}>Genehmigt!</h4>
                <p style={{ margin: '0.2rem 0 0', fontSize: 'var(--font-sm)', lineHeight: 1.4 }}>
                  Deine Anfrage über <strong>{Math.abs(req.stars)} Sterne</strong> wurde {req.stars < 0 ? 'gutgeschrieben' : 'genehmigt und abgezogen'}. Viel Spaß!
                </p>
              </div>
              <button onClick={() => acknowledgeApproval(req)} aria-label="Schließen" style={{ background: 'none', border: 'none', color: 'var(--color-success)', cursor: 'pointer', display: 'flex' }}>
                <X size={20} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Hero: Sternenkonto */}
      <div style={{
        background: HERO_GRADIENT,
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 12px 28px rgba(63,52,196,0.28)',
        padding: '1.6rem 1.25rem',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.35rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <Sparkles size={80} color="white" style={{ position: 'absolute', right: '-12px', top: '-12px', opacity: 0.14 }} />
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', opacity: 0.85 }}>DEIN STERNENKONTO</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '3.6rem', fontWeight: 800, lineHeight: 1.1 }}>
          <Star size={50} fill="#FFD36B" color="#FFD36B" /> {balance}
        </div>
        {pendingMine.length > 0 && (
          <span style={{ marginTop: '0.3rem', padding: '0.3rem 0.8rem', borderRadius: '999px', background: 'rgba(255,255,255,0.22)', fontSize: 'var(--font-xs)', fontWeight: 800 }}>
            ⏳ {pendingMine.length} Anfrage{pendingMine.length > 1 ? 'n' : ''} offen
          </span>
        )}
      </div>

      {/* Podium (Ranking) */}
      {rankings.length > 0 && (
        <div style={card}>
          <SectionTitle icon={<Trophy size={19} />} color="#6D5DF0">Siegertreppchen</SectionTitle>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '0.5rem', height: '170px', paddingTop: '0.5rem' }}>
            {podiumSlots.map(slot => {
              const entry = rankings[slot.index];
              if (!entry) return null;
              const isFirst = slot.index === 0;
              return (
                <div key={slot.index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: slot.width }}>
                  <div style={{ marginBottom: '0.25rem' }}><Avatar user={entry} size={slot.avatar} /></div>
                  {entry.balance <= 0 && (
                    <span style={{ fontWeight: 800, fontSize: 'var(--font-xs)', display: 'flex', alignItems: 'center', gap: '0.1rem', marginBottom: '0.2rem', color: 'var(--color-text-muted)' }}>
                      0 <Star size={10} fill="currentColor" />
                    </span>
                  )}
                  <div style={{
                    width: '100%',
                    height: `${barHeight(entry.balance)}px`,
                    background: slot.fill,
                    borderRadius: '14px 14px 4px 4px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    color: slot.index === 0 ? 'white' : 'var(--color-primary)',
                    boxShadow: isFirst ? '0 -4px 16px rgba(109,93,240,0.28)' : 'none',
                  }}>
                    {entry.balance > 0 && (
                      <>
                        <span style={{ position: 'absolute', top: slot.iconTop, display: 'flex' }}>{slot.icon}</span>
                        <span style={{ fontWeight: 800, fontSize: slot.font, display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                          {entry.balance} <Star size={11} fill="currentColor" />
                        </span>
                      </>
                    )}
                  </div>
                  <span style={{ fontSize: 'var(--font-xs)', marginTop: '0.4rem', fontWeight: isFirst ? 800 : 600, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{entry.id}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Spielecke */}
      <div style={card}>
        <SectionTitle icon={<Gamepad2 size={19} />} color="#F27A9B">Arcade-Halle</SectionTitle>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
          {GAMES.map(game => (
            <div key={game.id} style={{ background: 'var(--color-surface-hover)', padding: '0.9rem 0.8rem', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textAlign: 'center' }}>
              <div style={{ width: '58px', height: '58px', borderRadius: '50%', background: 'white', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>{game.emoji}</div>
              <strong style={{ fontSize: 'var(--font-sm)' }}>{game.name}</strong>
              <button
                onClick={() => handlePlayGame(game.id)}
                className="btn btn-primary"
                disabled={balance < 2}
                style={{ width: '100%', marginTop: 'auto', gap: '0.25rem', padding: '0.55rem 0.5rem', opacity: balance < 2 ? 0.5 : 1 }}
              >
                <Play size={14} /> 2 <Star size={12} fill="currentColor" />
              </button>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', margin: '0.9rem 0 0', textAlign: 'center' }}>
          Jede gespielte Runde kostet 2 Sterne.
        </p>
      </div>

      {/* Exchange Form */}
      <div style={card}>
        <SectionTitle icon={<Clock size={19} />} color="#4B8DFF">Medienzeit eintauschen</SectionTitle>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
          {formula.map(item => (
            <div key={item.stars} style={{ background: 'var(--color-surface-hover)', borderRadius: 'var(--radius-lg)', padding: '0.7rem 0.4rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <span style={{ fontWeight: 800, color: STAR_COLOR, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem' }}>
                {item.stars} <Star size={13} fill={STAR_COLOR} color={STAR_COLOR} />
              </span>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', fontWeight: 700 }}>{item.minutes} Min.</span>
            </div>
          ))}
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
              style={pillInput}
            />
            <button
              onClick={handleRequest}
              className="btn btn-primary"
              disabled={!exchangeAmount || exchangeAmount <= 0 || exchangeAmount > balance}
              style={{ opacity: !exchangeAmount || exchangeAmount <= 0 || exchangeAmount > balance ? 0.5 : 1 }}
            >
              Einlösen <Send size={16} />
            </button>
          </div>
        ) : (
          <div style={{ background: '#FDEFF0', border: '1.5px solid #E5484D55', padding: '1rem', borderRadius: 'var(--radius-lg)' }}>
            <h4 style={{ margin: '0 0 0.5rem', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert size={20} /> Sicher?
            </h4>
            <p style={{ fontSize: 'var(--font-sm)', margin: '0 0 1rem' }}>
              Willst du wirklich {exchangeAmount} Sterne bei Papa/Mama anfragen?
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowConfirm(false)} style={{ flex: 1 }}>
                Abbrechen
              </button>
              <button className="btn btn-primary" onClick={confirmRequest} style={{ flex: 1 }}>
                Ja, anfragen!
              </button>
            </div>
          </div>
        )}

        {exchangeAmount !== '' && exchangeAmount > balance && (
          <p style={{ color: 'var(--color-danger)', fontSize: 'var(--font-xs)', margin: '0.6rem 0 0', fontWeight: 700 }}>
            Du hast nicht genug Sterne dafür!
          </p>
        )}
      </div>

      {/* Pending Requests Info */}
      {pendingMine.length > 0 && (
        <div style={{ ...card, border: '1.5px dashed var(--color-primary-light)' }}>
          <h4 style={{ margin: '0 0 0.5rem', color: 'var(--color-primary)', fontSize: 'var(--font-sm)', fontWeight: 800 }}>⏳ Warte auf Mama/Papa</h4>
          {pendingMine.map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-sm)', padding: '0.25rem 0' }}>
              <span>Anfrage über {r.stars} Sterne</span>
            </div>
          ))}
        </div>
      )}

      {/* History */}
      <div style={card}>
        <SectionTitle icon={<History size={19} />} color="#4FC3A1">Sterne-Historie</SectionTitle>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <div>
            <h4 style={{ margin: '0 0 0.5rem', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Verdienst & Gutschriften</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {earnings.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)', fontStyle: 'italic' }}>Noch keine Sterne verdient.</p>
              ) : earnings.map(r => historyRow(r, r.description || 'Gutschrift', true))}
            </div>
          </div>

          <div>
            <h4 style={{ margin: '0 0 0.5rem', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Eintausch & Abzüge</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {spendings.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)', fontStyle: 'italic' }}>Noch nichts eingetauscht.</p>
              ) : spendings.map(r => historyRow(r, r.id.startsWith('game-') ? 'Gespielt' : 'Medienzeit', false))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
