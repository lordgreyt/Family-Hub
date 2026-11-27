/**
 * Fröhliche, sanfte Web-Audio-Soundeffekte für die Vokabel-Schatzjagd
 * (komplett synthetisiert ohne externe Audio-Dateien, jederzeit stumm schaltbar).
 */

const SOUND_MUTE_STORAGE = 'family_hub_vocab_sfx_muted';

let sfxCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sfxCtx) {
    try {
      sfxCtx = new Ctor();
    } catch {
      return null;
    }
  }
  if (sfxCtx.state === 'suspended') {
    void sfxCtx.resume().catch(() => {});
  }
  return sfxCtx;
}

export function isVocabSfxMuted(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(SOUND_MUTE_STORAGE) === '1';
  } catch {
    return false;
  }
}

export function setVocabSfxMuted(muted: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SOUND_MUTE_STORAGE, muted ? '1' : '0');
    }
  } catch { /* ignore */ }
}

function playTone(freq: number, duration: number, type: OscillatorType, gainPeak: number, delay = 0) {
  if (isVocabSfxMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainPeak, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  } catch { /* ignore */ }
}

/** Klopf-/Spannungs-Ton beim Antippen der wackelnden Schatztruhe (steigt pro Tipp an). */
export function playChestTapSound(step: number, totalSteps: number): void {
  const ratio = Math.min(1, Math.max(0, step / Math.max(1, totalSteps)));
  const baseFreq = 280 + ratio * 380;
  playTone(baseFreq, 0.11, 'triangle', 0.16, 0);
  playTone(baseFreq * 1.5, 0.09, 'sine', 0.08, 0.03);
}

/** Fröhliche Glitzer-Fanfare beim Aufspringen der Schatztruhe. */
export function playChestOpenSound(): void {
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
  notes.forEach((freq, idx) => {
    playTone(freq, 0.24, 'triangle', 0.16, idx * 0.065);
    playTone(freq * 2, 0.18, 'sine', 0.06, idx * 0.065 + 0.02);
  });
}

/** Kurzer fröhlicher Pling für richtige Antworten / Combo-Serien. */
export function playComboPing(combo: number): void {
  const pitchBoost = Math.min(combo, 10) * 32;
  playTone(540 + pitchBoost, 0.12, 'sine', 0.1, 0);
  if (combo >= 5 && combo % 5 === 0) {
    playTone(720 + pitchBoost, 0.16, 'triangle', 0.12, 0.07);
    playTone(960 + pitchBoost, 0.2, 'sine', 0.1, 0.14);
  }
}
