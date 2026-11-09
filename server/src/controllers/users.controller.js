const { query } = require('../db');

// GET /api/users/doctors
// The doctors a patient can pick from.
async function listDoctors(req, res) {
  try {
    const result = await query(
      `SELECT id, name
       FROM users
       WHERE role = 'doctor'
       ORDER BY name`
    );

    return res.json({ doctors: result.rows });
  } catch (error) {
    console.error('List doctors error:', error);

    return res.status(500).json({
      message: 'Something went wrong.',
    });
  }
}

// PUT /api/users/me/doctor
// Body: { "doctor_id": 3 } to share with a doctor, { "doctor_id": null } to stop.
// It is the patient who picks, so a doctor can't claim someone's data.
async function setMyDoctor(req, res) {
  const { doctor_id } = req.body || {};

  if (doctor_id !== null && !Number.isInteger(doctor_id)) {
    return res.status(400).json({
      message: 'Please choose a valid doctor.',
    });
  }

  try {
    const me = await query(
      'SELECT role FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (me.rows.length === 0 || me.rows[0].role !== 'patient') {
      return res.status(403).json({
        message: 'Only patients can choose a doctor.',
      });
    }

    if (doctor_id !== null) {
      const doctor = await query(
        `SELECT id FROM users WHERE id = $1 AND role = 'doctor'`,
        [doctor_id]
      );

      if (doctor.rows.length === 0) {
        return res.status(404).json({
          message: 'Doctor not found.',
        });
      }
    }

    await query(
      'UPDATE users SET doctor_id = $1 WHERE id = $2',
      [doctor_id, req.user.userId]
    );

    return res.json({
      message: doctor_id === null ? 'Doctor removed.' : 'Doctor saved.',
      doctor_id,
    });
  } catch (error) {
    console.error('Set doctor error:', error);

    return res.status(500).json({
      message: 'Something went wrong.',
    });
  }
}

module.exports = {
  listDoctors,
  setMyDoctor,
};