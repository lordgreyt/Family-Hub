/**
 * GET /api/home-assistant/family-status
 *
 * Geschützter Endpunkt für das Family-Hub-Dashboard.
 * Liefert Nutzer, Aufgaben und Sterne aus Firebase RTDB.
 *
 * Auth: Bearer-Token via FAMILY_HUB_API_TOKEN env var.
 *
 * Vercel env vars (in Vercel Dashboard → Settings → Environment Variables):
 *   FAMILY_HUB_API_TOKEN    = <dein selbst gewähltes Token>
 *   FIREBASE_PROJECT_ID     = familyhub-a588b
 *   FIREBASE_CLIENT_EMAIL   = <aus Firebase Console → Service Accounts>
 *   FIREBASE_PRIVATE_KEY    = <private key aus Service Account JSON>
 */

const admin = require('firebase-admin');
const { getDatabase } = require('firebase-admin/database');

// Nur einmal initialisieren (Vercel hält den Prozess warm)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
    databaseURL: 'https://familyhub-a588b-default-rtdb.europe-west1.firebasedatabase.app',
  });
}

const db = getDatabase();

const DB_PATHS = {
  users: 'family_hub_users',
  tasks: 'family_hub_tasks',
  rewards: 'family_hub_rewards',
};

/** Liest einen Pfad aus der RTDB, gibt immer ein Array zurück */
async function fetchArray(path) {
  const ref = db.ref(path);
  const snap = await ref.once('value');
  const data = snap.val();
  if (!data) return [];
  if (Array.isArray(data)) return data.filter(Boolean);
  return Object.values(data).filter(Boolean);
}

module.exports = async function handler(req, res) {
  // CORS für lokale Entwicklung und Dashboard-Zugriff
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth-Prüfung
  const expectedToken = process.env.FAMILY_HUB_API_TOKEN;
  if (expectedToken) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (token !== expectedToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const [users, tasks, rewards] = await Promise.all([
      fetchArray(DB_PATHS.users),
      fetchArray(DB_PATHS.tasks),
      fetchArray(DB_PATHS.rewards),
    ]);

    return res.status(200).json({ users, tasks, rewards });
  } catch (err) {
    console.error('Firebase fetch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
