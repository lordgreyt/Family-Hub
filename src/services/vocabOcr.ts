export type VocabAiProvider = 'deepseek' | 'gemini' | 'openai';

export interface VocabAiConfig {
  provider: VocabAiProvider;
  apiKey: string;
  model?: string;
}

export interface VocabAiStatus {
  configured: boolean;
  provider: VocabAiProvider;
  model: string;
  keyHint: string;
  source: 'database' | 'env' | 'local' | 'none';
}

export interface ExtractedVocabPair {
  id: string;
  front: string;
  back: string;
  uncertain?: boolean;
}

export interface VocabOcrResult {
  title: string;
  languageFrom: string;
  languageTo: string;
  entries: ExtractedVocabPair[];
}

export interface PreparedPhoto {
  id: string;
  dataUrl: string;
  base64: string;
  mimeType: string;
}

const STORAGE_KEY = 'family_hub_vocab_ai_config';

export const DEFAULT_MODELS: Record<VocabAiProvider, string> = {
  deepseek: 'deepseek-flash',
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
};

export const PROVIDER_LABELS: Record<VocabAiProvider, string> = {
  deepseek: 'DeepSeek',
  gemini: 'Google Gemini',
  openai: 'OpenAI',
};

/**
 * Only auto-detect unambiguous prefixes:
 * - `AIza...` is Google Gemini
 * - `sk-proj-...` is OpenAI Project Key
 * Plain `sk-...` keys are shared by DeepSeek and OpenAI, so we respect the chosen provider.
 */
export function detectProviderFromKey(apiKey: string): VocabAiProvider | null {
  const trimmed = apiKey.trim();
  if (/^AIza[0-9A-Za-z_-]{20,}$/.test(trimmed)) return 'gemini';
  if (/^sk-proj-[A-Za-z0-9_-]{20,}$/.test(trimmed)) return 'openai';
  return null;
}

export function maskApiKey(apiKey: string): string {
  const clean = apiKey.trim();
  if (clean.length <= 8) return clean ? '••••' : '';
  return `${clean.slice(0, 4)}…${clean.slice(-4)}`;
}

export function getVocabAiConfig(): VocabAiConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { provider: 'deepseek', apiKey: '' };
    const parsed = JSON.parse(raw) as Partial<VocabAiConfig>;
    const provider: VocabAiProvider =
      parsed.provider === 'gemini' || parsed.provider === 'openai' || parsed.provider === 'deepseek'
        ? parsed.provider
        : 'deepseek';
    return {
      provider,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey.trim() : '',
      model: typeof parsed.model === 'string' && parsed.model.trim() ? parsed.model.trim() : undefined,
    };
  } catch {
    return { provider: 'deepseek', apiKey: '' };
  }
}

