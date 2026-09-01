/**
 * THE BUG-REPORT INBOX (#255) — where a customer's report finally arrives.
 *
 * Founder ruling, 2026-08-30, verbatim and entire:
 *
 *   "D is the right long-term answer probably in the admin panel first not the
 *    moderator panel yet. no point taking shortcuts."
 *
 * # What was wrong, in one sentence
 *
 * The lobby's menu offers *Send feedback* and *Report a bug* to every approved
 * account. Both wrote a row and dispatched a Slack message to a channel that
 * has never been configured on production — and nothing in the product could
 * read the table. A customer typed what went wrong, was told "Bug report
 * submitted. Thank you!", and the report reached nobody. This is the reader.
 *
 * # The copy on this page is deliberately plain about the queue being empty
 *
 * `bug_reports` holds ZERO rows, all time. Nobody has been failed yet — that is
 * luck rather than design, and it is why the founder chose the long answer over
 * the one-variable Slack patch. The empty state says the surface is live and
 * waiting, because "no reports yet" and "the reader is broken" must not look
 * the same on a support queue.
 *
 * # Two things this page deliberately does NOT have
 *
 * - **No delete.** `resolved` and `dismissed` are the terminal states and both
 *   KEEP what the customer said. Removing a person's words is a founder
 *   decision, not a button on a queue.
 * - **No export.** Where a customer's prose may travel is a second decision,
 *   and it was not the one he was asked.
 */

import { useState } from "react";
import { Redirect } from "wouter";
import { toast } from "sonner";

import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  RowId,
  RowStack,
  StatePill,
  StaffBarAdmin,
  StaffLoading,
  StaffSurface,
  pageRange,
} from "@/features/staff";
import { DataTable, TableFilter, TableHead } from "@/foundation";
import type { DataRow, RowAction } from "@/foundation";

/* ─── vocabulary ───
   Read from `shared/`, never retyped here. #27 is the standing card for the
   class this avoids — the client keeping its own copy of a server cap, sixteen
   sites and one already drifted. The db column, the procedure's zod enum and
   this page are three readers of ONE list. */

import {
  BUG_REPORT_CATEGORY_LABELS,
  BUG_REPORT_STATUSES as STATUSES,
  BUG_REPORT_STATUS_LABELS as STATUS_LABELS,
  type BugReportStatus as Status,
} from "@shared/bugReportVocabulary";

/**
 * ⚠ **THE FOUR-BUTTON DEFECT THIS PAGE ONCE HAD IS WHY THE COLOUR RULE IS ONE
 * FUNCTION NOW.** The card version drew every status as a filled pill *because*
 * every action beside it was outlined — the first attempt gave `reviewing` a
 * white fill with a dark border, which was the same shape, size and treatment
 * as the three workflow buttons inches away, and the card read as having four
 * buttons, one of which did nothing.
 *
 * The row treatment settles it structurally rather than by rule: a state is a
 * `StatePill` in a cell, an action is a `Button` in the expansion, and the two
 * are never on the same line. `new` is the only status asking for attention,
 * so it is the only one carrying accent (brief 06 §4).
 */
const ATTENTION_STATUS = new Set(["new"]);

const PAGE_SIZE = 25;

