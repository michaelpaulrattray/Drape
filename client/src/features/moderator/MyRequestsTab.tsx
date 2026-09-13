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
import { changeRequestStatusLabel, changeRequestTypeLabel } from "@shared/changeRequestLabels";
import { formatDate, formatFullDate } from "./moderatorConstants";


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
        meta={`${changeRequestTypeLabel(request.type)} · about ${request.targetUserName || `user ${request.targetUserId}`}`}
      />,
      /*
        ⚠ **#907 — this was the bare `request.status`**, so the pill rendered
        the database enum in machine case and the 104px column cut it mid-word:
        `PENDING_EXECUTI`. Its neighbours read `PENDING` and `DENIED`, so the
        broken one was the only one that looked like a leak — and the admin
        list one role away has said `Outcome unconfirmed` for that same state
        since #800.

        ⚠ **All six statuses take the words, not just the broken one.** Mapping
        one and leaving five raw would have left this column in two
        vocabularies, which is the mistake #900 was filed about. The words are
        `shared/changeRequestLabels.ts`'s, the same declaration the admin
        panel's `STATUS_CONFIG` reads, so the two surfaces cannot drift again.
      */
      <StatePill
        key="status"
        label={changeRequestStatusLabel(request.status)}
        attention={ATTENTION_STATUS.has(request.status)}
      />,
      <StatePill
        key="priority"
        label={request.priority}
        attention={ATTENTION_PRIORITY.has(request.priority)}
      />,
      /*
        ⚠ **#903 — this was a bare `toLocaleDateString()`**, so it took the
        machine's locale in full and rendered `03/09/2026` on an en-AU browser.
        One click away, this same console's Audit logs tab draws its own `When`
        column from `formatDate` and reads `Sep 13, 11:08`. Two date notations
        on one piece of furniture, which is #900's ruling in its DATE half:
        *"the one clock he would be comparing against was the one written
        differently."*

        ⚠ **IT GAINS A CLOCK, AND THAT WAS THE DECISION IN THE CARD.** The
        column had a date alone; the house formatter carries the time too. The
        neighbour column it is being matched to has always carried one, and the
        fact block below already prints the full stamp, so the clock is this
        console's own idiom rather than something new arriving with the fix. A
        date-only house formatter would have been a third shape — which is the
        thing #900 and #902 both exist to stop.
      */
      <span key="when">{formatDate(new Date(request.createdAt))}</span>,
    ],
    facts: [
      /*
        ⚠ **#900 — these two were bare `toLocaleString()`**, rendering
        `13/09/2026, 10:30:33 pm` inside a fact block whose siblings on
        `ActivitySubTab` and `AuditLogsTab` already read `September 13, 2026 at
        22:30:33` from `formatFullDate`. Same "WHEN" idiom, three files, one of
        them writing it differently. It calls the shared one now.
      */
      { label: "RAISED", value: formatFullDate(new Date(request.createdAt)) },
      { label: "ABOUT", value: request.targetUserName || `User #${request.targetUserId}` },
      ...(request.creditAmount
        ? [{ label: "CREDITS", value: `${request.creditAmount}` }]
        : []),
      ...(request.reviewedByName
        ? [
            { label: "REVIEWED BY", value: request.reviewedByName },
            {
              label: "REVIEWED",
              value: request.reviewedAt ? formatFullDate(new Date(request.reviewedAt)) : "—",
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
          /*
            ⚠ **152px, and the number is MEASURED rather than chosen (#907).**
            The widest status is `Outcome unconfirmed`, which renders at
            **142.8px** as a pill (9.5px mono, uppercase, 0.08em tracking, 9px
            padding either side). The column was 104px and `.dp-table__cell`
            is `overflow: hidden` with no ellipsis, so it was a hard cut
            mid-word — which is how `PENDING_EXECUTI` came to be on screen.

            ⚠ **Widening it is NOT the repair the card warned against.** That
            warning was about widening to make `PENDING_EXECUTION` legible —
            fitting a machine word into the furniture. The words changed first;
            this is the column being made big enough for the widest real word,
            and it is the same 152px the admin list now uses, because the same
            label was being cut there too.
          */
          { label: "Status", width: "0 0 152px" },
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
