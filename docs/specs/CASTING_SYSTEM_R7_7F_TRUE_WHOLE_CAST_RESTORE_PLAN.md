# Casting System R7-7F — True Whole-Cast Restore Plan

**Status:** code deployed with no restore-scope mutation; separately authorized founder evidence/drive gate pending
**Authority:** `CASTING_SYSTEM_R7_6_EVIDENCE_COMPOSER_DESIGN.md` §6.5,
§6.6, §14, §18, and §20; `CASTING_SYSTEM_R7_REVIEW_AND_EXECUTION_PLAN.md`
§7–§9
**Scope:** free, append-only, draft-only restore of one historical immutable
Cast state; no paid generation, provider request, storage copy, evidence
category widening, or production-scope widening

## 1. Product contract

“Restore this Cast state” creates a new current state from an older immutable
state. It never rewrites history.

One restore:

1. selects one older identity snapshot owned by the authenticated user’s Cast;
2. pairs it with the package snapshot created by the same operation;
3. appends a new identity snapshot whose parent is the current identity and
   whose `restoredFromSnapshotId` names the selected historical identity;
4. copies the historical documents, anchor authority, and selected feature
   graph;
5. appends a new package snapshot whose selections reproduce the paired
   historical package;
6. omits a non-anchor selection whose asset is no longer available, so the
   slot is honestly missing;
7. advances the model head through the existing state-version CAS; and
8. finalizes one zero-credit durable operation in the same transaction.

The current snapshot remains the newest chronological ledger entry. Restore
provenance forms an internal DAG through `parentSnapshotId` and
`restoredFromSnapshotId`; the public UI presents unique semantic Cast states
rather than exposing restore audit hops as additional user-facing versions.

This is not the existing per-view “Use this version” action. That action
remains package-only reuse inside the current identity. R7-7F is a true
identity transition.

## 2. Lifecycle and rollout

- Draft Cast: may restore an older available state.
- Minted/locked Cast: restore refuses before mutation and routes to the
  existing Fork ceremony. R7-7F does not add package-only restore within a
  sealed identity and does not silently fork.
- Archived/deleted/provisioning Cast: unavailable under the existing model
  availability contract.
- A restore point representing the current identity is informational only and
  cannot be selected.
- An unresolved evidence intent or active evidence candidate blocks restore.
  The user must finish or discard that work; restore never silently cancels it.

Add server-owned `R7_SNAPSHOT_RESTORE_SCOPE` with the same strict
`off | users:<ids> | all` grammar as snapshot reads. It defaults to `off` and
must be a subset of `R7_SNAPSHOT_READ_SCOPE`. The client cannot influence it.
Deployment and founder enablement are separate operations:

1. deploy verified code with restore scope `off`;
2. run read-only founder-account timeline/preflight evidence;
3. separately authorize `users:1`;
4. founder-drive featureless and evidence-bearing draft restores;
5. return the scope to `off` on any invariant failure without deleting rows.

No evidence ingestion/composer/package scope changes are part of R7-7F.

## 3. Historical state pairing

The whole-Cast timeline has one entry per unique semantic identity state.
Ordinary identity snapshots define states. A valid restore snapshot resolves
transitively through `restoredFromSnapshotId` to its original non-restore
identity and is coalesced into that state. The state containing the current
identity head is presented first. Every restore snapshot remains in the
immutable ledger; only the public projection is collapsed.

The paired package is the package snapshot created atomically with that
identity:

- for a live snapshot, `identity.createdByOperationId` and
  `package.createdByOperationId` must match and the package must reference the
  identity;
- for convergent bootstrap rows, both operation ids are null, the package must
  reference the identity, and exactly one bootstrap/create package may be the
  pair;
- zero or multiple valid pairs make that restore point unavailable and block
  execution.

Later package-only slot generation, refresh, per-view restore, mint, and late
view snapshots are not separate whole-Cast timeline entries. Their version
history remains in the existing per-view UI.

The route exposes the paired package UUID only as an opaque
`restorePointId`. Possession is not authority: execution independently proves
the package, identity, model, and authenticated owner in the locked
transaction.

## 4. Availability and exact-copy rules

