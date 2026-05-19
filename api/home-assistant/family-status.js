/**
 * GET /api/home-assistant/family-status
 *
 * Geschützter Endpunkt für das lokale Tablet-/Home-Assistant-Dashboard.
 * Liest Family-Hub-Daten direkt aus Firebase RTDB, inklusive family_hub_reminders.
 */

const admin = require('firebase-admin');
const { getDatabase } = require('firebase-admin/database');

const DATABASE_URL = 'https://familyhub-a588b-default-rtdb.europe-west1.firebasedatabase.app';

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

function initFirebase() {
  if (admin.apps.length) return;
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env('FIREBASE_PROJECT_ID'),
      clientEmail: env('FIREBASE_CLIENT_EMAIL'),
      privateKey: env('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL || DATABASE_URL,
  });
}

function asList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([, v]) => Boolean(v))
      .map(([key, v]) => (v && typeof v === 'object' && !Array.isArray(v) && !v.id ? { id: key, ...v } : v));
  }
  return [];
}

function priorityPoints(settings) {
  const points = { 1: 5, 2: 10, 3: 15 };
  const raw = (settings && (settings.prioPoints || settings.prio_points)) || {};
  if (raw && typeof raw === 'object') {
    for (const [key, value] of Object.entries(raw)) {
      const k = Number(key);
      const v = Number(value);
      if (Number.isFinite(k) && Number.isFinite(v)) points[k] = v;
    }
  }
  return points;
}

function parseDate(value) {
  if (!value) return null;
  try {
    if (typeof value === 'number' && value > 0) return new Date(value > 10_000_000_000 ? value : value * 1000);
    if (typeof value === 'string') return new Date(value);
  } catch (_) {
    return null;
  }
  return null;
}

