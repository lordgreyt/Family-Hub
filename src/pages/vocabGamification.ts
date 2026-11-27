import type { VocabularyEntry, VocabularyProgress, VocabularySet } from '../services/mockDb';

export const VOCAB_POOL_ID = 'vocab_pool';

export type ChestTier = 'bronze' | 'silver' | 'gold' | 'rainbow';

export type VocabBadgeId =
  | 'words_300'
  | 'words_600'
  | 'words_1000'
  | 'words_2500'
  | 'first_chest'
  | 'chests_10'
  | 'gold_chest'
  | 'rainbow_chest'
  | 'combo_10'
  | 'streak_7'
  | 'streak_30'
  | 'week_champ'
  | 'hard_crusher';

export const VOCAB_SHOP_ICONS = [
  '⭐', '💶', '🎬', '🍦', '🎮', '🍕', '🎁', '📱',
  '🎧', '⚽', '🎨', '📖', '🧸', '🎟️', '🏖️', '💎',
] as const;

export interface VocabShopReward {
  id: string;
  title: string;
  emoji: string;
  diamonds: number;
  /** Optional: Wie viele Family-Hub-Sterne das Kind bei Einlösung automatisch aufs Sternekonto bekommt (0 = keine). */
  starsReward?: number;
}

export interface VocabGamificationSettings {
  /** Interne Schema-Version für sanfte Default-Migrationen (aktuell: 2). */
  settingsVersion?: number;
  /** Wie viele Diamanten für einen Standard-Umtausch benötigt werden (Standard: 20). */
  exchangeDiamonds: number;
  /** Gegenwert-Text für den Standard-Umtausch (z. B. "2,00 €" oder "30 Min. Spielzeit"). */
  exchangeLabel: string;
  /** Wie viele gelernte Vokabeln eine Schatztruhe füllen (Standard: 50). */
  chestSize: number;
  /** Tagesziel für die Tages-Flamme (Standard: 30). */
  dailyGoal: number;
  /** Wie viele aktive Tage pro Woche für den Wochen-Bonus (Standard: 7 = Mo–So). */
  weeklyGoalDays: number;
  /** Optionale bunte Wunsch-Karten im Schatz-Tausch-Shop. */
  shopItems: VocabShopReward[];
}

export interface VocabPendingChest {
  id: string;
  createdAt: number;
  blockSize: number;
  correctCount: number;
  accuracy: number; // 0..100
  tier: ChestTier;
  diamonds: number;
}

export type VocabDailyQuestKind =
  | 'answers_30'
  | 'answers_40'
  | 'correct_30'
  | 'hard_boss'
  | 'hard_boss_8'
  | 'unique_20'
  | 'chest_1'
  | 'combo_10'
  | 'combo_15'
  | 'active_12'
  | 'type_10'
  | 'audio_8'
  | 'correct_20';

export interface VocabDailyQuest {
  id: string;
  date: string; // YYYY-MM-DD
  kind: VocabDailyQuestKind;
  title: string;
  subtitle: string;
  emoji: string;
  actionHint?: 'hard' | 'quiz';
  target: number;
  progress: number;
  rewardDiamonds: number;
  completed: boolean;
}

export interface VocabDiamondHistoryItem {
  id: string;
  at: number;
  delta: number; // + gewonnen, - eingetauscht
  reason: string;
  kind: 'chest' | 'streak' | 'week' | 'quest' | 'level' | 'exchange';
}

export interface VocabChildGamification {
  userId: string;
  diamonds: number;
  lifetimeDiamonds: number;
  totalAnswers: number;
  totalCorrect: number;
  lastRewardedLevel: number;
  chestsOpened: number;
  hardWordsMastered: number;

  // Aktueller 50er-Block für die nächste Schatztruhe
  blockCount: number;
  blockCorrect: number;
  blockWordCounts: Record<string, number>;
  pendingChests: VocabPendingChest[];

  // Combo
  currentCombo: number;
  bestCombo: number;

  // Tages- & Wochen-Streaks + Eis-Schild
  dailyStreak: number;
  bestDailyStreak: number;
  lastCompletedDay: string | null; // YYYY-MM-DD (letzter Tag mit erreichtem Tagesziel)
  todayDate: string | null; // YYYY-MM-DD
  todayCount: number;
  todayUniqueCorrectIds: string[];
  claimedDayMilestones: number[]; // z. B. [3, 7]

  weeklyStreak: number;
  bestWeeklyStreak: number;
  currentWeekKey: string | null; // YYYY-Www (ISO-Woche)
  weekActiveDays: string[]; // YYYY-MM-DD Tage mit erreichtem Tagesziel in currentWeekKey
  lastCompletedWeekKey: string | null;
  weekBonusClaimedFor: string | null;

  /** Eis-Schild: 1x pro Woche automatisch gratis bei 1 verpasstem Tag. */
  freezeWeekKey: string | null;
  freezeUsedThisWeek: boolean;
  lastFreezeDay: string | null;

  // Tages-Quests (3 pro Tag: 30er-Fleiß, Schwer-Boss, wechselnde Challenge) & Abzeichen
  dailyQuests: VocabDailyQuest[];
  badges: VocabBadgeId[];
  history: VocabDiamondHistoryItem[];
}

export interface VocabDiamondExchangeRequest {
  id: string;
  userId: string;
  userName: string;
  diamonds: number;
  rewardLabel: string;
  /** Optional: Family-Hub-Sterne, die bei Eltern-Freigabe automatisch gutgeschrieben werden. */
  starsReward?: number;
  note?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: number;
  resolvedAt?: number;
  resolvedBy?: string;
}

export interface VocabGamificationState {
  settings: VocabGamificationSettings;
  profilesByUser: Record<string, VocabChildGamification>;
  exchangeRequests: VocabDiamondExchangeRequest[];
}

export interface VocabRankInfo {
  level: number;
  minLevel: number;
  maxLevel: number;
  title: string;
  emoji: string;
  color: string;
  minAnswers: number;
  nextAnswers: number | null;
}

export interface VocabLevelProgress {
  level: number;
  maxLevel: number;
  totalXp: number;
  currentLevelXp: number;
  xpForNextLevel: number;
  progressPct: number;
  wordsRemainingForNextLevel: number;
  isMaxLevel: boolean;
  title: string;
  emoji: string;
  color: string;
}

export interface VocabBadgeMeta {
  id: VocabBadgeId;
  title: string;
  description: string;
  emoji: string;
  color: string;
}

export interface AnswerGamificationOutcome {
  profile: VocabChildGamification;
  countedForChest: boolean;
  newChest: VocabPendingChest | null;
  newLevel: number | null;
  earnedBonusDiamonds: number;
  bonusEvents: string[];
  newBadges: VocabBadgeId[];
  freezeTriggered: boolean;
}

