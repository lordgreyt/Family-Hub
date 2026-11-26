import test from 'node:test';
import assert from 'node:assert/strict';

const played = [];
const fetchCalls = [];
const storage = new Map();

class FakeAudio {
  constructor(src) {
    this.src = src;
    this.playbackRate = 1;
    this.preservesPitch = true;
    this.currentTime = 0;
    this.paused = false;
    this.onended = null;
    this.onerror = null;
  }
  play() {
    played.push(this);
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

globalThis.window = {};
globalThis.Audio = FakeAudio;
globalThis.localStorage = {
  getItem: key => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, val) => storage.set(key, String(val)),
  removeItem: key => storage.delete(key),
};
globalThis.URL.createObjectURL = blob => `blob:test-${played.length}-${blob.size}`;
globalThis.fetch = async (url, init) => {
  fetchCalls.push({ url, init });
  return {
    ok: true,
    status: 200,
    blob: async () => new Blob(['fake-mp3'], { type: 'audio/mpeg' }),
  };
};

const {
  SPEECH_RATE_SLOW,
  buildSpeechCacheKey,
  canSpeak,
  maskTtsKey,
  speakText,
  stopSpeaking,
} = await import('../src/pages/speech.ts');

const tick = (ms = 25) => new Promise(resolve => setTimeout(resolve, ms));

function reset() {
  played.length = 0;
  fetchCalls.length = 0;
  storage.clear();
  storage.set('family_hub_vocab_tts_key', 'sk-test-openai-key-1234567890');
  stopSpeaking();
}

test('canSpeak erkennt Audio-Unterstützung und Cache-Keys trennen Sprache/Stimme', () => {
  reset();
  assert.equal(canSpeak(), true);
  assert.equal(maskTtsKey('sk-1234567890abcd'), 'sk-1…abcd');
  const ukKey = buildSpeechCacheKey('Schedule', 'Englisch', 'coral', 'en-GB');
  const usKey = buildSpeechCacheKey('schedule', 'Englisch', 'coral', 'en-US');
  assert.notEqual(ukKey, usKey);
  assert.equal(ukKey, buildSpeechCacheKey('  schedule ', 'Englisch', 'coral', 'en-GB'));
});

test('speakText lädt MP3 über OpenAI-Proxy, cached es und spielt Langsam-Modus ohne Extra-Request', async () => {
  reset();
  let ended = 0;
  assert.equal(speakText('suitcase', 'Englisch', undefined, { onEnd: () => { ended += 1; } }), true);
  await tick();
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, '/api/openai/v1/audio/speech');
  assert.equal(played.length, 1);
  assert.equal(played[0].playbackRate, 1);
  played[0].onended();
  assert.equal(ended, 1);

  // Zweiter Aufruf im Langsam-Modus nutzt Memory-Cache (kein neuer API-Request!)
  assert.equal(speakText('suitcase', 'Englisch', undefined, { rate: SPEECH_RATE_SLOW }), true);
  await tick();
  assert.equal(fetchCalls.length, 1, 'gecachtes Wort darf keinen zweiten API-Aufruf auslösen');
  assert.equal(played.length, 2);
  assert.equal(played[1].playbackRate, SPEECH_RATE_SLOW);
  stopSpeaking();
  assert.equal(played[1].paused, true);
});

test('leerer Text löst keinen Request aus', async () => {
  reset();
  assert.equal(speakText('   ', 'Deutsch'), false);
  await tick();
  assert.equal(fetchCalls.length, 0);
  assert.equal(played.length, 0);
});
