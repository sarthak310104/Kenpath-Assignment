const { query } = require('../db');

const SLOTS = {
  morning: 'Morning (fasting)',
  after_breakfast: 'After breakfast',
  after_lunch: 'After lunch',
  after_dinner: 'After dinner',
};

const VALID_SLOTS = Object.keys(SLOTS);

function validateReading({ reading_date, slot, value }) {
  if (!reading_date) {
    return 'Please select a date.';
  }

  if (typeof reading_date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(reading_date)) {
    return 'Please enter a valid date.';
  }

  const parsedDate = new Date(`${reading_date}T00:00:00.000Z`);

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== reading_date
  ) {
    return 'Please enter a valid date.';
  }

  const today = new Date().toISOString().slice(0, 10);

  if (reading_date > today) {
    return 'Date cannot be in the future.';
  }

  if (!slot || !VALID_SLOTS.includes(slot)) {
    return 'Please select a valid time slot.';
  }

  if (value === undefined || value === null || value === '') {
    return 'Please enter a glucose value.';
  }

  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 40 ||
    value > 600
  ) {
    return 'Value must be between 40 and 600 mg/dl.';
  }

  return null;
}

function handleDatabaseError(error, res, slot) {
  if (error.code === '23505') {
    return res.status(409).json({
      message: `You already have an ${SLOTS[slot] || slot} reading for this date.`,
    });
  }

  console.error('Readings API error:', error);

  return res.status(500).json({
    message: 'Something went wrong. Please try again.',
  });
}

// GET /api/readings
async function getReadings(req, res) {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);

    if (
      !Number.isInteger(page) ||
      !Number.isInteger(limit) ||
      page < 1 ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        message: 'Invalid pagination parameters.',
      });
    }

    const offset = (page - 1) * limit;
    const userId = req.user.userId;

    const [readingsResult, countResult] = await Promise.all([
      query(
        `SELECT id, reading_date, slot, value, created_at, updated_at
         FROM readings
         WHERE user_id = $1
         ORDER BY reading_date DESC,
           CASE slot
             WHEN 'morning' THEN 1
             WHEN 'after_breakfast' THEN 2
             WHEN 'after_lunch' THEN 3
             WHEN 'after_dinner' THEN 4
           END
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      ),

      query(
        'SELECT COUNT(*) AS total FROM readings WHERE user_id = $1',
        [userId]
      ),
    ]);

    const total = countResult.rows[0].total;

    return res.json({
      readings: readingsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleDatabaseError(error, res);
  }
}

// GET /api/readings/:id
async function getReading(req, res) {
  try {
    const result = await query(
      `SELECT id, reading_date, slot, value, created_at, updated_at
       FROM readings
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Reading not found.',
      });
    }

    return res.json({
      reading: result.rows[0],
    });
  } catch (error) {
    return handleDatabaseError(error, res);
  }
}

// POST /api/readings
async function createReading(req, res) {
  const { reading_date, slot, value } = req.body || {};

  const validationError = validateReading({
    reading_date,
    slot,
    value,
  });

  if (validationError) {
    return res.status(400).json({
      message: validationError,
    });
  }

  try {
    const result = await query(
      `INSERT INTO readings (user_id, reading_date, slot, value)
       VALUES ($1, $2, $3, $4)
       RETURNING id, reading_date, slot, value, created_at, updated_at`,
      [req.user.userId, reading_date, slot, value]
    );

    return res.status(201).json({
      message: 'Reading added successfully.',
      reading: result.rows[0],
    });
  } catch (error) {
    return handleDatabaseError(error, res, slot);
  }
}

// PUT /api/readings/:id
async function updateReading(req, res) {
  const { reading_date, slot, value } = req.body || {};

  const validationError = validateReading({
    reading_date,
    slot,
    value,
  });

  if (validationError) {
    return res.status(400).json({
      message: validationError,
    });
  }

  try {
    const result = await query(
      `UPDATE readings
       SET reading_date = $1, slot = $2, value = $3
       WHERE id = $4 AND user_id = $5
       RETURNING id, reading_date, slot, value, created_at, updated_at`,
      [
        reading_date,
        slot,
        value,
        req.params.id,
        req.user.userId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Reading not found.',
      });
    }

    return res.json({
      message: 'Reading updated successfully.',
      reading: result.rows[0],
    });
  } catch (error) {
    return handleDatabaseError(error, res, slot);
  }
}

// DELETE /api/readings/:id
async function deleteReading(req, res) {
  try {
    const result = await query(
      `DELETE FROM readings
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Reading not found.',
      });
    }

    return res.json({
      message: 'Reading deleted successfully.',
    });
  } catch (error) {
    return handleDatabaseError(error, res);
  }
}

module.exports = {
  getReadings,
  getReading,
  createReading,
  updateReading,
  deleteReading,
};