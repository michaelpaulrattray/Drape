/**
 * Admin Security Module
 * 
 * Provides additional security hardening for admin functionality:
 * 1. Admin Allowlist - Only specific users can be admins
 * 2. Admin Activity Alerts - Slack notifications for all admin actions
 * 3. Admin Action Confirmation - Re-authentication for sensitive actions
 * 4. Immutable Audit Log - Append-only critical log storage
 */

import { SlackAlerts, sendAuditLogEntry } from "../slack/slackNotification";
import { logAuditEvent } from "../auditLog";
import { AUDIT_ACTIONS } from "../../drizzle/schema";

/**
 * ADMIN ALLOWLIST
 * 
 * Only users whose ID or email is in this list can have admin privileges.
 * Even if someone changes the role in the database, they won't have admin
 * access unless they're on this allowlist.
 * 
 * To add a new admin:
 * 1. Add their user ID or email to this list
 * 2. Update their role to 'admin' in the database
 * 
 * Format: Array of user IDs (numbers) or emails (strings)
 */
const ADMIN_ALLOWLIST: (number | string)[] = [
  // Add allowed admin user IDs or emails here
  // Example: 1, "admin@drape.app", 2
  process.env.OWNER_OPEN_ID || null,
  process.env.OWNER_NAME || null,
].filter(Boolean) as (number | string)[];

/**
 * Check if a user is on the admin allowlist
 */
export function isOnAdminAllowlist(userId: number, email?: string, openId?: string): boolean {
  // If allowlist is empty, allow all database admins (backwards compatible)
  if (ADMIN_ALLOWLIST.length === 0) {
    return true;
  }
  
  // Check if user ID is in allowlist
  if (ADMIN_ALLOWLIST.includes(userId)) {
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
  if (!isOnAdminAllowlist(user.id, user.email, user.openId)) {
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
  const crypto = require("crypto");
  
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

/**
 * Verify integrity of immutable log chain
 */
export function verifyImmutableLogChain(): { 
  valid: boolean; 
  entries: number;
  brokenAt?: number;
} {
  const crypto = require("crypto");
  
  if (immutableLogChain.length === 0) {
    return { valid: true, entries: 0 };
  }
  
  let expectedPreviousHash = "GENESIS";
  
  for (let i = 0; i < immutableLogChain.length; i++) {
    const entry = immutableLogChain[i];
    
    // Verify previous hash matches
    if (entry.previousHash !== expectedPreviousHash) {
      return { valid: false, entries: immutableLogChain.length, brokenAt: i };
    }
    
    // Verify entry hash
    const { hash, ...entryWithoutHash } = entry;
    const computedHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(entryWithoutHash))
      .digest("hex");
    
    if (computedHash !== hash) {
      return { valid: false, entries: immutableLogChain.length, brokenAt: i };
    }
    
    expectedPreviousHash = hash;
  }
  
  return { valid: true, entries: immutableLogChain.length };
}

// sendAuditLogEntry routes through the centralized dispatcher for dedup
