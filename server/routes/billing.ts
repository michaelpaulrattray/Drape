import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  getUserById,
  getSubscriptionByUserId,
  updateUserSubscription,
  addCredits,
  deductCredits,
  getUserCredits,
  getAnnualYearProgress,
  installAnnualMonthlyCredits,
} from "../db";
import {
  getOrCreateStripeCustomer,
  createSubscriptionCheckoutSession,
  createTopupCheckoutSession,
  createCustomerPortalSession,
  getSubscriptionDetails,
  cancelSubscription,
  reactivateSubscription,
  readSubscriptionBillingState,
  quotePlanChange,
  updateSubscriptionPlan,
  getInvoiceStatus,
  getCustomerInvoices,
  getAllCustomerInvoices,
  stripe,
} from "../stripe/stripeService";
import {
  releaseScheduleBeforeWrite,
  scheduleSubscriptionChange,
} from "../stripe/subscriptionSchedule";
import { formatCustomerShortDate } from "@shared/customerDate";
import { YEARLY_SWITCH_CREDITS_SENTENCE, planCancelledReceipt } from "@shared/planCancelCopy";
import {
  queuePlanChangeSettlement,
  applyPlanChangeSettlement,
} from "../stripe/planChangeSettlement";
import { stripeIntervalOf } from "@shared/annualBilling";
import { displayBalance, formatCredits } from "@shared/creditDisplay";
import {
  TOPUP_MAX_UNITS,
  TOPUP_NEEDS_A_PLAN_SENTENCE,
  topupEligibility,
  topupLedgerCredits,
  topupPriceInCents,
} from "@shared/creditTopups";
import { planCreditSliderLedgerCredits } from "@shared/planCreditSlider";
import {
  monthlyLedgerCreditsFor,
  PLAN_CREDIT_SLIDER_MAX_UNITS,
  planCreditSliderSpec,
  planCreditSliderUnitsAllowed,
} from "../stripe/planCreditSlider";
import type { PlanTier } from "../../drizzle/schema";
import {
  SUBSCRIPTION_PRODUCTS,
  SubscriptionPlan,
  PURCHASABLE_PLANS,
  OFFERED_PLAN_ORDER,
  OFFERED_PLAN_TIERS,
  SELF_SERVE_PLAN_ORDER,
  ownPlanFacts,
} from "../stripe/stripeProducts";
import { CASTING_V2_ONE_CHARACTER_CREDITS } from "../castingV2/castViewPackage";
import {
  CASTING_V2_ROLL_PRICE_CREDITS,
  CASTING_V2_SIGN_PRICE_CREDITS,
} from "../casting/castingCreditCosts";
import { appBaseUrl, PRODUCTION_APP_HOSTNAME } from "../_core/appOrigin";
import { logAuditEvent, AUDIT_ACTIONS } from "../auditLog";
import { z } from "zod";
import { planAllowanceRemaining } from "../db/credits";
import {
  StripePriceUnavailableError,
  PRICE_UNAVAILABLE_SENTENCE,
} from "../stripe/stripePriceCatalogue";
import { spokenError } from "../_core/spokenError";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("routes/billing");
import { TRPCError } from "@trpc/server";

/**
 * WHY A PLAN CHANGE CANNOT GO AHEAD, IN HER OWN WORDS — OR `null` (#1987).
 *
 * ⚠ **ONE FUNCTION, TWO READERS, AND THAT IS THE REPAIR FOR ITS SECOND
 * FINDING.** `changePlan` refuses with this sentence and `previewPlanChange`
 * serves it, so the confirm step shows the refusal BEFORE she presses
 * anything, in exactly the words the press would have met. Until #1987 the
 * preview drew a "starts on 7 Nov" sentence for a decrease the confirm then
 * refused — the confirm step promising a change the server would not make.
 *
 * **The states, decided one by one** (#1987 finding 3 — none of them was
 * gated on either road before):
 *
 *  · `active` with collection running — the only state a change is for.
 *  · `past_due` / `unpaid` — a payment has failed and an invoice is open.
 *    An upgrade would raise a second invoice on a card that is already
 *    declining, and a scheduled decrease would be written onto a plan Stripe
 *    may cancel at the end of its retries. Refused; the one thing to do is the
 *    card, and the Billing tab's button for it is "Update card".
 *  · `paused`, or `active` with `pause_collection` set — the portal's pause.
 *    Invoices are not collected, so an upgrade's credits would land against
 *    an invoice nobody pays. Refused until she resumes.
 *  · `trialing` — the product sells no trials today, so this is unreachable;
 *    it is refused because an upgrade during a trial is invoiced at nothing
 *    while its prorated credits are granted in full, which is a mint.
 *  · `incomplete`, `incomplete_expired`, `canceled`, and anything Stripe adds
 *    later — not a running plan. Refused; the default arm is the refusal, so
 *    a new status cannot reach the money roads by being unnamed.
 *
 * ⚠ **AND A DECREASE IS ALSO REFUSED WHILE THE PLAN IS SET TO END** — #1936's
 * repair 2, moved here unchanged except that "set to end" now reads both of
 * Stripe's shapes (`endsAtSec`, finding 1). It stays scoped to the DEFERRED
 * road, as #1936 scoped it: an instant change on a cancelling plan is a
 * pre-existing road that card did not re-rule, and neither does this one.
 */
function planChangeRefusal(
  state: {
    status: string;
    collectionPaused: boolean;
    endsAtSec: number | null;
  },
  quote: { deferred: boolean },
): string | null {
  if (state.status === "active" && state.collectionPaused) {
    return "Your plan is paused, so it can't be changed right now. Resume it first, then you can change it.";
  }
  switch (state.status) {
    case "active":
      break;
    case "past_due":
    case "unpaid":
      return "Your last payment didn't go through, so your plan can't be changed until it does. Update your card under Billing, then try again.";
    case "paused":
      return "Your plan is paused, so it can't be changed right now. Resume it first, then you can change it.";
    case "trialing":
      return "Your plan is still in its trial, so it can't be changed until the trial ends.";
    default:
      return "Your plan isn't active right now, so it can't be changed.";
  }
  if (quote.deferred && state.endsAtSec !== null) {
    return `Your plan is set to end on ${formatCustomerShortDate(new Date(state.endsAtSec * 1000))}, so this change has nothing to take effect at. Resume your plan first, then you can change it.`;
  }
  return null;
}

/**
 * What is left of the PLAN's part of her balance, for the quote (#1965). A
 * missing credit row answers 0 — the reading under which nothing can be
 * taken back, so the switch's unused share is paid for rather than given
 * away; it is the same direction the settlement floor takes on a null row.
 */
async function planAllowanceLeftFor(userId: number): Promise<number> {
  const row = await getUserCredits(userId);
  return row ? planAllowanceRemaining(row) : 0;
}

/**
 * HOW MANY OF THE CURRENT YEAR'S MONTHS HAVE BEEN GRANTED, FOR THE QUOTE
 * (#2152, his ruling on #2159: *"yearly credits apply month by month"*).
 *
 * - `null` — the period was granted whole: a monthly plan, or a yearly one
 *   granted up front before this change (no year on the row). The quote then
 *   prices exactly as it always has.
 * - a count — read off the ledger by `getAnnualYearProgress`, never off the
 *   calendar, so a worker running late can only make the take-back SMALLER
 *   (what was not handed over is not taken back) and never charges a customer
 *   for a month they were not given.
 * - `0` — a year IS on the row but it is not the period Stripe says is current
 *   (the new year's invoice has not landed yet): nothing of this period has
 *   been handed over.
 *
 * `yearStart` is the paid year's own start, and only when it IS Stripe's
 * current period — the year an instant upgrade's higher month is recorded
 * against, so its install can be conditioned on that year still being the one
 * on the row when the money settles (never a year read now and trusted later).
 */
async function annualYearFor(
  userId: number,
  state: { currentInterval: "monthly" | "annual"; periodStartSec: number },
  subscriptionId: string,
): Promise<{ monthsGranted: number | null; yearStart: Date | null }> {
  if (state.currentInterval !== "annual") return { monthsGranted: null, yearStart: null };
  const year = await getAnnualYearProgress(userId);
  if (!year) return { monthsGranted: null, yearStart: null };
  const sameYear =
    year.subscriptionId === subscriptionId
    && Math.abs(Math.floor(year.periodStart.getTime() / 1000) - state.periodStartSec) <= 60;
  return sameYear
    ? { monthsGranted: year.monthsGranted, yearStart: year.periodStart }
    : { monthsGranted: 0, yearStart: null };
}

/**
 * THE CUSTOMER'S SENTENCE FOR A PRICE THE CATALOGUE CANNOT SUPPLY (#1605
 * bullet 1) — one translator, both money paths.
 *
 * `resolvePriceId` refuses with the lookup key in the message, which is what a
 * person repairing it needs and is exactly what a customer must not be handed.
 * This is the boundary where those two readers part: the key is LOGGED with the
 * account and the plan beside it, and an authored sentence goes to the screen.
 *
 * ⚠ **Marked spoken on purpose.** An unmarked `INTERNAL_SERVER_ERROR` is
 * answered by the client's own fallback (`client/src/lib/failureSentence.ts` —
 * `INTERNAL_SERVER_ERROR` is not on its `OURS` list), and on the plan-change
 * modal that fallback is *"We lost contact while changing your plan. Check your
 * plan before trying again."* Nothing is attempted when this fires, so that
 * sentence would send somebody to check a plan that never moved.
 *
 * Any other error is returned unchanged, so this cannot quietly become the
 * answer to a failure it was not written for.
 */
