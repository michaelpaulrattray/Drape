/**
 * DEFERRED PLAN CHANGES — the period-boundary half of a plan change (#1936).
 *
 * ⚠ **WHY THIS MODULE EXISTS: A CHANGE THAT HANDS MONEY BACK WAS MINTING
 * CREDITS.** `always_invoice` returns the unused share of the period as a
 * customer-balance credit in the same act as the plan change, while the credit
 * take-back is floored at what is LEFT of the allowance — his own *"spent
 * credits are spent"* rule (`planChangeSettlement.ts`, `routes/billing.ts`).
 * Both halves are individually right and together they are a loop: raise the
 * dial, spend the credits, lower it for the money back, raise again out of the
 * Stripe balance. Measured on the live catalogue at the fix: **up to 380,000
 * display credits a round trip** on the top rung (76 steps × 5,000), with no
 * rate limit on `changePlan`, and ×12 on an annual cycle. A plain rung
 * downgrade has the same hole and pre-dates the dial.
 *
 * **His ruling, 2026-10-08 (terminal), verbatim: _"1 for the slider fix"_** —
 * option 1 of three: **a DECREASE takes effect at the next renewal, with no
 * refund and no credit take-back; an INCREASE stays instant.** That closes the
 * loop at its engine rather than policing its symptoms: nothing is handed back
 * today, so there is nothing to keep.
 *
 * ⚠ **THE THREE REJECTED REPAIRS, so nobody re-opens them cheaply.** Stopping
 * the take-back alone makes the loop WORSE (money still returns, no credits
 * move). Stopping the refund alone robs a customer who has not spent. Moving
 * the Stripe price now with `proration_behavior: "none"` moves no money and
 * would close the loop — and it makes the plan read as the LOWER one from the
 * moment she asks, which is a different product from the one he described.
 * His *"applies at the period boundary"* rules it out.
 *
 * ## Why Stripe's own object and not a table of ours
 *
 * The tempting shortcut is a `pending_plan_change` row applied by our renewal
 * webhook. It does not work, and the reason is timing rather than taste:
 * Stripe builds the renewal invoice from the subscription's items at the
 * moment it creates that invoice, so a row we apply when the invoice ARRIVES
 * has already missed it — the customer is billed one more period at the old
 * level, which contradicts his *"billed and granted at the new level"*. Racing
 * the invoice from `invoice.created` is exactly the approximation the fidelity
 * law names. Subscription schedules are the dedicated, documented mechanism,
 * and this module is the whole of our use of them.
 *
 * ## The one rule worth carrying away
 *
 * ⚠ **EVERY WRITE TO A SUBSCRIPTION RELEASES ITS PENDING SCHEDULE FIRST.**
 * One sentence, three call sites ({@link releaseScheduleBeforeWrite} from
 * `updateSubscriptionPlan`, from `cancelSubscription`, and from
 * {@link scheduleSubscriptionChange} itself), and it is Stripe's own
 * documented pattern rather than a workaround of ours — their automatic
 * dispute cancellation is specified as *"For subscriptions managed with
 * schedules, the subscription is first released from the schedule and then
 * canceled."* It also hands the product the semantics a customer expects
 * without inventing a second mechanism: **changing your mind replaces the
 * pending change**, and leaving replaces it with nothing.
 *
 * ⚠ **WHAT IS REASONED FROM THE DOCUMENTATION RATHER THAN DRIVEN, said plainly
 * because this is a money path.** Whether `subscriptions.update` carrying
 * `cancel_at_period_end` is outright REFUSED on a schedule-managed
 * subscription was NOT driven against Stripe — production's key is still
 * `sk_test_` and a shift does not transact. It is also moot under the rule
 * above: we release first in every direction, so that refusal can never be
 * reached. Every Stripe behaviour this module does rest on is quoted from the
 * documentation at the call site that uses it.
 */

import Stripe from "stripe";
import { SUBSCRIPTION_PRODUCTS, SubscriptionPlan } from "./stripeProducts";
import { type BillingIntervalChoice } from "@shared/annualBilling";
import { resolvePlanCreditsPriceId, resolvePriceId } from "./stripePriceCatalogue";
import { planCreditSliderUnitsAllowed } from "./planCreditSlider";
import { environmentMetadata } from "./environmentTag";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("stripe/subscriptionSchedule");

/**
 * The pending change a subscription carries, in the product's own vocabulary.
 */
