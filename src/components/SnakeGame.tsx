import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Trophy, RefreshCw, X } from 'lucide-react';

const GRID_SIZE = 15;
const INITIAL_SNAKE = [{ x: 7, y: 7 }];
const INITIAL_DIRECTION = { x: 0, y: -1 };

export const SnakeGame = ({ onExit, onReplay, onSaveScore, highScore }: { onExit: () => void, onReplay: () => void, onSaveScore: (score: number) => void, highScore: number }) => {
  const [snake, setSnake] = useState(INITIAL_SNAKE);
  const [direction, setDirection] = useState(INITIAL_DIRECTION);
  const [food, setFood] = useState({ x: 3, y: 3 });
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);

  const directionRef = useRef(direction);

  const generateFood = useCallback(() => {
    let newFood;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
      };
      // eslint-disable-next-line
      if (!snake.some(segment => segment.x === newFood.x && segment.y === newFood.y)) {
        break;
      }
    }
    return newFood;
  }, [snake]);

  const resetGame = () => {
    setSnake(INITIAL_SNAKE);
    setDirection(INITIAL_DIRECTION);
    directionRef.current = INITIAL_DIRECTION;
    setFood({ x: Math.floor(Math.random() * GRID_SIZE), y: Math.floor(Math.random() * GRID_SIZE) });
    setIsGameOver(false);
    setScore(0);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          if (directionRef.current.y === 0) directionRef.current = { x: 0, y: -1 };
          e.preventDefault();
          break;
        case 'ArrowDown':
          if (directionRef.current.y === 0) directionRef.current = { x: 0, y: 1 };
          e.preventDefault();
          break;
        case 'ArrowLeft':
          if (directionRef.current.x === 0) directionRef.current = { x: -1, y: 0 };
          e.preventDefault();
          break;
        case 'ArrowRight':
          if (directionRef.current.x === 0) directionRef.current = { x: 1, y: 0 };
          e.preventDefault();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isGameOver) return;

    const moveSnake = () => {
      setSnake(prevSnake => {
        const head = prevSnake[0];
        const newHead = {
          x: head.x + directionRef.current.x,
          y: head.y + directionRef.current.y
        };

        if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
          setIsGameOver(true);
          onSaveScore(score);
          return prevSnake;
        }

        if (prevSnake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
          setIsGameOver(true);
          onSaveScore(score);
          return prevSnake;
        }

        const newSnake = [newHead, ...prevSnake];

        if (newHead.x === food.x && newHead.y === food.y) {
          setScore(s => s + 1);
          setFood(generateFood());
        } else {
          newSnake.pop();
        }

        return newSnake;
      });
      setDirection(directionRef.current);
    };

    const intervalId = setInterval(moveSnake, 180); // Speed
    return () => clearInterval(intervalId);
  }, [food, generateFood, highScore, isGameOver]);

  const handleSwipe = (dir: string) => {
      switch (dir) {
        case 'UP':
          if (directionRef.current.y === 0) directionRef.current = { x: 0, y: -1 };
          break;
        case 'DOWN':
          if (directionRef.current.y === 0) directionRef.current = { x: 0, y: 1 };
          break;
        case 'LEFT':
          if (directionRef.current.x === 0) directionRef.current = { x: -1, y: 0 };
          break;
        case 'RIGHT':
          if (directionRef.current.x === 0) directionRef.current = { x: 1, y: 0 };
          break;
      }
  };

  const [touchStart, setTouchStart] = useState<{x: number, y:number} | null>(null);
  
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };
  
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    const dx = touchEnd.x - touchStart.x;
    const dy = touchEnd.y - touchStart.y;
    
    if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 30) handleSwipe('RIGHT');
        else if (dx < -30) handleSwipe('LEFT');
    } else {
        if (dy > 30) handleSwipe('DOWN');
        else if (dy < -30) handleSwipe('UP');
    }
    setTouchStart(null);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'var(--color-bg)', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
            <span style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-text)' }}>Score: {score}</span>
            <span style={{ color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Trophy size={16}/> {highScore}</span>
        </div>
        <button onClick={onExit} style={{ background: 'none', border: 'none', color: 'var(--color-text)', cursor: 'pointer' }}>
          <X size={24} />
        </button>
      </div>

      <div 
        style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem', touchAction: 'none' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div style={{ 
          width: '100%', 
          maxWidth: '400px', 
          aspectRatio: '1/1', 
          backgroundColor: '#0f172a',
          borderRadius: '8px',
          padding: '4px',
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
          position: 'relative'
        }}>
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
            const x = i % GRID_SIZE;
            const y = Math.floor(i / GRID_SIZE);
            const isHead = snake[0].x === x && snake[0].y === y;
            const isBody = snake.some((segment, idx) => idx !== 0 && segment.x === x && segment.y === y);
            const isFood = food.x === x && food.y === y;

            let bgColor = 'transparent';
            if (isHead) bgColor = '#4ade80';
            else if (isBody) bgColor = '#22c55e';
            else if (isFood) bgColor = '#ef4444';
            
            return (
              <div key={i} style={{ backgroundColor: bgColor, borderRadius: isFood ? '50%' : '2px', border: bgColor === 'transparent' ? '1px solid rgba(255,255,255,0.02)' : '1px solid rgba(0,0,0,0.1)' }} />
            );
          })}

          {isGameOver && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', borderRadius: '8px' }}>
                  <h2 style={{ marginBottom: '1rem', color: '#ef4444' }}>Stark!</h2>
                  <p style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>Punkte: {score}</p>
                  <button onClick={() => { resetGame(); onReplay(); }} className="btn btn-primary" style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1.5rem' }}>
                      <RefreshCw size={18} /> Noch eine Runde (5 🌟)
                  </button>
              </div>
          )}
        </div>
      </div>
      
      {/* Mobile Controls */}
      <div style={{ padding: '1rem', display: 'flex', justifyContent: 'center', gap: '1rem', paddingBottom: '3rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 60px)', gridTemplateRows: 'repeat(2, 60px)', gap: '0.5rem' }}>
              <div />
              <button onTouchStart={() => handleSwipe('UP')} onMouseDown={() => handleSwipe('UP')} className="btn" style={{ padding: 0, background: 'var(--color-surface)', fontSize: '1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>↑</button>
              <div />
              <button onTouchStart={() => handleSwipe('LEFT')} onMouseDown={() => handleSwipe('LEFT')} className="btn" style={{ padding: 0, background: 'var(--color-surface)', fontSize: '1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>←</button>
              <button onTouchStart={() => handleSwipe('DOWN')} onMouseDown={() => handleSwipe('DOWN')} className="btn" style={{ padding: 0, background: 'var(--color-surface)', fontSize: '1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>↓</button>
              <button onTouchStart={() => handleSwipe('RIGHT')} onMouseDown={() => handleSwipe('RIGHT')} className="btn" style={{ padding: 0, background: 'var(--color-surface)', fontSize: '1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>→</button>
          </div>
      </div>
    </div>
  );
};
