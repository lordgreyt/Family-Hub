import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

const DATABASE_URL = 'https://familyhub-a588b-default-rtdb.europe-west1.firebasedatabase.app';

type AnyRecord = Record<string, any>;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

function initFirebase() {
  if (getApps().length) return;
  initializeApp({
    credential: cert({
      projectId: env('FIREBASE_PROJECT_ID'),
      clientEmail: env('FIREBASE_CLIENT_EMAIL'),
      privateKey: env('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL || DATABASE_URL,
  });
}

function asList(value: any): AnyRecord[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([, v]) => Boolean(v))
      .map(([key, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? { id: key, ...(v as AnyRecord) } : v as AnyRecord));
  }
  return [];
}

function priorityPoints(settings: AnyRecord): Record<number, number> {
  const points: Record<number, number> = { 1: 5, 2: 10, 3: 15 };
  const raw = settings?.prioPoints || settings?.prio_points || {};
  if (raw && typeof raw === 'object') {
    for (const [key, value] of Object.entries(raw)) {
      const k = Number(key);
      const v = Number(value);
      if (Number.isFinite(k) && Number.isFinite(v)) points[k] = v;
    }
  }
  return points;
}

function parseDate(value: any): Date | null {
  if (!value) return null;
  try {
    if (typeof value === 'number' && value > 0) return new Date(value > 10_000_000_000 ? value : value * 1000);
    if (typeof value === 'string') return new Date(value);
  } catch {
    return null;
  }
  return null;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function localIsoDay(date: Date): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function asStringList(value: any): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => asStringList(item));
  if (value && typeof value === 'object') {
    if (typeof value.text === 'string') return [value.text];
    if (typeof value.content === 'string') return [value.content];
    if (typeof value.title === 'string') return [value.title];
    if (typeof value.label === 'string') return [value.label];
    return Object.values(value).flatMap((item) => asStringList(item));
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function normalizeReminderGroups(rawReminders: any, today: string, children: { id: string; name: string; avatar: any }[]) {
  const childAliases = new Map<string, { id: string; name: string; avatar: any }>();
  for (const child of children) {
    for (const value of [child.id, child.name]) {
      const key = String(value || '').trim().toLowerCase();
      if (key) childAliases.set(key, child);
    }
  }

  const dateBucket = rawReminders?.[today] || rawReminders?.today || rawReminders?.[today.replaceAll('-', '')] || {};
  const byChild: Record<string, string[]> = {};

  const add = (childKey: any, value: any) => {
    const key = String(childKey || '').trim();
    if (!key) return;
    const child = childAliases.get(key.toLowerCase());
    const childId = child?.id || key;
    const items = asStringList(value);
    if (!items.length) return;
    byChild[childId] = [...(byChild[childId] || []), ...items];
  };

  if (Array.isArray(dateBucket)) {
    for (const item of dateBucket) add(item?.childId || item?.child_id || item?.child || item?.name, item?.items || item?.entries || item?.reminders || item?.text || item?.content || item);
  } else if (dateBucket && typeof dateBucket === 'object') {
    for (const [childKey, value] of Object.entries(dateBucket)) add(childKey, value);
  }

  // Also support child-first structures: family_hub_reminders/{childId}/{YYYY-MM-DD}.
  if (rawReminders && typeof rawReminders === 'object' && !Array.isArray(rawReminders)) {
    for (const [childKey, value] of Object.entries(rawReminders)) {
      if (childKey === today || childKey === 'today') continue;
      const bucket = (value as AnyRecord)?.[today] || (value as AnyRecord)?.[today.replaceAll('-', '')];
      if (bucket) add(childKey, bucket);
    }
  }

  return children.map((child) => ({
    child_id: child.id,
    name: child.name,
    avatar: child.avatar || '⭐',
    entries: Array.from(new Set((byChild[child.id] || []).map((x) => String(x).trim()).filter(Boolean))),
  }));
}

function normalize(raw: AnyRecord) {
  const now = new Date();
  const today = localIsoDay(now);
  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const users = asList(raw.family_hub_users || raw.users || raw.children);
  const tasks = asList(raw.family_hub_tasks || raw.tasks);
  const rewards = asList(raw.family_hub_rewards || raw.rewards || raw.requests);
  const rawReminders = raw.family_hub_reminders || raw.reminders || {};
  const settings = raw.family_hub_settings || raw.settings || {};
  const points = priorityPoints(settings);

  const children = users
    .filter((u) => u?.isChild || u?.is_child || u?.role === 'child')
    .map((child) => {
      const childId = String(child.id || child.name || child.uid || '').trim();
      const acceptedRewards = rewards.filter((r) => String(r.childId || r.child_id || '') === childId && r.status !== 'REJECTED');

      let stars = 0;
      let starsToday = 0;
      let starsWeek = 0;
      const history = acceptedRewards.map((reward) => {
        const rewardStars = Number(reward.stars || 0);
        stars -= rewardStars;
        const createdAt = parseDate(reward.createdAt || reward.created_at);
        if (rewardStars < 0 && createdAt) {
          const earned = Math.abs(rewardStars);
          if (isoDay(createdAt) === today) starsToday += earned;
          if (createdAt.getTime() >= weekAgo) starsWeek += earned;
        }
        return {
          id: String(reward.id || ''),
          stars: rewardStars,
          display_stars: -rewardStars,
          status: reward.status || 'APPROVED',
          description: reward.description || (rewardStars < 0 ? 'Gutschrift' : 'Einlösung'),
          created_at: createdAt?.toISOString() || '',
        };
      });

      let doneToday = 0;
      const openTasks = tasks
        .filter((task) => {
          const assigned = Array.isArray(task.assignedTo || task.assigned_to)
            ? (task.assignedTo || task.assigned_to).map(String)
            : task.assignedTo || task.assigned_to
              ? [String(task.assignedTo || task.assigned_to)]
              : [];
          return assigned.includes(childId) || (!assigned.length && Boolean(task.isShared || task.is_shared));
        })
        .map((task) => {
          const completedAt = parseDate(task.completedAt || task.completed_at);
          if ((task.isDone || task.is_done) && completedAt && isoDay(completedAt) === today) doneToday += 1;
          return task;
        })
        .filter((task) => !(task.isDone || task.is_done))
        .sort((a, b) => String(a.dueDate || a.due_date || '9999-99-99').localeCompare(String(b.dueDate || b.due_date || '9999-99-99')) || Number(b.priority || 0) - Number(a.priority || 0))
        .slice(0, 8)
        .map((task) => {
          const priority = Number(task.priority || 1);
          return {
            id: String(task.id || ''),
            content: String(task.content || task.title || 'Aufgabe'),
            priority,
            stars: points[priority] || 0,
            dueDate: task.dueDate || task.due_date || '',
            is_shared: Boolean(task.isShared || task.is_shared),
            createdBy: task.createdBy || task.created_by || '',
          };
        });

      return {
        id: childId,
        name: childId,
        avatar: child.avatar || '⭐',
        stars,
        stars_today: starsToday,
        stars_week: starsWeek,
        tasks_open: openTasks.length,
        tasks_done_today: doneToday,
        open_tasks: openTasks,
        history: history.slice(0, 8),
      };
    })
    .filter((child) => child.id)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));

  const childById = new Map(children.map((child) => [child.id, child]));
  const allTasks = tasks
    .map((task) => {
      const assignedRaw = task.assignedTo || task.assigned_to;
      const assignedIds = Array.isArray(assignedRaw)
        ? assignedRaw.map(String)
        : assignedRaw
          ? [String(assignedRaw)]
          : [];
      const priority = Number(task.priority || 1);
      const completedAt = parseDate(task.completedAt || task.completed_at);
      const createdAt = parseDate(task.createdAt || task.created_at);
      const isDone = Boolean(task.isDone || task.is_done);
      return {
        id: String(task.id || ''),
        content: String(task.content || task.title || 'Aufgabe'),
        priority,
        stars: points[priority] || 0,
        dueDate: task.dueDate || task.due_date || '',
        is_done: isDone,
        is_shared: Boolean(task.isShared || task.is_shared),
        assigned_to: assignedIds,
        assigned_names: assignedIds.map((id) => childById.get(id)?.name || id).filter(Boolean),
        createdBy: task.createdBy || task.created_by || '',
        created_at: createdAt?.toISOString() || '',
        completed_at: completedAt?.toISOString() || '',
      };
    })
    .filter((task) => task.id || task.content)
    .sort((a, b) => {
      if (a.is_done !== b.is_done) return a.is_done ? 1 : -1;
      return String(a.dueDate || '9999-99-99').localeCompare(String(b.dueDate || '9999-99-99')) || Number(b.priority || 0) - Number(a.priority || 0);
    });
  const openTasksTotal = allTasks.filter((task) => !task.is_done).length;
  const todayReminders = normalizeReminderGroups(rawReminders, today, children);
  const reminderCount = todayReminders.reduce((sum, child) => sum + child.entries.length, 0);
  const pendingRequests = rewards.filter((reward) => reward.status === 'PENDING').length;

  return {
    configured: true,
    source: 'vercel-firebase-admin',
    updated_at: now.toISOString(),
    children,
    tasks: allTasks,
    reminders_today: todayReminders,
    reminders: { today, children: todayReminders, count: reminderCount },
    pending_requests: pendingRequests,
    summary: {
      children: children.length,
      tasks: allTasks.length,
      open_tasks: openTasksTotal,
      done_tasks: allTasks.length - openTasksTotal,
      stars: children.reduce((sum, child) => sum + child.stars, 0),
      pending_requests: pendingRequests,
      reminders_today: reminderCount,
    },
  };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const expectedToken = env('FAMILY_HUB_API_TOKEN');
  const auth = String(req.headers.authorization || '');
  if (auth !== `Bearer ${expectedToken}`) return res.status(401).json({ error: 'Unauthorized' });

  try {
    initFirebase();
    const db = getDatabase();
    const [users, tasks, rewards, reminders, settings] = await Promise.all([
      db.ref('family_hub_users').get(),
      db.ref('family_hub_tasks').get(),
      db.ref('family_hub_rewards').get(),
      db.ref('family_hub_reminders').get(),
      db.ref('family_hub_settings').get(),
    ]);

    return res.status(200).json(normalize({
      family_hub_users: users.val() || {},
      family_hub_tasks: tasks.val() || {},
      family_hub_rewards: rewards.val() || {},
      family_hub_reminders: reminders.val() || {},
      family_hub_settings: settings.val() || {},
    }));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
}
