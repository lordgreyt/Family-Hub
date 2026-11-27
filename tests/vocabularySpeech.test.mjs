import test from 'node:test';
import assert from 'node:assert/strict';

let audioInstances = 0;
const played = [];
const webAudioPlayed = [];
const fetchCalls = [];
const storage = new Map();
let failNextAudioPlay = false;
let nextFetchFail502 = false;

class FakeAudio {
  constructor() {
    audioInstances += 1;
    this.src = '';
    this.preload = '';
    this.playbackRate = 1;
    this.preservesPitch = true;
    this.currentTime = 0;
    this.paused = false;
    this.onended = null;
    this.onerror = null;
    this.error = null;
  }
  setAttribute() {}
  load() {}
  play() {
    this.paused = false;
    if (failNextAudioPlay) {
      failNextAudioPlay = false;
      this.error = { code: 4 };
      return Promise.reject(Object.assign(new Error('NotSupportedError'), { name: 'NotSupportedError' }));
    }
    played.push({ audio: this, src: this.src, playbackRate: this.playbackRate });
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

class FakeAudioContext {
  constructor() {
    this.state = 'running';
    this.destination = {};
  }
  async resume() {
    this.state = 'running';
  }
  async decodeAudioData(arrayBuffer) {
    return { byteLength: arrayBuffer.byteLength };
  }
  createBufferSource() {
    const source = {
      buffer: null,
      playbackRate: { value: 1 },
      onended: null,
      connect() {},
      disconnect() {},
      start() {
        webAudioPlayed.push(source);
      },
      stop() {},
    };
    return source;
  }
}

globalThis.window = { AudioContext: FakeAudioContext };
globalThis.Audio = FakeAudio;
globalThis.localStorage = {
  getItem: key => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, val) => storage.set(key, String(val)),
  removeItem: key => storage.delete(key),
};
globalThis.fetch = async (url, init) => {
  fetchCalls.push({ url, init });
  if (nextFetchFail502) {
    nextFetchFail502 = false;
    return {
      ok: false,
      status: 502,
      headers: { get: () => 'application/json' },
      json: async () => ({ error: { message: 'Temporary gateway error' } }),
    };
  }
  const mp3Bytes = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x21, 0xff, 0xfb, 0x90, 0x64]);
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'audio/mpeg' },
    arrayBuffer: async () => mp3Bytes.buffer.slice(0),
    blob: async () => new Blob([mp3Bytes], { type: 'audio/mpeg' }),
  };
};

const {
  SPEECH_RATE_SLOW,
  buildSpeechCacheKey,
  canSpeak,
  maskTtsKey,
  speakText,
  stopSpeaking,
  unlockAudio,
} = await import('../src/pages/speech.ts');

const tick = (ms = 40) => new Promise(resolve => setTimeout(resolve, ms));

function reset() {
  played.length = 0;
  webAudioPlayed.length = 0;
  fetchCalls.length = 0;
  failNextAudioPlay = false;
  nextFetchFail502 = false;
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

test('speakText nutzt ein einziges Audio-Element mit data:-MP3, cached es und spielt Langsam-Modus ohne Extra-Request', async () => {
  reset();
  let ended = 0;
  assert.equal(speakText('suitcase', 'Englisch', undefined, { onEnd: () => { ended += 1; } }), true);
  await tick();
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, '/api/openai/v1/audio/speech');
  assert.equal(played.length, 1);
  assert.equal(audioInstances, 1, 'es darf nur ein wiederverwendetes Audio-Element erstellt werden');
  assert.ok(played[0].src.startsWith('data:audio/mpeg;base64,'), 'Audio muss als stabile data:-URL statt blob: gespielt werden');
  assert.equal(played[0].playbackRate, 1);
  played[0].audio.onended();
  assert.equal(ended, 1);

  // Zweiter Aufruf im Langsam-Modus nutzt Memory-Cache (kein neuer API-Request, gleiches Audio-Element!)
  assert.equal(speakText('suitcase', 'Englisch', undefined, { rate: SPEECH_RATE_SLOW }), true);
  await tick();
  assert.equal(fetchCalls.length, 1, 'gecachtes Wort darf keinen zweiten API-Aufruf auslösen');
  assert.equal(audioInstances, 1, 'Audio-Element muss wiederverwendet werden');
  assert.equal(played.length, 2);
  assert.equal(played[1].playbackRate, SPEECH_RATE_SLOW);
  stopSpeaking();
  assert.equal(played[1].audio.paused, true);
});

test('Web-Audio-API-Fallback übernimmt automatisch bei Media-Fehler des Audio-Elements', async () => {
  reset();
  failNextAudioPlay = true;
  let errorCalled = 0;
  let ended = 0;
  assert.equal(
    speakText('umbrella', 'Englisch', () => { errorCalled += 1; }, { onEnd: () => { ended += 1; } }),
    true
  );
  await tick();
  assert.equal(errorCalled, 0, 'Web-Audio-Fallback muss den Fehler abfangen');
  assert.equal(webAudioPlayed.length, 1);
  webAudioPlayed[0].onended();
  assert.equal(ended, 1);
});

test('temporärer Server-Fehler (502) wird automatisch 1x wiederholt', async () => {
  reset();
  nextFetchFail502 = true;
  let errorCalled = 0;
  assert.equal(speakText('backpack', 'Englisch', () => { errorCalled += 1; }), true);
  await tick(450);
  assert.equal(errorCalled, 0);
  assert.equal(fetchCalls.length, 2, 'bei 502 muss 1x automatisch neu versucht werden');
  assert.equal(played.length, 1);
});

test('leerer Text löst keinen Request aus und unlockAudio wirft nicht', async () => {
  reset();
  unlockAudio();
  assert.equal(speakText('   ', 'Deutsch'), false);
  await tick();
  assert.equal(fetchCalls.length, 0);
});
