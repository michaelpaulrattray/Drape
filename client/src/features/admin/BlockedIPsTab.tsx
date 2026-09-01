/**
 * Admin → Audit logs → Blocked IPs, on the one staff table pattern.
 *
 * ⚠ **THE TWELFTH SURFACE, AND HIS BRIEF NAMES ELEVEN.** §1's table lists
 * Blocked IPs under Moderation only; there is a **second** blocked-IP list in
 * Admin — this file — sitting as a tab inside the audit-logs page, hand-rolled,
 * over the same data, and carrying an **Unblock** action the moderator's copy
 * does not have. The blank canvas could not know it was there.
 *
 * It is converted with the eleven and declared on the card, because leaving it
 * would ship *"no surface hand-rolls rows"* while a hand-rolled row list sat
 * one tab away inside a page this brief rebuilds.
 */
import { RowId, StatePill, pageRange } from "@/features/staff";
import { Button, DataTable } from "@/foundation";
import type { DataRow } from "@/foundation";

import { formatDate } from "./adminConstants";

interface BlockedIP {
  id: number;
  ipAddress: string;
  reason: string;
  blockedBy: number;
  expiresAt: string | null;
  createdAt: string;
}

interface BlockedIPsTabProps {
  ips: BlockedIP[];
  isLoading: boolean;
  onBlockIp: () => void;
  onUnblockIp: (ipAddress: string) => void;
  unblockPending: boolean;
}

export function BlockedIPsTab({
  ips,
  isLoading,
  onBlockIp,
  onUnblockIp,
  unblockPending,
}: BlockedIPsTabProps) {
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
          /* A block still in force is what someone is scanning for; one that
             has already lapsed is a resting state. */
          attention={!lifted}
        />,
        <span key="blocked">{formatDate(new Date(ip.createdAt))}</span>,
      ],
      facts: [
        { label: "ADDRESS", value: ip.ipAddress },
        { label: "BLOCKED BY", value: `Admin #${ip.blockedBy}` },
        { label: "BLOCKED", value: formatDate(new Date(ip.createdAt)) },
        {
          label: "EXPIRES",
          value: ip.expiresAt ? formatDate(new Date(ip.expiresAt)) : "Never",
        },
      ],
      evidence: ip.reason,
      actions: lifted
        ? []
        : [
            {
              key: "unblock",
              label: unblockPending ? "Unblocking…" : "Unblock",
              onClick: () => onUnblockIp(ip.ipAddress),
              disabled: unblockPending,
              variant: "secondary",
            },
          ],
    };
  });

  return (
    <div className="dp-stack" style={{ gap: 16 }}>
      <div className="dp-tablehead">
        <span className="dp-eyebrow">Blocked IPs</span>
        <span className="dp-tablehead__rule" />
        <span className="dp-tablehead__filters">
          <Button size="small" onClick={onBlockIp}>
            Block an IP
          </Button>
        </span>
      </div>
      <DataTable
        columns={[
          { label: "Address", width: "0 0 148px" },
          { label: "Reason", width: "1 1 0" },
          { label: "Block", width: "0 0 104px" },
          { label: "Blocked", width: "0 0 148px" },
        ]}
        rows={rows}
        loading={isLoading}
        empty={{
          title: "No IP addresses are blocked.",
          body: "Block one from an audit entry, or add it by hand above.",
        }}
        footer={{ meta: pageRange({ offset: 0, count: ips.length, total: ips.length }) }}
      />
    </div>
  );
}
