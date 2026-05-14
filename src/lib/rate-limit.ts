/**
 * Simple in-memory rate limiter for Next.js API routes.
 * In production, replace with Redis-based rate limiting.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

export interface RateLimitOptions {
  windowMs?: number;   // Time window in milliseconds
  maxRequests?: number; // Max requests per window
}

const DEFAULT_WINDOW = 60 * 1000; // 1 minute
const DEFAULT_MAX = 60; // 60 requests per minute

/**
 * Check if a request from this IP/key should be allowed.
 * Returns { allowed, remaining, resetAt }.
 */
export function rateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): { allowed: boolean; remaining: number; resetAt: number } {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW;
  const maxRequests = options.maxRequests ?? DEFAULT_MAX;
  const now = Date.now();

  const entry = store.get(identifier);

  if (!entry || now > entry.resetAt) {
    // New window
    const newEntry: RateLimitEntry = { count: 1, resetAt: now + windowMs };
    store.set(identifier, newEntry);
    return { allowed: true, remaining: maxRequests - 1, resetAt: newEntry.resetAt };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

/**
 * Clean up expired entries periodically to prevent memory leaks.
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, 60 * 1000); // Clean every minute
