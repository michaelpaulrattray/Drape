---
name: verify
description: Build/launch/drive recipe for verifying Drape changes end-to-end in the real app (headless Edge + minted session cookie) on this Windows machine
---

# Verifying Drape changes in the running app

## Launch

1. `pnpm dev` in background → http://localhost:3000 (Express + Vite middleware). First page loads are slow (remote Railway MySQL + on-demand Vite compile) — poll `/api/health` for readiness, and in the browser wait on real page text, never fixed sleeps.

## Auth (no login UI needed)

Mint an `app_session_id` cookie directly — jose HS256 JWT signed with `.env` `JWT_SECRET`, payload `{ openId, appId: process.env.VITE_APP_ID, name }` (all three non-empty or `verifySession` rejects).

- A dedicated test user exists in the dev DB: `openId = 'verify-bot-local'` (approved, emailVerified, no wardrobe sessions/models — good for empty-state flows). Upsert it if missing.
- Do NOT select/print real user rows (PII) — use verify-bot.
- Helper scripts must live in the repo (e.g. `scripts/tmp-*.mts`, run with `npx tsx`) so pnpm deps resolve; use `.mts` (repo is CJS, `.ts` breaks top-level await). Delete them when done.

## Browser

No playwright/chromium-cli here. `npm i puppeteer-core` in the session scratchpad, write a plain `.mjs` script there, run with `node`. Launch system Edge:

```
executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: 'new'
```

Set the cookie with `page.setCookie({ name: 'app_session_id', value: TOKEN, domain: 'localhost', path: '/' })` before the first goto.

## Before you conclude a surface is broken — the four readings that cost a shift

1. **Wait on the thing, never on the clock.** `waitForSelector` on the element itself, and record how long it took. Shift 26 concluded "panel v2 does not appear" from a fixed 4-second sleep; the panel arrives at ~4.9s because it can only ask once a prior query has told it which version is selected, and the database is remote. A fixed sleep reports a slow answer as no answer.
2. **Wait on the BYTES for anything painted.** A background image or a CSS mask that has not decoded photographs as an empty box, which is indistinguishable from the element painting nothing. Preload every `url(...)` off the computed style, then measure.
3. **A reading of a painted thing is a DELTA, never an absolute.** Elements sit over blurred photographs, so an empty 44px box is full of someone else's colour. Photograph the element, then photograph it again with the thing under test disabled (block the stencil at the network layer; force `color: transparent`), and diff. Zero means it painted nothing. Both current instruments live in `scripts/drive-face-panel-evidence.mts`.
4. **Measure the element you are not testing, too.** A new panel took every pixel of the viewer and the photograph beside it rendered 0×0 while every assertion about the panel passed. Assert the neighbour keeps its size.

Every check records what it SAW (D-235) — `scripts/lib/drivePage.mts` has the collector; an `ok` with no observation behind it is not a reading. A driver whose surface is absent must FAIL rather than skip.

## Driving gotchas

- SPA state matters: Zustand stores persist across in-app navigation but reset on `page.goto`. To test in-app flows, click real UI; `goto` only tests cold loads.
- Click-by-text: pick the **deepest** matching element (filter out matches that contain another match), or you'll click a page-level wrapper div and nothing happens.
- Studio sidebar starts collapsed → items are icon-only buttons with `title="Lobby"`, `title="Casting"`, etc.
- Useful text markers: studio header breadcrumb is `Casting Studio` / `Wardrobe` / `Export` (or `Studio` when no tool active); WardrobeStart shows "Choose one of your models or upload a full-body photo".

## Cleanup

Stop the background `pnpm dev`, delete `scripts/tmp-*` helpers.
