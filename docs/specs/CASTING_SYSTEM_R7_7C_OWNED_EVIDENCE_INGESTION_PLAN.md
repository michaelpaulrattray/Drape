# R7-7C — owned evidence ingestion execution plan

**Status:** corrected implementation plan for Fable challenge; no migration,
runtime capability, flag change, upload, or production operation is authorized
by this document alone.

**Authority:** `CASTING_SYSTEM_R7_6_EVIDENCE_COMPOSER_DESIGN.md`, D-65, the
R7-5 exact-key cleanup contract, the R7-7A/B snapshot authority, and the access
control invariants in `CLAUDE.md`.

## 1. Product result and hard boundary

R7-7C creates the safe storage and ownership boundary that the later ink pilot
will use:

- a draft Cast owner can stage one validated reference image when the
  server-owned founder scope is enabled;
- Drape canonicalizes it, assigns an opaque ID and a fresh, single-owner,
  exact Drape key, and records server-derived dimensions, byte size, MIME, and
  content hash;
- future server code can persist contextual crops through the same boundary;
- discarded, failed, abandoned, model-deleted, and account-deleted evidence
  becomes a durable exact-key cleanup manifest;
- a crash after object upload but before final database attachment cannot
  create an unauditable orphan.

R7-7C does **not** call Gemini, deduct or refund credits, create or accept an
identity feature, alter identity/package snapshots, select an asset, insert
`model_assets`, change a Cast document, refresh siblings, expose a composer UI,
or weaken the current marks refusal. R7-7D owns generation, candidate schema,
candidate review, probes, billing, Accept/Retry/Cancel, and ink authority.

## 2. Preconditions and rollout posture

Before the migration or runtime is used:

1. R7-7B production reads remain at full parity with
   `R7_SNAPSHOT_READ_SCOPE=all`.
2. The retired Cast-slot pin route remains refused in snapshot mode.
3. The R7-5 storage cleanup worker and health reporting remain wired to server
   startup. A control that is not invoked does not count.
4. Existing model/account deletion manifests and GDPR export are extended in
   the same cumulative range as the new tables.
5. `R7_EVIDENCE_INGEST_SCOPE` is absent/off by default and parsed at boot. A
   malformed value stops startup. Supported values mirror the closed snapshot
   scope grammar: `off`, `all`, or `users:<positive ids>`.
6. Boot refuses when `R7_EVIDENCE_INGEST_SCOPE` is not `off` unless
   `ENABLE_STORAGE_CLEANUP_WORKER=true`. An enabled ingest path with inert
   recovery is a configuration error, not a degraded mode.

Migration, disabled-runtime deploy, founder enablement, and R7-7D are separate
operations with separate evidence and authorization.

## 3. Trimmed additive persistence — migration `0011`

### 3.1 `casting_evidence_ingestions`

This mutable table is the crash-recovery receipt because R2 and MySQL cannot
share one atomic transaction.

- `id` UUID primary key;
- `userId`, `modelId`, `operationId`;
- `purpose`: `reference_plate` or `evidence_crop`;
- `status`: `planned`, `stored`, `attached`, `cleanup_pending`, `cleaned`;
- exact server-generated `storageKey`;
- canonical MIME, dimensions, byte size, and SHA-256 content hash;
- nullable attached entity kind/id;
- nullable `cleanupBatchId`;
- `createdAt`, `updatedAt`, nullable `attachedAt`, `cleanupQueuedAt`.

Constraints:

- unique `operationId`;
- unique `storageKey`;
- index `(status, updatedAt)` for bounded reconciliation;
- index `(userId, modelId, status)`;
- no raw bytes, base64, prompt, descriptor, or provider response;
- no enforced database foreign keys. Owner/model closure is proved by
  owner-scoped application statements. This lets an older runtime complete a
  model/account deletion instead of being blocked by `RESTRICT` or silently
  cascading rows without scheduling their object keys.

The planned receipt is inserted before the adapter put, so the exact key is
durable before an object can exist. Immediately after `putCanonical` returns
the exact expected key, the service commits `planned → stored` before
attempting attachment. That marker is the durable evidence that the
object-store call succeeded. A crash before the marker leaves a conservative
`planned` receipt whose key can still be safely replayed or cleaned.
Finalization changes `stored → attached` only in the transaction that inserts
the immutable entity.