export const DEFAULT_GAMIFICATION_SETTINGS: VocabGamificationSettings = {
  settingsVersion: 2,
  exchangeDiamonds: 20,
  exchangeLabel: '2,00 €',
  chestSize: 50,
  dailyGoal: 30,
  weeklyGoalDays: 7,
  shopItems: [
    { id: 'shop_stars', title: '25 Sterne aufs Konto', emoji: '⭐', diamonds: 20, starsReward: 25 },
    { id: 'shop_pocket', title: '2,00 € Taschengeld', emoji: '💶', diamonds: 20 },
    { id: 'shop_movie', title: 'Filmabend aussuchen', emoji: '🎬', diamonds: 30 },
    { id: 'shop_icecream', title: 'Eis essen gehen', emoji: '🍦', diamonds: 45 },
  ],
};

export const CHEST_TIERS: Record<
  ChestTier,
  { label: string; minAccuracy: number; diamonds: number; accent: string; glow: string; badgeBg: string }
> = {
  bronze: {
    label: 'Bronze-Truhe',
    minAccuracy: 0,
    diamonds: 3,
    accent: '#D97706',
    glow: 'rgba(217, 119, 6, 0.45)',
    badgeBg: '#FEF3C7',
  },
  silver: {
    label: 'Silber-Truhe',
    minAccuracy: 65,
    diamonds: 5,
    accent: '#64748B',
    glow: 'rgba(148, 163, 184, 0.55)',
    badgeBg: '#F1F5F9',
  },
  gold: {
    label: 'Gold-Truhe',
    minAccuracy: 85,
    diamonds: 8,
    accent: '#F59E0B',
    glow: 'rgba(250, 204, 21, 0.65)',
    badgeBg: '#FEF9C3',
  },
  rainbow: {
    label: 'Regenbogen-Truhe',
    minAccuracy: 95,
    diamonds: 12,
    accent: '#EC4899',
    glow: 'rgba(236, 72, 153, 0.55)',
    badgeBg: '#FCE7F3',
  },
};

export const DAY_STREAK_MILESTONES: Array<{ days: number; diamonds: number }> = [
  { days: 3, diamonds: 2 },
  { days: 7, diamonds: 5 },
  { days: 14, diamonds: 10 },
  { days: 30, diamonds: 20 },
];

export const WEEKLY_BONUS_DIAMONDS = 5;
export const MAX_SAME_WORD_PER_BLOCK = 3;
export const MAX_VOCAB_LEVEL = 60;
export const XP_PER_CORRECT_WORD = 10;
export const LEVEL_UP_DIAMONDS = 1;

/** XP-Bedarf für den Aufstieg von `level` nach `level + 1` (Lvl 1→2 = 400 XP / 40 richtige Wörter, wächst um +100 XP pro Level). */
export function xpNeededForLevelStep(level: number): number {
  return 400 + Math.max(0, level - 1) * 100;
}

export const VOCAB_RANKS: VocabRankInfo[] = [
  { level: 1, minLevel: 1, maxLevel: 9, title: 'Wort-Entdecker', emoji: '🧭', color: '#38BDF8', minAnswers: 0, nextAnswers: 720 },
  { level: 2, minLevel: 10, maxLevel: 19, title: 'Schatzsucher', emoji: '🗺️', color: '#10B981', minAnswers: 720, nextAnswers: 2470 },
  { level: 3, minLevel: 20, maxLevel: 29, title: 'Sprach-Ninja', emoji: '🥷', color: '#A855F7', minAnswers: 2470, nextAnswers: 5220 },
  { level: 4, minLevel: 30, maxLevel: 39, title: 'Vokabel-Magier', emoji: '🧙', color: '#F59E0B', minAnswers: 5220, nextAnswers: 8970 },
  { level: 5, minLevel: 40, maxLevel: 49, title: 'Drachen-Bezwinger', emoji: '🐉', color: '#F43F5E', minAnswers: 8970, nextAnswers: 13720 },
  { level: 6, minLevel: 50, maxLevel: 60, title: 'Diamant-Legende', emoji: '👑', color: '#EC4899', minAnswers: 13720, nextAnswers: null },
];

export const VOCAB_BADGES: VocabBadgeMeta[] = [
  { id: 'words_300', title: '300er-Entdecker', description: '300 Vokabeln erfolgreich gelöst', emoji: '🥉', color: '#10B981' },
  { id: 'words_600', title: '600er-Champion', description: '600 Vokabeln erfolgreich gelöst', emoji: '🥈', color: '#38BDF8' },
  { id: 'words_1000', title: '1.000er-Meister', description: '1.000 Vokabeln erfolgreich gelöst', emoji: '🥇', color: '#F59E0B' },
  { id: 'words_2500', title: '2.500er-Legende', description: '2.500 Vokabeln erfolgreich gelöst', emoji: '👑', color: '#EC4899' },
  { id: 'first_chest', title: 'Schatzfinder', description: 'Erste Schatztruhe geöffnet', emoji: '🧰', color: '#F59E0B' },
  { id: 'chests_10', title: 'Truhen-König', description: '10 Schatztruhen geöffnet (500+ Wörter)', emoji: '💎', color: '#0EA5E9' },
  { id: 'gold_chest', title: 'Gold-Jäger', description: 'Mindestens 85 % in einem Truhen-Block', emoji: '🏆', color: '#EAB308' },
  { id: 'rainbow_chest', title: 'Regenbogen-Meister', description: 'Mindestens 95 % in einem Truhen-Block', emoji: '🌈', color: '#EC4899' },
  { id: 'combo_10', title: 'Blitz-Serie', description: '10 Vokabeln am Stück richtig', emoji: '⚡', color: '#F97316' },
  { id: 'streak_7', title: '7-Tage-Flamme', description: '7 Tage hintereinander gelernt', emoji: '🔥', color: '#EF4444' },
  { id: 'streak_30', title: '30-Tage-Legende', description: '30 Tage hintereinander gelernt', emoji: '🌋', color: '#F43F5E' },
  { id: 'week_champ', title: 'Wochen-Champion', description: 'Ein volles Wochenziel geschafft', emoji: '📅', color: '#6366F1' },
  { id: 'hard_crusher', title: 'Problemwort-Held', description: '50 schwierige Wörter gemeistert', emoji: '🛡️', color: '#06B6D4' },
];

const VALID_BADGE_IDS = new Set<string>(VOCAB_BADGES.map(b => b.id));

