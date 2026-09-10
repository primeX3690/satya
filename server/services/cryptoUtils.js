const crypto = require('crypto');

/**
 * Returns a hex-encoded SHA-256 hash of the given string content.
 * Used to fingerprint post content so edits/tampering are detectable.
 */
function hashContent(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Same as hashContent but for binary data (uploaded images/videos).
 */
function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Generates a cryptographically random numeric OTP code as a string.
 * @param {number} length
 */
function generateOtp(length = 6) {
  const max = 10 ** length;
  const num = crypto.randomInt(0, max);
  return num.toString().padStart(length, '0');
}

/**
 * One-way hash for OTP codes so raw codes are never stored at rest.
 */
function hashOtp(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Generates a URL-safe random token, e.g. for password reset / invite links.
 */
function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/**
 * Constant-time string comparison to avoid timing attacks on hash checks.
 */
function safeCompare(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// --- Email hashing + encryption --------------------------------------------
// We never store a plaintext email. Two representations are kept instead:
//   1. A deterministic HMAC hash (EMAIL_HASH_SECRET) -> used for exact-match
//      lookup/uniqueness at login/signup. One-way: cannot be reversed.
//   2. A reversible AES-256-GCM encryption (EMAIL_ENCRYPTION_SECRET) -> used
//      only when we actually need the real address, e.g. to deliver an OTP.
// The two secrets are intentionally different so a leak of one doesn't
// compromise the other property (lookup vs. recovery).

const EMAIL_ENC_ALGO = 'aes-256-gcm';

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

/**
 * Deterministic one-way hash of an email, keyed with EMAIL_HASH_SECRET.
 * Same email always produces the same hash, so it can be used as a unique
 * lookup key - but the original email cannot be recovered from it.
 */
function hashEmail(email, secret) {
  if (!secret) throw new Error('EMAIL_HASH_SECRET is not configured');
  return crypto.createHmac('sha256', secret).update(normalizeEmail(email)).digest('hex');
}

function getEmailEncryptionKey(secret) {
  if (!secret) throw new Error('EMAIL_ENCRYPTION_SECRET is not configured');
  if (!/^[0-9a-f]{64}$/i.test(secret)) {
    throw new Error('EMAIL_ENCRYPTION_SECRET must be a 64-character hex string (32 bytes) - generate with `openssl rand -hex 32`');
  }
  return Buffer.from(secret, 'hex');
}

/**
 * Reversibly encrypts an email so the real address can be recovered later
 * (e.g. to send an OTP), without ever storing it in plaintext at rest.
 * Returns "iv:authTag:ciphertext" (all hex), safe to store in a single column.
 */
function encryptEmail(email, secret) {
  const key = getEmailEncryptionKey(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(EMAIL_ENC_ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(normalizeEmail(email), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Reverses encryptEmail(). Throws if the payload was tampered with (GCM
 * auth tag check fails) or the secret is wrong.
 */
function decryptEmail(payload, secret) {
  if (!payload) return null;
  const key = getEmailEncryptionKey(secret);
  const [ivHex, tagHex, dataHex] = payload.split(':');
  const decipher = crypto.createDecipheriv(EMAIL_ENC_ALGO, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = {
  hashContent,
  hashBuffer,
  generateOtp,
  hashOtp,
  randomToken,
  safeCompare,
  hashEmail,
  encryptEmail,
  decryptEmail
};
