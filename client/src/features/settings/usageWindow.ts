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
import { displayBalance, formatCredits } from "@shared/creditDisplay";

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
 *
 * ⚠ **A `null` BASIS IS "NOT KNOWN YET", AND IT GETS NO WINDOW WORDS AT ALL**
 * (PR #634 review, the one finding). The first draft defaulted a missing basis
 * to `rolling30`, so a SUBSCRIBED account opening the pane read *"Usage in the
 * last 30 days"* and *"61,000 credits left"* for one render beat before it
 * flipped — real data attached to a claim about a window nobody had summed,
 * which is this module's own docblock warning inverted. The figures were
 * honestly em-dashed while the words were not, and the words are the half a
 * customer reads first.
 *
 * So there is no default: the window is named only once the server has said
 * which one it summed, and until then the heading is the bare noun.
 *
 * ⚠ **AND THE ALLOWANCE IS THE THIRD HALF OF THE SAME GUARD — #1741.** The
 * paragraph below caught `balance` and left `allowance` on the reading that a
 * zero quotes nothing. True of a zero; it was not a zero. `allowance` reached
 * here out of a plan-catalogue lookup keyed on a DEFAULTED plan id, so for the
 * beat before `billing.getStatus` answered it was the FREE rung's grant — and
 * the period branch printed *"of 13,500 this billing period"* at a subscriber
 * whose allowance is nothing like it. Real window words, a real-looking figure,
 * the wrong plan. It is `number | null` now and a `null` gets no note, on the
 * same ground as the other two.
 *
 * ⚠ **AND THE SAME RULE NOW BINDS THE FIGURE, WHICH IT DID NOT — #1703, 2026-10-01.**
 * The guard above is about the basis, and the basis comes from
 * `usage.getCycleSpend`; `balance` comes from `billing.getStatus`, which is a
 * DIFFERENT query. So the free branch below could be reached with a known window
 * and an unknown balance, and it printed *"0 credits left"* — real window words
 * attached to a figure nobody had read, which is this docblock's own warning
 * with the two halves swapped. **Guarding the words and not the number they
 * quote is half a guard**, and a `null` balance now gets no note at all on the
 * same ground a `null` basis gets no window.
 */
export function spendWindowCopy(
  basis: SpendBasis | null,
  balance: number | null,
  allowance: number | null,
): { heading: string; over: string | null; note?: string } {
  if (basis === null) {
    /* The honest loading state: a title that claims nothing, no note, and no
       span under the rate — the values are em dashes beside it. */
    return { heading: "Usage", over: null };
  }
  if (basis === "period") {
    return {
      heading: "Usage this billing period",
      /* ⚠ TWO PHRASINGS OF ONE WINDOW, because English needs both and a
         surface writing its own second one is how the two came apart before:
         `Usage this billing period` heads the group, `averaged over this
         billing period` sits under a rate. The free window cannot use one
         string for both — *"averaged over in the last 30 days"*. */
      over: "this billing period",
      /* ⚠ `null` IS NOT ZERO AND NEITHER MAY BE QUOTED (#1741) — see the
         docblock. A `null` here is "nobody has read the plan yet"; a 0 is the
         free rung, which has no period to measure against in the first place. */
      note:
        allowance !== null && allowance > 0
          ? `of ${formatCredits(displayBalance(allowance))} this billing period`
          : undefined,
    };
  }
  return {
    heading: "Usage in the last 30 days",
    over: "the last 30 days",
    /* ⚠ NOT KNOWN YET IS NOT ZERO (#1703). A pool that does not refill is
       described by the pool itself, so this note is the one true figure beside
       the free window — and a figure nobody has read yet is not that figure. No
       note is the honest answer for the beat before `getStatus` lands; the
       heading and the window words above are already true without it. */
    note: balance === null
      ? undefined
      : `${formatCredits(displayBalance(balance))} credits left`,
  };
}
