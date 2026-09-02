/**
 * Moderation → My requests, on the one staff table pattern (brief 06).
 *
 * A moderator's own change requests and what an admin did with them.
 *
 * # The five summary tiles are one filter now
 *
 * The old head drew five coloured count tiles — amber pending, emerald
 * approved, red denied, grey closed, plain total — and none of them did
 * anything when clicked. Five numbers, no action. They are the filter's option
 * labels now, which is where a count earns its place: it tells you what
 * choosing that option would show you.
 *
 * ⚠ **The filter is CLIENT-SIDE and says so.** `getMyChangeRequests` takes no
 * status argument, so filtering here narrows the page you already have rather
 * than asking the server for another one — and the range in the footer counts
 * what is on screen. Adding a status argument would be changing a query, which
 * §7 forbids.
 */
import { useState } from "react";

import { RowId, RowStack, StatePill, pageRange } from "@/features/staff";
import { DataTable, TableFilter, TableHead } from "@/foundation";
import type { DataRow } from "@/foundation";

const TYPE_LABELS: Record<string, string> = {
  refund_credits: "Refund credits",
  add_credits: "Add credits",
  flag_account: "Flag account",
  note_incident: "Note incident",
  suspend_user: "Suspend user",
  unsuspend_user: "Unsuspend user",
  block_ip: "Block IP",
  other: "Other",
};

/** Waiting on somebody is the only state a moderator needs to act on. */
const ATTENTION_STATUS = new Set(["pending"]);
const ATTENTION_PRIORITY = new Set(["high", "urgent"]);

interface MyRequestsTabProps {
  data: any;
  isLoading: boolean;
  refetch: () => void;
}

export function MyRequestsTab({ data, isLoading }: MyRequestsTabProps) {
  const [statusFilter, setStatusFilter] = useState("all");

  const requests: any[] = data?.requests ?? [];
  const summary = data?.summary;

  /*
    ⚠ **"Closed" IS TWO STATUSES AND THE COUNT ALWAYS KNEW IT.** The option
    label adds `cancelledCount + expiredCount`, so a moderator with one expired
    request read `Closed (1)`, selected it, and got *"None of your requests are
    in that state."* — the count and the predicate disagreed, and an expired
    request was invisible under every filter but All.
  */
  const CLOSED = ["cancelled", "expired"];
  const filtered =
    statusFilter === "all"
      ? requests
      : statusFilter === "cancelled"
        ? requests.filter((request: any) => CLOSED.includes(request.status))
        : requests.filter((request: any) => request.status === statusFilter);

  const rows: DataRow[] = filtered.map((request: any) => ({
    id: String(request.id),
    cells: [
      <RowStack
        key="what"
        name={
          <>
            <RowId>#{request.id}</RowId> {request.title}
          </>
        }
        meta={`${TYPE_LABELS[request.type] || request.type} · about ${request.targetUserName || `user ${request.targetUserId}`}`}
      />,
      <StatePill
        key="status"
        label={request.status}
        attention={ATTENTION_STATUS.has(request.status)}
      />,
      <StatePill
        key="priority"
        label={request.priority}
        attention={ATTENTION_PRIORITY.has(request.priority)}
      />,
      <span key="when">{new Date(request.createdAt).toLocaleDateString()}</span>,
    ],
    facts: [
      { label: "RAISED", value: new Date(request.createdAt).toLocaleString() },
      { label: "ABOUT", value: request.targetUserName || `User #${request.targetUserId}` },
      ...(request.creditAmount
        ? [{ label: "CREDITS", value: `${request.creditAmount}` }]
        : []),
      ...(request.reviewedByName
        ? [
            { label: "REVIEWED BY", value: request.reviewedByName },
            {
              label: "REVIEWED",
              value: request.reviewedAt ? new Date(request.reviewedAt).toLocaleString() : "—",
            },
          ]
        : []),
    ],
    evidence: (
      <>
        {request.description}
        {request.reviewNotes ? `\n\nThey said: ${request.reviewNotes}` : ""}
      </>
    ),
  }));

  return (
    <div className="dp-stack" style={{ gap: 16 }}>
      <TableHead eyebrow="My requests">
        <TableFilter
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: countedLabel("All", summary?.totalCount) },
            { value: "pending", label: countedLabel("Waiting", summary?.pendingCount) },
            { value: "approved", label: countedLabel("Approved", summary?.approvedCount) },
            { value: "denied", label: countedLabel("Denied", summary?.deniedCount) },
            {
              value: "cancelled",
              label: countedLabel(
                "Closed",
                summary ? summary.cancelledCount + summary.expiredCount : undefined,
              ),
            },
          ]}
        />
      </TableHead>
      <DataTable
        columns={[
          { label: "Request", width: "1 1 0" },
          { label: "Status", width: "0 0 104px" },
          { label: "Priority", width: "0 0 92px" },
          { label: "Raised", width: "0 0 118px" },
        ]}
        rows={rows}
        loading={isLoading}
        empty={{
          title:
            statusFilter === "all"
              ? "You have not raised any change requests."
              : "None of your requests are in that state.",
          /* Quotes the button in the surface bar above — renamed together
             on his reply #91, or this sentence names a control nobody sees. */
          body: 'Use "File a request" above to raise one.',
        }}
        footer={{ meta: pageRange({ offset: 0, count: filtered.length, total: filtered.length }) }}
      />
    </div>
  );
}

/** A count earns its place on a filter option: it says what choosing it shows. */
function countedLabel(label: string, count: number | undefined): string {
  return count ? `${label} (${count})` : label;
}
