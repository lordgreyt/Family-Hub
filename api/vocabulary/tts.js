import admin from 'firebase-admin';
import { getDatabase } from 'firebase-admin/database';
import homeAssistant from '../../server/homeAssistant.cjs';
import { decryptPrivateData, encryptPrivateData } from '../../server/privateFinanceCrypto.cjs';

const { PublicError, sendError, setApiHeaders, verifyAdultUser } = homeAssistant;

// Kept outside mockDb.DB_KEYS so clients subscribed to RTDB root never download it.
const TTS_STORAGE_PATH = 'family_hub_private_vocab_tts_v1';
const OCR_STORAGE_PATH = 'family_hub_private_vocab_ai_v1';
const VALID_VOICES = new Set(['coral', 'sage', 'nova', 'echo', 'alloy', 'shimmer']);
const VALID_ACCENTS = new Set(['en-GB', 'en-US']);
const TTS_MODEL = 'gpt-4o-mini-tts';

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
  throw new PublicError(500, 'Verschlüsselung ist serverseitig nicht konfiguriert.', 'encryption_not_configured');
}

function asList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === 'object') return Object.values(value).filter(Boolean);
  return [];
}

function bearerToken(req) {
  const header = String(req.headers.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

function initFirebaseIfNeeded() {
  if (admin.apps.length) return;
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
    credential = admin.credential.cert(sa);
  } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    credential = admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
  } else {
    throw new PublicError(500, 'Firebase Admin ist serverseitig nicht konfiguriert.', 'firebase_not_configured');
  }
  admin.initializeApp({
    credential,
    databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://familyhub-a588b-default-rtdb.europe-west1.firebasedatabase.app',
  });
}

/**
 * Verifies any authenticated Family Hub member (adults AND children) for POST audio playback,
 * so children can listen to vocabulary audio while never having access to GET/PUT key settings.
 */
async function verifyFamilyMember(req) {
  const token = bearerToken(req);
  if (!token) throw new PublicError(401, 'Bitte erneut anmelden.', 'missing_auth');
  initFirebaseIfNeeded();

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch {
    throw new PublicError(401, 'Bitte erneut anmelden.', 'invalid_auth');
  }

  const usersSnap = await getDatabase().ref('family_hub_users').get();
  const hubUser = asList(usersSnap.val()).find(u => u && u.uid === decoded.uid);
  if (!hubUser) {
    throw new PublicError(403, 'Nutzer ist in Family Hub nicht freigeschaltet.', 'user_not_allowed');
  }
  return { uid: decoded.uid, isChild: Boolean(hubUser.isChild || hubUser.is_child || hubUser.role === 'child') };
}

function requestBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  try {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body);
    return JSON.parse(raw);
  } catch {
    throw new PublicError(400, 'Ungültiges JSON-Format.', 'invalid_json');
  }
}

function maskKey(key) {
  const clean = String(key || '').trim();
  if (clean.length <= 8) return clean ? '••••' : '';
  return `${clean.slice(0, 4)}…${clean.slice(-4)}`;
}

async function readStoredTtsConfig() {
  const snap = await getDatabase().ref(TTS_STORAGE_PATH).get();
  if (snap.exists()) {
    const data = decryptPrivateData(snap.val(), encryptionSecret());
    if (data && typeof data === 'object' && data.apiKey) {
      return {
        apiKey: String(data.apiKey).trim(),
        voice: VALID_VOICES.has(data.voice) ? data.voice : 'coral',
        accent: VALID_ACCENTS.has(data.accent) ? data.accent : 'en-GB',
        source: 'database',
      };
    }
  }

  // Convenience fallback: reuse OpenAI key if adult saved an OpenAI key in OCR settings
  const ocrSnap = await getDatabase().ref(OCR_STORAGE_PATH).get();
  if (ocrSnap.exists()) {
    const ocrData = decryptPrivateData(ocrSnap.val(), encryptionSecret());
    if (ocrData && ocrData.provider === 'openai' && ocrData.apiKey) {
      return {
        apiKey: String(ocrData.apiKey).trim(),
        voice: 'coral',
        accent: 'en-GB',
        source: 'database',
      };
    }
  }

  if (process.env.OPENAI_API_KEY) {
    return {
      apiKey: process.env.OPENAI_API_KEY.trim(),
      voice: 'coral',
      accent: 'en-GB',
      source: 'env',
    };
  }

  return null;
}

