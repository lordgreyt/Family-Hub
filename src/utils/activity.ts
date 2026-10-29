import { mockDb } from '../services/mockDb';
import type { User } from '../services/mockDb';

export type ActivityKind =
  | 'expense'
  | 'income'
  | 'budget'
  | 'task_done'
  | 'task_new'
  | 'grade'
  | 'stars_earned'
  | 'stars_request'
  | 'holiday'
  | 'depot'
  | 'vocab';

export interface ActivityEvent {
  id: string;
  at: number;
  kind: ActivityKind;
  title: string;
  subtitle?: string;
  /** Betrag in Euro, vorzeichenbehaftet (positiv = Einnahme) */
  amount?: number;
  userId?: string;
  link: string;
}

// Alles vor 2001 (bzw. in Sekunden statt ms) ist ein künstlicher/Seed-Zeitstempel
const isValidTime = (n: unknown): n is number => typeof n === 'number' && n > 1e12;

const fmtGrade = (v: number) => (Number.isInteger(v) ? String(v) : v.toLocaleString('de-DE', { maximumFractionDigits: 2 }));

export const getRecentActivity = (user: User | null, limit = 30): ActivityEvent[] => {
  if (!user) return [];
  const isChild = !!user.isChild;
  const events: ActivityEvent[] = [];
  const push = (e: ActivityEvent) => {
    if (isValidTime(e.at)) events.push(e);
  };

  // Aufgaben
  for (const t of mockDb.getTasks() || []) {
    if (!t) continue;
    if (!isChild && !t.isShared && t.createdBy !== user.id) continue;
    if (t.isDone && t.completedAt) {
      push({
        id: `task-done-${t.id}`,
        at: t.completedAt,
        kind: 'task_done',
        title: t.content,
        subtitle: 'Aufgabe erledigt',
        userId: t.assignedTo?.length === 1 ? t.assignedTo[0] : undefined,
        link: '/tasks',
      });
    } else if (!t.isDone) {
      push({
        id: `task-new-${t.id}`,
        at: t.createdAt,
        kind: 'task_new',
        title: t.content,
        subtitle: 'Neue Aufgabe',
        userId: t.createdBy,
        link: '/tasks',
      });
    }
  }

  // Sterne
  for (const r of mockDb.getRewardRequests() || []) {
    if (!r || r.taskId) continue; // Sterne aus Aufgaben stehen schon bei der Aufgabe
    if (isChild && r.childId !== user.id) continue;
    const n = Math.abs(r.stars);
    if (r.stars < 0) {
      push({
        id: `stars-earned-${r.id}`,
        at: r.createdAt,
        kind: 'stars_earned',
        title: `${n} ${n === 1 ? 'Stern' : 'Sterne'} erhalten`,
        subtitle: r.description || 'Bonus',
        userId: r.childId,
        link: '/rewards',
      });
    } else {
      const status = r.status === 'APPROVED' ? 'genehmigt' : r.status === 'REJECTED' ? 'abgelehnt' : 'wartet auf Freigabe';
      push({
        id: `stars-request-${r.id}`,
        at: r.createdAt,
        kind: 'stars_request',
        title: r.description || `Belohnung für ${n} ${n === 1 ? 'Stern' : 'Sterne'}`,
        subtitle: `Belohnung ${status}`,
        userId: r.childId,
        link: '/rewards',
      });
    }
  }

  // Noten
  const gradeBook = mockDb.getGradeBook() || {};
  for (const [childId, record] of Object.entries(gradeBook)) {
    if (isChild && childId !== user.id) continue;
    for (const subject of record?.subjects || []) {
      for (const g of subject.grades || []) {
        push({
          id: `grade-${g.id}`,
          at: g.createdAt,
          kind: 'grade',
          title: `Note ${fmtGrade(g.value)} in ${subject.name}`,
          subtitle: 'Note',
          userId: childId,
          link: '/grades',
        });
      }
    }
  }

  // Vokabeln
  for (const set of mockDb.getVocabularySets() || []) {
    if (!set) continue;
    push({
      id: `vocab-${set.id}`,
      at: set.createdAt,
      kind: 'vocab',
      title: set.title,
      subtitle: 'Vokabelset angelegt',
      userId: set.createdBy,
      link: '/vokabeln',
    });
  }

  if (!isChild) {
    // Ausgaben & Einnahmen
    for (const e of mockDb.getExpenses() || []) {
      if (!e) continue;
      const amount = Number(e.amount) || 0;
      push({
        id: `expense-${e.id}`,
        at: e.createdAt,
        kind: e.type === 'INCOME' ? 'income' : 'expense',
        title: e.description ? `${e.category} · ${e.description}` : e.category || (e.type === 'INCOME' ? 'Einnahme' : 'Ausgabe'),
        subtitle: e.type === 'INCOME' ? 'Einnahme' : 'Ausgabe',
        amount: e.type === 'INCOME' ? amount : -amount,
        userId: e.createdBy,
        link: '/expenses',
      });
    }

    // Budget
    for (const b of mockDb.getBudgetItems() || []) {
      if (!b) continue;
      const amount = Number(b.amount) || 0;
      push({
        id: `budget-${b.id}`,
        at: b.createdAt,
        kind: 'budget',
        title: b.title,
        subtitle: b.type === 'INCOME' ? 'Budget: Einnahme' : 'Budget: Ausgabe',
        amount: b.type === 'INCOME' ? amount : -amount,
        userId: b.createdBy,
        link: '/budget',
      });
    }

    // Urlaubsbudget
    for (const h of mockDb.getHolidayBudget()?.entries || []) {
      if (!h) continue;
      push({
        id: `holiday-${h.id}`,
        at: h.createdAt,
        kind: 'holiday',
        title: h.note || 'Urlaubsausgabe',
        subtitle: 'Urlaubsbudget',
        amount: -(Number(h.amount) || 0),
        userId: h.createdBy,
        link: '/urlaubsbudget',
      });
    }

    // N26-Depots (nur Falko, nur manuelle Buchungen)
    if (user.id === 'Falko') {
      const depots = mockDb.getDepots();
      for (const tx of mockDb.getDepotTransactions() || []) {
        if (!tx || tx.isAutomated) continue;
        const depot = depots.find(d => d.id === tx.depotId);
        push({
          id: `depot-${tx.id}`,
          at: tx.createdAt,
          kind: 'depot',
          title: depot ? `${depot.name}${tx.note ? ` · ${tx.note}` : ''}` : tx.note || 'Depot',
          subtitle: 'Depot-Buchung',
          amount: Number(tx.amount) || 0,
          userId: 'Falko',
          link: '/n26',
        });
      }
    }
  }

  return events.sort((a, b) => b.at - a.at).slice(0, limit);
};

export const relativeTime = (at: number, now = Date.now()): string => {
  const diff = now - at;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;

  const d = new Date(at);
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(new Date(now)) - startOfDay(d)) / 86400000);

  if (dayDiff === 0) return `vor ${Math.floor(min / 60)} Std.`;
  if (dayDiff === 1) return `Gestern, ${time}`;
  if (dayDiff < 7) return `${d.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '')}, ${time}`;
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }).replace('.', '');
};
