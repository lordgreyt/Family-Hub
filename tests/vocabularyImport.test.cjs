'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeVocabularyImport, mergeVocabularyImport } = require('../server/vocabularyImport.cjs');

const makeId = (() => { let id = 0; return () => `id-${++id}`; })();

test('normalizes entries and removes duplicate pairs from an imported photo batch', () => {
  const batch = normalizeVocabularyImport({
    title: 'Unit 4', languageFrom: 'Englisch', languageTo: 'Deutsch',
    entries: [
      { front: 'apple', back: 'Apfel' },
      { front: ' apple ', back: ' apfel ' },
      { front: '', back: 'leer' },
    ],
  }, makeId);

  assert.equal(batch.title, 'Unit 4');
  assert.equal(batch.entries.length, 1);
  assert.equal(batch.entries[0].front, 'apple');
  assert.equal(batch.source, 'Chat-Foto');
});

test('merges pages with the same title and language pair without duplicating words', () => {
  const first = normalizeVocabularyImport({
    title: 'Unit 4', languageFrom: 'Englisch', languageTo: 'Deutsch',
    entries: [{ front: 'apple', back: 'Apfel' }],
  }, makeId);
  const firstMerge = mergeVocabularyImport({}, first, 1000);
  firstMerge.store[firstMerge.setId].progressByUser.Lennart = { 'word-1': { correct: 1 } };

  const second = normalizeVocabularyImport({
    title: ' unit 4 ', languageFrom: 'englisch', languageTo: 'deutsch',
    entries: [{ front: 'apple', back: 'Apfel' }, { front: 'pear', back: 'Birne' }],
  }, makeId);
  const secondMerge = mergeVocabularyImport(firstMerge.store, second, 2000);

  assert.equal(secondMerge.setId, firstMerge.setId);
  assert.equal(secondMerge.addedCount, 1);
  assert.equal(secondMerge.totalCount, 2);
  assert.deepEqual(secondMerge.store[firstMerge.setId].progressByUser.Lennart, { 'word-1': { correct: 1 } });
  assert.equal(secondMerge.store[firstMerge.setId].updatedAt, 2000);
});

test('rejects missing titles and oversized batches', () => {
  assert.throws(() => normalizeVocabularyImport({ languageFrom: 'Englisch', languageTo: 'Deutsch', entries: [{ front: 'x', back: 'y' }] }), /Titel/);
  assert.throws(() => normalizeVocabularyImport({ title: 'Unit', languageFrom: 'Englisch', languageTo: 'Deutsch', entries: Array(301).fill({ front: 'x', back: 'y' }) }), /300/);
});
