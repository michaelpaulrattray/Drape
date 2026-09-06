import { trpc } from "@/lib/trpc";

import { sumWindow, windowStart } from "@/features/settings/usageWindow";

/**
 * WHAT THIS ACCOUNT HAS SPENT INSIDE ITS CURRENT BILLING CYCLE — #385.
 *
 * The two money modals used to take this from `billing.getStatus`'s
 * `creditsUsed`, which is a LIFETIME counter (`server/db/credits.ts` sets it to
 * 0 once and only ever adds to it). Dividing that by the days elapsed in ONE
 * cycle gave a burn rate, and the burn rate gave an empty date and the plan
 * recommendation — so on an account six months old the modal would have said
 * *"you run out on the 6th"* off a figure that was its entire history.
 *
 * ⚠ **`null` MEANS "NOT KNOWN YET", NEVER "SPENT NOTHING".** They are opposite
 * facts on this surface: a real zero is somebody who has not cast this cycle
 * and legitimately has no rate; a `null` is the query still in flight, and
 * rendering a rate off it would be the same shape of confident wrong number
 * this card is about. `readCycle` takes the `null` straight through and
 * `readBurn` then answers no rate at all, so the band hides itself rather than
 * printing a zero.
 *
 * ⚠ **THE QUERY COSTS NOTHING EXTRA ON A PAGE VIEW.** `AccountSurfaces` mounts
 * these modals only while one is open (its own docblock records the
 * measurement — an unconditional mount cost a paying customer a Stripe
 * proration read on every page view), so a query inside the modal fires when
 * the modal opens and not before. It also rides the same wave as `getStatus`
 * and `getPlans`, which the surface already waits on, so it adds no new
 * loading state that was not already there.
 */
export function useCycleSpend(
  periodStart: Date | null,
): { spent: number; elapsedDays: number } | null {
  /*
    `windowStart`'s balance and allowance arguments only feed the Usage pane's
    NOTE copy, which nothing here renders — so they are zero, and this call is
    used purely for the window edges the pane and the modals must agree on.
  */
  const { firstDay, days, elapsedDays } = windowStart(periodStart, 0, 0);
  const { data: daily } = trpc.usage.getDailyUsage.useQuery(
    { days },
    /* No period, no cycle, and nothing on this surface reads the answer — a
       free account never reaches the burn band at all (`readCycle` returns
       `null` without both period ends), so asking would buy a row set nobody
       looks at. */
    { enabled: periodStart !== null },
  );
  if (!daily) return null;
  return { spent: sumWindow(daily, firstDay), elapsedDays };
}
