const Redis = require('ioredis');

// Report cache. Reports are the slowest queries, so their results are kept
// in Redis and thrown away whenever one of the user's readings changes.
//
// Redis is optional: with no REDIS_URL (or if Redis is down) every function
// here quietly does nothing and the app just reads from Postgres.

const TTL_SECONDS = 15 * 60;

let client = null;
let warned = false;

function warnOnce(error) {
  if (warned) return;
  warned = true;
  console.warn('Redis cache not available, carrying on without it:', error.message);
}

function connect() {
  // Off while testing (a test can plug in its own client) and when REDIS_URL is empty.
  if (process.env.NODE_ENV === 'test' || !process.env.REDIS_URL) return;

  client = new Redis(process.env.REDIS_URL, {
    lazyConnect: true,
    enableOfflineQueue: false, // fail straight away while disconnected instead of queueing
    maxRetriesPerRequest: 1,
    retryStrategy: (attempt) => Math.min(attempt * 1000, 10000),
  });

  client.on('error', warnOnce);
  client.on('ready', () => {
    warned = false;
    console.log('Redis cache connected.');
  });

  client.connect().catch(warnOnce);
}

connect();

// One set per user remembers which report keys exist, so they can all be
// deleted together without scanning the whole database.
function keyListFor(userId) {
  return `reports:keys:${userId}`;
}

async function getReport(key) {
  if (!client) return null;

  try {
    const text = await client.get(key);
    return text ? JSON.parse(text) : null;
  } catch (error) {
    warnOnce(error);
    return null;
  }
}

async function saveReport(userId, key, report) {
  if (!client) return;

  try {
    await client.set(key, JSON.stringify(report), 'EX', TTL_SECONDS);
    await client.sadd(keyListFor(userId), key);
    await client.expire(keyListFor(userId), TTL_SECONDS);
  } catch (error) {
    warnOnce(error);
  }
}

// Call this after a reading is added, edited or deleted.
async function clearReports(userId) {
  if (!client) return;

  try {
    const keys = await client.smembers(keyListFor(userId));

    if (keys.length > 0) {
      await client.del(...keys);
    }

    await client.del(keyListFor(userId));
  } catch (error) {
    warnOnce(error);
  }
}

// Only for tests: swap in a fake client, or null to switch caching off.
function setClient(fakeClient) {
  client = fakeClient;
  warned = false;
}

// For scripts that should exit when they are done (the seed script).
async function close() {
  if (!client) return;

  try {
    await client.quit();
  } catch (error) {
    // not connected, so stop it from retrying in the background
    client.disconnect();
  }
}

module.exports = { getReport, saveReport, clearReports, setClient, close };