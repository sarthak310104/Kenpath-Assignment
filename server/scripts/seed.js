require('dotenv').config();

const bcrypt = require('bcryptjs');
const { query, pool } = require('../src/db');

async function seed() {
  try {
    const passwordHash = await bcrypt.hash('Demo@12345', 10);

    // Create the demo user if it doesn't already exist.
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

    // Generate three readings per day across the last 35 days.
    const slots = [
      'morning',
      'after_breakfast',
      'after_lunch',
      'after_dinner'
    ];

    for (let daysAgo = 0; daysAgo < 35; daysAgo++) {
      // Rotate the omitted slot so all four slots appear in the dataset.
      const omittedSlot = daysAgo % 4;

      for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
        if (slotIndex === omittedSlot) continue;

        const slot = slots[slotIndex];

        // Deterministic variation keeps the demo data realistic and repeatable.
        const value = 100 + slotIndex * 15 + (daysAgo % 7) * 4;

        await query(
          `INSERT INTO readings (user_id, reading_date, slot, value)
           VALUES ($1, CURRENT_DATE - $2::int, $3, $4)
           ON CONFLICT (user_id, reading_date, slot) DO NOTHING`,
          [userId, daysAgo, slot, value]
        );
      }
    }

    console.log('Database seeded successfully!');
    console.log('Generated readings across the last 35 days.');
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