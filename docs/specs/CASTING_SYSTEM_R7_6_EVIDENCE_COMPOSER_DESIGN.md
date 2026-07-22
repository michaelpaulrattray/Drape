# Casting System R7-6 — Identity Snapshots and Evidence Composer Design

**Date:** 2026-07-22
**Baseline:** `f926848` (`main`; deployed to production through `local-migration`)
**Status:** FOUNDER-RATIFIED (2026-07-22) after Fable challenge and correction against live code at `f926848`. Design and calibration only; no schema, runtime, migration, flag, or production change is authorized by this document
**Governing sources:** `CASTING_SYSTEM_R7_REVIEW_AND_EXECUTION_PLAN.md`, `CASTING_SYSTEM_AUDIT_ADDENDUM_REVISED.md`, `IDENTITY_EDIT_INTERIM_POLICY.md`, D-56, D-62, D-64

## 1. Executive decision

R7-6 defines the authority model that R7-7 may build. It does not implement the composer.

The core design decision is to separate two histories that current code conflates:

1. **Identity history** — immutable documents, authoritative visual evidence, marks, parentage, and the identity anchor.
2. **Package history** — the explicitly selected image for each canonical view and whether that selection is current, stale, or unverified against the selected identity.

Every effective Cast state is therefore:

> one immutable identity snapshot + one immutable package snapshot that selects zero or one asset for each canonical view.

The model row carries only the current package-snapshot pointer and a compare-and-swap state version. The package snapshot points to its identity snapshot. No reader infers current truth from newest rows, numeric revision ordering, a pin, or asset JSON.

This split is required because:

- an identity edit changes who the Cast is and makes sibling views stale;
- an image-only refinement changes one photograph without changing identity;
- a per-view restore changes one selected photograph without rolling identity backward;
- a true restore changes the whole identity/package state but must preserve history;
- a missing view added after mint may extend the package without extending sealed identity;
- assets can remain valid across several package states and, when explicitly carried, across several identity snapshots.

## 2. Already-ratified product boundaries

These are not reopened in R7-6:

- Casting creates a reusable neutral person/character sheet. Canvas and Wardrobe own clothing, makeup, styling, props, and scene presentation.
- Minted Casts use a read-only Profile. Identity change routes to Fork.
- Missing views may be generated after mint through explicit priced actions.
- Nothing generates, refreshes, retries, accepts, or spends credits automatically except one disclosed internal validation retry included in a paid operation.
- Reference images provide evidence, never authorization.
- Initial Cast creation does not accept a reference image. References remain post-creation inputs.
- Tattoos/ink are the first evidence category. Other mark families remain refused until individually calibrated and enabled.
- A first unseen-region invention never becomes identity silently. The user gets **Accept / Retry / Cancel**.
- Pinning retires. Explicit package selections replace it.
- Restore is append-only. It creates a new current state and destroys no evidence.
- No Photoshop-style underlying layer, reveal composite, saved layer stack, or pixel-offset eraser.
- If erasure is ever enabled, it is a generative masked identity edit through the same classifier, evidence, candidate, validation, billing, and commit boundary.
- Deletion is permanent. Linked Cast views/placements/evidence are removed; independent downstream creative outputs remain.
- R6 refusals remain the fallback for every category not explicitly enabled by a server capability.

## 3. Current code truth at `f926848`

| Concern | Current authority | R7-6 correction |
|---|---|---|
| Identity documents | `models.masterPrompt`, `technicalSchema`, and `preferences` mutate in place | Immutable identity snapshot rows |
| Identity era | `models.identityRevisionId`; `NULL` means genesis | Snapshot ID, immutable parentage, and model state CAS |
| Identity anchor | newest filled `frontClose` with anchor role; legacy no-role rows count as anchors | Snapshot-owned `anchorAssetId` |
| Display headshot | newest filled `frontClose`, role ignored | Explicit selected `frontClose` asset in package snapshot |
| Package selection | newest filled row wins per view | Immutable package snapshot + six explicit slot selections |
| Freshness | JSON `status.state === "stale"` on newest asset | Slot-selection state relative to one identity snapshot |
| Pinning | mutable `model_assets.pinned`; refresh refusal | Removed after selection migration; no replacement lock concept |
| Per-view restore | copy-forward asset row inside current identity revision | new package snapshot using an existing compatible asset |
| True identity restore | unavailable | new identity snapshot copied from a historical snapshot + new package snapshot |
| Reference image | transient client base64; one additional generation input | validated, owned reference plate only for an authorized operation |
| Marks | creation-time ink prose only; every post-creation mark edit refuses | typed feature, zone, evidence version, candidate acceptance |
| View consistency gate | headshot vs generated back/walk; checker fails open | snapshot/evidence-aware typed validation; `unknown` cannot commit canon |
| Identity payload composer | `composeIdentityPayload.ts` exists but has no production caller; ordinary iterate explicitly bypasses it | one effective-snapshot composer adopted by every identity consumer |
| Generation durability | R7 parent operation receipt + child attempts + locks | reused; candidate review is a completed operation result, not a long-held lock |
| Storage cleanup | exact-key manifest and worker from R7-5 | extended to plates, crops, candidate assets, and snapshot/evidence rows |

The current R6 system stays authoritative until a model has a successfully bootstrapped snapshot head and the server-side read flag is enabled for that model/account.

## 4. Terminology

- **Identity snapshot** — immutable identity documents, anchor, and selected evidence versions describing who the person is.
- **Package snapshot** — immutable selection of Cast-view assets for one identity snapshot.
- **Effective Cast state** — the model's current package snapshot and the identity snapshot it references.
- **Feature** — a stable logical identity feature, initially tattoo/ink; future categories are separate capabilities.
- **Evidence version** — an immutable accepted physical description and owned visual evidence for a feature.
- **Reference plate** — an owned, validated full input image retained as evidence. It is not automatically a canonical Cast view.
- **Evidence crop** — an owned derivative containing enough anatomical context to preserve placement, not a Photoshop layer.
- **Candidate** — generated but unaccepted output. It is not a model asset, selected package view, identity anchor, or identity document.
- **First-region authoring** — the first time a feature is instantiated on a body region that has no accepted visual evidence.
- **Recipe version** — immutable identifier for composition, prediction, generation, probe, validation, retry, and crop behavior.

