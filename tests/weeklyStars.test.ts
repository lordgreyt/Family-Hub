import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lastWeeklyStarBoundary,
  nextWeeklyStarBoundary,
  localDateKey,
  planWeeklyStarBookings,
  weeklyStarRewardId,
} from '../src/services/weeklyStars.ts';

const sunday = (day = 8) => new Date(2026, 10, day, 18, 0, 0, 0); // Sonntag, 08.11.2026, 18:00
const task = (over: Record<string, unknown> = {}) => ({
  id: 't1',
  childId: 'Lennart',
  title: 'Zimmer aufräumen',
  stars: 5,
  active: true,
  createdAt: new Date(2026, 10, 1, 9, 0, 0, 0).getTime(),
  ...over,
});

test('Buchungstermin: Sonntag 18:00 wird korrekt bestimmt', () => {
  // Dienstag, 10.11.2026 09:00 → letzter Termin war Sonntag, 08.11. 18:00
  const tuesday = new Date(2026, 10, 10, 9, 0, 0, 0);
  assert.equal(localDateKey(lastWeeklyStarBoundary(tuesday)), '2026-11-08');
  assert.equal(lastWeeklyStarBoundary(tuesday).getHours(), 18);

  // Sonntag 17:59 → noch nicht gebucht, letzter Termin ist der Sonntag davor
  const before = new Date(2026, 10, 8, 17, 59, 0, 0);
  assert.equal(localDateKey(lastWeeklyStarBoundary(before)), '2026-11-01');

  // Sonntag 18:00 → Termin ist gerade eben
  assert.equal(localDateKey(lastWeeklyStarBoundary(sunday())), '2026-11-08');

  // Nächster Termin liegt immer in der Zukunft und ist ein Sonntag
  const next = nextWeeklyStarBoundary(tuesday);
  assert.equal(next.getDay(), 0);
  assert.equal(next.getHours(), 18);
  assert.ok(next.getTime() > tuesday.getTime());
  assert.equal(localDateKey(next), '2026-11-15');
  // Genau am Termin zeigt „nächster“ auf die Folgewoche
  assert.equal(localDateKey(nextWeeklyStarBoundary(sunday())), '2026-11-15');
});

test('Sommer-/Winterzeit: Termin bleibt Sonntag 18:00 Uhr lokal', () => {
  const dstChange = new Date(2026, 9, 28, 12, 0, 0, 0); // Mittwoch nach Zeitumstellung
  const boundary = lastWeeklyStarBoundary(dstChange);
  assert.equal(boundary.getDay(), 0);
  assert.equal(boundary.getHours(), 18);
  assert.equal(localDateKey(boundary), '2026-10-25');
});

test('Buchung: aktive Aufgaben werden pro Kind gesammelt und gutgeschrieben', () => {
  const bookings = planWeeklyStarBookings({
    tasks: [
      task(),
      task({ id: 't2', title: 'Müll rausbringen', stars: 3 }),
      task({ id: 't3', childId: 'Lotta', title: 'Tisch decken', stars: 4 }),
    ],
    existingIds: [],
    boundary: sunday(),
  });

  assert.equal(bookings.length, 2);

  const lennart = bookings.find(b => b.childId === 'Lennart')!;
  assert.equal(lennart.id, weeklyStarRewardId('2026-11-08', 'Lennart'));
  assert.equal(lennart.stars, -8); // negativ = Gutschrift
  assert.equal(lennart.status, 'APPROVED');
  assert.equal(lennart.createdAt, sunday().getTime());
  assert.match(lennart.description!, /Zimmer aufräumen, Müll rausbringen/);

  const lotta = bookings.find(b => b.childId === 'Lotta')!;
  assert.equal(lotta.stars, -4);
});

test('Buchung ist idempotent: bereits gebuchte Woche erzeugt nichts', () => {
  const tasks = [task()];
  const existing = [weeklyStarRewardId('2026-11-08', 'Lennart')];
  assert.deepEqual(planWeeklyStarBookings({ tasks, existingIds: existing, boundary: sunday() }), []);

  // andere Woche bucht erneut
  const nextWeek = new Date(2026, 10, 15, 18, 0, 0, 0);
  assert.equal(planWeeklyStarBookings({ tasks, existingIds: existing, boundary: nextWeek }).length, 1);
});

test('Buchung: ausgeschaltete Aufgaben zählen nicht', () => {
  const bookings = planWeeklyStarBookings({
    tasks: [task({ active: false }), task({ id: 't2', title: 'Müll', stars: 6, active: false })],
    existingIds: [],
    boundary: sunday(),
  });
  assert.deepEqual(bookings, []);
});

test('Buchung: nur aktive Aufgaben landen in der Summe', () => {
  const bookings = planWeeklyStarBookings({
    tasks: [
      task({ stars: 10 }),
      task({ id: 't2', title: 'Pausiert', stars: 100, active: false }),
    ],
    existingIds: [],
    boundary: sunday(),
  });
  assert.equal(bookings.length, 1);
  assert.equal(bookings[0].stars, -10);
});

test('Buchung: nach dem Termin angelegte Aufgaben zählen erst nächste Woche', () => {
  const createdAfter = task({ createdAt: new Date(2026, 10, 10, 9, 0, 0, 0).getTime() });
  assert.deepEqual(
    planWeeklyStarBookings({ tasks: [createdAfter], existingIds: [], boundary: sunday() }),
    []
  );
  // nächster Sonntag bucht sie
  assert.equal(
    planWeeklyStarBookings({
      tasks: [createdAfter],
      existingIds: [],
      boundary: new Date(2026, 10, 15, 18, 0, 0, 0),
    }).length,
    1
  );
});

test('Buchung: ungültige Sternwerte werden ignoriert', () => {
  const bookings = planWeeklyStarBookings({
    tasks: [task({ stars: 0 }), task({ id: 't2', stars: -4 }), task({ id: 't3', stars: 2.4 })],
    existingIds: [],
    boundary: sunday(),
  });
  assert.equal(bookings.length, 1);
  assert.equal(bookings[0].stars, -2);
});
