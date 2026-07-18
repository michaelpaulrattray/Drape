# Casting System R6 — W6 Execution Plan

**Author:** Fable 5 (investigation + plan). **Date:** 2026-07-18. **Verified at:** `3448ce5` (R6 W5-F, current production HEAD).
**Scope source:** founder's focused W5 production drive — eight confirmed live findings. Investigation only at this point; no code or documentation beyond this plan has been touched.
**Boundaries for the executor:** implement exactly these batches; do not stage/commit/push/deploy/migrate/contact production without founder approval; never touch `.agents/`, `.codex/`, `CLAUDE.local.md`, `.claude/settings.local.json`, or `docs/specs/CLAUDE_*.md`; stop at each review gate (§11).

## 1. Executive verdict

**READY FOR EXECUTION.** All eight findings reproduce in the code at `3448ce5`; no diagnosis was contradicted (two were sharpened — §3). Items 1–3 are one defect wearing three faces: casting work is owned by the Casting surface's React lifecycle, and the board learns about it only through paths that require the surface to still be open. W6 builds **one background-operation handoff** (same-tab, §6/W6-A) rather than three flag patches. Items 4–7 are bounded corrections with confirmed root causes, each in one or two files. Item 8 is verified functional server-side; W6 ships only a refusal-visibility fix and records the UX rethink as R7. No founder ruling is required: every correction derives from the stated required outcomes plus existing rulings; the two judgment calls this plan makes are flagged for veto in §5.

## 2. Evidence table

