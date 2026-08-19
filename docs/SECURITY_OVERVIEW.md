# Drape Security Documentation

This folder contains security guides for developers working on Drape. These documents explain the security patterns, best practices, and implementation details that protect user data and prevent abuse.

## Security Guides

| Guide | Description | When to Read |
|-------|-------------|--------------|
| [ATOMIC_CREDITS.md](./ATOMIC_CREDITS.md) | Atomic credit deduction pattern for AI generation | Before implementing any credit-consuming feature |
| [AUTHENTICATION.md](./AUTHENTICATION.md) | Authentication flow and protected procedures | Before creating new API endpoints |
| [RATE_LIMITING.md](./RATE_LIMITING.md) | Rate limiting implementation and configuration | Before exposing public endpoints |
| [AUDIT_LOGGING.md](./AUDIT_LOGGING.md) | Audit logging for sensitive operations | Before implementing billing or deletion features |
| [NOTIFICATIONS.md](./NOTIFICATIONS.md) | Slack alerts and emergency actions | Before setting up security monitoring |
| [BILLING_ALERTS.md](./BILLING_ALERTS.md) | Billing-specific Slack alerts and velocity limits | Before modifying payment or credit flows |
| [specs/SECURITY_AUDIT_2026-07-25.md](./specs/SECURITY_AUDIT_2026-07-25.md) | Current security audit — open findings and what is not yet enforced | **Read first.** Before trusting any claim in the guides above |

> **ADMIN_SECURITY.md was deleted on 2026-07-25.** Its central claim — that the admin allowlist stops an attacker who has changed a role in the database — is false, and it described a Slack approval flow that is not in the request path. See H3 and H4 in the current audit.

## Security Principles

Drape follows these core security principles throughout the codebase.

**Defense in Depth** means that multiple independent layers protect sensitive operations. For example, paid generation combines authentication, server-derived ownership, operation locks and receipts, atomic credits, provider boundaries, and tested refund handling rather than relying on one guard.

**Fail Secure** ensures that when errors occur, the system defaults to the more restrictive behavior. The atomic credit pattern exemplifies this by deducting credits before expensive operations and refunding on failure, rather than risking free generations.

**Least Privilege** restricts access to the minimum necessary. Admin operations require explicit role checks via `adminProcedure`. The 2026-07-25 audit found four board procedures that checked the parent's owner and then acted on client-supplied child ids without re-anchoring them (C1). Local `main` fixes those four procedures and the remaining known Canvas write paths with durable owner-and-parent-scoped statements; Wardrobe session access now follows the same law. Keep that pattern: scope the owner in the statement that actually reads or writes, not only in a preceding guard.

**Positive Response Projections** mean browser-facing routes explicitly name the fields they return. Never spread a database row into a response and try to remember every private column to remove. Local `main` applies this rule to `auth.me` and the account-owned Cast list/detail boundaries, so future schema columns remain server-only unless deliberately reviewed into the public projection.

**Audit Everything** maintains a record of security-relevant events. The audit logging system captures billing changes, model deletions, and detected abuse patterns for investigation and compliance.

**Monitor Proactively** means security-relevant events should trigger real-time alerts where the request path is actually wired to do so. Slack helpers or documented channels are not enforcement by themselves; the current audit identifies the approval, IP-blocking, and purchase-velocity controls that still need a real request-path connection or removal.

## Quick Reference: Endpoint Security Checklist

Before deploying any new endpoint, verify the following:

| Check | How to Verify |
|-------|---------------|
| Authentication | Endpoint uses `protectedProcedure` or `adminProcedure` |
| Authorization | The owner predicate is in the statement that reads or writes — not only in a preceding guard |
| Child records | Any client-supplied child id (item, edge, version) is constrained to the owned parent in that same statement |
| Identity source | `userId` comes from `ctx.user.id`, never from procedure input |
| Response projection | Browser-facing responses explicitly list approved fields; never spread a database row or ORM record |
| Rate Limiting | Public endpoints have rate limits, and a real `TOO_MANY_REQUESTS` is returned rather than a 200 with an error field |
| Credit Deduction | Generation endpoints use `withAtomicCredits` |
| Audit Logging | Sensitive operations call `logAuditEvent` |
| Input Validation | All inputs validated with Zod schemas, using `.strict()` so unknown fields are rejected |
| Billing Alerts | Payment events trigger appropriate Slack alerts |
| **Controls actually run** | If you added a protection, something invokes it on the request path, a test proves it *blocks*, and it refuses rather than allows when a dependency is missing |

## Slack Alert Channels

| Channel | Purpose | Webhook Env Var |
|---------|---------|----------------|
| `#admin-actions` | Admin actions, IP blocks, emergency alerts | `SLACK_ADMIN_ACTIONS_WEBHOOK_URL` |
| `#audit-log` | Audit log entries, security events | `SLACK_AUDIT_LOG_WEBHOOK_URL` |
| `#billing-alerts` | Chargebacks, payment failures, cancellations, large purchases | `SLACK_BILLING_ALERTS_WEBHOOK_URL` |
| `#general` | General notifications, test alerts | `SLACK_WEBHOOK_URL` |

## Credit Purchase Velocity Limits — DELETED 2026-08-19

**There is no application-side fraud cap on credit purchases, and there is no longer any code pretending otherwise.**

This section used to describe three caps — 3 top-ups an hour, 10 a day, ~$500 of spend a day — as active. They were active, for one day: added 2026-02-06 inside the `createTopupCheckout` procedure, and orphaned 2026-02-07 when the whole one-time topup system was removed for an unrelated product reason. The two query helpers and the `velocityLimitHit` alert outlived their only call site by six months, along with this page and a test suite that could not go red.

On 2026-08-19 the founder's decision was to **delete rather than re-wire**, and the helpers, the alert template and `server/velocityLimits.test.ts` are gone. The reasoning is on the record and is a product one: deciding how fast is too fast for a paying customer, and what happens to them when they hit it, is a design question and not a switch — and code that pretends to be the answer is worse than no code.

If a cap is wanted, it starts from that design. What it should not start from is a resurrection of two SQL helpers because they happened to survive. Closes H5 of `docs/specs/SECURITY_AUDIT_2026-07-25.md`.

## Reporting Security Issues

If you discover a security vulnerability, please report it privately to the development team rather than creating a public issue. Security issues should be addressed with urgency and disclosed responsibly after fixes are deployed.

## Document Maintenance

These security guides should be updated whenever:

1. New security patterns are introduced
2. Existing patterns are modified
3. New categories of sensitive operations are added
4. Security incidents reveal gaps in documentation

A guide describing a control is not evidence the control runs. Four protections in this codebase — the admin allowlist, the Slack approval flow, IP blocking, and credit-purchase velocity limits — were documented and marked complete while never being invoked on a request path. When updating these guides, verify the call site, not just the helper.

Last updated: July 25, 2026