## 5. Persistence design

Names are provisional, but the responsibilities and constraints are binding once ratified.

### 5.1 Model head

Add to `models`:

- `currentPackageSnapshotId` — nullable during mixed-version bootstrap;
- `stateVersion` — monotonically increasing integer used for compare-and-swap;
- `sealedIdentitySnapshotId` — nullable; set once by mint;
- `sealedPackageSnapshotId` — nullable; records the package selected at mint.

The current identity snapshot is resolved through `currentPackageSnapshotId → model_package_snapshots.identitySnapshotId`. This avoids two independently mutable current pointers.

`identityRevisionId` remains during dual-write compatibility. It is not the R7 read authority after cutover.

During dual-write, mint keeps committing through `mintModelAtomically`'s `expectedIdentityRevisionId` compare-and-swap (`server/casting/mintPackage.ts:502-513`); the same transition dual-writes the seal columns. Only after cutover do mint and every other canon commit CAS on `stateVersion` + snapshot IDs.

### 5.2 `model_identity_snapshots`

Immutable columns:

- `id` UUID primary key;
- `modelId`;
- `sequence` integer unique per model;
- `parentSnapshotId` nullable;
- `restoredFromSnapshotId` nullable;
- `reason` closed vocabulary: `bootstrap`, `create`, `identity_edit`, `anchor_reroll`, `evidence_accept`, `evidence_remove`, `restore`, `fork_bootstrap`;
- full `masterPrompt`, `technicalSchema`, and `preferences` values;
- verbatim composed `identityText` plus `identityTextHash`;
- `anchorAssetId`;
- `recipeVersion`;
- `createdByOperationId`;
- `createdAt`.

Constraints and laws:

- unique `(modelId, sequence)`;
- every parent/restored source belongs to the same model;
- the anchor asset belongs to the same model and is server-authored;
- snapshot rows never update or delete except permanent model/account deletion;
- a restore's `parentSnapshotId` is the state being left and `restoredFromSnapshotId` is the historical state being copied;
- the UI presents a simple chronological timeline even though internal restore provenance forms a DAG.

### 5.3 `model_package_snapshots`

Immutable columns:

- `id` UUID primary key;
- `modelId`;
- `identitySnapshotId`;
- `sequence` integer unique per model;
- `parentPackageSnapshotId` nullable;
- `reason`: `bootstrap`, `create`, `identity_change`, `slot_generate`, `slot_refresh`, `slot_restore`, `add_views`, `whole_restore`, `mint`, `late_view`;
- `createdByOperationId`;
- `createdAt`.

One package snapshot always references one identity snapshot. A package-only change creates a new package snapshot pointing to the same identity snapshot.

Two closure laws keep the single-pointer resolution sound:

- **An identity snapshot becomes current only through a package snapshot that references it.** Every identity-snapshot-creating operation — including `evidence_accept`/`evidence_remove` commits that change no view selection — creates a paired package snapshot in the same transaction. There is no second path to current identity.
- **After mint, every new package snapshot must reference the sealed identity snapshot** until Fork. A late view or per-view restore can never re-point a minted model at a different identity snapshot.

### 5.4 `model_package_snapshot_slots`

One immutable row per selected slot:

- `packageSnapshotId`;
- `viewAngle` from the canonical six;
- `selectedAssetId`;
- `compatibility`: `current`, `stale`, or `unverified`;
- `selectionReason`: `generated`, `carried`, `refreshed`, `restored`, `late_view`, `bootstrap`;
- optional `sourceSelectionId` for copy-forward provenance.

Constraints:

- unique `(packageSnapshotId, viewAngle)`;
- an asset can appear at most once in one package snapshot;
- the selected asset belongs to the same model and angle;
- failed attempts and candidates are never selected;
- absence of a row means missing, not failed;
- failed generation truth stays on operation children/candidate results, not on an imaginary selected slot.

A selection row is the explicit proof that an asset is valid for that package/identity state. Numeric revision comparisons are never used.

### 5.5 Identity features and versions

`model_identity_features` is the stable logical record:

- UUID, model ID, category, created operation, created timestamp;
- no mutable `active` flag.

`model_identity_feature_versions` is immutable:

- UUID and feature ID;
- category (`ink` first; future `scar`, `pigmentation`, `piercing`, `structural` require separate flags and calibration);
- operation (`present`, `replace`, `remove`);
- ontology version;
- anatomical zone, surface, and side;
- normalized physical descriptor;
- source asset ID and source view angle;
- accepted plate/crop IDs;
- recipe version, operation ID, and timestamp.

`model_snapshot_feature_selections` maps an identity snapshot to zero or one selected version of each feature. This is the only active-feature authority.

No model-wide `hasBodyArt` keyword or prose grep controls prompting. Prompt rules derive from selected typed features:

- selected ink exists → preserve selected ink and forbid additional ink;
- category explicitly verified absent for the relevant zone → forbid that category there;
- unknown/unverified legacy state → do not promise propagation; refuse evidence-bearing operations that require certainty.

### 5.6 Owned plates and crops

`model_reference_plates`:

- UUID, user ID, model ID;
- kind: `uploaded_reference`, `selected_cast_view`, `accepted_candidate`, `legacy_adoption`;
- exact owned storage key and server-derived public URL;
- MIME, dimensions, byte size, content hash;
- source asset ID where applicable;
- created operation and timestamp.

`model_evidence_crops`:

- UUID, plate ID;
- ontology version, zone, surface, side;
- normalized crop rectangle and source dimensions;
- exact owned storage key and server-derived URL;
- content hash, crop recipe version, timestamp.

Rules:

- a URL is never accepted as ownership proof;
- upload MIME, decoded content, dimensions, size, and image safety are validated before persistence;
- crops include anatomical context; they are not transparent overlays or reveal layers;
- crop count is bounded by relevant zones, not number of marks;
- crop recalculation after an accepted edit is a versioned recipe operation, never an in-place overwrite;
- forked models must survive deletion of the parent. R7's first implementation uses copy-on-fork into new owned keys rather than shared-key inference.

