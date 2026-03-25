# FormaStudio™ — Production Readiness Audit

**Multi-User Scale Assessment**
**Date:** February 19, 2026
**Scope:** Server-side infrastructure, Gemini API integration, credit system, security, monitoring, and data management
**Prepared for:** Mike (Founder)

---

## Executive Summary

FormaStudio's architecture is **well-designed for single-digit concurrent users** and already includes several production-grade patterns: atomic credit deduction, per-user rate limiting, in-memory session isolation, Slack-based health monitoring, graceful shutdown, and comprehensive audit logging. However, scaling to **dozens or hundreds of concurrent users** exposes gaps in eight critical areas. This report catalogs every finding across 14 dimensions, rates each by severity, and proposes concrete fixes with estimated effort.

**Overall Readiness Score: 6.5 / 10** — Solid foundation, but needs targeted hardening before a public launch with significant traffic.

---

## 1. Gemini API — Rate Limits & Quota Sharing

### Current State

All Gemini calls flow through a single API key (`GEMINI_API_KEY`). Every user's generation — headshot, iteration, full body, multi-view, upscale, suggestions, reconciliation, schema update, prompt compaction, identity check — shares the same quota bucket. The codebase uses four distinct Gemini models (`gemini-3-pro-image-preview`, `gemini-2.5-flash-image`, `gemini-3-pro-preview`, `gemini-3-flash-preview`, `gemini-2.5-flash`) with automatic fallback chains.

### Identified Gaps

| # | Gap | Severity | Impact |
|---|-----|----------|--------|
| 1.1 | **Single API key = single quota bucket.** All users share one RPM/TPM limit. A burst of 10 concurrent users generating images could exhaust the quota and cascade 429 errors to everyone. | **Critical** | Total service outage for all users when any one user triggers rate limits |
| 1.2 | **No server-side Gemini rate limiter.** The app relies entirely on Gemini's server-side 429 responses. There is no proactive throttling or queuing before requests hit the API. | **High** | Wasted credits (deducted atomically before the API call), poor UX (users see errors after waiting 60s) |
| 1.3 | **429 errors are not retried** (by design — `withSingleRetry503` explicitly skips 429). This is correct for preventing amplification, but without a queue, users simply lose. | **Medium** | Users must manually retry; no automatic recovery |
| ~~1.4~~ | ~~**`generateAllViews` fires 3 parallel Gemini image calls** per user.~~ | ~~High~~ | **CORRECTION (v22 review):** The `generateAllViews` endpoint still exists in the codebase and still fires 3 parallel calls (`side`, `walk`, `back`), but this is **stale code from pre-Patch 15**. The current production flow only generates a single side profile view via the `multiView` endpoint (1 Gemini call, not 3). The `generateAllViews` endpoint should be **deprecated and removed** to prevent accidental use. Severity downgraded from High to **Low** (dead code cleanup). |

### Recommended Fixes

**Fix 1.1 + 1.2 — Gemini Request Queue (P0, ~2 days)**
Introduce a server-side concurrency limiter (e.g., `p-limit` or a custom semaphore) that caps total in-flight Gemini image generation calls to a configurable maximum (e.g., 5–8). Requests beyond the limit enter a FIFO queue with a maximum wait time. This prevents quota exhaustion and provides fair scheduling across users.

**Fix 1.4 — Remove stale `generateAllViews` endpoint (P2, ~0.5 hour)**
The `generateAllViews` route, the `generateRemainingViews` batch function in `geminiViews.ts`, and the frontend `useCastingViewGeneration.ts` references to `generateAllViewsMutation` / walking / back views are all stale post-Patch 15. Remove them to prevent confusion and eliminate the risk of a user accidentally triggering 3 parallel Gemini calls. The `multiView` single-view endpoint and `generateSingleView` function remain the correct path.

---

## 2. In-Memory Session Management

### Current State

Casting chat sessions are stored in a `Map<string, CastingSession>` keyed by `userId`. Sessions have a 30-minute TTL with lazy eviction (checked only when `clearCastingSession` is called). Each session holds a Gemini `chat` object that retains conversation history for identity consistency during iterations.

### Identified Gaps

