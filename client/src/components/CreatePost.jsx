import React, { useState, useRef } from 'react';
import { api } from '../services/api';

const MAX_FILE_MB = 50;

export default function CreatePost({ onPosted }) {
  const [content, setContent] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    setError('');
    if (!selected) {
      setFile(null);
      setPreview(null);
      return;
    }
    if (selected.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`File is too large - max ${MAX_FILE_MB}MB.`);
      return;
    }
    setFile(selected);
    setPreview({ url: URL.createObjectURL(selected), isVideo: selected.type.startsWith('video/') });
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!content.trim() && !file) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      if (content.trim()) formData.append('content', content.trim());
      if (file) formData.append('media', file);

      const { post, moderation } = await api.createPost(formData);
      setContent('');
      clearFile();

      if (post.status === 'flagged') {
        setNotice(
          `Your post was flagged for review (${moderation.reasons.join('; ')}) and is not on the public timeline yet. You can file an appeal from "My appeals".`
        );
      } else {
        setNotice('Posted.');
      }
      onPosted?.(post);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="card" onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
      <div className="field" style={{ marginBottom: 12 }}>
        <label htmlFor="content">Share a claim, update, photo, or video</label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={2000}
          placeholder="What do you want to say? Every post is hashed and anchored for integrity."
        />
      </div>

      {preview && (
        <div style={{ marginBottom: 12, position: 'relative', maxWidth: 320 }}>
          {preview.isVideo ? (
            <video src={preview.url} controls style={{ width: '100%', borderRadius: 3 }} />
          ) : (
            <img src={preview.url} alt="Upload preview" style={{ width: '100%', borderRadius: 3 }} />
          )}
          <button type="button" className="btn btn-secondary" onClick={clearFile} style={{ marginTop: 8 }}>
            Remove
          </button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
          Add photo/video
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </label>
        <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Up to {MAX_FILE_MB}MB</span>
      </div>

      {error && <p className="error-text">{error}</p>}
      {notice && <p className="success-text">{notice}</p>}

      <button className="btn" type="submit" disabled={submitting || (!content.trim() && !file)}>
        {submitting ? 'Posting…' : 'Post'}
      </button>
    </form>
  );
}
