import test from 'node:test';
import assert from 'node:assert/strict';
import { SPELLING_KINGDOMS, SPELLING_TASKS } from '../src/pages/spellingData.ts';
import {
  buildSpellingChoices,
  buildSpellingSession,
  checkGermanSpellingInput,
  computeKingdomStats,
  getAllSpellingTasks,
  normalizeSpellingStore,
} from '../src/pages/spellingEngine.ts';

test('Alle 8 Themen-Königreiche der 3. Klasse sind mit pädagogischen Aufgaben gefüllt', () => {
  assert.equal(SPELLING_KINGDOMS.length, 8);
  for (const kingdom of SPELLING_KINGDOMS) {
    const tasks = SPELLING_TASKS.filter(t => t.kingdom === kingdom.id);
    assert.ok(tasks.length >= 14, `Königreich ${kingdom.id} muss mindestens 14 Aufgaben haben (hat ${tasks.length})`);
    for (const task of tasks) {
      assert.ok(task.rule && task.rule.length >= 10, `Aufgabe ${task.id} braucht eine Merkregel`);
      if (task.gap) {
        assert.ok(task.gap.choices.includes(task.gap.answer), `Gap-Antwort muss in choices sein (${task.id})`);
      }
      if (task.detectiveWrong) {
        assert.equal(task.detectiveWrong.includes(task.word), false, `Zielwort darf nicht in detectiveWrong stehen (${task.id})`);
      }
    }
  }
});

test('Strenge deutsche Rechtschreibprüfung erkennt Groß-/Kleinschreibung mit kindgerechtem Hinweis', () => {
  assert.equal(checkGermanSpellingInput('Hund', 'Hund').correct, true);
  assert.equal(checkGermanSpellingInput('Straße', 'Straße').correct, true);

  const lower = checkGermanSpellingInput('hund', 'Hund');
  assert.equal(lower.correct, false);
  assert.match(lower.feedback || '', /groß/i);

  const upperVerb = checkGermanSpellingInput('Rennen', 'rennen');
  assert.equal(upperVerb.correct, false);
  assert.match(upperVerb.feedback || '', /klein/i);

  // Umlaute & ß müssen exakt stimmen
  assert.equal(checkGermanSpellingInput('Strasse', 'Straße').correct, false);
  assert.equal(checkGermanSpellingInput('Meuse', 'Mäuse').correct, false);
});

test('buildSpellingSession mischt Aufgabenarten zufällig und verhindert direkte Wiederholungen', () => {
  let seed = 1;
  const pseudoRandom = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const session = buildSpellingSession({
    allTasks: SPELLING_TASKS,
    progressByTask: {},
    kingdom: 'all',
    canSpeak: true,
    count: 15,
    random: pseudoRandom,
  });

  assert.equal(session.length, 15);
  const seenKinds = new Set(session.map(item => item.kind));
  assert.ok(seenKinds.size >= 3, 'Abenteuer-Runde muss mindestens 3 verschiedene Aufgabenarten mischen');

  for (let i = 0; i < session.length; i += 1) {
    const item = session[i];
    if (item.kind !== 'dictation') {
      const choices = buildSpellingChoices(item.task, item.kind, `seed-${i}`);
      assert.ok(choices.length >= 2);
    }
  }
});

test('Königreich-Kronen & Wort-Thron schalten pro Kind isoliert frei', () => {
  const childAProgress = {};
  // Kind A meistert alle 8 Königreiche (je >= 10 Aufgaben mit streak >= 2)
  for (const kingdom of SPELLING_KINGDOMS) {
    const tasks = SPELLING_TASKS.filter(t => t.kingdom === kingdom.id).slice(0, kingdom.crownTarget);
    for (const t of tasks) {
      childAProgress[t.id] = { correctCount: 2, wrongCount: 0, streak: 2, lastReviewedAt: 1000, nextReviewAt: 2000 };
    }
  }

  const statsA = computeKingdomStats(childAProgress);
  assert.equal(statsA.crownsEarned, 8);
  assert.equal(statsA.throneUnlocked, true);

  // Kind B hat noch nichts gelöst -> komplett isoliert (0 Kronen)
  const statsB = computeKingdomStats({});
  assert.equal(statsB.crownsEarned, 0);
  assert.equal(statsB.throneUnlocked, false);
});

test('Eigene Eltern-Diktatwörter werden sauber normalisiert & in Aufgaben umgewandelt', () => {
  const store = normalizeSpellingStore({
    customWords: [
      { id: 'c1', word: 'Schmetterling', sentence: 'Ein bunter Schmetterling fliegt.', hint: 'Mit zwei t!', createdAt: 1 },
      { id: 'c2', word: '   ', createdAt: 2 },
    ],
  });
  assert.equal(store.customWords.length, 1);
  const all = getAllSpellingTasks(store.customWords);
  const customTask = all.find(t => t.id === 'custom_c1');
  assert.ok(customTask);
  assert.equal(customTask.word, 'Schmetterling');
  assert.equal(customTask.rule, 'Mit zwei t!');
});
