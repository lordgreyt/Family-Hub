import { useState, useEffect, useRef } from 'react';
import { Trophy, RefreshCw, X, Clock } from 'lucide-react';

const GRID_SIZE = 9;
const GAME_DURATION_SEC = 30;
const MOLE_EMOJIS = ['🐰', '🦊', '🐭', '🐹']; // Random cute animals

export const WhackAMoleGame = ({ onExit, onReplay, onSaveScore, highScore }: { onExit: () => void, onReplay: () => void, onSaveScore: (score: number) => void, highScore: number }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_SEC);
  
  const [activeMoles, setActiveMoles] = useState<{ id: number, emoji: string }[]>([]);

  const activeMolesRef = useRef<{ id: number, emoji: string, timeout: NodeJS.Timeout }[]>([]);
  const nextMoleTimeoutRef = useRef<NodeJS.Timeout>();

  const startGame = () => {
    setIsPlaying(true);
    setIsGameOver(false);
    setScore(0);
    setTimeLeft(GAME_DURATION_SEC);
    scheduleNextMole();
  };

  const endGame = () => {
    setIsPlaying(false);
    setIsGameOver(true);
    clearAllTimeouts();
  };

  const clearAllTimeouts = () => {
    if (nextMoleTimeoutRef.current) clearTimeout(nextMoleTimeoutRef.current);
    activeMolesRef.current.forEach(mole => clearTimeout(mole.timeout));
    activeMolesRef.current = [];
    setActiveMoles([]);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            endGame();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, timeLeft]);

  useEffect(() => {
    return () => clearAllTimeouts();
  }, []);

  const scheduleNextMole = () => {
    const delay = Math.max(300, 1000 - (score * 15)); // Get faster as score increases
    nextMoleTimeoutRef.current = setTimeout(spawnMole, delay);
  };

  const spawnMole = () => {
    // Generate new position that isn't currently occupied
    const availablePositions = Array.from({ length: GRID_SIZE }, (_, i) => i)
        .filter(i => !activeMolesRef.current.find(m => m.id === i));

    if (availablePositions.length > 0) {
        const id = availablePositions[Math.floor(Math.random() * availablePositions.length)];
        const emoji = MOLE_EMOJIS[Math.floor(Math.random() * MOLE_EMOJIS.length)];
        
        const lifespan = Math.max(500, 1500 - (score * 20)); // Disappear faster

        const timeout = setTimeout(() => {
            activeMolesRef.current = activeMolesRef.current.filter(m => m.id !== id);
            setActiveMoles([...activeMolesRef.current.map(m => ({ id: m.id, emoji: m.emoji }))]);
        }, lifespan);

        activeMolesRef.current.push({ id, emoji, timeout });
        setActiveMoles([...activeMolesRef.current.map(m => ({ id: m.id, emoji: m.emoji }))]);
    }

    scheduleNextMole();
  };

  const whack = (id: number) => {
    const moleIndex = activeMolesRef.current.findIndex(m => m.id === id);
    if (moleIndex >= 0) {
        const mole = activeMolesRef.current[moleIndex];
        clearTimeout(mole.timeout);
        
        activeMolesRef.current.splice(moleIndex, 1);
        setActiveMoles([...activeMolesRef.current.map(m => ({ id: m.id, emoji: m.emoji }))]);
        
        setScore(s => s + 1);
    }
  };

  useEffect(() => {
    if (isGameOver && score > 0) {
       onSaveScore(score);
    }
  }, [isGameOver, score, onSaveScore]);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'var(--color-bg)', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
       <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
            <span style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-text)' }}>Score: {score}</span>
            <span style={{ color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Trophy size={16}/> {highScore}</span>
            <span style={{ color: timeLeft <= 5 ? '#ef4444' : 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Clock size={16}/> {timeLeft}s</span>
        </div>
        <button onClick={onExit} style={{ background: 'none', border: 'none', color: 'var(--color-text)', cursor: 'pointer' }}>
          <X size={24} />
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem', touchAction: 'manipulation' }}>
        <div style={{ 
          width: '100%', 
          maxWidth: '450px', 
          aspectRatio: '1/1',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridTemplateRows: 'repeat(3, 1fr)',
          gap: '1rem',
          position: 'relative'
        }}>
           {Array.from({ length: GRID_SIZE }).map((_, i) => {
               const mole = activeMoles.find(m => m.id === i);
               
               return (
                   <div 
                       key={i}
                       style={{ 
                           backgroundColor: '#8b5cf6', // Indigo block
                           borderRadius: '50%',
                           display: 'flex',
                           justifyContent: 'center',
                           alignItems: 'center',
                           position: 'relative',
                           overflow: 'hidden',
                           boxShadow: 'inset 0 -10px 15px rgba(0,0,0,0.3)',
                           border: '4px solid #6d28d9'
                       }}
                       onMouseDown={(e) => { e.preventDefault(); if (mole) whack(i); }}
                       onTouchStart={(e) => { e.preventDefault(); if (mole) whack(i); }}
                   >
                       <div style={{
                           position: 'absolute',
                           bottom: mole ? '10%' : '-100%',
                           fontSize: '4rem',
                           transition: 'bottom 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275)', // popping effect
                           cursor: 'pointer',
                           userSelect: 'none'
                       }}>
                           {mole ? mole.emoji : ''}
                       </div>
                   </div>
               );
           })}

           {/* Start Screen */}
           {!isPlaying && !isGameOver && (
               <div style={{ position: 'absolute', inset: -20, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '1rem', zIndex: 10 }}>
                   <button onClick={startGame} className="btn btn-primary" style={{ fontSize: '1.2rem', padding: '1rem 2rem' }}>
                       Start (30 Sekunden)
                   </button>
               </div>
           )}

           {/* Game Over Screen */}
           {isGameOver && (
               <div style={{ position: 'absolute', inset: -20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', color: 'white', borderRadius: '1rem', zIndex: 10 }}>
                   <Trophy size={64} fill="#facc15" color="#ca8a04" style={{ marginBottom: '1rem' }} />
                   <h2 style={{ marginBottom: '1rem', color: '#facc15' }}>Zeit abgelaufen!</h2>
                   <p style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>Punkte: {score}</p>
                   <button onClick={() => { startGame(); onReplay(); }} className="btn btn-primary" style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1.5rem' }}>
                       <RefreshCw size={18} /> Noch eine Runde (5 🌟)
                   </button>
               </div>
           )}
        </div>
      </div>
    </div>
  );
};