| # | Gap | Severity | Impact |
|---|-----|----------|--------|
| 2.1 | **Unbounded memory growth.** Each session holds a Gemini chat object containing full conversation history (including base64 image data). With 100 active users, this could consume several GB of RAM. | **High** | OOM crashes under load |
| 2.2 | **No periodic eviction.** Stale sessions are only cleaned when `clearCastingSession` is called. If no one clears, sessions accumulate indefinitely until the 30-min TTL check fires — but that check only runs inside `clearCastingSession`, not on a timer. | **Medium** | Memory leak over time |
| 2.3 | **Sessions lost on server restart.** All in-memory sessions are destroyed on deploy or crash. Users mid-iteration lose their conversation context. | **Low** | Acceptable for current scale; iterations fall back to stateless mode gracefully |

### Recommended Fixes

**Fix 2.1 + 2.2 — Periodic eviction timer + session cap (P1, ~0.5 day)**
Add a `setInterval` (every 5 minutes) that calls `evictStaleSessions()`. Add a hard cap (e.g., 200 sessions) with LRU eviction when the cap is reached. Log session count periodically for monitoring.

**Fix 2.1 (alternative) — Session size estimation (P2, ~1 day)**
Track approximate memory per session (count of messages × average size). Evict the largest sessions first when memory pressure is detected.

---

## 3. Rate Limiting Architecture

### Current State

The rate limiting system is comprehensive and well-structured:

- **IP-based rate limiting** for public endpoints (newsletter, waitlist): `checkRateLimit()`
- **Per-user rate limiting** for authenticated endpoints: `checkUserRateLimit()`
- **Global attack detection** for credential stuffing: `recordGlobalFailedLogin()`
- **IP blocking** via database: `checkIpBlocked()`
- Pre-configured limits: 10 generations/min (IP), 20 generations/min (user), 60 API calls/min (user)

### Identified Gaps

| # | Gap | Severity | Impact |
|---|-----|----------|--------|
| 3.1 | **Rate limiting is in-memory only.** In a multi-instance deployment, each server has its own rate limit counters. A user could bypass limits by hitting different instances. | **Medium** | Only relevant if horizontally scaled; single-instance is fine |
| 3.2 | **`castingImage` route uses IP-based rate limiting** (`checkRateLimit('user:${ctx.user.id}', RATE_LIMITS.generation)`) but other generation routes (`fullBody`, `multiView`, `iterate`, `upscale`) have **no rate limiting at all**. | **High** | Users can spam expensive generation endpoints without throttling |
| 3.3 | **Free-tier endpoints** (`suggestions`, `analyzeReference`, `reconcile`, `compactPrompt`, `enhance`) have **no rate limiting and no credit cost**. Each makes a Gemini API call. | **High** | A malicious user could spam these to exhaust the shared Gemini quota without spending any credits |
| 3.4 | **`proxyImage` has no rate limiting.** It fetches arbitrary URLs and returns base64. | **Medium** | Could be used as a bandwidth amplifier (SSRF severity is covered separately in 9.3) |

### Recommended Fixes

**Fix 3.2 — Add rate limiting to all generation routes (P0, ~1 hour)**
Apply `checkUserRateLimit(ctx.user.id, USER_RATE_LIMITS.userGeneration)` to `fullBody`, `multiView`, `iterate`, and `upscale` mutations.

**Fix 3.3 — Add rate limiting to free Gemini endpoints (P0, ~1 hour)**
Apply a dedicated rate limit (e.g., 30 calls/min per user) to `suggestions`, `analyzeReference`, `reconcile`, `compactPrompt`, and `enhance`. These are "free" in credits but expensive in API quota.

**Fix 3.4 — Rate limit proxyImage (P1, ~0.5 hour)**
Add rate limiting. Domain restriction is covered in 9.3.

---

## 4. Atomic Credit System & Billing Protection

### Current State

The credit system is well-engineered:

- **Atomic deduction** via SQL `UPDATE ... WHERE balance >= amount` prevents race conditions
- **Refund on failure** via `withAtomicCredits()` wrapper
- **Idempotency check** on `addCredits()` via `referenceId` deduplication
- **Account freeze** blocks generation for accounts under billing investigation
- **Flash fallback pricing** at 50% discount

### Identified Gaps

