# Credit Ledger Writer Inventory

**Status:** R7-1B migration gate inventory
**Authority:** `CASTING_SYSTEM_R7_1_TRUST_FOUNDATION_EXECUTION_PLAN.md` §R7-1B

The database unique key `(userId, referenceId)` is the final arbiter for every non-null reference. `NULL` remains legal only where an operation is inherently one-time or a deliberate manual action has no external replay identity. This inventory names every production writer to `point_transactions` after R7-1B.

| Writer | Movement | Reference authority after R7-1B | Replay result |
|---|---|---|---|
| `initializeUserCredits` | Signup grant | `NULL`; the unique `points.userId` row and the shared creation transaction make the whole initialization one-time | A second initialization fails/rolls back; it cannot create a second signup ledger row independently |
| `deductCredits` | Generic charge/debit | Caller-supplied deterministic id where retryable; otherwise a caller-owned unique id | Exact duplicate refuses with `duplicate: true`; mismatch is a critical collision |
| `addCredits` | Generic refund/bonus/top-up | Caller-supplied deterministic id where retryable | Exact duplicate succeeds without changing balance and returns current balance; mismatch is a critical collision |
| `withAtomicCredits` / `recordRefund` | Generation charge and derived refund | Caller charge id or collision-resistant fallback; refund deterministically derives from the charge | Charge replay refuses; exact refund replay succeeds once |
| `refreshMonthlyCredits` from `invoice.payment_succeeded` | Subscription-period reset/grant | `stripe-invoice:<invoice.id>` | Webhook replay rolls back the losing reset and returns the current balance |
| `addTopupCredits` | Stripe top-up | Existing Stripe checkout/session reference supplied by the webhook path | Exact webhook replay succeeds once |
| Referral referee/referrer grants | Referral bonuses | `referral-referred:<referral.id>` / `referral-referrer:<referral.id>` | Exact workflow replay succeeds once |
| Dispute revoke/restore | Chargeback debit/refund | `dispute_<id>` / `dispute_restore_<id>` | Replayed revoke refuses; replayed restoration succeeds once |
| Change-request refund/add | Approved admin movement | `cr-<changeRequestId>` | Exact Slack/action replay succeeds once; a mismatched reuse is a collision |
| Change-request Stripe-refund deduction | Admin debit after external refund | `cr-stripe-refund:<changeRequestId>` | Exact action replay succeeds once without a second debit |
| Direct admin adjustment | Deliberate manual adjustment | Optional reference supported; current direct admin UI supplies `NULL`, so each approved click is a distinct accounting action | No idempotent replay claim until the admin UI gains a request receipt |
| Plan-change prorated bonus | Subscription upgrade bonus | New clients supply `plan-change:<clientRequestId>`; input is temporarily optional only for mixed-version deploy compatibility | New-client transport replay grants once; the old-bundle compatibility window has no idempotency claim and must end when the field becomes required |

## Reference length

The physical column is `varchar(64)`. `normalizeCreditReferenceId` preserves readable references up to 64 characters and deterministically converts longer charge/refund child references to a 64-character SHA-256 form. This prevents future large numeric ids or nested refund prefixes from failing or being truncated. R7-1D replaces Casting charge references with the shorter operation-owned `op:<uuid>:charge` contract.

## Known follow-up

The optional plan-change request id and direct-admin `NULL` reference are explicit mixed-version/manual boundaries, not claims of full billing-operation idempotency. They require a separate billing/admin receipt contract before public launch; the Casting `generation_operations` table in R7-1C must not be stretched into an unrelated billing ledger.
