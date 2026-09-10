const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { generateOtp, hashOtp, safeCompare } = require('./cryptoUtils');

const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 10);
const OTP_MODE = process.env.OTP_MODE || 'console';

/**
 * Sends the OTP to the user via the configured channel.
 * "console" mode just logs it — perfect for local dev, no external account needed.
 * "twilio" mode sends a real SMS (requires TWILIO_* env vars).
 */
async function deliverOtp(destination, code) {
  if (OTP_MODE === 'twilio') {
    // Lazy-require so the twilio package is only needed if this mode is used.
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.messages.create({
      body: `Your SatyaNet verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`,
      from: process.env.TWILIO_FROM_NUMBER,
      to: destination
    });
    return;
  }
  // Default / dev mode
  // eslint-disable-next-line no-console
  console.log(`[OTP] Code for ${destination}: ${code} (expires in ${OTP_TTL_MINUTES}m)`);
}

/**
 * Creates and stores a new OTP for a user, then delivers it.
 */
async function issueOtp(userId, destination, purpose = 'verify') {
  const code = generateOtp(6);
  const codeHash = hashOtp(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

  db.prepare(
    `INSERT INTO otp_codes (id, user_id, code_hash, purpose, expires_at) VALUES (?, ?, ?, ?, ?)`
  ).run(uuidv4(), userId, codeHash, purpose, expiresAt);

  await deliverOtp(destination, code);
  return { expiresAt };
}

/**
 * Verifies a submitted OTP code for a user. Returns true/false.
 * Consumes the OTP row on success so it cannot be replayed.
 */
function verifyOtp(userId, submittedCode, purpose = 'verify') {
  const row = db
    .prepare(
      `SELECT * FROM otp_codes
       WHERE user_id = ? AND purpose = ? AND consumed = 0
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(userId, purpose);

  if (!row) return false;
  if (new Date(row.expires_at).getTime() < Date.now()) return false;

  const submittedHash = hashOtp(submittedCode);
  const matches = safeCompare(submittedHash, row.code_hash);
  if (!matches) return false;

  db.prepare(`UPDATE otp_codes SET consumed = 1 WHERE id = ?`).run(row.id);
  return true;
}

module.exports = { issueOtp, verifyOtp };
