const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { emitToUser } = require('./socket');

/**
 * Creates a notification row and pushes a lightweight real-time ping to the
 * recipient if they're currently connected. The client treats the socket
 * event as a "go refetch your notifications" signal rather than trusting
 * its payload directly, so this stays simple by design.
 */
async function createNotification({ userId, type, actorId = null, postId = null }) {
  if (!userId || (actorId && actorId === userId)) return null; // never notify yourself

  const id = uuidv4();
  await db.run(
    `INSERT INTO notifications (id, user_id, type, actor_id, post_id) VALUES (?, ?, ?, ?, ?)`,
    [id, userId, type, actorId, postId]
  );

  emitToUser(userId, 'notification:new', { id, type });
  return id;
}

module.exports = { createNotification };

