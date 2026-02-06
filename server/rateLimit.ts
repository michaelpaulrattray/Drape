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


// ============ Per-User Rate Limiting ============
// Protects against distributed attacks where same user attacks from multiple IPs

const userRateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup user rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(userRateLimitStore.entries());
  for (const [key, entry] of entries) {
    if (now - entry.windowStart > 60 * 60 * 1000) {
      userRateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Check per-user rate limit (regardless of IP)
 * Use this for authenticated endpoints to prevent distributed attacks
 */
export function checkUserRateLimit(
  userId: number,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetIn: number } {
  const key = `user:${config.keyPrefix || 'rl'}:${userId}`;
  const now = Date.now();
  
  const entry = userRateLimitStore.get(key);
  
  if (!entry || now - entry.windowStart >= config.windowMs) {
    userRateLimitStore.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs,
    };
  }
  
  if (entry.count >= config.maxRequests) {
    const resetIn = config.windowMs - (now - entry.windowStart);
    return {
      allowed: false,
      remaining: 0,
      resetIn,
    };
  }
  
  entry.count++;
  const resetIn = config.windowMs - (now - entry.windowStart);
  
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetIn,
  };
}

// ============ Global Attack Detection ============
// Detects system-wide attacks across all IPs

interface GlobalAttackWindow {
  failedLogins: number;
  windowStart: number;
  alertSent: boolean;
}

let globalAttackWindow: GlobalAttackWindow = {
  failedLogins: 0,
  windowStart: Date.now(),
  alertSent: false,
};

const GLOBAL_ATTACK_CONFIG = {
  windowMs: 5 * 60 * 1000,    // 5 minute window
  threshold: 50,              // 50 failed logins system-wide triggers alert
  criticalThreshold: 100,     // 100 triggers critical alert
};

/**
 * Record a failed login for global attack detection
 * Returns attack status for immediate response
 */
export function recordGlobalFailedLogin(): { 
  underAttack: boolean; 
  severity: 'none' | 'warning' | 'critical';
  failedCount: number;
} {
  const now = Date.now();
  
  // Reset window if expired
  if (now - globalAttackWindow.windowStart >= GLOBAL_ATTACK_CONFIG.windowMs) {
    globalAttackWindow = {
      failedLogins: 1,
      windowStart: now,
      alertSent: false,
    };
    return { underAttack: false, severity: 'none', failedCount: 1 };
  }
  
  globalAttackWindow.failedLogins++;
  
  const count = globalAttackWindow.failedLogins;
  
  if (count >= GLOBAL_ATTACK_CONFIG.criticalThreshold) {
    return { underAttack: true, severity: 'critical', failedCount: count };
  }
  
  if (count >= GLOBAL_ATTACK_CONFIG.threshold) {
    return { underAttack: true, severity: 'warning', failedCount: count };
  }
  
  return { underAttack: false, severity: 'none', failedCount: count };
}

/**
 * Check if system is currently under attack
 */
export function isSystemUnderAttack(): { 
  underAttack: boolean; 
  severity: 'none' | 'warning' | 'critical';
  failedCount: number;
  windowRemaining: number;
} {
  const now = Date.now();
  
  // Check if window is still active
  if (now - globalAttackWindow.windowStart >= GLOBAL_ATTACK_CONFIG.windowMs) {
    return { 
      underAttack: false, 
      severity: 'none', 
      failedCount: 0,
      windowRemaining: 0,
    };
  }
  
  const count = globalAttackWindow.failedLogins;
  const windowRemaining = GLOBAL_ATTACK_CONFIG.windowMs - (now - globalAttackWindow.windowStart);
  
  if (count >= GLOBAL_ATTACK_CONFIG.criticalThreshold) {
    return { underAttack: true, severity: 'critical', failedCount: count, windowRemaining };
  }
  
  if (count >= GLOBAL_ATTACK_CONFIG.threshold) {
    return { underAttack: true, severity: 'warning', failedCount: count, windowRemaining };
  }
  
  return { underAttack: false, severity: 'none', failedCount: count, windowRemaining };
}

/**
 * Mark that an alert has been sent for the current attack window
 */
export function markGlobalAttackAlertSent(): void {
  globalAttackWindow.alertSent = true;
}

/**
 * Check if alert needs to be sent for current attack
 */
export function shouldSendGlobalAttackAlert(): boolean {
  return !globalAttackWindow.alertSent && 
         globalAttackWindow.failedLogins >= GLOBAL_ATTACK_CONFIG.threshold;
}

// Per-user rate limits for authenticated endpoints
export const USER_RATE_LIMITS = {
  // API calls per user per minute
  apiGeneral: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 60,          // 60 requests per minute per user
    keyPrefix: 'api',
  },
  // Generation requests per user
  userGeneration: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 20,          // 20 generations per minute per user
    keyPrefix: 'user_gen',
  },
  // Billing actions per user
  userBilling: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 5,           // 5 billing actions per minute per user
    keyPrefix: 'user_billing',
  },
} as const;