function localIsoDay(date) {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => (parts.find((part) => part.type === type) || {}).value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function asStringList(value) {
  if (Array.isArray(value)) return value.flatMap((item) => asStringList(item));
  if (value && typeof value === 'object') {
    for (const key of ['text', 'content', 'title', 'label']) {
      if (typeof value[key] === 'string' && value[key].trim()) return [value[key].trim()];
    }
    return Object.values(value).flatMap((item) => asStringList(item));
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function normalizeReminderGroups(rawReminders, today, children) {
  const childAliases = new Map();
  for (const child of children) {
    for (const value of [child.id, child.name]) {
      const key = String(value || '').trim().toLowerCase();
      if (key) childAliases.set(key, child);
    }
  }

  const compact = today.replace(/-/g, '');
  let dayOfWeek = new Date(`${today}T12:00:00+01:00`).getDay(); // JS: So=0, Mo=1 ...
  const byChild = {};

  const add = (childKey, value) => {
    const key = String(childKey || '').trim();
    if (!key) return;
    const child = childAliases.get(key.toLowerCase());
    const childId = (child && child.id) || key;
    const items = asStringList(value).filter(Boolean);
    if (!items.length) return;
    byChild[childId] = [...(byChild[childId] || []), ...items];
  };

  const addReminderObject = (item) => {
    if (!item || typeof item !== 'object') return;
    const childKey = item.childId || item.child_id || item.child || item.name;
    const itemDate = String(item.date || item.day || '').trim();
    const itemDow = item.dayOfWeek !== undefined ? Number(item.dayOfWeek) : item.day_of_week !== undefined ? Number(item.day_of_week) : null;
    const isRecurring = Boolean(item.isRecurring || item.is_recurring);
    const matches = (isRecurring && itemDow === dayOfWeek) || (!isRecurring && itemDate === today);
    if (matches) add(childKey, item.text || item.content || item.title || item);
  };

  // Family-Hub app contract: top-level array / numeric-key object of reminder objects.
  if (Array.isArray(rawReminders)) {
    rawReminders.forEach(addReminderObject);
  } else if (rawReminders && typeof rawReminders === 'object') {
    if (Object.keys(rawReminders).length && Object.keys(rawReminders).every((k) => /^\d+$/.test(String(k)))) {
      Object.values(rawReminders).forEach(addReminderObject);
    }

    // Date-first variants: family_hub_reminders/{YYYY-MM-DD}/{childId}.
    const dateBucket = rawReminders[today] || rawReminders[compact] || rawReminders.today || {};
    if (Array.isArray(dateBucket)) {
      for (const item of dateBucket) {
        add(item && (item.childId || item.child_id || item.child || item.name), item && (item.items || item.entries || item.reminders || item.text || item.content || item));
      }
    } else if (dateBucket && typeof dateBucket === 'object') {
      for (const [childKey, value] of Object.entries(dateBucket)) add(childKey, value);
    }

    // Child-first variants + arbitrary object entries.
    for (const [childKey, value] of Object.entries(rawReminders)) {
      if (childKey === today || childKey === compact || childKey === 'today') continue;
      if (value && typeof value === 'object') {
        const bucket = value[today] || value[compact];
        if (bucket) add(childKey, bucket);
        addReminderObject(value);
      }
    }
  }

  return children.map((child) => ({
    child_id: child.id,
    name: child.name,
    avatar: child.avatar || '⭐',
    entries: Array.from(new Set((byChild[child.id] || []).map((x) => String(x).trim()).filter(Boolean))),
  }));
}

function normalize(raw) {
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
    .filter((u) => u && (u.isChild || u.is_child || u.role === 'child'))
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
          if (localIsoDay(createdAt) === today) starsToday += earned;
          if (createdAt.getTime() >= weekAgo) starsWeek += earned;
        }
        return {
          id: String(reward.id || ''),
          stars: rewardStars,
          display_stars: -rewardStars,
          status: reward.status || 'APPROVED',
          description: reward.description || (rewardStars < 0 ? 'Gutschrift' : 'Einlösung'),
          created_at: createdAt ? createdAt.toISOString() : '',
        };
      });

      let doneToday = 0;
      const openTasks = tasks
        .filter((task) => {
          const assignedRaw = task.assignedTo || task.assigned_to;
          const assigned = Array.isArray(assignedRaw) ? assignedRaw.map(String) : assignedRaw ? [String(assignedRaw)] : [];
          return assigned.includes(childId) || (!assigned.length && Boolean(task.isShared || task.is_shared));
        })
        .map((task) => {
          const completedAt = parseDate(task.completedAt || task.completed_at);
          if ((task.isDone || task.is_done) && completedAt && localIsoDay(completedAt) === today) doneToday += 1;
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
      const assignedIds = Array.isArray(assignedRaw) ? assignedRaw.map(String) : assignedRaw ? [String(assignedRaw)] : [];
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
        assigned_names: assignedIds.map((id) => (childById.get(id) || {}).name || id).filter(Boolean),
        createdBy: task.createdBy || task.created_by || '',
        created_at: createdAt ? createdAt.toISOString() : '',
        completed_at: completedAt ? completedAt.toISOString() : '',
      };
    })
    .filter((task) => task.id || task.content)
    .sort((a, b) => {
      if (a.is_done !== b.is_done) return a.is_done ? 1 : -1;
      return String(a.dueDate || '9999-99-99').localeCompare(String(b.dueDate || '9999-99-99')) || Number(b.priority || 0) - Number(a.priority || 0);
    });

  const todayReminders = normalizeReminderGroups(rawReminders, today, children);
  const reminderCount = todayReminders.reduce((sum, child) => sum + child.entries.length, 0);
  const openTasksTotal = allTasks.filter((task) => !task.is_done).length;
  const pendingRequests = rewards.filter((reward) => reward.status === 'PENDING').length;

  return {
    configured: true,
    source: 'vercel-firebase-admin-direct',
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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const expectedToken = env('FAMILY_HUB_API_TOKEN');
  const authHeader = String(req.headers.authorization || '');
  if (authHeader !== `Bearer ${expectedToken}`) return res.status(401).json({ error: 'Unauthorized' });

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

    const remindersVal = reminders.val();

    const result = normalize({
      family_hub_users: users.val() || {},
      family_hub_tasks: tasks.val() || {},
      family_hub_rewards: rewards.val() || {},
      family_hub_reminders: remindersVal || {},
      family_hub_settings: settings.val() || {},
    });

    // Debug: expose raw reminders for troubleshooting
    result._raw_reminders = remindersVal;

    return res.status(200).json(result);
  } catch (err) {
    console.error('Firebase fetch error:', err);
    return res.status(500).json({ error: (err && err.message) || 'Internal server error' });
  }
};
