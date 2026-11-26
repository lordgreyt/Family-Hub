import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Check, Pencil, Plus, Search, Trash2, Turtle, Volume2, X } from 'lucide-react';
import type { VocabularyEntry, VocabularySet } from '../../services/mockDb';
import { entryMastery, isHardEntry, speechText } from '../../pages/vocabularyLearn';
import { SPEECH_RATE_NORMAL, SPEECH_RATE_SLOW, canSpeak, speakText, stopSpeaking } from '../../pages/speech';
import { GREEN_TEXT, PINK_TEXT, PRIMARY } from '../SurgeryFinance/theme';

interface VocabWordListSheetProps {
  set: VocabularySet | null;
  userId: string;
  canEdit: boolean;
  onSaveSet: (updated: VocabularySet) => void;
  onClose: () => void;
}

type ListFilter = 'all' | 'hard' | 'new' | 'learning' | 'mastered';

function createId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const VocabWordListSheet: React.FC<VocabWordListSheetProps> = ({
  set,
  userId,
  canEdit,
  onSaveSet,
  onClose,
}) => {
  const [filter, setFilter] = useState<ListFilter>('all');
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFront, setEditFront] = useState('');
  const [editBack, setEditBack] = useState('');
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!set) {
      stopSpeaking();
      return;
    }
    setFilter('all');
    setQuery('');
    setEditingId(null);
    setAdding(false);
    setNewFront('');
    setNewBack('');
  }, [set?.id]);

  useEffect(() => () => stopSpeaking(), []);

  const progressMap = set?.progressByUser?.[userId] || {};

  const counts = useMemo(() => {
    if (!set) return { all: 0, hard: 0, new: 0, learning: 0, mastered: 0 };
    let hard = 0;
    let fresh = 0;
    let learning = 0;
    let mastered = 0;
    for (const entry of set.entries) {
      const p = progressMap[entry.id];
      if (isHardEntry(p)) hard += 1;
      const m = entryMastery(p);
      if (m === 'new') fresh += 1;
      else if (m === 'learning') learning += 1;
      else mastered += 1;
    }
    return { all: set.entries.length, hard, new: fresh, learning, mastered };
  }, [set, progressMap]);

  const filteredEntries = useMemo(() => {
    if (!set) return [];
    const q = query.trim().toLowerCase();
    return set.entries.filter(entry => {
      const p = progressMap[entry.id];
      if (filter === 'hard' && !isHardEntry(p)) return false;
      if (filter === 'new' && entryMastery(p) !== 'new') return false;
      if (filter === 'learning' && entryMastery(p) !== 'learning') return false;
      if (filter === 'mastered' && entryMastery(p) !== 'mastered') return false;
      if (q && !entry.front.toLowerCase().includes(q) && !entry.back.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [set, progressMap, filter, query]);

  if (!set) return null;

  const ttsAvailable = canSpeak();

  const startEdit = (entry: VocabularyEntry) => {
    setEditingId(entry.id);
    setEditFront(entry.front);
    setEditBack(entry.back);
  };

  const commitEdit = () => {
    if (!editingId || !editFront.trim() || !editBack.trim()) return;
    const entries = set.entries.map(e =>
      e.id === editingId ? { ...e, front: editFront.trim(), back: editBack.trim() } : e
    );
    onSaveSet({ ...set, entries, updatedAt: Date.now() });
    setEditingId(null);
  };

  const deleteEntry = (entryId: string) => {
    const entries = set.entries.filter(e => e.id !== entryId);
    onSaveSet({ ...set, entries, updatedAt: Date.now() });
  };

  const addEntry = () => {
    if (!newFront.trim() || !newBack.trim()) return;
    const entry: VocabularyEntry = {
      id: createId(),
      front: newFront.trim(),
      back: newBack.trim(),
    };
    onSaveSet({ ...set, entries: [entry, ...set.entries], updatedAt: Date.now() });
    setNewFront('');
    setNewBack('');
    setAdding(false);
  };

  const updateExamDate = (value: string) => {
    const next = { ...set, updatedAt: Date.now() };
    if (value) next.examDate = value;
    else delete next.examDate;
    onSaveSet(next);
  };

  const masteryPill = (entry: VocabularyEntry) => {
    const p = progressMap[entry.id];
    const state = entryMastery(p);
    if (state === 'mastered') return { label: 'Sicher', bg: '#E3F6EF', color: GREEN_TEXT };
    if (isHardEntry(p)) return { label: 'Schwer', bg: '#FDE8EF', color: PINK_TEXT };
    if (state === 'learning') return { label: 'Üben', bg: '#FFF4E0', color: '#A85F12' };
    return { label: 'Neu', bg: '#ECE8FF', color: PRIMARY };
  };

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(18, 15, 48, 0.56)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 2100,
        animation: 'wlFade 0.18s ease',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Wortliste ${set.title}`}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '92dvh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: '28px 28px 0 0',
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text)',
          boxShadow: '0 -16px 48px rgba(23, 20, 58, 0.34)',
          animation: 'wlSlideUp 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            flex: 'none',
            padding: '0.85rem 1.25rem 1.05rem',
            color: '#FFFFFF',
            background: 'linear-gradient(150deg, #27208C 0%, #4E3FD6 55%, #8E78F2 100%)',
          }}
        >
          <div style={{ width: '40px', height: '4px', borderRadius: '999px', background: 'rgba(255,255,255,0.4)', margin: '0 auto 0.65rem' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', opacity: 0.82 }}>
                Wortliste · {set.languageFrom} → {set.languageTo}
              </div>
              <h2 style={{ margin: '0.12rem 0 0', fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {set.title}
              </h2>
            </div>
            <button type="button" className="glass-btn" onClick={onClose} aria-label="Schließen" style={{ width: '36px', height: '36px' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1rem 1.15rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Klassenarbeits-Datum (für Erwachsene bearbeitbar) */}
          {canEdit && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.65rem 0.85rem',
                borderRadius: '14px',
                background: 'var(--color-surface-hover)',
                border: '1px solid var(--color-border)',
                flexWrap: 'wrap',
              }}
            >
              <CalendarDays size={16} color={PRIMARY} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text)', flex: '1 1 120px' }}>
                Klassenarbeit / Test-Datum
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <input
                  type="date"
                  value={set.examDate || ''}
                  onChange={e => updateExamDate(e.target.value)}
                  aria-label="Test-Datum"
                  style={{
                    height: '34px',
                    padding: '0 0.6rem',
                    borderRadius: '10px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-text)',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    fontFamily: 'inherit',
                  }}
                />
                {set.examDate && (
                  <button
                    type="button"
                    onClick={() => updateExamDate('')}
                    aria-label="Test-Datum entfernen"
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      border: 'none',
                      background: '#FDE8EF',
                      color: PINK_TEXT,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Search & Add */}
          <div style={{ display: 'flex', gap: '0.45rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Wort suchen…"
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 0.85rem 0 2.2rem',
                  borderRadius: '12px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-hover)',
                  color: 'var(--color-text)',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => setAdding(v => !v)}
                style={{
                  height: '40px',
                  padding: '0 0.85rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#ECE8FF',
                  color: PRIMARY,
                  fontSize: '12.5px',
                  fontWeight: 800,
                  fontFamily: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <Plus size={15} /> Wort
              </button>
            )}
          </div>

          {/* Add Inline Form */}
          {adding && canEdit && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                padding: '0.75rem',
                borderRadius: '14px',
                background: '#F4F1FF',
                border: '1.5px solid #6D5DF0',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                <input
                  type="text"
                  value={newFront}
                  onChange={e => setNewFront(e.target.value)}
                  placeholder={set.languageFrom}
                  className="input-field"
                  style={{ height: '38px', fontSize: '13px', fontWeight: 700 }}
                  autoFocus
                />
                <input
                  type="text"
                  value={newBack}
                  onChange={e => setNewBack(e.target.value)}
                  placeholder={set.languageTo}
                  className="input-field"
                  style={{ height: '38px', fontSize: '13px', fontWeight: 600 }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') addEntry();
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                <button type="button" onClick={() => setAdding(false)} style={{ height: '32px', padding: '0 0.75rem', borderRadius: '999px', border: 'none', background: 'transparent', color: 'var(--color-text-muted)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={addEntry}
                  disabled={!newFront.trim() || !newBack.trim()}
                  style={{ height: '32px', padding: '0 0.85rem', borderRadius: '999px', border: 'none', background: PRIMARY, color: '#FFFFFF', fontSize: '12px', fontWeight: 800, cursor: 'pointer', opacity: newFront.trim() && newBack.trim() ? 1 : 0.45 }}
                >
                  Hinzufügen
                </button>
              </div>
            </div>
          )}

          {/* Filter Chips */}
          <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '2px' }}>
            {([
              { id: 'all', label: `Alle (${counts.all})` },
              { id: 'hard', label: `Schwere (${counts.hard})` },
              { id: 'new', label: `Neu (${counts.new})` },
              { id: 'learning', label: `Üben (${counts.learning})` },
              { id: 'mastered', label: `Sicher (${counts.mastered})` },
            ] as const).map(tab => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  style={{
                    height: '30px',
                    padding: '0 0.75rem',
                    borderRadius: '999px',
                    border: 'none',
                    background: active ? 'linear-gradient(135deg, #3F34C4, #6D5DF0)' : 'var(--color-surface-muted)',
                    color: active ? '#FFFFFF' : 'var(--color-text-muted)',
                    fontSize: '11.5px',
                    fontWeight: 800,
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Entries List */}
          {filteredEntries.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
              Keine Vokabeln in dieser Auswahl.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {filteredEntries.map(entry => {
                const isEditing = editingId === entry.id;
                const badge = masteryPill(entry);
                if (isEditing) {
                  return (
                    <div
                      key={entry.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.45rem',
                        padding: '0.65rem',
                        borderRadius: '14px',
                        background: '#F4F1FF',
                        border: '1.5px solid #6D5DF0',
                      }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                        <input
                          type="text"
                          value={editFront}
                          onChange={e => setEditFront(e.target.value)}
                          className="input-field"
                          style={{ height: '36px', fontSize: '13px', fontWeight: 700 }}
                        />
                        <input
                          type="text"
                          value={editBack}
                          onChange={e => setEditBack(e.target.value)}
                          className="input-field"
                          style={{ height: '36px', fontSize: '13px', fontWeight: 600 }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                        <button type="button" onClick={() => setEditingId(null)} style={{ height: '30px', padding: '0 0.7rem', borderRadius: '999px', border: 'none', background: 'transparent', color: 'var(--color-text-muted)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                          Abbrechen
                        </button>
                        <button type="button" onClick={commitEdit} style={{ height: '30px', padding: '0 0.8rem', borderRadius: '999px', border: 'none', background: PRIMARY, color: '#FFFFFF', fontSize: '12px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                          <Check size={13} /> Speichern
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={entry.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.55rem',
                      padding: '0.65rem 0.75rem',
                      borderRadius: '14px',
                      background: 'var(--color-surface-hover)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    {ttsAvailable && (
                      <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => speakText(speechText(entry.front), set.languageFrom, undefined, { rate: SPEECH_RATE_NORMAL })}
                          aria-label={`${entry.front} vorlesen`}
                          title="Vorlesen"
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '10px',
                            border: 'none',
                            background: '#ECE8FF',
                            color: PRIMARY,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          <Volume2 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => speakText(speechText(entry.front), set.languageFrom, undefined, { rate: SPEECH_RATE_SLOW })}
                          aria-label={`${entry.front} langsam vorlesen`}
                          title="Langsam vorlesen"
                          style={{
                            width: '28px',
                            height: '32px',
                            borderRadius: '10px',
                            border: 'none',
                            background: 'var(--color-surface)',
                            color: 'var(--color-text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          <Turtle size={13} />
                        </button>
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--font-sm)', fontWeight: 800, color: 'var(--color-text)', overflowWrap: 'anywhere' }}>
                        {entry.front}
                      </div>
                      <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-text-muted)', overflowWrap: 'anywhere', marginTop: '1px' }}>
                        {entry.back}
                      </div>
                    </div>

                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '999px',
                        background: badge.bg,
                        color: badge.color,
                        fontSize: '10.5px',
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {badge.label}
                    </span>

                    {canEdit && (
                      <div style={{ display: 'flex', gap: '0.15rem', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => startEdit(entry)}
                          aria-label="Bearbeiten"
                          style={{ width: '28px', height: '28px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteEntry(entry.id)}
                          aria-label="Löschen"
                          style={{ width: '28px', height: '28px', borderRadius: '8px', border: 'none', background: 'transparent', color: PINK_TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes wlFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes wlSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>,
    document.body
  );
};
