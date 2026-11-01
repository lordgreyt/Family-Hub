import type { VocabularyEntry, VocabularyLearnMode } from '../services/mockDb';

export type LearnMode = VocabularyLearnMode;

export const MODE_LABEL: Record<LearnMode, string> = {
  choice: 'Erkennen',
  type: 'Schreiben',
  audio: 'Hören',
  dictation: 'Diktat',
};

export const MODE_HINT: Record<LearnMode, string> = {
  choice: 'Welche Übersetzung passt?',
  type: 'Schreibe die Übersetzung.',
  audio: 'Hör zu und schreibe die Übersetzung.',
  dictation: 'Hör das Wort und schreibe es.',
};

const ARTICLES = /^\s*(to|the|an|a|der|die|das|den|dem|ein|eine|einen|einem|einer|le|la|les|un|une|el|los|las|il|lo)\s+/i;

export function stripArticles(value: string) {
  return value.trim().replace(ARTICLES, '');
}

/** Vergleicht Antworten tolerant: Groß-/Kleinschreibung, Umlaute/Akzente, Satzzeichen, Artikel. */
export function normalizeAnswer(value: string) {
  return stripArticles(value)
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function editDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

/** Kleine Tippfehler verzeihen, falsche Wörter aber nicht. */
export function isAnswerClose(given: string, expected: string) {
  const a = normalizeAnswer(given);
  const b = normalizeAnswer(expected);
  if (!a || !b) return false;
  if (a === b) return true;
  const tolerance = b.length >= 12 ? 2 : b.length >= 6 ? 1 : 0;
  return editDistance(a, b) <= tolerance;
}

/**
 * Mehrere gültige Übersetzungen stehen im Feld getrennt durch , ; / | oder „oder".
 * Beispiel: „versuchen, probieren" → ['versuchen', 'probieren'].
 * Ein Schrägstrich trennt nur echte Wortvarianten – „km/h" bleibt eine Antwort.
 */
const VARIANT_SPLIT = /\s*(?:[,;|]|\soder\s)\s*/i;
const SLASH_SPLIT = /\s*\/\s*/;

function splitVariants(value: string): string[] {
  return value.split(VARIANT_SPLIT).flatMap(part => {
    const chunks = part.split(SLASH_SPLIT).map(chunk => chunk.trim()).filter(Boolean);
    const letters = (text: string) => text.replace(/[^A-Za-zÄÖÜäöüß]/g, '').length;
    return chunks.length > 1 && chunks.length <= 4 && chunks.every(chunk => letters(chunk) >= 3) ? chunks : [part];
  });
}

/** Alle gültigen Schreibweisen einer Vokabel – erste Variante ist die gesprochene/angezeigte. */
export function answerVariants(value: string): string[] {
  const seen = new Set<string>();
  return splitVariants(value)
    .map(part => part.trim())
    .filter(part => {
      const key = normalizeAnswer(part);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Hauptvariante: wird vorgelesen und als Antwortoption angezeigt. */
export function primaryVariant(value: string) {
  return answerVariants(value)[0] || value.trim();
}

/** Richtig ist die Antwort, wenn sie zu irgendeiner hinterlegten Variante passt. */
export function isAnswerCorrect(given: string, expected: string) {
  const variants = answerVariants(expected);
  if (!variants.length) return false;
  return variants.some(variant => isAnswerClose(given, variant));
}

export function isGermanLanguage(value: string) {
  return /deutsch|german/i.test(value);
}

const SPEECH_LANGS: Array<[RegExp, string]> = [
  [/englisch|english/i, 'en-US'],
  [/deutsch|german/i, 'de-DE'],
  [/franz|français|french/i, 'fr-FR'],
  [/span|español|spanish/i, 'es-ES'],
  [/ital|italiano|italian/i, 'it-IT'],
  [/latein|latin/i, 'it-IT'],
  [/portug|português/i, 'pt-PT'],
  [/niederländ|dutch|nederlands/i, 'nl-NL'],
];

export function speechLangFor(language: string) {
  return SPEECH_LANGS.find(([pattern]) => pattern.test(language))?.[1] || 'en-US';
}

function hashSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededShuffle<T>(items: T[], seed: string): T[] {
  const list = [...items];
  let state = hashSeed(seed) || 1;
  for (let index = list.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const swap = state % (index + 1);
    [list[index], list[swap]] = [list[swap], list[index]];
  }
  return list;
}

/** Antwortoptionen: ähnliche Länge und gleicher Anfangsbuchstabe sind schwieriger – genau richtig. */
export function buildChoiceOptions(entry: VocabularyEntry, entries: VocabularyEntry[], answerOf: (entry: VocabularyEntry) => string, seed: string) {
  const correct = primaryVariant(answerOf(entry));
  const correctKeys = new Set(answerVariants(answerOf(entry)).map(normalizeAnswer));
  const seen = new Set(correctKeys);
  const pool: string[] = [];
  entries.forEach(other => {
    if (other.id === entry.id) return;
    const value = primaryVariant(answerOf(other));
    const key = normalizeAnswer(value);
    if (!key || seen.has(key)) return;
    seen.add(key);
    pool.push(value);
  });
  pool.sort((a, b) => {
    const scoreA = Math.abs(a.length - correct.length) + (a[0]?.toLowerCase() === correct[0]?.toLowerCase() ? -6 : 0);
    const scoreB = Math.abs(b.length - correct.length) + (b[0]?.toLowerCase() === correct[0]?.toLowerCase() ? -6 : 0);
    return scoreA - scoreB;
  });
  return seededShuffle([correct, ...pool.slice(0, 3)], seed);
}

/** Lernleiter: neu erkennen → schreiben → hören/diktieren; nie zweimal dieselbe Methode. */
export function pickLearnMode(options: { streak: number; lastMode?: LearnMode; canChoose: boolean; canDictate: boolean }): LearnMode {
  const { streak, lastMode, canChoose, canDictate } = options;
  let mode: LearnMode;
  if (streak <= 0) mode = canChoose ? 'choice' : 'type';
  else if (streak === 1) mode = 'type';
  else mode = canDictate ? 'dictation' : 'audio';

  if (mode !== lastMode) return mode;
  if (mode === 'choice') return 'type';
  if (mode === 'type') return canChoose ? 'choice' : 'type';
  return 'type';
}
