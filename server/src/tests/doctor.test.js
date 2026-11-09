require('dotenv').config();

// doctors are created through the approval flow, which needs the admin key
const ADMIN_KEY = 'test-admin-key';
process.env.ADMIN_API_KEY = ADMIN_KEY;

const request = require('supertest');
const app = require('../app');
const { query, pool } = require('../db');

const EMAILS = [
  'doctors-doc1@example.test',
  'doctors-doc2@example.test',
  'doctors-patient-a@example.test',
  'doctors-patient-b@example.test'
];

describe('Doctor role', () => {
  let doc1;
  let doc2;
  let patientA; // picks doc1
  let patientB; // never picks a doctor

  async function signUp(name, email, role) {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name, email, password: 'password123', role });

    return {
      id: response.body.user.id,
      token: response.body.token,
      response
    };
  }

  // sign up as a doctor, approve the code like the server owner would, log in
  async function signUpDoctor(name, email) {
    const signup = await request(app)
      .post('/api/auth/register')
      .send({ name, email, password: 'password123', role: 'doctor' });

    const { rows } = await query(
      'SELECT code FROM pending_doctors WHERE email = $1',
      [email]
    );

    await request(app)
      .post('/api/admin/doctors/approve')
      .set('X-Admin-Key', ADMIN_KEY)
      .send({ code: rows[0].code });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'password123' });

    return {
      id: response.body.user.id,
      token: response.body.token,
      signup,
      response
    };
  }

  function get(path, who) {
    return request(app)
      .get(path)
      .set('Authorization', `Bearer ${who.token}`);
  }

  function chooseDoctor(who, doctorId) {
    return request(app)
      .put('/api/users/me/doctor')
      .set('Authorization', `Bearer ${who.token}`)
      .send({ doctor_id: doctorId });
  }

  beforeAll(async () => {
    await query('DELETE FROM users WHERE email = ANY($1)', [EMAILS]);
    await query('DELETE FROM pending_doctors WHERE email = ANY($1)', [EMAILS]);

    doc1 = await signUpDoctor('Dr One', EMAILS[0]);
    doc2 = await signUpDoctor('Dr Two', EMAILS[1]);
    patientA = await signUp('Patient A', EMAILS[2]);
    patientB = await signUp('Patient B', EMAILS[3]);

    await chooseDoctor(patientA, doc1.id);

    for (const [slot, value] of [['morning', 100], ['after_lunch', 140]]) {
      await request(app)
        .post('/api/readings')
        .set('Authorization', `Bearer ${patientA.token}`)
        .send({ reading_date: '2026-10-15', slot, value });
    }
  });

  afterAll(async () => {
    await query('DELETE FROM users WHERE email = ANY($1)', [EMAILS]);
    await query('DELETE FROM pending_doctors WHERE email = ANY($1)', [EMAILS]);
    await pool.end();
  });

  describe('accounts', () => {
    test('should sign up as a doctor and default everyone else to patient', () => {
      expect(doc1.signup.status).toBe(202);
      expect(doc1.response.status).toBe(200);
      expect(doc1.response.body.user.role).toBe('doctor');
      expect(patientA.response.body.user.role).toBe('patient');
    });

    test('should reject an unknown role', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Nobody',
          email: 'doctors-bad-role@example.test',
          password: 'password123',
          role: 'admin'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Role must be patient or doctor.');
    });

    test('should include the role when logging in and on /me', async () => {
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: EMAILS[0], password: 'password123' });

      const me = await get('/api/auth/me', doc1);

      expect(login.body.user.role).toBe('doctor');
      expect(me.body.user.role).toBe('doctor');
    });
  });

  describe('choosing a doctor', () => {
    test('should list doctors but not patients', async () => {
      const response = await get('/api/users/doctors', patientB);
      const names = response.body.doctors.map((d) => d.name);

      expect(response.status).toBe(200);
      expect(names).toContain('Dr One');
      expect(names).toContain('Dr Two');
      expect(names).not.toContain('Patient A');
    });

    test('should remember the doctor a patient picked', async () => {
      const me = await get('/api/auth/me', patientA);

      expect(me.body.user.doctor_id).toBe(doc1.id);
    });

    test('should not accept a patient as the doctor', async () => {
      const response = await chooseDoctor(patientB, patientA.id);

      expect(response.status).toBe(404);
    });

    test('should reject a doctor id that is not a number', async () => {
      const response = await chooseDoctor(patientB, 'abc');

      expect(response.status).toBe(400);
    });

    test('should not let a doctor pick a doctor', async () => {
      const response = await chooseDoctor(doc1, doc2.id);

      expect(response.status).toBe(403);
    });
  });

  describe('doctor views', () => {
    test('should list only the doctors own patients', async () => {
      const mine = await get('/api/doctor/patients', doc1);
      const other = await get('/api/doctor/patients', doc2);

      expect(mine.status).toBe(200);
      expect(mine.body.patients.map((p) => p.name)).toEqual(['Patient A']);
      expect(other.body.patients).toHaveLength(0);
    });

    test('should show a patients daily report', async () => {
      const response = await get(
        `/api/doctor/patients/${patientA.id}/reports/daily?date=2026-10-15`,
        doc1
      );

      expect(response.status).toBe(200);
      expect(response.body.patient.name).toBe('Patient A');
      expect(response.body.summary.total_readings).toBe(2);
      expect(response.body.summary.minimum).toBe(100);
      expect(response.body.summary.maximum).toBe(140);
      expect(Number(response.body.summary.average)).toBe(120);
      expect(response.body.readings).toHaveLength(2);
    });

    test('should show month-to-date and previous-month reports too', async () => {
      const monthToDate = await get(
        `/api/doctor/patients/${patientA.id}/reports/month-to-date?date=2026-10-20`,
        doc1
      );

      const previousMonth = await get(
        `/api/doctor/patients/${patientA.id}/reports/previous-month?date=2026-11-09`,
        doc1
      );

      expect(monthToDate.body.summary.total_readings).toBe(2);
      expect(monthToDate.body.period.start_date).toBe('2026-10-01');
      expect(previousMonth.body.summary.total_readings).toBe(2);
      expect(previousMonth.body.period.start_date).toBe('2026-10-01');
    });

    test('should not show another doctors patient', async () => {
      const response = await get(
        `/api/doctor/patients/${patientA.id}/reports/daily?date=2026-10-15`,
        doc2
      );

      expect(response.status).toBe(404);
      expect(response.body.readings).toBeUndefined();
    });

    test('should not show a patient who has not picked a doctor', async () => {
      const response = await get(
        `/api/doctor/patients/${patientB.id}/reports/daily?date=2026-10-15`,
        doc1
      );

      expect(response.status).toBe(404);
    });

    test('should validate the id, the report kind and the date', async () => {
      const badId = await get('/api/doctor/patients/abc/reports/daily?date=2026-10-15', doc1);
      const badKind = await get(`/api/doctor/patients/${patientA.id}/reports/yearly?date=2026-10-15`, doc1);
      const noDate = await get(`/api/doctor/patients/${patientA.id}/reports/daily`, doc1);

      expect(badId.status).toBe(404);
      expect(badKind.status).toBe(404);
      expect(noDate.status).toBe(400);
    });
  });

  describe('who is allowed in', () => {
    test('should keep patients out of the doctor endpoints', async () => {
      const list = await get('/api/doctor/patients', patientA);
      const report = await get(
        `/api/doctor/patients/${patientA.id}/reports/daily?date=2026-10-15`,
        patientA
      );

      expect(list.status).toBe(403);
      expect(report.status).toBe(403);
    });

    test('should require a login', async () => {
      const response = await request(app).get('/api/doctor/patients');

      expect(response.status).toBe(401);
    });
  });

  describe('changing your mind', () => {
    test('should stop the doctor seeing a patient who removes them', async () => {
      const removed = await chooseDoctor(patientA, null);

      const response = await get(
        `/api/doctor/patients/${patientA.id}/reports/daily?date=2026-10-15`,
        doc1
      );

      expect(removed.status).toBe(200);
      expect(response.status).toBe(404);

      // put it back so the other tests keep working if they run again
      await chooseDoctor(patientA, doc1.id);
    });
  });
});