# Casting System R7-2 — Durable Operations Execution Plan

**Date:** 2026-07-19

**Verified baseline:** `8a47b12` (`main`; R7-1 complete locally through R7-1E)

**Production baseline:** `1a5eb38` (`local-migration`; migration 0007 is present, but the R7-1C/D/E runtime is not deployed)

**Status:** READY FOR FABLE REVIEW — investigation and design only; no R7-2 migration, runtime code, production access, push, or deploy has occurred

**Governing source:** `CASTING_SYSTEM_R7_REVIEW_AND_EXECUTION_PLAN.md` R7-2 plus D-61/D-62/D-63 and the R7-1 trust-foundation contract

## 1. Executive verdict

R7-2 should extend the existing `generation_operations` receipt. It must not introduce a second parent-job table or allow a browser store to remain authoritative.

R7-1 now prevents duplicate provider work, duplicate credit movement, and concurrent Cast mutation. It does **not** yet make an operation recoverable to the product. Operation rows are server-internal; there is no authenticated read surface, no cross-tab/reload hydration, no child-attempt linkage, no heartbeat, no stale-operation adjudicator, and no durable landing acknowledgement. The Canvas and Casting Studio still rely on three same-tab memory structures. Reloading loses their visible progress and settlement handling even though the server receipt, model, assets, and ledger survive.

R7-2 therefore has four bounded responsibilities:

1. extend the existing receipt with enough durable progress, lease, attempt, and landing truth;
2. expose a user-owned, public-safe operation read model and explicit recovery/landing mutations;
3. make server reconciliation conservative and evidence-based after request or process interruption;
4. replace in-memory authority with one client operation bridge used by Canvas and Studio.

This is migration-backed infrastructure, not the R7 UI redesign. It adds only the minimum progress and recovery presentation needed to be truthful. Package Health is not expanded; the future strip-first surface remains R7-4.

## 2. Confirmed current-code evidence

| # | Finding | Current evidence at `8a47b12` | Consequence |
|---|---|---|---|
| 1 | The parent receipt already exists and is the correct authority | `generation_operations` owns user, kind, request id, model/origin, expected revision, cost, ledger references, terminal public result/error, and timestamps. | R7-2 must extend it rather than duplicate it. |
| 2 | Operation reads are server-internal only | `getGenerationOperationOutcome` is exported from `server/db/generationOperations.ts`; no protected tRPC query exposes it or lists a user's active operations. | Reload and another tab cannot recover progress or terminal truth. |
| 3 | Status is too coarse for product recovery | Current values are `claimed`, `running`, `succeeded`, `failed`, and `recovery_required`. There is no durable phase/progress, partial terminal state, or cancellation capability field. | The UI can only invent progress locally; partial outcomes are hidden inside result JSON. |
| 4 | Locks have expiry but no heartbeat/adjudication | `generation_operation_locks.expiresAt` is written once. R7-1 deliberately never renews or steals it. | A server/process interruption can strand a Cast until support intervenes. |
| 5 | Individual attempts are not linked to their parent | `generations` has no `operationId`, step key, or view angle. Casting, mint, refresh, and Canvas operations create one or several rows independently. | Recovery cannot prove which provider attempts and per-angle results belong to one user intent. |
| 6 | Same-tab memory remains the visible owner | `pendingCastRegistry.ts`, `useCastingRefreshStore.ts`, and `useGenerationJobs.ts` are module/Zustand memory only. | Reload erases visible running/refreshing state and settlement callbacks. |
| 7 | Background landing is browser-owned | `CastingOperationOwner` in `App.tsx` listens to the memory registry and later calls `boardOps.fillFromLibrary`. | A reload between durable model creation and that callback can leave the origin node empty with no deliberate recovery path. |
| 8 | Landing is not acknowledged on the receipt | The receipt records `originBoardId`/`originItemId`, but no pending/landed/relink-required state or landed item id. | Multiple tabs cannot coordinate exactly-once placement feedback. |
| 9 | Canvas progress is synthetic | `useGenerationJobs` records a local start time and asymptotic estimate keyed by item id. | It is useful animation, but not evidence that an operation is still alive. |
| 10 | Studio rejoin is same-tab only | `CastingWorkspace` calls `getActiveCastingOperations` and subscribes to the memory registry. | Reopening after reload cannot resume the operation view. |
| 11 | R7-1 has two known stranded-state seams | `markGenerationOperationRunning` can fail after claim/lock, and Canvas wrappers can seal post-claim refusals using running-state finalization. | R7-2 must close these while adding adjudication, not merely poll the rows. |
| 12 | There is no general realtime transport to reuse | The app uses ordinary tRPC/TanStack queries; WebSocket references are Vite HMR only. | Bounded polling is the smallest honest cross-tab mechanism. Do not add a socket stack solely for R7-2. |