/** Liefert den aktuellen Fortschritt (current / target) für zählbare Abzeichen. */
export function getBadgeProgress(
  badgeId: VocabBadgeId,
  profile: VocabChildGamification
): { current: number; target: number } | null {
  switch (badgeId) {
    case 'words_300':
      return { current: Math.min(300, profile.totalCorrect), target: 300 };
    case 'words_600':
      return { current: Math.min(600, profile.totalCorrect), target: 600 };
    case 'words_1000':
      return { current: Math.min(1000, profile.totalCorrect), target: 1000 };
    case 'words_2500':
      return { current: Math.min(2500, profile.totalCorrect), target: 2500 };
    case 'chests_10':
      return { current: Math.min(10, profile.chestsOpened), target: 10 };
    case 'combo_10':
      return { current: Math.min(10, profile.bestCombo), target: 10 };
    case 'streak_7':
      return { current: Math.min(7, profile.bestDailyStreak), target: 7 };
    case 'streak_30':
      return { current: Math.min(30, profile.bestDailyStreak), target: 30 };
    case 'hard_crusher':
      return { current: Math.min(50, profile.hardWordsMastered), target: 50 };
    default:
      return null;
  }
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function localDayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDayKey(dayKey: string): Date {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

export function diffCalendarDays(fromDay: string, toDay: string): number {
  const a = parseDayKey(fromDay);
  const b = parseDayKey(toDay);
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

export function isoWeekKey(date: Date = new Date()): string {
  const tmp = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  const day = tmp.getDay() || 7; // Mo=1 .. So=7
  tmp.setDate(tmp.getDate() + 4 - day);
  const yearStart = new Date(tmp.getFullYear(), 0, 1, 12, 0, 0);
  const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000) + 1) / 7);
  return `${tmp.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function previousIsoWeekKey(date: Date = new Date()): string {
  const prev = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 7, 12, 0, 0);
  return isoWeekKey(prev);
}

/** Liefert die 7 Tage (Mo–So) der aktuellen Woche inkl. Label & Key. */
export function currentWeekDays(date: Date = new Date()): Array<{ key: string; short: string; isToday: boolean }> {
  const today = localDayKey(date);
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  const day = base.getDay() || 7; // Mo=1 .. So=7
  const monday = new Date(base);
  monday.setDate(base.getDate() - (day - 1));
  const labels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  return labels.map((short, idx) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + idx);
    const key = localDayKey(d);
    return { key, short, isToday: key === today };
  });
}

export function getRankForLevel(level: number): VocabRankInfo {
  let current = VOCAB_RANKS[0];
  for (const rank of VOCAB_RANKS) {
    if (level >= rank.minLevel) current = rank;
  }
  return current;
}

/** Berechnet das aktuelle Level (1..60) und die XP innerhalb des aktuellen Levels aus `totalCorrect`. */
export function getLevelProgress(totalCorrect: number): VocabLevelProgress {
  const safeCorrect = Math.max(0, Math.floor(Number(totalCorrect) || 0));
  const totalXp = safeCorrect * XP_PER_CORRECT_WORD;
  let level = 1;
  let remainingXp = totalXp;

  while (level < MAX_VOCAB_LEVEL) {
    const needed = xpNeededForLevelStep(level);
    if (remainingXp < needed) {
      const tier = getRankForLevel(level);
      const progressPct = Math.min(100, Math.round((remainingXp / needed) * 100));
      const wordsRemainingForNextLevel = Math.max(1, Math.ceil((needed - remainingXp) / XP_PER_CORRECT_WORD));
      return {
        level,
        maxLevel: MAX_VOCAB_LEVEL,
        totalXp,
        currentLevelXp: remainingXp,
        xpForNextLevel: needed,
        progressPct,
        wordsRemainingForNextLevel,
        isMaxLevel: false,
        title: tier.title,
        emoji: tier.emoji,
        color: tier.color,
      };
    }
    remainingXp -= needed;
    level += 1;
  }

  const maxTier = getRankForLevel(MAX_VOCAB_LEVEL);
  const lastStep = xpNeededForLevelStep(MAX_VOCAB_LEVEL - 1);
  return {
    level: MAX_VOCAB_LEVEL,
    maxLevel: MAX_VOCAB_LEVEL,
    totalXp,
    currentLevelXp: lastStep,
    xpForNextLevel: lastStep,
    progressPct: 100,
    wordsRemainingForNextLevel: 0,
    isMaxLevel: true,
    title: maxTier.title,
    emoji: maxTier.emoji,
    color: maxTier.color,
  };
}

export function getRankForAnswers(totalCorrect: number): VocabRankInfo {
  return getRankForLevel(getLevelProgress(totalCorrect).level);
}

export function determineChestTier(accuracy: number): { tier: ChestTier; diamonds: number } {
  if (accuracy >= 95) return { tier: 'rainbow', diamonds: CHEST_TIERS.rainbow.diamonds };
  if (accuracy >= 85) return { tier: 'gold', diamonds: CHEST_TIERS.gold.diamonds };
  if (accuracy >= 65) return { tier: 'silver', diamonds: CHEST_TIERS.silver.diamonds };
  return { tier: 'bronze', diamonds: CHEST_TIERS.bronze.diamonds };
}

export function createDailyQuests(dayKey: string, minDailyTarget = 30): VocabDailyQuest[] {
  const daily30 = Math.max(30, Math.round(minDailyTarget));
  const daily40 = Math.max(40, daily30 + 10);
  const dayIndex = Math.max(0, Math.floor(parseDayKey(dayKey).getTime() / (24 * 60 * 60 * 1000)));

  // Slot 1 (3 Fleiß-Missionen, immer >= 30 Vokabeln)
  const slot1Pool: VocabDailyQuest[] = [
    {
      id: `${dayKey}_answers30`,
      date: dayKey,
      kind: 'answers_30',
      title: `Tages-Training: ${daily30} Vokabeln üben`,
      subtitle: 'Bleib dran und fülle deine Schatztruhe!',
      emoji: '🔥',
      actionHint: 'quiz',
      target: daily30,
      progress: 0,
      rewardDiamonds: 2,
      completed: false,
    },
    {
      id: `${dayKey}_answers40`,
      date: dayKey,
      kind: 'answers_40',
      title: `Turbo-Marathon: ${daily40} Vokabeln üben`,
      subtitle: 'Extra-Ausdauer für Extra-Diamanten!',
      emoji: '🚀',
      actionHint: 'quiz',
      target: daily40,
      progress: 0,
      rewardDiamonds: 3,
      completed: false,
    },
    {
      id: `${dayKey}_correct30`,
      date: dayKey,
      kind: 'correct_30',
      title: `Gold-Treffer: ${daily30} richtige Antworten`,
      subtitle: 'Zeig, wie sicher dein Wortschatz sitzt!',
      emoji: '🏆',
      actionHint: 'quiz',
      target: daily30,
      progress: 0,
      rewardDiamonds: 3,
      completed: false,
    },
  ];

  // Slot 2 (4 Boss-, Entdecker- & Truhen-Missionen)
  const slot2Pool: VocabDailyQuest[] = [
    {
      id: `${dayKey}_boss5`,
      date: dayKey,
      kind: 'hard_boss',
      title: 'Boss-Kampf: 5 schwere Wörter meistern',
      subtitle: 'Besiege Wörter, die du dir schwer merken kannst!',
      emoji: '🐉',
      actionHint: 'hard',
      target: 5,
      progress: 0,
      rewardDiamonds: 2,
      completed: false,
    },
    {
      id: `${dayKey}_unique20`,
      date: dayKey,
      kind: 'unique_20',
      title: 'Welt-Entdecker: 20 verschiedene Wörter',
      subtitle: 'Löse heute 20 unterschiedliche Vokabeln richtig!',
      emoji: '🦉',
      actionHint: 'quiz',
      target: 20,
      progress: 0,
      rewardDiamonds: 2,
      completed: false,
    },
    {
      id: `${dayKey}_boss8`,
      date: dayKey,
      kind: 'hard_boss_8',
      title: 'Drachen-Jagd: 8 schwere Wörter besiegen',
      subtitle: 'Der große Endgegner wartet auf dich!',
      emoji: '🐉',
      actionHint: 'hard',
      target: 8,
      progress: 0,
      rewardDiamonds: 3,
      completed: false,
    },
    {
      id: `${dayKey}_chest1`,
      date: dayKey,
      kind: 'chest_1',
      title: 'Schatzjäger: 1 Schatztruhe heute knacken',
      subtitle: 'Mach heute einen vollen 50er-Truhenblock voll!',
      emoji: '🧰',
      actionHint: 'quiz',
      target: 1,
      progress: 0,
      rewardDiamonds: 2,
      completed: false,
    },
  ];

  // Slot 3 (5 Combo- & Skill-Missionen; lcm(3, 4, 5) = 60 verschiedene Tages-Kombinationen!)
  const slot3Pool: VocabDailyQuest[] = [
    {
      id: `${dayKey}_combo10`,
      date: dayKey,
      kind: 'combo_10',
      title: 'Blitz-Serie: 10 Richtige am Stück',
      subtitle: 'Bleib fokussiert und knacke die 10er-Combo!',
      emoji: '⚡',
      actionHint: 'quiz',
      target: 10,
      progress: 0,
      rewardDiamonds: 2,
      completed: false,
    },
    {
      id: `${dayKey}_active12`,
      date: dayKey,
      kind: 'active_12',
      title: 'Profi-Training: 12× Schreiben oder Hören',
      subtitle: 'Tippe oder höre 12 Wörter richtig!',
      emoji: '🎧',
      actionHint: 'quiz',
      target: 12,
      progress: 0,
      rewardDiamonds: 2,
      completed: false,
    },
    {
      id: `${dayKey}_type10`,
      date: dayKey,
      kind: 'type_10',
      title: 'Schreib-Champion: 10 Wörter selbst tippen',
      subtitle: 'Beweise deine Rechtschreibung im Schreib-Modus!',
      emoji: '✍️',
      actionHint: 'quiz',
      target: 10,
      progress: 0,
      rewardDiamonds: 2,
      completed: false,
    },
    {
      id: `${dayKey}_combo15`,
      date: dayKey,
      kind: 'combo_15',
      title: 'Mega-Blitz: 15 Richtige am Stück',
      subtitle: 'Schaffst du die legendäre 15er-Serie ohne Fehler?',
      emoji: '⚡',
      actionHint: 'quiz',
      target: 15,
      progress: 0,
      rewardDiamonds: 3,
      completed: false,
    },
    {
      id: `${dayKey}_audio8`,
      date: dayKey,
      kind: 'audio_8',
      title: 'Ohren-Profi: 8 Wörter im Hör-Modus',
      subtitle: 'Löse 8 Wörter im Hören- oder Diktat-Modus!',
      emoji: '🔊',
      actionHint: 'quiz',
      target: 8,
      progress: 0,
      rewardDiamonds: 2,
      completed: false,
    },
  ];

  return [
    slot1Pool[dayIndex % slot1Pool.length],
    slot2Pool[dayIndex % slot2Pool.length],
    slot3Pool[dayIndex % slot3Pool.length],
  ];
}

export function normalizeGamificationSettings(raw?: Partial<VocabGamificationSettings> | null): VocabGamificationSettings {
  const clampInt = (v: unknown, fallback: number, min: number, max: number) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
  };

  const shopItems = Array.isArray(raw?.shopItems)
    ? raw!.shopItems
        .filter(item => item && typeof item.title === 'string' && item.title.trim())
        .map((item, idx) => {
          const stars = clampInt(item.starsReward, 0, 0, 1000);
          return {
            id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `shop_${idx + 1}`,
            title: item.title.trim(),
            emoji: typeof item.emoji === 'string' && item.emoji.trim() ? item.emoji.trim() : '🎁',
            diamonds: clampInt(item.diamonds, 20, 1, 500),
            ...(stars > 0 ? { starsReward: stars } : {}),
          };
        })
    : DEFAULT_GAMIFICATION_SETTINGS.shopItems;

  const isLegacySchema = !raw?.settingsVersion || Number(raw.settingsVersion) < 2;
  const rawDailyGoal = isLegacySchema && Number(raw?.dailyGoal) === 10 ? 30 : raw?.dailyGoal;
  const rawWeeklyGoal = isLegacySchema && Number(raw?.weeklyGoalDays) === 5 ? 7 : raw?.weeklyGoalDays;

  return {
    settingsVersion: 2,
    exchangeDiamonds: clampInt(raw?.exchangeDiamonds, DEFAULT_GAMIFICATION_SETTINGS.exchangeDiamonds, 1, 500),
    exchangeLabel:
      typeof raw?.exchangeLabel === 'string' && raw.exchangeLabel.trim()
        ? raw.exchangeLabel.trim()
        : DEFAULT_GAMIFICATION_SETTINGS.exchangeLabel,
    chestSize: clampInt(raw?.chestSize, DEFAULT_GAMIFICATION_SETTINGS.chestSize, 5, 200),
    dailyGoal: clampInt(rawDailyGoal, DEFAULT_GAMIFICATION_SETTINGS.dailyGoal, 1, 100),
    weeklyGoalDays: clampInt(rawWeeklyGoal, DEFAULT_GAMIFICATION_SETTINGS.weeklyGoalDays, 1, 7),
    shopItems,
  };
}

export function createEmptyChildProfile(userId: string, now: Date = new Date()): VocabChildGamification {
  const today = localDayKey(now);
  const week = isoWeekKey(now);
  return {
    userId,
    diamonds: 0,
    lifetimeDiamonds: 0,
    totalAnswers: 0,
    totalCorrect: 0,
    lastRewardedLevel: 1,
    chestsOpened: 0,
    hardWordsMastered: 0,
    blockCount: 0,
    blockCorrect: 0,
    blockWordCounts: {},
    pendingChests: [],
    currentCombo: 0,
    bestCombo: 0,
    dailyStreak: 0,
    bestDailyStreak: 0,
    lastCompletedDay: null,
    todayDate: today,
    todayCount: 0,
    todayUniqueCorrectIds: [],
    claimedDayMilestones: [],
    weeklyStreak: 0,
    bestWeeklyStreak: 0,
    currentWeekKey: week,
    weekActiveDays: [],
    lastCompletedWeekKey: null,
    weekBonusClaimedFor: null,
    freezeWeekKey: week,
    freezeUsedThisWeek: false,
    lastFreezeDay: null,
    dailyQuests: createDailyQuests(today),
    badges: [],
    history: [],
  };
}

export function normalizeChildProfile(
  userId: string,
  raw?: Partial<VocabChildGamification> | null,
  now: Date = new Date()
): VocabChildGamification {
  const base = createEmptyChildProfile(userId, now);
  if (!raw || typeof raw !== 'object') return base;

  const today = localDayKey(now);
  const week = isoWeekKey(now);

  const sameDay = raw.todayDate === today;
  const sameWeek = raw.currentWeekKey === week;

  // Prüfe, ob ein älterer Streak abgelaufen ist (ohne Eis-Schild-Mutation beim reinen Lesen)
  let dailyStreak = Number.isFinite(Number(raw.dailyStreak)) ? Math.max(0, Number(raw.dailyStreak)) : 0;
  if (raw.lastCompletedDay) {
    const gap = diffCalendarDays(raw.lastCompletedDay, today);
    // Wenn mehr als 2 Tage dazwischen liegen (oder 2 Tage ohne Eis-Schild), ist der Streak abgelaufen
    const canShield = raw.freezeWeekKey === week ? !raw.freezeUsedThisWeek : true;
    if (gap > 2 || (gap === 2 && !canShield)) {
      dailyStreak = 0;
    }
  }

  let weeklyStreak = Number.isFinite(Number(raw.weeklyStreak)) ? Math.max(0, Number(raw.weeklyStreak)) : 0;
  const prevWeek = previousIsoWeekKey(now);
  if (raw.lastCompletedWeekKey && raw.lastCompletedWeekKey !== week && raw.lastCompletedWeekKey !== prevWeek) {
    weeklyStreak = 0;
  }

  const validTodayQuests =
    Array.isArray(raw.dailyQuests) &&
    raw.dailyQuests.length >= 2 &&
    raw.dailyQuests.every(q => q && q.date === today && typeof q.id === 'string');
  const dailyQuests: VocabDailyQuest[] = validTodayQuests
    ? raw.dailyQuests!.map(q =>
        (q as unknown as { kind: string }).kind === 'combo_8'
          ? {
              ...q,
              id: `${today}_combo10`,
              kind: 'combo_10' as const,
              title: 'Blitz-Serie: 10 Richtige am Stück',
              subtitle: 'Bleib fokussiert und knacke die 10er-Combo!',
              target: 10,
              completed: q.progress >= 10,
            }
          : q
      )
    : createDailyQuests(today);

  return {
    ...base,
    ...raw,
    userId,
    diamonds: Math.max(0, Number(raw.diamonds) || 0),
    lifetimeDiamonds: Math.max(0, Number(raw.lifetimeDiamonds) || 0),
    totalAnswers: Math.max(0, Number(raw.totalAnswers) || 0),
    totalCorrect: Math.max(0, Number(raw.totalCorrect) || 0),
    lastRewardedLevel:
      Number.isFinite(Number(raw.lastRewardedLevel)) && Number(raw.lastRewardedLevel) >= 1
        ? Math.min(MAX_VOCAB_LEVEL, Math.floor(Number(raw.lastRewardedLevel)))
        : getLevelProgress(Math.max(0, Number(raw.totalCorrect) || 0)).level,
    chestsOpened: Math.max(0, Number(raw.chestsOpened) || 0),
    hardWordsMastered: Math.max(0, Number(raw.hardWordsMastered) || 0),
    blockCount: Math.max(0, Number(raw.blockCount) || 0),
    blockCorrect: Math.max(0, Number(raw.blockCorrect) || 0),
    blockWordCounts: raw.blockWordCounts && typeof raw.blockWordCounts === 'object' ? { ...raw.blockWordCounts } : {},
    pendingChests: Array.isArray(raw.pendingChests) ? raw.pendingChests.filter(Boolean) : [],
    currentCombo: Math.max(0, Number(raw.currentCombo) || 0),
    bestCombo: Math.max(0, Number(raw.bestCombo) || 0),
    dailyStreak,
    bestDailyStreak: Math.max(dailyStreak, Number(raw.bestDailyStreak) || 0),
    lastCompletedDay: typeof raw.lastCompletedDay === 'string' ? raw.lastCompletedDay : null,
    todayDate: today,
    todayCount: sameDay ? Math.max(0, Number(raw.todayCount) || 0) : 0,
    todayUniqueCorrectIds:
      sameDay && Array.isArray(raw.todayUniqueCorrectIds)
        ? Array.from(new Set(raw.todayUniqueCorrectIds.filter(id => typeof id === 'string')))
        : [],
    claimedDayMilestones: Array.isArray(raw.claimedDayMilestones)
      ? raw.claimedDayMilestones.map(Number).filter(Number.isFinite)
      : [],
    weeklyStreak,
    bestWeeklyStreak: Math.max(weeklyStreak, Number(raw.bestWeeklyStreak) || 0),
    currentWeekKey: week,
    weekActiveDays: sameWeek && Array.isArray(raw.weekActiveDays) ? Array.from(new Set(raw.weekActiveDays)) : [],
    lastCompletedWeekKey: typeof raw.lastCompletedWeekKey === 'string' ? raw.lastCompletedWeekKey : null,
    weekBonusClaimedFor: typeof raw.weekBonusClaimedFor === 'string' ? raw.weekBonusClaimedFor : null,
    freezeWeekKey: week,
    freezeUsedThisWeek: raw.freezeWeekKey === week ? Boolean(raw.freezeUsedThisWeek) : false,
    lastFreezeDay: typeof raw.lastFreezeDay === 'string' ? raw.lastFreezeDay : null,
    dailyQuests,
    badges: Array.isArray(raw.badges)
      ? (Array.from(new Set(raw.badges)).filter(b => VALID_BADGE_IDS.has(b)) as VocabBadgeId[])
      : [],
    history: Array.isArray(raw.history) ? raw.history.slice(0, 60) : [],
  };
}

export function normalizeGamificationState(
  raw?: Partial<VocabGamificationState> | null,
  now: Date = new Date()
): VocabGamificationState {
  const settings = normalizeGamificationSettings(raw?.settings);
  const profilesByUser: Record<string, VocabChildGamification> = {};
  if (raw?.profilesByUser && typeof raw.profilesByUser === 'object') {
    for (const [uid, prof] of Object.entries(raw.profilesByUser)) {
      if (uid && prof) {
        profilesByUser[uid] = normalizeChildProfile(uid, prof, now);
      }
    }
  }
  const exchangeRequests = Array.isArray(raw?.exchangeRequests)
    ? raw.exchangeRequests.filter(r => r && typeof r.id === 'string' && typeof r.userId === 'string')
    : [];

  return { settings, profilesByUser, exchangeRequests };
}

function appendHistory(
  history: VocabDiamondHistoryItem[],
  item: Omit<VocabDiamondHistoryItem, 'id'>
): VocabDiamondHistoryItem[] {
  return [{ id: makeId('hist'), ...item }, ...history].slice(0, 60);
}

/**
 * Verarbeitet eine beantwortete Vokabel im Gamification-System:
 * - Aktualisiert Combo, Tagesziel, Tages-/Wochen-Streak (+ Eis-Schild), Tages-Quest, Abzeichen
 * - Füllt den 50er-Block (mit Fairness-Cap: max. 3x gleiches Wort pro Block)
 * - Erzeugt bei vollem Block eine neue wartende Schatztruhe mit leistungsabhängigen Diamanten
 */
export function recordGamificationAnswer(params: {
  profile: VocabChildGamification;
  settings: VocabGamificationSettings;
  entryId: string;
  correct: boolean;
  wasHardOrNew?: boolean;
  mode?: 'choice' | 'type' | 'audio' | 'dictation';
  now?: Date;
}): AnswerGamificationOutcome {
  const now = params.now || new Date();
  const today = localDayKey(now);
  const week = isoWeekKey(now);
  const prevWeek = previousIsoWeekKey(now);
  const p = normalizeChildProfile(params.profile.userId, params.profile, now);

  let earnedBonusDiamonds = 0;
  const bonusEvents: string[] = [];
  const newlyUnlockedBadges: VocabBadgeId[] = [];
  let freezeTriggered = false;
  let newChest: VocabPendingChest | null = null;
  let newLevel: number | null = null;

  const grantBadge = (badge: VocabBadgeId) => {
    if (!p.badges.includes(badge)) {
      p.badges = [...p.badges, badge];
      newlyUnlockedBadges.push(badge);
    }
  };

  // 1. Grundzähler, Combo & 60-Level-XP-Aufstieg (+1 💎 pro Level-Up)
  const prevLevel = Math.max(p.lastRewardedLevel || 1, getLevelProgress(p.totalCorrect).level);
  p.totalAnswers += 1;
  if (params.correct) {
    p.totalCorrect += 1;
    p.currentCombo += 1;
    if (p.currentCombo > p.bestCombo) p.bestCombo = p.currentCombo;
    if (params.wasHardOrNew) p.hardWordsMastered += 1;
    if (params.entryId && !p.todayUniqueCorrectIds.includes(params.entryId)) {
      p.todayUniqueCorrectIds = [...p.todayUniqueCorrectIds, params.entryId];
    }

    const afterLevel = getLevelProgress(p.totalCorrect).level;
    if (afterLevel > prevLevel) {
      const gainedLevels = afterLevel - prevLevel;
      const levelDiamonds = gainedLevels * LEVEL_UP_DIAMONDS;
      p.lastRewardedLevel = afterLevel;
      p.diamonds += levelDiamonds;
      p.lifetimeDiamonds += levelDiamonds;
      earnedBonusDiamonds += levelDiamonds;
      newLevel = afterLevel;
      bonusEvents.push(`🎉 LEVEL UP! Level ${afterLevel} erreicht! +${levelDiamonds} 💎`);
      p.history = appendHistory(p.history, {
        at: now.getTime(),
        delta: levelDiamonds,
        reason: `Level ${afterLevel} erreicht!`,
        kind: 'level',
      });
    }
  } else {
    p.currentCombo = 0;
  }

  if (p.currentCombo >= 10) grantBadge('combo_10');
  if (p.totalCorrect >= 300) grantBadge('words_300');
  if (p.totalCorrect >= 600) grantBadge('words_600');
  if (p.totalCorrect >= 1000) grantBadge('words_1000');
  if (p.totalCorrect >= 2500) grantBadge('words_2500');
  if (p.hardWordsMastered >= 50) grantBadge('hard_crusher');

  // 2. 50er-Block für Schatztruhe (vor Quests, damit die Schatzjäger-Quest sofort beim Truhenfund auslöst)
  const seenInBlock = p.blockWordCounts[params.entryId] || 0;
  const countedForChest = seenInBlock < MAX_SAME_WORD_PER_BLOCK;
  if (countedForChest) {
    p.blockWordCounts = { ...p.blockWordCounts, [params.entryId]: seenInBlock + 1 };
    p.blockCount += 1;
    if (params.correct) p.blockCorrect += 1;

    if (p.blockCount >= params.settings.chestSize) {
      const accuracy = Math.round((p.blockCorrect / Math.max(1, p.blockCount)) * 100);
      const { tier, diamonds } = determineChestTier(accuracy);
      newChest = {
        id: makeId('chest'),
        createdAt: now.getTime(),
        blockSize: p.blockCount,
        correctCount: p.blockCorrect,
        accuracy,
        tier,
        diamonds,
      };
      p.pendingChests = [...p.pendingChests, newChest];
      p.blockCount = 0;
      p.blockCorrect = 0;
      p.blockWordCounts = {};
    }
  }

  // 3. Tages-Quests Fortschritt (alle 12 rotierenden Missionen)
  const isActiveInputMode = params.mode === 'type' || params.mode === 'audio' || params.mode === 'dictation';
  const isAudioMode = params.mode === 'audio' || params.mode === 'dictation';
  const isTypeMode = params.mode === 'type' || params.mode === 'dictation';
  p.dailyQuests = (p.dailyQuests || createDailyQuests(today, params.settings.dailyGoal)).map(quest => {
    if (quest.completed) return quest;
    let nextProgress = quest.progress;
    if (quest.kind === 'answers_30' || quest.kind === 'answers_40') {
      nextProgress += 1;
    } else if ((quest.kind === 'correct_30' || quest.kind === 'correct_20') && params.correct) {
      nextProgress += 1;
    } else if ((quest.kind === 'hard_boss' || quest.kind === 'hard_boss_8') && params.correct && params.wasHardOrNew) {
      nextProgress += 1;
    } else if (quest.kind === 'unique_20') {
      nextProgress = Math.max(nextProgress, p.todayUniqueCorrectIds.length);
    } else if (quest.kind === 'chest_1' && newChest) {
      nextProgress += 1;
    } else if (quest.kind === 'combo_10' || quest.kind === 'combo_15') {
      nextProgress = Math.max(nextProgress, p.currentCombo);
    } else if (quest.kind === 'active_12' && params.correct && isActiveInputMode) {
      nextProgress += 1;
    } else if (quest.kind === 'type_10' && params.correct && isTypeMode) {
      nextProgress += 1;
    } else if (quest.kind === 'audio_8' && params.correct && isAudioMode) {
      nextProgress += 1;
    }

    const completed = nextProgress >= quest.target;
    if (completed) {
      const reward = quest.rewardDiamonds;
      p.diamonds += reward;
      p.lifetimeDiamonds += reward;
      earnedBonusDiamonds += reward;
      bonusEvents.push(`Quest geschafft: ${quest.title}! +${reward} 💎`);
      p.history = appendHistory(p.history, {
        at: now.getTime(),
        delta: reward,
        reason: `Quest: ${quest.title}`,
        kind: 'quest',
      });
    }

    return {
      ...quest,
      progress: Math.min(quest.target, nextProgress),
      completed,
    };
  });

  // 4. Tagesziel, Tages-Streak (+ Eis-Schild) & Wochen-Streak
  p.todayCount += 1;
  if (p.todayCount >= params.settings.dailyGoal && p.lastCompletedDay !== today) {
    if (!p.lastCompletedDay) {
      p.dailyStreak = 1;
    } else {
      const gap = diffCalendarDays(p.lastCompletedDay, today);
      if (gap === 1) {
        p.dailyStreak += 1;
      } else if (gap === 2 && !p.freezeUsedThisWeek) {
        // Automatisches Eis-Schild rettet den Streak!
        p.freezeUsedThisWeek = true;
        p.lastFreezeDay = today;
        freezeTriggered = true;
        p.dailyStreak += 1;
        bonusEvents.push('❄️ Eis-Schild hat deine Serie gerettet!');
      } else if (gap > 1) {
        p.dailyStreak = 1;
        p.claimedDayMilestones = [];
      }
    }

    p.lastCompletedDay = today;
    if (p.dailyStreak > p.bestDailyStreak) p.bestDailyStreak = p.dailyStreak;
    if (p.dailyStreak >= 7) grantBadge('streak_7');
    if (p.dailyStreak >= 30) grantBadge('streak_30');

    // Tages-Streak Meilensteine prüfen
    for (const milestone of DAY_STREAK_MILESTONES) {
      if (p.dailyStreak >= milestone.days && !p.claimedDayMilestones.includes(milestone.days)) {
        p.claimedDayMilestones = [...p.claimedDayMilestones, milestone.days];
        p.diamonds += milestone.diamonds;
        p.lifetimeDiamonds += milestone.diamonds;
        earnedBonusDiamonds += milestone.diamonds;
        bonusEvents.push(`🔥 ${milestone.days}-Tage-Serie! +${milestone.diamonds} 💎`);
        p.history = appendHistory(p.history, {
          at: now.getTime(),
          delta: milestone.diamonds,
          reason: `${milestone.days}-Tage-Streak Bonus`,
          kind: 'streak',
        });
      }
    }

    // Wochen-Kalender & Wochen-Bonus
    if (!p.weekActiveDays.includes(today)) {
      p.weekActiveDays = [...p.weekActiveDays, today];
    }

    if (p.weekActiveDays.length >= params.settings.weeklyGoalDays && p.weekBonusClaimedFor !== week) {
      p.weekBonusClaimedFor = week;
      if (p.lastCompletedWeekKey === prevWeek) {
        p.weeklyStreak += 1;
      } else if (p.lastCompletedWeekKey !== week) {
        p.weeklyStreak = 1;
      }
      p.lastCompletedWeekKey = week;
      if (p.weeklyStreak > p.bestWeeklyStreak) p.bestWeeklyStreak = p.weeklyStreak;

      p.diamonds += WEEKLY_BONUS_DIAMONDS;
      p.lifetimeDiamonds += WEEKLY_BONUS_DIAMONDS;
      earnedBonusDiamonds += WEEKLY_BONUS_DIAMONDS;
      bonusEvents.push(`📅 Wochenziel geschafft! +${WEEKLY_BONUS_DIAMONDS} 💎`);
      p.history = appendHistory(p.history, {
        at: now.getTime(),
        delta: WEEKLY_BONUS_DIAMONDS,
        reason: `Wochenziel (${p.weekActiveDays.length} Tage) erreicht`,
        kind: 'week',
      });
      grantBadge('week_champ');
    }
  }

  return {
    profile: p,
    countedForChest,
    newChest,
    newLevel,
    earnedBonusDiamonds,
    bonusEvents,
    newBadges: newlyUnlockedBadges,
    freezeTriggered,
  };
}

/** Öffnet eine wartende Schatztruhe und schreibt die Diamanten + Truhen-Abzeichen gut. */
export function claimPendingChest(
  profile: VocabChildGamification,
  chestId: string,
  now: Date = new Date()
): { profile: VocabChildGamification; chest: VocabPendingChest | null; newBadges: VocabBadgeId[] } {
  const chest = profile.pendingChests.find(c => c.id === chestId) || null;
  if (!chest) return { profile, chest: null, newBadges: [] };

  const next: VocabChildGamification = {
    ...profile,
    diamonds: profile.diamonds + chest.diamonds,
    lifetimeDiamonds: profile.lifetimeDiamonds + chest.diamonds,
    chestsOpened: profile.chestsOpened + 1,
    pendingChests: profile.pendingChests.filter(c => c.id !== chestId),
    badges: [...profile.badges],
    history: appendHistory(profile.history, {
      at: now.getTime(),
      delta: chest.diamonds,
      reason: `${CHEST_TIERS[chest.tier].label} (${chest.accuracy} % richtig)`,
      kind: 'chest',
    }),
  };

  const newBadges: VocabBadgeId[] = [];
  const grant = (b: VocabBadgeId) => {
    if (!next.badges.includes(b)) {
      next.badges.push(b);
      newBadges.push(b);
    }
  };
  grant('first_chest');
  if (next.chestsOpened >= 10) grant('chests_10');
  if (chest.tier === 'gold' || chest.tier === 'rainbow') grant('gold_chest');
  if (chest.tier === 'rainbow') grant('rainbow_chest');

  return { profile: next, chest, newBadges };
}

/** Wie viele Diamanten sind bereits durch offene Anfragen reserviert? */
export function reservedDiamondsForUser(requests: VocabDiamondExchangeRequest[], userId: string): number {
  return requests
    .filter(r => r.userId === userId && r.status === 'PENDING')
    .reduce((sum, r) => sum + r.diamonds, 0);
}

/** Erstellt eine neue Umtauschanfrage eines Kindes an die Eltern. */
export function createExchangeRequest(params: {
  state: VocabGamificationState;
  userId: string;
  userName: string;
  diamonds: number;
  rewardLabel: string;
  starsReward?: number;
  note?: string;
  now?: Date;
}): { state: VocabGamificationState; request: VocabDiamondExchangeRequest } {
  const now = params.now || new Date();
  const profile = normalizeChildProfile(params.userId, params.state.profilesByUser[params.userId], now);
  const amount = Math.round(Number(params.diamonds));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Bitte eine gültige Anzahl Diamanten auswählen.');
  }

  const reserved = reservedDiamondsForUser(params.state.exchangeRequests, params.userId);
  const available = profile.diamonds - reserved;
  if (amount > available) {
    throw new Error(
      reserved > 0
        ? `Du hast nur noch ${Math.max(0, available)} freie Diamanten (${reserved} warten schon auf Bestätigung).`
        : `Du brauchst noch ${amount - profile.diamonds} Diamanten für diesen Tausch.`
    );
  }

  const starsReward =
    Number.isFinite(Number(params.starsReward)) && Number(params.starsReward) > 0
      ? Math.min(1000, Math.round(Number(params.starsReward)))
      : undefined;

  const request: VocabDiamondExchangeRequest = {
    id: makeId('exch'),
    userId: params.userId,
    userName: params.userName || params.userId,
    diamonds: amount,
    rewardLabel: params.rewardLabel.trim() || params.state.settings.exchangeLabel,
    ...(starsReward ? { starsReward } : {}),
    note: params.note?.trim() || undefined,
    status: 'PENDING',
    createdAt: now.getTime(),
  };

  return {
    request,
    state: {
      ...params.state,
      exchangeRequests: [request, ...params.state.exchangeRequests].slice(0, 120),
    },
  };
}

/** Eltern genehmigen oder lehnen eine Diamanten-Umtauschanfrage ab. */
export function resolveExchangeRequest(params: {
  state: VocabGamificationState;
  requestId: string;
  decision: 'APPROVED' | 'REJECTED';
  resolvedBy: string;
  now?: Date;
}): VocabGamificationState {
  const now = params.now || new Date();
  const target = params.state.exchangeRequests.find(r => r.id === params.requestId);
  if (!target || target.status !== 'PENDING') return params.state;

  const nextRequests = params.state.exchangeRequests.map(r =>
    r.id === params.requestId
      ? { ...r, status: params.decision, resolvedAt: now.getTime(), resolvedBy: params.resolvedBy }
      : r
  );

  const nextProfiles = { ...params.state.profilesByUser };
  if (params.decision === 'APPROVED') {
    const profile = normalizeChildProfile(target.userId, nextProfiles[target.userId], now);
    nextProfiles[target.userId] = {
      ...profile,
      diamonds: Math.max(0, profile.diamonds - target.diamonds),
      history: appendHistory(profile.history, {
        at: now.getTime(),
        delta: -target.diamonds,
        reason: `Eingetauscht: ${target.rewardLabel}`,
        kind: 'exchange',
      }),
    };
  }

  return {
    ...params.state,
    profilesByUser: nextProfiles,
    exchangeRequests: nextRequests,
  };
}

/**
 * Führt beliebig viele bestehende Unit-Sets verlustfrei & dedupliziert zu einem einzigen
 * Vokabel-Pool (`vocab_pool`) zusammen — sämtlicher Lernfortschritt (`progressByUser`) bleibt erhalten!
 */
export function consolidateVocabularyPool(sets: VocabularySet[]): VocabularySet {
  const sorted = [...sets].sort((a, b) => {
    if (a.id === VOCAB_POOL_ID) return -1;
    if (b.id === VOCAB_POOL_ID) return 1;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });

  const existingPool = sorted.find(s => s.id === VOCAB_POOL_ID);
  const first = existingPool || sorted[0];

  const entries: VocabularyEntry[] = [];
  const keyToEntryId = new Map<string, string>();
  const oldIdToCanonicalId = new Map<string, string>();

  const pairKey = (front: string, back: string) =>
    `${front.trim().toLowerCase()}:::${back.trim().toLowerCase()}`;

  for (const s of sorted) {
    for (const entry of s.entries || []) {
      if (!entry || !entry.front?.trim() || !entry.back?.trim()) continue;
      const key = pairKey(entry.front, entry.back);
      const existingId = keyToEntryId.get(key);
      if (existingId) {
        oldIdToCanonicalId.set(entry.id, existingId);
        continue;
      }
      const id = entry.id || makeId('v');
      keyToEntryId.set(key, id);
      oldIdToCanonicalId.set(entry.id, id);
      entries.push({
        id,
        front: entry.front.trim(),
        back: entry.back.trim(),
      });
    }
  }

  const progressByUser: Record<string, Record<string, VocabularyProgress>> = {};
  for (const s of sorted) {
    if (!s.progressByUser) continue;
    for (const [uid, map] of Object.entries(s.progressByUser)) {
      if (!map || typeof map !== 'object') continue;
      if (!progressByUser[uid]) progressByUser[uid] = {};
      for (const [entryId, prog] of Object.entries(map)) {
        if (!prog) continue;
        const canonicalId = oldIdToCanonicalId.get(entryId) || entryId;
        const prev = progressByUser[uid][canonicalId];
        if (!prev || (prog.lastReviewedAt || 0) >= (prev.lastReviewedAt || 0)) {
          progressByUser[uid][canonicalId] = prog;
        }
      }
    }
  }

  // Frühestes noch in der Zukunft liegendes Klassenarbeitsdatum übernehmen
  const examDates = sorted
    .map(s => s.examDate)
    .filter((d): d is string => Boolean(d && /^\d{4}-\d{2}-\d{2}$/.test(d)))
    .sort();

  return {
    id: VOCAB_POOL_ID,
    title: 'Vokabel-Pool',
    languageFrom: first?.languageFrom || 'Englisch',
    languageTo: first?.languageTo || 'Deutsch',
    entries,
    createdAt: first?.createdAt || Date.now(),
    updatedAt: Math.max(...sorted.map(s => s.updatedAt || s.createdAt || 0), Date.now()),
    createdBy: first?.createdBy || 'System',
    examDate: existingPool?.examDate || examDates[0],
    progressByUser,
  };
}
