# CLAUDE.md

Drape — AI fashion studio: cast AI models (Gemini image generation), digitize garments, run virtual try-on (wardrobe/VTO), and iterate on an infinite canvas (boards). Originally scaffolded on the Manus WebDev platform; all Manus platform code has since been removed (see "Manus legacy" below for the one intentional remnant).

## Project context

Drape is a commercial product heading for public launch. Billing, credits, and auth code are production-critical — treat changes there conservatively.

Design taste: restrained, editorial, monochrome. Prefer simple, human-feeling solutions over clever or busy ones; avoid generic templated UI patterns. When in doubt on design decisions, less is more.

## The fidelity law (founder ruling, 2026-08-06)

Never take the path of least resistance on quality. When a capability
exists as a dedicated, proven tool — a segmentation model instead of
hand-drawn shapes, a matting model instead of a binary outline, a real
library instead of an approximation — use the dedicated one, even when
the approximation is nearer to hand. The convenient substitute silently
caps the ceiling of everything built on top of it.

Shortcuts are permitted only when **declared**: scaffolding-first is
legitimate engineering, but the report must say "this is scaffolding,
the real source lands next," and the real source must be on the board.
A lesser path taken *silently* — shipped as if it were the real thing —
is the violation. Origin: the maskGeometry incident (masks built from
authored shapes when segmentation models were the obvious source; the
founder's "not just blocks and squares?" caught it mid-build). When you
notice you are about to approximate, name the tradeoff out loud and let
it be challenged before it ships, not after.

## Working laws (founder-ratified, each from a real incident)

1. **Reports are claims; artifacts are facts.** Never assert what a
   file, image, log, or database row contains from memory or from
   another report — open the artifact itself, at the resolution the
   claim needs. A deploy reporting SUCCESS is a claim; the health check
   and the changed bytes are the fact. (D-164, D-202.)
2. **Verify the instrument before believing its finding.** A new
   metric, reader, or checker gets a negative control and a positive
   control before its verdicts count for anything. A green suite proves
   nothing if the checker cannot fail. (D-147, D-203.)
3. **A backstop needs a test the model cannot rescue.** If the only
   test of a guard runs through an LLM that usually behaves, the guard
   is untested. Drive it directly.
4. **Derive, never mirror.** A second list shadowing a source of truth
   always drifts from it. Build derived views, not parallel copies.
5. **Assert at the wire.** Contracts about what gets sent are proven on
   the outgoing request, not on a constant near it.
6. **Render before shipping anything visual.** No visual change ships
   without being looked at in the running app first. (D-101.)
7. **Fix the class, not the instance.** (Founder, 2026-08-07.) A bug
   found once is a pattern until proven unique. Before declaring any
   defect fixed: name its class (the shape of the mistake, not the
   symptom), sweep the rest of the feature — and any code sharing the
   shape — for siblings, and fix or explicitly file every one found.
   The sweep is part of the fix; a fix without its sweep is half done.
   Evidence this pays: the nose/rose typo fix swept 46 sentences and
   caught two more latent hits before any user did; the "earring"
   default was one of a class of quiet dispatch fallbacks; the
   wrong-boundary measurement error took four appearances before its
   class was named — each earlier sweep would have prevented the later
   instances.

   **The same law pointed at rulings instead of bugs (2026-08-19):
   WHEN A RULING CLOSES A PATH, THE SWEEP ASKS WHAT WAS BOLTED TO IT.**
   Asked at the closing commit, not later. Three controls have now died
   this way and none of them by carelessness: the credit-velocity caps
   (a product removing its topup checkout, `41a765ea`), the
   sensitive-action gate (a file split, `3cb0cdee`, six hours earlier the
   same day), and the founder-approved refused-frame camera — killed by
   his own catastrophic-only refund ruling (`5c5a1f3f`), which was
   CORRECT and still took a control with it. That is the harshest form,
   because there is no mistake to find in the change itself. Each would
   have been caught on the day for the cost of one grep along the dying
   branch. A control that stops being reachable leaves no failing test
   and no error — only a green suite and a document that still describes
   it.

   **The type specimen is 2026-02-07.** Two security controls died that
   day, in two unrelated refactors six hours apart — the sensitive-action
   gate at 03:35 in a file split, the credit-velocity caps at 09:13 in a
   product removal — and both were then described, in code comments and
   in this file, as controls whose call site was never added. Six months
   of confident documentation, from one ordinary morning's tidying.
8. **This is a visual studio, not a maths class.** (Founder, 2026-08-06.)
   The user's ontology governs design: edits are scoped and named the
   way a stylist, photographer, or casting director thinks — a fringe
   is part of a haircut, a tan covers all visible skin, earrings come
   in matching pairs. Pixel deltas, masks, and metrics are the
   implementation and verification layer — they serve the stylist's
   promise and never frame the product. Origin: the fringe was built as
   strands painted onto a forehead patch (the minimal-diff framing)
   when it was always a cut change (the user's framing) — the founder
   had assumed the obvious ontology while engineering optimized the
   mathematical one, and nobody put the two in one room. When scoping
   any edit, ask first: how would the user describe what changes? That
   description is the spec; the math proves it happened.
9. **The founder's eyes are king — always.** (Founder, 2026-08-16,
   verbatim: "do NOT trust the engine my eyes are king. ALWAYS. the
   engine lies and cannot be trusted.") A model's reading of an image
   — describer, verification reader, any vision judge — is never the
   final word on what a frame shows. A reader's output is a pointer to
   look, not a fact to file: no claim about a visible surface closes
   on reader prose alone; frames go in front of eyes, and reports
   quote what was seen. Where a reader and his eye have ever
   disagreed on a class, the reader is presumed wrong on that class
   until re-proven with a control he has seen. Origin: the freckle
   court — both arms overturned at the frames in one sitting
   (fable-714/715/716): the reader called freckles absent on frames
   that visibly held them, after the tan-drift figure had already
   fallen to a moving-mask measurement artifact.

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
- `server/` — Express + tRPC
  - `_core/` — bootstrap (`index.ts`), env access (`env.ts`), session cookies (`cookies.ts`), JWT session sign/verify (`sdk.ts`), Vite integration (`vite.ts`), tRPC setup (`trpc.ts`, `context.ts`)
  - `routers.ts` — combines feature routers from `routes/` (admin sub-routers in `routes/admin/`)
  - `routes/` — tRPC feature routers + plain Express routes for auth (cookie-setting: `emailAuth.ts`, `googleAuth.ts`, `emailVerification.ts`) and `imageProxy.ts`
  - `db/` — Drizzle ORM queries per domain; shared pool in `connection.ts` (MySQL via mysql2)
  - `casting/` — Gemini image-generation pipeline (queue, circuit breaker, prompts)
  - `wardrobe/` — garment digitization / VTO pipeline
  - `storage.ts` — file storage on Cloudflare R2 via the S3 SDK (`storagePut`/`storageGet`/`storageDelete`; callers pass relative keys). Served URLs are public bucket URLs (`R2_PUBLIC_URL`), **not** presigned — they are persisted in DB records, so they must never expire. Static app assets (logos, swatches) live under `assets/` in the bucket, referenced via `ASSETS_BASE_URL` in `shared/const.ts`.

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

¹ Admins pass the moderator middleware (`server/_core/trpc.ts:131`), so they inherit the entire moderator surface — there are no separate admin content endpoints for casts, boards or wardrobe. The generation history and its CSV export carry `hasResult`, never the image URL (closed 2026-07-30, `b186bff`; guarded by `server/staffImageBoundary.test.ts`).
² The former `registry.lookup` / `registry.verify` namespace has been deleted from the root router. Absence tests prevent it from being silently restored.

Resources not in the grid (profile, referrals, bug reports, invite codes, announcements…) default to **owner-only for users, none for staff**; anything broader is a deliberate, documented exception.

Unapproved accounts are *intended* to be able to sign in and redeem an access code, and nothing else — no generation, no board writes, no billing. **Enforced on the API since 2026-07-30.** `protectedProcedure` is `requireUser` (auth, suspension, lockout) plus `requireApproved`; an unapproved account gets `FORBIDDEN` from every protected procedure in real time, the same way suspension works.

The exemptions are enumerated, and adding one is a deliberate decision like adding a public endpoint: `access.redeem` and `access.status` use `onboardingProcedure` (signed in, approval not required) — gating those would make approval unreachable, since the account could never redeem the code that approves it. `auth.me` and `auth.logout` are `publicProcedure` and were never behind this gate. `server/approvalGate.test.ts` proves both the block and every exemption, and pins the exempt list; the Atlas reports them as `onboarding-endpoint` findings.

Still true, and now the reason it matters is narrower: `/api/auth/verify-email` mints a session without an approval check (invariant 9's counterexample). That session is now inert for everything but the onboarding surface, but the issuance site is still an unenumerated one.

**"Metadata only" is a boundary, not a convenience.** Staff roles may see that a generation happened — kind, timestamp, credit cost, status — for support, billing and abuse work. They must not be given the creative content: `masterPrompt`, `technicalSchema`, `preferences`, or the images. Do not add those fields to a moderator or admin projection. Both halves hold as of 2026-07-30: the moderator generation history carries `hasResult` rather than `resultUrl`, and the URL is never selected in the first place, so reintroducing it takes a deliberate edit. `server/staffImageBoundary.test.ts` guards it.

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
4. **`.strict()` on every input schema**, so unknown fields are rejected rather than silently dropped. (Required on all new code and all public/auth/billing schemas now; legacy coverage measured by the Atlas at 56 of 237 procedures, leaving 169 non-public procedures without it — `pnpm architecture:generate` reports the current figure as `non-strict-input` findings. See M4.)
5. **Public endpoints are an enumerated allowlist.** Each is rate-limited, `.strict()`-validated, and structurally unable to mutate another user's data. Adding one is a deliberate decision, not a default. The current list (mechanically verified by the Atlas, 2026-07-30 — `pnpm architecture:generate` reports it as `public-endpoint` findings): tRPC `system.health`, `auth.me`/`logout`, `billing.getPlans`, `credits.getCosts`, `generation.costs`, `announcements.getActive`, `waitlist.join`/`getStats`, `newsletter.subscribe`, `access.validate`, `referral.validate` — twelve, matching this list exactly. (`generation.costs` was documented here as `generation.castingExport.costs`; that is the file it is declared in, but `castingExportRouter` is merged into `generation` by procedure spread, so the callable id has no `castingExport` segment.) Express: the auth routes, `/api/auth/verify-email`, `/api/health` (IP-rate-limited), `/api/hero/*`, `/api/webhooks/stripe`, `/api/slack/interactions`. `/api/image-proxy` and `/api/evidence/:kind/:entityId` are authenticated and user-rate-limited; the evidence route additionally re-proves the child, live Cast, and owner in one database statement. The former registry namespace is absent.
6. **Rate limits return a real `TOO_MANY_REQUESTS`**, not a 200 carrying an error field the client cannot distinguish from a validation failure.
7. **A control that is not invoked does not exist.** If you add a protection, something must call it on the request path, a test must prove it *blocks*, and it must refuse — not allow — when a dependency is missing or unconfigured.
8. **Read paths return an explicit projection.** Never let a bare `select()` or a spread DB row cross the serialization boundary — that is how `passwordHash` reached `auth.me` and image URLs reached the moderator surface. Sensitive field groups stay out by construction, not by callers remembering to omit them.
9. **Every route that mints a session cookie enforces the same gates as login.** `/api/auth/verify-email` issuing sessions without the approval check (M8) is the counterexample. A new issuance site is an enumerated decision, like a new public endpoint.

### Currently not enforced — do not rely on these

Documented and believed working; verified inert. Fixes are queued post-R7:

Each now carries the ROAD it took, read off the git history 2026-08-19 rather than assumed — because "never finished" and "demolished by accident" argue for different answers, and this list had them all filed as the first:

- **Admin allowlist** (`server/security/adminSecurity.ts`) — admits everyone when empty, and it is empty in production. Admin access is role-only. **Road: invoked, inert by configuration.** `isOnAdminAllowlist` IS called on every admin request, through `validateAdminAccess` in `adminProcedure` (`server/_core/trpc.ts:160`) — it is the empty-list early return that admits everyone. This is the only one of the three whose entry here was already right.
- **Slack approval for sensitive admin actions** — the sensitive procedures in `server/routes/admin/users.ts` execute directly, and the approval flow self-approves when Slack is unconfigured. **Road: WIRED AND LOST TO A REFACTOR.** `isSensitiveAction` — the gate deciding which actions need the extra confirmation — had a live call site in `server/routers.ts` and was dropped in `3cb0cdee` (2026-02-07 03:35), the commit that split that 4,209-line file into 17 feature modules. Nothing about the control was decided; it did not survive the move. Six hours later the same day, `41a765ea` did the same thing to the credit-velocity caps.
- **IP blocking** (`server/db/ipBlocking.ts`) — blocks are recorded, never checked during a request. **Road: never wired**, confirmed at birth: in `098de49d` the only non-test caller of `isIpBlocked` was `blockIp` itself checking for a duplicate, and `docs/RATE_LIMITING.md` was updated in that same commit to describe the request-path check that was never written.
- **The "immutable" audit log** (`adminSecurity.ts`) — invoked, but the hash chain is in-memory (resets every deploy) and its Slack backup no-ops when Slack is unconfigured. There is currently no tamper evidence.

Most of these followed the same path: helper or rule written, docs written, todo ticked, call site never added — and the last is the nastier variant, invoked but inert under the current configuration. **There is a third path, and it is the hardest of the three to catch, because at no point did anyone skip a step: written, wired, live — and then orphaned by a change aimed at something else entirely.** Three instances are now on the record and none of them was carelessness — the credit-velocity caps (killed by removing the topup product, `41a765ea`), the sensitive-action gate above (killed by a file split, `3cb0cdee`, six hours earlier the same day), and the refused-frame diagnostic capture (killed by the founder's own catastrophic-only refund ruling, `5c5a1f3f` — a CORRECT ruling that took a control with it, which is the harshest form). **An import-graph reading that only asks "does anything call this" cannot tell a control that was never wired from one that was UN-wired, and only the second kind has a commit that can be found and read.** Invariants 7 and 8 exist because of them. The grid above was re-verified cell-by-cell against the code on 2026-07-25.

**One has left this list — and it was never on it, which is the part worth noticing.** The site-wide login-attack detector (`recordGlobalFailedLogin` / `shouldSendGlobalAttackAlert` / `markGlobalAttackAlertSent`) had no call site anywhere in the product for months, and **this list did not name it** while `docs/RATE_LIMITING.md` carried a worked example of the wiring that had never been done. So the honest record was incomplete and the dishonest one was confident. **Wired 2026-08-19** by founder ruling (*"wire and explain in plain english"*): `server/security/loginAttackAlert.ts` is the call site, and the login route calls it from **both** failed-login exits — including the unknown-email exit, which is the one credential stuffing mostly hits. **It lands on the admin and moderator panels, not in Slack** — his own follow-up ruling the same day (*"slack isnt connected needs to eb wired into admin /mod panels"*), and he was right: production has no Slack webhook, so the first version of this wire was itself an inert control of exactly the kind this list names. It writes an `abuse.global_attack_detected` audit row — no new surface, no widening of the grid above, no migration — and that action is added to the panel's abuse CATEGORY in the same commit, without which every row it writes would have been filtered away unseen. Its limit is stated rather than shipped quietly: **the counter is in memory and resets on every deploy**, so it catches a fast, loud attack and would miss a slow, patient one. `server/security/loginAttackAlert.test.ts` drives it directly, including the concurrent case that a sequential test cannot see.

**A second has left this list, by the other door: the credit-purchase velocity pair is DELETED (2026-08-19), not wired.** The founder was asked for one word — *wire* or *bin* — and the recommendation put to him was bin, with a deliberate pause afterwards so that *"I didn't get a chance to say"* could not be true; he did not object, and the stated default landed. `getRecentTopupCount`, `getRecentTopupCredits`, `SlackAlerts.velocityLimitHit` and `server/velocityLimits.test.ts` are gone, and `BILLING_ALERTS.md`, `SECURITY_OVERVIEW.md` and the audit's H5 say so. The reason is a product one: blocking a paying customer's top-up is a decision about how we treat paying people — what counts as too fast, what happens when someone hits it — and half of that is unanswered, so it deserves its own design rather than a wire-up. **There is now no application-side fraud cap on credit purchases, which is the honest state and is the point.**

**And the deletion turned up the fact that named the third path above.** The caps were not written-and-never-wired: they were live from `a3abdf8b` (2026-02-06) to `41a765ea` (2026-02-07), when removing the one-time topup system took `createTopupCheckout` — the only call site — with it. The helpers stayed, the docs stayed, and so did a test suite that compared local constants to themselves and therefore **could not go red when its own subject was deleted**. Its docblock even recorded that the topup packages were gone and called itself *"relevant for any future credit purchase flow"*. **A suite that cannot fail when its subject is deleted is how a dead control keeps a live reputation** — invariant 7's sibling, and worth asking of H2/H3/H4 rather than assuming their road was the first one.

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
- `CASTING_V2_SCOPE` — `off`/absent, `all`, or `users:<ids>`; gates the whole `castingV2.*` namespace, which is **spendable surface** (a roll charges credits). Any non-off value fails startup unless `ENABLE_STORAGE_CLEANUP_WORKER=true` and `FAL_KEY` is set — without the worker, candidate objects outlive the sheets §G.6 promises to purge; without the transport, every paid roll fails at dispatch
- `CASTING_SEGMENTS_SCOPE` — `off`/absent, `all`, or `users:<ids>`; the segment store (segment permanence). Off by default and additive: with it off no segment row is ever written and no composite reads one, so the code lands dark even though `CASTING_V2_SCOPE` is already open. Non-off fails startup unless `ENABLE_STORAGE_CLEANUP_WORKER=true` and every user named is already inside `CASTING_V2_SCOPE`. **The `casting_segments` table must exist before this is flipped on** (migration `0025`; production takes it by ceremony). Purging is deliberately *not* gated on this flag — segments are always swept with their candidate
- `CASTING_SEGMENTS_DELIVERED_SCOPE` — `off`/absent, `all`, or `users:<ids>`; cuts a segment from the DELIVERED frame's own extent of the thing (`applied ∩ (region(delivered) ∪ region(master))`) instead of the master's alone. Off by default and additive: with it off the cutter is handed no delivered map and behaves exactly as before. Non-off fails startup unless every user named is already inside `CASTING_SEGMENTS_SCOPE`. It costs **no extra vision call** — the harvest already reads the delivered region for its own content gate. Measured on the founder's v#163: the segment goes from **10.0% to 88.7%** of what the paid edit actually delivered
- `CASTING_REFERENCE_LIBRARY_SCOPE` — `off`/absent, `all`, or `users:<ids>`; the compositor swap's **reference library** (`casting_reference_library`, migration 0028 — the table must exist before this is flipped on; production takes it by the ceremony script). Off by default and inert: with it off no library row is ever written and no recipe reads one. Non-off fails startup unless `ENABLE_STORAGE_CLEANUP_WORKER=true` and every user named is already inside `CASTING_V2_SCOPE`. Deliberately NOT a child of `CASTING_SEGMENTS_SCOPE` — the library is not built from the segment store and never reads it. Purging is not gated on it: library crops are always swept with their candidate
- `CASTING_REPAINT_SCOPE` — `off`/absent, `all`, or `users:<ids>`; **the compositor swap** (D-241). Off, a refine renders full-frame, harvests a region and pastes it back onto the master with a blended join. On, the same ask assembles a recipe (`recipeAssembler`) and repaints the whole frame from the pristine master plus a cropped reference of every delivered feature (`repaintRender`) — the engine's own frame is the delivered frame, nothing is composited into it, and there is no seam. Off by default and inert: with it off, not one line of the new road runs. Non-off fails startup unless every user named is already inside `CASTING_REFERENCE_LIBRARY_SCOPE` — **a repaint carries features by CROP, so a repaint user without a library loses every feature the paste was preserving.** An empty library is a different thing and is fine: that is the degenerate case (master alone plus words), the road every new cast travels. Three doors refuse into the refund rather than painting: an ask the product cannot yet state declaratively, a recipe D-244 forbids, and a reference whose bytes have moved since the library minted them
- `CASTING_SIDE_PHRASING_SCOPE` — `off`/absent, `all`, or `users:<ids>`; whether a per-side ask also says WHERE that side is. Off, the recipe names it once — *"Change only her right eye: fiery red"*; on, it adds *"(on the left of the picture as you look at it)"*. It exists because the engine paints by position rather than by anatomy: twelve renders each way on her right eye, four painted the OTHER eye without the clause and none with it (p≈0.09, never once worse, free per render — `docs/specs/V4_SIDE_INFERENCE_COURT.md` §3b). Non-off fails startup unless every user named is already inside `CASTING_REPAINT_SCOPE`, since the clause is written by the repaint recipe and this flag governs that lane alone. **A second lane says the same sentence and is NOT gated by it**: a signed Cast's tattoos carry the positional phrasing into every package view unconditionally (fable-1006 §3), because the view clause is house prose on a road with no installed behaviour to protect. Both callers come through one owner (`sidePhrasing.imageHalfClause`) so the two lanes cannot drift on what "left" means
- `CASTING_FACE_SCAN_SCOPE` — `off`/absent, `all`, or `users:<ids>`; **the auto-scan**. Off, the face panel is what it is today — rows from the catalogue, content from the library — so a face nobody has edited shows a column of empty slots. On, the panel's first read of a version also asks a segmenter where every feature is on that frame and fills the rows the library has nothing for, as masked cutouts drawn from the frame already on screen. On its own it **mints nothing**: no rows, no objects, no manifest, no purge path — the geometry and its one-bit stencils live in memory, keyed (candidate, version), and the re-scan rate is logged so promoting that cache to a table is a reading rather than an anecdote. That reading arrived (58 paid scans for 28 distinct faces in two days) and bought the table — see `CASTING_SCAN_TABLE_SCOPE` below, which is the only thing that makes a scan durable; with it off this paragraph is still exactly true. It spends house money (**20 segmenter calls, $0.100 per version looked at**, plus one describer call on a different transport — counted through `scanFace` itself with a recording reader on 2026-08-16, `scripts/count-scan-reads-disposable.mts`, not derived: twelve questions, five of them read as two half-frames, one composed below-head slot costing a head read and a subject matte, and one shared midline read) and never a user's credits. Non-off fails startup unless every user named is already inside `CASTING_REFERENCE_LIBRARY_SCOPE` — the panel it fills is dark without it, and a paid read nobody can see is inert, which is indistinguishable from mistaken
- `CASTING_SCAN_TABLE_SCOPE` — `off`/absent, `all`, or `users:<ids>`; whether a finished scan is **kept**. Off, the scan behaves exactly as `CASTING_FACE_SCAN_SCOPE` describes — remembered in memory, forgotten on every deploy, and re-bought on the next look (58 paid scans for 28 distinct faces across two days of live use). On, a clean scan is written to `casting_face_scans` (migration 0032; **the table must exist before this is flipped on** — production takes it by the ceremony script) and read back once per (candidate, version). The row holds GEOMETRY only: measured on 29 clean production scans, stencils base64 inside the row would be 12,365 B against 1,212 B without, which is ~4.7 GB of MySQL at 10,000 users × 5 casts × 8 versions — so the stencils are objects under the candidate's own purge path instead. Rows and stencils die with their cast, unconditionally and **not** gated on this flag. Non-off fails startup unless `ENABLE_STORAGE_CLEANUP_WORKER=true` and every user named is already inside `CASTING_FACE_SCAN_SCOPE` — a user who produces no scans has nothing to keep
- `CASTING_OPEN_LANE_SCOPE` — `off`/absent, `all`, or `users:<ids>`; **the open lane** — whether an ask naming something the catalogue has never heard of may name its own kind. Off, the interpreter is not told it may do so, its replies key onto the nearest closed subject (*"give her wings"* is winged eyeliner), and the acceptance door is not consulted at all. On, the prompt carries a last-resort clause, fantastical anatomy stops routing to the stage wall, and an out-of-vocabulary ask files as `delta.open`. Off by default and inert. Non-off fails startup unless every user named is already inside `CASTING_REPAINT_SCOPE` — **not** the casting scope, and the difference is measured: the repaint recipe reads `delta.open`, while the paste road composes its prompt from words the recipe never carries. Wall (d)'s re-read now uses `readStoredDelta` rather than the strict `readDelta`, because it reads *our own persisted row*; with the strict reader an ask whose only content was an open kind read as unreadable and refunded, on every road (`OPEN_LANE_DESIGN_NOTE.md` §9.13)
- `CASTING_INK_STUDIO_SCOPE` — `off`/absent, `all`, or `users:<ids>`; **the ink studio's door** (M12 row 15, tattoos first). Off, and absent means off, `castingV2.ink.upload` answers NOT_FOUND and not one design row is written. On, a customer may attach a tattoo design to a Cast — our own COPY of her bytes under the candidate's purge path (swept with her Cast unconditionally, never gated on this flag), capped at 8 designs per Cast, charging nothing at all while the plate does not exist — against the closed placement vocabulary — `neck`, `upper arm`, `upper chest` conditional on the neckline, which is what sixteen production masters were measured to contain (`V3B_PLACEMENT_VOCABULARY_READING.md`; everything else is below the crop line or under the roll prompt's own crew tee). Non-off fails startup unless `ENABLE_STORAGE_CLEANUP_WORKER=true` (an uploaded design is bytes we keep under the candidate's purge path) and every user named is already inside `CASTING_REPAINT_SCOPE` — the open lane's argument one step on: a design reaches a photograph as a cropped reference carried by the repaint recipe, and the paste road carries none. **And the `casting_ink_form_demand` table must exist before this is flipped on** (migration `0041`; production takes it by `scripts/ceremony-ink-form-demand.mts`) — a named prerequisite of the FLIP rather than a boot guard, and it is not a crash risk: the writer catches its own failure and the mint catches again, so a missing table costs the TALLY and never a customer's answer. It is a prerequisite anyway because the thing being counted is the refusal a cast with no torso form receives, and `SEXES` has three members while the set has two torso forms — flip the door open ahead of the table and the first people to meet that refusal are the ones whose demand nobody records. **AND THE WIDENING TRIPWIRE (ruled fable-1052 §2): THIS SCOPE DOES NOT WIDEN PAST `users:1` WHILE UPLOADS RIDE UNCROPPED TO THE MINT.** The fence everything here is written on — *the uploaded photograph never reaches a render* — is true and is scoped to the RENDER; the plate mint is a second engine and `inkPlateMint.ts` hands it the stored upload unchanged, while `inkUploadDoor.ts` gates placement, size, format, edge, intent and the per-Cast cap and nothing about who is in the picture. A full-person photograph therefore rides wholesale to the mint today. That was ruled acceptable on ONE ground and one only — **the sole account behind this door is the founder's own**, his uploads, his hand, his ordered flag, to the vendor every render already streams through — after all three candidate interim gates were scoped and found worse than the exposure (a face detector cannot separate a portrait tattoo from a photograph of a person, and law 9 forbids asking a vision reader to; a rectangle crop is the fidelity violation in the very place he said "cropped" means the design; gating the mint disarms the fence court that settles the question). **The tripwire KEEPS while the mannequin road is deferred, and the deferral is not what retires it** (ruled fable-1064 §2): with `MANNEQUIN_ROAD_DEFERRED` on, no upload reaches any engine at all, so the tripwire's condition cannot fire — but the bound it protects, a customer's photograph reaching an engine, RE-ARMS the moment the road resumes. A control retired by a ruling aimed at something else is law 7's second half verbatim. The crop-from-photo build (V3B §7.11 build 3a) is what retires it. **A widening request before 3a lands re-opens the question as a BLOCKING prerequisite, not a judgement call** — the sentence that makes the exposure acceptable is *"it is his"*, and the first customer through the door is the moment that sentence stops being true. It does **not** gate the words-rendered ink road (`inkPlacement.ts`, D-133(a) face and neck), which is untouched in either position. ⚠ **And the released-tuple table is NOT a control — it is consulted by no door at all** (found at the wire 2026-08-19, fable-1064 §3): `isInkTupleReleased` has no caller outside its own test, so the sentence *"the tuple table governs what sells"* described a door that was never built. What holds today is `MANNEQUIN_ROAD_DEFERRED`, and the release door is a named blocking prerequisite of the mannequin road resuming. Two things are still true with it ON: the released-tuple table (`shared/inkReleasedPlacements.ts`) is EMPTY — measured is not earned, and a tuple is never inferred from a neighbouring placement or the opposite side (the legacy road's rule, bought with 300 credits refunded twice for wrong anatomical side, DECISION_LOG R7-7G) — and the mannequin template a design is plated onto does not exist until the founder's one-time D-138 taste gate is answered
- `CASTING_HAIR_REFERENCE_SCOPE` — `off`/absent, `all`, or `users:<ids>`; **taking her hair from an attached picture** — the first thing the attach door's handle is for (his own example, relayed fable-1047 §3). On, a `refine` may carry a `referenceId`, an ask that names hair without saying WHICH of the three is meant gets the question — *colour? style? or the whole look?* — and the answer routes to the form his ruling gives it: colour as WORDS, style and the whole look as a CROP. Off, and absent means off, a `referenceId` is refused free, no question is composed and no picture is read. Non-off fails startup unless every user named is already inside `CASTING_REFERENCE_ATTACH_SCOPE` — the handle a hair take travels with is minted there, so armed without it a customer meets a question about a reference she has no way to supply; the repaint and cleanup-worker parents ride in through that flag's own check. **The flag is protecting a PROMISE rather than a risky feature**: D-180's condition on every question this product asks is that it never dead-ends, and a question with three chips two of whose roads are unfinished is a dead end wearing a tap target — so it stays shut until all three answers ACT (ruled fable-1074 §3). Two facts belong beside it. **The style answer's ride-along sentence claims the cut and explicitly NOT the colour** (his amendment, fable-1048), and that disclaimer is not a second list: hair is five subject cards since D-142, `colour` declares the one it claims, `style` is that list read backwards, and a hair card whose PROMPT HEADING names COLOUR and which the colour take does not claim reddens the suite — so a future `hairRoots` cannot land in `style` silently. And **hair does NOT have makeup's out-of-class defect, measured on the same bytes that produced makeup's**: handed the cyborg and a golden retriever, a bare hair reader answered *absent* 2/2 each, because a presence question anchored on a body part is a gate while one anchored on a judgement is a prompt. It has a different one — **a drawn hairstyle reads as a real one** (a salon illustration returned *"copper red with auburn tones"*, 2/2) — and that routes rather than refuses (ruled fable-1075 §1): the drawn answer may narrow away the CROP takes and never the WORDS one, because 1052 forbids a reader's verdict that turns a customer away and tolerates one that only chooses a lane
- `CASTING_REFINE_DISPATCH_SCOPE` — `off`/absent, `all`, or `users:<ids>`; **whether the paid half of a refine stops holding the request** (Landing C of `CASTING_V2_REFINE_DISPATCH_DESIGN.md`). Off, `castingV2.refine` awaits the whole render before it answers, so the customer's exposure is the operation's own life: measured off production over 180 worker-settled refines, **median 121 s, p95 276 s, max 390 s, and 1.7% answered past the observed ~305 s gateway wall** — where the socket carrying the answer is gone before the answer exists, the money safe and the REASON lost. On, the same ask claims, charges and dispatches exactly as it does today and then returns a receipt (`kind: "dispatched"`, with the variant and the operation), and the outcome arrives on the surface like every other durable fact. The parent is `CASTING_V2_SCOPE` and **not** the repaint scope, unlike every other sub-flag here: the swap changes WHEN the answer arrives and never what is painted, so a paste-road customer is a legitimate subject — what it cannot be armed over is a user with no refine to dispatch. Two things stay true with it ON: the settled list (Landing A) is unconditional either way — take the socket away before the surface can represent its own terminal outcome and the outcome reaches nobody ALWAYS, which is worse than the 1.7% — and the census still prices the render at settlement, so a dispatched refine is never read by the cost lane as a 200 ms one
- `FAL_KEY` — fal.ai credential; the casting image transport (GPT Image 2 for rolls, Nano Banana Pro for identity work). `OPENROUTER_API_KEY` — text transport (brief interpreter, treatment stage) and image fallback
- `FAL_ACCOUNT_CEILING` (default 20) — the provider account's own concurrent-request ceiling, quoted from its 429. Five paths spend it and `assertFalBudget()` REFUSES TO BOOT if their sum exceeds it, or if any of them is set to zero: `ROLL_IMAGE_CONCURRENCY` 8 + `SIGN_VIEW_CONCURRENCY` 3 + `REFINE_EDIT_CONCURRENCY` 3 + `FAL_CONCURRENCY` 5 + `INK_PLATE_CONCURRENCY` 1 = 20. The plate mint's slot came out of the **courtesy** pool (region reads 6 → 5, 2026-08-18) rather than any paid path, and it costs the panel nothing at the size the reader actually runs: a face scan is 20 segmenter calls, and `ceil(20/6)` and `ceil(20/5)` are both four waves
- `FAL_CONCURRENCY` (default 5, was 6 until the plate mint was wired) — how many fal calls the segmenter may have in flight at once. The account's ceiling is **20 concurrent requests**, and one panel scan asks eleven questions with every bilateral one becoming two more, so an ungated reader spends the whole allowance on one face: measured 2026-08-14, eight panels opened at once returned no rows at all on five of them, with the provider answering `429 concurrent_requests_limit`. Below 20 on purpose — roll dispatch spends from the same allowance
- `ROLL_IMAGE_CONCURRENCY` (default 8), `ROLL_IMAGE_MAX_QUEUE_DEPTH` (default 64) — casting provider budget; roll creation refuses with a real `TOO_MANY_REQUESTS` when a whole roll would not fit
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

## Deploying while a paid roll is in flight

Every push to `main` deploys, and the founder dogfoods paid rolls while that
happens. A deploy that lands mid-roll kills the process holding its candidates.

**This is a known and accepted collision class, not a bug.** Per-slice billing
plus the recovery sweep is the designed answer: a roll is eight independently
refundable units, so losing the process midway costs the user only what they
did not receive. Do NOT build drain infrastructure for it (founder ruling,
2026-08-01). `server/castingV2/deployCollision.test.ts` asserts the contract
end to end — every candidate terminal, money conserved, settled in one pass.

**What it costs the user: up to ~6 minutes.** A `running` operation only
becomes eligible for the sweep once `leaseExpiresAt` passes, so the window is
the remaining lease plus up to one 60s sweep. The lease is 5 minutes
(`DEFAULT_GENERATION_OPERATION_LEASE_MS`) with a 30s heartbeat — ten renewals
of tolerance for a live operation, which is the only thing that constrains how
short it can be.

It was 15 minutes until 2026-08-01, and the real incident (production roll
`78041664`) settled **937 seconds** after creation, six seconds after expiry.
Shortened by founder ruling D-85: a live operation renews every 30s, so the
length only ever governed how long a DEAD one kept its rows non-terminal and
its credits held.

During the window the money is safe and the recovery is correct — it is the
WAIT that is visible. Past ~2 minutes a still-casting tile says so and names
the outcome, so the wait reads as supervised rather than broken.

Full deployment procedure (services, rollback, production env vars, migrations, external registrations, known gaps): see the `deploy-railway` skill.

## Manus legacy

All Manus platform code (OAuth flow, Forge proxies, runtime/debug plugins, dead modules, deps) has been removed. The one intentional remnant: `files.manuscdn.com` / `*.cloudfront.net` stay in the CSP `img-src` (`server/security/securityHeaders.ts`) and SSRF allowlist (`server/security/urlValidator.ts`) because old DB records still reference those hosts — they go when `scripts/migrate-storage-urls.ts` is run against production at final cutover.

Gotchas that remain relevant:

- Session cookie: `sameSite` must be `lax` (not `none`) on plain-HTTP localhost — handled in `server/_core/cookies.ts`.
- `VITE_APP_ID` empty → `verifySession` rejects every session with no visible error. Keep it set.
