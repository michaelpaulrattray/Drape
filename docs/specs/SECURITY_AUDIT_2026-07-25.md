# Drape security audit — full review and remediation plan

**Status:** current security document for Drape. Supersedes `docs/archive/SECURITY_AUDIT.md` (2026-02-06) and `docs/archive/security-audit.md` (2026-07-09), both now deleted — recoverable from git history if the originals are ever needed.
**Implementation status:** C1, C2, H1, H6, and M7 option 1 are implemented and committed on local `main`. They have not been pushed or deployed by this workstream; production status must be verified separately before any finding is called closed in production. All remaining findings must be resolved or explicitly accepted before the invite gate opens.
**Audit date:** 2026-07-25. **Branch:** `main`. **Method:** read-only source review of the server, plus `pnpm audit`. Independent second review was attempted and could not be completed, so every finding here rests on a single reviewer — treat the "Verified healthy" section in particular as unconfirmed by a second pair of eyes.

---

## Context

Drape is a pre-launch commercial product with live billing, credits, and auth, currently mid-way through R7 (the casting-studio overhaul). The founder asked for a full security audit that could run alongside that work, plus coverage of four specific themes: rate limiting on public endpoints, strict schema validation that rejects unexpected fields, secure API-key handling, and an access-control matrix written into `CLAUDE.md` so future agents know the *expected* behaviour per permission level rather than inferring it.

**One exposure fact frames every severity call below:** Drape is invite-gated. Registration requires a valid beta code (`server/routes/emailAuth.ts:101`) and login requires `approved` (`:317`). So any finding that needs a logged-in account has a small, known, invited attacker pool today — but becomes a live risk the moment the gate opens. Findings reachable **without** an account do not get that discount, and those are the ones flagged for during-R7 attention.

Everything here is verified against the code. Two concerns raised during review were checked and **disproved** — see "Verified healthy" — and are recorded so nobody re-raises them.

---

## Implementation ledger

| Finding | Local implementation | Production |
|---|---|---|
| C1 — board child-ID ownership | `705eeb3` — durable owner/board-scoped locks and writes, exact-count refusal, cross-tenant DB tests | Not deployed or verified by this documentation update |
| C2 — image proxy SSRF | `6d23000` — authentication, per-user rate limit, redirect refusal, timeout, byte cap, streamed-size enforcement, and magic-byte validation through shared fetch authority | Not deployed or verified by this documentation update |
| H1 — spoofable client IP | `6d23000` — Railway one-hop trust configuration plus `req.ip`-only rate-limit identity | Not deployed or verified by this documentation update |
| H6 — public Cast registry | `cc45ba7` — route, router namespace, DB lookup, projection, and duplicate parity consumer removed; absence tests added | Not deployed or verified by this documentation update |
| M7 option 1 — guessable storage keys | `2e25674` — all current server storage writers use `node:crypto` `randomUUID()`; inventory guard rejects weak future writers | Not deployed or verified by this documentation update |

The finding narratives below preserve the audit-baseline evidence. Each implemented finding carries an explicit local status note; do not read the historical vulnerable-code description as the current local implementation.

---

## Verified healthy

Worth stating plainly, because it scopes the work and several of these are the things that usually go wrong:

- **API-key handling is clean — founder ask #3 needs no code change.** No secret reaches the client bundle. The only `import.meta.env` reference in all of `client/src` is `import.meta.env.DEV` (`client/src/features/casting/stores/useCastingGenerationStore.ts:200`). Gemini, Stripe secret, R2, and Resend keys are read server-side only through `server/_core/env.ts`. All Gemini calls happen server-side; the browser never holds a provider credential.
- **Spend and quota paths cannot be driven by client input.** `userId` in `server/lib/boardOps.ts` is a local helper parameter fed exclusively from `ctx.user.id` (`server/routes/boardOps.ts:430, 462, 509, 549, 621, 666`). `chargeReferenceId` is server-derived via `operationChargeReference(operationId)` (`server/db/generationOperations.ts:852`) and guarded by an equality check at `:859`, so refunds cannot be replayed by a forged reference.
- **`storageDelete` cannot be aimed at another bucket.** `Bucket` is hardcoded from env (`server/storage.ts:111`), satisfying D-64's "only storage keys proven to belong to Drape's configured bucket may be deleted".
- **Ownership checks are right in most of the app.** At the audit baseline, the four exceptions were the C1 board procedures below. Local `main` now scopes those durable statements by caller, board, and child cohort as well.
- **Storage-key authority is server-owned** and user-scoped. Where a user-supplied attachment filename is retained for usability, it is reduced to a strict `[A-Za-z0-9._-]` spelling before entering the key; the namespace and cryptographic random segment remain server-generated. Local `main` uses UUIDs at every current storage writer.
- **Stripe webhooks** verify the signature before parsing, are correctly registered ahead of `express.json()`, and are idempotent via the `stripeWebhookEvents` table.
- **Admin role management is sound** — no self-promotion, cannot grant admin, cannot modify an existing admin (`server/routes/admin/roles.ts:26-33`).
- **Production CSP is genuinely strict**: no `unsafe-inline`/`unsafe-eval` in `script-src`, plus HSTS, `nosniff`, and `frame-ancestors 'none'`.
- **Password handling** is bcrypt at cost 12 with a sane policy, generic login errors to prevent enumeration, and account lockout on repeated failure.
- **The Slack approval endpoint is properly authenticated.** `/api/slack/interactions` gates sensitive admin actions, so an unsigned endpoint here would be a full admin bypass. It is not: `server/slack/slackInteractions.ts:59-84` requires `SLACK_SIGNING_SECRET`, **fails closed with a 500 when it is unset**, requires both signature and timestamp headers, and `verifySlackSignature` (`server/slack/slackCore.ts:293`) rejects timestamps older than five minutes. *Minor robustness note, not a vulnerability:* the handler re-derives the signing base from `` `payload=${encodeURIComponent(payloadString)}` `` (`:78`) rather than the true raw bytes, so any encoding difference from Slack's original body would cause verification to fail closed — safe, but a possible source of mysterious "invalid signature" failures.

### Coverage gaps in this audit

