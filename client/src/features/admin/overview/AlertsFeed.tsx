/**
 * AlertsFeed — live feed of critical and warning audit events with severity timeline.
 */
import {
  AlertTriangle,
  Shield,
  Snowflake,
  Ban,
  Globe,
  Zap,
  CreditCard,
} from "lucide-react";
import { Link } from "wouter";

interface AlertItem {
  id: number;
  action: string;
  severity: string;
  userId: number | null;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: Date;
}

const ACTION_CONFIG: Record<string, { icon: typeof AlertTriangle; label: string; color: string; bg: string }> = {
  "account.auto_frozen": { icon: Snowflake, label: "Auto-Frozen", color: "text-blue-600", bg: "bg-blue-50" },
  "account.unfrozen": { icon: Snowflake, label: "Unfrozen", color: "text-emerald-600", bg: "bg-emerald-50" },
  "admin.account_suspended": { icon: Ban, label: "Suspended", color: "text-red-600", bg: "bg-red-50" },
  "admin.account_unsuspended": { icon: Ban, label: "Unsuspended", color: "text-emerald-600", bg: "bg-emerald-50" },
  "admin.ip_blocked": { icon: Globe, label: "IP Blocked", color: "text-red-600", bg: "bg-red-50" },
  "security.rate_limit": { icon: Shield, label: "Rate Limit", color: "text-amber-600", bg: "bg-amber-50" },
  "abuse.detected": { icon: AlertTriangle, label: "Abuse", color: "text-red-600", bg: "bg-red-50" },
  "abuse.credits_exploit_attempt": { icon: Zap, label: "Credit Exploit", color: "text-red-600", bg: "bg-red-50" },
  "abuse.billing_anomaly": { icon: CreditCard, label: "Billing Anomaly", color: "text-amber-600", bg: "bg-amber-50" },
  "abuse.global_attack_detected": { icon: Shield, label: "Global Attack", color: "text-red-600", bg: "bg-red-50" },
  "security.emergency_action": { icon: Shield, label: "Emergency", color: "text-red-600", bg: "bg-red-50" },
  "billing.stripe_refund_issued": { icon: CreditCard, label: "Refund", color: "text-amber-600", bg: "bg-amber-50" },
};

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function getMetadataPreview(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "";
  const m = metadata as Record<string, unknown>;
  const parts: string[] = [];
  if (m.reason && typeof m.reason === "string") parts.push(m.reason);
  if (m.userName && typeof m.userName === "string") parts.push(`User: ${m.userName}`);
  if (m.discrepancy && typeof m.discrepancy === "number") parts.push(`Δ${m.discrepancy} cr`);
  if (m.ip && typeof m.ip === "string") parts.push(m.ip);
  return parts.join(" · ");
}

export function AlertsFeed({ alerts }: { alerts: AlertItem[] }) {
  const criticalCount = alerts.filter(a => a.severity === "critical").length;
  const warningCount = alerts.filter(a => a.severity === "warning").length;

  if (alerts.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[#E5E5E5] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#0A0A0A]">Recent Alerts</h3>
          <Shield className="w-4 h-4 text-[#bbb]" />
        </div>
        <div className="flex flex-col items-center py-10 text-[#999]">
          <Shield className="w-10 h-10 mb-3 opacity-20" />
          <p className="text-sm font-medium">No critical alerts</p>
          <p className="text-[11px] mt-1">Everything looks good</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#0A0A0A]">Recent Alerts</h3>
        <Link href="/admin/audit-logs">
          <button className="text-[11px] text-[#999] hover:text-[#0A0A0A] transition-colors">
            View all →
          </button>
        </Link>
      </div>

      {/* Severity summary */}
      <div className="flex items-center gap-2 mb-3">
        {criticalCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            {criticalCount} critical
          </span>
        )}
        {warningCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {warningCount} warning
          </span>
        )}
      </div>

      {/* Timeline feed */}
      <div className="space-y-0.5 max-h-[460px] overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
        {alerts.map((alert, idx) => {
          const config = ACTION_CONFIG[alert.action] || {
            icon: AlertTriangle,
            label: alert.action,
            color: alert.severity === "critical" ? "text-red-600" : "text-amber-600",
            bg: alert.severity === "critical" ? "bg-red-50" : "bg-amber-50",
          };
          const Icon = config.icon;
          const preview = getMetadataPreview(alert.metadata);
          const isCritical = alert.severity === "critical";

          return (
            <div key={alert.id} className="flex gap-3 group">
              {/* Timeline connector */}
              <div className="flex flex-col items-center w-5 flex-shrink-0">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${config.bg}`}>
                  <Icon className={`w-3 h-3 ${config.color}`} />
                </div>
                {idx < alerts.length - 1 && (
                  <div className="w-px flex-1 bg-[#E5E5E5] my-0.5" />
                )}
              </div>

              {/* Content */}
              <div className={`flex-1 pb-3 ${idx < alerts.length - 1 ? "" : ""}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-semibold ${isCritical ? "text-red-700" : "text-[#0A0A0A]"}`}>
                    {config.label}
                  </span>
                  {alert.userId && (
                    <span className="text-[10px] text-[#bbb]">
                      #{alert.userId}
                    </span>
                  )}
                  <span className="text-[10px] text-[#bbb] ml-auto flex-shrink-0">
                    {getTimeAgo(alert.createdAt)}
                  </span>
                </div>
                {preview && (
                  <p className="text-[10px] text-[#999] truncate mt-0.5 max-w-[280px]">
                    {preview}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
