const { query } = require('../db');

function isValidDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);

  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date;
}

async function generateReport(req, res, startDate, endDate) {
  try {
    const userId = req.user.userId;

    const readingsResult = await query(
      `SELECT id, reading_date, slot, value, created_at, updated_at
       FROM readings
       WHERE user_id = $1
         AND reading_date >= $2
         AND reading_date < $3
       ORDER BY reading_date ASC,
         CASE slot
           WHEN 'morning' THEN 1
           WHEN 'after_breakfast' THEN 2
           WHEN 'after_lunch' THEN 3
           WHEN 'after_dinner' THEN 4
         END ASC`,
      [userId, startDate, endDate]
    );

    const summaryResult = await query(
      `SELECT
         COUNT(*)::int AS total_readings,
         ROUND(AVG(value), 1) AS average,
         MIN(value) AS minimum,
         MAX(value) AS maximum
       FROM readings
       WHERE user_id = $1
         AND reading_date >= $2
         AND reading_date < $3`,
      [userId, startDate, endDate]
    );

    res.json({
      period: {
        start_date: startDate,
        end_date: endDate
      },
      summary: summaryResult.rows[0],
      readings: readingsResult.rows
    });
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ message: 'Failed to generate report.' });
  }
}

async function getDailyReport(req, res) {
  const { date } = req.query;

  if (!date || !isValidDate(date)) {
    return res.status(400).json({
      message: 'Please provide a valid date in YYYY-MM-DD format.'
    });
  }

  // End date is exclusive, so add one day.
  const nextDate = new Date(`${date}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);

  const endDate = nextDate.toISOString().slice(0, 10);

  return generateReport(req, res, date, endDate);
}

async function getMonthToDateReport(req, res) {
  const result = await query(
    `SELECT
       date_trunc('month', CURRENT_DATE)::date AS start_date,
       (CURRENT_DATE + INTERVAL '1 day')::date AS end_date`
  );

  const { start_date, end_date } = result.rows[0];

  return generateReport(req, res, start_date, end_date);
}

async function getPreviousMonthReport(req, res) {
  const result = await query(
    `SELECT
       (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date AS start_date,
       date_trunc('month', CURRENT_DATE)::date AS end_date`
  );

  const { start_date, end_date } = result.rows[0];

  return generateReport(req, res, start_date, end_date);
}

module.exports = {
  getDailyReport,
  getMonthToDateReport,
  getPreviousMonthReport
};