| # | Gap | Severity | Impact |
|---|-----|----------|--------|
| 4.1 | **`castingImage` route uses manual deduct/refund** instead of `withAtomicCredits()`.** It calls `deductPoints()` directly, then manually calls `addCredits()` in the catch block. This duplicates the atomic pattern and could diverge. | **Medium** | Maintenance risk; the manual refund path is functionally correct but inconsistent |
| 4.2 | **`addCredits()` is not atomic.** It reads the balance, computes `newBalance = balance + amount`, then writes. Two concurrent `addCredits` calls could overwrite each other (last-write-wins). | **High** | Credits could be lost during concurrent refunds or subscription renewals |
| 4.3 | **No daily/weekly spending cap.** A user with a large balance could burn through their entire allocation in minutes via rapid generation. | **Low** | Business decision; not a security bug |
| 4.4 | **Credit transaction log has no index on `(userId, referenceId)`.** The idempotency check in `addCredits()` does a full scan. | **Medium** | Slow idempotency checks at scale |
| 4.5 | **Gemini content safety refusals may not trigger the refund path.** See new Section 15 for detailed analysis. | **P0** | Users charged for refused generations |

### Recommended Fixes

**Fix 4.1 — Migrate castingImage to withAtomicCredits (P2, ~0.5 hour)**
Replace the manual deduct/refund pattern with the standard `withAtomicCredits()` wrapper for consistency.

**Fix 4.2 — Make addCredits atomic (P0, ~1 hour)**
Replace the read-then-write pattern with `UPDATE points SET balance = balance + ${amount} WHERE user_id = ${userId}`, matching the atomic pattern already used in `deductCredits`.

**Fix 4.4 — Add database indexes (P1, ~0.5 hour)**
See Section 7 for the full index recommendation.

---

## 5. Concurrency & Request Isolation

### Current State

Each tRPC mutation runs in its own async context. The Gemini client is stateless (created fresh via `getAiClient()` on each call). Chat sessions are isolated by `userId` key. Credit deductions use atomic SQL.

### Identified Gaps

| # | Gap | Severity | Impact |
|---|-----|----------|--------|
| 5.1 | **No request-level abort propagation.** If a user navigates away mid-generation, the server continues the 60-second Gemini call, consuming API quota and credits. The `withTimeout` helper accepts an `AbortController` but it's never passed from the router layer. | **Medium** | Wasted resources; credits are deducted but the result is discarded |
| ~~5.2~~ | ~~**`generateAllViews` partial failure = full refund.**~~ | ~~Medium~~ | **CORRECTION (v22 review):** This concern applied to the stale `generateAllViews` endpoint that fires 3 parallel Gemini calls. Since Patch 15, the production flow uses single-view `multiView` calls (1 Gemini call per invocation). Partial failure handling is no longer relevant — each call either succeeds or fails atomically. Severity downgraded to **N/A** (dead code). The fix is to remove `generateAllViews` entirely (see 1.4). |
| 5.3 | **No global concurrency limit on Gemini calls.** (Duplicate of 1.2 — included here for completeness.) | **High** | Quota exhaustion |

### Recommended Fixes

**Fix 5.1 — Abort propagation (P2, ~0.5 day)**
Pass an `AbortController` from the Express request to `withTimeout`. When the client disconnects (`req.on('close')`), abort the controller to cancel in-flight Gemini calls.

---

## 6. Image Storage & S3 Management

### Current State

All generated images are uploaded to S3 via `storagePut()` with random filenames. The S3 bucket is public (no signing required). Storage URLs are saved in `model_assets.storageUrl`. A `storageDelete()` helper exists but is not called from any generation or cleanup code.

### Identified Gaps

| # | Gap | Severity | Impact |
|---|-----|----------|--------|
| 6.1 | **No S3 cleanup on iteration.** When a user iterates on a headshot, a new asset is created but the old image remains in S3. Over time, orphaned images accumulate. | **Medium** | Storage cost growth; not a functional issue |
| 6.2 | **No S3 cleanup on model deletion.** When a model is archived, its S3 images are not deleted. | **Medium** | Same as above |
| 6.3 | **No storage quota enforcement at upload time.** The `users.storageUsed` and `users.storageLimit` fields exist in the schema but are never checked or updated during generation. | **Medium** | Users can generate unlimited images regardless of their storage quota |
| 6.4 | **Base64 round-trip for S3 images.** When generating full body or views from an existing S3 image, the server fetches the image, converts to base64, sends to Gemini, gets base64 back, and re-uploads. This doubles bandwidth and memory per request. | **Low** | Performance concern at scale; functionally correct |

