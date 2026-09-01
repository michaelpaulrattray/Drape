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
import { EmptyState, TableHead } from "@/foundation";
import { actionLabel } from "./actionLabel";

/**
 * RECENT ALERTS (brief 07 §8) — full width, greyscale, no inner scroll.
 *
 * ## `ACTION_CONFIG` loses its colour and background fields
 *
 * It mapped thirteen action types to blue / emerald / amber / red. His §3:
 * *"Thirteen action types tinted four ways is colour encoding a category,
 * which the system forbids for a concrete reason: it leaves nothing left to
 * say urgent. Keep the icons and the labels; those do the identifying."*
 *
 * So the record is now `{ icon, label }` and severity — which is a *state* —
 * is the only thing that may carry colour. `foundation/severity.ts` already
 * held this rule; this is one of the surfaces it was written for.
 *
 * ## Four smaller things, each with a reason in the brief
 *
 * - **No `max-h` + `overflow-y-auto`.** *"A scrolling region inside a scrolling
 *   page traps the wheel and hides rows behind an inner edge."* The list is
 *   capped at 12 with a link out instead.
 * - **A spacer, not `ml-auto`.** *"Auto margins resolve to hard pixels under
 *   any computed-style read, overflow the row, and clip."*
 * - **No `max-w-[280px]`** on the metadata line — it was there because the feed
 *   used to live in a 2-of-5 rail. The rail is gone, so the truncation is too.
 * - **The empty state is the primitive**, not a 40px 20%-opacity glyph.
 */

interface AlertItem {
  id: number;
  action: string;
  severity: string;
  userId: number | null;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: Date;
}

/** §8: the list is capped and links out for the rest. */
const VISIBLE_LIMIT = 12;

/**
 * The ICON per action. The label comes from `actionLabel` — see that module for
 * why a hand-written label map cannot be complete here.
 */
const ACTION_ICON: Record<string, typeof AlertTriangle> = {
  "account.auto_frozen": Snowflake,
  "account.frozen": Snowflake,
  "account.unfrozen": Snowflake,
  "admin.account_suspended": Ban,
  "admin.account_unsuspended": Ban,
  "admin.ip_blocked": Globe,
  "security.rate_limit": Shield,
  "abuse.detected": AlertTriangle,
  "abuse.credits_exploit_attempt": Zap,
  "abuse.billing_anomaly": CreditCard,
  "abuse.global_attack_detected": Shield,
  "security.emergency_action": Shield,
  "billing.stripe_refund_issued": CreditCard,
};

function getTimeAgo(date: Date): string {
  const diffMins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
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
  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;
  const visible = alerts.slice(0, VISIBLE_LIMIT);

  return (
    <section className="dp-ov__section">
      <TableHead eyebrow="Recent alerts">
        {criticalCount > 0 && (
          <span className="dp-ov__sevpill dp-ov__sevpill--critical">
            {criticalCount} critical
          </span>
        )}
        {warningCount > 0 && (
          <span className="dp-ov__sevpill dp-ov__sevpill--warning">
            {warningCount} warning
          </span>
        )}
        <Link href="/admin/audit-logs" className="dp-ov__link">
          All audit entries
          <svg
            className="dp-ov__chev"
            viewBox="0 0 11 11"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          >
            <path d="M4 2.5 L7.5 5.5 L4 8.5" />
          </svg>
        </Link>
      </TableHead>

      {alerts.length === 0 ? (
        <div className="dp-ov__card">
          <EmptyState
            title="No critical alerts"
            body="Security events, freezes and billing anomalies appear here as they happen."
          />
        </div>
      ) : (
        <div className="dp-ov__card">
          <div className="dp-ov__timeline">
            {visible.map((alert, idx) => {
              const Icon = ACTION_ICON[alert.action] ?? AlertTriangle;
              const label = actionLabel(alert.action);
              const preview = getMetadataPreview(alert.metadata);
              const isCritical = alert.severity === "critical";

              return (
                <div key={alert.id} className="dp-ov__alert">
                  <div className="dp-ov__alertrail">
                    <span
                      className={`dp-ov__alerttile${
                        isCritical ? " dp-ov__alerttile--critical" : ""
                      }`}
                    >
                      <Icon className="dp-ov__alerticon" />
                    </span>
                    {idx < visible.length - 1 && <span className="dp-ov__alertline" />}
                  </div>
                  <div className="dp-ov__alertbody">
                    <div className="dp-ov__alertrow">
                      <span
                        className={`dp-ov__alertlabel${
                          isCritical ? " dp-ov__alertlabel--critical" : ""
                        }`}
                      >
                        {label}
                      </span>
                      {alert.userId && (
                        <span className="dp-ov__alertid">#{alert.userId}</span>
                      )}
                      {/* A spacer, never `ml-auto` (§8). */}
                      <span className="dp-ov__spacer" />
                      <span className="dp-ov__alerttime">{getTimeAgo(alert.createdAt)}</span>
                    </div>
                    {preview && <p className="dp-ov__alertmeta">{preview}</p>}
                  </div>
                </div>
              );
            })}
          </div>
          {alerts.length > VISIBLE_LIMIT && (
            <p className="dp-ov__alertmore">
              {alerts.length - VISIBLE_LIMIT} more in the audit log
            </p>
          )}
        </div>
      )}
    </section>
  );
}
