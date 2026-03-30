import { NextRequest } from "next/server";
import { RateLimitError } from "./errors";
import { getRedisConnection } from "./jobs/queue";
import { logger } from "./logger";

const log = logger.child({ module: "rate-limit" });

type RedisClient = import("ioredis").default;
let _redis: RedisClient | null = null;
let _redisUnavailable = false;

async function getRedis(): Promise<RedisClient | null> {
  if (_redisUnavailable) return null;
  if (!_redis) {
    const { default: Redis } = await import("ioredis");
    const baseConfig = getRedisConnection();
    _redis = new Redis({
      ...baseConfig,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      commandTimeout: 2000,
      retryStrategy(times) {
        if (times > 1) {
          _redisUnavailable = true;
          return null;
        }
        return 200;
      },
    });
    _redis.on("error", () => {
      _redisUnavailable = true;
    });
  }
  return _redis;
}

interface RateLimitOptions {
  /** Sliding-window size in milliseconds */
  windowMs: number;
  /** Maximum requests allowed per window */
  max: number;
}

/**
 * Sliding-window rate limiter backed by Redis.
 * Throws `RateLimitError` (429) when the limit is exceeded.
 * Falls back to allowing the request if Redis is unreachable.
 */
export async function rateLimit(
  key: string,
  options: RateLimitOptions
): Promise<void> {
  try {
    const client = await getRedis();
    if (!client) return;

    const windowKey = `rl:${key}:${Math.floor(Date.now() / options.windowMs)}`;

    const count = await client.incr(windowKey);
    if (count === 1) {
      await client.pexpire(windowKey, options.windowMs);
    }

    if (count > options.max) {
      const resetMs = options.windowMs - (Date.now() % options.windowMs);
      throw new RateLimitError(resetMs);
    }
  } catch (err) {
    if (err instanceof RateLimitError) throw err;
    log.warn({ err }, "Rate limit Redis unavailable — allowing request");
  }
}

/** Best-effort extraction of client IP from proxy headers. */
export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