function formatWhen(d: string | Date): string {
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ─── page ─── */

export default function AdminBugReports() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const isAdmin = isAuthenticated && user?.role === "admin";

  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [offset, setOffset] = useState(0);

  const utils = trpc.useUtils();

  const listQuery = trpc.admin.getBugReports.useQuery(
    {
      ...(statusFilter === "all" ? {} : { status: statusFilter }),
      limit: PAGE_SIZE,
      offset,
    },
    { enabled: isAdmin, staleTime: 10_000 }
  );

  const countsQuery = trpc.admin.getBugReportCounts.useQuery(undefined, {
    enabled: isAdmin,
    staleTime: 10_000,
  });

  const updateStatus = trpc.admin.updateBugReportStatus.useMutation({
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error("That report no longer exists.");
      } else if (result.changed) {
        toast.success(`Marked ${STATUS_LABELS[result.status as Status].toLowerCase()}`);
      }
      utils.admin.getBugReports.invalidate();
      utils.admin.getBugReportCounts.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  /* ─── auth guards, the shape every other admin page uses ─── */
  if (authLoading) {
    return <StaffLoading />;
  }
  if (!isAuthenticated) return <Redirect to="/login" />;
  /* Brief 05 §6 — the redirect is silent now. The `toast.error` that used to
     sit here fired from the render body, which double-fires under strict mode,
     and somebody who cannot see Admin does not need telling why. */
  if (user?.role !== "admin") return <Redirect to="/app" />;

  const reports = listQuery.data?.rows ?? [];
  const total = listQuery.data?.total ?? 0;
  const counts = countsQuery.data;

  /*
    Five options — so `TableFilter` draws a select rather than a segmented row,
    which is the rule doing its job: five cramped stubs is what the segmented
    control stops being good at.

    ⚠ The COUNTS the pills carried are gone from the filter and are not
    reinvented anywhere: a `<select>` option cannot hold a pill, and inventing
    a second counts row beside it would be a surface the brief does not draw.
    The range in the footer says how many the current filter has.
  */
  const filterOptions = [
    { value: "all", label: counts?.total ? `All (${counts.total})` : "All" },
    ...STATUSES.map((status) => ({
      value: status,
      label: counts?.[status] ? `${STATUS_LABELS[status]} (${counts[status]})` : STATUS_LABELS[status],
    })),
  ];

  const rows: DataRow[] = reports.map((report) => {
    const status = report.status as Status;
    return {
      id: String(report.id),
      cells: [
        <RowStack
          key="who"
          name={report.reporterName || report.reporterEmail || `User #${report.userId}`}
          meta={
            BUG_REPORT_CATEGORY_LABELS[
              report.category as keyof typeof BUG_REPORT_CATEGORY_LABELS
            ] ?? report.category
          }
        />,
        <StatePill key="status" label={STATUS_LABELS[status]} attention={ATTENTION_STATUS.has(status)} />,
        <RowId key="page">{report.page || "—"}</RowId>,
        <span key="when">{formatWhen(report.createdAt)}</span>,
      ],
      facts: [
        { label: "REPORT", value: `#${report.id}` },
        { label: "FROM", value: report.reporterEmail || `user #${report.userId}` },
        { label: "SENT", value: formatWhen(report.createdAt) },
        { label: "PAGE", value: report.page || "not recorded" },
        { label: "VIEWPORT", value: report.viewport || "not recorded" },
      ],
      /* The customer's own words — the whole reason this page exists. */
      evidence: report.description,
      actions: STATUSES.filter((s) => s !== status).map(
        (s): RowAction => ({
          key: s,
          label: `Mark ${STATUS_LABELS[s].toLowerCase()}`,
          onClick: () => updateStatus.mutate({ id: report.id, status: s }),
          disabled: updateStatus.isPending,
        }),
      ),
    };
  });

  return (
    <StaffSurface breadcrumb="Admin / Bug reports" bar={<StaffBarAdmin />}>
      <main className="dp-stack" style={{ gap: 16 }}>
        <TableHead eyebrow="Bug reports">
          <TableFilter
            label="Status"
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value as Status | "all");
              setOffset(0);
            }}
            options={filterOptions}
          />
        </TableHead>

        <DataTable
          columns={[
            { label: "From", width: "1 1 0" },
            { label: "Status", width: "0 0 104px" },
            { label: "Page", width: "0 0 210px" },
            { label: "Sent", width: "0 0 168px" },
          ]}
          rows={rows}
          loading={listQuery.isLoading}
          empty={{
            title:
              statusFilter === "all"
                ? "No bug reports yet."
                : `No ${STATUS_LABELS[statusFilter as Status].toLowerCase()} reports.`,
            body: "Reports sent from the lobby menu arrive here.",
          }}
          footer={{
            meta: pageRange({ offset, count: reports.length, total }),
            onBack: () => setOffset((o) => Math.max(0, o - PAGE_SIZE)),
            onNext: () => setOffset((o) => o + PAGE_SIZE),
            backDisabled: offset === 0,
            nextDisabled: offset + PAGE_SIZE >= total,
          }}
        />
      </main>
    </StaffSurface>
  );
}