| # | Founder finding | Current code path | Confirmed root cause | Class |
|---|---|---|---|---|
| 1 | Fresh cast: node stayed empty, no generating state; draft landed only via Open Draft | `useCastingGeneration.ts:229` (`beginPendingCast`), `App.tsx:32-46` (toast-only consumer), `CastingTakeover.tsx:177-187` (`needsBoardLanding` requires a headshot at close), `BoardPage.tsx:687-700` | The pending-cast registry (W5-F) carries no origin (`boardId`/`itemId`) and has one consumer: an app-level toast. `useGenerationJobs` — which drives the node's progress card via `useCastNodeController` — is never started for a takeover cast. The only landing paths are `onMinted`/`onDraftLanded`/`startClose`, all of which require an open takeover; a background success therefore lands nowhere until the reopened draft session closes. | **W6-A** |
| 2 | Background iteration: no generating state on the node or a reopened session; result appeared silently later | `useCastingGeneration.ts:339` (`if (!session.isCurrent()) return;`), `:382` (packageState invalidation *behind* the guard), `useCastingRefreshStore.ts` (iterate never begins/ends an angle) | The post-close continuation correctly refuses to write the dead session (W4 contract) but **also drops the cache invalidation and any handoff** — the board updates only on a natural refetch (`staleTime` 15s / remount): the observed "silently appeared later". No per-angle in-flight mark is ever set for iterate, so neither the board tile, the strip (`ViewTabs.tsx:235`), nor a reopened session can show truth. | **W6-A** |
| 3 | Could not leave Casting while Add Views ran, despite copy promising continuation | `CastingTakeover.tsx:330` (`if (isCasting) return;` in `attemptClose`), `CastModelModal.tsx:336-341` (W5-F continuation copy), `w5-post-close.test.ts:84-89` | **Confirmed contradiction.** W5-F made the modal dismissible during generation and added "These views will continue generating…", but the takeover's close gate was never updated: `isCasting` covers mint, upgrade, and stays-draft Add Views alike, and blocks every close. The background mechanics already survive close: `useCastGate` begins per-angle refresh marks before awaiting and ends them in `finally` (`useCastGate.ts:71,193`), its failure toasts and invalidations run unconditionally (`:137-144`), and ghost tiles already render refreshing spinners (`CharacterSheetImageArea.tsx:143`). Only the door is locked. | **W6-A** |
| 4 | Mint modal: "she/her" on a male draft; complete six-view package still showed tier choices | `CastModelModal.tsx` — all 10 she/her strings live in this one file (`:88,215,220-222,228,244,300,390`); tier picker renders unconditionally (`:256`) | Hardcoded gendered copy; no collapsed state for a complete package — three tiers all reading "Complete" with both doors dead (`canAddViews` false via `selectedGenerates`). | **W6-B** |
| 5 | Typed "Haniel", clicked Keep editing, name lost on reopen | `CastModelModal.tsx:110` (modal-local `useState`), `:404` (`onClick={onClose}` discards), prefill reads `useCastingFormStore.modelName` which was never written | The name exists only in modal-local state; "Keep editing" calls bare `onClose()`. The only persistence path is `mintPackage`'s stays-draft nickname (`mintPackage.ts:440-447`), which requires paying for views. The correct server surface already exists: `models.update` (`models.ts:108`) — display-name-only, strict schema, cannot touch status. | **W6-C** |
| 6 | After a successful identity edit, the open client disagreed with the server until reload | Server: `castingRefinement.ts:304-313`; commit: `identityCommit.ts:362-368`; client: `useCastingGeneration.ts:357-360` | **Diagnosis sharpened — the gap is on both sides.** `commitIdentityEdit` computes and returns `preferences`, but the iterate route's identity response **omits it** (returns only `masterPrompt` + `technicalSchema`). The client then applies only `masterPrompt`; `setCurrentTechnicalSchema` exists in the bindings and is never called, and the form store is never patched. Refund-then-retry behavior was correct (M20 paths verified untouched). | **W6-D** |
| 7 | Deleting every node leaves the stale lobby thumbnail | Client: `BoardPage.tsx:210-227` (`if (!newest?.imageUrl) return;`); route: `boards.ts:124` (`z.string().url().optional()`); schema: `drizzle/schema.ts:751` (nullable `text`) | Confirmed twice over: the effect returns instead of clearing, and the route schema cannot express `null`. The DB column is already nullable — **no migration**. `updateBoard`'s `cleanData` filter drops only `undefined`, so `null` flows through unchanged. The lobby already renders a null-thumbnail fallback (`RecentWorkCard.tsx:121-126`). | **W6-E** |
| 8 | Verify version-history restore behavior | `mintPackage.ts:633-777` (`getSlotVersions`, `executeRestoreSlotVersion`), `useSheetController.ts:174-192`, `CastNode.tsx:636-698`, `restoreSlotVersion.test.ts` | **Functional as ruled.** Restore is a copy-forward append (`pointsCost: 0`, `restoredFromAssetId` provenance, always role `display`) that never deletes or mutates siblings; cross-revision restores refuse (§7.4 membership → `crossRevisionRestore` copy) and the client pre-seals incompatible thumbs with the ruled tooltip; two-step select-then-commit and no-op guards are in place. **One gap:** `restoreMutation` has **no `onError`** — a server refusal ("already the current image", head-changed race) is silently swallowed: "Restoring…" ends and nothing visibly happens. | **W6-F** (refusal visibility only; redesign = R7) |

## 3. Challenges and sharpened diagnoses

1. **Item 3 — the stated diagnosis is right and the fix is smaller than it looks.** The founder's read ("code blocks takeover closing while `isCasting` is true, contradicting the copy") is exactly what the code shows. What the code *also* shows: everything downstream of the close already works in the background — per-angle marks end in `finally`, failure toasts and cache invalidations run unconditionally after the await, and the board's ghost tiles already spin. W6-A opens the door and unifies the handoff; it does not need to build background execution for Add Views.
2. **Item 6 — not purely a client defect.** The server response omits `preferences` even though the commit computes them; the client fix alone cannot reach the form. One additive field on the identity branch of the response, plus the client application. The image-only branch stays byte-identical — its *absence* of identity fields becomes the client's discriminator, which is what keeps a cosmetic edit structurally unable to rewrite identity documents.
3. **Item 1 — "draft only populated after Open Draft" is precise.** The landing runs in `startClose` of the *reopened* session (`needsBoardLanding` + headshot present → `onDraftLanded`). So the node fills on the reopened session's close, which from the founder's seat reads as "after Open Draft was clicked". The fix moves the durable landing to the settle event itself.
4. **W5's R7 boundary is partially superseded by this instruction.** W5 §9 listed "Add-Views leave-and-resume beyond same-tab modal dismissal" as R7. The founder's W6 item 3 explicitly requires leaving Casting (same tab) while Add Views continues. W6 implements the same-tab case; cross-reload/cross-tab durability remains R7 (§10).
5. **Item 5 interacts with a W5 honesty rule — superseded by its own premise being removed.** `confirmArgsForDoor` deliberately refuses to harvest a fresh-cast name as a stays-draft nickname *because the fresh field's label promised "this mints her identity"* (`CastModelModal.tsx:37-42`, pinned by `castModelModal.test.ts:158-166`). Item 4 removes that label (pronouns + honesty), and item 5's required outcome makes the name a savable draft label. With the label now reading "saved as this model's draft label until you mint" on both non-upgrade paths, the carve-out's premise is gone: the stays-draft door carries the trimmed name on both paths, and `confirmArgsForDoor` + its tests simplify. Derived from the founder's own required outcomes + D-55/FR-3(B); flagged for veto, not asked.