## 3. Binding invariants

1. **One authority.** `generation_operations` is the parent operation. `generations` rows are child attempts. Client stores are caches only.
2. **User isolation.** Every operation query or mutation derives `userId` from the authenticated context. An operation id alone never authorizes a read, landing, retry, or recovery action.
3. **No sensitive request persistence.** Raw prompts, masks, reference images, base64, cookies, tokens, and provider payloads remain absent from the receipt and public progress.
4. **No automatic spend.** Polling, hydration, adjudication, landing, relinking, and acknowledgement are free. A failed/stale operation never silently launches a replacement.
5. **No guessed financial outcome.** Recovery reconciles from durable operation, ledger, model/asset, and child-attempt evidence. Ambiguous paid work stays `recovery_required` with its lock retained.
6. **Heartbeat is not success evidence.** It proves only that an executor recently held the lease. Terminal success still requires a durable result plus a terminal receipt.
7. **Locks are stolen only after adjudication.** Expiry starts recovery; it does not itself authorize another writer.
8. **Exactly-once landing is a database transition.** Toast suppression is not the landing contract. Board placement and receipt landing state change together or neither changes.
9. **The board is not the result owner.** A generated Cast remains durable in Models if its origin node was deleted, repurposed, or could not be filled.
10. **Relink is deliberate.** A completed result that could not land may be attached to a founder/user-selected empty Cast node through a free, idempotent mutation. It never overwrites a populated node.
11. **Partial success is first-class.** Kept paid results, actual charges/refunds, failed child outcomes, and unplaced library results remain visible and replayable.
12. **Cancellation is honest.** R7-2 does not pretend Gemini work is cancellable. Public operation state reports `cancellable: false`; closing a surface detaches presentation only.
13. **No Package Health dependency.** Routine operation progress appears on the originating node/view strip/Studio loading surface. Package Health is not a required recovery door and is not expanded.

## 4. Additive migration 0008 design

### 4.1 Extend `generation_operations`

Add nullable/defaulted columns so the migration is compatible with the R7-1 runtime:

| Column | Shape | Purpose |
|---|---|---|
| `phase` | nullable `varchar(48)` | Stable public-safe phase vocabulary, never arbitrary provider text |
| `progress` | nullable JSON | Bounded public progress: requested/completed/failed view keys and child counts; no prompts or URLs required |
| `heartbeatAt` | nullable timestamp | Last executor lease renewal |
| `leaseExpiresAt` | nullable timestamp | Receipt-level recovery boundary mirrored with the lock lease |
| `landingStatus` | `varchar(24)` default `not_applicable` | `not_applicable`, `pending`, `landed`, `relink_required`, `dismissed` |
| `landedItemId` | nullable int | Board item filled by the receipt's free landing/relink transition |
| `landingAcknowledgedAt` | nullable timestamp | Durable acknowledgement used to prevent repeated completion ceremony across tabs |
| `recoveryAttemptedAt` | nullable timestamp | Rate-limit/audit for stale adjudication |

Keep `status` as `varchar`. Add terminal `partial` to the typed vocabulary; it replays the stored public result like success. Do not add a fake `cancelled` status because current provider calls cannot be cancelled. The public DTO carries `cancellable: false`.

`landingStatus` is `pending` only for an operation with a durable result whose trusted origin should receive that result. Operations without an origin, operations whose executor already performed an atomic Canvas landing, and non-placement operations use `not_applicable` or `landed` as appropriate.

Add an index on `(status, leaseExpiresAt)` for the bounded stale-operation sweeper. The existing `(modelId, status, createdAt)` index cannot serve a global lease-expiry scan without leading on `modelId`.

