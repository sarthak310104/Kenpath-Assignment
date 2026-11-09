require('dotenv').config();

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../app');
const { query, pool } = require('../db');

const testEmail = 'auth-test@example.com';
const testPassword = 'password123';

describe('Authentication API', () => {
  beforeEach(async () => {
    await query(
      'DELETE FROM users WHERE email LIKE $1',
      ['%@example.com']
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('POST /api/auth/register', () => {
    test('should register a new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: testEmail,
          password: testPassword,
        });

      expect(response.status).toBe(201);
      expect(response.body.user.name).toBe('Test User');
      expect(response.body.user.email).toBe(testEmail);
      expect(response.body.token).toBeDefined();

      expect(response.body.user.password_hash).toBeUndefined();

      const result = await query(
        'SELECT password_hash FROM users WHERE email = $1',
        [testEmail]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].password_hash).not.toBe(testPassword);

      const passwordMatches = await bcrypt.compare(
        testPassword,
        result.rows[0].password_hash
      );

      expect(passwordMatches).toBe(true);
    });

    test('should reject duplicate email registration', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: testEmail,
          password: testPassword,
        });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Another User',
          email: testEmail,
          password: testPassword,
        });

      expect(response.status).toBe(409);
    });

    test('should reject invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'invalid-email',
          password: testPassword,
        });

      expect(response.status).toBe(400);
    });

    test('should reject short passwords', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: testEmail,
          password: '123',
        });

      expect(response.status).toBe(400);
    });

    test('should reject missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
        });

      expect(response.status).toBe(400);
    });

    test('should reject whitespace-only names', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: '   ',
          email: testEmail,
          password: testPassword,
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      const passwordHash = await bcrypt.hash(testPassword, 10);

      await query(
        `INSERT INTO users (name, email, password_hash)
         VALUES ($1, $2, $3)`,
        ['Test User', testEmail, passwordHash]
      );
    });

    test('should login with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe(testEmail);
    });

    test('should reject incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
    });

    test('should reject nonexistent users', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'unknown@example.com',
          password: testPassword,
        });

      expect(response.status).toBe(401);
    });

    test('should handle email case differences', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'AUTH-TEST@EXAMPLE.COM',
          password: testPassword,
        });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/auth/me', () => {
    let token;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: testEmail,
          password: testPassword,
        });

      token = response.body.token;
    });

    test('should return the authenticated user', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe(testEmail);
      expect(response.body.user.name).toBe('Test User');
    });

    test('should reject requests without a token', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
    });

    test('should reject invalid tokens', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });
});