export type PendingPlanChange = {
  scheduleId: string;
  /** When the scheduled phase begins — the end of the period she has paid for. */
  effectiveAt: Date;
  plan: SubscriptionPlan;
  interval: BillingIntervalChoice;
  /** The dial's position in the scheduled phase; 0 when it carries no add-on. */
  creditUnits: number;
};

/**
 * ⚠ **THE THREE OUTCOMES STAY APART FOR `retrieveLiveSubscription`'S OWN
 * REASON.** A read that FAILED is not a subscription with no pending change,
 * and a surface that collapsed the two would tell a customer her scheduled
 * downgrade had vanished because one API call timed out.
 */
export type PendingChangeRead =
  | { outcome: "none" }
  | { outcome: "pending"; change: PendingPlanChange }
  | { outcome: "failed"; error: string };

/** The schedule id on a retrieved subscription, whichever shape the SDK gives it. */
function scheduleIdOf(subscription: Stripe.Subscription): string | null {
  const schedule = (subscription as { schedule?: unknown }).schedule;
  if (typeof schedule === "string") return schedule || null;
  if (schedule && typeof schedule === "object") {
    const id = (schedule as { id?: unknown }).id;
    return typeof id === "string" && id ? id : null;
  }
  return null;
}

/**
 * RELEASE WHATEVER IS PENDING, BEFORE ANY OTHER WRITE TO THIS SUBSCRIPTION.
 *
 * Documented: *"You can release a subscription from a schedule if the status is
 * `not_started` or `active`. Releasing a subscription leaves it in place but
 * removes the schedule and any remaining phases."* So this moves no money,
 * changes no price, and costs one read on the happy path where there is
 * nothing to release.
 *
 * ⚠ **IT REPORTS RATHER THAN THROWING, AND THE CALLER DECIDES.** A failed
 * release means the write that follows may land on a schedule-managed
 * subscription — precisely the state this product must not guess about — so
 * the callers that are about to move money REFUSE, and this hands back the
 * fact instead of deciding for them.
 */
export async function releaseScheduleBeforeWrite(
  stripe: Stripe,
  subscriptionId: string,
): Promise<ReleaseOutcome> {
  let subscription: Stripe.Subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    log.error(
      { err: error, subscriptionId },
      "[Schedule] Could not read the subscription to look for a pending change",
    );
    return { outcome: "failed", error: String(error) };
  }
  return releaseScheduleOn(stripe, subscription);
}

export type ReleaseOutcome =
  | { outcome: "nothing-to-release" }
  | { outcome: "released"; scheduleId: string }
  | { outcome: "failed"; error: string };

/**
 * THE SAME RELEASE, FOR A CALLER THAT HAS ALREADY RETRIEVED THE SUBSCRIPTION.
 *
 * ⚠ **THIS EXISTS BECAUSE THE FIRST DRAFT MADE `updateSubscriptionPlan` READ
 * THE SUBSCRIPTION TWICE, AND AN EXISTING ARM CAUGHT IT** —
 * `annualPlanChange.test.ts`'s *"the item id was supplied, so nothing
 * re-fetched the subscription"*, which has guarded that round trip since #664
 * and went red the moment the release grew its own read. Both reads wanted the
 * same object: one for the schedule id, one for the plan's item id.
 *
 * So the rule is unchanged and the cost is not doubled: a caller that is about
 * to write retrieves ONCE and hands the object here. The cost that remains is
 * honest and is the price of the rule — a plan change that supplied its item
 * id used to make NO read and now makes one, which on an action already
 * spending three Stripe round trips is the cheapest half of the trade.
 */
