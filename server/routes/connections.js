const express = require('express');
const { v4: uuidv4 } = require('uuid');

const db = require('../database');
const { requireAuth } = require('../middleware/auth');
const { createNotification } = require('../services/notifications');

const router = express.Router();

function findExisting(userA, userB) {
  return db
    .prepare(
      `SELECT * FROM connection_requests
       WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)`
    )
    .get(userA, userB, userB, userA);
}

/**
 * GET /api/connections/status/:userId
 * Returns the connection state between the current user and :userId:
 * 'none' | 'pending_sent' | 'pending_received' | 'accepted'
 */
router.get('/status/:userId', requireAuth, (req, res) => {
  const otherId = req.params.userId;
  const row = findExisting(req.user.id, otherId);

  if (!row || row.status === 'rejected') return res.json({ status: 'none' });
  if (row.status === 'accepted') return res.json({ status: 'accepted' });
  if (row.from_user_id === req.user.id) return res.json({ status: 'pending_sent' });
  return res.json({ status: 'pending_received', requestId: row.id });
});

/**
 * POST /api/connections/request
 * body: { toUserId }
 * A previously rejected request can be re-sent (resets it to pending).
 */
router.post('/request', requireAuth, (req, res) => {
  const { toUserId } = req.body || {};
  if (!toUserId) return res.status(400).json({ error: 'toUserId is required' });
  if (toUserId === req.user.id) return res.status(400).json({ error: "You can't connect with yourself" });

  const toUser = db.prepare('SELECT id FROM users WHERE id = ?').get(toUserId);
  if (!toUser) return res.status(404).json({ error: 'User not found' });

  const existing = findExisting(req.user.id, toUserId);

  if (existing) {
    if (existing.status === 'accepted') return res.status(409).json({ error: 'Already connected' });
    if (existing.status === 'pending') return res.status(409).json({ error: 'A request is already pending' });

    db.prepare(
      `UPDATE connection_requests
       SET status = 'pending', from_user_id = ?, to_user_id = ?, created_at = datetime('now'), responded_at = NULL
       WHERE id = ?`
    ).run(req.user.id, toUserId, existing.id);

    createNotification({ userId: toUserId, type: 'connection_request', actorId: req.user.id });
    return res.status(201).json({ message: 'Request sent' });
  }

  const id = uuidv4();
  db.prepare('INSERT INTO connection_requests (id, from_user_id, to_user_id) VALUES (?, ?, ?)').run(
    id,
    req.user.id,
    toUserId
  );
  createNotification({ userId: toUserId, type: 'connection_request', actorId: req.user.id });

  return res.status(201).json({ message: 'Request sent', requestId: id });
});

/**
 * GET /api/connections/requests
 * Incoming pending requests for the current user - this is the "message
 * requests" inbox.
 */
router.get('/requests', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT connection_requests.*, users.display_name AS from_name
       FROM connection_requests
       JOIN users ON users.id = connection_requests.from_user_id
       WHERE connection_requests.to_user_id = ? AND connection_requests.status = 'pending'
       ORDER BY connection_requests.created_at DESC`
    )
    .all(req.user.id);

  return res.json({
    requests: rows.map((r) => ({
      id: r.id,
      fromUserId: r.from_user_id,
      fromUserName: r.from_name,
      createdAt: r.created_at
    }))
  });
});

/**
 * PATCH /api/connections/requests/:id
 * body: { status: 'accepted' | 'rejected' }
 */
router.patch('/requests/:id', requireAuth, (req, res) => {
  const { status } = req.body || {};
  if (!['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ error: "status must be 'accepted' or 'rejected'" });
  }

  const request = db.prepare('SELECT * FROM connection_requests WHERE id = ?').get(req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.to_user_id !== req.user.id) {
    return res.status(403).json({ error: 'Not your request to respond to' });
  }
  if (request.status !== 'pending') {
    return res.status(409).json({ error: 'This request has already been responded to' });
  }

  db.prepare(`UPDATE connection_requests SET status = ?, responded_at = datetime('now') WHERE id = ?`).run(
    status,
    request.id
  );

  if (status === 'accepted') {
    createNotification({ userId: request.from_user_id, type: 'connection_accepted', actorId: req.user.id });
  }

  return res.json({ message: `Request ${status}` });
});

module.exports = router;
