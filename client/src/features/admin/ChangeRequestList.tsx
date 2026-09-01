/**
 * Admin → Change requests, on the one staff table pattern (brief 06).
 *
 * # ⚠ What this replaced was a PANE, not a modal
 *
 * His §2 lists `ChangeRequestDetail` among "four such modals". At the code it
 * was a **side pane**: this page drew a 2/5 list beside a 3/5 detail column,
 * and `ReviewModal` was the only dialog on it. The blank canvas could not know
 * — and his instruction lands the same way either way, because a side pane has
 * the modal's defect in a quieter form: at 1280px the list column was 400px
 * wide, so a request's title truncated to make room for a pane that was empty
 * until you clicked something.
 *
 * The pane's contents are this row's expansion, and the type-specific blocks —
 * credit amount, refund figures, IP address — are FACTS, which is what they
 * always were: pairs of a label and a value, drawn as four coloured boxes.
 *
 * # The "Approving will…" sentences were already the consequence note
 *
 * Every one of those blocks ended with a line reading *"Approving will issue a
 * $12.00 Stripe refund and deduct 160 credits from the user"*. His §5 rule —
 * a specific consequence beside the button rather than inside a dialog — was
 * half-built here before he wrote it down. They are now the note on the
 * Approve action, which is where they were always trying to sit.
 */
import { RowId, RowStack, StatePill, pageRange } from "@/features/staff";
import { DataTable } from "@/foundation";
import type { DataFact, DataRow, RowAction } from "@/foundation";

import { AttachmentsSection } from "./ChangeRequestAttachments";
import {
  SENSITIVE_TYPES,
  TYPE_CONFIG,
  formatDate,
  formatRelativeTime,
  getActionConfig,
} from "./ChangeRequestConstants";

interface ChangeRequest {
  id: number;
  type: string;
  title: string;
  status: string;
  priority: string;
  submittedByName?: string | null;
  submittedById: number;
  createdAt: string | Date | null;
}

/**
 * The request types where APPROVING cannot be taken back from this surface —
 * money leaves, credits move, or somebody loses access.
 *
 * `SENSITIVE_TYPES` is a different question and both are needed: that one asks
 * *does Slack have to confirm it*, this one asks *can it be undone*. Suspension
 * is in both; a Stripe refund is only in this one.
 */
const IRREVERSIBLE_TYPES = [
  "stripe_refund",
  "refund_credits",
  "add_credits",
  "suspend_user",
  "unsuspend_user",
];

/** The states an admin is here to act on. Everything else has been dealt with. */
const ATTENTION_STATUS = new Set(["pending", "pending_execution"]);
const ATTENTION_PRIORITY = new Set(["high", "urgent"]);

interface ChangeRequestListProps {
  requests: ChangeRequest[];
  isLoading: boolean;
  selectedRequestId: number | null;
  onSelect: (id: number | null) => void;
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  selectedRequest: any;
  detailLoading: boolean;
  slackStatus: string | null | undefined;
  isSlackExecuting: boolean;
  onApprove: () => void;
  onDeny: () => void;
}

