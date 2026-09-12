import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

export default function Messages() {
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getConversations()
      .then(({ conversations: rows }) => setConversations(Array.isArray(rows) ? rows : []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container" style={{ marginTop: 32, marginBottom: 60 }}>
      <h1>Messages</h1>

      {loading && <p>Loading…</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && conversations.length === 0 && (
        <p>No conversations yet. Start one from someone's profile.</p>
      )}

      {conversations.map((c) => (
        <Link
          key={c.conversationId}
          to={c.otherUser ? `/messages/${c.otherUser.id}` : '#'}
          className="card"
          style={{ display: 'block', marginBottom: 10, textDecoration: 'none', color: 'var(--ink)' }}
        >
          <strong>{c.otherUser?.displayName || 'Unknown user'}</strong>
          {c.lastMessage && (
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>
              {c.lastMessage.content.slice(0, 80)}
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}
