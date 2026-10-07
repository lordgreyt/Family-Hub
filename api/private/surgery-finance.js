import { getDatabase } from 'firebase-admin/database';
import homeAssistant from '../../server/homeAssistant.cjs';
import { decryptPrivateData, encryptPrivateData } from '../../server/privateFinanceCrypto.cjs';

const { sendError, setApiHeaders, verifyAdultUser } = homeAssistant;
// Keep this path out of mockDb.DB_KEYS: clients subscribe to the RTDB root.
// Only the authenticated adult API receives plaintext; Firebase stores ciphertext only.
const STORAGE_PATH = 'family_hub_private_finance_v1';
const MAX_PAYLOAD_BYTES = 100_000;

function encryptionSecret() {
  if (process.env.FAMILY_FINANCE_ENCRYPTION_KEY) {
    return process.env.FAMILY_FINANCE_ENCRYPTION_KEY;
  }
  if (process.env.FIREBASE_PRIVATE_KEY) {
    return process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (typeof account.private_key === 'string') return account.private_key.replace(/\\n/g, '\n');
  }
  throw new Error('Private finance encryption is not configured.');
}

function requestBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  setApiHeaders(res, ['GET', 'PUT']);
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await verifyAdultUser(req);
    const recordRef = getDatabase().ref(STORAGE_PATH);

    if (req.method === 'GET') {
      const snapshot = await recordRef.get();
      if (!snapshot.exists()) return res.status(200).json({ data: null });
      const data = decryptPrivateData(snapshot.val(), encryptionSecret());
      return res.status(200).json({ data });
    }

    const body = requestBody(req);
    if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
      return res.status(400).json({ error: 'Ungültige Finanzplan-Daten.' });
    }
    const serialized = JSON.stringify(body.data);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_PAYLOAD_BYTES) {
      return res.status(413).json({ error: 'Der Finanzplan ist zu groß.' });
    }

    const encrypted = encryptPrivateData(body.data, encryptionSecret());
    await recordRef.set(encrypted);
    return res.status(200).json({ saved: true });
  } catch (err) {
    return sendError(res, err);
  }
}
