# Casting System R7-1 — Trust Foundation Execution Plan

**Date:** 2026-07-19

**Verified baseline:** `f790862` (`main`; R7-0 locally committed, not deployed)

**Production baseline:** `e66b8db` through `local-migration`

**Status:** READY FOR FABLE REVIEW — investigation and migration design only; no R7-1 product code, migration, production access, push, or deploy has occurred

**Governing source:** `CASTING_SYSTEM_R7_REVIEW_AND_EXECUTION_PLAN.md` R7-1 plus D-61/D-62

## 1. Executive verdict

R7-1 should proceed, but it is not one automatic coding batch. It is the financial and concurrency foundation for every later R7 surface and must ship through five separately reviewed batches with migration-backed release gates.

The audit found one release-blocking security issue not recorded in the high-level R7 plan: the authenticated `credits.add` mutation currently lets an ordinary user add arbitrary credits to their own account. `credits.deduct` also lets a client create arbitrary debit ledger entries. No client code uses either mutation. Removing both client-facing write routes is the first R7-1 change and may ship independently before any migration.

The existing R7 boundary also needs one architectural clarification. Database-backed idempotency cannot be implemented honestly without a small server-owned operation claim/receipt. R7-1 therefore creates the **minimum parent-operation foundation** needed to claim a request, exclude concurrent model mutations, derive charge references, and replay terminal outcomes. R7-2 does not create a competing second job table; it extends this same operation record with child-attempt progress, heartbeat/recovery workers, cross-tab reads, landing acknowledgements, and the full durable-operation UI.

## 2. Confirmed current-code evidence

| # | Finding | Current evidence | Consequence | Batch |
|---|---|---|---|---|
| 1 | Authenticated users can mint credits for themselves | `server/routes/credits.ts` exposes `credits.add` as `protectedProcedure`, accepts client-selected amount/type/description/reference, and directly calls `addCredits`. No production client call exists. | Unlimited self-credit and forged ledger history. This is a release blocker independent of Casting. | R7-1A |
| 2 | Authenticated users can write arbitrary debits | The same router exposes `credits.deduct`; only tests call it. | A client can poison its own financial/audit history and choose trusted-looking metadata. All balance writes must remain server-internal. | R7-1A |
| 3 | `createModel` can return another concurrent insert | `server/db/models.ts` inserts, then selects the user's newest model by `createdAt`. | Concurrent Studio, fork, variation, or Canvas creation can receive the wrong model id. | R7-1A |
| 4 | Refund uniqueness is read-before-write | `point_transactions` has non-unique `idx_credit_txn_user_ref`; `addCredits` selects then updates then inserts. | Two concurrent identical refunds can both increase the balance. | R7-1B |
| 5 | Charges have no reference-level idempotency contract | `deductCredits` atomically checks balance but never checks reference reuse. | A network replay or duplicate submission with a reused charge reference can charge twice. | R7-1B/C |
| 6 | Direct Casting mutations accept no request key | `castingImage`, `iterate`, `mintPackage`, and `refreshSlots` inputs contain no `clientRequestId`; each generates a fresh UUID charge reference server-side. | Retrying an uncertain request is indistinguishable from buying the operation again. | R7-1C/D |
| 7 | Canvas Casting mutations have the same gap | `boardOps.runGeneration.execute`, `applyModelEdit.execute`, and `runVariations.execute` contain paid Casting work and accept no request key. | Canvas retries can duplicate drafts, candidates, provider calls, charges, or placements. | R7-1E |
| 8 | Mint's clean-draft check and transition are separate | `executeMintPackage` reads/checks the model, may charge and generate, then `mintModel` performs another read followed by an unconditional update by id. | Two simultaneous mint requests can both spend/generate; only the last agency id may remain. | R7-1D |
| 9 | There is no model-wide mutation exclusion | Iterate, refresh, add views, mint, restore, recast, variations, compacting, and deletion do not share a lock. | A refresh can race an identity edit; deletion can race a paid result; two package writers can append competing heads. | R7-1C–E |
| 10 | Audit rows are attempts, not request receipts | `generations` represents individual AI calls; multi-slot work creates several rows and one user request may have no replayable result. | `generations` cannot safely dedupe a whole request or replay its terminal response. | R7-1C |
| 11 | Hidden paid upscale remains raw-client callable | `generation.upscale` is a live `protectedProcedure` with no request id. It accepts an arbitrary `imageUrl`, `fetchImageAsBase64` server-fetches it without the route's proxy allowlist or model/asset ownership proof, `executePaidUpscale` creates a fresh random charge reference, and the path creates no `generations` row or model-asset linkage. R6 removed every UI caller but tests deliberately kept the hidden capability. | Raw callers can replay charges/provider work, use the server as a URL fetcher, and create paid orphan outputs. This contradicts D-62's deferred, server-planned quality contract. | R7-1A |

