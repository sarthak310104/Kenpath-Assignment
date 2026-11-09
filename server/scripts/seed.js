require('dotenv').config();

const bcrypt = require('bcryptjs');
const { query, pool } = require('../src/db');

async function seed() {
  try {
    const passwordHash = await bcrypt.hash('Demo@12345', 10);

    // Create demo user if it doesn't already exist.
    const userResult = await query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'patient')
       ON CONFLICT DO NOTHING
       RETURNING id`,
      ['Demo Patient', 'demo@sweety.com', passwordHash]
    );

    let userId;

    if (userResult.rows.length > 0) {
      userId = userResult.rows[0].id;
    } else {
      const existingUser = await query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
        ['demo@sweety.com']
      );

      userId = existingUser.rows[0].id;
    }

    // Insert demo readings across the current and previous month.
    const readings = [
      [-10, 'morning', 110],
      [-10, 'after_breakfast', 145],
      [-10, 'after_lunch', 130],
      [-10, 'after_dinner', 155],

      [-5, 'morning', 105],
      [-5, 'after_breakfast', 138],
      [-5, 'after_lunch', 125],
      [-5, 'after_dinner', 148],

      [-2, 'morning', 115],
      [-2, 'after_lunch', 132],

      [-20, 'morning', 120],
      [-20, 'after_dinner', 150]
    ];

    for (const [daysAgo, slot, value] of readings) {
      await query(
        `INSERT INTO readings (user_id, reading_date, slot, value)
         VALUES ($1, CURRENT_DATE - $2::int, $3, $4)
         ON CONFLICT (user_id, reading_date, slot) DO NOTHING`,
        [userId, daysAgo, slot, value]
      );
    }

    console.log('Database seeded successfully!');
    console.log('Demo login:');
    console.log('Email: demo@sweety.com');
    console.log('Password: Demo@12345');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seed();