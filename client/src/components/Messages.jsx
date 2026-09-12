import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

function RequestRow({ request, onHandled }) {
  const [busy, setBusy] = useState(false);

  const respond = async (status) => {
    setBusy(true);
    try {
      await api.respondToConnectionRequest(request.id, status);
      onHandled(request.id);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span><strong>{request.fromUserName}</strong> wants to connect</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" disabled={busy} onClick={() => respond('accepted')}>Accept</button>
        <button className="btn btn-secondary" disabled={busy} onClick={() => respond('rejected')}>Decline</button>
      </div>
    </div>
  );
}

export default function Messages() {
  const [conversations, setConversations] = useState([]);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getConversations(), api.getConnectionRequests()])
      .then(([convoData, reqData]) => {
        setConversations(Array.isArray(convoData.conversations) ? convoData.conversations : []);
        setRequests(Array.isArray(reqData.requests) ? reqData.requests : []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container" style={{ marginTop: 32, marginBottom: 60 }}>
      <h1>Messages</h1>

      {loading && <p>Loading…</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && requests.length > 0 && (
        <>
          <h2 style={{ fontSize: '1rem' }}>Message requests</h2>
          {requests.map((r) => (
            <RequestRow
              key={r.id}
              request={r}
              onHandled={(id) => setRequests((prev) => prev.filter((x) => x.id !== id))}
            />
          ))}
        </>
      )}

      {!loading && conversations.length === 0 && requests.length === 0 && (
        <p>No conversations yet. Send a connection request from someone's profile to start chatting.</p>
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

