import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../App.jsx';

export default function VerifyAccount() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [userId, setUserId] = useState(location.state?.userId || '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { token, user } = await api.verifyOtp({ userId, code });
      login(token, user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setInfo('');
    try {
      await api.resendOtp({ userId });
      setInfo('A new code was sent.');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 420, marginTop: 48 }}>
      <h1>Verify your account</h1>
      <p style={{ color: 'var(--muted)' }}>
        Enter the code we sent you. In local dev, it's printed in the server console.
      </p>

      <form className="card" onSubmit={handleVerify}>
        {!location.state?.userId && (
          <div className="field">
            <label htmlFor="userId">User ID</label>
            <input id="userId" value={userId} onChange={(e) => setUserId(e.target.value)} required />
          </div>
        )}
        <div className="field">
          <label htmlFor="code">Verification code</label>
          <input
            id="code"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </div>

        {error && <p className="error-text">{error}</p>}
        {info && <p className="success-text">{info}</p>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? 'Verifying…' : 'Verify'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleResend}>
            Resend code
          </button>
        </div>
      </form>
    </div>
  );
}
