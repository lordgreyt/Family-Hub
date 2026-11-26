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
  Trash2,
  Turtle,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';
import type { VocabularyEntry, VocabularyLearnMode, VocabularySet } from '../services/mockDb';
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
} from './speech';
import type { EnglishAccent, OpenAiVoice, TtsStatus } from './speech';
import { HubIcon } from '../components/HubIcon';
import { VocabCameraScanner } from '../components/Vocabulary/VocabCameraScanner';
import { VocabAudioPlayer } from '../components/Vocabulary/VocabAudioPlayer';
import { VocabFlashcards } from '../components/Vocabulary/VocabFlashcards';
import { VocabMatchGame } from '../components/Vocabulary/VocabMatchGame';
import { VocabWordListSheet } from '../components/Vocabulary/VocabWordListSheet';
import { CARD, GREEN_TEXT, HERO_GRADIENT, PINK_TEXT, PRIMARY } from '../components/SurgeryFinance/theme';

type LearnMode = VocabularyLearnMode;
type QuizModePreference = 'smart' | 'choice' | 'type' | 'dictation';
type ActiveActivity =
  | { kind: 'quiz'; setId: string; modePref: QuizModePreference; onlyHard: boolean }
  | { kind: 'flashcards'; setId: string; onlyHard: boolean }
  | { kind: 'match'; setId: string; onlyHard: boolean }
  | { kind: 'audio'; setId: string; onlyHard: boolean };

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

function optionStyle(state: 'idle' | 'correct' | 'wrong') {
  const base = {
    minHeight: 54,
    width: '100%',
    borderRadius: '16px',
    border: '1.5px solid var(--color-border)',
    background: 'var(--color-surface-hover)',
    color: 'var(--color-text)',
    fontSize: 'clamp(0.98rem, 3.6vw, 1.12rem)',
    fontWeight: 700,
    padding: '0.7rem 0.95rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 140ms ease, border-color 140ms ease, transform 120ms ease',
  } as const;
  if (state === 'correct') return { ...base, background: '#1E9A78', borderColor: '#1E9A78', color: 'white' };
  if (state === 'wrong') return { ...base, background: '#D4416E', borderColor: '#D4416E', color: 'white' };
  return base;
}