### 5.7 Pending feature intents

`model_identity_feature_intents` persists a requested feature that has not yet produced accepted evidence:

- UUID, user ID, model ID, and source operation ID;
- category, ontology version, zone, surface, side, and normalized descriptor;
- state: `pending`, `resolved`, or `cancelled`;
- resolved candidate/feature IDs where applicable;
- created/resolved timestamps.

An intent is workflow truth, not identity authority. It is never selected by an identity snapshot and never enters the identity text. Intents and candidates are deliberately separate tables because their lifetimes differ: an intent persists across any number of generations until a view exposes the region or the user cancels; a candidate is one generation's reviewable output and records which intent it attempts to resolve. For feature-flagged creation, mark language is extracted and normalized before `masterPrompt`/`technicalSchema` construction; it cannot remain as an untracked prose instruction.

If the first generated view is predicted to show the intended region, that generation is a candidate and cannot land until accepted. If the region is not visible, ordinary clean-skin/anti-invention rules apply to the generated view and the intent remains pending for the first suitable view. Cancelling the intent sets it `cancelled` and removes it from all future composition. No identity snapshot is required because the intent was never canon.

### 5.8 Durable candidates

`casting_evidence_candidates`:

- UUID, user ID, model ID, originating operation ID;
- expected `stateVersion`, identity snapshot ID, package snapshot ID;
- target view angle;
- candidate kind: `feature_add`, `feature_replace`, `feature_remove`, `identity_edit`, `initial_mark_capture`, `legacy_adopt`;
- status: `ready`, `accepted`, `rejected`, `cancelled`, `expired`, `invalid`;
- normalized server-owned intent; for marks this includes category/zone/surface/side and typed descriptor;
- candidate asset, reference plate, and crop IDs;
- recipe version, created/expiry/resolved timestamps.

The candidate row itself (or a dedicated child table ratified with it) carries the exact owned storage key(s) of its generated output and any staged plate — candidate output images have no other durable home, because candidates are not inserted into `model_assets` and cannot be selected until acceptance.

Cleanup contract note: `storage_cleanup_batches.kind` is a closed enum of `model_delete` and `account_delete` today (`drizzle/schema.ts:337`). The migration that introduces candidates/plates must add an additive cleanup kind (for example `candidate_cleanup`) in the same batch, so rejected/cancelled/expired candidates can produce exact-key manifests through the proven R7-5 worker rather than a parallel mechanism.

Probe findings are typed rows or a strictly validated closed JSON shape containing only:

- predicted visibility;
- observed visibility;
- feature presence/match;
- zone/side correctness;
- identity consistency;
- pose/framing preservation;
- outcome `pass`, `fail`, or `unknown`;
- recipe/model version and bounded confidence values.

Raw chain-of-thought is never stored or returned.

## 6. State transitions

### 6.1 Initial bootstrap

For every non-deleted model:

1. create an identity snapshot from current documents;
2. choose the current identity anchor using the existing shared anchor selector;
3. create a package snapshot selecting the existing newest filled row for each angle — filled means non-null `storageUrl`, so failure-marker rows are never selected;
4. copy present stale truth into selection compatibility;
5. record no typed feature evidence unless it was accepted through an evidence ceremony;
6. no mark scan runs at bootstrap. `legacy_unverified` is not a stored per-mark classification — it is the implicit evidentiary state of every bootstrapped model (no typed evidence recorded, no verified absence recorded), consistent with §11.2's no-inference rule;
7. atomically set `models.currentPackageSnapshotId` with an expected-null/state-version guard.

Draft, active, and legacy locked rows bootstrap. Deleted/tombstoned rows do not, and neither do `archived` rows — FR-4 treats archived as deleted everywhere. Bootstrap is idempotent as **convergence**, not replay-equality: re-running against unchanged truth is a no-op; re-running after intervening R6 writes appends one corrective snapshot pair reflecting current newest-filled truth and never duplicates rows.

### 6.2 Package-only operation

Image-only iterate, refresh, add-view, or compatible per-view restore:

1. plan from current package snapshot;
2. generate or select the candidate asset outside a long transaction;
3. validate it against the referenced identity snapshot;
4. under the model operation lock, re-read current state/version;
5. insert accepted model asset if generated;
6. insert a new package snapshot and copy all unchanged selections;
7. replace only the affected slot selection;
8. update the model head with CAS and finalize the durable operation atomically.

Identity documents and feature selections remain byte-identical.

### 6.3 Identity edit

An authorized draft identity edit:

1. classifier/normalizer creates the same typed `AuthorizedIdentityPatch` used today;
2. evidence requirements are derived from the edited fields and target view;
3. generation produces a candidate, never current canon;
4. validation must pass or yield explicit candidate review;
5. acceptance creates a new identity snapshot with parent=current identity;
6. it creates a package snapshot selecting the new accepted anchor/current edited view;
7. sibling stale scoping — the R7-7 default remains the ratified R6 rule: **every filled sibling selection is copied as `stale`, pinned included** (D-56/R1; `server/casting/identity/identityCommit.ts` commits stale-all in one transaction). Narrowing to "physically affected siblings only" is a later calibrated capability behind its own flag; nothing in this step authorizes carrying a sibling as `current` until that affectedness rule ships with tests;
8. model head CAS and operation finalization happen in the same transaction.

Face, hair, skin, and body edits are no longer universally forced through a headshot. The authoring view must actually evidence the changed field. R7-6 requires a field-to-view/evidence matrix before any such expansion is enabled.

Provisional authoring matrix for calibration:

