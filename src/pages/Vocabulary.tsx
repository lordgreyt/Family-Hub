import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  CircleCheck,
  Clock3,
  Ear,
  Flame,
  Gift,
  Grid2x2,
  Headphones,
  Keyboard,
  Languages,
  Layers,
  Lightbulb,
  List,
  ListChecks,
  Plus,
  RotateCcw,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Turtle,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';
import type { VocabularyEntry, VocabularyLearnMode, VocabularySet } from '../services/mockDb';
import { mergeVocabEntries } from '../services/vocabOcr';
import {
  MODE_HINT,
  MODE_LABEL,
  answerVariants,
  buildChoiceOptions,
  buildTypingHint,
  dailyExamTarget,
  daysUntilExam,
  isAnswerCorrect,
  isGermanLanguage,
  isHardEntry,
  pickLearnMode,
  speechText,
} from './vocabularyLearn';
import {
  normalizeChildProfile,
  type VocabGamificationState,
  type VocabPendingChest,
} from './vocabGamification';
import { playComboPing } from './vocabSounds';
import {
  OPENAI_VOICES,
  SPEECH_RATE_NORMAL,
  SPEECH_RATE_SLOW,
  canSpeak,
  getEnglishAccent,
  getLastTtsError,
  getTtsVoice,
  loadTtsStatus,
  setEnglishAccent,
  setTtsVoice,
  speakText,
  stopSpeaking,
  unlockAudio,
} from './speech';
import type { EnglishAccent, OpenAiVoice, TtsStatus } from './speech';
import { HubIcon } from '../components/HubIcon';
import { VocabCameraScanner } from '../components/Vocabulary/VocabCameraScanner';
import { VocabAudioPlayer } from '../components/Vocabulary/VocabAudioPlayer';
import { VocabFlashcards } from '../components/Vocabulary/VocabFlashcards';
import { VocabMatchGame } from '../components/Vocabulary/VocabMatchGame';
import { VocabWordListSheet } from '../components/Vocabulary/VocabWordListSheet';
import { VocabTreasureChest } from '../components/Vocabulary/VocabTreasureChest';
import {
  VocabBadgesView,
  VocabTreasureHud,
  VocabTreasuryView,
} from '../components/Vocabulary/VocabGamificationPanel';
import { CARD, GREEN_TEXT, HERO_GRADIENT, PINK_TEXT, PRIMARY } from '../components/SurgeryFinance/theme';

type LearnMode = VocabularyLearnMode;
type QuizModePreference = 'smart' | 'choice' | 'type' | 'dictation';
type VocabTab = 'learn' | 'treasury' | 'badges';
type ActiveActivity =
  | { kind: 'quiz'; modePref: QuizModePreference; onlyHard: boolean }
  | { kind: 'flashcards'; onlyHard: boolean }
  | { kind: 'match'; onlyHard: boolean }
  | { kind: 'audio'; onlyHard: boolean };

const AUTO_SPEAK_KEY = 'family_hub_vocab_auto_speak';

function readAutoSpeak(): boolean {
  try {
    const raw = localStorage.getItem(AUTO_SPEAK_KEY);
    return raw === null ? true : raw === '1';
  } catch {
    return true;
  }
}

function createId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parsePairs(text: string): Array<{ front: string; back: string }> {
  return text.split(/\r?\n/).flatMap(line => {
    const parts = line.trim().split(/[\t;|]/).map(part => part.trim());
    return parts.length > 1 && parts[0] && parts.slice(1).join(' ').trim()
      ? [{ front: parts[0], back: parts.slice(1).join(' ').trim() }]
      : [];
  });
}

function optionStyle(state: 'idle' | 'correct' | 'wrong'): React.CSSProperties {
  const base: React.CSSProperties = {
    minHeight: 56,
    width: '100%',
    borderRadius: '16px',
    border: '2px solid rgba(167, 139, 250, 0.34)',
    background: 'rgba(15, 23, 42, 0.62)',
    color: '#FFFFFF',
    fontSize: 'clamp(0.98rem, 3.6vw, 1.12rem)',
    fontWeight: 800,
    padding: '0.75rem 1rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    boxShadow: '0 4px 0 rgba(15, 23, 42, 0.9)',
    transition: 'background 140ms ease, border-color 140ms ease, transform 120ms ease',
  };
  if (state === 'correct') {
    return {
      ...base,
      background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.48), rgba(5, 150, 105, 0.62))',
      borderColor: '#34D399',
      color: '#ECFDF5',
      boxShadow: '0 4px 0 #065F46, 0 0 18px rgba(52, 211, 153, 0.35)',
    };
  }
  if (state === 'wrong') {
    return {
      ...base,
      background: 'linear-gradient(180deg, rgba(225, 29, 72, 0.45), rgba(159, 18, 57, 0.6))',
      borderColor: '#FB7185',
      color: '#FFE4E6',
      boxShadow: '0 4px 0 #881337, 0 0 18px rgba(251, 113, 133, 0.35)',
    };
  }
  return base;
}

interface StudyCardProps {
  mode: LearnMode;
  options: string[];
  prompt: string;
  answer: string;
  promptLanguage: string;
  answerLanguage: string;
  autoSpeak: boolean;
  onAnswer: (correct: boolean, mode: LearnMode) => void;
}

