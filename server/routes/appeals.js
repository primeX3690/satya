const express = require('express');
const { v4: uuidv4 } = require('uuid');

const db = require('../database');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

function logAudit(actorId, action, targetType, targetId, details) {
  db.prepare(
    `INSERT INTO audit_log (id, actor_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(uuidv4(), actorId, action, targetType, targetId, details ? JSON.stringify(details) : null);
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
 * The post's author can appeal a moderation action taken on their own post.
 */
router.post('/', requireAuth, (req, res) => {
  const { postId, message } = req.body || {};
  if (!postId || !message || !message.trim()) {
    return res.status(400).json({ error: 'postId and message are required' });
  }

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.author_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only appeal actions on your own posts' });
  }
  if (post.status === 'published') {
    return res.status(400).json({ error: 'This post has no moderation action to appeal' });
  }

  const existing = db
    .prepare(`SELECT id FROM appeals WHERE post_id = ? AND status = 'pending'`)
    .get(postId);
  if (existing) {
    return res.status(409).json({ error: 'An appeal for this post is already pending' });
  }

  const id = uuidv4();
  db.prepare(
    `INSERT INTO appeals (id, post_id, user_id, message) VALUES (?, ?, ?, ?)`
  ).run(id, postId, req.user.id, message.trim());

  logAudit(req.user.id, 'appeal_filed', 'post', postId, { appealId: id });

  return res.status(201).json({ message: 'Appeal submitted', appealId: id });
});

/**
 * GET /api/appeals/mine
 * The current user's own appeals.
 */
router.get('/mine', requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT * FROM appeals WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.user.id);
  return res.json({ appeals: rows.map(serializeAppeal) });
});

/**
 * GET /api/appeals
 * Admin/moderator queue of pending appeals.
 */
router.get('/', requireAuth, requireRole('moderator', 'admin'), (req, res) => {
  const rows = db
    .prepare(`SELECT * FROM appeals WHERE status = 'pending' ORDER BY created_at ASC`)
    .all();
  return res.json({ appeals: rows.map(serializeAppeal) });
});

/**
 * PATCH /api/appeals/:id
 * body: { status, resolutionNote } - status: 'approved' | 'rejected'
 * Approving an appeal restores the post to 'published'.
 */
router.patch('/:id', requireAuth, requireRole('moderator', 'admin'), (req, res) => {
  const { status, resolutionNote } = req.body || {};
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: "status must be 'approved' or 'rejected'" });
  }

  const appeal = db.prepare('SELECT * FROM appeals WHERE id = ?').get(req.params.id);
  if (!appeal) return res.status(404).json({ error: 'Appeal not found' });
  if (appeal.status !== 'pending') {
    return res.status(409).json({ error: 'This appeal has already been resolved' });
  }

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE appeals SET status = ?, resolution_note = ?, resolved_by = ?, resolved_at = ? WHERE id = ?`
  ).run(status, resolutionNote || null, req.user.id, now, appeal.id);

  if (status === 'approved') {
    db.prepare(`UPDATE posts SET status = 'published' WHERE id = ?`).run(appeal.post_id);
  }

  logAudit(req.user.id, `appeal_${status}`, 'appeal', appeal.id, { resolutionNote });

  return res.json({ message: 'Appeal resolved' });
});

module.exports = router;
