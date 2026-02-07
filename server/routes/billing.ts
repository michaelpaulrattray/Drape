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
import { SUBSCRIPTION_PRODUCTS, SubscriptionPlan, PAID_PLAN_ORDER, PLAN_ORDER } from "../stripe/stripeProducts";
import { PLAN_TIERS } from "../../drizzle/schema";
import { logAuditEvent, AUDIT_ACTIONS } from "../auditLog";
import { SlackAlerts } from "../slack/slackNotification";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const billingRouter = router({
  // Get available pricing plans
  getPlans: publicProcedure.query(() => {
    return {
      subscriptions: Object.entries(SUBSCRIPTION_PRODUCTS).map(([key, plan]) => ({
        id: key as SubscriptionPlan,
        name: plan.name,
        description: plan.description,
        priceInCents: plan.priceInCents,
        credits: plan.credits,
        features: plan.features,
        interval: plan.interval,
      })),
      tiers: PLAN_TIERS,
      planOrder: PLAN_ORDER,
    };
  }),

  // Get current user's subscription status
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const subscription = await getSubscriptionByUserId(ctx.user.id);
    if (!subscription) {
      return {
        planTier: "free" as const,
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
      plan: z.enum(["starter", "pro", "studio", "studio_plus", "business", "business_plus", "scale", "scale_plus", "enterprise", "enterprise_plus", "ultimate"]),
      interval: z.enum(["monthly", "annual"]).optional().default("monthly"),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get user info
      const user = await getUserById(ctx.user.id);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      // Get or create Stripe customer
      const subscription = await getSubscriptionByUserId(ctx.user.id);
      const customerId = await getOrCreateStripeCustomer(
        ctx.user.id,
        user.email || `user-${ctx.user.id}@formastudio.app`,
        user.displayName || user.name || undefined,
        subscription?.stripeCustomerId
      );

      // Save customer ID if new
      if (!subscription?.stripeCustomerId) {
        await updateUserSubscription(ctx.user.id, { stripeCustomerId: customerId });
      }

      // Create checkout session
      const baseUrl = process.env.NODE_ENV === "production" 
        ? "https://formastudio.app" 
        : "http://localhost:3000";
      
      const checkoutUrl = await createSubscriptionCheckoutSession(
        customerId,
        input.plan,
        `${baseUrl}/dashboard?billing=success`,
        `${baseUrl}/dashboard?billing=canceled`,
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

    const baseUrl = process.env.NODE_ENV === "production" 
      ? "https://formastudio.app" 
      : "http://localhost:3000";

    const portalUrl = await createCustomerPortalSession(
      subscription.stripeCustomerId,
      `${baseUrl}/dashboard`
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
      newPlan: z.enum(["starter", "pro", "studio", "studio_plus", "business", "business_plus", "scale", "scale_plus", "enterprise", "enterprise_plus", "ultimate"]),
    }))
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
    }).optional())
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
    }).optional())
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
      newPlan: z.enum(["starter", "pro", "studio", "studio_plus", "business", "business_plus", "scale", "scale_plus", "enterprise", "enterprise_plus", "ultimate"]),
    }))
    .mutation(async ({ ctx, input }) => {
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
        await addCredits(
          ctx.user.id,
          creditAdjustment,
          "bonus",
          `Prorated credits for upgrade to ${input.newPlan}`
        );
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
