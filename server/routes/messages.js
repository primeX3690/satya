const express = require('express');
const { v4: uuidv4 } = require('uuid');

const db = require('../database');
const { requireAuth } = require('../middleware/auth');
const { emitToUser } = require('../services/socket');

const router = express.Router();

/**
 * Finds the existing conversation between two users, or creates one.
 * Conversations are stored with the two participant ids sorted, so the
 * (A,B) / (B,A) pair always maps to the same row.
 */
function getOrCreateConversation(userIdA, userIdB) {
  const [a, b] = [userIdA, userIdB].sort();
  let convo = db
    .prepare('SELECT * FROM conversations WHERE user_a_id = ? AND user_b_id = ?')
    .get(a, b);
  if (!convo) {
    const id = uuidv4();
    db.prepare('INSERT INTO conversations (id, user_a_id, user_b_id) VALUES (?, ?, ?)').run(id, a, b);
    convo = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
  }
  return convo;
}

/**
 * GET /api/messages/conversations
 * All of the current user's conversations, with the other participant's
 * name and a preview of the most recent message, newest first.
 */
router.get('/conversations', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.*,
         CASE WHEN c.user_a_id = ? THEN c.user_b_id ELSE c.user_a_id END AS other_user_id
       FROM conversations c
       WHERE c.user_a_id = ? OR c.user_b_id = ?`
    )
    .all(req.user.id, req.user.id, req.user.id);

  const conversations = rows
    .map((c) => {
      const other = db.prepare('SELECT id, display_name FROM users WHERE id = ?').get(c.other_user_id);
      const lastMessage = db
        .prepare(
          'SELECT content, sender_id, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1'
        )
        .get(c.id);
      return {
        conversationId: c.id,
        otherUser: other ? { id: other.id, displayName: other.display_name } : null,
        lastMessage: lastMessage
          ? { content: lastMessage.content, senderId: lastMessage.sender_id, createdAt: lastMessage.created_at }
          : null
      };
    })
    .sort((x, y) => (y.lastMessage?.createdAt || '').localeCompare(x.lastMessage?.createdAt || ''));

  return res.json({ conversations });
});

/**
 * GET /api/messages/with/:userId
 * Gets (or creates) the conversation with a specific user and returns the
 * full message history. This is the entry point for starting a new chat -
 * e.g. from a "Message" button on someone's profile.
 */
router.get('/with/:userId', requireAuth, (req, res) => {
  const otherUser = db.prepare('SELECT id, display_name FROM users WHERE id = ?').get(req.params.userId);
  if (!otherUser) return res.status(404).json({ error: 'User not found' });
  if (otherUser.id === req.user.id) return res.status(400).json({ error: "You can't message yourself" });

  const convo = getOrCreateConversation(req.user.id, otherUser.id);
  const rows = db
    .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
    .all(convo.id);

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
});

/**
 * POST /api/messages/conversations/:conversationId/messages
 * body: { content }
 */
router.post('/conversations/:conversationId/messages', requireAuth, (req, res) => {
  const { content } = req.body || {};
  if (!content || !content.trim()) return res.status(400).json({ error: 'content is required' });

  const convo = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.conversationId);
  if (!convo) return res.status(404).json({ error: 'Conversation not found' });
  if (convo.user_a_id !== req.user.id && convo.user_b_id !== req.user.id) {
    return res.status(403).json({ error: 'Not a participant in this conversation' });
  }

  const id = uuidv4();
  const trimmed = content.trim();
  db.prepare('INSERT INTO messages (id, conversation_id, sender_id, content) VALUES (?, ?, ?, ?)').run(
    id,
    convo.id,
    req.user.id,
    trimmed
  );

  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
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
});

module.exports = router;
