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
import { eq, and, gte, lte, desc, inArray, count as countRows, type SQL } from "drizzle-orm";
import { createModuleLogger } from "./logging/logger";
const log = createModuleLogger("auditLog");

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
      log.warn("[AuditLog] Database not available");
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
    log.error({ err: error }, "[AuditLog] Failed to log event:");
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
      log.error({ err: error }, `[AbuseDetection] Error checking pattern ${pattern.name}:`);
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
  log.warn(`[AbuseDetection] Pattern "${pattern.name}" triggered for user ${userId}`);

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

  // The ABUSE_DETECTED row above IS the surface: it lands on the staff
  // audit log and, at warning/critical severity, on the admin overview's
  // alerts feed. The Slack alert and the Slack-only "owner notification"
  // that used to follow were retired with #800 — production never had a
  // webhook, so this row was always the only record anyone could read.
}

// ============ Query Helpers ============


// Re-export AUDIT_ACTIONS for convenience
export { AUDIT_ACTIONS };


// ============ Admin Dashboard Query Helpers ============

/*
  Action category mappings for filtering.

  EXPORTED for `server/auditLogCategoryAgreement.test.ts` (#939), which holds
  this list against the chip the panels draw. It is exported rather than
  re-read with a regex because a guard that parses the thing it guards shares
  the guarded file's blind spots — four Atlas collectors were found doing
  exactly that, and the rule from it is in CLAUDE.md: do not shape-match where
  a declaration exists.
*/
export const ACTION_CATEGORIES: Record<string, AuditAction[]> = {
  billing: [
    AUDIT_ACTIONS.SUBSCRIPTION_CREATED,
    AUDIT_ACTIONS.SUBSCRIPTION_CANCELED,
    AUDIT_ACTIONS.SUBSCRIPTION_UPDATED,
    AUDIT_ACTIONS.CREDITS_PURCHASED,
    AUDIT_ACTIONS.CREDITS_DEDUCTED,
    AUDIT_ACTIONS.CREDITS_REFUNDED,
    /*
      THE TWO MONEY ANOMALIES (#771). Same lesson as the login alarm below:
      without these lines the billing filter would drop the rows the moment a
      refund fails or an invoice is paid after its plan ended, and the only
      surface production has for them is this panel.
    */
    AUDIT_ACTIONS.STRIPE_REFUND_ISSUED,
    AUDIT_ACTIONS.STRIPE_REFUND_FAILED,
    AUDIT_ACTIONS.INVOICE_PAID_AFTER_PLAN_ENDED,
    /*
      #939. The panel already draws a "Billing" chip on this row — its
      `getActionCategory` sends every `credits.*` to billing — so the row
      claimed a category whose filter dropped it. The three siblings above it
      are already here; this is the missing line, not a new reading.
    */
    AUDIT_ACTIONS.CREDITS_ADDED,
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
    /*
      #939 — ELEVEN MORE OF THE SAME DEFECT THE ABUSE COMMENT BELOW DESCRIBES.
      The four lines above establish this bucket's reading: `auth.*` AND
      `security.*` are both security here, which is also exactly what the
      panel's own `getActionCategory` has always told staff. Every action
      below was drawing a red "Security" chip while the Security filter — and
      the Security CSV export (`routes/moderatorExports.ts`) — dropped it.
      Eight of the thirteen in #939 have a live writer, and all eight are in
      this bucket.

      `security.emergency_action` writes nothing today (the Slack buttons were
      retired in #800) and is here for the reason its schema comment gives:
      the historical rows are still in the table and still carry the label.
    */
    AUDIT_ACTIONS.LOGIN_BLOCKED_SUSPENDED,
    AUDIT_ACTIONS.LOGIN_BLOCKED_LOCKED,
    AUDIT_ACTIONS.ACCOUNT_LOCKOUT,
    AUDIT_ACTIONS.IP_BLOCKED_REQUEST,
    AUDIT_ACTIONS.EMERGENCY_ACTION_EXECUTED,
    AUDIT_ACTIONS.SECURITY_UNAUTHORIZED_ADMIN,
    AUDIT_ACTIONS.SECURITY_IMMUTABLE_LOG,
    AUDIT_ACTIONS.EMAIL_VERIFICATION_SENT,
    AUDIT_ACTIONS.EMAIL_VERIFICATION_RESENT,
    AUDIT_ACTIONS.EMAIL_VERIFIED,
    AUDIT_ACTIONS.EMAIL_VERIFICATION_FAILED,
  ],
  abuse: [
    AUDIT_ACTIONS.ABUSE_DETECTED,
    AUDIT_ACTIONS.ABUSE_PATTERN_CREDITS,
    AUDIT_ACTIONS.ABUSE_PATTERN_DELETION,
    AUDIT_ACTIONS.ABUSE_PATTERN_BILLING,
    /*
      THE SITE-WIDE LOGIN ALARM (founder ruling 2026-08-19, relayed fable-1018).
      Without this line the panel's own abuse filter would drop every row the
      alarm writes — the wire would exist, the row would exist, and staff would
      never see it. `getAbuseAlertsSummary` filters on this same list.
    */
    AUDIT_ACTIONS.ABUSE_GLOBAL_ATTACK,
    /*
      #939. The comment above was written about one action and was true of six.
      This is the sixth: the panel sends every `abuse.*` to the abuse chip, so
      the day something writes a credential-stuffing row it would have been
      dropped by the Abuse filter exactly as described.
    */
    AUDIT_ACTIONS.ABUSE_CREDENTIAL_STUFFING,
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

/*
  EVERY condition a staff member's filter choice means, as ONE statement.

  EXPORTED so `server/auditLogFilterSql.test.ts` can render the SQL this
  actually sends (invariant 5, *assert at the wire*) — and so the page query
  and the COUNT query behind the pager cannot drift into asking two different
  questions, which is working law 4 at the scale of two lines.

  ⚠ THE CATEGORY LINE IS THE #941 FIX AND IT BELONGS HERE, NOT AFTER THE
  FETCH. Until 2026-09-14 the category was applied in JavaScript to whichever
  rows the page happened to contain, so "Security" did not mean *the security
  rows* — it meant *whichever of the newest 20 rows were security rows*.
  Measured on the dev table the day it was fixed: 3,047 rows, 19 of them
  `auth.login`, and the Security filter returned 8 at a page size of 20 and 11
  at a page size of 100. **The answer changed with the page size**, no page
  size reached the login rows at all, and the CSV export
  (`routes/moderatorExports.ts`) shipped that same partial slice as a
  confident file.
*/
export function auditLogFilterConditions(
  options: Omit<FilteredAuditLogsOptions, "limit" | "offset">,
): SQL | undefined {
  const { severity, actionCategory, userId, startDate, endDate } = options;
  const conditions: SQL[] = [];

  if (severity) conditions.push(eq(auditLogs.severity, severity));
  if (userId) conditions.push(eq(auditLogs.userId, userId));
  if (startDate) conditions.push(gte(auditLogs.createdAt, startDate));
  if (endDate) conditions.push(lte(auditLogs.createdAt, endDate));

  /*
    An empty bucket would render `IN ()`, which MySQL rejects outright — so an
    unknown category is refused here by returning no rows rather than by
    silently dropping the filter and returning EVERY row, which is the failure
    direction that would look like the feature working.
  */
  if (actionCategory) {
    conditions.push(inArray(auditLogs.action, ACTION_CATEGORIES[actionCategory] ?? []));
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
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

  const { limit, offset } = options;
  const where = auditLogFilterConditions(options);

  const logs = await db
    .select()
    .from(auditLogs)
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  /*
    A REAL count of the matching rows. It used to be
    `offset + logs.length + (hasMore ? 1 : 0)` — a number computed from the
    page it was describing, so the footer read "Showing 1–8" of a total it had
    invented, and paging forward re-filtered a different slice. The pager can
    only stop lying if this counts the same population the page is drawn from,
    which is why both take the identical `where`.
  */
  const [counted] = await db
    .select({ value: countRows() })
    .from(auditLogs)
    .where(where);
  const total = counted?.value ?? 0;

  return { logs, total, hasMore: offset + logs.length < total };
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

  /*
    ⚠ THE LAW-7 SIBLING OF #941, AND IT WAS THE WORSE OF THE TWO. This read
    the newest 100 rows of the WHOLE table and then kept the abuse ones — with
    no `where` clause at all — so a site-wide credential-stuffing alarm could
    fire, land correctly in the abuse bucket, and still show up nowhere a
    person looks, purely because a hundred ordinary rows arrived after it. On
    the dev table `casting.refusal` is 2,927 of 3,047 rows, which is how fast
    a hundred rows arrive.

    That is precisely the failure the founder ruling above this bucket exists
    to prevent — *"the wire would exist, the row would exist, and staff would
    never see it"* — reached by a different road.

    The severity counts below are unchanged in meaning: they still describe
    the alerts being SHOWN. What changed is that the alerts being shown are
    now genuinely the newest abuse rows.
  */
  const abuseAlerts = await db
    .select()
    .from(auditLogs)
    .where(inArray(auditLogs.action, ACTION_CATEGORIES.abuse))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

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

  /*
    #941's third sibling, same class as the two above: a COUNT taken by
    fetching rows. This pulled up to 10,000 whole rows across the wire and
    returned their length, so the "Total entries" tile on both staff panels
    stopped counting at exactly 10,000 however large the table grew — a number
    that looks precise and silently stops moving. The row counts above
    (`bySeverity`, `byCategory`) are NOT in this class: they aggregate the
    complete 24-hour set, not a page of it.
  */
  const [countedAll] = await db.select({ value: countRows() }).from(auditLogs);
  const totalLogs = countedAll?.value ?? 0;

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
