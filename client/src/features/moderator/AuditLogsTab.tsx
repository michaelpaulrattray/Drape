/**
 * Moderation → Audit logs, on the one staff table pattern (brief 06).
 *
 * `LogDetailModal` is gone. Its eight facts, its raw metadata and its "Submit
 * change request" button are this row's expansion.
 *
 * # The abuse-alerts banner stays, and it is NOT the table
 *
 * The critical alerts above the table are a different question — *what needs
 * looking at right now* rather than *what happened* — and the brief's §1 does
 * not touch them. They keep their own treatment; what changed is that the five
 * alert rows and the log rows no longer draw two different kinds of pill for
 * the same severity word.
 *
 * # Two actions became one
 *
 * Every row had an eye button and, on warnings, a flag button. The eye opened
 * the modal, which is now what clicking the row does — so it is gone rather
 * than kept as a control that does what the row already does.
 */
import { useState } from "react";

import { toast } from "sonner";

import { RawPayload, RowId, StatePill, pageRange } from "@/features/staff";
import { Button, DataTable, TableFilter, TableHead, TableSearch } from "@/foundation";
import type { DataRow, RowAction } from "@/foundation";
import { staffDateTime, staffFullDateTime } from "@/foundation/staffDate";
import { logRawFailure, readableFailure } from "@/lib/failureSentence";
import { trpc } from "@/lib/trpc";

import { csvDateStamp, runStaffCsvExport, saveCsvFile } from "./staffCsvExport";
import { AuditLog, formatAction, getActionCategory, type OpenChangeRequestOptions } from "./moderatorConstants";

const PAGE_SIZE = 20;

interface AuditLogsTabProps {
  logsQuery: any;
  alertsQuery: any;
  page: number;
  setPage: (fn: (p: number) => number) => void;
  severityFilter: string;
  setSeverityFilter: (v: string) => void;
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  userIdSearch: string;
  setUserIdSearch: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  totalPages: number;
  selectedLog: AuditLog | null;
  onSelectLog: (log: AuditLog | null) => void;
  onOpenChangeRequest: (options?: OpenChangeRequestOptions) => void;
  onResetFilters: () => void;
}