### Recommended Fixes

**Fix 6.1 + 6.2 — S3 cleanup on asset replacement and model archival (P2, ~1 day)**
When creating a new asset for the same `(modelId, viewType)`, delete the previous S3 object. When archiving a model, queue S3 deletions for all its assets.

**Fix 6.3 — Enforce storage quota (P2, ~0.5 day)**
Before `storagePut()`, check `storageUsed + estimatedSize <= storageLimit`. Update `storageUsed` after successful upload.

---

## 7. Database Architecture & Write Pressure

### Current State

The database is MySQL/TiDB accessed via Drizzle ORM with a single connection (no explicit pool configuration). The schema includes 12 tables with appropriate column types. No database indexes are defined beyond primary keys and unique constraints.

### Identified Gaps

| # | Gap | Severity | Impact |
|---|-----|----------|--------|
| 7.1 | **No secondary indexes.** The following queries will perform full table scans as the tables grow: `creditTransactions WHERE userId AND referenceId`, `generations WHERE userId`, `modelAssets WHERE modelId`, `auditLogs WHERE severity AND createdAt`, `models WHERE userId`. | **Critical** | Query performance degrades linearly with table size; health monitor queries become slow |
| 7.2 | **No connection pooling configuration.** `drizzle(process.env.DATABASE_URL)` uses the default mysql2 pool (typically 10 connections). Under load, 10+ concurrent generation requests could exhaust the pool. | **High** | Database connection timeouts; cascading failures |
| 7.3 | **No database transactions.** Multi-step operations (deduct credits → create generation → create asset → update model) are not wrapped in transactions. A failure mid-sequence leaves partial state. | **Medium** | Orphaned generation records, credits deducted without assets created |
| 7.4 | **`creditTransactions` table grows unbounded.** Every generation, refund, and purchase creates a row. No archival or partitioning strategy. | **Low** | Manageable for months; becomes a concern at millions of rows |

### Recommended Fixes

**Fix 7.1 — Add secondary indexes (P0, ~1 hour)**
```sql
-- Credit system
CREATE INDEX idx_credit_txn_user_ref ON point_transactions(userId, referenceId);
CREATE INDEX idx_credit_txn_user_created ON point_transactions(userId, createdAt);

-- Generations
CREATE INDEX idx_generations_user ON generations(userId, createdAt);
CREATE INDEX idx_generations_status ON generations(status, createdAt);

-- Model assets
CREATE INDEX idx_model_assets_model ON model_assets(modelId);

-- Audit logs (health monitor queries)
CREATE INDEX idx_audit_severity_created ON audit_logs(severity, createdAt);
CREATE INDEX idx_audit_user ON audit_logs(userId, createdAt);

-- Models
CREATE INDEX idx_models_user ON models(userId, status);
```

**Fix 7.2 — Configure connection pool (P1, ~0.5 hour)**
Pass explicit pool options to the mysql2 driver: `connectionLimit: 20`, `waitForConnections: true`, `queueLimit: 50`.

---

## 8. Error Recovery & Resilience

### Current State

The error recovery patterns are solid:

- **Model fallback chains:** Every Gemini call tries Pro first, then Flash, with 1-second delays between attempts
- **`withSingleRetry503`:** Retries once on 500/503 with 3-second backoff
- **`withTimeout`:** All Gemini calls have 30–90 second timeouts
- **Fail-safe defaults:** Suggestions, reconciliation, and prompt compaction return current state on failure
- **Graceful shutdown:** SIGTERM/SIGINT handlers drain connections with 10-second force-exit

### Identified Gaps

| # | Gap | Severity | Impact |
|---|-----|----------|--------|
| 8.1 | **No circuit breaker.** If Gemini is down, every user request still attempts the full fallback chain (Pro → Flash → error), wasting 60+ seconds per request before failing. | **Medium** | Poor UX during outages; users wait a long time for inevitable failures |
| 8.2 | **Error messages leak internal details.** `formatGeminiError` passes through raw error messages for 400 errors: `Invalid request (400): ${msg}`. | **Low** | Information disclosure; not a security risk but unprofessional |
| 8.3 | **No structured error logging.** Errors are logged via `console.error` with inconsistent formats. No correlation IDs link a user's request to its error. | **Medium** | Difficult to debug production issues |