### 3.2 `model_reference_plates`

Immutable after insertion except permanent model/account deletion:

- UUID, `userId`, `modelId`;
- kind: `uploaded_reference` only in migration `0011`;
- exact owned storage key only; delivery is resolved at read time;
- canonical MIME, dimensions, byte size, and SHA-256 content hash;
- `createdByOperationId`, `createdAt`.

Constraints and invariants:

- unique storage key;
- unique created operation;
- index `(userId, modelId, createdAt)`;
- user/model are server-resolved and match a live owned model in the durable
  insertion transaction;
- every row owns a freshly written canonical object under
  `users/<userId>/models/<modelId>/evidence/plates/<plateId>.webp`;
- no evidence row may store a key copied from `model_assets`, another evidence
  row, a client URL, or a namespace outside the evidence grammar.

Single-owner keys are the invariant that makes exact-key discard safe.
Neither plates nor receipts persist a public URL or bucket-specific URL.

### 3.3 `model_evidence_crops`

Immutable contextual derivatives:

- UUID, `userId`, `modelId`, `plateId`;
- ontology version, zone, surface, and side;
- normalized source rectangle plus source dimensions;
- a fresh exact owned evidence key; delivery is resolved at read time;
- canonical MIME, output dimensions, byte size, and content hash;
- crop recipe version and `createdAt`.

The crop insertion proves, in the same durable transaction, that the plate
belongs to the same user and model. No client-facing 7C input accepts a zone,
rectangle, crop key, URL, hash, or dimensions. Only a later server recipe may
call the crop primitive. Crop lifecycle, deletion, GDPR, and cleanup are still
fully exercised in 7C tests.

Migration `0011` deliberately does **not** create candidate rows,
candidate-output ingestion purposes, selected-view adoption,
accepted-candidate adoption, or legacy-adoption policy. R7-7D owns that schema
and state machine under its own review.

### 3.4 Cleanup kind

Extend `storage_cleanup_batches.kind` additively with `evidence_cleanup`.
The existing worker remains the only object-deletion mechanism. No direct
best-effort deletion becomes product truth.

## 4. Image validation and canonicalization

One pure server utility accepts a strict image data URL for the founder-scoped
reference route and raw server bytes for future crop callers.

Validation order:

1. authenticated user, per-user rate limit, scope gate, and owned-live-draft
   model gate;
2. strict data-URL grammar and encoded-length bound;
3. strict base64 decode with no ignored junk;
4. decoded byte limit: 10 MiB;
5. magic-byte and decoder agreement;
6. Sharp metadata read with an input-pixel limit;
7. exactly one frame/page;
8. MIME allowlist: JPEG, PNG, or WebP only;
9. dimensions between 256 and 8192 on each side and at most 40 megapixels;
10. auto-rotate and re-encode as lossless WebP without metadata;
11. refuse when canonical output exceeds 10 MiB, even when the source was
    within its own 10 MiB limit;
12. re-check canonical dimensions/bytes and compute SHA-256 over canonical
    bytes.

The wire schema uses one derived encoded-length constant:
`4 * ceil(10 MiB / 3) + maximum accepted data-URL prefix`. It refuses an
oversized string before decoding and leaves honest headroom below the existing
15 MiB Express request limit.

SVG, GIF/animation, PDF, malformed/truncated images, MIME mismatch, empty
payloads, oversized inputs, and decoder bombs refuse with one closed public
message. Logs contain only user/model/operation IDs and a closed error code,
never bytes, URLs, keys, EXIF, or decoder/provider text.

The separate canonical-output ceiling prevents a compressed photographic input
from expanding into a much larger lossless object or memory/storage burden.
Canonical oversize is a refusal, never an implicit quality-changing
recompression.

## 4.1 Posture-neutral evidence storage

All evidence writes and owner reads go through one narrow evidence-delivery
adapter:

- `putCanonical(key, bytes, mime)` accepts only the evidence key grammar and
  must return the exact key;
