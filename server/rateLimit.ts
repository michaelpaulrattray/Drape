/**
 * Rate Limiting Middleware
 * 
 * Provides in-memory rate limiting to prevent abuse of public endpoints.
 * Uses a sliding window algorithm with automatic cleanup.
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// In-memory store for rate limiting (per IP/identifier)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(rateLimitStore.entries());
  for (const [key, entry] of entries) {
    // Remove entries older than 1 hour
    if (now - entry.windowStart > 60 * 60 * 1000) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  keyPrefix?: string;    // Prefix for the rate limit key
}

/**
 * Check if a request should be rate limited
 * @returns { allowed: boolean, remaining: number, resetIn: number }
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetIn: number } {
  const key = `${config.keyPrefix || 'rl'}:${identifier}`;
  const now = Date.now();
  
  const entry = rateLimitStore.get(key);
  
  if (!entry || now - entry.windowStart >= config.windowMs) {
    // New window
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs,
    };
  }
  
  // Within existing window
  if (entry.count >= config.maxRequests) {
    const resetIn = config.windowMs - (now - entry.windowStart);
    return {
      allowed: false,
      remaining: 0,
      resetIn,
    };
  }
  
  // Increment count
  entry.count++;
  const resetIn = config.windowMs - (now - entry.windowStart);
  
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetIn,
  };
}

/**
 * Get client IP from request, handling proxies
 */
export function getClientIp(req: { headers: Record<string, string | string[] | undefined>; ip?: string }): string {
  // Check X-Forwarded-For header (common for proxies/load balancers)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ip.trim();
  }
  
  // Check X-Real-IP header
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }
  
  // Fall back to req.ip
  return req.ip || 'unknown';
}

// Pre-configured rate limit configs
export const RATE_LIMITS = {
  // Public signup endpoints - generous but prevents spam bots
  newsletter: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,           // 5 signups per hour per IP
    keyPrefix: 'newsletter',
  },
  waitlist: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,           // 5 signups per hour per IP
    keyPrefix: 'waitlist',
  },
  // Generation endpoints - per user, stricter
  generation: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 10,          // 10 generations per minute
    keyPrefix: 'gen',
  },
  // Model creation - per user
  modelCreate: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 5,           // 5 model creations per minute
    keyPrefix: 'model',
  },
  // Billing/checkout - strict to prevent abuse
  billing: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 3,           // 3 checkout attempts per minute
    keyPrefix: 'billing',
  },
} as const;

/**
 * Create a rate limit error message
 */
export function rateLimitError(resetIn: number): string {
  const seconds = Math.ceil(resetIn / 1000);
  if (seconds < 60) {
    return `Too many requests. Please try again in ${seconds} seconds.`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `Too many requests. Please try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`;
}