### Recommended Fixes

**Fix 8.1 — Circuit breaker for Gemini API (P1, ~1 day)**
Track consecutive failures per model. After N failures (e.g., 5) within a window (e.g., 2 minutes), skip that model for a cooldown period. Alert via Slack when a circuit opens.

---

## 9. Security Hardening

### Current State

Security is above average for an early-stage product:

- **Auth:** Manus OAuth with session cookies, `protectedProcedure` enforcement
- **Authorization:** `model.userId !== ctx.user.id` checks on all model operations
- **Input validation:** Zod schemas on all tRPC inputs
- **IP blocking:** Database-backed with admin UI
- **Audit logging:** Comprehensive coverage of security events
- **Account lockout:** Failed login protection with temporary lockout
- **Disposable email blocking:** Prevents throwaway signups

### Identified Gaps

| # | Gap | Severity | Impact |
|---|-----|----------|--------|
| 9.1 | **No security headers.** No `helmet`, no CSP, no `X-Frame-Options`, no `Strict-Transport-Security`. | **High** | Clickjacking, MIME sniffing, missing HSTS |
| 9.2 | **50MB JSON body limit.** `express.json({ limit: "50mb" })` is extremely generous. A malicious user could send large payloads to exhaust server memory. | **Medium** | Memory exhaustion via large request bodies |
| 9.3 | **`proxyImage` is an authenticated SSRF endpoint (P0).** Although it sits behind `protectedProcedure` (so unauthenticated users cannot access it), any logged-in user can make the server fetch **any URL** and return its content as base64. There is no domain allowlist. This is a **security vulnerability**, not merely a scaling concern. A malicious authenticated user could use it to probe internal network endpoints, access cloud metadata services (e.g., `http://169.254.169.254/`), or exfiltrate data from services only reachable from the server's network. | **P0 / Critical** | SSRF — internal network scanning, metadata endpoint access, data exfiltration from server-side network |
| 9.4 | **Base64 image inputs have no size validation.** `referenceImageBase64`, `maskBase64`, `imageBase64` fields accept unbounded strings. A 100MB base64 string would consume ~150MB of server memory. | **Medium** | Memory exhaustion via oversized image inputs |
| 9.5 | **Console log leaks email addresses.** `sdk.ts` logs `Blocked disposable email signup: ${userInfo.email}`. | **Low** | PII in logs; minor compliance concern |

### Recommended Fixes

**Fix 9.1 — Add security headers (P0, ~0.5 hour)**
Install `helmet` and add it as Express middleware before all routes. This adds CSP, X-Frame-Options, HSTS, and other headers with sensible defaults.

**Fix 9.2 — Reduce JSON body limit (P1, ~5 minutes)**
Reduce to `10mb` for the general JSON parser. Create a separate route with higher limits specifically for image upload endpoints.

**Fix 9.3 — Restrict proxyImage to S3 domains (P0, ~0.5 hour)**
Validate that `input.imageUrl` starts with the known S3/CloudFront storage domain before fetching. Reject all other URLs with a `BAD_REQUEST` error. Additionally, block RFC 1918 private ranges, link-local addresses (`169.254.x.x`), and `localhost` to prevent internal network probing even if the allowlist is bypassed via DNS rebinding.

**Fix 9.4 — Add base64 size limits (P1, ~0.5 hour)**
Add `.max()` constraints to Zod schemas for base64 string inputs (e.g., `z.string().max(15_000_000)` for ~10MB images).

---

## 10. Monitoring & Observability

### Current State

The monitoring system is well-built:

- **Health monitor:** Runs every 5 minutes, checks generation success rate, DB connectivity, DB latency, error spikes, and queue backup
- **Slack alerting:** Dispatches to dedicated channels with cooldown to prevent spam
- **Audit log system:** Tracks 40+ event types with severity levels
- **Health endpoint:** `/api/health` with rate limiting

### Identified Gaps