Stated explicitly so the reviewer knows where to look rather than re-treading covered ground. Read thoroughly: bootstrap/session/tRPC middleware, both auth paths, email verification, rate limiting, SSRF validator, both proxies, security headers, Stripe webhooks, storage, admin roles, and the boards/boardOps/wardrobe ownership paths. **Not covered or only spot-checked:** the admin sub-routers other than `roles.ts` (`users.ts`, `inviteCodes.ts`, `changeRequests.ts`, `slackApproval.ts`, `auditLogs.ts`, `overview.ts`); all four moderator routers; `server/casting/**` internals (the live R7 surface — sampled, not audited); `server/wardrobe/**` internals; `security/deleteUserData.ts` and `db/gdprExport.ts`; `auditLog.ts` tamper-resistance; credit arithmetic and atomicity under concurrency; referral anti-fraud; the entire client (XSS, `dangerouslySetInnerHTML`, anything held in browser storage); and prompt-injection from user text into Gemini.

---

## Findings

Timing key: **During R7** = reachable without an account and isolated from casting files. **Post-R7** = fix after the overhaul ships. **Before launch** = must be closed before the invite gate opens, whenever that is.

### C1 — Cross-tenant board destruction (IDOR) · CRITICAL · **IMPLEMENTED LOCALLY 2026-07-25 — pending deployment**

**Current local status.** Fixed in `705eeb3`. The four durable database helpers now lock and prove the caller-owned board, re-anchor every child id to that board in the same statement, reject duplicates, require exact cohort/write counts, and roll back mixed or incomplete batches. Cross-tenant disposable-MySQL tests prove refusal and re-read the victim rows unchanged; legitimate owner behavior is also covered.

Four procedures verify you own the *board*, then pass client-supplied *child ids* straight into queries that filter on the child id alone:

| Procedure | Router | Backing query |
|---|---|---|
| `boards.deleteItems` | `server/routes/boards.ts:334` | `db.delete(boardItems).where(inArray(boardItems.id, itemIds))` — `server/db/boards.ts:209` |
| `boards.batchUpdatePositions` | `server/routes/boards.ts:302` | `where(eq(boardItems.id, id))` — `server/db/boards.ts:200` |
| `boardOps.undoDelete` | `server/routes/boardOps.ts:378` | `where(inArray(boardItems.id, itemIds))` — `server/db/boards.ts:149` |
| `boardOps.removeEdge` | `server/routes/boardOps.ts:403` | `where(eq(boardEdges.id, edgeId))` — `server/db/boardEdges.ts:40` |

**Impact.** Any logged-in user can permanently destroy up to 100 other users' canvas items per call, or silently rearrange their boards. `deleteBoardItems` is a **hard** delete, and D-64 rules out any archive, recovery window, or undo — the work is simply gone.

**Why it happened, and why that matters more than the bug.** The correct pattern already exists in the same codebase: `requireItemInBoard` (`server/lib/boardOps.ts:1812`), used correctly by `deleteNodes`, `moveNodes`, and `addEdge`. `server/routes/boardOps.ts` applies two checks (board ownership *and* per-id anchoring); `server/routes/boards.ts` applies only the first for its bulk procedures. This is precisely the founder's thesis in the wild — not bad code, but a convention that was never written down, so half the sibling procedures got it and half didn't.

**Recommended fix.** Push ownership into the durable write rather than adding a fifth guard call. D-64's deletion boundary already requires this shape: *"every Wardrobe/model writer that can persist a model id must re-prove an owned, available subject at its durable write"* (`docs/specs/DECISION_LOG.md:669`). Concretely:

```sql
DELETE bi FROM board_items bi JOIN boards b ON bi.board_id = b.id
WHERE bi.id IN (?) AND b.user_id = ?
```

Rows must match **and** be owned in one statement. This is strictly stronger than the guard pattern, which does a `SELECT` then writes on `id` alone and leaves a check-then-write race open.

**Scope note for the reviewer:** do *not* mass-migrate all db helpers to take `ownerId`. Fix these four sites and record the convention (see §"Access-control matrix"), so R7's new casting procedures adopt it going forward.

### C2 — Unauthenticated SSRF into the internal network · CRITICAL · **IMPLEMENTED LOCALLY 2026-07-25 — pending deployment**

**Current local status.** Fixed in `6d23000`. `/api/image-proxy` now authenticates, refuses suspended or locked users, applies a real per-user 429 limit, validates the requested URL, and delegates to shared bounded fetch authority. That authority revalidates, refuses redirects, times out header and body reads, enforces declared and streamed byte caps, requires an image content type, verifies supported magic bytes, and exposes only fixed refusal copy. The R7 snapshot-PDF path uses the same authority. The legacy CDN allowlist was deliberately left unchanged pending its data migration.

`/api/image-proxy` (`server/routes/imageProxy.ts:28`) requires no authentication and no rate limit. It validates only the *initial* URL, then calls bare `fetch(url)` — which follows redirects by default. The allowlist (`server/security/urlValidator.ts:15`) includes `.cloudfront.net`, and **anyone can create a CloudFront distribution**. So the attack is: point the proxy at your own `*.cloudfront.net` host, which 302-redirects to `mysql.railway.internal:3306` or a cloud metadata endpoint. Per CLAUDE.md, `DATABASE_URL` reaches MySQL over exactly that private network. There is also no response size cap and no timeout.

The careful SSRF work in `urlValidator.ts` — private-IP ranges, blocked hostnames, no bare IPs, exact-host R2 matching — is all bypassed, because it only ever inspects the first URL.

**Why this one shouldn't wait.** It is the only critical finding that needs no account, so the invite gate gives no protection. The fix is confined to two files that R7 does not touch, and the proxy is used from exactly one place in the client (`client/src/features/boards/canvas/imageActions.ts:12`, a logged-in canvas feature), so requiring auth breaks nothing.

**Fix.** Set `redirect: "manual"` and re-validate any redirect target through `validateProxyUrl` (or refuse redirects outright); add a size cap and timeout; require authentication and a per-user rate limit; drop `.cloudfront.net` and `.manuscdn.com` from the allowlist. That last item is coupled to legacy data — CLAUDE.md notes old DB records still reference those hosts pending `scripts/migrate-storage-urls.ts`, so **confirm current production data before removing them**. Requiring auth plus redirect re-validation closes the hole even if the allowlist entries have to stay for now.

