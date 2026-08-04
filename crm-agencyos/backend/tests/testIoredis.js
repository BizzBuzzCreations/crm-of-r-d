// backend/src/testIoredis.js
const Redis = require('ioredis');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const host = process.env.REDIS_HOST || '127.0.0.1';
const port = parseInt(process.env.REDIS_PORT || '6379', 10);

console.log(`Connecting directly to Redis at ${host}:${port}...`);

const redis = new Redis({
  host,
  port,
  maxRetriesPerRequest: 1,
  connectTimeout: 5000
});

redis.on('connect', () => {
  console.log('⚡ Redis event: connect');
});

redis.on('ready', async () => {
  console.log('✅ Redis event: ready');
  try {
    const res = await redis.ping();
    console.log('PING Response:', res);
  } catch (err) {
    console.error('Ping failed:', err.message);
  } finally {
    redis.disconnect();
    process.exit(0);
  }
});

redis.on('error', (err) => {
  console.error('❌ Redis event: error', err.message);
  redis.disconnect();
  process.exit(1);
});

redis.on('close', () => {
  console.log('🔌 Redis event: close');
});
