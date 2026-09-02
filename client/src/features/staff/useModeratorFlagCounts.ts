import { useAuth } from "@/_core/hooks/useAuth";
import { DEFAULT_DISCREPANCY_THRESHOLD } from "@/features/moderator/flagThresholds";
import { trpc } from "@/lib/trpc";

/**
 * THE MODERATION BADGE'S NUMBER (#416).
 *
 * **His ask, 2026-09-01, verbatim:** *"the moderator pages should also have
 * notifications which show any flags thats come up that need attention. in the
 * profile drop down menu in the top bar next to admin and moderator the
 * notification count should sit next to each also e.g admin 4 or moderator 6"*
 *
 * # ⚠ WHAT IT COUNTS, AND THE ONE THING IT DELIBERATELY DOES NOT
 *
 * **Flagged referrals + flagged credit discrepancies.** Both are things a
 * moderator must ACT on: a referral pair sharing an IP, and an account whose
 * credits and records disagree.
 *
 * ⚠ **It does NOT count audit entries above `info` in 24h**, which is what
 * `00b-chrome-and-menus.md` and the retired `01-staff-shell.md` both proposed.
 * That line was written before either flagged surface existed. An audit log is
 * a RECORD — it fills every day whether or not anything is wrong — so a badge
 * counting it is never zero and therefore says nothing, which is the same
 * defect as a badge that never shows a number at all. The proposal is treated
 * as a proposal, per #416's own instruction, and the departure is stated here
 * rather than left for someone to rediscover from a diff.
 *
 * # Why these two readers and not a new one
 *
 * #416 §4 puts a new count query out of scope in those words. Both numbers come
 * off procedures the moderator surfaces already call:
 *
 * - `moderator.getFlaggedReferrals` returns `total` — an unbounded `COUNT(*)`
 *   over `sameIpFlag = true`, computed separately from the page it returns. So
 *   this asks for **one row** and reads the count beside it: the cheapest read
 *   that is still honest above 50 flagged referrals. Asking for `limit: 50` to
 *   "get the real number" would have been the wrong instinct — the list is not
 *   the count, and a count read off a page length is capped at the page.
 * - `moderatorReconciliation.getFlaggedUsers` returns every account above the
 *   threshold, so its `users.length` IS the count. There is no `total` to read
 *   and no cheaper procedure; if this scan is ever measured to cost, the repair
 *   is a count-only reader, one file, and this hook's shape survives it.
 *
 * ⚠ **The threshold is `DEFAULT_DISCREPANCY_THRESHOLD` and is imported, not
 * written.** Two reasons, and the second is the load-bearing one: the badge and
 * `FlaggedDiscrepanciesCard` must not each own a `500`; and passing the card's
 * own default means TanStack sees the SAME query key, so on the moderator
 * dashboard — where that card is always mounted — this badge costs nothing at
 * all. A moderator who narrows the card's chip forks the key and pays one more
 * read, which is the correct way round: the common path is free.
 *
 * # The gate
 *
 * `enabled` admits moderators and admins only, and only once auth has answered.
 * Both procedures are `moderatorProcedure` and would refuse anyone else — but a
 * query that fires and fails on every customer's render is two round trips
 * spent learning something the client already knows. **Admins are included
 * because `moderatorProcedure` admits them** (the capability grid: admins
 * inherit the entire moderator surface), and the menu shows them the row.
 *
 * # ⚠ Zero while loading, on purpose
 *
 * `showsMenuCount` omits the pill at zero, so an unanswered query draws NO pill
 * rather than a wrong one. The failure that avoids is a menu flashing a stale or
 * invented number every time it opens.
 */

/** Held this long before reopening the menu re-asks. Mirrors `useStaffCounts`. */
const STALE_MS = 30_000;

export interface ModeratorFlagCounts {
  flaggedReferrals: number;
  flaggedDiscrepancies: number;
  /** What the badge shows. Zero means the pill is omitted, never `(0)`. */
  total: number;
}

/**
 * THE ARITHMETIC, OUT WHERE A TEST CAN DRIVE IT (#416).
 *
 * ⚠ **This is the whole reason the hook is not one expression.** `pnpm test`
 * runs with no DOM by config, so a hook cannot be rendered here — and the
 * failure this card exists to fix is a badge that shows nothing FOREVER, which
 * every absence-only assertion is green against. So the part that can actually
 * be wrong lives in a pure function and is driven with NON-ZERO counts.
 *
 * Two of the three ways to get this wrong are one character apart and none of
 * them throws:
 *
 * - reading the referral count off `items.length` — the page, capped at
 *   whatever `limit` was asked for — instead of `total`, the unbounded
 *   `COUNT(*)` the procedure computes separately;
 * - reading the discrepancy count off `scannedCount`, which is how many
 *   accounts were EXAMINED and is never zero on a live database;
 * - dropping a `?? 0`, which makes the total `NaN` while a query is unanswered
 *   — and `NaN > 0` is `false`, so the pill would omit and nothing would look
 *   broken until the day it should have said something.
 */
export function readFlagCounts(
  referrals: { total?: number } | undefined,
  discrepancies: { users?: unknown[] } | undefined,
): ModeratorFlagCounts {
  const flaggedReferrals = referrals?.total ?? 0;
  const flaggedDiscrepancies = discrepancies?.users?.length ?? 0;
  return {
    flaggedReferrals,
    flaggedDiscrepancies,
    total: flaggedReferrals + flaggedDiscrepancies,
  };
}

export function useModeratorFlagCounts(): ModeratorFlagCounts {
  const { user, isAuthenticated } = useAuth();
  const isStaff = user?.role === "moderator" || user?.role === "admin";
  const enabled = isAuthenticated && isStaff;

  /*
    ⚠ ONLY OBSERVER-SCOPED OPTIONS HERE, and the reason is a defect that already
    shipped once on this exact shape (#415, caught by the gate review of PR
    #456). `retry` and its family are FETCH-level: TanStack resolves them from
    the LAST observer to set options on a key, not per observer the way
    `staleTime` works. `getFlaggedUsers` is observed by
    `FlaggedDiscrepanciesCard` at this same key, and this hook mounts inside the
    page that renders it — so a fetch-level option set here would silently
    change that card's behaviour on the moderator dashboard.
  */
  const referrals = trpc.moderator.getFlaggedReferrals.useQuery(
    { limit: 1, offset: 0 },
    { enabled, staleTime: STALE_MS },
  );

  const discrepancies = trpc.moderatorReconciliation.getFlaggedUsers.useQuery(
    { threshold: DEFAULT_DISCREPANCY_THRESHOLD },
    { enabled, staleTime: STALE_MS },
  );

  return readFlagCounts(referrals.data, discrepancies.data);
}
