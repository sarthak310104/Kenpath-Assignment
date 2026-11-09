-- Database schema.
-- Idempotent: safe to run more than once (npm run db:init).
-- Business rules that can be enforced by the database are enforced here.
-- Rules that depend on "today" (no future dates) or on counting (max 4 per day,
-- with a friendly message) live in the service layer.

-- ---------------------------------------------------------------------------
-- Shared helper: keep updated_at current on every UPDATE
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash TEXT         NOT NULL,
  -- role and doctor_id are only used by the optional "doctor" bonus.
  -- Every account is a 'patient' with no doctor unless that bonus is built.
  role          TEXT         NOT NULL DEFAULT 'patient',
  doctor_id     INTEGER      REFERENCES users (id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT users_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT users_role_valid     CHECK (role IN ('patient', 'doctor')),
  CONSTRAINT users_not_own_doctor CHECK (doctor_id IS NULL OR doctor_id <> id)
);

-- Emails are unique regardless of letter case.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (lower(email));

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- readings
-- One row = one blood glucose reading for one user, on one date, in one slot.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS readings (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  reading_date DATE        NOT NULL,
  slot         TEXT        NOT NULL,
  value        INTEGER     NOT NULL,   -- mg/dl
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- The four allowed slots. Labels shown to users are mapped in the app:
  --   morning          -> Morning (fasting)
  --   after_breakfast  -> After breakfast
  --   after_lunch      -> After lunch
  --   after_dinner     -> After dinner
  CONSTRAINT readings_slot_valid  CHECK (slot IN ('morning', 'after_breakfast', 'after_lunch', 'after_dinner')),

  -- Whole number between 40 and 600 mg/dl (INTEGER already rules out decimals).
  CONSTRAINT readings_value_range CHECK (value BETWEEN 40 AND 600),

  -- Only one reading per slot per day, per user. Because there are exactly
  -- four slots, this also guarantees the "maximum 4 readings per day" rule.
  -- Its index (user_id, reading_date, slot) also serves every report query,
  -- which filter by user_id and a reading_date range.
  CONSTRAINT readings_user_date_slot_key UNIQUE (user_id, reading_date, slot)
);

DROP TRIGGER IF EXISTS readings_set_updated_at ON readings;
CREATE TRIGGER readings_set_updated_at
  BEFORE UPDATE ON readings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- pending_doctors
-- A doctor who signed up but has not been approved yet. There is no users row
-- until someone approves the code, so a pending doctor can't log in. On
-- approval the row moves into users (role 'doctor') and is deleted from here.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pending_doctors (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- 8 characters, 5 letters + 3 digits, made by the app (utils/doctorCode.js)
  code          TEXT         NOT NULL,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash TEXT         NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT pending_doctors_code_format CHECK (code ~ '^[A-Z0-9]{8}$'),
  CONSTRAINT pending_doctors_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS pending_doctors_code_key ON pending_doctors (code);
CREATE UNIQUE INDEX IF NOT EXISTS pending_doctors_email_lower_key ON pending_doctors (lower(email));