The selected historical identity must have:

- matching model ownership;
- a valid identity-text hash;
- a non-empty `frontClose` anchor asset owned by the same model;
- a paired package whose `frontClose` selection is that anchor;
- no duplicate angle or selected-asset rows.

Each historical slot is copied only when its selected asset still exists,
belongs to the same model, matches the selected angle, has a non-empty public
URL, and is not a failure marker. An unavailable non-anchor slot becomes
missing. The server never substitutes a newer asset.

“Available” is database/storage-ownership authority, not a live R2 network
probe. Planning and restore perform no object read or `HEAD` request. Existing
authenticated/public delivery remains responsible for surfacing a genuinely
missing object through its normal unavailable-image behavior.

Feature selections are copied generically, not through the ink-pilot
classifier. Every selected feature and version must belong to the same model,
the version must belong to that feature, and every non-null accepted/source
asset, plate, crop, or reference link required by the selected version must
close to a same-model row. An unavailable selected feature graph blocks the
whole restore; it is never partially erased.

New feature-selection rows use `selectionReason = restored` and point
`sourceSelectionId` at the historical selection. Restoring a featureless
state writes zero feature selections, deliberately removing features from the
new current identity without deleting their history.

New package-selection rows retain the historical compatibility value, use
`selectionReason = restored`, and point `sourceSelectionId` at the historical
selection.

## 5. Dual-write rollback compatibility

Snapshot selections continue to point at the exact historical asset ids. This
preserves exact feature-version closure, including an accepted feature
version whose `acceptedAssetId` must equal its selected evidence-bearing
view.

Inside the same restore transaction, the legacy asset ledger also receives
one zero-cost copy-forward row for every available historical selection:

- same model, angle, resolution, public URL, and storage key;
- no object copy and no new public/private storage ownership;
- `pinned = false`;
- provenance records `engine = restore` and `restoredFromAssetId`;
- a newly minted legacy identity revision stamps the headshot copy as
  `anchor` and sibling copies as `display`;
- historical `stale` remains stale; `unverified` is conservatively stale in
  the R6 compatibility projection.

The model’s mutable documents are dual-written from the historical identity
and `identityRevisionId` advances. Consequently disabling snapshot reads
shows the same restored images and documents through R6 newest-filled truth,
while snapshot readers retain the exact immutable selection graph.

The copy-forward rows are compatibility projections only. They are not the
new snapshot selections and do not change feature evidence.

Snapshot consumers must not reinterpret the restored historical asset’s old
legacy `identityRevisionId` as current authority. In particular, snapshot mint
planning/execution must evaluate the immutable identity snapshot plus explicit
slot compatibility, not reject an exact restored selection because its
original ledger provenance predates the newly dual-written rollback revision.
The snapshot mint adapter may create a trusted in-memory current-revision
projection for its existing legacy integrity helper; it must not mutate the
historical row or weaken stale/unverified checks. The same audit covers
iteration, refresh, export, Wardrobe, Canvas, registry, and per-view history.

## 6. Durable operation and atomicity

Add a distinct operation kind, `casting.restore_state`. The existing
`casting.restore` remains per-view and evidence-blind.

`casting.restore_state` is:

- zero planned, charged, and refunded credits;
- model-lock scoped;
- evidence-aware because it deliberately replaces a server-proven selected
  feature graph;
- non-provider and non-storage;
- replay-safe by `clientRequestId` plus trusted payload hash; and
- non-cancellable.

The receipt captures the current state version, identity snapshot, package
snapshot, and legacy revision when it becomes running. The locked transition
re-proves the historical target and then commits all of the following or none:

1. mutable document/revision dual-write;
2. legacy copy-forward asset rows;
3. new identity snapshot;
4. restored feature-selection rows;
5. new package snapshot;
6. restored package-selection rows;
7. model-head/state-version CAS; and
8. running-operation success receipt plus lock release.

Add a transaction-scoped running-operation success finalizer so the product
state and zero-credit receipt cannot separate. A response lost after commit
replays the stored result. A stale pre-commit running operation has no durable
restore rows and resolves as a standard free failure. Any contradictory
receipt/snapshot shape remains `recovery_required`; recovery never guesses or
adds a second restore.

