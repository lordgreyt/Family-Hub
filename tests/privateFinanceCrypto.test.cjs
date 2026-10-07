const test = require('node:test');
const assert = require('node:assert/strict');
const { decryptPrivateData, encryptPrivateData } = require('../server/privateFinanceCrypto.cjs');

const SECRET = 'test-secret-that-is-not-production';

test('private finance data round-trips through authenticated encryption', () => {
  const data = { surgeryCostCents: 1234567, note: 'test only' };
  const envelope = encryptPrivateData(data, SECRET);
  assert.deepEqual(decryptPrivateData(envelope, SECRET), data);
  assert.equal(JSON.stringify(envelope).includes('1234567'), false);
});

test('private finance ciphertext cannot be decrypted with another secret', () => {
  const envelope = encryptPrivateData({ amountCents: 2500 }, SECRET);
  assert.throws(() => decryptPrivateData(envelope, 'different-test-secret'), /authenticate|Unsupported state|bad decrypt/i);
});

test('tampered ciphertext is rejected', () => {
  const envelope = encryptPrivateData({ amountCents: 2500 }, SECRET);
  envelope.ciphertext = Buffer.from('tampered').toString('base64');
  assert.throws(() => decryptPrivateData(envelope, SECRET));
});

test('private finance API rejects requests without Firebase authentication', async () => {
  const { default: handler } = await import('../api/private/surgery-finance.js');
  const response = {
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    end() { this.ended = true; return this; },
  };

  await handler({ method: 'GET', headers: {} }, response);
  assert.equal(response.statusCode, 401);
  assert.equal(response.body.code, 'missing_auth');
});
