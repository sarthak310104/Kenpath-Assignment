const { query } = require('../db');
const cache = require('../cache');

const REPORT_KINDS = ['daily', 'month-to-date', 'previous-month'];

function isValidDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);

  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date;
}

function addDays(date, days) {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);

  return result.toISOString().slice(0, 10);
}

// The date range for each kind of report, based on the selected date.
// start is included, end is NOT (it is the day after the last day counted).
function rangeFor(kind, date) {
  if (kind === 'daily') {
    return { start: date, end: addDays(date, 1) };
  }

  if (kind === 'month-to-date') {
    return { start: `${date.slice(0, 7)}-01`, end: addDays(date, 1) };
  }

  // previous-month: the whole month before the selected date's month
  const firstOfThisMonth = `${date.slice(0, 7)}-01`;
  const previous = new Date(`${firstOfThisMonth}T00:00:00.000Z`);
  previous.setUTCMonth(previous.getUTCMonth() - 1);

  return { start: previous.toISOString().slice(0, 10), end: firstOfThisMonth };
}

// Summary + readings for one user between two dates (end not included).
// Used for the patient's own reports and for a doctor looking at a patient.
async function buildReport(userId, startDate, endDate) {
  const key = `reports:${userId}:${startDate}:${endDate}`;

  const cached = await cache.getReport(key);

  if (cached) {
    return { report: cached, hit: true };
  }

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

  const report = {
    period: {
      start_date: startDate,
      end_date: endDate
    },
    summary: summaryResult.rows[0],
    readings: readingsResult.rows
  };

  await cache.saveReport(userId, key, report);

  return { report, hit: false };
}

function reportHandler(kind) {
  return async function (req, res) {
    const { date } = req.query;

    if (!date || !isValidDate(date)) {
      return res.status(400).json({
        message: 'Please provide a valid date in YYYY-MM-DD format.'
      });
    }

    try {
      const { start, end } = rangeFor(kind, date);
      const { report, hit } = await buildReport(req.user.userId, start, end);

      // handy for checking the cache from curl or the browser's network tab
      res.set('X-Cache', hit ? 'HIT' : 'MISS');
      res.json(report);
    } catch (error) {
      console.error('Report error:', error);
      res.status(500).json({ message: 'Failed to generate report.' });
    }
  };
}

module.exports = {
  getDailyReport: reportHandler('daily'),
  getMonthToDateReport: reportHandler('month-to-date'),
  getPreviousMonthReport: reportHandler('previous-month'),
  buildReport,
  rangeFor,
  isValidDate,
  REPORT_KINDS
};