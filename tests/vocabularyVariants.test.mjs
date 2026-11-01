import test from 'node:test';
import assert from 'node:assert/strict';
import {
  answerVariants,
  buildChoiceOptions,
  isAnswerCorrect,
  primaryVariant,
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

test('Hauptvariante wird gesprochen', () => {
  assert.equal(primaryVariant('versuchen, probieren'), 'versuchen');
  assert.equal(primaryVariant('ruhig'), 'ruhig');
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
