# Billing Alerts

Billing alerts are **audit rows** since #800 (the Slack retirement,
2026-09-11): each lands on the admin overview's alerts feed and the staff
audit log's billing filter. The pattern is #771's, founder-ratified — a log
line is a surface nobody is subscribed to, and production never had a Slack
webhook, so the row IS the alert.

## The billing alert rows

| Event | Audit action | Severity | Written from |
|-------|--------------|----------|--------------|
| Chargeback / dispute filed | `billing.chargeback_filed` | critical | `server/stripe/webhooks.ts` (`handleDisputeCreated`) |
| Chargeback resolved (won or lost) | `billing.chargeback_resolved` | warning | `server/stripe/webhooks.ts` (`handleDisputeClosed`) |
| Final payment failure (subscription auto-cancelled) | `billing.payment_final_failure` | warning | `server/stripe/webhooks.ts` |
| Stripe refund reported failed after issue | `billing.stripe_refund_failed` | critical | `server/stripe/webhooks.ts` (`handleRefundFailed`, #771) |
| Invoice paid after plan ended | `billing.invoice_paid_after_plan_ended` | critical | `server/stripe/stripeService.ts` (#771) |
| Stripe refund issued via change request | `billing.stripe_refund_issued` | critical | `server/lib/adminActions/changeRequestActions.ts` |

Chargeback handling still auto-suspends the identified user and revokes
credits, failing the webhook event so Stripe redelivers if a protective
action does not land (#792/#789 — both verdicts are read, not dropped).

## Events handled silently (noise reduction — deliberate)

Subscription cancellations, large credit purchases and successful routine
payments write their ordinary records but no alert row. The decision is
`69eb9b0f` ("Reduced billing alert noise") and it stands.

## History

The Slack alert system this file used to document (five channels,
`SlackAlerts.*` templates, `dispatchBillingAlert`) was deleted whole by #800.

Three templates in `SlackAlerts` had no caller anywhere in the server and were **deleted on 2026-08-19**, after their history was read — because the same "no caller" reading covered two different things and they argue for different answers:

- `subscriptionCancelled` and `largeCreditPurchase` were wired at birth (`a3abdf8b`) and **deliberately un-wired** by `69eb9b0f` — *"Reduced billing alert noise… removed subscription cancellation Slack alerts… removed large purchase alert trigger."* That decision stands and is still recorded in "Alerts NOT Sent (Noise Reduction)" above; only the leftover templates went.
- `consumptionSpike` had **never** had a caller since `a3abdf8b`. This page said so in its own words — *"available for integration with consumption monitoring logic"* — which was honest, and six months later still unbuilt.

Neither needed a founder decision, and that is exactly why the history was read first: had the question gone up as one, it would have asked for one word about a switch somebody turned off on purpose and a thing nobody finished.

Last updated: 2026-08-19 (v3 — velocity limits deleted, three uncalled templates deleted after their history was read, file paths corrected against the tree)