| Identity dimension | Minimum authoring evidence | Required validation evidence | R7 fallback until calibrated |
|---|---|---|---|
| face shape, jaw, cheeks, nose, lips, brows, eyes | selected `frontClose` | anchor + `threeQuarter` where available | existing R6 draft-headshot rule |
| short/medium hair style, texture, color | `frontClose` with hair visible | `threeQuarter`; `sideClose` when silhouette matters | existing R6 rule |
| long/very-long hair length, rear mass, nape shape | `frontFull`, `sideFull`, or `backFull` that shows the requested extent | anchor plus at least one orthogonal selected view | refuse evidence expansion; keep R6 behavior behind old flag |
| diffuse skin tone/texture | visible unoccluded skin in `frontClose`; `frontFull` when a body-wide change is claimed | selected face + body evidence | existing typed R6 path only |
| body build/proportions | selected `frontFull` | `sideFull`; back silhouette where available | deliberate Recast model ceremony |
| localized feature/mark | selected view that visibly contains the exact zone | zone crop + any view predicted affected | refuse until category/zone flag passes |
| age, gender, ethnicity/person-level recast | full Recast identity ceremony, not a local photographic tweak | new anchor plus required package validation | current Recast/Fork behavior |

The matrix grants no capability by itself. Each row needs a server registry entry, calibration result, feature flag, and tests. An attached reference never relaxes the minimum evidence.

### 6.4 Per-view restore

“Use this version” remains free and does not restore identity:

- source asset must be explicitly compatible with the current identity snapshot;
- create a new package snapshot selecting that asset for one slot;
- never create a new identity snapshot;
- never promote a display headshot into anchor authority;
- never delete history.

### 6.5 True whole-Cast restore

“Restore this Cast state”:

1. select a historical identity snapshot and its historical package snapshot;
2. create a new identity snapshot whose parent is current and `restoredFromSnapshotId` is the chosen historical snapshot;
3. copy its documents, anchor, and feature selections;
4. create a new package snapshot by copying the historical package selections;
5. mark any unavailable asset as missing—never silently replace it;
6. CAS the model head and finalize one free restore operation.

Restore never rewrites or deletes old snapshots. A later edit branches from the newly restored current snapshot while the internal provenance graph retains both parent and restore source.

**Lifecycle scope (applies existing law, not a new ruling):** true whole-Cast restore is **draft-only in the first release**. It creates a new current identity snapshot, which is an identity change; D-43 and D-62 ruling 5 reserve identity change on a minted Cast for Fork, and §6.6's seal law forbids re-pointing a minted model at a non-sealed identity snapshot. A minted Cast refuses whole-Cast restore and routes to Fork. A later, separately ratified ceremony could offer a **package-only** whole restore within the sealed identity (restoring historical selections without touching identity); it is not part of R7-7F.

### 6.6 Mint and late views

Mint performs one conditional transition that records the current identity and package snapshot as the seal. Mint refuses when:

- no authoritative anchor exists;
- required tier views are missing, stale, unverified, or pending acceptance;
- unresolved evidence intent could affect a required view;
- another operation owns the model lock;
- the quoted snapshot/version is no longer current.

After mint:

- identity snapshot and feature selections never change in place;
- missing views may derive from the sealed identity snapshot through explicit priced actions;
- a late view may create a new package snapshot but may not extend identity evidence silently;
- if the view exposes an unsealed/ambiguous evidence region, the first R7 release refuses and routes to Fork. A later separately approved ceremony may permit deliberate extension.

## 7. First tattoo/ink capability

### 7.1 Narrow pilot

The recommended first enabled capability is:

- draft models only;
- one tattoo/ink feature at a time;
- one calibrated front upper-torso zone;
- authored from a selected `frontFull` view;
- optional uploaded tattoo reference;
- explicit Accept / Retry / Cancel;
- affected siblings become stale but never refresh automatically;
- minted models refuse and route to Fork;
- add, replace, and remove are separate calibrated operations. Begin with add only.

This is deliberately narrower than “all tattoos everywhere.” It proves owned evidence, placement, hidden-view anti-invention, candidate acceptance, selection snapshots, cleanup, and billing without pretending the whole anatomical ontology is solved.

### 7.2 Reference-assisted authoring

1. User selects a draft view and describes only the tattoo to add.
2. Server classifies the request as `mark.ink` and validates the target zone.
3. If a reference is attached, it is validated and staged as an owned candidate plate; attachment itself grants no authorization.
4. Composer sends the selected identity anchor, selected target view, and at most one relevant evidence plate/crop under the pilot recipe.
5. Generated candidate is probed for identity, zone/side, tattoo presence, and pose preservation.
6. A passing candidate is shown with Accept / Retry / Cancel. It is still non-canonical.
7. Accept performs the atomic snapshot/evidence/package commit.
8. Retry is a new deliberate priced generation; Cancel discards the candidate and queues its owned keys for cleanup.

Vague requests (“copy this look,” “make him like this,” “use everything”) still refuse free before generation.

### 7.3 Visibility loop

For every affected view:

1. **Predict** whether the typed zone should be visible for the requested canonical angle/pose.
2. **Compose** only the evidence relevant to that zone and view.
3. **Generate** one candidate.
4. **Probe** observed visibility, feature presence/absence, placement, identity, and pose.
5. **Validate** against the typed feature registry and prediction.
6. **Resolve**:
   - pass → candidate may be offered/committed;
   - deterministic validation fail → one disclosed internal retry included in the operation;
   - unknown/probe outage → do not commit canon; show retry/cancel or fail with refund according to billing law;
   - repeated fail → named failure and full refund.

Evidence-bearing checks fail closed. The existing back/walk gate's fail-open infrastructure contract cannot govern canon commits.

Where the current gate is retained vs replaced: the existing `verifyViewIdentity` gate (fail-open on checker error — `server/casting/backViewGate.ts:96-99`) **remains** for ordinary non-evidence R6 refresh/mint/add-view paths under the D-39.4 retry-then-refund contract, exactly as today. It is **replaced** by this fail-closed loop only inside evidence-flagged operations, where an unverifiable result must not commit canon. No flag-off path changes behavior.

### 7.4 Accumulated-feature visual truth

An accepted canonical view is always one complete, flattened generated image of the person. It is never a Photoshop layer stack and never requires downstream consumers to assemble one image per tattoo.

Typed features remain separate records so Drape can locate, preserve, replace, remove, restore, and delete each feature honestly. Their visual expression accumulates in the selected full-view asset:

