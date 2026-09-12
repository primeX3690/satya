import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import PostCard from './PostCard.jsx';

function ConnectionButton({ userId }) {
  const [status, setStatus] = useState(null); // 'none' | 'pending_sent' | 'pending_received' | 'accepted'
  const [requestId, setRequestId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getConnectionStatus(userId)
      .then((data) => {
        setStatus(data.status);
        setRequestId(data.requestId || null);
      })
      .catch(() => setStatus('none'));
  }, [userId]);

  const sendRequest = async () => {
    setBusy(true);
    setError('');
    try {
      await api.sendConnectionRequest(userId);
      setStatus('pending_sent');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const respond = async (newStatus) => {
    setBusy(true);
    setError('');
    try {
      await api.respondToConnectionRequest(requestId, newStatus);
      setStatus(newStatus === 'accepted' ? 'accepted' : 'none');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (status === null) return null; // still loading

  return (
    <div style={{ marginTop: 10 }}>
      {status === 'accepted' && (
        <Link to={`/messages/${userId}`} className="btn btn-secondary">Message</Link>
      )}
      {status === 'none' && (
        <button className="btn btn-secondary" onClick={sendRequest} disabled={busy}>
          {busy ? 'Sending…' : 'Connect'}
        </button>
      )}
      {status === 'pending_sent' && (
        <button className="btn btn-secondary" disabled>Request sent</button>
      )}
      {status === 'pending_received' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Wants to connect with you:</span>
          <button className="btn" onClick={() => respond('accepted')} disabled={busy}>Accept</button>
          <button className="btn btn-secondary" onClick={() => respond('rejected')} disabled={busy}>Decline</button>
        </div>
      )}
      {error && <p className="error-text" style={{ marginTop: 6 }}>{error}</p>}
    </div>
  );
}

export default function Profile() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError('');
    api
      .getProfile(id)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDeleted = (postId) => {
    setData((prev) => (prev ? { ...prev, posts: prev.posts.filter((p) => p.id !== postId) } : prev));
  };

  if (loading) return <div className="container" style={{ marginTop: 32 }}><p>Loading…</p></div>;
  if (error) return <div className="container" style={{ marginTop: 32 }}><p className="error-text">{error}</p></div>;
  if (!data) return null;

  const { user, isSelf, posts } = data;
  const postList = Array.isArray(posts) ? posts : [];

  return (
    <div className="container" style={{ marginTop: 32, marginBottom: 60 }}>
      <div className="card" style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 4 }}>{user.displayName}</h1>
        <p style={{ color: 'var(--muted)', marginBottom: 0 }}>
          Trust score: {user.trustScore} · Member since{' '}
          {new Date(`${user.memberSince}Z`).toLocaleDateString()}
        </p>
        {!isSelf && <ConnectionButton userId={user.id} />}
      </div>

      <h2 style={{ fontSize: '1.1rem' }}>{isSelf ? 'Your posts' : `${user.displayName}'s posts`}</h2>
      {isSelf && (
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
          You can see all your posts here, including flagged or removed ones. Only your
          published posts are visible to other people.
        </p>
      )}

      {postList.length === 0 && <p>No posts yet.</p>}
      {postList.map((post) => (
        <PostCard key={post.id} post={post} showAppealLink={isSelf} onDeleted={handleDeleted} />
      ))}
    </div>
  );
}

