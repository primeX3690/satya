const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { generateOtp, hashOtp, safeCompare } = require('./cryptoUtils');

const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 10);
const EMAIL_SHAPE = /^\S+@\S+\.\S+$/;

// Email delivery: 'console' (default, prints to server terminal) | 'gmail' | 'smtp'
const EMAIL_DELIVERY = process.env.EMAIL_OTP_DELIVERY || 'console';
// SMS delivery: 'console' (default) | 'twilio'
const SMS_DELIVERY = process.env.SMS_OTP_DELIVERY || 'console';

let mailTransport = null;

/**
 * Lazily builds (and caches) a Nodemailer transport based on EMAIL_OTP_DELIVERY.
 * - 'gmail': uses a Gmail account + App Password (free, good for dev/small scale)
 * - 'smtp' : generic SMTP (any provider - SendGrid, Mailgun, your own mail server, etc.)
 */
function getMailTransport() {
  if (mailTransport) return mailTransport;
  // Lazy-require so nodemailer's cost is only paid when email sending is actually used.
  const nodemailer = require('nodemailer');

  if (EMAIL_DELIVERY === 'gmail') {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD must be set when EMAIL_OTP_DELIVERY=gmail');
    }
    mailTransport = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
    });
  } else if (EMAIL_DELIVERY === 'smtp') {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error('SMTP_HOST, SMTP_USER, and SMTP_PASS must be set when EMAIL_OTP_DELIVERY=smtp');
    }
    const port = Number(process.env.SMTP_PORT || 587);
    mailTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465, // true for 465 (implicit TLS), false for 587/25 (STARTTLS)
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  }
  return mailTransport;
}

/**
 * Sends the OTP by email. Falls back to logging the code to the server
 * console if real delivery isn't configured or fails - this way a
 * misconfigured mail provider never permanently locks a user out during
 * development; the code is always recoverable from the server terminal.
 */
async function sendEmailOtp(destination, code) {
  if (EMAIL_DELIVERY === 'console') {
    // eslint-disable-next-line no-console
    console.log(`[OTP] Code for ${destination}: ${code} (expires in ${OTP_TTL_MINUTES}m)`);
    return;
  }

  try {
    const transport = getMailTransport();
    await transport.sendMail({
      from: process.env.EMAIL_FROM || process.env.GMAIL_USER || process.env.SMTP_USER,
      to: destination,
      subject: 'Your SatyaNet verification code',
      text: `Your verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`,
      html: `<p>Your SatyaNet verification code is <strong style="font-size:1.2em">${code}</strong>.</p><p>It expires in ${OTP_TTL_MINUTES} minutes.</p>`
    });
    // eslint-disable-next-line no-console
    console.log(`[OTP] Email sent to ${destination}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[OTP] Email delivery to ${destination} failed (${err.message}) - falling back to console.`);
    // eslint-disable-next-line no-console
    console.log(`[OTP fallback] Code for ${destination}: ${code} (expires in ${OTP_TTL_MINUTES}m)`);
  }
}

/**
 * Sends the OTP by SMS via Twilio, or logs it if SMS_OTP_DELIVERY=console.
 * Same fail-safe fallback behavior as sendEmailOtp.
 */
async function sendSmsOtp(destination, code) {
  if (SMS_DELIVERY === 'console') {
    // eslint-disable-next-line no-console
    console.log(`[OTP] Code for ${destination}: ${code} (expires in ${OTP_TTL_MINUTES}m)`);
    return;
  }

  try {
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.messages.create({
      body: `Your SatyaNet verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`,
      from: process.env.TWILIO_FROM_NUMBER,
      to: destination
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[OTP] SMS delivery to ${destination} failed (${err.message}) - falling back to console.`);
    // eslint-disable-next-line no-console
    console.log(`[OTP fallback] Code for ${destination}: ${code} (expires in ${OTP_TTL_MINUTES}m)`);
  }
}

async function deliverOtp(destination, code) {
  if (EMAIL_SHAPE.test(destination)) {
    return sendEmailOtp(destination, code);
  }
  return sendSmsOtp(destination, code);
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