export function ChangeRequestList({
  requests,
  isLoading,
  selectedRequestId,
  onSelect,
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  selectedRequest,
  detailLoading,
  slackStatus,
  isSlackExecuting,
  onApprove,
  onDeny,
}: ChangeRequestListProps) {
  const rows: DataRow[] = requests.map((request) => {
    const open = selectedRequestId === request.id;
    const detail = open && selectedRequest?.id === request.id ? selectedRequest : undefined;

    return {
      id: String(request.id),
      cells: [
        <RowStack
          key="what"
          name={
            <>
              <RowId>#{request.id}</RowId> {request.title}
            </>
          }
          meta={`${TYPE_CONFIG[request.type]?.label || request.type} · by ${request.submittedByName || `user ${request.submittedById}`}`}
        />,
        <StatePill
          key="status"
          label={request.status.replace("_", " ")}
          attention={ATTENTION_STATUS.has(request.status)}
        />,
        <StatePill
          key="priority"
          label={request.priority}
          attention={ATTENTION_PRIORITY.has(request.priority)}
        />,
        <span key="when">{formatRelativeTime(request.createdAt)}</span>,
      ],
      facts: detail ? requestFacts(detail) : [{ label: "REQUEST", value: `#${request.id}` }],
      evidence: detail ? (
        <>
          {detail.description}
          {detail.evidenceSummary ? `\n\n${detail.evidenceSummary}` : ""}
          <AttachmentsSection changeRequestId={detail.id} />
        </>
      ) : detailLoading ? (
        "Loading this request…"
      ) : undefined,
      actions: detail ? requestActions(detail) : [],
    };
  });

  function requestActions(detail: any): RowAction[] {
    const actions: RowAction[] = [];

    if (detail.status === "pending") {
      const config = getActionConfig(detail.type);
      const sensitive = SENSITIVE_TYPES.includes(detail.type);

      /*
        ⚠ THE DESTRUCTIVE FLAG SITS ON **APPROVE**, NOT ON DENY, AND THE FIRST
        VERSION HAD IT THE OTHER WAY ROUND.

        Deny is the reversible half: it closes a request and does nothing to
        the account it names. **Approve is the act that moves money and ends
        access** — a Stripe refund that cannot be undone from here, a credit
        adjustment, a suspension. Hanging §5's compile-time guarantee on Deny
        meant the type was guarding the button that needed it least, and
        Approve never wore the destructive hover treatment.

        `IRREVERSIBLE_TYPES` is the set where approving cannot be taken back
        from this surface. The other four — flag, note, block_ip, other — are
        records rather than acts, so Approve stays a plain primary there and
        the consequence rides Deny instead. Every branch still carries a
        sentence; what changed is which button the compiler holds.
      */
      const irreversible = IRREVERSIBLE_TYPES.includes(detail.type);
      const label = sensitive ? `${config.approveLabel} (Slack)` : config.approveLabel;

      if (irreversible) {
        actions.push({
          key: "approve",
          label,
          onClick: onApprove,
          destructive: true,
          consequence: approvalConsequence(detail),
        });
        actions.push({ key: "deny", label: config.denyLabel, onClick: onDeny });
      } else {
        actions.push({ key: "approve", label, onClick: onApprove, variant: "primary" });
        actions.push({
          key: "deny",
          label: config.denyLabel,
          onClick: onDeny,
          destructive: true,
          consequence: approvalConsequence(detail),
        });
      }
    }

    if (detail.status === "pending_execution") {
      actions.push({
        key: "slack",
        label: slackStatusLabel(slackStatus, isSlackExecuting),
        disabled: true,
      });
    }

    if (detail.relatedAuditLogId) {
      actions.push({
        key: "audit",
        label: `Open audit entry #${detail.relatedAuditLogId}`,
        href: `/admin/audit-logs?highlight=${detail.relatedAuditLogId}`,
      });
    }

    return actions;
  }

  return (
    <DataTable
      columns={[
        { label: "Request", width: "1 1 0" },
        { label: "Status", width: "0 0 118px" },
        { label: "Priority", width: "0 0 92px" },
        { label: "Raised", width: "0 0 118px" },
      ]}
      rows={rows}
      loading={isLoading}
      openId={selectedRequestId === null ? null : String(selectedRequestId)}
      onOpenChange={(id) => onSelect(id === null ? null : Number(id))}
      empty={{
        title: "No change requests match those filters.",
        body: "Clear a filter, or check back when a moderator raises one.",
      }}
      footer={{
        meta: pageRange({ offset: page * pageSize, count: requests.length, total }),
        onBack: () => onPageChange(Math.max(0, page - 1)),
        onNext: () => onPageChange(page + 1),
        backDisabled: page === 0,
        nextDisabled: page >= totalPages - 1,
      }}
    />
  );
}

