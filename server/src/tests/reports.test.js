require('dotenv').config();

const request = require('supertest');
const app = require('../app');
const { query, pool } = require('../db');

describe('Reports API', () => {
  let token;
  let anotherUserToken;
  let userId;
  let anotherUserId;

  beforeAll(async () => {
    await query(
      `DELETE FROM users
       WHERE email IN ($1, $2)`,
      ['reports-test@example.test', 'reports-other@example.test']
    );

    const firstUser = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Reports Test',
        email: 'reports-test@example.test',
        password: 'password123'
      });

    const secondUser = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Another Reports Test',
        email: 'reports-other@example.test',
        password: 'password123'
      });

    token = firstUser.body.token;
    anotherUserToken = secondUser.body.token;

    userId = firstUser.body.user.id;
    anotherUserId = secondUser.body.user.id;
  });

  beforeEach(async () => {
    await query(
      'DELETE FROM readings WHERE user_id IN ($1, $2)',
      [userId, anotherUserId]
    );
  });

  afterAll(async () => {
    await query(
      'DELETE FROM users WHERE id IN ($1, $2)',
      [userId, anotherUserId]
    );

    await pool.end();
  });

  async function createReading(date, slot, value, authToken = token) {
    return request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        reading_date: date,
        slot,
        value
      });
  }

  test('should return readings for the selected date', async () => {
    await createReading('2026-10-15', 'morning', 110);
    await createReading('2026-10-15', 'after_lunch', 140);
    await createReading('2026-10-16', 'morning', 120);

    const response = await request(app)
      .get('/api/reports/daily?date=2026-10-15')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.readings).toHaveLength(2);
    expect(response.body.summary.total_readings).toBe(2);
    expect(Number(response.body.summary.average)).toBe(125);
    expect(response.body.summary.minimum).toBe(110);
    expect(response.body.summary.maximum).toBe(140);
  });

  test('should reject an invalid date', async () => {
    const response = await request(app)
      .get('/api/reports/daily?date=2026-02-30')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
  });

  test('should reject a missing date', async () => {
    const response = await request(app)
      .get('/api/reports/daily')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
  });

  // end_date in the API is exclusive (the day after the last day included).

  test('should return the month-to-date range for the selected date', async () => {
    const response = await request(app)
      .get('/api/reports/month-to-date?date=2026-10-15')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.period.start_date).toBe('2026-10-01');
    expect(response.body.period.end_date).toBe('2026-10-16');
  });

  test('should only count readings up to the selected date in month-to-date', async () => {
    await createReading('2026-09-30', 'morning', 50);
    await createReading('2026-10-01', 'morning', 100);
    await createReading('2026-10-15', 'morning', 140);
    await createReading('2026-10-16', 'morning', 300);

    const response = await request(app)
      .get('/api/reports/month-to-date?date=2026-10-15')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.summary.total_readings).toBe(2);
    expect(Number(response.body.summary.average)).toBe(120);
    expect(response.body.summary.minimum).toBe(100);
    expect(response.body.summary.maximum).toBe(140);
  });

  test('should return the whole previous month', async () => {
    const response = await request(app)
      .get('/api/reports/previous-month?date=2026-10-15')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.period.start_date).toBe('2026-09-01');
    expect(response.body.period.end_date).toBe('2026-10-01');
  });

  test('should roll the previous month back over a year boundary', async () => {
    const response = await request(app)
      .get('/api/reports/previous-month?date=2026-01-20')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.period.start_date).toBe('2025-12-01');
    expect(response.body.period.end_date).toBe('2026-01-01');
  });

  test('should require a date for month-to-date and previous-month', async () => {
    const monthToDate = await request(app)
      .get('/api/reports/month-to-date')
      .set('Authorization', `Bearer ${token}`);

    const previousMonth = await request(app)
      .get('/api/reports/previous-month')
      .set('Authorization', `Bearer ${token}`);

    expect(monthToDate.status).toBe(400);
    expect(previousMonth.status).toBe(400);
  });

  test('should return an empty summary when there are no readings', async () => {
    const response = await request(app)
      .get('/api/reports/daily?date=2026-01-01')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.summary.total_readings).toBe(0);
    expect(response.body.summary.average).toBeNull();
    expect(response.body.summary.minimum).toBeNull();
    expect(response.body.summary.maximum).toBeNull();
    expect(response.body.readings).toHaveLength(0);
  });

  test('should round the average to 1 decimal', async () => {
    // 100, 100, 101 -> 100.333...
    await createReading('2026-10-15', 'morning', 100);
    await createReading('2026-10-15', 'after_breakfast', 100);
    await createReading('2026-10-15', 'after_lunch', 101);

    const response = await request(app)
      .get('/api/reports/daily?date=2026-10-15')
      .set('Authorization', `Bearer ${token}`);

    expect(Number(response.body.summary.average)).toBe(100.3);
  });

  test('should calculate previous month summary correctly', async () => {
    await createReading('2026-10-15', 'morning', 100);
    await createReading('2026-10-15', 'after_lunch', 140);
    await createReading('2026-11-09', 'morning', 200);

    const response = await request(app)
      .get('/api/reports/previous-month?date=2026-11-09')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.summary.total_readings).toBe(2);
    expect(Number(response.body.summary.average)).toBe(120);
    expect(response.body.summary.minimum).toBe(100);
    expect(response.body.summary.maximum).toBe(140);
  });

  test('should not include another user readings', async () => {
    await createReading('2026-10-15', 'morning', 110);

    await createReading(
      '2026-10-15',
      'morning',
      200,
      anotherUserToken
    );

    const response = await request(app)
      .get('/api/reports/previous-month?date=2026-11-09')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.summary.total_readings).toBe(1);
    expect(response.body.readings).toHaveLength(1);
    expect(response.body.readings[0].value).toBe(110);
  });

  test('should reject unauthenticated requests', async () => {
    const response = await request(app)
      .get('/api/reports/previous-month');

    expect(response.status).toBe(401);
  });
});