- `resolveOwnerDelivery(userId, key)` produces the current owner-scoped
  delivery locator at read time and refuses unless the key's
  `users/<userId>/` prefix matches that authenticated owner;
- cleanup persists and consumes only the exact key, never a delivery URL.

The database stores no public URL. The adapter has a disposable test
implementation for 7C evidence and is the only seam that may later choose a
public bucket or private storage plus authenticated delivery. Therefore
migration `0011`, receipts, deletion, cleanup, and GDPR metadata remain neutral
to the founder privacy ruling. No real upload is enabled until the production
adapter matches that ruling.

## 5. Exact-key plate ingestion

The only 7C ingestion route is `stageReferencePlate`. Crop ingestion has no
route or client caller until a later reviewed slice.

### 5.1 Wire input

Protected strict mutation:

```text
{ modelId: positive int, clientRequestId: UUID, imageDataUrl: bounded string }
```

No `userId`, scope/read mode, storage key, URL, MIME, dimensions, content hash,
plate/crop ID, snapshot ID, model status, zone, or recipe claim is accepted
from the client.

### 5.2 Idempotent sequence

1. Capture `ctx.user.id` and server-owned evidence-ingest mode.
2. Apply the per-user limit and refuse unless the user is scoped and the model
   is an owned live draft.
3. Validate/canonicalize bytes and build a payload hash from model ID plus the
   canonical content hash.
4. Claim a durable generation-operation receipt of kind
   `evidence_plate_ingest`; replay with a different payload refuses.
5. Under the established operation lock order, re-prove owner, live draft,
   current snapshot head, and absence of a conflicting model operation.
6. Generate plate/ingestion UUIDs and the exact key:
   `users/<userId>/models/<modelId>/evidence/plates/<plateId>.webp`.
7. Insert and commit the `planned` ingestion receipt before any R2 call.
8. Call the evidence-delivery adapter's `putCanonical` with the canonical bytes
   and exact recorded key; require the returned key to match.
9. Commit `planned → stored`, scoped by owner, model, operation, key, and
   payload hash.
10. In one transaction, re-lock the owned live draft, re-check the quoted
    snapshot head, insert the immutable plate, mark the ingestion `attached`,
    and complete the operation receipt with a private plate result projection
    containing metadata and `plateId` only—never a delivery locator. Field
    names also obey `assertPublicOperationResult`; in particular the result
    does not use a `reference*` key.
11. Return only plate ID, MIME, dimensions, byte size, content hash, and the
    owner delivery locator resolved through the adapter, never a stored URL.

No database transaction or model row lock remains open across `putCanonical`.
The finalize transaction re-proves every authority and snapshot fence after
the object-store call. A behavioral test pins this ordering.

Replay:

- a completed operation returns the same closed stored metadata and re-resolves
  the owner delivery locator through the adapter on every replay;
- `planned`/`stored` with the same payload may safely re-put the same canonical
  bytes to the same key and finalize once;
- any payload, owner, model, or snapshot mismatch refuses;
- no replay creates a second key or plate.

If storage fails, the operation fails with no attached plate. If finalize
fails, the caller is invited to repeat the same payload during a short recovery
window. Only receipts that age out are adjudicated by the reconciler. A Sharp
or encoder-version change can alter canonical bytes and make replay fail
closed; therefore the recovery window is short and aged receipts are cleaned,
never guessed into attachment.

Both evidence operation kinds are added to the closed
`GENERATION_OPERATION_KINDS` contract. They remain in `claimed` status and
never enter `running`, acquire a running lease, start a heartbeat, or carry
credits. Success/failure finalizes through the existing claimed-operation
terminal functions with zero charged/refunded credits. Replay always honors a
terminal operation result before inspecting an ingestion receipt.

The same-payload recovery window is a named constant strictly shorter than the
existing 15-minute stale-claim horizon. Once the generic stale-operation
sweeper free-fails a claimed evidence operation, replay returns that terminal
failure. The evidence reconciler then cleans any aged `planned`/`stored` key;
it never changes the operation to `recovery_required`. A convergence test pins
the combined outcome: a sweeper-failed ingest operation plus an aged stored
receipt becomes a free terminal failure plus a cleaned key.

