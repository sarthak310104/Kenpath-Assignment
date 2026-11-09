// Creates the database if it does not exist, then applies db/schema.sql.
//
//   npm run db:init         -> uses DATABASE_URL
//   npm run db:init:test    -> uses TEST_DATABASE_URL
//   npm run db:reset        -> DROPS the tables first, then re-applies the schema
//
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const args = process.argv.slice(2);
const useTestDb = args.includes('--test');
const reset = args.includes('--reset');

const envName = useTestDb ? 'TEST_DATABASE_URL' : 'DATABASE_URL';
const connectionString = process.env[envName];

async function ensureDatabaseExists(url) {
  const target = new URL(url);
  const dbName = decodeURIComponent(target.pathname.slice(1));

  // Connect to the default "postgres" database to check for / create ours.
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );
    if (rowCount === 0) {
      await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
      console.log(`Created database "${dbName}".`);
    }
  } finally {
    await client.end();
  }
}

async function main() {
  if (!connectionString) {
    throw new Error(`${envName} is not set. Copy .env.example to .env and fill it in.`);
  }
  if (reset && process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to reset the database when NODE_ENV=production.');
  }

  await ensureDatabaseExists(connectionString);

  const client = new Client({ connectionString });
  await client.connect();
  try {
    if (reset) {
      await client.query('DROP TABLE IF EXISTS readings, users CASCADE');
      console.log('Dropped existing tables.');
    }
    const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
    await client.query(schema);
    console.log(`Schema applied (${envName}).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});