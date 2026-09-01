/**
 * Admin → Audit logs, on the one staff table pattern (brief 06).
 *
 * `AuditLogDetailModal` is gone. Its six facts, its raw metadata payload, its
 * user-status block and its four actions are this row's expansion — and the
 * reason that matters here more than anywhere: **an audit log is read in
 * runs.** Somebody following a suspicious account opens five entries in a row,
 * and a modal made them re-find their place in a 4,000-entry list five times.
 *
 * ⚠ **The user's status is a FACT here, not a pill in the row.** It belongs to
 * the account, not to the log entry, and it only arrives when a row is opened
 * (`getUserDetails` is enabled by the open row, exactly as it was by the open
 * modal). Putting it in a column would promise a value every row can show.
 */
import { RawPayload, RowId, StatePill, pageRange, SUSPEND_CONSEQUENCE } from "@/features/staff";
import { DataTable } from "@/foundation";
import type { DataRow, RowAction } from "@/foundation";

import {
  PAGE_SIZE,
  formatAction,
  formatDate,
  formatFullDate,
  getActionCategory,
  type AuditLog,
} from "./adminConstants";

interface UserDetails {
  name: string | null;
  email: string | null;
  role: string;
  suspendedAt: Date | null;
  suspendedReason: string | null;
  lockedUntil: Date | null;
}

interface AuditLogTableProps {
  logs: AuditLog[];
  isLoading: boolean;
  hasMore: boolean;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  selectedLog: AuditLog | null;
  onSelectLog: (log: AuditLog | null) => void;
  userDetails: UserDetails | undefined;
  onFilterByUser: (userId: string) => void;
  onSuspendUser: (userId: number) => void;
  onUnsuspendUser: (userId: number) => void;
  unsuspendPending: boolean;
  onBlockIp: (ip: string) => void;
}

export function AuditLogTable({
  logs,
  isLoading,
  hasMore,
  page,
  setPage,
  selectedLog,
  onSelectLog,
  userDetails,
  onFilterByUser,
  onSuspendUser,
  onUnsuspendUser,
  unsuspendPending,
  onBlockIp,
}: AuditLogTableProps) {
  const rows: DataRow[] = logs.map((log) => {
    const category = getActionCategory(log.action);
    const open = selectedLog?.id === log.id;
    const details = open ? userDetails : undefined;

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
        { label: "RESOURCE", value: log.resourceType ? `${log.resourceType} ${log.resourceId ?? ""}` : "—" },
        { label: "IP", value: log.ipAddress || "—" },
        { label: "USER AGENT", value: log.userAgent || "—" },
        ...(details
          ? [
              {
                label: "ACCOUNT",
                value: `${details.name || "Unknown"} · ${details.email || "no email"} · ${accountState(details)}`,
              },
            ]
          : []),
      ],
      evidence:
        log.metadata && Object.keys(log.metadata).length > 0 ? (
          <RawPayload value={log.metadata} />
        ) : undefined,
      actions: open ? logActions(log, details) : [],
    };
  });

  function logActions(log: AuditLog, details: UserDetails | undefined): RowAction[] {
    const actions: RowAction[] = [];
    if (log.userId) {
      actions.push({
        key: "filter",
        label: `Show only user #${log.userId}`,
        onClick: () => {
          onFilterByUser(String(log.userId));
          onSelectLog(null);
        },
      });
    }
    if (log.userId && details && !details.suspendedAt && details.role !== "admin") {
      actions.push({
        key: "suspend",
        label: "Suspend this account",
        onClick: () => onSuspendUser(log.userId!),
        destructive: true,
        consequence: SUSPEND_CONSEQUENCE,
      });
    }
    if (log.userId && details?.suspendedAt) {
      actions.push({
        key: "unsuspend",
        label: unsuspendPending ? "Unsuspending…" : "Unsuspend this account",
        onClick: () => onUnsuspendUser(log.userId!),
        disabled: unsuspendPending,
        variant: "secondary",
      });
    }
    if (log.ipAddress) {
      actions.push({
        key: "block",
        label: "Block this IP",
        onClick: () => onBlockIp(log.ipAddress!),
        destructive: true,
        /* ⚠ WHAT THIS SENTENCE SAYS AND WHAT IT ORIGINALLY SAID.

           It read "Blocking an IP turns away everyone behind it" — which is
           what a block MEANS, and is not what this product does. CLAUDE.md's
           "Currently not enforced" list has it, and it is re-verified at the
           bytes: the only non-test callers of `isIpBlocked` are its own
           declaration and `blockIp`'s duplicate check, so nothing on the
           request path ever consults the list.

           §5's rule is that the consequence says what it does, TO WHOM. A note
           describing an inert control as a live one is the worst possible use
           of a mechanism whose whole value is accuracy — an admin would block
           an abusive address, read that everyone behind it is turned away, and
           stop watching. */
        consequence:
          "This records the address on the block list. It does not turn anyone away yet — nothing on the request path checks that list, so treat it as a note for later rather than a defence.",
      });
    }
    return actions;
  }

  return (
    <DataTable
      columns={[
        { label: "Severity", width: "0 0 104px" },
        { label: "Action", width: "1 1 0" },
        { label: "User", width: "0 0 92px" },
        { label: "IP", width: "0 0 148px" },
        { label: "When", width: "0 0 148px" },
      ]}
      rows={rows}
      loading={isLoading}
      openId={selectedLog ? String(selectedLog.id) : null}
      onOpenChange={(id) => onSelectLog(id === null ? null : logs.find((l) => String(l.id) === id) ?? null)}
      empty={{
        title: "No audit entries match those filters.",
        body: "Widen the severity or category, or clear the user filter.",
      }}
      footer={{
        /* This procedure returns `hasMore`, never a total — so the range says
           what it knows and stops, rather than inventing one (§6). */
        meta: pageRange({ offset: page * PAGE_SIZE, count: logs.length }),
        onBack: () => setPage((p) => Math.max(0, p - 1)),
        onNext: () => setPage((p) => p + 1),
        backDisabled: page === 0,
        nextDisabled: !hasMore,
      }}
    />
  );
}

function accountState(details: UserDetails): string {
  if (details.suspendedAt) {
    return `suspended (${details.suspendedReason || "no reason recorded"})`;
  }
  if (details.lockedUntil && new Date(details.lockedUntil) > new Date()) {
    return "locked out";
  }
  return "active";
}