const chipWhite = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  padding: '0.34rem 0.72rem',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.2)',
  color: '#FFFFFF',
  fontSize: 'var(--font-xs)',
  fontWeight: 700,
  lineHeight: 1.3,
} as const;

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
  const [ttsBroken, setTtsBroken] = useState(false);
  const answerRef = useRef(onAnswer);
  answerRef.current = onAnswer;

  const listening = mode === 'audio' || mode === 'dictation';
  const ttsAvailable = canSpeak() && !ttsBroken;
  const acceptedAnswers = answerVariants(answer);
  const spokenText = speechText(mode === 'dictation' ? answer : prompt);
  const spokenLanguage = mode === 'dictation' ? answerLanguage : promptLanguage;
  const foreignAnswerText = !isGermanLanguage(answerLanguage) ? speechText(answer) : '';

  const playAudio = (slow = false) => {
    if (!ttsAvailable) return;
    if (listening && plays >= 5) return;
    if (
      speakText(spokenText, spokenLanguage, () => setTtsBroken(true), {
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
      if (speakText(spokenText, spokenLanguage, () => setTtsBroken(true), { rate: SPEECH_RATE_NORMAL })) {
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
    <div style={{ ...CARD, padding: 'clamp(1.1rem, 3.5vw, 1.6rem)', display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
      {/* Top Row: Mode badge + Hint */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.28rem 0.7rem',
            borderRadius: 999,
            background: '#ECE8FF',
            color: PRIMARY,
            fontSize: 'var(--font-xs)',
            fontWeight: 800,
          }}
        >
          {mode === 'choice' ? <ListChecks size={14} /> : mode === 'type' ? <Keyboard size={14} /> : <Ear size={14} />}
          {MODE_LABEL[mode]}
        </span>
        <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
          {MODE_HINT[mode]}
        </span>
      </div>

      {/* Prompt Area + Universal Speech Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0', textAlign: 'center' }}>
        {listening && mode === 'audio' && ttsAvailable ? (
          <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--color-text-muted)', padding: '0.6rem 0 0.2rem' }}>
            Hör genau zu und schreibe die Übersetzung ({answerLanguage})
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
              {promptLanguage}
            </div>
            <div
              style={{
                fontSize: 'clamp(1.85rem, 7vw, 2.85rem)',
                lineHeight: 1.14,
                fontWeight: 800,
                color: 'var(--color-text)',
                marginTop: '0.25rem',
                overflowWrap: 'anywhere',
              }}
            >
              {prompt}
            </div>
          </div>
        )}

        {/* Always-available Normal & Slow Audio Buttons */}
        {ttsAvailable ? (
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.15rem' }}>
            <button
              type="button"
              onClick={() => playAudio(false)}
              disabled={listening && plays >= 5}
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
                opacity: listening && plays >= 5 ? 0.45 : 1,
              }}
            >
              <Volume2 size={16} /> {plays > 0 ? 'Nochmal hören' : 'Vorlesen'}
            </button>
            <button
              type="button"
              onClick={() => playAudio(true)}
              disabled={listening && plays >= 5}
              style={{
                height: '38px',
                padding: '0 0.8rem',
                borderRadius: '999px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-hover)',
                color: 'var(--color-text-muted)',
                fontSize: '12px',
                fontWeight: 700,
                fontFamily: 'inherit',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                cursor: 'pointer',
                opacity: listening && plays >= 5 ? 0.45 : 1,
              }}
            >
              <Turtle size={14} /> Langsam
            </button>
          </div>
        ) : (
          listening && (
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
              {getLastTtsError() || 'OpenAI Sprachausgabe aktuell nicht verfügbar – Wort steht oben.'}
            </span>
          )
        )}
      </div>

      {/* Answer Interaction */}
      {mode === 'choice' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
        <form onSubmit={submitTyped} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {hintText && result === 'idle' && (
            <div
              style={{
                padding: '0.55rem 0.85rem',
                borderRadius: '12px',
                background: '#FFF8EB',
                border: '1px solid #FAD9A5',
                color: '#9C5A14',
                textAlign: 'center',
                fontSize: '0.95rem',
                fontWeight: 800,
                letterSpacing: '0.06em',
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
            style={{ fontSize: 'clamp(1.02rem, 4vw, 1.25rem)', textAlign: 'center', fontWeight: 700, height: '50px', borderRadius: '14px' }}
          />

          {result === 'idle' && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setHintLevel(lvl => (lvl < 2 ? ((lvl + 1) as 1 | 2) : 2))}
                disabled={hintLevel >= 2}
                style={{
                  height: '48px',
                  padding: '0 0.95rem',
                  borderRadius: '999px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-hover)',
                  color: hintLevel >= 2 ? 'var(--color-text-tertiary)' : '#A85F12',
                  fontSize: '13px',
                  fontWeight: 800,
                  fontFamily: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  cursor: hintLevel >= 2 ? 'default' : 'pointer',
                  opacity: hintLevel >= 2 ? 0.55 : 1,
                }}
              >
                <Lightbulb size={15} /> {hintLevel === 0 ? 'Tipp' : hintLevel === 1 ? 'Mehr Tipp' : 'Tipp aktiv'}
              </button>
              <button
                type="submit"
                disabled={!typed.trim()}
                style={{
                  flex: 1,
                  height: '48px',
                  borderRadius: '999px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #3F34C4 0%, #6D5DF0 100%)',
                  color: '#FFFFFF',
                  fontSize: 'var(--font-base)',
                  fontWeight: 800,
                  fontFamily: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  cursor: typed.trim() ? 'pointer' : 'default',
                  opacity: typed.trim() ? 1 : 0.45,
                  boxShadow: typed.trim() ? '0 8px 20px rgba(63, 52, 196, 0.25)' : 'none',
                }}
              >
                <Check size={17} strokeWidth={2.8} /> Prüfen
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
            padding: '0.75rem 0.9rem',
            borderRadius: '14px',
            background: result === 'correct' ? '#E3F6EF' : '#FDE8EF',
            color: result === 'correct' ? GREEN_TEXT : PINK_TEXT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
            fontWeight: 700,
            fontSize: 'var(--font-sm)',
          }}
        >
          {result === 'correct' ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <CircleCheck size={18} /> Richtig!
              {acceptedAnswers.length > 1 && <span style={{ opacity: 0.85, fontWeight: 600 }}>({acceptedAnswers.join(' · ')})</span>}
            </span>
          ) : (
            <span>
              Richtig {acceptedAnswers.length > 1 ? 'sind' : 'ist'}:{' '}
              <strong style={{ color: 'var(--color-text)' }}>{acceptedAnswers.join(' · ') || answer}</strong>
            </span>
          )}

          {ttsAvailable && (
            <button
              type="button"
              onClick={() => speakText(speechText(answer), answerLanguage, undefined, { rate: SPEECH_RATE_NORMAL })}
              aria-label="Lösung vorlesen"
              title="Lösung anhören"
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(255,255,255,0.8)',
                color: PRIMARY,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Volume2 size={14} />
            </button>
          )}
        </div>
      )}

      {result === 'wrong' && (
        <button
          type="button"
          onClick={() => answerRef.current(false, mode)}
          style={{
            height: '48px',
            borderRadius: '999px',
            border: 'none',
            background: 'linear-gradient(135deg, #3F34C4 0%, #6D5DF0 100%)',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: 'var(--font-base)',
            fontFamily: 'inherit',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            cursor: 'pointer',
            boxShadow: '0 8px 20px rgba(63, 52, 196, 0.25)',
          }}
        >
          Weiter <ArrowRight size={17} />
        </button>
      )}

      {result === 'idle' && mode !== 'choice' && (
        <button
          type="button"
          onClick={() => setResult('wrong')}
          style={{
            background: 'transparent',
            border: 0,
            color: 'var(--color-text-tertiary)',
            fontSize: '12px',
            fontWeight: 600,
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
  const [sets, setSets] = useState<VocabularySet[]>([]);
  const [manageOpen, setManageOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [wordListSetId, setWordListSetId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [languageFrom, setLanguageFrom] = useState('Englisch');
  const [languageTo, setLanguageTo] = useState('Deutsch');
  const [examDate, setExamDate] = useState('');
  const [pairsText, setPairsText] = useState('');
  const [message, setMessage] = useState('');

  // Active study session
  const [activity, setActivity] = useState<ActiveActivity | null>(null);
  const [direction, setDirection] = useState<'forward' | 'reverse'>('forward');
  const [queue, setQueue] = useState<string[]>([]);
  const [requeued, setRequeued] = useState<Record<string, number>>({});
  const [sessionAnswered, setSessionAnswered] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [sessionSeq, setSessionSeq] = useState(0);
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
    if (!user || user.isChild) return;
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
    const refresh = () => setSets(mockDb.getVocabularySets());
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

  const userId = user?.id || '';

  const overviewStats = useMemo(() => {
    let totalWords = 0;
    let totalMastered = 0;
    let totalDue = 0;
    let totalHard = 0;
    let nearestExam: { title: string; days: number } | null = null;

    for (const set of sets) {
      const progress = set.progressByUser?.[userId] || {};
      totalWords += set.entries.length;
      for (const entry of set.entries) {
        const p = progress[entry.id];
        if ((p?.streak || 0) >= 2) totalMastered += 1;
        if (!p?.nextReviewAt || p.nextReviewAt <= nowMs) totalDue += 1;
        if (isHardEntry(p)) totalHard += 1;
      }
      const d = daysUntilExam(set.examDate);
      if (d !== null && d >= 0 && (!nearestExam || d < nearestExam.days)) {
        nearestExam = { title: set.title, days: d };
      }
    }
    return { totalWords, totalMastered, totalDue, totalHard, nearestExam };
  }, [sets, userId, nowMs]);

  const activeSet = activity ? sets.find(set => set.id === activity.setId) || null : null;
  const wordListSet = wordListSetId ? sets.find(set => set.id === wordListSetId) || null : null;

  const entriesForActivity = (set: VocabularySet, onlyHard: boolean): VocabularyEntry[] => {
    const progress = set.progressByUser?.[userId] || {};
    if (onlyHard) {
      const hard = set.entries.filter(entry => isHardEntry(progress[entry.id]));
      if (hard.length > 0) return hard;
    }
    return set.entries;
  };

  const startQuiz = (
    set: VocabularySet,
    options: { modePref?: QuizModePreference; onlyHard?: boolean; nextDirection?: 'forward' | 'reverse' } = {}
  ) => {
    const modePref = options.modePref ?? 'smart';
    const onlyHard = options.onlyHard ?? false;
    const nextDirection = options.nextDirection ?? direction;

    const progress = set.progressByUser?.[userId] || {};
    let pool = entriesForActivity(set, onlyHard);
    if (!onlyHard) {
      const due = pool.filter(entry => !progress[entry.id]?.nextReviewAt || progress[entry.id].nextReviewAt <= nowMs);
      if (due.length > 0) pool = due;
    }

    stopSpeaking();
    setActivity({ kind: 'quiz', setId: set.id, modePref, onlyHard });
    setDirection(nextDirection);
    setQueue(pool.map(entry => entry.id));
    setRequeued({});
    setSessionAnswered(0);
    setSessionCorrect(0);
    setSessionTotal(pool.length);
    setSessionSeq(value => value + 1);
  };

  const finishActivity = () => {
    stopSpeaking();
    setActivity(null);
    setQueue([]);
  };

  const currentEntry: VocabularyEntry | null =
    activity?.kind === 'quiz' && activeSet && queue.length
      ? activeSet.entries.find(entry => entry.id === queue[0]) || null
      : null;

  const sessionPercent = sessionTotal ? Math.min(100, Math.round((sessionAnswered / sessionTotal) * 100)) : 0;
  const promptLanguage = direction === 'forward' ? activeSet?.languageFrom || '' : activeSet?.languageTo || '';
  const answerLanguage = direction === 'forward' ? activeSet?.languageTo || '' : activeSet?.languageFrom || '';
  const prompt = currentEntry ? (direction === 'forward' ? currentEntry.front : currentEntry.back) : '';
  const answer = currentEntry ? (direction === 'forward' ? currentEntry.back : currentEntry.front) : '';
  const currentProgress = activeSet && currentEntry ? activeSet.progressByUser?.[userId]?.[currentEntry.id] : undefined;

  const learnMode: LearnMode = (() => {
    if (!currentEntry || !activeSet || activity?.kind !== 'quiz') return 'choice';
    const canChoose = activeSet.entries.length > 1;
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
    currentEntry && activeSet && learnMode === 'choice'
      ? buildChoiceOptions(
          currentEntry,
          activeSet.entries,
          direction === 'forward' ? entry => entry.back : entry => entry.front,
          `${currentEntry.id}:${sessionSeq}`
        )
      : [];

  const answerCard = (correct: boolean, answeredMode: LearnMode) => {
    if (!activeSet || !currentEntry || !user) return;
    mockDb.recordVocabularyAnswer(activeSet.id, user.id, currentEntry.id, correct, answeredMode);
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

  const handleCreateSet = (event: FormEvent) => {
    event.preventDefault();
    if (!user || user.isChild) return;
    const pairs = parsePairs(pairsText);
    if (!title.trim() || pairs.length === 0) {
      setMessage('Bitte Titel und mindestens ein gültiges Wortpaar eintragen.');
      return;
    }
    const uniquePairs = pairs.filter(
      (pair, index) =>
        pairs.findIndex(
          other =>
            other.front.toLocaleLowerCase() === pair.front.toLocaleLowerCase() &&
            other.back.toLocaleLowerCase() === pair.back.toLocaleLowerCase()
        ) === index
    );
    const now = Date.now();
    mockDb.saveVocabularySet({
      id: createId(),
      title: title.trim(),
      languageFrom: languageFrom.trim() || 'Sprache 1',
      languageTo: languageTo.trim() || 'Sprache 2',
      entries: uniquePairs.map(pair => ({ id: createId(), ...pair })),
      createdAt: now,
      updatedAt: now,
      createdBy: user.id,
      source: 'Manuell',
      ...(examDate ? { examDate } : {}),
      progressByUser: {},
    });
    setTitle('');
    setExamDate('');
    setPairsText('');
    setMessage(`${uniquePairs.length} Vokabeln gespeichert.`);
    setManageOpen(false);
    window.setTimeout(() => setMessage(''), 3500);
  };

  const handleDeleteSet = (set: VocabularySet) => {
    if (window.confirm(`Lernset „${set.title}“ mit ${set.entries.length} Vokabeln wirklich löschen?`)) {
      mockDb.deleteVocabularySet(set.id);
      if (activity?.setId === set.id) finishActivity();
      if (wordListSetId === set.id) setWordListSetId(null);
    }
  };

  const handleScannerSaved = (savedSet: VocabularySet, summary: string) => {
    mockDb.saveVocabularySet(savedSet);
    setMessage(summary);
    window.setTimeout(() => setMessage(''), 4500);
  };

  // --- Active Learning Sub-Views ---
  if (activity && activeSet) {
    if (activity.kind === 'audio') {
      return (
        <VocabAudioPlayer
          set={activeSet}
          entries={entriesForActivity(activeSet, activity.onlyHard)}
          onClose={finishActivity}
        />
      );
    }

    if (activity.kind === 'flashcards') {
      return (
        <VocabFlashcards
          set={activeSet}
          entries={entriesForActivity(activeSet, activity.onlyHard)}
          userName={user?.id || ''}
          autoSpeak={autoSpeak}
          onToggleAutoSpeak={toggleAutoSpeak}
          onRate={(entryId, known) => {
            if (user) mockDb.recordVocabularyAnswer(activeSet.id, user.id, entryId, known, 'choice');
          }}
          onClose={finishActivity}
        />
      );
    }

    if (activity.kind === 'match') {
      return (
        <VocabMatchGame
          set={activeSet}
          entries={entriesForActivity(activeSet, activity.onlyHard)}
          userName={user?.id || ''}
          autoSpeak={autoSpeak}
          onToggleAutoSpeak={toggleAutoSpeak}
          onPairResult={(entryId, correct) => {
            if (user) mockDb.recordVocabularyAnswer(activeSet.id, user.id, entryId, correct, 'choice');
          }}
          onClose={finishActivity}
        />
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
      <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 680, margin: '0 auto', paddingBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={finishActivity}
            style={{
              height: '40px',
              padding: '0 0.9rem',
              borderRadius: '999px',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              fontWeight: 700,
              fontSize: 'var(--font-sm)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <ChevronLeft size={17} /> Zurück
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {canSpeak() && (
              <button
                type="button"
                onClick={toggleAutoSpeak}
                style={{
                  height: '38px',
                  padding: '0 0.75rem',
                  borderRadius: '999px',
                  border: 'none',
                  background: autoSpeak ? '#ECE8FF' : 'var(--color-surface-muted)',
                  color: autoSpeak ? PRIMARY : 'var(--color-text-muted)',
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
                startQuiz(activeSet, {
                  modePref: activity.modePref,
                  onlyHard: activity.onlyHard,
                  nextDirection: direction === 'forward' ? 'reverse' : 'forward',
                })
              }
              title="Abfragerichtung wechseln"
              style={{
                height: '38px',
                padding: '0 0.85rem',
                borderRadius: '999px',
                border: 'none',
                background: '#ECE8FF',
                color: PRIMARY,
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
                ? `${activeSet.languageFrom} → ${activeSet.languageTo}`
                : `${activeSet.languageTo} → ${activeSet.languageFrom}`}
            </button>
          </div>
        </div>

        {/* Session Card + Live Mode Switcher */}
        <div style={{ ...CARD, padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.6rem' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: PRIMARY }}>
                {activity.onlyHard ? 'Problemwörter-Training' : 'Vokabeltraining'}
              </div>
              <h2 style={{ margin: '0.12rem 0 0', fontSize: 'var(--font-lg)', fontWeight: 800, overflowWrap: 'anywhere' }}>
                {activeSet.title}
              </h2>
            </div>
            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 800, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
              {completed ? `${sessionCorrect}/${sessionAnswered} richtig` : `${Math.min(sessionAnswered + 1, sessionTotal)} / ${sessionTotal}`}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', padding: '3px', borderRadius: '12px', background: 'var(--color-surface-muted)' }}>
            {modeOptions.map(opt => {
              const active = activity.modePref === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setActivity({ ...activity, modePref: opt.id })}
                  style={{
                    height: '32px',
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

          <div style={{ height: 7, borderRadius: 99, background: 'var(--color-surface-muted)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${sessionPercent}%`, background: HERO_GRADIENT, transition: 'width 180ms ease' }} />
          </div>
        </div>

        {completed ? (
          <div style={{ ...CARD, textAlign: 'center', padding: '2rem 1.25rem' }}>
            <div style={{ width: 58, height: 58, borderRadius: '50%', margin: '0 auto 0.8rem', background: '#E3F6EF', color: GREEN_TEXT, display: 'grid', placeItems: 'center' }}>
              <Sparkles size={28} />
            </div>
            <h2 style={{ margin: '0 0 0.4rem', fontWeight: 800 }}>Gut gemacht, {user?.id}!</h2>
            <p style={{ margin: '0 0 1.2rem', color: 'var(--color-text-muted)' }}>
              {sessionCorrect} von {sessionAnswered} Antworten richtig.
            </p>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => startQuiz(activeSet, { modePref: activity.modePref, onlyHard: activity.onlyHard })}
                className="btn btn-primary"
                style={{ borderRadius: '999px', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <RotateCcw size={16} /> Nochmal üben
              </button>
              <button type="button" onClick={finishActivity} className="btn btn-secondary" style={{ borderRadius: '999px' }}>
                Fertig
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
            <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Dieses Lernset enthält noch keine Vokabeln.</p>
            <button type="button" onClick={finishActivity} className="btn btn-secondary" style={{ marginTop: '1rem', borderRadius: '999px' }}>
              Zur Übersicht
            </button>
          </div>
        )}
      </section>
    );
  }

  // --- Main Overview Page (Modern Family Hub Design) ---
  const manualPairCount = parsePairs(pairsText).length;
  const totalMasteryPct =
    overviewStats.totalWords > 0
      ? Math.round((overviewStats.totalMastered / overviewStats.totalWords) * 100)
      : 0;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 780, margin: '0 auto', paddingBottom: '2rem' }}>
      {/* Hero Card */}
      <div
        style={{
          background: HERO_GRADIENT,
          borderRadius: 'var(--radius-xl)',
          padding: '1.35rem 1.25rem',
          color: '#FFFFFF',
          boxShadow: '0 12px 28px rgba(63, 52, 196, 0.28)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', minWidth: 0 }}>
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
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 'var(--font-lg)', fontWeight: 800, lineHeight: 1.15 }}>Vokabeltraining</div>
              <div style={{ fontSize: 'var(--font-xs)', opacity: 0.86, fontWeight: 600 }}>
                Vorlesen · Karteikarten · Match · Schreiben
              </div>
            </div>
          </div>

          {canSpeak() && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
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

        <div style={{ marginTop: '1.1rem', fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', opacity: 0.85 }}>
          HEUTE FÄLLIG
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.15rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>
            {overviewStats.totalDue}
          </span>
          <span style={{ fontSize: 'var(--font-sm)', fontWeight: 700, opacity: 0.86 }}>
            {overviewStats.totalWords === 0
              ? 'Noch keine Vokabeln angelegt'
              : overviewStats.totalDue === 0
                ? 'Alle Vokabeln auf dem aktuellen Stand!'
                : `von ${overviewStats.totalWords} Vokabeln · ${totalMasteryPct}% sicher`}
          </span>
        </div>

        {/* Status Chips */}
        <div style={{ marginTop: '0.85rem', display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
          <span style={chipWhite}>
            <Sparkles size={13} /> {overviewStats.totalMastered} sicher
          </span>
          {overviewStats.totalHard > 0 && (
            <span style={chipWhite}>
              <Flame size={13} /> {overviewStats.totalHard} schwer
            </span>
          )}
          {overviewStats.nearestExam && (
            <span style={{ ...chipWhite, background: 'rgba(255,255,255,0.28)' }}>
              <CalendarDays size={13} />
              {overviewStats.nearestExam.days === 0
                ? `Test heute: ${overviewStats.nearestExam.title}`
                : overviewStats.nearestExam.days === 1
                  ? `Test morgen: ${overviewStats.nearestExam.title}`
                  : `Test in ${overviewStats.nearestExam.days} Tagen`}
            </span>
          )}
        </div>

        {/* Adult Action Buttons */}
        {!user?.isChild && (
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
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

          {!user?.isChild && ttsStatus && !ttsStatus.configured && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.7rem', padding: '0.7rem 0.85rem', borderRadius: '14px', background: '#F4F1FF', border: '1px solid #C7B6F7', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#17143A', flex: '1 1 180px' }}>
                Noch kein OpenAI Sprach-Key hinterlegt.
              </span>
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
            </div>
          )}

          {/* OpenAI Studio Voices */}
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

          {/* UK vs US Accent + Test Buttons */}
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

      {/* Manual Create Form */}
      {manageOpen && !user?.isChild && (
        <form onSubmit={handleCreateSet} style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h2 style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--font-lg)', fontWeight: 800 }}>
            Lernset manuell anlegen
          </h2>
          <input
            className="input-field"
            value={title}
            onChange={event => setTitle(event.target.value)}
            placeholder="Titel, z. B. Englisch – Unit 4"
            maxLength={120}
            required
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: '0.55rem' }}>
            <input
              className="input-field"
              value={languageFrom}
              onChange={event => setLanguageFrom(event.target.value)}
              placeholder="Ausgangssprache"
              maxLength={40}
              aria-label="Ausgangssprache"
            />
            <input
              className="input-field"
              value={languageTo}
              onChange={event => setLanguageTo(event.target.value)}
              placeholder="Zielsprache"
              maxLength={40}
              aria-label="Zielsprache"
            />
            <input
              type="date"
              className="input-field"
              value={examDate}
              onChange={event => setExamDate(event.target.value)}
              aria-label="Klassenarbeit-Datum (optional)"
              title="Optionales Test-Datum"
            />
          </div>
          <textarea
            className="input-field"
            value={pairsText}
            onChange={event => setPairsText(event.target.value)}
            placeholder={'Ein Wortpaar pro Zeile, getrennt durch Tab, ; oder |\napple;Apfel\nquiet;ruhig'}
            rows={5}
            style={{ resize: 'vertical', lineHeight: 1.5 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.7rem', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)' }}>
              {manualPairCount} Wortpaare erkannt · mehrere Übersetzungen mit Komma trennen
            </span>
            <button type="submit" className="btn btn-primary" style={{ borderRadius: '999px' }} disabled={!title.trim() || manualPairCount === 0}>
              Lernset speichern
            </button>
          </div>
          {message && <p style={{ margin: 0, color: PINK_TEXT, fontSize: 'var(--font-sm)', fontWeight: 700 }}>{message}</p>}
        </form>
      )}

      {/* Sets List */}
      {sets.length === 0 ? (
        <div style={{ ...CARD, padding: '2.2rem 1.25rem', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
            <HubIcon name="vocab" size={56} />
          </div>
          <h2 style={{ color: 'var(--color-text)', margin: '0 0 0.35rem', fontSize: 'var(--font-lg)', fontWeight: 800 }}>
            Noch keine Vokabeln
          </h2>
          <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: 'var(--font-sm)' }}>
            {user?.isChild
              ? 'Sobald deine Eltern die erste Vokabelseite eingetragen haben, kannst du hier loslegen.'
              : 'Fotografiere eine Vokabelseite ab oder lege dein erstes Lernset manuell an.'}
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.15rem' }}>
            <h2 style={{ margin: 0, fontSize: 'var(--font-base)', fontWeight: 800 }}>Lernsets</h2>
            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-text-muted)' }}>
              {sets.length} {sets.length === 1 ? 'Set' : 'Sets'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {sets.map(set => {
              const progress = set.progressByUser?.[userId] || {};
              const total = set.entries.length;
              const learned = set.entries.filter(entry => (progress[entry.id]?.streak || 0) >= 2).length;
              const due = set.entries.filter(entry => !progress[entry.id]?.nextReviewAt || progress[entry.id].nextReviewAt <= nowMs).length;
              const hardCount = set.entries.filter(entry => isHardEntry(progress[entry.id])).length;
              const masteryPct = total > 0 ? Math.round((learned / total) * 100) : 0;

              const daysLeft = daysUntilExam(set.examDate);
              const pacePerDay = dailyExamTarget(Math.max(0, total - learned), daysLeft);

              return (
                <article key={set.id} style={{ ...CARD, padding: '1.05rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {/* Header row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.6rem' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800, color: 'var(--color-text)', overflowWrap: 'anywhere' }}>
                        {set.title}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '999px', background: '#ECE8FF', color: PRIMARY, fontSize: '11px', fontWeight: 800 }}>
                          {set.languageFrom} → {set.languageTo}
                        </span>
                        {daysLeft !== null && daysLeft >= 0 && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              background: daysLeft <= 2 ? '#FDE8EF' : '#FFF4E0',
                              color: daysLeft <= 2 ? PINK_TEXT : '#A85F12',
                              fontSize: '11px',
                              fontWeight: 800,
                            }}
                          >
                            <CalendarDays size={11} />
                            {daysLeft === 0 ? 'Test heute' : daysLeft === 1 ? 'Test morgen' : `Test in ${daysLeft} T.`}
                            {pacePerDay ? ` · ca. ${pacePerDay}/Tag` : ' · sitzt!'}
                          </span>
                        )}
                      </div>
                    </div>
                    {!user?.isChild && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSet(set)}
                        aria-label={`Lernset ${set.title} löschen`}
                        title="Lernset löschen"
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          border: 'none',
                          background: 'var(--color-surface-hover)',
                          color: 'var(--color-text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  {/* Progress bar + stats */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>
                      <span>
                        {total} Vokabeln · <strong style={{ color: GREEN_TEXT }}>{learned} sicher</strong> · {due} fällig
                      </span>
                      <span style={{ fontWeight: 800, color: PRIMARY, fontVariantNumeric: 'tabular-nums' }}>{masteryPct}%</span>
                    </div>
                    <div style={{ height: 7, borderRadius: 99, background: 'var(--color-surface-muted)', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${masteryPct}%`,
                          borderRadius: 99,
                          background: masteryPct === 100 ? 'linear-gradient(90deg, #1E9A78, #4FC3A1)' : HERO_GRADIENT,
                          transition: 'width 260ms ease',
                        }}
                      />
                    </div>
                  </div>

                  {/* Primary CTA + Problem Words */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => startQuiz(set, { modePref: 'smart', onlyHard: false })}
                      disabled={!total}
                      style={{
                        flex: '1 1 160px',
                        height: '44px',
                        borderRadius: '999px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #3F34C4 0%, #6D5DF0 100%)',
                        color: '#FFFFFF',
                        fontSize: '13.5px',
                        fontWeight: 800,
                        fontFamily: 'inherit',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        cursor: total ? 'pointer' : 'default',
                        boxShadow: '0 6px 16px rgba(63, 52, 196, 0.24)',
                        opacity: total ? 1 : 0.45,
                      }}
                    >
                      <Sparkles size={15} /> {due > 0 ? `Jetzt üben (${due})` : 'Nochmal üben'}
                    </button>

                    {hardCount > 0 && (
                      <button
                        type="button"
                        onClick={() => startQuiz(set, { modePref: 'smart', onlyHard: true })}
                        style={{
                          height: '44px',
                          padding: '0 0.9rem',
                          borderRadius: '999px',
                          border: '1.5px solid #F2A9BE',
                          background: '#FDE8EF',
                          color: PINK_TEXT,
                          fontSize: '12.5px',
                          fontWeight: 800,
                          fontFamily: 'inherit',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          cursor: 'pointer',
                        }}
                      >
                        <Flame size={14} /> Schwere ({hardCount})
                      </button>
                    )}
                  </div>

                  {/* Quick Mode Row: Flashcards · Match · Audio · Word List */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                    {[
                      {
                        label: 'Karten',
                        icon: Layers,
                        disabled: !total,
                        onClick: () => setActivity({ kind: 'flashcards', setId: set.id, onlyHard: false }),
                      },
                      {
                        label: 'Match',
                        icon: Grid2x2,
                        disabled: total < 2,
                        onClick: () => setActivity({ kind: 'match', setId: set.id, onlyHard: false }),
                      },
                      {
                        label: 'Anhören',
                        icon: Headphones,
                        disabled: !total,
                        onClick: () => setActivity({ kind: 'audio', setId: set.id, onlyHard: false }),
                      },
                      {
                        label: 'Liste',
                        icon: List,
                        disabled: false,
                        onClick: () => setWordListSetId(set.id),
                      },
                    ].map(btn => (
                      <button
                        key={btn.label}
                        type="button"
                        disabled={btn.disabled}
                        onClick={btn.onClick}
                        style={{
                          height: '38px',
                          borderRadius: '12px',
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-surface-hover)',
                          color: 'var(--color-text)',
                          fontSize: '12px',
                          fontWeight: 700,
                          fontFamily: 'inherit',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.3rem',
                          cursor: btn.disabled ? 'default' : 'pointer',
                          opacity: btn.disabled ? 0.4 : 1,
                        }}
                      >
                        <btn.icon size={14} color={PRIMARY} />
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)', textAlign: 'center', marginTop: '0.25rem' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <Clock3 size={13} /> Gewusste Wörter kommen später wieder (1 → 3 → 7 → 14 Tage), schwierige nach 10 Min.
        </span>
      </div>

      {/* Modals */}
      {!user?.isChild && user && (
        <VocabCameraScanner
          isOpen={scannerOpen}
          existingSets={sets}
          userId={user.id}
          onClose={() => setScannerOpen(false)}
          onSaved={handleScannerSaved}
        />
      )}

      <VocabWordListSheet
        set={wordListSet}
        userId={userId}
        canEdit={!user?.isChild}
        onSaveSet={updated => mockDb.saveVocabularySet(updated)}
        onClose={() => setWordListSetId(null)}
      />
    </section>
  );
};
