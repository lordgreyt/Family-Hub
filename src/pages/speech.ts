/**
 * Studio-Sprachausgabe für Vokabeln über OpenAI TTS (`gpt-4o-mini-tts`)
 * mit dauerhaftem Browser-Cache (Cache API), sodass jede Vokabel nur einmal erzeugt wird.
 *
 * Mobil-optimierte Wiedergabe (iOS Safari / PWA, Android Chrome, Samsung Internet):
 * - Ein einziges, wiederverwendetes `<audio>`-Element (kein Hardware-Decoder-Überlauf,
 *   beibehaltene User-Gesture-Entsperrung im Hör-Modus).
 * - `data:audio/mpeg;base64,...` statt anfälliger `blob:`-URLs (vermeidet iOS AVPlayer Range-Bugs).
 * - Automatischer Web-Audio-API-Fallback (`AudioContext.decodeAudioData`), falls `<audio>`
 *   trotzdem einen Media-Fehler meldet.
 * - Validierung & Selbstheilung: leere/kaputte Cache-Einträge werden verworfen und 1× frisch geladen.
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
// 46-Byte standardkonforme Stille-WAV zum synchronen Entsperren auf iOS/Mobile im Click-Handler
const SILENT_WAV_DATA_URL = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQIAAAAAAA==';

const VALID_VOICES = new Set<string>(OPENAI_VOICES.map(v => v.id));

interface CachedAudio {
  bytes: Uint8Array;
  dataUrl: string;
}

let sharedAudio: HTMLAudioElement | null = null;
let sharedAudioUnlocked = false;
let sharedAudioContext: AudioContext | null = null;
let activeBufferSource: AudioBufferSourceNode | null = null;
let activeRunId = 0;
const memoryAudioCache = new Map<string, CachedAudio>();
const inflightFetches = new Map<string, Promise<{ audio: CachedAudio; fromCache: boolean }>>();
let lastTtsErrorMessage = '';

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && (typeof Audio !== 'undefined' || getAudioContextClass() !== null);
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

async function getFirebaseAuthHeaders(forceRefresh = false): Promise<Record<string, string> | null> {
  try {
    const { auth } = await import('../services/firebase');
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    const token = await currentUser.getIdToken(forceRefresh);
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

function getAudioContextClass(): (typeof AudioContext) | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return win.AudioContext || win.webkitAudioContext || null;
}

function getAudioContext(): AudioContext | null {
  const Ctor = getAudioContextClass();
  if (!Ctor) return null;
  if (!sharedAudioContext) {
    try {
      sharedAudioContext = new Ctor();
    } catch {
      return null;
    }
  }
  return sharedAudioContext;
}

function getSharedAudio(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = 'auto';
    if (typeof sharedAudio.setAttribute === 'function') {
      sharedAudio.setAttribute('playsinline', 'true');
    }
  }
  return sharedAudio;
}

/**
 * Entsperrt `<audio>` und `AudioContext` synchron innerhalb eines User-Klicks,
 * damit nachfolgende Vokabeln (nach `fetch` oder Denkpause) auf iOS Safari & Mobile nicht blockiert werden.
 */
export function unlockAudio(): void {
  const ctx = getAudioContext();
  if (ctx) {
    try {
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
    } catch { /* ignore */ }
  }

  if (!sharedAudioUnlocked) {
    const audio = getSharedAudio();
    if (audio) {
      try {
        audio.onerror = null;
        audio.onended = null;
        audio.src = SILENT_WAV_DATA_URL;
        const p = audio.play();
        sharedAudioUnlocked = true;
        if (p && typeof p.then === 'function') {
          p.then(() => {
            if (audio.src === SILENT_WAV_DATA_URL) {
              try {
                audio.pause();
                audio.currentTime = 0;
              } catch { /* ignore */ }
            }
          }).catch(() => {
            sharedAudioUnlocked = false;
          });
        }
      } catch {
        sharedAudioUnlocked = false;
      }
    }
  }
}