## 3. Binding invariants

1. **No client owns money movement.** Public tRPC exposes credit reads and server-planned costs only. Charges, refunds, bonuses, subscriptions, top-ups, referrals, disputes, and admin corrections remain server-internal, role-gated, or webhook-owned.
2. **A client request id is not an operation id.** The client supplies a cryptographically random UUID identifying one intent. The server mints its own operation UUID and owns status, charge references, result, and error truth.
3. **Same request id + same payload means the same operation.** While running it returns `CONFLICT` with the existing operation id; after success it returns the stored response; after a terminal failure it replays the stored public error. It never calls the provider or moves money again.
4. **Same request id + different payload is refused and security-logged.** Raw reference images and prompts are not persisted in the operation row; only a canonical SHA-256 payload hash is stored.
5. **One Cast has one authoritative writer at a time.** Paid model mutations take an exclusive `model:<id>` operation lock before deduction or provider contact. Free package/identity writers honor the same lock for their short transaction. Display-name changes are exempt because they cannot affect pixels, identity revision, package selection, lifecycle, or cost.
6. **Locks never fail open.** A live or uncertain lock refuses new work before money. R7-1 never automatically steals an expired lock. R7-2 adds lease heartbeat and stale-operation recovery after the recovery rules are implemented.
7. **The ledger is database-idempotent.** MySQL uniqueness, not a prior SELECT, is the final arbiter for every non-null `(userId, referenceId)`.
8. **A duplicate refund is success only when it matches the original semantic transaction.** Same reference with a different amount or type is a collision/abuse error, not a benign duplicate.
9. **A duplicate charge never authorizes another provider call.** At the low-level ledger boundary it returns a typed duplicate refusal; replayable success comes only from the operation receipt.
10. **Mint is a conditional transition.** Final name + agency id + `active` + `mintedAt` land in one update whose `WHERE` still proves clean draft and the operation's expected identity revision. A zero-row update never reports minted.
11. **Credit conservation is measurable per operation.** `chargedCredits - refundedCredits` equals the sum of durable paid results kept by that operation. Partial slot operations record their actual totals and never claim a failed refund landed.
12. **Existing R6 durable-boundary law remains binding.** Failure before a paid durable result refunds; a durable result that exists is not refunded because a later audit/UI/landing write failed.

## 4. Schema and migration design

### 4.1 Migration 0006 — ledger uniqueness

Change `drizzle/schema.ts` from a normal index to:

```ts
uniqueIndex("uq_point_txn_user_ref").on(table.userId, table.referenceId)
```

MySQL permits multiple `NULL` values in a unique composite index, so historical rows without a reference remain legal while every non-null user/reference pair becomes unique.

Before generating or applying 0006, add a read-only audit command that reports:

- every duplicate non-null `(userId, referenceId)` group;
- ids, types, amounts, descriptions, balances-after, and timestamps for its rows;
- the group's net balance effect;
- references reused with conflicting type or amount.

The audit exits non-zero when any duplicate exists. It never deletes or rewrites rows. Deleting duplicate ledger rows would not repair the already-adjusted balance. If production contains a duplicate, stop for a separately reviewed reconciliation using the immutable/audit records; do not force the unique index.

### 4.2 Migration 0007 — operation claims and exclusive locks

Add `generation_operations` as the R7 parent-operation foundation:

