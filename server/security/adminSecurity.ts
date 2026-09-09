/**
 * Admin Security Module
 * 
 * Provides additional security hardening for admin functionality:
 * 1. Admin Allowlist - Only specific users can be admins
 * 2. Admin Activity Alerts - Slack notifications for all admin actions
 * 3. Admin Action Confirmation - Re-authentication for sensitive actions
 * 4. Immutable Audit Log - Append-only critical log storage
 */

import crypto from "crypto";
import { SlackAlerts, sendAuditLogEntry } from "../slack/slackNotification";
import { logAuditEvent } from "../auditLog";
import { AUDIT_ACTIONS } from "../../drizzle/schema";

/**
 * ADMIN ALLOWLIST
 *
 * A second gate in front of the admin role: even someone whose row says
 * `admin` is refused unless they are on this list. An EMPTY list admits every
 * database admin, which is what production runs today (neither variable below
 * is set there — read at the Railway variables, 2026-09-09), so admin access
 * is role-only until somebody populates it.
 *
 * ⚠ THE LIST HOLDS STRINGS, AND ONLY STRINGS (#727). Its two entries come from
 * `process.env`, whose values are always strings, so there is no road by which
 * a number reaches it. It used to be typed `(number | string)[]`, documented as
 * *"user IDs (numbers) or emails (strings)"* with the worked example
 * `1, "admin@klieglabs.com", 2`, and it carried a matching
 * `ADMIN_ALLOWLIST.includes(userId)` branch that compared a NUMERIC id against
 * that list. `["42"].includes(42)` is `false`, so that branch could not fire in
 * any deployed configuration: with `OWNER_OPEN_ID="42"`, user 42 was refused by
 * id and admitted only by `openId`. The type, the docblock and the branch
 * together promised an id allowlist that did not exist — and the person it
 * would have failed is whoever populated the list with a numeric id, believed
 * they had allowlisted an admin, and got *"User is not on admin allowlist
 * despite having admin role"* pointing nowhere near the cause.
 *
 * The dead branch is gone and the type says what is true. Nothing about who is
 * admitted changed: the branch was proven unreachable by a sabotage that
 * deletes it and reddens no arm (a permanent control in
 * `server/security/adminSecurity.test.ts`). MAKING numeric ids work is the
 * other repair, and it is a WIDENING of who reaches the admin surface — the
 * founder's call, not a shift's.
 *
 * To allowlist an admin: set `OWNER_OPEN_ID` to their `openId`, or `OWNER_NAME`
 * to a value matching their `email`, and set their role to `admin`.
 */
const ADMIN_ALLOWLIST: string[] = [
  process.env.OWNER_OPEN_ID || null,
  process.env.OWNER_NAME || null,
].filter(Boolean) as string[];

/**
 * Check if a user is on the admin allowlist.
 *
 * ⚠ Takes no user id ON PURPOSE (#727) — an id is not a thing this list can
 * hold. A `userId: number` parameter sat here and was compared against the
 * list; it never matched, and its presence told every reader that ids were
 * checked. An ignored parameter on a security predicate is the same lie the
 * old type told, so it went with the branch rather than staying as a comment.
 */
export function isOnAdminAllowlist(email?: string, openId?: string): boolean {
  // If allowlist is empty, allow all database admins (backwards compatible)
  if (ADMIN_ALLOWLIST.length === 0) {
    return true;
  }

  // Check if openId is in allowlist (OWNER_OPEN_ID is a string, not a number)
  if (openId && ADMIN_ALLOWLIST.includes(openId)) {
    return true;
  }

  // Check if email is in allowlist
  if (email && ADMIN_ALLOWLIST.includes(email)) {
    return true;
  }

  return false;
}

/**
 * Validate admin access - checks both role AND allowlist
 */
export function validateAdminAccess(
  user: { id: number; role: string; email?: string; name?: string; openId?: string }
): { allowed: boolean; reason?: string } {
  // Check role first
  if (user.role !== "admin") {
    return { allowed: false, reason: "User does not have admin role" };
  }
  
  // Check allowlist
  if (!isOnAdminAllowlist(user.email, user.openId)) {
    return { 
      allowed: false, 
      reason: "User is not on admin allowlist despite having admin role" 
    };
  }
  
  return { allowed: true };
}

/**
 * SENSITIVE ADMIN ACTIONS
 * 
 * These actions require extra confirmation and generate warning-level alerts
 */
const SENSITIVE_ACTIONS = [
  "suspendUser",
  "adjustCredits",
  "blockIP",
  "deleteModel",
  "changePlan",
  "cancelSubscription",
];

/**
 * Check if an action is considered sensitive
 */
export function isSensitiveAction(action: string): boolean {
  return SENSITIVE_ACTIONS.includes(action);
}