### 4.2 Link child attempts

Extend `generations` with:

| Column | Shape | Purpose |
|---|---|---|
| `operationId` | nullable `varchar(36)` | Parent receipt; nullable for historical and Wardrobe rows until those products adopt the contract |
| `stepKey` | nullable `varchar(64)` | Stable child identity such as `headshot`, `iterate`, `view:sideClose`, or `variation:2` |
| `viewAngle` | nullable `varchar(32)` | Canonical Casting angle when the attempt is angle-specific |

Add indexes on `(operationId, createdAt)` and `(operationId, stepKey)`. Do not make `(operationId, stepKey)` unique: a deliberate provider retry within the same operation may create another attempt, and attempt history must remain auditable.

Existing `generations.status`, `resultUrl`, `errorMessage`, `pointsCost`, and timestamps remain the child-attempt outcome. Public DTOs expose only sanitized status/angle/step/timestamps, never raw internal errors or arbitrary URLs.

### 4.3 Migration safety

- Generate 0008 and its Drizzle snapshot/journal normally; never hand-edit journal metadata.
- Disposable DB applies 0000–0007, audits, then 0008.
- Mixed-version gate: the current R7-1 runtime must continue to operate with the added nullable/defaulted columns.
- Production migration occurs only after Fable approval and explicit founder authorization; runtime using 0008 deploys only after production has 0008.
- No backfill is required. Pre-0008 operations remain valid terminal receipts but cannot claim child-attempt detail or heartbeat history they never recorded.

## 5. Server operation lifecycle

### 5.1 Start and heartbeat

1. Claim and lock exactly as R7-1 does.
2. Move the claimed-to-running transition inside a sealed helper. If the start write fails, inspect current receipt truth; otherwise mark `recovery_required` and retain the lock. Never leave a silently claimed row.
3. Starting writes `phase`, `heartbeatAt`, `leaseExpiresAt`, and renews the lock expiry in one transaction.
4. A scoped executor heartbeat renews both receipt and owned lock with compare-and-swap guards (`status = running`, matching operation id/lock ownership). It stops in `finally` before terminal finalization.
5. A heartbeat failure does not start a second executor. The active request completes its existing durable-boundary rules, but terminal finalization records/raises recovery if lease truth cannot be safely maintained.

### 5.2 Progress and children

- Each Casting/Canvas `createGeneration` call receives the parent `operationId` plus stable `stepKey`/`viewAngle`.
- Parent progress updates are monotonic summaries derived from child states and known slot outcomes. They do not replace child rows.
- Multi-view/mint/refresh/variations record per-child success/failure/refund truth as each bounded child settles.
- Parent `partial` is terminal when at least one paid durable result is kept and at least one requested result failed or could not be placed. Its result remains replayable.

### 5.3 Conservative stale adjudication

Adjudication is a server helper invoked by active-operation reads and by a bounded background sweep. It uses a database claim/CAS so only one adjudicator acts on a stale receipt.

Classification:

1. **Stale `claimed`, no charge, no child, no durable model/result:** terminal free failure; release lock.
2. **Stale `running`, no charge, all child attempts terminal, durable outcome provable:** reconstruct public-safe success/partial/failure from model/assets/children and finalize once.
3. **Stale `running`, charge exists, no paid durable result, every provider attempt is durably failed:** verify refund ledger truth; record missing deterministic refund if and only if the original charge and absence of kept results are proven; then fail and release.
4. **Stale `running` with a durable model/asset/result but incomplete receipt:** finalize success/partial without refund; create `landingStatus: pending` when applicable.
5. **Provider outcome unknown, child still processing without terminal evidence, ledger/result disagreement, missing audit row, or any ambiguous paid state:** set/keep `recovery_required`, retain lock, expose support-safe copy. Never auto-refund or retry.
6. **Stale free operation, zero charge, no provider attempt, and no possible partial-write hazard:** terminal free failure and release the lock. This covers interrupted pin, restore, compact, and equivalent free writers only when the durable evidence proves nothing could have been partially committed; otherwise class 5 still wins.

