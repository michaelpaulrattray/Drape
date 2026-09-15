import {
  Info,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";

import type { AuditCategory } from "@shared/auditActionCategories";

// ── Severity ──────────────────────────────────────────────
export const SEVERITY_COLORS = {
  info: "bg-blue-50 text-blue-700 border-blue-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  critical: "bg-red-50 text-red-700 border-red-200",
} as const;

export const SEVERITY_ICONS = {
  info: Info,
  warning: AlertTriangle,
  critical: AlertCircle,
} as const;

// ── Category ──────────────────────────────────────────────
export const CATEGORY_COLORS = {
  billing: "bg-emerald-50 text-emerald-700",
  model: "bg-purple-50 text-purple-700",
  security: "bg-orange-50 text-orange-700",
  /* #938 — deliberately the quiet one. A change request is staff housekeeping,
     not an alarm, and giving it a warning colour would say the opposite of
     what the founder's ruling separated it from. */
  moderator: "bg-slate-100 text-slate-700",
  abuse: "bg-red-50 text-red-700",
  /* Typed against the bucket list so a sixth category cannot ship without a
     colour here — the completeness check is the compiler's, not a reviewer's. */
} as const satisfies Record<AuditCategory, string>;

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

