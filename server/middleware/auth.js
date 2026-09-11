const jwt = require('jsonwebtoken');

/**
 * Verifies the Bearer token on the Authorization header and attaches
 * the decoded payload to req.user. Rejects with 401 if missing/invalid.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, role, email }
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Like requireAuth, but never rejects the request - it just attaches
 * req.user when a valid token is present. Used on public routes (timeline,
 * single post) that want to personalize the response (e.g. "did I like
 * this?") for logged-in users without forcing everyone to log in to read.
 */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      // Invalid/expired token on an optional route - proceed as anonymous.
    }
  }
  return next();
}

/**
 * Restricts a route to one or more roles. Must run after requireAuth.
 * Usage: requireRole('admin') or requireRole('admin', 'moderator')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole, optionalAuth };

