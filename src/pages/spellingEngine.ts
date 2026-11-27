import type { VocabularyProgress } from '../services/mockDb';
import {
  SPELLING_KINGDOMS,
  SPELLING_TASKS,
  type SpellingKingdomId,
  type SpellingKingdomMeta,
  type SpellingTask,
  type SpellingTaskKind,
} from './spellingData.ts';
import { seededShuffle } from './vocabularyLearn.ts';

export interface CustomSpellingWord {
  id: string;
  word: string;
  sentence?: string;
  hint?: string;
  createdAt: number;
}

export interface SpellingStoreState {
  progressByUser: Record<string, Record<string, VocabularyProgress>>;
  customWords: CustomSpellingWord[];
}

export interface SpellingQueueItem {
  task: SpellingTask;
  kind: SpellingTaskKind;
}

export interface KingdomProgressStats {
  kingdom: SpellingKingdomMeta;
  totalTasks: number;
  masteredTasks: number;
  hardTasks: number;
  crownUnlocked: boolean;
  progressPct: number;
}

export interface SpellingCheckResult {
  correct: boolean;
  feedback?: string;
}

export const SPELLING_MODE_LABEL: Record<SpellingTaskKind, string> = {
  gap: 'Lücken-Zauber',
  detective: 'Fehler-Detektiv',
  case_duel: 'Groß oder Klein?',
  root: 'Wort-Verwandte',
  dictation: 'Studio-Diktat',
};

export const SPELLING_MODE_HINT: Record<SpellingTaskKind, string> = {
  gap: 'Wähle die fehlenden Buchstaben!',
  detective: 'Welches Wort ist richtig geschrieben?',
  case_duel: 'Wird das Wort groß oder klein geschrieben?',
  root: 'Finde das verwandte Wort oder die Verlängerung!',
  dictation: 'Hör genau zu und schreibe das Wort richtig!',
};

export function createEmptySpellingStore(): SpellingStoreState {
  return {
    progressByUser: {},
    customWords: [],
  };
}

export function normalizeSpellingStore(raw?: Partial<SpellingStoreState> | null): SpellingStoreState {
  if (!raw || typeof raw !== 'object') return createEmptySpellingStore();
  const progressByUser: Record<string, Record<string, VocabularyProgress>> = {};
  if (raw.progressByUser && typeof raw.progressByUser === 'object') {
    for (const [uid, map] of Object.entries(raw.progressByUser)) {
      if (uid && map && typeof map === 'object') {
        progressByUser[uid] = { ...map };
      }
    }
  }
  const customWords: CustomSpellingWord[] = Array.isArray(raw.customWords)
    ? raw.customWords
        .filter(w => w && typeof w.word === 'string' && w.word.trim().length > 0)
        .map((w, idx) => ({
          id: typeof w.id === 'string' && w.id.trim() ? w.id.trim() : `cword_${idx + 1}`,
          word: w.word.trim(),
          sentence: typeof w.sentence === 'string' && w.sentence.trim() ? w.sentence.trim() : undefined,
          hint: typeof w.hint === 'string' && w.hint.trim() ? w.hint.trim() : undefined,
          createdAt: Number(w.createdAt) || Date.now(),
        }))
    : [];
  return { progressByUser, customWords };
}

/** Wandelt eigene Eltern-Diktatwörter in Aufgaben um (landen automatisch im Diktat-Abenteuer). */
export function customWordsToTasks(customWords: CustomSpellingWord[]): SpellingTask[] {
  return customWords.map(cw => ({
    id: `custom_${cw.id}`,
    kingdom: 'merk',
    word: cw.word,
    sentence: cw.sentence || `Schreibe das Lernwort: ${cw.word}.`,
    rule: cw.hint || `Übungswort deiner Eltern: Merke dir die genaue Schreibweise von „${cw.word}“.`,
    allowDictation: true,
  }));
}

export function getAllSpellingTasks(customWords: CustomSpellingWord[] = []): SpellingTask[] {
  return [...SPELLING_TASKS, ...customWordsToTasks(customWords)];
}

