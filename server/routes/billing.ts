import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  getUserById,
  getSubscriptionByUserId,
  updateUserSubscription,
  addCredits,
} from "../db";
import {
  getOrCreateStripeCustomer,
  createSubscriptionCheckoutSession,
  createCustomerPortalSession,
  getSubscriptionDetails,
  cancelSubscription,
  reactivateSubscription,
  calculateProration,
  updateSubscriptionPlan,
  calculateCreditAdjustment,
  getCustomerInvoices,
  getAllCustomerInvoices,
} from "../stripe/stripeService";
import {
  SUBSCRIPTION_PRODUCTS,
  SubscriptionPlan,
  PAID_PLAN_ORDER,
  PURCHASABLE_PLANS,
  OFFERED_PLAN_ORDER,
  OFFERED_PLAN_TIERS,
} from "../stripe/stripeProducts";
import { PLAN_TIERS } from "../../drizzle/schema";
import { appBaseUrl, PRODUCTION_APP_HOSTNAME } from "../_core/appOrigin";
import { logAuditEvent, AUDIT_ACTIONS } from "../auditLog";
import { SlackAlerts } from "../slack/slackNotification";
import { z } from "zod";
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
        planName: PLAN_TIERS.free.name,
        planPriceInCents: PLAN_TIERS.free.price,
        balance: 0,
        subscriptionStatus: null,
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
      planName: PLAN_TIERS[subscription.planTier]?.name ?? subscription.planTier,
      planPriceInCents: PLAN_TIERS[subscription.planTier]?.price ?? 0,
      balance: subscription.balance,
      creditsPurchased: subscription.creditsPurchased,
      creditsUsed: subscription.creditsUsed,
      rolloverCredits: subscription.rolloverCredits,
      subscriptionStatus: subscription.subscriptionStatus,
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

  // Preview proration for plan change
  previewPlanChange: protectedProcedure
    .input(z.object({
      newPlan: z.enum(PURCHASABLE_PLANS),
    }).strict())
    .query(async ({ ctx, input }) => {
      const subscription = await getSubscriptionByUserId(ctx.user.id);

      if (!subscription?.stripeSubscriptionId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active subscription found. Please subscribe first.",
        });
      }

      const proration = await calculateProration(
        subscription.stripeSubscriptionId,
        input.newPlan
      );

      if (!proration) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to calculate proration.",
        });
      }

      // Calculate credit adjustment
      const currentPlan = subscription.planTier || "free";
      const creditAdjustment = calculateCreditAdjustment(
        currentPlan,
        input.newPlan,
        proration.daysRemaining,
        proration.totalDays
      );

      return {
        currentPlan,
        newPlan: input.newPlan,
        isUpgrade: proration.isUpgrade,
        proratedAmount: proration.proratedAmount,
        immediateCharge: proration.immediateCharge,
        creditBalance: proration.creditBalance,
        currentPlanPrice: proration.currentPlanPrice,
        newPlanPrice: proration.newPlanPrice,
        daysRemaining: proration.daysRemaining,
        totalDays: proration.totalDays,
        creditAdjustment,
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
    };
  }),

  // Change subscription plan with proration
  changePlan: protectedProcedure
    .input(z.object({
      newPlan: z.enum(PURCHASABLE_PLANS),
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

      // Calculate proration first to get credit adjustment
      const proration = await calculateProration(
        subscription.stripeSubscriptionId,
        input.newPlan
      );

      if (!proration) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to calculate proration.",
        });
      }

      // Update the subscription in Stripe
      const result = await updateSubscriptionPlan(
        subscription.stripeSubscriptionId,
        input.newPlan,
        ctx.user.id
      );

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Failed to change plan.",
        });
      }

      // Calculate and apply credit adjustment for upgrades
      const currentPlan = subscription.planTier || "free";
      const creditAdjustment = calculateCreditAdjustment(
        currentPlan,
        input.newPlan,
        proration.daysRemaining,
        proration.totalDays
      );

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
      }

      // Update local subscription record
      await updateUserSubscription(ctx.user.id, {
        planTier: input.newPlan,
      });

      // Audit log: subscription plan changed
      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.SUBSCRIPTION_UPDATED,
        resourceType: "subscription",
        resourceId: subscription.stripeSubscriptionId,
        metadata: {
          previousPlan: currentPlan,
          newPlan: input.newPlan,
          isUpgrade: proration.isUpgrade,
          creditAdjustment,
          proratedAmount: result.proratedAmount,
        },
        req: ctx.req,
      });

      return {
        success: true,
        message: proration.isUpgrade
          ? `Upgraded to ${input.newPlan}! ${creditAdjustment} bonus credits added.`
          : `Downgraded to ${input.newPlan}. Changes take effect at next billing cycle.`,
        proratedAmount: result.proratedAmount,
        creditAdjustment,
      };
    }),
});
