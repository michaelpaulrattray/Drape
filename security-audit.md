# FormaStudio Security Audit Report

## Assessment Summary

Based on a thorough review of the codebase against the SaaS Security Checklist provided.

---

## AUTHENTICATION & AUTHORIZATION

| Item | Status | Notes |
|------|--------|-------|
| OAuth/SSO authentication | **PASS** | Manus OAuth via `/api/oauth/callback`. No password-based auth to worry about. |
| HttpOnly, Secure, SameSite cookies | **PASS** | `cookies.ts` sets `httpOnly: true`, `sameSite: "none"`, `secure: isSecureRequest(req)` |
| Role-based access control (RBAC) | **PASS** | `admin`, `moderator`, `user` roles enforced via `adminProcedure`, `moderatorProcedure`, `protectedProcedure` |
| Admin allowlist (hardcoded) | **PASS** | Already marked in checklist |
| Session expiration/timeout | **CONCERN** | Session cookie `maxAge` is set to `ONE_YEAR_MS` (~365 days). No inactivity timeout. This is very long. |
| Re-auth for sensitive actions | **PASS** | Slack out-of-band approval for sensitive admin actions |

**Verdict:** Session expiration is the only gap. Since auth is OAuth-based (no passwords), there's no password reset flow to worry about. Email verification and "log out all devices" are N/A for OAuth-only.

---

## DATABASE & DATA PROTECTION

| Item | Status | Notes |
|------|--------|-------|
| Parameterized queries (ORM) | **PASS** | Drizzle ORM used throughout. `sql` template literals are parameterized. |
| Credentials in env vars only | **PASS** | All secrets via `process.env`, managed by platform |
| Database connection over SSL | **N/A** | Managed by Manus platform. `DATABASE_URL` is injected; SSL configuration is at the infrastructure level, not application level. |
| Sensitive data encrypted at rest | **N/A** | No raw card data stored (Stripe handles it). PII is limited to name/email from OAuth. No additional encryption layer needed beyond DB-level encryption. |
| Regular automated backups | **N/A** | Managed by Manus platform infrastructure |
| Immutable audit logs | **PASS** | `writeImmutableLog()` in `adminSecurity.ts` with Slack audit trail |

**Verdict:** Clean. The platform handles DB SSL and backups.

---

## MONITORING & ALERTS

| Item | Status | Notes |
|------|--------|-------|
| Admin activity Slack alerts | **PASS** | Centralized dispatcher with dedup, `#admin-actions` and `#audit-log` channels |
| Failed login attempt monitoring | **PASS** | `recordGlobalFailedLogin()` in `rateLimit.ts`, `shouldSendGlobalAttackAlert()` triggers Slack alerts for brute force detection |
| Error tracking (Sentry, etc.) | **MISSING** | No error tracking service integrated. Server errors are only logged to console. |
| Uptime monitoring | **MISSING** | No uptime monitoring configured |
| Rate limiting on API/auth routes | **PASS** | `rateLimit.ts` with sliding window algorithm. Applied to: newsletter (5/hr), waitlist (5/hr), generation (10/min), model creation (5/min), billing (3/min), general API (60/min per user) |

**Verdict:** Rate limiting is solid. Error tracking and uptime monitoring are missing but are infrastructure-level concerns.

---

## INFRASTRUCTURE & HOSTING

| Item | Status | Notes |
|------|--------|-------|
| HTTPS everywhere | **PASS** | Manus platform enforces HTTPS. Cookies set `secure: true` when HTTPS detected. |
| HSTS header | **MISSING** | No `Strict-Transport-Security` header set in Express middleware |
| CORS properly configured | **PARTIAL** | No explicit CORS middleware configured. The platform proxy may handle this, but there's no application-level CORS restriction. |
| CSP (Content Security Policy) | **MISSING** | No Content-Security-Policy header. This is a real gap — allows potential XSS vectors. |
| Environment separation | **N/A** | Managed by Manus platform (dev server vs published) |
| Secrets management | **PASS** | All secrets via platform env injection, never in git |

**Verdict:** HSTS and CSP headers should be added. CORS depends on platform proxy behavior.

---

## INPUT & OUTPUT SECURITY

| Item | Status | Notes |
|------|--------|-------|
| Input validation (server-side) | **PASS** | 277+ Zod validations across `routers.ts`. All tRPC inputs are validated. |
| Output encoding/escaping | **PASS** | React auto-escapes all JSX output. Only `dangerouslySetInnerHTML` usage is in `chart.tsx` for static CSS themes (no user input). |
| File upload restrictions | **PASS** | Avatar: 5MB limit. Banner: 10MB limit. Voice: 16MB limit. All validated server-side via Zod. |
| No sensitive data in URLs | **PASS** | All mutations use POST body via tRPC. Only OAuth callback uses query params (standard OAuth flow). |
| API response filtering | **PASS** | Procedures explicitly map return fields. No raw DB rows leaked with internal fields. |

**Verdict:** Clean across the board.

---

## USER ACCOUNT SECURITY

| Item | Status | Notes |
|------|--------|-------|
| Email verification on signup | **N/A** | OAuth-only auth — email is verified by the OAuth provider (Manus) |
| Password reset flow | **N/A** | No passwords — OAuth-only |
| Account deletion option | **MISSING** | No account deletion or data export functionality. Potential GDPR concern if serving EU users. |
| User sessions visible/revocable | **MISSING** | No session listing or "log out all devices" feature. Single JWT cookie with 1-year expiry. |

**Verdict:** Account deletion is the main gap. Session management is minimal but acceptable for OAuth-only.

---

## CODE & DEPLOYMENT

