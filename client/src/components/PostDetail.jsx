import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import PostCard from './PostCard.jsx';

/**
 * Single-post permalink page - this is where share links (copied via the
 * "share" button on PostCard) actually land.
 */
export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError('');
    api
      .getPost(id)
      .then(({ post: p }) => setPost(p))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="container" style={{ marginTop: 32, marginBottom: 60, maxWidth: 620 }}>
      <p style={{ marginBottom: 16 }}>
        <Link to="/">&larr; Back to timeline</Link>
      </p>

      {loading && <p>Loading…</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && post && (
        <PostCard post={post} showAppealLink onDeleted={() => navigate('/')} />
      )}
    </div>
  );
}

