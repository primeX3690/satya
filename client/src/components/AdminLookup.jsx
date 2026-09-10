import React, { useState } from 'react';
import { api } from '../services/api';

export default function AdminLookup() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [postId, setPostId] = useState('');
  const [postStatus, setPostStatus] = useState('published');
  const [postMessage, setPostMessage] = useState('');

  const search = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { users: rows } = await api.searchUsers(query);
      setUsers(rows);
    } catch (err) {
      setError(err.message);
    }
  };

  const changeRole = async (id, role) => {
    try {
      await api.setUserRole(id, role);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
    } catch (err) {
      alert(err.message);
    }
  };

  const applyPostStatus = async (e) => {
    e.preventDefault();
    setPostMessage('');
    try {
      await api.setPostStatus(postId, postStatus);
      setPostMessage('Post status updated.');
    } catch (err) {
      setPostMessage(err.message);
    }
  };

  return (
    <div className="container" style={{ marginTop: 32, marginBottom: 60 }}>
      <h1>Admin lookup</h1>

      <section className="card" style={{ marginBottom: 24 }}>
        <h2>Find a user</h2>
        <form onSubmit={search} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 3 }}
            placeholder="Search by email, phone, or name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn" type="submit">
            <svg className="icon" width="14" height="14"><use href="/icons.svg#icon-search" /></svg>
            Search
          </button>
        </form>

        {error && <p className="error-text">{error}</p>}

        {users.map((u) => (
          <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--line)' }}>
            <div>
              <strong>{u.display_name}</strong>{' '}
              <span style={{ color: 'var(--muted)' }}>{u.email || u.phone}</span>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                Trust score: {u.trust_score} · {u.is_verified ? 'Verified' : 'Unverified'}
              </div>
            </div>
            <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value)}>
              <option value="user">user</option>
              <option value="moderator">moderator</option>
              <option value="admin">admin</option>
            </select>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Manual post action</h2>
        <form onSubmit={applyPostStatus}>
          <div className="field">
            <label htmlFor="postId">Post ID</label>
            <input id="postId" value={postId} onChange={(e) => setPostId(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="postStatus">New status</label>
            <select id="postStatus" value={postStatus} onChange={(e) => setPostStatus(e.target.value)}>
              <option value="published">published</option>
              <option value="flagged">flagged</option>
              <option value="removed">removed</option>
            </select>
          </div>
          <button className="btn" type="submit">Apply</button>
          {postMessage && <p style={{ marginTop: 10 }}>{postMessage}</p>}
        </form>
      </section>
    </div>
  );
}
