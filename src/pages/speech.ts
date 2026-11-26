/**
 * Studio-Sprachausgabe für Vokabeln über OpenAI TTS (`gpt-4o-mini-tts`)
 * mit dauerhaftem Browser-Cache (Cache API), sodass jede Vokabel nur einmal erzeugt wird.
 *
 * - Im Live-Betrieb (Vercel): ruft `/api/vocabulary/tts` auf (Key liegt verschlüsselt auf dem Server,
 *   Kinder können hören, aber niemals den Key sehen oder ändern).
 * - Lokal unter `vite` (ohne Vercel-Serverless): nutzt `/api/openai/v1/audio/speech` über den Vite-Dev-Proxy
 *   mit dem in Setup hinterlegten lokalen OpenAI-Key.
 */

export const SPEECH_RATE_NORMAL = 1.0;
export const SPEECH_RATE_SLOW = 0.72;

export type OpenAiVoice = 'coral' | 'sage' | 'nova' | 'echo' | 'alloy' | 'shimmer';
export type EnglishAccent = 'en-GB' | 'en-US';

export interface TtsStatus {
  configured: boolean;
  voice: OpenAiVoice;
  accent: EnglishAccent;
  keyHint: string;
  source: 'database' | 'env' | 'local' | 'none';
}

export interface SpeakOptions {
  rate?: number;
  onEnd?: () => void;
  voice?: OpenAiVoice;
  accent?: EnglishAccent;
}

export const OPENAI_VOICES: { id: OpenAiVoice; label: string; hint: string }[] = [
  { id: 'coral', label: 'Coral', hint: 'Warm & sehr klar' },
  { id: 'sage', label: 'Sage', hint: 'Ruhig & deutlich' },
  { id: 'nova', label: 'Nova', hint: 'Freundlich & modern' },
  { id: 'echo', label: 'Echo', hint: 'Ruhig (männlich)' },
  { id: 'alloy', label: 'Alloy', hint: 'Ausgewogen & neutral' },
  { id: 'shimmer', label: 'Shimmer', hint: 'Hell & sanft' },
];

const TTS_MODEL = 'gpt-4o-mini-tts';
const CACHE_NAME = 'family-hub-vocab-tts-v1';
const LOCAL_KEY_STORAGE = 'family_hub_vocab_tts_key';
const VOICE_STORAGE = 'family_hub_vocab_tts_voice';
const ACCENT_STORAGE = 'family_hub_vocab_en_accent';

const VALID_VOICES = new Set<string>(OPENAI_VOICES.map(v => v.id));

let activeAudio: HTMLAudioElement | null = null;
let activeRunId = 0;
const memoryBlobUrls = new Map<string, string>();
let lastTtsErrorMessage = '';

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && typeof Audio !== 'undefined';
}

export function getLastTtsError(): string {
  return lastTtsErrorMessage;
}

export function getTtsVoice(): OpenAiVoice {
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(VOICE_STORAGE) : null;
    if (saved && VALID_VOICES.has(saved)) return saved as OpenAiVoice;
  } catch { /* ignore */ }
  return 'coral';
}

export function setTtsVoice(voice: OpenAiVoice): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(VOICE_STORAGE, voice);
  } catch { /* ignore */ }
}

export function getEnglishAccent(): EnglishAccent {
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(ACCENT_STORAGE) : null;
    if (saved === 'en-US' || saved === 'en-GB') return saved;
  } catch { /* ignore */ }
  return 'en-GB';
}

export function setEnglishAccent(accent: EnglishAccent): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(ACCENT_STORAGE, accent);
  } catch { /* ignore */ }
}

function getLocalOpenAiKey(): string {
  try {
    return typeof localStorage !== 'undefined' ? (localStorage.getItem(LOCAL_KEY_STORAGE) || '').trim() : '';
  } catch {
    return '';
  }
}

function setLocalOpenAiKey(key: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const clean = key.trim();
    if (clean) localStorage.setItem(LOCAL_KEY_STORAGE, clean);
    else localStorage.removeItem(LOCAL_KEY_STORAGE);
  } catch { /* ignore */ }
}

export function maskTtsKey(key: string): string {
  const clean = key.trim();
  if (clean.length <= 8) return clean ? '••••' : '';
  return `${clean.slice(0, 4)}…${clean.slice(-4)}`;
}

async function getFirebaseAuthHeaders(): Promise<Record<string, string> | null> {
  try {
    const { auth } = await import('../services/firebase');
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    const token = await currentUser.getIdToken();
    return { Authorization: `Bearer ${token}` };
  } catch {
    return null;
  }
}

