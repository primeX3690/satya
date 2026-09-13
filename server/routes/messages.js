const express = require('express');
const { v4: uuidv4 } = require('uuid');

const db = require('../database');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { emitToUser } = require('../services/socket');

const router = express.Router();

/**
 * Finds the existing conversation between two users, or creates one.
 */
async function getOrCreateConversation(userIdA, userIdB) {
  const [a, b] = [userIdA, userIdB].sort();
  let convo = await db.get('SELECT * FROM conversations WHERE user_a_id = ? AND user_b_id = ?', [a, b]);
  if (!convo) {
    const id = uuidv4();
    await db.run('INSERT INTO conversations (id, user_a_id, user_b_id) VALUES (?, ?, ?)', [id, a, b]);
    convo = await db.get('SELECT * FROM conversations WHERE id = ?', [id]);
  }
  return convo;
}

/**
 * Two users can only message each other once they have an accepted
 * connection request between them.
 */
async function isConnected(userA, userB) {
  const row = await db.get(
    `SELECT 1 FROM connection_requests
     WHERE status = 'accepted' AND (
       (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)
     )`,
    [userA, userB, userB, userA]
  );
  return !!row;
}

/**
 * GET /api/messages/conversations
 */
router.get(
  '/conversations',
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await db.all(
      `SELECT c.*,
         CASE WHEN c.user_a_id = ? THEN c.user_b_id ELSE c.user_a_id END AS other_user_id
       FROM conversations c
       WHERE c.user_a_id = ? OR c.user_b_id = ?`,
      [req.user.id, req.user.id, req.user.id]
    );

    const conversations = await Promise.all(
      rows.map(async (c) => {
        const other = await db.get('SELECT id, display_name FROM users WHERE id = ?', [c.other_user_id]);
        const lastMessage = await db.get(
          'SELECT content, sender_id, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1',
          [c.id]
        );
        return {
          conversationId: c.id,
          otherUser: other ? { id: other.id, displayName: other.display_name } : null,
          lastMessage: lastMessage
            ? { content: lastMessage.content, senderId: lastMessage.sender_id, createdAt: lastMessage.created_at }
            : null
        };
      })
    );

    conversations.sort((x, y) => (y.lastMessage?.createdAt || '').localeCompare(x.lastMessage?.createdAt || ''));

    return res.json({ conversations });
  })
);

/**
 * GET /api/messages/with/:userId
 */
router.get(
  '/with/:userId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const otherUser = await db.get('SELECT id, display_name FROM users WHERE id = ?', [req.params.userId]);
    if (!otherUser) return res.status(404).json({ error: 'User not found' });
    if (otherUser.id === req.user.id) return res.status(400).json({ error: "You can't message yourself" });

    if (!(await isConnected(req.user.id, otherUser.id))) {
      return res.status(403).json({
        error: 'You need to connect with this person before messaging them',
        code: 'NOT_CONNECTED'
      });
    }

    const convo = await getOrCreateConversation(req.user.id, otherUser.id);
    const rows = await db.all('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC', [
      convo.id
    ]);

    return res.json({
      conversationId: convo.id,
      otherUser: { id: otherUser.id, displayName: otherUser.display_name },
      messages: rows.map((m) => ({
        id: m.id,
        senderId: m.sender_id,
        content: m.content,
        createdAt: m.created_at
      }))
    });
  })
);

/**
 * POST /api/messages/conversations/:conversationId/messages
 */
router.post(
  '/conversations/:conversationId/messages',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { content } = req.body || {};
    if (!content || !content.trim()) return res.status(400).json({ error: 'content is required' });

    const convo = await db.get('SELECT * FROM conversations WHERE id = ?', [req.params.conversationId]);
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });
    if (convo.user_a_id !== req.user.id && convo.user_b_id !== req.user.id) {
      return res.status(403).json({ error: 'Not a participant in this conversation' });
    }

    const id = uuidv4();
    const trimmed = content.trim();
    await db.run('INSERT INTO messages (id, conversation_id, sender_id, content) VALUES (?, ?, ?, ?)', [
      id,
      convo.id,
      req.user.id,
      trimmed
    ]);

    const row = await db.get('SELECT * FROM messages WHERE id = ?', [id]);
    const message = {
      id: row.id,
      conversationId: convo.id,
      senderId: row.sender_id,
      content: row.content,
      createdAt: row.created_at
    };

    const recipientId = convo.user_a_id === req.user.id ? convo.user_b_id : convo.user_a_id;
    emitToUser(recipientId, 'message:new', message);

    return res.status(201).json({ message });
  })
);

module.exports = router;

