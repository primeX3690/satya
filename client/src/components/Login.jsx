import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../App.jsx';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { token, user } = await api.login({ identifier, password });
      login(token, user);
      navigate('/');
    } catch (err) {
      if (err.message === 'Account not verified') {
        setError('Account not verified yet. Check your OTP.');
      } else {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 420, marginTop: 48 }}>
      <h1>Log in</h1>
      <p style={{ color: 'var(--muted)' }}>Welcome back. Verify claims, track your appeals.</p>

      <form className="card" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="identifier">Email or phone</label>
          <input
            id="identifier"
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <p className="error-text">{error}</p>}

        <button className="btn" type="submit" disabled={submitting} style={{ width: '100%', justifyContent: 'center' }}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p style={{ marginTop: 16 }}>
        Don't have an account? <Link to="/signup">Sign up</Link>
      </p>
    </div>
  );
}
