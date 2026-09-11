import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';

function ReportRow({ report, onResolved }) {
  const [busy, setBusy] = useState(false);

  const act = async (status) => {
    setBusy(true);
    try {
      await api.updateReport(report.id, { status });
      onResolved(report.id);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <p style={{ marginBottom: 6 }}>
        <strong>{report.reporterName}</strong> reported post <code>{report.postId.slice(0, 8)}</code>
      </p>
      <p style={{ color: 'var(--muted)' }}>{report.reason}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" disabled={busy} onClick={() => act('reviewed')}>Mark reviewed</button>
        <button className="btn btn-secondary" disabled={busy} onClick={() => act('dismissed')}>Dismiss</button>
      </div>
    </div>
  );
}

function AppealRow({ appeal, onResolved }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const act = async (status) => {
    setBusy(true);
    try {
      await api.resolveAppeal(appeal.id, { status, resolutionNote: note });
      onResolved(appeal.id);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <p style={{ marginBottom: 6 }}>
        Appeal on post <code>{appeal.postId.slice(0, 8)}</code>
      </p>
      <p style={{ color: 'var(--muted)' }}>{appeal.message}</p>
      <div className="field">
        <label htmlFor={`note-${appeal.id}`}>Resolution note (optional)</label>
        <input id={`note-${appeal.id}`} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" disabled={busy} onClick={() => act('approved')}>Approve &amp; restore</button>
        <button className="btn btn-danger" disabled={busy} onClick={() => act('rejected')}>Reject</button>
      </div>
    </div>
  );
}

export default function ModerationPanel() {
  const [reports, setReports] = useState([]);
  const [appeals, setAppeals] = useState([]);
  const [tab, setTab] = useState('reports');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [{ reports: r }, { appeals: a }] = await Promise.all([
        api.getReportQueue(),
        api.getAppealQueue()
      ]);
      setReports(r);
      setAppeals(a);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="container" style={{ marginTop: 32, marginBottom: 60 }}>
      <h1>Moderation queue</h1>
      <p style={{ color: 'var(--muted)' }}>Open reports and pending appeals awaiting a decision.</p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          className={tab === 'reports' ? 'btn' : 'btn btn-secondary'}
          onClick={() => setTab('reports')}
        >
          Reports ({reports.length})
        </button>
        <button
          className={tab === 'appeals' ? 'btn' : 'btn btn-secondary'}
          onClick={() => setTab('appeals')}
        >
          Appeals ({appeals.length})
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {tab === 'reports' && (
        <>
          {reports.length === 0 && <p>No open reports.</p>}
          {reports.map((r) => (
            <ReportRow
              key={r.id}
              report={r}
              onResolved={(id) => setReports((prev) => prev.filter((x) => x.id !== id))}
            />
          ))}
        </>
      )}

      {tab === 'appeals' && (
        <>
          {appeals.length === 0 && <p>No pending appeals.</p>}
          {appeals.map((a) => (
            <AppealRow
              key={a.id}
              appeal={a}
              onResolved={(id) => setAppeals((prev) => prev.filter((x) => x.id !== id))}
            />
          ))}
        </>
      )}
    </div>
  );
}

