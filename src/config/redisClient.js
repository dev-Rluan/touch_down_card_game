const { createClient } = require('redis');

function buildRedisUrlFromEnv() {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }

  const host = process.env.REDIS_HOST || '127.0.0.1';
  const port = process.env.REDIS_PORT || '6379';
  const db = process.env.REDIS_DB || '0';
  const username = process.env.REDIS_USERNAME || '';
  const password = process.env.REDIS_PASSWORD || '';
  const forceTls = process.env.REDIS_TLS === 'true';
  const protocol = process.env.REDIS_PROTOCOL || (forceTls ? 'rediss' : 'redis');

  let auth = '';
  if (username || password) {
    const encodedUser = username ? encodeURIComponent(username) : '';
    const encodedPass = password ? encodeURIComponent(password) : '';
    if (encodedUser && encodedPass) {
      auth = `${encodedUser}:${encodedPass}@`;
    } else if (encodedPass && !encodedUser) {
      auth = `:${encodedPass}@`;
    } else {
      auth = `${encodedUser}@`;
    }
  }

  return `${protocol}://${auth}${host}:${port}/${db}`;
}

const redisUrl = buildRedisUrlFromEnv();
const useTls = (process.env.REDIS_TLS === 'true') || redisUrl.startsWith('rediss://');

const clientOptions = { url: redisUrl };
if (useTls) {
  clientOptions.socket = {
    tls: true,
    rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED === 'false' ? false : true
  };
}

const client = createClient(clientOptions);
let connectPromise = null;

client.on('error', (err) => {
  console.error('[Redis] Client error', err);
});

async function ensureRedisConnection() {
  if (client.isOpen) {
    return client;
  }

  if (!connectPromise) {
    connectPromise = client.connect().catch((err) => {
      connectPromise = null;
      throw err;
    });
  }

  await connectPromise;
  return client;
}

module.exports = {
  ensureRedisConnection,
  redisClient: client
};
