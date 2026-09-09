/**
 * WHERE A SUBSCRIPTION'S PERIOD ACTUALLY LIVES ON THIS STRIPE API VERSION
 * (#664, found by driving the annual switch against real test-mode Stripe).
 *
 * Stripe's Basil API (2025-03) moved `current_period_start/end` from the
 * Subscription onto its ITEMS, and this codebase's readers still asked the
 * subscription — every one of them was silently taking its `|| now + 30 days`
 * fallback. Measured at a live test-mode object: `sub.current_period_end` is
 * `undefined`, `sub.items.data[0].current_period_end` is the real timestamp.
 *
 * What that fallback cost while nobody looked: a fabricated month-long cycle
 * behind every renewal date shown, every period the webhook wrote, and every
 * proration divided. On a monthly plan the lie happens to be roughly true,
 * which is why it survived; on an ANNUAL plan a 365-day cycle read as 30 days
 * breaks every quote — the reason it is fixed in the change that makes annual
 * real rather than filed beside it.
 *
 * One reader, item first, subscription second (older API shapes and fixtures
 * still carry it there), fallback last — so the fallback is what it was
 * always meant to be: the shape for an object with no period at all, not the
 * everyday road.
 */
export function subscriptionPeriodSec(subscription: unknown): {
  startSec: number;
  endSec: number;
} {
  const sub = subscription as {
    items?: { data?: Array<{ current_period_start?: number; current_period_end?: number }> };
    current_period_start?: number;
    current_period_end?: number;
  } | null;
  const item = sub?.items?.data?.[0];
  const nowSec = Math.floor(Date.now() / 1000);
  const startSec = item?.current_period_start ?? sub?.current_period_start ?? nowSec;
  const endSec =
    item?.current_period_end ?? sub?.current_period_end ?? startSec + 30 * 24 * 60 * 60;
  return { startSec, endSec };
}
