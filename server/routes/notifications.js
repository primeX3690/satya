const express = require('express');

const db = require('../database');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

function buildMessage(type, actorName) {
  const name = actorName || 'Someone';
  if (type === 'like') return `${name} liked your post`;
  if (type === 'comment') return `${name} commented on your post`;
  if (type === 'appeal_resolved') return 'Your appeal has been resolved';
  if (type === 'connection_request') return `${name} wants to connect with you`;
  if (type === 'connection_accepted') return `${name} accepted your connection request`;
  return 'New notification';
}

/**
 * GET /api/notifications
 */
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await db.all(
      `SELECT notifications.*, actor.display_name AS actor_name
       FROM notifications
       LEFT JOIN users actor ON actor.id = notifications.actor_id
       WHERE notifications.user_id = ?
       ORDER BY notifications.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );

    const notifications = rows.map((r) => ({
      id: r.id,
      type: r.type,
      actorId: r.actor_id,
      actorName: r.actor_name,
      postId: r.post_id,
      isRead: !!r.is_read,
      createdAt: r.created_at,
      message: buildMessage(r.type, r.actor_name)
    }));

    return res.json({ notifications });
  })
);

/**
 * GET /api/notifications/unread-count
 */
router.get(
  '/unread-count',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await db.get('SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0', [
      req.user.id
    ]);
    // Postgres returns COUNT(*) as a string (bigint) via node-postgres - cast explicitly.
    return res.json({ count: Number(row.count) });
  })
);

/**
 * PATCH /api/notifications/:id/read
 */
router.patch(
  '/:id/read',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await db.run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id
    ]);
    if (result.changes === 0) return res.status(404).json({ error: 'Notification not found' });
    return res.json({ message: 'Marked as read' });
  })
);

/**
 * PATCH /api/notifications/read-all
 */
router.patch(
  '/read-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    await db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.user.id]);
    return res.json({ message: 'All marked as read' });
  })
);

module.exports = router;