function localTtsStatus(): TtsStatus {
  const localKey = getLocalOpenAiKey();
  return {
    configured: Boolean(localKey),
    voice: getTtsVoice(),
    accent: getEnglishAccent(),
    keyHint: maskTtsKey(localKey),
    source: localKey ? 'local' : 'none',
  };
}

/**
 * Loads the shared TTS status.
 * The key is stored once by an adult; every family member (children included) gets
 * `configured: true` from the server and can therefore play the audio.
 * The API never exposes the raw key or the admin-side voice settings to children.
 */
export async function loadTtsStatus(): Promise<TtsStatus> {
  const headers = await getFirebaseAuthHeaders();
  if (headers) {
    try {
      const response = await fetch('/api/vocabulary/tts', {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      if (response.ok) {
        const data = (await response.json()) as TtsStatus;
        // Children receive placeholder voice/accent — only adopt real values.
        if (data.keyHint && data.voice && VALID_VOICES.has(data.voice)) setTtsVoice(data.voice);
        if (data.keyHint && (data.accent === 'en-GB' || data.accent === 'en-US')) setEnglishAccent(data.accent);
        if (data.configured) {
          return { ...data, voice: getTtsVoice(), accent: getEnglishAccent() };
        }
        const local = localTtsStatus();
        return local.configured ? local : data;
      }
    } catch {
      // Fall back to local config in plain Vite dev
    }
  }
  return localTtsStatus();
}

export async function saveTtsConfigSecurely(params: {
  apiKey?: string;
  voice?: OpenAiVoice;
  accent?: EnglishAccent;
  remove?: boolean;
}): Promise<TtsStatus> {
  const voice = params.voice || getTtsVoice();
  const accent = params.accent || getEnglishAccent();
  setTtsVoice(voice);
  setEnglishAccent(accent);

  const trimmedKey = (params.apiKey || '').trim();
  const headers = await getFirebaseAuthHeaders();
  if (headers) {
    try {
      const response = await fetch('/api/vocabulary/tts', {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({
          apiKey: trimmedKey,
          voice,
          accent,
          remove: Boolean(params.remove),
        }),
      });
      if (response.ok) {
        const remote = (await response.json()) as TtsStatus;
        setLocalOpenAiKey('');
        return remote;
      }
      if (response.status === 401 || response.status === 403) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || 'Nur Erwachsene dürfen den OpenAI Sprach-Key verwalten.');
      }
    } catch (err) {
      if (err instanceof Error && /Erwachsene|anmelden/i.test(err.message)) {
        throw err;
      }
      // Fall through to local dev storage when serverless API is not mounted locally
    }
  }

  if (params.remove) {
    setLocalOpenAiKey('');
  } else if (trimmedKey) {
    setLocalOpenAiKey(trimmedKey);
  }
  return localTtsStatus();
}

export function buildSpeechCacheKey(text: string, language: string, voice: OpenAiVoice, accent: EnglishAccent): string {
  const normalizedLang = /englisch|english/i.test(language) ? accent : language.trim().toLowerCase();
  const keyText = text.trim().toLowerCase();
  return `https://tts-cache.family-hub.local/v1/${encodeURIComponent(voice)}/${encodeURIComponent(normalizedLang)}/${encodeURIComponent(keyText)}`;
}

function buildLocalInstructions(language: string, accent: EnglishAccent): string {
  if (/englisch|english/i.test(language)) {
    const region = accent === 'en-US' ? 'American English' : 'British English';
    return `Pronounce this ${region} vocabulary word or short phrase clearly, naturally, and distinctly for a language student. If multiple variants are separated by commas, read all of them in order with a brief pause between them. Say only the provided text without adding any explanation.`;
  }
  if (/deutsch|german/i.test(language)) {
    return 'Sprich diese deutsche Vokabel oder Übersetzung klar, natürlich und deutlich in Hochdeutsch aus. Wenn mehrere Bedeutungen durch Komma getrennt sind, lies alle nacheinander mit kurzer Pause vor. Füge keine zusätzlichen Wörter hinzu.';
  }
  return `Pronounce this ${language} vocabulary word or phrase clearly and naturally as a native speaker for a language student. If multiple variants are separated by commas, read all of them in order with a brief pause between them. Say only the provided text.`;
}

