require('dotenv').config();

const request = require('supertest');
const app = require('../app');
const { query, pool } = require('../db');

describe('Readings API', () => {
  let token;
  let anotherUserToken;
  let readingId;
  let userId;
  let anotherUserId;

  beforeAll(async () => {
    // Remove test users from previous runs.
    await query(
      `DELETE FROM users
       WHERE email IN ($1, $2)`,
      ['readings-test@example.test', 'readings-other@example.test']
    );

    const firstUser = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Readings Test',
        email: 'readings-test@example.test',
        password: 'password123'
      });

    const secondUser = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Another Test',
        email: 'readings-other@example.test',
        password: 'password123'
      });

    token = firstUser.body.token;
    anotherUserToken = secondUser.body.token;

    userId = firstUser.body.user.id;
    anotherUserId = secondUser.body.user.id;
  });

  beforeEach(async () => {
    await query('DELETE FROM readings WHERE user_id IN ($1, $2)', [
      userId,
      anotherUserId
    ]);
  });

  afterAll(async () => {
    await query('DELETE FROM users WHERE id IN ($1, $2)', [
      userId,
      anotherUserId
    ]);

    await pool.end();
  });

  test('should create a reading', async () => {
    const response = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        reading_date: '2026-10-15',
        slot: 'morning',
        value: 110
      });

    expect(response.status).toBe(201);
    expect(response.body.reading.value).toBe(110);
    expect(response.body.reading.slot).toBe('morning');

    readingId = response.body.reading.id;
  });

  test('should reject a duplicate slot on the same date', async () => {
    const payload = {
      reading_date: '2026-10-15',
      slot: 'morning',
      value: 110
    };

    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    const response = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(response.status).toBe(409);
  });

  test('should reject values outside the allowed range', async () => {
    const response = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        reading_date: '2026-10-15',
        slot: 'morning',
        value: 700
      });

    expect(response.status).toBe(400);
  });

  test('should reject an invalid slot', async () => {
    const response = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        reading_date: '2026-10-15',
        slot: 'night',
        value: 110
      });

    expect(response.status).toBe(400);
  });

  test('should reject future dates', async () => {
    const response = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        reading_date: '2099-01-01',
        slot: 'morning',
        value: 110
      });

    expect(response.status).toBe(400);
  });

  test('should fetch readings for the logged-in user', async () => {
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        reading_date: '2026-10-15',
        slot: 'morning',
        value: 110
      });

    const response = await request(app)
      .get('/api/readings')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.readings).toHaveLength(1);
    expect(response.body.readings[0].value).toBe(110);
  });

  test('should not expose another user’s readings', async () => {
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        reading_date: '2026-10-15',
        slot: 'morning',
        value: 110
      });

    const response = await request(app)
      .get('/api/readings')
      .set('Authorization', `Bearer ${anotherUserToken}`);

    expect(response.status).toBe(200);
    expect(response.body.readings).toHaveLength(0);
  });

  test('should update a reading', async () => {
    const created = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        reading_date: '2026-10-15',
        slot: 'morning',
        value: 110
      });

    const response = await request(app)
      .put(`/api/readings/${created.body.reading.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        reading_date: '2026-10-15',
        slot: 'morning',
        value: 125
      });

    expect(response.status).toBe(200);
    expect(response.body.reading.value).toBe(125);
  });

  test('should delete a reading', async () => {
    const created = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        reading_date: '2026-10-15',
        slot: 'morning',
        value: 110
      });

    const response = await request(app)
      .delete(`/api/readings/${created.body.reading.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
  });

  test('should reject requests without authentication', async () => {
    const response = await request(app).get('/api/readings');

    expect(response.status).toBe(401);
  });
});