function bytesToDataUrl(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    const CHUNK = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return `data:audio/mpeg;base64,${btoa(binary)}`;
  }
  const maybeBuffer = (globalThis as unknown as { Buffer?: { from: (data: Uint8Array) => { toString: (enc: string) => string } } }).Buffer;
  if (maybeBuffer) {
    return `data:audio/mpeg;base64,${maybeBuffer.from(bytes).toString('base64')}`;
  }
  throw new Error('Base64-Kodierung nicht verfügbar.');
}

function isValidAudioBytes(bytes: Uint8Array, contentType?: string | null): boolean {
  if (!bytes || bytes.byteLength === 0) return false;
  const ct = (contentType || '').toLowerCase();
  if (ct && (ct.includes('text/html') || ct.includes('application/json') || ct.includes('text/plain'))) {
    return false;
  }
  // Erste sichtbare Zeichen auf versehentliches HTML (`<`) oder JSON (`{`) prüfen
  let idx = 0;
  while (idx < bytes.length && idx < 16 && (bytes[idx] === 0x20 || bytes[idx] === 0x09 || bytes[idx] === 0x0a || bytes[idx] === 0x0d)) {
    idx += 1;
  }
  if (idx < bytes.length && (bytes[idx] === 0x3c || bytes[idx] === 0x7b)) {
    return false;
  }
  return true;
}

async function readResponseAudioBytes(response: Response): Promise<Uint8Array> {
  const contentType = typeof response.headers?.get === 'function' ? response.headers.get('content-type') : '';
  let bytes: Uint8Array;
  if (typeof response.arrayBuffer === 'function') {
    bytes = new Uint8Array(await response.arrayBuffer());
  } else {
    const blob = await response.blob();
    bytes = new Uint8Array(await blob.arrayBuffer());
  }
  if (!isValidAudioBytes(bytes, contentType)) {
    throw new Error('Ungültige Audiodatei vom Server erhalten.');
  }
  return bytes;
}

async function deleteCachedEntry(cacheUrl: string): Promise<void> {
  memoryAudioCache.delete(cacheUrl);
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.delete(cacheUrl);
    } catch { /* ignore */ }
  }
}

async function fetchFromNetworkWithRetry(
  text: string,
  language: string,
  voice: OpenAiVoice,
  accent: EnglishAccent
): Promise<Uint8Array> {
  const attemptOnce = async (): Promise<Uint8Array> => {
    let bytes: Uint8Array | null = null;
    let backendMissing = false;

    const headers = await getFirebaseAuthHeaders();
    if (headers) {
      try {
        let response = await fetch('/api/vocabulary/tts', {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text, language, voice, accent }),
        });

        // Falls ein Firebase-Token nach PWA-Standby abgelaufen ist (401), 1× frisch erneuern
        if (response.status === 401) {
          const freshHeaders = await getFirebaseAuthHeaders(true);
          if (freshHeaders) {
            response = await fetch('/api/vocabulary/tts', {
              method: 'POST',
              headers: {
                ...freshHeaders,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ text, language, voice, accent }),
            });
          }
        }

        if (response.ok) {
          bytes = await readResponseAudioBytes(response);
        } else if (response.status === 404) {
          backendMissing = true;
        } else {
          const rawText = await response.text().catch(() => '');
          let parsedErr = '';
          try {
            const parsed = JSON.parse(rawText);
            if (parsed && typeof parsed.error === 'string') parsedErr = parsed.error;
          } catch { /* non-JSON error page (e.g. Vercel protection) */ }
          const err = new Error(parsedErr || `Sprachausgabe-Fehler (HTTP ${response.status}).`) as Error & {
            retryable?: boolean;
          };
          err.retryable = response.status >= 500 || response.status === 429;
          throw err;
        }
      } catch (err) {
        if (!backendMissing && err instanceof Error && err.message && !/Failed to fetch|NetworkError|Load failed/i.test(err.message)) {
          throw err;
        }
        if (err instanceof Error && /Failed to fetch|NetworkError|Load failed/i.test(err.message)) {
          // Im Live-Betrieb ohne lokalen Key nicht still als backendMissing verschlucken
          if (!getLocalOpenAiKey()) {
            const netErr = new Error('Netzwerkfehler beim Laden der Sprachausgabe.') as Error & { retryable?: boolean };
            netErr.retryable = true;
            throw netErr;
          }
        }
        backendMissing = true;
      }
    } else {
      backendMissing = true;
    }

    if (!bytes && backendMissing) {
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
        const err = new Error(`OpenAI TTS Fehler: ${msg}`) as Error & { retryable?: boolean };
        err.retryable = response.status >= 500 || response.status === 429;
        throw err;
      }
      bytes = await readResponseAudioBytes(response);
    }

    if (!bytes) {
      throw new Error('Audio konnte nicht geladen werden.');
    }
    return bytes;
  };

  try {
    return await attemptOnce();
  } catch (err) {
    const retryable = Boolean(
      err && typeof err === 'object' && 'retryable' in err && (err as { retryable?: boolean }).retryable
    );
    if (!retryable) throw err;
    await new Promise(resolve => setTimeout(resolve, 350));
    return attemptOnce();
  }
}

