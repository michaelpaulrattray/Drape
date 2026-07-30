# CLAUDE.md

Drape — AI fashion studio: cast AI models (Gemini image generation), digitize garments, run virtual try-on (wardrobe/VTO), and iterate on an infinite canvas (boards). Originally scaffolded on the Manus WebDev platform; all Manus platform code has since been removed (see "Manus legacy" below for the one intentional remnant).

## Project context

Drape is a commercial product heading for public launch. Billing, credits, and auth code are production-critical — treat changes there conservatively.

Design taste: restrained, editorial, monochrome. Prefer simple, human-feeling solutions over clever or busy ones; avoid generic templated UI patterns. When in doubt on design decisions, less is more.

## Advisor protocol

This protocol applies only to the top-level primary executor. The advisor and other subagents never invoke or spawn another advisor.

Determine eligibility from the top-level primary model:

- **Opus primary:** use the proactive advisor protocol below.
- **Fable primary** (`fable` or `claude-fable-5`): do not invoke the advisor through the routine protocol; the executor is already using the advisor model. Perform the same architecture and risk review directly as a self-review. Invoke a separate advisor only if the user explicitly requests an additional advisor/Fable review in the current task.
- **Any other primary model:** invoke the advisor only when the user explicitly requests an advisor/Fable review in the current task.
- **Unknown primary model:** treat it as “other” and do not invoke automatically.

For an eligible Opus primary, call the read-only `advisor` BEFORE substantive work — before writing code or committing to an interpretation on a non-trivial task. Orientation (reading files, grep) is not substantive work; do that first, then consult. Also call it when stuck (recurring errors or a non-converging approach) and before declaring a milestone chunk complete. Give its advice serious weight; if evidence contradicts it, surface the conflict in one more consult rather than silently switching. When it flags a founder ruling, stop and ask rather than deciding.

For coding under an eligible Opus primary: milestone plans and DECISION_LOG rulings are pre-made judgment, so executing them needs no consult. Consult when the plan leaves implementation shape open and the choice is architectural, after the FIRST failed fix attempt on any bug (not the third), and as a brief review before reporting a milestone chunk complete.

## Commands

