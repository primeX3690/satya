import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../App.jsx';

export default function ChatThread() {
  const { userId } = useParams();
  const { user } = useAuth();

  const [conversationId, setConversationId] = useState(null);
  const [otherUser, setOtherUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const bottomRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    setError('');
    api
      .getConversationWith(userId)
      .then((data) => {
        setConversationId(data.conversationId);
        setOtherUser(data.otherUser);
        setMessages(Array.isArray(data.messages) ? data.messages : []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onMessage = (message) => {
      // Only append if it belongs to this open thread.
      if (message?.conversationId === conversationId) {
        setMessages((prev) => [...prev, message]);
      }
    };
    socket.on('message:new', onMessage);
    return () => socket.off('message:new', onMessage);
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || !conversationId) return;
    try {
      const { message } = await api.sendMessage(conversationId, { content: text.trim() });
      setMessages((prev) => [...prev, message]);
      setText('');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container" style={{ marginTop: 32, marginBottom: 60, maxWidth: 560 }}>
      <p style={{ marginBottom: 12 }}>
        <Link to="/messages">&larr; All messages</Link>
      </p>

      {loading && <p>Loading…</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && otherUser && (
        <>
          <h1 style={{ fontSize: '1.3rem' }}>{otherUser.displayName}</h1>

          <div
            className="card"
            style={{ height: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}
          >
            {messages.length === 0 && (
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>No messages yet - say hello.</p>
            )}
            {messages.map((m) => {
              const mine = m.senderId === user?.id;
              return (
                <div
                  key={m.id}
                  style={{
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    background: mine ? 'var(--deep-green)' : 'var(--paper)',
                    color: mine ? '#fff' : 'var(--ink)',
                    padding: '8px 12px',
                    borderRadius: 8,
                    maxWidth: '75%'
                  }}
                >
                  {m.content}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSend} style={{ display: 'flex', gap: 8 }}>
            <input
              style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 3 }}
              placeholder="Type a message…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button className="btn" type="submit" disabled={!text.trim()}>Send</button>
          </form>
        </>
      )}
    </div>
  );
}
