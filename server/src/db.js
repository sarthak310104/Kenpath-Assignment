const { Pool, types } = require('pg');

// Return DATE columns as plain 'YYYY-MM-DD' strings. By default node-postgres
// converts them to JS Date objects in the server's timezone, which can shift
// the day by one. Strings keep the date exactly as stored.
types.setTypeParser(types.builtins.DATE, (value) => value);

// COUNT(*) returns BIGINT, which node-postgres gives back as a string.
// Counts here are tiny, so parse them to normal numbers.
types.setTypeParser(types.builtins.INT8, (value) => parseInt(value, 10));

const connectionString =
  process.env.NODE_ENV === 'test'
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

const pool = new Pool({ connectionString });

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};