export function saveVocabAiConfig(config: VocabAiConfig): void {
  const clean: VocabAiConfig = {
    provider: config.provider,
    apiKey: config.apiKey.trim(),
    ...(config.model?.trim() ? { model: config.model.trim() } : {}),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
}

export function clearVocabAiConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

async function getAdultAuthHeaders(): Promise<Record<string, string> | null> {
  try {
    const { auth } = await import('./firebase');
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    const token = await currentUser.getIdToken();
    return { Authorization: `Bearer ${token}` };
  } catch {
    return null;
  }
}

function localStatusFallback(): VocabAiStatus {
  const local = getVocabAiConfig();
  if (local.apiKey) {
    return {
      configured: true,
      provider: local.provider,
      model: local.model || DEFAULT_MODELS[local.provider],
      keyHint: maskApiKey(local.apiKey),
      source: 'local',
    };
  }
  return {
    configured: false,
    provider: local.provider,
    model: DEFAULT_MODELS[local.provider],
    keyHint: '',
    source: 'none',
  };
}

/**
 * Loads the current OCR AI key status.
 * Adults get the full status incl. key hint from the encrypted backend (/api/vocabulary/ocr);
 * children only learn whether the shared key exists. Falls back to localStorage in Vite dev.
 */
export async function loadVocabAiStatus(): Promise<VocabAiStatus> {
  const headers = await getAdultAuthHeaders();
  if (headers) {
    try {
      const response = await fetch('/api/vocabulary/ocr', {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      if (response.ok) {
        const data = (await response.json()) as VocabAiStatus;
        if (data.configured) return data;
        const local = localStatusFallback();
        return local.configured ? local : data;
      }
    } catch {
      // Backend unreachable (e.g. plain Vite dev server) -> fall back to local config
    }
  }
  return localStatusFallback();
}

/**
 * Saves or removes the API key for adult users.
 * Writes AES-256-GCM encrypted to Firebase via /api/vocabulary/ocr when the serverless API is available;
 * also mirrors locally in localStorage so local Vite dev works immediately.
 */
export async function saveVocabAiKeySecurely(
  provider: VocabAiProvider,
  apiKey: string
): Promise<VocabAiStatus> {
  const trimmed = apiKey.trim();
  const detected = detectProviderFromKey(trimmed) || provider;

  const headers = await getAdultAuthHeaders();
  if (headers) {
    try {
      const response = await fetch('/api/vocabulary/ocr', {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({ provider: detected, apiKey: trimmed }),
      });

      if (response.ok) {
        const remoteStatus = (await response.json()) as VocabAiStatus;
        // Clear any leftover plaintext local key once safely encrypted on server
        clearVocabAiConfig();
        return remoteStatus;
      }

      // 401/403 must be surfaced directly (never silently bypassed)
      if (response.status === 401 || response.status === 403) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || 'Nur Erwachsene dürfen den KI API-Key verwalten.');
      }
    } catch (err) {
      if (err instanceof Error && /Erwachsene|anmelden/i.test(err.message)) {
        throw err;
      }
      // Fall through to local dev storage when /api/vocabulary/ocr is not mounted (plain Vite dev)
    }
  }

  if (trimmed) {
    saveVocabAiConfig({ provider: detected, apiKey: trimmed });
  } else {
    clearVocabAiConfig();
  }
  return localStatusFallback();
}

function makeTempId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Resizes a camera/gallery photo to a crisp OCR-friendly JPEG (max 1600px on longest side)
 * so textbook small print stays sharp while keeping API uploads fast.
 */
export function prepareVocabPhoto(fileOrBlob: Blob, maxDimension = 1600): Promise<PreparedPhoto> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Foto konnte nicht gelesen werden.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Bildformat wird nicht unterstützt.'));
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas nicht verfügbar.'));
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const mimeType = 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, 0.86);
        const base64 = dataUrl.split(',')[1] || '';
        resolve({ id: makeTempId(), dataUrl, base64, mimeType });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(fileOrBlob);
  });
}