The public terminal result contains only `modelId`, `stateVersion`,
`restored: true`, selected-view count, and canonical missing-angle names. It
contains no snapshot ids, feature ids, evidence locators, prompts, or storage
keys.

## 7. Transition service changes

Extend the private snapshot transition specification with two closed modes:

- feature selections: existing `carryCurrent` mode or
  `replaceWithHistorical`, including an empty list;
- package selections: existing carry/overlay mode or
  `replaceWithHistorical`.

Only `restore + whole_restore + evidence_aware` may use replacement modes.
Each source selection is re-proven in the transaction. Existing writers keep
their current type shape and behavior.

Add `commitWholeCastRestore` as the only live caller. It resolves no client
authority beyond the opaque restore-point selection and uses the generic
transition boundary for the append/CAS.

## 8. Router contract

Add two protected procedures under `generation`:

### `castStateHistory`

Input: `{ modelId }`.

Output:

- `enabled`;
- lifecycle (`draft | minted`);
- unique state restore points with opaque `restorePointId`, timestamp,
  reason label, preview URL when available, selected-view count,
  feature count, `current`, `available`, and a closed unavailable reason;
- top-level `canRestore` and `forkRequired`.

The query is owner-scoped, read-only, snapshot-only, and fail-closed. It never
returns documents, prompts, technical schema, feature descriptors, private
evidence, internal identity ids, or storage keys.

### `restoreCastState`

Input:
`{ clientRequestId, modelId, restorePointId }`.

The route captures restore scope once, refuses when disabled or outside
snapshot reads, claims `casting.restore_state`, acquires the model lock,
performs a read-only preflight, marks the receipt running at zero credits, and
executes the atomic restore. Replay returns the durable public result and
fresh server truth; it does not re-run the transition.

## 9. Studio UI

Add a restrained “Cast states” section above per-view details in
`CastingDetailsDialog`.

- Show compact unique-state rows with a headshot preview, original state date,
  state label, view count, and feature count.
- Put the semantic state containing the newest identity head first and mark it
  “Current”; never render `Restored state` audit hops as separate rows.
- Selecting an available older draft row reveals one inline confirmation:
  “Restore this Cast state”. Supporting copy says it is free, makes the
  selected state current, and keeps the other states.
- Unavailable rows remain visible and name only a safe closed reason.
- A minted Cast shows the timeline read-only and one existing Fork door; it
  never presents Restore as permitted.
- Pending state holds the selected row and prevents duplicate requests.
- Success closes the confirmation, publishes
  `publishCastProjectionChanged(modelId)`, reloads `models.get`, package
  state, refresh/mint plans, per-view history, and Cast states, and lets the
  workspace’s durable-operation bridge rehydrate current assets/documents.
- Failure leaves the current Cast unchanged and shows the server message.

No new modal, technical snapshot ids, graph visualization, destructive-red
styling, or automatic generation is introduced.

## 10. Verification gates

### Pure/unit

- restore-scope parser, subset validation, and capture;
- deterministic identity/package pairing;
- historical availability and safe public projection;
- featureless restore and exact evidence-bearing graph restore;
- unavailable non-anchor slot becomes missing;
- unavailable anchor or feature graph refuses;
- current target, foreign target, wrong model, minted lifecycle, unresolved
  intent/candidate, malformed hash, duplicate selection, and disabled scope
  refuse free;
- transition replacement modes are unreachable from every non-restore kind;
- R6 copy-forward parity preserves exact image URLs/documents and conservative
  compatibility;
- snapshot mint remains possible for restored `current` selections even
  though their immutable ledger provenance belongs to the historical legacy
  revision; stale/unverified restored selections still refuse;
- iteration, refresh, export, Wardrobe, Canvas, registry, and per-view history
  all resolve the restored snapshot head without legacy-revision laundering;
- operation kind, feature authority, replay-family, stale recovery, landing,
  and public-result maps remain exhaustive;
- client timeline states, confirmation, invalidation, and minted Fork door.
- repeated and transitive restore hops collapse into unique semantic states
  while execution still appends every restore snapshot.

### Disposable MySQL

