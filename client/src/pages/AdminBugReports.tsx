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
import { Loader2, Inbox, ExternalLink } from "lucide-react";

import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { Button } from "@/components/ui/button";

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
 * Greyscale, with weight carrying the meaning — `new` is the only status that
 * asks for attention, so it is the only one at full contrast.
 *
 * ⚠ **EVERY STATUS IS FILLED, BECAUSE EVERY ACTION ON THIS CARD IS OUTLINED.**
 * That is the whole rule and it is not decoration. The first version gave
 * `reviewing` a white fill with a dark border, which is the same shape, size
 * and treatment as the three outlined workflow buttons sitting inches away on
 * the same row — looked at in the running app, the card read as having FOUR
 * buttons, one of which does nothing when you press it. A state that looks
 * like a control is a dead control by appearance (plan §O), and no assertion
 * about the status text could have seen it. Founder law 6, earned.
 *
 * So: state = filled, control = outlined, one rule, pinned by an arm in
 * `bugReportInbox.test.ts` because this is exactly the shape a tidy-up undoes.
 */
const STATUS_STYLES: Record<Status, string> = {
  new: "bg-[#0A0A0A] text-white border-[#0A0A0A]",
  reviewing: "bg-[#E4E4E4] text-[#0A0A0A] border-[#E4E4E4]",
  resolved: "bg-[#F4F4F4] text-[#666] border-[#F4F4F4]",
  dismissed: "bg-[#F4F4F4] text-[#999] border-[#F4F4F4]",
};

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
    return (
      <div className="min-h-screen bg-[#EBEBEB] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#0A0A0A]" />
      </div>
    );
  }
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (user?.role !== "admin") {
    toast.error("Access denied. Admin privileges required.");
    return <Redirect to="/studio" />;
  }

  const rows = listQuery.data?.rows ?? [];
  const total = listQuery.data?.total ?? 0;
  const counts = countsQuery.data;

  const filters: Array<{ key: Status | "all"; label: string; count: number | undefined }> = [
    { key: "all", label: "All", count: counts?.total },
    ...STATUSES.map((s) => ({ key: s, label: STATUS_LABELS[s], count: counts?.[s] })),
  ];

  return (
    <div className="min-h-screen bg-[#EBEBEB] text-[#0A0A0A]">
      <AdminHeader title="Bug Reports" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* ─── filters ─── */}
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => {
            const active = statusFilter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  setStatusFilter(f.key);
                  setOffset(0);
                }}
                aria-pressed={active}
                className={`h-8 px-3 rounded-full border text-xs transition-colors ${
                  active
                    ? "bg-[#0A0A0A] text-white border-[#0A0A0A]"
                    : "bg-white text-[#666] border-[#D5D5D5] hover:text-[#0A0A0A]"
                }`}
              >
                {f.label}
                {/* Hidden at zero rather than showing "(0)" — an empty count is
                    noise on a filter row, and a MISSING count is honest while
                    the counts are still loading. */}
                {f.count ? <span className="ml-1.5 tabular-nums opacity-60">{f.count}</span> : null}
              </button>
            );
          })}
        </div>

        {/* ─── the queue ─── */}
        {listQuery.isLoading ? (
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-12 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-[#999]" />
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-12 text-center">
            <Inbox className="w-6 h-6 mx-auto text-[#CCC]" aria-hidden="true" />
            <p className="mt-3 text-sm text-[#0A0A0A]">
              {statusFilter === "all"
                ? "No bug reports yet."
                : `No ${STATUS_LABELS[statusFilter].toLowerCase()} reports.`}
            </p>
            <p className="mt-1 text-xs text-[#999]">
              Reports sent from the lobby menu arrive here.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((report) => (
              <li
                key={report.id}
                className="bg-white rounded-2xl border border-[#E5E5E5] p-5"
              >
                {/* header row: who, when, where, status */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`h-6 px-2.5 inline-flex items-center rounded-full border text-[11px] ${
                          STATUS_STYLES[report.status as Status]
                        }`}
                      >
                        {STATUS_LABELS[report.status as Status]}
                      </span>
                      <span className="text-xs text-[#666]">
                        {BUG_REPORT_CATEGORY_LABELS[report.category as keyof typeof BUG_REPORT_CATEGORY_LABELS] ?? report.category}
                      </span>
                      <span className="text-xs text-[#BBB]">·</span>
                      <span className="text-xs text-[#999] tabular-nums">
                        {formatWhen(report.createdAt)}
                      </span>
                    </div>
                    <div className="mt-1.5 text-xs text-[#666] truncate">
                      {/* A report is worthless for support if you cannot answer
                          the person who sent it. A deleted account still shows
                          its report — the join is a leftJoin on purpose. */}
                      {report.reporterName || report.reporterEmail || `User #${report.userId}`}
                      {report.reporterEmail && report.reporterName ? (
                        <span className="text-[#AAA]"> · {report.reporterEmail}</span>
                      ) : null}
                    </div>
                  </div>

                  {/* the workflow */}
                  <div className="flex flex-wrap gap-1.5">
                    {STATUSES.filter((s) => s !== report.status).map((s) => (
                      <Button
                        key={s}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full border-[#D5D5D5] h-7 px-2.5 text-[11px]"
                        disabled={updateStatus.isPending}
                        onClick={() => updateStatus.mutate({ id: report.id, status: s })}
                      >
                        {STATUS_LABELS[s]}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* the customer's own words — the whole reason this page exists */}
                <p className="mt-3 text-sm text-[#0A0A0A] whitespace-pre-wrap break-words">
                  {report.description}
                </p>

                {/* context, quiet */}
                {(report.page || report.viewport) && (
                  <div className="mt-3 pt-3 border-t border-[#F0F0F0] flex flex-wrap gap-3 text-[11px] text-[#999]">
                    {report.page ? (
                      <span className="inline-flex items-center gap-1 font-mono break-all">
                        <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                        {report.page}
                      </span>
                    ) : null}
                    {report.viewport ? (
                      <span className="font-mono tabular-nums">{report.viewport}</span>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* ─── paging: shown only when there is more than one page ─── */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#999] tabular-nums">
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full border-[#D5D5D5]"
                disabled={offset === 0}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full border-[#D5D5D5]"
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