export async function releaseScheduleOn(
  stripe: Stripe,
  subscription: Stripe.Subscription,
): Promise<ReleaseOutcome> {
  const scheduleId = scheduleIdOf(subscription);
  if (!scheduleId) return { outcome: "nothing-to-release" };
  const subscriptionId = subscription.id;

  try {
    await stripe.subscriptionSchedules.release(scheduleId);
    log.info(
      { subscriptionId, scheduleId },
      "[Schedule] Released a pending change before writing to the subscription",
    );
    return { outcome: "released", scheduleId };
  } catch (error) {
    /* ⚠ A SCHEDULE THAT IS ALREADY GONE IS SUCCESS FOR OUR PURPOSE, AND THAT
       IS A DELIBERATE READING RATHER THAN A SWALLOWED ERROR. Release is
       documented as available only while the status is `not_started` or
       `active`, so a schedule that has completed, been released or been
       canceled answers with an invalid-state error — and in every one of those
       cases nothing is managing the subscription any more, which is the state
       the caller asked for. Anything else is a real failure and is reported as
       one.

       ⚠ `not_started` WAS IN THIS LIST AND IS THE ONE STATUS THAT MUST NOT BE
       — read at the documented sentence two paragraphs up, release is
       available *"if the status is `not_started` or `active`"*, so a
       `not_started` schedule is RELEASABLE and a message naming it is never
       the already-gone state. It is also the status every schedule this module
       mints passes through, so the one word was turning a real release failure
       on a brand-new schedule into "nothing to release" — and the write that
       follows would then land on a schedule-managed subscription, which is the
       single state this product must not guess about. */
    const code = (error as { code?: string } | null)?.code;
    const message = String((error as { message?: string } | null)?.message ?? error);
    if (code === "resource_missing" || /released|canceled|completed/i.test(message)) {
      log.warn(
        { subscriptionId, scheduleId, message },
        "[Schedule] Release refused on a schedule that is already gone — nothing to release",
      );
      return { outcome: "nothing-to-release" };
    }
    log.error({ err: error, subscriptionId, scheduleId }, "[Schedule] Release failed");
    return { outcome: "failed", error: message };
  }
}

/**
 * SCHEDULE THE DECREASE FOR THE PERIOD BOUNDARY.
 *
 * Three calls, in this order, each simple on purpose:
 *
 * 1. {@link releaseScheduleBeforeWrite} — so a second change REPLACES the
 *    first rather than stacking on it.
 * 2. `subscriptionSchedules.create({ from_subscription })` — documented as
 *    creating *"a schedule with one phase that's based on the current billing
 *    period of the subscription"*, and *"doesn't create proration invoice items
 *    during the migration"*. **That is the whole reason this is three calls
 *    rather than one**: Stripe mints the current phase from the live
 *    subscription, so we never compose it from our own idea of what she is on.
 * 3. `subscriptionSchedules.update` with TWO phases — the minted one echoed
 *    back, the target appended.
 *
 * ⚠ **THE ECHO IS LOAD-BEARING AND ITS LIMIT IS STATED, NOT DISCOVERED.**
 * Stripe's own warning: *"Include all items and settings from the current
 * phase in the update, such as discounts, metadata, tax rates, and trial
 * settings. Stripe unsets omitted parameters."* So an omission here does not
 * fail — it silently RAISES a customer's bill, which is the worst failure
 * shape a money path has.
 *
 * What is echoed is every field that can change what she pays: **items**
 * (price and quantity, both lines when the dial is on), **metadata**,
 * **discounts**, **default tax rates** and **trial end**. This product sells
 * no coupons, tax rates or trials today — there is no discount machinery in
 * the tree — so all four of those are echoed for a value that is empty on
 * every subscription in existence, deliberately, because the one that is NOT
 * empty would be a discount somebody applied by hand in the Stripe dashboard
 * for a real customer, and dropping it is exactly the mistake nobody would
 * see. The remaining phase fields (`collection_method`, `invoice_settings`,
 * `automatic_tax`, `on_behalf_of`, `transfer_data`, `application_fee_percent`,
 * `billing_thresholds`, `add_invoice_items`, `description`,
 * `billing_cycle_anchor`) have no writer anywhere in this product and cannot
 * affect the amount; **THIS ECHO is where any of them has to be added** the
 * day one acquires one.
 *
 * ⚠ **THE TARGET PHASE'S `metadata` IS WHY THE RENEWAL NEEDS NO NEW CODE.**
 * Phase metadata is applied to the subscription when that phase is entered,
 * and every read in this product takes the plan off `subscription.metadata.plan`
 * — so when the boundary passes, the live subscription names the new plan by
 * itself and the existing road (`retrieveLiveSubscription` →
 * `invoiceBilledPlanGrant`, which already sizes the grant from the invoice)
 * bills and grants at the new level untouched. The shape stamped here is
 * deliberately the shape `updateSubscriptionPlan` stamps on an instant change.
 *
 * A one-period `duration` with `end_behavior: "release"` is the documented
 * downgrade shape: the target phase runs one billing period, then the schedule
 * lets go and the subscription simply keeps renewing at the target price.
 * ⚠ **`duration` is this SDK's spelling of what the documentation's example
 * still calls `iterations`** (stripe 20.3.0 — `iterations` is not on
 * `SubscriptionScheduleUpdateParams.Phase` at all, and writing it is a type
 * error rather than a silent no-op, which is how this was caught). The
 * interval is the TARGET's, because the phase's length is a period of the
 * cycle being bought.
 */
