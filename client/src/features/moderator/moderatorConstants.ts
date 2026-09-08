import { Info, AlertTriangle, AlertCircle } from "lucide-react";

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

export const CATEGORY_COLORS = {
  billing: "bg-emerald-50 text-emerald-700",
  model: "bg-purple-50 text-purple-700",
  security: "bg-orange-50 text-orange-700",
  abuse: "bg-red-50 text-red-700",
} as const;

export const PAGE_SIZE = 20;

// ── Utility Functions ──

export function formatDate(date: Date): string {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatFullDate(date: Date): string {
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function getActionCategory(action: string): keyof typeof CATEGORY_COLORS | null {
  if (action.startsWith("subscription.") || action.startsWith("credits.")) return "billing";
  if (action.startsWith("model.")) return "model";
  if (action.startsWith("auth.") || action.startsWith("security.")) return "security";
  if (action.startsWith("abuse.") || action.startsWith("moderator.")) return "abuse";
  return null;
}

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
