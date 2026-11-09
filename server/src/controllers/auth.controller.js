const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const { makeDoctorCode } = require('../utils/doctorCode');

const SALT_ROUNDS = 10;

const PENDING_MESSAGE = 'We are currently verifying your profile, check back later.';

function createToken(userId) {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

async function createPendingDoctor(res, name, email, passwordHash) {
  // a clash on the random code is very unlikely, but just try again
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeDoctorCode();

    try {
      await query(
        `INSERT INTO pending_doctors (code, name, email, password_hash)
         VALUES ($1, $2, $3, $4)`,
        [code, name, email, passwordHash]
      );

      if (process.env.NODE_ENV !== 'test') {
        console.log(`[doctor signup] waiting for approval: ${name} <${email}> code ${code}`);
      }

      return res.status(202).json({ message: PENDING_MESSAGE, pending: true });
    } catch (error) {
      if (error.code === '23505' && error.constraint === 'pending_doctors_code_key') {
        continue;
      }

      throw error;
    }
  }

  throw new Error('Could not make a unique doctor code.');
}

async function register(req, res) {
  try {
    const { name, email, password, role } = req.body || {};

    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string'
    ) {
      return res.status(400).json({
        message: 'Name, email and password are required.',
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      return res.status(400).json({
        message: 'Name cannot be empty.',
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        message: 'Please enter a valid email address.',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters long.',
      });
    }

    // role is optional and defaults to patient
    if (role !== undefined && role !== 'patient' && role !== 'doctor') {
      return res.status(400).json({
        message: 'Role must be patient or doctor.',
      });
    }

    const existingUser = await query(
      'SELECT id FROM users WHERE lower(email) = $1',
      [cleanEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        message: 'An account with this email already exists.',
      });
    }

    const waiting = await query(
      'SELECT id FROM pending_doctors WHERE lower(email) = $1',
      [cleanEmail]
    );

    if (waiting.rows.length > 0) {
      return res.status(409).json({
        message: 'A doctor request with this email is already waiting for approval.',
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Doctors don't get an account straight away. They wait in
    // pending_doctors until the server owner approves their code.
    if (role === 'doctor') {
      return createPendingDoctor(res, cleanName, cleanEmail, passwordHash);
    }

    const result = await query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, doctor_id, created_at`,
      [cleanName, cleanEmail, passwordHash, role || 'patient']
    );

    const user = result.rows[0];

    return res.status(201).json({
      message: 'Account created successfully.',
      token: createToken(user.id),
      user,
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        message: 'An account with this email already exists.',
      });
    }

    console.error('Registration error:', error);

    return res.status(500).json({
      message: 'Something went wrong while creating your account.',
    });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body || {};

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: 'Email and password are required.',
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const result = await query(
      `SELECT id, name, email, role, doctor_id, password_hash
       FROM users
       WHERE lower(email) = $1`,
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      // not a user yet, maybe a doctor who is still waiting for approval
      const waiting = await query(
        'SELECT password_hash FROM pending_doctors WHERE lower(email) = $1',
        [cleanEmail]
      );

      if (
        waiting.rows.length > 0 &&
        (await bcrypt.compare(password, waiting.rows[0].password_hash))
      ) {
        return res.status(403).json({ message: PENDING_MESSAGE });
      }

      return res.status(401).json({
        message: 'Invalid email or password.',
      });
    }

    const user = result.rows[0];

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: 'Invalid email or password.',
      });
    }

    return res.json({
      message: 'Login successful.',
      token: createToken(user.id),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        doctor_id: user.doctor_id,
      },
    });
  } catch (error) {
    console.error('Login error:', error);

    return res.status(500).json({
      message: 'Something went wrong while logging in.',
    });
  }
}

async function getMe(req, res) {
  try {
    const result = await query(
      `SELECT id, name, email, role, doctor_id, created_at
       FROM users
       WHERE id = $1`,
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'User not found.',
      });
    }

    return res.json({
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Get user error:', error);

    return res.status(500).json({
      message: 'Something went wrong.',
    });
  }
}

module.exports = {
  register,
  login,
  getMe,
};