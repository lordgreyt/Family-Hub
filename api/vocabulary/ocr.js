import { getDatabase } from 'firebase-admin/database';
import homeAssistant from '../../server/homeAssistant.cjs';
import { decryptPrivateData, encryptPrivateData } from '../../server/privateFinanceCrypto.cjs';

const { PublicError, sendError, setApiHeaders, verifyAdultUser } = homeAssistant;

// Kept outside mockDb.DB_KEYS so clients subscribed to RTDB root never see it.
// Only authenticated adult users (verifyAdultUser) may read status, save a key, or run OCR.
const STORAGE_PATH = 'family_hub_private_vocab_ai_v1';
const MAX_BODY_BYTES = 12_000_000; // up to 4 compressed textbook photos
const VALID_PROVIDERS = new Set(['deepseek', 'gemini', 'openai']);
const DEFAULT_MODELS = {
  deepseek: 'deepseek-flash',
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
};

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

function requestBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  try {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body);
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
      throw new PublicError(413, 'Die Anfrage ist zu groß.', 'payload_too_large');
    }
    return JSON.parse(raw);
  } catch (err) {
    if (err instanceof PublicError) throw err;
    throw new PublicError(400, 'Ungültiges JSON-Format.', 'invalid_json');
  }
}

function maskKey(key) {
  const clean = String(key || '').trim();
  if (clean.length <= 8) return clean ? '••••' : '';
  return `${clean.slice(0, 4)}…${clean.slice(-4)}`;
}

function envFallbackConfig() {
  if (process.env.DEEPSEEK_API_KEY) {
    return { provider: 'deepseek', apiKey: process.env.DEEPSEEK_API_KEY.trim(), source: 'env' };
  }
  if (process.env.GEMINI_API_KEY) {
    return { provider: 'gemini', apiKey: process.env.GEMINI_API_KEY.trim(), source: 'env' };
  }
  if (process.env.OPENAI_API_KEY) {
    return { provider: 'openai', apiKey: process.env.OPENAI_API_KEY.trim(), source: 'env' };
  }
  return null;
}

async function readStoredConfig() {
  const snapshot = await getDatabase().ref(STORAGE_PATH).get();
  if (!snapshot.exists()) return null;
  const decrypted = decryptPrivateData(snapshot.val(), encryptionSecret());
  if (!decrypted || typeof decrypted !== 'object' || !decrypted.apiKey) return null;
  const provider = VALID_PROVIDERS.has(decrypted.provider) ? decrypted.provider : 'deepseek';
  return {
    provider,
    apiKey: String(decrypted.apiKey).trim(),
    model: typeof decrypted.model === 'string' && decrypted.model.trim() ? decrypted.model.trim() : undefined,
    source: 'database',
  };
}

async function callOpenAiCompatible({ endpoint, apiKey, model, prompt, photos, providerLabel }) {
  const content = [
    { type: 'text', text: prompt },
    ...photos.map(photo => ({
      type: 'image_url',
      image_url: {
        url: `data:${photo.mimeType || 'image/jpeg'};base64,${photo.base64}`,
        ...(providerLabel === 'OpenAI' ? { detail: 'high' } : {}),
      },
    })),
  ];

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content }],
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiMsg = payload?.error?.message || `HTTP ${response.status}`;
    if (response.status === 401) {
      throw new PublicError(400, `Der ${providerLabel} API-Key ist ungültig. Bitte prüfe ihn in den Einstellungen.`, 'invalid_api_key');
    }
    if (response.status === 402 || response.status === 429) {
      throw new PublicError(429, `${providerLabel} Limit oder Guthaben erschöpft (${apiMsg}).`, 'rate_or_quota');
    }
    throw new PublicError(502, `${providerLabel}-Fehler: ${apiMsg}`, 'upstream_error');
  }

  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    throw new PublicError(502, `${providerLabel} hat keine lesbare Antwort zurückgegeben.`, 'empty_response');
  }
  return text;
}

async function callGemini({ apiKey, model, prompt, photos }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const parts = [
    { text: prompt },
    ...photos.map(photo => ({
      inline_data: {
        mime_type: photo.mimeType || 'image/jpeg',
        data: photo.base64,
      },
    })),
  ];

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiMsg = payload?.error?.message || `HTTP ${response.status}`;
    if (response.status === 400 && /API key/i.test(apiMsg)) {
      throw new PublicError(400, 'Der Gemini API-Key ist ungültig. Bitte prüfe ihn in den Einstellungen.', 'invalid_api_key');
    }
    if (response.status === 401 || response.status === 403) {
      throw new PublicError(400, 'Gemini API-Zugriff verweigert. Bitte prüfe deinen API-Key.', 'invalid_api_key');
    }
    if (response.status === 429) {
      throw new PublicError(429, 'Gemini API-Limit erreicht. Bitte kurz warten.', 'rate_or_quota');
    }
    throw new PublicError(502, `Gemini-Fehler: ${apiMsg}`, 'upstream_error');
  }

  const text = payload?.candidates?.[0]?.content?.parts
    ?.map(p => (typeof p?.text === 'string' ? p.text : ''))
    .join('\n');
  if (!text || !text.trim()) {
    throw new PublicError(502, 'Gemini hat keine lesbare Antwort zurückgegeben.', 'empty_response');
  }
  return text;
}

