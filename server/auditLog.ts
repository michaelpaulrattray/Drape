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
  /** Direct IP address (alternative to req) */
  ipAddress?: string | null;
  /** Direct user agent (alternative to req) */
  userAgent?: string | null;
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
    ipAddress: directIpAddress,
    userAgent: directUserAgent,
  } = options;

  try {
    const db = await getDb();
    if (!db) {
      console.warn("[AuditLog] Database not available");
      return;
    }
    
    // Use direct values if provided, otherwise extract from request
    const ipAddress = directIpAddress ?? getIpFromRequest(req);
    const userAgent = directUserAgent ?? getUserAgentFromRequest(req);
    
    await db.insert(auditLogs).values({
      userId: userId ?? null,
      action,
      resourceType: resourceType ?? null,
      resourceId: resourceId ?? null,
      metadata: metadata ?? null,
      severity,
      ipAddress,
      userAgent,
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

  // Get user info for notifications
  const { getUserById } = await import("./db");
  const user = await getUserById(userId);
  const userName = user?.name || `User ${userId}`;
  
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

  // Send Slack notification with emergency action buttons
  try {
    const { SlackAlerts } = await import("./slack/slackNotification");
    
    if (pattern.name === "Credits Exploit Attempt") {
      await SlackAlerts.creditsExploit(userId, userName, eventCount);
    } else if (pattern.name === "Rapid Model Deletion") {
      await SlackAlerts.rapidDeletion(userId, userName, eventCount);
    } else if (pattern.name === "Billing Anomaly") {
      await SlackAlerts.billingAnomaly(userId, userName, pattern.name, pattern.description);
    } else {
      // Generic alert for other patterns
      const { sendSlackAlert } = await import("./slack/slackNotification");
      await sendSlackAlert({
        title: `Security Alert: ${pattern.name}`,
        description: pattern.description,
        severity: pattern.severity,
        fields: [
          { title: "User", value: userName, short: true },
          { title: "User ID", value: String(userId), short: true },
          { title: "Events", value: String(eventCount), short: true },
          { title: "Threshold", value: String(pattern.threshold), short: true },
        ],
        userId,
        userName,
        alertContext: {
          patternName: pattern.name,
          eventCount,
        },
      });
    }
  } catch (error) {
    console.error("[AbuseDetection] Failed to send Slack alert:", error);
  }

  // Also notify owner via in-app notification for critical patterns
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

This is an automated security notification from Drape.
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


// ============ Admin Dashboard Query Helpers ============

// Action category mappings for filtering
const ACTION_CATEGORIES: Record<string, AuditAction[]> = {
  billing: [
    AUDIT_ACTIONS.SUBSCRIPTION_CREATED,
    AUDIT_ACTIONS.SUBSCRIPTION_CANCELED,
    AUDIT_ACTIONS.SUBSCRIPTION_UPDATED,
    AUDIT_ACTIONS.CREDITS_PURCHASED,
    AUDIT_ACTIONS.CREDITS_DEDUCTED,
    AUDIT_ACTIONS.CREDITS_REFUNDED,
  ],
  model: [
    AUDIT_ACTIONS.MODEL_CREATED,
    AUDIT_ACTIONS.MODEL_DELETED,
    AUDIT_ACTIONS.MODEL_MINTED,
  ],
  security: [
    AUDIT_ACTIONS.LOGIN_SUCCESS,
    AUDIT_ACTIONS.LOGIN_FAILED,
    AUDIT_ACTIONS.RATE_LIMIT_EXCEEDED,
    AUDIT_ACTIONS.INSUFFICIENT_CREDITS,
  ],
  abuse: [
    AUDIT_ACTIONS.ABUSE_DETECTED,
    AUDIT_ACTIONS.ABUSE_PATTERN_CREDITS,
    AUDIT_ACTIONS.ABUSE_PATTERN_DELETION,
    AUDIT_ACTIONS.ABUSE_PATTERN_BILLING,
  ],
};

export interface FilteredAuditLogsOptions {
  limit: number;
  offset: number;
  severity?: "info" | "warning" | "critical";
  actionCategory?: "billing" | "model" | "security" | "abuse";
  userId?: number;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Get filtered and paginated audit logs for admin dashboard
 */
export async function getFilteredAuditLogs(options: FilteredAuditLogsOptions): Promise<{
  logs: AuditLog[];
  total: number;
  hasMore: boolean;
}> {
  const db = await getDb();
  if (!db) return { logs: [], total: 0, hasMore: false };

  const { limit, offset, severity, actionCategory, userId, startDate, endDate } = options;

  // Build conditions array
  const conditions: ReturnType<typeof eq>[] = [];

  if (severity) {
    conditions.push(eq(auditLogs.severity, severity));
  }

  if (userId) {
    conditions.push(eq(auditLogs.userId, userId));
  }

  if (startDate) {
    conditions.push(gte(auditLogs.createdAt, startDate));
  }

  if (endDate) {
    const { lte } = await import("drizzle-orm");
    conditions.push(lte(auditLogs.createdAt, endDate));
  }

  // Get logs with filters
  let query = db.select().from(auditLogs);
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  let logs = await query.orderBy(desc(auditLogs.createdAt)).limit(limit + 1).offset(offset);

  // Filter by action category if specified (done in JS since it's an array match)
  if (actionCategory && ACTION_CATEGORIES[actionCategory]) {
    const categoryActions = ACTION_CATEGORIES[actionCategory];
    logs = logs.filter((log: AuditLog) => categoryActions.includes(log.action as AuditAction));
  }

  // Check if there are more results
  const hasMore = logs.length > limit;
  if (hasMore) {
    logs = logs.slice(0, limit);
  }

  // Get total count (simplified - just return current batch info)
  const total = offset + logs.length + (hasMore ? 1 : 0);

  return { logs, total, hasMore };
}

/**
 * Get abuse alerts summary for admin dashboard
 */
export async function getAbuseAlertsSummary(limit: number = 10): Promise<{
  alerts: AuditLog[];
  criticalCount: number;
  warningCount: number;
  recentPatterns: { pattern: string; count: number }[];
}> {
  const db = await getDb();
  if (!db) return { alerts: [], criticalCount: 0, warningCount: 0, recentPatterns: [] };

  // Get recent abuse-related events
  const abuseActions = ACTION_CATEGORIES.abuse;
  const alerts = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);

  // Filter to abuse events
  const abuseAlerts = alerts.filter((log: AuditLog) => 
    abuseActions.includes(log.action as AuditAction)
  ).slice(0, limit);

  // Count by severity
  const criticalCount = abuseAlerts.filter((a: AuditLog) => a.severity === "critical").length;
  const warningCount = abuseAlerts.filter((a: AuditLog) => a.severity === "warning").length;

  // Count by pattern (from metadata)
  const patternCounts = new Map<string, number>();
  for (const alert of abuseAlerts) {
    const metadata = alert.metadata as Record<string, unknown> | null;
    const patternName = metadata?.patternName as string || alert.resourceId || "unknown";
    patternCounts.set(patternName, (patternCounts.get(patternName) || 0) + 1);
  }

  const recentPatterns = Array.from(patternCounts.entries())
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return { alerts: abuseAlerts, criticalCount, warningCount, recentPatterns };
}

/**
 * Get audit statistics for admin dashboard
 */
export async function getAuditStatistics(): Promise<{
  totalLogs: number;
  last24Hours: number;
  bySeverity: { severity: string; count: number }[];
  byCategory: { category: string; count: number }[];
}> {
  const db = await getDb();
  if (!db) return { totalLogs: 0, last24Hours: 0, bySeverity: [], byCategory: [] };

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Get recent logs for statistics
  const recentLogs = await db
    .select()
    .from(auditLogs)
    .where(gte(auditLogs.createdAt, oneDayAgo))
    .orderBy(desc(auditLogs.createdAt));

  const last24Hours = recentLogs.length;

  // Count by severity
  const severityCounts = new Map<string, number>();
  for (const log of recentLogs) {
    severityCounts.set(log.severity, (severityCounts.get(log.severity) || 0) + 1);
  }
  const bySeverity = Array.from(severityCounts.entries())
    .map(([severity, count]) => ({ severity, count }));

  // Count by category
  const categoryCounts = new Map<string, number>();
  for (const log of recentLogs) {
    for (const [category, actions] of Object.entries(ACTION_CATEGORIES)) {
      if (actions.includes(log.action as AuditAction)) {
        categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
        break;
      }
    }
  }
  const byCategory = Array.from(categoryCounts.entries())
    .map(([category, count]) => ({ category, count }));

  // Get total count (approximate)
  const allLogs = await db.select().from(auditLogs).limit(10000);
  const totalLogs = allLogs.length;

  return { totalLogs, last24Hours, bySeverity, byCategory };
}

/**
 * Get single audit log by ID
 */
export async function getAuditLogById(id: number): Promise<AuditLog | null> {
  const db = await getDb();
  if (!db) return null;

  const results = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.id, id))
    .limit(1);

  return results[0] || null;
}
