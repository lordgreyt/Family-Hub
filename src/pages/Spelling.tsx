import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  CircleCheck,
  Crown,
  Gift,
  Lightbulb,
  Plus,
  RotateCcw,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Turtle,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';
import {
  normalizeChildProfile,
  type VocabGamificationState,
  type VocabPendingChest,
} from './vocabGamification';
import {
  SPELLING_KINGDOMS,
  type SpellingKingdomId,
  type SpellingTask,
  type SpellingTaskKind,
} from './spellingData';
import {
  SPELLING_MODE_HINT,
  SPELLING_MODE_LABEL,
  buildSpellingChoices,
  buildSpellingSession,
  checkGermanSpellingInput,
  computeKingdomStats,
  getAllSpellingTasks,
  pickRandomSpellingKind,
  type CustomSpellingWord,
  type SpellingQueueItem,
  type SpellingStoreState,
} from './spellingEngine';
import { buildTypingHint } from './vocabularyLearn';
import { playComboPing } from './vocabSounds';
import {
  OPENAI_VOICES,
  SPEECH_RATE_NORMAL,
  SPEECH_RATE_SLOW,
  canSpeak,
  getLastTtsError,
  getTtsVoice,
  loadTtsStatus,
  setTtsVoice,
  speakText,
  stopSpeaking,
  unlockAudio,
} from './speech';
import type { OpenAiVoice, TtsStatus } from './speech';
import { HubIcon } from '../components/HubIcon';
import { VocabTreasureChest } from '../components/Vocabulary/VocabTreasureChest';
import {
  VocabBadgesView,
  VocabTreasureHud,
  VocabTreasuryView,
} from '../components/Vocabulary/VocabGamificationPanel';
import { CARD, GREEN_TEXT, HERO_GRADIENT, PINK_TEXT, PRIMARY } from '../components/SurgeryFinance/theme';

type SpellingTab = 'throne' | 'treasury' | 'badges';

interface ActiveSpellingSession {
  kingdom: SpellingKingdomId | 'all' | 'custom';
  title: string;
  onlyHard: boolean;
}

const AUTO_SPEAK_KEY = 'family_hub_spelling_auto_speak';

function readAutoSpeak(): boolean {
  try {
    const raw = localStorage.getItem(AUTO_SPEAK_KEY);
    return raw === null ? true : raw === '1';
  } catch {
    return true;
  }
}

function choiceButtonStyle(state: 'idle' | 'correct' | 'wrong'): React.CSSProperties {
  const base: React.CSSProperties = {
    minHeight: 58,
    width: '100%',
    borderRadius: '16px',
    border: '2px solid rgba(167, 139, 250, 0.36)',
    background: 'rgba(15, 23, 42, 0.64)',
    color: '#FFFFFF',
    fontSize: 'clamp(1.02rem, 4vw, 1.24rem)',
    fontWeight: 900,
    padding: '0.8rem 1rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'center',
    boxShadow: '0 4px 0 rgba(15, 23, 42, 0.92)',
    transition: 'background 140ms ease, border-color 140ms ease, transform 120ms ease',
  };
  if (state === 'correct') {
    return {
      ...base,
      background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.52), rgba(5, 150, 105, 0.68))',
      borderColor: '#34D399',
      color: '#ECFDF5',
      boxShadow: '0 4px 0 #065F46, 0 0 18px rgba(52, 211, 153, 0.4)',
    };
  }
  if (state === 'wrong') {
    return {
      ...base,
      background: 'linear-gradient(180deg, rgba(225, 29, 72, 0.48), rgba(159, 18, 57, 0.64))',
      borderColor: '#FB7185',
      color: '#FFE4E6',
      boxShadow: '0 4px 0 #881337, 0 0 18px rgba(251, 113, 133, 0.4)',
    };
  }
  return base;
}

/* ============================================================================
 * Interaktive 5-Modi Rechtschreib-Karte (Dark Starry Gaming Style)
 * ============================================================================ */

interface SpellingCardProps {
  task: SpellingTask;
  kind: SpellingTaskKind;
  choices: string[];
  autoSpeak: boolean;
  onAnswer: (correct: boolean, kind: SpellingTaskKind) => void;
}