function billingRefusalFor(
  error: unknown,
  where: string,
  meta: Record<string, unknown>,
): unknown {
  if (!(error instanceof StripePriceUnavailableError)) return error;
  log.error(
    { ...meta, lookupKey: error.lookupKey, err: error },
    `[Billing] ${where} refused: Stripe's catalogue could not supply the price. Nothing was charged.`,
  );
  return spokenError({
    code: "INTERNAL_SERVER_ERROR",
    message: PRICE_UNAVAILABLE_SENTENCE,
    cause: error,
  });
}

export const billingRouter = router({
  // Get available pricing plans.
  //
  // ⚠ THE OFFERED LADDER ONLY (#391). This is a public endpoint, and the
  // hidden top rung's price is deliberately unpublished — so it maps
  // PURCHASABLE_PLANS and OFFERED_PLAN_TIERS, never the whole product table
  // (invariant 8: an explicit projection, not a spread). The hidden rung's
  // door is the email line the plan modal draws under the ladder.
  getPlans: publicProcedure.query(() => {
    return {
      subscriptions: PURCHASABLE_PLANS.map((key) => {
        const plan = SUBSCRIPTION_PRODUCTS[key];
        return {
          id: key as SubscriptionPlan,
          name: plan.name,
          // `description` left this projection with #1605: it was a composed
          // ledger figure ("200,000 credits/month with …") that no client ever
          // rendered — `planBlurbs.ts` is the customer-facing line, and the
          // credits figure comes from `credits` below through P1-1's display
          // helper. A field nobody reads is a second copy of a number, which
          // is working law 4 on a money surface.
          //
          // `features` left it with #1972 half 1, on the same ground and the
          // relay's ruling: no client file has read it since the Section 03
          // rebuild (#370, 2026-09-01), the Phase 2 compare table (#1834)
          // draws the plan comparison, and a public money projection carrying
          // a list no screen draws is where the next wrong promise goes
          // unseen — #1953's three undelivered lines sat here for exactly
          // that reason. The lines stay in `SUBSCRIPTION_PRODUCTS`; only the
          // wire stopped carrying them. `undeliveredPlanFeatures1953.test.ts`
          // pins the served keys.
          priceInCents: plan.priceInCents,
          credits: plan.credits,
          interval: plan.interval,
        };
      }),
      tiers: OFFERED_PLAN_TIERS,
      planOrder: OFFERED_PLAN_ORDER,
      /*
        THE SELF-SERVE LADDER — which rungs the plan surface DRAWS (#1832,
        Pricing Phase 2). `free` plus the three individual plans; the rungs
        above are the Enterprise band's conversation (#1833).

        ⚠ **IT IS SERVED RATHER THAN FILTERED ON THE CLIENT, AND THAT IS
        WORKING LAW 4 ON THE ONE SURFACE WHERE A SECOND LIST WOULD BE WORST.**
        A client-side `["starter", "pro", "studio"]` is a second copy of the
        ladder: the day he hand-sells a rung into the band, or adds a fourth
        individual plan, the surface and the catalogue disagree and the
        disagreement is a price in front of a customer. `planOrder` stays
        beside it — it is still what the `tiers` projection is keyed by and
        what the compare table's Upgrade/Downgrade direction is read from, so
        this is a narrower view of one list and not a rival to it.
      */
      selfServeOrder: SELF_SERVE_PLAN_ORDER,
      /*
        THE CREDIT SLIDER'S SPEC — which drawn card carries the dial, how far
        it goes, and what one step is worth and costs (#1832, the design's §5;
        his word on the $9: *"frames right numbers right"*).

        ⚠ **SERVED FOR `selfServeOrder`'S OWN REASON, AND MORE SHARPLY.** Both
        facts it carries are derived from `PLAN_TIERS` — the rung is the
        dearest paid rung of the drawn ladder, the ceiling is the rung the
        slider replaces — and `PLAN_TIERS` is schema that does not belong in
        the bundle. A client that decided for itself which card was "the
        biggest one" would be a second copy of the ladder on the surface where
        a disagreement is a price in front of a customer.

        ⚠ **AND THE RENAME IS WHY `planId` IS AN ID.** His word, 2026-10-07:
        *"rename the Studio plan to Pro Plus, everywhere a customer sees it"*
        (#1900). Nothing in this block is a plan's NAME, so the copy change
        moves one table and the dial stays where it is.

        `maxUnits: 0` means there is no slider and the surface draws none.
      */
      creditSlider: planCreditSliderSpec(),
      /*
        WHAT ONE FINISHED CHARACTER COSTS — the divisor behind every plan
        card's worked example (#1607, P1-8). A ledger number, like every
        other figure in this projection; the surface divides it through
        `@shared/creditDisplay`.

        ⚠ **IT IS SERVED HERE RATHER THAN READ FROM `credits.getCosts`, AND
        THAT IS THE REPAIR AS MUCH AS THE ADDITION.** The plan cards used to
        translate a plan's credits into *"About N casting frames"* using
        `CREDIT_COSTS.castingImage` — the LEGACY studio's price, which is not
        part of the new scale and retires with #29. So the one number on the
        card that told a customer what their money buys was priced off a road
        they are not being sold: 350 a frame against the 200 the studio they
        use actually charges, reading every figure low by more than half. The
        example now comes from the three prices the studio actually charges, on
        the same query the cards already make, and this surface no longer reads
        a legacy price at all.

        ⚠ **THIS PARAGRAPH SAID *"for a lane that has been admin-only since
        #1654"* AND THAT GROUND WAS FALSE — corrected #1786, 2026-10-02.** The
        repair above is unaffected and the honest reason is the stronger one
        already stated: it was the wrong price for the road being sold. What
        was wrong is *unreachable* — `CREDIT_COSTS.castingImage` is the
        constant the LIVE canvas charges, through three `protectedProcedure`s
        in `routes/boardOps.ts` with no admin check on any of them, and
        `castingCreditCosts.ts`'s own docblock carries the full seven-reader
        reading.

        D-15's rule holds: the client is served the number and never carries a
        literal.
      */
      oneFinishedCharacterCredits: CASTING_V2_ONE_CHARACTER_CREDITS,
      /*
        WHAT A CREDIT PACK BUYS, IN THE TWO THINGS A CUSTOMER ASKS FOR (#1606
        slice 2, P1-7). Ledger numbers, like every other figure here; the
        surface divides them through `@shared/creditDisplay`.

        His design for Add credits asks that every pack row say what it buys
        *"in the customer's words and at the live prices"* — *about 78 Rolls,
        or 14 Signs* — and *"DERIVED from the price table through the display
        helper, never typed"*. A Roll and a Sign are the two ends of the road
        the studio sells: the one that finds her and the one that fixes her.

        ⚠ **THEY ARE SERVED HERE RATHER THAN READ FROM `castingV2.config`, AND
        THE REASON IS THE SURFACE RATHER THAN TASTE.** That query is the casting
        sheet's own, behind the casting scope chain; a billing modal that had to
        open it to price a pack would be a money surface holding a feature flag.
        `oneFinishedCharacterCredits` above arrived on this projection for the
        same reason (#1607) and this is the second and third figure of the same
        kind, not a new idea.

        ⚠ **AND THE ROLL FIGURE IS THE ROLL'S, NOT THE FOLLOW'S.** They agree
        today under his one-price ruling of 2026-10-02 (#1753) and they are
        still two declared prices; a pack row counts what a customer casting a
        new character spends, which is a Roll. `followCandidate` is deliberately
        absent for the same reason it is absent from the character sum above.

        D-15's rule holds: the client is served the number and never carries a
        literal.
      */
      rollCredits: CASTING_V2_ROLL_PRICE_CREDITS,
      signCredits: CASTING_V2_SIGN_PRICE_CREDITS,
    };
  }),

  // Get current user's subscription status
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const subscription = await getSubscriptionByUserId(ctx.user.id);
    if (!subscription) {
      return {
        planTier: "free" as const,
        ...ownPlanFacts("free"),
        balance: 0,
        subscriptionStatus: null,
        billingInterval: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        canUpgrade: true,
        canManage: false,
        hasSubscription: false,
      };
    }

    return {
      planTier: subscription.planTier,
      // The OWN-ROW naming of the plan (#391): `getPlans` serves only the
      // offered ladder, so an account on the hidden rung cannot look its own
      // name up there — and a customer's own tier is their data. Without
      // this, Settings would caption a hand-sold Ultimate account "Free",
      // which is the one thing a billing surface must never do.
      ...ownPlanFacts(subscription.planTier),
      balance: subscription.balance,
      creditsPurchased: subscription.creditsPurchased,
      creditsUsed: subscription.creditsUsed,
      rolloverCredits: subscription.rolloverCredits,
      subscriptionStatus: subscription.subscriptionStatus,
      // The interval the customer is actually billed on (#664) — a cache of
      // the Stripe price's own recurring interval, written by the webhook and
      // by changePlan. Null means unknown, never "monthly": the surfaces fall
      // back to monthly COPY but must not claim a cycle nobody read.
      billingInterval: subscription.billingInterval ?? null,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      lastRefreshAt: subscription.lastRefreshAt,
      canUpgrade: subscription.planTier !== "ultimate",
      canManage: !!subscription.stripeSubscriptionId,
      stripeCustomerId: subscription.stripeCustomerId,
      hasSubscription: !!subscription.stripeSubscriptionId && subscription.subscriptionStatus === "active",
    };
  }),

  // Create checkout session for subscription
  createSubscriptionCheckout: protectedProcedure
    .input(z.object({
      // Derived, never retyped (#391, working law 4) — and the hidden rung is
      // structurally absent: a plan the UI does not offer must not be a plan
      // the API accepts (invariant 5).
      plan: z.enum(PURCHASABLE_PLANS),
      interval: z.enum(["monthly", "annual"]).optional().default("monthly"),
      /*
        THE CREDIT SLIDER'S POSITION (#1832) — whole steps, 0 for a plain plan.

        ⚠ **THE SCHEMA'S BOUND IS THE LADDER'S OWN CEILING, and a bound is not
        optional on this input** — `quantity` is what decides the charge, so an
        unbounded step count is an unbounded charge composed from a request
        body (invariant 4's reason, and `TOPUP_MAX_UNITS`' own note). The
        schema holds the widest bound any rung sells; the PER-RUNG refusal is
        below, because a dial on a rung that has none is a different wrong
        answer and deserves its own sentence.

        Absent means 0, which is what every bundle older than this commit
        sends — the field is additive and removing one is the contract
        invariant 4 now carries.
      */
      creditUnits: z
        .number()
        .int()
        .min(0)
        .max(PLAN_CREDIT_SLIDER_MAX_UNITS)
        .optional()
        .default(0),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      /* ⚠ THE PER-RUNG REFUSAL, BEFORE ANY STRIPE CALL. `resolvePlanCreditsPriceId`
         refuses this too — an input schema is not the only caller a money
         helper can ever have — but its refusal speaks the catalogue's
         "this one is on us" sentence, which is false here: the request asked
         for something this product does not sell, and saying so plainly is
         the refusal clause of the disappearing-technology law (what was
         refused, and what to do). */
      const unitsAllowed = planCreditSliderUnitsAllowed(input.plan);
      if (input.creditUnits > unitsAllowed) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            unitsAllowed === 0
              ? "That plan comes with a fixed amount of credits. Nothing was charged — pick the top plan if you want to add more."
              : "That is more extra credits than this plan offers. Nothing was charged — move the slider down, or write to us for a bigger pool.",
        });
      }

      // Check if account is frozen (blocks purchases)
      const user = await getUserById(ctx.user.id);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }
      if (user.frozenAt) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Your account is currently under review. Purchases are temporarily paused while we verify your billing records. This usually resolves within 24-48 hours.",
        });
      }

      // Get or create Stripe customer
      const subscription = await getSubscriptionByUserId(ctx.user.id);
      const customerId = await getOrCreateStripeCustomer(
        ctx.user.id,
        user.email || `user-${ctx.user.id}@${PRODUCTION_APP_HOSTNAME}`,
        user.displayName || user.name || undefined,
        subscription?.stripeCustomerId
      );

      // Save customer ID if new — or if it CHANGED (PR #797 review): the helper
      // mints a fresh customer when the saved one is deleted or unretrievable
      // in Stripe (stripeService.ts, the deleted-check and its catch), so a
      // guard keyed on "nothing saved yet" would skip the save AND the refusal
      // below, and mint the session against an id the account still does not
      // hold. The comparison is the guard; the verdict read is the same.
      //
      // ⚠ THE VERDICT IS READ, NOT DROPPED (#796, the request-path remainder
      // of #792): `updateUserSubscription` never throws — a failed write comes
      // back `{ success: false }` — and a checkout minted anyway is a subscription
      // the account can never claim: `customer.subscription.created` finds the
      // user BY `stripeCustomerId` (`getUserByStripeCustomerId`, the webhook's
      // first read), so with the id unsaved the event fails on every redelivery
      // and the customer pays for a plan their account never receives. Refusing
      // here costs them a retry and nothing else — no session, no charge. The
      // just-minted Stripe customer is left empty (no subscription hangs off it)
      // and the retry mints another, which is the harmless half of the card's
      // "second customer"; the harmful half is only reachable past this throw.
      if (customerId !== subscription?.stripeCustomerId) {
        const saved = await updateUserSubscription(ctx.user.id, { stripeCustomerId: customerId });
        if (!saved.success) {
          log.error(
            { userId: ctx.user.id, customerId, error: saved.error },
            "[Billing] Stripe customer id could not be saved — refusing the checkout rather than mint a session the account cannot claim",
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "We could not set up your billing account. Nothing was charged — please try again in a moment.",
          });
        }
      }

      // Create checkout session — the return URLs come from the one production
      // base URL (#531, his order: "one production base URL read from one place")
      const baseUrl = appBaseUrl();

      const checkoutUrl = await createSubscriptionCheckoutSession(
        customerId,
        input.plan,
        `${baseUrl}/app?billing=success`,
        `${baseUrl}/app?billing=canceled`,
        ctx.user.id,
        input.interval,
        input.creditUnits,
      ).catch((error: unknown) => {
        throw billingRefusalFor(error, "checkout", {
          userId: ctx.user.id,
          plan: input.plan,
          interval: input.interval,
          creditUnits: input.creditUnits,
        });
      });

      // Audit log: subscription checkout initiated
      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.SUBSCRIPTION_CREATED,
        resourceType: "subscription",
        resourceId: customerId,
        metadata: {
          plan: input.plan,
          interval: input.interval,
          /* The dial's position, in the audit row with everything else the
             checkout was minted for (#1832). Ledger credits beside it, like
             every other credit figure in this log. */
          creditUnits: input.creditUnits,
          creditUnitsLedgerCredits: planCreditSliderLedgerCredits(input.creditUnits),
          stage: "checkout_initiated",
        },
        req: ctx.req,
      });

      return { checkoutUrl };
    }),

  /**
   * BUY CREDITS — a one-off pack, for an account that is on a plan (#1606).
   *
   * The road it rebuilds died in February with the old top-up product
   * (`41a765ea`), and `addTopupCredits` has sat with no caller since — which is
   * why `server/db/billing.ts`'s own docblock says *"#1606 sells top-ups
   * again"*. Nothing of the deleted machinery comes back with it: the credit
   * PURCHASE VELOCITY CAPS that used to be called from inside the old
   * `createTopupCheckout` are NOT reinstated here (this card's law-7 clause
   * says so in terms, and the audit's H5 records why — what counts as too fast,
   * and what a blocked customer is told, is a product decision and belongs on
   * a card of its own, named on #1598).
   *
   * The shape follows `createSubscriptionCheckout` above clause for clause
   * (frozen account, customer id saved AND its verdict read, the price resolved
   * from Stripe's catalogue, an audit row) because every one of those clauses
   * was paid for by a real defect on the subscription road and a one-off sale
   * has the same four exposures. What differs:
   *
   *  · **`units`, not a pack id.** The three packs and the slider are one
   *    ladder (`shared/creditTopups.ts`), so there is one input and no second
   *    list of sizes to keep in step. `.strict()` and a bound, because
   *    `quantity` is what decides the charge.
   *  · **The plan rung is a gate.** `topupEligibility` is the card's own rule,
   *    and the refusal is a sentence that offers a plan rather than naming a
   *    tier (the disappearing-technology law's refusal clause).
   *  · **Nothing is granted here.** The credits land when the webhook says the
   *    money did. This procedure's only effect on the account is a Stripe
   *    customer id, exactly as the subscription road's does.
   */
  createTopupCheckout: protectedProcedure
    .input(z.object({
      /* The ladder's own bound, read from the ladder (working law 4). A
         fractional or out-of-range count never reaches the resolver — which
         refuses it too, because an input schema is not the only caller a money
         helper can ever have. */
      units: z.number().int().min(1).max(TOPUP_MAX_UNITS),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      const user = await getUserById(ctx.user.id);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }
      if (user.frozenAt) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Your account is currently under review. Purchases are temporarily paused while we verify your billing records. This usually resolves within 24-48 hours.",
        });
      }

      const subscription = await getSubscriptionByUserId(ctx.user.id);

      /* ⚠ A MISSING CREDITS ROW IS `free` HERE, AND ONLY HERE. On the server
         the rung is READ, so its absence is a fact about the account rather
         than a beat in a render — `getStatus` above answers the same way for
         the same reason. The three-state reading still earns its keep: an
         `unread` verdict can only mean a rung this product does not recognise,
         and that must refuse rather than fall through to a sale. */
      const eligibility = topupEligibility(subscription?.planTier ?? "free");
      if (eligibility !== "may-buy") {
        log.info(
          { userId: ctx.user.id, planTier: subscription?.planTier ?? null, eligibility },
          "[Billing] top-up refused — the account is not on a plan",
        );
        throw spokenError({
          code: "FORBIDDEN",
          message: TOPUP_NEEDS_A_PLAN_SENTENCE,
        });
      }

      const customerId = await getOrCreateStripeCustomer(
        ctx.user.id,
        user.email || `user-${ctx.user.id}@${PRODUCTION_APP_HOSTNAME}`,
        user.displayName || user.name || undefined,
        subscription?.stripeCustomerId
      );

      /* The subscription road's reasoning, unchanged and for a reason that is
         stronger here: this session's completion is found by its OWN metadata,
         but `getOrCreateStripeCustomer` can MINT a new customer when the saved
         one is gone, and a customer id the account does not hold would leave
         the next subscription webhook unable to find its user. Refusing costs
         a retry and nothing else — no session, no charge. */
      if (customerId !== subscription?.stripeCustomerId) {
        const saved = await updateUserSubscription(ctx.user.id, { stripeCustomerId: customerId });
        if (!saved.success) {
          log.error(
            { userId: ctx.user.id, customerId, error: saved.error },
            "[Billing] Stripe customer id could not be saved — refusing the top-up checkout rather than mint a session against an id the account does not hold",
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "We could not set up your billing account. Nothing was charged — please try again in a moment.",
          });
        }
      }

      const baseUrl = appBaseUrl();

      const checkoutUrl = await createTopupCheckoutSession(
        customerId,
        input.units,
        `${baseUrl}/app?credits=added`,
        `${baseUrl}/app?credits=canceled`,
        ctx.user.id,
      ).catch((error: unknown) => {
        throw billingRefusalFor(error, "top-up checkout", {
          userId: ctx.user.id,
          units: input.units,
        });
      });

      /* The audit row records the INTENT, which is all that has happened: the
         grant writes its own ledger line when the webhook lands. Credits in
         ledger units, like every other row in this log. */
      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.CREDITS_PURCHASED,
        resourceType: "credits",
        resourceId: customerId,
        metadata: {
          units: input.units,
          ledgerCredits: topupLedgerCredits(input.units),
          cents: topupPriceInCents(input.units),
          stage: "checkout_initiated",
        },
        req: ctx.req,
      });

      return { checkoutUrl };
    }),

  // Create customer portal session for subscription management
  createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
    const subscription = await getSubscriptionByUserId(ctx.user.id);
    
    if (!subscription?.stripeCustomerId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No billing account found. Please subscribe to a plan first.",
      });
    }

    const baseUrl = appBaseUrl();

    const portalUrl = await createCustomerPortalSession(
      subscription.stripeCustomerId,
      `${baseUrl}/app`
    );

    return { portalUrl };
  }),

  // Cancel subscription (at period end)
  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const subscription = await getSubscriptionByUserId(ctx.user.id);
    
    if (!subscription?.stripeSubscriptionId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No active subscription found.",
      });
    }

    const success = await cancelSubscription(subscription.stripeSubscriptionId);
    
    if (!success) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to cancel subscription.",
      });
    }

    // Audit log: subscription canceled
    await logAuditEvent({
      userId: ctx.user.id,
      action: AUDIT_ACTIONS.SUBSCRIPTION_CANCELED,
      resourceType: "subscription",
      resourceId: subscription.stripeSubscriptionId,
      metadata: {
        planTier: subscription.planTier,
        cancelAtPeriodEnd: true,
      },
      severity: "warning",
      req: ctx.req,
    });

    /* #1940 B25 — his approved receipt, with the period end this row already
       holds (the plan runs to it: `cancel_at_period_end`). */
    return { success: true, message: planCancelledReceipt(subscription.currentPeriodEnd) };
  }),

  // Reactivate canceled subscription
  reactivateSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const subscription = await getSubscriptionByUserId(ctx.user.id);
    
    if (!subscription?.stripeSubscriptionId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No subscription found.",
      });
    }

    const success = await reactivateSubscription(subscription.stripeSubscriptionId);
    
    if (!success) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to reactivate subscription.",
      });
    }

    return { success: true, message: "Subscription reactivated." };
  }),

  /**
   * WHERE THE CREDIT SLIDER ALREADY SITS, for an account that has one (#1832).
   *
   * ⚠ **IT IS ITS OWN PROCEDURE RATHER THAN A FIELD ON `getStatus`, AND THE
   * REASON IS LATENCY ON A HOT PATH.** The dial's position lives on Stripe —
   * it is the add-on subscription item's own quantity, which is the artifact
   * that bills — so reading it costs a Stripe round trip. `getStatus` is
   * fetched by every signed-in surface on load; this is fetched by one modal,
   * for one rung, by a client that has already read the spec and the account's
   * own tier and concluded there is a dial to place.
   *
   * ⚠ **AND IT IS NOT MIRRORED INTO A COLUMN** (working law 4, on credits). A
   * cached step count that drifted from the subscription would be an allowance
   * that disagrees with the invoice, and the renewal grant reads the same
   * artifact for the same reason.
   *
   * **`units: null` means UNREAD, never 0** — #1703's family rule, which this
   * card's own done-when names: the surface draws no thumb position until it
   * knows one, rather than putting the dial at the bottom and inviting a
   * customer to "confirm" a downgrade they never asked for.
   */
  getPlanCreditUnits: protectedProcedure.query(async ({ ctx }) => {
    const subscription = await getSubscriptionByUserId(ctx.user.id);
    if (!subscription?.stripeSubscriptionId) {
      /* No subscription is a real answer and it is ZERO rather than unread:
         there is no dial to place because there is nothing bought yet, and a
         fresh checkout starts the slider where the customer puts it. */
      return { units: 0 as number | null };
    }

    /* A rung with no dial cannot carry steps, so the Stripe read is skipped
       entirely — the same narrowing the grant road makes. */
    if (planCreditSliderUnitsAllowed(subscription.planTier) === 0) {
      return { units: 0 as number | null };
    }

    const billingState = await readSubscriptionBillingState(
      subscription.stripeSubscriptionId,
    );
    if (!billingState) {
      /* Unread, and said so. The surface declines to place the thumb rather
         than claiming the bottom of the dial. */
      return { units: null as number | null };
    }
    return {
      units: Math.min(
        billingState.currentCreditUnits,
        planCreditSliderUnitsAllowed(billingState.currentPlan),
      ) as number | null,
    };
  }),

  // Preview a plan change — the same quote `changePlan` acts on (#664), so
  // the figure a surface prints and the figure the button charges cannot be
  // two computations.
  previewPlanChange: protectedProcedure
    .input(z.object({
      newPlan: z.enum(PURCHASABLE_PLANS),
      // Absent = keep the interval the customer is billed on today.
      interval: z.enum(["monthly", "annual"]).optional(),
      /* The dial being bought (#1832). ⚠ ABSENT MEANS KEEP THE DIAL WHERE IT
         IS — never 0, for `interval`'s own reason one line up: an older bundle
         that omits it must not be able to hand back somebody's extra credits,
         and a cycle change is not a request to move the slider. Bounded for
         `createSubscriptionCheckout`'s reason; the quote clamps it to the
         TARGET rung, so a move off the slider's rung drops the steps. */
      creditUnits: z.number().int().min(0).max(PLAN_CREDIT_SLIDER_MAX_UNITS).optional(),
    }).strict())
    .query(async ({ ctx, input }) => {
      const subscription = await getSubscriptionByUserId(ctx.user.id);

      if (!subscription?.stripeSubscriptionId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active subscription found. Please subscribe first.",
        });
      }

      const billingState = await readSubscriptionBillingState(
        subscription.stripeSubscriptionId,
      );

      if (!billingState) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to calculate proration.",
        });
      }

      const quote = quotePlanChange(
        billingState,
        input.newPlan,
        input.interval,
        undefined,
        input.creditUnits,
        /* The same read `changePlan` takes (#1965), so "due today" here and
           the charge there are one arithmetic. */
        await planAllowanceLeftFor(ctx.user.id),
        /* And the same months-granted read (#2152), for the same reason. */
        (await annualYearFor(ctx.user.id, billingState, subscription.stripeSubscriptionId)).monthsGranted,
      );

      return {
        /* ⚠ **THE REFUSAL THE CONFIRM WOULD MEET, SERVED BEFORE IT (#1987).**
           `null` when the change can go ahead. The confirm step shows this
           sentence in place of the change's own, so she never presses a
           button whose only answer is no. */
        refusal: planChangeRefusal(billingState, quote),
        currentPlan: billingState.currentPlan,
        newPlan: input.newPlan,
        /* The dial on each side of the change, so the confirm step can say
           what is happening to it in the customer's own words (#1832). */
        currentCreditUnits: quote.currentCreditUnits,
        targetCreditUnits: quote.targetCreditUnits,
        isUpgrade: quote.isUpgrade,
        proratedAmount: quote.proratedAmount,
        immediateCharge: quote.immediateCharge,
        creditBalance: quote.creditBalance,
        currentPlanPrice: quote.currentPlanPrice,
        newPlanPrice: quote.newPlanPrice,
        daysRemaining: quote.daysRemaining,
        totalDays: quote.totalDays,
        creditAdjustment: quote.creditAdjustment,
        creditUnwind: quote.creditUnwind,
        spentShareCharge: quote.spentShareCharge,
        /* The credits that charge pays for (#1965 repair) — the confirm step
           says "Includes N credits you've already used", and N must be THIS
           quote's figure, never a second calculation on the client. */
        spentShareCredits: quote.spentShareCredits,
        kind: quote.kind,
        currentInterval: quote.currentInterval,
        targetInterval: quote.targetInterval,
        /* ⚠ **WHETHER THIS HAPPENS TODAY, AND WHEN IF NOT (#1936).** The
           confirm step draws its whole sentence from this quote, and without
           these two fields it would tell a customer that money is coming back
           and the plan is changing now — the sentences that stood here before
           his option 1 — while the server scheduled it for the boundary and
           moved nothing. The preview and the charge read ONE
           `quotePlanChange`, which is what keeps them from being two
           arithmetics; these are that same discipline applied to the one fact
           that is not a figure. */
        deferred: quote.deferred,
        effectiveAtSec: quote.effectiveAtSec,
      };
    }),

  // Get recent invoices
  getInvoices: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).optional().default(5),
    /* `.strict()` INSIDE the `.optional()`, and the order is the whole care
       (fable-1446 condition 1): the wrapper is what makes "send nothing"
       legal, and the strictness belongs to the OBJECT. Read at the runtime
       rather than assumed — `ZodOptional` has no `.strict` in zod 4, so the
       other order is a type error AND a TypeError, never a schema that
       silently stayed open. */
    }).strict().optional())
    .query(async ({ ctx, input }) => {
      const subscription = await getSubscriptionByUserId(ctx.user.id);
      
      if (!subscription?.stripeCustomerId) {
        return {
          invoices: [],
          hasMore: false,
        };
      }

      const result = await getCustomerInvoices(
        subscription.stripeCustomerId,
        input?.limit || 5
      );

      return result;
    }),

  // Get all invoices with pagination
  getAllInvoices: protectedProcedure
    .input(z.object({
      cursor: z.string().optional(),
    /* Strict on the OBJECT, optional on the whole — see `getInvoices`. Its
       only caller sends no input at all, so the arm proving `undefined`
       still parses is load-bearing rather than decoration. */
    }).strict().optional())
    .query(async ({ ctx, input }) => {
      const subscription = await getSubscriptionByUserId(ctx.user.id);
      
      if (!subscription?.stripeCustomerId) {
        return {
          invoices: [],
          hasMore: false,
          nextCursor: null,
        };
      }

      const result = await getAllCustomerInvoices(
        subscription.stripeCustomerId,
        input?.cursor
      );

      return result;
    }),

  // Get subscription details with renewal date
  getSubscriptionDetails: protectedProcedure.query(async ({ ctx }) => {
    const subscription = await getSubscriptionByUserId(ctx.user.id);
    
    if (!subscription?.stripeSubscriptionId) {
      return null;
    }

    const details = await getSubscriptionDetails(subscription.stripeSubscriptionId);
    
    if (!details) {
      return null;
    }

    return {
      planTier: subscription.planTier,
      renewalDate: details.currentPeriodEnd,
      status: details.status,
      cancelAtPeriodEnd: details.cancelAtPeriodEnd,
      currentPeriodStart: details.currentPeriodStart,
      currentPeriodEnd: details.currentPeriodEnd,
      billingInterval: details.billingInterval,
      /* ⚠ **THE SCHEDULED CHANGE, PROJECTED FIELD BY FIELD (#1936, invariant
         8).** Without it a deferred downgrade is invisible: she is told it
         happens on 7 Nov and then every screen goes on showing the plan she
         is leaving, with nothing coming.

         `scheduleId` is deliberately NOT projected. The undo takes no id from
         the client — it reads the schedule off her own subscription, the way
         every other procedure here takes the subscription from `ctx.user.id`
         (invariant 3) — so sending it would be a Stripe object id on the wire
         that nothing needs. */
      pendingChange: details.pendingChange
        ? {
            effectiveAt: details.pendingChange.effectiveAt,
            plan: details.pendingChange.plan,
            interval: details.pendingChange.interval,
            creditUnits: details.pendingChange.creditUnits,
            planName:
              SUBSCRIPTION_PRODUCTS[details.pendingChange.plan]?.name
              ?? details.pendingChange.plan,
            /* ⚠ **THE ALLOWANCE THE SCHEDULED POSITION BUYS, COMPUTED BY THE
               ONE HELPER THAT OWNS IT.** A dial move on the same rung changes
               no plan NAME, so the only honest thing the Billing tab can say
               about it is the credits a month she will have — and
               `monthlyLedgerCreditsFor` is server-side, so a client composing
               that figure from a step count would be a second arithmetic on a
               money surface. */
            monthlyCredits: monthlyLedgerCreditsFor(
              details.pendingChange.plan as PlanTier,
              details.pendingChange.creditUnits,
            ),
          }
        : null,
    };
  }),

  /**
   * UNDO A SCHEDULED CHANGE — "actually, keep me where I am" (#1936).
   *
   * ⚠ **THIS IS NOT A CONVENIENCE AND IT SHIPS IN THE SAME COMMIT AS THE
   * DEFERRAL ON PURPOSE.** Once a decrease waits for the period boundary,
   * there is a state a customer can get into that did not exist before: she
   * has asked to drop to Pro on 7 November and has changed her mind on the
   * 3rd. Without this she is stranded — the only road back would be to ask
   * for an INCREASE she does not want, and pay a proration for it.
   *
   * ⚠ **IT TAKES NO INPUT, AND THAT IS THE ACCESS CONTROL.** The schedule is
   * read off the subscription belonging to `ctx.user.id` (invariant 3), so
   * there is no id on the wire that could name somebody else's schedule, and
   * no ownership check to get wrong. `releaseScheduleBeforeWrite` is the same
   * helper the three write paths use — one expression of "release", not a
   * second one here.
   */
  cancelScheduledChange: protectedProcedure.mutation(async ({ ctx }) => {
    const subscription = await getSubscriptionByUserId(ctx.user.id);

    if (!subscription?.stripeSubscriptionId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No active subscription found.",
      });
    }

    const released = await releaseScheduleBeforeWrite(
      stripe,
      subscription.stripeSubscriptionId,
    );

    if (released.outcome === "failed") {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "We could not cancel that scheduled change. Nothing has changed — please try again.",
      });
    }

    /* ⚠ NOTHING TO RELEASE IS A SUCCESS, NOT A REFUSAL. Two clicks, or a
       click after the boundary has already passed, must not hand a customer
       an error for a state that is exactly what she asked for — she is
       staying on her plan either way. The audit row records which it was, so
       support can still tell them apart. */
    await logAuditEvent({
      userId: ctx.user.id,
      action: AUDIT_ACTIONS.SUBSCRIPTION_UPDATED,
      resourceType: "subscription",
      resourceId: subscription.stripeSubscriptionId,
      metadata: {
        scheduledChangeCancelled: true,
        outcome: released.outcome,
        planTier: subscription.planTier,
      },
      severity: "warning",
      req: ctx.req,
    });

    return {
      success: true,
      message:
        released.outcome === "released"
          ? "That change is cancelled — you stay on your current plan."
          : "You are staying on your current plan.",
    };
  }),

  // Change subscription plan and/or billing interval, invoiced immediately
  changePlan: protectedProcedure
    .input(z.object({
      newPlan: z.enum(PURCHASABLE_PLANS),
      // The billing cycle being bought (#664). ⚠ ABSENT MEANS KEEP THE CYCLE
      // THE CUSTOMER IS ON — never "monthly": an older bundle that omits it
      // must not be able to move somebody's interval, and the server reads
      // the current one off the Stripe price itself.
      interval: z.enum(["monthly", "annual"]).optional(),
      /* The dial being bought (#1832) — ⚠ ABSENT MEANS KEEP IT WHERE IT IS,
         for `interval`'s own reason: an older bundle that omits it must not
         hand back credits the customer is paying for. `previewPlanChange`
         carries the same field and the same bound, because the figure this
         charges is the figure that preview printed. */
      creditUnits: z.number().int().min(0).max(PLAN_CREDIT_SLIDER_MAX_UNITS).optional(),
      // Additive for deploy skew: current clients send one id per deliberate
      // click; an older bundle may omit it until the new client is live.
      //
      // ⚠ AND THE COMMENT ABOVE IS ABOUT THE OTHER DIRECTION — it held
      // the billing five open for months and does not argue for it
      // (opus-1104, ruled fable-1446). `.strict()` rejects an UNKNOWN key;
      // it says nothing about a MISSING optional one, which is exactly what
      // this field is. What closing these schemas really changes is the
      // REMOVAL contract — see invariant 4 in CLAUDE.md, where it now lives.
      clientRequestId: z.string().uuid().optional(),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      // Check if account is frozen
      const frozenUser = await getUserById(ctx.user.id);
      if (frozenUser?.frozenAt) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Your account is currently under review. Plan changes are temporarily paused while we verify your billing records.",
        });
      }

      const subscription = await getSubscriptionByUserId(ctx.user.id);
      
      if (!subscription?.stripeSubscriptionId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active subscription found. Please subscribe first.",
        });
      }

      // Read the billing state off the Stripe artifact, quote the change,
      // and only then act — the quote is the same one previewPlanChange
      // serves, so the confirm step and the charge cannot be two arithmetics.
      const billingState = await readSubscriptionBillingState(
        subscription.stripeSubscriptionId,
      );

      if (!billingState) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "We could not read your current billing details. Nothing was changed — please try again.",
        });
      }

      const annualYear = await annualYearFor(
        ctx.user.id,
        billingState,
        subscription.stripeSubscriptionId,
      );
      const annualMonthsGranted = annualYear.monthsGranted;
      const quote = quotePlanChange(
        billingState,
        input.newPlan,
        input.interval,
        undefined,
        input.creditUnits,
        /* ⚠ What is left of the allowance decides how much of an interval
           switch's unused share can be taken back and how much is paid for
           (#1965). Read before the charge, from the same helper the preview
           reads it through. */
        await planAllowanceLeftFor(ctx.user.id),
        /* ⚠ How much of a yearly plan's year has actually been handed over
           (#2152) — the take-back, the upgrade's top-up and the spent-share
           charge are all priced in it. */
        annualMonthsGranted,
      );

      /*
        ⚠ **THE DIAL'S LEDGER FIGURES ARE COMPUTED HERE, BEFORE THE POINT OF NO
        RETURN, AND THAT POSITION IS THE WHOLE CARE (#1832).**
        `planCreditSliderLedgerCredits` REFUSES a value that is not a whole
        number of steps — correct for a money helper — and the audit row and the
        confirmation sentence that read it both run AFTER `updateSubscriptionPlan`
        has succeeded. A throw down there is the #796 class exactly: Stripe has
        already changed the plan and invoiced for it, and the customer is handed
        an error for a change that happened.

        The quote is TYPED to carry both fields, so this should be unreachable —
        and `server/routes/billingRequestPathVerdicts.test.ts` found it anyway,
        because a test double cast with `as ReturnType<…>` satisfies the
        compiler while omitting them. That is a fair model of the real exposure:
        the type is a claim about `quotePlanChange`, and this code's safety
        should not rest on it one statement past the charge.

        So the arithmetic happens where a refusal costs nothing — nothing has
        been attempted yet — and what crosses into the post-charge block is two
        plain numbers.
      */
      const currentSliderLedger = planCreditSliderLedgerCredits(quote.currentCreditUnits);
      const targetSliderLedger = planCreditSliderLedgerCredits(quote.targetCreditUnits);

      /* ⚠ THE "NOTHING TO DO" REFUSAL NOW HAS A THIRD LIMB, and without it a
         customer who moved only the slider would be told they are already on
         this plan — which they are, and the dial is the thing they changed
         (#1832). All three have to agree before there is nothing to do. */
      if (
        input.newPlan === billingState.currentPlan
        && quote.kind === "same-interval"
        && quote.targetCreditUnits === quote.currentCreditUnits
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You are already on this plan and billing cycle.",
        });
      }

      /* ⚠ **A STATE THAT CANNOT TAKE A CHANGE IS REFUSED BEFORE EITHER ROAD
         (#1987)** — the instant one and the deferred one alike, and before
         anything is attempted. The sentence is the one the preview already
         showed her; see `planChangeRefusal` for each state and why. */
      const refusal = planChangeRefusal(billingState, quote);
      if (refusal) {
        throw new TRPCError({ code: "BAD_REQUEST", message: refusal });
      }

      /*
        ⚠ **A DECREASE DOES NOT HAPPEN TODAY — IT IS SCHEDULED FOR THE PERIOD
        BOUNDARY (#1936), AND THIS BRANCH IS WHERE THE CREDIT-MINTING LOOP IS
        CLOSED.**

        His ruling, verbatim: *"1 for the slider fix"* — option 1 of three: a
        DECREASE takes effect at the next renewal, with no refund and no credit
        take-back; an INCREASE stays instant.

        The loop it closes: `always_invoice` returned the unused share of the
        period as money to the customer's Stripe balance, while the credit
        take-back floored at what was LEFT of the allowance (his own *"spent
        credits are spent"*). Raise the dial, spend the credits, lower it for
        the money, raise again out of that balance — up to 380,000 display
        credits a round trip on the top rung, ×12 on an annual cycle, with no
        rate limit on this procedure. Both halves were individually right.

        ⚠ **IT RETURNS BEFORE `updateSubscriptionPlan` AND THAT POSITION IS THE
        WHOLE OF IT.** Everything below this line is the instant road: the
        Stripe price write, the settlement record, the local tier write, the
        audit row. A deferred change must reach NONE of them — the plan she is
        on has not changed, so writing `planTier` now would hand her the lower
        allowance at the next renewal AND take the higher one away today,
        which is worse than the defect.

        ⚠ **AND THERE IS NO CREDIT SETTLEMENT HERE ON PURPOSE.** Nothing moves,
        in either direction, so there is nothing to record against an invoice
        — and there is no invoice: `from_subscription` raises no prorations.
        `creditSettlement: "none"` is the literal truth rather than a default.
      */
      if (quote.deferred) {
        /*
          ⚠ **A DECREASE IS REFUSED WHILE THE PLAN IS ALREADY SET TO END, AND
          WITHOUT THIS REFUSAL THE DEFERRAL UNDOES THE CANCELLATION (#1936
          repair 2).**

          `scheduleSubscriptionChange` mints a two-phase schedule — the period
          in progress, then a target phase that STARTS at the renewal and runs
          one billing period, with `end_behavior: "release"`. On a subscription
          carrying `cancel_at_period_end`, that second phase CONTINUES the
          subscription past the date it was meant to end, and the customer is
          charged at the renewal she had cancelled. She asked for less and got
          another period.

          ⚠ **The two repairs that are not taken, so neither is re-opened
          cheaply.** Scheduling the decrease and keeping the cancellation means
          minting a phase and then cancelling into it, which is a Stripe
          interaction this module has NOT driven (see its header's own note on
          what is reasoned from documentation) — and the phase would be billed
          for a period nobody wants. Cancelling the cancellation to let the
          change through decides something she never asked for. So the product
          says what is in the way, in her own words, and leaves both facts
          where she put them.

          It reads `endsAtSec` off the billing state, which is the same
          `subscriptions.retrieve` the period and the dial come from — not our
          `subscriptions` row, which a webhook writes late and which a change
          made in Stripe's own portal would leave stale in exactly the
          direction that lets this through.

          ⚠ **THE REFUSAL ITSELF NOW LIVES IN `planChangeRefusal` AND RAN
          ABOVE, BEFORE EITHER ROAD (#1987).** It moved so the preview could
          serve the same sentence before the press, and it reads both of
          Stripe's ending shapes — `cancel_at_period_end` AND a `cancel_at`
          date, the second of which this branch could not see.
        */

        const scheduled = await scheduleSubscriptionChange(
          stripe,
          subscription.stripeSubscriptionId,
          ctx.user.id,
          {
            plan: input.newPlan,
            interval: quote.targetInterval,
            creditUnits: quote.targetCreditUnits,
          },
        ).catch((error: unknown) => {
          /* The catalogue's own refusal, rethrown the way the instant road
             rethrows it — nothing was attempted. */
          throw billingRefusalFor(error, "scheduled plan change", {
            userId: ctx.user.id,
            plan: input.newPlan,
            interval: quote.targetInterval,
          });
        });

        if (!scheduled.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              "We could not schedule that change, so nothing was changed. Your plan is exactly as it was — please try again.",
          });
        }

        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.SUBSCRIPTION_UPDATED,
          resourceType: "subscription",
          resourceId: subscription.stripeSubscriptionId,
          metadata: {
            scheduled: true,
            effectiveAt: scheduled.effectiveAt.toISOString(),
            scheduleId: scheduled.scheduleId,
            previousPlan: billingState.currentPlan,
            newPlan: input.newPlan,
            previousInterval: quote.currentInterval,
            newInterval: quote.targetInterval,
            previousCreditUnits: quote.currentCreditUnits,
            newCreditUnits: quote.targetCreditUnits,
            creditUnitsLedgerDelta: targetSliderLedger - currentSliderLedger,
            changeKind: quote.kind,
            /* Said explicitly rather than left to be inferred from absence:
               this is the row support reads when a customer asks why no
               refund arrived. */
            proratedAmount: 0,
            creditAdjustment: 0,
            creditsReturned: 0,
            creditSettlement: "none",
          },
          severity: "warning",
          req: ctx.req,
        });

        const targetName = SUBSCRIPTION_PRODUCTS[input.newPlan]?.name ?? input.newPlan;
        return {
          success: true as const,
          /* Her own terms, and it says all three things that matter: what
             happens, when, and that nothing is being taken from her today. */
          message: `${targetName} starts on ${formatCustomerShortDate(scheduled.effectiveAt)}. Nothing is charged today, and your plan and credits stay as they are until then.`,
          proratedAmount: 0,
          creditAdjustment: 0,
          creditSettlement: "none" as const,
          targetInterval: quote.targetInterval,
          changeKind: quote.kind,
          deferred: true as const,
          effectiveAt: scheduled.effectiveAt,
        };
      }

      // Update the subscription in Stripe — at the interval being bought,
      // invoiced immediately (always_invoice; see updateSubscriptionPlan).
      const result = await updateSubscriptionPlan(
        subscription.stripeSubscriptionId,
        input.newPlan,
        ctx.user.id,
        quote.targetInterval,
        billingState.subscriptionItemId,
        /* The dial comes from the QUOTE, not from the input — the quote is
           what clamped it to the target rung and what the customer was shown
           (#1832). Passing the raw input here would let the charge and the
           confirm step be two arithmetics, which is the defect this whole
           quote-then-act shape exists to prevent. */
        { targetCreditUnits: quote.targetCreditUnits, creditItemId: billingState.creditItemId },
        /* The spent share of an interval switch, charged on the same invoice
           (#1965) — from the quote, for the same reason the dial is. */
        quote.spentShareCharge,
      ).catch((error: unknown) => {
        /* The ONLY throw this function has: a price the catalogue cannot
           supply, rethrown there rather than folded into `success: false`
           because nothing was attempted. Its own docblock carries why. */
        throw billingRefusalFor(error, "plan change", {
          userId: ctx.user.id,
          plan: input.newPlan,
          interval: quote.targetInterval,
        });
      });

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Failed to change plan.",
        });
      }

      // ⚠ CREDITS MIRROR THE MONEY'S OWN PRORATION, IN BOTH DIRECTIONS —
      // AND THEY MOVE WHEN THAT MONEY SETTLES (#664 findings 1+3; #711).
      // Stripe's `always_invoice` nets the money side of every change, so the
      // credit side nets the same share:
      //   · same-interval upgrade   → grant the remaining-cycle share (+)
      //   · same-interval downgrade → deduct the same share (−)
      //   · interval switch         → deduct the OLD period's unconsumed
      //     grant; the switch invoice's webhook grants the NEW period.
      // But the Stripe update SUCCEEDING is not the money settling: the
      // `always_invoice` charge can decline, and a grant applied here-and-now
      // let a declined card keep an upgrade's credits (×12 on annual) while
      // the invoice sat unpaid. So the move is RECORDED against the change's
      // own invoice and APPLIED when that invoice is paid — which for a
      // working card (and every zero-due downgrade invoice) is already true
      // by the time we look, so the happy path applies in this same breath.
      // The record-then-recheck order and the shared ledger key are the race
      // analysis — see stripe/planChangeSettlement.ts. Deductions still floor
      // at APPLICATION time: spent credits are spent.
      //
      // ⚠ BUT THEY FLOOR AT THE PLAN'S PART, NOT AT THE TOTAL BALANCE — #1661,
      // and this REVERSES the sentence that stood here (#1604's law-7 sweep).
      // It read: *the #664 "deliberately coarse mirror" ruling (the floor is
      // the total balance; no per-source lots) carries over unchanged.*
      //
      // #664's ruling was CORRECT when it was made and is not being
      // overturned: it was coarse because there was nothing to be fine about.
      // There were no per-source lots, and no purchased credits either — the
      // one-time top-up product had been removed in February (41a765ea) and
      // nothing could reach `addTopupCredits`. **#1604 creates the thing that
      // ruling says does not exist**, and a floor at the total balance would
      // then settle a dispute about the customer's PLAN ALLOWANCE out of
      // credits she BOUGHT.
      //
      // Worked: 25,000 bought, 2,000 of the allowance left, a downgrade whose
      // mirror is 8,000. The old floor deducts min(8,000, 27,000) = 8,000 and
      // 6,000 of that is her money. The plan's part gives min(8,000, 2,000) =
      // 2,000 — spent allowance is still spent, out of the right pocket.
      //
      // Still coarse in the way #664 meant: ONE number, no lots, no reconciling
      // a pending grant against a later deduction. What changed is which pocket
      // the one number describes.
      const currentPlan = billingState.currentPlan;
      const creditAdjustment = quote.creditAdjustment;
      const creditsToReturn =
        quote.kind === "interval-switch" ? quote.creditUnwind : Math.max(0, -creditAdjustment);

      /* ⚠ AN INSTANT CHANGE ON A YEARLY PLAN GRANTED MONTH BY MONTH ALSO
         RAISES THE MONTHS STILL TO COME (#2152, his ruling on #2159: "yearly
         credits apply month by month"). The grant above covers the month in
         hand; the rest of the year is paid for too, so the paid year's month
         becomes the new plan's — installed by the settlement when this
         change's invoice is PAID, never before. Only an increase reaches here
         (a decrease is deferred to the renewal, whose invoice starts a new
         year at the new plan). `null` when there is no year in flight: a
         monthly plan, or a year granted up front — and `null` too when the year
         on the row is not Stripe's current one (the next year's invoice will
         size that year by its own plan). */
      const annualMonthAfterChange =
        annualYear.yearStart !== null && quote.kind === "same-interval"
          ? monthlyLedgerCreditsFor(input.newPlan as PlanTier, quote.targetCreditUnits)
          : null;

      const direction: "grant" | "unwind" | null =
        creditAdjustment > 0 || (annualMonthAfterChange !== null && creditAdjustment >= 0)
          ? "grant"
          : creditsToReturn > 0
            ? "unwind"
            : null;
      let creditSettlement: "applied" | "pending" | "none" = "none";

      if (direction) {
        const settlementCredits = direction === "grant" ? creditAdjustment : creditsToReturn;
        const description =
          direction === "grant"
            ? `Prorated credits for upgrade to ${input.newPlan}`
            : quote.kind === "interval-switch"
              ? `Unused ${quote.currentInterval} cycle credits returned with its refund (switch to ${input.newPlan}, billed ${quote.targetInterval === "annual" ? "yearly" : "monthly"})`
              : `Prorated credits returned with the refund for downgrading to ${input.newPlan}`;

        if (!result.invoiceId) {
          // `always_invoice` should make this unreachable: no invoice means
          // no settlement signal to hang on. The declared fallback is the old
          // immediate move — withholding here would risk a paid customer's
          // credits to close a bounded house exposure, which is the wrong
          // trade — and it is loud, never silent.
          log.error(
            { userId: ctx.user.id, subscriptionId: subscription.stripeSubscriptionId },
            "[Billing] plan change produced NO invoice — applying the credit move immediately (legacy road)",
          );
          if (direction === "grant") {
            const creditResult = settlementCredits > 0
              ? await addCredits(
                  ctx.user.id,
                  settlementCredits,
                  "bonus",
                  description,
                  input.clientRequestId ? `plan-change:${input.clientRequestId}` : undefined,
                )
              : { success: true };
            if (creditResult.success && annualMonthAfterChange !== null && annualYear.yearStart !== null) {
              await installAnnualMonthlyCredits(ctx.user.id, annualMonthAfterChange, annualYear.yearStart);
            }
            if (!creditResult.success) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "The plan changed, but the credit adjustment could not be recorded. Contact support before retrying.",
              });
            }
          } else {
            const liveCredits = await getUserCredits(ctx.user.id);
            /* THE PLAN'S PART, read off the SAME row the balance comes from —
               #1661. Two reads would be two different moments on a money path,
               and `planAllowanceRemaining` already has the balance in hand. A
               null row answers 0, which is the direction that cannot claw back
               credits whose provenance could not be read. */
            const returnable = Math.min(
              settlementCredits,
              liveCredits ? planAllowanceRemaining(liveCredits) : 0,
            );
            if (returnable > 0) {
              const unwindResult = await deductCredits(
                ctx.user.id,
                returnable,
                "subscription",
                description,
                input.clientRequestId ? `plan-change-unwind:${input.clientRequestId}` : undefined,
                { toolKind: null },
              );
              if (!unwindResult.success && !unwindResult.duplicate) {
                log.error(
                  { userId: ctx.user.id, returnable, error: unwindResult.error },
                  "[Billing] plan-change credit unwind failed after the Stripe update",
                );
              }
            }
          }
          creditSettlement = "applied";
        } else {
          // Record FIRST, then read the status FRESH: a webhook that fired
          // before the row existed can never re-fire, so the fresh read is
          // what closes that gap (planChangeSettlement.ts, the race note).
          const recorded = await queuePlanChangeSettlement({
            userId: ctx.user.id,
            stripeInvoiceId: result.invoiceId,
            direction,
            credits: settlementCredits,
            description,
            clientRequestId: input.clientRequestId,
            annualMonthlyCredits: direction === "grant" ? annualMonthAfterChange : null,
            annualPeriodStart: direction === "grant" && annualMonthAfterChange !== null ? annualYear.yearStart : null,
          });
          if (!recorded.success) {
            if (direction === "grant") {
              // The customer's money is (or will be) taken and nothing now
              // owes them the credits — that must not pass as success.
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "The plan changed, but the credit adjustment could not be recorded. Contact support before retrying.",
              });
            }
            // A lost unwind is house exposure, visible, never the customer's
            // problem — the same stance as a failed unwind before #711.
            log.error(
              { userId: ctx.user.id, invoiceId: result.invoiceId },
              "[Billing] plan-change unwind settlement could not be recorded",
            );
          } else {
            // The fresh re-read is the LAST road to the credits when the
            // invoice paid synchronously and its webhook was consumed before
            // the row existed (PR #755 review, finding 1) — so a transient
            // read failure retries before we defer. A real answer ("open",
            // "paid") stops the loop; only null (the read itself failing)
            // spends another attempt.
            let status: string | null = result.invoiceStatus === "paid" ? "paid" : null;
            for (let attempt = 0; status === null && attempt < 3; attempt++) {
              status = await getInvoiceStatus(result.invoiceId);
            }
            if (status === "paid") {
              const applied = await applyPlanChangeSettlement(result.invoiceId);
              if (applied.outcome === "failed") {
                if (direction === "grant") {
                  throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "The plan changed, but the credit adjustment could not be recorded. Contact support before retrying.",
                  });
                }
                // Failed unwind: visible in the module's own log; the row
                // stays pending as the support artifact.
                creditSettlement = "pending";
              } else {
                creditSettlement = "applied";
              }
            } else {
              // The charge has not settled — Stripe is collecting (or the
              // card declined and Stripe will retry). The credits move when
              // invoice.payment_succeeded lands; a final failure voids them.
              creditSettlement = "pending";
            }
          }
        }
      }

      // Update local subscription record — the period dates for an interval
      // switch come from the subscription webhook, which reads them off the
      // updated Stripe object rather than guessing them here.
      //
      // ⚠ THE VERDICT IS READ, AND A FAILURE HERE IS NOT THE CUSTOMER'S (#796).
      // By this line Stripe has ACCEPTED the change and the credits have moved
      // (or are queued on the invoice), so throwing would tell a customer their
      // upgrade failed when it did not — and a retry meets "You are already on
      // this plan", because `changePlan` reads the current plan off Stripe, not
      // off this row. The webhook is the corrector: `customer.subscription.updated`
      // writes `planTier` and `billingInterval` from the Stripe object and, since
      // #794, FAILS its event on a lost write so Stripe redelivers until it
      // lands. Until then the account reads its old tier — minutes, normally.
      // The audit row says which road the record took, so support can tell a
      // deferred write from a written one.
      const localRecord = await updateUserSubscription(ctx.user.id, {
        planTier: input.newPlan,
        billingInterval: stripeIntervalOf(quote.targetInterval),
      });
      if (!localRecord.success) {
        log.error(
          { userId: ctx.user.id, newPlan: input.newPlan, error: localRecord.error },
          "[Billing] plan change accepted by Stripe but the local record could not be written — the subscription.updated webhook is the corrector",
        );
      }

      // What the change actually cost: Stripe's own invoice when readable,
      // our day-granular quote otherwise — and the audit row says which.
      const proratedAmount = result.invoicedAmount ?? quote.proratedAmount;

      // Audit log: subscription plan changed
      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.SUBSCRIPTION_UPDATED,
        resourceType: "subscription",
        resourceId: subscription.stripeSubscriptionId,
        metadata: {
          previousPlan: currentPlan,
          newPlan: input.newPlan,
          previousInterval: quote.currentInterval,
          newInterval: quote.targetInterval,
          /* The dial on each side (#1832) — steps, with the ledger credits
             they are worth, because a step count alone is not a figure anybody
             reading this log can act on. */
          previousCreditUnits: quote.currentCreditUnits,
          newCreditUnits: quote.targetCreditUnits,
          creditUnitsLedgerDelta: targetSliderLedger - currentSliderLedger,
          changeKind: quote.kind,
          isUpgrade: quote.isUpgrade,
          creditAdjustment,
          creditsReturned: creditsToReturn,
          /* The part of the switch's unused share that was already spent, and
             what was charged for it instead of taken back (#1965). */
          spentShareCredits: quote.spentShareCredits,
          spentShareCharge: quote.spentShareCharge,
          creditSettlement,
          localRecord: localRecord.success ? "written" : "deferred-to-webhook",
          settlementInvoiceId: result.invoiceId ?? null,
          proratedAmount,
          amountSource: result.invoicedAmount != null ? "stripe-invoice" : "estimate",
        },
        req: ctx.req,
      });

      const planName = SUBSCRIPTION_PRODUCTS[input.newPlan]?.name ?? input.newPlan;
      /*
        ⚠ **A DIAL-ONLY MOVE IS NEITHER AN UPGRADE NOR A DOWNGRADE OF THE PLAN,
        AND WITHOUT THIS BRANCH IT READ AS A DOWNGRADE (#1832).**

        `quote.isUpgrade` compares the two RUNGS' prices, which is right for
        the button's label and right for the direction of a tier move. On the
        slider's rung a customer can change only the dial — same plan, same
        cycle, more credits and more money — and `isUpgrade` is then `false`,
        so the sentence below would have told somebody who just bought 50,000
        extra credits a month that they had been *downgraded* and that their
        unused time was coming back as billing credit. Both halves false.

        So the dial gets its own sentence, in the customer's own units (credits
        a month, which is the figure on the card they moved), and the plan's
        two sentences are untouched for every change that moves a rung.
      */
      const sliderLedgerDelta = targetSliderLedger - currentSliderLedger;
      const dialOnly =
        input.newPlan === currentPlan
        && quote.kind === "same-interval"
        && sliderLedgerDelta !== 0;
      /* The whole allowance the dial now buys, said once rather than three
         times — a delta ("+50,000") is arithmetic the customer has to do
         against a figure they cannot see from here. */
      const dialMonthlyFigure = formatCredits(
        displayBalance(
          monthlyLedgerCreditsFor(input.newPlan as PlanTier, quote.targetCreditUnits),
        ),
      );
      /*
        ⚠ **THREE SENTENCES HERE PROMISED MONEY BACK AND #1936 MADE ALL THREE
        FALSE — this is that card's law-7 sweep on its own file, and the class
        is "copy that promises a refund on a decrease".**

        Each of them — the dial-down, the switch to monthly, and the plain
        downgrade — said some version of *"unused time comes back as billing
        credit"*. That was TRUE while `always_invoice` returned the unused
        share in the same act, and it is the exact behaviour his option 1
        removes. Every one of those three changes now returns from the
        deferred branch far above, so these arms are reachable only when
        `proratedAmount >= 0` — where **no money comes back at all** — and the
        refund clause is false in every case that can still get here.

        ⚠ **THEY ARE REACHABLE, WHICH IS WHY THEY ARE REWRITTEN RATHER THAN
        DELETED.** `daysRemaining` is 0 at the instant the period ends, so a
        decrease asked for in that moment quotes 0 and takes the instant road.
        Nothing is owed either way, and these sentences now say only what
        happened. The upgrade arms are untouched: money is charged on those
        and the credits really do land.
      */
      const message =
        dialOnly
          ? sliderLedgerDelta > 0
            ? creditSettlement === "pending"
              ? `${planName} now comes with ${dialMonthlyFigure} credits a month. The extra credits for the rest of this month land as soon as the payment settles.`
              : `${planName} now comes with ${dialMonthlyFigure} credits a month, and the extra credits for the rest of this month are already on your balance.`
            : `${planName} now comes with ${dialMonthlyFigure} credits a month.`
          : quote.kind === "interval-switch"
          ? quote.targetInterval === "annual"
            ? `You are on ${planName}, billed yearly — the new billing year starts today. ${YEARLY_SWITCH_CREDITS_SENTENCE}`
            : `You are on ${planName}, billed monthly — the new billing month starts today.`
          : quote.isUpgrade
            /* A yearly upgrade at a month's very edge owes nothing for the
               month in hand (#2152); "0 bonus credits added" would be a figure
               with nothing behind it. */
            ? creditAdjustment <= 0
              ? `Upgraded to ${planName}!`
              : creditSettlement === "pending"
              ? `Upgraded to ${planName}! Your ${formatCredits(displayBalance(creditAdjustment))} bonus credits land as soon as the payment settles.`
              : `Upgraded to ${planName}! ${formatCredits(displayBalance(creditAdjustment))} bonus credits added.`
            : `You are on ${planName}.`;

      return {
        success: true,
        message,
        proratedAmount,
        creditAdjustment,
        creditSettlement,
        targetInterval: quote.targetInterval,
        changeKind: quote.kind,
        /* The instant road carries the same two fields as the deferred one, so
           a caller reads one shape and never has to ask which branch it got
           (the client's `onSuccess` is one handler for both). */
        deferred: false as const,
        effectiveAt: null,
      };
    }),
});
