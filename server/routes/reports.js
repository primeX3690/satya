const express = require('express');
const { v4: uuidv4 } = require('uuid');

const db = require('../database');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

function serializeReport(row) {
  return {
    id: row.id,
    postId: row.post_id,
    reporterId: row.reporter_id,
    reporterName: row.display_name,
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at
  };
}

/**
 * POST /api/reports
 * body: { postId, reason }
 * Any authenticated user can report a post. Duplicate open reports by the
 * same user on the same post are rejected.
 */
router.post('/', requireAuth, (req, res) => {
  const { postId, reason } = req.body || {};
  if (!postId || !reason || !reason.trim()) {
    return res.status(400).json({ error: 'postId and reason are required' });
  }

  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const dup = db
    .prepare(`SELECT id FROM reports WHERE post_id = ? AND reporter_id = ? AND status = 'open'`)
    .get(postId, req.user.id);
  if (dup) {
    return res.status(409).json({ error: 'You already have an open report on this post' });
  }

  const id = uuidv4();
  db.prepare(
    `INSERT INTO reports (id, post_id, reporter_id, reason) VALUES (?, ?, ?, ?)`
  ).run(id, postId, req.user.id, reason.trim());

  return res.status(201).json({ message: 'Report submitted', reportId: id });
});

/**
 * GET /api/reports
 * Moderator/admin queue of open reports.
 */
router.get('/', requireAuth, requireRole('moderator', 'admin'), (req, res) => {
  const rows = db
    .prepare(
      `SELECT reports.*, users.display_name FROM reports
       JOIN users ON users.id = reports.reporter_id
       WHERE reports.status = 'open'
       ORDER BY reports.created_at DESC`
    )
    .all();
  return res.json({ reports: rows.map(serializeReport) });
});

/**
 * PATCH /api/reports/:id
 * body: { status } - 'reviewed' | 'dismissed'
 */
router.patch('/:id', requireAuth, requireRole('moderator', 'admin'), (req, res) => {
  const { status } = req.body || {};
  if (!['reviewed', 'dismissed'].includes(status)) {
    return res.status(400).json({ error: "status must be 'reviewed' or 'dismissed'" });
  }

  const result = db.prepare('UPDATE reports SET status = ? WHERE id = ?').run(status, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Report not found' });

  return res.json({ message: 'Report updated' });
});

module.exports = router;
