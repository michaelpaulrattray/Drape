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
  getInvoiceStatus,
  getCustomerInvoices,
  getAllCustomerInvoices,
} from "../stripe/stripeService";
import {
  queuePlanChangeSettlement,
  applyPlanChangeSettlement,
} from "../stripe/planChangeSettlement";
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
      // at the live balance, read at APPLICATION time: spent credits are
      // spent, and the #664 "deliberately coarse mirror" ruling (the floor is
      // the total balance; no per-source lots) carries over unchanged.
      const currentPlan = billingState.currentPlan;
      const creditAdjustment = quote.creditAdjustment;
      const creditsToReturn =
        quote.kind === "interval-switch" ? quote.creditUnwind : Math.max(0, -creditAdjustment);

      const direction: "grant" | "unwind" | null =
        creditAdjustment > 0 ? "grant" : creditsToReturn > 0 ? "unwind" : null;
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
            const creditResult = await addCredits(
              ctx.user.id,
              settlementCredits,
              "bonus",
              description,
              input.clientRequestId ? `plan-change:${input.clientRequestId}` : undefined,
            );
            if (!creditResult.success) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "The plan changed, but the credit adjustment could not be recorded. Contact support before retrying.",
              });
            }
          } else {
            const liveCredits = await getUserCredits(ctx.user.id);
            const returnable = Math.min(settlementCredits, Math.max(0, liveCredits?.balance ?? 0));
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
          changeKind: quote.kind,
          isUpgrade: quote.isUpgrade,
          creditAdjustment,
          creditsReturned: creditsToReturn,
          creditSettlement,
          localRecord: localRecord.success ? "written" : "deferred-to-webhook",
          settlementInvoiceId: result.invoiceId ?? null,
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
            ? creditSettlement === "pending"
              ? `Upgraded to ${planName}! Your ${creditAdjustment} bonus credits land as soon as the payment settles.`
              : `Upgraded to ${planName}! ${creditAdjustment} bonus credits added.`
            : `Downgraded to ${planName}. Unused time on the old price comes back as billing credit, and its unused credits go with it.`;

      return {
        success: true,
        message,
        proratedAmount,
        creditAdjustment,
        creditSettlement,
        targetInterval: quote.targetInterval,
        changeKind: quote.kind,
      };
    }),
});
