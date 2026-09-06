/**
 * THE USAGE WINDOW — one reading of "how much has this account spent, over
 * which days", shared by every surface that says it.
 *
 * ⚠ **THIS MODULE EXISTS BECAUSE THE SAME DEFECT HAS NOW APPEARED TWICE, ON
 * TWO SURFACES, FROM ONE CAUSE — #381 and #385.** `points.creditsUsed` is set
 * to 0 when the row is made and only ever incremented
 * (`server/db/credits.ts`); nothing resets it at a period boundary. So it is a
 * LIFETIME counter, and every surface that has read it as "this cycle" has
 * been wrong:
 *
 * 1. **The Usage pane** printed `115,695 credits used · of 5,000 this month` —
 *    a lifetime sum against a monthly allowance. The founder caught it by eye
 *    and named the class himself: *"two different windows on one line."*
 * 2. **Change plan and Add credits** divided the same lifetime figure by the
 *    days elapsed in ONE cycle to get a burn rate, and then an empty date from
 *    that. Measured on production 2026-09-01, no account could reach it
 *    (`readCycle` needs both period ends and zero rows had them), so nobody
 *    was ever shown it — it goes live silently on the first subscription.
 *
 * The repair on both is the same: **sum a real per-day window** from
 * `usage.getDailyUsage`, which returns rows the ledger actually holds. The
 * window arithmetic and the sum live HERE rather than in either surface, so
 * the two cannot drift apart the way the two readings of `creditsUsed` did
 * (working law 4 — derive, never mirror).
 *
 * The React half is `client/src/features/billing/useCycleSpend.ts`; this file
 * stays pure so it can be driven without a query client.
 */

/** A row of `usage.getDailyUsage` — a UTC day key and what was spent on it. */
export type DailyUsageRow = { date: string; creditsUsed: number };

/**
 * THE WINDOW, and the day it starts.
 *
 * `getDailyUsage` keys its rows on `new Date(createdAt).toISOString()` — UTC
 * days — so the window edge is computed in UTC too. Comparing a UTC row key
 * against a local-time boundary is how a day lands in the wrong month for ten
 * hours a day on this machine.
 *
 * ⚠ **`firstDay` IS THE FIRST DAY THE SERVER SEEDS, NEVER MERELY THE WINDOW'S
 * NOMINAL START.** `getDailyUsage(days)` selects from `now - days` but seeds its
 * map with the `days` days ENDING TODAY — so a transaction in the few hours
 * between those two edges arrives as an extra, earlier key that the seeding
 * never made room for. Measured on his rows at `days = 2`: the array came back
 * `[08-31, 09-01, 08-30]`, out of order, with a partial 3rd day on the end. A
 * filter keyed on the nominal start would have counted part of a day outside
 * the window it names; keyed on the first SEEDED day it drops cleanly.
 */
export function windowStart(
  periodStart: Date | null,
  balance: number,
  allowance: number,
): { firstDay: string; label: string; days: number; elapsedDays: number; note?: string } {
  const now = new Date();
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);

  if (periodStart && periodStart.getTime() <= now.getTime()) {
    const elapsedDays = Math.max(
      1,
      Math.ceil((now.getTime() - periodStart.getTime()) / 86_400_000) + 1,
    );
    /* `getDailyUsage` caps at 90; a period longer than that is an annual plan,
       and the cap is stated rather than silently truncating the answer. */
    const days = Math.min(90, elapsedDays);
    const seededFirst = new Date(now.getTime() - (days - 1) * 86_400_000);
    return {
      /* The later of the two edges: the period's own start when the whole
         period is seeded, the seeded edge when the 90-day cap has bitten. */
      firstDay: dayKey(periodStart) > dayKey(seededFirst) ? dayKey(periodStart) : dayKey(seededFirst),
      label: "this billing period",
      days,
      elapsedDays,
      note: allowance > 0 ? `of ${allowance.toLocaleString()} this billing period` : undefined,
    };
  }

  /*
    NO BILLING PERIOD — so no period to report on, and no allowance that
    renews. A fixed 30-day window is a real window that names itself, and the
    only true thing to say beside it is what is actually left.
  */
  const days = 30;
  return {
    firstDay: dayKey(new Date(now.getTime() - (days - 1) * 86_400_000)),
    label: "in the last 30 days",
    days,
    elapsedDays: days,
    note: `${balance.toLocaleString()} credits left`,
  };
}

/**
 * What the account spent inside the window — the sum both surfaces quote.
 *
 * ⚠ **AN ABSENT ARRAY IS NOT A ZERO SPEND, AND THIS FUNCTION CANNOT TELL YOU
 * WHICH IT IS.** It answers `0` for `undefined` because a sum of nothing is
 * zero, and the caller that knows the query is still in flight is the one that
 * must not render a rate off it. `useCycleSpend` is that caller and returns
 * `null` while the rows are missing; a second caller must do the same or say
 * why it need not.
 */
export function sumWindow(
  rows: DailyUsageRow[] | undefined | null,
  firstDay: string,
): number {
  return (rows ?? [])
    .filter((row) => row.date >= firstDay)
    .reduce((sum, row) => sum + row.creditsUsed, 0);
}
