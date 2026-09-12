const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;
// Maps userId -> Set of socket.id's, since one user can have multiple tabs/devices open.
const userSockets = new Map();

/**
 * Attaches Socket.IO to the given HTTP server. Every connection must present
 * a valid JWT (the same one used for REST auth) or the connection is refused.
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
      credentials: true
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.id;
      return next();
    } catch (err) {
      return next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const uid = socket.userId;
    if (!userSockets.has(uid)) userSockets.set(uid, new Set());
    userSockets.get(uid).add(socket.id);

    socket.on('disconnect', () => {
      const set = userSockets.get(uid);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) userSockets.delete(uid);
      }
    });
  });

  return io;
}

/**
 * Sends a real-time event to every open connection a given user has (all
 * their tabs/devices), if any are currently connected. Silently does
 * nothing if the user isn't online - REST endpoints remain the source of
 * truth; this is just a "hey, go refetch" nudge.
 */
function emitToUser(userId, event, payload) {
  if (!io) return;
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  for (const socketId of sockets) {
    io.to(socketId).emit(event, payload);
  }
}

module.exports = { initSocket, emitToUser };
