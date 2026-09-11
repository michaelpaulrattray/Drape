# Security Notifications Guide

**The Slack integration this document used to describe is RETIRED (#800,
2026-09-11)** — the founder's word, verbatim: *"retire slack everything runs
through moderator and admin at the moment."* It was never configured in
production (zero `SLACK_*` variables, ever), so nothing an operator relied on
has changed; what changed is that the code no longer promises a channel that
does not exist.

## Where notifications actually land

| Surface | What shows there |
|---------|------------------|
| **Admin overview alerts feed** (`/admin`, `getRecentAlerts`) | Every `critical` and `warning` audit row: abuse patterns, login attacks, chargebacks, failed payments, failed change-request executions, system health alerts, server crashes |
| **Staff audit-log pages** | Every audit row, filterable by category |
| **Admin change-request queue** (`/admin/change-requests`) | Moderator escalations awaiting review |
| **Admin bug-report inbox** (#255) | Customer bug reports and feedback |

The writers: `logAuditEvent` (everything), `logAdminAction` / `writeImmutableLog`
(`server/security/adminSecurity.ts`), `recordLoginAttack`
(`server/security/loginAttackAlert.ts`), `recordHealthAlert`
(`server/monitoring/healthMonitor.ts`), and the Stripe webhook handlers
(`billing.chargeback_filed`, `billing.chargeback_resolved`,
`billing.payment_final_failure`, `billing.stripe_refund_failed`).

## What was retired, for the record

Slack webhooks for five channels, message templates (`SlackAlerts.*`), a
dedup cache, interactive emergency buttons (Block IP / Suspend User) backed by
single-use tokens in `emergency_tokens` (table kept, empty — dropping it is a
founder ceremony), the `/api/slack/interactions` endpoint with signature
verification, and the in-memory approval store for sensitive admin actions
(which auto-approved when unconfigured, i.e. always). Two limits that were
real before and are still real: the immutable log chain is in-memory and
resets on deploy (no tamper evidence — CLAUDE.md's "currently not enforced"
list), and a database-down health alert cannot land in a database-backed
panel (it stays a fatal log line, stated in `healthMonitor.ts`).
