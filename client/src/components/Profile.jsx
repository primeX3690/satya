import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';
import PostCard from './PostCard.jsx';

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

  if (loading) return <div className="container" style={{ marginTop: 32 }}><p>Loading…</p></div>;
  if (error) return <div className="container" style={{ marginTop: 32 }}><p className="error-text">{error}</p></div>;
  if (!data) return null;

  const { user, isSelf, posts } = data;

  return (
    <div className="container" style={{ marginTop: 32, marginBottom: 60 }}>
      <div className="card" style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 4 }}>{user.displayName}</h1>
        <p style={{ color: 'var(--muted)', marginBottom: 0 }}>
          Trust score: {user.trustScore} · Member since{' '}
          {new Date(`${user.memberSince}Z`).toLocaleDateString()}
        </p>
      </div>

      <h2 style={{ fontSize: '1.1rem' }}>{isSelf ? 'Your posts' : `${user.displayName}'s posts`}</h2>
      {isSelf && (
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
          You can see all your posts here, including flagged or removed ones. Only your
          published posts are visible to other people.
        </p>
      )}

      {posts.length === 0 && <p>No posts yet.</p>}
      {posts.map((post) => (
        <PostCard key={post.id} post={post} showAppealLink={isSelf} />
      ))}
    </div>
  );
}