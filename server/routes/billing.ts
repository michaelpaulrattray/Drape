import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  getUserById,
  getSubscriptionByUserId,
  updateUserSubscription,
  addCredits,
  deductCredits,
  getUserCredits,
} from "../db";
import {
  getOrCreateStripeCustomer,
  createSubscriptionCheckoutSession,
  createCustomerPortalSession,
  getSubscriptionDetails,
  cancelSubscription,
  reactivateSubscription,
  readSubscriptionBillingState,
  quotePlanChange,
  updateSubscriptionPlan,
  getCustomerInvoices,
  getAllCustomerInvoices,
} from "../stripe/stripeService";
import { stripeIntervalOf } from "@shared/annualBilling";
import {
  SUBSCRIPTION_PRODUCTS,
  SubscriptionPlan,
  PURCHASABLE_PLANS,
  OFFERED_PLAN_ORDER,
  OFFERED_PLAN_TIERS,
  ownPlanFacts,
} from "../stripe/stripeProducts";
import { appBaseUrl, PRODUCTION_APP_HOSTNAME } from "../_core/appOrigin";
import { logAuditEvent, AUDIT_ACTIONS } from "../auditLog";
import { SlackAlerts } from "../slack/slackNotification";
import { z } from "zod";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("routes/billing");
import { TRPCError } from "@trpc/server";

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
          description: plan.description,
          priceInCents: plan.priceInCents,
          credits: plan.credits,
          features: plan.features,
          interval: plan.interval,
        };
      }),
      tiers: OFFERED_PLAN_TIERS,
      planOrder: OFFERED_PLAN_ORDER,
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
    }).strict())
    .mutation(async ({ ctx, input }) => {
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

      // Save customer ID if new
      if (!subscription?.stripeCustomerId) {
        await updateUserSubscription(ctx.user.id, { stripeCustomerId: customerId });
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
        input.interval
      );

      // Audit log: subscription checkout initiated
      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.SUBSCRIPTION_CREATED,
        resourceType: "subscription",
        resourceId: customerId,
        metadata: {
          plan: input.plan,
          interval: input.interval,
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

    return { success: true, message: "Subscription will be canceled at the end of the billing period." };
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

  // Preview a plan change — the same quote `changePlan` acts on (#664), so
  // the figure a surface prints and the figure the button charges cannot be
  // two computations.
  previewPlanChange: protectedProcedure
    .input(z.object({
      newPlan: z.enum(PURCHASABLE_PLANS),
      // Absent = keep the interval the customer is billed on today.
      interval: z.enum(["monthly", "annual"]).optional(),
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

      const quote = quotePlanChange(billingState, input.newPlan, input.interval);

      return {
        currentPlan: billingState.currentPlan,
        newPlan: input.newPlan,
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
        kind: quote.kind,
        currentInterval: quote.currentInterval,
        targetInterval: quote.targetInterval,
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

      const quote = quotePlanChange(billingState, input.newPlan, input.interval);

      if (input.newPlan === billingState.currentPlan && quote.kind === "same-interval") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You are already on this plan and billing cycle.",
        });
      }

      // Update the subscription in Stripe — at the interval being bought,
      // invoiced immediately (always_invoice; see updateSubscriptionPlan).
      const result = await updateSubscriptionPlan(
        subscription.stripeSubscriptionId,
        input.newPlan,
        ctx.user.id,
        quote.targetInterval,
        billingState.subscriptionItemId,
      );

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Failed to change plan.",
        });
      }

      // ⚠ CREDITS MIRROR THE MONEY'S OWN PRORATION, IN BOTH DIRECTIONS
      // (#664 review findings 1+3). Stripe's `always_invoice` nets the money
      // side of every change — unused time comes back as customer balance —
      // so the credit side must net the same share or alternating changes
      // mint allowance: upgrade-then-downgrade kept the ×12 grant while the
      // money returned, and switch-then-switch-back re-granted a period
      // whose money had been refunded. One rule closes the class:
      //   · same-interval upgrade   → grant the remaining-cycle share (+)
      //   · same-interval downgrade → deduct the same share (−)
      //   · interval switch         → deduct the OLD period's unconsumed
      //     grant; the switch invoice's webhook grants the NEW period.
      // Deductions floor at the live balance: spent credits are spent.
      const currentPlan = billingState.currentPlan;
      const creditAdjustment = quote.creditAdjustment;
      const creditsToReturn =
        quote.kind === "interval-switch" ? quote.creditUnwind : Math.max(0, -creditAdjustment);

      if (creditAdjustment > 0) {
        // Add prorated credits for upgrade
        const creditResult = await addCredits(
          ctx.user.id,
          creditAdjustment,
          "bonus",
          `Prorated credits for upgrade to ${input.newPlan}`,
          input.clientRequestId ? `plan-change:${input.clientRequestId}` : undefined,
        );
        if (!creditResult.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "The plan changed, but the credit adjustment could not be recorded. Contact support before retrying.",
          });
        }
      } else if (creditsToReturn > 0) {
        // Floor at the balance read NOW (not the pre-change row): a deduction
        // that exceeds the balance is refused by deductCredits, and a spend
        // mid-change must cost the customer nothing extra.
        const liveCredits = await getUserCredits(ctx.user.id);
        const returnable = Math.min(creditsToReturn, Math.max(0, liveCredits?.balance ?? 0));
        if (returnable > 0) {
          const unwindResult = await deductCredits(
            ctx.user.id,
            returnable,
            "subscription",
            quote.kind === "interval-switch"
              ? `Unused ${quote.currentInterval} cycle credits returned with its refund (switch to ${input.newPlan}, billed ${quote.targetInterval === "annual" ? "yearly" : "monthly"})`
              : `Prorated credits returned with the refund for downgrading to ${input.newPlan}`,
            input.clientRequestId ? `plan-change-unwind:${input.clientRequestId}` : undefined,
            // Not a tool spend: the unwind returns unconsumed allowance
            // beside Stripe's money credit for the same days. One of the two
            // deliberate null-toolKind sites (#401; the other is the
            // chargeback revoke in stripe/webhooks.ts).
            { toolKind: null },
          );
          if (!unwindResult.success && !unwindResult.duplicate) {
            // The plan HAS changed and the money side is already netted;
            // a failed unwind must be visible, not silent generosity.
            log.error(
              { userId: ctx.user.id, returnable, error: unwindResult.error },
              "[Billing] plan-change credit unwind failed after the Stripe update",
            );
          }
        }
      }

      // Update local subscription record — the period dates for an interval
      // switch come from the subscription webhook, which reads them off the
      // updated Stripe object rather than guessing them here.
      await updateUserSubscription(ctx.user.id, {
        planTier: input.newPlan,
        billingInterval: stripeIntervalOf(quote.targetInterval),
      });

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
          changeKind: quote.kind,
          isUpgrade: quote.isUpgrade,
          creditAdjustment,
          creditsReturned: creditsToReturn,
          proratedAmount,
          amountSource: result.invoicedAmount != null ? "stripe-invoice" : "estimate",
        },
        req: ctx.req,
      });

      const planName = SUBSCRIPTION_PRODUCTS[input.newPlan]?.name ?? input.newPlan;
      const message =
        quote.kind === "interval-switch"
          ? quote.targetInterval === "annual"
            ? `You are on ${planName}, billed yearly — the new billing year starts today, and the full year of credits lands as soon as the payment settles, replacing what was left of your old cycle's allowance.`
            : `You are on ${planName}, billed monthly — the new billing month starts today, and unused time from your year comes off future bills automatically.`
          : quote.isUpgrade
            ? `Upgraded to ${planName}! ${creditAdjustment} bonus credits added.`
            : `Downgraded to ${planName}. Unused time on the old price comes back as billing credit, and its unused credits go with it.`;

      return {
        success: true,
        message,
        proratedAmount,
        creditAdjustment,
        targetInterval: quote.targetInterval,
        changeKind: quote.kind,
      };
    }),
});
