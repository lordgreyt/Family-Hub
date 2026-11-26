'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('vocabulary import endpoint rejects unauthenticated writes before touching Firebase', async () => {
  const previousToken = process.env.FAMILY_HUB_API_TOKEN;
  delete process.env.FAMILY_HUB_API_TOKEN;
  try {
    const { default: handler } = await import('../api/vocabulary/import.js');
    const headers = {};
    let statusCode = 200;
    let body;
    const response = {
      setHeader(name, value) { headers[name] = value; return this; },
      status(code) { statusCode = code; return this; },
      json(value) { body = value; return this; },
      end() { return this; },
    };

    await handler({ method: 'POST', headers: {}, body: { title: 'Test' } }, response);
    assert.equal(statusCode, 401);
    assert.deepEqual(body, { error: 'Unauthorized' });
    assert.equal(headers['Cache-Control'], 'no-store');
  } finally {
    if (previousToken === undefined) delete process.env.FAMILY_HUB_API_TOKEN;
    else process.env.FAMILY_HUB_API_TOKEN = previousToken;
  }
});

test('vocabulary OCR endpoint rejects unauthenticated GET, PUT, and POST before touching Firebase', async () => {
  const { default: handler } = await import('../api/vocabulary/ocr.js');
  for (const method of ['GET', 'PUT', 'POST']) {
    const headers = {};
    let statusCode = 200;
    let body;
    const response = {
      setHeader(name, value) { headers[name] = value; return this; },
      status(code) { statusCode = code; return this; },
      json(value) { body = value; return this; },
      end() { return this; },
    };

    await handler({ method, headers: {}, body: {} }, response);
    assert.equal(statusCode, 401, `${method} must reject without Firebase auth`);
    assert.ok(body && typeof body.error === 'string');
    assert.equal(headers['Cache-Control'], 'no-store');
  }
});

test('vocabulary TTS endpoint rejects unauthenticated GET, PUT, and POST before touching Firebase', async () => {
  const { default: handler } = await import('../api/vocabulary/tts.js');
  for (const method of ['GET', 'PUT', 'POST']) {
    const headers = {};
    let statusCode = 200;
    let body;
    const response = {
      setHeader(name, value) { headers[name] = value; return this; },
      status(code) { statusCode = code; return this; },
      json(value) { body = value; return this; },
      send(value) { body = value; return this; },
      end() { return this; },
    };

    await handler({ method, headers: {}, body: {} }, response);
    assert.equal(statusCode, 401, `${method} must reject without Firebase auth`);
    assert.ok(body && typeof body.error === 'string');
    assert.equal(headers['Cache-Control'], 'no-store');
  }
});
