import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { getSocket } from '../services/socket';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      const { count } = await api.getUnreadNotificationCount();
      setUnreadCount(count);
    } catch {
      // Non-critical - the badge just won't update this time.
    }
  }, []);

  useEffect(() => {
    refreshCount();

    // Poll every 30s as a fallback, and also react instantly to the
    // socket's "go refetch" ping if the connection is live.
    const interval = setInterval(refreshCount, 30000);
    const socket = getSocket();
    const onNew = () => refreshCount();
    socket?.on('notification:new', onNew);

    return () => {
      clearInterval(interval);
      socket?.off('notification:new', onNew);
    };
  }, [refreshCount]);

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      try {
        const { notifications: rows } = await api.getNotifications();
        setNotifications(rows);
        setLoaded(true);
      } catch {
        // Leave the dropdown empty on failure rather than crashing.
      }
    }
  };

  const handleMarkAll = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Non-critical.
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button className="btn btn-secondary" onClick={toggleOpen}>
        🔔{unreadCount > 0 ? ` ${unreadCount}` : ''}
      </button>

      {open && (
        <div
          className="card"
          style={{
            position: 'absolute',
            right: 0,
            top: '110%',
            width: 300,
            maxHeight: 360,
            overflowY: 'auto',
            zIndex: 20
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <strong style={{ fontSize: '0.9rem' }}>Notifications</strong>
            {unreadCount > 0 && (
              <button
                className="btn btn-secondary"
                style={{ padding: '2px 8px', fontSize: '0.78rem' }}
                onClick={handleMarkAll}
              >
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 && (
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>No notifications yet.</p>
          )}

          {notifications.map((n) => (
            <Link
              key={n.id}
              to={n.postId ? `/post/${n.postId}` : '/my-appeals'}
              onClick={() => setOpen(false)}
              style={{
                display: 'block',
                padding: '8px 0',
                borderTop: '1px solid var(--line)',
                textDecoration: 'none',
                color: 'var(--ink)',
                fontSize: '0.88rem',
                fontWeight: n.isRead ? 400 : 600
              }}
            >
              {n.message}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
