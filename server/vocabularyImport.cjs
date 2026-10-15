'use strict';

const { randomUUID } = require('node:crypto');

function cleanText(value, maxLength, field) {
  if (typeof value !== 'string') throw new TypeError(`${field} muss Text sein.`);
  const text = value.trim();
  if (!text || text.length > maxLength) throw new TypeError(`${field} fehlt oder ist zu lang.`);
  return text;
}

function normalizeVocabularyImport(input, makeId = randomUUID) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Importdaten müssen ein Objekt sein.');
  }

  const title = cleanText(input.title, 120, 'Titel');
  const languageFrom = cleanText(input.languageFrom, 40, 'Ausgangssprache');
  const languageTo = cleanText(input.languageTo, 40, 'Zielsprache');
  if (!Array.isArray(input.entries) || input.entries.length < 1 || input.entries.length > 300) {
    throw new TypeError('Es werden 1 bis 300 Vokabelpaare benötigt.');
  }

  const seen = new Set();
  const entries = [];
  for (const row of input.entries) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    if (typeof row.front !== 'string' || typeof row.back !== 'string') continue;
    const front = row.front.trim();
    const back = row.back.trim();
    if (!front || !back || front.length > 180 || back.length > 240) continue;
    const key = `${front.toLocaleLowerCase()}\u0000${back.toLocaleLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({ id: makeId(), front, back });
  }

  if (!entries.length) throw new TypeError('Keine gültigen Vokabelpaare gefunden.');

  const setId = typeof input.setId === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(input.setId)
    ? input.setId
    : makeId();
  const source = typeof input.source === 'string' ? input.source.trim().slice(0, 160) : 'Chat-Foto';

  return { setId, title, languageFrom, languageTo, source, entries };
}

function normalizedKey(value) {
  return String(value || '').trim().toLocaleLowerCase();
}

function mergeVocabularyImport(current, incoming, now = Date.now()) {
  const store = current && typeof current === 'object' && !Array.isArray(current) ? { ...current } : {};
  const targetLanguagePair = `${normalizedKey(incoming.languageFrom)}\u0000${normalizedKey(incoming.languageTo)}`;
  const targetTitle = normalizedKey(incoming.title);

  let existing = store[incoming.setId];
  if (!existing) {
    existing = Object.values(store).find((set) => set
      && normalizedKey(set.title) === targetTitle
      && `${normalizedKey(set.languageFrom)}\u0000${normalizedKey(set.languageTo)}` === targetLanguagePair);
  }

  const id = existing?.id || incoming.setId;
  const priorEntries = Array.isArray(existing?.entries) ? existing.entries.filter(Boolean) : [];
  const seen = new Set(priorEntries.map((entry) => `${normalizedKey(entry.front)}\u0000${normalizedKey(entry.back)}`));
  const additions = incoming.entries.filter((entry) => {
    const key = `${normalizedKey(entry.front)}\u0000${normalizedKey(entry.back)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const merged = {
    ...(existing || {}),
    id,
    title: incoming.title,
    languageFrom: incoming.languageFrom,
    languageTo: incoming.languageTo,
    source: incoming.source || existing?.source || 'Chat-Foto',
    createdAt: Number.isFinite(existing?.createdAt) ? existing.createdAt : now,
    updatedAt: now,
    createdBy: existing?.createdBy || 'Hermes',
    entries: [...priorEntries, ...additions],
    progressByUser: existing?.progressByUser && typeof existing.progressByUser === 'object'
      ? existing.progressByUser
      : {},
  };

  store[id] = merged;
  return { store, setId: id, addedCount: additions.length, totalCount: merged.entries.length };
}

module.exports = { normalizeVocabularyImport, mergeVocabularyImport };
