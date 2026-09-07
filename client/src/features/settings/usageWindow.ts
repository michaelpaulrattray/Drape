/**
 * THE USAGE WINDOW'S COPY — what a spend figure is named, once, for every
 * surface that shows one.
 *
 * ⚠ **THIS MODULE USED TO OWN THE WINDOW ITSELF AND NO LONGER CAN — #624,
 * his approved option (a).** It computed a first UTC DAY and summed
 * `usage.getDailyUsage`'s whole-day buckets inside it. That was the best a
 * client could do and it was never enough: a real billing period begins at a
 * mid-day INSTANT (the period starts when the customer pays), the buckets are
 * keyed by day, and the sub-day edge does not survive the query. So a period
 * that rolled over at 14:00 counted the fourteen hours of the PREVIOUS cycle
 * that shared its date, and on a fresh cycle — where the divisor is smallest —
 * that error carried the whole burn rate into the plan recommendation.
 *
 * **The window is now `usage.getCycleSpend` on the server** (`server/db/billing.ts`),
 * which sums the ledger between `currentPeriodStart` and now at timestamp
 * precision, with no 90-day cap. The two client-side functions that lived here
 * — `windowStart` and `sumWindow` — are gone rather than left with corrected
 * docblocks, because a reassembly of day buckets is not a repairable road.
 *
 * What genuinely still belongs on the client is the COPY, and it is here for
 * the reason the arithmetic used to be: the Usage pane and the two money modals
 * must name the same window, and two hand-written labels drift (working law 4).
 *
 * ⚠ **AND IT IS DERIVED FROM THE `basis` THE SERVER ACTUALLY SUMMED, never a
 * second time from the period start.** A label reading *"this billing period"*
 * over a rolling 30-day sum is the same defect one layer up, and deciding it
 * twice from one input is exactly how the two readings of `creditsUsed` came
 * apart in #381 and #385.
 *
 * The React half is `client/src/features/billing/useCycleSpend.ts`; this file
 * stays pure so it can be driven without a query client.
 */

/** Which window the server summed — `usage.getCycleSpend`'s own word for it. */
export type SpendBasis = "period" | "rolling30";

/**
 * What to call the window, and what may honestly be said beside the figure.
 *
 * ⚠ **NO BILLING PERIOD MEANS NO MONTHLY-ALLOWANCE CLAIM** (#387 item 2, and
 * the founder caught the original by eye). `refreshMonthlyCredits` is never
 * reached for the free tier, so *"of 5,000 this month"* promised a refill that
 * never arrives. The only true figure beside a pool that does not refill is
 * the pool itself.
 */
export function spendWindowCopy(
  basis: SpendBasis,
  balance: number,
  allowance: number,
): { label: string; over: string; note?: string } {
  if (basis === "period") {
    return {
      label: "this billing period",
      /* ⚠ TWO PHRASINGS OF ONE WINDOW, because English needs both and a
         surface writing its own second one is how the two came apart before:
         `Usage this billing period` heads the group, `averaged over this
         billing period` sits under a rate. The free window cannot use one
         string for both — *"averaged over in the last 30 days"*. */
      over: "this billing period",
      note: allowance > 0 ? `of ${allowance.toLocaleString()} this billing period` : undefined,
    };
  }
  return {
    label: "in the last 30 days",
    over: "the last 30 days",
    note: `${balance.toLocaleString()} credits left`,
  };
}
