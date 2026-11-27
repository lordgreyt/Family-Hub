import test from 'node:test';
import assert from 'node:assert/strict';
import {
  answerVariants,
  buildChoiceOptions,
  buildTypingHint,
  dailyExamTarget,
  daysUntilExam,
  entryMastery,
  isAnswerCorrect,
  isHardEntry,
  pickRandomAdventureMode,
  primaryVariant,
  speechText,
} from '../src/pages/vocabularyLearn.ts';

test('kommagetrennte Varianten gelten beide', () => {
  assert.deepEqual(answerVariants('versuchen, probieren'), ['versuchen', 'probieren']);
  assert.equal(isAnswerCorrect('versuchen', 'versuchen, probieren'), true);
  assert.equal(isAnswerCorrect('probieren', 'versuchen, probieren'), true);
  assert.equal(isAnswerCorrect('Versuchen', 'versuchen, probieren'), true);
});

test('Englisch mit mehreren Übersetzungen', () => {
  assert.equal(isAnswerCorrect('to try', 'to try, to attempt'), true);
  assert.equal(isAnswerCorrect('attempt', 'to try, to attempt'), true);
  assert.equal(isAnswerCorrect('try', 'to try, to attempt'), true);
  assert.equal(isAnswerCorrect('start', 'to try, to attempt'), false);
});

test('Trenner ; | / und "oder"', () => {
  assert.deepEqual(answerVariants('versuchen; probieren'), ['versuchen', 'probieren']);
  assert.deepEqual(answerVariants('versuchen / probieren'), ['versuchen', 'probieren']);
  assert.deepEqual(answerVariants('versuchen oder probieren'), ['versuchen', 'probieren']);
  assert.deepEqual(answerVariants('versuchen/probieren'), ['versuchen', 'probieren']);
});

test('km/h bleibt eine Antwort', () => {
  assert.deepEqual(answerVariants('km/h'), ['km/h']);
  assert.equal(isAnswerCorrect('km/h', 'km/h'), true);
});

test('Hauptvariante und vollständiger Vorlesetext', () => {
  assert.equal(primaryVariant('versuchen, probieren'), 'versuchen');
  assert.equal(primaryVariant('ruhig'), 'ruhig');
  assert.equal(speechText('versuchen; probieren'), 'versuchen, probieren');
  assert.equal(speechText('versuchen / probieren'), 'versuchen, probieren');
  assert.equal(speechText('versuchen | probieren'), 'versuchen, probieren');
  assert.equal(speechText('versuchen, probieren'), 'versuchen, probieren');
  assert.equal(speechText('versuchen oder probieren'), 'versuchen oder probieren');
  assert.equal(speechText('km/h'), 'km/h');
});

test('Tippfehler weiterhin toleriert, Dubletten entfernt', () => {
  assert.equal(isAnswerCorrect('probiern', 'versuchen, probieren'), true);
  assert.deepEqual(answerVariants('die Blume, die Blume'), ['die Blume']);
  assert.equal(isAnswerCorrect('die Blume', 'die Blume, die Blume'), true);
});

test('Antwortoptionen nutzen die Hauptvariante und keine gültige Dublette', () => {
  const entries = [
    { id: 'a', front: 'to try', back: 'versuchen, probieren' },
    { id: 'b', front: 'to eat', back: 'probieren' },
    { id: 'c', front: 'to run', back: 'rennen' },
    { id: 'd', front: 'to sleep', back: 'schlafen' },
  ];
  const options = buildChoiceOptions(entries[0], entries, entry => entry.back, 'seed');
  assert.equal(options.filter(option => option === 'versuchen').length, 1);
  assert.equal(options.includes('probieren'), false);
  assert.equal(options.includes('versuchen'), true);
});

test('Tipp-Hilfe deckt Buchstaben stufenweise auf', () => {
  assert.equal(buildTypingHint('suitcase', 1), 's _ _ _ _ _ _ _');
  assert.equal(buildTypingHint('suitcase', 2), 's u i _ _ _ _ e');
  assert.equal(buildTypingHint('versuchen, probieren', 1), 'v _ _ _ _ _ _ _ _');
});

test('Lernstand, Problemwörter und Klassenarbeits-Countdown', () => {
  assert.equal(entryMastery(undefined), 'new');
  assert.equal(entryMastery({ correctCount: 1, wrongCount: 1, streak: 1 }), 'learning');
  assert.equal(entryMastery({ correctCount: 2, wrongCount: 0, streak: 2 }), 'mastered');
  assert.equal(isHardEntry({ wrongCount: 2, streak: 0 }), true);
  assert.equal(isHardEntry({ wrongCount: 2, streak: 2 }), false);

  const refDay = new Date(2026, 10, 26, 12, 0, 0);
  assert.equal(daysUntilExam('2026-11-26', refDay), 0);
  assert.equal(daysUntilExam('2026-11-30', refDay), 4);
  assert.equal(dailyExamTarget(10, 4), 3);
  assert.equal(dailyExamTarget(0, 4), null);
});

test('pickRandomAdventureMode mischt Auswahl, Schreiben & Hören zufällig ohne direkte Wiederholung', () => {
  const seen = new Set();
  let prev;
  for (let i = 0; i < 30; i += 1) {
    const mode = pickRandomAdventureMode({
      canChoose: true,
      canSpeak: true,
      canDictate: i % 2 === 0,
      previousMode: prev,
      random: () => ((i * 37) % 100) / 100,
    });
    if (prev) assert.notEqual(mode, prev, 'Darf nicht direkt denselben Modus wiederholen');
    seen.add(mode);
    prev = mode;
  }
  assert.ok(seen.has('choice'));
  assert.ok(seen.has('type'));
  assert.ok(seen.has('dictation') || seen.has('audio'));
});
