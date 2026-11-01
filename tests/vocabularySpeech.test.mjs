import test from 'node:test';
import assert from 'node:assert/strict';

// Minimaler Ersatz für die Web-Speech-API, bevor das Modul geladen wird.
class FakeUtterance {
  constructor(text) {
    this.text = text;
    this.lang = '';
    this.rate = 1;
    this.voice = null;
    this.onend = null;
    this.onerror = null;
  }
}

const state = { spoken: [], speaking: false, pending: false, paused: false, cancels: 0, current: null };

const synth = {
  get speaking() { return state.speaking; },
  get pending() { return state.pending; },
  get paused() { return state.paused; },
  getVoices: () => [
    { lang: 'de-DE', name: 'de' },
    { lang: 'en-US', name: 'en' },
  ],
  speak(utterance) {
    state.spoken.push(utterance);
    state.speaking = true;
    state.current = utterance;
  },
  cancel() {
    state.cancels += 1;
    const previous = state.current;
    state.speaking = false;
    state.pending = false;
    state.current = null;
    if (previous?.onerror) previous.onerror({ error: 'interrupted' });
  },
  resume() { state.paused = false; },
  pause() { state.paused = true; },
};

globalThis.window = {
  speechSynthesis: synth,
  SpeechSynthesisUtterance: FakeUtterance,
  setTimeout,
  clearTimeout,
};

const { canSpeak, speakText, stopSpeaking } = await import('../src/pages/speech.ts');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function reset() {
  state.spoken.length = 0;
  state.speaking = false;
  state.pending = false;
  state.paused = false;
  state.cancels = 0;
  state.current = null;
}

test('kann sprechen und setzt Sprache + Stimme', () => {
  reset();
  assert.equal(canSpeak(), true);
  assert.equal(speakText('versuchen', 'Deutsch'), true);
  assert.equal(state.spoken.length, 1);
  assert.equal(state.spoken[0].lang, 'de-DE');
  assert.equal(state.spoken[0].voice?.name, 'de');
  assert.equal(state.spoken[0].text, 'versuchen');
  stopSpeaking();
});

test('Nochmal hören startet die Ausgabe wirklich neu', async () => {
  reset();
  speakText('versuchen', 'Deutsch');
  assert.equal(state.spoken.length, 1);
  // Zweiter Klick während der laufenden Ausgabe
  speakText('versuchen', 'Deutsch');
  assert.equal(state.cancels, 1);
  assert.equal(state.spoken.length, 1, 'speak() darf nicht im selben Tick folgen');
  await sleep(260);
  assert.equal(state.spoken.length, 2, 'nach der kurzen Pause muss neu gesprochen werden');
  assert.equal(state.spoken[1].text, 'versuchen');
  stopSpeaking();
});

test('interrupted durch eigenes cancel() gilt nicht als Fehler', async () => {
  reset();
  let errors = 0;
  speakText('probieren', 'Deutsch', () => { errors += 1; });
  speakText('probieren', 'Deutsch', () => { errors += 1; });
  await sleep(260);
  assert.equal(errors, 0);
  stopSpeaking();
  await sleep(50);
  assert.equal(errors, 0);
});

test('echter Fehler wird einmal wiederholt und dann gemeldet', async () => {
  reset();
  let errors = 0;
  speakText('test', 'Deutsch', () => { errors += 1; });
  state.spoken[0].onerror({ error: 'synthesis-failed' });
  assert.equal(errors, 0, 'erst nach dem Retry melden');
  await sleep(400);
  assert.equal(state.spoken.length, 2, 'zweiter Versuch');
  state.spoken[1].onerror({ error: 'synthesis-failed' });
  await sleep(400);
  assert.equal(errors, 1);
  stopSpeaking();
});

test('pausierten Zustand beim Neustart wieder aufheben', async () => {
  reset();
  state.speaking = true;
  state.paused = true;
  speakText('ruhig', 'Deutsch');
  assert.equal(state.paused, false);
  stopSpeaking();
});

test('leerer Text löst keine Ausgabe aus', () => {
  reset();
  assert.equal(speakText('   ', 'Deutsch'), false);
  assert.equal(state.spoken.length, 0);
});
