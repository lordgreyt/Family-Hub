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

function normalize(raw: AnyRecord) {
  const now = new Date();
  const today = isoDay(now);
  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const users = asList(raw.family_hub_users || raw.users || raw.children);
  const tasks = asList(raw.family_hub_tasks || raw.tasks);
  const rewards = asList(raw.family_hub_rewards || raw.rewards || raw.requests);
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

  const pendingRequests = rewards.filter((reward) => reward.status === 'PENDING').length;

  return {
    configured: true,
    source: 'vercel-firebase-admin',
    updated_at: now.toISOString(),
    children,
    pending_requests: pendingRequests,
    summary: {
      children: children.length,
      open_tasks: children.reduce((sum, child) => sum + child.tasks_open, 0),
      stars: children.reduce((sum, child) => sum + child.stars, 0),
      pending_requests: pendingRequests,
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
    const [users, tasks, rewards, settings] = await Promise.all([
      db.ref('family_hub_users').get(),
      db.ref('family_hub_tasks').get(),
      db.ref('family_hub_rewards').get(),
      db.ref('family_hub_settings').get(),
    ]);

    return res.status(200).json(normalize({
      family_hub_users: users.val() || {},
      family_hub_tasks: tasks.val() || {},
      family_hub_rewards: rewards.val() || {},
      family_hub_settings: settings.val() || {},
    }));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
}
