/**
 * Audit Logging System
 * 
 * Provides centralized audit logging for security-sensitive operations
 * with built-in abuse detection and owner notifications.
 * 
 * USAGE:
 * ```typescript
 * await logAuditEvent({
 *   userId: ctx.user.id,
 *   action: AUDIT_ACTIONS.SUBSCRIPTION_CREATED,
 *   resourceType: "subscription",
 *   resourceId: subscriptionId,
 *   metadata: { plan: "pro", interval: "monthly" },
 *   req: ctx.req,
 * });
 * ```
 */

import { getDb } from "./db";
import { auditLogs, AUDIT_ACTIONS, type AuditAction, type AuditLog } from "../drizzle/schema";
import { notifyOwner } from "./_core/notification";
import { eq, and, gte, desc } from "drizzle-orm";

export interface AuditEventOptions {
  /** User ID performing the action (null for system events) */
  userId?: number | null;
  /** The action being performed */
  action: AuditAction;
  /** Type of resource being affected */
  resourceType?: string;
  /** ID of the affected resource */
  resourceId?: string;
  /** Additional context data */
  metadata?: Record<string, unknown>;
  /** Severity level */
  severity?: "info" | "warning" | "critical";
  /** Request object for IP/user agent extraction */
  req?: {
    headers: Record<string, string | string[] | undefined>;
    ip?: string;
  };
}

/**
 * Extract client IP from request headers
 */
function getIpFromRequest(req?: AuditEventOptions["req"]): string | null {
  if (!req) return null;
  
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return ip.trim();
  }
  
  const realIp = req.headers["x-real-ip"];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }
  
  return req.ip || null;
}

/**
 * Extract user agent from request headers
 */
function getUserAgentFromRequest(req?: AuditEventOptions["req"]): string | null {
  if (!req) return null;
  const ua = req.headers["user-agent"];
  return Array.isArray(ua) ? ua[0] : ua || null;
}

/**
 * Log an audit event to the database
 */
export async function logAuditEvent(options: AuditEventOptions): Promise<void> {
  const {
    userId,
    action,
    resourceType,
    resourceId,
    metadata,
    severity = "info",
    req,
  } = options;

  try {
    const db = await getDb();
    if (!db) {
      console.warn("[AuditLog] Database not available");
      return;
    }
    
    await db.insert(auditLogs).values({
      userId: userId ?? null,
      action,
      resourceType: resourceType ?? null,
      resourceId: resourceId ?? null,
      metadata: metadata ?? null,
      severity,
      ipAddress: getIpFromRequest(req),
      userAgent: getUserAgentFromRequest(req),
    });

    // Check for abuse patterns after logging
    if (userId) {
      await checkAbusePatterns(userId, action);
    }
  } catch (error) {
    // Log errors but don't fail the main operation
    console.error("[AuditLog] Failed to log event:", error);
  }
}

// ============ Abuse Detection ============

interface AbusePattern {
  name: string;
  actions: AuditAction[];
  windowMinutes: number;
  threshold: number;
  severity: "warning" | "critical";
  description: string;
}

const ABUSE_PATTERNS: AbusePattern[] = [
  {
    name: "Credits Exploit Attempt",
    actions: [AUDIT_ACTIONS.INSUFFICIENT_CREDITS],
    windowMinutes: 5,
    threshold: 10,
    severity: "critical",
    description: "Multiple insufficient credits errors in short time - possible exploit attempt",
  },
  {
    name: "Rapid Model Deletion",
    actions: [AUDIT_ACTIONS.MODEL_DELETED],
    windowMinutes: 10,
    threshold: 5,
    severity: "warning",
    description: "Rapid model deletions detected - possible account compromise or abuse",
  },
  {
    name: "Billing Anomaly",
    actions: [
      AUDIT_ACTIONS.SUBSCRIPTION_CREATED,
      AUDIT_ACTIONS.SUBSCRIPTION_CANCELED,
      AUDIT_ACTIONS.SUBSCRIPTION_UPDATED,
    ],
    windowMinutes: 60,
    threshold: 5,
    severity: "critical",
    description: "Unusual billing activity pattern detected",
  },
  {
    name: "Rate Limit Abuse",
    actions: [AUDIT_ACTIONS.RATE_LIMIT_EXCEEDED],
    windowMinutes: 15,
    threshold: 20,
    severity: "warning",
    description: "Persistent rate limit violations - possible automated abuse",
  },
];

