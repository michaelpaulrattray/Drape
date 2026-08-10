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

export const TRUSTED_PROXY_HOPS = 1;

export function configureTrustedProxy(app: {
  set(setting: "trust proxy", value: number): unknown;
}): void {
  app.set("trust proxy", TRUSTED_PROXY_HOPS);
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
 * Get the client IP only from Express. `configureTrustedProxy` makes Express
 * trust exactly Railway's final proxy hop; raw forwarding headers are never
 * accepted as authority here.
 */
export function getClientIp(req: { ip?: string }): string {
  return req.ip?.trim() || "unknown";
}

// Pre-configured rate limit configs
export const RATE_LIMITS = {
  // Free Gemini endpoints (suggestions, enhance, reconcile, etc.)
  // No credit cost, but still consume API quota
  geminiAssist: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 30,           // 30 requests per minute per user
    keyPrefix: 'gemini_assist',
  },
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
  /*
    THREE CASTING BUCKETS, SPLIT BY WHO IS ASKING — and the split is the fix
    for a real refusal, not a tidy-up.

    2026-08-10, production, user 1: six 429s in one burst. Five were the
    sheet's own `getSession` poll; the sixth was `castingV2.selectVariant` —
    the founder's CLICK to change which version of a face he was looking at,
    refused with "Too many requests. Please try again in 14 seconds." He was
    not rendering. He was browsing, and the app refused him because it was
    busy talking to itself.

    One bucket held all eight casting procedures, so a background poller
    running at a fixed machine cadence could spend the budget a human action
    needed. **A human action must never queue behind a poller**, so the
    buckets are separated by intent and never by module:

      castingPoll   what the CLIENT asks on a timer, with no user present
      castingRead   what a PERSON's navigation asks for, on demand
      castingSheet  what a PERSON does — every mutation

    The caps were deliberately NOT raised to fix this. A cap raised to outrun
    a poller is a number waiting to be outrun again; the poller's own cadence
    is gated instead (see `CastingSheet.tsx` — a quiet sheet polls slowly).
  */
  // Casting V2 sheet MUTATIONS (keep/discard/undo/selectVariant). Generous,
  // because these are one-tap card actions a real user fires in bursts — the
  // limit exists so a loop cannot hammer the database, not to pace human
  // hands (plan §J).
  castingSheet: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 120,
    keyPrefix: 'casting_sheet',
  },
  /*
    THE TIMER'S OWN BUDGET, and the arithmetic is stated rather than asserted.

    Two pollers run at the 2.5s cadence — the session and the viewed roll —
    which is 24 requests a minute each, 48 for one active tab. This used to
    claim "headroom for a second tab" and it never had any: two tabs mid-roll
    is 96 against 60. The claim was wrong for as long as it was written, and
    it was the comment nobody re-derived.

    60 stands because the CADENCE is what changed: both pollers now go quiet
    when nothing is arriving, so a sheet being read rather than filled costs
    ~2/min, and only a genuinely active roll approaches this number. If this
    cap is ever reached again the poller is the thing to look at, not the cap.
  */
  castingPoll: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 60,
    keyPrefix: 'casting_poll',
  },
  /*
    READS A PERSON ASKED FOR — opening a face, switching version, the roster,
    the kept panel. Human-paced but several per action (one tap can invalidate
    three queries), so it is sized like the mutations rather than like the
    timer, and it is separate from BOTH so a read storm cannot refuse a keep
    and a poller cannot refuse a read.
  */
  castingRead: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 120,
    keyPrefix: 'casting_read',
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