## 4. Founder rulings already settled — do not re-ask

- **D-55 / FR-3(B):** `agencyId` (assigned at mint) is the stable identity key; the name is display metadata; renaming never alters visual identity; the mint ceremony still requires a name. W6-C persists a *draft label* through the existing `models.update`; it never mints and never touches status (the route structurally cannot).
- **D-40 (the surface updating IS the feedback):** background iterate completion lands silently on the node/strip — no toast. The one background-cast success/failure toast (W5-F, App-level) remains the only notice; W6-A must not add duplicates.
- **D-15 (every cost is plan-derived, every spend deliberate):** nothing in W6 adds an automatic charge; the collapsed "Ready to mint" state keeps plan truth ("No new views to generate") and never invents a price.
- **§14 mint integrity:** blockers render with their own copy and hold the mint door shut — the collapsed complete-package state must keep the integrity block and its "Review and refresh views" exit verbatim.
- **W4 session contract (close is authoritative at close-start):** `invalidateSession()` before the exit timer; no continuation may write a closed or newer session. W6-A keeps every existing `captureCastingSession` guard; the registry publishes plain data and consumers apply it against *current* state only.
- **D-53 restore semantics:** copy-forward append, free, unpinned, `display` role, never a backward mutation; §7.4 revision-compatibility gating. W6-F changes none of it.
- **Same-tab registry posture (recorded in `useCastingRefreshStore.ts:12-13`):** "Server-persisted job state remains R7; this registry only covers work started in this client." W6-A extends this posture; it does not build server job state.
- **Identity documents change only through deliberate authorized operations** (Batch C/R7 reconcile removal): W6-D applies *server-returned committed* documents — it reintroduces no reconcile and no image-derived rewrite.

## 5. Genuinely unresolved founder questions

**None that block implementation.** Two judgment calls are made and flagged for veto rather than asked, because ratified rulings plus the W6 instruction imply them:

1. **A true mint (`mint: true`) still blocks close in W6.** The founder's required outcome names Add Views only. Unblocking mint touches the landing/naming/close choreography (`onMinted` → node fill → takeover close) and is deliberately out of scope; the block's copy stays honest ("mint in flight — landing imminent"). Reversible in R7 by routing mint through the same registry.
2. **The stays-draft door harvests the typed name on both non-upgrade paths** once the field's label says "draft label until you mint" everywhere (§3.5).

## 6. The unified background handoff (design for W6-A)

Generalize `pendingCastRegistry.ts` (keeping its W5-F-tested exactly-once `take()` semantics and test reset hook) into a module-level **casting-operations registry**:

```ts
interface CastingOp {
  id: number;
  kind: 'newCast' | 'iterate' | 'addViews';   // stays-draft AND upgrade both ride 'addViews'
  modelId: number | null;                     // null until models.create returns (newCast)
  origin: { boardId: number; itemId: number } | null;
  angles: CanonicalViewAngle[];               // in-flight views ('frontClose' for newCast/headshot iterate)
  startedAt: number;
}
```

