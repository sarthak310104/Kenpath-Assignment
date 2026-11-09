const crypto = require('crypto');

// The admin endpoints are for whoever runs the server, not for app users.
// They need the ADMIN_API_KEY from .env in an X-Admin-Key header. With no
// key set they stay switched off.
function requireAdminKey(req, res, next) {
  const expected = process.env.ADMIN_API_KEY;

  if (!expected) {
    return res.status(503).json({
      message: 'Admin access is not set up on this server.',
    });
  }

  const given = req.get('x-admin-key');

  if (typeof given !== 'string') {
    return res.status(401).json({ message: 'Admin key required.' });
  }

  const a = Buffer.from(given);
  const b = Buffer.from(expected);

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ message: 'Admin key required.' });
  }

  next();
}

module.exports = requireAdminKey;