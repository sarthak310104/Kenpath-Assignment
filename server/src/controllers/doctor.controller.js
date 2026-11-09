const { query } = require('../db');
const {
  buildReport,
  rangeFor,
  isValidDate,
  REPORT_KINDS,
} = require('./reports.controller');

// GET /api/doctor/patients
// Only the patients who picked this doctor.
async function listPatients(req, res) {
  try {
    const result = await query(
      `SELECT id, name, email
       FROM users
       WHERE doctor_id = $1
       ORDER BY name`,
      [req.user.userId]
    );

    return res.json({ patients: result.rows });
  } catch (error) {
    console.error('List patients error:', error);

    return res.status(500).json({
      message: 'Something went wrong.',
    });
  }
}

// GET /api/doctor/patients/:id/reports/:kind?date=YYYY-MM-DD
// kind is daily, month-to-date or previous-month, same as the patient's own reports.
async function getPatientReport(req, res) {
  const { id, kind } = req.params;
  const { date } = req.query;

  if (!/^\d{1,9}$/.test(id) || !REPORT_KINDS.includes(kind)) {
    return res.status(404).json({
      message: 'Not found.',
    });
  }

  if (!date || !isValidDate(date)) {
    return res.status(400).json({
      message: 'Please provide a valid date in YYYY-MM-DD format.',
    });
  }

  try {
    // 404 (not 403) for patients who belong to someone else, so a doctor
    // can't use this to find out which user ids exist.
    const patientResult = await query(
      'SELECT id, name FROM users WHERE id = $1 AND doctor_id = $2',
      [id, req.user.userId]
    );

    if (patientResult.rows.length === 0) {
      return res.status(404).json({
        message: 'Patient not found.',
      });
    }

    const patient = patientResult.rows[0];
    const { start, end } = rangeFor(kind, date);
    const { report, hit } = await buildReport(patient.id, start, end);

    res.set('X-Cache', hit ? 'HIT' : 'MISS');
    return res.json({ patient, ...report });
  } catch (error) {
    console.error('Patient report error:', error);

    return res.status(500).json({
      message: 'Failed to generate report.',
    });
  }
}

module.exports = {
  listPatients,
  getPatientReport,
};