## 6. Bounded reconciliation and cleanup

The existing startup-wired storage cleanup worker gains a bounded pre-pass:

1. claim one stale non-attached ingestion receipt using lease/CAS semantics;
2. leave a safely replayable receipt inside the short recovery window alone;
3. otherwise create one `evidence_cleanup` batch containing its exact key,
   using the ingest operation ID as the batch `operationId`; store the batch ID
   on the receipt and atomically mark it `cleanup_pending`;
4. a `cleanup_pending` receipt refuses replay;
5. after the linked cleanup batch reaches its successful terminal state, a
   bounded follow-up changes `cleanup_pending → cleaned`;
6. never infer keys from URLs and never list/delete by prefix.

The worker processes a bounded number per sweep. Evidence metrics extend the
existing `getStorageCleanupHealth` result and its single warning path with
planned/stored counts, cleanup-pending count, failed manifests, and age of the
oldest non-attached receipt. Source guards and behavior tests prove the
reconciler is actually called by `startStorageCleanupWorker`.

`discardReferencePlate` is a separately idempotent protected mutation with
strict input `{ plateId, clientRequestId }`. It claims its own
`generation_operations` receipt of kind `evidence_plate_discard` and returns
the same closed result on replay. It locks the owned draft and plate, refuses
if a crop references it, creates the exact-key cleanup manifest using the
discard operation ID as the batch `operationId`, records the batch ID on the
ingestion, deletes the plate row, and marks the ingestion `cleanup_pending` in
one transaction. It never calls R2 directly.

Reconciler-created batches use the original ingest operation ID. This is safe
because a `cleanup_pending` receipt refuses replay. Discard-created batches use
the distinct discard operation ID, so the cleanup batch's unique operation
constraint and replay identity remain truthful.

Permanent model/account deletion deliberately permits a key already present in
an `evidence_cleanup` batch to appear again in its deletion manifest.
`storageDelete` is exact-key and idempotent, so the duplicate deletion is safe.
Deletion may remove the linked ingestion row while its batch remains pending;
the later `cleaned` follow-up treats the missing receipt as an expected no-op.

## 7. Deletion, rollback, fork, and privacy

In the same cumulative 7C runtime:

- final Cast deletion includes every plate, crop, and non-attached ingestion
  key in its existing exact-key manifest before deleting the evidence rows;
- account deletion does the same for the user's entire cohort;
- reference/crop rows disappear atomically with model/account data;
- GDPR export includes evidence metadata and an owner delivery locator resolved
  through the adapter at export time, but never
  cleanup leases, ingestion receipts, or operation internals. This is a
  boundary against staff and other users, not a claim that an owner-facing URL
  conceals its own object path;
- moderator/admin DTOs gain no evidence content;
- fork copying is not implemented in 7C because no evidence can become
  accepted canon yet; R7-7D must implement copy-on-fork before acceptance can
  be enabled;
- no background pruning touches attached plates. Only explicit discard or
  permanent deletion schedules cleanup.

The evidence tables intentionally have no enforced database foreign keys.
This keeps a pre-7C runtime rollback able to delete a model/account rather than
failing or cascading rows without an object manifest. The mandatory
post-rollback orphan audit explicitly scans evidence rows and the exact
evidence-key grammar before any re-enable.

## 8. Scope, reachability, and privacy ruling

`R7_EVIDENCE_INGEST_SCOPE` is a server-owned account allowlist. Absent means
off. Boot refuses a non-off scope unless the cleanup worker is enabled. The
client receives only a protected boolean capability. 7C adds no UI control, so
UI reachability remains zero, although an authenticated API capability exists
for the bounded founder ceremony.

Runtime caller allowlist:

- one protected `stageReferencePlate` mutation;
- one protected `discardReferencePlate` mutation;
- internal crop primitives called only by tests in 7C;
- bounded reconciliation from the existing cleanup worker;
- deletion and GDPR readers.

No public procedure, generation worker/scheduler, provider, credit,
snapshot-transition, `model_assets`, Canvas, or Wardrobe writer may import the
ingestion service.

