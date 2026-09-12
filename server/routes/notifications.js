const express = require('express');

const db = require('../database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function buildMessage(type, actorName) {
  const name = actorName || 'Someone';
  if (type === 'like') return `${name} liked your post`;
  if (type === 'comment') return `${name} commented on your post`;
  if (type === 'appeal_resolved') return 'Your appeal has been resolved';
  return 'New notification';
}

/**
 * GET /api/notifications
 * The current user's most recent notifications, newest first.
 */
router.get('/', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT notifications.*, actor.display_name AS actor_name
       FROM notifications
       LEFT JOIN users actor ON actor.id = notifications.actor_id
       WHERE notifications.user_id = ?
       ORDER BY notifications.created_at DESC
       LIMIT 50`
    )
    .all(req.user.id);

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
});

/**
 * GET /api/notifications/unread-count
 * Fast count for a badge - avoids fetching the full list just to show a number.
 */
router.get('/unread-count', requireAuth, (req, res) => {
  const row = db
    .prepare('SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0')
    .get(req.user.id);
  return res.json({ count: row.count });
});

/**
 * PATCH /api/notifications/:id/read
 */
router.patch('/:id/read', requireAuth, (req, res) => {
  const result = db
    .prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Notification not found' });
  return res.json({ message: 'Marked as read' });
});

/**
 * PATCH /api/notifications/read-all
 */
router.patch('/read-all', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(req.user.id);
  return res.json({ message: 'All marked as read' });
});

module.exports = router;
