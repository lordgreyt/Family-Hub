import { useState, useEffect } from 'react';
import { Trophy, RefreshCw, X } from 'lucide-react';

const EMOJIS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼'];

const shuffle = (array: any[]) => [...array].sort(() => Math.random() - 0.5);

export const MemoryGame = ({ onExit, onReplay, onSaveScore, highScore }: { onExit: () => void, onReplay: () => void, onSaveScore: (score: number) => void, highScore: number }) => {
  const [cards, setCards] = useState<string[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);

  useEffect(() => {
    resetGame();
  }, []);

  const resetGame = () => {
    setCards(shuffle([...EMOJIS, ...EMOJIS]));
    setFlippedIndices([]);
    setMatchedPairs([]);
    setMoves(0);
  };

  const handleCardClick = (index: number) => {
    if (flippedIndices.length === 2 || flippedIndices.includes(index) || matchedPairs.includes(cards[index])) {
      return;
    }

    const newFlipped = [...flippedIndices, index];
    setFlippedIndices(newFlipped);

    if (newFlipped.length === 2) {
      setMoves(m => m + 1);
      const [first, second] = newFlipped;
      if (cards[first] === cards[second]) {
        setMatchedPairs([...matchedPairs, cards[first]]);
        setFlippedIndices([]);
      } else {
        setTimeout(() => {
          setFlippedIndices([]);
        }, 1000);
      }
    }
  };

  const isGameOver = matchedPairs.length === EMOJIS.length;

  useEffect(() => {
    if (isGameOver) {
       onSaveScore(moves);
    }
  }, [isGameOver, moves, onSaveScore]);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'var(--color-bg)', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
       <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
            <span style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-text)' }}>Versuche: {moves}</span>
        </div>
        <button onClick={onExit} style={{ background: 'none', border: 'none', color: 'var(--color-text)', cursor: 'pointer' }}>
          <X size={24} />
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
        <div style={{ 
          width: '100%', 
          maxWidth: '400px', 
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '10px',
          padding: '10px'
        }}>
          {cards.map((emoji, index) => {
            const isFlipped = flippedIndices.includes(index);
            const isMatched = matchedPairs.includes(emoji);
            const showFace = isFlipped || isMatched;

            return (
              <div 
                key={index} 
                onClick={() => handleCardClick(index)}
                style={{
                  aspectRatio: '1/1',
                  backgroundColor: showFace ? 'var(--color-surface)' : 'var(--color-primary)',
                  borderRadius: '12px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: '3rem',
                  cursor: showFace ? 'default' : 'pointer',
                  boxShadow: showFace ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  transform: showFace ? 'rotateY(0)' : 'rotateY(180deg)',
                  transition: 'transform 0.3s, background-color 0.3s',
                  userSelect: 'none',
                  opacity: isMatched ? 0.6 : 1
                }}
              >
                {/* To simulate the card flip effect smoothly without double layers, we just flip the text */}
                <div style={{ transform: showFace ? 'rotateY(0)' : 'rotateY(180deg)', opacity: showFace ? 1 : 0, transition: 'opacity 0.2s' }}>
                  {emoji}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isGameOver && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', zIndex: 10 }}>
              <Trophy size={64} fill="#facc15" color="#ca8a04" style={{ marginBottom: '1rem' }} />
              <h2 style={{ marginBottom: '1rem', color: '#facc15' }}>Klasse gemacht!</h2>
              <p style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>Benötigte Versuche: {moves}</p>
              {highScore > 0 && <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: '#facc15' }}>Rekord: {highScore}</p>}
              <button onClick={() => { resetGame(); onReplay(); }} className="btn btn-primary" style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1.5rem' }}>
                  <RefreshCw size={18} /> Noch eine Runde (5 🌟)
              </button>
          </div>
      )}
    </div>
  );
};
