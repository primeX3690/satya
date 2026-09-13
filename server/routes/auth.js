const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const db = require('../database');
const { authLimiter } = require('../middleware/rateLimit');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { issueOtp, verifyOtp } = require('../services/otpProvider');
const { hashEmail, encryptEmail, decryptEmail } = require('../services/cryptoUtils');

const router = express.Router();
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

const EMAIL_HASH_SECRET = process.env.EMAIL_HASH_SECRET;
const EMAIL_ENCRYPTION_SECRET = process.env.EMAIL_ENCRYPTION_SECRET;

const EMAIL_SHAPE = /^\S+@\S+\.\S+$/;

function signToken(user, email) {
  return jwt.sign(
    { id: user.id, role: user.role, email: email || null },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/**
 * Decrypts the stored email (if any) and shapes the user object we're
 * willing to hand back to the client. The plaintext email only ever exists
 * in memory for the duration of a request - it is never logged or stored.
 */
function publicUser(user) {
  const email = user.email_encrypted ? decryptEmail(user.email_encrypted, EMAIL_ENCRYPTION_SECRET) : null;
  return {
    id: user.id,
    email,
    phone: user.phone,
    displayName: user.display_name,
    role: user.role,
    isVerified: !!user.is_verified,
    trustScore: user.trust_score
  };
}

async function findUserByEmail(email) {
  const emailHash = hashEmail(email, EMAIL_HASH_SECRET);
  return db.get('SELECT * FROM users WHERE email_hash = ?', [emailHash]);
}

/**
 * POST /api/auth/signup
 * body: { email, phone, password, displayName }
 * Creates the user (unverified) and sends an OTP. The email is never stored
 * in plaintext: we keep a one-way hash for lookups and a separately-keyed
 * reversible encryption so we can still deliver the OTP/notifications.
 */
router.post(
  '/signup',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, phone, password, displayName } = req.body || {};

    if (!password || !displayName || (!email && !phone)) {
      return res.status(400).json({ error: 'email or phone, password, and displayName are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (email && !EMAIL_SHAPE.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const emailHash = email ? hashEmail(email, EMAIL_HASH_SECRET) : null;

    const existing = await db.get(
      'SELECT id FROM users WHERE (email_hash IS NOT NULL AND email_hash = ?) OR (phone IS NOT NULL AND phone = ?)',
      [emailHash, phone || null]
    );
    if (existing) {
      return res.status(409).json({ error: 'An account with this email or phone already exists' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const emailEncrypted = email ? encryptEmail(email, EMAIL_ENCRYPTION_SECRET) : null;
    const id = uuidv4();

    await db.run(
      `INSERT INTO users (id, email_hash, email_encrypted, phone, password_hash, display_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, emailHash, emailEncrypted, phone || null, passwordHash, displayName]
    );

    const destination = email || phone;
    await issueOtp(id, destination, 'verify');

    return res.status(201).json({
      message: 'Account created. Check your console/SMS/email for the verification code.',
      userId: id
    });
  })
);

/**
 * POST /api/auth/verify-otp
 * body: { userId, code }
 * Marks the account verified and returns a JWT session.
 */
router.post(
  '/verify-otp',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { userId, code } = req.body || {};
    if (!userId || !code) {
      return res.status(400).json({ error: 'userId and code are required' });
    }

    const ok = await verifyOtp(userId, code, 'verify');
    if (!ok) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    await db.run('UPDATE users SET is_verified = 1 WHERE id = ?', [userId]);
    const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    const publicUserData = publicUser(user);

    const token = signToken(user, publicUserData.email);
    return res.json({ token, user: publicUserData });
  })
);

/**
 * POST /api/auth/resend-otp
 * body: { userId }
 */
router.post(
  '/resend-otp',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { userId } = req.body || {};
    const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const email = user.email_encrypted ? decryptEmail(user.email_encrypted, EMAIL_ENCRYPTION_SECRET) : null;
    await issueOtp(user.id, email || user.phone, 'verify');
    return res.json({ message: 'A new code has been sent.' });
  })
);

/**
 * POST /api/auth/login
 * body: { identifier, password }  (identifier = email or phone)
 * If the identifier looks like an email, we hash it and look up by
 * email_hash (we can never query an encrypted column directly). Otherwise
 * we treat it as a phone number, which is still stored in plaintext.
 */
router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) {
      return res.status(400).json({ error: 'identifier and password are required' });
    }

    const user = EMAIL_SHAPE.test(identifier)
      ? await findUserByEmail(identifier)
      : await db.get('SELECT * FROM users WHERE phone = ?', [identifier]);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.is_verified) {
      return res.status(403).json({ error: 'Account not verified', userId: user.id });
    }

    const publicUserData = publicUser(user);
    const token = signToken(user, publicUserData.email);
    return res.json({ token, user: publicUserData });
  })
);

/**
 * GET /api/auth/me
 * Returns the currently authenticated user (email decrypted just for this response).
 */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: publicUser(user) });
  })
);

module.exports = router;

