import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Volume2, VolumeX, X } from 'lucide-react';
import {
  CHEST_TIERS,
  VOCAB_BADGES,
  type VocabBadgeId,
  type VocabPendingChest,
} from '../../pages/vocabGamification';
import {
  isVocabSfxMuted,
  playChestOpenSound,
  playChestTapSound,
  setVocabSfxMuted,
} from '../../pages/vocabSounds';

interface VocabTreasureChestProps {
  chest: VocabPendingChest | null;
  onClaim: (chestId: string) => VocabBadgeId[];
  onClose: () => void;
}

const TAPS_REQUIRED = 6;
const CONFETTI_COLORS = ['#FACC15', '#EC4899', '#38BDF8', '#34D399', '#A855F7', '#FB923C', '#FFFFFF'];

export const VocabTreasureChest: React.FC<VocabTreasureChestProps> = ({ chest, onClaim, onClose }) => {
  const [taps, setTaps] = useState(0);
  const [opened, setOpened] = useState(false);
  const [tapPulse, setTapPulse] = useState(0);
  const [muted, setMuted] = useState(() => isVocabSfxMuted());
  const [unlockedBadges, setUnlockedBadges] = useState<VocabBadgeId[]>([]);

  React.useEffect(() => {
    setTaps(0);
    setOpened(false);
    setTapPulse(0);
    setUnlockedBadges([]);
  }, [chest?.id]);

  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        left: `${4 + ((i * 37) % 90)}%`,
        delay: `${(i % 7) * 0.08}s`,
        duration: `${1.45 + (i % 5) * 0.25}s`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 8 + (i % 4) * 3,
        isDiamond: i % 3 === 0,
      })),
    []
  );

  if (!chest) return null;

  const tierMeta = CHEST_TIERS[chest.tier];
  const remaining = Math.max(0, TAPS_REQUIRED - taps);
  const progressRatio = Math.min(1, taps / TAPS_REQUIRED);

  const handleTapChest = () => {
    if (opened) return;
    const nextTaps = taps + 1;
    setTaps(nextTaps);
    setTapPulse(v => v + 1);

    if (nextTaps >= TAPS_REQUIRED) {
      playChestOpenSound();
      setOpened(true);
      const badges = onClaim(chest.id);
      setUnlockedBadges(badges);
    } else {
      playChestTapSound(nextTaps, TAPS_REQUIRED);
    }
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setVocabSfxMuted(next);
  };

  const tapPrompt =
    taps === 0
      ? 'Tippe auf die Schatztruhe!'
      : remaining > 3
        ? `Weiter klopfen! Noch ${remaining}×`
        : remaining > 1
          ? `Sie glüht schon! Noch ${remaining}×`
          : 'Noch 1× tippen – sie springt gleich auf!';

  const chestFilter =
    chest.tier === 'rainbow'
      ? `drop-shadow(0 0 ${18 + taps * 5}px rgba(236, 72, 153, 0.9)) drop-shadow(0 18px 26px rgba(0, 0, 0, 0.55))`
      : chest.tier === 'gold'
        ? `drop-shadow(0 0 ${16 + taps * 5}px rgba(250, 204, 21, 0.92)) drop-shadow(0 18px 26px rgba(0, 0, 0, 0.55))`
        : `drop-shadow(0 0 ${14 + taps * 4}px rgba(56, 189, 248, 0.75)) drop-shadow(0 18px 26px rgba(0, 0, 0, 0.55))`;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Schatztruhe öffnen"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2400,
        background:
          chest.tier === 'rainbow'
            ? 'radial-gradient(circle at 50% 36%, #701A75 0%, #312E81 48%, #090D1F 100%)'
            : 'radial-gradient(circle at 50% 36%, #3730A3 0%, #1E1B4B 52%, #090D1F 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        overflow: 'hidden',
        color: '#FFFFFF',
      }}
    >
      {/* Top Controls */}
      <div
        style={{
          position: 'absolute',
          top: '1rem',
          left: '1rem',
          right: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10,
        }}
      >
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? 'Sound einschalten' : 'Sound ausschalten'}
          style={{
            height: '40px',
            padding: '0 0.85rem',
            borderRadius: '999px',
            border: '1px solid rgba(255,255,255,0.24)',
            background: 'rgba(15, 23, 42, 0.55)',
            color: '#FFFFFF',
            fontSize: '12px',
            fontWeight: 800,
            fontFamily: 'inherit',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            cursor: 'pointer',
          }}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          {muted ? 'Ton aus' : 'Ton an'}
        </button>

        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.24)',
            background: 'rgba(15, 23, 42, 0.55)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Confetti & Falling 3D Diamonds once opened */}
      {opened && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 2 }}>
          {confettiPieces.map(piece => (
            <span
              key={piece.id}
              className="vocab-confetti-piece"
              style={{
                position: 'absolute',
                top: '-32px',
                left: piece.left,
                animationDelay: piece.delay,
                animationDuration: piece.duration,
                width: piece.isDiamond ? '26px' : `${piece.size}px`,
                height: piece.isDiamond ? '26px' : `${piece.size * 1.4}px`,
                borderRadius: piece.isDiamond ? undefined : '3px',
                background: piece.isDiamond ? 'transparent' : piece.color,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {piece.isDiamond && (
                <img
                  src="/vocab-game/diamond.png"
                  alt=""
                  style={{ width: '24px', height: '24px', objectFit: 'contain' }}
                />
              )}
            </span>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 5,
          width: '100%',
          maxWidth: '430px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '0.9rem',
        }}
      >
        {/* Tier Pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.42rem 1rem',
            borderRadius: '999px',
            background: 'rgba(250, 204, 21, 0.18)',
            border: '1.5px solid rgba(250, 204, 21, 0.55)',
            color: '#FEF08A',
            fontSize: '12px',
            fontWeight: 900,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          <Sparkles size={14} color="#FDE047" />
          {chest.blockSize} Vokabeln gemeistert!
        </div>

        <h2
          style={{
            margin: 0,
            fontSize: 'clamp(1.7rem, 6.5vw, 2.25rem)',
            fontWeight: 900,
            lineHeight: 1.12,
            textShadow: '0 4px 18px rgba(0,0,0,0.45)',
          }}
        >
          {opened ? tierMeta.label : 'Schatztruhe freigeschaltet!'}
        </h2>

        {/* Chest Stage with Rotating Golden / Rainbow Halo */}
        <div
          style={{
            position: 'relative',
            width: '290px',
            height: '265px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Rotating Sunburst Halo ("Heiligenschein") */}
          <div
            className="vocab-chest-halo"
            style={{
              position: 'absolute',
              width: opened ? '330px' : `${240 + progressRatio * 65}px`,
              height: opened ? '330px' : `${240 + progressRatio * 65}px`,
              borderRadius: '50%',
              background:
                chest.tier === 'rainbow'
                  ? 'repeating-conic-gradient(from 0deg, rgba(250,204,21,0.52) 0deg 14deg, rgba(236,72,153,0.42) 14deg 28deg, rgba(56,189,248,0.45) 28deg 42deg, transparent 42deg 56deg)'
                  : 'repeating-conic-gradient(from 0deg, rgba(253,224,71,0.58) 0deg 14deg, rgba(251,146,60,0.22) 14deg 20deg, transparent 20deg 32deg)',
              WebkitMaskImage: 'radial-gradient(circle, rgba(0,0,0,1) 24%, rgba(0,0,0,0) 70%)',
              maskImage: 'radial-gradient(circle, rgba(0,0,0,1) 24%, rgba(0,0,0,0) 70%)',
              transition: 'width 0.25s ease, height 0.25s ease',
              pointerEvents: 'none',
            }}
          />

          {/* Intense Inner Light Halo */}
          <div
            style={{
              position: 'absolute',
              width: '200px',
              height: '200px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${opened ? 'rgba(56,189,248,0.65)' : tierMeta.glow} 0%, transparent 72%)`,
              filter: 'blur(12px)',
              transform: `scale(${opened ? 1.35 : 1 + progressRatio * 0.3})`,
              transition: 'transform 0.25s ease',
              pointerEvents: 'none',
            }}
          />

          {/* Floating Sparkles */}
          <span className="vocab-sparkle-1" style={{ position: 'absolute', top: '16px', left: '22px', fontSize: '22px', pointerEvents: 'none' }}>✨</span>
          <span className="vocab-sparkle-2" style={{ position: 'absolute', top: '22px', right: '20px', fontSize: '24px', pointerEvents: 'none' }}>⭐</span>
          <img
            src="/vocab-game/diamond.png"
            alt=""
            className="vocab-sparkle-3"
            style={{ position: 'absolute', bottom: '28px', left: '16px', width: '28px', height: '28px', objectFit: 'contain', pointerEvents: 'none' }}
          />

          {/* Interactive 3D Cutout Treasure Chest Image */}
          <button
            key={tapPulse}
            type="button"
            onClick={handleTapChest}
            aria-label={opened ? 'Schatztruhe geöffnet' : 'Schatztruhe antippen'}
            className={opened ? 'vocab-chest-opened' : taps > 0 ? 'vocab-chest-tap-hit' : 'vocab-chest-wobble'}
            style={{
              position: 'relative',
              zIndex: 3,
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: opened ? 'default' : 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <img
              src={opened ? '/vocab-game/chest-open.png' : '/vocab-game/chest-closed.png'}
              alt={opened ? 'Geöffnete Schatztruhe mit Diamanten' : 'Geschlossene Schatztruhe'}
              draggable={false}
              style={{
                width: opened ? '238px' : '220px',
                height: opened ? '238px' : '220px',
                objectFit: 'contain',
                filter: chestFilter,
                transition: 'width 0.25s ease, height 0.25s ease',
                userSelect: 'none',
              }}
            />
          </button>
        </div>

        {/* Before Opening: Tap Progress Bar & 3D Game Button */}
        {!opened ? (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ fontSize: 'var(--font-base)', fontWeight: 900, color: '#FEF08A' }}>
              {tapPrompt}
            </div>

            <div style={{ display: 'flex', gap: '0.45rem' }}>
              {Array.from({ length: TAPS_REQUIRED }, (_, i) => (
                <span
                  key={i}
                  style={{
                    width: '32px',
                    height: '11px',
                    borderRadius: '999px',
                    background: i < taps ? 'linear-gradient(90deg, #FDE047, #F97316)' : 'rgba(255,255,255,0.18)',
                    border: i < taps ? '1px solid #FEF08A' : '1px solid rgba(255,255,255,0.12)',
                    transition: 'background 0.2s ease, transform 0.2s ease',
                    transform: i === taps - 1 ? 'scale(1.18)' : 'scale(1)',
                  }}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={handleTapChest}
              style={{
                marginTop: '0.3rem',
                height: '54px',
                padding: '0 2.2rem',
                borderRadius: '18px',
                border: '2px solid #FEF08A',
                background: 'linear-gradient(180deg, #FDE047 0%, #F59E0B 100%)',
                color: '#3B0764',
                fontSize: 'var(--font-base)',
                fontWeight: 900,
                fontFamily: 'inherit',
                cursor: 'pointer',
                boxShadow: '0 6px 0 #B45309, 0 14px 28px rgba(245, 158, 11, 0.45)',
                letterSpacing: '0.02em',
              }}
            >
              KLOPFEN! ({taps} / {TAPS_REQUIRED})
            </button>
          </div>
        ) : (
          /* After Opening: Reward Reveal Card with Real 3D Diamond */
          <div
            style={{
              width: '100%',
              padding: '1.2rem 1.2rem',
              borderRadius: '24px',
              background: 'linear-gradient(180deg, rgba(30, 27, 75, 0.88), rgba(15, 23, 42, 0.92))',
              border: '2px solid rgba(56, 189, 248, 0.55)',
              backdropFilter: 'blur(12px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.65rem',
              boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
            }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}>
              <span style={{ fontSize: 'clamp(2.4rem, 9vw, 3.2rem)', fontWeight: 900, lineHeight: 1, color: '#FEF08A', textShadow: '0 3px 14px rgba(250,204,21,0.5)' }}>
                +{chest.diamonds}
              </span>
              <img
                src="/vocab-game/diamond.png"
                alt="Diamanten"
                style={{ width: '48px', height: '48px', objectFit: 'contain', filter: 'drop-shadow(0 0 14px rgba(56,189,248,0.85))' }}
              />
            </div>

            <div style={{ fontSize: 'var(--font-sm)', fontWeight: 800, color: '#E0F2FE' }}>
              {chest.correctCount} von {chest.blockSize} richtig ({chest.accuracy} %)
            </div>

            {unlockedBadges.length > 0 && (
              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.2rem' }}>
                {unlockedBadges.map(id => {
                  const meta = VOCAB_BADGES.find(b => b.id === id);
                  if (!meta) return null;
                  return (
                    <span
                      key={id}
                      style={{
                        padding: '0.32rem 0.75rem',
                        borderRadius: '999px',
                        background: 'rgba(250, 204, 21, 0.22)',
                        border: '1px solid rgba(250, 204, 21, 0.55)',
                        fontSize: '12px',
                        fontWeight: 800,
                        color: '#FEF08A',
                      }}
                    >
                      Neues Abzeichen: {meta.emoji} {meta.title}
                    </span>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                marginTop: '0.45rem',
                width: '100%',
                height: '52px',
                borderRadius: '16px',
                border: '2px solid #6EE7B7',
                background: 'linear-gradient(180deg, #34D399 0%, #10B981 100%)',
                color: '#022C22',
                fontSize: 'var(--font-base)',
                fontWeight: 900,
                fontFamily: 'inherit',
                cursor: 'pointer',
                boxShadow: '0 5px 0 #047857, 0 12px 24px rgba(16, 185, 129, 0.4)',
              }}
            >
              DIAMANTEN EINSAMMELN!
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes vocabHaloSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes vocabChestWobble {
          0%, 100% { transform: rotate(0deg) scale(1); }
          15% { transform: rotate(-6deg) translateY(-5px) scale(1.04); }
          30% { transform: rotate(6deg) translateY(-8px) scale(1.06); }
          45% { transform: rotate(-4deg) translateY(-3px) scale(1.02); }
          60% { transform: rotate(3deg) scale(1.01); }
          75% { transform: rotate(0deg) scale(1); }
        }
        @keyframes vocabChestHit {
          0% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(1.16, 0.88) rotate(-9deg); }
          55% { transform: scale(0.94, 1.12) rotate(8deg) translateY(-14px); }
          80% { transform: scale(1.05) rotate(-3deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes vocabChestPopOpen {
          0% { transform: scale(0.85); }
          45% { transform: scale(1.14) translateY(-8px); }
          100% { transform: scale(1); }
        }
        @keyframes vocabConfettiFall {
          0% { transform: translateY(-30px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(108vh) rotate(540deg); opacity: 0.15; }
        }
        @keyframes vocabSparkleFloat {
          0%, 100% { transform: translateY(0px) scale(0.92); opacity: 0.78; }
          50% { transform: translateY(-11px) scale(1.18); opacity: 1; }
        }
        .vocab-chest-halo {
          animation: vocabHaloSpin 13s linear infinite;
        }
        .vocab-chest-wobble {
          animation: vocabChestWobble 1.65s ease-in-out infinite;
        }
        .vocab-chest-tap-hit {
          animation: vocabChestHit 0.36s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .vocab-chest-opened {
          animation: vocabChestPopOpen 0.48s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .vocab-confetti-piece {
          animation: vocabConfettiFall linear infinite;
        }
        .vocab-sparkle-1 {
          animation: vocabSparkleFloat 2.1s ease-in-out infinite;
        }
        .vocab-sparkle-2 {
          animation: vocabSparkleFloat 2.5s ease-in-out 0.4s infinite;
        }
        .vocab-sparkle-3 {
          animation: vocabSparkleFloat 1.9s ease-in-out 0.8s infinite;
        }
      `}</style>
    </div>,
    document.body
  );
};
