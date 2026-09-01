/**
 * Moderation → Flagged referrals, on the one staff table pattern (brief 06).
 *
 * Referrals where the referee's IP matched the referrer's within 24 hours —
 * i.e. somebody probably referring themselves.
 *
 * # Three columns became facts, and the table got readable
 *
 * The old table had SEVEN columns in a `<table>` inside no scroller, three of
 * which were stacked pairs: two IPs over an "Exact match" badge, two credit
 * lines, a name over an id. At 1280px the referrer and referee names each had
 * about 150px. **The identifying column — who referred whom — takes the
 * flexible basis now, and the pairs are facts inside the expansion**, which is
 * where a two-line value has room to be read.
 *
 * The **Exact match** badge is the one that mattered and it is a state pill in
 * a column of its own: a same-IP flag where the addresses are byte-identical
 * is the strongest signal on this surface, and it was a 10px badge stacked
 * under two mono addresses.
 */
import { RowId, RowStack, StatePill, pageRange } from "@/features/staff";
import { DataTable } from "@/foundation";
import type { DataRow } from "@/foundation";

import { formatDate, type OpenChangeRequestOptions } from "./moderatorConstants";

const PAGE_SIZE = 20;

interface FlaggedReferral {
  id: number;
  referrerUserId: number;
  referrerName: string | null;
  referrerEmail: string | null;
  referredUserId: number | null;
  referredName: string | null;
  referredEmail: string | null;
  referrerIp: string | null;
  referredIp: string | null;
  status: string;
  creditsAwarded: number;
  referrerCredited: boolean;
  referredCredited: boolean;
  createdAt: Date;
  completedAt: Date | null;
}

interface FlaggedReferralsTabProps {
  data: { items: FlaggedReferral[]; total: number } | undefined;
  isLoading: boolean;
  page: number;
  setPage: (page: number) => void;
  onOpenChangeRequest: (options: OpenChangeRequestOptions) => void;
}

export function FlaggedReferralsTab({
  data,
  isLoading,
  page,
  setPage,
  onOpenChangeRequest,
}: FlaggedReferralsTabProps) {
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const rows: DataRow[] = items.map((item) => {
    const exactMatch = Boolean(
      item.referrerIp && item.referredIp && item.referrerIp === item.referredIp,
    );
    return {
      id: String(item.id),
      cells: [
        <RowStack
          key="who"
          name={
            <>
              <RowId>#{item.referrerUserId}</RowId> {item.referrerName || "Unknown"}
            </>
          }
          meta={`referred ${item.referredName || item.referredEmail || "somebody who never signed up"}`}
        />,
        <StatePill key="match" label={exactMatch ? "same IP" : "near match"} attention={exactMatch} />,
        <span key="status">{item.status.replace("_", " ")}</span>,
        <span key="credits">
          {item.referrerCredited || item.referredCredited ? `${item.creditsAwarded} cr` : "—"}
        </span>,
        <span key="when">{formatDate(item.createdAt)}</span>,
      ],
      facts: [
        {
          label: "REFERRER",
          value: `${item.referrerName || "Unknown"} · ${item.referrerEmail || "no email"} · #${item.referrerUserId}`,
        },
        {
          label: "REFEREE",
          value: item.referredUserId
            ? `${item.referredName || "Unknown"} · ${item.referredEmail || "no email"} · #${item.referredUserId}`
            : "Never signed up",
        },
        { label: "REFERRER IP", value: item.referrerIp || "—" },
        { label: "REFEREE IP", value: item.referredIp || "—" },
        {
          label: "REFERRER PAID",
          value: item.referrerCredited ? `${item.creditsAwarded} credits` : "not paid",
        },
        {
          label: "REFEREE PAID",
          value: item.referredCredited ? `${item.creditsAwarded} credits` : "not paid",
        },
        { label: "STARTED", value: formatDate(item.createdAt) },
        { label: "COMPLETED", value: item.completedAt ? formatDate(item.completedAt) : "—" },
      ],
      evidence: exactMatch
        ? "Both sides signed up from the same IP address within 24 hours. That is one household, one office, or one person with two accounts — the flag cannot tell them apart, which is why it is a queue and not a block."
        : "The referee's address matched the referrer's within 24 hours.",
      actions: [
        {
          key: "review",
          label: "Raise a change request",
          onClick: () =>
            onOpenChangeRequest({
              type: "flag_account",
              targetUserId: String(item.referrerUserId),
              targetUserName: item.referrerName || undefined,
              ipAddress: item.referrerIp || undefined,
            }),
          variant: "secondary",
        },
      ],
    };
  });

  return (
    <div className="dp-stack" style={{ gap: 16 }}>
      <div className="dp-tablehead">
        <span className="dp-eyebrow">Flagged referrals</span>
        <span className="dp-tablehead__rule" />
        <span className="dp-small">Referee's IP matched the referrer's within 24 hours</span>
      </div>
      <DataTable
        columns={[
          { label: "Referral", width: "1 1 0" },
          { label: "Match", width: "0 0 104px" },
          { label: "Status", width: "0 0 104px" },
          { label: "Credits", width: "0 0 88px" },
          { label: "Started", width: "0 0 148px" },
        ]}
        rows={rows}
        loading={isLoading}
        empty={{
          title: "No flagged referrals.",
          body: "Nothing has tripped the same-IP check yet.",
        }}
        footer={{
          meta: pageRange({ offset: page * PAGE_SIZE, count: items.length, total }),
          onBack: () => setPage(page - 1),
          onNext: () => setPage(page + 1),
          backDisabled: page === 0,
          nextDisabled: page >= totalPages - 1,
        }}
      />
    </div>
  );
}