function StudyCard({
  mode,
  options,
  prompt,
  answer,
  promptLanguage,
  answerLanguage,
  autoSpeak,
  onAnswer,
}: StudyCardProps) {
  const [typed, setTyped] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [plays, setPlays] = useState(0);
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2>(0);
  const [ttsErrorMsg, setTtsErrorMsg] = useState<string | null>(null);
  const answerRef = useRef(onAnswer);
  answerRef.current = onAnswer;

  const listening = mode === 'audio' || mode === 'dictation';
  const ttsAvailable = canSpeak();
  const acceptedAnswers = answerVariants(answer);
  const spokenText = speechText(mode === 'dictation' ? answer : prompt);
  const spokenLanguage = mode === 'dictation' ? answerLanguage : promptLanguage;
  const foreignAnswerText = !isGermanLanguage(answerLanguage) ? speechText(answer) : '';

  const handleTtsError = () => {
    setTtsErrorMsg(getLastTtsError() || 'OpenAI Sprachausgabe aktuell nicht erreichbar – tippe auf „Vorlesen“.');
  };

  const playAudio = (slow = false) => {
    if (!ttsAvailable) return;
    if (listening && plays >= 5) return;
    unlockAudio();
    setTtsErrorMsg(null);
    if (
      speakText(spokenText, spokenLanguage, handleTtsError, {
        rate: slow ? SPEECH_RATE_SLOW : SPEECH_RATE_NORMAL,
      })
    ) {
      setPlays(value => value + 1);
    }
  };

  // Auto-speak on card appearance: always in listening/dictation, or when autoSpeak is ON and prompt is foreign
  useEffect(() => {
    if (!ttsAvailable) return;
    const shouldAutoPlay = listening || (autoSpeak && !isGermanLanguage(spokenLanguage));
    if (!shouldAutoPlay) return;
    const timer = window.setTimeout(() => {
      if (speakText(spokenText, spokenLanguage, handleTtsError, { rate: SPEECH_RATE_NORMAL })) {
        setPlays(value => value + 1);
      }
    }, 260);
    return () => window.clearTimeout(timer);
    // Card is remounted per entry via key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => stopSpeaking(), []);

  // Speak correct foreign answer right after answering (e.g. Deutsch -> Englisch)
  useEffect(() => {
    if (result === 'idle') return;
    if (autoSpeak && ttsAvailable && foreignAnswerText && mode !== 'dictation') {
      speakText(foreignAnswerText, answerLanguage, undefined, { rate: SPEECH_RATE_NORMAL });
    }
    if (result === 'correct') {
      const delay = autoSpeak && foreignAnswerText ? 1250 : 900;
      const timer = window.setTimeout(() => answerRef.current(true, mode), delay);
      return () => window.clearTimeout(timer);
    }
  }, [result, mode, autoSpeak, ttsAvailable, foreignAnswerText, answerLanguage]);

  const choose = (value: string) => {
    if (result !== 'idle') return;
    setSelected(value);
    setResult(isAnswerCorrect(value, answer) ? 'correct' : 'wrong');
  };

  const submitTyped = (event: FormEvent) => {
    event.preventDefault();
    if (result !== 'idle' || !typed.trim()) return;
    setResult(isAnswerCorrect(typed, answer) ? 'correct' : 'wrong');
  };

  const hintText = hintLevel > 0 ? buildTypingHint(answer, hintLevel) : '';

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
              : '0 16px 38px rgba(23, 21, 59, 0.4)',
        color: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      {/* Top Row: Gaming Mode Badge + Hint */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.3rem 0.78rem',
            borderRadius: 999,
            background: 'rgba(129, 140, 248, 0.24)',
            border: '1px solid rgba(165, 180, 252, 0.45)',
            color: '#E0E7FF',
            fontSize: '12px',
            fontWeight: 900,
            letterSpacing: '0.03em',
          }}
        >
          {mode === 'choice' ? <ListChecks size={14} /> : mode === 'type' ? <Keyboard size={14} /> : <Ear size={14} />}
          {MODE_LABEL[mode]}
        </span>
        <span style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: '#C4B5FD' }}>
          {MODE_HINT[mode]}
        </span>
      </div>

      {/* Prompt Stage + 3D Sound Crystal Button */}
      <div
        style={{
          padding: '1.05rem 0.9rem',
          borderRadius: '20px',
          background: 'rgba(15, 23, 42, 0.48)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.7rem',
          textAlign: 'center',
        }}
      >
        {listening && mode === 'audio' && ttsAvailable ? (
          <div style={{ fontSize: 'var(--font-sm)', fontWeight: 800, color: '#BAE6FD', padding: '0.45rem 0 0.1rem' }}>
            Hör genau zu und schreibe die Übersetzung ({answerLanguage})
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#A5B4FC' }}>
              {promptLanguage}
            </div>
            <div
              style={{
                fontSize: 'clamp(1.9rem, 7vw, 2.9rem)',
                lineHeight: 1.14,
                fontWeight: 900,
                color: '#FFFFFF',
                marginTop: '0.25rem',
                overflowWrap: 'anywhere',
                textShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
              }}
            >
              {prompt}
            </div>
          </div>
        )}

        {/* 3D Gaming Audio Buttons */}
        {ttsAvailable ? (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.15rem' }}>
            <button
              type="button"
              onClick={() => playAudio(false)}
              disabled={listening && plays >= 5}
              style={{
                height: '44px',
                padding: '0 1rem 0 0.5rem',
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
                opacity: listening && plays >= 5 ? 0.45 : 1,
                boxShadow: '0 4px 0 rgba(30, 58, 138, 0.9)',
              }}
            >
              <img src="/vocab-game/sound-orb.png" alt="" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
              {plays > 0 ? 'Nochmal hören' : 'Vorlesen'}
            </button>
            <button
              type="button"
              onClick={() => playAudio(true)}
              disabled={listening && plays >= 5}
              style={{
                height: '44px',
                padding: '0 0.9rem',
                borderRadius: '14px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.1)',
                color: '#E2E8F0',
                fontSize: '12.5px',
                fontWeight: 800,
                fontFamily: 'inherit',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: 'pointer',
                opacity: listening && plays >= 5 ? 0.45 : 1,
                boxShadow: '0 4px 0 rgba(15, 23, 42, 0.7)',
              }}
            >
              <Turtle size={15} /> Langsam
            </button>
          </div>
        ) : (
          listening && (
            <span style={{ fontSize: 'var(--font-xs)', color: '#CBD5E1' }}>
              {getLastTtsError() || 'OpenAI Sprachausgabe aktuell nicht verfügbar – Wort steht oben.'}
            </span>
          )
        )}

        {ttsErrorMsg && (
          <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: '#FDA4AF', maxWidth: '380px' }}>
            {ttsErrorMsg}
          </div>
        )}
      </div>

      {/* Answer Interaction */}
      {mode === 'choice' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          {options.map(option => {
            const isCorrect = isAnswerCorrect(option, answer);
            const state = result === 'idle' ? 'idle' : isCorrect ? 'correct' : selected === option ? 'wrong' : 'idle';
            return (
              <button key={option} type="button" onClick={() => choose(option)} disabled={result !== 'idle'} style={optionStyle(state)}>
                {option}
              </button>
            );
          })}
        </div>
      ) : (
        <form onSubmit={submitTyped} style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          {hintText && result === 'idle' && (
            <div
              style={{
                padding: '0.6rem 0.9rem',
                borderRadius: '14px',
                background: 'rgba(250, 204, 21, 0.16)',
                border: '1.5px solid rgba(250, 204, 21, 0.5)',
                color: '#FEF08A',
                textAlign: 'center',
                fontSize: '1rem',
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
            onChange={event => setTyped(event.target.value)}
            placeholder={`Antwort auf ${answerLanguage} eingeben…`}
            aria-label="Antwort"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            disabled={result !== 'idle'}
            style={{
              fontSize: 'clamp(1.05rem, 4vw, 1.28rem)',
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

      {/* Result Banner + Solution Audio Replay */}
      {result !== 'idle' && (
        <div
          role="status"
          style={{
            padding: '0.8rem 0.95rem',
            borderRadius: '16px',
            background: result === 'correct' ? 'rgba(16, 185, 129, 0.24)' : 'rgba(225, 29, 72, 0.25)',
            border: result === 'correct' ? '1.5px solid #34D399' : '1.5px solid #FB7185',
            color: result === 'correct' ? '#A7F3D0' : '#FECDD3',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.55rem',
            flexWrap: 'wrap',
            fontWeight: 800,
            fontSize: 'var(--font-sm)',
          }}
        >
          {result === 'correct' ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <CircleCheck size={19} color="#34D399" /> Richtig!
              {acceptedAnswers.length > 1 && <span style={{ opacity: 0.88, fontWeight: 700 }}>({acceptedAnswers.join(' · ')})</span>}
            </span>
          ) : (
            <span>
              Richtig {acceptedAnswers.length > 1 ? 'sind' : 'ist'}:{' '}
              <strong style={{ color: '#FFFFFF' }}>{acceptedAnswers.join(' · ') || answer}</strong>
            </span>
          )}

          {ttsAvailable && (
            <button
              type="button"
              onClick={() => speakText(speechText(answer), answerLanguage, undefined, { rate: SPEECH_RATE_NORMAL })}
              aria-label="Lösung vorlesen"
              title="Lösung anhören"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.28)',
                background: 'rgba(255,255,255,0.16)',
                color: '#FFFFFF',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <img src="/vocab-game/sound-orb.png" alt="" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
            </button>
          )}
        </div>
      )}

      {result === 'wrong' && (
        <button
          type="button"
          onClick={() => answerRef.current(false, mode)}
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

      {result === 'idle' && mode !== 'choice' && (
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
          Weiß ich nicht – Lösung zeigen
        </button>
      )}
    </div>
  );
}

export const Vocabulary = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Ein gemeinsamer Vokabel-Pool + Gamification-Zustand
  const [pool, setPool] = useState<VocabularySet>(() => mockDb.getVocabularyPool());
  const [gamState, setGamState] = useState<VocabGamificationState>(() => mockDb.getVocabGamification());
  const [allUsers, setAllUsers] = useState(() => mockDb.getUsers());

  const [activeTab, setActiveTab] = useState<VocabTab>('learn');
  const [manageOpen, setManageOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [wordListOpen, setWordListOpen] = useState(false);

  // Standardmäßig IMMER das eigene angemeldete Konto anzeigen; Kinder sehen nur ihren eigenen Bereich
  const childUsers = useMemo(() => allUsers.filter(u => u.isChild), [allUsers]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>(() => user?.id || '');

  useEffect(() => {
    if (user?.isChild) {
      setSelectedProfileId(user.id);
    } else if (user?.id && !selectedProfileId) {
      setSelectedProfileId(user.id);
    }
  }, [user, selectedProfileId]);

  const [languageFrom, setLanguageFrom] = useState(pool.languageFrom || 'Englisch');
  const [languageTo, setLanguageTo] = useState(pool.languageTo || 'Deutsch');
  const [examDate, setExamDate] = useState(pool.examDate || '');
  const [pairsText, setPairsText] = useState('');
  const [message, setMessage] = useState('');

  // Aktive Schatztruhe & Bonus-Meldungen
  const [activeChest, setActiveChest] = useState<VocabPendingChest | null>(null);
  const [bonusBanner, setBonusBanner] = useState<string>('');

  // Active study session
  const [activity, setActivity] = useState<ActiveActivity | null>(null);
  const [direction, setDirection] = useState<'forward' | 'reverse'>('forward');
  const [queue, setQueue] = useState<string[]>([]);
  const [requeued, setRequeued] = useState<Record<string, number>>({});
  const [sessionAnswered, setSessionAnswered] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [sessionSeq, setSessionSeq] = useState(0);
  const [sessionCombo, setSessionCombo] = useState(0);
  const [nowMs, setNowMs] = useState(0);
  const [autoSpeak, setAutoSpeak] = useState<boolean>(readAutoSpeak);
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);
  const [enAccent, setEnAccent] = useState<EnglishAccent>(getEnglishAccent);
  const [studioVoice, setStudioVoice] = useState<OpenAiVoice>(getTtsVoice);
  const [ttsStatus, setTtsStatus] = useState<TtsStatus | null>(null);
  const [voiceTestError, setVoiceTestError] = useState('');

  useEffect(() => {
    if (!voicePanelOpen) return;
    setVoiceTestError('');
    if (!user) return;
    loadTtsStatus().then(status => {
      setTtsStatus(status);
      setStudioVoice(status.voice);
      setEnAccent(status.accent);
    });
  }, [voicePanelOpen, user]);

  useEffect(() => {
    const updateClock = () => setNowMs(Date.now());
    const timer = window.setTimeout(updateClock, 0);
    const interval = window.setInterval(updateClock, 60_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const refresh = () => {
      setPool(mockDb.getVocabularyPool());
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

  const poolStats = useMemo(() => {
    const progress = pool.progressByUser?.[viewedUserId] || {};
    const totalWords = pool.entries.length;
    let totalMastered = 0;
    let totalDue = 0;
    let totalHard = 0;

    for (const entry of pool.entries) {
      const p = progress[entry.id];
      if ((p?.streak || 0) >= 2) totalMastered += 1;
      if (!p?.nextReviewAt || p.nextReviewAt <= nowMs) totalDue += 1;
      if (isHardEntry(p)) totalHard += 1;
    }

    const daysLeft = daysUntilExam(pool.examDate);
    const pacePerDay = dailyExamTarget(Math.max(0, totalWords - totalMastered), daysLeft);
    return { totalWords, totalMastered, totalDue, totalHard, daysLeft, pacePerDay };
  }, [pool, viewedUserId, nowMs]);

  const entriesForActivity = (onlyHard: boolean): VocabularyEntry[] => {
    const progress = pool.progressByUser?.[actingUserId] || {};
    if (onlyHard) {
      const hard = pool.entries.filter(entry => isHardEntry(progress[entry.id]));
      if (hard.length > 0) return hard;
    }
    return pool.entries;
  };

  const pickSessionBatch = (onlyHard: boolean): VocabularyEntry[] => {
    const progress = pool.progressByUser?.[actingUserId] || {};
    const source = entriesForActivity(onlyHard);
    if (onlyHard) return source.slice(0, 25);

    const due = source.filter(e => !progress[e.id]?.nextReviewAt || progress[e.id].nextReviewAt <= nowMs);
    const ordered = [...(due.length > 0 ? due : source)].sort((a, b) => {
      const pa = progress[a.id];
      const pb = progress[b.id];
      const hardDiff = Number(isHardEntry(pb)) - Number(isHardEntry(pa));
      if (hardDiff !== 0) return hardDiff;
      return (pa?.nextReviewAt || 0) - (pb?.nextReviewAt || 0);
    });
    return ordered.slice(0, 25);
  };

  const startQuiz = (
    options: { modePref?: QuizModePreference; onlyHard?: boolean; nextDirection?: 'forward' | 'reverse' } = {}
  ) => {
    const modePref = options.modePref ?? 'smart';
    const onlyHard = options.onlyHard ?? false;
    const nextDirection = options.nextDirection ?? direction;

    const batch = pickSessionBatch(onlyHard);
    if (batch.length === 0) return;

    stopSpeaking();
    setActivity({ kind: 'quiz', modePref, onlyHard });
    setDirection(nextDirection);
    setQueue(batch.map(entry => entry.id));
    setRequeued({});
    setSessionAnswered(0);
    setSessionCorrect(0);
    setSessionTotal(batch.length);
    setSessionCombo(0);
    setBonusBanner('');
    setSessionSeq(value => value + 1);
  };

  const finishActivity = () => {
    stopSpeaking();
    setActivity(null);
    setQueue([]);
    setBonusBanner('');
  };

  const handleGamifiedAnswer = (entryId: string, correct: boolean, mode: LearnMode, countForGamification = true) => {
    if (!user) return;
    const outcome = mockDb.recordPoolVocabularyAnswer(user.id, entryId, correct, mode, { countForGamification });
    if (!outcome) return;

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
  };

  const currentEntry: VocabularyEntry | null =
    activity?.kind === 'quiz' && queue.length
      ? pool.entries.find(entry => entry.id === queue[0]) || null
      : null;

  const sessionPercent = sessionTotal ? Math.min(100, Math.round((sessionAnswered / sessionTotal) * 100)) : 0;
  const promptLanguage = direction === 'forward' ? pool.languageFrom : pool.languageTo;
  const answerLanguage = direction === 'forward' ? pool.languageTo : pool.languageFrom;
  const prompt = currentEntry ? (direction === 'forward' ? currentEntry.front : currentEntry.back) : '';
  const answer = currentEntry ? (direction === 'forward' ? currentEntry.back : currentEntry.front) : '';
  const currentProgress = currentEntry ? pool.progressByUser?.[actingUserId]?.[currentEntry.id] : undefined;

  const learnMode: LearnMode = (() => {
    if (!currentEntry || activity?.kind !== 'quiz') return 'choice';
    const canChoose = pool.entries.length > 1;
    const canDictate = !isGermanLanguage(answerLanguage);
    if (activity.modePref === 'choice') return canChoose ? 'choice' : 'type';
    if (activity.modePref === 'type') return 'type';
    if (activity.modePref === 'dictation') return canDictate ? 'dictation' : 'audio';
    return pickLearnMode({
      streak: currentProgress?.streak || 0,
      lastMode: currentProgress?.lastMode,
      canChoose,
      canDictate,
    });
  })();

  const choiceOptions =
    currentEntry && learnMode === 'choice'
      ? buildChoiceOptions(
          currentEntry,
          pool.entries,
          direction === 'forward' ? entry => entry.back : entry => entry.front,
          `${currentEntry.id}:${sessionSeq}`
        )
      : [];

  const answerCard = (correct: boolean, answeredMode: LearnMode) => {
    if (!currentEntry || !user) return;
    handleGamifiedAnswer(currentEntry.id, correct, answeredMode, true);
    setSessionAnswered(value => value + 1);
    if (correct) setSessionCorrect(value => value + 1);
    let nextQueue = queue.slice(1);
    if (!correct && (requeued[currentEntry.id] || 0) < 1) {
      nextQueue = [...nextQueue, currentEntry.id];
      setRequeued(previous => ({ ...previous, [currentEntry.id]: (previous[currentEntry.id] || 0) + 1 }));
    }
    setQueue(nextQueue);
    setSessionSeq(value => value + 1);
  };

  const handleAddManualEntries = (event: FormEvent) => {
    event.preventDefault();
    if (!user || user.isChild) return;
    const pairs = parsePairs(pairsText);
    if (pairs.length === 0 && examDate === (pool.examDate || '')) {
      setMessage('Bitte mindestens ein gültiges Wortpaar eintragen.');
      return;
    }

    const merged = mergeVocabEntries(
      pool.entries,
      pairs.map(p => ({ id: createId(), front: p.front, back: p.back }))
    );

    mockDb.saveVocabularyPool({
      ...pool,
      languageFrom: languageFrom.trim() || pool.languageFrom || 'Englisch',
      languageTo: languageTo.trim() || pool.languageTo || 'Deutsch',
      examDate: examDate || undefined,
      entries: merged.entries,
      createdBy: pool.createdBy || user.id,
    });

    setPairsText('');
    setMessage(
      merged.addedCount > 0
        ? `${merged.addedCount} neue Vokabeln zum Vokabel-Pool hinzugefügt (gesamt ${merged.entries.length}).`
        : 'Vokabel-Pool aktualisiert.'
    );
    setManageOpen(false);
    window.setTimeout(() => setMessage(''), 4000);
  };

  const handleScannerSaved = (savedPool: VocabularySet, summary: string) => {
    mockDb.saveVocabularyPool(savedPool);
    setMessage(summary);
    window.setTimeout(() => setMessage(''), 4500);
  };

  const chestOverlay = (
    <VocabTreasureChest
      chest={activeChest}
      onClaim={chestId => {
        const targetId = activity ? actingUserId : viewedUserId;
        const result = mockDb.claimVocabChest(targetId, chestId);
        return result.newBadges;
      }}
      onClose={() => setActiveChest(null)}
    />
  );

  // --- Active Learning Sub-Views ---
  if (activity) {
    if (activity.kind === 'audio') {
      return (
        <>
          <VocabAudioPlayer
            set={pool}
            entries={entriesForActivity(activity.onlyHard)}
            onClose={finishActivity}
          />
          {chestOverlay}
        </>
      );
    }

    if (activity.kind === 'flashcards') {
      return (
        <>
          <VocabFlashcards
            set={pool}
            entries={entriesForActivity(activity.onlyHard)}
            userName={user?.id || ''}
            autoSpeak={autoSpeak}
            onToggleAutoSpeak={toggleAutoSpeak}
            onRate={(entryId, known) => {
              // Karteikarten aktualisieren den Lernstand, zählen aber nicht fürs Durchklicken in die Truhe
              handleGamifiedAnswer(entryId, known, 'choice', false);
            }}
            onClose={finishActivity}
          />
          {chestOverlay}
        </>
      );
    }

    if (activity.kind === 'match') {
      return (
        <>
          <VocabMatchGame
            set={pool}
            entries={entriesForActivity(activity.onlyHard)}
            userName={user?.id || ''}
            autoSpeak={autoSpeak}
            onToggleAutoSpeak={toggleAutoSpeak}
            onPairResult={(entryId, correct) => {
              handleGamifiedAnswer(entryId, correct, 'choice', true);
            }}
            onClose={finishActivity}
          />
          {chestOverlay}
        </>
      );
    }

    // Quiz Mode (Smart / Choice / Type / Dictation)
    const completed = queue.length === 0;
    const modeOptions: { id: QuizModePreference; label: string }[] = [
      { id: 'smart', label: 'Smart' },
      { id: 'choice', label: 'Auswahl' },
      { id: 'type', label: 'Schreiben' },
      { id: 'dictation', label: 'Hören' },
    ];

    return (
      <section style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', maxWidth: 680, margin: '0 auto', paddingBottom: '2.2rem' }}>
        {/* Top Gaming Control Strip */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={finishActivity}
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
            <ChevronLeft size={17} /> Arena
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

            <button
              type="button"
              onClick={() =>
                startQuiz({
                  modePref: activity.modePref,
                  onlyHard: activity.onlyHard,
                  nextDirection: direction === 'forward' ? 'reverse' : 'forward',
                })
              }
              title="Abfragerichtung wechseln"
              style={{
                height: '38px',
                padding: '0 0.8rem',
                borderRadius: '14px',
                border: '1px solid rgba(167, 139, 250, 0.35)',
                background: '#312E81',
                color: '#E0E7FF',
                fontWeight: 800,
                fontSize: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <Languages size={14} />
              {direction === 'forward'
                ? `${pool.languageFrom} → ${pool.languageTo}`
                : `${pool.languageTo} → ${pool.languageFrom}`}
            </button>
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

        {/* Gaming HUD Session Header Card */}
        <div
          style={{
            borderRadius: '22px',
            padding: '0.95rem 1.05rem',
            background: 'linear-gradient(145deg, #17153B 0%, #2B2164 60%, #3C2474 100%)',
            border: '2px solid rgba(167, 139, 250, 0.35)',
            color: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.7rem',
            boxShadow: '0 12px 26px rgba(23, 21, 59, 0.32)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
              <img
                src={activity.onlyHard ? '/vocab-game/boss-dragon.png' : '/vocab-game/swords-quest.png'}
                alt=""
                style={{ width: '36px', height: '36px', objectFit: 'contain', flexShrink: 0 }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '10.5px', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: activity.onlyHard ? '#F9A8D4' : '#FEF08A' }}>
                  {activity.onlyHard ? 'BOSS-KAMPF · SCHWERE WÖRTER' : 'ABENTEUER-MODUS'}
                </div>
                <h2 style={{ margin: '0.08rem 0 0', fontSize: 'var(--font-base)', fontWeight: 900 }}>
                  {pool.languageFrom} ↔ {pool.languageTo}
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', padding: '4px', borderRadius: '14px', background: 'rgba(15, 23, 42, 0.55)' }}>
            {modeOptions.map(opt => {
              const active = activity.modePref === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setActivity({ ...activity, modePref: opt.id })}
                  style={{
                    height: '32px',
                    borderRadius: '10px',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '12px',
                    fontWeight: active ? 900 : 700,
                    background: active ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : 'transparent',
                    color: active ? '#FFFFFF' : '#94A3B8',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div style={{ height: 10, borderRadius: 99, background: 'rgba(255,255,255,0.12)', overflow: 'hidden', padding: '1px' }}>
            <div
              style={{
                height: '100%',
                width: `${completed ? 100 : sessionPercent}%`,
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
              src="/vocab-game/hero-owl.png"
              alt="Sieg"
              style={{ width: '108px', height: '108px', objectFit: 'contain', filter: 'drop-shadow(0 12px 22px rgba(0,0,0,0.45))' }}
            />
            <div style={{ fontSize: '26px', letterSpacing: '0.2rem' }}>
              {sessionAnswered > 0 && sessionCorrect / sessionAnswered >= 0.9
                ? '⭐⭐⭐'
                : sessionAnswered > 0 && sessionCorrect / sessionAnswered >= 0.65
                  ? '⭐⭐'
                  : '⭐'}
            </div>
            <h2 style={{ margin: 0, fontSize: '1.55rem', fontWeight: 900 }}>Runde gewonnen, {user?.id}!</h2>
            <p style={{ margin: 0, color: '#E0E7FF', fontWeight: 800, fontSize: 'var(--font-sm)' }}>
              {sessionCorrect} von {sessionAnswered} richtig · Truhe: {ownProfile.blockCount}/{gamState.settings.chestSize}
            </p>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '0.35rem', width: '100%' }}>
              <button
                type="button"
                onClick={() => startQuiz({ modePref: activity.modePref, onlyHard: activity.onlyHard })}
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
                onClick={finishActivity}
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
                Zur Arena
              </button>
            </div>
          </div>
        ) : currentEntry ? (
          <StudyCard
            key={`${currentEntry.id}:${sessionSeq}:${activity.modePref}`}
            mode={learnMode}
            options={choiceOptions}
            prompt={prompt}
            answer={answer}
            promptLanguage={promptLanguage}
            answerLanguage={answerLanguage}
            autoSpeak={autoSpeak}
            onAnswer={answerCard}
          />
        ) : (
          <div style={{ ...CARD, padding: '1.5rem', textAlign: 'center' }}>
            <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Der Vokabel-Pool enthält noch keine Vokabeln.</p>
            <button type="button" onClick={finishActivity} className="btn btn-secondary" style={{ marginTop: '1rem', borderRadius: '999px' }}>
              Zur Übersicht
            </button>
          </div>
        )}

        {chestOverlay}
      </section>
    );
  }

  // --- Main Overview Page (Single Vocabulary Pool + Colorful Gamification) ---
  const manualPairCount = parsePairs(pairsText).length;
  const totalMasteryPct =
    poolStats.totalWords > 0 ? Math.round((poolStats.totalMastered / poolStats.totalWords) * 100) : 0;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem', maxWidth: 780, margin: '0 auto', paddingBottom: '2.5rem' }}>
      {/* Hero Card */}
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
              <HubIcon name="vocab" size={34} />
            </span>
            <div style={{ fontSize: 'var(--font-lg)', fontWeight: 800, lineHeight: 1.15, whiteSpace: 'nowrap' }}>
              Vokabeltraining
            </div>
          </div>

          {canSpeak() && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0, marginLeft: 'auto' }}>
              <button
                type="button"
                onClick={() => setVoicePanelOpen(v => !v)}
                title="Stimme & Aussprache einstellen"
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
                title={autoSpeak ? 'Automatisches Vorlesen aktiv' : 'Automatisches Vorlesen aus'}
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

        {/* Adult child-switcher so parents can inspect each child's diamonds & streaks */}
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

        {/* Adult Action Buttons (Camera Scanner + Manual Add to Pool) */}
        {!user?.isChild && (
          <div style={{ marginTop: '0.95rem', display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                setScannerOpen(true);
                setMessage('');
              }}
              style={{
                flex: '1 1 180px',
                height: '44px',
                padding: '0 1rem',
                borderRadius: '999px',
                border: 'none',
                background: '#FFFFFF',
                color: '#3F34C4',
                fontWeight: 800,
                fontSize: '13.5px',
                fontFamily: 'inherit',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                cursor: 'pointer',
                boxShadow: '0 6px 16px rgba(23, 20, 58, 0.16)',
              }}
            >
              <Camera size={16} /> Seite abfotografieren
            </button>
            <button
              type="button"
              onClick={() => {
                setManageOpen(value => !value);
                setMessage('');
              }}
              style={{
                height: '44px',
                padding: '0 1rem',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.45)',
                background: 'rgba(255,255,255,0.18)',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '13.5px',
                fontFamily: 'inherit',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                cursor: 'pointer',
              }}
            >
              {manageOpen ? <X size={16} /> : <Plus size={16} />}
              {manageOpen ? 'Schließen' : 'Manuell'}
            </button>
          </div>
        )}
      </div>

      {/* Prominent Parent Alert for Pending Diamond Exchange Requests */}
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

      {/* Voice Panel */}
      {voicePanelOpen && canSpeak() && (
        <div style={{ ...CARD, padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 'var(--font-base)', fontWeight: 800 }}>OpenAI Studio-Stimme</h2>
              <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Natürliche KI-Aussprache (gpt-4o-mini-tts) mit lokalem Offline-Cache
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
                  ? 'Noch keine Vorlese-Stimme freigeschaltet – ein Erwachsener kann sie in den Einstellungen hinterlegen.'
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

          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>
              Stimme wählen
            </div>
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
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', padding: '3px', borderRadius: '12px', background: 'var(--color-surface-muted)', flex: '1 1 200px' }}>
              {([
                { id: 'en-GB', label: 'Britisch (UK)' },
                { id: 'en-US', label: 'Amerikanisch (US)' },
              ] as const).map(opt => {
                const active = enAccent === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setEnglishAccent(opt.id);
                      setEnAccent(opt.id);
                    }}
                    style={{
                      height: '34px',
                      borderRadius: '9px',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: '12px',
                      fontWeight: active ? 800 : 600,
                      background: active ? 'var(--color-surface)' : 'transparent',
                      color: active ? PRIMARY : 'var(--color-text-muted)',
                      boxShadow: active ? '0 2px 6px rgba(23,20,58,0.08)' : 'none',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                setVoiceTestError('');
                speakText('Good morning! Let us practise vocabulary together.', 'Englisch', () => {
                  setVoiceTestError(getLastTtsError() || 'Sprachausgabe fehlgeschlagen.');
                }, { voice: studioVoice, accent: enAccent });
              }}
              style={{
                height: '38px',
                padding: '0 0.9rem',
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
              <Volume2 size={14} /> Test EN
            </button>

            <button
              type="button"
              onClick={() => {
                setVoiceTestError('');
                speakText('Guten Morgen, lass uns gemeinsam Vokabeln üben.', 'Deutsch', () => {
                  setVoiceTestError(getLastTtsError() || 'Sprachausgabe fehlgeschlagen.');
                }, { voice: studioVoice, accent: enAccent });
              }}
              style={{
                height: '38px',
                padding: '0 0.85rem',
                borderRadius: '999px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-hover)',
                color: 'var(--color-text)',
                fontSize: '12.5px',
                fontWeight: 700,
                fontFamily: 'inherit',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: 'pointer',
              }}
            >
              <Volume2 size={14} /> Test DE
            </button>
          </div>

          {voiceTestError && (
            <div style={{ padding: '0.6rem 0.8rem', borderRadius: '12px', background: '#FDE8EF', color: PINK_TEXT, fontSize: '12.5px', fontWeight: 700 }}>
              {voiceTestError}
            </div>
          )}
        </div>
      )}

      {message && !manageOpen && (
        <div
          role="status"
          style={{
            padding: '0.7rem 0.95rem',
            borderRadius: '14px',
            background: '#E3F6EF',
            color: GREEN_TEXT,
            fontSize: 'var(--font-sm)',
            fontWeight: 700,
          }}
        >
          {message}
        </div>
      )}

      {/* Manual Add to Pool Form */}
      {manageOpen && !user?.isChild && (
        <form onSubmit={handleAddManualEntries} style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h2 style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--font-lg)', fontWeight: 800 }}>
            Vokabeln zum Pool hinzufügen
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: '0.55rem' }}>
            <input
              className="input-field"
              value={languageFrom}
              onChange={event => setLanguageFrom(event.target.value)}
              placeholder="Fremdsprache"
              maxLength={40}
              aria-label="Fremdsprache"
            />
            <input
              className="input-field"
              value={languageTo}
              onChange={event => setLanguageTo(event.target.value)}
              placeholder="Übersetzung"
              maxLength={40}
              aria-label="Übersetzung"
            />
            <input
              type="date"
              className="input-field"
              value={examDate}
              onChange={event => setExamDate(event.target.value)}
              aria-label="Klassenarbeit-Datum (optional)"
              title="Optionales Klassenarbeits-Datum"
            />
          </div>
          <textarea
            className="input-field"
            value={pairsText}
            onChange={event => setPairsText(event.target.value)}
            placeholder={'Ein Wortpaar pro Zeile, getrennt durch Tab, ; oder |\napple;Apfel\nquiet;ruhig, leise'}
            rows={5}
            style={{ resize: 'vertical', lineHeight: 1.5 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.7rem', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)' }}>
              {manualPairCount} Wortpaare erkannt · landen direkt im Vokabel-Pool
            </span>
            <button type="submit" className="btn btn-primary" style={{ borderRadius: '999px' }} disabled={manualPairCount === 0 && examDate === (pool.examDate || '')}>
              In den Pool übernehmen
            </button>
          </div>
          {message && <p style={{ margin: 0, color: PINK_TEXT, fontSize: 'var(--font-sm)', fontWeight: 700 }}>{message}</p>}
        </form>
      )}

      {/* 3 Gamified 3D Arena Navigation Tabs: Lernen · Schatzkammer · Abzeichen */}
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
              id: 'learn',
              label: 'Lernen',
              imgSrc: '/vocab-game/swords-quest.png',
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
              <span style={{ lineHeight: 1.1, letterSpacing: '0.01em' }}>{tab.label}</span>
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
                    boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ================= TAB 1: LERNEN (HUD + EIN VOKABEL-POOL) ================= */}
      {activeTab === 'learn' && (
        <>
          <VocabTreasureHud
            profile={viewedProfile}
            settings={gamState.settings}
            childLabel={viewedUserId || 'Lernprofil'}
            hardWordCount={poolStats.totalHard}
            onOpenChest={chest => setActiveChest(chest)}
            onOpenTreasury={() => setActiveTab('treasury')}
            onStartQuestAction={action => startQuiz({ modePref: 'smart', onlyHard: action === 'hard' })}
          />

          {poolStats.totalWords === 0 ? (
            <div style={{ ...CARD, padding: '2.2rem 1.25rem', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
                <img src="/vocab-game/hero-owl.png" alt="Vokabel-Eule" style={{ width: '88px', height: '88px', objectFit: 'contain' }} />
              </div>
              <h2 style={{ color: 'var(--color-text)', margin: '0 0 0.35rem', fontSize: 'var(--font-lg)', fontWeight: 900 }}>
                Der Vokabel-Pool ist noch leer
              </h2>
              <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: 'var(--font-sm)' }}>
                {user?.isChild
                  ? 'Sobald deine Eltern die ersten Vokabeln eingetragen haben, kannst du loslegen und Diamanten sammeln!'
                  : 'Fotografiere eine Vokabelseite ab oder füge Wörter manuell in den Pool ein.'}
              </p>
            </div>
          ) : (
            <article
              style={{
                position: 'relative',
                overflow: 'hidden',
                padding: '1.15rem 1.2rem',
                borderRadius: '26px',
                background: 'linear-gradient(155deg, #17153B 0%, #2A2063 55%, #3C2474 100%)',
                border: '2px solid rgba(167, 139, 250, 0.35)',
                boxShadow: '0 14px 32px rgba(23, 21, 59, 0.34)',
                color: '#FFFFFF',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.95rem',
              }}
            >
              {/* Decorative Glow */}
              <div
                style={{
                  position: 'absolute',
                  top: '-45px',
                  right: '-30px',
                  width: '160px',
                  height: '160px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(99, 102, 241, 0.28) 0%, transparent 70%)',
                  pointerEvents: 'none',
                }}
              />

              {/* Pool Header */}
              <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
                  <img
                    src="/vocab-game/swords-quest.png"
                    alt="Lern-Arena"
                    style={{ width: '44px', height: '44px', objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.45))' }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '10.5px', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#FEF08A' }}>
                      Lern-Arena
                    </div>
                    <h2 style={{ margin: '0.08rem 0 0', fontSize: '1.18rem', fontWeight: 900, color: '#FFFFFF' }}>
                      Vokabel-Pool ({poolStats.totalWords} Wörter)
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                      <span
                        style={{
                          padding: '2px 10px',
                          borderRadius: '999px',
                          background: 'rgba(129, 140, 248, 0.28)',
                          border: '1px solid rgba(165, 180, 252, 0.4)',
                          color: '#E0E7FF',
                          fontSize: '11.5px',
                          fontWeight: 800,
                        }}
                      >
                        {pool.languageFrom} → {pool.languageTo}
                      </span>
                      {poolStats.daysLeft !== null && poolStats.daysLeft >= 0 && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '2px 9px',
                            borderRadius: '999px',
                            background: poolStats.daysLeft <= 2 ? 'rgba(244, 63, 94, 0.28)' : 'rgba(250, 204, 21, 0.22)',
                            border: poolStats.daysLeft <= 2 ? '1px solid #FB7185' : '1px solid #FDE047',
                            color: '#FFFFFF',
                            fontSize: '11.5px',
                            fontWeight: 800,
                          }}
                        >
                          <CalendarDays size={11} />
                          {poolStats.daysLeft === 0
                            ? 'Test heute'
                            : poolStats.daysLeft === 1
                              ? 'Test morgen'
                              : `Test in ${poolStats.daysLeft} Tagen`}
                          {poolStats.pacePerDay ? ` · ca. ${poolStats.pacePerDay}/Tag` : ' · sitzt!'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Overall Pool Mastery Bar */}
              <div
                style={{
                  position: 'relative',
                  zIndex: 2,
                  padding: '0.7rem 0.85rem',
                  borderRadius: '16px',
                  background: 'rgba(15, 23, 42, 0.45)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 700, color: '#CBD5E1', marginBottom: '0.4rem' }}>
                  <span>
                    <strong style={{ color: '#6EE7B7' }}>{poolStats.totalMastered} sicher</strong> · {poolStats.totalDue} fällig
                    {poolStats.totalHard > 0 ? ` · ${poolStats.totalHard} schwer` : ''}
                  </span>
                  <span style={{ fontWeight: 900, color: '#FEF08A', fontVariantNumeric: 'tabular-nums' }}>{totalMasteryPct}%</span>
                </div>
                <div style={{ height: 11, borderRadius: 99, background: 'rgba(255,255,255,0.12)', overflow: 'hidden', padding: '1px' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${totalMasteryPct}%`,
                      borderRadius: 99,
                      background: totalMasteryPct === 100 ? 'linear-gradient(90deg, #34D399, #10B981)' : 'linear-gradient(90deg, #38BDF8, #A855F7, #FACC15)',
                      boxShadow: '0 0 10px rgba(168, 85, 247, 0.55)',
                      transition: 'width 260ms ease',
                    }}
                  />
                </div>
              </div>

              {/* 3D Gaming CTA + Boss Fight */}
              <div style={{ position: 'relative', zIndex: 2, display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => startQuiz({ modePref: 'smart', onlyHard: false })}
                  style={{
                    flex: '1 1 190px',
                    height: '54px',
                    borderRadius: '16px',
                    border: '2px solid #6EE7B7',
                    background: 'linear-gradient(180deg, #34D399 0%, #059669 100%)',
                    color: '#022C22',
                    fontSize: '15px',
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
                  <Sparkles size={18} /> {poolStats.totalDue > 0 ? `ABENTEUER STARTEN (${poolStats.totalDue})` : 'ABENTEUER STARTEN'}
                </button>

                {poolStats.totalHard > 0 && (
                  <button
                    type="button"
                    onClick={() => startQuiz({ modePref: 'smart', onlyHard: true })}
                    style={{
                      height: '54px',
                      padding: '0 1rem 0 0.6rem',
                      borderRadius: '16px',
                      border: '2px solid #F9A8D4',
                      background: 'linear-gradient(180deg, #EC4899 0%, #BE185D 100%)',
                      color: '#FFFFFF',
                      fontSize: '13.5px',
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
                    BOSS ({poolStats.totalHard})
                  </button>
                )}
              </div>

              {/* 4 Dark Neon 3D Mode Tiles */}
              <div style={{ position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.45rem' }}>
                {[
                  {
                    label: 'Karten',
                    icon: Layers,
                    bg: 'rgba(99, 102, 241, 0.25)',
                    border: 'rgba(165, 180, 252, 0.5)',
                    shadow: '#312E81',
                    color: '#E0E7FF',
                    disabled: poolStats.totalWords === 0,
                    onClick: () => setActivity({ kind: 'flashcards', onlyHard: false }),
                  },
                  {
                    label: 'Match',
                    icon: Grid2x2,
                    bg: 'rgba(245, 158, 11, 0.24)',
                    border: 'rgba(253, 224, 71, 0.55)',
                    shadow: '#92400E',
                    color: '#FEF08A',
                    disabled: poolStats.totalWords < 2,
                    onClick: () => setActivity({ kind: 'match', onlyHard: false }),
                  },
                  {
                    label: 'Anhören',
                    icon: Headphones,
                    bg: 'rgba(14, 165, 233, 0.24)',
                    border: 'rgba(125, 211, 252, 0.55)',
                    shadow: '#075985',
                    color: '#BAE6FD',
                    disabled: poolStats.totalWords === 0,
                    onClick: () => setActivity({ kind: 'audio', onlyHard: false }),
                  },
                  {
                    label: 'Wörter',
                    icon: List,
                    bg: 'rgba(192, 132, 252, 0.22)',
                    border: 'rgba(216, 180, 254, 0.5)',
                    shadow: '#581C87',
                    color: '#F3E8FF',
                    disabled: false,
                    onClick: () => setWordListOpen(true),
                  },
                ].map(btn => (
                  <button
                    key={btn.label}
                    type="button"
                    disabled={btn.disabled}
                    onClick={btn.onClick}
                    style={{
                      minHeight: '64px',
                      padding: '0.5rem 0.25rem',
                      borderRadius: '16px',
                      border: `1.5px solid ${btn.border}`,
                      background: btn.bg,
                      color: btn.color,
                      fontSize: '11.5px',
                      fontWeight: 900,
                      fontFamily: 'inherit',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.32rem',
                      cursor: btn.disabled ? 'default' : 'pointer',
                      opacity: btn.disabled ? 0.4 : 1,
                      boxShadow: btn.disabled ? 'none' : `0 4px 0 ${btn.shadow}`,
                    }}
                  >
                    <btn.icon size={19} />
                    <span style={{ lineHeight: 1.1, whiteSpace: 'nowrap' }}>{btn.label}</span>
                  </button>
                ))}
              </div>
            </article>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)', textAlign: 'center', marginTop: '0.15rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Clock3 size={13} /> Gewusste Wörter kommen später wieder (1 → 3 → 7 → 14 Tage), schwierige nach 10 Min.
            </span>
          </div>
        </>
      )}

      {/* ================= TAB 2: SCHATZKAMMER ================= */}
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

      {/* ================= TAB 3: ABZEICHEN & RÄNGE ================= */}
      {activeTab === 'badges' && <VocabBadgesView profile={viewedProfile} />}

      {/* Modals */}
      {!user?.isChild && user && (
        <VocabCameraScanner
          isOpen={scannerOpen}
          existingSets={[pool]}
          userId={user.id}
          onClose={() => setScannerOpen(false)}
          onSaved={handleScannerSaved}
        />
      )}

      <VocabWordListSheet
        set={wordListOpen ? pool : null}
        userId={viewedUserId}
        canEdit={!user?.isChild}
        onSaveSet={updated => mockDb.saveVocabularyPool(updated)}
        onClose={() => setWordListOpen(false)}
      />

      {chestOverlay}
    </section>
  );
};