export function AuditLogsTab({
  logsQuery,
  alertsQuery,
  page,
  setPage,
  severityFilter,
  setSeverityFilter,
  categoryFilter,
  setCategoryFilter,
  userIdSearch,
  setUserIdSearch,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  totalPages,
  selectedLog,
  onSelectLog,
  onOpenChangeRequest,
  onResetFilters,
}: AuditLogsTabProps) {
  const [isExporting, setIsExporting] = useState(false);
  const hasFilters =
    severityFilter !== "all" || categoryFilter !== "all" || userIdSearch || startDate || endDate;

  /*
    ⚠ THROUGH THE VANILLA CLIENT, NEVER `useQuery({ enabled: false })` + `refetch()`
    (#1991). `refetch()` resolves with `{ error }` rather than throwing, so a
    refusal said nothing, and its `data` is the last SUCCESSFUL answer, so a
    refused second press re-downloaded the previous file. `utils.client` throws,
    caches nothing and retries nothing; `runStaffCsvExport` says something on
    every road and is driven in `staffCsvExport.test.ts`.
  */
  const utils = trpc.useUtils();

  const handleExport = async () => {
    setIsExporting(true);
    const input = {
      severity: severityFilter as any,
      actionCategory: categoryFilter as any,
      userId: userIdSearch && !isNaN(parseInt(userIdSearch)) ? parseInt(userIdSearch) : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };
    try {
      await runStaffCsvExport({
        context: "moderatorExports.exportAuditLogsCsv",
        fetchExport: () => utils.client.moderatorExports.exportAuditLogsCsv.query(input),
        fileName: `audit-logs-${csvDateStamp()}.csv`,
        successMessage: (answer) => `Exported ${answer.total} audit log entries`,
        fallbackFailure: "The audit logs could not be exported.",
        download: saveCsvFile,
        onSuccess: (message) => toast.success(message),
        onFailure: (message) => toast.error(message),
        logFailure: logRawFailure,
        readFailure: readableFailure,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const logs: AuditLog[] = logsQuery.data?.logs ?? [];

  const rows: DataRow[] = logs.map((log) => {
    const category = getActionCategory(log.action);
    const open = selectedLog?.id === log.id;
    return {
      id: String(log.id),
      cells: [
        <StatePill
          key="severity"
          label={log.severity}
          attention={log.severity === "critical" || log.severity === "warning"}
        />,
        <span key="action" className="dp-table__pair">
          <span className="dp-table__pairmain">{formatAction(log.action)}</span>
          {category ? <span className="dp-table__id">{category}</span> : null}
        </span>,
        <RowId key="user">{log.userId ? `#${log.userId}` : "system"}</RowId>,
        <RowId key="ip">{log.ipAddress || "—"}</RowId>,
        <span key="when">{staffDateTime(log.createdAt)}</span>,
      ],
      facts: [
        { label: "ENTRY", value: `#${log.id}` },
        { label: "WHEN", value: staffFullDateTime(log.createdAt) },
        { label: "ACTION", value: log.action },
        {
          label: "RESOURCE",
          value: log.resourceType ? `${log.resourceType} ${log.resourceId ?? ""}` : "—",
        },
        { label: "IP", value: log.ipAddress || "—" },
        { label: "USER AGENT", value: log.userAgent || "—" },
      ],
      evidence:
        log.metadata && Object.keys(log.metadata).length > 0 ? (
          <RawPayload value={log.metadata} />
        ) : undefined,
      actions: open ? logActions(log) : [],
    };
  });

  function logActions(log: AuditLog): RowAction[] {
    if (log.severity !== "warning" && log.severity !== "critical") return [];
    return [
      {
        key: "request",
        label: "Raise a change request",
        variant: "secondary",
        onClick: () => {
          const metadata = log.metadata as Record<string, unknown> | null;
          onOpenChangeRequest({
            type: metadata?.ipAddress
              ? "block_ip"
              : log.userId
                ? "flag_account"
                : "note_incident",
            targetUserId: log.userId?.toString() || "",
            targetUserName: (metadata?.userName as string) || undefined,
            relatedAuditLogId: log.id,
            ipAddress: (metadata?.ipAddress as string) || undefined,
          });
        },
      },
    ];
  }

  return (
    <div className="dp-stack" style={{ gap: 16 }}>
      {/*
        This condition is why #946 was a real defect rather than a wrong number:
        the panel headed "Needs looking at" renders ONLY here, and until the
        count became a real COUNT it was taken over the newest ten abuse rows —
        so ten newer warnings hid a critical alert's own panel. Same shape as
        the founder ruling above the abuse bucket in `server/auditLog.ts`.
      */}
      {(alertsQuery.data?.criticalCount || 0) > 0 ? (
        <AbuseAlerts alertsQuery={alertsQuery} onOpenChangeRequest={onOpenChangeRequest} />
      ) : null}

      <TableHead eyebrow="Audit">
        <TableSearch
          label="Show only one user's entries, by id"
          placeholder="User id"
          value={userIdSearch}
          onChange={(value) => {
            setUserIdSearch(value);
            setPage(() => 0);
          }}
        />
        <TableFilter
          label="Severity"
          value={severityFilter}
          onChange={(value) => {
            setSeverityFilter(value);
            setPage(() => 0);
          }}
          options={[
            { value: "all", label: "All" },
            { value: "info", label: "Info" },
            { value: "warning", label: "Warning" },
            { value: "critical", label: "Critical" },
          ]}
        />
        <TableFilter
          label="Category"
          value={categoryFilter}
          onChange={(value) => {
            setCategoryFilter(value);
            setPage(() => 0);
          }}
          options={[
            { value: "all", label: "All categories" },
            { value: "billing", label: "Billing" },
            { value: "model", label: "Model" },
            { value: "security", label: "Security" },
            { value: "moderator", label: "Moderator" },
            { value: "abuse", label: "Abuse" },
          ]}
        />
        {/* Two native date inputs, kept as they were: a date range is the one
            filter here with no segmented or select form, and the brief adds no
            control for it. */}
        <input
          type="date"
          className="dp-tableselect"
          aria-label="From date"
          value={startDate}
          onChange={(event) => {
            setStartDate(event.target.value);
            setPage(() => 0);
          }}
        />
        <input
          type="date"
          className="dp-tableselect"
          aria-label="To date"
          value={endDate}
          onChange={(event) => {
            setEndDate(event.target.value);
            setPage(() => 0);
          }}
        />
        {hasFilters ? (
          <Button variant="quiet" size="small" onClick={onResetFilters}>
            Reset
          </Button>
        ) : null}
        <Button
          variant="quiet"
          size="small"
          onClick={handleExport}
          disabled={isExporting || logsQuery.isLoading}
        >
          {isExporting ? "Exporting…" : "Export CSV"}
        </Button>
      </TableHead>

      <DataTable
        columns={[
          { label: "Severity", width: "0 0 104px" },
          { label: "Action", width: "1 1 0" },
          { label: "User", width: "0 0 92px" },
          { label: "IP", width: "0 0 148px" },
          { label: "When", width: "0 0 148px" },
        ]}
        rows={rows}
        loading={logsQuery.isLoading}
        openId={selectedLog ? String(selectedLog.id) : null}
        onOpenChange={(id) =>
          onSelectLog(id === null ? null : logs.find((log) => String(log.id) === id) ?? null)
        }
        empty={{
          title: "No audit entries match those filters.",
          body: "Widen the severity or category, or clear the date range.",
        }}
        footer={{
          meta: pageRange({
            offset: page * PAGE_SIZE,
            count: logs.length,
            total: logsQuery.data?.total,
          }),
          onBack: () => setPage((p) => Math.max(0, p - 1)),
          onNext: () => setPage((p) => Math.min(totalPages - 1, p + 1)),
          backDisabled: page === 0,
          nextDisabled: page >= totalPages - 1,
        }}
      />
    </div>
  );
}

/**
 * The critical alerts, above the table. A different question from the log —
 * *what needs looking at right now* rather than *what happened* — so it keeps
 * its own shape, drawn on the accent tokens rather than a red wash.
 */
function AbuseAlerts({
  alertsQuery,
  onOpenChangeRequest,
}: {
  alertsQuery: any;
  onOpenChangeRequest: (options?: OpenChangeRequestOptions) => void;
}) {
  return (
    <div className="dp-alertpanel">
      <div className="dp-tablehead">
        <span className="dp-eyebrow">Needs looking at</span>
        <span className="dp-tablehead__rule" />
        {/*
          ⚠ "IN THE LAST DAY" IS GONE, AND THERE WAS NEVER A DAY BEHIND IT
          (#946). `getAbuseAlertsSummary` has no time condition in it; the
          number was the criticals among the newest TEN abuse rows, so it could
          never exceed ten and it fell to zero the moment ten newer warnings
          arrived — which also took this whole panel off the page, because it
          renders on that same number. The count is now every critical abuse
          row, and the sentence says what it counts. Each row below carries its
          own timestamp, which is where "when" belongs.
        */}
        <span className="dp-small">{alertsQuery.data?.criticalCount} critical</span>
      </div>
      {alertsQuery.data?.alerts.slice(0, 5).map((alert: any) => (
        <div key={alert.id} className="dp-alertpanel__row">
          <StatePill label={alert.severity} attention />
          <span className="dp-alertpanel__what">{formatAction(alert.action)}</span>
          <span className="dp-table__id">{staffDateTime(alert.createdAt)}</span>
          <Button
            variant="secondary"
            size="small"
            onClick={() => {
              const metadata = alert.metadata as Record<string, unknown> | null;
              onOpenChangeRequest({
                type: metadata?.ipAddress ? "block_ip" : "flag_account",
                targetUserId: alert.userId?.toString() || "",
                targetUserName: (metadata?.userName as string) || undefined,
                relatedAuditLogId: alert.id,
                ipAddress: (metadata?.ipAddress as string) || undefined,
              });
            }}
          >
            Raise a request
          </Button>
        </div>
      ))}
    </div>
  );
}