| Column | Shape | Purpose |
|---|---|---|
| `id` | `varchar(36)` primary key | Server-generated operation UUID |
| `userId` | `int not null` | Ownership |
| `clientRequestId` | `varchar(36) not null` | Client intent UUID |
| `kind` | `varchar(48) not null` | Stable server vocabulary (`model.create`, `casting.headshot`, `casting.iterate`, `casting.mint`, `casting.add_views`, `casting.refresh`, `canvas.cast`, `canvas.recast`, `canvas.fork`, `canvas.variations`) |
| `modelId` | nullable `int` | Set immediately when known |
| `originBoardId` / `originItemId` | nullable `int` | Canvas origin without making the board the result owner |
| `payloadHash` | `varchar(64) not null` | Canonical SHA-256; no prompt/reference payload stored |
| `status` | `varchar(24) not null` | R7-1: `claimed`, `running`, `succeeded`, `failed`, `recovery_required`; varchar deliberately allows R7-2 states without an enum migration |
| `expectedIdentityRevisionId` | nullable `varchar(64)` | Server-read revision at claim time |
| `plannedCredits` / `chargedCredits` / `refundedCredits` | non-null ints default `0` | Conservation truth |
| `chargeReferenceId` | nullable `varchar(64)` | Derived from server operation id |
| `result` | nullable JSON | Public-safe terminal response for replay |
| `errorCode` | nullable `varchar(32)` | Public tRPC code for replay |
| `publicMessage` | nullable text | Already-sanitized failure/refund truth |
| timestamps | created, updated, completed | Audit and later recovery |

Constraints/indexes:

- unique `(userId, clientRequestId)`;
- index `(modelId, status, createdAt)`;
- index `(userId, createdAt)`;
- unique `chargeReferenceId` when non-null (multiple nulls remain legal).

Add `generation_operation_locks`:

| Column | Shape | Purpose |
|---|---|---|
| `lockKey` | `varchar(96)` primary key | `model:<id>` or `board-item:<id>` |
| `operationId` | `varchar(36)` unique not null | Owning operation |
| `kind` | `varchar(48)` not null | Inspection/support context |
| `acquiredAt` / `expiresAt` | timestamps | Audit and future R7-2 lease recovery |

R7-1 deletes the lock only in the same transaction that records a terminal operation receipt. An expired row remains a safe refusal plus a support-visible recovery reference; it is not auto-stolen. Add a read-only stale-lock audit script. R7-2 supplies heartbeat, recovery classification, safe lease takeover, and cross-tab progress.

### 4.3 Why R7-1 creates the parent foundation

A separate `idempotency_keys` table now and a `generation_operations` table in R7-2 would encode the same user intent twice and create disagreement over which row owns the charge and terminal result. R7-1 creates the minimal final parent record because database uniqueness and replay need it. R7-2 extends behavior and read models; it does not replace the table.

## 5. Request/lock protocol

1. Client creates one UUID synchronously when a user deliberately fires an action. Double-clicks and transport retries reuse it. A deliberate retry after a known terminal failure creates a new UUID; an uncertain network outcome reuses the old UUID to recover the receipt.
2. Server validates ownership, lifecycle, classification, and structural refusals first where those checks are free and deterministic.
3. Server canonicalizes the trusted input, hashes it, and inserts the operation claim. A unique collision loads the existing row and follows invariant 3 or 4.
4. Server acquires the resource lock with one insert. A lock collision marks the newly claimed operation failed with a free `CONFLICT`; it never deducts or calls Gemini.
5. Server re-reads authoritative model/package state under the acquired lock, derives expected identity revision, plan, and price, stores them on the operation, and transitions it to `running`.
6. Charge reference is `op:<server-operation-uuid>:charge`; refund remains `refund:<charge-reference>`. Per-slot refunds keep deterministic child references but roll into `refundedCredits`.
7. Execute the existing R6 provider and durable-result contract.
8. Persist public-safe terminal result/error, actual charge/refund totals, and release the lock atomically. A duplicate request now replays this receipt.
9. If the provider returned but no paid durable result committed, clean up any known owned temporary object, refund truthfully, and record terminal failure. If cleanup fails, log the object key for R7-5 orphan repair; refund truth is unaffected.
10. If a durable result exists but terminal receipt finalization fails, do not refund or invite a retry. Log/mark `recovery_required` when possible and return the operation id with honest support copy. R7-2 automates reconciliation; R7-1's lock prevents a second operation from silently duplicating it.

## 6. Implementation batches

### R7-1A — Emergency credit-route closure + exact insert ids (no migration)

**Files expected:**

- `server/routes/credits.ts`
- `server/credits.test.ts`
- `server/db/models.ts`
- `server/routes/generation/castingRefinement.ts`
- upscale route-presence/source-guard tests (`server/w1-export-truth.test.ts`, `server/casting/geminiPhase2Migration.test.ts`, and any confirmed direct route contract)
- new focused exact-id test (prefer a DB adapter unit plus disposable-DB concurrency leg)
- `docs/specs/DECISION_LOG.md` for the discovered route closure and R7-1 execution record

**Changes:**

