import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Clock3, RotateCcw, Sparkles, Volume2, VolumeX } from 'lucide-react';
import type { VocabularyEntry, VocabularySet } from '../../services/mockDb';
import { primaryVariant, seededShuffle, speechText } from '../../pages/vocabularyLearn';
import { SPEECH_RATE_NORMAL, canSpeak, speakText, stopSpeaking } from '../../pages/speech';
import { CARD, GREEN_TEXT, HERO_GRADIENT, PINK_TEXT, PRIMARY } from '../SurgeryFinance/theme';

interface VocabMatchGameProps {
  set: VocabularySet;
  entries: VocabularyEntry[];
  userName: string;
  autoSpeak: boolean;
  onToggleAutoSpeak: () => void;
  onPairResult?: (entryId: string, correct: boolean) => void;
  onClose: () => void;
}

const PAIRS_PER_ROUND = 6;

export const VocabMatchGame: React.FC<VocabMatchGameProps> = ({
  set,
  entries,
  userName,
  autoSpeak,
  onToggleAutoSpeak,
  onPairResult,
  onClose,
}) => {
  const [seed, setSeed] = useState(1);
  const [roundIdx, setRoundIdx] = useState(0);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [wrongPair, setWrongPair] = useState<{ left: string; right: string } | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [finished, setFinished] = useState(false);

  const rounds = useMemo(() => {
    const shuffled = seededShuffle(entries, `match:${set.id}:${seed}`);
    const chunks: VocabularyEntry[][] = [];
    for (let i = 0; i < shuffled.length; i += PAIRS_PER_ROUND) {
      chunks.push(shuffled.slice(i, i + PAIRS_PER_ROUND));
    }
    return chunks;
  }, [entries, set.id, seed]);

  const currentRound = rounds[roundIdx] || [];
  const leftItems = useMemo(
    () => seededShuffle(currentRound, `match-l:${roundIdx}:${seed}`),
    [currentRound, roundIdx, seed]
  );
  const rightItems = useMemo(
    () => seededShuffle(currentRound, `match-r:${roundIdx}:${seed}`),
    [currentRound, roundIdx, seed]
  );

  useEffect(() => () => stopSpeaking(), []);

  useEffect(() => {
    if (finished) return;
    const interval = window.setInterval(() => setElapsedSec(s => s + 1), 1000);
    return () => window.clearInterval(interval);
  }, [finished]);

  const checkPair = (leftId: string, rightId: string) => {
    if (leftId === rightId) {
      const nextMatched = [...matchedIds, leftId];
      setMatchedIds(nextMatched);
      setSelectedLeft(null);
      setSelectedRight(null);
      onPairResult?.(leftId, true);

      if (nextMatched.length >= currentRound.length) {
        window.setTimeout(() => {
          if (roundIdx + 1 < rounds.length) {
            setRoundIdx(r => r + 1);
            setMatchedIds([]);
          } else {
            setFinished(true);
          }
        }, 420);
      }
    } else {
      setMistakes(m => m + 1);
      setWrongPair({ left: leftId, right: rightId });
      onPairResult?.(leftId, false);
      window.setTimeout(() => {
        setWrongPair(null);
        setSelectedLeft(null);
        setSelectedRight(null);
      }, 480);
    }
  };

  const tapLeft = (entry: VocabularyEntry) => {
    if (matchedIds.includes(entry.id) || wrongPair) return;
    if (autoSpeak && canSpeak()) {
      speakText(speechText(entry.front), set.languageFrom, undefined, { rate: SPEECH_RATE_NORMAL });
    }
    if (selectedRight) {
      checkPair(entry.id, selectedRight);
    } else {
      setSelectedLeft(prev => (prev === entry.id ? null : entry.id));
    }
  };

  const tapRight = (entry: VocabularyEntry) => {
    if (matchedIds.includes(entry.id) || wrongPair) return;
    if (selectedLeft) {
      checkPair(selectedLeft, entry.id);
    } else {
      setSelectedRight(prev => (prev === entry.id ? null : entry.id));
    }
  };

  const restart = () => {
    stopSpeaking();
    setSeed(v => v + 1);
    setRoundIdx(0);
    setSelectedLeft(null);
    setSelectedRight(null);
    setMatchedIds([]);
    setWrongPair(null);
    setMistakes(0);
    setElapsedSec(0);
    setFinished(false);
  };

  const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  const totalMatched = roundIdx * PAIRS_PER_ROUND + matchedIds.length;
  const pct = entries.length > 0 ? Math.min(100, Math.round((totalMatched / entries.length) * 100)) : 0;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 680, margin: '0 auto', paddingBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          {canSpeak() && (
            <button
              type="button"
              onClick={onToggleAutoSpeak}
              style={{
                height: '36px',
                padding: '0 0.7rem',
                borderRadius: '999px',
                border: 'none',
                background: autoSpeak ? '#ECE8FF' : 'var(--color-surface-muted)',
                color: autoSpeak ? PRIMARY : 'var(--color-text-muted)',
                fontWeight: 800,
                fontSize: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {autoSpeak ? <Volume2 size={14} /> : <VolumeX size={14} />} Ton
            </button>
          )}
          <span
            style={{
              height: '36px',
              padding: '0 0.8rem',
              borderRadius: '999px',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '12.5px',
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <Clock3 size={14} color={PRIMARY} /> {fmtTime(elapsedSec)}
          </span>
        </div>
      </div>

      {/* Header Progress */}
      <div style={{ ...CARD, padding: '0.9rem 1.1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: PRIMARY }}>
              Paare zuordnen · Runde {Math.min(roundIdx + 1, Math.max(1, rounds.length))} von {Math.max(1, rounds.length)}
            </div>
            <h2 style={{ margin: '0.1rem 0 0', fontSize: 'var(--font-lg)', fontWeight: 800 }}>{set.title}</h2>
          </div>
          <span style={{ fontSize: '12px', fontWeight: 700, color: mistakes > 0 ? PINK_TEXT : GREEN_TEXT }}>
            {mistakes === 0 ? 'Fehlerfrei' : `${mistakes} ${mistakes === 1 ? 'Fehler' : 'Fehler'}`}
          </span>
        </div>
        <div style={{ height: 7, borderRadius: 99, background: 'var(--color-surface-muted)', marginTop: '0.75rem', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${finished ? 100 : pct}%`, background: HERO_GRADIENT, transition: 'width 200ms ease' }} />
        </div>
      </div>

      {finished ? (
        <div style={{ ...CARD, textAlign: 'center', padding: '2.1rem 1.25rem' }}>
          <div style={{ width: 58, height: 58, borderRadius: '50%', margin: '0 auto 0.8rem', background: '#E3F6EF', color: GREEN_TEXT, display: 'grid', placeItems: 'center' }}>
            <Sparkles size={26} />
          </div>
          <h2 style={{ margin: '0 0 0.35rem', fontWeight: 800 }}>Alle Paare gelöst, {userName}!</h2>
          <p style={{ margin: '0 0 1.25rem', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
            {entries.length} Paare in <strong>{fmtTime(elapsedSec)}</strong> · {mistakes === 0 ? 'komplett fehlerfrei!' : `${mistakes} Fehlversuche`}
          </p>
          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={restart} className="btn btn-primary" style={{ borderRadius: '999px', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <RotateCcw size={15} /> Nochmal spielen
            </button>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ borderRadius: '999px' }}>
              Zur Übersicht
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
          {/* Left column: Foreign language */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', textAlign: 'center' }}>
              {set.languageFrom}
            </div>
            {leftItems.map(entry => {
              const isMatched = matchedIds.includes(entry.id);
              const isSelected = selectedLeft === entry.id;
              const isWrong = wrongPair?.left === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  disabled={isMatched}
                  onClick={() => tapLeft(entry)}
                  style={{
                    minHeight: '58px',
                    padding: '0.65rem 0.7rem',
                    borderRadius: '16px',
                    border: isWrong
                      ? '2px solid #D4416E'
                      : isMatched
                        ? '1.5px solid #4FC3A1'
                        : isSelected
                          ? '2px solid #5A4BE0'
                          : '1.5px solid var(--color-border)',
                    background: isWrong
                      ? '#FDE8EF'
                      : isMatched
                        ? '#E3F6EF'
                        : isSelected
                          ? '#ECE8FF'
                          : 'var(--color-surface)',
                    color: isWrong ? PINK_TEXT : isMatched ? GREEN_TEXT : isSelected ? PRIMARY : 'var(--color-text)',
                    fontSize: '0.92rem',
                    fontWeight: 800,
                    fontFamily: 'inherit',
                    cursor: isMatched ? 'default' : 'pointer',
                    opacity: isMatched ? 0.42 : 1,
                    transition: 'all 0.16s ease',
                    overflowWrap: 'anywhere',
                    lineHeight: 1.25,
                  }}
                >
                  {primaryVariant(entry.front)}
                </button>
              );
            })}
          </div>

          {/* Right column: Translation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', textAlign: 'center' }}>
              {set.languageTo}
            </div>
            {rightItems.map(entry => {
              const isMatched = matchedIds.includes(entry.id);
              const isSelected = selectedRight === entry.id;
              const isWrong = wrongPair?.right === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  disabled={isMatched}
                  onClick={() => tapRight(entry)}
                  style={{
                    minHeight: '58px',
                    padding: '0.65rem 0.7rem',
                    borderRadius: '16px',
                    border: isWrong
                      ? '2px solid #D4416E'
                      : isMatched
                        ? '1.5px solid #4FC3A1'
                        : isSelected
                          ? '2px solid #5A4BE0'
                          : '1.5px solid var(--color-border)',
                    background: isWrong
                      ? '#FDE8EF'
                      : isMatched
                        ? '#E3F6EF'
                        : isSelected
                          ? '#ECE8FF'
                          : 'var(--color-surface)',
                    color: isWrong ? PINK_TEXT : isMatched ? GREEN_TEXT : isSelected ? PRIMARY : 'var(--color-text)',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    cursor: isMatched ? 'default' : 'pointer',
                    opacity: isMatched ? 0.42 : 1,
                    transition: 'all 0.16s ease',
                    overflowWrap: 'anywhere',
                    lineHeight: 1.25,
                  }}
                >
                  {primaryVariant(entry.back)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
