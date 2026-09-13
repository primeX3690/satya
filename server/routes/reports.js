const express = require('express');
const { v4: uuidv4 } = require('uuid');

const db = require('../database');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

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
 */
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { postId, reason } = req.body || {};
    if (!postId || !reason || !reason.trim()) {
      return res.status(400).json({ error: 'postId and reason are required' });
    }

    const post = await db.get('SELECT id FROM posts WHERE id = ?', [postId]);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const dup = await db.get(
      `SELECT id FROM reports WHERE post_id = ? AND reporter_id = ? AND status = 'open'`,
      [postId, req.user.id]
    );
    if (dup) {
      return res.status(409).json({ error: 'You already have an open report on this post' });
    }

    const id = uuidv4();
    await db.run(`INSERT INTO reports (id, post_id, reporter_id, reason) VALUES (?, ?, ?, ?)`, [
      id,
      postId,
      req.user.id,
      reason.trim()
    ]);

    return res.status(201).json({ message: 'Report submitted', reportId: id });
  })
);

/**
 * GET /api/reports
 * Moderator/admin queue of open reports.
 */
router.get(
  '/',
  requireAuth,
  requireRole('moderator', 'admin'),
  asyncHandler(async (req, res) => {
    const rows = await db.all(
      `SELECT reports.*, users.display_name FROM reports
       JOIN users ON users.id = reports.reporter_id
       WHERE reports.status = 'open'
       ORDER BY reports.created_at DESC`
    );
    return res.json({ reports: rows.map(serializeReport) });
  })
);

/**
 * PATCH /api/reports/:id
 * body: { status } - 'reviewed' | 'dismissed'
 */
router.patch(
  '/:id',
  requireAuth,
  requireRole('moderator', 'admin'),
  asyncHandler(async (req, res) => {
    const { status } = req.body || {};
    if (!['reviewed', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: "status must be 'reviewed' or 'dismissed'" });
    }

    const result = await db.run('UPDATE reports SET status = ? WHERE id = ?', [status, req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Report not found' });

    return res.json({ message: 'Report updated' });
  })
);

module.exports = router;