| # | Gap | Severity | Impact |
|---|-----|----------|--------|
| 10.1 | **No per-request tracing.** No correlation IDs, no request duration logging, no way to trace a user's journey through the system. | **Medium** | Difficult to debug "my generation failed" reports |
| 10.2 | **No Gemini API usage metrics.** No tracking of calls per model, latency percentiles, or error rates by model. | **Medium** | Cannot make data-driven decisions about model fallback thresholds |
| 10.3 | **No active user count metric.** The session map size is never logged or exposed. | **Low** | Cannot correlate load with issues |
| 10.4 | **Health monitor queries have no indexes** (covered in Section 7). | **Medium** | Health checks themselves become slow under load |

### Recommended Fixes

**Fix 10.1 — Request correlation IDs (P2, ~1 day)**
Generate a UUID per request in tRPC context. Pass it through to all log statements and Gemini calls. Return it in error responses so users can reference it in support tickets.

**Fix 10.2 — Gemini metrics tracking (P2, ~1 day)**
Wrap `getAiClient()` calls with a metrics layer that records: model name, latency, success/failure, token usage. Expose via the health endpoint or a dedicated metrics endpoint.

---

## 11. Graceful Degradation

### Current State

The system has good degradation patterns:

- **Model fallback chains:** Pro → Flash for all generation types
- **Fail-safe suggestions:** Returns hardcoded fallbacks if Gemini fails
- **Fail-safe reconciliation:** Returns current schema unchanged on error
- **Fail-safe prompt compaction:** Returns bloated prompt unchanged on error

### Identified Gaps

| # | Gap | Severity | Impact |
|---|-----|----------|--------|
| 11.1 | **No maintenance mode.** There is no way to gracefully disable generation while keeping the rest of the app functional (browsing models, viewing history, billing). | **Medium** | During Gemini outages, users see cryptic errors instead of a clear message |
| 11.2 | **No user-facing status page.** The announcement system exists but is not automatically triggered by health monitor alerts. | **Low** | Users don't know if the system is degraded |

### Recommended Fixes

**Fix 11.1 — Maintenance mode flag (P2, ~0.5 day)**
Add a server-side flag (environment variable or database setting) that, when enabled, returns a friendly "Generation is temporarily unavailable" message from all generation endpoints without attempting Gemini calls.

---

## 12. Data Privacy & Compliance

### Current State

- User data is stored in MySQL with standard fields
- S3 images are publicly accessible (no authentication required)
- Audit logs track security-sensitive operations
- No GDPR data export or deletion endpoints exist

### Identified Gaps

| # | Gap | Severity | Impact |
|---|-----|----------|--------|
| 12.1 | **No account deletion flow.** The `ACCOUNT_DELETED` audit action exists but no endpoint implements it. Users cannot delete their data. | **High** | GDPR/CCPA non-compliance if serving EU/California users |
| 12.2 | **No data export endpoint.** Users cannot download their data. | **Medium** | GDPR right of access non-compliance |
| 12.3 | **S3 images are publicly enumerable** if someone guesses the key pattern (`casting/timestamp-random.png`). The random suffix provides some protection but is not cryptographically strong. | **Low** | Low risk due to random component; could be hardened |
| 12.4 | **Email logged in plaintext** in disposable email blocking. | **Low** | Minor PII leak in server logs |

### Recommended Fixes

**Fix 12.1 — Account deletion endpoint (P1, ~2 days)**
Implement a `deleteAccount` mutation that: soft-deletes the user record, queues S3 asset deletion, anonymizes audit logs, cancels Stripe subscription, and logs the action.

---

## 13. Load Testing Readiness

### Current State

No load testing infrastructure exists. The test suite covers unit tests and integration tests but not performance or concurrency scenarios.

### Recommended Actions

**Load test scenario design (P2, ~1 day)**
Design and document key scenarios:
1. **10 concurrent headshot generations** — validates Gemini queue and credit atomicity
2. **50 concurrent suggestion requests** — validates free-endpoint rate limiting
3. **100 concurrent model list queries** — validates DB connection pool
4. **Rapid iteration spam** (20 iterations in 1 minute from one user) — validates per-user rate limiting

---

## 14. Infrastructure & Deployment

### Current State

The application runs as a single Node.js process with Express + tRPC. It uses Manus hosting with automatic deployment via checkpoints.

