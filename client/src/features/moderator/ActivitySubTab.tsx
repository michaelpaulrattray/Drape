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
import type { DataRow, RowAction } from "@/foundation";

import {
  formatDate,
  formatAction,
  formatFullDate,
  type OpenChangeRequestOptions,
} from "./moderatorConstants";

interface ActivitySubTabProps {
  userActivityQuery: any;
  onOpenChangeRequest: (options?: OpenChangeRequestOptions) => void;
}

export function ActivitySubTab({ userActivityQuery, onOpenChangeRequest }: ActivitySubTabProps) {
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
    actions: changeRequestAction(log),
  }));

  /*
    ⚠ **THIS ACTION WAS ALMOST DROPPED SILENTLY, WHICH IS THE WHOLE DANGER OF
    DELETING A SHARED MODAL.**

    `LogDetailModal` offered "Submit change request" on warning and critical
    entries, and these rows opened it. Converting them to expansions took the
    modal away and did not put the action back — reachable elsewhere, so
    nothing would have looked broken, and the PR body said the investigative
    tools were untouched while a removal sat inside one.

    It is restored on `AuditLogsTab`'s exact condition — warning or critical
    only — so the two surfaces offering the same thing agree on when.
  */
  function changeRequestAction(log: any): RowAction[] {
    if (log.severity !== "warning" && log.severity !== "critical") return [];
    return [
      {
        key: "request",
        label: "Raise a change request",
        variant: "secondary",
        onClick: () => {
          const metadata = log.metadata as Record<string, unknown> | null;
          onOpenChangeRequest({
            type: metadata?.ipAddress ? "block_ip" : log.userId ? "flag_account" : "note_incident",
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
