/**
 * Wraps an async route handler so a thrown/rejected error is forwarded to
 * Express's error-handling middleware, instead of crashing silently.
 * Express 4 doesn't do this automatically for async functions.
 *
 * Usage: router.get('/', asyncHandler(async (req, res) => { ... }))
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