Customer-uploaded reference photos may contain real likenesses. Previous M7
discussion concerns generated images and does not decide this new privacy
posture. Before `users:1` can be enabled, the founder must explicitly choose:

- **recommended strongest posture:** private object storage served only through
  an authenticated, owner-scoped delivery path; or
- permanent unauthenticated, unguessable public URLs, explicitly accepting
  link-lifetime exposure.

Migration and scope-off runtime work can proceed without this ruling because
the schema persists only posture-neutral keys and all put/serve behavior sits
behind the adapter. No production adapter that permits a real upload, and no
founder enablement, may land before the ruling.

## 9. Verification slices

### 9.1 C1 — contracts and trimmed schema

- ingestion, plate, and crop schemas and indexes;
- `evidence_cleanup` enum widening;
- migration contract test and ≤0011 disposable driver;
- mixed-version contract: old `model_delete` and `account_delete` batch kinds
  remain insertable after the enum widening, while `evidence_cleanup` is
  available to the new runtime;
- source guard pins that the worker delete loop remains kind-agnostic;
- no runtime caller.

### 9.2 C2 — validator and exact-key primitive

- full validation/canonicalization matrix;
- magic/MIME mismatch, animation, EXIF stripping, rotation, size/pixel bounds;
- canonical-output amplification over 10 MiB refuses;
- canonical byte/hash determinism;
- key grammar, single ownership, and output projection;
- owner-delivery prefix mismatch refuses;
- `planned → stored → attached` against the disposable evidence-delivery
  adapter;
- returned-key equality and no open transaction across `putCanonical`.

### 9.3 C3 — recovery before capability

- reconciler pre-pass and receipt-to-batch linkage;
- convergence with the generic stale-operation sweeper;
- successful cleanup changes `cleanup_pending → cleaned`;
- final Cast/account deletion manifests include every evidence key;
- GDPR projection and rollback orphan audit;
- source guards pin startup reachability and forbidden imports;
- route capability remains absent.

### 9.4 C4 — operation-bound routes last

- scope off and foreign/minted/deleted/archived refuse before storage;
- scope-on/worker-off boot refusal;
- both evidence kinds are in the closed operation vocabulary, remain claimed,
  and never acquire a running lease;
- strict input rejects every authority field;
- stored operation result uses safe metadata keys and never stores a delivery
  locator; replay resolves delivery anew;
- per-user limit runs before decode;
- replay returns one plate/key;
- changed-payload replay refuses;
- storage/finalize failures leave honest receipts;
- discard owns an operation receipt and replays one cleanup batch;
- no credits/provider/snapshot/model-asset writes.

### 9.5 Required evidence before disabled deploy

- `pnpm check`;
- focused and full unit suites;
- production build;
- disposable MySQL migration and failure/concurrency cases;
- disposable evidence-delivery adapter proving exact-key put/delete behavior
  without production R2;
- `git diff --check`;
- Fable review of each staged slice and the cumulative 7C range.

## 10. Deployment gates

1. Commit C1–C4 locally in separately reviewed slices.
2. Run disposable MySQL/object-store proof.
3. Review the cumulative range and mixed-version deployment.
4. Apply migration `0011` under separate authorization.
5. Deploy runtime with `R7_EVIDENCE_INGEST_SCOPE=off`.
6. Verify boot, health, cleanup worker, and all existing R7/R6 behavior.
7. Record the founder privacy ruling from section 8.
8. Implement and review the production evidence-delivery adapter selected by
   that ruling.
9. Only after that ruling and adapter, separately authorize `users:1` and run a
   bounded upload/discard browser ceremony with no generation or credits.
10. Stop. R7-7D requires a new plan/review and may not infer authorization from
   successful 7C ingestion.

Rollback turns the ingest scope off. Existing attached rows remain inert and
owned; cleanup manifests continue to run. Runtime capable of deleting/exporting
evidence must deploy before the route can ever be enabled. A code rollback
after any 7C write requires the explicit evidence orphan/dependency audit before
re-enable and may not assume old code understands the new rows.
