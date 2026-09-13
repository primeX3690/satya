const express = require('express');
const { v4: uuidv4 } = require('uuid');

const db = require('../database');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { createNotification } = require('../services/notifications');

const router = express.Router();

async function logAudit(actorId, action, targetType, targetId, details) {
  await db.run(
    `INSERT INTO audit_log (id, actor_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?, ?)`,
    [uuidv4(), actorId, action, targetType, targetId, details ? JSON.stringify(details) : null]
  );
}

function serializeAppeal(row) {
  return {
    id: row.id,
    postId: row.post_id,
    userId: row.user_id,
    message: row.message,
    status: row.status,
    resolutionNote: row.resolution_note,
    resolvedBy: row.resolved_by,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at
  };
}

/**
 * POST /api/appeals
 * body: { postId, message }
 */
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { postId, message } = req.body || {};
    if (!postId || !message || !message.trim()) {
      return res.status(400).json({ error: 'postId and message are required' });
    }

    const post = await db.get('SELECT * FROM posts WHERE id = ?', [postId]);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.author_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only appeal actions on your own posts' });
    }
    if (post.status === 'published') {
      return res.status(400).json({ error: 'This post has no moderation action to appeal' });
    }

    const existing = await db.get(`SELECT id FROM appeals WHERE post_id = ? AND status = 'pending'`, [postId]);
    if (existing) {
      return res.status(409).json({ error: 'An appeal for this post is already pending' });
    }

    const id = uuidv4();
    await db.run(`INSERT INTO appeals (id, post_id, user_id, message) VALUES (?, ?, ?, ?)`, [
      id,
      postId,
      req.user.id,
      message.trim()
    ]);

    await logAudit(req.user.id, 'appeal_filed', 'post', postId, { appealId: id });

    return res.status(201).json({ message: 'Appeal submitted', appealId: id });
  })
);

/**
 * GET /api/appeals/mine
 */
router.get(
  '/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await db.all('SELECT * FROM appeals WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    return res.json({ appeals: rows.map(serializeAppeal) });
  })
);

/**
 * GET /api/appeals
 * Admin/moderator queue of pending appeals.
 */
router.get(
  '/',
  requireAuth,
  requireRole('moderator', 'admin'),
  asyncHandler(async (req, res) => {
    const rows = await db.all(`SELECT * FROM appeals WHERE status = 'pending' ORDER BY created_at ASC`);
    return res.json({ appeals: rows.map(serializeAppeal) });
  })
);

/**
 * PATCH /api/appeals/:id
 * body: { status, resolutionNote } - status: 'approved' | 'rejected'
 */
router.patch(
  '/:id',
  requireAuth,
  requireRole('moderator', 'admin'),
  asyncHandler(async (req, res) => {
    const { status, resolutionNote } = req.body || {};
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: "status must be 'approved' or 'rejected'" });
    }

    const appeal = await db.get('SELECT * FROM appeals WHERE id = ?', [req.params.id]);
    if (!appeal) return res.status(404).json({ error: 'Appeal not found' });
    if (appeal.status !== 'pending') {
      return res.status(409).json({ error: 'This appeal has already been resolved' });
    }

    const now = new Date().toISOString();
    await db.run(
      `UPDATE appeals SET status = ?, resolution_note = ?, resolved_by = ?, resolved_at = ? WHERE id = ?`,
      [status, resolutionNote || null, req.user.id, now, appeal.id]
    );

    if (status === 'approved') {
      await db.run(`UPDATE posts SET status = 'published' WHERE id = ?`, [appeal.post_id]);
    }

    await logAudit(req.user.id, `appeal_${status}`, 'appeal', appeal.id, { resolutionNote });
    await createNotification({ userId: appeal.user_id, type: 'appeal_resolved', postId: appeal.post_id });

    return res.json({ message: 'Appeal resolved' });
  })
);

module.exports = router;