function buildOcrPrompt(hints: { languageFrom?: string; languageTo?: string; title?: string }): string {
  const fromHint = hints.languageFrom?.trim() || 'Englisch';
  const toHint = hints.languageTo?.trim() || 'Deutsch';
  const titleHint = hints.title?.trim() ? `Gewünschter Titel (falls passend übernehmen): "${hints.title.trim()}".` : '';

  return [
    'Du liest Vokabelseiten aus deutschen Schulbüchern oder Vokabelheften aus Fotos aus.',
    `Erwartete Sprachrichtung: ${fromHint} -> ${toHint} (passe an, falls das Bild eindeutig eine andere Sprache wie Französisch, Spanisch oder Latein zeigt).`,
    titleHint,
    'Extrahiere ALLE Vokabelpaare in der Reihenfolge der Seite.',
    'Regeln:',
    '1. "front" = Fremdwort / Ausdruck (ohne Lautschrift wie /.../ und ohne ganze Beispielsätze; kurze Hinweise wie "(to)" oder Artikel dürfen bleiben, wenn sie zum Lernen wichtig sind).',
    '2. "back" = deutsche Bedeutung (mehrere gültige Bedeutungen sauber mit Komma trennen, z. B. "versuchen, probieren").',
    '3. Ignoriere reine Beispielsätze, Seitenzahlen, Grammatik-Infokästen ohne Wortpaar und Kopfzeilen-Deko.',
    '4. Wenn ein Wort abgeschnitten, verwackelt oder handschriftlich unsicher lesbar ist, setze "uncertain": true.',
    '5. Schlage einen kurzen, klaren "title" aus der Überschrift der Seite vor (z. B. "Englisch – Unit 4").',
    'Antworte AUSSCHLIESSLICH mit gültigem JSON in exakt diesem Format:',
    '{"title":"...","languageFrom":"...","languageTo":"...","entries":[{"front":"...","back":"...","uncertain":false}]}',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Parses and normalizes raw JSON text returned by DeepSeek, Gemini, or OpenAI Vision models.
 * Strips optional markdown code fences and deduplicates identical pairs.
 */
export function parseVocabOcrResponse(
  rawText: string,
  fallback: { title?: string; languageFrom?: string; languageTo?: string } = {},
  makeId: () => string = makeTempId
): VocabOcrResult {
  const cleaned = String(rawText || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const jsonSlice = firstBrace !== -1 && lastBrace > firstBrace ? cleaned.slice(firstBrace, lastBrace + 1) : cleaned;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonSlice) as Record<string, unknown>;
  } catch {
    throw new Error('Die KI-Antwort konnte nicht als Vokabelliste gelesen werden. Bitte versuche ein schärferes Foto.');
  }

  const rawEntries = Array.isArray(parsed.entries) ? parsed.entries : [];
  const seen = new Set<string>();
  const entries: ExtractedVocabPair[] = [];

  for (const item of rawEntries) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const front = typeof row.front === 'string' ? row.front.trim().replace(/\s+/g, ' ') : '';
    const back = typeof row.back === 'string' ? row.back.trim().replace(/\s+/g, ' ') : '';
    if (!front || !back) continue;
    const key = `${front.toLocaleLowerCase()}\u0000${back.toLocaleLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({
      id: makeId(),
      front: front.slice(0, 180),
      back: back.slice(0, 240),
      ...(row.uncertain === true ? { uncertain: true } : {}),
    });
  }

  if (entries.length === 0) {
    throw new Error('Auf dem Foto wurden keine Vokabelpaare erkannt. Bitte fotografiere die Seite näher und gut beleuchtet.');
  }

  const detectedTitle = typeof parsed.title === 'string' ? parsed.title.trim() : '';
  const detectedFrom = typeof parsed.languageFrom === 'string' ? parsed.languageFrom.trim() : '';
  const detectedTo = typeof parsed.languageTo === 'string' ? parsed.languageTo.trim() : '';

  return {
    title: (fallback.title?.trim() || detectedTitle || 'Gescannte Vokabeln').slice(0, 120),
    languageFrom: (detectedFrom || fallback.languageFrom?.trim() || 'Englisch').slice(0, 40),
    languageTo: (detectedTo || fallback.languageTo?.trim() || 'Deutsch').slice(0, 40),
    entries,
  };
}

/**
 * Merges newly scanned entries into an existing entry array without duplicates.
 */
export function mergeVocabEntries<T extends { front: string; back: string }>(
  existing: T[],
  incoming: T[]
): { entries: T[]; addedCount: number } {
  const seen = new Set(
    existing.map(e => `${e.front.trim().toLocaleLowerCase()}\u0000${e.back.trim().toLocaleLowerCase()}`)
  );
  const additions: T[] = [];
  for (const item of incoming) {
    const front = item.front.trim();
    const back = item.back.trim();
    if (!front || !back) continue;
    const key = `${front.toLocaleLowerCase()}\u0000${back.toLocaleLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    additions.push({ ...item, front, back });
  }
  return { entries: [...existing, ...additions], addedCount: additions.length };
}

async function extractWithOpenAiCompatible(
  endpoint: string,
  photos: PreparedPhoto[],
  prompt: string,
  apiKey: string,
  model: string,
  providerLabel: string,
  includeDetailHigh: boolean
): Promise<string> {
  const content = [
    { type: 'text', text: prompt },
    ...photos.map(photo => ({
      type: 'image_url',
      image_url: {
        url: photo.dataUrl,
        ...(includeDetailHigh ? { detail: 'high' } : {}),
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
    const apiMessage = payload?.error?.message || `HTTP ${response.status}`;
    if (response.status === 401) {
      throw new Error(`Der ${providerLabel} API-Key ist ungültig. Bitte prüfe ihn in den Einstellungen.`);
    }
    if (response.status === 402 || response.status === 429) {
      throw new Error(`${providerLabel} Limit oder Guthaben erschöpft (${apiMessage}).`);
    }
    throw new Error(`${providerLabel}-Fehler: ${apiMessage}`);
  }

  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error(`${providerLabel} hat keine lesbare Antwort zurückgegeben.`);
  }
  return text;
}

async function extractWithGemini(
  photos: PreparedPhoto[],
  prompt: string,
  apiKey: string,
  model: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const parts = [
    { text: prompt },
    ...photos.map(photo => ({
      inline_data: {
        mime_type: photo.mimeType,
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
    const apiMessage = payload?.error?.message || `HTTP ${response.status}`;
    if (response.status === 400 && /API key/i.test(apiMessage)) {
      throw new Error('Der Gemini API-Key ist ungültig. Bitte prüfe ihn in den Einstellungen.');
    }
    if (response.status === 403 || response.status === 401) {
      throw new Error('Gemini API-Zugriff verweigert. Bitte prüfe deinen API-Key.');
    }
    if (response.status === 429) {
      throw new Error('API-Limit erreicht. Bitte kurz warten und erneut versuchen.');
    }
    throw new Error(`Gemini-Fehler: ${apiMessage}`);
  }

  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text || '')
    .join('\n');

  if (!text) {
    throw new Error('Gemini hat keine lesbare Antwort zurückgegeben.');
  }
  return text;
}

export async function extractVocabularyFromPhotos(
  photos: PreparedPhoto[],
  hints: { title?: string; languageFrom?: string; languageTo?: string } = {}
): Promise<VocabOcrResult> {
  if (!photos.length) {
    throw new Error('Bitte nimm zuerst mindestens ein Foto auf.');
  }

  const prompt = buildOcrPrompt(hints);
  const localCfg = getVocabAiConfig();

  // 1. Prefer the server-side proxy (/api/vocabulary/ocr): the shared key that an adult
  //    saved once lives there, so children never need (or see) an API key of their own.
  const headers = await getAdultAuthHeaders();
  if (headers) {
    let backendMissing = false;
    try {
      const response = await fetch('/api/vocabulary/ocr', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({
          photos: photos.map(p => ({ base64: p.base64, mimeType: p.mimeType })),
          prompt,
          ...(localCfg.apiKey ? { provider: localCfg.provider, apiKey: localCfg.apiKey } : {}),
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as { rawText?: string };
        if (typeof data.rawText === 'string') {
          return parseVocabOcrResponse(data.rawText, hints);
        }
      } else if (response.status === 404) {
        backendMissing = true;
      } else {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || `Server-Fehler (HTTP ${response.status}).`);
      }
    } catch (err) {
      // Only fall back to local dev proxy if the serverless endpoint itself is not mounted locally
      if (!backendMissing && err instanceof Error && err.message && !/Failed to fetch/i.test(err.message)) {
        throw err;
      }
      backendMissing = true;
    }

    if (!backendMissing) {
      throw new Error('Unerwartete Antwort vom OCR-Server.');
    }
  }

  // 2. Local Vite dev fallback (uses Vite /api/deepseek proxy for DeepSeek so CORS never blocks)
  const apiKey = localCfg.apiKey.trim();
  if (!apiKey) {
    throw new Error('Kein KI API-Key hinterlegt. Ein Erwachsener kann ihn unter Setup → KI-Vokabelscanner eintragen – danach gilt er für alle Familienmitglieder.');
  }

  const provider = detectProviderFromKey(apiKey) || localCfg.provider;
  const model = localCfg.model?.trim() || DEFAULT_MODELS[provider];

  let rawText: string;
  if (provider === 'deepseek') {
    rawText = await extractWithOpenAiCompatible(
      '/api/deepseek/v1/chat/completions',
      photos,
      prompt,
      apiKey,
      model,
      'DeepSeek',
      false
    );
  } else if (provider === 'openai') {
    rawText = await extractWithOpenAiCompatible(
      'https://api.openai.com/v1/chat/completions',
      photos,
      prompt,
      apiKey,
      model,
      'OpenAI',
      true
    );
  } else {
    rawText = await extractWithGemini(photos, prompt, apiKey, model);
  }

  return parseVocabOcrResponse(rawText, hints);
}
