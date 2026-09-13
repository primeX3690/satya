const express = require('express');
const { v4: uuidv4 } = require('uuid');

const db = require('../database');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { hashEmail, decryptEmail } = require('../services/cryptoUtils');

const router = express.Router();

const EMAIL_SHAPE = /^\S+@\S+\.\S+$/;
const EMAIL_HASH_SECRET = process.env.EMAIL_HASH_SECRET;
const EMAIL_ENCRYPTION_SECRET = process.env.EMAIL_ENCRYPTION_SECRET;

// Every route in this file requires an authenticated admin or moderator.
router.use(requireAuth, requireRole('moderator', 'admin'));

async function logAudit(actorId, action, targetType, targetId, details) {
  await db.run(
    `INSERT INTO audit_log (id, actor_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?, ?)`,
    [uuidv4(), actorId, action, targetType, targetId, details ? JSON.stringify(details) : null]
  );
}

function serializeUser(row) {
  const { email_hash, email_encrypted, ...rest } = row;
  return {
    ...rest,
    email: email_encrypted ? decryptEmail(email_encrypted, EMAIL_ENCRYPTION_SECRET) : null
  };
}

/**
 * GET /api/admin/users?query=
 * Looks up users by phone or display name (partial, case-insensitive match
 * via ILIKE - Postgres's LIKE is case-sensitive by default, unlike
 * SQLite's), or by an exact email address (hashed lookup).
 */
router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const query = req.query.query || '';
    let rows;

    if (EMAIL_SHAPE.test(query)) {
      const emailHash = hashEmail(query, EMAIL_HASH_SECRET);
      rows = await db.all(
        `SELECT id, email_hash, email_encrypted, phone, display_name, role, is_verified, trust_score, created_at
         FROM users WHERE email_hash = ?`,
        [emailHash]
      );
    } else {
      const q = `%${query}%`;
      rows = await db.all(
        `SELECT id, email_hash, email_encrypted, phone, display_name, role, is_verified, trust_score, created_at
         FROM users
         WHERE phone ILIKE ? OR display_name ILIKE ?
         ORDER BY created_at DESC LIMIT 50`,
        [q, q]
      );
    }

    return res.json({ users: rows.map(serializeUser) });
  })
);

/**
 * PATCH /api/admin/users/:id/role
 */
router.patch(
  '/users/:id/role',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { role } = req.body || {};
    if (!['user', 'moderator', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const result = await db.run('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'User not found' });

    await logAudit(req.user.id, 'role_change', 'user', req.params.id, { newRole: role });
    return res.json({ message: 'Role updated' });
  })
);

/**
 * PATCH /api/admin/posts/:id/status
 */
router.patch(
  '/posts/:id/status',
  asyncHandler(async (req, res) => {
    const { status } = req.body || {};
    if (!['published', 'flagged', 'removed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const result = await db.run('UPDATE posts SET status = ? WHERE id = ?', [status, req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Post not found' });

    await logAudit(req.user.id, 'manual_moderation', 'post', req.params.id, { status });
    return res.json({ message: 'Post status updated' });
  })
);

/**
 * GET /api/admin/audit-log
 */
router.get(
  '/audit-log',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const { targetType, targetId } = req.query;

    let rows;
    if (targetType && targetId) {
      rows = await db.all(
        `SELECT * FROM audit_log WHERE target_type = ? AND target_id = ? ORDER BY created_at DESC LIMIT ?`,
        [targetType, targetId, limit]
      );
    } else {
      rows = await db.all(`SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?`, [limit]);
    }

    const parsed = rows.map((r) => ({ ...r, details: r.details ? JSON.parse(r.details) : null }));
    return res.json({ entries: parsed });
  })
);

module.exports = router;

