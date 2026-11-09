require('dotenv').config();

const request = require('supertest');
const app = require('../app');
const { query, pool } = require('../db');

const ADMIN_KEY = 'test-admin-key';
process.env.ADMIN_API_KEY = ADMIN_KEY;

const EMAILS = [
  'approval-doc1@example.test',
  'approval-doc2@example.test',
  'approval-patient@example.test'
];

describe('Doctor approval', () => {
  function signUp(email, role) {
    return request(app)
      .post('/api/auth/register')
      .send({ name: 'Dr Waiting', email, password: 'password123', role });
  }

  function login(email, password = 'password123') {
    return request(app).post('/api/auth/login').send({ email, password });
  }

  const admin = (req) => req.set('X-Admin-Key', ADMIN_KEY);

  async function pendingRow(email) {
    const { rows } = await query(
      'SELECT code, password_hash FROM pending_doctors WHERE email = $1',
      [email]
    );
    return rows[0];
  }

  async function clean() {
    await query('DELETE FROM users WHERE email = ANY($1)', [EMAILS]);
    await query('DELETE FROM pending_doctors WHERE email = ANY($1)', [EMAILS]);
  }

  beforeAll(clean);

  afterAll(async () => {
    await clean();
    await pool.end();
  });

  describe('signing up as a doctor', () => {
    test('should park the doctor as pending, with no account and no token', async () => {
      const response = await signUp(EMAILS[0], 'doctor');
      const users = await query('SELECT id FROM users WHERE email = $1', [EMAILS[0]]);

      expect(response.status).toBe(202);
      expect(response.body.pending).toBe(true);
      expect(response.body.message).toBe(
        'We are currently verifying your profile, check back later.'
      );
      expect(response.body.token).toBeUndefined();
      expect(users.rowCount).toBe(0);
    });

    test('should make a code of 5 letters and 3 digits, without look-alike characters', async () => {
      const { code } = await pendingRow(EMAILS[0]);

      expect(code).toMatch(/^[A-Z0-9]{8}$/);
      expect(code.replace(/[^A-Z]/g, '')).toHaveLength(5);
      expect(code.replace(/[^0-9]/g, '')).toHaveLength(3);
      expect(code).not.toMatch(/[IO01]/);
    });

    test('should not keep the plain password', async () => {
      const row = await pendingRow(EMAILS[0]);

      expect(row.password_hash).not.toContain('password123');
    });

    test('should refuse a second request with the same email', async () => {
      const response = await signUp(EMAILS[0], 'doctor');

      expect(response.status).toBe(409);
    });

    test('should refuse a patient signup with an email that is waiting for approval', async () => {
      const response = await signUp(EMAILS[0], 'patient');

      expect(response.status).toBe(409);
    });

    test('should still create patients straight away', async () => {
      const response = await signUp(EMAILS[2], 'patient');

      expect(response.status).toBe(201);
      expect(response.body.user.role).toBe('patient');
      expect(response.body.token).toBeDefined();
    });
  });

  describe('logging in while pending', () => {
    test('should tell the doctor we are verifying their profile', async () => {
      const response = await login(EMAILS[0]);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(
        'We are currently verifying your profile, check back later.'
      );
      expect(response.body.token).toBeUndefined();
    });

    test('should not reveal pending status with a wrong password', async () => {
      const response = await login(EMAILS[0], 'wrong-password');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid email or password.');
    });

    test('should not let a pending doctor reach doctor routes', async () => {
      const response = await request(app).get('/api/doctor/patients');

      expect(response.status).toBe(401);
    });
  });

  describe('admin access', () => {
    test('should refuse the list without the admin key', async () => {
      const none = await request(app).get('/api/admin/doctors/pending');
      const wrong = await request(app)
        .get('/api/admin/doctors/pending')
        .set('X-Admin-Key', 'guess');

      expect(none.status).toBe(401);
      expect(wrong.status).toBe(401);
    });

    test('should refuse approving without the admin key, even with a real code', async () => {
      const { code } = await pendingRow(EMAILS[0]);
      const response = await request(app)
        .post('/api/admin/doctors/approve')
        .send({ code });

      expect(response.status).toBe(401);
      expect((await pendingRow(EMAILS[0]))).toBeDefined();
    });

    test('should stay switched off when no admin key is configured', async () => {
      delete process.env.ADMIN_API_KEY;

      try {
        const response = await request(app)
          .get('/api/admin/doctors/pending')
          .set('X-Admin-Key', ADMIN_KEY);

        expect(response.status).toBe(503);
      } finally {
        process.env.ADMIN_API_KEY = ADMIN_KEY;
      }
    });

    test('should list pending doctors with their codes, but never password hashes', async () => {
      const response = await admin(request(app).get('/api/admin/doctors/pending'));
      const mine = response.body.pending.find((p) => p.email === EMAILS[0]);

      expect(response.status).toBe(200);
      expect(mine.code).toMatch(/^[A-Z0-9]{8}$/);
      expect(JSON.stringify(response.body)).not.toContain('password_hash');
    });
  });

  describe('approving', () => {
    test('should reject a missing or badly formed code', async () => {
      const missing = await admin(request(app).post('/api/admin/doctors/approve')).send({});
      const short = await admin(request(app).post('/api/admin/doctors/approve')).send({ code: 'ABC' });

      expect(missing.status).toBe(400);
      expect(short.status).toBe(400);
    });

    test('should return 404 for a code nobody has', async () => {
      const response = await admin(request(app).post('/api/admin/doctors/approve'))
        .send({ code: 'ZZZZZ999' });

      expect(response.status).toBe(404);
    });

    test('should move the doctor into users and remove the pending row', async () => {
      const { code } = await pendingRow(EMAILS[0]);
      const response = await admin(request(app).post('/api/admin/doctors/approve'))
        .send({ code: code.toLowerCase() }); // letter case should not matter

      const user = await query('SELECT role FROM users WHERE email = $1', [EMAILS[0]]);

      expect(response.status).toBe(200);
      expect(response.body.doctor.email).toBe(EMAILS[0]);
      expect(user.rows[0].role).toBe('doctor');
      expect(await pendingRow(EMAILS[0])).toBeUndefined();
    });

    test('should let the approved doctor log in with the password they chose', async () => {
      const response = await login(EMAILS[0]);

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('doctor');

      const patients = await request(app)
        .get('/api/doctor/patients')
        .set('Authorization', `Bearer ${response.body.token}`);

      expect(patients.status).toBe(200);
    });

    test('should not accept the same code twice', async () => {
      await signUp(EMAILS[1], 'doctor');
      const { code } = await pendingRow(EMAILS[1]);

      const first = await admin(request(app).post('/api/admin/doctors/approve')).send({ code });
      const again = await admin(request(app).post('/api/admin/doctors/approve')).send({ code });

      expect(first.status).toBe(200);
      expect(again.status).toBe(404);
    });
  });
});