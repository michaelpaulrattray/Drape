# FormaStudio Security Documentation

This folder contains security guides for developers working on FormaStudio. These documents explain the security patterns, best practices, and implementation details that protect user data and prevent abuse.

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

FormaStudio follows these core security principles throughout the codebase.

**Defense in Depth** means that multiple layers of security protect sensitive operations. For example, a billing endpoint uses authentication (protectedProcedure), rate limiting, velocity limits, audit logging, and abuse detection together rather than relying on any single mechanism.

**Fail Secure** ensures that when errors occur, the system defaults to the more restrictive behavior. The atomic credit pattern exemplifies this by deducting credits before expensive operations and refunding on failure, rather than risking free generations.

**Least Privilege** restricts access to the minimum necessary. Admin operations require explicit role checks via `adminProcedure`. The 2026-07-25 audit found four board procedures that checked the parent's owner and then acted on client-supplied child ids without re-anchoring them (C1). Local `main` now fixes those four procedures with durable owner-and-parent-scoped statements and exact-count refusal tests. Keep that pattern: scope the owner in the statement that actually writes, not only in a preceding guard.

**Audit Everything** maintains a record of security-relevant events. The audit logging system captures billing changes, model deletions, and detected abuse patterns for investigation and compliance.

**Monitor Proactively** ensures that security-relevant events trigger real-time alerts. The Slack alert system routes billing events (chargebacks, payment failures, velocity limit triggers) to dedicated channels for immediate visibility.

## Quick Reference: Endpoint Security Checklist

Before deploying any new endpoint, verify the following:

| Check | How to Verify |
|-------|---------------|
| Authentication | Endpoint uses `protectedProcedure` or `adminProcedure` |
| Authorization | The owner predicate is in the statement that reads or writes — not only in a preceding guard |
| Child records | Any client-supplied child id (item, edge, version) is constrained to the owned parent in that same statement |
| Identity source | `userId` comes from `ctx.user.id`, never from procedure input |
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
| `#billing-alerts` | Chargebacks, payment failures, cancellations, large purchases, velocity limits | `SLACK_BILLING_ALERTS_WEBHOOK_URL` |
| `#general` | General notifications, test alerts | `SLACK_WEBHOOK_URL` |

## Credit Purchase Velocity Limits

> **Not enforced as of 2026-07-25.** This section previously described the caps below as active. They are not. `getRecentTopupCount` and `getTopupCreditsTotal` (`server/db/moderatorQueries.ts:344-390`) compute the figures and `SlackAlerts.velocityLimitHit` is ready to fire, but nothing calls them — `server/routes/billing.ts` performs no velocity check. Treat credit top-ups as having **no application-side fraud cap** until H5 in the current audit is fixed.

The intended design, for whoever wires it up:

| Limit | Window | Purpose |
|-------|--------|--------|
| 3 top-ups | Per hour | Prevents rapid-fire purchases |
| 10 top-ups | Per 24 hours | Daily cap |
| ~$500 total spend | Per 24 hours | Dollar-amount cap (33,333 credits) |

The check belongs in the checkout path before the Stripe session is created; over the cap should refuse with `TOO_MANY_REQUESTS`. The refusal must not depend on Slack being connected — only the alert is optional.

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