export async function scheduleSubscriptionChange(
  stripe: Stripe,
  subscriptionId: string,
  userId: number,
  target: {
    plan: SubscriptionPlan;
    interval: BillingIntervalChoice;
    creditUnits: number;
  },
): Promise<
  { success: true; scheduleId: string; effectiveAt: Date } | { success: false; error: string }
> {
  const released = await releaseScheduleBeforeWrite(stripe, subscriptionId);
  if (released.outcome === "failed") {
    return {
      success: false,
      error: `Could not clear the previous scheduled change: ${released.error}`,
    };
  }

  /* ⚠ THE PRICES ARE RESOLVED BEFORE ANY SCHEDULE EXISTS, and the position is
     the same care `changePlan` takes with the dial's ledger figures: a
     catalogue that cannot supply the target price must refuse while nothing
     has been attempted. Resolving them after the `create` would leave the
     customer attached to a one-phase schedule with no target — managed, for
     nothing — which is strictly worse than a refusal. */
  let planPriceId: string;
  let creditPriceId: string | null = null;
  try {
    planPriceId = await resolvePriceId(stripe, target.plan, target.interval);
    if (target.creditUnits > 0) {
      creditPriceId = await resolvePlanCreditsPriceId(
        stripe,
        target.plan,
        target.interval,
        target.creditUnits,
      );
    }
  } catch (error) {
    /* Rethrown rather than folded into `success: false`, matching
       `updateSubscriptionPlan`'s single throw: nothing was attempted, and the
       route turns it into the catalogue's own refusal. */
    log.error(
      { err: error, subscriptionId, target },
      "[Schedule] The catalogue could not price the scheduled change",
    );
    throw error;
  }

  let schedule: Stripe.SubscriptionSchedule;
  try {
    schedule = await stripe.subscriptionSchedules.create({ from_subscription: subscriptionId });
  } catch (error) {
    log.error(
      { err: error, subscriptionId },
      "[Schedule] Could not create a schedule from the subscription",
    );
    return { success: false, error: String(error) };
  }

  const current = schedule.phases?.[0];
  const currentItems = (current?.items ?? []).map((item) => {
    const price = typeof item.price === "string" ? item.price : (item.price as { id: string }).id;
    return typeof item.quantity === "number" ? { price, quantity: item.quantity } : { price };
  });
  /* The money-affecting settings on the phase Stripe just minted, read back as
     the ids the write side takes (the read side expands them into objects).
     Empty on every subscription this product has ever created — see the
     docblock on why they are echoed anyway. */
  const currentDiscounts = (current?.discounts ?? []).map((discount) => ({
    coupon: typeof discount.coupon === "string" ? discount.coupon : (discount.coupon?.id ?? undefined),
    discount:
      typeof discount.discount === "string" ? discount.discount : (discount.discount?.id ?? undefined),
    promotion_code:
      typeof discount.promotion_code === "string"
        ? discount.promotion_code
        : (discount.promotion_code?.id ?? undefined),
  }));
  const currentTaxRates = (current?.default_tax_rates ?? []).map((rate) =>
    typeof rate === "string" ? rate : rate.id,
  );
  if (!current || currentItems.length === 0) {
    log.error(
      { subscriptionId, scheduleId: schedule.id },
      "[Schedule] Stripe minted a schedule with no readable current phase — releasing it again",
    );
    await stripe.subscriptionSchedules.release(schedule.id).catch(() => undefined);
    return { success: false, error: "Stripe returned a schedule with no readable current phase." };
  }

  const targetItems: { price: string; quantity?: number }[] = [{ price: planPriceId }];
  if (creditPriceId) targetItems.push({ price: creditPriceId, quantity: target.creditUnits });

  try {
    const updated = await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: "release",
      phases: [
        {
          items: currentItems,
          start_date: current.start_date,
          end_date: current.end_date,
          metadata: current.metadata ?? undefined,
          ...(currentDiscounts.length > 0 ? { discounts: currentDiscounts } : {}),
          ...(currentTaxRates.length > 0 ? { default_tax_rates: currentTaxRates } : {}),
          ...(typeof current.trial_end === "number" ? { trial_end: current.trial_end } : {}),
        },
        {
          items: targetItems,
          duration: {
            interval: target.interval === "annual" ? "year" : "month",
            interval_count: 1,
          },
          metadata: {
            userId: userId.toString(),
            plan: target.plan,
            interval: target.interval,
            ...environmentMetadata(),
          },
        },
      ],
    });

    const effectiveAtSec = updated.phases?.[1]?.start_date ?? current.end_date;
    log.info(
      {
        subscriptionId,
        scheduleId: schedule.id,
        plan: target.plan,
        interval: target.interval,
        creditUnits: target.creditUnits,
        effectiveAtSec,
      },
      "[Schedule] A decrease is scheduled for the period boundary — no money and no credits moved",
    );
    return { success: true, scheduleId: schedule.id, effectiveAt: new Date(effectiveAtSec * 1000) };
  } catch (error) {
    /* ⚠ THE SCHEDULE IS RELEASED AGAIN ON A FAILED UPDATE, and this is the arm
       most worth keeping. Without it the customer is left attached to a
       one-phase schedule that changes nothing and yet makes every later write
       take the release road for no reason. Nothing has been billed either way
       — `from_subscription` raises no prorations — so the clean-up is free and
       she is handed a refusal for a change that did not happen. */
    log.error(
      { err: error, subscriptionId, scheduleId: schedule.id },
      "[Schedule] Could not add the target phase — releasing the schedule again",
    );
    await stripe.subscriptionSchedules.release(schedule.id).catch(() => undefined);
    return { success: false, error: String(error) };
  }
}

