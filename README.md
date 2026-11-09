# Sweety - Blood Glucose Tracker

A small web app where a diabetes patient records up to 4 blood glucose readings a day and looks at daily, month-to-date and previous-month reports. Approved doctors can log in and view the reports of the patients who chose them.

Stack: Node.js + Express, PostgreSQL, React (Vite). Redis is optional.

## Features

- Sign up and log in (bcrypt-hashed passwords, JWT auth)
- Add, view, edit and delete readings (4 slots a day, value in mg/dl, history is paginated)
- Validation with clear error messages, on both the API and the forms
- Daily, month-to-date and previous-month reports (highest, lowest, average, count)
- Line chart of the month so far, one line per time slot
- Doctor role: a patient picks their doctor, and the doctor gets a read-only view of that patient's reports
- Doctor approval: doctors can't just sign up. They wait until the person running the server approves them
- Optional Redis cache for reports, cleared whenever a reading is added, edited or deleted

## Project structure

```
sweety/
  server/   Express API, PostgreSQL access, seed script, tests
  client/   React frontend
  docker-compose.yml   PostgreSQL and Redis for local development
```

## Prerequisites

- Node.js 18+
- Docker (easiest way to get PostgreSQL and Redis), or your own PostgreSQL 14+
- Git

## Installation

```bash
git clone https://github.com/sarthak310104/Kenpath-Assignment.git
cd Kenpath-Assignment

cd server && npm install
cd ../client && npm install
```

## Database setup

Start PostgreSQL and Redis:

```bash
docker compose up -d
```

PostgreSQL is on host port **5433** and Redis on **6380**. These are not the default ports on purpose, so they do not clash with a Postgres or Redis you already have installed.

Then copy the env file and create the tables:

```bash
cd server
cp .env.example .env
npm run db:init
```

`db:init` creates the database if it does not exist and applies `server/db/schema.sql`. It is safe to run more than once, so run it again after pulling new changes. `npm run db:reset` drops the tables and starts again.

There are two tables for accounts: `users` (patients and approved doctors, told apart by `role`) and `pending_doctors` (doctors waiting for approval). The other table is `readings`.

Not using Docker? Install PostgreSQL yourself, point `DATABASE_URL` at it in `server/.env`, and either remove `REDIS_URL` or leave it empty.

## Environment variables

Copy `server/.env.example` to `server/.env`.

