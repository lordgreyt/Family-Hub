import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_GAMIFICATION_SETTINGS,
  VOCAB_POOL_ID,
  claimPendingChest,
  consolidateVocabularyPool,
  createEmptyChildProfile,
  createExchangeRequest,
  determineChestTier,
  getLevelProgress,
  normalizeGamificationSettings,
  normalizeGamificationState,
  recordGamificationAnswer,
  resolveExchangeRequest,
} from '../src/pages/vocabGamification.ts';

test('consolidateVocabularyPool führt alle alten Units dedupliziert mit Fortschritt zusammen', () => {
  const pool = consolidateVocabularyPool([
    {
      id: 'unit-1',
      title: 'Unit 1',
      languageFrom: 'Englisch',
      languageTo: 'Deutsch',
      createdAt: 1000,
      createdBy: 'Falko',
      entries: [
        { id: 'e1', front: 'apple', back: 'Apfel' },
        { id: 'e2', front: 'house', back: 'Haus' },
      ],
      progressByUser: {
        Lennart: {
          e1: { correctCount: 3, wrongCount: 0, streak: 3, lastReviewedAt: 2000, nextReviewAt: 5000 },
        },
      },
    },
    {
      id: 'unit-2',
      title: 'Unit 2',
      languageFrom: 'Englisch',
      languageTo: 'Deutsch',
      createdAt: 2000,
      createdBy: 'Falko',
      entries: [
        { id: 'e1_dup', front: 'Apple', back: 'Apfel' },
        { id: 'e3', front: 'book', back: 'Buch' },
      ],
      progressByUser: {
        Lennart: {
          e3: { correctCount: 1, wrongCount: 1, streak: 1, lastReviewedAt: 3000, nextReviewAt: 6000 },
        },
      },
    },
  ]);

  assert.equal(pool.id, VOCAB_POOL_ID);
  assert.equal(pool.entries.length, 3);
  assert.equal(pool.progressByUser?.Lennart?.e1?.streak, 3);
  assert.equal(pool.progressByUser?.Lennart?.e3?.correctCount, 1);
});

test('50er-Block erzeugt leistungsgerechte Schatztruhe, Fairness-Cap verhindert Durchklicken desselben Wortes', () => {
  const settings = { ...DEFAULT_GAMIFICATION_SETTINGS, chestSize: 10, dailyGoal: 5 };
  let profile = createEmptyChildProfile('Lennart', new Date(2026, 10, 23, 10, 0, 0));

  // Dasselbe Wort 5x hintereinander -> nur max. 3x gezählt!
  for (let i = 0; i < 5; i += 1) {
    const out = recordGamificationAnswer({
      profile,
      settings,
      entryId: 'same-word',
      correct: true,
      now: new Date(2026, 10, 23, 10, 0, i),
    });
    profile = out.profile;
  }
  assert.equal(profile.blockCount, 3, 'Fairness-Cap muss dasselbe Wort auf 3x pro Block deckeln');

  // 7 weitere verschiedene richtige Wörter -> 10/10 voll -> Regenbogen-Truhe (12 💎)
  let generatedChest = null;
  for (let i = 0; i < 7; i += 1) {
    const out = recordGamificationAnswer({
      profile,
      settings,
      entryId: `word-${i}`,
      correct: true,
      now: new Date(2026, 10, 23, 10, 1, i),
    });
    profile = out.profile;
    if (out.newChest) generatedChest = out.newChest;
  }

  assert.ok(generatedChest);
  assert.equal(generatedChest.tier, 'rainbow');
  assert.equal(generatedChest.diamonds, 12);
  assert.equal(profile.blockCount, 0);
  assert.equal(profile.pendingChests.length, 1);

  const claimed = claimPendingChest(profile, generatedChest.id);
  assert.equal(claimed.profile.pendingChests.length, 0);
  assert.ok(claimed.profile.diamonds >= 12);
  assert.ok(claimed.profile.badges.includes('first_chest'));
  assert.ok(claimed.profile.badges.includes('rainbow_chest'));
  assert.ok(claimed.profile.badges.includes('combo_10'));

  // Truhenstufen prüfen
  assert.deepEqual(determineChestTier(50), { tier: 'bronze', diamonds: 3 });
  assert.deepEqual(determineChestTier(70), { tier: 'silver', diamonds: 5 });
  assert.deepEqual(determineChestTier(90), { tier: 'gold', diamonds: 8 });
  assert.deepEqual(determineChestTier(98), { tier: 'rainbow', diamonds: 12 });
});

