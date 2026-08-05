---
name: deploy-railway
description: Deploying Drape to Railway production — services, how deploys trigger, rollback, production env var meanings, running migrations against the production database, and the external-service registrations tied to the domain. Use when deploying, rolling back, changing Railway variables, or running production migrations.
---

# Deploying Drape (Railway production)

> Note: the founder ruling on deploying while a paid roll is in flight stays in `CLAUDE.md` and is always loaded — it is a prohibition, not a procedure.

Production runs in the Railway project **drape-production** (deployed 2026-07-10), fully isolated from dev: its own MySQL, its own R2 bucket, fresh secrets. Live at https://drape-production-0232.up.railway.app.

## Services

- **MySQL** — Railway-managed MySQL. The app reaches it over Railway's private network via the reference variable `${{MySQL.MYSQL_URL}}` (resolves to `mysql://…@mysql.railway.internal:3306/railway`). The service also exposes `MYSQL_PUBLIC_URL` (proxy) — that's what you use to run migrations from a dev machine.
- **Drape** — app service connected to the GitHub repo (`michaelpaulrattray/Drape`), branch **`local-migration`**. Build command `pnpm build`; start command `node dist/index.js` (NOT `pnpm start` — the start script needs `cross-env`, a devDependency; `NODE_ENV=production` is set as a service variable instead). Public domain targets port 3000, pinned via `PORT=3000`.

## How deploys trigger

Every push to `local-migration` triggers a Railway build + deploy. Changing a service variable also redeploys. Current convention: `local-migration` is kept in sync with `main` (`git push origin main:local-migration`).

## Rollback

Railway → Drape service → Deployments → pick the last good deployment → ⋮ → **Redeploy**. That reuses the old build image; no git revert needed. For a bad variable change, fix the variable (auto-redeploys). DB migrations are append-only (drizzle journal) — never rolled back automatically; treat schema changes as forward-only.

## Production env vars (meanings, not values — secrets live only in Railway)

Everything in the "Required .env vars" section of `CLAUDE.md`, plus the production-specific notes:

- `DATABASE_URL` = `${{MySQL.MYSQL_URL}}` (internal URL, no proxy hop)
- `JWT_SECRET` — production-only random secret, distinct from dev (dev sessions can't be replayed against prod)
- `VITE_APP_ID` = `drape-production` (distinct from dev's `drape-local`, same reason)
- `R2_BUCKET` = `drape-production`, `R2_PUBLIC_URL` = that bucket's public r2.dev URL; same account endpoint + API token as dev (token covers both buckets)
- `VITE_ASSETS_BASE_URL` = `<prod R2_PUBLIC_URL>/assets` — overrides the dev-bucket fallback in `shared/const.ts`; must match `R2_PUBLIC_URL`'s origin or the CSP `img-src` blocks the assets. The `assets/` tree was copied from `drape-dev` on 2026-07-10.
- `STRIPE_WEBHOOK_SECRET` — signing secret of the Stripe (test-mode) webhook endpoint `https://<domain>/api/webhooks/stripe`, subscribed to the 8 event types handled in `server/stripe/webhooks.ts`
- `NODE_ENV=production`, `PORT=3000`
- Gemini/Stripe/Resend/Google OAuth keys are currently shared with dev (Stripe in test mode)

Vite inlines `VITE_*` vars into the client bundle at build time, so they must be present as Railway variables (they are available during build), and changing them requires a rebuild, not just a restart.

## Migrations & one-off SQL against production

`pnpm db:push` (drizzle generate + migrate) from a dev machine, with `DATABASE_URL` overridden to the **MYSQL_PUBLIC_URL** for that one command — never put the prod URL in `.env`. Initial data was seeded with one-off SQL (single-use invite code, then `UPDATE users SET role='admin'` after first signup); `seed.ts` refuses production by design.

## External-service registrations tied to the domain

- **Google OAuth**: the Railway domain's `/api/auth/google/callback` is an authorized redirect URI on the shared OAuth client. A new domain (custom domain later) needs the same registration.
- **Stripe**: webhook endpoint per environment; the raw-body route must stay registered before `express.json()` in `server/_core/index.ts` or signature verification breaks (learned in production).
- **Resend**: no verified sending domain yet — emails send from `onboarding@resend.dev`, which only delivers to the Resend account owner. Email/password signup verification is therefore broken for everyone else until a domain is verified in Resend and the `from:` in `server/routes/emailVerification.ts` is updated. Google OAuth signups are unaffected.

## Known gaps at deploy time

- `hero/*` keys (home-page hero media, served via `server/heroProxy.ts`) were never re-hosted to R2 — the hero 502s in dev and prod alike. Needs source files + `scripts/upload-hero-v3.mjs`.
- `VITE_STRIPE_PUBLISHABLE_KEY` unset in prod — client-side checkout UI unavailable (server warns at boot).