1. every new feature generation starts from the latest selected complete target view;
2. that target view already contains every previously accepted feature visible from its angle;
3. the composer adds only the newly authorized feature and emits preserve directives for every previously selected feature predicted visible;
4. validation must prove that previously visible accepted features did not disappear, move, mutate, or multiply;
5. accepting the candidate selects the complete output image and versions any recalculated regional plate/crop; it does not add an image layer;
6. sibling views become stale under §6.3 and are regenerated only by a deliberate priced action, each as a complete image containing every accepted feature predicted visible from that angle;
7. no sibling refresh or charge occurs automatically.

The first pilot still enables one feature addition in one calibrated zone per operation. Multi-zone accumulation (for example chest, stomach, then arm ink) remains disabled until its calibration proves both new-feature fidelity and preservation of all earlier visible features. Existing features do not each consume a separate Gemini reference input: the latest complete target view carries their visible pixels, while typed feature selections and bounded zone evidence govern hidden-angle propagation.

## 8. Identity composer recipe

All consumers call one server composer. No caller selects arbitrary images or evidence.

Inputs are resolved from explicit snapshot selections:

1. identity snapshot's anchor asset;
2. package snapshot's selected intent view when relevant and current;
3. only the evidence crops predicted visible for the requested view;
4. verbatim snapshot identity text;
5. typed feature directives with zone-specific preserve/omit/anti-invention rules;
6. recipe version and exact snapshot/selection/evidence IDs.

Reference budget is recipe-specific, never an unlimited array. Recommended pilot maximum: anchor + target view + one evidence plate/crop.

Exact supersessions (the complete D-30/D-39/D-53 clause list):

- **D-30 strategy (b) two-image budget** — superseded only inside the feature-flagged evidence recipe; generic downstream composition remains unchanged until calibrated.
- **D-30 stale-input rule** ("pinned views are accepted-final and used silently" — `server/casting/composeIdentityPayload.ts:17-19,110`) — superseded at pin retirement by explicit selection state. Safe to supersede: the composer has no production caller today.
- **D-39(d) ~5–6 usable reference budget** — **not** superseded as an outer bound; per-recipe budgets replace the single global number, and every recipe must stay within D-39(d) until a calibration explicitly amends it (audit addendum ruling 7).
- **D-53 "pins mark accepted-final"** — superseded at pin retirement. D-53's other clauses survive re-homed: the ledger remains the asset store while package snapshots become the selection authority, and `restoreSlotVersion`'s copy-forward becomes the §6.4 snapshot-selection restore.
- **D-21/D-29 slot Pin/Unpin surfaces** (tile popover pin, pinned refresh refusal, pin badges) — retire with §15. D-21's **board-item** pin ("Keep old" on board nodes — `executeSetNodePinned`, `server/lib/boardOps.ts:188-192`; `metadata.pinned` in `shared/boardTypes.ts:125`) is a different concept and is untouched.

The D-12 manifest records:

- identity and package snapshot IDs;
- exact selected asset IDs and image URLs sent;
- exact evidence plate/crop IDs and URLs sent;
- identity text verbatim;
- typed feature directives;
- prediction/probe recipe versions;
- generation model/version;
- operation/attempt IDs.

Reproducible inputs do not imply reproducible pixels.

## 9. Billing and idempotency

Every generation begins with an R7 durable parent operation and one client request UUID.

Recommended founder billing ruling:

| Outcome | User credit result |
|---|---|
| Refusal/classification/visibility plan fails before provider | no charge |
| One candidate delivered for review | one disclosed generation charge |
| Accept | free |
| Cancel after a valid candidate was delivered | no refund; generation was delivered |
| User chooses Retry after a valid candidate | new explicit quoted charge and new request ID |
| Internal validation fails first candidate | one internal retry included; no second charge |
| Internal retry also fails | full refund |
| Probe/crop infrastructure unavailable before a valid candidate | full refund |
| CAS conflict after provider output but before candidate/commit truth | full refund and owned candidate cleanup |
| Duplicate client submission | replay stored operation/candidate result; no second charge |
| Accept replay | idempotent same accepted snapshot/result |
| Candidate expires undecided | proposed: same as Cancel — the candidate was delivered; no refund; owned keys queued for cleanup (§20 founder decision) |
| Cancel/reject cleanup failure | no false success; durable cleanup evidence retained for worker |

Probe calls and evidence crops are platform overhead in the pilot and are not separate user-visible charges. If their cost later becomes material, pricing changes require a new founder ruling and quote contract.

Candidate review must not hold a model lock or a running generation lease while waiting for the user. Candidate generation completes with a durable result. Accept, Retry, and Cancel are separate operations.

**Ledger fit (verified constraints):** `point_transactions.referenceId` is `varchar(64)` under unique `(userId, referenceId)` (`drizzle/schema.ts:124-130`); operation charge references are globally unique via `uq_generation_ops_charge_ref` (`drizzle/schema.ts:310`); refunds derive deterministically as `refund:<charge-reference>` and over-length references normalize to a deterministic `sha256:` form (`server/db/credits.ts:29-33`, `server/casting/atomicCredits.ts:77-78`). Every new candidate/retry/refund reference flows through the same normalization; no new reference scheme is introduced.

**Pilot candidate cardinality (proposed, §20):** at most one `ready` candidate per model per capability. User Retry resolves the prior candidate (`rejected`, cleanup manifest queued) before the new generation is quoted — no side-by-side candidate comparison in the first release.

## 10. Concurrency and atomicity

- AI, upload, crop, and probe work occur outside long database transactions.
- Every operation captures expected `stateVersion`, package snapshot ID, and identity snapshot ID. Concrete home: additive columns on `generation_operations` beside the existing `expectedIdentityRevisionId` (`drizzle/schema.ts:283`), duplicated on the durable candidate row so post-completion adjudication never depends on a joined read.
- Canon/package commit requires the model operation lock plus `WHERE stateVersion = expected` CAS.
- Snapshot rows, selected evidence, package selections, model head update, asset promotion, and operation terminal result commit in one transaction.
- A candidate generated against stale state cannot be accepted; it receives a typed conflict, no silent rebase.
- Accept races: exactly one winner; loser replays the accepted result or receives a terminal conflict without another charge.
- Delete/fork/mint/identity edit/refresh all share the model lock ordering established in R7-1/R7-2/R7-5.
- No client input can assert anchor role, snapshot membership, compatibility, evidence acceptance, provenance, storage ownership, or probe result.
- Recovery may adjudicate a durable candidate or terminal receipt; it never guesses a canon commit from an R2 object alone.

