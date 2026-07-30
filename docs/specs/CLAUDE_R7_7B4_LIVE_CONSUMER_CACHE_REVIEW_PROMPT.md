# R7-7B4 live-consumer and cross-tab cache closure — independent review

You are the independent, read-only reviewer. Review the staged diff at baseline
`51f3acb` against the ratified R7-7B cutover plan and the surrounding production
code. Do not edit, stage, commit, run a database/browser driver, contact
production, change an environment variable, push, deploy, or enable
`R7_SNAPSHOT_READ_SCOPE`.

Return exactly one verdict:

- `APPROVE — safe to commit R7-7B4 live-consumer and cross-tab cache closure locally`
- `REQUEST CHANGES` with a concrete, reachable blocker.

Keep non-blocking observations separate. This review can authorize only a local
commit.

## Intended staged scope

Exactly these 12 files should be staged:

1. `client/src/features/operations/castProjectionSync.ts`
2. `client/src/features/operations/GenerationOperationBridge.tsx`
3. `client/src/features/casting/components/SlotVersionHistory.tsx`
4. `client/src/features/casting/components/CastProfilePanel.tsx`
5. `client/src/features/studio/takeover/CastingTakeover.tsx`
6. `client/src/pages/DrapeStudio.tsx`
7. `server/r7-cast-projection-sync.test.ts`
8. `server/r7-b4-live-consumers.test.ts`
9. `scripts/drive-r7-b4-browser.mts`
10. `scripts/r7-b4-browser-seed.mts`
11. `scripts/r7-b4-browser-drive.mts`
12. `scripts/tsconfig.r7-b4-browser.json`

The intentional two-line Resend sender/reply-to change in
`server/routes/emailVerification.ts` must remain unstaged. The founder's future
Asset Library ownership note in `docs/specs/DECISION_LOG.md` must remain
unstaged. `.agents/`, `.codex/`, `.claude/settings.local.json`,
`CLAUDE.local.md`, brand files, plans, and review prompts must remain untracked
or unstaged.

## Product claim to challenge

The server-side B4 projection adopters are already committed. This final B4
slice closes the remaining browser-consumer and cache-delivery boundary:

- Canvas Cast roots and comp cards, the pop-out spawn menu, and the library
  chooser already render `generation.packageState` selected slots.
- Cast Profile already consumes `models.get` plus `generation.packageState`.
- No client consumer gets to choose a snapshot/package/version or interpret
  ledger history as current truth.
- A terminal operation, restore, or direct name save now sends a finite
  model-id-only signal to other open tabs. Receivers only invalidate and
  re-read server-owned projections.
- Cast deletion remains a separate, stronger subject-deleted signal that can
  reset Studio state; this signal does not weaken or replace it.
- With `R7_SNAPSHOT_READ_SCOPE` unset/off, R6 remains the live server reader.

## Required challenges

1. Confirm the staged set and baseline exactly. Confirm the two intentional
   unstaged tracked changes remain outside the index.
2. Trace Canvas root rendering in `useSheetController.ts` and `CastNode.tsx`.
   A model-backed root must use the selected frontClose slot; a comp card must
   use the selected package tiles. The durable board item image remains the
   placement-time fallback, not a new authority.
3. Trace `SpawnMenu.tsx` and `ModelCardChooser.tsx`. They must use the same
   package-state slot projection, with no ledger/newest-row fallback.
4. Trace `CastProfilePanel.tsx`. Identity/lifecycle data must come from the
   adopted `models.get` response and package presentation from package state.
   The cache signal must not become identity authority.
5. Review `castProjectionSync.ts` as an untrusted browser-message boundary.
   The event must contain exactly `{type, modelId, nonce}`; require a positive
   safe-integer model id and bounded nonempty nonce; carry no name, URL,
   storage key, prompt, schema, preferences, agency id, user id, receipt,
   snapshot id, or selection.
6. Confirm BroadcastChannel is primary and localStorage is only a fallback.
   The localStorage event must not replay to a tab opened later, and malformed
   browser state must be ignored.
7. Confirm dual delivery is nonce-deduped, the seen set is bounded, unsubscribe
   closes/removes both listeners, SSR is a no-op, and invalid model ids do
   nothing.
8. Prove there is no broadcast loop. A receiver invalidates/refetches only and
   never republishes. Multiple tabs independently observing one terminal
   receipt may cause bounded duplicate invalidation, but never a write,
   generation, spend, or repeated signal loop.
9. Review the exact caller allowlist. Runtime importers of
   `castProjectionSync.ts` must be only:
   `GenerationOperationBridge.tsx`, `SlotVersionHistory.tsx`,
   `CastProfilePanel.tsx`, `DrapeStudio.tsx`, and `CastingTakeover.tsx`.
   The test must pin this repo-wide.
10. Trace `GenerationOperationBridge`. It may publish only after durable
    terminal-result invalidation. It must preserve credit invalidation,
    origin-board item/edge invalidation, and all prior receipt/retry/deletion
    behavior.
11. Challenge the complete projection invalidation set:
    `models.list`, `models.get`, Wardrobe minted/draft lists,
    `lobby.recentWork`, `boardOps.listCastableModels`, `boards.getItems`,
    `boards.getItemModelInfo`, `generation.packageState`,
    `refreshSlotsPlan`, `mintPackagePlan`, and `exportPlan`.
    Determine whether any warm B4 projection is missing.
12. Confirm unbounded invalidations are intentional only where the cache key
    lacks a model id (for example every warm board-items query), and cannot
    mutate or reveal a foreign subject.