/**
 * Strenge deutsche Rechtschreib-Prüfung (exakte Groß-/Kleinschreibung, Umlaute & ß),
 * aber mit kindgerechtem Hinweis, falls z. B. nur Groß-/Kleinschreibung verwechselt wurde!
 */
export function checkGermanSpellingInput(given: string, expected: string): SpellingCheckResult {
  const cleanGiven = given.trim().replace(/\s+/g, ' ');
  const cleanExpected = expected.trim().replace(/\s+/g, ' ');
  if (!cleanGiven) return { correct: false };
  if (cleanGiven === cleanExpected) {
    return { correct: true };
  }
  if (cleanGiven.toLowerCase() === cleanExpected.toLowerCase()) {
    const startsUpper = cleanExpected[0] === cleanExpected[0].toUpperCase() && cleanExpected[0] !== cleanExpected[0].toLowerCase();
    return {
      correct: false,
      feedback: startsUpper
        ? `Fast! Achte auf die Großschreibung: „${cleanExpected}“ schreibt man groß!`
        : `Fast! „${cleanExpected}“ wird hier kleingeschrieben!`,
    };
  }
  return { correct: false };
}

/**
 * Ermittelt alle möglichen Aufgabenarten für eine Aufgabe und wählt per Zufall eine aus
 * (vermeidet direkte Wiederholungen — vom Kind nicht manipulierbar!).
 */
export function availableKindsForTask(task: SpellingTask, canSpeak: boolean): SpellingTaskKind[] {
  const kinds: SpellingTaskKind[] = [];
  if (task.gap) kinds.push('gap');
  if (task.detectiveWrong && task.detectiveWrong.length >= 2) kinds.push('detective');
  if (task.caseDuel) kinds.push('case_duel');
  if (task.rootQuiz) kinds.push('root');
  if (task.allowDictation !== false && canSpeak) kinds.push('dictation');
  if (kinds.length === 0) kinds.push('dictation');
  return kinds;
}

export function pickRandomSpellingKind(options: {
  task: SpellingTask;
  canSpeak: boolean;
  previousKind?: SpellingTaskKind;
  random?: () => number;
}): SpellingTaskKind {
  const { task, canSpeak, previousKind, random = Math.random } = options;
  const all = availableKindsForTask(task, canSpeak);
  const filtered = previousKind && all.length > 1 ? all.filter(k => k !== previousKind) : all;
  const candidates = filtered.length > 0 ? filtered : all;
  const idx = Math.floor(Math.max(0, Math.min(0.999999, random())) * candidates.length);
  return candidates[idx];
}

export function buildSpellingChoices(task: SpellingTask, kind: SpellingTaskKind, seed: string): string[] {
  if (kind === 'gap' && task.gap) {
    // Satzzeichen bleiben in fester Reihenfolge (. ? !), Buchstaben werden gemischt
    if (task.kingdom === 'satz') return [...task.gap.choices];
    return seededShuffle(task.gap.choices, seed);
  }
  if (kind === 'detective' && task.detectiveWrong) {
    return seededShuffle([task.word, ...task.detectiveWrong.slice(0, 3)], seed);
  }
  if (kind === 'case_duel' && task.caseDuel) {
    return seededShuffle([task.caseDuel.correct, task.caseDuel.wrong], seed);
  }
  if (kind === 'root' && task.rootQuiz) {
    return seededShuffle([task.rootQuiz.answer, ...task.rootQuiz.wrong.slice(0, 3)], seed);
  }
  return [];
}

