import React, { useState, useEffect, useRef } from 'react';
import { Trophy, RefreshCw, X } from 'lucide-react';

const GRAVITY = 0.5;
const JUMP_STRENGTH = -8;
const PIPE_SPEED = 4;
const PIPE_WIDTH = 50;
const PIPE_GAP = 160;
const GAME_WIDTH = window.innerWidth > 400 ? 400 : window.innerWidth - 32;
const GAME_HEIGHT = 450;
const BIRD_SIZE = 30;

export const FlappyGame = ({ onExit, onReplay, onSaveScore, highScore }: { onExit: () => void, onReplay: () => void, onSaveScore: (score: number) => void, highScore: number }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);

  const [birdPos, setBirdPos] = useState(GAME_HEIGHT / 2);
  const [birdVelocity, setBirdVelocity] = useState(0);

  const [pipes, setPipes] = useState<{ x: number, topHeight: number }[]>([]);
  
  const frameRef = useRef<number>();
  const lastPipeRef = useRef<number>(0);

  const birdPosRef = useRef(GAME_HEIGHT / 2);
  const birdVelocityRef = useRef(0);
  const pipesRef = useRef<{ x: number, topHeight: number }[]>([]);
  const isGameOverRef = useRef(false);

  const resetGame = () => {
    setBirdPos(GAME_HEIGHT / 2);
    setBirdVelocity(0);
    setPipes([]);
    setScore(0);
    setIsGameOver(false);
    setIsPlaying(false);
    
    birdPosRef.current = GAME_HEIGHT / 2;
    birdVelocityRef.current = 0;
    pipesRef.current = [];
    isGameOverRef.current = false;
  };

  const jump = () => {
    if (isGameOver) return;
    if (!isPlaying) {
        setIsPlaying(true);
    }
    birdVelocityRef.current = JUMP_STRENGTH;
  };

  useEffect(() => {
     if (!isPlaying || isGameOver) return;

     let frames = 0;

     const updateGame = () => {
        if (isGameOverRef.current) return;
        frames++;

        // Update bird
        birdVelocityRef.current += GRAVITY;
        birdPosRef.current += birdVelocityRef.current;

        // Check floor/ceiling collision
        if (birdPosRef.current >= GAME_HEIGHT - BIRD_SIZE || birdPosRef.current <= 0) {
            isGameOverRef.current = true;
        }

        // Generate pipes
        if (frames - lastPipeRef.current > 70) {
            const topHeight = Math.max(50, Math.random() * (GAME_HEIGHT - PIPE_GAP - 100));
            pipesRef.current.push({ x: GAME_WIDTH, topHeight });
            lastPipeRef.current = frames;
        }

        // Update pipes & Check pipe collisions
        const nextPipes = [];
        let scoreIncrement = 0;

        for (let i = 0; i < pipesRef.current.length; i++) {
            const p = pipesRef.current[i];
            p.x -= PIPE_SPEED;

            // Check collision
            const birdRight = 50 + BIRD_SIZE; // Bird X is fixed at 50
            const birdLeft = 50;
            const birdTop = birdPosRef.current;
            const birdBottom = birdPosRef.current + BIRD_SIZE;

            const pipeLeft = p.x;
            const pipeRight = p.x + PIPE_WIDTH;
            const pipeTopBottom = p.topHeight;
            const pipeBottomTop = p.topHeight + PIPE_GAP;

             if (
                birdRight > pipeLeft &&
                birdLeft < pipeRight &&
                (birdTop < pipeTopBottom || birdBottom > pipeBottomTop)
             ) {
                isGameOverRef.current = true;
             }

             // Passed pipe
             if (p.x === 50) {
                scoreIncrement++;
             }

             if (p.x + PIPE_WIDTH > 0) {
                 nextPipes.push(p);
             }
        }
        
        pipesRef.current = nextPipes;

        // Sink state
        setBirdPos(birdPosRef.current);
        setBirdVelocity(birdVelocityRef.current);
        setPipes([...pipesRef.current]);

        if (scoreIncrement > 0) {
            setScore(s => s + scoreIncrement);
        }

        if (isGameOverRef.current) {
            setIsGameOver(true);
            setIsPlaying(false);
            // On game over, score hasn't updated in state yet, but we have it roughly via `score + scoreIncrement` internally.
            // A better way is using a useEffect for isGameOver.
        } else {
            frameRef.current = requestAnimationFrame(updateGame);
        }
     };

     frameRef.current = requestAnimationFrame(updateGame);

     return () => {
         if (frameRef.current) cancelAnimationFrame(frameRef.current);
     };
  }, [isPlaying, isGameOver, highScore]);

  useEffect(() => {
    if (isGameOver) {
       onSaveScore(score);
    }
  }, [isGameOver, score, onSaveScore]);

  // Prevent default scrolling when tapping the screen repeatedly
  useEffect(() => {
    const preventDefault = (e: TouchEvent) => { e.preventDefault(); };
    window.addEventListener('touchmove', preventDefault, { passive: false });
    return () => window.removeEventListener('touchmove', preventDefault);
  }, []);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#ffffff', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
       <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
            <span style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-text)' }}>Score: {score}</span>
            <span style={{ color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Trophy size={16}/> {highScore}</span>
        </div>
        <button onClick={onExit} style={{ background: 'none', border: 'none', color: 'var(--color-text)', cursor: 'pointer' }}>
          <X size={24} />
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem', touchAction: 'none' }}>
         <div 
            onClick={jump}
            style={{ 
                width: `${GAME_WIDTH}px`, 
                height: `${GAME_HEIGHT}px`, 
                backgroundColor: '#38bdf8', /* Sky blue */
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                cursor: 'pointer'
         }}>
             {/* Bird */}
             <div style={{
                 position: 'absolute',
                 left: 50,
                 top: birdPos,
                 width: BIRD_SIZE,
                 height: BIRD_SIZE,
                 fontSize: '24px',
                 lineHeight: `${BIRD_SIZE}px`,
                 textAlign: 'center',
                 transform: `rotate(${Math.min(90, Math.max(-20, birdVelocity * 4))}deg)`,
                 transition: 'transform 0.1s'
             }}>
                 🐦
             </div>

             {/* Pipes */}
             {pipes.map((pipe, idx) => (
                 <React.Fragment key={idx}>
                     {/* Top pipe */}
                     <div style={{
                         position: 'absolute',
                         left: pipe.x,
                         top: 0,
                         width: PIPE_WIDTH,
                         height: pipe.topHeight,
                         backgroundColor: '#4ade80',
                         border: '2px solid #22c55e',
                         borderTop: 'none'
                     }} />
                     {/* Bottom pipe */}
                     <div style={{
                         position: 'absolute',
                         left: pipe.x,
                         top: pipe.topHeight + PIPE_GAP,
                         width: PIPE_WIDTH,
                         height: GAME_HEIGHT - (pipe.topHeight + PIPE_GAP),
                         backgroundColor: '#4ade80',
                         border: '2px solid #22c55e',
                         borderBottom: 'none'
                     }} />
                 </React.Fragment>
             ))}

             {/* Start Screen */}
             {!isPlaying && !isGameOver && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '1.2rem', fontWeight: 600 }}>
                      Klicke zum Fliegen!
                  </div>
             )}

             {/* Game Over Screen */}
             {isGameOver && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white' }}>
                    <h2 style={{ marginBottom: '1rem', color: '#ef4444' }}>Oje, abgestürzt!</h2>
                    <p style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>Punkte: {score}</p>
                    <button onClick={(e) => { e.stopPropagation(); resetGame(); onReplay(); }} className="btn btn-primary" style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1.5rem', zIndex: 10 }}>
                        <RefreshCw size={18} /> Noch eine Runde (2 🌟)
                    </button>
                </div>
             )}
         </div>
      </div>
    </div>
  );
};
