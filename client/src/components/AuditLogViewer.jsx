import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

export default function AuditLogViewer() {
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getAuditLog()
      .then(({ entries: rows }) => setEntries(rows))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container" style={{ marginTop: 32, marginBottom: 60 }}>
      <h1>
        <svg className="icon" width="20" height="20" style={{ marginRight: 8, verticalAlign: 'middle' }}>
          <use href="/icons.svg#icon-log" />
        </svg>
        Audit log
      </h1>
      <p style={{ color: 'var(--muted)' }}>Every moderation and admin action, in order, for full transparency.</p>

      {loading && <p>Loading…</p>}
      {error && <p className="error-text">{error}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
            <th style={{ padding: '8px 6px' }}>When</th>
            <th style={{ padding: '8px 6px' }}>Action</th>
            <th style={{ padding: '8px 6px' }}>Target</th>
            <th style={{ padding: '8px 6px' }}>Details</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} style={{ borderBottom: '1px solid var(--line)' }}>
              <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>{new Date(e.created_at).toLocaleString()}</td>
              <td style={{ padding: '8px 6px' }}>{e.action}</td>
              <td style={{ padding: '8px 6px' }}>{e.target_type} · {e.target_id.slice(0, 8)}</td>
              <td style={{ padding: '8px 6px', color: 'var(--muted)' }}>
                {e.details ? JSON.stringify(e.details) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

