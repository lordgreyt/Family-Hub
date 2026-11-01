import { speechLangFor } from './vocabularyLearn.ts';

/** Browser-Sprachausgabe (Web Speech API) – mit Workarounds für Chrome/Android. */

export function canSpeak() {
  return typeof window !== 'undefined'
    && 'speechSynthesis' in window
    && typeof window.SpeechSynthesisUtterance === 'function';
}

/**
 * Chrome verwirft Utterances, die nicht referenziert bleiben (GC) – deshalb kurz festhalten.
 */
const spoken: SpeechSynthesisUtterance[] = [];
let pendingTimer: number | null = null;

function clearPending() {
  if (pendingTimer === null || typeof window === 'undefined') return;
  window.clearTimeout(pendingTimer);
  pendingTimer = null;
}

export function stopSpeaking() {
  clearPending();
  if (!canSpeak()) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    // Chrome bleibt nach cancel() gelegentlich im pausierten Zustand hängen.
    if (synth.paused) synth.resume();
  } catch { /* nicht verfügbar */ }
}

/**
 * Liest Text vor. Ein laufende Ausgabe wird abgebrochen und nach kurzer Pause neu gestartet –
 * cancel() + speak() im selben Tick wird von Chrome/Android sonst still verschluckt.
 */
export function speakText(text: string, language: string, onError?: () => void) {
  if (!canSpeak() || !text.trim()) return false;
  try {
    const synth = window.speechSynthesis;
    const lang = speechLangFor(language);

    const utteranceFor = (attempt: number) => {
      const utterance = new window.SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 0.92;
      const voice = synth.getVoices().find(candidate => candidate.lang?.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
      if (voice) utterance.voice = voice;
      utterance.onend = () => {
        const index = spoken.indexOf(utterance);
        if (index >= 0) spoken.splice(index, 1);
      };
      utterance.onerror = event => {
        const reason = (event as { error?: string } | undefined)?.error;
        // Unser eigenes cancel() löst 'interrupted' aus – das ist kein echter Fehler.
        if (reason === 'interrupted' || reason === 'canceled') return;
        if (attempt < 2) {
          clearPending();
          pendingTimer = window.setTimeout(() => { pendingTimer = null; utteranceFor(attempt + 1); }, 260);
          return;
        }
        onError?.();
      };
      spoken.push(utterance);
      if (spoken.length > 8) spoken.shift();
      synth.speak(utterance);
    };

    clearPending();
    if (synth.speaking || synth.pending || synth.paused) {
      synth.cancel();
      if (synth.paused) synth.resume();
      pendingTimer = window.setTimeout(() => { pendingTimer = null; utteranceFor(1); }, 160);
    } else {
      utteranceFor(1);
    }
    return true;
  } catch {
    return false;
  }
}
