import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  Headphones,
  Languages,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Turtle,
  Volume2,
} from 'lucide-react';
import type { VocabularyEntry, VocabularySet } from '../../services/mockDb';
import { seededShuffle, speechText } from '../../pages/vocabularyLearn';
import { SPEECH_RATE_NORMAL, SPEECH_RATE_SLOW, canSpeak, getLastTtsError, prefetchSpeech, speakText, stopSpeaking, unlockAudio } from '../../pages/speech';
import { HERO_GRADIENT, PRIMARY, CARD } from '../SurgeryFinance/theme';

interface VocabAudioPlayerProps {
  set: VocabularySet;
  entries: VocabularyEntry[];
  onClose: () => void;
}

type Phase = 'idle' | 'prompt' | 'pause' | 'answer';

const PAUSE_OPTIONS = [
  { ms: 1500, label: '1,5 s' },
  { ms: 2500, label: '2,5 s' },
  { ms: 4000, label: '4 s' },
];

export const VocabAudioPlayer: React.FC<VocabAudioPlayerProps> = ({ set, entries, onClose }) => {
  const [direction, setDirection] = useState<'forward' | 'reverse'>('forward');
  const [slow, setSlow] = useState(false);
  const [pauseMs, setPauseMs] = useState(2500);
  const [shuffled, setShuffled] = useState(false);
  const [repeat, setRepeat] = useState(true);
  const [shuffleSeed, setShuffleSeed] = useState(1);

  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [ttsError, setTtsError] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);
  const runIdRef = useRef(0);

  const playlist = useMemo(() => {
    if (!shuffled) return entries;
    return seededShuffle(entries, `audio:${set.id}:${shuffleSeed}`);
  }, [entries, shuffled, set.id, shuffleSeed]);

  const current = playlist[index] || null;
  const promptLang = direction === 'forward' ? set.languageFrom : set.languageTo;
  const answerLang = direction === 'forward' ? set.languageTo : set.languageFrom;
  const promptText = current ? (direction === 'forward' ? current.front : current.back) : '';
  const answerText = current ? (direction === 'forward' ? current.back : current.front) : '';

  const clearTimers = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopPlayback = () => {
    runIdRef.current += 1;
    clearTimers();
    stopSpeaking();
    setPlaying(false);
    setPhase('idle');
  };

  useEffect(() => () => {
    runIdRef.current += 1;
    clearTimers();
    stopSpeaking();
  }, []);

  const speakCurrentStep = (idx: number, runId: number) => {
    const item = playlist[idx];
    if (!item || runId !== runIdRef.current) return;

    const pText = speechText(direction === 'forward' ? item.front : item.back);
    const aText = speechText(direction === 'forward' ? item.back : item.front);
    const rate = slow ? SPEECH_RATE_SLOW : SPEECH_RATE_NORMAL;

    setIndex(idx);
    setPhase('prompt');

    // Antwort und nächstes Wort still vorladen, damit nach der Denkpause kein Netzwerk-Hänger entsteht
    prefetchSpeech(aText, answerLang);
    const upcomingItem = playlist[idx + 1] || (repeat ? playlist[0] : null);
    if (upcomingItem && upcomingItem !== item) {
      prefetchSpeech(speechText(direction === 'forward' ? upcomingItem.front : upcomingItem.back), promptLang);
    }

    const startedPrompt = speakText(
      pText,
      promptLang,
      () => {
        if (runId !== runIdRef.current) return;
        setTtsError(getLastTtsError() || 'OpenAI Sprachausgabe nicht erreichbar. Bitte OpenAI API-Key unter Setup prüfen.');
        setPlaying(false);
        setPhase('idle');
      },
      {
        rate,
        onEnd: () => {
          if (runId !== runIdRef.current) return;
          setPhase('pause');
          timerRef.current = window.setTimeout(() => {
            if (runId !== runIdRef.current) return;
            setPhase('answer');
            speakText(
              aText,
              answerLang,
              () => {
                if (runId !== runIdRef.current) return;
                setTtsError(getLastTtsError() || 'OpenAI Sprachausgabe nicht erreichbar. Bitte OpenAI API-Key unter Setup prüfen.');
                setPlaying(false);
                setPhase('idle');
              },
              {
                rate,
                onEnd: () => {
                  if (runId !== runIdRef.current) return;
                  timerRef.current = window.setTimeout(() => {
                    if (runId !== runIdRef.current) return;
                    const nextIdx = idx + 1;
                    if (nextIdx < playlist.length) {
                      speakCurrentStep(nextIdx, runId);
                    } else if (repeat && playlist.length > 0) {
                      speakCurrentStep(0, runId);
                    } else {
                      setPlaying(false);
                      setPhase('idle');
                    }
                  }, 1100);
                },
              }
            );
          }, pauseMs);
        },
      }
    );

    if (!startedPrompt) {
      setTtsError(getLastTtsError() || 'OpenAI Sprachausgabe nicht verfügbar.');
      setPlaying(false);
      setPhase('idle');
    }
  };

  const startFrom = (startIdx: number) => {
    if (!playlist.length || !canSpeak()) {
      setTtsError('Audio-Wiedergabe wird in diesem Browser nicht unterstützt.');
      return;
    }
    unlockAudio();
    setTtsError(null);
    clearTimers();
    const nextRun = runIdRef.current + 1;
    runIdRef.current = nextRun;
    setPlaying(true);
    speakCurrentStep(startIdx, nextRun);
  };

  const togglePlay = () => {
    if (playing) {
      stopPlayback();
    } else {
      startFrom(index);
    }
  };

  const jumpTo = (targetIdx: number) => {
    if (!playlist.length) return;
    const bounded = (targetIdx + playlist.length) % playlist.length;
    if (playing) {
      startFrom(bounded);
    } else {
      setIndex(bounded);
      setPhase('idle');
    }
  };

  // Restart smoothly if playback settings change while playing
  useEffect(() => {
    if (!playing) return;
    startFrom(Math.min(index, Math.max(0, playlist.length - 1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction, slow, pauseMs, shuffled, shuffleSeed]);

  const ttsAvailable = canSpeak();

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 680, margin: '0 auto', paddingBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={() => {
            stopPlayback();
            onClose();
          }}
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

        <button
          type="button"
          onClick={() => setDirection(d => (d === 'forward' ? 'reverse' : 'forward'))}
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
          {promptLang} → {answerLang}
        </button>
      </div>

      {/* Hero Now-Playing Card */}
      <div
        style={{
          background: HERO_GRADIENT,
          borderRadius: 'var(--radius-xl)',
          padding: '1.4rem 1.25rem',
          color: '#FFFFFF',
          boxShadow: '0 14px 32px rgba(63, 52, 196, 0.28)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.88 }}>
            <Headphones size={14} /> Hör-Modus · {set.title}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 800, opacity: 0.9, fontVariantNumeric: 'tabular-nums' }}>
            {playlist.length ? `${index + 1} / ${playlist.length}` : '0 / 0'}
          </span>
        </div>

        {/* Active Word Display */}
        <div
          style={{
            minHeight: '148px',
            borderRadius: '20px',
            background: 'rgba(255,255,255,0.14)',
            backdropFilter: 'blur(8px)',
            padding: '1.2rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: '0.55rem',
          }}
        >
          {current ? (
            <>
              <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', opacity: 0.8 }}>
                {promptLang}
              </div>
              <div
                style={{
                  fontSize: 'clamp(1.6rem, 6vw, 2.3rem)',
                  fontWeight: 800,
                  lineHeight: 1.15,
                  opacity: phase === 'answer' ? 0.82 : 1,
                  transform: phase === 'prompt' ? 'scale(1.03)' : 'scale(1)',
                  transition: 'all 0.2s ease',
                  overflowWrap: 'anywhere',
                }}
              >
                {promptText}
              </div>

              <div
                style={{
                  marginTop: '0.35rem',
                  paddingTop: '0.55rem',
                  borderTop: '1px solid rgba(255,255,255,0.2)',
                  width: '100%',
                  opacity: phase === 'prompt' ? 0.35 : phase === 'pause' ? 0.55 : 1,
                  transition: 'opacity 0.25s ease',
                }}
              >
                <div style={{ fontSize: '10.5px', fontWeight: 700, opacity: 0.82, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {phase === 'pause' ? 'Denkpause…' : answerLang}
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: '0.15rem', overflowWrap: 'anywhere' }}>
                  {phase === 'prompt' || phase === 'pause' ? '• • •' : answerText}
                </div>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 'var(--font-sm)', opacity: 0.85 }}>Keine Vokabeln zum Anhören.</div>
          )}
        </div>

        {/* Transport Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.85rem' }}>
          <button
            type="button"
            onClick={() => {
              setShuffled(s => !s);
              setShuffleSeed(v => v + 1);
            }}
            aria-label="Zufällige Reihenfolge"
            title="Zufällige Reihenfolge"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: 'none',
              background: shuffled ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Shuffle size={17} />
          </button>

          <button
            type="button"
            onClick={() => jumpTo(index - 1)}
            aria-label="Vorherige Vokabel"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255,255,255,0.18)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <SkipBack size={20} />
          </button>

          <button
            type="button"
            onClick={togglePlay}
            disabled={!playlist.length || !ttsAvailable}
            aria-label={playing ? 'Pause' : 'Abspielen'}
            style={{
              width: '62px',
              height: '62px',
              borderRadius: '50%',
              border: 'none',
              background: '#FFFFFF',
              color: '#3F34C4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: playlist.length && ttsAvailable ? 'pointer' : 'default',
              boxShadow: '0 8px 22px rgba(23, 20, 58, 0.28)',
              opacity: playlist.length && ttsAvailable ? 1 : 0.5,
            }}
          >
            {playing ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" style={{ marginLeft: '3px' }} />}
          </button>

          <button
            type="button"
            onClick={() => jumpTo(index + 1)}
            aria-label="Nächste Vokabel"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255,255,255,0.18)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <SkipForward size={20} />
          </button>

          <button
            type="button"
            onClick={() => setRepeat(r => !r)}
            aria-label="Endlosschleife"
            title="Endlosschleife"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: 'none',
              background: repeat ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Repeat size={17} />
          </button>
        </div>

        {/* Speed & Pause Settings */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.35rem', borderTop: '1px solid rgba(255,255,255,0.18)' }}>
          <button
            type="button"
            onClick={() => setSlow(s => !s)}
            style={{
              height: '32px',
              padding: '0 0.75rem',
              borderRadius: '999px',
              border: 'none',
              background: slow ? '#FFFFFF' : 'rgba(255,255,255,0.18)',
              color: slow ? '#3F34C4' : '#FFFFFF',
              fontSize: '12px',
              fontWeight: 800,
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: 'pointer',
            }}
          >
            <Turtle size={14} /> {slow ? 'Langsam (0,72×)' : 'Normal'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, opacity: 0.8 }}>Denkpause:</span>
            {PAUSE_OPTIONS.map(opt => (
              <button
                key={opt.ms}
                type="button"
                onClick={() => setPauseMs(opt.ms)}
                style={{
                  height: '28px',
                  padding: '0 0.55rem',
                  borderRadius: '999px',
                  border: 'none',
                  background: pauseMs === opt.ms ? '#FFFFFF' : 'rgba(255,255,255,0.18)',
                  color: pauseMs === opt.ms ? '#3F34C4' : '#FFFFFF',
                  fontSize: '11px',
                  fontWeight: 800,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {ttsError && (
        <div style={{ padding: '0.75rem 1rem', borderRadius: '14px', background: '#FDE8EF', color: '#D4416E', fontSize: 'var(--font-sm)', fontWeight: 700 }}>
          {ttsError}
        </div>
      )}

      {/* Playlist Jump List */}
      <div style={{ ...CARD, padding: '0.9rem 1rem' }}>
        <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.6rem' }}>
          Wiedergabeliste ({playlist.length} Wörter)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '320px', overflowY: 'auto' }}>
          {playlist.map((entry, idx) => {
            const active = idx === index;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => startFrom(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.6rem 0.7rem',
                  borderRadius: '12px',
                  border: active ? '1.5px solid #5A4BE0' : '1px solid transparent',
                  background: active ? 'rgba(90, 75, 224, 0.09)' : 'var(--color-surface-hover)',
                  color: 'var(--color-text)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ width: '22px', fontSize: '11px', fontWeight: 800, color: active ? PRIMARY : 'var(--color-text-tertiary)', textAlign: 'center', flexShrink: 0 }}>
                  {active && playing ? <Volume2 size={14} color={PRIMARY} /> : idx + 1}
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--font-sm)', fontWeight: 700, overflowWrap: 'anywhere' }}>
                  {direction === 'forward' ? entry.front : entry.back}
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right', overflowWrap: 'anywhere' }}>
                  {direction === 'forward' ? entry.back : entry.front}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
