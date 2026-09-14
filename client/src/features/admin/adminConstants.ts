import { staffDateTime } from "@/foundation/staffDate";

import {
  Info,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";

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
} as const;

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
 * `formatRelativeTime` below stayed: it is a different question (how long ago)
 * and it has one root's worth of consumers, which is under the promotion bar.
 */

export function getActionCategory(action: string): keyof typeof CATEGORY_COLORS | null {
  if (action.startsWith("subscription.") || action.startsWith("credits.")) return "billing";
  if (action.startsWith("model.")) return "model";
  if (action.startsWith("auth.") || action.startsWith("security.")) return "security";
  if (action.startsWith("moderator.")) return "moderator";
  if (action.startsWith("abuse.")) return "abuse";
  return null;
}

export function formatAction(action: string): string {
  return action
    .split(".")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" → ");
}

export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return staffDateTime(date);
}