/**
 * WHAT IS PENDING, READ OFF THE SCHEDULE RATHER THAN REMEMBERED.
 *
 * Working law 4: the pending change is not written down on our side at all, so
 * there is no second list to drift from Stripe. The plan and interval come out
 * of the target phase's own metadata — the same field the live subscription
 * answers `currentPlan` from, and the field Stripe copies onto the
 * subscription when the phase is entered — so this read and the renewal cannot
 * disagree about what was scheduled.
 *
 * A phase whose metadata names no plan this product sells answers `none`
 * rather than inventing one: that is a schedule somebody made by hand in the
 * Stripe dashboard, and reporting it as a plan change would put a tier on a
 * customer's screen that the product cannot price.
 */
export async function readPendingPlanChange(
  stripe: Stripe,
  subscription: Stripe.Subscription,
): Promise<PendingChangeRead> {
  const scheduleId = scheduleIdOf(subscription);
  if (!scheduleId) return { outcome: "none" };

  let schedule: Stripe.SubscriptionSchedule;
  try {
    schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
  } catch (error) {
    if ((error as { code?: string } | null)?.code === "resource_missing") return { outcome: "none" };
    log.error({ err: error, scheduleId }, "[Schedule] Could not read the pending change");
    return { outcome: "failed", error: String(error) };
  }

  if (schedule.status !== "active" && schedule.status !== "not_started") return { outcome: "none" };

  /* ⚠ THE PENDING PHASE IS THE ONE THAT STARTS AFTER THE ONE IN PROGRESS —
     NEVER `phases[1]` BY POSITION. `current_phase` names the phase in progress
     by its start date, and a schedule that has already advanced carries its
     COMPLETED phases in the same array, so an index would report a change that
     has already happened as still pending. */
  const currentStart = schedule.current_phase?.start_date ?? null;
  const pending = (schedule.phases ?? []).find(
    (phase) => currentStart === null || phase.start_date > currentStart,
  );
  if (!pending) return { outcome: "none" };

  const plan = pending.metadata?.plan as SubscriptionPlan | undefined;
  const interval = pending.metadata?.interval as BillingIntervalChoice | undefined;
  if (!plan || !(plan in SUBSCRIPTION_PRODUCTS)) {
    log.warn(
      { scheduleId, plan },
      "[Schedule] A pending phase names no plan this product sells — reporting nothing pending",
    );
    return { outcome: "none" };
  }
  if (interval !== "monthly" && interval !== "annual") {
    log.warn(
      { scheduleId, interval },
      "[Schedule] A pending phase names no interval this product sells — reporting nothing pending",
    );
    return { outcome: "none" };
  }

  /* The dial's position in the scheduled phase comes from the phase's own
     items, the way the live dial comes from the add-on line's quantity — the
     artifact that will bill, not a figure stamped beside it. WHICH of those
     lines it is, is {@link pendingDialUnits}'s whole subject. */
  const creditUnits = await pendingDialUnits(
    stripe,
    scheduleId,
    pending.items ?? [],
    plan,
    interval,
  );

  return {
    outcome: "pending",
    change: {
      scheduleId,
      effectiveAt: new Date(pending.start_date * 1000),
      plan,
      interval,
      creditUnits: Math.max(0, Math.trunc(creditUnits)),
    },
  };
}