- **Begin/settle callers:** `useCastingGeneration.handleGenerate` (newCast — replaces `beginPendingCast`), `useCastingGeneration.performIteration` (iterate), `useCastGate.handleCastAndContinue` with `stayDraft`/`upgrade` (addViews). The **registry**, not each caller, mirrors angles into `useCastingRefreshStore` — one per-angle truth for the Studio strip, Package Health, and board tiles. (This gives iterate its missing in-flight mark for free.)
- **Origin:** BoardPage registers an origin provider while a takeover session is active (it already maintains `activeCastSessionRef`); ops capture origin at begin. The temp→real item-id swap in `createCastNodeMutation.onSuccess` additionally remaps any live op's `origin.itemId`, exactly as it already remaps `castTakeoverItemId`.
- **Settle publishes once** (registry `take()`), to three subscribers:
  - **App-level (always mounted):** owns the one toast (unchanged copy for newCast success/failure; iterate/addViews settle silently per D-40 — addViews per-slot failures keep their existing refund-honest toasts from `useCastGate`) **and the durable landing**: on newCast success it fires `boardOps.fillFromLibrary` directly via the tRPC client with the op's `{boardId, itemId, modelId}` — so auto-landing survives navigation to another board or the lobby. "Open Draft" stays as the toast's secondary action and guards against its origin board being unmounted.
  - **BoardPage (per board, optics only):** on newCast begin → `startJob(itemId, 'castHeadshot')` (the node renders the paid-wait progress card immediately — `useCastNodeController` already does this from the job store); on success → `completeJob` + `useOptimisticFills.setFill(itemId, { imageUrl, modelId, label, draft: true })` (the D-55 pattern from `handleDraftLanded`) + `packageState` invalidate; on failure → `clearJob` (node returns truthfully to its empty front door; the App toast carries the server's refund-honest sentence). On iterate/addViews settle → invalidate `packageState` + credits — restoring the invalidation the session guard currently swallows.
  - **Open Casting session:** `CastingWorkspace` consults the registry at hydration — an in-flight op for its `modelId` renders truthful state (the strip's refreshing marks come free via the store; plus one quiet genState line, "An earlier edit is still finishing"). On settle with a matching *current* `modelId` (checked via `getState()` at settle time, never captured closures), apply the outcome's `{angle, url, assetId}` into `currentAssets`/`pushHistory`. No toast.
- **Stale-session writes stay impossible:** every existing `captureCastingSession` guard is untouched; the registry never writes casting stores from continuations.
- **Same-tab is sufficient for W6.** The server already owns every durable truth (charges, refunds, asset rows, drafts, refunds-on-failure). What was missing is same-tab *presentation* and *landing*. After a reload or in another tab, in-flight spinners are invisible but all results, charges, and refunds remain correct and appear on refetch — the recorded R7 posture. **Server-readable in-flight truth is not required for W6** and stays R7.

## 7. Implementation batches (dependency/risk order)

### W6-A — Unified background handoff + Add Views close (items 1–3)

**Objective:** the originating node shows generation from the moment work starts and lands results automatically, exactly once; a closed-then-reopened session tells the truth about in-flight edits; Add Views closes freely while its copy's promise actually holds. No duplicate notices, no duplicate charges, no writes into dead sessions.

**Files:**
- `client/src/features/casting/pendingCastRegistry.ts` → generalized casting-ops registry (§6); keep `resetPendingCastRegistryForTests` semantics.
- `client/src/features/casting/hooks/useCastingGeneration.ts` — begin/settle for newCast + iterate; iterate's angle rides the registry's refresh-store mirroring; post-close settle replaces the bare `return` at `:339` (store writes stay guarded; the settle carries the data out).
- `client/src/features/studio/hooks/useCastGate.ts` — op kind tracking (`'mint' | 'addViews' | 'upgrade'`, exposed to the host); begin/settle for stays-draft/upgrade; its own refresh-store begin/end moves into the registry.
- `client/src/features/studio/takeover/CastingTakeover.tsx` — `attemptClose` blocks **only** `mint: true` in flight; leave-confirm gains the addViews branch ("Your new views keep generating and will appear on this card"); Esc path follows.
- `client/src/features/studio/components/CastingWorkspace.tsx` — hydration-time registry check + settle application (current-modelId gated).
- `client/src/features/boards/BoardPage.tsx` — origin provider registration; subscriber (jobs, optimistic fill, invalidations); op remap in `createCastNodeMutation.onSuccess`; `handleBackgroundDraftReady` skips `originNeedsLanding` when the node already landed.
- `client/src/App.tsx` — subscriber consumes the new outcome shape; durable `fillFromLibrary` landing; toast copy unchanged.
- `client/src/pages/DrapeStudio.tsx` — consumes the `useCastGate` signature change (no takeover gate there).

**Invariants:** W4 session-token contract untouched; exactly-once landing via `take()`; no toast for silently-landing results (D-40); the one W5-F toast remains the only newCast notice; refunds/failure copy remain the server's sentences; `useCastingRefreshStore` stays the single per-angle truth; a repurposed origin node (user filled it with another model mid-flight) is never overwritten — landing checks the item is still unbound and degrades to toast-only ("saved to Drafts").

**Acceptance:** the eight-leg drive matrix rows 1–4 (§9) pass; closing during a mint still blocks with honest copy; no duplicate toast or double-charge in any leg.

### W6-B — Mint modal truth (item 4)

**Objective:** neutral language everywhere; a complete package collapses to "Ready to mint"; integrity blockers and plan-derived pricing survive verbatim.

**Files:** `client/src/features/studio/components/CastModelModal.tsx`; `server/castModelModal.test.ts` (copy pins updated).

**Fix:** replace all 10 she/her strings with neutral phrasing ("this model", "its identity"). Collapsed state when `tiers && TIER_ORDER.every(t => tiers[t].missing.length === 0)` (**`missing.length` is truth, never `cost`**): hide the tier picker and the Add views door; render "Ready to mint — all six views are complete. No new views to generate." + name field + mint door + the §14 integrity block (unchanged, with its "Review and refresh views" exit — a complete package can still be integrity-blocked by stale views, and the door stays shut). Collapsed confirm passes `tier: 'production'` (missing empty on all tiers; charge zero either way).

**Note:** the comment at `CastModelModal.tsx:40` records the old label as founder-ruled wording; this instruction supersedes it — the replacement keeps the *function* (fresh-path name field is the mint trigger) with neutral words.

### W6-C — Draft-name persistence (item 5)

**Objective:** a typed draft name survives "Keep editing" without minting, prefills future mint attempts, and fails loudly when it can't save.

**Files:** `client/src/features/studio/components/CastModelModal.tsx` (`onClose` → `onClose(typedName)`; label copy per §3.5; `confirmArgsForDoor` simplification); `client/src/features/studio/takeover/CastingTakeover.tsx` + `client/src/pages/DrapeStudio.tsx` (host persistence); `server/castModelModal.test.ts`.

**Exact persistence rule:** on modal dismissal ("Keep editing" / scrim / Esc), when a model row exists (`currentModelId` set), the session is not a minted edit, and the trimmed name is non-empty and differs from the stored name → call `models.update` (existing display-only mutation; **no new server surface, structurally cannot mint or change status**), write `useCastingFormStore.setModelName` (title + prefill), invalidate `models.get` + `boardOps.listCastableModels`. **Failure surfacing:** visible toast "Couldn't save the name — it will not be remembered"; the form store still updates for the open session; never silent, never a mint. Pre-headshot sessions (no model row yet): the name stays in the form store and rides `models.create`'s existing `name` parameter. A concurrent stays-draft mintPackage nickname write is last-write-wins on the same value the user typed — harmless by construction.

### W6-D — Post-identity-edit client synchronization (item 6)

**Objective:** after a successful identity edit, form, Profile/Spec, master prompt, and server row agree immediately; image-only edits remain structurally unable to touch identity documents.

**Files:** `server/routes/generation/castingRefinement.ts` (identity branch adds `preferences: commit.preferences` — one additive field; image-only branch byte-identical); `client/src/features/casting/hooks/useCastingGeneration.ts` (`performIteration`, inside the existing `session.isCurrent()` guard: when the response carries identity fields, apply `setCurrentMasterPrompt` + `setCurrentTechnicalSchema(result.technicalSchema)` + `useCastingFormStore` via `editablePreferencesFromStored(result.preferences)` — the same helper hydration uses, so Open-choice flags stay read-only schema truth per W4 — and invalidate `models.get`; when absent, touch nothing).

**Edge accepted:** form fields changed *while* the edit was in flight are overwritten by server truth on settle; the refine bar is single-flight per session (`genState.isGenerating`), so the window is nearly empty, and server truth winning is the required outcome.

**Tests must distinguish the classes:** identity response carries all three documents; image-only response carries none; client application is conditional on their presence.

### W6-E — Board thumbnail lifecycle (item 7)

**Objective:** removing the last image-bearing node clears the lobby card; a remaining image-bearing node keeps newest-wins; no stale debounced write survives a state change.

**Files:** `server/routes/boards.ts` (`thumbnailUrl: z.string().url().nullable().optional()`; `cleanData` already passes `null` — verify with a test, don't re-filter); `client/src/features/boards/BoardPage.tsx` (thumbnail effect: extract the decision into a pure helper — `nextThumbnail(items, current): { set: string } | { clear: true } | null` — and add the clear branch: `items` loaded ∧ zero image-bearing rows ∧ effective current thumbnail (`lastThumbnailRef.current ?? board.thumbnailUrl`) non-null → same 4s debounce → `thumbnailUrl: null`, `lastThumbnailRef.current = null`).

**Stale-write protection is structural:** every `items` change re-runs the effect and its cleanup cancels the pending timer — a delete-then-undo (optimistic restore) or a landing inside the debounce window cancels the pending clear and re-derives from current truth. No migration (`drizzle/schema.ts:751` is nullable `text`); the lobby fallback render already exists.

### W6-F — Version-history refusal visibility (item 8)

**Objective:** restore refusals become visible; nothing else changes; the larger history UX is recorded as R7.

**Files:** `client/src/features/boards/canvas/nodes/useSheetController.ts` — `restoreMutation` gains `onError: (err) => toast.error(err.message)` and a `slotVersions` invalidation on settle (a head-changed race re-syncs the thumb strip).

**Documented findings (no code):** copy-forward restore verified (appends, never deletes siblings); cross-revision refusal verified server-side (`§7.4` membership) and pre-sealed client-side with the ruled tooltip; two-step select-then-commit and no-op guards in place; `restoreSlotVersion.test.ts` covers the server. **Do not redesign history in W6.**

## 8. Data ownership, lifecycle, and race analysis

| Concern | Owner | Lifetime |
|---|---|---|
| Durable results, charges, refunds, draft rows | Server (unchanged) | Permanent |
| In-flight op records | Casting-ops registry (module scope, same tab) | begin → settle; test reset hook |
| Per-angle in-flight display | `useCastingRefreshStore` (fed by the registry) | mirrors op angles |
| Per-node progress card | `useGenerationJobs` (fed by BoardPage subscriber) | startJob → complete/clear |
| Durable board landing (newCast) | App-level subscriber → `fillFromLibrary` | once per op via `take()` |
| Node optics (fills, jobs) | BoardPage subscriber, per board | while that board is mounted |
| Session application of settled edits | Open workspace, gated on current `modelId` at settle time | while a matching session is open |

**Races:**
- **Immediate close:** op registered before the first await; `invalidateSession()` at close-start keeps every store write guarded (W4 untouched); node job already running; settle lands via subscribers.
- **Reopen before completion:** new session token → old continuation cannot write it; hydration reads the registry for truthful in-flight state; settle applies only if the live store's `modelId` matches *at settle time*.
- **Navigation to another board / lobby:** BoardPage subscriber unmounts; the App subscriber still lands `fillFromLibrary` with the op's own `{boardId, itemId}`; returning refetches truth; "Open Draft" no-ops gracefully without its host.
- **Duplicate nodes for one model:** landing targets the op's originating `itemId` only; other placements update through `packageState`.
- **Origin node repurposed mid-flight:** landing checks the item is still unbound; otherwise skip the fill — the toast's "saved to Drafts" stays true.
- **Temp→real id swap during an op:** registry remap in `createCastNodeMutation.onSuccess`, mirroring the existing takeover-id swap.
- **Operation failure/refund:** server refund paths unchanged; one publish; App shows the server's refund-honest sentence; node job cleared to its true state.
- **Unmount + late responses:** closures over `utils`/queryClient survive unmount (app-level QueryClient); store writes stay session-gated; `take()` makes publish exactly-once even if success and failure paths race.
- **Concurrent same-angle edits (reopened session starts a new edit while an old op is in flight):** the strip's refreshing mark on that angle is visible; if the user iterates it anyway, the server appends two rows and newest wins — acceptable ledger behavior, noted for the drive.
- **Thumbnail clear vs late landing / undo:** debounce cancelled by any `items` change; decision re-derived from current cache each run.

## 9. Tests

**Unit/contract (house patterns — pure units + source-contract reads):**
- Registry: begin/settle exactly-once with origin; remap; angle mirroring into the refresh store; foreground consumption suppressing background publish (extends `w5-post-close.test.ts`).
- Source-contract updates: `w4-close-open-contract.test.ts` (leave-confirm copy branches), `w5-post-close.test.ts` (close gate blocks mint only), `castModelModal.test.ts` (neutral copy, collapsed complete state, `onClose(name)` shape, `confirmArgsForDoor` simplification).
- `CastModelModal` static renders: complete-package plan → no tier picker, no Add views door, "Ready to mint" present, integrity block renders and holds the mint door.
- W6-D: server response-shape test (identity branch carries `masterPrompt`+`technicalSchema`+`preferences`; image-only carries none); client source-contract (application conditional on identity fields).
- W6-E: route accepts `thumbnailUrl: null` and passes it to `updateBoard`; pure-helper unit tests for set/clear/no-op decisions.
- W6-F: source-contract for restore `onError` + settle invalidation.

**Browser-drive matrix** (dev only, via the `verify` skill / `scripts/drive-*.mts` pattern; no production contact):
1. Empty node → cast → leave immediately → node shows progress → draft auto-lands; exactly one toast; Open Draft still works.
2. Same, but navigate to the lobby before completion → return → node is filled.
3. Draft edit → close mid-iterate → node/tile shows in-flight → completes without reopening; reopen-mid-flight variant shows in-flight truth and settles once, no duplicate charge.
4. Add Views → dismiss modal → close takeover → board tiles spin → views land; one injected failure slot shows the refund toast exactly once.
5. Six-view male draft → mint modal: neutral copy, collapsed "Ready to mint"; type a name → Keep editing → reopen → prefilled; verify via `models.get`.
6. Pink-hair identity edit → form/Spec/master prompt agree post-success without reload; a cosmetic edit leaves the identity documents byte-identical.
7. Delete all nodes → lobby card clears; re-add an image → thumbnail returns.
8. "Use this version" on an old version → new head appends, siblings intact; cross-revision thumb sealed with copy; a refused restore shows its toast.

## 10. Explicit exclusions (R7 — per the founder's list)

Full direct-refresh controls in the view strip · replacing stale dots with richer refresh/status controls · Package Health redesign · version-history redesign · server-persisted in-flight job state (cross-tab/reload visibility) · unblocking close during a true mint (§5.1).

## 11. Review gates

1. **After W6-A:** staged diff + registry/contract test output + drive legs 1–4. This is the batch with real race surface; nothing else lands until it's reviewed.
2. **After W6-B + W6-C (modal batch):** staged diff + drive leg 5; copy review against the neutral-language requirement.
3. **After W6-D:** staged diff + the response-shape tests + drive leg 6; confirm the image-only branch is byte-identical.
4. **After W6-E + W6-F:** staged diff + drive legs 7–8.
5. **Before the final report:** `pnpm check`, the focused W6 tests, the full unit suite, and the bounded drive rerun; credit-ledger assertions attached wherever money moved (legs 3, 4, 6).

Prefer these six coherent batches; do not split further. W6-A is the reason W6 exists — it ships first and is never bundled behind copy polish.

---

*Investigation verified at `3448ce5` by Fable 5, 2026-07-18. Produced from the founder's W6 investigation prompt. No product code, commits, pushes, deployments, production data, or credits were touched. This file is deliberately left uncommitted for the executor to work from.*