- Delete `credits.add` and `credits.deduct` from the public router. Keep `getBalance`, `getTransactions`, `checkBalance`, and `getCosts` unchanged. Do not replace the writes with admin checks in this router; legitimate adjustments already use admin/change-request, Stripe, referral, billing, and internal generation paths.
- Delete the public `generation.upscale` mutation. There is no connected client caller, and the ratified product contract defers quality choice until it is server-planned, persisted, priced, and owned. Keep the internal upscale primitive only if another server-internal test/helper still needs it; do not expose an arbitrary-URL compatibility door. A future quality surface must accept a server-owned asset id (not a client URL), prove ownership, participate in the operation/audit contract, and persist/reuse the derivative.
- Replace `createModel`'s insert-then-newest query with `$returningId()` and fail if no id is returned.
- Sweep database helpers for the same insert-then-newest pattern; change only confirmed copies and record any unrelated findings rather than broad refactoring.

**Acceptance:** raw tRPC calls to `credits.add`, `credits.deduct`, and `generation.upscale` return procedure-not-found; credit reads still work; internal refunds/top-ups/referrals compile and remain callable only from server code; no client module references `generation.upscale`; the internal upscale service's refund-truth tests may remain; parallel `createModel` calls receive their own inserted ids.

**Release posture:** this is a security hotfix-sized commit and may be deployed before the rest of R7-1 after Fable approval and normal verification.

### R7-1B — Ledger audit, unique migration, and duplicate semantics

**Files expected:**

- `drizzle/schema.ts`
- generated `drizzle/0006_*.sql` and journal/snapshot artifacts produced by Drizzle (never hand-edit the journal)
- `server/db/credits.ts`
- `server/casting/atomicCredits.ts` comments/types as needed
- new ledger concurrency tests requiring `TEST_DATABASE_URL`
- `scripts/audit-credit-reference-duplicates.mts`

**Changes:**

- Add the unique ledger index from §4.1 after the audit passes.
- Make duplicate-key handling explicit after transaction rollback:
  - `addCredits`: load the existing row; exact same user/reference/type/amount returns `{success:true, duplicate:true}` and the current balance; mismatch returns a typed collision failure and critical log.
  - `deductCredits`: duplicate reference returns `{success:false, duplicate:true}` so no caller may treat it as authorization to run paid work again. The operation receipt owns replay.
- Keep null-reference legacy operations legal, but inventory every internal writer. New paid/refund/top-up/referral/dispute/admin paths should supply deterministic non-null references wherever an external or retried event exists.

**Migration gate:** disposable DB audit → apply 0006 → concurrent tests → mixed-version test with the old runtime behavior → Fable review → read-only production audit → explicit production migration authorization. No dependent runtime code deploys before the index exists.

### R7-1C — Operation receipt + lock foundation

**Files expected:**

- `drizzle/schema.ts`
- generated `drizzle/0007_*.sql` plus Drizzle metadata
- new `server/db/generationOperations.ts`
- new `server/casting/operationContract.ts`
- new `shared/clientRequestId.ts` or a client-only equivalent
- new operation/lock unit and disposable-DB concurrency tests
- read-only `scripts/audit-generation-operation-locks.mts`

**Changes:**

- Implement the schema in §4.2 and the protocol in §5 as typed helpers, not route-specific copies.
- Use stable canonical JSON hashing. Reject non-UUID ids and payload mismatch. Never persist raw reference images, prompts, masks, or secrets in operation records.
- Derive charge references only from the server operation id.
- Make receipt finalization + lock release one transaction.
- Provide typed outcomes: `claimed`, `in_progress`, `replay_success`, `replay_failure`, `payload_conflict`, `resource_busy`, `recovery_required`.

**Migration gate:** same discipline as R7-1B. Runtime adoption in R7-1D/E waits until 0007 is present in production.

### R7-1D — Direct Casting adoption + atomic mint

**Paid/expensive doors in scope:**

- `models.create` (unpriced Gemini text work and draft creation, still idempotent)
- `generation.castingImage`
- `generation.iterate`
- `generation.mintPackage` for both true mint and Add Views
- `generation.refreshSlots`

`generation.upscale` is intentionally absent: R7-1A removes that public door. Do not reintroduce it merely to adopt idempotency. The later quality contract must be asset-owned, server-planned, persisted, and operation-backed.

**Supporting writers that must honor the model lock:** restore version, pin/unpin while pinning still exists, compact prompt, draft deletion, and any other confirmed package/identity writer found by the final inventory. Display-only rename remains exempt.

