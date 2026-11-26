import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MODELS,
  detectProviderFromKey,
  maskApiKey,
  mergeVocabEntries,
  parseVocabOcrResponse,
} from '../src/services/vocabOcr.ts';

test('detectProviderFromKey only auto-detects unambiguous Gemini and OpenAI project keys', () => {
  assert.equal(detectProviderFromKey('AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz123456'), 'gemini');
  assert.equal(detectProviderFromKey('sk-proj-1234567890abcdefghijklmnop'), 'openai');
  // DeepSeek and legacy OpenAI both start with sk-, so keep user-selected provider (default: deepseek)
  assert.equal(detectProviderFromKey('sk-1234567890abcdef1234567890abcdef'), null);
  assert.equal(DEFAULT_MODELS.deepseek, 'deepseek-flash');
  assert.equal(maskApiKey('sk-1234567890abcdef'), 'sk-1…cdef');
});

test('parseVocabOcrResponse strips code fences, deduplicates, and preserves uncertain flags', () => {
  const raw = [
    '```json',
    JSON.stringify({
      title: 'Unit 5 – Holidays',
      languageFrom: 'Englisch',
      languageTo: 'Deutsch',
      entries: [
        { front: ' suitcase ', back: 'Koffer', uncertain: false },
        { front: 'Suitcase', back: 'koffer' },
        { front: 'departure', back: 'Abfahrt, Abflug', uncertain: true },
        { front: '', back: 'leer' },
      ],
    }),
    '```',
  ].join('\n');

  let seq = 0;
  const parsed = parseVocabOcrResponse(raw, {}, () => `v-${++seq}`);
  assert.equal(parsed.title, 'Unit 5 – Holidays');
  assert.equal(parsed.languageFrom, 'Englisch');
  assert.equal(parsed.languageTo, 'Deutsch');
  assert.equal(parsed.entries.length, 2);
  assert.deepEqual(parsed.entries[0], { id: 'v-1', front: 'suitcase', back: 'Koffer' });
  assert.deepEqual(parsed.entries[1], { id: 'v-2', front: 'departure', back: 'Abfahrt, Abflug', uncertain: true });
});

test('parseVocabOcrResponse prefers explicit fallback title and rejects empty responses', () => {
  const parsed = parseVocabOcrResponse(
    JSON.stringify({ title: 'Detected', entries: [{ front: 'chien', back: 'Hund' }] }),
    { title: 'Französisch Lektion 2', languageFrom: 'Französisch', languageTo: 'Deutsch' },
    () => 'id-1'
  );
  assert.equal(parsed.title, 'Französisch Lektion 2');
  assert.equal(parsed.languageFrom, 'Französisch');
  assert.throws(() => parseVocabOcrResponse('{"entries":[]}'), /keine Vokabelpaare/i);
  assert.throws(() => parseVocabOcrResponse('kein json'), /gelesen werden/i);
});

test('mergeVocabEntries appends only non-duplicate pairs', () => {
  const existing = [{ id: '1', front: 'apple', back: 'Apfel' }];
  const incoming = [
    { id: '2', front: ' Apple ', back: 'apfel' },
    { id: '3', front: 'pear', back: 'Birne' },
  ];
  const merged = mergeVocabEntries(existing, incoming);
  assert.equal(merged.addedCount, 1);
  assert.equal(merged.entries.length, 2);
  assert.equal(merged.entries[1].front, 'pear');
});
