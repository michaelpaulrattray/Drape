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
import { trpc } from "@/lib/trpc";

import {
  AuditLog,
  formatDate,
  formatAction,
  formatFullDate,
  getActionCategory,
  type OpenChangeRequestOptions,
} from "./moderatorConstants";

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

  const exportQuery = trpc.moderatorExports.exportAuditLogsCsv.useQuery(
    {
      severity: severityFilter as any,
      actionCategory: categoryFilter as any,
      userId: userIdSearch && !isNaN(parseInt(userIdSearch)) ? parseInt(userIdSearch) : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    },
    { enabled: false }
  );

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportQuery.refetch();
      if (result.data) {
        const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`Exported ${result.data.total} audit log entries`);
      }
    } catch {
      toast.error("Failed to export audit logs");
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
        <span key="when">{formatDate(log.createdAt)}</span>,
      ],
      facts: [
        { label: "ENTRY", value: `#${log.id}` },
        { label: "WHEN", value: formatFullDate(log.createdAt) },
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
        <span className="dp-small">{alertsQuery.data?.criticalCount} critical in the last day</span>
      </div>
      {alertsQuery.data?.alerts.slice(0, 5).map((alert: any) => (
        <div key={alert.id} className="dp-alertpanel__row">
          <StatePill label={alert.severity} attention />
          <span className="dp-alertpanel__what">{formatAction(alert.action)}</span>
          <span className="dp-table__id">{formatDate(alert.createdAt)}</span>
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
