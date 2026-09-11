import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';

export default function Signup() {
  const [form, setForm] = useState({ displayName: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.email && !form.phone) {
      setError('Provide an email or a phone number.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        displayName: form.displayName,
        password: form.password,
        ...(form.email ? { email: form.email } : {}),
        ...(form.phone ? { phone: form.phone } : {})
      };
      const { userId } = await api.signup(payload);
      navigate('/verify', { state: { userId } });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 420, marginTop: 48 }}>
      <h1>Create an account</h1>
      <p style={{ color: 'var(--muted)' }}>
        We'll send a one-time code to verify you're a real person before you can post.
      </p>

      <form className="card" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="displayName">Display name</label>
          <input id="displayName" value={form.displayName} onChange={update('displayName')} required />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={form.email} onChange={update('email')} />
        </div>
        <div className="field">
          <label htmlFor="phone">Phone (optional if email given)</label>
          <input id="phone" value={form.phone} onChange={update('phone')} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            minLength={8}
            value={form.password}
            onChange={update('password')}
            required
          />
        </div>

        {error && <p className="error-text">{error}</p>}

        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Sign up'}
        </button>
      </form>

      <p style={{ marginTop: 16 }}>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}

