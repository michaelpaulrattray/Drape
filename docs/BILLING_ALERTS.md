# Billing Alerts

This document covers the billing-specific Slack alert system.

**There are no credit-purchase velocity limits, and this page described them as live for six months after they stopped existing.** The history is worth a paragraph, because it is not the usual one.

The caps were real and wired: `a3abdf8b` (2026-02-06) added `VELOCITY_LIMITS` inside the `createTopupCheckout` procedure, three checks against the two query helpers, and a `velocityLimitHit` alert on each. **They lived for one day.** `41a765ea` (2026-02-07) removed the entire one-time credit-topup system for an unrelated product reason — the procedure went, and with it the only call site. The helpers and the alert template stayed. So did this page.

**That is the class, and it is not "somebody forgot to wire it".** A control dies when its call site is deleted for a reason that has nothing to do with the control, and nothing sweeps behind it. `server/velocityLimits.test.ts` survived the same commit and stayed green for six months — its own docblock said the topup packages had been removed and that the tests "remain relevant for any future credit purchase flow", while every assertion in it compared a local constant to itself. A suite that cannot go red when its subject is deleted is how the corpse stays warm.

The helpers, the alert and that suite were deleted on 2026-08-19 by founder default. If a purchase cap is wanted it starts as a product decision — what counts as too fast for a paying customer, and what happens when they hit it — not as a re-wiring of two queries. See `docs/specs/SECURITY_AUDIT_2026-07-25.md` H5 for the audit finding this closes.

## Overview

All billing alerts are routed to the `#billing-alerts` Slack channel via `SLACK_BILLING_ALERTS_WEBHOOK_URL`. This channel is separate from admin actions and audit logs to ensure billing events get dedicated attention.

## Alert Types

### Chargeback Filed

**Trigger:** `charge.dispute.created` webhook event  
**Channel:** `#billing-alerts`  
**Auto-actions:** Suspend user, revoke all credits, send alert  
**Template:** `SlackAlerts.chargebackFiled()`

When a chargeback is filed, the system automatically suspends the user account, revokes their entire credit balance, and sends a detailed Slack alert with dispute ID, amount, reason, and user info.

### Chargeback Resolved

**Trigger:** `charge.dispute.closed` webhook event  
**Channel:** `#billing-alerts`  
**Auto-actions:** On win: unsuspend + restore credits. On loss: keep suspended + cancel subscription.  
**Template:** `SlackAlerts.chargebackResolved()`

### Payment Failed (Final) + Auto-Cancel

**Trigger:** `invoice.payment_failed` webhook event where `next_payment_attempt` is null (Stripe exhausted all retries)  
**Channel:** `#billing-alerts`  
**Auto-actions:** Cancel subscription via Stripe API, downgrade user to free tier, mark subscription as `canceled`  
**Template:** `SlackAlerts.paymentFailed()`

Stripe retries failed payments ~3 times over 2 weeks. Only the **final failure** (when Stripe gives up) triggers this alert. Intermediate retries silently mark the subscription as `past_due` (which blocks generation) without alerting. On final failure, the subscription is automatically cancelled and the user is downgraded to the free plan.

### Stripe Refund Issued

**Trigger:** Admin approves a `stripe_refund` change request  
**Channel:** `#billing-alerts`  
**Auto-actions:** Issue Stripe refund, deduct credits (floored at 0), audit log  
**Template:** `SlackAlerts.stripeRefundIssued()`

Fires when an admin approves a moderator-initiated Stripe refund. Includes refund type (full/proportional), amount, credits deducted, and user info.

### Alerts NOT Sent (Noise Reduction)

The following events are handled silently — no Slack alerts:

- **Subscription cancelled** — users cancel for many reasons; not actionable
- **Large credit purchase** — informational only; there is no automated fraud cap behind it
- **Intermediate payment failures** — Stripe retries automatically; only final failure alerts

## Adding New Billing Alerts

1. Add a new async method to `SlackAlerts` in `server/slack/slackNotification.ts`
2. Use `dispatchBillingAlert()` from `server/slack/slackDispatcher.ts` to route to `#billing-alerts`
3. Call the alert from the appropriate webhook handler or procedure
4. Add tests that drive the alert, not tests that assert it is a function — an existence assertion is something the typechecker already makes, and the deleted velocity suite is what that looks like after a year
5. Update this document

## Stripe Refund Workflow

Moderators can request Stripe refunds through the existing change request system:

1. **Moderator** finds the user's topup transaction in the mod dashboard
2. **Moderator** clicks "Refund" button → selects refund type (full or proportional)
3. **System** calculates refund amount and creates a change request
4. **Admin** approves or denies via Slack interactive message
5. **On approval:** System issues Stripe refund, deducts credits (floored at 0), logs audit entry, sends Slack alert

### Refund Types

| Type | Calculation | Use Case |
|------|-------------|----------|
| **Proportional** | `(unused_credits / original_credits) × original_price` | User consumed some credits, refund the rest |
| **Full** | Full original amount, deduct all purchased credits | Goodwill refund, user barely used the product |

Credits are deducted down to a floor of 0 — balances never go negative.

### Files

| File | Purpose |
|------|---------|
| `server/stripe/stripeService.ts` | `issueStripeRefund()`, `calculateProportionalRefund()`, `getPaymentIntentFromSession()` |
| `server/stripe/stripeRefund.test.ts` | tests for proportional refund calculation |
| `drizzle/schema.ts` | `stripeSessionId`, `refundType`, `refundAmountCents`, `creditsToDeduct`, `originalCredits` on `changeRequests` |

## Files

| File | Purpose |
|------|---------|
| `server/slack/slackNotification.ts` | Alert templates (`SlackAlerts.*`) |
| `server/slack/slackDispatcher.ts` | Channel routing (`dispatchBillingAlert`) |
| `server/stripe/webhooks.ts` | Webhook handlers that trigger alerts |

Every path above was checked against the tree on 2026-08-19. Six of the seven this table used to carry were wrong — `server/db.ts`, `server/webhooks.ts` and four others had moved into subdirectories, and one named a procedure that does not exist. A file table nobody re-reads is a map of a building that has been rebuilt around it.

Three templates in `SlackAlerts` had no caller anywhere in the server and were **deleted on 2026-08-19**, after their history was read — because the same "no caller" reading covered two different things and they argue for different answers:

- `subscriptionCancelled` and `largeCreditPurchase` were wired at birth (`a3abdf8b`) and **deliberately un-wired** by `69eb9b0f` — *"Reduced billing alert noise… removed subscription cancellation Slack alerts… removed large purchase alert trigger."* That decision stands and is still recorded in "Alerts NOT Sent (Noise Reduction)" above; only the leftover templates went.
- `consumptionSpike` had **never** had a caller since `a3abdf8b`. This page said so in its own words — *"available for integration with consumption monitoring logic"* — which was honest, and six months later still unbuilt.

Neither needed a founder decision, and that is exactly why the history was read first: had the question gone up as one, it would have asked for one word about a switch somebody turned off on purpose and a thing nobody finished.

Last updated: 2026-08-19 (v3 — velocity limits deleted, three uncalled templates deleted after their history was read, file paths corrected against the tree)
