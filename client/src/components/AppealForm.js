import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function AppealForm() {
  const { postId } = useParams();
  const navigate = useNavigate();

  const [post, setPost] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getPost(postId).then(({ post: p }) => setPost(p)).catch((err) => setError(err.message));
  }, [postId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.createAppeal({ postId, message });
      navigate('/my-appeals');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 560, marginTop: 32, marginBottom: 60 }}>
      <h1>File an appeal</h1>

      {post && (
        <div className="card" style={{ marginBottom: 20 }}>
          <span className={`badge badge-${post.status}`}>{post.status}</span>
          <p style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>{post.content}</p>
        </div>
      )}

      <form className="card" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="message">Why should this decision be reversed?</label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
        </div>

        {error && <p className="error-text">{error}</p>}

        <button className="btn" type="submit" disabled={submitting || !message.trim()}>
          {submitting ? 'Submitting…' : 'Submit appeal'}
        </button>
      </form>
    </div>
  );
}
