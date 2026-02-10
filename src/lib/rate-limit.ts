/**
 * Rate limiter with Redis support and in-memory fallback
 *
 * Uses Redis for distributed rate limiting across multiple instances.
 * Falls back to in-memory storage if Redis is not configured or unavailable.
 */

import { getRedisClient } from './redis';

// ============================================================================
// In-Memory Fallback Storage
// ============================================================================

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically (only used for in-memory fallback)
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of rateLimitStore.entries()) {
            if (entry.resetTime < now) {
                rateLimitStore.delete(key);
            }
        }
    }, 60000); // Clean up every minute
}

// ============================================================================
// Types and Configuration
// ============================================================================

interface RateLimitConfig {
    windowMs: number;  // Time window in milliseconds
    maxRequests: number;  // Max requests per window
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    source: 'redis' | 'memory';  // Indicates which storage was used
}

// Preset configurations for different route types
export const RATE_LIMITS = {
    // Strict limit for auth endpoints
    auth: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 10,
    },
    // Standard API limit
    api: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 60,
    },
    // Relaxed limit for dashboard pages
    dashboard: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 120,
    },
    // Webhook endpoints (more lenient for automated systems)
    webhook: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 200,
    },
};

// ============================================================================
// Redis-based Rate Limiting
// ============================================================================

/**
 * Check rate limit using Redis sliding window algorithm
 * Uses a simple counter with TTL for the window
 */
async function checkRateLimitRedis(
    identifier: string,
    config: RateLimitConfig
): Promise<RateLimitResult | null> {
    const redis = await getRedisClient();
    if (!redis) return null;

    const key = `ratelimit:${identifier}`;
    const windowSeconds = Math.ceil(config.windowMs / 1000);

    try {
        // Use Redis MULTI for atomic operations
        const pipeline = redis.pipeline();

        // Increment the counter
        pipeline.incr(key);
        // Set expiry only if key is new (won't reset existing TTL)
        pipeline.expire(key, windowSeconds, 'NX');
        // Get TTL for reset time calculation
        pipeline.ttl(key);

        const results = await pipeline.exec();

        if (!results) {
            return null;
        }

        const count = results[0]?.[1] as number || 0;
        const ttl = results[2]?.[1] as number || windowSeconds;

        const allowed = count <= config.maxRequests;
        const remaining = Math.max(0, config.maxRequests - count);
        const resetTime = Date.now() + (ttl * 1000);

        return {
            allowed,
            remaining,
            resetTime,
            source: 'redis',
        };
    } catch (err) {
        console.error('Redis rate limit error:', err);
        return null; // Fall back to in-memory
    }
}

// ============================================================================
// In-Memory Rate Limiting (Fallback)
// ============================================================================

/**
 * Check rate limit using in-memory storage
 */
function checkRateLimitMemory(
    identifier: string,
    config: RateLimitConfig
): RateLimitResult {
    const now = Date.now();
    const key = identifier;

    let entry = rateLimitStore.get(key);

    // Create new entry if doesn't exist or expired
    if (!entry || entry.resetTime < now) {
        entry = {
            count: 0,
            resetTime: now + config.windowMs,
        };
    }

    entry.count++;
    rateLimitStore.set(key, entry);

    const allowed = entry.count <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - entry.count);

    return {
        allowed,
        remaining,
        resetTime: entry.resetTime,
        source: 'memory',
    };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Check and update rate limit for a given identifier
 * Tries Redis first, falls back to in-memory if unavailable
 */
export async function checkRateLimitAsync(
    identifier: string,
    config: RateLimitConfig
): Promise<RateLimitResult> {
    // Try Redis first
    const redisResult = await checkRateLimitRedis(identifier, config);
    if (redisResult) {
        return redisResult;
    }

    // Fall back to in-memory
    return checkRateLimitMemory(identifier, config);
}

/**
 * Synchronous rate limit check (in-memory only)
 * Use this when you can't use async/await (e.g., in some middleware scenarios)
 *
 * @deprecated Prefer checkRateLimitAsync for Redis support
 */
export function checkRateLimit(
    identifier: string,
    config: RateLimitConfig
): RateLimitResult {
    return { ...checkRateLimitMemory(identifier, config), source: 'memory' };
}

/**
 * Get rate limit key from request (IP + path)
 */
export function getRateLimitKey(ip: string, path: string): string {
    return `${ip}:${path}`;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Clear rate limit for a specific identifier (useful for testing or manual reset)
 */
export async function clearRateLimit(identifier: string): Promise<void> {
    // Clear from memory
    rateLimitStore.delete(identifier);

    // Clear from Redis if available
    const redis = await getRedisClient();
    if (redis) {
        try {
            await redis.del(`ratelimit:${identifier}`);
        } catch (err) {
            console.error('Failed to clear Redis rate limit:', err);
        }
    }
}

/**
 * Get current rate limit status without incrementing
 */
export async function getRateLimitStatus(
    identifier: string,
    _config: RateLimitConfig
): Promise<{ count: number; resetTime: number; source: 'redis' | 'memory' } | null> {
    const redis = await getRedisClient();

    if (redis) {
        try {
            const key = `ratelimit:${identifier}`;
            const [count, ttl] = await Promise.all([
                redis.get(key),
                redis.ttl(key),
            ]);

            if (count !== null) {
                return {
                    count: parseInt(count, 10),
                    resetTime: Date.now() + (ttl * 1000),
                    source: 'redis',
                };
            }
        } catch (err) {
            console.error('Redis get status error:', err);
        }
    }

    // Check in-memory
    const entry = rateLimitStore.get(identifier);
    if (entry && entry.resetTime > Date.now()) {
        return {
            count: entry.count,
            resetTime: entry.resetTime,
            source: 'memory',
        };
    }

    return null;
}
