import { Link } from "wouter";
import { TableHead } from "@/foundation";
import { actionLabel } from "./actionLabel";
import type { GovernanceData } from "./GovernanceCard";

/**
 * NEEDS A HUMAN — the first section, and the reason the page exists (brief 07 §2, §5).
 *
 * His argument, verbatim: *"An admin opens this page to find out whether
 * anything needs them. A success rate of 97% does not need them. Four pending
 * change requests do."*
 *
 * ## ⚠ Two sources, not the four the brief names — and that is a reconciliation
 * finding, not a shortcut
 *
 * §2 and §5 name four things: pending change requests, unanswered Crew cards,
 * flagged discrepancies, critical alerts. **Two of them have a reader on this
 * page and two do not**, and §10's *"do not add a query"* settles what happens
 * to the other two:
 *
 * | named | reader | here? |
 * |---|---|---|
 * | pending change requests | `data.governance` | yes |
 * | critical alerts | `data.alerts` | yes |
 * | unanswered Crew cards | `crew.getState` — a separate procedure returning the whole briefing | no |
 * | flagged discrepancies | `moderatorReconciliation.getUsersWithDiscrepancies(threshold)` — separate, and it would need this card to invent a threshold | no |
 *
 * The brief's own §2 hedges to exactly this: *"`GovernanceCard` and
 * `AlertsFeed` already hold **most** of this data."* The two absent sources are
 * named on #397 so he can rule on whether they are worth a second query, rather
 * than drawn as an empty row that looks like a working feature reading zero.
 *
 * ## The absence IS the message
 *
 * *"When nothing needs a human, the section disappears — no empty card, no 'all
 * clear' reassurance. Its absence is the message, and it is the strongest
 * signal the page can send."* So this component returns `null` on an empty
 * list; there is deliberately no `EmptyState` here, which is the one place on
 * this page that primitive would be wrong.
 *
 * ## Every card is dashed, and that is not an oversight
 *
 * §5 asks for *"dashed while unresolved, solid once handled"*. Nothing in this
 * section can be handled: an item leaves the list the moment it is dealt with —
 * a change request stops being pending, an alert scrolls out of the critical
 * window. So a `--resolved` modifier would be a state with no producer, and it
 * is not written. Dashed still means *not yet*, which is the load-bearing half.
 */

interface AlertItem {
  id: number;
  action: string;
  severity: string;
  userId: number | null;
  metadata: unknown;
  createdAt: Date;
}

export interface AttentionItem {
  key: string;
  /** The mono kind label — what sort of thing this is. */
  kind: string;
  /** Relative time, right-aligned on the top row. */
  when: string;
  /** The sentence. What is waiting, in plain words. */
  line: string;
  /** What to do about it. */
  next: string;
  /** Where the decision gets made. */
  href: string;
  /** Only an urgent item pulses (§3, §5). */
  urgent: boolean;
}

function timeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Build the list. Exported so the guard can drive it directly rather than
 * through a render — a backstop tested only through the component is a
 * backstop tested through whatever the component happens to do that day.
 */
export function attentionItems(
  governance: GovernanceData,
  alerts: AlertItem[],
): AttentionItem[] {
  const items: AttentionItem[] = [];

  if (governance.pendingChangeRequests > 0) {
    const n = governance.pendingChangeRequests;
    const urgent = governance.urgentChangeRequests > 0;
    items.push({
      key: "change-requests",
      kind: "REQUESTS",
      /* No per-request timestamp is in this payload — the count is a count.
         Saying "now" would invent a recency the data does not carry. */
      when: "waiting",
      line:
        n === 1
          ? "One change request is waiting for a decision."
          : `${n} change requests are waiting for a decision.`,
      next: urgent
        ? `${governance.urgentChangeRequests} marked urgent — open the Requests tab`
        : "Open the Requests tab",
      href: "/admin/change-requests",
      urgent,
    });
  }

  for (const alert of alerts) {
    if (alert.severity !== "critical") continue;
    items.push({
      key: `alert-${alert.id}`,
      kind: "ALERT",
      when: timeAgo(alert.createdAt),
      line: actionLabel(alert.action),
      next: alert.userId
        ? `Account #${alert.userId} — open the audit entry`
        : "Open the audit entry",
      href: "/admin/audit-logs",
      urgent: true,
    });
  }

  return items;
}

export function NeedsHuman({
  governance,
  alerts,
}: {
  governance: GovernanceData;
  alerts: AlertItem[];
}) {
  const items = attentionItems(governance, alerts);

  /* The whole section, head included. Absence is the message. */
  if (items.length === 0) return null;

  return (
    <section className="dp-ov__section">
      <TableHead eyebrow="Needs a human">
        <span className="dp-ov__meta">{items.length} waiting</span>
      </TableHead>
      <div className="dp-ov__attngrid">
        {items.map((item) => (
          <Link key={item.key} href={item.href} className="dp-attn">
            <span className="dp-attn__top">
              <span
                className={`dp-attn__dot${item.urgent ? " dp-attn__dot--urgent" : ""}`}
              />
              <span className="dp-attn__kind">{item.kind}</span>
              <span className="dp-attn__when">{item.when}</span>
            </span>
            <span className="dp-attn__line">{item.line}</span>
            <span className="dp-attn__next">{item.next}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
