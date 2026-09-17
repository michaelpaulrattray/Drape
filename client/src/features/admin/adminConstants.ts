// ── Types ─────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────
export const PAGE_SIZE = 20;

/*
 * The date formatters that lived here — `formatDate` and `formatFullDate` —
 * are now `staffDateTime` and `staffFullDateTime` in `@/foundation/staffDate`
 * (#902), together with the moderator file's byte-identical pair. The module
 * docblock there carries the 24-hour ruling and the promotion's reasoning.
 *
 * A third, `formatRelativeTime`, stayed behind at that promotion on the
 * reasoning that it asked a different question (how long ago) and had one
 * root's worth of consumers. It had NONE — the consumers belonged to the
 * same-named function in `ChangeRequestConstants.tsx`, which is live and
 * stays. It is deleted here (#932), and the two names are worth keeping apart
 * in the mind: a `grep` for `formatRelativeTime` still finds the other one.
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

