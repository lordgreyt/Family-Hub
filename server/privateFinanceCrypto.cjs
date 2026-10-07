const { createCipheriv, createDecipheriv, createHash, randomBytes } = require('node:crypto');

const ENVELOPE_VERSION = 1;
const KEY_CONTEXT = ':family-hub-private-finance:v1';

function deriveKey(secret) {
  if (typeof secret !== 'string' || secret.length < 16) {
    throw new Error('A private encryption secret is required.');
  }
  return createHash('sha256').update(secret, 'utf8').update(KEY_CONTEXT, 'utf8').digest();
}

function encryptPrivateData(data, secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  const plaintext = Buffer.from(JSON.stringify(data), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    version: ENVELOPE_VERSION,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

function decryptPrivateData(envelope, secret) {
  if (!envelope || envelope.version !== ENVELOPE_VERSION) {
    throw new Error('Unsupported private-data envelope.');
  }
  const iv = Buffer.from(String(envelope.iv || ''), 'base64');
  const tag = Buffer.from(String(envelope.tag || ''), 'base64');
  const ciphertext = Buffer.from(String(envelope.ciphertext || ''), 'base64');
  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
    throw new Error('Invalid private-data envelope.');
  }
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return JSON.parse(plaintext);
}

module.exports = { decryptPrivateData, encryptPrivateData };
