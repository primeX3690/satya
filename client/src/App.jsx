import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { api, getToken, setToken } from './services/api.js';

import Header from './components/Header.jsx';
import Login from './components/Login.jsx';
import Signup from './components/Signup.jsx';
import VerifyAccount from './components/VerifyAccount.jsx';
import Timeline from './components/Timeline.jsx';
import PostDetail from './components/PostDetail.jsx';
import ModerationPanel from './components/ModerationPanel.jsx';
import AdminLookup from './components/AdminLookup.jsx';
import AppealForm from './components/AppealForm.jsx';
import MyAppeals from './components/MyAppeals.jsx';
import AuditLogViewer from './components/AuditLogViewer.jsx';
import TrustPage from './components/TrustPage.jsx';
import PostCard from './components/PostDetail.jsx';
import Profile from './components/Profile.jsx';

// --- Auth context ----------------------------------------------------------
// Kept here (rather than a separate file) so the whole auth lifecycle -
// load, login, logout - lives next to the router that reacts to it.

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within App');
  return ctx;
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user: me } = await api.me();
      setUser(me);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const login = (token, userData) => {
    setToken(token);
    setUser(userData);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh: loadMe }}>
      {children}
    </AuthContext.Provider>
  );
}

// --- Route guards -----------------------------------------------------------

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container"><p>Loading…</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireRole({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container"><p>Loading…</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

// --- App shell ---------------------------------------------------------------

function AppShell() {
  return (
    <>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Timeline />} />
          <Route path="/post/:id" element={<PostDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify" element={<VerifyAccount />} />
          <Route path="/trust" element={<TrustPage />} />
          <Route path="/profile/:id" element={<Profile />} />
          <Route
            path="/appeal/:postId"
            element={
              <RequireAuth>
                <AppealForm />
              </RequireAuth>
            }
          />
          <Route
            path="/my-appeals"
            element={
              <RequireAuth>
                <MyAppeals />
              </RequireAuth>
            }
          />
          <Route
            path="/moderation"
            element={
              <RequireRole roles={['moderator', 'admin']}>
                <ModerationPanel />
              </RequireRole>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireRole roles={['admin']}>
                <AdminLookup />
              </RequireRole>
            }
          />
          <Route
            path="/audit-log"
            element={
              <RequireRole roles={['moderator', 'admin']}>
                <AuditLogViewer />
              </RequireRole>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

