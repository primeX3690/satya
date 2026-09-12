import { io } from 'socket.io-client';
import { API_ORIGIN, getToken } from './api';

let socket = null;

/**
 * Opens a Socket.IO connection authenticated with the current JWT. Safe to
 * call repeatedly - reuses the existing connection if already connected.
 * Returns null if there's no token (not logged in).
 */
export function connectSocket() {
  const token = getToken();
  if (!token) return null;
  if (socket?.connected) return socket;

  socket = io(API_ORIGIN, { auth: { token } });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function getSocket() {
  return socket;
}
