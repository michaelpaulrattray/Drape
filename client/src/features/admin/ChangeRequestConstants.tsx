import {
  Coins,
  Flag,
  FileText,
  Ban,
  UserCheck,
  Globe,
  HelpCircle,
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  Timer,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─── Type Config ─────────────────────────────────────────────────────────────

export const TYPE_CONFIG: Record<string, { label: string; icon: typeof Coins; color: string }> = {
  refund_credits: { label: "Refund Credits", icon: Coins, color: "text-amber-400" },
  add_credits: { label: "Add Credits", icon: Coins, color: "text-emerald-400" },
  flag_account: { label: "Flag Account", icon: Flag, color: "text-orange-400" },
  note_incident: { label: "Note Incident", icon: FileText, color: "text-blue-400" },
  suspend_user: { label: "Suspend User", icon: Ban, color: "text-red-400" },
  unsuspend_user: { label: "Unsuspend User", icon: UserCheck, color: "text-green-400" },
  block_ip: { label: "Block IP", icon: Globe, color: "text-red-400" },
  stripe_refund: { label: "Stripe Refund", icon: CreditCard, color: "text-violet-400" },
  other: { label: "Other", icon: HelpCircle, color: "text-gray-400" },
};

export const STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  pending: { label: "Pending", className: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: Clock },
  approved: { label: "Approved", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle },
  denied: { label: "Denied", className: "bg-red-500/10 text-red-400 border-red-500/20", icon: XCircle },
  cancelled: { label: "Cancelled", className: "bg-gray-500/10 text-gray-400 border-gray-500/20", icon: XCircle },
  expired: { label: "Expired", className: "bg-gray-500/10 text-gray-400 border-gray-500/20", icon: Clock },
  pending_execution: { label: "Awaiting Slack", className: "bg-purple-500/10 text-purple-400 border-purple-500/20", icon: Timer },
};

export const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
  normal: { label: "Normal", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  high: { label: "High", className: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  urgent: { label: "Urgent", className: "bg-red-500/10 text-red-400 border-red-500/20" },
};

export const ALL_TYPES = [
  "refund_credits", "add_credits", "stripe_refund", "flag_account", "note_incident",
  "suspend_user", "unsuspend_user", "block_ip", "other",
];
export const ALL_STATUSES = ["pending", "approved", "denied", "pending_execution", "cancelled", "expired", "all"];
export const ALL_PRIORITIES = ["all", "low", "normal", "high", "urgent"];
export const SENSITIVE_TYPES = ["suspend_user", "unsuspend_user", "stripe_refund"];

// ─── Badge Components ────────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status];
  if (!config) return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`text-[10px] ${config.className}`}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const config = PRIORITY_CONFIG[priority];
  if (!config) return null;
  return (
    <Badge variant="outline" className={`text-[10px] ${config.className}`}>
      {config.label}
    </Badge>
  );
}

export function TypeIcon({ type }: { type: string }) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.other;
  const Icon = config.icon;
  return <Icon className={`w-4 h-4 ${config.color}`} />;
}

// ─── Formatters ──────────────────────────────────────────────────────────────

export function formatDate(dateStr: string | Date | null | undefined) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelativeTime(dateStr: string | Date | null | undefined) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