test('Tages-Streak, automatisches Eis-Schild und Wochenziel-Bonus funktionieren korrekt', () => {
  const settings = { ...DEFAULT_GAMIFICATION_SETTINGS, dailyGoal: 2, weeklyGoalDays: 3, chestSize: 50 };
  let profile = createEmptyChildProfile('Lennart', new Date(2026, 10, 23, 10, 0, 0)); // Montag

  const completeDay = (day) => {
    let lastOut = null;
    for (let i = 0; i < 2; i += 1) {
      lastOut = recordGamificationAnswer({
        profile,
        settings,
        entryId: `d-${day.getDate()}-${i}`,
        correct: true,
        now: day,
      });
      profile = lastOut.profile;
    }
    return lastOut;
  };

  // Mo (Tag 1)
  completeDay(new Date(2026, 10, 23, 15, 0, 0));
  assert.equal(profile.dailyStreak, 1);

  // Di ausgelassen! Mi (Tag 2 nach 2 Tagen Gap -> Eis-Schild rettet!)
  const wedOut = completeDay(new Date(2026, 10, 25, 15, 0, 0));
  assert.equal(wedOut.freezeTriggered, true);
  assert.equal(profile.freezeUsedThisWeek, true);
  assert.equal(profile.dailyStreak, 2);

  // Do (Tag 3 -> 3-Tage-Meilenstein +2 💎 UND 3. aktiver Tag der Woche -> Wochenziel +5 💎!)
  const thuOut = completeDay(new Date(2026, 10, 26, 15, 0, 0));
  assert.equal(profile.dailyStreak, 3);
  assert.equal(profile.weeklyStreak, 1);
  assert.ok(thuOut.earnedBonusDiamonds >= 7, '3-Tage-Meilenstein (+2) + Wochenziel (+5) müssen gutgeschrieben werden');
  assert.ok(profile.badges.includes('week_champ'));
});

test('Diamanten-Umtauschanfrage sperrt doppeltes Ausgeben und Eltern-Freigabe zieht korrekt ab', () => {
  const baseProfile = { ...createEmptyChildProfile('Lennart'), diamonds: 25 };
  let state = normalizeGamificationState({
    settings: DEFAULT_GAMIFICATION_SETTINGS,
    profilesByUser: { Lennart: baseProfile },
    exchangeRequests: [],
  });

  const { state: afterReq, request } = createExchangeRequest({
    state,
    userId: 'Lennart',
    userName: 'Lennart',
    diamonds: 20,
    rewardLabel: '2,00 €',
    note: 'Für mein Sparschwein',
  });
  state = afterReq;
  assert.equal(state.exchangeRequests.length, 1);
  assert.equal(state.exchangeRequests[0].status, 'PENDING');

  // Zweite Anfrage für 20 💎 muss fehlschlagen, weil nur noch 5 frei sind!
  assert.throws(
    () =>
      createExchangeRequest({
        state,
        userId: 'Lennart',
        userName: 'Lennart',
        diamonds: 20,
        rewardLabel: '2,00 €',
      }),
    /freie Diamanten/
  );

  // Eltern genehmigen -> 20 💎 werden abgezogen (Rest: 5 💎)
  state = resolveExchangeRequest({
    state,
    requestId: request.id,
    decision: 'APPROVED',
    resolvedBy: 'Falko',
  });
  assert.equal(state.profilesByUser.Lennart.diamonds, 5);
  assert.equal(state.exchangeRequests[0].status, 'APPROVED');
});

test('Tages-Quests enthalten mindestens 30 Vokabeln und eine Boss-Quest für schwere Wörter', () => {
  const settings = DEFAULT_GAMIFICATION_SETTINGS;
  let profile = createEmptyChildProfile('Lennart', new Date(2026, 10, 27, 12, 0, 0));
  assert.equal(profile.dailyQuests.length, 3);
  const volumeQuest = profile.dailyQuests.find(q => q.kind === 'answers_30');
  const bossQuest = profile.dailyQuests.find(q => q.kind === 'hard_boss');
  assert.ok(volumeQuest && volumeQuest.target >= 30);
  assert.ok(bossQuest && bossQuest.target === 5);

  // 5 schwere Wörter meistern -> Boss-Quest erledigt (+2 💎)
  for (let i = 0; i < 5; i += 1) {
    const out = recordGamificationAnswer({
      profile,
      settings,
      entryId: `hard-${i}`,
      correct: true,
      wasHardOrNew: true,
      now: new Date(2026, 10, 27, 12, 0, i),
    });
    profile = out.profile;
  }
  assert.equal(profile.dailyQuests.find(q => q.kind === 'hard_boss')?.completed, true);
  assert.ok(profile.diamonds >= 2);

  // Blitz-Serie-Quest muss exakt 10 Richtige am Stück verlangen
  const comboDay = new Date(2026, 10, 26, 12, 0, 0);
  const comboProfile = createEmptyChildProfile('Lennart', comboDay);
  const comboQuest = comboProfile.dailyQuests.find(q => q.kind === 'combo_10');
  if (comboQuest) {
    assert.equal(comboQuest.target, 10);
  }
});