function SpellingCard({ task, kind, choices, autoSpeak, onAnswer }: SpellingCardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [customFeedback, setCustomFeedback] = useState<string | null>(null);
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2>(0);
  const [plays, setPlays] = useState(0);
  const [ttsErrorMsg, setTtsErrorMsg] = useState<string | null>(null);

  const answerRef = useRef(onAnswer);
  answerRef.current = onAnswer;

  const ttsAvailable = canSpeak();
  const isDictation = kind === 'dictation';

  const expectedOption =
    kind === 'gap' && task.gap
      ? task.gap.answer
      : kind === 'case_duel' && task.caseDuel
        ? task.caseDuel.correct
        : kind === 'root' && task.rootQuiz
          ? task.rootQuiz.answer
          : task.word;

  const handleTtsError = () => {
    setTtsErrorMsg(getLastTtsError() || 'Sprachausgabe aktuell nicht erreichbar – tippe nochmal auf „Vorlesen“.');
  };

  const speakWord = (slow = false, readSentence = false) => {
    if (!ttsAvailable) return;
    unlockAudio();
    setTtsErrorMsg(null);
    const toSpeak = readSentence && task.sentence ? task.sentence : task.word;
    if (
      speakText(toSpeak, 'Deutsch', handleTtsError, {
        rate: slow ? SPEECH_RATE_SLOW : SPEECH_RATE_NORMAL,
      })
    ) {
      setPlays(v => v + 1);
    }
  };

  // Im Studio-Diktat automatisch deutlich auf Hochdeutsch vorlesen
  useEffect(() => {
    if (!ttsAvailable || !isDictation) return;
    const timer = window.setTimeout(() => {
      if (speakText(task.word, 'Deutsch', handleTtsError, { rate: SPEECH_RATE_NORMAL })) {
        setPlays(v => v + 1);
      }
    }, 260);
    return () => window.clearTimeout(timer);
    // Remounted per card via key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => stopSpeaking(), []);

  useEffect(() => {
    if (result !== 'correct') return;
    if (autoSpeak && ttsAvailable && !isDictation && task.kingdom !== 'satz') {
      speakText(task.word, 'Deutsch', undefined, { rate: SPEECH_RATE_NORMAL });
    }
    const timer = window.setTimeout(() => answerRef.current(true, kind), 1550);
    return () => window.clearTimeout(timer);
  }, [result, kind, autoSpeak, ttsAvailable, isDictation, task.word, task.kingdom]);

  const choose = (option: string) => {
    if (result !== 'idle') return;
    setSelected(option);
    const ok = option === expectedOption;
    setResult(ok ? 'correct' : 'wrong');
  };

  const submitDictation = (e: FormEvent) => {
    e.preventDefault();
    if (result !== 'idle' || !typed.trim()) return;
    const checked = checkGermanSpellingInput(typed, task.word);
    setCustomFeedback(checked.feedback || null);
    setResult(checked.correct ? 'correct' : 'wrong');
  };

  const hintText = hintLevel > 0 ? buildTypingHint(task.word, hintLevel) : '';

  const filledGapPreview =
    kind === 'gap' && task.gap
      ? `${task.gap.before}${result !== 'idle' ? task.gap.answer : selected ?? '___'}${task.gap.after}`
      : '';

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '26px',
        padding: 'clamp(1.15rem, 3.8vw, 1.65rem)',
        background: 'linear-gradient(155deg, #17153B 0%, #2B2164 52%, #3D2673 100%)',
        border:
          result === 'correct'
            ? '2px solid #34D399'
            : result === 'wrong'
              ? '2px solid #FB7185'
              : '2px solid rgba(167, 139, 250, 0.38)',
        boxShadow:
          result === 'correct'
            ? '0 16px 36px rgba(16, 185, 129, 0.28)'
            : result === 'wrong'
              ? '0 16px 36px rgba(244, 63, 94, 0.25)'
              : '0 16px 38px rgba(23, 21, 59, 0.42)',
        color: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      {/* Mode Badge + Instruction */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.3rem 0.78rem',
            borderRadius: 999,
            background: 'rgba(250, 204, 21, 0.2)',
            border: '1px solid rgba(253, 224, 71, 0.5)',
            color: '#FEF08A',
            fontSize: '12px',
            fontWeight: 900,
            letterSpacing: '0.03em',
          }}
        >
          <Sparkles size={13} />
          {SPELLING_MODE_LABEL[kind]}
        </span>
        <span style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: '#C4B5FD' }}>
          {SPELLING_MODE_HINT[kind]}
        </span>
      </div>

      {/* Prompt Stage */}
      <div
        style={{
          padding: '1.1rem 0.95rem',
          borderRadius: '20px',
          background: 'rgba(15, 23, 42, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.13)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.7rem',
          textAlign: 'center',
        }}
      >
        {kind === 'gap' && task.gap && (
          <>
            {task.kingdom === 'satz' ? (
              <div style={{ fontSize: 'clamp(1.2rem, 4.6vw, 1.55rem)', fontWeight: 900, lineHeight: 1.35, color: '#FFFFFF' }}>
                {task.gap.before}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '38px',
                    padding: '0.05rem 0.45rem',
                    marginLeft: '0.3rem',
                    borderRadius: '10px',
                    background: result === 'correct' ? '#10B981' : 'rgba(250, 204, 21, 0.26)',
                    border: '2px solid #FACC15',
                    color: '#FEF08A',
                  }}
                >
                  {result !== 'idle' ? task.gap.answer : '?'}
                </span>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 'clamp(2rem, 7.5vw, 3rem)', fontWeight: 900, letterSpacing: '0.04em', lineHeight: 1.15 }}>
                  {task.gap.before}
                  <span
                    style={{
                      display: 'inline-block',
                      minWidth: '46px',
                      padding: '0 0.35rem',
                      margin: '0 0.12rem',
                      borderRadius: '12px',
                      background: result === 'correct' ? 'rgba(16, 185, 129, 0.45)' : 'rgba(250, 204, 21, 0.22)',
                      border: result === 'correct' ? '2px solid #34D399' : '2px dashed #FACC15',
                      color: '#FEF08A',
                    }}
                  >
                    {result !== 'idle' ? task.gap.answer : '…'}
                  </span>
                  {task.gap.after}
                </div>
                {task.sentence && result === 'idle' && (
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#BAE6FD', opacity: 0.9 }}>
                    Tipp: {task.sentence.replace(new RegExp(task.word, 'g'), filledGapPreview)}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {kind === 'detective' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', alignItems: 'center' }}>
            <div style={{ fontSize: 'clamp(1.25rem, 4.8vw, 1.55rem)', fontWeight: 900, color: '#FFFFFF' }}>
              Welche Schreibweise ist richtig?
            </div>
            {ttsAvailable && (
              <button
                type="button"
                onClick={() => speakWord(false)}
                style={{
                  height: '42px',
                  padding: '0 0.95rem 0 0.5rem',
                  borderRadius: '14px',
                  border: '1.5px solid rgba(56, 189, 248, 0.6)',
                  background: 'linear-gradient(180deg, rgba(56, 189, 248, 0.32), rgba(37, 99, 235, 0.48))',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 900,
                  fontFamily: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 0 rgba(30, 58, 138, 0.9)',
                }}
              >
                <img src="/vocab-game/sound-orb.png" alt="" style={{ width: '26px', height: '26px', objectFit: 'contain' }} />
                Wort anhören
              </button>
            )}
          </div>
        )}

        {kind === 'case_duel' && task.caseDuel && (
          <div style={{ fontSize: 'clamp(1.2rem, 4.8vw, 1.6rem)', fontWeight: 800, lineHeight: 1.45, color: '#FFFFFF' }}>
            {task.caseDuel.sentenceBefore ? `${task.caseDuel.sentenceBefore} ` : ''}
            <span
              style={{
                display: 'inline-block',
                padding: '0.08rem 0.55rem',
                borderRadius: '12px',
                background: result === 'correct' ? 'rgba(16, 185, 129, 0.45)' : 'rgba(250, 204, 21, 0.24)',
                border: result === 'correct' ? '2px solid #34D399' : '2px dashed #FACC15',
                color: '#FEF08A',
                fontWeight: 900,
              }}
            >
              {result !== 'idle' ? task.caseDuel.correct : '______'}
            </span>
            {task.caseDuel.sentenceAfter
              ? task.caseDuel.sentenceAfter.startsWith('.') || task.caseDuel.sentenceAfter.startsWith('!') || task.caseDuel.sentenceAfter.startsWith('?')
                ? task.caseDuel.sentenceAfter
                : ` ${task.caseDuel.sentenceAfter}`
              : ''}
          </div>
        )}

        {kind === 'root' && task.rootQuiz && (
          <div style={{ fontSize: 'clamp(1.2rem, 4.6vw, 1.55rem)', fontWeight: 900, lineHeight: 1.35, color: '#FFFFFF' }}>
            {task.rootQuiz.question}
          </div>
        )}

        {isDictation && (
          <>
            <div style={{ fontSize: 'var(--font-sm)', fontWeight: 800, color: '#BAE6FD' }}>
              Hör genau zu und schreibe das Wort — achte auf Groß- &amp; Kleinschreibung!
            </div>
            {ttsAvailable ? (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => speakWord(false, false)}
                  style={{
                    height: '46px',
                    padding: '0 1rem 0 0.5rem',
                    borderRadius: '14px',
                    border: '1.5px solid rgba(56, 189, 248, 0.65)',
                    background: 'linear-gradient(180deg, rgba(56, 189, 248, 0.34), rgba(37, 99, 235, 0.52))',
                    color: '#FFFFFF',
                    fontSize: '13.5px',
                    fontWeight: 900,
                    fontFamily: 'inherit',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 0 rgba(30, 58, 138, 0.9)',
                  }}
                >
                  <img src="/vocab-game/sound-orb.png" alt="" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                  {plays > 0 ? 'Nochmal hören' : 'Wort vorlesen'}
                </button>
                <button
                  type="button"
                  onClick={() => speakWord(true, false)}
                  style={{
                    height: '46px',
                    padding: '0 0.9rem',
                    borderRadius: '14px',
                    border: '1px solid rgba(255,255,255,0.22)',
                    background: 'rgba(255,255,255,0.1)',
                    color: '#E2E8F0',
                    fontSize: '12.5px',
                    fontWeight: 800,
                    fontFamily: 'inherit',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 0 rgba(15, 23, 42, 0.7)',
                  }}
                >
                  <Turtle size={15} /> Langsam
                </button>
                {task.sentence && (
                  <button
                    type="button"
                    onClick={() => speakWord(false, true)}
                    style={{
                      height: '46px',
                      padding: '0 0.9rem',
                      borderRadius: '14px',
                      border: '1px solid rgba(250, 204, 21, 0.45)',
                      background: 'rgba(250, 204, 21, 0.16)',
                      color: '#FEF08A',
                      fontSize: '12.5px',
                      fontWeight: 800,
                      fontFamily: 'inherit',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      cursor: 'pointer',
                    }}
                  >
                    <Volume2 size={15} /> Beispielsatz
                  </button>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 'var(--font-xs)', color: '#CBD5E1' }}>
                Sprachausgabe nicht verfügbar — Wort: <strong>{buildTypingHint(task.word, 1)}</strong>
              </div>
            )}
            {ttsErrorMsg && (
              <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: '#FDA4AF', maxWidth: '380px' }}>
                {ttsErrorMsg}
              </div>
            )}
          </>
        )}
      </div>

      {/* Interaction Area */}
      {!isDictation ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              kind === 'case_duel' || (kind === 'gap' && choices.length <= 3)
                ? `repeat(${Math.min(3, Math.max(2, choices.length))}, 1fr)`
                : 'repeat(auto-fit, minmax(145px, 1fr))',
            gap: '0.6rem',
          }}
        >
          {choices.map(opt => {
            const label = opt === '' ? '— (nichts)' : opt;
            const isRight = opt === expectedOption;
            const state = result === 'idle' ? 'idle' : isRight ? 'correct' : selected === opt ? 'wrong' : 'idle';
            return (
              <button
                key={label}
                type="button"
                disabled={result !== 'idle'}
                onClick={() => choose(opt)}
                style={choiceButtonStyle(state)}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : (
        <form onSubmit={submitDictation} style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          {hintText && result === 'idle' && (
            <div
              style={{
                padding: '0.6rem 0.9rem',
                borderRadius: '14px',
                background: 'rgba(250, 204, 21, 0.16)',
                border: '1.5px solid rgba(250, 204, 21, 0.5)',
                color: '#FEF08A',
                textAlign: 'center',
                fontSize: '1.05rem',
                fontWeight: 900,
                letterSpacing: '0.08em',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}
            >
              {hintText}
            </div>
          )}

          <input
            className="input-field"
            value={typed}
            onChange={e => setTyped(e.target.value)}
            placeholder="Wort genau eintippen…"
            aria-label="Rechtschreib-Antwort"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={result !== 'idle'}
            style={{
              fontSize: 'clamp(1.1rem, 4.2vw, 1.32rem)',
              textAlign: 'center',
              fontWeight: 800,
              height: '54px',
              borderRadius: '16px',
              background: 'rgba(15, 23, 42, 0.68)',
              border: '2px solid rgba(167, 139, 250, 0.45)',
              color: '#FFFFFF',
            }}
          />

          {result === 'idle' && (
            <div style={{ display: 'flex', gap: '0.55rem' }}>
              <button
                type="button"
                onClick={() => setHintLevel(lvl => (lvl < 2 ? ((lvl + 1) as 1 | 2) : 2))}
                disabled={hintLevel >= 2}
                style={{
                  height: '50px',
                  padding: '0 1rem',
                  borderRadius: '16px',
                  border: '1.5px solid rgba(250, 204, 21, 0.5)',
                  background: 'rgba(250, 204, 21, 0.16)',
                  color: '#FEF08A',
                  fontSize: '13px',
                  fontWeight: 900,
                  fontFamily: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  cursor: hintLevel >= 2 ? 'default' : 'pointer',
                  opacity: hintLevel >= 2 ? 0.45 : 1,
                  boxShadow: hintLevel >= 2 ? 'none' : '0 4px 0 rgba(161, 98, 7, 0.7)',
                }}
              >
                <Lightbulb size={15} /> {hintLevel === 0 ? 'Tipp' : hintLevel === 1 ? 'Mehr Tipp' : 'Tipp aktiv'}
              </button>
              <button
                type="submit"
                disabled={!typed.trim()}
                style={{
                  flex: 1,
                  height: '50px',
                  borderRadius: '16px',
                  border: typed.trim() ? '2px solid #6EE7B7' : '1px solid rgba(255,255,255,0.16)',
                  background: typed.trim()
                    ? 'linear-gradient(180deg, #34D399 0%, #10B981 100%)'
                    : 'rgba(255,255,255,0.1)',
                  color: typed.trim() ? '#022C22' : '#94A3B8',
                  fontSize: 'var(--font-base)',
                  fontWeight: 900,
                  fontFamily: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  cursor: typed.trim() ? 'pointer' : 'default',
                  boxShadow: typed.trim() ? '0 5px 0 #047857, 0 10px 20px rgba(16, 185, 129, 0.35)' : 'none',
                }}
              >
                <Check size={18} strokeWidth={3} /> PRÜFEN!
              </button>
            </div>
          )}
        </form>
      )}

      {/* Result Banner + 3rd-Grade Merkregel */}
      {result !== 'idle' && (
        <div
          role="status"
          style={{
            padding: '0.9rem 1rem',
            borderRadius: '18px',
            background: result === 'correct' ? 'rgba(16, 185, 129, 0.22)' : 'rgba(225, 29, 72, 0.24)',
            border: result === 'correct' ? '1.5px solid #34D399' : '1.5px solid #FB7185',
            color: result === 'correct' ? '#A7F3D0' : '#FECDD3',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', fontWeight: 900, fontSize: 'var(--font-sm)' }}>
            {result === 'correct' ? (
              <>
                <CircleCheck size={19} color="#34D399" /> Super richtig!
                {task.kingdom !== 'satz' && <strong style={{ color: '#FFFFFF' }}>{task.word}</strong>}
              </>
            ) : (
              <span>
                {customFeedback || (
                  <>
                    Richtig ist: <strong style={{ color: '#FFFFFF' }}>{kind === 'root' ? expectedOption : task.word}</strong>
                  </>
                )}
              </span>
            )}
          </div>

          {/* 1-Satz-Merkregel */}
          <div
            style={{
              padding: '0.55rem 0.75rem',
              borderRadius: '12px',
              background: 'rgba(15, 23, 42, 0.5)',
              color: '#FEF08A',
              fontSize: '12.5px',
              fontWeight: 700,
              lineHeight: 1.4,
            }}
          >
            💡 {task.rule}
          </div>
        </div>
      )}

      {result === 'wrong' && (
        <button
          type="button"
          onClick={() => answerRef.current(false, kind)}
          style={{
            height: '50px',
            borderRadius: '16px',
            border: '2px solid #818CF8',
            background: 'linear-gradient(180deg, #6366F1 0%, #4338CA 100%)',
            color: '#FFFFFF',
            fontWeight: 900,
            fontSize: 'var(--font-base)',
            fontFamily: 'inherit',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            cursor: 'pointer',
            boxShadow: '0 5px 0 #312E81',
          }}
        >
          WEITER <ArrowRight size={17} />
        </button>
      )}

      {result === 'idle' && isDictation && (
        <button
          type="button"
          onClick={() => setResult('wrong')}
          style={{
            background: 'transparent',
            border: 0,
            color: '#94A3B8',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            alignSelf: 'center',
          }}
        >
          Weiß ich nicht – Lösung &amp; Regel zeigen
        </button>
      )}
    </div>
  );
}

/* ============================================================================
 * Hauptseite: Rechtschreibung (3. Klasse · Jagd nach dem Wort-Thron)
 * ============================================================================ */

export const Spelling = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [spellingStore, setSpellingStore] = useState<SpellingStoreState>(() => mockDb.getSpellingStore());
  const [gamState, setGamState] = useState<VocabGamificationState>(() => mockDb.getVocabGamification());
  const [allUsers, setAllUsers] = useState(() => mockDb.getUsers());

  const [activeTab, setActiveTab] = useState<SpellingTab>('throne');
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState('');
  const [customFeedback, setCustomFeedback] = useState('');

  // Jedes Kind hat strikt seinen eigenen Bereich; Erwachsene starten auf ihrem eigenen Konto
  const childUsers = useMemo(() => allUsers.filter(u => u.isChild), [allUsers]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>(() => user?.id || '');

  useEffect(() => {
    if (user?.isChild) {
      setSelectedProfileId(user.id);
    } else if (user?.id && !selectedProfileId) {
      setSelectedProfileId(user.id);
    }
  }, [user, selectedProfileId]);

  const [activeChest, setActiveChest] = useState<VocabPendingChest | null>(null);
  const [bonusBanner, setBonusBanner] = useState('');

  // Active Adventure Session
  const [session, setSession] = useState<ActiveSpellingSession | null>(null);
  const [queue, setQueue] = useState<SpellingQueueItem[]>([]);
  const [requeued, setRequeued] = useState<Record<string, number>>({});
  const [sessionAnswered, setSessionAnswered] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [sessionSeq, setSessionSeq] = useState(0);
  const [sessionCombo, setSessionCombo] = useState(0);

  // Voice Settings
  const [autoSpeak, setAutoSpeak] = useState<boolean>(readAutoSpeak);
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);
  const [studioVoice, setStudioVoice] = useState<OpenAiVoice>(getTtsVoice);
  const [ttsStatus, setTtsStatus] = useState<TtsStatus | null>(null);
  const [voiceTestError, setVoiceTestError] = useState('');

  useEffect(() => {
    if (!voicePanelOpen || !user) return;
    setVoiceTestError('');
    loadTtsStatus().then(status => {
      setTtsStatus(status);
      setStudioVoice(status.voice);
    });
  }, [voicePanelOpen, user]);

  useEffect(() => {
    const refresh = () => {
      setSpellingStore(mockDb.getSpellingStore());
      setGamState(mockDb.getVocabGamification());
      setAllUsers(mockDb.getUsers());
    };
    refresh();
    window.addEventListener('db_updated', refresh);
    return () => window.removeEventListener('db_updated', refresh);
  }, []);

  const toggleAutoSpeak = () => {
    setAutoSpeak(prev => {
      const next = !prev;
      try {
        localStorage.setItem(AUTO_SPEAK_KEY, next ? '1' : '0');
      } catch { /* ignore */ }
      if (!next) stopSpeaking();
      return next;
    });
  };

  const actingUserId = user?.id || '';
  const viewedUserId = user?.isChild ? actingUserId : selectedProfileId || actingUserId;
  const viewedProfile = useMemo(
    () => normalizeChildProfile(viewedUserId, gamState.profilesByUser[viewedUserId]),
    [gamState.profilesByUser, viewedUserId]
  );
  const ownProfile = useMemo(
    () => normalizeChildProfile(actingUserId, gamState.profilesByUser[actingUserId]),
    [gamState.profilesByUser, actingUserId]
  );

  const pendingExchangeRequests = useMemo(
    () => gamState.exchangeRequests.filter(r => r.status === 'PENDING'),
    [gamState.exchangeRequests]
  );

  const allTasks = useMemo(() => getAllSpellingTasks(spellingStore.customWords), [spellingStore.customWords]);
  const viewedProgress = spellingStore.progressByUser[viewedUserId] || {};
  const ownProgress = spellingStore.progressByUser[actingUserId] || {};

  const throneStats = useMemo(
    () => computeKingdomStats(viewedProgress, allTasks),
    [viewedProgress, allTasks]
  );

  const startAdventure = (options: { kingdom?: SpellingKingdomId | 'all' | 'custom'; onlyHard?: boolean } = {}) => {
    const kingdom = options.kingdom ?? 'all';
    const onlyHard = options.onlyHard ?? false;
    const built = buildSpellingSession({
      allTasks,
      progressByTask: ownProgress,
      kingdom,
      onlyHard,
      canSpeak: canSpeak(),
      count: 15,
    });
    if (built.length === 0) return;

    const title = onlyHard
      ? 'Fehler-Kobold · Boss-Kampf'
      : kingdom === 'custom'
        ? 'Eltern-Diktatwörter'
        : kingdom === 'all'
          ? 'Jagd nach dem Wort-Thron'
          : SPELLING_KINGDOMS.find(k => k.id === kingdom)?.title || 'Königreich';

    stopSpeaking();
    setSession({ kingdom, title, onlyHard });
    setQueue(built);
    setRequeued({});
    setSessionAnswered(0);
    setSessionCorrect(0);
    setSessionTotal(built.length);
    setSessionCombo(0);
    setBonusBanner('');
    setSessionSeq(v => v + 1);
  };

  const finishSession = () => {
    stopSpeaking();
    setSession(null);
    setQueue([]);
    setBonusBanner('');
  };

  const handleAnswer = (correct: boolean, kind: SpellingTaskKind) => {
    if (!queue.length || !user) return;
    const current = queue[0];
    const outcome = mockDb.recordSpellingAnswer(user.id, current.task.id, correct, kind);

    if (correct) {
      setSessionCombo(outcome.profile.currentCombo);
      if (outcome.profile.currentCombo >= 3) {
        playComboPing(outcome.profile.currentCombo);
      }
    } else {
      setSessionCombo(0);
    }

    if (outcome.bonusEvents.length > 0) {
      setBonusBanner(outcome.bonusEvents.join(' · '));
      window.setTimeout(() => setBonusBanner(''), 4500);
    }

    if (outcome.newChest) {
      stopSpeaking();
      setActiveChest(outcome.newChest);
    }

    setSessionAnswered(v => v + 1);
    if (correct) setSessionCorrect(v => v + 1);

    let nextQueue = queue.slice(1);
    if (!correct && (requeued[current.task.id] || 0) < 1) {
      const prevKind = nextQueue[nextQueue.length - 1]?.kind ?? kind;
      const nextKind = pickRandomSpellingKind({
        task: current.task,
        canSpeak: canSpeak(),
        previousKind: prevKind,
      });
      nextQueue = [...nextQueue, { task: current.task, kind: nextKind }];
      setRequeued(prev => ({ ...prev, [current.task.id]: (prev[current.task.id] || 0) + 1 }));
    }
    setQueue(nextQueue);
    setSessionSeq(v => v + 1);
  };

  const handleAddCustomWords = (e: FormEvent) => {
    e.preventDefault();
    if (!user || user.isChild) return;
    const lines = customText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const existingSet = new Set(spellingStore.customWords.map(w => w.word.toLowerCase()));
    const added: CustomSpellingWord[] = [];
    for (const line of lines) {
      const [rawWord, rawSentence, rawHint] = line.split(/[|;]/).map(s => s.trim());
      if (!rawWord || existingSet.has(rawWord.toLowerCase())) continue;
      existingSet.add(rawWord.toLowerCase());
      added.push({
        id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        word: rawWord,
        sentence: rawSentence || undefined,
        hint: rawHint || undefined,
        createdAt: Date.now(),
      });
    }

    if (added.length > 0) {
      mockDb.saveSpellingCustomWords([...spellingStore.customWords, ...added]);
      setCustomText('');
      setCustomFeedback(`${added.length} neue Diktatwörter gespeichert!`);
      window.setTimeout(() => setCustomFeedback(''), 3500);
    }
  };

  const chestOverlay = (
    <VocabTreasureChest
      chest={activeChest}
      onClaim={chestId => {
        const targetId = session ? actingUserId : viewedUserId;
        const result = mockDb.claimVocabChest(targetId, chestId);
        return result.newBadges;
      }}
      onClose={() => setActiveChest(null)}
    />
  );

  /* ========================================================================
   * AKTIVER SPIELMODUS (Thron-Abenteuer · 100 % Zufalls-Mix)
   * ======================================================================== */
  if (session) {
    const completed = queue.length === 0;
    const currentItem = queue[0] || null;
    const sessionPct = sessionTotal ? Math.min(100, Math.round((sessionAnswered / sessionTotal) * 100)) : 0;
    const choices = currentItem
      ? buildSpellingChoices(currentItem.task, currentItem.kind, `${currentItem.task.id}:${sessionSeq}`)
      : [];

    return (
      <section style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', maxWidth: 680, margin: '0 auto', paddingBottom: '2.2rem' }}>
        {/* Top Gaming Control Strip */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={finishSession}
            style={{
              height: '40px',
              padding: '0 0.9rem',
              borderRadius: '14px',
              border: '1.5px solid rgba(167, 139, 250, 0.35)',
              background: '#1E1B4B',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: 'var(--font-sm)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <ChevronLeft size={17} /> Thron-Karte
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span
              style={{
                height: '38px',
                padding: '0 0.75rem 0 0.45rem',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #2E236C, #4C1D95)',
                border: '1.5px solid rgba(250, 204, 21, 0.55)',
                color: '#FEF08A',
                fontWeight: 900,
                fontSize: '12.5px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.32rem',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <img src="/vocab-game/chest-closed.png" alt="" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
              {ownProfile.blockCount}/{gamState.settings.chestSize}
            </span>

            {sessionCombo >= 2 && (
              <span
                style={{
                  height: '38px',
                  padding: '0 0.75rem 0 0.45rem',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #F59E0B, #EA580C)',
                  border: '1.5px solid #FEF08A',
                  color: '#FFFFFF',
                  fontWeight: 900,
                  fontSize: '12.5px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  boxShadow: '0 4px 14px rgba(245, 158, 11, 0.45)',
                }}
              >
                <img src="/vocab-game/lightning-bolt.png" alt="" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                {sessionCombo}×
              </span>
            )}

            {canSpeak() && (
              <button
                type="button"
                onClick={toggleAutoSpeak}
                style={{
                  height: '38px',
                  padding: '0 0.75rem',
                  borderRadius: '14px',
                  border: '1px solid rgba(167, 139, 250, 0.35)',
                  background: autoSpeak ? '#312E81' : 'rgba(30, 27, 75, 0.65)',
                  color: autoSpeak ? '#BAE6FD' : '#94A3B8',
                  fontWeight: 800,
                  fontSize: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {autoSpeak ? <Volume2 size={14} /> : <VolumeX size={14} />} Auto-Ton
              </button>
            )}
          </div>
        </div>

        {bonusBanner && (
          <div
            role="status"
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #F59E0B, #EC4899)',
              border: '2px solid #FEF08A',
              color: '#FFFFFF',
              fontSize: 'var(--font-sm)',
              fontWeight: 900,
              textAlign: 'center',
              boxShadow: '0 10px 24px rgba(236, 72, 153, 0.32)',
            }}
          >
            {bonusBanner}
          </div>
        )}

        {/* Session Header Card */}
        <div
          style={{
            borderRadius: '22px',
            padding: '0.95rem 1.05rem',
            background: 'linear-gradient(145deg, #17153B 0%, #2B2164 60%, #3C2474 100%)',
            border: '2px solid rgba(167, 139, 250, 0.35)',
            color: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
            boxShadow: '0 12px 26px rgba(23, 21, 59, 0.32)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
              <img
                src={session.onlyHard ? '/vocab-game/boss-dragon.png' : '/vocab-game/word-throne.png'}
                alt=""
                style={{ width: '40px', height: '40px', objectFit: 'contain', flexShrink: 0 }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '10.5px', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: session.onlyHard ? '#F9A8D4' : '#FEF08A' }}>
                  {session.onlyHard ? 'FEHLER-KOBOLD · BOSS-KAMPF' : 'RECHTSCHREIB-ABENTEUER · KLASSE 3'}
                </div>
                <h2 style={{ margin: '0.08rem 0 0', fontSize: 'var(--font-base)', fontWeight: 900 }}>
                  {session.title}
                </h2>
              </div>
            </div>
            <span
              style={{
                padding: '0.28rem 0.65rem',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.14)',
                fontSize: '12px',
                fontWeight: 900,
                color: '#FEF08A',
                whiteSpace: 'nowrap',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {completed ? `${sessionCorrect}/${sessionAnswered} richtig` : `${Math.min(sessionAnswered + 1, sessionTotal)} / ${sessionTotal}`}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', fontSize: '11px', fontWeight: 800, color: '#C4B5FD' }}>
            <span style={{ padding: '0.18rem 0.55rem', borderRadius: '999px', background: 'rgba(129, 140, 248, 0.24)', border: '1px solid rgba(165, 180, 252, 0.38)', color: '#E0E7FF' }}>
              🎲 Zufalls-Mix
            </span>
            <span>Lücken · Fehler-Detektiv · Groß/Klein · Verwandte · Diktat</span>
          </div>

          <div style={{ height: 10, borderRadius: 99, background: 'rgba(255,255,255,0.12)', overflow: 'hidden', padding: '1px' }}>
            <div
              style={{
                height: '100%',
                width: `${completed ? 100 : sessionPct}%`,
                borderRadius: 99,
                background: 'linear-gradient(90deg, #38BDF8 0%, #A855F7 55%, #FACC15 100%)',
                boxShadow: '0 0 10px rgba(250, 204, 21, 0.55)',
                transition: 'width 200ms ease',
              }}
            />
          </div>
        </div>

        {completed ? (
          <div
            style={{
              borderRadius: '26px',
              padding: '2rem 1.3rem',
              background: 'linear-gradient(155deg, #17153B 0%, #312E81 55%, #581C87 100%)',
              border: '2px solid rgba(250, 204, 21, 0.55)',
              color: '#FFFFFF',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.8rem',
              boxShadow: '0 18px 40px rgba(23, 21, 59, 0.42)',
            }}
          >
            <img
              src="/vocab-game/word-throne.png"
              alt="Wort-Thron"
              style={{ width: '112px', height: '112px', objectFit: 'contain', filter: 'drop-shadow(0 12px 24px rgba(250,204,21,0.45))' }}
            />
            <div style={{ fontSize: '26px', letterSpacing: '0.2rem' }}>
              {sessionAnswered > 0 && sessionCorrect / sessionAnswered >= 0.9
                ? '⭐⭐⭐'
                : sessionAnswered > 0 && sessionCorrect / sessionAnswered >= 0.65
                  ? '⭐⭐'
                  : '⭐'}
            </div>
            <h2 style={{ margin: 0, fontSize: '1.55rem', fontWeight: 900 }}>Runde gemeistert, {user?.id}!</h2>
            <p style={{ margin: 0, color: '#E0E7FF', fontWeight: 800, fontSize: 'var(--font-sm)' }}>
              {sessionCorrect} von {sessionAnswered} richtig · Truhe: {ownProfile.blockCount}/{gamState.settings.chestSize}
            </p>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '0.35rem', width: '100%' }}>
              <button
                type="button"
                onClick={() => startAdventure({ kingdom: session.kingdom, onlyHard: session.onlyHard })}
                style={{
                  flex: '1 1 180px',
                  height: '50px',
                  padding: '0 1.25rem',
                  borderRadius: '16px',
                  border: '2px solid #6EE7B7',
                  background: 'linear-gradient(180deg, #34D399, #10B981)',
                  color: '#022C22',
                  fontWeight: 900,
                  fontSize: 'var(--font-sm)',
                  fontFamily: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                  boxShadow: '0 5px 0 #047857',
                }}
              >
                <RotateCcw size={16} /> NÄCHSTE RUNDE!
              </button>
              <button
                type="button"
                onClick={finishSession}
                style={{
                  height: '50px',
                  padding: '0 1.15rem',
                  borderRadius: '16px',
                  border: '1px solid rgba(255,255,255,0.28)',
                  background: 'rgba(255,255,255,0.12)',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: 'var(--font-sm)',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                Zur Thron-Karte
              </button>
            </div>
          </div>
        ) : currentItem ? (
          <SpellingCard
            key={`${currentItem.task.id}:${sessionSeq}:${currentItem.kind}`}
            task={currentItem.task}
            kind={currentItem.kind}
            choices={choices}
            autoSpeak={autoSpeak}
            onAnswer={handleAnswer}
          />
        ) : null}

        {chestOverlay}
      </section>
    );
  }

  /* ========================================================================
   * HAUPTÜBERSICHT: JAGD NACH DEM WORT-THRON
   * ======================================================================== */
  const thronePct = Math.round((throneStats.crownsEarned / Math.max(1, throneStats.totalCrowns)) * 100);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem', maxWidth: 780, margin: '0 auto', paddingBottom: '2.5rem' }}>
      {/* Hero Header */}
      <div
        style={{
          background: HERO_GRADIENT,
          borderRadius: 'var(--radius-xl)',
          padding: '1.3rem 1.25rem',
          color: '#FFFFFF',
          boxShadow: '0 12px 28px rgba(63, 52, 196, 0.28)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem 1.25rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', flexShrink: 0 }}>
            <span
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '14px',
                background: 'rgba(255,255,255,0.92)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(23,20,58,0.16)',
              }}
            >
              <HubIcon name="spelling" size={34} />
            </span>
            <div style={{ fontSize: 'var(--font-lg)', fontWeight: 800, lineHeight: 1.15, whiteSpace: 'nowrap' }}>
              Rechtschreibung
            </div>
          </div>

          {canSpeak() && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0, marginLeft: 'auto' }}>
              <button
                type="button"
                onClick={() => setVoicePanelOpen(v => !v)}
                style={{
                  height: '34px',
                  padding: '0 0.65rem',
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.35)',
                  background: voicePanelOpen ? '#FFFFFF' : 'rgba(255,255,255,0.16)',
                  color: voicePanelOpen ? '#3F34C4' : '#FFFFFF',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  fontFamily: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  cursor: 'pointer',
                }}
              >
                <SlidersHorizontal size={13} /> Stimme
              </button>
              <button
                type="button"
                onClick={toggleAutoSpeak}
                style={{
                  height: '34px',
                  padding: '0 0.7rem',
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.35)',
                  background: autoSpeak ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.1)',
                  color: '#FFFFFF',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  fontFamily: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  cursor: 'pointer',
                }}
              >
                {autoSpeak ? <Volume2 size={14} /> : <VolumeX size={14} />}
                {autoSpeak ? 'Ton an' : 'Ton aus'}
              </button>
            </div>
          )}
        </div>

        {/* Adult-only Profile Switcher (Kinder sehen strikt nur ihr eigenes Konto) */}
        {!user?.isChild && childUsers.length > 0 && (
          <div style={{ marginTop: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, opacity: 0.82 }}>Ansicht:</span>
            {[...childUsers, ...(user ? [user] : [])].map(member => {
              const active = viewedUserId === member.id;
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => setSelectedProfileId(member.id)}
                  style={{
                    height: '28px',
                    padding: '0 0.7rem',
                    borderRadius: '999px',
                    border: active ? 'none' : '1px solid rgba(255,255,255,0.32)',
                    background: active ? '#FFFFFF' : 'rgba(255,255,255,0.14)',
                    color: active ? '#3F34C4' : '#FFFFFF',
                    fontSize: '11.5px',
                    fontWeight: 800,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  {member.id}
                </button>
              );
            })}
          </div>
        )}

        {/* Adult-only Custom Dictation Words Button */}
        {!user?.isChild && (
          <div style={{ marginTop: '0.9rem', display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setCustomOpen(v => !v)}
              style={{
                height: '42px',
                padding: '0 1rem',
                borderRadius: '999px',
                border: customOpen ? 'none' : '1px solid rgba(255,255,255,0.45)',
                background: customOpen ? '#FFFFFF' : 'rgba(255,255,255,0.18)',
                color: customOpen ? '#3F34C4' : '#FFFFFF',
                fontWeight: 800,
                fontSize: '13px',
                fontFamily: 'inherit',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer',
              }}
            >
              {customOpen ? <X size={15} /> : <Plus size={15} />}
              {customOpen ? 'Schließen' : `Eigene Diktatwörter (${spellingStore.customWords.length})`}
            </button>
          </div>
        )}
      </div>

      {/* Pending Diamond Exchange Requests Banner for Parents */}
      {!user?.isChild && pendingExchangeRequests.length > 0 && activeTab !== 'treasury' && (
        <button
          type="button"
          onClick={() => setActiveTab('treasury')}
          style={{
            padding: '0.85rem 1rem',
            borderRadius: '18px',
            border: '2px solid #F59E0B',
            background: '#FEF3C7',
            color: '#92400E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.6rem',
            cursor: 'pointer',
            fontFamily: 'inherit',
            textAlign: 'left',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-sm)', fontWeight: 900 }}>
            <Gift size={18} />
            {pendingExchangeRequests.length === 1
              ? `1 offene Diamanten-Anfrage von ${pendingExchangeRequests[0].userName} (${pendingExchangeRequests[0].diamonds} 💎)`
              : `${pendingExchangeRequests.length} offene Diamanten-Anfragen warten auf Bestätigung`}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 900, whiteSpace: 'nowrap' }}>Prüfen →</span>
        </button>
      )}

      {/* Voice Settings Panel */}
      {voicePanelOpen && canSpeak() && (
        <div style={{ ...CARD, padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 'var(--font-base)', fontWeight: 800 }}>Diktat-Vorlesestimme (Deutsch)</h2>
              <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Klare Hochdeutsch-Aussprache über OpenAI Studio-TTS
              </div>
            </div>
            <button
              type="button"
              onClick={() => setVoicePanelOpen(false)}
              aria-label="Schließen"
              style={{ width: '30px', height: '30px', borderRadius: '50%', border: 'none', background: 'var(--color-surface-muted)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <X size={15} />
            </button>
          </div>

          {ttsStatus && !ttsStatus.configured && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.7rem', padding: '0.7rem 0.85rem', borderRadius: '14px', background: '#F4F1FF', border: '1px solid #C7B6F7', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#17143A', flex: '1 1 180px' }}>
                {user?.isChild
                  ? 'Vorlese-Stimme noch nicht aktiv – Mama oder Papa können sie im Setup hinterlegen.'
                  : 'Noch kein OpenAI Sprach-Key hinterlegt.'}
              </span>
              {!user?.isChild && (
                <button
                  type="button"
                  onClick={() => { setVoicePanelOpen(false); navigate('/setup'); }}
                  style={{
                    height: '34px', padding: '0 0.85rem', borderRadius: '999px', border: 'none',
                    background: 'linear-gradient(135deg, #3F34C4, #6D5DF0)', color: '#FFFFFF',
                    fontSize: '12px', fontWeight: 800, fontFamily: 'inherit',
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer',
                  }}
                >
                  <Settings size={13} /> In Setup eintragen
                </button>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.45rem' }}>
            {OPENAI_VOICES.map(v => {
              const active = studioVoice === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setStudioVoice(v.id);
                    setTtsVoice(v.id);
                    setVoiceTestError('');
                  }}
                  style={{
                    padding: '0.55rem 0.4rem',
                    borderRadius: '14px',
                    border: active ? '1.5px solid #5A4BE0' : '1px solid var(--color-border)',
                    background: active ? 'rgba(90, 75, 224, 0.1)' : 'var(--color-surface-hover)',
                    color: active ? PRIMARY : 'var(--color-text)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 800 }}>{v.label}</span>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-muted)' }}>{v.hint}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              setVoiceTestError('');
              speakText('Auf der grünen Wiese fliegt eine fleißige Biene.', 'Deutsch', () => {
                setVoiceTestError(getLastTtsError() || 'Sprachausgabe fehlgeschlagen.');
              }, { voice: studioVoice });
            }}
            style={{
              alignSelf: 'flex-start',
              height: '38px',
              padding: '0 0.95rem',
              borderRadius: '999px',
              border: 'none',
              background: '#ECE8FF',
              color: PRIMARY,
              fontSize: '12.5px',
              fontWeight: 800,
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: 'pointer',
            }}
          >
            <Volume2 size={14} /> Diktat-Stimme testen
          </button>

          {voiceTestError && (
            <div style={{ padding: '0.6rem 0.8rem', borderRadius: '12px', background: '#FDE8EF', color: PINK_TEXT, fontSize: '12.5px', fontWeight: 700 }}>
              {voiceTestError}
            </div>
          )}
        </div>
      )}

      {/* Adult Custom Dictation Words Panel */}
      {customOpen && !user?.isChild && (
        <form onSubmit={handleAddCustomWords} style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--font-base)', fontWeight: 900 }}>
            Eigene Lernwörter fürs nächste Diktat
          </h2>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
            Ein Wort pro Zeile (optional mit Beispielsatz &amp; Merkregel getrennt durch <code>|</code>, z. B.{' '}
            <code>Fahrrad | Ich fahre mit dem Fahrrad. | Mit Dehnungs-h und zwei r</code>).
          </p>
          <textarea
            className="input-field"
            rows={4}
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            placeholder={'Schmetterling\nFahrrad | Mein Fahrrad ist rot.\nFrühling'}
            style={{ resize: 'vertical', lineHeight: 1.5 }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" style={{ borderRadius: '999px' }} disabled={!customText.trim()}>
              Wörter speichern
            </button>
          </div>
          {customFeedback && (
            <div style={{ padding: '0.55rem 0.8rem', borderRadius: '12px', background: '#E3F6EF', color: GREEN_TEXT, fontSize: '12.5px', fontWeight: 800 }}>
              {customFeedback}
            </div>
          )}

          {spellingStore.customWords.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.2rem' }}>
              {spellingStore.customWords.map(cw => (
                <span
                  key={cw.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.3rem 0.65rem',
                    borderRadius: '999px',
                    background: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    fontSize: '12px',
                    fontWeight: 800,
                  }}
                >
                  {cw.word}
                  <button
                    type="button"
                    onClick={() => mockDb.saveSpellingCustomWords(spellingStore.customWords.filter(w => w.id !== cw.id))}
                    aria-label={`${cw.word} löschen`}
                    style={{ border: 'none', background: 'transparent', color: PINK_TEXT, cursor: 'pointer', display: 'inline-flex', padding: 0 }}
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </form>
      )}

      {/* 3 Gamified 3D Arena Tabs (identisch zu Vokabeln, mit 3D-Wort-Thron!) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.5rem',
          padding: '0.45rem',
          borderRadius: '22px',
          background: 'linear-gradient(155deg, #17153B 0%, #261D59 100%)',
          border: '2px solid rgba(167, 139, 250, 0.35)',
          boxShadow: '0 12px 26px rgba(23, 21, 59, 0.28)',
        }}
      >
        {(
          [
            {
              id: 'throne',
              label: 'Thron-Jagd',
              imgSrc: '/vocab-game/word-throne.png',
              activeBg: 'linear-gradient(180deg, #6366F1 0%, #4338CA 100%)',
              activeBorder: '#A5B4FC',
              activeShadow: '0 4px 0 #312E81, 0 0 18px rgba(99, 102, 241, 0.5)',
              badge: null,
            },
            {
              id: 'treasury',
              label: 'Schatzkammer',
              imgSrc: '/vocab-game/chest-open.png',
              activeBg: 'linear-gradient(180deg, #0EA5E9 0%, #0369A1 100%)',
              activeBorder: '#7DD3FC',
              activeShadow: '0 4px 0 #0C4A6E, 0 0 18px rgba(56, 189, 248, 0.5)',
              badge: !user?.isChild && pendingExchangeRequests.length > 0 ? pendingExchangeRequests.length : null,
            },
            {
              id: 'badges',
              label: 'Abzeichen',
              imgSrc: '/vocab-game/trophy-badge.png',
              activeBg: 'linear-gradient(180deg, #F59E0B 0%, #B45309 100%)',
              activeBorder: '#FDE047',
              activeShadow: '0 4px 0 #78350F, 0 0 18px rgba(250, 204, 21, 0.45)',
              badge: null,
            },
          ] as const
        ).map(tab => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                position: 'relative',
                minHeight: '72px',
                padding: '0.45rem 0.35rem 0.5rem',
                borderRadius: '16px',
                border: active ? `2px solid ${tab.activeBorder}` : '1.5px solid rgba(255,255,255,0.1)',
                background: active ? tab.activeBg : 'rgba(15, 23, 42, 0.48)',
                color: active ? '#FFFFFF' : '#CBD5E1',
                fontSize: '12px',
                fontWeight: 900,
                fontFamily: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.28rem',
                cursor: 'pointer',
                boxShadow: active ? tab.activeShadow : '0 3px 0 rgba(15, 23, 42, 0.85)',
                transform: active ? 'translateY(-1px)' : 'none',
                transition: 'transform 140ms ease, box-shadow 140ms ease, background 140ms ease',
              }}
            >
              <img
                src={tab.imgSrc}
                alt=""
                style={{
                  width: '34px',
                  height: '34px',
                  objectFit: 'contain',
                  filter: active
                    ? 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.45))'
                    : 'drop-shadow(0 3px 6px rgba(0, 0, 0, 0.35)) opacity(0.85)',
                }}
              />
              <span style={{ lineHeight: 1.1 }}>{tab.label}</span>
              {tab.badge !== null && (
                <span
                  style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    minWidth: '20px',
                    height: '20px',
                    padding: '0 5px',
                    borderRadius: '999px',
                    background: 'linear-gradient(180deg, #FDE047, #F59E0B)',
                    color: '#451A03',
                    fontSize: '11px',
                    fontWeight: 900,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ================= TAB 1: THRON-JAGD ================= */}
      {activeTab === 'throne' && (
        <>
          <VocabTreasureHud
            profile={viewedProfile}
            settings={gamState.settings}
            childLabel={viewedUserId || 'Lernprofil'}
            hardWordCount={throneStats.totalHard}
            onOpenChest={chest => setActiveChest(chest)}
            onOpenTreasury={() => setActiveTab('treasury')}
            onStartQuestAction={action => startAdventure({ kingdom: 'all', onlyHard: action === 'hard' })}
          />

          {/* GOLDENER WORT-THRON STAGE + 8 KÖNIGREICHE */}
          <article
            style={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: '26px',
              padding: '1.15rem 1.2rem',
              background: 'linear-gradient(155deg, #17153B 0%, #2A2063 55%, #4C1D95 100%)',
              border: throneStats.throneUnlocked
                ? '2px solid #FACC15'
                : '2px solid rgba(250, 204, 21, 0.42)',
              boxShadow: '0 16px 34px rgba(23, 21, 59, 0.38)',
              color: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.95rem',
            }}
          >
            {/* Throne Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '88px', height: '88px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div
                  style={{
                    position: 'absolute',
                    inset: '-8px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(250, 204, 21, 0.34) 0%, transparent 70%)',
                    pointerEvents: 'none',
                  }}
                />
                <img
                  src="/vocab-game/word-throne.png"
                  alt="Goldener Wort-Thron"
                  style={{
                    position: 'relative',
                    zIndex: 2,
                    width: '84px',
                    height: '84px',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 8px 16px rgba(250, 204, 21, 0.45))',
                  }}
                />
              </div>

              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ fontSize: '10.5px', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#FEF08A', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Crown size={13} /> JAGD NACH DEM WORT-THRON · 3. KLASSE
                </div>
                <h2 style={{ margin: '0.15rem 0 0', fontSize: '1.22rem', fontWeight: 900, lineHeight: 1.15 }}>
                  {throneStats.throneUnlocked
                    ? `👑 Königlicher Thron erobert, ${viewedUserId}!`
                    : `${throneStats.crownsEarned} von ${throneStats.totalCrowns} Kronen erobert`}
                </h2>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#CBD5E1', marginTop: '0.2rem' }}>
                  Meistere alle 8 Königreiche und besteige den Goldenen Wort-Thron!
                </div>
              </div>
            </div>

            {/* Throne Progress Bar */}
            <div
              style={{
                padding: '0.7rem 0.85rem',
                borderRadius: '16px',
                background: 'rgba(15, 23, 42, 0.48)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 800, color: '#E2E8F0', marginBottom: '0.35rem' }}>
                <span>👑 Thron-Fortschritt ({throneStats.totalMastered} Wörter gemeistert)</span>
                <span style={{ color: '#FEF08A', fontVariantNumeric: 'tabular-nums' }}>{thronePct}%</span>
              </div>
              <div style={{ height: '11px', borderRadius: '999px', background: 'rgba(255,255,255,0.12)', overflow: 'hidden', padding: '1px' }}>
                <div
                  style={{
                    width: `${thronePct}%`,
                    height: '100%',
                    borderRadius: '999px',
                    background: 'linear-gradient(90deg, #FACC15 0%, #F97316 55%, #EC4899 100%)',
                    boxShadow: '0 0 12px rgba(250, 204, 21, 0.65)',
                    transition: 'width 0.35s ease',
                  }}
                />
              </div>
            </div>

            {/* Primary Adventure CTAs */}
            <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => startAdventure({ kingdom: 'all', onlyHard: false })}
                style={{
                  flex: '1 1 200px',
                  height: '54px',
                  borderRadius: '16px',
                  border: '2px solid #6EE7B7',
                  background: 'linear-gradient(180deg, #34D399 0%, #059669 100%)',
                  color: '#022C22',
                  fontSize: '14.5px',
                  fontWeight: 900,
                  fontFamily: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  cursor: 'pointer',
                  boxShadow: '0 5px 0 #065F46, 0 12px 24px rgba(16, 185, 129, 0.35)',
                  letterSpacing: '0.02em',
                }}
              >
                <Sparkles size={18} /> THRON-ABENTEUER STARTEN
              </button>

              {throneStats.totalHard > 0 && (
                <button
                  type="button"
                  onClick={() => startAdventure({ kingdom: 'all', onlyHard: true })}
                  style={{
                    height: '54px',
                    padding: '0 1rem 0 0.6rem',
                    borderRadius: '16px',
                    border: '2px solid #F9A8D4',
                    background: 'linear-gradient(180deg, #EC4899 0%, #BE185D 100%)',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 900,
                    fontFamily: 'inherit',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    cursor: 'pointer',
                    boxShadow: '0 5px 0 #831843, 0 10px 20px rgba(236, 72, 153, 0.35)',
                  }}
                >
                  <img src="/vocab-game/boss-dragon.png" alt="" style={{ width: '30px', height: '30px', objectFit: 'contain' }} />
                  BOSS ({throneStats.totalHard})
                </button>
              )}

              {spellingStore.customWords.length > 0 && (
                <button
                  type="button"
                  onClick={() => startAdventure({ kingdom: 'custom', onlyHard: false })}
                  style={{
                    height: '54px',
                    padding: '0 0.95rem',
                    borderRadius: '16px',
                    border: '2px solid #7DD3FC',
                    background: 'linear-gradient(180deg, #0EA5E9 0%, #0369A1 100%)',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 900,
                    fontFamily: 'inherit',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    cursor: 'pointer',
                    boxShadow: '0 5px 0 #0C4A6E',
                  }}
                >
                  📝 DIKTAT ({spellingStore.customWords.length})
                </button>
              )}
            </div>

            {/* 8 Themen-Königreiche Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.15rem' }}>
              <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#C4B5FD' }}>
                Die 8 Rechtschreib-Königreiche (tippe zum Üben)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(158px, 1fr))', gap: '0.55rem' }}>
                {throneStats.kingdoms.map(({ kingdom, masteredTasks, crownUnlocked, progressPct }) => (
                  <button
                    key={kingdom.id}
                    type="button"
                    onClick={() => startAdventure({ kingdom: kingdom.id, onlyHard: false })}
                    style={{
                      padding: '0.8rem 0.78rem',
                      borderRadius: '18px',
                      border: crownUnlocked
                        ? '2px solid #FACC15'
                        : `1.5px solid ${kingdom.color}66`,
                      background: crownUnlocked
                        ? 'linear-gradient(155deg, rgba(250, 204, 21, 0.22), rgba(15, 23, 42, 0.65))'
                        : 'rgba(15, 23, 42, 0.52)',
                      color: '#FFFFFF',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                      boxShadow: crownUnlocked
                        ? '0 4px 0 rgba(161, 98, 7, 0.85), 0 0 14px rgba(250, 204, 21, 0.25)'
                        : '0 4px 0 rgba(15, 23, 42, 0.85)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.3rem' }}>
                      <span style={{ fontSize: '24px', lineHeight: 1 }}>{kingdom.emoji}</span>
                      {crownUnlocked ? (
                        <span
                          style={{
                            padding: '0.12rem 0.45rem',
                            borderRadius: '999px',
                            background: 'linear-gradient(135deg, #FDE047, #F59E0B)',
                            color: '#451A03',
                            fontSize: '10px',
                            fontWeight: 900,
                          }}
                        >
                          👑 KRONE
                        </span>
                      ) : (
                        <span style={{ fontSize: '10.5px', fontWeight: 900, color: '#CBD5E1', fontVariantNumeric: 'tabular-nums' }}>
                          {masteredTasks}/{kingdom.crownTarget}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12.5px', fontWeight: 900, lineHeight: 1.2, color: '#FFFFFF' }}>
                      {kingdom.shortTitle}
                    </div>
                    <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#CBD5E1', lineHeight: 1.3 }}>
                      {kingdom.subtitle}
                    </div>
                    <div style={{ marginTop: 'auto', paddingTop: '0.2rem', height: '6px', borderRadius: '999px', background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${progressPct}%`,
                          height: '100%',
                          borderRadius: '999px',
                          background: crownUnlocked ? '#FACC15' : kingdom.color,
                        }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </article>
        </>
      )}

      {/* ================= TAB 2: GEMEINSAME SCHATZKAMMER ================= */}
      {activeTab === 'treasury' && (
        <VocabTreasuryView
          profile={viewedProfile}
          settings={gamState.settings}
          requests={gamState.exchangeRequests}
          isAdult={!user?.isChild}
          viewerName={user?.id || 'Eltern'}
          onRequestExchange={({ diamonds, rewardLabel, starsReward, note }) => {
            mockDb.requestVocabDiamondExchange({
              userId: viewedProfile.userId,
              userName: viewedProfile.userId,
              diamonds,
              rewardLabel,
              starsReward,
              note,
            });
          }}
          onResolveRequest={(requestId, decision) => {
            mockDb.resolveVocabDiamondExchange(requestId, decision, user?.id || 'Eltern');
          }}
        />
      )}

      {/* ================= TAB 3: ABZEICHEN & 60-LEVEL-RÄNGE ================= */}
      {activeTab === 'badges' && <VocabBadgesView profile={viewedProfile} />}

      {chestOverlay}
    </section>
  );
};
