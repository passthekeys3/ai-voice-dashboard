// Use dynamic import to avoid loading ioredis in Edge runtime
type RedisClient = import('ioredis').default;

let redis: RedisClient | null = null;
let connectionAttempted = false;
let connectionFailed = false;
let connectionFailedAt = 0; // Timestamp of last failure
const RETRY_AFTER_MS = 60_000; // Retry connection after 60 seconds
let redisModule: typeof import('ioredis') | null = null;

/**
 * Get Redis client instance (singleton)
 * Returns null if Redis is not configured, connection failed, or running in Edge runtime
 */
export async function getRedisClient(): Promise<RedisClient | null> {
  // If connection previously failed, retry after RETRY_AFTER_MS
  if (connectionFailed) {
    if (Date.now() - connectionFailedAt < RETRY_AFTER_MS) {
      return null;
    }
    // Enough time has passed — reset and retry
    connectionFailed = false;
    connectionAttempted = false;
    redis = null;
    console.log('Redis retry: attempting reconnection after cooldown');
  }

  // If no Redis URL configured, return null
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return null;
  }

  // Create client if not exists
  if (!redis && !connectionAttempted) {
    connectionAttempted = true;

    try {
      // Dynamic import to avoid Edge runtime issues
      if (!redisModule) {
        redisModule = await import('ioredis');
      }
      const Redis = redisModule.default;

      redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          // Stop retrying after 3 attempts
          if (times > 3) {
            connectionFailed = true;
            connectionFailedAt = Date.now();
            console.warn('Redis connection failed after 3 attempts, falling back to in-memory rate limiting');
            return null;
          }
          // Exponential backoff: 200ms, 400ms, 800ms
          return Math.min(times * 200, 2000);
        },
        // Connection timeout
        connectTimeout: 5000,
        // Don't block on connection - allow operations to fail gracefully
        enableOfflineQueue: false,
        // TLS support for production Redis services
        tls: redisUrl.startsWith('rediss://') ? {} : undefined,
      });

      redis.on('error', (err) => {
        console.error('Redis error:', err.message);
        // Don't mark as failed on transient errors, just log them
      });

      redis.on('connect', () => {
        console.log('Redis connected successfully');
        connectionFailed = false;
      });

      redis.on('close', () => {
        console.log('Redis connection closed');
      });

    } catch (err) {
      console.error('Failed to create Redis client:', err);
      connectionFailed = true;
      connectionFailedAt = Date.now();
      redis = null;
    }
  }

  return redis;
}

/**
 * Check if Redis is available and connected
 */
export async function isRedisAvailable(): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) return false;

  try {
    await client.ping();
    return true;
  } catch {
    return false;
  }
}

/**
 * Close Redis connection (for cleanup)
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    connectionAttempted = false;
    connectionFailed = false;
  }
}
