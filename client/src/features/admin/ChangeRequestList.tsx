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
import { CHANGE_REQUEST_NOT_RECORDED } from "@shared/changeRequestLabels";
import { changeRequestApprovalBlocker } from "@shared/changeRequestApproval";

import { RowId, RowStack, StatePill, pageRange } from "@/features/staff";
import { DataTable } from "@/foundation";
import type { DataFact, DataRow, RowAction } from "@/foundation";
import { staffDateTimeWithYear } from "@/foundation/staffDate";

import { AttachmentsSection } from "./ChangeRequestAttachments";
import {
  STATUS_CONFIG,
  TYPE_CONFIG,
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
 * (Until #800 a separate `SENSITIVE_TYPES` list asked a second question —
 * *does Slack have to confirm it* — but no second sign-off exists any more:
 * approving a sensitive type executes it in the same mutation.)
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
          /* The config label, not the raw enum — `pending_execution` reads
             "Outcome unconfirmed" since #800, and the raw words would
             promise a wait that is not happening. */
          label={STATUS_CONFIG[request.status]?.label ?? request.status.replace("_", " ")}
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
      const label = config.approveLabel;

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
      /* The approve mutation records the review, then executes (#800). A
         request still here means the outcome was never confirmed — the
         executor threw, OR the action ran and the settle write / process
         died before recording it (this product deploys with work in
         flight). The label must not claim the action did not happen: acting
         again on that belief is how a refund gets issued twice. Settling it
         is a person's call, never a retry button. */
      actions.push({
        key: "unconfirmed",
        label: "Approved, but the outcome is unconfirmed — check the audit log and Stripe before acting again",
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
        /*
          ⚠ **118px HELD THE WORDS BUT NOT THE WIDEST ONE — found by #907's
          sweep, and it had been true here since #800.** This list has said
          `Outcome unconfirmed` for `pending_execution` for as long as that
          state has existed, and the pill renders at **139.1px** against a
          118px cell: `.dp-table__cell` is `overflow: hidden` with no ellipsis,
          so an admin reading the Outcome-unconfirmed filter saw the label cut
          mid-word. The card was filed about the moderator's console; this is
          the same defect one role over, which is why it is fixed in the same
          commit rather than filed as a sibling.
        */
        { label: "Status", width: "0 0 152px" },
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
    { label: "RAISED", value: staffDateTimeWithYear(detail.createdAt) },
    { label: "UPDATED", value: staffDateTimeWithYear(detail.updatedAt) },
  ];

  /*
    ⚠ **THE CREDITS ROW APPEARS EVEN WHEN THERE IS NO AMOUNT, AND SAYING SO IS
    THE POINT (#913).** It used to be inside `&& detail.creditAmount`, so a
    credit request with no amount showed no credits fact at all — while the
    consequence sentence under the Approve button read *"Approving adds null
    credits to this account"*. The page therefore told an admin nothing about
    the number and then asserted a JavaScript word for it, in one panel.

    An absent amount is a FACT about a money request, not a reason to draw
    nothing: the row now says `not recorded`, which is what the admin needs to
    know before they decide.
  */
  if (detail.type === "refund_credits" || detail.type === "add_credits") {
    facts.push({
      label: "CREDITS",
      value:
        detail.creditAmount == null
          ? CHANGE_REQUEST_NOT_RECORDED
          : `${detail.creditAmount}`,
    });
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

  /* The same rule as the credits row above, and for the same reason: on a
     request whose whole subject is an address, the address not being there is
     the most important thing on the panel. */
  if (detail.type === "block_ip") {
    facts.push({
      label: "IP ADDRESS",
      value: detail.ipAddress ?? CHANGE_REQUEST_NOT_RECORDED,
    });
  }

  if (detail.reviewedById) {
    facts.push({
      label: "REVIEWED",
      value: `${detail.reviewedByName || `Admin ${detail.reviewedById}`} · ${staffDateTimeWithYear(detail.reviewedAt)}`,
    });
    if (detail.reviewNotes) facts.push({ label: "REVIEW NOTES", value: detail.reviewNotes });
  }

  return facts;
}

/**
 * ⚠ **AN AMOUNT-LESS CREDIT REQUEST CANNOT BE APPROVED, AND THE SENTENCE SAYS
 * SO RATHER THAN NAMING A NUMBER IT DOES NOT HAVE (#913).**
 *
 * Read at the server before this was written, because what the sentence may
 * promise is whatever the executor actually does: `cr_addCredits` and
 * `cr_refundCredits` both open with
 * `if (typeof amount !== "number" || amount <= 0) throw new Error("Invalid
 * credit amount")` (`server/lib/adminActions/changeRequestActions.ts`). So
 * approving does not move a strange amount of credits — it moves none, and the
 * review mutation has already CAS'd the request to `pending_execution` by
 * then, which the panel draws as *"Outcome unconfirmed"* and which no control
 * on this page can clear (the review procedure refuses anything that is not
 * `pending`, deliberately: an executor that failed midway may have moved money
 * already, and a retry road here is how a refund gets issued twice).
 *
 * **The road in is closed too, which is why nobody has been hurt by this.**
 * `moderator.createChangeRequest` is the only creation road in the product and
 * it refuses a credit request with no amount. Measured the day this was fixed:
 * production holds **zero** `change_requests` rows of any type, all time; the
 * seven amount-less rows that produced the frame on the card are dev fixtures
 * from 2026-09-02, one of which is already wedged in `pending_execution`.
 *
 * So this is a display defect on an unreachable row — and it is still worth
 * repairing, because the last thing an admin reads before pressing a button
 * that moves a paying customer's balance must not be the word `null`.
 *
 * ⚠ **#923 MOVED THE BEHAVIOUR, SO THE SENTENCE MOVED WITH IT — AND IT NOW
 * CANNOT BE LEFT BEHIND AGAIN.** The review procedure refuses an approval
 * missing the field its executor needs BEFORE the compare-and-swap, for every
 * type that has one (credit amount, IP address, Stripe session, original
 * credits), so such a request stays `pending` and deniable instead of sticking
 * at *"Outcome unconfirmed"*. Which fields, and the sentence for each, are ONE
 * declaration in `shared/changeRequestApproval.ts` that the server refuses
 * with and this function shows. Until then each branch below carried its own
 * hand-written `== null` check and its own copy of the sentence, and two of
 * them had to be rewritten by hand when the server changed (#913, #921). The
 * check also reads a stored `0` as absent now, which the old `== null` did
 * not — the router never passed a `0` on, so approving one wedged too.
 */
function approvalConsequence(detail: any): string {
  const blocker = changeRequestApprovalBlocker(detail);
  if (blocker) return blocker.sentence;

  switch (detail.type) {
    case "refund_credits":
      return `Approving refunds ${detail.creditAmount} credits to this account. Denying leaves the balance as it is and closes the request.`;
    case "add_credits":
      return `Approving adds ${detail.creditAmount} credits to this account. Denying leaves the balance as it is and closes the request.`;
    case "stripe_refund":
      return `Approving issues a ${detail.refundAmountCents ? `$${(detail.refundAmountCents / 100).toFixed(2)}` : "—"} Stripe refund to the customer's card and takes ${detail.creditsToDeduct ?? "—"} credits back off their balance, floored at zero. Neither half can be undone from here.`;
    case "block_ip":
      /*
        ⚠ **THE LAW-7 SIBLING OF #913, AND IT WAS THE WORSE OF THE TWO.**

        The original read `Approving records ${detail.ipAddress} on the block
        list`, which rendered `undefined` on an address-less request — and
        pressing the button then blocked the TARGET USER'S ID as if it were an
        address (#921). Between #913 and #921 this branch carried a sentence
        describing that fallback, true the day it shipped and false the day
        #921 landed. The address-less case is now the shared blocker above.
      */
      /* Same correction as `AuditLogTable`'s: the block is RECORDED and never
         consulted on the request path. See that file's note. */
      return `Approving records ${detail.ipAddress} on the block list. It does not turn anyone away yet — nothing on the request path checks that list.`;
    case "suspend_user":
      return "Approving signs this person out, immediately, and blocks every sign-in until it is lifted.";
    case "unsuspend_user":
      return "Approving lets this person sign in again, immediately.";
    default:
      return "Denying closes this request without doing anything to the account it names.";
  }
}