function buildSpeechInstructions(language, accent) {
  const lang = String(language || 'Englisch').trim();
  if (/englisch|english/i.test(lang)) {
    const region = accent === 'en-US' ? 'American English' : 'British English';
    return `Pronounce this ${region} vocabulary word or short phrase clearly, naturally, and distinctly for a language student. If multiple variants are separated by commas, read all of them in order with a brief pause between them. Say only the provided text without adding any explanation.`;
  }
  if (/deutsch|german/i.test(lang)) {
    return 'Sprich diese deutsche Vokabel oder Übersetzung klar, natürlich und deutlich in Hochdeutsch aus. Wenn mehrere Bedeutungen durch Komma getrennt sind, lies alle nacheinander mit kurzer Pause vor. Füge keine zusätzlichen Wörter hinzu.';
  }
  return `Pronounce this ${lang} vocabulary word or phrase clearly and naturally as a native speaker for a language student. If multiple variants are separated by commas, read all of them in order with a brief pause between them. Say only the provided text.`;
}

export default async function handler(req, res) {
  setApiHeaders(res, ['GET', 'PUT', 'POST']);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'PUT' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Adult-only status check
    if (req.method === 'GET') {
      await verifyAdultUser(req);
      const stored = await readStoredTtsConfig();
      if (!stored) {
        return res.status(200).json({
          configured: false,
          voice: 'coral',
          accent: 'en-GB',
          keyHint: '',
          source: 'none',
        });
      }
      return res.status(200).json({
        configured: true,
        voice: stored.voice,
        accent: stored.accent,
        keyHint: maskKey(stored.apiKey),
        source: stored.source,
      });
    }

    // 2. Adult-only save / remove encrypted OpenAI key & voice preference
    if (req.method === 'PUT') {
      await verifyAdultUser(req);
      const body = requestBody(req);
      const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
      const voice = VALID_VOICES.has(body.voice) ? body.voice : 'coral';
      const accent = VALID_ACCENTS.has(body.accent) ? body.accent : 'en-GB';
      const recordRef = getDatabase().ref(TTS_STORAGE_PATH);

      if (!apiKey && body.remove === true) {
        await recordRef.remove();
        return res.status(200).json({
          configured: false,
          voice,
          accent,
          keyHint: '',
          source: 'none',
        });
      }

      const existing = await readStoredTtsConfig();
      const finalKey = apiKey || existing?.apiKey || '';
      if (!finalKey) {
        throw new PublicError(400, 'Bitte gib einen gültigen OpenAI API-Key ein.', 'missing_api_key');
      }

      const encrypted = encryptPrivateData(
        { apiKey: finalKey, voice, accent, updatedAt: Date.now() },
        encryptionSecret()
      );
      await recordRef.set(encrypted);

      return res.status(200).json({
        configured: true,
        voice,
        accent,
        keyHint: maskKey(finalKey),
        source: 'database',
      });
    }

    // 3. Audio synthesis for authenticated family members (adults & children)
    await verifyFamilyMember(req);
    const body = requestBody(req);
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const language = typeof body.language === 'string' ? body.language.trim() : 'Englisch';
    if (!text || text.length > 240) {
      throw new PublicError(400, 'Text muss zwischen 1 und 240 Zeichen lang sein.', 'invalid_text');
    }

    const stored = await readStoredTtsConfig();
    if (!stored || !stored.apiKey) {
      throw new PublicError(400, 'Kein OpenAI API-Key für die Sprachausgabe hinterlegt (Setup → KI-Sprachausgabe).', 'missing_api_key');
    }

    const voice = VALID_VOICES.has(body.voice) ? body.voice : stored.voice;
    const accent = VALID_ACCENTS.has(body.accent) ? body.accent : stored.accent;

    const openaiRes = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stored.apiKey}`,
      },
      body: JSON.stringify({
        model: TTS_MODEL,
        voice,
        input: text,
        instructions: buildSpeechInstructions(language, accent),
        response_format: 'mp3',
      }),
    });

    if (!openaiRes.ok) {
      const errBody = await openaiRes.json().catch(() => ({}));
      const msg = errBody?.error?.message || `HTTP ${openaiRes.status}`;
      if (openaiRes.status === 401) {
        throw new PublicError(400, 'Der OpenAI API-Key ist ungültig. Bitte prüfe ihn unter Setup.', 'invalid_api_key');
      }
      if (openaiRes.status === 429) {
        throw new PublicError(429, `OpenAI Limit oder Guthaben erschöpft (${msg}).`, 'rate_or_quota');
      }
      throw new PublicError(502, `OpenAI Sprachausgabe fehlgeschlagen: ${msg}`, 'upstream_error');
    }

    const audioBuffer = Buffer.from(await openaiRes.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    return res.status(200).send(audioBuffer);
  } catch (err) {
    return sendError(res, err);
  }
}