/**
 * Log admin action and send Slack notification
 */
export async function logAdminAction(options: {
  adminId: number;
  adminName: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  const { adminId, adminName, action, targetType, targetId, details, ipAddress, userAgent } = options;
  
  // Log to audit system
  await logAuditEvent({
    userId: adminId,
    action: AUDIT_ACTIONS.ADMIN_ACTION,
    severity: isSensitiveAction(action) ? "warning" : "info",
    resourceType: targetType,
    resourceId: targetId,
    metadata: {
      adminAction: action,
      details,
      performedBy: adminName,
    },
    ipAddress,
    userAgent,
  });
  
  // Send Slack notification
  if (isSensitiveAction(action)) {
    await SlackAlerts.sensitiveAdminAction(
      adminName,
      adminId,
      action,
      targetType,
      targetId,
      details
    );
  } else {
    await SlackAlerts.adminAction(
      adminName,
      adminId,
      action,
      targetType,
      targetId,
      details
    );
  }
}

/**
 * Log unauthorized admin access attempt
 */
export async function logUnauthorizedAdminAccess(options: {
  userId: number;
  userName: string;
  attemptedAction: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  const { userId, userName, attemptedAction, ipAddress, userAgent } = options;
  
  // Log to audit system with critical severity
  await logAuditEvent({
    userId,
    action: AUDIT_ACTIONS.SECURITY_UNAUTHORIZED_ADMIN,
    severity: "critical",
    resourceType: "admin",
    resourceId: attemptedAction,
    metadata: {
      attemptedAction,
      userName,
      blocked: true,
    },
    ipAddress,
    userAgent,
  });
  
  // Send critical Slack alert
  await SlackAlerts.unauthorizedAdminAccess(
    userId,
    userName,
    attemptedAction,
    ipAddress
  );
}

/**
 * ADMIN ACTION CONFIRMATION
 * 
 * UI-only confirmation tokens have been replaced by Slack-based approval flow.
 * See server/slackApproval.ts for the out-of-band two-factor authorization system.
 * 
 * Sensitive actions now require approval via Slack before execution,
 * ensuring an attacker needs access to both the admin session AND the Slack workspace.
 */

/**
 * IMMUTABLE AUDIT LOG
 * 
 * Critical security events are written to a separate append-only log
 * that cannot be modified even with database access.
 * 
 * This uses a combination of:
 * 1. Hash chaining (each entry includes hash of previous entry)
 * 2. External backup via Slack (permanent record in Slack channel)
 */
interface ImmutableLogEntry {
  id: string;
  timestamp: number;
  previousHash: string;
  eventType: string;
  data: Record<string, unknown>;
  hash: string;
}

// In-memory chain for current session (also backed up to Slack)
const immutableLogChain: ImmutableLogEntry[] = [];
let lastHash = "GENESIS";

/**
 * Write to immutable audit log
 * 
 * This creates a hash-chained entry that:
 * 1. Is stored in memory with hash verification
 * 2. Is backed up to Slack as permanent record
 * 3. Is written to database audit_logs with chain hash
 */
export async function writeImmutableLog(
  eventType: string,
  data: Record<string, unknown>
): Promise<ImmutableLogEntry> {

  const entry: Omit<ImmutableLogEntry, "hash"> = {
    id: crypto.randomBytes(16).toString("hex"),
    timestamp: Date.now(),
    previousHash: lastHash,
    eventType,
    data,
  };
  
  // Compute hash of entry
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(entry))
    .digest("hex");
  
  const fullEntry: ImmutableLogEntry = { ...entry, hash };
  
  // Add to chain
  immutableLogChain.push(fullEntry);
  lastHash = hash;
  
  // Backup to #audit-log Slack channel as permanent record
  await sendAuditLogEntry({
    title: "🔒 Immutable Security Log",
    description: `Critical security event recorded with hash chain verification.`,
    fields: [
      { title: "Event Type", value: eventType, short: true },
      { title: "Entry ID", value: entry.id, short: true },
      { title: "Hash", value: hash.substring(0, 16) + "...", short: true },
      { title: "Previous Hash", value: entry.previousHash.substring(0, 16) + "...", short: true },
      { title: "Data", value: JSON.stringify(data).substring(0, 200), short: false },
    ],
  });
  
  // Also write to database audit log with hash for verification
  await logAuditEvent({
    userId: (data.adminId as number) || 0,
    action: AUDIT_ACTIONS.SECURITY_IMMUTABLE_LOG,
    severity: "info",
    resourceType: "immutable_log",
    resourceId: entry.id,
    metadata: {
      eventType,
      hash,
      previousHash: entry.previousHash,
      ...data,
    },
  });
  
  return fullEntry;
}


// sendAuditLogEntry routes through the centralized dispatcher for dedup
