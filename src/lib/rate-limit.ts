/**
 * In-memory sliding-window rate limiter for API routes.
 *
 * Works well on Vercel serverless — warm function instances share the Map,
 * catching rapid-fire abuse from the same IP. Cold starts reset the window,
 * which is acceptable: the alternative (Upstash Redis) adds a dependency
 * and latency on every request.
 *
 * Usage:
 *   const limiter = createRateLimiter({ maxRequests: 10, windowMs: 60_000 });
 *   // In your route handler:
 *   const ip = getClientIp(req);
 *   const limited = limiter.check(ip);
 *   if (limited) return limited; // returns a 429 NextResponse
 */

import { NextRequest, NextResponse } from 'next/server';

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimiterConfig {
  /** Max requests allowed within the window. */
  maxRequests: number;
  /** Time window in milliseconds. */
  windowMs: number;
}

interface RateLimiter {
  /** Returns a 429 NextResponse if rate-limited, or null if allowed. */
  check(key: string): NextResponse | null;
}

const DEFAULT_CONFIGS = {
  /** Auth-sensitive routes: 5 requests per minute */
  auth: { maxRequests: 5, windowMs: 60_000 },
  /** User-creation routes: 10 requests per minute */
  create: { maxRequests: 10, windowMs: 60_000 },
  /** General API routes: 30 requests per minute */
  standard: { maxRequests: 30, windowMs: 60_000 },
  /** Read-heavy routes: 60 requests per minute */
  read: { maxRequests: 60, windowMs: 60_000 },
} as const;

/**
 * Create a rate limiter instance with its own isolated store.
 */
function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  const store = new Map<string, RateLimitEntry>();

  // Periodic cleanup to prevent memory growth (every 5 minutes)
  let lastCleanup = Date.now();
  const CLEANUP_INTERVAL = 5 * 60_000;

  function cleanup() {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL) return;
    lastCleanup = now;

    const cutoff = now - config.windowMs;
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter(t => t > cutoff);
      if (entry.timestamps.length === 0) store.delete(key);
    }
  }

  return {
    check(key: string): NextResponse | null {
      cleanup();

      const now = Date.now();
      const cutoff = now - config.windowMs;

      let entry = store.get(key);
      if (!entry) {
        entry = { timestamps: [] };
        store.set(key, entry);
      }

      // Remove timestamps outside the window
      entry.timestamps = entry.timestamps.filter(t => t > cutoff);

      if (entry.timestamps.length >= config.maxRequests) {
        const retryAfterMs = entry.timestamps[0] + config.windowMs - now;
        const retryAfterSec = Math.ceil(retryAfterMs / 1000);

        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          {
            status: 429,
            headers: {
              'Retry-After': String(retryAfterSec),
              'X-RateLimit-Limit': String(config.maxRequests),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Math.ceil((entry.timestamps[0] + config.windowMs) / 1000)),
            },
          },
        );
      }

      // Allow the request
      entry.timestamps.push(now);

      return null;
    },
  };
}

/**
 * Extract client IP from a Next.js request.
 * Vercel sets x-forwarded-for; falls back to x-real-ip.
 */
function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

// ---- Pre-built limiter instances ----
// Use globalThis to survive module re-evaluation in Next.js dev mode
// (same pattern as Prisma/Supabase client singletons).
// In production (Vercel serverless), each warm instance gets its own set.

interface RateLimiters {
  auth: RateLimiter;
  create: RateLimiter;
  standard: RateLimiter;
  read: RateLimiter;
}

const globalForLimiters = globalThis as typeof globalThis & {
  _rateLimiters?: RateLimiters;
};

if (!globalForLimiters._rateLimiters) {
  globalForLimiters._rateLimiters = {
    auth: createRateLimiter(DEFAULT_CONFIGS.auth),
    create: createRateLimiter(DEFAULT_CONFIGS.create),
    standard: createRateLimiter(DEFAULT_CONFIGS.standard),
    read: createRateLimiter(DEFAULT_CONFIGS.read),
  };
}

const limiters = globalForLimiters._rateLimiters;

/**
 * Apply rate limiting to a request. Returns a 429 response if limited, null if allowed.
 *
 * @param req - The incoming request
 * @param tier - Which rate limit tier to apply
 *
 * @example
 *   const limited = applyRateLimit(req, 'auth');
 *   if (limited) return limited;
 */
export function applyRateLimit(
  req: NextRequest,
  tier: 'auth' | 'create' | 'standard' | 'read' = 'standard',
): NextResponse | null {
  const ip = getClientIp(req);

  switch (tier) {
    case 'auth':
      return limiters.auth.check(ip);
    case 'create':
      return limiters.create.check(ip);
    case 'read':
      return limiters.read.check(ip);
    case 'standard':
    default:
      return limiters.standard.check(ip);
  }
}

export { createRateLimiter, getClientIp, DEFAULT_CONFIGS };
export type { RateLimiterConfig, RateLimiter };
