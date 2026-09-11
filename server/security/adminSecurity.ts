/**
 * Admin Security Module
 * 
 * Provides additional security hardening for admin functionality:
 * 1. Admin Allowlist - Only specific users can be admins
 * 2. Admin Activity Audit - every admin action writes an audit row, read on
 *    the staff audit-log surfaces (severity from `isSensitiveAction`)
 * 3. Immutable Audit Log - hash-chained critical log storage
 */

import crypto from "crypto";
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
 * Validate admin access - checks both role AND allowlist.
 *
 * TWO fields decide the answer and they are the only two read here: `role`,
 * then `email`/`openId` through `isOnAdminAllowlist`.
 *
 * ⚠ IT NO LONGER TAKES A `name` (#733, the law-7 sibling of #727). Every
 * admin request supplied one and no branch had ever read it. That is the same
 * shape #727 removed one function along: an ignored input on a security
 * predicate tells the next reader it is checked, and here it did so beside a
 * genuine trap — the allowlist's two entries are `OWNER_OPEN_ID` and
 * `OWNER_NAME`, and the one called `OWNER_NAME` is compared against the user's
 * EMAIL, so it only ever admits anybody when it holds an email address. A
 * `name` sitting unread in this signature was the wrong hint in exactly the
 * place someone populating that variable would read it.
 *
 * ⚠ `id` IS ALSO READ BY NO BRANCH, AND IT STAYS ON PURPOSE — the exception
 * is stated here rather than left to be rediscovered as a third instance of
 * the same class. It is the subject of a live tripwire: the arm named *"an id
 * that matches the allowlist entry does not admit"* drives this function with
 * an id equal to an allowlist entry, and goes red if an id road is ever added
 * quietly. That widening is the founder's call, not a shift's. Removing the
 * parameter would delete the only door through which a test can pose the
 * question at all, which is a control dying to a correct-looking change — the
 * path-three death CLAUDE.md's law 7 is about. So it is kept, and its reason
 * is written down where the signature is read.
 */
export function validateAdminAccess(
  user: { id: number; role: string; email?: string; openId?: string }
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
 * Log an admin action to the audit system. Sensitive actions get `warning`
 * severity, which puts them on the admin overview's alerts feed.
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
}

/**
 * ADMIN ACTION CONFIRMATION — there is none beyond the panel (#800).
 *
 * The Slack-based approval flow this section used to point at was retired
 * 2026-09-11: it never ran in production (no webhook was ever configured, so
 * it self-approved) and it was already on CLAUDE.md's "currently not
 * enforced" list. The admin panel's explicit review step, plus these audit
 * and immutable-log writes, is the control. An out-of-band second factor for
 * sensitive admin actions would be a NEW control and a founder decision.
 */

/**
 * IMMUTABLE AUDIT LOG
 * 
 * Critical security events are written to a separate append-only log
 * that cannot be modified even with database access.
 * 
 * This uses hash chaining (each entry includes the hash of the previous
 * entry) plus a database audit row carrying the hash. ⚠ The chain is
 * IN-MEMORY and resets on every deploy, and its former "external backup"
 * (a Slack channel production never had) is retired with #800 — so there is
 * currently NO tamper evidence, which CLAUDE.md's "currently not enforced"
 * list says under its own name.
 */
interface ImmutableLogEntry {
  id: string;
  timestamp: number;
  previousHash: string;
  eventType: string;
  data: Record<string, unknown>;
  hash: string;
}

// In-memory chain for current session (resets on deploy — see above)
const immutableLogChain: ImmutableLogEntry[] = [];
let lastHash = "GENESIS";

/**
 * Write to immutable audit log
 * 
 * This creates a hash-chained entry that:
 * 1. Is stored in memory with hash verification
 * 2. Is written to database audit_logs with chain hash
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
  
  // Write to database audit log with hash for verification
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

