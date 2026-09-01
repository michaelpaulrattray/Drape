/**
 * Moderation → User investigation → Activity, on the one staff table pattern.
 *
 * ⚠ **THIS IS ONE OF THE TWO SURFACES BRIEF 06 CLAIMS THAT LIVE INSIDE THE
 * TOOL BRIEF 09 OWNS**, and the founder settled it himself in 09 §1: *"`
 * ActivitySubTab` and `GenerationsSubTab` are table-shaped and were covered by
 * brief 06."* So the two sub-tabs are converted here and **nothing around them
 * is touched** — the investigation tool's own frame, its user picker and its
 * other two sub-tabs are brief 09's.
 *
 * # The row opens instead of opening the audit modal
 *
 * Every row used to open `LogDetailModal` — the same dialog moderation's main
 * audit table opened, mounted on the dashboard, reached from two places. The
 * row expands now, so a moderator reading an account's history in a 400px-tall
 * scroller no longer loses it to a dialog. That was the modal's last consumer
 * and it is deleted.
 */
import { RawPayload, StatePill } from "@/features/staff";
import { DataTable } from "@/foundation";
import type { DataRow } from "@/foundation";

import { formatDate, formatAction, formatFullDate } from "./moderatorConstants";

interface ActivitySubTabProps {
  userActivityQuery: any;
}

export function ActivitySubTab({ userActivityQuery }: ActivitySubTabProps) {
  const activities: any[] = userActivityQuery.data?.logs ?? [];

  const rows: DataRow[] = activities.map((log) => ({
    id: String(log.id),
    cells: [
      <StatePill
        key="severity"
        label={log.severity}
        attention={log.severity === "critical" || log.severity === "warning"}
      />,
      <span key="action">{formatAction(log.action)}</span>,
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
    ],
    evidence:
      log.metadata && Object.keys(log.metadata).length > 0 ? (
        <RawPayload value={log.metadata} />
      ) : undefined,
  }));

  return (
    <DataTable
      columns={[
        { label: "Severity", width: "0 0 104px" },
        { label: "What happened", width: "1 1 0" },
        { label: "When", width: "0 0 148px" },
      ]}
      rows={rows}
      loading={userActivityQuery.isLoading}
      empty={{
        title: "No recorded activity for this account.",
        body: "Anything they do that the audit log watches will appear here.",
      }}
    />
  );
}
