import { timingSafeEqual } from 'node:crypto';
import admin from 'firebase-admin';
import { getDatabase } from 'firebase-admin/database';
import vocabularyImport from '../../server/vocabularyImport.cjs';

const { normalizeVocabularyImport, mergeVocabularyImport } = vocabularyImport;
const DATABASE_URL = 'https://familyhub-a588b-default-rtdb.europe-west1.firebasedatabase.app';
const STORAGE_PATH = 'family_hub_vocabulary';
const MAX_PAYLOAD_BYTES = 100_000;

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

function authorized(req) {
  const expected = process.env.FAMILY_HUB_API_TOKEN || '';
  const match = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!expected || !match) return false;
  const providedBytes = Buffer.from(match[1]);
  const expectedBytes = Buffer.from(expected);
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8'));
  return {};
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const body = readBody(req);
    if (Buffer.byteLength(JSON.stringify(body), 'utf8') > MAX_PAYLOAD_BYTES) {
      return res.status(413).json({ error: 'Import ist zu groß.' });
    }

    let incoming;
    try {
      incoming = normalizeVocabularyImport(body);
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Ungültiger Import.' });
    }

    initFirebase();
    const reference = getDatabase().ref(STORAGE_PATH);
    let result;
    const transaction = await reference.transaction((current) => {
      result = mergeVocabularyImport(current, incoming);
      return result.store;
    });

    if (!transaction.committed || !result) {
      return res.status(409).json({ error: 'Der Import konnte nicht übernommen werden.' });
    }

    return res.status(200).json({
      saved: true,
      setId: result.setId,
      addedCount: result.addedCount,
      totalCount: result.totalCount,
    });
  } catch (error) {
    console.error('Vocabulary import failed:', error);
    return res.status(500).json({ error: 'Vokabeln konnten nicht gespeichert werden.' });
  }
}
