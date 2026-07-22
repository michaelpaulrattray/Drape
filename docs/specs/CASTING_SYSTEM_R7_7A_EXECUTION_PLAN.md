# R7-7A Snapshot and Selection Execution Plan

**Date:** 2026-07-22
**Baseline:** `09aed73`
**Status:** ready for bounded execution and Fable challenge
**Authority:** D-65, `CASTING_SYSTEM_R7_6_EVIDENCE_COMPOSER_DESIGN.md`, `CASTING_SYSTEM_R7_7A_SNAPSHOT_SELECTION_INVENTORY.md`

## 1. Outcome

R7-7A establishes immutable snapshot and explicit-selection infrastructure while the current R6 read model remains authoritative. It ships in migration-before-runtime slices so old production code can run safely after the additive schema lands.

It does not expose the evidence composer, tattoos, plates, candidates, whole-Cast restore, snapshot UI, pin removal, automatic refresh or any new paid action.

## 2. Slice order

### R7-7A1 — Additive schema contract only

Add migration 0010 containing:

- nullable `models.currentPackageSnapshotId`;
- non-null `models.stateVersion` default `0`;
- nullable `models.sealedIdentitySnapshotId` and `sealedPackageSnapshotId`;
- nullable `generation_operations.expectedStateVersion`, `expectedIdentitySnapshotId`, and `expectedPackageSnapshotId`;
- `model_identity_snapshots`;
- `model_package_snapshots`;
- `model_package_snapshot_slots`.

No route, writer or reader uses the new objects in A1.

Schema implementation decisions:

- snapshot and selection ids are application-generated UUID strings (`varchar(36)`);
- snapshot sequence is unique per model; R7-7A2's writer starts at `1` and rejects non-positive values at the service boundary;
- `createdByOperationId` is nullable only for convergent bootstrap/backfill; live user operations must provide it;
- models without a filled headshot legitimately have no snapshot head;
- identity reasons add `document_compact`; package reasons add `image_refine` so live writers are not mislabeled;
- slots have their own UUID primary key so `sourceSelectionId` is real provenance;
- unique `(packageSnapshotId, viewAngle)` and `(packageSnapshotId, selectedAssetId)` constraints enforce one angle and no duplicate selected asset per package;
- cross-model ownership, same-angle asset selection, immutable rows and paired-head laws are enforced in locked transaction services and disposable tests. No foreign keys are introduced during the mixed-runtime phase because the existing schema intentionally performs ordered application deletion and old runtime knows nothing about the new tables.

Required A1 proof:

1. schema, SQL, snapshot and journal agree exactly;
2. 0000–0009 runtime insert shapes still work after 0010;
3. historical model/asset/operation rows survive with null pointers and stateVersion `0`;
4. unique sequence, slot-angle and slot-asset constraints reject duplicates;
5. closed reason/state vocabularies reject unknown values;
6. no runtime production file imports the new tables beyond schema/contract/tests;
7. guarded disposable runner creates and drops only a fresh `drape_r7_7a1_disposable_*` database and never contacts storage/provider services.

**Gate:** typecheck, focused contract tests, guarded disposable MySQL proof, full suite, build, Fable review, local commit, then separate founder authorization for production migration 0010. A2 cannot deploy before 0010 exists in production.

### R7-7A2 — Bootstrap service and model-head CAS

After migration 0010 is present in production:

- implement one locked bootstrap constructor from current R6 truth;
- select newest filled canonical rows, never failure markers;
- resolve anchor and displayed headshot separately;
- create one immutable identity snapshot, package snapshot and explicit slot set;
- CAS the model from null head/stateVersion `0` to the package head/stateVersion `1`;
- make replay convergent: an existing equivalent head returns it; a changed legacy state appends/corrects rather than declaring stale parity successful;
- exclude archived/deleted and foreign models;
- expose no new client capability.

Add a guarded backfill/audit tool only after lazy bootstrap code exists. It reports counts/hashes, never prompts, schemas, preferences, names or URLs.

### R7-7A3 — Dual writers

Adopt the inventory writers under the model operation lock:

- initial headshot/create and fork bootstrap;
- image-only refine/package append;
- identity edit, anchor reroll and structured recast paired append;
- add views/mint/late view;
- refresh settlement;
- slot restore;
- compact-prompt document snapshot;
- mint seal pointers while retaining the existing identity-revision CAS.

Every new operation captures expected stateVersion and snapshot ids on the server receipt. Snapshot/model-head/asset/model-document changes that represent one state transition commit atomically. Partial generation outcomes append only after durable successful assets are known.

### R7-7A4 — Shadow reads and convergence

Build a private server comparator for:

- selected slots versus current package-state slots;
- anchor versus current anchor selector;
- displayed headshot;
- stale/current compatibility;
- mint/refresh plan inputs;
- export and board/library selections;
- model documents versus identity snapshot;
- sealed mint pointers.

It emits only ids, counts, enum mismatch kinds and hashes. It never logs identity content or URLs. Snapshot reads remain disabled. Convergence/backfill runs after dual-write deploy, followed by fresh parity.

**R7-7A completion gate:** zero unexplained mismatches for founder/test cohorts, writer inventory closed, rollback proven, Fable approval, and founder authorization. R7-7B owns read cutover and pin retirement.

## 3. Non-negotiable invariants

- R6 is the read authority throughout A.
- No client-provided snapshot authority.
- No snapshot head before a valid filled anchor exists.
- Identity snapshot creation and its referencing package snapshot are paired.
- After mint, package appends reference the sealed identity snapshot.
- A package append copies every unchanged slot explicitly.
- Identity change marks every filled sibling stale, pinned included.
- Failure markers and candidate assets are never selected.
- Nothing generates or spends automatically.
- Rollback disables new reads; old rows and fields remain valid.
- Deletion and account erasure cannot leave snapshot rows behind.

## 4. Review cadence

Each slice is staged and reviewed independently. Fable returns either:

- `APPROVE — safe to commit R7-7A<n> locally`, or
- `REQUEST CHANGES` with a concrete reachable blocker.

Migration application, runtime deploy, snapshot-read enablement and later evidence feature flags remain separate founder-authorized gates.