## 11. Initial creation and legacy models

### 11.1 New creation with ink language

Creation references remain forbidden. Typed tattoo/ink prose may create a **pending feature intent**, not accepted visual evidence.

- The normalized intent records category, requested zone/side, and descriptor outside the identity documents.
- The mark text is removed from general identity prose before the documents are built; no prose-only shadow canon remains.
- A headshot may generate normally when the region is predicted hidden, but the intent remains unresolved.
- The first generated view predicted to expose the region becomes a candidate and requires Accept / Retry / Cancel.
- Mint and affected exports refuse while required evidence intent is unresolved.
- Accept creates the first feature/evidence version and a new identity/package snapshot.
- Cancel marks the non-canonical intent cancelled and removes it from future composition. The already accepted identity/package state remains byte-for-byte unchanged.

This replaces the current “ink may vary between views” promise only for models on the evidence feature flag.

### 11.2 Existing and legacy models

Do not infer typed marks from prose, pixels, keyword scans, or existing `freckles` fields.

- Existing selected pixels remain visible after bootstrap.
- Mark state is `legacy_unverified` until the user deliberately adopts a visible feature through a future adoption ceremony.
- Composer operations that require mark certainty refuse rather than erase, invent, mirror, or propagate.
- Drafts may enter a feature-flagged adoption ceremony after calibration.
- Minted/locked models remain read-only; adopting or changing identity evidence requires Fork.
- A clean-looking image is not proof of clean skin.

## 12. Downstream consumers

All identity consumers resolve the effective snapshot through one server function.

- **Cast Profile:** reads immutable identity summary, selected package, evidence status, and timeline; no in-place minted identity editing.
- **View strip:** reads six explicit selections and states; direct deliberate actions only.
- **Canvas Cast node:** reads live package selections. Linked canonical pop-outs remain model-owned and are deleted with the Cast.
- **Independent Canvas image/video outputs:** remain when a Cast is deleted; provenance may report that the source is unavailable, but the output stays.
- **Wardrobe/VTO:** consumes the sealed/current snapshot manifest and creates an independent output; it never writes back into Cast identity. Two current-code facts the migration must handle: (1) Wardrobe procedures today accept a **client-supplied `modelImageUrl`** (`server/routes/wardrobe.ts:248,327,419,652`) rather than a server-resolved selection — cutting Wardrobe to the effective-snapshot resolver is an inventoried consumer change, not automatic; (2) Wardrobe runs a live **pixel-based tattoo scanner** (`server/wardrobe/tattooAnalysis.ts`, `wardrobe.analyzeTattoos` route) that infers a per-generation `TattooMap` to stop VTO hallucinating or erasing ink. That map is presentation-scoped prompt guidance, never canon, and it survives unchanged; once typed feature evidence exists, a flagged later batch may feed it typed truth instead of a pixel guess. It must never be used to backfill typed marks (§11.2).
- **Fork:** creates a new model and bootstrap snapshots; evidence objects are copied to new owned keys so parent deletion cannot break the fork.
- **Export:** exports only explicitly selected package views and the selected identity snapshot; no surprise upscale.
- **Future reference-sheet derivative (R7-8):** pure layout from selected snapshot views, with engine-specific presets; it never changes canon.
- **Future user asset library:** saving an output to the library creates an independent owned asset record/key. Deleting its source Canvas or Cast never removes that saved library asset.
- **Additional newest-filled readers the cutover must include:** the public registry bundle (`server/routes/registry.ts:33`), the `models.get` asset payload (`server/routes/models.ts:206`), and board item asset reads (`server/routes/boards.ts:447`). Each must move to explicit selections at R7-7B or be explicitly recorded as display-only legacy reads during dual-write.

## 13. Storage, deletion, privacy, and retention

Before any evidence feature can be enabled, R7-5 manifests and account deletion must include:

- reference plates;
- evidence crops;
- unaccepted candidate images;
- accepted feature evidence;
- generated probe/crop derivatives;
- snapshot and feature rows;
- new operation result shapes.

Rules:

- successful promotion transfers exact-key authority from candidate storage to model-owned evidence in the same transaction;
- rejected/cancelled/expired candidates create exact-key cleanup manifests;
- accepted evidence remains until permanent model/account deletion; no background “helpful” pruning;
- forked evidence has independent keys;
- audit/security receipts keep identifiers, counts, hashes, and timestamps only—never identity documents, prompts, plates, crops, image URLs, or mark descriptions after deletion;
- GDPR export includes current and historical snapshot/evidence metadata and the user's owned evidence files according to published policy;
- independent downstream output assets are outside model deletion unless explicitly linked as canonical Cast material.

## 14. Feature flags and rollback

Required server-owned capabilities:

- snapshot dual-write;
- snapshot read;
- evidence composer;
- category `ink`;
- per-operation capability (`add`, later `replace`, later `remove`);
- explicit test-user/account allowlist.

The client renders a capability only from a protected server query. A hidden client control never creates authority.

Rollout sequence:

1. additive schema migration;
2. disposable-DB migration and mixed-version proof;
3. deploy dual-write with **lazy bootstrap**: every R7-aware writer that touches a model with no snapshot head bootstraps that head inside its own model lock/transaction before appending — reads stay old;
4. run the idempotent (convergent, §6.1) backfill script with read-only pre-audit for models that receive no writes — ordering matters: dual-write must be live **before** the backfill, or every model written between backfill and dual-write deploy carries a silently stale head;
5. shadow-read parity report for every package/model state;
6. enable snapshot reads for founder test account only;
7. migrate pin semantics to explicit selections and remove pin UI/routes only after parity;
8. enable owned plate ingestion for founder account;
9. enable one ink/add pilot recipe;
10. founder visual/calibration gate;
11. widen only after measured thresholds pass.