- one restore appends exactly one identity and one package snapshot;
- parent and restore-source links are exact;
- zero-feature restore removes current features without deleting history;
- evidence-bearing restore preserves the exact selected feature/version graph;
- package selections match the paired historical package minus only proven
  unavailable non-anchor slots;
- mutable documents/revision and legacy copy rows match snapshot-visible
  restored images;
- CAS race, restore-vs-delete, restore-vs-mint, restore-vs-evidence accept,
  duplicate client request, and model-lock contention;
- failure injection at every durable boundary rolls back model, assets,
  identity, feature selections, package, head, receipt, and lock together;
- zero credit-ledger rows for success, refusal, replay, and recovery;
- permanent model/account deletion still removes every appended row without
  new object double-deletion.

### Local release

- focused R7-7F tests;
- full `pnpm test`;
- `pnpm check`;
- `pnpm build`;
- `git diff --check`;
- one consolidated milestone review;
- authenticated app verification with restore scope locally bounded to a
  disposable/test owner, with no provider invocation.

## 11. Bounded implementation order

1. F1 — scope, operation vocabulary, pairing/availability projection, tests.
2. F2 — closed transition replacement modes and atomic success finalizer.
3. F3 — whole-restore service plus failure-injection/disposable-DB coverage.
4. F4 — protected history/restore routes and replay/refusal tests.
5. F5 — Studio timeline/confirmation/invalidation UI and component tests.
6. F6 — full verification and consolidated review.
7. F7 — deploy code with restore scope off.
8. F8 — separately authorized founder-only scope enablement and live
   no-provider restore drive.

R7-7F closes only after the founder drive proves both a featureless historical
state and an evidence-bearing historical state restore correctly, or after a
reviewed explanation shows why one of those states is not yet present in the
founder account and an equivalent disposable-DB proof is accepted. No paid
generation is part of closure.

Founder UX correction (2026-07-29): the first live drive proved that exposing
each append-only restore snapshot as a separate `Restored state` row produces
mechanical version clutter. The public history therefore coalesces valid
restore chains into their original semantic states. This changes presentation
only: provenance, receipts, parentage, rollback safety, and the append-only
ledger remain intact.

## 12. Local implementation record — 2026-07-29

F1 through F6 are implemented. The restore scope is server-owned and defaults
off; whole restore uses a distinct free durable operation and the existing
model lock; historical package and generic feature selections are re-proven;
the mutable rollback projection, immutable identity/package append, model-head
CAS, zero-credit receipt, and lock release settle in one transaction. The
Studio timeline remains absent when restore scope is off.

The consolidated direct milestone review tightened four boundaries before
release:

- an accepted feature asset must be one of the exact available historical
  package selections;
- disabled/unavailable public rows use a one-way digest rather than exposing
  an internal identity id;
- accounts outside restore scope take a minimal owner/lifecycle read and do
  not traverse snapshot history; and
- snapshot mint uses a trusted in-memory current-revision projection for an
  exact historical selection while retaining restrictive stale/unverified
  behavior.

Verification evidence:

- focused R7-7F: 40 passed; the 38 disposable-MySQL transition tests skipped
  because no guarded `TEST_DATABASE_URL` is configured;
- full unit/contract suite: 236 files and 3,102 tests passed, 21
  environment/database files and 239 tests skipped;
- `pnpm check`: passed;
- `pnpm build`: passed;
- no image generation, paid operation, production-data read/write, storage
  operation, or production variable change was performed.

The repository verification recipe cannot safely exercise this interaction
with its empty `verify-bot-local` account, and the local environment has no
disposable snapshot model/database.

F7 deployed at commit `d70a489` as Railway deployment
`52d8fb8d-0de1-4734-aba3-d12d05d2cdb5`. Railway reported terminal `SUCCESS`,
the instance was running, bounded startup logs showed the server listening,
and `/api/health` reported healthy with the database up. No production
variable was changed. A targeted restore-scope readback was not performed
because the available CLI path would retrieve the complete secret-bearing
variable set before filtering and that broader read was not authorized.
Exact scope confirmation, privacy-safe founder history/preflight evidence,
and F8 enablement remain separate gates.