/** Stellt eine zufällige Abenteuer-Runde (15 Aufgaben) mit nicht-manipulierbarem Aufgaben-Mix zusammen. */
export function buildSpellingSession(params: {
  allTasks: SpellingTask[];
  progressByTask: Record<string, VocabularyProgress>;
  kingdom?: SpellingKingdomId | 'all' | 'custom';
  onlyHard?: boolean;
  canSpeak: boolean;
  count?: number;
  nowMs?: number;
  random?: () => number;
}): SpellingQueueItem[] {
  const {
    allTasks,
    progressByTask,
    kingdom = 'all',
    onlyHard = false,
    canSpeak,
    count = 15,
    nowMs = Date.now(),
    random = Math.random,
  } = params;

  let filtered = allTasks;
  if (kingdom === 'custom') {
    filtered = allTasks.filter(t => t.id.startsWith('custom_'));
  } else if (kingdom !== 'all') {
    filtered = allTasks.filter(t => t.kingdom === kingdom);
  }

  if (onlyHard) {
    const hard = filtered.filter(t => {
      const p = progressByTask[t.id];
      return Boolean(p && p.wrongCount > 0 && p.streak < 2);
    });
    if (hard.length > 0) filtered = hard;
  }

  if (filtered.length === 0) return [];

  // Priorisiere fällige & schwere Aufgaben, mische aber innerhalb gleicher Priorität zufällig!
  const withScore = filtered.map(task => {
    const p = progressByTask[task.id];
    const isHard = Boolean(p && p.wrongCount > 0 && p.streak < 2);
    const isDue = !p?.nextReviewAt || p.nextReviewAt <= nowMs;
    const isNew = !p || (p.correctCount === 0 && p.wrongCount === 0);
    const priority = isHard ? 0 : isDue ? 1 : isNew ? 2 : 3;
    return { task, priority, jitter: random() };
  });

  withScore.sort((a, b) => (a.priority !== b.priority ? a.priority - b.priority : a.jitter - b.jitter));
  const selected = withScore.slice(0, Math.min(count, withScore.length)).map(item => item.task);

  const queue: SpellingQueueItem[] = [];
  let prevKind: SpellingTaskKind | undefined;
  for (const task of selected) {
    const kind = pickRandomSpellingKind({ task, canSpeak, previousKind: prevKind, random });
    queue.push({ task, kind });
    prevKind = kind;
  }
  return queue;
}

/** Berechnet den Fortschritt pro Königreich & wie viele der 8 Thron-Kronen bereits erobert wurden. */
export function computeKingdomStats(
  progressByTask: Record<string, VocabularyProgress>,
  allTasks: SpellingTask[] = SPELLING_TASKS
): {
  kingdoms: KingdomProgressStats[];
  crownsEarned: number;
  totalCrowns: number;
  throneUnlocked: boolean;
  totalHard: number;
  totalMastered: number;
} {
  let crownsEarned = 0;
  let totalHard = 0;
  let totalMastered = 0;

  const kingdoms: KingdomProgressStats[] = SPELLING_KINGDOMS.map(kingdom => {
    const tasks = allTasks.filter(t => t.kingdom === kingdom.id && !t.id.startsWith('custom_'));
    let mastered = 0;
    let hard = 0;
    for (const t of tasks) {
      const p = progressByTask[t.id];
      if ((p?.streak || 0) >= 2 || (p?.correctCount || 0) >= 2) mastered += 1;
      if (p && p.wrongCount > 0 && p.streak < 2) hard += 1;
    }
    const target = Math.min(kingdom.crownTarget, Math.max(1, tasks.length));
    const crownUnlocked = mastered >= target;
    if (crownUnlocked) crownsEarned += 1;
    totalHard += hard;
    totalMastered += mastered;

    return {
      kingdom,
      totalTasks: tasks.length,
      masteredTasks: mastered,
      hardTasks: hard,
      crownUnlocked,
      progressPct: Math.min(100, Math.round((mastered / target) * 100)),
    };
  });

  return {
    kingdoms,
    crownsEarned,
    totalCrowns: SPELLING_KINGDOMS.length,
    throneUnlocked: crownsEarned >= SPELLING_KINGDOMS.length,
    totalHard,
    totalMastered,
  };
}

/** Wandelt einen Rechtschreib-Aufgabentyp in den passenden Gamification-Modus für Tages-Quests um. */
export function spellingKindToGamificationMode(kind: SpellingTaskKind): 'choice' | 'type' | 'dictation' {
  if (kind === 'dictation') return 'dictation';
  return 'choice';
}