/**
 * Check for abuse patterns and notify owner if detected
 */
async function checkAbusePatterns(userId: number, currentAction: AuditAction): Promise<void> {
  for (const pattern of ABUSE_PATTERNS) {
    // Only check patterns relevant to the current action
    if (!pattern.actions.includes(currentAction)) {
      continue;
    }

    const windowStart = new Date(Date.now() - pattern.windowMinutes * 60 * 1000);

    try {
      // Count matching events in the time window
      const db = await getDb();
      if (!db) continue;
      
      const recentEvents = await db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.userId, userId),
            gte(auditLogs.createdAt, windowStart)
          )
        )
        .orderBy(desc(auditLogs.createdAt));

      // Filter to matching actions
      const matchingCount = recentEvents.filter((e: AuditLog) => 
        pattern.actions.includes(e.action as AuditAction)
      ).length;

      if (matchingCount >= pattern.threshold) {
        await handleAbuseDetection(userId, pattern, matchingCount);
      }
    } catch (error) {
      console.error(`[AbuseDetection] Error checking pattern ${pattern.name}:`, error);
    }
  }
}

/**
 * Handle detected abuse by logging and notifying owner
 */
async function handleAbuseDetection(
  userId: number,
  pattern: AbusePattern,
  eventCount: number
): Promise<void> {
  console.warn(`[AbuseDetection] Pattern "${pattern.name}" triggered for user ${userId}`);

  // Log the abuse detection event
  const db = await getDb();
  if (!db) return;
  
  await db.insert(auditLogs).values({
    userId,
    action: AUDIT_ACTIONS.ABUSE_DETECTED,
    resourceType: "abuse_pattern",
    resourceId: pattern.name.toLowerCase().replace(/\s+/g, "_"),
    metadata: {
      patternName: pattern.name,
      eventCount,
      threshold: pattern.threshold,
      windowMinutes: pattern.windowMinutes,
      description: pattern.description,
    },
    severity: pattern.severity,
  });

  // Notify owner for critical patterns
  if (pattern.severity === "critical") {
    try {
      await notifyOwner({
        title: `🚨 Security Alert: ${pattern.name}`,
        content: `
**Abuse Pattern Detected**

**User ID:** ${userId}
**Pattern:** ${pattern.name}
**Severity:** ${pattern.severity.toUpperCase()}

**Details:**
${pattern.description}

**Statistics:**
- Events detected: ${eventCount}
- Threshold: ${pattern.threshold}
- Time window: ${pattern.windowMinutes} minutes

**Recommended Actions:**
1. Review the user's recent activity in the audit logs
2. Consider temporarily suspending the account if abuse is confirmed
3. Investigate the source of the activity (IP addresses, user agents)

This is an automated security notification from FormaStudio.
        `.trim(),
      });
      console.log(`[AbuseDetection] Owner notified about ${pattern.name} for user ${userId}`);
    } catch (error) {
      console.error("[AbuseDetection] Failed to notify owner:", error);
    }
  }
}

// ============ Query Helpers ============

/**
 * Get recent audit logs for a user
 */
export async function getUserAuditLogs(
  userId: number,
  limit: number = 50
): Promise<AuditLog[]> {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.userId, userId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

/**
 * Get audit logs by action type
 */
export async function getAuditLogsByAction(
  action: AuditAction,
  limit: number = 100
): Promise<AuditLog[]> {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.action, action))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

/**
 * Get critical security events
 */
export async function getCriticalAuditLogs(
  limit: number = 100
): Promise<AuditLog[]> {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.severity, "critical"))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

// Re-export AUDIT_ACTIONS for convenience
export { AUDIT_ACTIONS };