test('Wochenziel gilt standardmäßig für alle 7 Tage (Mo–So) inkl. Migration', () => {
  assert.equal(DEFAULT_GAMIFICATION_SETTINGS.weeklyGoalDays, 7);
  // Altes Schema ohne settingsVersion mit 5 Tagen wird sauber auf 7 Tage migriert
  const migrated = normalizeGamificationSettings({ weeklyGoalDays: 5, dailyGoal: 10 });
  assert.equal(migrated.weeklyGoalDays, 7);
  assert.equal(migrated.dailyGoal, 30);
  // Explizit in v2 gespeicherte Werte bleiben erhalten
  const custom = normalizeGamificationSettings({ settingsVersion: 2, weeklyGoalDays: 6, dailyGoal: 40 });
  assert.equal(custom.weeklyGoalDays, 6);
  assert.equal(custom.dailyGoal, 40);
});

test('60-Level-XP-System, +1 Diamant pro Level-Up & 300/600/1.000er Abzeichen', () => {
  const start = getLevelProgress(0);
  assert.equal(start.level, 1);
  assert.equal(start.maxLevel, 60);
  assert.equal(start.currentLevelXp, 0);
  assert.equal(start.xpForNextLevel, 400);

  // Level 1 -> Level 2 bei exakt 40 richtigen Vokabeln (400 XP) + 1 Diamant Bonus
  const settings = DEFAULT_GAMIFICATION_SETTINGS;
  let lvlProfile = {
    ...createEmptyChildProfile('Lennart', new Date(2026, 10, 27, 12, 0, 0)),
    totalCorrect: 39,
    totalAnswers: 39,
    lastRewardedLevel: 1,
  };
  assert.equal(getLevelProgress(39).level, 1);
  assert.equal(getLevelProgress(39).currentLevelXp, 390);

  const lvlUpOut = recordGamificationAnswer({
    profile: lvlProfile,
    settings,
    entryId: 'w-40',
    correct: true,
    now: new Date(2026, 10, 27, 12, 1, 0),
  });
  lvlProfile = lvlUpOut.profile;
  assert.equal(lvlUpOut.newLevel, 2);
  assert.equal(getLevelProgress(lvlProfile.totalCorrect).level, 2);
  assert.equal(getLevelProgress(lvlProfile.totalCorrect).currentLevelXp, 0);
  assert.equal(getLevelProgress(lvlProfile.totalCorrect).xpForNextLevel, 500);
  assert.ok(lvlProfile.diamonds >= 1, 'Level-Up muss mindestens +1 Diamant gutschreiben');
  assert.ok(lvlProfile.history.some(h => h.kind === 'level' && h.delta === 1));

  // Level 60 ist das Langzeit-Endziel (19.470 richtige Vokabeln)
  const maxLvl = getLevelProgress(19470);
  assert.equal(maxLvl.level, 60);
  assert.equal(maxLvl.isMaxLevel, true);

  let profile = { ...createEmptyChildProfile('Lennart', new Date(2026, 10, 27, 12, 0, 0)), totalCorrect: 299, totalAnswers: 299 };

  // Falsche Antwort schaltet 300er-Abzeichen NICHT frei
  profile = recordGamificationAnswer({
    profile,
    settings,
    entryId: 'w-wrong',
    correct: false,
    now: new Date(2026, 10, 27, 12, 0, 1),
  }).profile;
  assert.equal(profile.badges.includes('words_300'), false);

  // 300. richtige Antwort schaltet words_300 frei
  profile = recordGamificationAnswer({
    profile,
    settings,
    entryId: 'w-300',
    correct: true,
    now: new Date(2026, 10, 27, 12, 0, 2),
  }).profile;
  assert.equal(profile.badges.includes('words_300'), true);
  assert.equal(profile.badges.includes('words_600'), false);

  // 600. richtige Antwort schaltet words_600 frei
  profile = { ...profile, totalCorrect: 599 };
  profile = recordGamificationAnswer({
    profile,
    settings,
    entryId: 'w-600',
    correct: true,
    now: new Date(2026, 10, 27, 12, 0, 3),
  }).profile;
  assert.equal(profile.badges.includes('words_600'), true);
  assert.equal(profile.badges.includes('words_1000'), false);

  // 1.000. richtige Antwort schaltet words_1000 frei
  profile = { ...profile, totalCorrect: 999 };
  profile = recordGamificationAnswer({
    profile,
    settings,
    entryId: 'w-1000',
    correct: true,
    now: new Date(2026, 10, 27, 12, 0, 4),
  }).profile;
  assert.equal(profile.badges.includes('words_1000'), true);
});