The sweeper is bounded by age/status/index and per-run limit. It never scans the entire history on an end-user request. Read-triggered adjudication may examine only the stale operations returned for that authenticated user.

## 6. Public API and read model

Add a focused generation-operation router under the existing `generation` namespace:

- `operationState({ operationId })` — owned public DTO or `NOT_FOUND`;
- `activeOperations({ boardId?, modelId? })` — the authenticated user's active/recovery rows, plus recently completed unacknowledged landings relevant to the filter;
- `recentOperation({ clientRequestId })` — recover an uncertain transport result without re-executing;
- `acknowledgeOperation({ operationId })` — free CAS acknowledgement for terminal ceremony only; no landing or money movement;
- `landOperationResult({ operationId, boardId, itemId })` — free, idempotent, atomic landing/relink transition.

Public DTO fields are deliberately small:

- operation id, client request id, kind, model id, trusted origin;
- status (`claimed`, `running`, `partial`, `succeeded`, `failed`, `recovery_required`), phase, bounded progress;
- planned/charged/refunded/net credits;
- public message and public-safe terminal result;
- child summaries without internal error strings;
- created/updated/completed/heartbeat timestamps;
- `cancellable: false`;
- landing status and landed item id.

No endpoint returns another user's existence, lock owner id, payload hash, raw ledger reference, raw prompt/reference/mask, or internal failure text.

### 6.1 Atomic landing/relink rules

`landOperationResult` must:

1. load the terminal owned receipt and prove its public result identifies a durable model;
2. lock/validate the target board item belongs to the user and is still an empty Cast node;
3. enforce trusted origin for automatic landing; a deliberate relink may target another explicitly selected empty node on an owned board;
4. fill the board item using the same status/provenance truth as `fillFromLibrary`;
5. write `landingStatus = landed`, `landedItemId`, and acknowledgement in the same database transaction;
6. return the existing landed state on replay without another item/version row;
7. if the origin vanished or was repurposed, mark `relink_required` without changing the board.

The existing `fillFromLibrary` remains the normal library picker. It does not acknowledge an unrelated operation by inference.

## 7. Client authority bridge

### 7.1 One query owner

Create one always-mounted operation bridge near `CastingOperationOwner` that:

- polls only while the authenticated user has active/recovery/unacknowledged operations;
- polls faster while visible (approximately 2–3 seconds) and backs off/pauses in a hidden tab;
- hydrates `useGenerationJobs`, Casting refreshing presentation, and Studio generation copy from server DTOs;
- invalidates the relevant board/model/package/balance queries once per observed terminal transition;
- uses operation id plus terminal `updatedAt` as its local dedupe key;
- acknowledges completion ceremony only after the corresponding UI/landing action is durably handled.

No second listener independently lands, toasts, or charges. Existing memory registry events may update the bridge optimistically in the originating tab, but server reads overwrite them.

### 7.2 Canvas behavior

- An origin Cast node derives running state from `activeOperations({ boardId })`, including a pre-headshot `modelId: null` operation.
- Reload or another tab shows the same operation phase rather than the default empty node.
- Terminal automatic landing calls `landOperationResult` once. A vanished/occupied origin shows the library result as saved and offers a deliberate **Place on empty Cast node** action; it never overwrites or auto-creates clutter.
- Canvas-native operations whose server executor already performed the atomic node write are marked landed/not-applicable and only trigger query refresh.
- Synthetic progress animation may remain, clearly subordinate to durable status/phase.

### 7.3 Casting Studio behavior

- Opening a model queries active operations for that model and shows truthful generating/refreshing state.
- Closing Add Views, refresh, iterate, or true mint detaches the surface; the operation continues and reappears on reopen/reload.
- Per-angle progress hydrates the existing view strip state. R7-2 does not add the full priced strip actions reserved for R7-4.
- Failures and `recovery_required` use the saved public message. No duplicate generic toast appears in another tab after acknowledgement.

### 7.4 Retirement sequence for same-tab authority

Do not delete all three stores in the migration batch. Convert in this order:

1. server query becomes authoritative;
2. `useGenerationJobs` becomes a projection/cache with operation id;
3. `useCastingRefreshStore.refreshingByModel` becomes a projection of child progress; retain only unrelated UI-open state temporarily;
4. `pendingCastRegistry` loses settlement/landing authority and becomes an optional immediate-event adapter;
5. remove dead listeners and W5/W6 source pins only after reload/cross-tab drives prove parity.

