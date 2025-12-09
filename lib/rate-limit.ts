/*
  This implementation uses an in-memory store for simplicity.
  For production with multiple instances, we should use Redis/Upstash.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

class RateLimiter {
  private store: Map<string, RateLimitEntry>;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor() {
    this.store = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt < now) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Check if a request should be rate limited
   * @param identifier - Unique identifier (e.g., IP address)
   * @param limit - Maximum number of requests allowed
   * @param windowMs - Time window in milliseconds
   * @returns Rate limit result
   */
  async check(
    identifier: string,
    limit: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const key = `ratelimit:${identifier}`;

    let entry = this.store.get(key);

    if (!entry || entry.resetAt < now) {
      entry = {
        count: 0,
        resetAt: now + windowMs,
      };
      this.store.set(key, entry);
    }

    entry.count++;

    const remaining = Math.max(0, limit - entry.count);
    const success = entry.count <= limit;

    return {
      success,
      limit,
      remaining,
      reset: entry.resetAt,
    };
  }

  /**
   * Reset rate limit for a specific identifier
   */
  async reset(identifier: string): Promise<void> {
    const key = `ratelimit:${identifier}`;
    this.store.delete(key);
  }

  /**
   * Block an identifier for a specific duration
   */
  async block(identifier: string, durationMs: number): Promise<void> {
    const key = `ratelimit:${identifier}`;
    this.store.set(key, {
      count: 999999, // Set high count to block
      resetAt: Date.now() + durationMs,
    });
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
  LOGIN: {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  },
  LOGIN_STRICT: {
    limit: 5,
    windowMs: 60 * 60 * 1000,
  },
  SIGNUP: {
    limit: 3,
    windowMs: 60 * 60 * 1000,
  },
  PASSWORD_RESET: {
    limit: 3,
    windowMs: 60 * 60 * 1000,
  },
  EMAIL_RESEND: {
    limit: 3,
    windowMs: 15 * 60 * 1000, // 3 requests per 15 minutes
  },
} as const;

/**
 * Check rate limit for login attempts
 */
export async function checkLoginRateLimit(
  ip: string
): Promise<RateLimitResult> {
  return rateLimiter.check(ip, RATE_LIMITS.LOGIN.limit, RATE_LIMITS.LOGIN.windowMs);
}

/**
 * Check strict rate limit (used after multiple failures)
 */
export async function checkStrictRateLimit(
  ip: string
): Promise<RateLimitResult> {
  return rateLimiter.check(
    `strict:${ip}`,
    RATE_LIMITS.LOGIN_STRICT.limit,
    RATE_LIMITS.LOGIN_STRICT.windowMs
  );
}

/**
 * Block an IP address for a specific duration
 */
export async function blockIP(ip: string, durationMs: number): Promise<void> {
  return rateLimiter.block(ip, durationMs);
}

/**
 * Reset rate limit for an IP (e.g., after successful login)
 */
export async function resetRateLimit(ip: string): Promise<void> {
  return rateLimiter.reset(ip);
}

/**
 * Check rate limit for email resend requests
 */
export async function checkEmailResendRateLimit(
  identifier: string
): Promise<RateLimitResult> {
  return rateLimiter.check(
    `email_resend:${identifier}`,
    RATE_LIMITS.EMAIL_RESEND.limit,
    RATE_LIMITS.EMAIL_RESEND.windowMs
  );
}

/**
 * Extract IP address from request headers
 */
export function getClientIP(headers: Headers): string {
  // Try various headers that might contain the real IP
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    // x-forwarded-for may contain multiple IPs, take the first one
    return forwardedFor.split(",")[0].trim();
  }

  const realIP = headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  // Fallback to a default (not ideal, but prevents errors)
  return "unknown";
}

export { rateLimiter };
