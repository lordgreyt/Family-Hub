// Wochen-Sterne: reine Logik ohne Firebase-Abhängigkeit (dadurch testbar).
// Aufgaben sind pro Kind dauerhaft hinterlegt und werden jeden Sonntagabend
// automatisch als Gutschrift gebucht.
import type { RewardRequest } from './mockDb';

export const WEEKLY_STAR_WEEKDAY = 0; // 0 = Sonntag
export const WEEKLY_STAR_HOUR = 18; // Buchung ab 18:00 Uhr abends
export const WEEKLY_STAR_MAX = 500;

export interface WeeklyStarTask {
  id: string;
  childId: string;
  title: string;
  stars: number;
  active: boolean; // ausgeschaltet = wird nicht gebucht
  createdAt: number;
  createdBy?: string;
}

const pad2 = (value: number) => String(value).padStart(2, '0');

export const localDateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

/** Letzter Buchungstermin (Sonntag, 18:00), der bereits erreicht ist. */
export function lastWeeklyStarBoundary(now: Date = new Date()): Date {
  const boundary = new Date(now);
  boundary.setHours(WEEKLY_STAR_HOUR, 0, 0, 0);
  const dayDiff = (boundary.getDay() - WEEKLY_STAR_WEEKDAY + 7) % 7;
  boundary.setDate(boundary.getDate() - dayDiff);
  if (boundary.getTime() > now.getTime()) boundary.setDate(boundary.getDate() - 7);
  return boundary;
}

/** Nächster Buchungstermin (Sonntag, 18:00) in der Zukunft. */
export function nextWeeklyStarBoundary(now: Date = new Date()): Date {
  const boundary = lastWeeklyStarBoundary(now);
  if (boundary.getTime() <= now.getTime()) boundary.setDate(boundary.getDate() + 7);
  return boundary;
}

/** Idempotente Buchungs-ID: pro Kind und Buchungssonntag genau eine Gutschrift. */
export const weeklyStarRewardId = (weekKey: string, childId: string) => `weekly-${weekKey}-${childId}`;

export interface WeeklyStarPlanInput {
  tasks: WeeklyStarTask[];
  /** IDs der bereits vorhandenen Sterne-Buchungen (andere Buchungen irrelevant). */
  existingIds: Iterable<string>;
  boundary: Date;
}

/**
 * Ermittelt die Gutschriften für einen Buchungstermin.
 * - nur aktive Aufgaben mit Sternen > 0
 * - nur Aufgaben, die vor dem Termin angelegt wurden (kein Nachtrag für die
 *   bereits gelaufene Woche)
 * - pro Kind genau eine Sammelbuchung, wenn sie nicht schon existiert
 */
export function planWeeklyStarBookings({ tasks, existingIds, boundary }: WeeklyStarPlanInput): RewardRequest[] {
  const weekKey = localDateKey(boundary);
  const boundaryTime = boundary.getTime();
  const known = new Set(existingIds);

  const byChild = new Map<string, WeeklyStarTask[]>();
  tasks.forEach(task => {
    if (!task || task.active === false) return;
    if (!(Number(task.stars) > 0)) return;
    if ((task.createdAt ?? 0) > boundaryTime) return;
    const list = byChild.get(task.childId) ?? [];
    list.push(task);
    byChild.set(task.childId, list);
  });

  const bookings: RewardRequest[] = [];
  byChild.forEach((childTasks, childId) => {
    const id = weeklyStarRewardId(weekKey, childId);
    if (known.has(id)) return;
    const stars = childTasks.reduce((sum, task) => sum + Math.round(Number(task.stars)), 0);
    if (stars <= 0) return;
    bookings.push({
      id,
      childId,
      stars: -stars, // negativ = Gutschrift
      status: 'APPROVED',
      createdAt: boundaryTime,
      description: `Wochenaufgaben: ${childTasks.map(task => task.title).join(', ')}`,
    });
  });

  return bookings;
}

export interface WeeklyTaskOwner {
  id: string;
  weeklyTasks?: WeeklyStarTask[];
}

/**
 * Wochenaufgaben liegen im jeweiligen Kind-Datensatz (family_hub_users).
 * Diese Funktion flacht sie zu einer Liste zusammen und setzt `childId`.
 */
export function flattenWeeklyTasks(users: WeeklyTaskOwner[]): WeeklyStarTask[] {
  const tasks: WeeklyStarTask[] = [];
  (users || []).forEach(user => {
    if (!user || !Array.isArray(user.weeklyTasks)) return;
    user.weeklyTasks.forEach(task => {
      if (!task || typeof task !== 'object' || !task.id) return;
      tasks.push({ ...task, childId: user.id });
    });
  });
  return tasks;
}