async function loadTtsAudio(
  text: string,
  language: string,
  voice: OpenAiVoice,
  accent: EnglishAccent,
  bypassCache = false
): Promise<{ audio: CachedAudio; fromCache: boolean }> {
  const cacheUrl = buildSpeechCacheKey(text, language, voice, accent);

  if (!bypassCache) {
    const inMemory = memoryAudioCache.get(cacheUrl);
    if (inMemory) return { audio: inMemory, fromCache: true };

    const pending = inflightFetches.get(cacheUrl);
    if (pending) return pending;
  }

  const task = (async (): Promise<{ audio: CachedAudio; fromCache: boolean }> => {
    // 1. Dauerhafte Cache API prüfen (und beschädigte Einträge sofort aussortieren)
    if (!bypassCache && typeof caches !== 'undefined') {
      try {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(cacheUrl);
        if (cached && cached.ok) {
          const cachedBytes = new Uint8Array(await cached.arrayBuffer());
          if (isValidAudioBytes(cachedBytes, 'audio/mpeg')) {
            const entry: CachedAudio = { bytes: cachedBytes, dataUrl: bytesToDataUrl(cachedBytes) };
            memoryAudioCache.set(cacheUrl, entry);
            return { audio: entry, fromCache: true };
          }
          await cache.delete(cacheUrl);
        }
      } catch { /* cache unavailable */ }
    }

    // 2. Frisch vom Server/Proxy laden (mit 1× Retry bei Netzwerk-/5xx-Hänger)
    const bytes = await fetchFromNetworkWithRetry(text, language, voice, accent);
    const entry: CachedAudio = { bytes, dataUrl: bytesToDataUrl(bytes) };
    memoryAudioCache.set(cacheUrl, entry);

    // 3. Dauerhaft in Cache API ablegen
    if (typeof caches !== 'undefined') {
      try {
        const cache = await caches.open(CACHE_NAME);
        const copy = new Uint8Array(bytes.byteLength);
        copy.set(bytes);
        await cache.put(
          cacheUrl,
          new Response(copy.buffer, {
            headers: { 'Content-Type': 'audio/mpeg' },
          })
        );
      } catch { /* ignore quota errors */ }
    }

    return { audio: entry, fromCache: false };
  })();

  if (!bypassCache) {
    inflightFetches.set(cacheUrl, task);
  }
  try {
    return await task;
  } finally {
    if (inflightFetches.get(cacheUrl) === task) {
      inflightFetches.delete(cacheUrl);
    }
  }
}

