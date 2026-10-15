import IORedis from 'ioredis';
import env, { queueEnabled } from '../config/env.js';

let connection = null;

/**
 * BullMQ requires `maxRetriesPerRequest: null` so blocking commands are not
 * aborted mid-wait. Returns null when REDIS_URL is empty, which is the signal
 * for the inline driver to take over.
 */
export function getRedis() {
  if (!queueEnabled) return null;
  if (connection) return connection;

  connection = new IORedis(env.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => Math.min(times * 500, 5000),
  });

  connection.on('error', (error) => console.error('[redis] error:', error.message));
  connection.on('connect', () => console.log('[redis] connected'));

  return connection;
}

export async function pingRedis() {
  const redis = getRedis();
  if (!redis) return { enabled: false };
  try {
    await redis.ping();
    return { enabled: true, ok: true };
  } catch (error) {
    return { enabled: true, ok: false, error: error.message };
  }
}

export async function closeRedis() {
  if (connection) {
    await connection.quit().catch(() => {});
    connection = null;
  }
}

export { queueEnabled };
export default getRedis;
