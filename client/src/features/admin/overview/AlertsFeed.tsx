/**
 * AlertsFeed — live feed of critical and warning audit events.
 */
import {
  AlertTriangle,
  Shield,
  Snowflake,
  Ban,
  Globe,
  Zap,
  CreditCard,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

const ACTION_CONFIG: Record<string, { icon: typeof AlertTriangle; label: string; color: string }> = {
  "account.auto_frozen": { icon: Snowflake, label: "Account Auto-Frozen", color: "text-blue-600" },
  "account.unfrozen": { icon: Snowflake, label: "Account Unfrozen", color: "text-emerald-600" },
  "admin.account_suspended": { icon: Ban, label: "Account Suspended", color: "text-red-600" },
  "admin.account_unsuspended": { icon: Ban, label: "Account Unsuspended", color: "text-emerald-600" },
  "admin.ip_blocked": { icon: Globe, label: "IP Blocked", color: "text-red-600" },
  "security.rate_limit": { icon: Shield, label: "Rate Limit Hit", color: "text-amber-600" },
  "abuse.detected": { icon: AlertTriangle, label: "Abuse Detected", color: "text-red-600" },
  "abuse.credits_exploit_attempt": { icon: Zap, label: "Credit Exploit Attempt", color: "text-red-600" },
  "abuse.billing_anomaly": { icon: CreditCard, label: "Billing Anomaly", color: "text-amber-600" },
  "abuse.global_attack_detected": { icon: Shield, label: "Global Attack", color: "text-red-600" },
  "security.emergency_action": { icon: Shield, label: "Emergency Action", color: "text-red-600" },
  "billing.stripe_refund_issued": { icon: CreditCard, label: "Refund Issued", color: "text-amber-600" },
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
  if (m.discrepancy && typeof m.discrepancy === "number") parts.push(`Discrepancy: ${m.discrepancy} credits`);
  if (m.ip && typeof m.ip === "string") parts.push(`IP: ${m.ip}`);
  return parts.join(" · ");
}

export function AlertsFeed({ alerts }: { alerts: AlertItem[] }) {
  if (alerts.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[#E5E5E5] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#0A0A0A] uppercase tracking-wider">
            Recent Alerts
          </h3>
          <Shield className="w-4 h-4 text-[#757575]" />
        </div>
        <div className="flex flex-col items-center py-8 text-[#757575]">
          <Shield className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-sm">No critical alerts</p>
          <p className="text-xs mt-1">Everything looks good</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#0A0A0A] uppercase tracking-wider">
          Recent Alerts
        </h3>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px] bg-red-50 text-red-700">
            {alerts.filter(a => a.severity === "critical").length} critical
          </Badge>
          <Link href="/admin/audit-logs">
            <button className="text-xs text-[#757575] hover:text-[#0A0A0A] transition-colors">
              View all →
            </button>
          </Link>
        </div>
      </div>

      <div className="space-y-1 max-h-[400px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
        {alerts.map((alert) => {
          const config = ACTION_CONFIG[alert.action] || {
            icon: AlertTriangle,
            label: alert.action,
            color: alert.severity === "critical" ? "text-red-600" : "text-amber-600",
          };
          const Icon = config.icon;
          const preview = getMetadataPreview(alert.metadata);

          return (
            <div
              key={alert.id}
              className={`flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-gray-50 ${
                alert.severity === "critical" ? "border-l-2 border-red-400" : ""
              }`}
            >
              <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.color}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[#0A0A0A]">
                    {config.label}
                  </span>
                  {alert.userId && (
                    <span className="text-[10px] text-[#757575]">
                      User #{alert.userId}
                    </span>
                  )}
                </div>
                {preview && (
                  <p className="text-[11px] text-[#757575] truncate mt-0.5">
                    {preview}
                  </p>
                )}
              </div>
              <span className="text-[10px] text-[#757575] flex-shrink-0 mt-0.5">
                {getTimeAgo(alert.createdAt)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