/** Lädt eine Vokabel still in den Cache vor (z. B. nächster Schritt im Hör-Modus). */
export function prefetchSpeech(text: string, language: string, options?: Pick<SpeakOptions, 'voice' | 'accent'>): void {
  const cleanText = text.trim();
  if (!canSpeak() || !cleanText) return;
  const voice = options?.voice || getTtsVoice();
  const accent = options?.accent || getEnglishAccent();
  void loadTtsAudio(cleanText, language, voice, accent).catch(() => { /* ignore background prefetch failures */ });
}

export function stopSpeaking(): void {
  activeRunId += 1;
  if (sharedAudio) {
    try {
      sharedAudio.onended = null;
      sharedAudio.onerror = null;
      sharedAudio.pause();
      sharedAudio.currentTime = 0;
    } catch { /* ignore */ }
  }
  if (activeBufferSource) {
    try {
      activeBufferSource.onended = null;
      activeBufferSource.stop();
      activeBufferSource.disconnect();
    } catch { /* ignore */ }
    activeBufferSource = null;
  }
}

async function playViaWebAudio(bytes: Uint8Array, rate: number, runId: number, onEnd?: () => void): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx || typeof ctx.decodeAudioData !== 'function') return false;
  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const decoded = await ctx.decodeAudioData(copy as ArrayBuffer);
    if (runId !== activeRunId) return true;

    const source = ctx.createBufferSource();
    source.buffer = decoded;
    source.playbackRate.value = rate;
    source.connect(ctx.destination);
    activeBufferSource = source;
    source.onended = () => {
      if (activeBufferSource === source) activeBufferSource = null;
      if (runId === activeRunId) onEnd?.();
    };
    source.start(0);
    return true;
  } catch {
    return false;
  }
}

function describeMediaError(audio: HTMLAudioElement): string {
  const code = audio.error?.code;
  if (code === 2) return 'Audio-Netzwerkfehler (Code 2).';
  if (code === 3) return 'Audiodatei konnte nicht dekodiert werden (Code 3).';
  if (code === 4) return 'Audioformat wird vom Browser abgelehnt (Code 4).';
  return 'Audio konnte nicht abgespielt werden.';
}

function playViaSharedAudioElement(
  audioData: CachedAudio,
  rate: number,
  runId: number,
  onEnd?: () => void,
  onLateMediaError?: (message: string) => void
): Promise<{ ok: true } | { ok: false; reason: 'autoplay' | 'media'; message: string }> {
  const audio = getSharedAudio();
  if (!audio) {
    return Promise.resolve({ ok: false, reason: 'media', message: 'Audio-Element nicht verfügbar.' });
  }

  return new Promise(resolve => {
    let settled = false;
    const finish = (result: { ok: true } | { ok: false; reason: 'autoplay' | 'media'; message: string }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    try {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.src = audioData.dataUrl;
      audio.currentTime = 0;
      audio.playbackRate = rate;
      if ('preservesPitch' in audio) {
        (audio as HTMLAudioElement & { preservesPitch: boolean }).preservesPitch = true;
      }
      if (typeof audio.load === 'function') {
        audio.load();
      }
    } catch {
      finish({ ok: false, reason: 'media', message: 'Audio konnte nicht initialisiert werden.' });
      return;
    }

    audio.onended = () => {
      if (runId === activeRunId) onEnd?.();
    };

    audio.onerror = () => {
      if (runId !== activeRunId) {
        finish({ ok: true });
        return;
      }
      const message = describeMediaError(audio);
      if (!settled) {
        finish({ ok: false, reason: 'media', message });
      } else {
        onLateMediaError?.(message);
      }
    };

    const playPromise = audio.play();
    sharedAudioUnlocked = true;
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => finish({ ok: true }))
        .catch((err: unknown) => {
          if (runId !== activeRunId) {
            finish({ ok: true });
            return;
          }
          const errName = err && typeof err === 'object' && 'name' in err ? String((err as { name: unknown }).name) : '';
          if (errName === 'AbortError') {
            finish({ ok: true });
            return;
          }
          if (errName === 'NotAllowedError') {
            finish({
              ok: false,
              reason: 'autoplay',
              message: 'Autoplay wurde vom Browser blockiert – tippe auf „Vorlesen“.',
            });
            return;
          }
          finish({
            ok: false,
            reason: 'media',
            message: err instanceof Error && err.message ? err.message : 'Audio konnte nicht abgespielt werden.',
          });
        });
    } else {
      finish({ ok: true });
    }
  });
}