**Files expected:** their route/core/client callers, operation helpers, `server/db/models.ts`, and focused contract tests. Do not redesign UI or durable progress here.

**Changes:**

- Add strict `clientRequestId: uuid` to execute inputs, never plan/read inputs.
- Generate/reuse ids at the user-action boundary, not during render and not independently inside a retry.
- Route every door through the shared receipt and `model:<id>` lock. `models.create` uses the receipt before its text-model call; once the row exists it binds `modelId` to the operation.
- Replace `mintModel` with a null-safe conditional update that atomically writes the trimmed name, agency id, `active`, and `mintedAt` only while the row is still a clean draft at the claimed expected identity revision. Check affected rows.
- A competing request returns free `CONFLICT` before deduction/provider contact. A same-id retry replays the stored response/error.
- Preserve all R6 identity authority, per-slot refunds, public messages, and durable-boundary behavior.

**One deliberate product constraint:** while a paid Cast operation runs, the Cast is read-only for other package/identity mutations. This is safer and clearer than allowing refresh, identity edit, restore, and mint to race. Later R7 UI should explain the busy state; R7-1 may use concise existing error presentation.

### R7-1E — Canvas Casting adoption

**Doors in scope:**

- `boardOps.runGeneration.execute`
- `boardOps.applyModelEdit.execute` (`update`/recast and `fork`)
- `boardOps.runVariations.execute`

These are the same commercial Casting system reached through Canvas; leaving them replayable would make the trust foundation bypassable.

**Changes:**

- Add strict client request ids to execute calls and reuse the shared operation contract.
- Empty-node cast takes `board-item:<id>` while it has no model. Model-backed recast/fork/variations take `model:<sourceModelId>` after authoritative ownership/model resolution.
- Record board origin but keep the durable library model/asset as the paid result, preserving R6's typed partial-success rule when placement fails.
- For variations, one parent receipt owns the batch; child candidate failures/refunds contribute to its actual totals. Replaying the parent returns the exact settled candidates/failures without generating again.

**Explicit exclusion:** Wardrobe paid mutations adopt the generic operation layer in their own later overhaul. R7-1 must not alter Wardrobe product behavior, but the shared schema/helpers must be domain-neutral enough to support that adoption without a second idempotency system.

## 7. Recovery and crash matrix

| Failure point | Durable paid result? | Money outcome | Operation/lock outcome |
|---|---:|---|---|
| Refusal, payload mismatch, or resource busy | No | No charge | Terminal free failure; no provider call |
| Charge insert fails | No | Transaction rolls back | Terminal failure; release lock |
| Provider fails | No | Deterministic refund attempted and reported truthfully | Terminal failure; release lock only after receipt records refund truth |
| Provider succeeds, asset/model/identity transaction fails | No | Refund; clean known temporary R2 object when owned | Terminal failure; retry requires new request id |
| Durable library result commits; generation audit completion fails | Yes | Charge stands | Success receipt; audit gap logged; no retry invitation |
| Durable library result commits; board landing fails | Yes | Charge stands | Typed partial success stored and replayed; library location named |
| Terminal receipt cannot commit after durable result | Yes or uncertain | Never guess/refund automatically | Keep lock, return/log operation id, recovery required |
| Process dies while running | Unknown | Do not guess | Persistent lock remains; R7-1 refuses; R7-2 recovery reconciles before release |
| Response is lost after terminal receipt | As recorded | As recorded | Same client request id replays receipt exactly |

## 8. Test and verification matrix

### Unit/contract

1. Credit write procedures are absent; all credit read procedures remain.
2. The public arbitrary-URL `generation.upscale` procedure is absent; the internal upscale primitive cannot be reached through tRPC, and later quality work is pinned to owned asset ids.
3. `createModel` returns `$returningId()` and never runs a newest-row lookup.
4. Canonical hashing is key-order stable and distinguishes any semantic payload change without retaining raw values.
5. Same request/same payload returns in-progress or replays terminal result; different payload refuses.
6. Lock collision refuses before deduction, generation row, model write, or provider call.
7. Terminal receipt and lock release are atomic; failed receipt leaves the lock safe.
8. Mint CAS succeeds exactly once and zero-row/conflict never reports minted.
9. Every route schema requires a strict UUID only on execute mutations; plan queries stay unchanged.
10. Image/reference payloads are absent from persisted operation rows and logs.
11. Existing R6 refund wording and failure-marker truth remain byte-for-byte or behaviorally pinned.

