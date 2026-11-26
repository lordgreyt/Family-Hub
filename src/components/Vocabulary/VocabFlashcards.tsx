import React, { useEffect, useState } from 'react';
import { Check, ChevronLeft, Languages, RotateCcw, Sparkles, Turtle, Volume2, VolumeX, X } from 'lucide-react';
import type { VocabularyEntry, VocabularySet } from '../../services/mockDb';
import { speechText } from '../../pages/vocabularyLearn';
import { SPEECH_RATE_NORMAL, SPEECH_RATE_SLOW, canSpeak, speakText, stopSpeaking } from '../../pages/speech';
import { CARD, GREEN_TEXT, HERO_GRADIENT, PINK_TEXT, PRIMARY } from '../SurgeryFinance/theme';

interface VocabFlashcardsProps {
  set: VocabularySet;
  entries: VocabularyEntry[];
  userName: string;
  autoSpeak: boolean;
  onToggleAutoSpeak: () => void;
  onRate: (entryId: string, known: boolean) => void;
  onClose: () => void;
}

export const VocabFlashcards: React.FC<VocabFlashcardsProps> = ({
  set,
  entries,
  userName,
  autoSpeak,
  onToggleAutoSpeak,
  onRate,
  onClose,
}) => {
  const [direction, setDirection] = useState<'forward' | 'reverse'>('forward');
  const [queue, setQueue] = useState<string[]>(() => entries.map(e => e.id));
  const [requeued, setRequeued] = useState<Record<string, number>>({});
  const [flipped, setFlipped] = useState(false);
  const [knownCount, setKnownCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const totalInitial = entries.length;

  const entryMap = new Map(entries.map(e => [e.id, e]));
  const current = queue.length > 0 ? entryMap.get(queue[0]) || null : null;

  const promptLang = direction === 'forward' ? set.languageFrom : set.languageTo;
  const answerLang = direction === 'forward' ? set.languageTo : set.languageFrom;
  const promptText = current ? (direction === 'forward' ? current.front : current.back) : '';
  const answerText = current ? (direction === 'forward' ? current.back : current.front) : '';
  const ttsAvailable = canSpeak();

  useEffect(() => () => stopSpeaking(), []);

  useEffect(() => {
    if (!current || !autoSpeak || !ttsAvailable) return;
    const textToRead = direction === 'forward' ? speechText(current.front) : '';
    if (!textToRead) return;
    const timer = window.setTimeout(() => {
      speakText(textToRead, set.languageFrom, undefined, { rate: SPEECH_RATE_NORMAL });
    }, 220);
    return () => window.clearTimeout(timer);
  }, [current?.id, direction, autoSpeak, ttsAvailable, set.languageFrom]);

  const handleFlip = () => {
    const nextFlipped = !flipped;
    setFlipped(nextFlipped);
    if (nextFlipped && current && autoSpeak && ttsAvailable && direction === 'reverse') {
      speakText(speechText(current.front), set.languageFrom, undefined, { rate: SPEECH_RATE_NORMAL });
    }
  };

  const handleRate = (known: boolean) => {
    if (!current) return;
    stopSpeaking();
    onRate(current.id, known);
    setAnsweredCount(v => v + 1);
    if (known) setKnownCount(v => v + 1);

    let nextQueue = queue.slice(1);
    if (!known && (requeued[current.id] || 0) < 1) {
      nextQueue = [...nextQueue, current.id];
      setRequeued(prev => ({ ...prev, [current.id]: (prev[current.id] || 0) + 1 }));
    }
    setQueue(nextQueue);
    setFlipped(false);
  };

  const handleRestart = () => {
    stopSpeaking();
    setQueue(entries.map(e => e.id));
    setRequeued({});
    setFlipped(false);
    setKnownCount(0);
    setAnsweredCount(0);
  };

  const progressPct = totalInitial > 0 ? Math.min(100, Math.round(((totalInitial - Math.min(queue.length, totalInitial)) / totalInitial) * 100)) : 0;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 680, margin: '0 auto', paddingBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => {
            stopSpeaking();
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {ttsAvailable && (
            <button
              type="button"
              onClick={onToggleAutoSpeak}
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
            onClick={() => {
              setDirection(d => (d === 'forward' ? 'reverse' : 'forward'));
              setFlipped(false);
            }}
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
            <Languages size={14} /> {promptLang} → {answerLang}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ ...CARD, padding: '0.9rem 1.1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: PRIMARY }}>
              Karteikarten
            </div>
            <h2 style={{ margin: '0.1rem 0 0', fontSize: 'var(--font-lg)', fontWeight: 800 }}>{set.title}</h2>
          </div>
          <span style={{ fontSize: 'var(--font-xs)', fontWeight: 800, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {queue.length === 0 ? `${knownCount} von ${answeredCount} gekonnt` : `${queue.length} offen`}
          </span>
        </div>
        <div style={{ height: 7, borderRadius: 99, background: 'var(--color-surface-muted)', marginTop: '0.75rem', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: HERO_GRADIENT, transition: 'width 200ms ease' }} />
        </div>
      </div>

      {!current ? (
        <div style={{ ...CARD, textAlign: 'center', padding: '2.1rem 1.25rem' }}>
          <div style={{ width: 58, height: 58, borderRadius: '50%', margin: '0 auto 0.8rem', background: '#ECE8FF', color: PRIMARY, display: 'grid', placeItems: 'center' }}>
            <Sparkles size={26} />
          </div>
          <h2 style={{ margin: '0 0 0.35rem', fontWeight: 800 }}>Stark gemacht, {userName}!</h2>
          <p style={{ margin: '0 0 1.25rem', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
            Du hast alle Karteikarten durchgearbeitet ({knownCount} von {answeredCount} direkt gewusst).
          </p>
          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={handleRestart} className="btn btn-primary" style={{ borderRadius: '999px', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <RotateCcw size={15} /> Nochmal durchgehen
            </button>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ borderRadius: '999px' }}>
              Zur Übersicht
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Interactive Flip Card */}
          <div
            role="button"
            tabIndex={0}
            onClick={handleFlip}
            onKeyDown={e => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                handleFlip();
              }
            }}
            style={{
              ...CARD,
              minHeight: '260px',
              padding: '1.5rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              textAlign: 'center',
              cursor: 'pointer',
              userSelect: 'none',
              background: flipped ? 'linear-gradient(160deg, #F8F6FF 0%, #FFFFFF 100%)' : 'var(--color-surface)',
              border: flipped ? '1.5px solid #6D5DF0' : '1px solid var(--color-border)',
              transition: 'border-color 0.2s ease, background 0.2s ease',
            }}
          >
            <span
              style={{
                padding: '0.25rem 0.7rem',
                borderRadius: '999px',
                background: flipped ? '#E3F6EF' : '#ECE8FF',
                color: flipped ? GREEN_TEXT : PRIMARY,
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              {flipped ? `${answerLang} · Lösung` : promptLang}
            </span>

            <div style={{ padding: '1rem 0', width: '100%' }}>
              <div
                style={{
                  fontSize: 'clamp(1.8rem, 7vw, 2.75rem)',
                  fontWeight: 800,
                  lineHeight: 1.15,
                  color: 'var(--color-text)',
                  overflowWrap: 'anywhere',
                }}
              >
                {flipped ? answerText : promptText}
              </div>
              {flipped && (
                <div style={{ marginTop: '0.6rem', fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  {promptText}
                </div>
              )}
            </div>

            {/* Audio Buttons on Card */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.55rem' }}>
              {ttsAvailable && (
                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => speakText(speechText(flipped ? answerText : promptText), flipped ? answerLang : promptLang, undefined, { rate: SPEECH_RATE_NORMAL })}
                    style={{
                      height: '36px',
                      padding: '0 0.85rem',
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
                    <Volume2 size={15} /> Vorlesen
                  </button>
                  <button
                    type="button"
                    onClick={() => speakText(speechText(flipped ? answerText : promptText), flipped ? answerLang : promptLang, undefined, { rate: SPEECH_RATE_SLOW })}
                    style={{
                      height: '36px',
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
                    }}
                  >
                    <Turtle size={14} /> Langsam
                  </button>
                </div>
              )}
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-tertiary)' }}>
                {flipped ? 'Tippen zum Zurückdrehen' : 'Karte antippen zum Umdrehen'}
              </span>
            </div>
          </div>

          {/* Rating Actions */}
          {flipped ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={() => handleRate(false)}
                style={{
                  height: '52px',
                  borderRadius: '999px',
                  border: '1.5px solid #F2A9BE',
                  background: '#FDE8EF',
                  color: PINK_TEXT,
                  fontSize: 'var(--font-sm)',
                  fontWeight: 800,
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                }}
              >
                <X size={17} /> Nochmal üben
              </button>
              <button
                type="button"
                onClick={() => handleRate(true)}
                style={{
                  height: '52px',
                  borderRadius: '999px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #1E9A78 0%, #4FC3A1 100%)',
                  color: '#FFFFFF',
                  fontSize: 'var(--font-sm)',
                  fontWeight: 800,
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                  boxShadow: '0 8px 20px rgba(30, 154, 120, 0.25)',
                }}
              >
                <Check size={17} strokeWidth={2.8} /> Kann ich!
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleFlip}
              style={{
                width: '100%',
                height: '50px',
                borderRadius: '999px',
                border: 'none',
                background: 'linear-gradient(135deg, #3F34C4 0%, #6D5DF0 100%)',
                color: '#FFFFFF',
                fontSize: 'var(--font-base)',
                fontWeight: 800,
                fontFamily: 'inherit',
                cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(63, 52, 196, 0.28)',
              }}
            >
              Umdrehen & Lösung zeigen
            </button>
          )}
        </>
      )}
    </section>
  );
};
