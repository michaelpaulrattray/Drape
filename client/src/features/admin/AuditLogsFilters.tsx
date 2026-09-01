import { RowId, StatePill } from "@/features/staff";
import { Button, DataTable, Skeleton, TableFilter, TableHead, TableSearch } from "@/foundation";
import type { DataRow } from "@/foundation";
import {
  formatAction,
  formatDate,
  type AuditLog,
} from "./adminConstants";

interface StatsData {
  totalLogs: number;
  last24Hours: number;
}

interface AlertsData {
  criticalCount: number;
  warningCount: number;
  alerts: Array<{
    id: number;
    severity: string;
    action: string;
    userId: number | null;
    createdAt: Date;
  }>;
}

interface AuditLogsFiltersProps {
  statsData?: StatsData;
  statsLoading: boolean;
  alertsData?: AlertsData;
  alertsLoading: boolean;
  severityFilter: string;
  setSeverityFilter: (v: string) => void;
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  userIdSearch: string;
  setUserIdSearch: (v: string) => void;
  setPage: (fn: (p: number) => number) => void;
  onResetFilters: () => void;
}

/**
 * The four counts above the audit table.
 *
 * ⚠ **Only one of them carries colour now, and that is brief 06 §4's rule
 * applied to a figure rather than a pill**: `Critical alerts` is the number a
 * reader opens this page to check. Total logs, last 24 hours and warnings are
 * facts about volume — they were emerald-adjacent black, red and amber, and
 * when three figures out of four are coloured the fourth cannot stand out.
 *
 * They stay tiles rather than becoming a table: they are not a list of
 * records, and brief 07 owns the dashboard shape.
 */
export function AuditStatsCards({
  statsData,
  statsLoading,
  alertsData,
  alertsLoading,
}: Pick<AuditLogsFiltersProps, "statsData" | "statsLoading" | "alertsData" | "alertsLoading">) {
  const tiles: { label: string; value: number | undefined; loading: boolean; alert?: boolean }[] = [
    { label: "Total entries", value: statsData?.totalLogs, loading: statsLoading },
    { label: "Last 24 hours", value: statsData?.last24Hours, loading: statsLoading },
    {
      label: "Critical alerts",
      value: alertsData?.criticalCount,
      loading: alertsLoading,
      alert: (alertsData?.criticalCount || 0) > 0,
    },
    { label: "Warnings", value: alertsData?.warningCount, loading: alertsLoading },
  ];

  return (
    <div className="dp-countrow">
      {tiles.map((tile) => (
        <div key={tile.label} className="dp-counttile">
          <span className="dp-chrome">{tile.label}</span>
          {tile.loading ? (
            <Skeleton className="dp-counttile__skeleton" />
          ) : (
            <span className={`dp-counttile__value${tile.alert ? " dp-counttile__value--alert" : ""}`}>
              {tile.value ?? 0}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * The critical alerts, above the table.
 *
 * ⚠ **It was the detail modal's second entrance and that entrance is gone.**
 * Clicking an alert used to open `AuditLogDetailModal`; with rows opening in
 * place, setting `selectedLog` to an alert would try to open a row that is
 * very likely not on the current page — so the panel would silently do
 * nothing. **This is the class of defect deleting a shared modal creates:
 * every OTHER entrance to it becomes a dead control**, and grepping for the
 * component name is what finds them.
 *
 * The five alerts are the same table pattern instead, expanding in place
 * against their own rows. Nothing was lost: the modal showed exactly these
 * facts.
 */
export function AbuseAlertsPanel({
  alertsData,
}: Pick<AuditLogsFiltersProps, "alertsData">) {
  if (!alertsData || (alertsData.criticalCount || 0) === 0) return null;

  const rows: DataRow[] = alertsData.alerts.slice(0, 5).map((alert) => ({
    id: String(alert.id),
    cells: [
      <StatePill key="severity" label={alert.severity} attention />,
      <span key="action">{formatAction(alert.action)}</span>,
      <RowId key="user">{alert.userId ? `#${alert.userId}` : "system"}</RowId>,
      <span key="when">{formatDate(alert.createdAt)}</span>,
    ],
    facts: [
      { label: "ENTRY", value: `#${alert.id}` },
      { label: "ACTION", value: alert.action },
      { label: "WHEN", value: formatDate(alert.createdAt) },
      { label: "USER", value: alert.userId ? `#${alert.userId}` : "system" },
    ],
  }));

  return (
    <div className="dp-alertpanel">
      <div className="dp-tablehead">
        <span className="dp-eyebrow">Needs looking at</span>
        <span className="dp-tablehead__rule" />
        <span className="dp-small">{alertsData.criticalCount} critical</span>
      </div>
      <DataTable
        columns={[
          { label: "Severity", width: "0 0 104px" },
          { label: "Action", width: "1 1 0" },
          { label: "User", width: "0 0 92px" },
          { label: "When", width: "0 0 148px" },
        ]}
        rows={rows}
      />
    </div>
  );
}

/**
 * Audit logs' section head and filter cluster (brief 06 §3).
 *
 * Severity (4) and Category (5) show the rule working in both directions: four
 * options or fewer is segmented, more is a select, and `TableFilter` decides —
 * so a surface cannot get it wrong by choosing.
 *
 * The **Reset** button survives because filters here stack four deep and
 * clearing them one at a time is four clicks; it appears only when something
 * is actually set.
 */
export function AuditFiltersBar({
  severityFilter,
  setSeverityFilter,
  categoryFilter,
  setCategoryFilter,
  userIdSearch,
  setUserIdSearch,
  setPage,
  onResetFilters,
}: Omit<AuditLogsFiltersProps, "statsData" | "statsLoading" | "alertsData" | "alertsLoading" | "onSelectLog">) {
  const filtered = severityFilter !== "all" || categoryFilter !== "all" || userIdSearch !== "";
  return (
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
        onChange={(value) => { setSeverityFilter(value); setPage(() => 0); }}
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
        onChange={(value) => { setCategoryFilter(value); setPage(() => 0); }}
        options={[
          { value: "all", label: "All categories" },
          { value: "billing", label: "Billing" },
          { value: "model", label: "Model" },
          { value: "security", label: "Security" },
          { value: "abuse", label: "Abuse" },
        ]}
      />
      {filtered ? (
        <Button variant="quiet" size="small" onClick={onResetFilters}>
          Reset
        </Button>
      ) : null}
    </TableHead>
  );
}
