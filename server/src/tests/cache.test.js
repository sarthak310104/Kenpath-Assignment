require('dotenv').config();

const request = require('supertest');
const app = require('../app');
const cache = require('../cache');
const { query, pool } = require('../db');

// A tiny stand-in for Redis, so these tests don't need a server running.
// It only knows the few commands the cache uses.
function makeFakeRedis() {
  const values = new Map();
  const sets = new Map();

  return {
    broken: false,

    check() {
      if (this.broken) throw new Error('connection lost');
    },

    async get(key) {
      this.check();
      return values.has(key) ? values.get(key) : null;
    },

    async set(key, value) {
      this.check();
      values.set(key, value);
      return 'OK';
    },

    async sadd(key, member) {
      this.check();
      if (!sets.has(key)) sets.set(key, new Set());
      sets.get(key).add(member);
      return 1;
    },

    async expire() {
      this.check();
      return 1;
    },

    async smembers(key) {
      this.check();
      return [...(sets.get(key) || [])];
    },

    async del(...keys) {
      this.check();
      keys.forEach((key) => {
        values.delete(key);
        sets.delete(key);
      });
      return keys.length;
    }
  };
}

describe('Report cache', () => {
  let token;
  let otherToken;
  let fake;

  beforeAll(async () => {
    await query(
      'DELETE FROM users WHERE email IN ($1, $2)',
      ['cache-test@example.test', 'cache-other@example.test']
    );

    const first = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Cache Test', email: 'cache-test@example.test', password: 'password123' });

    const second = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Cache Other', email: 'cache-other@example.test', password: 'password123' });

    token = first.body.token;
    otherToken = second.body.token;
  });

  beforeEach(async () => {
    await query(
      `DELETE FROM readings
       WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'cache-%@example.test')`
    );

    fake = makeFakeRedis();
    cache.setClient(fake);
  });

  afterAll(async () => {
    cache.setClient(null);

    await query("DELETE FROM users WHERE email LIKE 'cache-%@example.test'");
    await pool.end();
  });

  function addReading(slot, value, date = '2026-10-15', authToken = token) {
    return request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ reading_date: date, slot, value });
  }

  function dailyReport(date = '2026-10-15', authToken = token) {
    return request(app)
      .get(`/api/reports/daily?date=${date}`)
      .set('Authorization', `Bearer ${authToken}`);
  }

  test('should answer the second request from the cache', async () => {
    await addReading('morning', 100);

    const first = await dailyReport();
    const second = await dailyReport();

    expect(first.headers['x-cache']).toBe('MISS');
    expect(second.headers['x-cache']).toBe('HIT');
    expect(second.body).toEqual(first.body);
  });

  test('should clear the cache when a reading is added', async () => {
    await addReading('morning', 100);
    await dailyReport();
    expect((await dailyReport()).headers['x-cache']).toBe('HIT');

    await addReading('after_lunch', 140);

    const after = await dailyReport();

    expect(after.headers['x-cache']).toBe('MISS');
    expect(after.body.summary.total_readings).toBe(2);
  });

  test('should clear the cache when a reading is edited', async () => {
    const created = await addReading('morning', 100);
    await dailyReport();

    await request(app)
      .put(`/api/readings/${created.body.reading.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reading_date: '2026-10-15', slot: 'morning', value: 180 });

    const after = await dailyReport();

    expect(after.headers['x-cache']).toBe('MISS');
    expect(after.body.summary.maximum).toBe(180);
  });

  test('should clear the cache when a reading is deleted', async () => {
    const created = await addReading('morning', 100);
    await dailyReport();

    await request(app)
      .delete(`/api/readings/${created.body.reading.id}`)
      .set('Authorization', `Bearer ${token}`);

    const after = await dailyReport();

    expect(after.headers['x-cache']).toBe('MISS');
    expect(after.body.summary.total_readings).toBe(0);
  });

  test('should keep different dates apart', async () => {
    const a = await dailyReport('2026-10-15');
    const b = await dailyReport('2026-10-16');

    expect(a.headers['x-cache']).toBe('MISS');
    expect(b.headers['x-cache']).toBe('MISS');
    expect((await dailyReport('2026-10-15')).headers['x-cache']).toBe('HIT');
    expect((await dailyReport('2026-10-16')).headers['x-cache']).toBe('HIT');
  });

  test('should not clear another users cached reports', async () => {
    await dailyReport('2026-10-15', otherToken);
    expect((await dailyReport('2026-10-15', otherToken)).headers['x-cache']).toBe('HIT');

    await addReading('morning', 100);

    expect((await dailyReport('2026-10-15', otherToken)).headers['x-cache']).toBe('HIT');
  });

  test('should keep working when Redis is down', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    fake.broken = true;

    const added = await addReading('morning', 100);
    const report = await dailyReport();

    expect(added.status).toBe(201);
    expect(report.status).toBe(200);
    expect(report.headers['x-cache']).toBe('MISS');
    expect(report.body.summary.total_readings).toBe(1);

    // one warning, not one per request
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  test('should work with caching switched off', async () => {
    cache.setClient(null);

    await addReading('morning', 100);

    const first = await dailyReport();
    const second = await dailyReport();

    expect(first.status).toBe(200);
    expect(second.headers['x-cache']).toBe('MISS');
  });
});