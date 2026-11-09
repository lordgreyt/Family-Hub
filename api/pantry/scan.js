import { timingSafeEqual } from 'node:crypto';
import admin from 'firebase-admin';
import { getDatabase } from 'firebase-admin/database';
import pantryScan from '../../server/pantryScan.cjs';

const { ScanRequestError, normalizeScanEvent, parseDeviceTokens, processScan } = pantryScan;
const DATABASE_URL = 'https://familyhub-a588b-default-rtdb.europe-west1.firebasedatabase.app';
const MAX_PAYLOAD_BYTES = 2_000;

const PATHS = {
  pantry: 'family_hub_pantry',
  log: 'family_hub_pantry_log',
  unknown: 'family_hub_pantry_unknown',
  lists: 'family_hub_shopping_lists',
  items: 'family_hub_shopping_items',
};

function initFirebase() {
  if (admin.apps.length) return;
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (serviceAccount.private_key) serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    credential = admin.credential.cert(serviceAccount);
  } else {
    const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
    if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
      throw new Error('Firebase Admin is not configured.');
    }
    credential = admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
  }
  admin.initializeApp({
    credential,
    databaseURL: process.env.FIREBASE_DATABASE_URL || DATABASE_URL,
  });
}

// Jedes Gerät hat ein eigenes Token (KITCHEN_SCANNER_DEVICES = {"kueche-1":"<token>"}).
// Das Token legt fest, als welches Gerät gebucht wird – eine fremde device_id wird abgelehnt.
function authenticateDevice(req) {
  const devices = parseDeviceTokens(process.env.KITCHEN_SCANNER_DEVICES);
  const match = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const provided = Buffer.from(match[1]);
  let found = null;
  for (const [deviceId, token] of Object.entries(devices)) {
    const expected = Buffer.from(token);
    // Alle Geräte prüfen (kein vorzeitiger Abbruch), damit die Laufzeit nichts verrät.
    if (provided.length === expected.length && timingSafeEqual(provided, expected)) found = deviceId;
  }
  return found;
}

function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8'));
  return {};
}

function createFirebaseStore() {
  initFirebase();
  const db = getDatabase();
  const val = async (path) => (await db.ref(path).get()).val();

  return {
    async claimEvent(logId, placeholder, canClaim) {
      let existing = null;
      const result = await db.ref(`${PATHS.log}/${logId}`).transaction((current) => {
        existing = current;
        return canClaim(current) ? placeholder : undefined;
      });
      return { claimed: result.committed, existing: result.committed ? null : result.snapshot.val() || existing };
    },
    async releaseEvent(logId) {
      await db.ref(`${PATHS.log}/${logId}`).remove();
    },
    getPantry: () => val(PATHS.pantry),
    async transactPantryItem(id, update) {
      await db.ref(`${PATHS.pantry}/${id}`).transaction((current) => update(current));
    },
    async touchUnknown(barcode, update) {
      await db.ref(`${PATHS.unknown}/${barcode}`).transaction((current) => update(current));
    },
    async getShopping() {
      const [lists, items] = await Promise.all([val(PATHS.lists), val(PATHS.items)]);
      return { lists: lists || {}, items: items || {} };
    },
    async ensureDefaultList(now) {
      const list = { id: 'liste-supermarkt', name: 'Supermarkt', emoji: '🛒', createdAt: now };
      await db.ref(`${PATHS.lists}/${list.id}`).transaction((current) => current || list);
      return list;
    },
    // Legt den Nachkauf-Eintrag an; ein bereits offener Eintrag mit gleicher ID bleibt unberührt.
    async putAutoItem(item) {
      const result = await db.ref(`${PATHS.items}/${item.id}`).transaction((current) => (
        current && !current.checked ? undefined : item
      ));
      return result.committed;
    },
    async updateLog(logId, entry) {
      await db.ref(`${PATHS.log}/${logId}`).set(entry);
    },
    // Hält das Protokoll klein (die Clients laden die ganze Datenbank).
    async pruneLog(limit) {
      if (Math.random() > 0.1) return;
      const entries = Object.entries((await val(PATHS.log)) || {});
      if (entries.length <= limit) return;
      entries.sort((a, b) => (b[1]?.at || 0) - (a[1]?.at || 0));
      const patch = {};
      for (const [key] of entries.slice(limit)) patch[key] = null;
      await db.ref(PATHS.log).update(patch);
    },
  };
}

export function createHandler(getStore = createFirebaseStore) {
  return async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const deviceId = authenticateDevice(req);
    if (!deviceId) return res.status(401).json({ error: 'Unauthorized' });

    let event;
    try {
      const body = readBody(req);
      if (Buffer.byteLength(JSON.stringify(body), 'utf8') > MAX_PAYLOAD_BYTES) {
        return res.status(413).json({ error: 'payload_too_large' });
      }
      if (body.device_id !== undefined && body.device_id !== deviceId) {
        return res.status(403).json({ error: 'device_mismatch' });
      }
      event = normalizeScanEvent(body);
    } catch (error) {
      if (error instanceof ScanRequestError) return res.status(400).json({ error: error.code, message: error.message });
      return res.status(400).json({ error: 'invalid_request', message: 'Body ist kein gültiges JSON.' });
    }

    try {
      const result = await processScan({ store: getStore(), deviceId, event });
      return res.status(200).json(result);
    } catch (error) {
      console.error('Pantry scan failed:', error);
      // 5xx: Das Gerät behält das Ereignis im Puffer und sendet es später erneut (gleiche event_id).
      return res.status(500).json({ error: 'server_error' });
    }
  };
}

export default createHandler();
