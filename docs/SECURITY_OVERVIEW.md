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

## Security Principles

FormaStudio follows these core security principles throughout the codebase.

**Defense in Depth** means that multiple layers of security protect sensitive operations. For example, a billing endpoint uses authentication (protectedProcedure), rate limiting, audit logging, and abuse detection together rather than relying on any single mechanism.

**Fail Secure** ensures that when errors occur, the system defaults to the more restrictive behavior. The atomic credit pattern exemplifies this by deducting credits before expensive operations and refunding on failure, rather than risking free generations.

**Least Privilege** restricts access to the minimum necessary. User data is scoped by userId in all queries, and admin operations require explicit role checks via adminProcedure.

**Audit Everything** maintains a record of security-relevant events. The audit logging system captures billing changes, model deletions, and detected abuse patterns for investigation and compliance.

## Quick Reference: Endpoint Security Checklist

Before deploying any new endpoint, verify the following:

| Check | How to Verify |
|-------|---------------|
| Authentication | Endpoint uses `protectedProcedure` or `adminProcedure` |
| Authorization | User data queries include `userId` filter |
| Rate Limiting | Public endpoints have rate limits configured |
| Credit Deduction | Generation endpoints use `withAtomicCredits` |
| Audit Logging | Sensitive operations call `logAuditEvent` |
| Input Validation | All inputs validated with Zod schemas |

## Reporting Security Issues

If you discover a security vulnerability, please report it privately to the development team rather than creating a public issue. Security issues should be addressed with urgency and disclosed responsibly after fixes are deployed.

## Document Maintenance

These security guides should be updated whenever:

1. New security patterns are introduced
2. Existing patterns are modified
3. New categories of sensitive operations are added
4. Security incidents reveal gaps in documentation

Last updated: February 2026