### Identified Gaps

| # | Gap | Severity | Impact |
|---|-----|----------|--------|
| 14.1 | **Single process = single point of failure.** No horizontal scaling capability due to in-memory state (sessions, rate limits). | **Medium** | Acceptable for current scale; blocks future scaling |
| 14.2 | **No request timeout middleware.** Long-running Gemini calls (up to 90s for upscale) hold the connection open. Express has no default request timeout. | **Low** | Connection exhaustion under extreme load |

---

## 15. Gemini Safety Refusal — Credit Refund Gap (NEW)

> **Added based on code review feedback.** This section was not in the original audit and addresses a gap in the intersection of Gemini's content safety filters and the atomic credit system.

### The Question

When Gemini's content safety filter triggers **after credits have been deducted**, does the user get a refund? The `withAtomicCredits` wrapper refunds credits when the operation throws an error. But what if Gemini returns a **successful HTTP 200 response** with a safety refusal instead of an error?

### Code Path Analysis

The credit flow for all generation endpoints is:

1. `withAtomicCredits()` deducts credits atomically
2. The Gemini API call is made inside the operation callback
3. If the callback **throws**, credits are refunded
4. If the callback **returns**, credits stay deducted

The critical question is: **do safety refusals throw or return?**

Examining the response handling in `geminiGeneration.ts` (lines 472–482) and `geminiViews.ts` (lines 95–104), all generation paths use the same pattern:

```typescript
const extractImage = (response: any): string => {
  const diagnosis = diagnoseResponse(response);
  if (diagnosis) throw new Error(diagnosis);        // ← throws on safety block
  const imageUrl = extractImageFromResponse(response);
  if (!imageUrl) {
    const text = safeResponseText(response);
    if (text) throw new Error(`Refusal: ${text.slice(0, 80)}...`);  // ← throws on text-only refusal
    throw new Error("No image data in response.");   // ← throws on empty response
  }
  return imageUrl;
};
```

And `diagnoseResponse()` in `geminiClient.ts` (lines 89–109) checks:

```typescript
// Check prompt-level block (blocked before any generation)
const blockReason = response?.promptFeedback?.blockReason;
if (blockReason) return `Prompt blocked by safety filter: ${blockReason}...`;

// Check candidate finish reason
const finishReason = candidates[0]?.finishReason;
if (['SAFETY', 'BLOCKED', 'RECITATION', 'PROHIBITED_CONTENT'].includes(finishReason))
  return `Generation stopped: ${finishReason}...`;
```

### Verdict: Mostly Covered, One Gap

| Safety Scenario | Detected? | Throws? | Credits Refunded? |
|---|---|---|---|
| **Prompt blocked before generation** (`promptFeedback.blockReason` set) | Yes — `diagnoseResponse()` catches it | Yes | **Yes** |
| **Generation stopped mid-stream** (`finishReason = 'SAFETY'`) | Yes — `diagnoseResponse()` catches it | Yes | **Yes** |
| **Successful response but no image** (text-only refusal) | Yes — `extractImageFromResponse()` returns null, then text is checked | Yes | **Yes** |
| **Successful response, empty candidates array** | Yes — `diagnoseResponse()` catches `!candidates.length` | Yes | **Yes** |
| **Successful response with image AND safety flag** (Gemini returns a "safe" placeholder image with `finishReason = 'SAFETY'`) | **No** — `extractImageFromResponse()` finds an image and returns it before `finishReason` is checked | **No — returns normally** | **No — credits stay deducted** |

### The Gap: Placeholder Images with Safety Flags

The `extractImage` function calls `diagnoseResponse()` first (which checks `finishReason`), then `extractImageFromResponse()`. So if `finishReason` is `'SAFETY'`, it **will** throw before checking for an image. The ordering is correct.

However, there is a subtle edge case: if Gemini returns `finishReason = 'STOP'` (normal completion) but the image content is a **blank/placeholder image** generated as a "safe" alternative (e.g., a solid gray rectangle instead of the requested person), the system will treat it as a successful generation. The user pays credits for a useless image.

### Severity: **Medium**

