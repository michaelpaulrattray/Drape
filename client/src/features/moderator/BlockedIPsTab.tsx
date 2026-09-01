/**
 * Moderation → Blocked IPs, on the one staff table pattern (brief 06).
 *
 * ⚠ **A moderator SEES this list and cannot change it** — there is no unblock
 * procedure on the moderator router, and this brief adds none (§7: *"Do not add
 * a query or change a mutation"*). So the row expands to show the block's
 * reason and dates and offers nothing, which is the honest shape: the admin
 * copy of this list one panel over is the one with the Unblock action.
 */
import { RowId, StatePill, pageRange } from "@/features/staff";
import { DataTable } from "@/foundation";
import type { DataRow } from "@/foundation";

import { formatDate } from "./moderatorConstants";

interface BlockedIPsTabProps {
  blockedIpsQuery: any;
}

export function BlockedIPsTab({ blockedIpsQuery }: BlockedIPsTabProps) {
  const ips: any[] = blockedIpsQuery.data?.ips ?? [];

  const rows: DataRow[] = ips.map((ip) => {
    const lifted = ip.expiresAt !== null && new Date(ip.expiresAt) <= new Date();
    return {
      id: String(ip.id),
      cells: [
        <RowId key="ip">{ip.ipAddress}</RowId>,
        <span key="reason">{ip.reason}</span>,
        <StatePill
          key="state"
          label={lifted ? "expired" : ip.expiresAt ? "temporary" : "permanent"}
          attention={!lifted}
        />,
        <span key="blocked">{formatDate(new Date(ip.createdAt))}</span>,
      ],
      facts: [
        { label: "ADDRESS", value: ip.ipAddress },
        { label: "BLOCKED BY", value: `Admin #${ip.blockedBy}` },
        { label: "BLOCKED", value: formatDate(new Date(ip.createdAt)) },
        { label: "EXPIRES", value: ip.expiresAt ? formatDate(new Date(ip.expiresAt)) : "Never" },
      ],
      evidence: ip.reason,
    };
  });

  return (
    <div className="dp-stack" style={{ gap: 16 }}>
      <div className="dp-tablehead">
        <span className="dp-eyebrow">Blocked IPs</span>
        <span className="dp-tablehead__rule" />
        <span className="dp-small">An admin blocks and unblocks these</span>
      </div>
      <DataTable
        columns={[
          { label: "Address", width: "0 0 148px" },
          { label: "Reason", width: "1 1 0" },
          { label: "Block", width: "0 0 104px" },
          { label: "Blocked", width: "0 0 148px" },
        ]}
        rows={rows}
        loading={blockedIpsQuery.isLoading}
        empty={{
          title: "No IP addresses are blocked.",
          body: "An admin blocks these from the audit log.",
        }}
        footer={{ meta: pageRange({ offset: 0, count: ips.length, total: blockedIpsQuery.data?.total }) }}
      />
    </div>
  );
}