## 8. Implementation batches and review gates

### R7-2A — Schema, operation DTO, and disposable-DB proof

**Expected files:**

- `drizzle/schema.ts`
- generated `drizzle/0008_*.sql`, snapshot, and journal
- `server/casting/operationContract.ts`
- `server/db/generationOperations.ts`
- `server/db/generations.ts`
- focused unit and `TEST_DATABASE_URL` suites
- read-only operation/attempt audit script if needed

**Work:** implement §4 types/schema, owned public DTO projection, child linkage helpers, `partial` replay semantics, and database tests. Do not expose routes or change clients yet.

**Gate:** typecheck, migration snapshot diff, 0000–0007 → 0008 disposable drive, mixed-version test, concurrency/CAS tests, Fable review, then separate production migration authorization.

### R7-2B — Sealed start, heartbeat, progress, and stale adjudicator

**Expected files:** operation DB/direct helpers, Casting/Canvas executor seams, child-attempt call sites, focused recovery tests, bounded recovery runner.

**Work:** implement §5, close the two known R7-1 stranded-state seams, thread `operationId` into every Casting/Canvas child attempt, and prove all five adjudication classes. Do not add client UX.

**Gate:** server-restart simulation at each durable boundary, lease-owner races, ambiguous-state fail-closed tests, credit conservation, no provider replay, Fable review.

### R7-2C — Authenticated operation reads and atomic landing

**Expected files:** new generation operation route module, generation router composition, board transaction helper reuse, route/authorization/landing tests.

**Work:** implement §6. Keep all reads public-safe and every landing free/idempotent.

**Gate:** cross-user probing returns `NOT_FOUND`; parallel landing calls create one placement/version only; two different operations targeting the same empty node produce one landing and one `relink_required`; deleted/occupied origin becomes `relink_required`; no charge/provider call; Fable review.

### R7-2D — Client operation bridge and server-backed Canvas progress

**Expected files:** `App.tsx`, `BoardPage.tsx`, operation query hook/store adapter, `useGenerationJobs.ts`, Cast node controller/presentation, focused client contracts.

**Work:** hydrate origin-node progress from server truth, recover pre-headshot casts after reload, coordinate one terminal landing/notice path, and demote same-tab settlement ownership.

**Gate:** same-tab close, hard reload, second-tab, deleted-origin, occupied-origin, duplicate subscription, and no-duplicate-toast/landing drives; Fable review.

### R7-2E — Studio rejoin, per-angle progress hydration, and memory-authority removal

**Expected files:** Casting operation hook/bridge consumers, `CastingWorkspace`, `pendingCastRegistry`, `useCastingRefreshStore`, W5/W6 contracts replaced by behavioral tests.

**Work:** make model/view progress survive reload and allow Add Views/refresh/iterate/mint surfaces to close safely. Remove obsolete settlement authority only after parity.

**Gate:** Studio close/reopen, hard reload, second tab, six-angle partial failure, terminal acknowledgement, and no-auto-spend drives; full test/build; Fable milestone review.

### R7-2F — Production release gate

1. confirm production has migration 0008;
2. read-only audit active/stale receipts and locks;
3. deploy R7-1C/D/E plus reviewed R7-2 runtime only with explicit founder authorization;
4. drive one free/unpriced model create and bounded paid Casting paths on the founder-approved live account;
5. verify operation rows, child attempts, credits, landing, reload, and another tab;
6. stop immediately on duplicate charge, provider replay, lost durable result, cross-user visibility, or unrecoverable lock.

## 9. Verification matrix

### Unit/contract