export default async function handler(req, res) {
  setApiHeaders(res, ['GET', 'PUT', 'POST']);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'PUT' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await verifyAdultUser(req);

    // 1. Read status (masked, never exposes raw API key to clients)
    if (req.method === 'GET') {
      const stored = await readStoredConfig();
      if (stored) {
        return res.status(200).json({
          configured: true,
          provider: stored.provider,
          model: stored.model || DEFAULT_MODELS[stored.provider],
          keyHint: maskKey(stored.apiKey),
          source: 'database',
        });
      }
      const envCfg = envFallbackConfig();
      if (envCfg) {
        return res.status(200).json({
          configured: true,
          provider: envCfg.provider,
          model: DEFAULT_MODELS[envCfg.provider],
          keyHint: maskKey(envCfg.apiKey),
          source: 'env',
        });
      }
      return res.status(200).json({
        configured: false,
        provider: 'deepseek',
        model: DEFAULT_MODELS.deepseek,
        keyHint: '',
        source: 'none',
      });
    }

    // 2. Save or clear encrypted API key (adults only)
    if (req.method === 'PUT') {
      const body = requestBody(req);
      const provider = VALID_PROVIDERS.has(body.provider) ? body.provider : 'deepseek';
      const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
      const model = typeof body.model === 'string' ? body.model.trim().slice(0, 80) : '';

      const recordRef = getDatabase().ref(STORAGE_PATH);
      if (!apiKey) {
        await recordRef.remove();
        return res.status(200).json({
          configured: false,
          provider,
          model: DEFAULT_MODELS[provider],
          keyHint: '',
          source: 'none',
        });
      }

      const encrypted = encryptPrivateData(
        {
          provider,
          apiKey,
          ...(model ? { model } : {}),
          updatedAt: Date.now(),
        },
        encryptionSecret()
      );
      await recordRef.set(encrypted);

      return res.status(200).json({
        configured: true,
        provider,
        model: model || DEFAULT_MODELS[provider],
        keyHint: maskKey(apiKey),
        source: 'database',
      });
    }

    // 3. Run Vision OCR server-side (avoids CORS & keeps key off the wire)
    const body = requestBody(req);
    const photos = Array.isArray(body.photos) ? body.photos : [];
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';

    if (photos.length === 0 || photos.length > 4) {
      throw new PublicError(400, 'Bitte sende 1 bis 4 Fotos zum Auslesen.', 'invalid_photos');
    }
    if (!prompt || prompt.length > 4000) {
      throw new PublicError(400, 'OCR-Prompt fehlt oder ist zu lang.', 'invalid_prompt');
    }

    const sanitizedPhotos = photos.map(p => {
      const base64 = typeof p?.base64 === 'string' ? p.base64.trim() : '';
      const mimeType = typeof p?.mimeType === 'string' && /^image\/(jpeg|png|webp)$/.test(p.mimeType)
        ? p.mimeType
        : 'image/jpeg';
      if (!base64 || base64.length > 5_000_000) {
        throw new PublicError(400, 'Ungültiges oder zu großes Foto.', 'invalid_photo');
      }
      return { base64, mimeType };
    });

    const stored = await readStoredConfig();
    const envCfg = envFallbackConfig();
    const fallbackInlineKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
    const requestedProvider = VALID_PROVIDERS.has(body.provider) ? body.provider : undefined;

    const resolved = stored
      || envCfg
      || (fallbackInlineKey
        ? { provider: requestedProvider || 'deepseek', apiKey: fallbackInlineKey, model: undefined }
        : null);

    if (!resolved || !resolved.apiKey) {
      throw new PublicError(400, 'Kein KI API-Key hinterlegt. Bitte trage deinen Key unter Setup → KI-Vokabelscanner ein.', 'missing_api_key');
    }

    const provider = resolved.provider;
    const model = resolved.model || DEFAULT_MODELS[provider];

    let rawText;
    if (provider === 'deepseek') {
      rawText = await callOpenAiCompatible({
        endpoint: 'https://api.deepseek.com/v1/chat/completions',
        apiKey: resolved.apiKey,
        model,
        prompt,
        photos: sanitizedPhotos,
        providerLabel: 'DeepSeek',
      });
    } else if (provider === 'openai') {
      rawText = await callOpenAiCompatible({
        endpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: resolved.apiKey,
        model,
        prompt,
        photos: sanitizedPhotos,
        providerLabel: 'OpenAI',
      });
    } else {
      rawText = await callGemini({
        apiKey: resolved.apiKey,
        model,
        prompt,
        photos: sanitizedPhotos,
      });
    }

    return res.status(200).json({ rawText, provider, model });
  } catch (err) {
    return sendError(res, err);
  }
}
