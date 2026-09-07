import { trpc } from "@/lib/trpc";

import type { SpendBasis } from "@/features/settings/usageWindow";

/**
 * WHAT THIS ACCOUNT HAS SPENT INSIDE ITS CURRENT BILLING CYCLE — #385, now
 * asked of the server (#624, his approved option (a)).
 *
 * The two money modals used to take this from `billing.getStatus`'s
 * `creditsUsed`, which is a LIFETIME counter (`server/db/credits.ts` sets it to
 * 0 once and only ever adds to it). Dividing that by the days elapsed in ONE
 * cycle gave a burn rate, and the burn rate gave an empty date and the plan
 * recommendation — so on an account six months old the modal would have said
 * *"you run out on the 6th"* off a figure that was its entire history.
 *
 * ⚠ **#385's REPAIR WAS A CLIENT-SIDE REASSEMBLY AND IT CARRIED ITS OWN
 * DEFECT.** It summed `usage.getDailyUsage`'s whole-UTC-day buckets from the
 * DAY of `currentPeriodStart` — and every real Stripe period starts mid-day, so
 * up to a day of the PREVIOUS cycle was counted; the same endpoint caps at 90
 * days, so an annual period could not be covered at all. `usage.getCycleSpend`
 * sums the ledger between the period's own instant and now, uncapped. The
 * shape this hook returns is unchanged, so the modals did not move.
 *
 * ⚠ **`null` MEANS "NOT KNOWN YET", NEVER "SPENT NOTHING".** They are opposite
 * facts on this surface: a real zero is somebody who has not cast this cycle
 * and legitimately has no rate; a `null` is the query still in flight or
 * failed, and rendering a rate off it would be the same shape of confident
 * wrong number this card is about. `readCycle` takes the `null` straight
 * through and `readBurn` then answers no rate at all, so the band hides itself
 * rather than printing a zero.
 *
 * ⚠ **THE QUERY COSTS NOTHING EXTRA ON A PAGE VIEW.** `AccountSurfaces` mounts
 * these modals only while one is open (its own docblock records the
 * measurement — an unconditional mount cost a paying customer a Stripe
 * proration read on every page view), so a query inside the modal fires when
 * the modal opens and not before. It also rides the same wave as `getStatus`
 * and `getPlans`, which the surface already waits on, so it adds no new
 * loading state that was not already there.
 */
function useSpend(enabled: boolean) {
  const { data } = trpc.usage.getCycleSpend.useQuery(undefined, { enabled });
  return data ?? null;
}

/**
 * The cycle's spend for the two money modals, and the span it covers.
 *
 * The period start is the ENABLE GATE and nothing else — the window itself is
 * the server's, read from the same row this argument came from. A free account
 * never reaches the burn band at all (`readCycle` returns `null` without both
 * period ends), so asking would buy an answer nobody looks at.
 */
export function useCycleSpend(
  periodStart: Date | null,
): { spent: number; days: number } | null {
  const spend = useSpend(periodStart !== null);
  if (!spend) return null;
  /* ⚠ THE SPAN TRAVELS WITH THE SUM (PR #622 review, finding 1). Returning a
     bare number let the caller divide a capped total by the days the period had
     actually run. */
  return { spent: spend.spent, days: spend.days };
}

/**
 * The same reading for the Usage pane, which shows a figure for every account
 * and therefore asks unconditionally.
 *
 * ⚠ **IT IS THE SAME QUERY, NOT A SECOND ONE.** The pane and the modals quote
 * one cycle spend, and #381/#385 are what happens when two surfaces compute it
 * separately: they drift, and nothing looks wrong on either. `basis` says which
 * window the server actually summed, so the pane's label cannot describe a
 * different window from the one the number came from.
 */
export function useSpendWindow(): {
  spent: number;
  days: number;
  basis: SpendBasis;
} | null {
  const spend = useSpend(true);
  if (!spend) return null;
  return { spent: spend.spent, days: spend.days, basis: spend.basis };
}