Rollback turns off snapshot/evidence reads and composer capabilities. Dual-written R6 fields remain valid until cutover is declared irreversible. Rollback never deletes new snapshot/evidence rows. If rollback also reverts the dual-writing code (a redeploy of old code, not just a flag), snapshot heads go stale from that moment; re-enablement therefore always starts with the convergent backfill re-run and a fresh shadow-read parity pass — never by trusting heads written before the rollback.

## 15. Pin retirement migration

Pin removal is not a UI-only deletion.

1. Bootstrap every current selected view from the existing newest-filled rule, regardless of pin.
2. Preserve the currently displayed headshot selection separately from anchor authority.
3. Record stale/current compatibility in selection rows.
4. Dual-write every view generation/restore into both old asset fields and new package snapshots — **including every stale-flag writer**: the §8.6 identity commit's stale-all, headshot re-roll, structured recast, and refresh's stale-clearing insert all produce a package snapshot, not only the generation paths.
5. Compare package state, history, refresh plan, mint plan, export inputs, and Canvas rendering under both readers.
6. Cut consumers to explicit selections.
7. Remove `setSlotPinned`, pinned refresh refusals, pin badges, and pin-dependent stale logic.
8. Leave the database column in place for one compatibility cycle; stop reading/writing it before a later forward-only removal.

The implementation inventory must include at least:

- `server/routes/generation/castingExport.ts` (`setSlotPinned` route and replay result);
- `server/casting/mintPackage.ts` (slot projection, mutation, version rows, restore result);
- `server/casting/refreshSlots.ts` and shared refresh policy (pinned refusal/count law);
- `server/casting/composeIdentityPayload.ts` (accepted-final stale exemption);
- `server/casting/identity/mintIntegrity.ts` and refusal copy;
- `client/src/features/casting/components/PackageHealthDialog.tsx` (internal filename; current Details surface);
- `client/src/features/casting/components/ImageViewer/ViewTabs.tsx`;
- `client/src/features/casting/components/SlotVersionHistory.tsx`;
- `client/src/features/boards/canvas/nodes/CastNode.tsx` and `useSheetController.ts`;
- `CharacterSheetImageArea.tsx` and `BulkRefreshDialog.tsx`;
- `server/db/models.ts` (`setModelAssetPinned` — the one pin column writer);
- `client/src/features/lobby/ModelCardChooser.tsx` (comp-card chooser renders slot pins via `generation.packageState`);
- `server/routes/registry.ts`, `server/routes/models.ts` (`models.get` payload), and `server/routes/boards.ts` newest-filled asset reads (§12);
- failure-marker rows: the strip's failed/Retry state today reads storageUrl-less marker rows in `model_assets` (`SlotFailure` in `mintPackage.ts`). Package snapshots never select markers (§6.1 step 3), and the marker mechanism keeps serving failed-state UI until a later batch moves that truth onto durable operations — retiring pins must not accidentally retire failure display;
- library/profile/package thumbnails and every test pinning stale/current behavior.

Board-item pins are a separate concept (`executeSetNodePinned` on board metadata, `server/lib/boardOps.ts:188-192`; `shared/boardTypes.ts:125`; read in `BoardCanvas.tsx`/`boardState.ts`) and remain untouched.

This is a minimum list, not permission to rely on a fixed grep count. R7-7A must produce a complete reader/writer inventory before migration code.

## 16. Calibration program

### 16.1 Pilot dataset

Use consented/synthetic test Casts only. Minimum feasibility matrix:

- at least six subjects spanning light through dark skin tones;
- more than one gender presentation and body build;
- straight, wavy, curly, and coily hair where it can occlude evidence;
- three tattoo placements: front upper torso, outer upper arm, and nape/back-neck;
- small and medium tattoo scale;
- black linework and filled/color work;
- birth view frontal and oblique;
- canonical visible and hidden views;
- three repeated generations per test cell where cost allows.

The first public capability still enables only the one zone whose evidence passes the gate.

### 16.2 Separate measures

Record separately:

- same-person identity pass;
- correct zone and side;
- visible-view feature presence;
- hidden-view anti-invention;
- no mirroring/migration to another surface;
- pose/framing preservation;
- composition fidelity (recognizable design, scale, and placement);
- micro-linework fidelity (reported honestly; not promised exact);
- first-candidate pass rate;
- pass rate after one internal retry;
- probe false-positive, false-negative, and unknown rates;
- crop contamination and reference-dilution failures;
- latency and provider cost.

### 16.3 Provisional release thresholds for founder/Fable challenge

- 100% of committed candidates have explicit user acceptance when first-region evidence is involved;
- 0 automatic canon commits on `unknown` probe result;
- at least 95% same-person pass after the included internal retry;
- at least 95% correct zone/side after retry;
- at least 98% no-invented-ink rate on views where the zone is hidden;
- at least 90% human-accepted composition fidelity;
- every failure/refund/cleanup path reconciles exactly;
- no category or zone ships solely because aggregate success hides a skin-tone, gender, pose, or occlusion failure cluster.

Thresholds are provisional, not claims about current Gemini performance.

## 17. Verification matrix before R7-7 capability enablement

### Pure/unit

- immutable snapshot construction and parentage;
- package selection completeness and canonical-angle uniqueness;
- field-to-authoring-view requirements;
- typed category/zone/side schemas;
- prediction and validation truth tables;
- candidate lifecycle and most-restrictive classifier behavior;
- billing/refund decision table;
- exact manifest projection excludes private fields.

### Disposable MySQL

- bootstrap idempotency and mixed R6/R7 writers — including the §14 ordering cases: lazy bootstrap racing a concurrent writer under the model lock, and backfill convergence over a model written after an earlier bootstrap;
- CAS conflicts for edit/accept/refresh/mint/delete/fork races;
- accept vs accept, accept vs delete, accept vs identity edit;
- package-only restore vs true restore;
- pin migration parity;
- operation receipt, asset, snapshot, evidence, and model-head atomic rollback at every boundary;
- candidate cleanup and accepted ownership transfer;
- permanent deletion/account erasure includes all new rows/keys;
- fork survives parent deletion.

### Service/router

- no client can claim snapshot/evidence/probe/anchor/storage authority;
- refusal before money for unavailable categories and ambiguous references;
- one charge per candidate operation and deterministic refunds;
- Accept/Retry/Cancel replay behavior;
- mint/export/late-view decisions use the quoted current snapshot;
- old R6 refusal remains when any capability is off.

