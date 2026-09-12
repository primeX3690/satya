import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, resolveMediaUrl } from '../services/api';
import { useAuth } from '../App.jsx';

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(`${iso}Z`).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function CommentSection({ postId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState(null); // null = not loaded yet
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { comments: rows } = await api.getComments(postId);
      // Defensive: only keep well-formed comment objects. A single
      // malformed entry from the API should never be able to crash the
      // whole list render.
      setComments(Array.isArray(rows) ? rows.filter((c) => c && c.id) : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      const result = await api.addComment(postId, { content: text.trim() });
      // Defensive: only add the new comment to the list if the server
      // actually sent one back in the expected shape.
      if (result && result.comment && result.comment.id) {
        setComments((prev) => [...(prev || []), result.comment]);
        setText('');
      } else {
        setError('Comment may not have saved - please refresh and check.');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
      {loading && <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Loading comments…</p>}
      {error && <p className="error-text">{error}</p>}

      {(comments || []).map((c) => (
        <div key={c.id} style={{ marginBottom: 8, fontSize: '0.9rem' }}>
          <strong>{c.authorName || 'Someone'}</strong>{' '}
          <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>
            {c.createdAt ? timeAgo(c.createdAt) : ''}
          </span>
          <p style={{ margin: '2px 0 0' }}>{c.content || ''}</p>
        </div>
      ))}
      {comments && comments.length === 0 && (
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>No comments yet.</p>
      )}

      {user && (
        <form onSubmit={submit} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 3 }}
            placeholder="Write a comment…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button className="btn" type="submit" disabled={!text.trim()}>Reply</button>
        </form>
      )}
    </div>
  );
}

export default function PostCard({ post, showAppealLink = false, onDeleted }) {
  const { user } = useAuth();
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');

  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [shareCount, setShareCount] = useState(post.shareCount);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareNotice, setShareNotice] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const isOwner = !!(user && post.authorId === user.id);

  const submitReport = async (e) => {
    e.preventDefault();
    if (!reportReason.trim()) return;
    try {
      await api.createReport({ postId: post.id, reason: reportReason.trim() });
      setStatus('sent');
      setMessage('Report submitted. Thank you.');
      setReporting(false);
      setReportReason('');
    } catch (err) {
      setStatus('error');
      setMessage(err.message);
    }
  };

  const handleLike = async () => {
    if (!user) return;
    setLiked((v) => !v);
    setLikeCount((c) => (liked ? c - 1 : c + 1));
    try {
      await api.toggleLike(post.id);
    } catch (err) {
      setLiked((v) => !v);
      setLikeCount((c) => (liked ? c + 1 : c - 1));
      alert(err.message);
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/post/${post.id}`;
    const shareData = {
      title: 'SatyaNet post',
      text: post.content ? post.content.slice(0, 120) : `A post by ${post.authorName} on SatyaNet`,
      url: shareUrl
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    } else {
      try {
        await navigator.clipboard?.writeText(shareUrl);
        setShareNotice('Link copied');
        setTimeout(() => setShareNotice(''), 2500);
      } catch {
        // Clipboard access can fail/be unavailable - sharing still gets recorded below.
      }
    }

    setShareCount((c) => c + 1);
    try {
      await api.sharePost(post.id);
    } catch {
      setShareCount((c) => c - 1);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.deletePost(post.id);
      onDeleted?.(post.id);
    } catch (err) {
      setDeleteError(err.message);
      setDeleting(false);
    }
  };

  if (deleting && !deleteError) return null;

  return (
    <article className="card" style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <Link to={`/profile/${post.authorId}`} style={{ color: 'var(--ink)', textDecoration: 'none' }}>
          <strong>{post.authorName}</strong>
        </Link>
        <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{timeAgo(post.createdAt)}</span>
      </div>

      {post.content && <p style={{ whiteSpace: 'pre-wrap' }}>{post.content}</p>}

      {post.media && (
        <div style={{ marginBottom: 12 }}>
          {post.media.type === 'video' ? (
            <video src={resolveMediaUrl(post.media.url)} controls style={{ width: '100%', borderRadius: 3 }} />
          ) : (
            <img src={resolveMediaUrl(post.media.url)} alt="" style={{ width: '100%', borderRadius: 3 }} />
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.78rem', color: 'var(--muted)' }}>
        <span className={`badge badge-${post.status}`}>{post.status}</span>
        {post.ipfsCid && (
          <span title={post.ipfsCid}>anchored · {post.ipfsCid.slice(0, 14)}…</span>
        )}
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          className="btn btn-secondary"
          onClick={handleLike}
          disabled={!user}
          style={liked ? { borderColor: '#DC2626', color: '#DC2626' } : undefined}
          title={user ? undefined : 'Log in to like'}
        >
          {liked ? '❤️' : '♡'} {likeCount}
        </button>
        <button className="btn btn-secondary" onClick={() => setCommentsOpen((v) => !v)}>
          💬 {post.commentCount}
        </button>
        <button className="btn btn-secondary" onClick={handleShare}>
          ↗ {shareCount}
        </button>
        {shareNotice && <span style={{ fontSize: '0.78rem', color: 'var(--ok)' }}>{shareNotice}</span>}
        {user && !isOwner && !reporting && (
          <button className="btn btn-secondary" onClick={() => setReporting(true)}>
            <svg className="icon" width="14" height="14"><use href="/icons.svg#icon-flag" /></svg>
            Report
          </button>
        )}
        {isOwner && (
          <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
        )}
        {showAppealLink && post.status !== 'published' && (
          <Link to={`/appeal/${post.id}`} className="btn btn-secondary">File appeal</Link>
        )}
      </div>

      {deleteError && <p className="error-text">{deleteError}</p>}

      {commentsOpen && <CommentSection postId={post.id} />}

      {reporting && (
        <form onSubmit={submitReport} style={{ marginTop: 12 }}>
          <div className="field">
            <label htmlFor={`reason-${post.id}`}>Why are you reporting this post?</label>
            <textarea
              id={`reason-${post.id}`}
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              required
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" type="submit">Submit report</button>
            <button className="btn btn-secondary" type="button" onClick={() => setReporting(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {status && <p className={status === 'sent' ? 'success-text' : 'error-text'}>{message}</p>}
    </article>
  );
}

