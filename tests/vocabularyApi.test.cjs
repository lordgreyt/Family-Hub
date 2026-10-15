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
