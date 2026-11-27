import React, { useState } from 'react';
import {
  Check,
  Clock,
  Gift,
  Play,
  Send,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import {
  CHEST_TIERS,
  LEVEL_UP_DIAMONDS,
  VOCAB_BADGES,
  VOCAB_RANKS,
  WEEKLY_BONUS_DIAMONDS,
  currentWeekDays,
  getBadgeProgress,
  getLevelProgress,
  reservedDiamondsForUser,
  type VocabChildGamification,
  type VocabDiamondExchangeRequest,
  type VocabGamificationSettings,
  type VocabPendingChest,
} from '../../pages/vocabGamification';
import { CARD, GREEN_TEXT, PINK_TEXT, PRIMARY } from '../SurgeryFinance/theme';

/* ============================================================================
 * 1. Profi-Gaming-Arena HUD (3D-Eule, 3D-Ressourcen, 3D-Truhe, Streaks & 3 Quests)
 * ============================================================================ */

interface VocabTreasureHudProps {
  profile: VocabChildGamification;
  settings: VocabGamificationSettings;
  childLabel: string;
  hardWordCount: number;
  onOpenChest: (chest: VocabPendingChest) => void;
  onOpenTreasury: () => void;
  onStartQuestAction: (action: 'hard' | 'quiz') => void;
}

export const VocabTreasureHud: React.FC<VocabTreasureHudProps> = ({
  profile,
  settings,
  childLabel,
  hardWordCount,
  onOpenChest,
  onOpenTreasury,
  onStartQuestAction,
}) => {
  const levelInfo = getLevelProgress(profile.totalCorrect);
  const weekDays = currentWeekDays();
  const activeSet = new Set(profile.weekActiveDays);
  const blockPct = Math.min(100, Math.round((profile.blockCount / Math.max(1, settings.chestSize)) * 100));
  const todayPct = Math.min(100, Math.round((profile.todayCount / Math.max(1, settings.dailyGoal)) * 100));
  const todayDone = profile.todayCount >= settings.dailyGoal;
  const nextChest = profile.pendingChests[0] || null;
  const nearChest = blockPct >= 80;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      {/* READY-TO-OPEN 3D TREASURE CHEST STAGE */}
      {nextChest && (
        <button
          type="button"
          onClick={() => onOpenChest(nextChest)}
          style={{
            position: 'relative',
            overflow: 'hidden',
            width: '100%',
            padding: '1.05rem 1.15rem',
            borderRadius: '24px',
            border: '2px solid #FDE047',
            background: 'linear-gradient(135deg, #4C1D95 0%, #9D174D 52%, #EA580C 100%)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            gap: '0.9rem',
            textAlign: 'left',
            cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 6px 0 #7C2D12, 0 18px 34px rgba(219, 39, 119, 0.38)',
          }}
        >
          {/* Rotating Halo behind the 3D Chest */}
          <div style={{ position: 'relative', width: '78px', height: '78px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
              className="vocab-hud-halo"
              style={{
                position: 'absolute',
                inset: '-10px',
                borderRadius: '50%',
                background: 'repeating-conic-gradient(from 0deg, rgba(253,224,71,0.6) 0deg 16deg, transparent 16deg 32deg)',
                WebkitMaskImage: 'radial-gradient(circle, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 70%)',
                maskImage: 'radial-gradient(circle, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 70%)',
              }}
            />
            <img
              src="/vocab-game/chest-closed.png"
              alt="Schatztruhe"
              className="vocab-mini-wobble"
              style={{
                position: 'relative',
                zIndex: 2,
                width: '74px',
                height: '74px',
                objectFit: 'contain',
                filter: 'drop-shadow(0 0 14px rgba(253,224,71,0.85))',
              }}
            />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#FEF08A' }}>
              {profile.pendingChests.length > 1
                ? `${profile.pendingChests.length} SCHATZTRUHEN BEREIT!`
                : 'SCHATZTRUHE FREIGESCHALTET!'}
            </div>
            <div style={{ fontSize: '1.18rem', fontWeight: 900, lineHeight: 1.15, marginTop: '0.12rem' }}>
              Jetzt klopfen & Diamanten holen!
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, opacity: 0.92, marginTop: '0.18rem' }}>
              {CHEST_TIERS[nextChest.tier].label} · {nextChest.accuracy} % richtig
            </div>
          </div>

          <span
            style={{
              padding: '0.55rem 0.95rem',
              borderRadius: '14px',
              background: 'linear-gradient(180deg, #FEF08A, #FACC15)',
              color: '#4C1D95',
              fontSize: '13px',
              fontWeight: 900,
              whiteSpace: 'nowrap',
              flexShrink: 0,
              boxShadow: '0 4px 0 #CA8A04',
            }}
          >
            ÖFFNEN!
          </span>
        </button>
      )}

      {/* PRO GAMING STAGE BOARD (Dark Starry Arena + Cutout 3D Mascot & Resources) */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '26px',
          padding: '1.15rem 1.15rem 1.2rem',
          background: 'linear-gradient(150deg, #17153B 0%, #2E236C 48%, #432C7A 100%)',
          border: '2px solid rgba(167, 139, 250, 0.35)',
          boxShadow: '0 16px 36px rgba(23, 21, 59, 0.38)',
          color: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.95rem',
        }}
      >
        {/* Subtle decorative starry glow orbs */}
        <div
          style={{
            position: 'absolute',
            top: '-45px',
            right: '-35px',
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(56, 189, 248, 0.25) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-50px',
            left: '-30px',
            width: '170px',
            height: '170px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(236, 72, 153, 0.22) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* Top Game HUD Bar: 3D Explorer Owl + Rank + Resource Pills */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          <img
            src="/vocab-game/hero-owl.png"
            alt="Entdecker-Eule"
            className="vocab-owl-float"
            style={{
              width: '84px',
              height: '84px',
              objectFit: 'contain',
              flexShrink: 0,
              filter: 'drop-shadow(0 10px 18px rgba(0, 0, 0, 0.45))',
            }}
          />

          <div style={{ flex: '1 1 170px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  padding: '0.18rem 0.58rem',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #FACC15, #F97316)',
                  color: '#2E1065',
                  fontSize: '11.5px',
                  fontWeight: 900,
                  letterSpacing: '0.04em',
                }}
              >
                LVL {levelInfo.level} / {levelInfo.maxLevel}
              </span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#C4B5FD' }}>
                {childLabel}
              </span>
            </div>

            <div style={{ fontSize: '1.2rem', fontWeight: 900, lineHeight: 1.15, marginTop: '0.2rem' }}>
              {levelInfo.title}
            </div>

            {/* Current-Level XP Progress Bar */}
            <div style={{ marginTop: '0.45rem', display: 'flex', flexDirection: 'column', gap: '0.22rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    flex: 1,
                    height: '10px',
                    borderRadius: '999px',
                    background: 'rgba(255,255,255,0.14)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    overflow: 'hidden',
                    padding: '1px',
                  }}
                >
                  <div
                    style={{
                      width: `${levelInfo.progressPct}%`,
                      height: '100%',
                      borderRadius: '999px',
                      background: 'linear-gradient(90deg, #38BDF8, #A855F7, #F472B6)',
                      boxShadow: '0 0 8px rgba(168, 85, 247, 0.7)',
                      transition: 'width 0.35s ease',
                    }}
                  />
                </div>
                <span style={{ fontSize: '10.5px', fontWeight: 900, color: '#BAE6FD', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {levelInfo.isMaxLevel
                    ? 'MAX LVL'
                    : `${levelInfo.currentLevelXp.toLocaleString('de-DE')} / ${levelInfo.xpForNextLevel.toLocaleString('de-DE')} XP`}
                </span>
              </div>
              <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#C4B5FD', display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                {levelInfo.isMaxLevel ? (
                  <span style={{ color: '#FEF08A', fontWeight: 900 }}>Höchstes Level 60 erreicht!</span>
                ) : (
                  <>
                    <span>
                      Noch {levelInfo.wordsRemainingForNextLevel} richtige bis Lvl {levelInfo.level + 1}
                    </span>
                    <span style={{ color: '#7DD3FC', fontWeight: 900 }}>
                      (+{LEVEL_UP_DIAMONDS} 💎)
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Sparkling 3D Diamond Balance Button */}
          <button
            type="button"
            onClick={onOpenTreasury}
            style={{
              height: '46px',
              padding: '0 0.95rem 0 0.55rem',
              borderRadius: '16px',
              border: '2px solid rgba(56, 189, 248, 0.65)',
              background: 'linear-gradient(180deg, rgba(14, 165, 233, 0.38) 0%, rgba(3, 105, 161, 0.55) 100%)',
              color: '#FFFFFF',
              fontSize: '1.08rem',
              fontWeight: 900,
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              cursor: 'pointer',
              boxShadow: '0 4px 0 rgba(7, 89, 133, 0.95), 0 8px 18px rgba(14, 165, 233, 0.3)',
            }}
          >
            <img
              src="/vocab-game/diamond.png"
              alt="Diamanten"
              style={{ width: '30px', height: '30px', objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(56,189,248,0.8))' }}
            />
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{profile.diamonds}</span>
            <span
              style={{
                marginLeft: '2px',
                padding: '0.14rem 0.45rem',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.2)',
                fontSize: '10.5px',
                fontWeight: 900,
              }}
            >
              SHOP
            </span>
          </button>
        </div>

        {/* 50-Vocab 3D Chest Progress Stage */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            padding: '0.8rem 0.9rem',
            borderRadius: '18px',
            background: 'rgba(15, 23, 42, 0.48)',
            border: '1.5px solid rgba(255, 255, 255, 0.14)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.8rem',
          }}
        >
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
              <span style={{ fontSize: '12px', fontWeight: 900, letterSpacing: '0.03em', color: '#FEF08A' }}>
                SCHATZTRUHEN-JAGD
              </span>
              <span style={{ fontSize: '13px', fontWeight: 900, color: '#FFFFFF', fontVariantNumeric: 'tabular-nums' }}>
                {profile.blockCount} / {settings.chestSize}
              </span>
            </div>

            <div
              style={{
                height: '14px',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.14)',
                overflow: 'hidden',
                padding: '2px',
              }}
            >
              <div
                style={{
                  width: `${blockPct}%`,
                  height: '100%',
                  borderRadius: '999px',
                  background: 'linear-gradient(90deg, #38BDF8 0%, #A855F7 48%, #FACC15 100%)',
                  boxShadow: '0 0 12px rgba(250, 204, 21, 0.65)',
                  transition: 'width 0.35s ease',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#CBD5E1' }}>
              <span>Noch {Math.max(0, settings.chestSize - profile.blockCount)} Wörter bis zur Truhe</span>
              {profile.blockCount > 0 && (
                <span style={{ color: '#6EE7B7', fontWeight: 800 }}>
                  Quote: {Math.round((profile.blockCorrect / profile.blockCount) * 100)} %
                </span>
              )}
            </div>
          </div>

          <img
            src="/vocab-game/chest-closed.png"
            alt="Nächste Truhe"
            className={nearChest ? 'vocab-mini-wobble' : undefined}
            style={{
              width: '58px',
              height: '58px',
              objectFit: 'contain',
              flexShrink: 0,
              filter: nearChest
                ? 'drop-shadow(0 0 12px rgba(250, 204, 21, 0.9))'
                : 'drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45))',
            }}
          />
        </div>

        {/* Streaks Row: 3D Flame + 3D Ice Shield + 7-Day Weekly Arena Strip */}
        <div style={{ position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(225px, 1fr))', gap: '0.65rem' }}>
          {/* Daily Flame + Ice Shield */}
          <div
            style={{
              padding: '0.75rem 0.85rem',
              borderRadius: '18px',
              background: todayDone ? 'rgba(245, 158, 11, 0.2)' : 'rgba(15, 23, 42, 0.45)',
              border: todayDone ? '1.5px solid rgba(251, 191, 36, 0.65)' : '1px solid rgba(255,255,255,0.14)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <img
                  src="/vocab-game/flame.png"
                  alt="Tages-Flamme"
                  style={{
                    width: '32px',
                    height: '32px',
                    objectFit: 'contain',
                    filter: profile.dailyStreak > 0 ? 'drop-shadow(0 0 8px rgba(251,146,60,0.85))' : 'grayscale(0.6) opacity(0.75)',
                  }}
                />
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 900, color: '#FEF08A', lineHeight: 1.1 }}>
                    {profile.dailyStreak} {profile.dailyStreak === 1 ? 'Tag' : 'Tage'} Serie
                  </div>
                  <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#CBD5E1' }}>
                    {todayDone ? `Heute erledigt (${profile.todayCount})` : `Heute: ${profile.todayCount} / ${settings.dailyGoal}`}
                  </div>
                </div>
              </div>

              <div
                title="Eis-Schild schützt 1× pro Woche deine Serie, falls ein Tag ausfällt"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.22rem 0.5rem 0.22rem 0.3rem',
                  borderRadius: '12px',
                  background: profile.freezeUsedThisWeek ? 'rgba(255,255,255,0.08)' : 'rgba(56, 189, 248, 0.22)',
                  border: profile.freezeUsedThisWeek ? '1px solid rgba(255,255,255,0.14)' : '1px solid rgba(125, 211, 252, 0.55)',
                  opacity: profile.freezeUsedThisWeek ? 0.65 : 1,
                }}
              >
                <img
                  src="/vocab-game/shield-ice.png"
                  alt="Eis-Schild"
                  style={{ width: '22px', height: '22px', objectFit: 'contain' }}
                />
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#E0F2FE' }}>
                  {profile.freezeUsedThisWeek ? 'Genutzt' : 'Schutz'}
                </span>
              </div>
            </div>

            <div style={{ height: '7px', borderRadius: '999px', background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${todayPct}%`,
                  height: '100%',
                  borderRadius: '999px',
                  background: todayDone ? '#34D399' : 'linear-gradient(90deg, #FB923C, #FDE047)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {/* Weekly Streak Mo–So */}
          <div
            style={{
              padding: '0.75rem 0.85rem',
              borderRadius: '18px',
              background: 'rgba(15, 23, 42, 0.45)',
              border: '1px solid rgba(255,255,255,0.14)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 900, color: '#E0E7FF' }}>
                WOCHEN-STREAK: {profile.weekActiveDays.length} / {settings.weeklyGoalDays}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '11.5px', fontWeight: 900, color: '#7DD3FC' }}>
                {profile.weeklyStreak > 0 ? `${profile.weeklyStreak} Wo.` : `+${WEEKLY_BONUS_DIAMONDS}`}
                {profile.weeklyStreak === 0 && (
                  <img src="/vocab-game/diamond.png" alt="" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
                )}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
              {weekDays.map(day => {
                const done = activeSet.has(day.key);
                return (
                  <div key={day.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                    <span
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '10px',
                        background: done
                          ? 'linear-gradient(180deg, #34D399, #059669)'
                          : day.isToday
                            ? 'rgba(129, 140, 248, 0.35)'
                            : 'rgba(255,255,255,0.08)',
                        border: day.isToday && !done ? '1.5px solid #A5B4FC' : 'none',
                        color: done ? '#FFFFFF' : day.isToday ? '#E0E7FF' : '#94A3B8',
                        fontSize: '11px',
                        fontWeight: 900,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: done ? '0 3px 0 #065F46' : 'none',
                      }}
                    >
                      {done ? <Check size={14} strokeWidth={3} /> : day.short[0]}
                    </span>
                    <span style={{ fontSize: '9.5px', fontWeight: 700, color: day.isToday ? '#FEF08A' : '#94A3B8' }}>
                      {day.short}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 3 DAILY GAMING QUESTS BOARD (Same Dark Starry Gaming Style!) */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '26px',
          padding: '1.1rem 1.15rem',
          background: 'linear-gradient(155deg, #17153B 0%, #2A2063 55%, #3C2474 100%)',
          border: '2px solid rgba(167, 139, 250, 0.35)',
          boxShadow: '0 14px 32px rgba(23, 21, 59, 0.32)',
          color: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-40px',
            left: '-30px',
            width: '150px',
            height: '150px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(244, 114, 182, 0.2) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}>
            <img
              src="/vocab-game/swords-quest.png"
              alt="Quests"
              style={{ width: '36px', height: '36px', objectFit: 'contain', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.45))' }}
            />
            <div>
              <div style={{ fontSize: '10.5px', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#C4B5FD' }}>
                Tägliche Missionen
              </div>
              <div style={{ fontSize: '1.08rem', fontWeight: 900, lineHeight: 1.15 }}>
                Tages-Quests
              </div>
            </div>
          </div>

          <span
            style={{
              padding: '0.28rem 0.7rem',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.18)',
              fontSize: '11.5px',
              fontWeight: 900,
              color: '#FEF08A',
            }}
          >
            {profile.dailyQuests.filter(q => q.completed).length} / {profile.dailyQuests.length} geschafft
          </span>
        </div>

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {profile.dailyQuests.map(quest => {
            const pct = Math.min(100, Math.round((quest.progress / Math.max(1, quest.target)) * 100));
            const isBoss = quest.kind === 'hard_boss';
            const questIconSrc =
              quest.kind === 'answers_30'
                ? '/vocab-game/flame.png'
                : quest.kind === 'hard_boss'
                  ? '/vocab-game/boss-dragon.png'
                  : quest.kind === 'combo_10'
                    ? '/vocab-game/lightning-bolt.png'
                    : quest.kind === 'active_12'
                      ? '/vocab-game/sound-orb.png'
                      : '/vocab-game/swords-quest.png';

            return (
              <div
                key={quest.id}
                style={{
                  padding: '0.85rem 0.9rem',
                  borderRadius: '18px',
                  border: quest.completed
                    ? '1.5px solid rgba(52, 211, 153, 0.65)'
                    : isBoss
                      ? '1.5px solid rgba(244, 114, 182, 0.55)'
                      : '1px solid rgba(255, 255, 255, 0.14)',
                  background: quest.completed
                    ? 'rgba(16, 185, 129, 0.18)'
                    : isBoss
                      ? 'linear-gradient(135deg, rgba(190, 24, 93, 0.28), rgba(15, 23, 42, 0.52))'
                      : 'rgba(15, 23, 42, 0.48)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.55rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
                    <img
                      src={questIconSrc}
                      alt=""
                      style={{
                        width: '40px',
                        height: '40px',
                        objectFit: 'contain',
                        flexShrink: 0,
                        filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.45))',
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13.5px', fontWeight: 900, color: '#FFFFFF', lineHeight: 1.2 }}>
                        {quest.title}
                      </div>
                      <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#CBD5E1', marginTop: '2px' }}>
                        {quest.subtitle}
                      </div>
                    </div>
                  </div>

                  {/* Diamond Reward Pill */}
                  <span
                    style={{
                      padding: '0.28rem 0.65rem',
                      borderRadius: '999px',
                      background: quest.completed ? '#10B981' : 'rgba(14, 165, 233, 0.28)',
                      border: quest.completed ? 'none' : '1px solid rgba(125, 211, 252, 0.5)',
                      color: '#FFFFFF',
                      fontSize: '12px',
                      fontWeight: 900,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {quest.completed ? (
                      <>
                        <Check size={13} strokeWidth={3} /> +{quest.rewardDiamonds}
                      </>
                    ) : (
                      <>
                        +{quest.rewardDiamonds}
                        <img src="/vocab-game/diamond.png" alt="" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
                      </>
                    )}
                  </span>
                </div>

                {/* Progress Bar + Quick Boss Launch */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ flex: 1, height: '10px', borderRadius: '999px', background: 'rgba(255,255,255,0.12)', overflow: 'hidden', padding: '1px' }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        borderRadius: '999px',
                        background: quest.completed
                          ? 'linear-gradient(90deg, #34D399, #10B981)'
                          : isBoss
                            ? 'linear-gradient(90deg, #F472B6, #FB923C)'
                            : 'linear-gradient(90deg, #38BDF8, #818CF8)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '11.5px', fontWeight: 900, color: quest.completed ? '#6EE7B7' : '#E2E8F0', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {quest.progress} / {quest.target}
                  </span>

                  {!quest.completed && isBoss && (
                    <button
                      type="button"
                      onClick={() => onStartQuestAction(hardWordCount > 0 ? 'hard' : 'quiz')}
                      style={{
                        height: '30px',
                        padding: '0 0.7rem',
                        borderRadius: '10px',
                        border: '1px solid #F9A8D4',
                        background: 'linear-gradient(180deg, #EC4899, #BE185D)',
                        color: '#FFFFFF',
                        fontSize: '11px',
                        fontWeight: 900,
                        fontFamily: 'inherit',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 3px 0 #831843',
                      }}
                    >
                      <Play size={11} fill="currentColor" /> BOSS!
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes vocabMiniWobble {
          0%, 100% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(-8deg) scale(1.06); }
          50% { transform: rotate(8deg) scale(1.08); }
          75% { transform: rotate(-5deg) scale(1.04); }
        }
        @keyframes vocabOwlFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes vocabHudHaloSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .vocab-mini-wobble {
          animation: vocabMiniWobble 1.6s ease-in-out infinite;
        }
        .vocab-owl-float {
          animation: vocabOwlFloat 3.2s ease-in-out infinite;
        }
        .vocab-hud-halo {
          animation: vocabHudHaloSpin 14s linear infinite;
        }
      `}</style>
    </div>
  );
};

/* ============================================================================
 * 2. Schatzkammer: Diamanten-Shop & Eltern-Freigabe (im Gaming-Shop-Look)
 * ============================================================================ */

interface VocabTreasuryViewProps {
  profile: VocabChildGamification;
  settings: VocabGamificationSettings;
  requests: VocabDiamondExchangeRequest[];
  isAdult: boolean;
  viewerName: string;
  onRequestExchange: (params: { diamonds: number; rewardLabel: string; starsReward?: number; note?: string }) => void;
  onResolveRequest: (requestId: string, decision: 'APPROVED' | 'REJECTED') => void;
}

export const VocabTreasuryView: React.FC<VocabTreasuryViewProps> = ({
  profile,
  settings,
  requests,
  isAdult,
  onRequestExchange,
  onResolveRequest,
}) => {
  const [note, setNote] = useState('');
  const [multiplier, setMultiplier] = useState(1);
  const [feedback, setFeedback] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null);

  const reserved = reservedDiamondsForUser(requests, profile.userId);
  const available = Math.max(0, profile.diamonds - reserved);
  const packDiamonds = settings.exchangeDiamonds * multiplier;
  const canAffordPack = available >= packDiamonds;

  const pendingForParents = requests.filter(r => r.status === 'PENDING');
  const childRequests = requests.filter(r => r.userId === profile.userId).slice(0, 15);

  const submitRequest = (diamonds: number, rewardLabel: string, starsReward?: number) => {
    setFeedback(null);
    try {
      onRequestExchange({ diamonds, rewardLabel, starsReward, note: note.trim() || undefined });
      setNote('');
      setMultiplier(1);
      setFeedback({
        text: starsReward
          ? `Anfrage für ${diamonds} Diamanten („${rewardLabel}“, +${starsReward} ⭐) an Mama & Papa gesendet!`
          : `Anfrage für ${diamonds} Diamanten („${rewardLabel}“) an Mama & Papa gesendet!`,
        kind: 'ok',
      });
    } catch (err) {
      setFeedback({ text: err instanceof Error ? err.message : 'Anfrage fehlgeschlagen.', kind: 'err' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      {/* Adult Approval Box */}
      {isAdult && pendingForParents.length > 0 && (
        <div
          style={{
            ...CARD,
            padding: '1rem 1.1rem',
            border: '2px solid rgba(245, 158, 11, 0.55)',
            background: 'linear-gradient(135deg, rgba(254, 243, 199, 0.8), var(--color-surface))',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
          }}
        >
          <div style={{ fontSize: 'var(--font-sm)', fontWeight: 900, color: '#B45309', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Gift size={17} /> Offene Diamanten-Anfragen ({pendingForParents.length})
          </div>
          {pendingForParents.map(req => (
            <div
              key={req.id}
              style={{
                padding: '0.75rem 0.85rem',
                borderRadius: '14px',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.65rem',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 'var(--font-sm)', fontWeight: 800, color: 'var(--color-text)' }}>
                  {req.userName}: <strong>{req.diamonds} 💎</strong> → {req.rewardLabel}
                  {(req.starsReward || 0) > 0 && (
                    <span
                      style={{
                        marginLeft: '0.4rem',
                        padding: '0.1rem 0.45rem',
                        borderRadius: '999px',
                        background: '#FEF3C7',
                        color: '#B45309',
                        fontSize: '11px',
                        fontWeight: 900,
                      }}
                    >
                      +{req.starsReward} ⭐
                    </span>
                  )}
                </div>
                {req.note && (
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
                    „{req.note}“
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => onResolveRequest(req.id, 'APPROVED')}
                  style={{
                    height: '36px',
                    padding: '0 0.85rem',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(180deg, #34D399, #10B981)',
                    color: '#022C22',
                    fontSize: '12px',
                    fontWeight: 900,
                    fontFamily: 'inherit',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    cursor: 'pointer',
                    boxShadow: '0 3px 0 #047857',
                  }}
                >
                  <Check size={14} /> Einlösen
                </button>
                <button
                  type="button"
                  onClick={() => onResolveRequest(req.id, 'REJECTED')}
                  style={{
                    height: '36px',
                    padding: '0 0.75rem',
                    borderRadius: '12px',
                    border: 'none',
                    background: '#FDE8EF',
                    color: PINK_TEXT,
                    fontSize: '12px',
                    fontWeight: 800,
                    fontFamily: 'inherit',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    cursor: 'pointer',
                  }}
                >
                  <X size={14} /> Ablehnen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sparkling 3D Diamond Vault Header */}
      <div
        style={{
          borderRadius: '24px',
          padding: '1.25rem',
          background: 'linear-gradient(140deg, #0F172A 0%, #1E3A8A 52%, #0284C7 100%)',
          border: '2px solid rgba(56, 189, 248, 0.45)',
          color: '#FFFFFF',
          boxShadow: '0 14px 32px rgba(2, 132, 199, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <img
            src="/vocab-game/diamond.png"
            alt="Diamanten"
            style={{ width: '64px', height: '64px', objectFit: 'contain', filter: 'drop-shadow(0 0 18px rgba(56,189,248,0.85))' }}
          />
          <div>
            <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7DD3FC' }}>
              Deine Schatzkammer
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1.05, marginTop: '0.1rem', fontVariantNumeric: 'tabular-nums' }}>
              {profile.diamonds}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, opacity: 0.9, marginTop: '0.2rem' }}>
              {reserved > 0
                ? `${available} frei · ${reserved} in Anfrage`
                : `Gesamt: ${profile.lifetimeDiamonds} · ${profile.chestsOpened} Truhen`}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '0.7rem 0.95rem',
            borderRadius: '16px',
            background: 'rgba(255,255,255,0.14)',
            border: '1px solid rgba(255,255,255,0.22)',
            textAlign: 'right',
          }}
        >
          <div style={{ fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', color: '#BAE6FD' }}>
            Eltern-Umtauschkurs
          </div>
          <div style={{ fontSize: 'var(--font-base)', fontWeight: 900, marginTop: '0.15rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            {settings.exchangeDiamonds}
            <img src="/vocab-game/diamond.png" alt="" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
            = {settings.exchangeLabel}
          </div>
        </div>
      </div>

      {/* Standard Exchange Card */}
      <div style={{ ...CARD, padding: '1.05rem 1.1rem', borderRadius: '22px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ fontSize: 'var(--font-base)', fontWeight: 900, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Sparkles size={17} color={PRIMARY} /> Diamanten bei Mama & Papa umtauschen
        </div>

        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
          {[1, 2, 3].map(mult => {
            const cost = settings.exchangeDiamonds * mult;
            const active = multiplier === mult;
            return (
              <button
                key={mult}
                type="button"
                onClick={() => setMultiplier(mult)}
                style={{
                  flex: 1,
                  minWidth: '90px',
                  height: '44px',
                  borderRadius: '14px',
                  border: active ? `2px solid ${PRIMARY}` : '1.5px solid var(--color-border)',
                  background: active ? '#ECE8FF' : 'var(--color-surface-hover)',
                  color: active ? PRIMARY : 'var(--color-text)',
                  fontSize: '13px',
                  fontWeight: 900,
                  fontFamily: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.3rem',
                  cursor: 'pointer',
                }}
              >
                <span>{cost}</span>
                <img src="/vocab-game/diamond.png" alt="" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
                <span style={{ opacity: 0.7 }}>({mult}×)</span>
              </button>
            );
          })}
        </div>

        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Optionaler Wunsch / Nachricht an Mama & Papa…"
          maxLength={120}
          className="input-field"
          style={{ height: '42px', borderRadius: '12px', fontSize: 'var(--font-sm)' }}
        />

        <button
          type="button"
          disabled={!canAffordPack}
          onClick={() =>
            submitRequest(
              packDiamonds,
              multiplier === 1 ? settings.exchangeLabel : `${multiplier}× ${settings.exchangeLabel}`
            )
          }
          style={{
            height: '48px',
            borderRadius: '16px',
            border: 'none',
            background: canAffordPack
              ? 'linear-gradient(180deg, #6D5DF0, #4338CA)'
              : 'var(--color-surface-hover)',
            color: canAffordPack ? '#FFFFFF' : 'var(--color-text-muted)',
            fontSize: 'var(--font-sm)',
            fontWeight: 900,
            fontFamily: 'inherit',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.45rem',
            cursor: canAffordPack ? 'pointer' : 'default',
            boxShadow: canAffordPack ? '0 5px 0 #312E81, 0 10px 20px rgba(67, 56, 202, 0.28)' : 'none',
          }}
        >
          <Send size={15} />
          {canAffordPack
            ? `${packDiamonds} Diamanten umtauschen anfragen`
            : `Noch ${packDiamonds - available} Diamanten sammeln`}
        </button>

        {feedback && (
          <div
            style={{
              padding: '0.65rem 0.85rem',
              borderRadius: '12px',
              background: feedback.kind === 'ok' ? '#ECFDF5' : '#FDE8EF',
              color: feedback.kind === 'ok' ? GREEN_TEXT : PINK_TEXT,
              fontSize: 'var(--font-xs)',
              fontWeight: 800,
            }}
          >
            {feedback.text}
          </div>
        )}
      </div>

      {/* Wish Shop */}
      {settings.shopItems.length > 0 && (
        <div style={{ ...CARD, padding: '1.05rem 1.1rem', borderRadius: '22px', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          <div style={{ fontSize: 'var(--font-base)', fontWeight: 900, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Gift size={17} color="#EC4899" /> Wunsch-Tausch-Shop
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
            {settings.shopItems.map(item => {
              const affordable = available >= item.diamonds;
              const pct = Math.min(100, Math.round((available / Math.max(1, item.diamonds)) * 100));
              return (
                <div
                  key={item.id}
                  style={{
                    padding: '0.9rem',
                    borderRadius: '18px',
                    border: affordable ? '2px solid rgba(16, 185, 129, 0.5)' : '1.5px solid var(--color-border)',
                    background: affordable ? 'rgba(236, 253, 245, 0.65)' : 'var(--color-surface-hover)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.55rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '28px' }}>{item.emoji}</span>
                    <span
                      style={{
                        padding: '0.2rem 0.55rem',
                        borderRadius: '999px',
                        background: '#E0F2FE',
                        color: '#0369A1',
                        fontSize: '12.5px',
                        fontWeight: 900,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.22rem',
                      }}
                    >
                      {item.diamonds}
                      <img src="/vocab-game/diamond.png" alt="" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--font-sm)', fontWeight: 800, color: 'var(--color-text)' }}>
                    {item.title}
                  </div>
                  {(item.starsReward || 0) > 0 && (
                    <div
                      style={{
                        alignSelf: 'flex-start',
                        padding: '0.16rem 0.55rem',
                        borderRadius: '999px',
                        background: '#FEF3C7',
                        color: '#B45309',
                        fontSize: '11.5px',
                        fontWeight: 900,
                      }}
                    >
                      +{item.starsReward} ⭐ aufs Sternekonto
                    </div>
                  )}
                  <div style={{ height: '7px', borderRadius: '999px', background: 'rgba(15,23,42,0.08)', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        borderRadius: '999px',
                        background: affordable ? '#10B981' : '#6366F1',
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!affordable}
                    onClick={() => submitRequest(item.diamonds, item.title, item.starsReward)}
                    style={{
                      marginTop: 'auto',
                      height: '36px',
                      borderRadius: '12px',
                      border: 'none',
                      background: affordable ? 'linear-gradient(180deg, #34D399, #10B981)' : 'var(--color-surface)',
                      color: affordable ? '#022C22' : 'var(--color-text-muted)',
                      fontSize: '12px',
                      fontWeight: 900,
                      fontFamily: 'inherit',
                      cursor: affordable ? 'pointer' : 'default',
                      boxShadow: affordable ? '0 3px 0 #047857' : 'none',
                    }}
                  >
                    {affordable ? 'JETZT ANFRAGEN!' : `Noch ${item.diamonds - available} Diamanten`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* History */}
      {(childRequests.length > 0 || profile.history.length > 0) && (
        <div style={{ ...CARD, padding: '1rem 1.1rem', borderRadius: '22px', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ fontSize: 'var(--font-sm)', fontWeight: 900, color: 'var(--color-text)' }}>
            Verlauf & Anfragen
          </div>

          {childRequests.map(req => (
            <div
              key={req.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                padding: '0.55rem 0.7rem',
                borderRadius: '12px',
                background: 'var(--color-surface-hover)',
                fontSize: '12.5px',
                fontWeight: 700,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <span>
                  {req.diamonds} 💎 → {req.rewardLabel}
                </span>
                {req.note && <span style={{ color: 'var(--color-text-muted)' }}> ({req.note})</span>}
              </div>
              <span
                style={{
                  padding: '0.18rem 0.55rem',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  background:
                    req.status === 'APPROVED'
                      ? '#D1FAE5'
                      : req.status === 'REJECTED'
                        ? '#FDE8EF'
                        : '#FEF3C7',
                  color:
                    req.status === 'APPROVED'
                      ? '#065F46'
                      : req.status === 'REJECTED'
                        ? PINK_TEXT
                        : '#B45309',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                {req.status === 'PENDING' && <Clock size={11} />}
                {req.status === 'APPROVED' ? 'Eingelöst' : req.status === 'REJECTED' ? 'Abgelehnt' : 'Wartet…'}
              </span>
            </div>
          ))}

          {profile.history.slice(0, 8).map(entry => (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                padding: '0.45rem 0.65rem',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--color-text-muted)',
              }}
            >
              <span>{entry.reason}</span>
              <span style={{ fontWeight: 900, color: entry.delta >= 0 ? GREEN_TEXT : PINK_TEXT, whiteSpace: 'nowrap' }}>
                {entry.delta >= 0 ? `+${entry.delta}` : entry.delta} 💎
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 3. Abzeichen & Entdecker-Ränge (Trophäen-Vitrine)
 * ============================================================================ */

interface VocabBadgesViewProps {
  profile: VocabChildGamification;
}

export const VocabBadgesView: React.FC<VocabBadgesViewProps> = ({ profile }) => {
  const levelInfo = getLevelProgress(profile.totalCorrect);
  const unlockedSet = new Set(profile.badges);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '26px',
          padding: '1.15rem 1.2rem',
          background: 'linear-gradient(155deg, #17153B 0%, #2A2063 55%, #4C1D95 100%)',
          border: '2px solid rgba(250, 204, 21, 0.45)',
          color: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          boxShadow: '0 14px 32px rgba(23, 21, 59, 0.36)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
          <img
            src="/vocab-game/trophy-badge.png"
            alt="Trophäe"
            style={{ width: '74px', height: '74px', objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 8px 16px rgba(250,204,21,0.45))' }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.08em', color: '#FEF08A', textTransform: 'uppercase' }}>
              Trophäen-Halle · Level {levelInfo.level} / {levelInfo.maxLevel}
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, marginTop: '0.1rem' }}>
              {levelInfo.title}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#C7D2FE', marginTop: '0.2rem' }}>
              {profile.totalCorrect.toLocaleString('de-DE')} richtige Vokabeln · {levelInfo.totalXp.toLocaleString('de-DE')} XP · {profile.badges.length} / {VOCAB_BADGES.length} Abzeichen
            </div>
          </div>
        </div>

        {/* Dedicated Current-Level XP Meter */}
        <div
          style={{
            padding: '0.75rem 0.9rem',
            borderRadius: '16px',
            background: 'rgba(15, 23, 42, 0.5)',
            border: '1px solid rgba(255,255,255,0.14)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 900 }}>
            <span style={{ color: '#FEF08A' }}>
              Level {levelInfo.level} Erfahrung
            </span>
            <span style={{ color: '#BAE6FD', fontVariantNumeric: 'tabular-nums' }}>
              {levelInfo.isMaxLevel
                ? 'MAX LEVEL 60'
                : `${levelInfo.currentLevelXp.toLocaleString('de-DE')} / ${levelInfo.xpForNextLevel.toLocaleString('de-DE')} XP (${levelInfo.progressPct}%)`}
            </span>
          </div>
          <div style={{ height: '12px', borderRadius: '999px', background: 'rgba(255,255,255,0.12)', overflow: 'hidden', padding: '1px' }}>
            <div
              style={{
                width: `${levelInfo.progressPct}%`,
                height: '100%',
                borderRadius: '999px',
                background: 'linear-gradient(90deg, #38BDF8 0%, #A855F7 50%, #FACC15 100%)',
                boxShadow: '0 0 10px rgba(250, 204, 21, 0.55)',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: 700, color: '#CBD5E1', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span>
              {levelInfo.isMaxLevel
                ? 'Du hast alle 60 Level gemeistert!'
                : `Noch ${levelInfo.wordsRemainingForNextLevel} richtige Vokabeln bis Level ${levelInfo.level + 1}`}
            </span>
            <span style={{ color: '#7DD3FC', fontWeight: 900 }}>
              Jeder Level-Aufstieg gibt +{LEVEL_UP_DIAMONDS} 💎!
            </span>
          </div>
        </div>
      </div>

      {/* Explorer Ranks Ladder (6 Rank Classes spanning Level 1–60) */}
      <div
        style={{
          borderRadius: '26px',
          padding: '1.1rem 1.15rem',
          background: 'linear-gradient(155deg, #17153B 0%, #2A2063 55%, #3C2474 100%)',
          border: '2px solid rgba(167, 139, 250, 0.35)',
          boxShadow: '0 14px 30px rgba(23, 21, 59, 0.3)',
          color: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.8rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 'var(--font-base)', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Trophy size={17} color="#FACC15" /> Rang-Klassen (Level 1–60)
          </div>
          <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#BAE6FD', fontVariantNumeric: 'tabular-nums' }}>
            Aktuell: Level {levelInfo.level} / {levelInfo.maxLevel}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', gap: '0.55rem' }}>
          {VOCAB_RANKS.map(item => {
            const reached = levelInfo.level >= item.minLevel;
            const current = levelInfo.level >= item.minLevel && levelInfo.level <= item.maxLevel;
            return (
              <div
                key={item.level}
                style={{
                  padding: '0.8rem 0.65rem',
                  borderRadius: '18px',
                  border: current
                    ? `2px solid ${item.color}`
                    : reached
                      ? `1.5px solid ${item.color}88`
                      : '1px solid rgba(255,255,255,0.12)',
                  background: current
                    ? `linear-gradient(160deg, ${item.color}38, rgba(15, 23, 42, 0.72))`
                    : reached
                      ? 'rgba(15, 23, 42, 0.52)'
                      : 'rgba(15, 23, 42, 0.34)',
                  opacity: reached ? 1 : 0.56,
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.25rem',
                  boxShadow: current ? `0 0 18px ${item.color}44` : 'none',
                }}
              >
                <span style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.06em', color: reached ? '#FEF08A' : '#94A3B8' }}>
                  LVL {item.minLevel}–{item.maxLevel}
                </span>
                <span style={{ fontSize: '28px', filter: reached ? 'none' : 'grayscale(0.9)' }}>{item.emoji}</span>
                <div style={{ fontSize: '12px', fontWeight: 900, color: '#FFFFFF' }}>{item.title}</div>
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#CBD5E1' }}>
                  ab {item.minAnswers.toLocaleString('de-DE')} richtig
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Collectible Badges Grid (Dark Starry Gaming Style with Progress Bars) */}
      <div
        style={{
          borderRadius: '26px',
          padding: '1.1rem 1.15rem',
          background: 'linear-gradient(155deg, #17153B 0%, #2A2063 55%, #3C2474 100%)',
          border: '2px solid rgba(167, 139, 250, 0.35)',
          boxShadow: '0 14px 30px rgba(23, 21, 59, 0.3)',
          color: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.8rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 'var(--font-base)', fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
            <img src="/vocab-game/trophy-badge.png" alt="" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
            Sammel-Abzeichen
          </div>
          <span
            style={{
              padding: '0.22rem 0.65rem',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.18)',
              fontSize: '11.5px',
              fontWeight: 900,
              color: '#FEF08A',
            }}
          >
            {profile.badges.length} / {VOCAB_BADGES.length}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem' }}>
          {VOCAB_BADGES.map(badge => {
            const earned = unlockedSet.has(badge.id);
            const prog = getBadgeProgress(badge.id, profile);
            const pct = prog ? Math.min(100, Math.round((prog.current / Math.max(1, prog.target)) * 100)) : earned ? 100 : 0;
            return (
              <div
                key={badge.id}
                style={{
                  padding: '0.85rem 0.75rem',
                  borderRadius: '18px',
                  border: earned ? `2px solid ${badge.color}` : '1.5px dashed rgba(255,255,255,0.2)',
                  background: earned
                    ? `linear-gradient(160deg, ${badge.color}30, rgba(15, 23, 42, 0.62))`
                    : 'rgba(15, 23, 42, 0.44)',
                  opacity: earned ? 1 : 0.74,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '0.32rem',
                  boxShadow: earned ? `0 0 16px ${badge.color}33` : 'none',
                }}
              >
                <span style={{ fontSize: '30px', filter: earned ? 'none' : 'grayscale(1) opacity(0.75)' }}>{badge.emoji}</span>
                <div style={{ fontSize: '12.5px', fontWeight: 900, color: '#FFFFFF' }}>{badge.title}</div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#CBD5E1', lineHeight: 1.35 }}>
                  {badge.description}
                </div>
                {prog && (
                  <div style={{ width: '100%', marginTop: 'auto', paddingTop: '0.3rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ height: '6px', borderRadius: '999px', background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          borderRadius: '999px',
                          background: earned ? '#34D399' : badge.color,
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: earned ? '#6EE7B7' : '#94A3B8', fontVariantNumeric: 'tabular-nums' }}>
                      {prog.current.toLocaleString('de-DE')} / {prog.target.toLocaleString('de-DE')}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: '0.2rem',
            padding: '0.75rem 0.9rem',
            borderRadius: '16px',
            background: 'rgba(15, 23, 42, 0.5)',
            border: '1px solid rgba(255,255,255,0.12)',
            display: 'flex',
            justifyContent: 'space-around',
            gap: '0.5rem',
            flexWrap: 'wrap',
            fontSize: '12px',
            fontWeight: 900,
            color: '#E0E7FF',
          }}
        >
          <span>⚡ Beste Combo: {profile.bestCombo}×</span>
          <span>🔥 Längste Serie: {profile.bestDailyStreak} Tage</span>
          <span>🧰 Truhen: {profile.chestsOpened}</span>
        </div>
      </div>
    </div>
  );
};