| Variable | What it does |
|---|---|
| `PORT` | API port (default 5000) |
| `CLIENT_ORIGIN` | Frontend URL allowed by CORS (default http://localhost:5173) |
| `DATABASE_URL` | Main database |
| `TEST_DATABASE_URL` | Separate database used by the tests |
| `JWT_SECRET` | Change this to a long random string |
| `JWT_EXPIRES_IN` | Token lifetime (default 7d) |
| `REDIS_URL` | Optional. Leave empty to run without the cache |
| `ADMIN_API_KEY` | Key for the doctor approval endpoints. Leave empty to switch them off. Change it before deploying anywhere |

The client talks to `http://localhost:5000/api` by default.

## Running the app

### Server

```bash
cd server
npm run dev     # or: npm start
```

### Client

```bash
cd client
npm run dev
```

Open http://localhost:5173.

### Seed demo data

```bash
cd server
npm run db:seed
```

This adds five weeks of readings for a demo patient, plus a demo doctor who has that patient assigned. Running it again is safe, it does not create duplicates. The demo doctor is created directly, so they do not need approval.

| Role | Email | Password |
|---|---|---|
| Patient | demo@sweety.com | Demo@12345 |
| Doctor | doctor@sweety.com | Doctor@12345 |

### Tests

```bash
cd server
npm run db:init:test   # creates (or updates) the test database
npm test

cd ../client
npm test
```

The server tests run against the real test database. The Redis cache tests use an in-memory fake, so you do not need Redis running to test.

## How doctor approval works

Anyone could tick "I'm a doctor" on the signup form, so a doctor account has to be approved by whoever runs the server.

1. A doctor signs up. The server saves them in `pending_doctors` with a random 8 character code (5 letters and 3 digits, for example `K7QMA2XD`). No account is created yet and no token is given. The signup page says "We are currently verifying your profile, check back later."
2. If they try to log in before approval, they see the same message.
3. The person running the server sees the request in the server log and through the list endpoint, checks the doctor is real, then approves the code.
4. Approval moves the doctor into `users` with the role `doctor` and deletes the pending row. They can now log in with the email and password they signed up with.

Both admin endpoints need the `X-Admin-Key` header to match `ADMIN_API_KEY` in `server/.env`. Without it they return 401, and with no key configured they return 503.

```bash
# who is waiting?
curl -H "X-Admin-Key: change-me-admin-key" http://localhost:5000/api/admin/doctors/pending

# approve one
curl -X POST http://localhost:5000/api/admin/doctors/approve \
  -H "X-Admin-Key: change-me-admin-key" \
  -H "Content-Type: application/json" \
  -d '{"code":"K7QMA2XD"}'
```

Patients are not affected. They sign up and log in straight away.

## API overview

All routes need `Authorization: Bearer <token>`, except register, login and the admin routes (which use `X-Admin-Key`).

| Method | Route | What it does |
|---|---|---|
| POST | `/api/auth/register` | Create an account. Patients get a token. With `role: "doctor"` the request is saved as pending and the response is 202 with no token |
| POST | `/api/auth/login` | Log in, returns a token. A pending doctor gets 403 with the "verifying" message |
| GET | `/api/auth/me` | Current user |
| GET | `/api/readings?page=&limit=` | Your readings, newest first |
| POST | `/api/readings` | Add a reading |
| GET / PUT / DELETE | `/api/readings/:id` | Read, edit or delete one reading |
| GET | `/api/reports/daily?date=YYYY-MM-DD` | Daily report |
| GET | `/api/reports/month-to-date?date=YYYY-MM-DD` | Month to date, up to the given day |
| GET | `/api/reports/previous-month?date=YYYY-MM-DD` | The full month before the given day |
| GET | `/api/users/doctors` | List doctors |
| PUT | `/api/users/me/doctor` | Choose (or clear) your doctor |
| GET | `/api/doctor/patients` | Doctor only: your patients |
| GET | `/api/doctor/patients/:id/reports/:kind` | Doctor only: a patient's report (`daily`, `month-to-date` or `previous-month`) |
| GET | `/api/admin/doctors/pending` | Admin key: doctors waiting for approval, with their codes |
| POST | `/api/admin/doctors/approve` | Admin key: approve the doctor with the given `code` |

`date` defaults to today when left out. Report responses include the period they cover, and the end of that period is exclusive.

Reading rules: value between 40 and 600, one reading per slot per day, at most 4 a day, no dates in the future. Slots are `morning`, `after_breakfast`, `after_lunch` and `after_dinner`.

## Notes

### Assumptions

- "Today" is the server's local date. The browser also uses its own local date for defaults, so the two are expected to be in the same timezone.
- The 4 readings a day are the 4 named slots, so a day can hold at most one reading per slot. Adding a 5th reading gives "You can add only 4 readings per day."
- A patient chooses their own doctor, which stands in for consent. A doctor only ever sees patients who picked them. Asking for any other patient returns 404, not 403, so ids are not leaked.
- A doctor's role is read from the database on each request, not from the token.
- Doctor verification is manual and happens outside the app. The server owner decides who is a real doctor, then approves their code. The code is only a reference for that request, the doctor never sees it.
- Redis is a nice-to-have. If it is missing or goes down, the API keeps working and just skips the cache (it logs one warning).
- Reports are cached for 15 minutes per user and date range, and any change to that user's readings clears them.

### What I would improve with more time

- Approval is done with curl and a shared admin key. A real version would have an admin login and a small admin screen, a way to reject a request, and an email to the doctor when they are approved.
- When a token expires the user stays on the page and sees an error. It should send them back to the login screen.
- A non-numeric reading id (like `/api/readings/abc`) returns 500. It should return 404.
- Send the user's timezone with each request instead of assuming the server and browser agree.
- The cache has a small window where a read that overlaps a write can store an old value. It fixes itself when the 15 minute TTL ends, but versioned keys would close it.
- Rate limiting on login, refresh tokens, and API docs (OpenAPI).
- Browser tests for the main flows, and a bigger doctor view (search, high/low alerts).