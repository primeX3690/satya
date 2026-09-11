const rateLimit = require('express-rate-limit');

// General API limiter - generous, just guards against runaway loops/bots.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

// Tighter limiter for auth endpoints to slow down brute-force / OTP abuse.
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please slow down.' }
});

module.exports = { apiLimiter, authLimiter };

