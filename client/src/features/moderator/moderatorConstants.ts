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
  info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
} as const;

export const SEVERITY_ICONS = {
  info: Info,
  warning: AlertTriangle,
  critical: AlertCircle,
} as const;

export const CATEGORY_COLORS = {
  billing: "bg-emerald-500/10 text-emerald-400",
  model: "bg-purple-500/10 text-purple-400",
  security: "bg-orange-500/10 text-orange-400",
  abuse: "bg-red-500/10 text-red-400",
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

export type ChangeRequestType =
  | "refund_credits"
  | "add_credits"
  | "flag_account"
  | "note_incident"
  | "suspend_user"
  | "unsuspend_user"
  | "block_ip"
  | "stripe_refund"
  | "other";

export type ChangeRequestPriority = "low" | "normal" | "high" | "urgent";

export interface OpenChangeRequestOptions {
  type?: ChangeRequestType;
  targetUserId?: string;
  targetUserName?: string;
  relatedAuditLogId?: number;
  ipAddress?: string;
  stripeSessionId?: string;
  originalAmountCents?: number;
  originalCredits?: number;
}