- `pnpm dev` — start dev server (Express + Vite middleware, single process on http://localhost:3000; auto-increments port if busy)
- `pnpm check` — TypeScript typecheck (no emit)
- `pnpm test` — vitest run (server unit tests; green out of the box — env-dependent suites skip with a console message)
- `pnpm test:integration` — HTTP tests against a live server (`server/**/*.integration.test.ts`); start `pnpm dev` first
- `pnpm build` — vite build (client → `dist/public`) + esbuild (server → `dist`)
- `pnpm db:push` — drizzle-kit generate + migrate (needs `DATABASE_URL`)
- `pnpm architecture:generate` — regenerate the Drape Atlas (`docs/architecture/`)
- `pnpm architecture:check` — verify the Atlas is fresh, schema-valid and deterministic (also runs inside `pnpm test`)
- `npx tsx seed.ts` — dev helper: marks every user approved + emailVerified + admin

## Architecture Atlas

After changing routes, schemas, database access, ownership rules, billing, workers, queues, providers, storage, feature flags, product-domain boundaries or legacy-module status, run `pnpm architecture:generate` and review the diff as part of the change. Before completing work, run `pnpm architecture:check`. Generated architecture files are reviewed with the code change and never edited manually; annotations live in `docs/architecture/annotations.yaml`.

The Atlas (`docs/architecture/drape-architecture.json`, with a filterable `index.html` derived from it) is mechanically extracted from source — it never runs app code, opens a database, reads an env *value*, or touches R2. It is the deletion authority for the legacy-retirement program: nothing is removed while its retirement view still shows live callers.

## Architecture

Single Express server serves both the tRPC API and the client (Vite middleware in dev, static `dist/public` in prod). Entry: `server/_core/index.ts`.

- `client/src/` — React 19, wouter routing (patched via `patches/`), TanStack Query + tRPC v11 client (`lib/trpc.ts`), Zustand stores, Tailwind v4, framer-motion, React Flow (`@xyflow/react`) canvas, three.js hero
  - `pages/` — route components (routes defined in `App.tsx`)
  - `features/<domain>/` — feature modules (casting, wardrobe, boards, studio, admin, moderator, billing…) with `hooks/`, `stores/` (Zustand, named `useXxxStore`), `components/`
  - `components/ui/` — shadcn/ui primitives (new-york style, see `components.json`)
  - `components/design-system/` — Drape design-system components (marketing/home pages)
- `server/` — Express + tRPC
  - `_core/` — bootstrap (`index.ts`), env access (`env.ts`), session cookies (`cookies.ts`), JWT session sign/verify (`sdk.ts`), Vite integration (`vite.ts`), tRPC setup (`trpc.ts`, `context.ts`)
  - `routers.ts` — combines feature routers from `routes/` (admin sub-routers in `routes/admin/`)
  - `routes/` — tRPC feature routers + plain Express routes for auth (cookie-setting: `emailAuth.ts`, `googleAuth.ts`, `emailVerification.ts`) and `imageProxy.ts`
  - `db/` — Drizzle ORM queries per domain; shared pool in `connection.ts` (MySQL via mysql2)
  - `casting/` — Gemini image-generation pipeline (queue, circuit breaker, prompts)
  - `wardrobe/` — garment digitization / VTO pipeline
  - `storage.ts` — file storage on Cloudflare R2 via the S3 SDK (`storagePut`/`storageGet`/`storageDelete`; callers pass relative keys). Served URLs are public bucket URLs (`R2_PUBLIC_URL`), **not** presigned — they are persisted in DB records, so they must never expire. Static app assets (logos, swatches) live under `assets/` in the bucket, referenced via `ASSETS_BASE_URL` in `shared/const.ts`.
  - `stripe/`, `slack/`, `security/`, `logging/` (pino), `monitoring/`
- `shared/` — constants and types shared client/server
- `drizzle/` — schema (`schema.ts`) + migrations
- Path aliases: `@` → `client/src`, `@shared` → `shared`, `@assets` → `attached_assets` (in vite.config.ts, vitest.config.ts, tsconfig.json)

Tests live next to server code as `*.test.ts` and run with vitest against a node environment. `vitest.setup.ts` loads `.env` for tests but **strips `DATABASE_URL`** so unit tests can never touch the live Railway database — suites that need a DB skip unless a disposable `TEST_DATABASE_URL` is provided. Suites that hit a running server over HTTP are named `*.integration.test.ts`, excluded from `pnpm test`, and run via `pnpm test:integration` (config: `vitest.integration.config.ts`).

### Auth

Two login paths, both ending in a JWT (jose, HS256, signed with `JWT_SECRET`) set as the `app_session_id` cookie (`shared/const.ts`):

- Email/password (`routes/emailAuth.ts`): register requires a beta/invite code, then email verification via Resend (`routes/emailVerification.ts`), then admin approval (`approved` column) gates login.
- Google OAuth (`routes/googleAuth.ts`): needs `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`.

`sdk.ts` handles session JWT sign/verify only (no external OAuth server). `verifySession` requires a non-empty `appId` in the JWT payload, which is why `VITE_APP_ID` must be set. A session whose user is missing from the DB is rejected outright. Owner notifications (`_core/notification.ts`) go to the Slack webhooks (#admin-actions, falling back to #security-alerts) and log a warning when none is configured.

## Access control — expected behaviour

Who may do what, and **where that must be enforced**. Current findings: `docs/specs/SECURITY_AUDIT_2026-07-25.md`.

### Capability grid

| Resource | Anonymous | Signed in, unapproved | Signed in, approved | Moderator | Admin |
|---|---|---|---|---|---|
| Models / casts | none | none | read/write/delete own | generation metadata only¹ | same as moderator¹ |
| Boards, items, edges | none | none | read/write/delete own | none | aggregate counts only |
| Wardrobe | none | none | read/write/delete own | none | aggregate counts only |
| Credits / billing | price lists only | none | read own, checkout own | read any transactions (support) | adjust any |
| Registry (minted casts) | none — route deleted² | none | none | none | none |
| Audit logs | none | none | none | read any | read any |
| Admin actions | none | none | none | none | write any |

¹ Admins pass the moderator middleware (`server/_core/trpc.ts:131`), so they inherit the entire moderator surface — there are no separate admin content endpoints for casts, boards or wardrobe. **Known violation:** the moderator generation history and its CSV export currently return `resultUrl` — the image itself, on a permanent public URL. See "Currently not enforced".
² The former `registry.lookup` / `registry.verify` namespace has been deleted from the root router. Absence tests prevent it from being silently restored.

Resources not in the grid (profile, referrals, bug reports, invite codes, announcements…) default to **owner-only for users, none for staff**; anything broader is a deliberate, documented exception.

Unapproved accounts are *intended* to be able to sign in and redeem an access code, and nothing else — no generation, no board writes, no billing. **This is not currently enforced on the API.** `requireUser` (`server/_core/trpc.ts:32`) checks suspension and lockout but not `approved`; the only approval checks are on the two login screens, and `/api/auth/verify-email` issues a session without one. A signed-in unapproved user can call every protected procedure. See M8. Do not treat the beta gate as an access-control boundary until that is fixed.

**"Metadata only" is a boundary, not a convenience.** Staff roles may see that a generation happened — kind, timestamp, credit cost, status — for support, billing and abuse work. They must not be given the creative content: `masterPrompt`, `technicalSchema`, `preferences`, or the images. Do not add those fields to a moderator or admin projection. (The prompt half of this boundary holds today; the image half does not — see "Currently not enforced".)

### A customer's cast is their work — founder ruling, 2026-07-25

> *"If a marketing team or content creator comes on the platform and makes a model that's theirs, no one should be able to steal or copy that work."*

This is a product commitment, and it governs anything that could expose a cast:

- **Never expose `masterPrompt`, `technicalSchema` or `preferences` outside the owning account.** Together they are the complete recipe for reproducing the cast. This is the single most sensitive field group in the product — treat it the way you would treat a password, not the way you would treat a caption.
- **The former public Cast registry is deleted.** `registry.lookup`, `registry.verify`, their root-router namespace, and the projection that exposed identity documents are gone. Do not reinstate a public registry without an explicit founder decision on shape.
- **Generated images sit at permanently public R2 URLs.** By design (`server/storage.ts:5`), because URLs are persisted in database records. In practice a cast's images are protected only by the URL being hard to guess, and anyone who ever obtains one keeps access until the object is deleted. Every current `storagePut` writer uses `crypto.randomUUID()` and a repository-wide guard rejects `Math.random()` in storage writers. See M7 — whether images move behind authentication is still an open decision.

### Enforcement invariants

The grid says *what*; these say *where*. The grid alone would not have caught any of the defects found in July 2026 — every one of those procedures "knew" the rule and applied it in the wrong place.

1. **Scope the owner in the statement that reads or writes.** A `SELECT` to check ownership followed by a write keyed on id alone is insufficient — it leaves a check-then-write race and it is what went wrong. Pass `ownerId` into the db helper and put it in the `WHERE`, or scope through the parent with a join or subquery. (D-64, `docs/specs/DECISION_LOG.md:669`.)
2. **Re-anchor child ids to the owned parent in that same statement.** Verifying `boardId` does not validate the `itemIds` sent alongside it.
3. **`userId` always comes from `ctx.user.id`** — never from procedure input. Applies to record scoping, credit spend, quota, and rate-limit keys.
4. **`.strict()` on every input schema**, so unknown fields are rejected rather than silently dropped. (Required on all new code and all public/auth/billing schemas now; legacy coverage is ~36 of 210 — see M4.)
5. **Public endpoints are an enumerated allowlist.** Each is rate-limited, `.strict()`-validated, and structurally unable to mutate another user's data. Adding one is a deliberate decision, not a default. The current list (verified against local `main` on 2026-07-26): tRPC `system.health`, `auth.me`/`logout`, `billing.getPlans`, `credits.getCosts`, `generation.castingExport.costs`, `announcements.getActive`, `waitlist.join`/`getStats`, `newsletter.subscribe`, `access.validate`, `referral.validate`; Express: the auth routes, `/api/auth/verify-email`, `/api/health` (IP-rate-limited), `/api/hero/*`, `/api/webhooks/stripe`, `/api/slack/interactions`. `/api/image-proxy` and `/api/evidence/:kind/:entityId` are authenticated and user-rate-limited; the evidence route additionally re-proves the child, live Cast, and owner in one database statement. The former registry namespace is absent.
6. **Rate limits return a real `TOO_MANY_REQUESTS`**, not a 200 carrying an error field the client cannot distinguish from a validation failure.
7. **A control that is not invoked does not exist.** If you add a protection, something must call it on the request path, a test must prove it *blocks*, and it must refuse — not allow — when a dependency is missing or unconfigured.
8. **Read paths return an explicit projection.** Never let a bare `select()` or a spread DB row cross the serialization boundary — that is how `passwordHash` reached `auth.me` and image URLs reached the moderator surface. Sensitive field groups stay out by construction, not by callers remembering to omit them.
9. **Every route that mints a session cookie enforces the same gates as login.** `/api/auth/verify-email` issuing sessions without the approval check (M8) is the counterexample. A new issuance site is an enumerated decision, like a new public endpoint.

### Currently not enforced — do not rely on these

Documented and believed working; verified inert. Fixes are queued post-R7:

- **The staff image boundary** — `moderator.getUserGenerationHistory` and `moderatorExports.exportUserGenerationHistoryCsv` return `resultUrl` (permanent public image URLs) for any user's generations. Prompts do not leak; images do.
- **Admin allowlist** (`server/security/adminSecurity.ts`) — admits everyone when empty, and it is empty in production. Admin access is role-only.
- **Slack approval for sensitive admin actions** — the sensitive procedures in `server/routes/admin/users.ts` execute directly, and the approval flow self-approves when Slack is unconfigured.
- **IP blocking** (`server/db/ipBlocking.ts`) — blocks are recorded, never checked during a request.
- **Credit-purchase velocity limits** — helpers and Slack alert exist, no call site in the checkout path.
- **The beta approval gate** — enforced on the login screens and in the UI, not in `requireUser`. See M8.
- **The "immutable" audit log** (`adminSecurity.ts`) — invoked, but the hash chain is in-memory (resets every deploy) and its Slack backup no-ops when Slack is unconfigured. There is currently no tamper evidence.

Most of these followed the same path: helper or rule written, docs written, todo ticked, call site never added — and the last is the nastier variant, invoked but inert under the current configuration. Invariants 7 and 8 exist because of them. The grid above was re-verified cell-by-cell against the code on 2026-07-25.

## Design system conventions

- Design tokens in `client/src/styles/tokens.css`: monochrome palette (black `#0A0A0A`, surface `#EBEBEB`, white), 4px spacing grid, Inter font. Reference via `var(--token-name)`; don't hardcode colors/spacing.
- Dark theme is the default (`ThemeProvider defaultTheme="dark"` in `App.tsx`).
- App UI (studio, admin, boards): shadcn/ui primitives from `@/components/ui`, composed inside `features/<domain>/components`.
- Marketing/home pages: use `@/components/design-system` (Section, Card, Button, Typography, Grid) — these encode the Home.tsx look.
- Icons: lucide-react. Toasts: sonner. Class merging: `cn()` from `@/lib/utils`.
- Client state: Zustand stores per feature; server state: tRPC + TanStack Query only.

## Local dev setup (Windows)

1. `pnpm install` (pnpm 10; patched deps + native builds: sharp, esbuild, @tailwindcss/oxide)
2. Database is a hosted Railway MySQL — there is no local MySQL install. Get `DATABASE_URL` (the public `mysql://` URL) from the Railway dashboard.
3. Create `.env` in the repo root (loaded via dotenv; Vite reads the same file — `envDir` is repo root)
4. `pnpm db:push` to create/update tables (runs against the Railway database)
5. `pnpm dev` → http://localhost:3000

### Required .env vars (server exits at boot if missing)

- `DATABASE_URL` — Railway MySQL public connection URL (from the Railway dashboard)
- `JWT_SECRET` — session-cookie signing secret (any long random string)
- `VITE_APP_ID` — any non-empty string; embedded in the session JWT and required by `verifySession` (empty value = every login silently rejected)
- `GEMINI_API_KEY` — Google AI Studio key (all image generation)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — Stripe (test-mode keys fine locally)
- `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` — Cloudflare R2 (S3 API) for all file storage (generated images, garments, avatars)
- `R2_PUBLIC_URL` — the bucket's public URL (`https://pub-….r2.dev` or a custom domain); used to build served image URLs, the CSP `img-src`, and the image-proxy SSRF allowlist

### Optional .env vars (feature-gated)

- `R7_EVIDENCE_INGEST_SCOPE` — `off`/absent, `all`, or `users:<ids>`; any non-off value fails startup unless the cleanup worker and private evidence adapter are fully configured
- `ENABLE_STORAGE_CLEANUP_WORKER=true` — required before evidence ingest can be enabled
- `R2_EVIDENCE_BUCKET`, `R2_EVIDENCE_ACCESS_KEY_ID`, `R2_EVIDENCE_SECRET_ACCESS_KEY` — dedicated private evidence bucket and least-privilege credential; uses `R2_ENDPOINT` but never `R2_PUBLIC_URL`
- `RESEND_API_KEY` — verification emails (signup breaks without it unless dev-mode skip applies)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google OAuth login
- `VITE_STRIPE_PUBLISHABLE_KEY` — client-side Stripe
- `OWNER_OPEN_ID`, `OWNER_NAME` — bootstrap owner/admin account
- `SLACK_WEBHOOK_URL` (+ `SLACK_ADMIN_ACTIONS_WEBHOOK_URL`, `SLACK_AUDIT_LOG_WEBHOOK_URL`, `SLACK_BILLING_ALERTS_WEBHOOK_URL`, `SLACK_SYSTEM_ALERTS_WEBHOOK_URL`, `SLACK_SIGNING_SECRET`) — alerting
- `KLAVIYO_PRIVATE_KEY` — marketing email flows
- `PORT` (default 3000), `LOG_LEVEL`, `DAILY_GENERATION_LIMIT`, `GEMINI_TEXT_CONCURRENCY`, `GEMINI_IMAGE_CONCURRENCY`, `GEMINI_MAX_QUEUE_DEPTH`

### Windows notes

- The dev script uses `cross-env` so `NODE_ENV=development` works under cmd/PowerShell.
- Shell is PowerShell; prefer `pnpm` scripts over raw shell one-liners from docs.

## Deployment (Railway production)

Production runs in the Railway project **drape-production** (deployed 2026-07-10), fully isolated from dev: its own MySQL, its own R2 bucket, fresh secrets. Live at https://drape-production-0232.up.railway.app.

### Services

- **MySQL** — Railway-managed MySQL. The app reaches it over Railway's private network via the reference variable `${{MySQL.MYSQL_URL}}` (resolves to `mysql://…@mysql.railway.internal:3306/railway`). The service also exposes `MYSQL_PUBLIC_URL` (proxy) — that's what you use to run migrations from a dev machine.
- **Drape** — app service connected to the GitHub repo (`michaelpaulrattray/Drape`), branch **`local-migration`**. Build command `pnpm build`; start command `node dist/index.js` (NOT `pnpm start` — the start script needs `cross-env`, a devDependency; `NODE_ENV=production` is set as a service variable instead). Public domain targets port 3000, pinned via `PORT=3000`.

### How deploys trigger

Every push to `local-migration` triggers a Railway build + deploy. Changing a service variable also redeploys. Current convention: `local-migration` is kept in sync with `main` (`git push origin main:local-migration`).

### Rollback

Railway → Drape service → Deployments → pick the last good deployment → ⋮ → **Redeploy**. That reuses the old build image; no git revert needed. For a bad variable change, fix the variable (auto-redeploys). DB migrations are append-only (drizzle journal) — never rolled back automatically; treat schema changes as forward-only.

### Production env vars (meanings, not values — secrets live only in Railway)

Everything in "Required .env vars" above, plus the production-specific notes:

- `DATABASE_URL` = `${{MySQL.MYSQL_URL}}` (internal URL, no proxy hop)
- `JWT_SECRET` — production-only random secret, distinct from dev (dev sessions can't be replayed against prod)
- `VITE_APP_ID` = `drape-production` (distinct from dev's `drape-local`, same reason)
- `R2_BUCKET` = `drape-production`, `R2_PUBLIC_URL` = that bucket's public r2.dev URL; same account endpoint + API token as dev (token covers both buckets)
- `VITE_ASSETS_BASE_URL` = `<prod R2_PUBLIC_URL>/assets` — overrides the dev-bucket fallback in `shared/const.ts`; must match `R2_PUBLIC_URL`'s origin or the CSP `img-src` blocks the assets. The `assets/` tree was copied from `drape-dev` on 2026-07-10.
- `STRIPE_WEBHOOK_SECRET` — signing secret of the Stripe (test-mode) webhook endpoint `https://<domain>/api/webhooks/stripe`, subscribed to the 8 event types handled in `server/stripe/webhooks.ts`
- `NODE_ENV=production`, `PORT=3000`
- Gemini/Stripe/Resend/Google OAuth keys are currently shared with dev (Stripe in test mode)

Vite inlines `VITE_*` vars into the client bundle at build time, so they must be present as Railway variables (they are available during build), and changing them requires a rebuild, not just a restart.

### Migrations & one-off SQL against production

`pnpm db:push` (drizzle generate + migrate) from a dev machine, with `DATABASE_URL` overridden to the **MYSQL_PUBLIC_URL** for that one command — never put the prod URL in `.env`. Initial data was seeded with one-off SQL (single-use invite code, then `UPDATE users SET role='admin'` after first signup); `seed.ts` refuses production by design.

### External-service registrations tied to the domain

- **Google OAuth**: the Railway domain's `/api/auth/google/callback` is an authorized redirect URI on the shared OAuth client. A new domain (custom domain later) needs the same registration.
- **Stripe**: webhook endpoint per environment; the raw-body route must stay registered before `express.json()` in `server/_core/index.ts` or signature verification breaks (learned in production).
- **Resend**: no verified sending domain yet — emails send from `onboarding@resend.dev`, which only delivers to the Resend account owner. Email/password signup verification is therefore broken for everyone else until a domain is verified in Resend and the `from:` in `server/routes/emailVerification.ts` is updated. Google OAuth signups are unaffected.

### Known gaps at deploy time

- `hero/*` keys (home-page hero media, served via `server/heroProxy.ts`) were never re-hosted to R2 — the hero 502s in dev and prod alike. Needs source files + `scripts/upload-hero-v3.mjs`.
- `VITE_STRIPE_PUBLISHABLE_KEY` unset in prod — client-side checkout UI unavailable (server warns at boot).

## Manus legacy

All Manus platform code (OAuth flow, Forge proxies, runtime/debug plugins, dead modules, deps) has been removed. The one intentional remnant: `files.manuscdn.com` / `*.cloudfront.net` stay in the CSP `img-src` (`server/security/securityHeaders.ts`) and SSRF allowlist (`server/security/urlValidator.ts`) because old DB records still reference those hosts — they go when `scripts/migrate-storage-urls.ts` is run against production at final cutover.

Gotchas that remain relevant:

- Session cookie: `sameSite` must be `lax` (not `none`) on plain-HTTP localhost — handled in `server/_core/cookies.ts`.
- `VITE_APP_ID` empty → `verifySession` rejects every session with no visible error. Keep it set.
