import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';

const styles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--line)',
    background: 'var(--paper-raised)'
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: 'var(--font-display)',
    fontSize: '1.3rem',
    fontWeight: 600,
    color: 'var(--deep-green)',
    textDecoration: 'none'
  },
  nav: { display: 'flex', alignItems: 'center', gap: 18, fontSize: '0.92rem' },
  link: { color: 'var(--ink)', textDecoration: 'none' }
};

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header style={styles.bar}>
      <Link to="/" style={styles.brand}>
        <svg className="icon" width="22" height="22"><use href="/icons.svg#icon-shield" /></svg>
        SatyaNet
      </Link>
      <nav style={styles.nav}>
        <Link to="/trust" style={styles.link}>How it works</Link>
        {user && <Link to={`/profile/${user.id}`} style={styles.link}>My profile</Link>}
        {user && <Link to="/my-appeals" style={styles.link}>My appeals</Link>}
        {user && ['moderator', 'admin'].includes(user.role) && (
          <Link to="/moderation" style={styles.link}>Moderation</Link>
        )}
        {user && user.role === 'admin' && (
          <>
            <Link to="/admin" style={styles.link}>Admin</Link>
            <Link to="/audit-log" style={styles.link}>Audit log</Link>
          </>
        )}
        {user ? (
          <>
            <span className="badge">{user.displayName}</span>
            <button className="btn btn-secondary" onClick={handleLogout}>Log out</button>
          </>
        ) : (
          <>
            <Link to="/login" style={styles.link}>Log in</Link>
            <Link to="/signup" className="btn">Sign up</Link>
          </>
        )}
      </nav>
    </header>
  );
}