### H1 — All IP-based rate limiting is bypassable · HIGH · **IMPLEMENTED LOCALLY 2026-07-25 — pending deployment**

**Current local status.** Fixed in `6d23000`. Express configures Railway's one trusted proxy hop before middleware and routes, and `getClientIp` uses only Express `req.ip`. A real Express regression test proves a spoofed leftmost `X-Forwarded-For` value cannot select a fresh rate-limit identity.

`getClientIp` (`server/security/rateLimit.ts:81`) trusts `X-Forwarded-For` unconditionally, and `app.set("trust proxy")` is never called anywhere in the codebase. Rotating a header value yields a fresh rate-limit bucket on every request, defeating login (10 per 15 min), register (5 per 15 min), and invite-code validation limits. Credential stuffing and invite-code brute force are effectively unmetered — and both are reachable without an account.

**Fix.** `app.set("trust proxy", 1)` in `server/_core/index.ts`, and rewrite `getClientIp` to prefer `req.ip`, taking the *rightmost* untrusted XFF entry rather than the leftmost. Small and isolated; worth taking early because it is what makes every other rate limit real.

### H2 — IP blocking is dead code · HIGH · Post-R7

`isIpBlocked` (`server/db/ipBlocking.ts:19`) is exported through `server/db/index.ts` and **never called by any middleware or route**. An admin blocks an address, an audit event is written, Slack is notified — and the address is not stopped. This is worse than not having the feature, because in an incident someone will block an IP and believe the problem is contained.

**Founder asked for both options recorded rather than a decision:**
- *Make it work:* add an Express middleware ahead of the routers that checks the block list, with a short in-memory cache so it costs no meaningful per-request latency. Keeps the existing admin tooling and makes it honest.
- *Remove it:* delete the blocking controls from the admin screen so nothing implies protection that doesn't exist. Less code, but no way to shut out an abusive address before launch.

Recommendation: make it work — it is a modest change and the tool is worth having at launch. Either way, **do not leave it as-is**.

### H3 — Admin allowlist is inert in production · HIGH · Post-R7, before launch

`ADMIN_ALLOWLIST` (`server/security/adminSecurity.ts:29`) is built from `OWNER_OPEN_ID` and `OWNER_NAME`, both optional env vars. When the list is empty, `isOnAdminAllowlist` returns `true` for everyone (`:41`). Per CLAUDE.md these are not set in production, so the advertised "role AND allowlist" defence-in-depth is really just "role" — one stray `UPDATE users SET role='admin'` is a full compromise, exactly the scenario the allowlist was written to survive.

**Fix.** Fail **closed**: when the allowlist is empty, deny admin access and log loudly at boot. Set `OWNER_OPEN_ID` in Railway as part of the change, or production admin access will break.

### H4 — The Slack admin-approval control does not exist · HIGH · Post-R7, before launch

`server/security/adminSecurity.ts:196-204` documents the security model as: *"Sensitive actions now require approval via Slack before execution, ensuring an attacker needs access to both the admin session AND the Slack workspace."* That is not what the code does, for two independent reasons.

**First, the approval flow auto-approves itself when Slack is absent.** `sendApprovalToSlack` (`server/slack/slackApproval.ts:280-287`):

```ts
if (!webhookUrl) {
  log.info("[SlackApproval] Admin-actions webhook not configured, auto-approving action");
  action.status = "approved";                       // ← fails OPEN
  action.resolvedBy = "system (Slack not configured)";
```

Slack is not currently configured, so every request through this path is approved instantly by the server itself. The out-of-band second factor approves on behalf of the absent second factor.

**Second, and more important, the approval flow is not in the path anyway.** `admin/users.ts` exposes `suspendUser` (`:13`), `unsuspendUser` (`:85`), and `adjustCredits` (`:350`) as ordinary `adminProcedure` mutations that execute immediately — `suspendUser` calls the db function directly at `:37` and only *then* calls `logAdminAction`. The Slack approval router (`server/routes/admin/slackApproval.ts`) is a **parallel, optional** route, not a gate. An admin session alone is sufficient for every sensitive action, whatever Slack's state.

So the compensating control that `adminSecurity.ts` relies on to justify a single-factor admin session is absent, which compounds H3 (the allowlist is also inert). Net effect: admin authority rests entirely on one session cookie with a 30-day life and no revocation (M3).

