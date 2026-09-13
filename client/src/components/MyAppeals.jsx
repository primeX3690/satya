import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

const statusColor = {
  pending: 'var(--muted)',
  approved: 'var(--ok)',
  rejected: 'var(--danger)'
};

export default function MyAppeals() {
  const [appeals, setAppeals] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getMyAppeals()
      .then(({ appeals: rows }) => setAppeals(rows))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container" style={{ marginTop: 32, marginBottom: 60 }}>
      <h1>My appeals</h1>

      {loading && <p>Loading…</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && appeals.length === 0 && (
        <p>You haven't filed any appeals. You can file one from a flagged or removed post of yours.</p>
      )}

      {appeals.map((a) => (
        <div key={a.id} className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <strong>Post {a.postId.slice(0, 8)}</strong>
            <span style={{ color: statusColor[a.status], fontWeight: 500 }}>{a.status}</span>
          </div>
          <p style={{ marginTop: 8 }}>{a.message}</p>
          {a.resolutionNote && (
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
              Resolution note: {a.resolutionNote}
            </p>
          )}
          <p style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Filed {new Date(a.createdAt).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