/**
 * Spielt die Vokabel über OpenAI Studio-TTS ab (mit Cache API, Einzel-Audio-Element & Web-Audio-Fallback).
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
  const cacheUrl = buildSpeechCacheKey(cleanText, language, voice, accent);

  const playWithRecovery = async (audioData: CachedAudio, fromCache: boolean): Promise<void> => {
    if (runId !== activeRunId) return;

    let lateRecoveryTriggered = false;
    const handleLateError = async (message: string) => {
      if (lateRecoveryTriggered || runId !== activeRunId) return;
      lateRecoveryTriggered = true;
      const webAudioOk = await playViaWebAudio(audioData.bytes, rate, runId, options?.onEnd);
      if (webAudioOk || runId !== activeRunId) {
        lastTtsErrorMessage = '';
        return;
      }
      lastTtsErrorMessage = message;
      onError?.();
    };

    const result = await playViaSharedAudioElement(audioData, rate, runId, options?.onEnd, msg => {
      void handleLateError(msg);
    });
    if (result.ok || runId !== activeRunId) {
      lastTtsErrorMessage = '';
      return;
    }

    // Automatischer Fallback auf Web Audio API (umgeht iOS Safari/WebKit `<audio>`-Aussetzer komplett)
    if (result.reason === 'media' || result.reason === 'autoplay') {
      const webAudioOk = await playViaWebAudio(audioData.bytes, rate, runId, options?.onEnd);
      if (webAudioOk || runId !== activeRunId) {
        lastTtsErrorMessage = '';
        return;
      }
    }

    // Selbstheilung: falls ein korrupter Cache-Eintrag vorlag, löschen und 1× frisch vom Server laden
    if (fromCache && result.reason === 'media') {
      await deleteCachedEntry(cacheUrl);
      if (runId !== activeRunId) return;
      try {
        const fresh = await loadTtsAudio(cleanText, language, voice, accent, true);
        if (runId !== activeRunId) return;
        const retryResult = await playViaSharedAudioElement(fresh.audio, rate, runId, options?.onEnd);
        if (retryResult.ok || runId !== activeRunId) {
          lastTtsErrorMessage = '';
          return;
        }
        const retryWebAudioOk = await playViaWebAudio(fresh.audio.bytes, rate, runId, options?.onEnd);
        if (retryWebAudioOk || runId !== activeRunId) {
          lastTtsErrorMessage = '';
          return;
        }
      } catch (err) {
        if (runId !== activeRunId) return;
        lastTtsErrorMessage = err instanceof Error ? err.message : result.message;
        onError?.();
        return;
      }
    }

    lastTtsErrorMessage = result.message;
    onError?.();
  };

  // Wenn bereits im RAM-Cache: sofort synchron im Klick-Handler starten (optimal für iOS/Mobile Autoplay)
  const cachedInMemory = memoryAudioCache.get(cacheUrl);
  if (cachedInMemory) {
    lastTtsErrorMessage = '';
    void playWithRecovery(cachedInMemory, true);
    return true;
  }

  // AudioContext ggf. schon im Klick-Handler reaktivieren
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    try {
      void ctx.resume();
    } catch { /* ignore */ }
  }

  loadTtsAudio(cleanText, language, voice, accent)
    .then(({ audio, fromCache }) => playWithRecovery(audio, fromCache))
    .catch((err: unknown) => {
      if (runId !== activeRunId) return;
      lastTtsErrorMessage = err instanceof Error ? err.message : 'OpenAI Sprachausgabe fehlgeschlagen.';
      onError?.();
    });

  return true;
}
