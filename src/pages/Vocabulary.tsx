import { useEffect, useState, type FormEvent } from 'react';
import { BookOpen, Check, ChevronLeft, Clock3, Eye, Languages, Plus, RotateCcw, Sparkles, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { mockDb } from '../services/mockDb';
import type { VocabularyEntry, VocabularySet } from '../services/mockDb';

function createId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parsePairs(text: string): Array<{ front: string; back: string }> {
  return text.split(/\r?\n/).flatMap(line => {
    const parts = line.trim().split(/[\t;|]/).map(part => part.trim());
    return parts.length > 1 && parts[0] && parts.slice(1).join(' ').trim()
      ? [{ front: parts[0], back: parts.slice(1).join(' ').trim() }]
      : [];
  });
}

const panel = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)' };
const actionButton = { minHeight: 46, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontWeight: 700, cursor: 'pointer', padding: '0.7rem 0.9rem' };

export const Vocabulary = () => {
  const { user } = useAuth();
  const [sets, setSets] = useState<VocabularySet[]>([]);
  const [manageOpen, setManageOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [languageFrom, setLanguageFrom] = useState('Englisch');
  const [languageTo, setLanguageTo] = useState('Deutsch');
  const [pairsText, setPairsText] = useState('');
  const [message, setMessage] = useState('');
  const [studySetId, setStudySetId] = useState<string | null>(null);
  const [direction, setDirection] = useState<'forward' | 'reverse'>('forward');
  const [queue, setQueue] = useState<string[]>([]);
  const [requeued, setRequeued] = useState<Record<string, number>>({});
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionAnswered, setSessionAnswered] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    const updateClock = () => setNowMs(Date.now());
    const timer = window.setTimeout(updateClock, 0);
    const interval = window.setInterval(updateClock, 60_000);
    return () => { window.clearTimeout(timer); window.clearInterval(interval); };
  }, []);

  useEffect(() => {
    const refresh = () => setSets(mockDb.getVocabularySets());
    refresh();
    window.addEventListener('db_updated', refresh);
    return () => window.removeEventListener('db_updated', refresh);
  }, []);

  const activeSet = sets.find(set => set.id === studySetId) || null;
  const currentEntry: VocabularyEntry | null = activeSet && queue.length ? activeSet.entries.find(entry => entry.id === queue[0]) || null : null;
  const sessionPercent = sessionTotal ? Math.min(100, Math.round(sessionAnswered / sessionTotal * 100)) : 0;

  const startStudy = (set: VocabularySet, nextDirection = direction) => {
    const progress = set.progressByUser?.[user?.id || ''] || {};
    const due = set.entries.filter(entry => !progress[entry.id]?.nextReviewAt || progress[entry.id].nextReviewAt <= nowMs);
    const firstRound = due.length ? due : set.entries;
    setStudySetId(set.id);
    setDirection(nextDirection);
    setQueue(firstRound.map(entry => entry.id));
    setRequeued({});
    setShowAnswer(false);
    setSessionAnswered(0);
    setSessionCorrect(0);
    setSessionTotal(firstRound.length);
  };

  const finishStudy = () => { setStudySetId(null); setQueue([]); setShowAnswer(false); };

  const answerCard = (correct: boolean) => {
    if (!activeSet || !currentEntry || !user) return;
    mockDb.recordVocabularyAnswer(activeSet.id, user.id, currentEntry.id, correct);
    setSessionAnswered(value => value + 1);
    if (correct) setSessionCorrect(value => value + 1);
    let nextQueue = queue.slice(1);
    if (!correct && (requeued[currentEntry.id] || 0) < 1) {
      nextQueue = [...nextQueue, currentEntry.id];
      setRequeued(previous => ({ ...previous, [currentEntry.id]: (previous[currentEntry.id] || 0) + 1 }));
    }
    setQueue(nextQueue);
    setShowAnswer(false);
  };

  const handleCreateSet = (event: FormEvent) => {
    event.preventDefault();
    if (!user || user.isChild) return;
    const pairs = parsePairs(pairsText);
    if (!title.trim() || pairs.length === 0) { setMessage('Bitte Titel und mindestens ein gültiges Wortpaar eintragen.'); return; }
    const uniquePairs = pairs.filter((pair, index) => pairs.findIndex(other =>
      other.front.toLocaleLowerCase() === pair.front.toLocaleLowerCase() && other.back.toLocaleLowerCase() === pair.back.toLocaleLowerCase()) === index);
    const now = Date.now();
    mockDb.saveVocabularySet({
      id: createId(), title: title.trim(), languageFrom: languageFrom.trim() || 'Sprache 1', languageTo: languageTo.trim() || 'Sprache 2',
      entries: uniquePairs.map(pair => ({ id: createId(), ...pair })), createdAt: now, updatedAt: now, createdBy: user.id, source: 'Manuell', progressByUser: {},
    });
    setTitle(''); setPairsText(''); setMessage(`${uniquePairs.length} Vokabeln gespeichert.`); setManageOpen(false);
    window.setTimeout(() => setMessage(''), 3500);
  };

  const handleDeleteSet = (set: VocabularySet) => {
    if (window.confirm(`Lernset „${set.title}“ mit ${set.entries.length} Vokabeln wirklich löschen?`)) {
      mockDb.deleteVocabularySet(set.id);
      if (studySetId === set.id) finishStudy();
    }
  };

  if (studySetId && activeSet) {
    const completed = queue.length === 0;
    const prompt = currentEntry ? (direction === 'forward' ? currentEntry.front : currentEntry.back) : '';
    const answer = currentEntry ? (direction === 'forward' ? currentEntry.back : currentEntry.front) : '';
    return (
      <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 680, margin: '0 auto', paddingBottom: '2rem' }}>
        <button onClick={finishStudy} style={{ ...actionButton, alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'transparent', color: 'var(--color-text)' }}><ChevronLeft size={18} /> Zurück</button>
        <div style={{ ...panel, padding: '1rem 1.1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.7rem', alignItems: 'center' }}>
            <div style={{ minWidth: 0 }}><div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Vokabeltraining</div><h2 style={{ margin: '0.2rem 0 0', color: 'var(--color-text)', fontSize: 'var(--font-lg)' }}>{activeSet.title}</h2></div>
            <button onClick={() => startStudy(activeSet, direction === 'forward' ? 'reverse' : 'forward')} title="Abfragerichtung wechseln" style={{ ...actionButton, display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-primary)', background: 'var(--color-primary-transparent)', flexShrink: 0 }}><Languages size={17} /> {direction === 'forward' ? `${activeSet.languageFrom} → ${activeSet.languageTo}` : `${activeSet.languageTo} → ${activeSet.languageFrom}`}</button>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: 'var(--color-surface-muted)', marginTop: '1rem', overflow: 'hidden' }}><div style={{ height: '100%', width: `${sessionPercent}%`, background: 'var(--color-primary)', transition: 'width 180ms ease' }} /></div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', marginTop: '0.4rem' }}>{completed ? `${sessionCorrect} von ${sessionAnswered} richtig` : `Karte ${Math.min(sessionAnswered + 1, sessionTotal)} von ${sessionTotal}`}</div>
        </div>
        {completed ? (
          <div style={{ ...panel, textAlign: 'center', padding: '2rem 1.2rem' }}>
            <div style={{ width: 58, height: 58, borderRadius: '50%', margin: '0 auto 0.8rem', background: 'var(--color-primary-transparent)', color: 'var(--color-primary)', display: 'grid', placeItems: 'center' }}><Sparkles size={28} /></div>
            <h2 style={{ margin: '0 0 0.4rem', color: 'var(--color-text)' }}>Gut gemacht, {user?.id}!</h2>
            <p style={{ margin: '0 0 1.2rem', color: 'var(--color-text-muted)' }}>{sessionCorrect} von {sessionAnswered} Antworten richtig.</p>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' }}><button onClick={() => startStudy(activeSet)} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><RotateCcw size={16} /> Nochmal üben</button><button onClick={finishStudy} className="btn btn-secondary">Fertig</button></div>
          </div>
        ) : currentEntry ? (
          <div style={{ ...panel, minHeight: 280, padding: 'clamp(1.2rem, 5vw, 2.4rem)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)', marginBottom: '1rem' }}>{direction === 'forward' ? activeSet.languageFrom : activeSet.languageTo}</div>
            <div style={{ fontSize: 'clamp(2rem, 8vw, 3.5rem)', lineHeight: 1.15, fontWeight: 800, color: 'var(--color-text)', overflowWrap: 'anywhere' }}>{prompt}</div>
            {showAnswer ? <>
              <div style={{ height: 1, width: 'min(100%, 260px)', background: 'var(--color-border)', margin: '1.5rem 0' }} />
              <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)', marginBottom: '0.4rem' }}>{direction === 'forward' ? activeSet.languageTo : activeSet.languageFrom}</div>
              <div style={{ fontSize: 'clamp(1.5rem, 6vw, 2.5rem)', fontWeight: 750, color: 'var(--color-primary)', overflowWrap: 'anywhere' }}>{answer}</div>
              <div style={{ display: 'flex', width: '100%', gap: '0.7rem', marginTop: '2rem' }}>
                <button onClick={() => answerCard(false)} style={{ ...actionButton, flex: 1, color: 'var(--color-text)', background: 'var(--color-surface-muted)' }}><RotateCcw size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Nochmal</button>
                <button onClick={() => answerCard(true)} style={{ ...actionButton, flex: 1, color: 'white', background: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}><Check size={17} style={{ verticalAlign: 'middle', marginRight: 6 }} />Gewusst</button>
              </div>
            </> : <button onClick={() => setShowAnswer(true)} className="btn btn-primary" style={{ marginTop: '2rem', minWidth: 160, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem' }}><Eye size={18} /> Lösung zeigen</button>}
          </div>
        ) : (
          <div style={{ ...panel, padding: '1.5rem', textAlign: 'center' }}><p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Dieses Lernset enthält noch keine Vokabeln.</p><button onClick={finishStudy} className="btn btn-secondary" style={{ marginTop: '1rem' }}>Zur Übersicht</button></div>
        )}
      </section>
    );
  }

  const manualPairCount = parsePairs(pairsText).length;
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 900, margin: '0 auto', paddingBottom: '2rem' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem' }}>
        <div><div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)', fontSize: 'var(--font-sm)', fontWeight: 700 }}><Languages size={18} /> Lernen</div><h1 style={{ margin: '0.2rem 0 0', color: 'var(--color-text)', fontSize: 'var(--font-2xl)' }}>Vokabeltraining</h1></div>
        {!user?.isChild && <button onClick={() => { setManageOpen(value => !value); setMessage(''); }} aria-label={manageOpen ? 'Vokabeln hinzufügen schließen' : 'Lernset hinzufügen'} title={manageOpen ? 'Schließen' : 'Lernset hinzufügen'} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0, padding: '0.55rem 0.7rem', fontSize: 'var(--font-sm)', whiteSpace: 'nowrap' }}>{manageOpen ? <X size={17} /> : <Plus size={17} />}<span>{manageOpen ? 'Schließen' : 'Neu'}</span></button>}
      </header>
      <div style={{ ...panel, padding: '0.9rem 1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        <div style={{ width: 36, height: 36, borderRadius: 12, display: 'grid', placeItems: 'center', color: 'var(--color-primary)', background: 'var(--color-primary-transparent)', flexShrink: 0 }}><BookOpen size={19} /></div>
        <div style={{ color: 'var(--color-text)', fontSize: 'var(--font-sm)', lineHeight: 1.45 }}><strong>Neue Vokabelseite?</strong> Schick mir das Foto hier im Chat und nenne – wenn möglich – Fach, Lektion und Sprachrichtung. Ich übertrage die Wörter in die gemeinsame Sammlung; unklare Stellen kläre ich erst mit dir. Das Foto selbst wird nicht gespeichert.</div>
      </div>
      {message && !manageOpen && <div role="status" style={{ color: 'var(--color-success)', fontSize: 'var(--font-sm)', fontWeight: 700 }}>{message}</div>}
      {manageOpen && !user?.isChild && (
        <form onSubmit={handleCreateSet} style={{ ...panel, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h2 style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--font-lg)' }}>Lernset manuell anlegen</h2>
          <input className="input-field" value={title} onChange={event => setTitle(event.target.value)} placeholder="Titel, z. B. Englisch – Unit 4" maxLength={120} required />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '0.6rem' }}><input className="input-field" value={languageFrom} onChange={event => setLanguageFrom(event.target.value)} placeholder="Ausgangssprache" maxLength={40} aria-label="Ausgangssprache" /><input className="input-field" value={languageTo} onChange={event => setLanguageTo(event.target.value)} placeholder="Zielsprache" maxLength={40} aria-label="Zielsprache" /></div>
          <textarea className="input-field" value={pairsText} onChange={event => setPairsText(event.target.value)} placeholder={'Ein Wortpaar pro Zeile, getrennt durch Tab, ; oder |\napple;Apfel\nquiet;ruhig'} rows={5} style={{ resize: 'vertical', lineHeight: 1.5 }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.7rem', flexWrap: 'wrap' }}><span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)' }}>{manualPairCount} Wortpaare erkannt</span><button type="submit" className="btn btn-primary" disabled={!title.trim() || manualPairCount === 0}>Lernset speichern</button></div>
          {message && <p style={{ margin: 0, color: 'var(--color-danger)', fontSize: 'var(--font-sm)' }}>{message}</p>}
        </form>
      )}
      {sets.length === 0 ? (
        <div style={{ ...panel, padding: '2rem 1.2rem', textAlign: 'center' }}><div style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 0.8rem', display: 'grid', placeItems: 'center', background: 'var(--color-primary-transparent)', color: 'var(--color-primary)' }}><Languages size={26} /></div><h2 style={{ color: 'var(--color-text)', margin: '0 0 0.4rem', fontSize: 'var(--font-lg)' }}>Noch keine Vokabeln</h2><p style={{ color: 'var(--color-text-muted)', margin: 0 }}>Sobald die erste Vokabelseite eingetragen ist, kann {user?.isChild ? 'hier' : 'dein Sohn hier'} direkt losüben.</p></div>
      ) : <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem' }}><h2 style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--font-lg)' }}>Lernsets</h2><span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)' }}>{sets.length} {sets.length === 1 ? 'Set' : 'Sets'}</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '0.7rem' }}>
          {sets.map(set => {
            const progress = set.progressByUser?.[user?.id || ''] || {};
            const learned = set.entries.filter(entry => (progress[entry.id]?.streak || 0) >= 2).length;
            const due = set.entries.filter(entry => !progress[entry.id]?.nextReviewAt || progress[entry.id].nextReviewAt <= nowMs).length;
            return <article key={set.id} style={{ ...panel, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'flex-start' }}><div style={{ minWidth: 0 }}><h3 style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--font-base)', overflowWrap: 'anywhere' }}>{set.title}</h3><div style={{ marginTop: '0.25rem', color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)' }}>{set.languageFrom} → {set.languageTo}</div></div>{!user?.isChild && <button onClick={() => handleDeleteSet(set)} aria-label={`Lernset ${set.title} löschen`} title="Lernset löschen" style={{ background: 'transparent', border: 0, color: 'var(--color-text-muted)', cursor: 'pointer', padding: 4, flexShrink: 0 }}><Trash2 size={17} /></button>}</div>
              <div style={{ display: 'flex', gap: '0.7rem', color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)' }}><span>{set.entries.length} Vokabeln</span><span>•</span><span>{learned} sicher</span><span>•</span><span>{due} offen</span></div>
              <button onClick={() => startStudy(set)} disabled={!set.entries.length} className="btn btn-primary" style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem' }}><Sparkles size={17} />{due ? 'Jetzt üben' : 'Nochmal üben'}</button>
            </article>;
          })}
        </div>
      </>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)' }}><Clock3 size={14} /> Gewusste Wörter kommen später wieder; schwierige nach kurzer Zeit.</div>
    </section>
  );
};