### Browser/founder drive

- add one supported tattoo from text and reference;
- candidate is visibly non-canonical until Accept;
- Cancel leaves the Cast byte-for-byte unchanged;
- Retry shows and charges the quoted amount;
- accepted target updates, siblings show honest stale state, nothing refreshes automatically;
- hidden back view does not invent a chest tattoo;
- package history and whole-Cast timeline are understandable without Package Health;
- reload/another tab recovers candidate and operation truth;
- minted Profile refuses identity evidence edit and routes to Fork;
- deletion removes accepted evidence and candidate leftovers while independent outputs remain.

## 18. R7-7 bounded implementation order

R7-6 ratification authorizes none of these by itself.

1. **R7-7A — snapshot/selection schema and bootstrap:** additive migration, disposable proof, dual-write, shadow reads; current behavior unchanged.
2. **R7-7B — snapshot reader and pin retirement:** founder account first; explicit selections become authority; old path remains rollback fallback.
3. **R7-7C — owned candidate/plate/crop ingestion:** validation, exact-key ownership, cleanup, no generation capability yet.
4. **R7-7D — ink/add pilot generation:** one draft zone, one recipe, candidate lifecycle, probe, billing, Accept/Retry/Cancel.
5. **R7-7E — sibling refresh from selected evidence:** explicit priced actions only; view-specific validation.
6. **R7-7F — true whole-Cast restore:** append-only identity/package restore using the proven snapshot contract; drafts only (§6.5) — minted refuses and routes to Fork.
7. **Later flags:** additional ink zones, then replace, then remove; other mark categories one at a time.
8. **Masked generative edit/erase:** only after add/replace/remove evidence and cleanup laws are proven. No layer stack.

Every batch receives typecheck, focused/full tests, build, disposable DB where applicable, Fable review, and founder authorization before migration/deploy/flag changes.

## 19. Adjacent quality investigation — recorded, not hidden in composer scope

Founder production observation on 2026-07-22:

> Brief: “30-year-old male editorial model with short brown hair, brown eyes, neutral expression and a plain studio portrait.”

The resulting face was unusually gaunt, pale, hollow-eyed, and clinically lit; hair also read longer than requested. This resembles the earlier “heavy metal bogan” brief producing a sickly/vampire-like model.

This may be random model variance, but the repeated aesthetic direction suggests a possible translator/master-prompt/default-value amplification issue. It is a separate initial-casting quality investigation, not evidence-composer proof.

Required later audit:

- run identical briefs repeatedly to separate variance from systematic bias;
- compare raw brief, translator preferences, Open/Auto resolutions, technical schema, master prompt, reinforced generation prompt, and output;
- test `editorial model` against neutral/commercial wording;
- inspect unspecified build, complexion, facial structure, grooming, and lighting defaults;
- ensure neutral defaults do not silently invent illness, exhaustion, substance-use cues, or extreme anatomy;
- audit the same over-amplification risk across every open attribute, not only hair or complexion;
- define a neutral healthy baseline without forcing conventional attractiveness or erasing natural variation.

This investigation belongs in R7-8 dogfood/quality closure unless it proves a current release blocker earlier.

R7-6 dependency check: none. Snapshots freeze the model's documents verbatim, which is correct historical behavior regardless of translator bias — a later translator/default fix changes only future snapshots (via ordinary identity operations), and the composer forwards snapshot text without reinterpreting it. Bootstrap will faithfully freeze today's possibly-biased documents as history; that is what history means, not a reason to couple the fix into R7-6.

## 20. Founder decisions ratified after Fable review

The founder ratified the following on 2026-07-22:

1. **History shape:** append-only chronological current timeline; internal parent + restore-source DAG; no destructive redo deletion.
2. **Pilot:** tattoo/ink add only, draft `frontFull`, front upper torso, one feature, one evidence input.
3. **Candidate billing:** delivered valid candidate is charged; Accept free; Cancel no refund; user Retry newly quoted/charged; system-invalid candidates get one included retry then full refund.
4. **Minted ambiguity:** late evidence-bearing region refuses and routes to Fork in the first release.
5. **Fork evidence:** copy-on-fork owned keys rather than shared-object ownership in the first release.
6. **Reference budget:** pilot maximum is anchor + selected target view + one relevant evidence plate/crop; later budgets require calibration.
7. **Calibration thresholds:** use §16.3 as minimum release gates, with cohort failures blocking even if the aggregate passes.
8. **Candidate expiry billing:** an undecided candidate that reaches its expiry timestamp resolves exactly like Cancel — delivered, no refund, owned keys queued for cleanup. Expiry is 30 days and the UI must disclose the expiry date before the candidate is abandoned. Auto-refunding expiry would invite deliberate abandonment as a free-retry loophole; expiring-as-cancel keeps the "delivered candidate is a delivered generation" rule consistent while the 30-day window avoids punitive short-lived storage.
9. **Candidate cardinality and Retry semantics:** at most one `ready` candidate per model per capability in the pilot; user Retry resolves the prior candidate as rejected (with cleanup) before the new quoted generation. Trade-off: side-by-side candidate comparison is a nicer product but multiplies cleanup, storage, accept-race, and billing surface for a pilot whose point is proving the boundary.

Fable note (applied under existing law, listed for visibility, not re-decided): §6.5 scopes true whole-Cast restore to drafts in the first release — a minted Cast refuses and routes to Fork, because creating a new current identity snapshot on a minted model is an identity change already reserved for Fork by D-43/D-62 ruling 5. The optional future "package-only restore within the sealed identity" is recorded there as a separate later ceremony if ever wanted.

## 21. Fable review gate

Fable must challenge this document against the live codebase and return either:

- **APPROVE — safe for founder ratification**, or
- **REQUEST CHANGES** with reachable contradictions, missing writers/consumers, unsafe migrations, race windows, billing ambiguity, deletion/storage holes, or unproven calibration claims.

Fable should improve this document directly only where the correction is evidence-backed and does not assume a new founder ruling. New product choices remain clearly listed for founder decision.
