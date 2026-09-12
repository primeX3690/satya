const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { apiLimiter } = require('./middleware/rateLimit');

const authRoutes = require('./routes/auth');
const postsRoutes = require('./routes/posts');
const usersRoutes = require('./routes/users');
const reportsRoutes = require('./routes/reports');
const appealsRoutes = require('./routes/appeals');
const adminRoutes = require('./routes/admin');
const notificationsRoutes = require('./routes/notifications');
const messagesRoutes = require('./routes/messages');

const app = express();

app.use(
  helmet({
    // Uploaded media is served from this API but rendered on a different
    // origin (the Vite client) - relax CORP just enough to allow that.
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(apiLimiter);

// Uploaded post media (images/video) - see server/routes/posts.js
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/appeals', appealsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/messages', messagesRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Centralized error handler - keeps stack traces out of API responses.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  // Multer (file upload) errors are client mistakes (too large, bad type), not server faults.
  if (err.name === 'MulterError' || /Unsupported media type/.test(err.message || '')) {
    return res.status(400).json({ error: err.message });
  }
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;