/**
 * The four blocks the pane drew in amber, violet, red and green are facts.
 * Only the ones this request TYPE has appear — a `block_ip` request has no
 * refund figures, and an empty labelled box is worse than no box.
 */
function requestFacts(detail: any): DataFact[] {
  const facts: DataFact[] = [
    {
      label: "RAISED BY",
      value: detail.submittedByName || `User ${detail.submittedById}`,
    },
    {
      label: "ABOUT",
      value: detail.targetUserName
        ? `${detail.targetUserName} (#${detail.targetUserId})`
        : `User #${detail.targetUserId}`,
    },
    { label: "RAISED", value: formatDate(detail.createdAt) },
    { label: "UPDATED", value: formatDate(detail.updatedAt) },
  ];

  if ((detail.type === "refund_credits" || detail.type === "add_credits") && detail.creditAmount) {
    facts.push({ label: "CREDITS", value: `${detail.creditAmount}` });
    if (detail.creditReason) facts.push({ label: "CREDIT REASON", value: detail.creditReason });
  }

  if (detail.type === "stripe_refund") {
    facts.push({ label: "REFUND TYPE", value: detail.refundType || "—" });
    facts.push({
      label: "REFUND",
      value: detail.refundAmountCents ? `$${(detail.refundAmountCents / 100).toFixed(2)}` : "—",
    });
    facts.push({ label: "ORIGINAL CREDITS", value: detail.originalCredits ?? "—" });
    facts.push({ label: "CREDITS TO DEDUCT", value: detail.creditsToDeduct ?? "—" });
    if (detail.stripeSessionId) {
      facts.push({ label: "STRIPE SESSION", value: detail.stripeSessionId });
    }
  }

  if (detail.type === "block_ip" && detail.ipAddress) {
    facts.push({ label: "IP ADDRESS", value: detail.ipAddress });
  }

  if (detail.reviewedById) {
    facts.push({
      label: "REVIEWED",
      value: `${detail.reviewedByName || `Admin ${detail.reviewedById}`} · ${formatDate(detail.reviewedAt)}`,
    });
    if (detail.reviewNotes) facts.push({ label: "REVIEW NOTES", value: detail.reviewNotes });
  }

  return facts;
}

function approvalConsequence(detail: any): string {
  switch (detail.type) {
    case "refund_credits":
      return `Approving refunds ${detail.creditAmount} credits to this account. Denying leaves the balance as it is and closes the request.`;
    case "add_credits":
      return `Approving adds ${detail.creditAmount} credits to this account. Denying leaves the balance as it is and closes the request.`;
    case "stripe_refund":
      return `Approving issues a ${detail.refundAmountCents ? `$${(detail.refundAmountCents / 100).toFixed(2)}` : "—"} Stripe refund to the customer's card and takes ${detail.creditsToDeduct ?? "—"} credits back off their balance, floored at zero. Neither half can be undone from here.`;
    case "block_ip":
      /* Same correction as `AuditLogTable`'s: the block is RECORDED and never
         consulted on the request path. See that file's note. */
      return `Approving records ${detail.ipAddress} on the block list. It does not turn anyone away yet — nothing on the request path checks that list.`;
    case "suspend_user":
      return "Approving asks Slack to confirm, and then signs this person out and blocks every sign-in until it is lifted.";
    case "unsuspend_user":
      return "Approving asks Slack to confirm, and then lets this person sign in again.";
    default:
      return "Denying closes this request without doing anything to the account it names.";
  }
}

function slackStatusLabel(status: string | null | undefined, executing: boolean): string {
  if (status === "approved") return executing ? "Slack approved — running" : "Slack approved";
  if (status === "denied") return "Slack denied — this will not run";
  if (status === "expired") return "Slack approval expired — this will not run";
  return "Waiting on Slack confirmation";
}
