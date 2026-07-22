'use strict';
// AES-256-GCM encrypt/decrypt for secrets at rest (SMTP passwords for
// campaign sending accounts). Key comes from ENCRYPTION_KEY (32-byte hex or
// any string, hashed to 32 bytes) — falls back to JWT_SECRET so this works
// out of the box without a new required env var, but a dedicated
// ENCRYPTION_KEY is recommended in production.
const crypto = require('crypto');

const KEY = crypto
  .createHash('sha256')
  .update(process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'insecure-default-key')
  .digest();

function encrypt(plainText) {
  if (!plainText) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decrypt(payload) {
  if (!payload) return '';
  try {
    const buf = Buffer.from(payload, 'base64');
    const iv  = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

module.exports = { encrypt, decrypt };