async function fetchTtsAudioBlob(
  text: string,
  language: string,
  voice: OpenAiVoice,
  accent: EnglishAccent
): Promise<Blob> {
  const cacheUrl = buildSpeechCacheKey(text, language, voice, accent);

  // 1. Check persistent Cache API first
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(cacheUrl);
      if (cached && cached.ok) {
        return await cached.blob();
      }
    } catch { /* cache unavailable */ }
  }

  // 2. Try production backend route (/api/vocabulary/tts)
  let blob: Blob | null = null;
  let backendMissing = false;

  const headers = await getFirebaseAuthHeaders();
  if (headers) {
    try {
      const response = await fetch('/api/vocabulary/tts', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, language, voice, accent }),
      });

      if (response.ok) {
        blob = await response.blob();
      } else if (response.status === 404) {
        backendMissing = true;
      } else {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || `Sprachausgabe-Fehler (HTTP ${response.status}).`);
      }
    } catch (err) {
      if (!backendMissing && err instanceof Error && err.message && !/Failed to fetch/i.test(err.message)) {
        throw err;
      }
      backendMissing = true;
    }
  } else {
    backendMissing = true;
  }

  // 3. Local Vite dev fallback via /api/openai proxy (with local OpenAI key from Setup)
  if (!blob && backendMissing) {
    const localKey = getLocalOpenAiKey();
    if (!localKey) {
      throw new Error('Kein OpenAI API-Key für die Sprachausgabe hinterlegt (Setup → KI-Sprachausgabe).');
    }
    const response = await fetch('/api/openai/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localKey}`,
      },
      body: JSON.stringify({
        model: TTS_MODEL,
        voice,
        input: text,
        instructions: buildLocalInstructions(language, accent),
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const msg = errBody?.error?.message || `HTTP ${response.status}`;
      if (response.status === 401) {
        throw new Error('Der OpenAI API-Key ist ungültig. Bitte prüfe ihn unter Setup → KI-Sprachausgabe.');
      }
      throw new Error(`OpenAI TTS Fehler: ${msg}`);
    }
    blob = await response.blob();
  }

  if (!blob) {
    throw new Error('Audio konnte nicht geladen werden.');
  }

  // 4. Persist MP3 in Cache API for instant offline replay
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(
        cacheUrl,
        new Response(blob.slice(0), {
          headers: { 'Content-Type': 'audio/mpeg' },
        })
      );
    } catch { /* ignore quota errors */ }
  }

  return blob;
}

export function stopSpeaking(): void {
  activeRunId += 1;
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch { /* ignore */ }
    activeAudio = null;
  }
}

/**
 * Spielt die Vokabel über OpenAI Studio-TTS ab (mit Cache API).
 * Bei Langsam-Modus (`rate < 1`) wird die bereits gecachte Studio-MP3 sauber mit `playbackRate` verlangsamt.
 */
export function speakText(
  text: string,
  language: string,
  onError?: () => void,
  options?: SpeakOptions
): boolean {
  const cleanText = text.trim();
  if (!canSpeak() || !cleanText) return false;

  stopSpeaking();
  const runId = activeRunId;
  const voice = options?.voice || getTtsVoice();
  const accent = options?.accent || getEnglishAccent();
  const rate =
    typeof options?.rate === 'number' && Number.isFinite(options.rate)
      ? Math.min(1.5, Math.max(0.5, options.rate))
      : SPEECH_RATE_NORMAL;

  const memKey = buildSpeechCacheKey(cleanText, language, voice, accent);

  const playUrl = (url: string) => {
    if (runId !== activeRunId) return;
    const audio = new Audio(url);
    audio.playbackRate = rate;
    if ('preservesPitch' in audio) {
      (audio as HTMLAudioElement & { preservesPitch: boolean }).preservesPitch = true;
    }
    activeAudio = audio;
    audio.onended = () => {
      if (activeAudio === audio) activeAudio = null;
      if (runId === activeRunId) options?.onEnd?.();
    };
    audio.onerror = () => {
      if (activeAudio === audio) activeAudio = null;
      if (runId === activeRunId) {
        lastTtsErrorMessage = 'Audio konnte nicht abgespielt werden.';
        onError?.();
      }
    };
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        if (activeAudio === audio) activeAudio = null;
        if (runId === activeRunId) {
          lastTtsErrorMessage = 'Autoplay wurde vom Browser blockiert – tippe auf „Vorlesen“.';
          onError?.();
        }
      });
    }
  };

  const cachedUrl = memoryBlobUrls.get(memKey);
  if (cachedUrl) {
    lastTtsErrorMessage = '';
    playUrl(cachedUrl);
    return true;
  }

  fetchTtsAudioBlob(cleanText, language, voice, accent)
    .then(blob => {
      if (runId !== activeRunId) return;
      lastTtsErrorMessage = '';
      const url = URL.createObjectURL(blob);
      memoryBlobUrls.set(memKey, url);
      playUrl(url);
    })
    .catch((err: unknown) => {
      if (runId !== activeRunId) return;
      lastTtsErrorMessage = err instanceof Error ? err.message : 'OpenAI Sprachausgabe fehlgeschlagen.';
      onError?.();
    });

  return true;
}