1. public DTO excludes payload hash, charge reference, internal errors, prompts/references/masks, and other-user existence;
2. `partial` replays the identical stored result and never runs the executor;
3. each Casting/Canvas child attempt carries the correct operation id and stable step/angle;
4. parent progress is monotonic and duplicate child settlement is idempotent;
5. heartbeat renews only the owning running operation and matching lock;
6. a terminal or recovery-required operation cannot heartbeat;
7. start-write failure cannot leave a silent claimed/locked row;
8. stale free claim finalizes free and releases;
9. proven paid failure refunds once; duplicate adjudication does not refund twice;
10. durable result with incomplete receipt finalizes without refund;
11. ambiguous paid state remains recovery-required and locked;
12. a provably untouched stale free operation fails free and releases, while any possible partial write remains recovery-required;
13. automatic landing accepts only the trusted empty origin;
14. deliberate relink accepts only an owned empty Cast node;
15. parallel landing/relink requests write once;
16. two different operations racing for one empty node produce one landing and one `relink_required`;
17. acknowledgements are idempotent and never hide an unlanded result;
18. polling/query hydration cannot create a charge, provider call, model, asset, or board item.

### Disposable database

1. mixed R7-1 runtime writes valid rows after 0008;
2. 20 concurrent heartbeat/terminal races yield one terminal receipt and no surviving terminal lock;
3. expired lease plus two adjudicators yields one recovery decision;
4. child attempt rows retain all parallel slot attempts and correct parent ids;
5. partial slot operation conserves `charged - refunded = kept paid results`;
6. two tabs landing one operation produce one landed item/version and one acknowledgement;
7. cross-user operation and target-board probes reveal nothing.

### Browser/live drives

1. begin headshot from an empty Canvas node, close, hard reload before completion: node still shows generating and later fills once;
2. open the same board in a second tab: both show the same phase, only one completion ceremony occurs;
3. close and reopen Studio during iterate/Add Views/refresh/mint: state and per-angle progress resume;
4. delete or repurpose the origin while generation runs: saved draft remains in Models and operation offers deliberate relink, with no overwrite;
5. simulate server restart after claim, after charge, after child success, and before terminal receipt: each follows §5.3 without duplicate spend/provider work;
6. partial multi-view result shows kept views, honest refund/failure truth, and replay parity;
7. acknowledge in one tab, reload another: no duplicate toast, landing, or action;
8. balances and ledger references exactly match operation totals.

## 10. Explicit exclusions

- No WebSocket/SSE platform solely for R7-2; bounded polling is sufficient.
- No Gemini cancellation claim or Cancel button.
- No provider retry that spends again automatically.
- No full operation-history/support dashboard; only user recovery surfaces and logs/audit hooks.
- No Package Health expansion. Its eventual removal/demotion is handled with R7-4 strip parity.
- No minted Profile or draft authoring-mode redesign (R7-3).
- No priced strip actions/history redesign/pin retirement (R7-4/R7-7).
- No archive/delete/storage cleanup behavior (R7-5, subject to the founder's updated permanent-delete ruling).
- No Batch D reference-plate/composer schema (R7-6/R7-7).
- No Wardrobe adoption in this phase. New attempt columns remain nullable so Wardrobe behavior is unchanged.

## 11. Fable review checklist

Before implementation, challenge this plan for:

1. whether the 0008 columns are the minimum sufficient durable contract rather than a second job system;
2. whether child linkage covers every R7-1 Casting/Canvas `createGeneration` call without dragging Wardrobe into scope;
3. whether heartbeat and lock renewal are transactionally coupled and cannot revive terminal work;
4. whether every stale-state classification is evidence-backed and credit-conserving;
5. whether any ambiguous state could release a lock, refund, retry, or report success incorrectly;
6. whether `partial` terminal semantics preserve exact replay and existing typed partial results;
7. whether automatic landing and deliberate relink are truly exactly-once and cannot overwrite a node;
8. whether acknowledgement can suppress feedback before a result is safely landed or intentionally deferred;
9. whether two tabs can create duplicate toast, landing, invalidation loops, or local job ownership;
10. whether pre-headshot/model-null operations remain discoverable after reload;
11. whether the client bridge makes server truth authoritative without introducing permanent polling load;
12. whether Package Health or any R7-3/R7-4 redesign has accidentally entered scope;
13. whether migration-before-code and mixed-version release ordering are safe;
14. any reachable blocker or missing operation door that would make the coverage claim false.

Return either:

- **APPROVE — safe to ratify the R7-2 execution plan**, or
- **REQUEST CHANGES** with a concrete reachable blocker and the smallest sound correction.