13. Trace restore publication. `SlotVersionHistory` may announce only after
    `restoreSlotVersion.mutateAsync` returns successfully (the transaction has
    committed), never on optimistic selection, refusal, or error.
14. Trace all direct display-name writers. Profile rename, Studio draft-name
    persistence, and takeover draft-name persistence must publish only after
    the server mutation resolves. Failed saves must not announce false truth.
15. Confirm operation-backed writers such as mint, refresh, iterate, headshot,
    Canvas recast, and pin rely on their durable terminal receipt and therefore
    reach the bridge; no operation result is silently omitted.
16. Confirm deletion synchronization remains separate and stronger. A
    projection-changed event for a deleted id must not revive it; the server
    re-read remains authoritative.
17. Confirm this slice adds no route/schema/migration/billing/storage/provider
    or server-read-authority change, no Railway variable, and no rollout
    enablement.
18. Challenge the real-browser seed. It must refuse production app ids, accept
    only the development `railway` database or the exact guarded scratch-name
    regex, use only `verify-bot-local`, create bounded fixture rows/data-SVG
    URLs, bootstrap through the production snapshot service, and print only
    ids/fixture metadata—never credentials.
19. Challenge cleanup in the seed. It must delete only the exact verify-bot
    fixture by owner plus fixed prompt/board name; it must tolerate the shared
    pre-0010 dev schema for cleanup without pretending it can run the B4 gate
    there.
20. Challenge the all-in-one browser driver. It must accept no arguments,
    refuse a production app id, require a MySQL source whose database is
    exactly `railway`, refuse any stale `drape_r7_b4_browser_*` database, create
    exactly one regex-guarded unique scratch database, apply migrations only
    through 0010, and set snapshot scope only for the fixture user in the
    temporary child process.
21. Confirm the driver starts one hidden local dev process, health-polls rather
    than sleeping, kills exactly that process tree in `finally`, and drops only
    its exact scratch database with retries in `finally` on success or failure.
22. Confirm the browser child refuses production, uses a short-lived
    verify-bot session cookie, uses desktop Edge headlessly, and targets only
    the loopback base URL supplied by the parent.
23. Assess the browser assertions as meaningful:
    - tab B first warms the library cache;
    - tab A opens the real model chooser and renders three distinct selected
      package views in the comp card;
    - tab A loads the real Cast Profile and commits a rename;
    - tab B sees the rename within 15 seconds without waiting for the
      30-second list stale time/focus;
    - tab B loads the real Canvas board and renders three distinct selected
      package views.
24. Confirm DOM polling is bounded and assertion-driven. The direct Studio
    route load is a headless-harness accommodation for a Framer Motion
    lobby-to-studio exit that Chromium can throttle; it must not weaken the
    actual Profile/query/mutation/cache assertions.
25. Review the browser gate source test. It should pin production refusal,
    scratch prefix/stale refusal, migration cap, per-user scope, exact process
    kill, cleanup, verify-bot identity, bootstrap, and the three browser
    outcomes.
26. Review behavioral coverage in `r7-cast-projection-sync.test.ts`: primary
    delivery, fallback payload, dual-transport dedupe, malformed rejection,
    unsubscribe, SSR, and invalid-id behavior.
27. Review `r7-b4-live-consumers.test.ts`: selected-slot consumer wiring,
    minimal payload, complete invalidation inventory, all direct-name/restore
    publishers, exact runtime caller set, pure selected-slot tile behavior,
    and guarded browser-driver source.
28. Look specifically for a timing hole where a second tab can retain a warm
    cache because another tab acknowledged the operation receipt first. The
    new delivery must close that without making the client an authority.
29. Look for memory/resource leaks: BroadcastChannel instances, event
    listeners, nonce history, test/browser processes, local dev children, DB
    pools/connections, and scratch databases.
30. Confirm no private data can appear in browser messages, test/browser logs,
    error strings, or the final JSON evidence.

## Recorded evidence to verify against the staged tree

- `pnpm check` — clean.
- `pnpm exec tsc -p scripts/tsconfig.r7-b4-browser.json` — clean.
- Focused affected suites — 70/70 before the final caller-allowlist test; the
  final two focused suites then passed 9/9 including that added test.
- Full unit suite — final rerun: 2,669 passed / 168 environment-gated skipped /
  0 failed. An earlier run had the known unrelated
  `emailVerification.test.ts` 5-second dynamic-import timeout; it passed alone
  2/2 in 1.57 seconds, and the untouched full rerun was green.
- `pnpm build` — passed.
- `git diff --check` — clean apart from ordinary Windows line-ending notices.
- Guarded real-browser drive — passed:
  `chooserSelectedViews: 3`, `canvasSelectedViews: 3`,
  `crossTabRename: true`.
- The successful drive created
  `drape_r7_b4_browser_1784882921195_9ae225` on the Railway development MySQL
  proxy, applied 0000–0010, and dropped it in `finally`.
- Earlier browser-harness attempts failed only on polling/selector/viewport or
  cold-start mechanics; every attempt printed its exact scratch drop. One
  partial fixture created during the initial shared-dev schema discovery was
  removed by the exact fixture cleanup. No migration was applied to the shared
  dev database.
- Final process audit: only the Codex runtime (`node_repl` plus its worker) and
  the long-lived Railway helper remained. No Vitest, pnpm, tsx, Edge, browser
  driver, or dev-server process remained.

## Scope reminder

Even an approval may authorize only committing these staged files locally. It
must not authorize push, deploy, migration, production contact, Railway
variable changes, snapshot-read scope enablement, convergence, pin retirement,
Wardrobe B5, or any later R7 work.
