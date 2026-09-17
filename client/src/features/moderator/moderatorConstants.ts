/**
 * Shared constants, types, and utility functions for the Moderator Dashboard.
 */

// ── Audit Log Types ──

export interface AuditLog {
  id: number;
  userId: number | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  severity: "info" | "warning" | "critical";
  createdAt: Date;
}

// ── Visual Constants ──

export const PAGE_SIZE = 20;

// ── Utility Functions ──

/*
 * The date formatters that lived here — `formatDate` and `formatFullDate` —
 * are now `staffDateTime` and `staffFullDateTime` in `@/foundation/staffDate`
 * (#902). This file's copies were byte-for-byte the admin file's, which is why
 * #900 had to make one identical change twice; the module docblock there
 * carries the 24-hour ruling and the promotion's reasoning.
 */

/**
 * THE CHIP IS DERIVED, NOT RE-IMPLEMENTED (#940).
 *
 * This was a prefix rule — `action.startsWith("credits.")` and four more —
 * written out identically in this file and in the other console's. Two lists
 * describing one thing, and both drifted from the server bucket list that
 * actually filters: #939 found thirteen rows wearing a chip their own filter
 * dropped, and #940 the mirror, three refund rows the Billing filter finds and
 * the prefix rule labelled with nothing.
 *
 * It reads `ACTION_CATEGORIES` now, which is the list the filter uses, so the
 * chip and the dropdown cannot disagree again. The reasoning and the one
 * behaviour change are in the shared module's docblock.
 */
export { getActionCategory } from "@shared/auditActionCategories";

export function formatAction(action: string): string {
  return action
    .split(".")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" → ");
}

// ── Change Request Types ──

/**
 * Re-exported from the one declaration (#679) rather than spelled out again.
 * This union was a hand-typed copy of the same nine keys; it agreed with the
 * shared list when it was written, which is exactly what the copies that had
 * drifted also did.
 */
import type { ChangeRequestType } from "@shared/changeRequestLabels";

export type { ChangeRequestType };

export type ChangeRequestPriority = "low" | "normal" | "high" | "urgent";

export interface OpenChangeRequestOptions {
  type?: ChangeRequestType;
  targetUserId?: string;
  targetUserName?: string;
  relatedAuditLogId?: number;
  ipAddress?: string;
  stripeSessionId?: string;
  // No money fields here on purpose (#418): a refund request names which
  // charge, and the server derives the amount and credits from Stripe and
  // the customer's own ledger.
}
