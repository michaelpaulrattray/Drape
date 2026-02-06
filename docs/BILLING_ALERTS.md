# Billing Alerts & Credit Purchase Velocity Limits

This document covers the billing-specific Slack alert system and credit purchase velocity limits that protect FormaStudio from payment fraud and abuse.

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

### Subscription Cancelled

**Trigger:** `customer.subscription.deleted` webhook event  
**Channel:** `#billing-alerts`  
**Template:** `SlackAlerts.subscriptionCancelled()`

Fires when a user's subscription is deleted (cancelled). Includes user info, previous plan, and cancellation reason if available.

### Payment Failed

**Trigger:** `invoice.payment_failed` webhook event  
**Channel:** `#billing-alerts`  
**Auto-actions:** Mark subscription as `past_due`  
**Template:** `SlackAlerts.paymentFailed()`

Fires when a subscription invoice payment fails. Includes amount, currency, and failure reason.

### Large Credit Purchase

**Trigger:** Successful top-up checkout with >= 500 credits  
**Channel:** `#billing-alerts`  
**Template:** `SlackAlerts.largeCreditPurchase()`

Fires after a large credit top-up is successfully processed. Threshold is 500 credits (large and xl packages).

### Velocity Limit Triggered

**Trigger:** User attempts a top-up that exceeds velocity limits  
**Channel:** `#billing-alerts`  
**Auto-actions:** Block the purchase, return error to user  
**Template:** `SlackAlerts.velocityLimitHit()`

Fires when a user hits any of the three velocity limits. Includes which limit was hit, current count, and the cap.

### Consumption Spike

**Trigger:** Called programmatically when unusual credit consumption is detected  
**Channel:** `#billing-alerts`  
**Template:** `SlackAlerts.consumptionSpike()`

Available for integration with consumption monitoring logic. Includes user info, credits used in the window, and the normal average.

## Credit Purchase Velocity Limits

Velocity limits are enforced in the `createTopupCheckout` procedure in `server/routers.ts`. They query the `credit_transactions` table for recent `topup` entries.

### Limits

| Limit | Value | Window | Purpose |
|-------|-------|--------|---------|
| Hourly max | 3 top-ups | Rolling 1 hour | Prevents rapid-fire purchases |
| Daily max | 10 top-ups | Rolling 24 hours | Daily transaction cap |
| Daily credit cap | 33,333 credits | Rolling 24 hours | ~$500 spend cap |

### Implementation

The velocity check runs before the Stripe checkout session is created, so no Stripe API calls are wasted on blocked purchases. The check uses two query helpers:

- `getRecentTopupCount(userId, sinceTimestamp)` — counts topup transactions in window
- `getRecentTopupCredits(userId, sinceTimestamp)` — sums credit amounts in window

### Error Messages

Users see friendly error messages when limits are hit:
- Hourly: "You've reached the maximum number of credit purchases per hour. Please try again later."
- Daily: "You've reached the maximum number of credit purchases per day. Please try again tomorrow."
- Spend cap: "You've reached the daily credit purchase limit. Please try again tomorrow."

### Tuning

The constants are defined in `VELOCITY_LIMITS` within the `createTopupCheckout` procedure. To adjust:

1. Change the constant values in `server/routers.ts`
2. Update the tests in `server/velocityLimits.test.ts`
3. Update this document

## Adding New Billing Alerts

1. Add a new async method to `SlackAlerts` in `server/slackNotification.ts`
2. Use `dispatchBillingAlert()` from `server/slackDispatcher.ts` to route to `#billing-alerts`
3. Call the alert from the appropriate webhook handler or procedure
4. Add tests in `server/velocityLimits.test.ts` or a new test file
5. Update this document

## Files

| File | Purpose |
|------|---------|
| `server/slackNotification.ts` | Alert templates (`SlackAlerts.*`) |
| `server/slackDispatcher.ts` | Channel routing (`dispatchBillingAlert`) |
| `server/webhooks.ts` | Webhook handlers that trigger alerts |
| `server/routers.ts` | Velocity limit enforcement in `createTopupCheckout` |
| `server/db.ts` | `getRecentTopupCount`, `getRecentTopupCredits` query helpers |
| `server/velocityLimits.test.ts` | Tests for velocity limits and alert templates |

Last updated: February 6, 2026
