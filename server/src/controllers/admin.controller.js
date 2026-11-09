const { pool, query } = require('../db');

async function listPendingDoctors(req, res) {
  try {
    const result = await query(
      `SELECT id, name, email, code, created_at
       FROM pending_doctors
       ORDER BY created_at, id`
    );

    return res.json({ pending: result.rows });
  } catch (error) {
    console.error('List pending doctors error:', error);

    return res.status(500).json({
      message: 'Something went wrong while loading pending doctors.',
    });
  }
}

// Body: { "code": "K7QMA2XD" }. Moves that doctor into users with the
// doctor role and removes the pending row.
async function approveDoctor(req, res) {
  const raw = req.body && req.body.code;
  const code = typeof raw === 'string' ? raw.trim().toUpperCase() : '';

  if (!/^[A-Z0-9]{8}$/.test(code)) {
    return res.status(400).json({
      message: 'Send the 8 character code of the doctor to approve.',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const found = await client.query(
      'SELECT id, name, email, password_hash FROM pending_doctors WHERE code = $1 FOR UPDATE',
      [code]
    );

    if (found.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        message: 'No pending doctor with that code.',
      });
    }

    const pending = found.rows[0];

    const created = await client.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'doctor')
       RETURNING id, name, email, role`,
      [pending.name, pending.email, pending.password_hash]
    );

    await client.query('DELETE FROM pending_doctors WHERE id = $1', [pending.id]);
    await client.query('COMMIT');

    return res.json({
      message: 'Doctor approved. They can log in now.',
      doctor: created.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});

    if (error.code === '23505') {
      return res.status(409).json({
        message: 'An account with this email already exists.',
      });
    }

    console.error('Approve doctor error:', error);

    return res.status(500).json({
      message: 'Something went wrong while approving the doctor.',
    });
  } finally {
    client.release();
  }
}

module.exports = { listPendingDoctors, approveDoctor };