| Item | Status | Notes |
|------|--------|-------|
| Dependencies audited | **CONCERN** | `pnpm audit` reports **23 vulnerabilities** (1 low, 13 moderate, 9 high). Key issues: `@trpc/server` prototype pollution (fixed in 11.8.0, current: 11.6.0), `qs` DoS vulnerability, `@smithy/config-resolver` issues in AWS SDK. |
| No secrets in git history | **PASS** | All secrets via platform env injection |
| Code review required | **N/A** | Single-developer project, no PR process |
| Automated security scanning | **MISSING** | No Snyk, CodeQL, or similar configured |

**Verdict:** Dependency updates needed, especially `@trpc/server` upgrade to 11.8.0+.

---

## PURCHASING & PAYMENTS

| Item | Status | Notes |
|------|--------|-------|
| PCI-compliant provider | **PASS** | Stripe Checkout — no raw card data ever touches our server |
| Webhook signature verification | **PASS** | `stripe.webhooks.constructEvent()` with `STRIPE_WEBHOOK_SECRET` in `stripeService.ts` |
| Idempotency on payment processing | **CONCERN** | `addTopupCredits()` does NOT check for duplicate `session.id` (referenceId). If Stripe replays the `checkout.session.completed` webhook, credits could be double-added. |
| Failed payment handling | **PASS** | `invoice.payment_failed` handler sets subscription to `past_due` status |
| Refund process secured | **PASS** | Admin-only credit adjustments logged in immutable audit log, routed through Slack approval for sensitive types |

**Verdict:** **Idempotency is the critical gap.** Webhook replays could cause double credit grants.

---

## CREDIT SYSTEM INTEGRITY

| Item | Status | Notes |
|------|--------|-------|
| Server-side credit validation | **PASS** | All credit checks in tRPC procedures, never client-side |
| Atomic credit transactions | **PASS** | `atomicCredits.ts` uses `WHERE balance >= amount` for atomic deduction with auto-refund on failure |
| Credit balance can't go negative | **PASS** | SQL `WHERE balance >= amount` prevents negative balance at DB level |
| Credit changes logged | **PASS** | `creditTransactions` table tracks who, when, why, amount, referenceId |
| Admin credit adjustments logged | **PASS** | Immutable audit log + Slack alerts |
| Rate limit credit-consuming actions | **PASS** | `withAtomicCreditsAndRateLimit()` combines rate limiting with atomic credit deduction. Generation: 10/min. |

**Verdict:** Excellent. The atomic credit system is well-designed.

---

## PLAN & SUBSCRIPTION LOGIC

| Item | Status | Notes |
|------|--------|-------|
| Plan limits enforced server-side | **PASS** | Credit balance is the enforcement mechanism — operations fail when balance is 0 |
| Downgrade handling | **PASS** | `handleSubscriptionDeleted` downgrades to free tier, clears subscription data |
| Upgrade proration | **PARTIAL** | No explicit proration logic — Stripe handles this by default, but no custom proration configuration |
| Subscription status synced | **PASS** | Webhooks for `subscription.created`, `subscription.updated`, `subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed` |
| Expired plan access revoked | **PARTIAL** | `past_due` status is set but no check prevents `past_due` users from consuming credits they already have |
| Free tier abuse prevention | **PARTIAL** | Rate limiting exists but no signup velocity limits or device fingerprinting |

**Verdict:** Mostly solid. The `past_due` access revocation could be tighter.

---

## FRAUD PREVENTION

| Item | Status | Notes |
|------|--------|-------|
| Stripe Radar | **NOT CONFIGURED** | Not enabled in checkout sessions |
| Chargeback alerts | **MISSING** | No `charge.dispute.created` webhook handler |
| Suspicious activity detection | **PARTIAL** | Abuse pattern detection in `auditLog.ts` for admin actions, but no payment-specific fraud detection |
| Credit purchase velocity limits | **MISSING** | No limit on how many top-ups a user can purchase per day/week |
| Promo code abuse prevention | **N/A** | `allow_promotion_codes` is not enabled in checkout sessions |

**Verdict:** Fraud prevention is the weakest area. Chargeback alerts and purchase velocity limits should be added.

---

## RECOMMENDED ALERTS STATUS

| Alert | Status |
|-------|--------|
| Large credit purchase (above threshold) | **MISSING** |
| Multiple failed payment attempts | **MISSING** (only sets `past_due`, no Slack alert) |
| Manual credit adjustment by admin | **PASS** |
| Chargeback/dispute filed | **MISSING** |
| Subscription cancelled | **MISSING** (handled in webhook but no alert) |
| Unusual credit consumption spike | **MISSING** |

---

## PRIORITY ACTION ITEMS

### Critical (Fix Now)
1. **Webhook idempotency** — `addTopupCredits` must check for duplicate `session.id` before adding credits
2. **Chargeback webhook handler** — Add `charge.dispute.created` event handling with Slack alert

### High Priority
3. **Security headers** — Add HSTS, CSP, X-Content-Type-Options, X-Frame-Options via Express middleware
4. **Dependency updates** — Upgrade `@trpc/server` to 11.8.0+ (prototype pollution fix)
5. **Credit purchase velocity limits** — Cap top-up purchases per user per day

### Medium Priority
6. **Session expiration** — Reduce from 1 year to 30 days, add sliding renewal
7. **Account deletion** — Add self-service account deletion for GDPR compliance
8. **Error tracking** — Integrate Sentry or similar for production error monitoring
9. **Subscription cancellation alerts** — Slack notification when users cancel
10. **Large purchase alerts** — Slack notification for purchases above a threshold
