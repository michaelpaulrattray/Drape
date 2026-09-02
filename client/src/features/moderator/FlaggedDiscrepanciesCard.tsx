/**
 * FLAGGED DISCREPANCIES — *"Which accounts need looking at?"*
 *
 * Brief 09 §5: *"the moderator's equivalent of Overview's 'needs a human':
 * dashed cards while unresolved, solid once handled, each linking to that
 * account's reconciliation."*
 *
 * ## ⚠ His own check, run — Overview's attention card does NOT serve this
 *
 * §5 asks first: *"Check whether Overview's attention card serves it before
 * writing a second one."* It does not, and `NeedsHuman.tsx`'s own docblock says
 * why in its own words: flagged discrepancies are one of the two sources that
 * card deliberately omits, because `getUsersWithDiscrepancies(threshold)` is a
 * separate procedure and *"it would need this card to invent a threshold."*
 * That threshold is a control on THIS card. So this stays where it is.
 *
 * ## ⚠ DASHED IS THE ONLY STATE, AND THAT IS MEASURED RATHER THAN LAZY
 *
 * *"Solid once handled"* has no population here. An account leaves this list
 * the moment its discrepancy falls below the threshold — nothing is ever
 * handled *in place*, exactly as `NeedsHuman` records for the admin side. A
 * solid variant would be a branch no data can reach, which reads as tested and
 * is not; #398 caught the same shape on the eye gallery's judged tiles.
 *
 * The one state variation that IS reachable: when nothing is flagged the border
 * stops being dashed, because a dashed frame around *"nothing needs you"* is an
 * empty card asking for attention.
 *
 * ## Colour
 *
 * The severity ladder is gone — red at 2000, amber at 1000, blue below. His §3:
 * *"when everything is coloured, the discrepancy is not."* Every row's figure
 * is `--errorInk` because every row on this card IS the fault; the ladder is
 * carried by the sort order and by the number itself.
 */
import { useMemo, useState } from "react";

import { Button, Chip, EmptyState, Skeleton, TableHead } from "@/foundation";
import { trpc } from "@/lib/trpc";

import "./investigations.css";

interface FlaggedDiscrepanciesCardProps {
  /**
   * ⚠ **`identity` is the SEARCH STRING the destination needs, not decoration.**
   * The investigation opens inside the account's row, so the caller has to put
   * that account into the list before selecting it — and `listUsers` matches
   * `name`, `email` and `openId`, never the numeric id. Handing the caller the
   * id alone is what made the link-through silently do nothing (#412 review).
   */
  onSelectUser: (userId: number, identity: string | null) => void;
  autoRefreshInterval?: number | false;
}

/**
 * ⚠ **THE SIGN AND GROUPING RULES ARE THE RECONCILIATION PANE'S, APPLIED HERE
 * TOO** (#412 review, finding 3 — law 7's sweep, which this PR named and then
 * stopped one file short of).
 *
 * A discrepancy is flagged in BOTH directions — `getFlaggedUsers` compares
 * `|discrepancy|` against the threshold, and the server's own summary wording
 * includes *"charged less than the records show"* — so a negative one is
 * reachable, and it was rendering as `-1240`: an ASCII hyphen and no thousands
 * separator, in mono, on the same page where the pane insists on U+2212 and
 * `toLocaleString`.
 */
const signed = (n: number): string => {
  if (n === 0) return "0";
  return n > 0
    ? `+${n.toLocaleString()}`
    : `−${Math.abs(n).toLocaleString()}`;
};

/** Unsigned, but grouped — a charged total is still a number a person reads. */
const grouped = (n: number): string => n.toLocaleString();

const DEFAULT_THRESHOLD = 500;
const THRESHOLDS = [100, 250, 500, 1000, 2000, 5000];

export function FlaggedDiscrepanciesCard({
  onSelectUser,
  autoRefreshInterval = false,
}: FlaggedDiscrepanciesCardProps) {
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [expanded, setExpanded] = useState(false);

  const flaggedQuery = trpc.moderatorReconciliation.getFlaggedUsers.useQuery(
    { threshold },
    { refetchInterval: autoRefreshInterval }
  );

  const flaggedUsers = flaggedQuery.data?.users ?? [];
  const scannedCount = flaggedQuery.data?.scannedCount ?? 0;
  const flaggedCount = flaggedUsers.length;

  const visibleUsers = useMemo(
    () => (expanded ? flaggedUsers : flaggedUsers.slice(0, 5)),
    [expanded, flaggedUsers]
  );

  return (
    <div
      className={`dp-inv__flagged${flaggedCount === 0 ? " dp-inv__flagged--clear" : ""}`}
    >
      <TableHead eyebrow="Credit discrepancies">
        {/*
          The threshold was behind a gear that opened a hidden row. It is the
          question this card answers — "above what?" — so it is the card's
          filter, in the head, where every other staff filter lives.
        */}
        <span className="dp-inv__thresholds">
          {THRESHOLDS.map((t) => (
            <Chip
              key={t}
              aria-pressed={threshold === t}
              className={threshold === t ? "dp-chip--static" : undefined}
              onClick={() => setThreshold(t)}
            >
              {t}+
            </Chip>
          ))}
        </span>
      </TableHead>

      {flaggedQuery.isLoading ? (
        <div className="dp-inv__flaggedrows">
          <Skeleton style={{ height: 38 }} />
          <Skeleton style={{ height: 38 }} />
        </div>
      ) : flaggedCount === 0 ? (
        <EmptyState
          title="No accounts need looking at."
          body={`Nothing above ${threshold} credits across ${scannedCount} accounts.`}
        />
      ) : (
        <>
          <p className="dp-inv__flaggedmeta">
            {flaggedCount} of {scannedCount} accounts scanned are above {threshold} credits
          </p>
          <div className="dp-inv__flaggedrows">
            {visibleUsers.map((user) => (
              <button
                key={user.userId}
                type="button"
                className="dp-inv__flaggedrow"
                onClick={() => onSelectUser(user.userId, user.email ?? user.userName)}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="dp-inv__flaggedname">
                    {user.userName || `User #${user.userId}`}
                  </span>
                  <span className="dp-inv__flaggedmeta" style={{ display: "block" }}>
                    Charged {grouped(user.grossDeductions)} · recorded{" "}
                    {grouped(user.expectedCost)}
                    {user.failedGenerations > 0 ? ` · ${user.failedGenerations} failed` : ""}
                    {user.refundAnomaly ? " · refunds exceed charges" : ""}
                  </span>
                </span>
                <span className="dp-inv__flaggedfigure">{signed(user.discrepancy)}</span>
              </button>
            ))}
          </div>
          {flaggedCount > 5 && (
            <div className="dp-inv__subjectaction">
              <Button variant="quiet" size="small" onClick={() => setExpanded(!expanded)}>
                {expanded ? "Show fewer" : `Show all ${flaggedCount}`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