**Options — founder decision, both recorded:**
- *Make it real:* route the sensitive mutations through the pending-action gate, and change the unconfigured branch to fail **closed** (refuse, don't auto-approve).
- *Remove it:* delete the approval flow and correct the `adminSecurity.ts` comment. Defensible for a solo-founder product where the only admin is the founder — but then H3 and M3 become the sole admin protections and should be fixed properly.

Whichever is chosen, **the current state — documentation describing a control that isn't there — is the one option to rule out.** This is the same failure mode as H2.

### H5 — Credit-purchase velocity limits are not enforced · HIGH · Post-R7, before launch

*(Found 2026-07-25 during documentation cleanup, not in the original sweep.)*

`docs/SECURITY_OVERVIEW.md` documents specific anti-fraud caps on credit top-ups — 3 per hour, 10 per 24 hours, and roughly $500 of spend per 24 hours — and states that exceeding them blocks the purchase and raises a Slack alert. None of that happens.

The parts exist. `getRecentTopupCount` and `getTopupCreditsTotal` (`server/db/moderatorQueries.ts:344-390`) compute exactly these figures, and `SlackAlerts.velocityLimitHit` (`server/slack/slackNotification.ts:631`) is written and ready. But **nothing calls them.** Outside `server/db/index.ts`, which merely re-exports, there is no call site anywhere in the server, and `server/routes/billing.ts` contains no velocity check at all. The stated purpose — *"to prevent fraud from stolen cards"* — is unmet.

This is the fourth control in this codebase with helpers written, documentation published, and no invocation, alongside H2, H3, and H4. It is listed separately because the others protect the admin surface, whereas this one protects money: a stolen card can be run through checkout without any application-side rate limit, which is a chargeback-cost and processor-standing risk, not just a security one.

Note the July 2026 audit recorded "Credit purchase velocity limits — MISSING" as a high-priority item. The helpers and the alert were subsequently built and documented as delivered; the enforcement was not.

**Fix.** Call the two helpers in the checkout path in `server/routes/billing.ts` before creating a Stripe Checkout session, refuse over the cap with `TOO_MANY_REQUESTS`, and fire `velocityLimitHit`. The logic already exists — this is wiring, not new work. If Slack stays disconnected, the refusal must still happen; only the alert is optional.

### H6 — The public registry discloses complete cast recipes, and nothing uses it · HIGH · **IMPLEMENTED LOCALLY 2026-07-25 — pending deployment**

**Current local status.** Fixed in `cc45ba7`, with residue cleanup in `2e25674`. `server/routes/registry.ts` and its root-router namespace are deleted; the agency-id DB helper, public projection, duplicate snapshot-parity consumer, manual drive leg, and registry-framed tests are gone. Runtime and source-absence tests prevent silent restoration. The PDF provenance copy no longer promises a registry that does not exist.

*(Raised from L1 on 2026-07-25 after checking what the endpoint actually returns. The original entry treated it only as an unmetered endpoint.)*

`registry.lookup` (`server/routes/registry.ts:15`) is a `publicProcedure` — no authentication. Given a cast's `agencyId` it returns, on both the legacy and the R7 snapshot path (`projectEffectiveRegistryBundle`, `server/casting/modelReadProjections.ts:63-78`):

`agencyId`, `name`, **`masterPrompt`**, **`technicalSchema`**, **`preferences`**, `mintedAt`, and every asset `storageUrl`.

The comment describes this as a "public identity bundle (no internal IDs or user info)", which is true as far as it goes — no user row leaks. But the master prompt, technical schema and preferences together are the *complete recipe* for regenerating that model. For a product whose value is the cast a customer developed, that is the customer's work product, handed to anyone who asks.

**Three things make it worse than an ordinary public read:**

1. **No rate limit** on either `lookup` or `verify`. IDs are `MOD-DD-XXXXXX` — two digits plus six hex characters, so about 16.7 million per two-digit prefix, and the prefix appears to be a small counter or year. Unmetered, that space is sweepable in days, which turns "needs the ID" into "harvest every minted cast in the system".
2. **`verify` is a free oracle** for that sweep: it confirms whether an ID exists and is minted without returning the payload, so an attacker separates discovery from retrieval cheaply.
3. **`agencyId` is surfaced to users** in `CastProfilePanel.tsx`, `ModelGallery.tsx`, `NodeInfoPanel.tsx`, and `useExportPack.ts`. Anything a customer exports or shares that carries the ID effectively publishes their prompt to whoever receives it — a consequence no one is told about.

**Nothing in the product calls it.** There are zero references to `registry.lookup` or `registry.verify` anywhere in `client/` or elsewhere in `server/`. It was built for "cross-app model retrieval" in the Manus era and is dormant.

**Fix.** Because there is no consumer, this is close to free and should ride along with C2 and H1 during R7. Preferred: delete both procedures. If the capability is wanted later, reinstate it deliberately — as an opt-in per cast, returning presentation fields only (`name`, `mintedAt`, maybe a single image) and never `masterPrompt`, `technicalSchema` or `preferences`, with a rate limit. Interim if deletion feels premature: change `publicProcedure` to `protectedProcedure` and add a rate limit; that removes anonymous access in one line each.

**Founder ruling, 2026-07-25:** *"If a marketing team or content creator comes on the platform and makes a model that's theirs, no one should be able to steal or copy that work."* A public registry is therefore **not** a wanted feature. Delete both procedures. This ruling also governs M7 below.

### M7 — A cast's images are protected only by the URL being hard to guess · MEDIUM · **OPTION 1 IMPLEMENTED LOCALLY; authenticated delivery still open**

*(Raised 2026-07-25 following the founder ruling on H6. Not a defect — a deliberate design whose consequences should be an explicit choice.)*

Every generated image is stored at a **permanently public, unauthenticated R2 URL**. This is intentional and documented (`server/storage.ts:5`): URLs are persisted into database records and served indefinitely, so presigned expiring URLs would break stored content. The bucket is public; there is no login between a URL and the image.

Measured against the ruling above, this means a customer's casts are guarded by URL obscurity alone. Anyone who ever obtains a URL keeps access **permanently and unrevocably** — through a shared export pack, a support ticket, a screenshot of dev tools, browser history on a shared machine, or a link pasted into any third-party tool. Deleting the cast does revoke it, because R7-5 deletes the underlying object, but nothing short of that will.

At the audit baseline, Casting and Wardrobe keys used short `Math.random()` suffixes. That weakness is fixed locally in `2e25674`: all ten key-construction sites across the six current server `storagePut` writers use `node:crypto` `randomUUID()`. A recursive inventory test fails if a new writer appears without review or if any storage-writer file reintroduces `Math.random()`. Existing objects are unchanged and need no migration.

**Options, cheapest first.**
1. **Make keys genuinely unguessable — implemented locally in `2e25674`.** New keys use `crypto.randomUUID()`, removing the PRNG weakness and making the URL a real capability token. This does not change the "whoever has the link has it forever" property.
2. **Serve images through an authenticated route**, keeping objects private in R2. Matches the ruling properly, but URLs are persisted in DB records across casts, boards, wardrobe and export packs, so this is a migration, not a patch.
3. **Accept it and say so** — treat unlisted URLs as the security model and make that explicit in customer-facing terms, so nobody believes their cast images are private when they are unlisted.

Option 1 is complete on local `main`. Option 2 versus 3 remains a founder decision that must be taken before launch, because it determines what can honestly be promised to a marketing team about their work.

### M8 — The approval gate is enforced at login but not on the API · MEDIUM · Post-R7, before launch

*(Found 2026-07-25 while writing the access-control section of `CLAUDE.md` — by attempting to verify a claim rather than asserting it. Worth noting as the process working.)*

`requireUser` (`server/_core/trpc.ts:32-64`), which backs every `protectedProcedure`, checks `suspendedAt` and `lockedUntil`. It **does not check `approved`**. The only approval checks in the codebase are at the two login entry points: `server/routes/emailAuth.ts:317` and `server/routes/googleAuth.ts:193`.

But login is not the only way to obtain a session. `/api/auth/verify-email` (`server/routes/emailVerification.ts:349-355`) marks the email verified, **issues a session cookie with no approval check**, and redirects to `/app`. So a user who is signed in but unapproved holds a fully privileged session and can call every protected procedure — generation, board writes, billing — because approval is never consulted again.

The design plainly contemplates that state: `access.redeem` is a `protectedProcedure` (you must be signed in to enter your code) and `access.status` exists to tell the client whether to show the code screen. The beta gate is therefore enforced by the login screens and by the UI, not by the API.

**How reachable.** Narrow but real. `redeemInviteCode` approves the user atomically on success, so the normal path ends approved. The gap opens when a user row exists unapproved and then verifies email — for example when a code passes `validateInviteCode` but fails at `redeemInviteCode` because it hit its usage limit in between, an edge case `emailAuth.ts:132-137` explicitly handles by returning 400 *after the user row has already been created*. It also means revoking a user's approval does not actually cut off their access.

**Fix.** Add the approval check to `requireUser` alongside the suspension and lockout checks, exempting the procedures an unapproved user legitimately needs — `access.redeem`, `access.status`, `auth.me`, `auth.logout`. Cleanest shape is to keep `protectedProcedure` as the approved-user procedure and add a separate `pendingApprovalProcedure` for that small set, so the default is closed.

**Wider point.** The claim "unapproved users cannot generate" was true of the UI and of both login screens, and false of the API — which is the same failure mode as H2 through H5: a rule that exists everywhere except the place that enforces it. It was caught only because writing the access-control matrix required checking each cell against code instead of restating intent.

### M1 — Session cookie disables the browser's CSRF protection · MEDIUM · Post-R7

`sameSite: "none"` whenever the request is HTTPS (`server/_core/cookies.ts:45`) — i.e. always in production — and there is no CSRF token or `Origin`/`Sec-Fetch-Site` check anywhere in the app.

`/api/auth/login` and `/api/auth/register` are directly forgeable, since `express.urlencoded` is registered globally and a cross-site form POST needs no preflight. The realistic attack is login-CSRF: silently sign a victim into an attacker-controlled account so the victim's subsequent work lands there. tRPC mutations are *incidentally* hard to forge — the superjson envelope shape plus zod's numeric types reject urlencoded bodies — but that is luck, not design, and a procedure taking only string inputs would be exploitable.

**Fix.** `sameSite: "lax"`. The app serves client and API from one origin and sets `frame-ancestors 'none'` in production, so `"none"` is a leftover from the dead Manus preview-iframe era. Lax still permits the Google OAuth top-level GET callback to set the cookie, so nothing breaks. Verify no intentional cross-site embed survives (per CLAUDE.md the Manus iframe is gone — this is a verification, not a decision). Add an `Origin` check on the plain Express auth routes as belt-and-braces.

### M2 — Upload size cap and storage quota are set by the client · MEDIUM · Post-R7

`profile.uploadAvatar` and `uploadBanner` (`server/routes/profile.ts:61, 122`) enforce the 5MB/10MB cap **and** all storage-quota accounting from `input.fileSize` — a client-supplied number never compared against the decoded `base64Data` buffer. Send `fileSize: 1` with a 14MB payload (under the 15MB body limit) and both the cap and the quota are bypassed. The delete path compounds the drift by subtracting a hardcoded ~100KB estimate (`:106`) rather than the real size.

There is also no magic-byte check that the bytes match the declared MIME type, so arbitrary content can be parked in the public R2 bucket under Drape's URL. Lower risk given the bucket is a separate origin and content-type is forced, but it is brand-abuse surface.

**Fix.** Derive size from `buffer.length`; drop `fileSize` from the input schema. Add a magic-byte check. Record real sizes for quota accounting. Note `wardrobe.upload` (`server/routes/wardrobe.ts:109`) already does this correctly — it caps the base64 string itself and derives the buffer.

### M3 — Sessions cannot be revoked · MEDIUM · Post-R7

30-day JWTs (`shared/const.ts:2`) with no server-side session store. `auth.logout` (`server/routes/auth.ts:10`) only clears the cookie, so a captured token stays valid for its full life regardless. Suspension *is* checked against the DB on every request (`server/_core/trpc.ts:40`), which meaningfully limits the blast radius — but "log out everywhere" and "invalidate on password change" do not exist.

**Fix (post-launch acceptable).** Add a `sessionVersion` integer on `users`, embed it in the JWT, and compare on verify. Bumping the column invalidates every existing token for that user. Cheaper than a session table and reuses the DB read already happening in `authenticateRequest`.

### M4 — Most input schemas accept unknown fields · MEDIUM · Post-R7 (convention)

Only **36 of 210** `z.object(` schemas in `server/routes` use `.strict()`. Unknown keys are silently dropped rather than rejected, so a typo'd, renamed, or injected field fails open and silently — the client believes it sent something the server never applied.

**Fix.** Do **not** convert all 210 mid-R7; that churn would collide with active casting work for little marginal safety. Instead: apply `.strict()` now to all *public* and all *auth/billing* schemas, make it the documented default in `CLAUDE.md`, and require it on new code. Directly addresses founder ask #2.

### M5 — The `VITE_APP_ID` isolation claimed in CLAUDE.md does not exist · MEDIUM · Post-R7 (docs or code)

`verifySession` (`server/_core/sdk.ts:88`) checks that `appId` is a non-empty string but **never compares it to `ENV.appId`**. CLAUDE.md states dev and prod use distinct `VITE_APP_ID` values so "dev sessions can't be replayed against prod" — that protection comes entirely from the differing `JWT_SECRET`, not from `appId`. The control is real; the stated reason for it is not.

**Fix.** Either enforce `appId === ENV.appId` (one line, closes the gap if a secret is ever shared between environments) or correct the CLAUDE.md claim. Enforcing is better — the docs are currently a trap for a future reader.

### Low severity

- **L1 — Unmetered public endpoints:** `/api/hero/*`, `announcements.getActive`, `/api/auth/verify-email`. Add generous IP-based limits. *(`/api/image-proxy` is now authenticated and per-user limited on local `main`; `registry.lookup` and `registry.verify` were promoted to H6 and then deleted.)*
- **L2 — Rate limiting is in-memory** (`server/security/rateLimit.ts:14`): per-process, reset on every redeploy, and will not survive horizontal scaling. **Acceptable pre-launch on a single Railway process** — document the limitation rather than adding Redis now. Revisit if you scale to more than one instance.
- **L3 — Google OAuth ignores `email_verified`.** `server/routes/googleAuth.ts:144` reads the ID-token payload but never checks `payload.email_verified` before matching an existing account by email. Add the check; it is one line and closes a known account-linking attack class.
- **L4 — Dependency CVEs.** `pnpm audit` flags `tar` (via `@tailwindcss/oxide`), `rollup` (via `vite`), and `fast-xml-parser` (via `@aws-sdk/client-s3`). Only **`fast-xml-parser` is reachable at runtime**; the other two are build-time only. Patch that one; schedule the rest.

---

## Reconciliation with the previous audit (July 2026)

`docs/archive/security-audit.md` is a prior security review from 2026-07-09, in the Manus era. Most of its recommendations were acted on: HSTS and CSP headers now exist, the chargeback webhook was added, Stripe webhook idempotency was implemented, sessions dropped from one year to 30 days, account deletion shipped, and `@trpc/server` is now `^11.9.0` (past the 11.8.0 prototype-pollution fix), with `qs` pinned via override.

**But it marked as PASS five things this audit found broken**, and the reason is consistent every time — it read declarations rather than tracing execution:

| Prior verdict | Actual state |
|---|---|
| "HttpOnly, Secure, SameSite cookies — **PASS** … `sameSite: "none"`" | Quoted the value that *is* the problem (M1) |
| "Admin allowlist (hardcoded) — **PASS** … Already marked in checklist" | Never verified it functions; it permits everyone when empty (H3) |
| "Re-auth for sensitive actions — **PASS** … Slack out-of-band approval" | Repeated the code comment; the flow isn't in the request path and self-approves (H4) |
| "File upload restrictions — **PASS** … Avatar: 5MB … validated server-side via Zod" | The Zod limit is on a client-supplied `fileSize` field, not the payload (M2) |
| "Input validation — **PASS** … 277+ Zod validations" | Counted schemas; 83% accept unknown fields (M4) |
| "Rate limiting on API/auth routes — **PASS** … sliding window" | Never checked that the IP key is attacker-controlled (H1) |

This is the founder's thesis demonstrated on Drape's own history: the defects survived a security audit because the audit confirmed that a control was *written*, not that it *runs*. It is the strongest available argument for Part 2 of the access-control matrix (enforcement invariants) over Part 1 (the capability grid) — a grid would have produced the same PASSes.

### Live documentation asserts controls that do not run

A second prior audit exists — `docs/archive/SECURITY_AUDIT.md`, dated 2026-02-06 — which states *"Data scoping by userId — **PASS** — All user queries scoped by `ctx.user.id`; ownership verified before mutations."* That is the precise claim C1 disproves. Both prior audits also passed the admin allowlist, the Slack re-auth flow, and `sameSite: "none"`.

More consequential than the archives, because a future agent will read them as current truth:

- `docs/ADMIN_SECURITY.md:17` — *"Even if an attacker gains database access and changes a user's role to `admin`, they won't have admin privileges unless they're on the allowlist."* This is the exact scenario H3 shows is unprotected: the allowlist admits everyone when empty, and it is empty in production. The document also points at `server/adminSecurity.ts`, which has since moved to `server/security/adminSecurity.ts`.
- `docs/todo.md:2596` — `[x] Update sensitive admin procedures to require Slack approval (suspendUser, unsuspendUser, adjustCredits, blockIP, unblockIP)`. Marked complete; those procedures execute directly (H4).
- `docs/todo.md:2539` — `[x] Add IP blocking check to rate limiter middleware`. Marked complete; no such check exists (H2).
- `docs/RATE_LIMITING.md:413` onward documents IP blocking as operational.

- `docs/SECURITY_OVERVIEW.md` documented credit-purchase velocity limits with specific numbers as active fraud protection. They are not enforced (H5).

**Four** security controls were checked off as delivered without ever being wired into a request path, and two live documents make specific guarantees that do not hold. Correcting these is part of the remediation, not housekeeping — the false documentation is what caused two subsequent audits to pass the same broken controls, and would cause a third.

**The pattern is the actual finding.** In every case the same thing happened: the helper was written, the documentation was written, the todo was ticked, and the one line that invokes the helper on a request path was never added. Nothing in the codebase distinguishes a control that runs from one that merely exists, so each was reasonably believed done. H5 was found by accident while deleting a document — which strongly suggests the remaining count is not four. Any control not covered by a test that proves it *blocks* something should be treated as unverified until checked.

**Still open from that audit, not re-examined here:**
- `past_due` subscribers can still spend credits already in their balance. Confirmed still true: `past_due` is written by `server/stripe/webhooks.ts:359` and read by no gate anywhere. Impact is bounded — Stripe's final failure cancels and downgrades to free — so this is the retry window only, and may be intentional. Worth a deliberate decision rather than drift.
- No error tracking (Sentry or equivalent); no credit-purchase velocity limit; Stripe Radar not configured; no signup-velocity or free-tier abuse controls; still no application-level CORS middleware.

## The founder's four asks

**1. Rate limiting on all public endpoints (IP + user, graceful 429, without punishing logged-out users).**
The helpers already exist and coverage on generation endpoints is good. Three gaps: (a) H1 makes every IP limit bypassable and should be fixed first, or the rest is theatre; (b) the endpoints in L1 have none; (c) **the 429 is not graceful and not consistent** — several call sites return `{ valid: false, error: "Too many attempts" }` in a 200 body (e.g. `server/routes/access.ts:36`, `:61`), which the client cannot distinguish from a validation failure. Standardise on a real `TOO_MANY_REQUESTS` with `Retry-After`. On not over-restricting the logged-out: keep public limits deliberately generous (per-IP, minutes not hours) and reserve the tight per-user limits for paid/expensive operations, which is roughly the existing shape.

**2. Strict input validation.** See M4. Schema-based validation via zod is already universal and length limits are generally present; the gap is specifically `.strict()` (rejecting unexpected fields) at 17% coverage.

**3. Secure API key handling.** Already correct — see "Verified healthy". No provider credential reaches the browser; all Gemini/Stripe/R2 calls are server-side. No change needed. The one adjacent note: R2 served URLs are deliberately public and non-expiring by design (`server/storage.ts:5`), which is a correct trade for durably-stored image records but does mean anyone with a URL can read that object forever.

**4. Access-control matrix in CLAUDE.md.** Drafted below.

---

## Draft: access-control matrix for CLAUDE.md

The founder's diagnosis is correct and C1 is the proof — every one of those four routers "knew" the user had to own the board; what was missing was **where the check must live**. A bare capability grid would not have prevented any of them. So the section has two parts, and the second is the one with teeth.

### Part 1 — capability grid

Rows = resource families: models/casts, boards, wardrobe, credits/billing, admin, moderator, registry, public proxies.
Columns = anonymous, authenticated-unapproved, authenticated-approved, moderator, admin.
Cells use one fixed vocabulary: `none / read-own / read-any / write-own / write-any / delete-own / delete-any`.

Sketch (to be completed and confirmed during implementation):

| Resource | Anonymous | Auth-unapproved | Auth-approved | Moderator | Admin |
|---|---|---|---|---|---|
| Models/casts | none | none | read/write/delete-own | read-any | read-any |
| Boards + items/edges | none | none | read/write/delete-own | none | read-any |
| Wardrobe | none | none | read/write/delete-own | none | read-any |
| Credits/billing | plans only | none | read-own, checkout-own | none | adjust-any (Slack-approved) |
| Registry (minted) | read-any (public by design) | read-any | read-any | read-any | read-any |
| Audit logs | none | none | none | read-any | read-any |
| Admin actions | none | none | none | none | write-any |

### Part 2 — enforcement invariants

1. Every tenant-scoped read or write is scoped by owner **in the durable query**, not only in a router guard (D-64, `DECISION_LOG.md:669`).
2. Child resources — board items, edges, versions, evidence candidates — re-anchor to the owned parent **in the same `WHERE` clause**, not via a preceding `SELECT`.
3. `userId` for scoping, spend, and rate limiting always comes from `ctx.user.id` — **never** from procedure input.
4. Approval gate: authenticated-unapproved can log in and redeem an access code, nothing else. No generation, no board writes, no billing.
5. Public endpoints are an **explicitly enumerated allowlist**. Each must be rate-limited, `.strict()`-validated, and structurally incapable of mutating another user's data.
6. All input schemas are `.strict()` by default.
7. Moderator = read-only across audit/user activity plus escalation; Admin = mutating actions, with sensitive ones requiring out-of-band Slack approval.

Target length: one screen. The test of success is that a future agent can answer *"can an approved user delete another user's board item, and where exactly is that enforced?"* from the table alone.

---

## Suggested sequencing

| Phase | Items | When |
|---|---|---|
| 0 | C1, C2, H1, H6, M7 option 1 | Implemented and committed on local `main`; push/deploy and production verification remain separate |
| 1 | H3 (allowlist fails closed), H5 (wire up velocity limits), H2 (IP blocking decision), H4 (Slack approval decision) | Immediately post-R7 |
| 2 | M1 (sameSite), M2 (upload sizes), M5 (appId), L3, L4 | Post-R7 |
| 3 | Access-control matrix in CLAUDE.md, `.strict()` on public/auth/billing schemas, consistent 429s | Post-R7, alongside phase 2 |
| 4 | M3 (session revocation), L1/L2 rate-limit coverage | Before public launch |

---

## Documentation consolidation (completed 2026-07-25)

Goal: one current security document, and nothing left in the tree asserting a protection the code does not provide. Done in this pass:

- **This document** placed at `docs/specs/SECURITY_AUDIT_2026-07-25.md` as the single current security reference.
- **Deleted** `docs/archive/SECURITY_AUDIT.md` and `docs/archive/security-audit.md`. Both were tracked in git and remain recoverable from history; their material claims are quoted in the reconciliation section above.
- **Deleted** `docs/ADMIN_SECURITY.md` in full — its central guarantee (that the allowlist stops a database-level role change) is false, and the rest of the file documents the Slack approval flow that H4 shows is not in the request path.
- **Removed** the IP Blocking section from `docs/RATE_LIMITING.md`, including the "Automatic IP Checking" subsection describing enforcement that does not happen. The rest of that file describes rate limiting accurately and was left intact.
- **Corrected** `docs/SECURITY_OVERVIEW.md`: dropped the deleted guide from its index and removed the "user data is scoped by userId in all queries" claim, which C1 disproves.
- **Appended a dated correction** to `docs/todo.md` rather than editing entries. It is a historical work log; deleting lines rewrites history instead of correcting it.
- **Added** the access-control section to `CLAUDE.md` — the capability grid plus, more importantly, the enforcement invariants, since those are what would have prevented C1.

**Deliberately left alone:** `casting-audit.md` at the repo root. It is an untracked stray, but it is a casting *architecture* audit for board integration, not a security document, and may still be relevant to R7. Delete it separately if it is superseded by the `docs/specs/CASTING_SYSTEM_AUDIT*.md` set.

**Not reviewed:** `docs/NOTIFICATIONS.md`, `docs/AUTHENTICATION.md`, and `docs/BILLING_ALERTS.md` are referenced from the security index and may carry the same overstated claims. Worth a pass when the H2/H3/H4 fixes land.

This consolidation is prepared as a separate documentation-only slice; code fixes and production rollout remain independently reviewed operations.

## Verification approach (when fixes are executed)

- `pnpm check` and `pnpm test` after each phase.
- **Per IDOR fix:** a regression test that, as user B, calls each of the four procedures with user A's ids and asserts `NOT_FOUND`/`FORBIDDEN` **and** that A's rows are unchanged. These four tests are the durable value of C1.
- **SSRF:** unit-test `validateProxyUrl` against a redirect chain; assert the redirect target is re-validated and the size cap trips.
- **Rate limiting:** assert a spoofed `X-Forwarded-For` no longer yields a fresh bucket.
- **End-to-end** via the `verify` skill (headless Edge + minted session cookie): log in, create a board, drag items, delete, undo, and run one casting generation — confirming the ownership changes did not break the owner's own path.
- All testing local against the dev database. **Nothing in this plan touches production**; the Railway CLI in this repo targets production, so avoid it entirely for this work.

---

## Open decisions

Still to be settled by the founder; none block the R7 work.

1. **Authenticated image delivery (M7)** — move generated images behind authentication with a migration, or explicitly accept permanent unlisted URLs as the product model.
2. **The SSRF allowlist** — can `.cloudfront.net` and `.manuscdn.com` come out now, or is `scripts/migrate-storage-urls.ts` still pending against production data? Authentication and redirect refusal close C2 either way, so this is not urgent.
3. **IP blocking (H2)** — implement enforcement, or remove the admin controls. Recommendation is to implement; the one option to rule out is leaving it as-is.
4. **Slack approval (H4)** — make it real and fail closed, or delete it. Recommendation is to delete, given a single admin, and to strengthen H3 and M3 instead.
5. **`past_due` credit spending** — bounded to Stripe's retry window and possibly intentional; worth a deliberate decision rather than drift.

**A note on assurance.** An independent review of this audit was attempted and could not be completed. Every finding was verified against the source by its author, and two claims raised during review were checked and disproved, but nothing here has been confirmed by a second reviewer. The "Verified healthy" section carries the most risk from that, because a mistake there produces no entry on any fix list. Re-check it before relying on it at launch.

---

## Second-pass findings — 2026-07-25, verification of the CLAUDE.md access-control section

A cell-by-cell verification of the capability grid against the code (performed while reviewing the new CLAUDE.md section) partially closed the moderator/admin coverage gap declared above and produced the findings below. Every original finding re-checked in that pass (H2, H3, H4, H5, M8, C1, H6, and the four C1 sites) was confirmed accurate as written. These are additions, not corrections. CLAUDE.md's grid, "Currently not enforced" list, and enforcement invariants (new rules 8 and 9) were updated the same day to reflect them.

### M9 — Moderator surface returns customers' generated images · MEDIUM · Post-R7, before launch

`moderator.getUserGenerationHistory` and `moderatorExports.exportUserGenerationHistoryCsv` return `resultUrl` — the generated image on its permanent public R2 URL — for any user's generations (`server/db/moderatorQueries.ts:253`, `server/routes/moderatorExports.ts:139`). This violates the "metadata only" staff boundary in CLAUDE.md: combined with M7, a moderator who exports a CSV retains image access permanently and unrevocably. Admins inherit the same surface via `moderatorProcedure`. The prompt bundle does **not** leak — the `masterPrompt` matches in these files are generation-*type* enum labels, and deletion-audit metadata is actively scrubbed of the sensitive keys (`server/casting/deletionAudit.ts:239`). Also note the same query returns the raw `generations.metadata` JSON — today only operational fields (viewType, mintTier, operationMode), but it is an open channel to moderators for anything future code writes there.

**Fix.** Drop `resultUrl` (and raw `metadata`) from the moderator projection and CSV, or replace with a boolean `hasResult`. Whether staff ever need image access for abuse review is a founder decision; the default per the 2026-07-25 ruling is no.

### M10 — `auth.me` serves the full users row, including `passwordHash` · MEDIUM · **WORKING-TREE FIX EXISTS; NOT YET REVIEWED OR COMMITTED**

`auth.me` returns `ctx.user` verbatim in committed code, and `ctx.user` is a full `SELECT *` row (`server/db/users.ts:116`) — so every session check ships the user's own bcrypt hash to the browser. Self-only (no cross-user exposure), but a free offline-cracking target in any logged, cached, or intercepted response. An unstaged working-tree change in `server/routes/auth.ts` strips `passwordHash`, but it must not be treated as delivered until separately reviewed and committed. The moderator/admin user queries were checked and are safe — they use explicit column projections (`server/db/admin.ts:46,165`). Root cause is the bare-`select()`-to-serializer pattern; CLAUDE.md invariant 8 forbids it.

### M11 — The "immutable audit log" provides no tamper evidence · MEDIUM · Post-R7, with the H4 decision

`writeImmutableLog` (`server/security/adminSecurity.ts:237`) *is* invoked — it passes a call-site check — but the hash chain lives in process memory and resets to `GENESIS` on every deploy, and its "permanent Slack backup" silently no-ops while Slack is unconfigured. Net: critical admin actions currently have ordinary mutable DB rows and nothing else. A nastier variant of the H2–H5 pattern: invoked but inert under the current configuration, which invariant 7's call-site test does not catch. Resolve alongside H4 — either give it a durable store or delete it and stop claiming immutability.

### Low severity additions

- **L5 — `checkUserRateLimit` — resolved locally by C2.** The audit baseline found it exported and unused. Commit `6d23000` now invokes it from `server/routes/imageProxy.ts` for the authenticated per-user image-proxy limit; it is no longer dead code.
- **L6 — The admin allowlist can never match on `OWNER_NAME`.** `isOnAdminAllowlist` compares entries against user id, openId, and email — a name never matches any of them, so half of the allowlist's two possible entries is inert even when set. Moot if H3's fail-closed fix lands, but worth knowing if the allowlist is kept.

### Grid corrections recorded (not defects)

- Moderators have deliberate read-any access to credit transactions and balances (support/complaint investigation) — the draft grid's "none" was wrong in the restrictive direction and has been corrected in CLAUDE.md, so a future agent doesn't "fix" intended access away.
- Admins have **no** per-record board or wardrobe access at all (aggregate KPIs only, `server/routes/admin/overview.ts`); the draft grid's "read-any" overstated it.
