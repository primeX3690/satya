
import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../App.jsx';
import CreatePost from './CreatePost.jsx';
import PostCard from './PostCard.jsx';

export default function Timeline() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { posts: rows } = await api.getTimeline();
      setPosts(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handlePosted = (post) => {
    if (post.status === 'published') {
      setPosts((prev) => [post, ...prev]);
    }
  };

  const handleDeleted = (id) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="container" style={{ marginTop: 32, marginBottom: 60 }}>
      <h1>Timeline</h1>
      <p style={{ color: 'var(--muted)' }}>
        Every post below has passed automated moderation and is publicly verifiable.
      </p>

      {user ? (
        <CreatePost onPosted={handlePosted} />
      ) : (
        <p className="card" style={{ marginBottom: 24 }}>
          Log in to post. Reading the timeline doesn't require an account.
        </p>
      )}

      {loading && <p>Loading timeline…</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && posts.length === 0 && <p>No posts yet. Be the first to share something.</p>}

      {posts.map((post) => (
        <PostCard key={post.id} post={post} onDeleted={handleDeleted} />
      ))}
    </div>
  );
}