/** The price id on a phase item, whichever shape the SDK gives it. */
function phaseItemPriceId(item: { price?: unknown }): string | null {
  const price = item.price;
  if (typeof price === "string") return price || null;
  if (price && typeof price === "object") {
    const id = (price as { id?: unknown }).id;
    return typeof id === "string" && id ? id : null;
  }
  return null;
}

/**
 * THE DIAL'S POSITION IN A SCHEDULED PHASE — THE ADD-ON LINE'S QUANTITY, AND
 * THE ADD-ON LINE IS FOUND BY ITS PRICE.
 *
 * ⚠ **THIS READ USED TO TAKE THE LARGEST QUANTITY ON THE PHASE, ON THE STATED
 * GROUND THAT _"nothing this product writes puts a quantity on the plan
 * line"_ — WHICH IS TRUE OF WHAT WE SEND AND FALSE OF WHAT STRIPE RETURNS.** A
 * licensed price's phase item comes back carrying `quantity: 1` whether or not
 * one was sent, which is why the echo in {@link scheduleSubscriptionChange}
 * reads a quantity off the minted phase at all. So the commonest decrease this
 * product sells — **the dial to 0 on the dial's own rung**, which schedules a
 * lone plan line — read `creditUnits = 1`, and the surface then promised one
 * extra 5,000-credit step from the renewal date that the invoice would never
 * grant. A pending-change read is a promise about money, so a line it cannot
 * identify is the one thing it must not guess at.
 *
 * Two readings, in this order, and the second is declared a FLOOR rather than
 * an answer:
 *
 * 1. **The rung's own dial, which is pure and free.** A plan that sells no
 *    slider can carry no add-on line, whatever is on the phase — so every rung
 *    but one answers 0 without asking Stripe anything.
 * 2. **The plan's base price, resolved from the catalogue**, and the add-on is
 *    the line that is not it. One extra `prices.list`, paid only while a
 *    decrease is actually pending (no schedule, no read at all), through the
 *    resolver this product already drives everywhere else.
 *
 * ⚠ **AND WHEN THE CATALOGUE CANNOT NAME THE PLAN'S OWN PRICE, THE STRUCTURAL
 * READING IS THE FLOOR AND SAYS SO RATHER THAN PASSING AS AN ANSWER.**
 * `resolvePriceId` refuses on an absent, ambiguous, wrongly-recurring or
 * inconsistently-priced key, and none of those is a reason to tell a customer
 * her scheduled dial is a number it is not. This product writes either a lone
 * plan line or a plan line plus one add-on line, so a single-item phase
 * carries no dial — which is precisely the case the old reading got wrong —
 * and a two-line phase falls back to the largest quantity, which is the
 * add-on's own step count in every shape this product has ever written.
 */
async function pendingDialUnits(
  stripe: Stripe,
  scheduleId: string,
  items: { price?: unknown; quantity?: number | null }[],
  plan: SubscriptionPlan,
  interval: BillingIntervalChoice,
): Promise<number> {
  const largestQuantity = () =>
    items.reduce((most, item) => {
      const quantity = typeof item.quantity === "number" ? item.quantity : 0;
      return quantity > most ? quantity : most;
    }, 0);

  if (planCreditSliderUnitsAllowed(plan) === 0) return 0;

  let basePriceId: string;
  try {
    basePriceId = await resolvePriceId(stripe, plan, interval);
  } catch (error) {
    const floor = items.length < 2 ? 0 : largestQuantity();
    log.warn(
      { err: error, scheduleId, plan, interval, floor },
      "[Schedule] The catalogue could not name the plan's own price — the pending dial is read structurally, as a floor",
    );
    return Math.max(0, Math.trunc(floor));
  }

  const units = items
    .filter((item) => phaseItemPriceId(item) !== basePriceId)
    .reduce((most, item) => {
      const quantity = typeof item.quantity === "number" ? item.quantity : 0;
      return quantity > most ? quantity : most;
    }, 0);
  return Math.max(0, Math.trunc(units));
}
