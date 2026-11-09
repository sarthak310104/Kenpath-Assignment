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

  // The tests below check the exact messages from the assignment.

  function addReading(body, authToken = token) {
    return request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${authToken}`)
      .send(body);
  }

  test('should ask for a value when it is missing', async () => {
    const response = await addReading({
      reading_date: '2026-10-15',
      slot: 'morning'
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Please enter a glucose value.');
  });

  test('should reject decimals and out of range values with the range message', async () => {
    const message = 'Value must be between 40 and 600 mg/dl.';

    for (const value of [39, 601, 110.5]) {
      const response = await addReading({
        reading_date: '2026-10-15',
        slot: 'morning',
        value
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(message);
    }
  });

  test('should accept the boundary values 40 and 600', async () => {
    const low = await addReading({
      reading_date: '2026-10-15',
      slot: 'morning',
      value: 40
    });

    const high = await addReading({
      reading_date: '2026-10-15',
      slot: 'after_lunch',
      value: 600
    });

    expect(low.status).toBe(201);
    expect(high.status).toBe(201);
  });

  test('should explain future dates', async () => {
    const response = await addReading({
      reading_date: '2099-01-01',
      slot: 'morning',
      value: 110
    });

    expect(response.body.message).toBe('Date cannot be in the future.');
  });

  test('should name the slot in the duplicate message', async () => {
    await addReading({ reading_date: '2026-10-15', slot: 'after_lunch', value: 120 });

    const response = await addReading({
      reading_date: '2026-10-15',
      slot: 'after_lunch',
      value: 130
    });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      'You already have an After lunch reading for this date.'
    );
  });

  test('should reject a fifth reading on the same day', async () => {
    const slots = ['morning', 'after_breakfast', 'after_lunch', 'after_dinner'];

    for (const slot of slots) {
      const ok = await addReading({ reading_date: '2026-10-15', slot, value: 110 });
      expect(ok.status).toBe(201);
    }

    const response = await addReading({
      reading_date: '2026-10-15',
      slot: 'morning',
      value: 120
    });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('You can add only 4 readings per day.');
  });

  test('should not let an edit move a reading onto a full day', async () => {
    const slots = ['morning', 'after_breakfast', 'after_lunch', 'after_dinner'];

    for (const slot of slots) {
      await addReading({ reading_date: '2026-10-15', slot, value: 110 });
    }

    const other = await addReading({
      reading_date: '2026-10-14',
      slot: 'morning',
      value: 100
    });

    const response = await request(app)
      .put(`/api/readings/${other.body.reading.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reading_date: '2026-10-15', slot: 'morning', value: 100 });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('You can add only 4 readings per day.');
  });

  test('should let a reading on a full day be edited in place', async () => {
    const slots = ['morning', 'after_breakfast', 'after_lunch', 'after_dinner'];
    let firstId;

    for (const slot of slots) {
      const created = await addReading({ reading_date: '2026-10-15', slot, value: 110 });
      firstId = firstId || created.body.reading.id;
    }

    const response = await request(app)
      .put(`/api/readings/${firstId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reading_date: '2026-10-15', slot: 'morning', value: 95 });

    expect(response.status).toBe(200);
    expect(response.body.reading.value).toBe(95);
  });

  test('should not let one user edit or delete another users reading', async () => {
    const created = await addReading({
      reading_date: '2026-10-15',
      slot: 'morning',
      value: 110
    });

    const id = created.body.reading.id;

    const edit = await request(app)
      .put(`/api/readings/${id}`)
      .set('Authorization', `Bearer ${anotherUserToken}`)
      .send({ reading_date: '2026-10-15', slot: 'morning', value: 300 });

    const remove = await request(app)
      .delete(`/api/readings/${id}`)
      .set('Authorization', `Bearer ${anotherUserToken}`);

    expect(edit.status).toBe(404);
    expect(remove.status).toBe(404);
  });
});