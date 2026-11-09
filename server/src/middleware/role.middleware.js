const { query } = require('../db');

// Lets only doctor accounts through. The role is read from the database on
// every call, not from the token, so it is always up to date.
async function requireDoctor(req, res, next) {
  try {
    const result = await query(
      'SELECT role FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0 || result.rows[0].role !== 'doctor') {
      return res.status(403).json({
        message: 'Only doctors can do this.',
      });
    }

    next();
  } catch (error) {
    console.error('Role check error:', error);

    return res.status(500).json({
      message: 'Something went wrong.',
    });
  }
}

module.exports = { requireDoctor };