### Disposable-DB concurrency

1. 20 concurrent `createModel` inserts return 20 distinct correct ids.
2. 20 concurrent identical refunds produce one positive ledger row and one balance increase.
3. A conflicting same-reference amount/type produces no second balance movement and a collision error.
4. Two identical charge references produce one debit; the duplicate cannot authorize a callback/provider call.
5. 20 claims with one user/client request id create one operation row.
6. Two different request ids targeting the same model create two receipts but only one acquires the model lock; the loser charges/generates zero.
7. Same-id success and terminal-failure replays match their original public payloads.
8. Two simultaneous mint requests (same id and different ids) generate/charge at most once and transition exactly once.
9. Add Views vs refresh, refresh vs iterate, and iterate vs delete races have one winner and one free busy refusal.
10. Variation replay returns the same child model/item ids and does not create extra candidates.

### Raw tRPC/local drive

Use an authenticated local session and a disposable database. Provider calls must be injected/faked or counted through a test-only dependency seam; do not spend production credits to prove idempotency.

1. Send two concurrent identical `castingImage` requests with the same UUID: one provider call, one charge, one asset, replayable result.
2. Repeat for iterate, Add Views, refresh, and true mint.
3. Send different UUIDs concurrently against one model: one runs; one receives free busy copy.
4. Drop the first HTTP response after the server commits, then resend the UUID: result replays with no new work.
5. Inject provider success + durable-commit failure: one truthful refund, cleanup attempt, terminal failure receipt.
6. Inject durable success + audit/board failure: charge/result stand and replay as success/typed partial success.

### Full gates

- `pnpm check`
- focused trust/ledger/operation tests
- full `pnpm test`
- `pnpm build`
- disposable migration from 0005 → 0006 → 0007
- old-runtime/new-schema mixed-version check
- new-runtime/new-schema concurrency drive
- `git diff --check`

## 9. Deployment sequence

1. Review and ship R7-1A independently if approved.
2. Generate 0006; run the duplicate audit on disposable/dev data. Fable reviews schema, SQL, audit, and tests.
3. Run the read-only production duplicate audit with explicit authorization. If non-zero, stop for reconciliation.
4. Apply 0006 to production before deploying R7-1B runtime duplicate handling.
5. Generate/test/review 0007. Apply it to production before any R7-1C/D/E runtime references the new tables.
6. Deploy R7-1C/D, run bounded duplicate-request drives, then R7-1E.
7. At every stage verify Railway health and migration journal. No automatic destructive repair, lock release, ledger rewrite, or rollback.

## 10. Explicit exclusions

- R7-2 cross-tab/reload progress UI, polling/subscriptions, heartbeat worker, automatic stale-operation recovery, and exactly-once board landing acknowledgement.
- R7-3 Profile/recast/refine UX redesign.
- R7-4 strip/history/pin retirement.
- R7-5 archive/R2 cleanup.
- R7-6/7 evidence composer, marks, plates, snapshots, masks, or rollback.
- Wardrobe behavior changes.
- Reintroducing public 2K/4K upscale or export-time regeneration before the ratified persisted quality/owned-derivative contract.
- Any production ledger correction or stale-lock release without separate evidence and authorization.

## 11. Review gates

1. **Plan gate (now):** Fable reviews this entire document against current code, specifically the discovered credit-write routes, parent-operation phase-boundary correction, schema shapes, lock semantics, financial invariants, and Canvas scope.
2. **R7-1A gate:** staged diff + route absence tests + exact-id concurrency evidence. Commit/deploy separately.
3. **R7-1B gate:** read-only audit output + generated 0006 SQL + ledger concurrency tests. Migration authorization is separate from code approval.
4. **R7-1C gate:** generated 0007 SQL + claim/lock concurrency tests + privacy review of stored hashes/results.
5. **R7-1D gate:** direct Casting duplicate drives, mint CAS proof, credit conservation table, failure injection.
6. **R7-1E gate:** Canvas duplicate/partial-success drives and full suite/build.
7. **Release gate:** production migration state, Railway deploy health, bounded live smoke. Do not use full-auto for any R7-1 batch.

---

*Prepared from a fresh code inspection at `f790862`. This document changes the high-level R7 phase boundary only to avoid two competing idempotency/operation systems: R7-1 creates the minimum final parent record; R7-2 completes durable orchestration and recovery. No product code, database, production system, credits, push, or deployment was touched while producing it.*