This is not a common scenario with `BLOCK_NONE` safety settings (which the app uses), but it can still occur for prompts that trigger Gemini's hardcoded safety boundaries that override `BLOCK_NONE`. The safety settings in `geminiClient.ts` are set to `BLOCK_NONE` specifically because fashion casting requires bare skin descriptions, but Gemini may still refuse certain combinations.

### Recommended Fix (P1, ~0.5 day)

Add a post-generation validation step that checks whether the returned image is a blank/placeholder (e.g., by checking if the image has very low entropy or is predominantly a single color). If detected, throw an error with a user-friendly message so the refund path triggers. This could reuse the existing `checkIdentityConsistency` pattern — ask a fast text model "Is this a real person or a blank/placeholder image?" before accepting the result.

---

## Priority Matrix

The following table summarizes all findings ordered by implementation priority:

| Priority | Item | Effort | Section |
|----------|------|--------|---------|
| **P0** | Add database indexes | 1 hour | 7.1 |
| **P0** | Add security headers (helmet) | 0.5 hour | 9.1 |
| **P0** | Restrict proxyImage to S3 domains + block private IPs | 0.5 hour | 9.3 |
| **P0** | Rate limit all generation routes | 1 hour | 3.2 |
| **P0** | Rate limit free Gemini endpoints | 1 hour | 3.3 |
| **P0** | Make addCredits atomic | 1 hour | 4.2 |
| **P0** | Gemini request queue / concurrency limiter | 2 days | 1.1, 1.2 |
| **P1** | Session eviction timer + cap | 0.5 day | 2.1, 2.2 |
| **P1** | Configure DB connection pool | 0.5 hour | 7.2 |
| **P1** | Add base64 size limits to Zod schemas | 0.5 hour | 9.4 |
| **P1** | Reduce JSON body limit | 5 min | 9.2 |
| **P1** | Circuit breaker for Gemini | 1 day | 8.1 |
| **P1** | Account deletion endpoint | 2 days | 12.1 |
| **P1** | Post-generation placeholder image detection | 0.5 day | 15 |
| **P2** | Remove stale generateAllViews endpoint + dead code | 0.5 hour | 1.4, 5.2 |
| **P2** | Migrate castingImage to withAtomicCredits | 0.5 hour | 4.1 |
| **P2** | S3 cleanup on iteration/archival | 1 day | 6.1, 6.2 |
| **P2** | Enforce storage quota | 0.5 day | 6.3 |
| **P2** | Abort propagation for disconnected clients | 0.5 day | 5.1 |
| **P2** | Request correlation IDs | 1 day | 10.1 |
| **P2** | Gemini metrics tracking | 1 day | 10.2 |
| **P2** | Maintenance mode flag | 0.5 day | 11.1 |
| **P2** | Load test scenario design | 1 day | 13 |

**Total estimated effort for P0 items: ~3 days**
**Total estimated effort for P0 + P1 items: ~8.5 days**
**Total estimated effort for all items: ~17 days**

---

## What's Already Working Well

It's worth acknowledging the patterns that are already production-grade and should be preserved:

1. **Atomic credit deduction** via SQL conditional update — prevents race condition exploits
2. **Comprehensive audit logging** with 40+ event types and severity levels
3. **Graceful shutdown** with connection draining and 10-second force-exit
4. **Model fallback chains** with automatic Pro → Flash degradation
5. **Per-user session isolation** for Gemini chat contexts
6. **Global attack detection** for credential stuffing with Slack alerting
7. **IP blocking** with database persistence and admin UI
8. **Account freeze** mechanism for billing investigations
9. **Idempotency checks** on credit additions via referenceId
10. **Health monitoring** with 5-minute intervals and Slack dispatch

These patterns demonstrate strong security awareness and should serve as templates for the recommended fixes above.

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| v1 | 2026-02-19 | Initial 14-dimension audit |
| v2 | 2026-02-19 | **Corrections based on founder review:** (1) Items 1.4 and 5.2 downgraded — `generateAllViews` is stale post-Patch 15; production flow uses single-view `multiView` endpoint. (2) Item 9.3 elevated to P0 — `proxyImage` is an SSRF vulnerability regardless of `protectedProcedure` auth; added private IP blocking recommendation. (3) New Section 15 added — Gemini safety refusal credit refund gap analysis; main paths are covered but placeholder image edge case identified. |
