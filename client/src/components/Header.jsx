import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import NotificationBell from './NotificationBell.jsx';

const styles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--line)',
    background: 'var(--paper-raised)',
    position: 'relative'
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
  link: { color: 'var(--ink)', textDecoration: 'none' }
};

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/');
  };

  const closeMenu = () => setMenuOpen(false);

  const navLinks = (
    <>
      <Link to="/trust" style={styles.link} onClick={closeMenu}>How it works</Link>
      {user && <Link to={`/profile/${user.id}`} style={styles.link} onClick={closeMenu}>My profile</Link>}
      {user && <Link to="/messages" style={styles.link} onClick={closeMenu}>Messages</Link>}
      {user && <Link to="/my-appeals" style={styles.link} onClick={closeMenu}>My appeals</Link>}
      {user && ['moderator', 'admin'].includes(user.role) && (
        <Link to="/moderation" style={styles.link} onClick={closeMenu}>Moderation</Link>
      )}
      {user && user.role === 'admin' && (
        <>
          <Link to="/admin" style={styles.link} onClick={closeMenu}>Admin</Link>
          <Link to="/audit-log" style={styles.link} onClick={closeMenu}>Audit log</Link>
        </>
      )}
      {user ? (
        <>
          <span className="badge">{user.displayName}</span>
          <button className="btn btn-secondary" onClick={handleLogout}>Log out</button>
        </>
      ) : (
        <>
          <Link to="/login" style={styles.link} onClick={closeMenu}>Log in</Link>
          <Link to="/signup" className="btn" onClick={closeMenu}>Sign up</Link>
        </>
      )}
    </>
  );

  return (
    <header style={styles.bar}>
      <Link to="/" style={styles.brand} onClick={closeMenu}>
        <svg className="icon" width="22" height="22"><use href="/icons.svg#icon-shield" /></svg>
        SatyaNet
      </Link>

      {/* Desktop nav - hidden on narrow screens via CSS (.nav-desktop) */}
      <nav className="nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: '0.92rem' }}>
        {navLinks}
        {user && <NotificationBell />}
      </nav>

      {/* Mobile: bell (if logged in) + hamburger toggle - shown only on narrow screens via CSS */}
      <div className="nav-mobile-controls" style={{ display: 'none', alignItems: 'center', gap: 10 }}>
        {user && <NotificationBell />}
        <button
          aria-label="Menu"
          className="btn btn-secondary"
          onClick={() => setMenuOpen((v) => !v)}
          style={{ padding: '6px 10px' }}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {menuOpen && (
        <nav
          className="nav-mobile-menu"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'var(--paper-raised)',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            padding: '16px 20px',
            zIndex: 30
          }}
        >
          {navLinks}
        </nav>
      )}
    </header>
  );
}
