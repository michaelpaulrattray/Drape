# R7-7B Snapshot Reader Cutover and Pin Retirement Plan

**Date:** 2026-07-23  
**Baseline:** `c35f677`  
**Status:** draft for Fable challenge and founder ratification  
**Authority:** D-65, `CASTING_SYSTEM_R7_6_EVIDENCE_COMPOSER_DESIGN.md`, `CASTING_SYSTEM_R7_7A_EXECUTION_PLAN.md`, `CASTING_SYSTEM_R7_7A_SNAPSHOT_SELECTION_INVENTORY.md`

## 1. Outcome

R7-7B makes the current package snapshot and its referenced identity snapshot the read authority for a deliberately bounded server-selected cohort. It then retires model-asset pins as Cast-selection authority.

The rollout begins with an exact founder-account allowlist. Unflagged accounts continue to use R6 reads. A flagged account never silently falls back to R6 within a request: snapshot truth either validates and serves the request or refuses before generation, credits, storage, or durable mutation. Operational rollback disables the server-owned read scope and returns the account to the still-maintained R6 compatibility path.

R7-7B does not add evidence composer capabilities, candidates, plates, crops, tattoo generation, whole-Cast restore, automatic refresh, a new paid action, or a new public history surface.

## 2. Production evidence entering R7-7B

R7-7A is complete at baseline `c35f677`:

- migration `0010` is present in production;
- all inventoried canonical writers dual-write under the model operation lock;
- the bounded production convergence completed for the founder cohort;
- the final production parity audit reported 42 audited Casts, 42 parity Casts, 0 mismatched Casts, 41 current heads, 1 legitimate headless Cast, and zero affected surfaces;
- the mint-parity correction was deployed successfully;
- R6 remains the only live reader;
- no convergence rerun or reader flag has been enabled after that final audit.

This evidence is necessary but not sufficient to enable reads. Each B slice below has its own review and rollout gate.

## 3. Non-negotiable authority laws

1. **One server-owned scope.** The client cannot request, assert, or weaken snapshot-read authority.
2. **No silent fallback for an enabled account.** A malformed, missing, cross-model, incomplete, or stale snapshot head refuses free. It does not use newest-filled R6 truth for that request.
3. **Rollback is configuration-level.** Disabling the server-owned scope restores the maintained R6 reader. It is not a catch block inside an enabled request.
4. **One effective-state resolver.** Every canonical consumer obtains identity, anchor, displayed headshot, and selected slots through one server resolver.
5. **History is not selection.** `model_assets` remains the immutable-ish asset ledger and version-history source. Newest-filled order, pin state, and mutable asset status do not choose the current Cast for enabled accounts.
6. **Failure is not selection.** Storage-URL-empty failure markers remain ledger/attempt evidence for the current Retry UI until operation-child migration. They can never occupy a package slot.
7. **Selection compatibility is snapshot truth.** `current`, `stale`, and `unverified` come from the selected slot. Mutable asset status may make a request more restrictive during the compatibility window, but it cannot launder a stale or invalid asset into current authority.
8. **The snapshot owns identity.** Identity documents and anchor come from the identity snapshot referenced by the current package. Mutable model documents remain dual-written rollback compatibility, not enabled-account read authority.
9. **The package owns display.** The selected `frontClose` slot is the displayed headshot. It never becomes anchor authority merely by being displayed.
10. **Sealed Casts stay sealed.** Mint and post-mint readers enforce the sealed identity/package laws already proven in R7-7A.
11. **Plans and execution quote the same authority.** Paid plan results and their execute doors must use the same server read mode and operation-captured snapshot head. A flag or head change between plan and execution causes a fresh plan/refusal, never a stale charge.
12. **Nothing spends automatically.** Cutover, parity checks, pin migration, cache invalidation, and rollback perform no generation or credit movement.
13. **Board-item pins are unrelated.** Canvas node layout/presentation pins remain untouched. Only `model_assets.pinned` and its Cast-slot behavior retire.
14. **Headless is legitimate.** A model with no valid filled anchor remains headless; readers return the existing empty/draft behavior without inventing a snapshot.

## 4. Server-owned rollout scope

Introduce one strict server configuration parser with three states:

- `off` — R6 reads for everyone;
- `users:<comma-separated positive user ids>` — snapshot reads only for the exact owners listed;
- `all` — snapshot reads for every eligible account.

The proposed variable is `R7_SNAPSHOT_READ_SCOPE`. Missing or empty means `off`. Invalid syntax must fail closed at server startup rather than partially enabling a cohort. Production starts with `off`; the first enabled value is an exact founder-account allowlist. No model id, snapshot id, state version, or read-mode claim enters any client schema.

The parser is pure and exhaustively tested. The resolved mode is captured once at the beginning of each request or durable operation. A single request must not mix R6 and snapshot reads if a variable reload or deploy occurs.

## 5. Effective Cast state resolver

Add a read-only service, provisionally `server/casting/effectiveCastState.ts`, with two explicit entry points:

- an owned resolver requiring `{ userId, modelId, readMode }`;
- an internal/public-safe resolver for registry/library projections with its own existing visibility and lifecycle checks.

For snapshot mode, one transaction reads:

- the owned/live model row;
- `currentPackageSnapshotId` and `stateVersion`;
- the exact current package;
- its exact identity snapshot;
- all current package slots;
- every selected asset by id;
- the sealed package/identity when the lifecycle requires them;
- ledger rows only where version counts, history, or failure-attempt truth are required.

The resolver validates before returning:

- pointer/state-version agreement;
- package and identity ownership by the same model;
- package-to-identity closure;
- one canonical angle and unique selected asset per slot;
- selected asset ownership, same angle, and non-empty storage URL;
- a selected `frontClose`;
- identity anchor ownership, `frontClose`, non-empty URL, and server-authored anchor eligibility;
- snapshot identity-text hash;
- draft/mint seal invariants;
- selected-slot compatibility vocabulary;
- no failure marker selected.

The public result is a typed server object, not raw joined rows. It contains the current identity documents, authoritative anchor, displayed headshot, selected views, compatibility, versions/failure summaries where requested, lifecycle/seal truth, and the quoted `stateVersion`/package id for internal CAS use. Public tRPC projections must continue to omit private snapshot ids and operation authority unless an existing contract genuinely requires a safe opaque id.

For R6 mode, callers continue through the existing reader during the rollout window. The resolver must not silently derive R6 truth inside snapshot mode.

## 6. Bounded slice order

### R7-7B1 — Resolver and scope foundation

- add the strict `R7_SNAPSHOT_READ_SCOPE` parser;
- add the effective-state resolver and validation errors;
- keep it unreachable from production routes;
- add pure and disposable-MySQL tests for valid, headless, malformed, cross-model, missing-row, duplicate-selection, seal, and hash cases;
- add source guards proving no route/client/worker imports it yet;
- prove the module is read-only and performs no credit, storage, provider, or audit writes.

**Gate:** typecheck, focused/full tests, build, disposable database proof, Fable review, founder-authorized local commit. No deploy-time enablement.

### R7-7B2 — Package state and paid-plan projections

Adopt the resolver behind the server-owned cohort scope for:

- `generation.packageState`;
- `generation.mintPackagePlan`;
- `generation.refreshSlotsPlan`;
- export planning and selected-view manifests.

Requirements:

- unflagged output remains byte-compatible with R6;
- enabled output is built from explicit selected slots and snapshot identity;
- failed-attempt/refund truth and per-angle version counts remain ledger-derived but never affect selection;
- `packageState` exposes a non-authoritative presentation capability such as `pinningAvailable` so clients can hide pin actions for enabled accounts without choosing authority;
- plan cost and refusal behavior are compared against the already-proven consumer shadow laws;
- snapshot validation failure is a free typed refusal;
- plan queries do not bootstrap, converge, mutate pins, or spend;
- execute doors re-resolve under the operation/model lock and compare the receipt-captured head before credits/provider work.

The old R6 projections remain compiled and tested as the rollback path.

**Gate:** parity tests for all three mint tiers and six angles; failure-marker, pinned/stale, restored-selection, late-view, minted-seal, and headless cases; no-auto-spend tests; Fable review.

### R7-7B3 — Canonical operation readers

Move every generation/edit decision that currently derives current truth from newest-filled rows to the effective resolver:

- `composeIdentityPayload`;
- initial/reroll prior-view selection in `castingImaging`;
- iterate target, anchor, displayed-headshot, and identity authorization in `castingRefinement`;
- add-view, mint, refresh, restore, and export execution;
- identity-pack export image resolution: `generation.generatePdf` currently renders client-supplied image URLs into the identity PDF (`castingExport.ts` `images` input, fed by `ExportPackDialog` from `packageState`). For enabled accounts the server resolves the selected package views itself; the client image fields are ignored or refused, never trusted;
- Canvas recast/reroll, library fill, pop-out, picker, and current-angle resolution in `boardOps`;
- operation recovery/landing reads where current Cast selection is material.

Rules:

- ordinary iteration may target only the server-resolved current selected asset where current membership is required;
- slot history/restore may name a historical ledger asset, but the server independently proves compatibility and the resulting package selection;
- current anchor and displayed headshot are never rediscovered through newest-filled scans for an enabled account;
- free refusals stay before generation rows, receipt-running transition, credits, Gemini, and storage;
- every paid executor binds to the receipt-captured `stateVersion` and package/identity head already introduced in R7-7A;
- **lazy convergence cannot launder a bad head for an enabled account.** Every paid door today runs `bootstrapModelSnapshot` before the receipt captures authority, and convergence appends a corrective snapshot pair from newest-filled R6 truth when the stored head diverges. For unflagged accounts that behavior is unchanged. For a snapshot-enabled account, a convergence outcome that would rewrite the head (`converged`, not the no-op `current`) is structural evidence the snapshot authority was wrong: the request refuses free with the incomplete/corrupt-snapshot copy and emits closed-code telemetry instead of proceeding on silently R6-corrected truth. Anything else is the per-request fallback law 2 forbids;
- no transition writer or billing law changes merely because its read source changes.

**Gate:** route/service matrices for both modes; stale plan-versus-execute races; replay; refund truth; exact storage cleanup; disposable concurrent-head tests.

### R7-7B4 — Library, registry, Canvas, and Profile readers

Cut over outward projections for enabled accounts:

- `models.get`;
- model-list/library thumbnails: `getHeadshotsForModels` (picker), plus the lobby feeds `getUserMintedModelsWithThumbnail` (prefers `frontFull` then `frontClose`; its asset query currently has no ORDER BY, so its "newest" is not even deterministic today) and `getUserDraftModelsWithThumbnail` (`server/db/models.ts`);
- public registry bundles — including filtering storageUrl-empty failure-marker rows out of `registry.lookup`'s asset list at cutover (they leak today; D-46 R7 log item 3);
- model-backed board item asset reads — including `boards.getItemModelInfo`'s `latestAssetId`, which today is `assets[0].id` and can be a failure-marker row; the cutover projects selected truth, never a marker id;
- Cast Profile identity/package projection;
- Canvas Cast-node live package images, comp cards, spawn menu, and ModelCardChooser.

Requirements:

- each surface resolves its canonical image through the explicit selected slot for that surface's angle preference, never newest-filled: pickers, live Cast nodes, and draft cards use the selected `frontClose`; the lobby minted gallery keeps its existing `frontFull`-then-`frontClose` preference, read over selected slots. No surface's angle preference changes in this slice;
- history endpoints may still return the complete ledger, clearly separated from `selected`;
- board placements remain independent durable snapshots, but linked live Cast views resolve their canonical image through the package;
- deleted/archived/non-owned behavior remains non-leaking;
- registry lifecycle rules remain unchanged and sealed/current package rules are enforced;
- client cache keys and invalidations remain the same where possible;
- no client receives authority to select a snapshot or asset by editing projection data.

The R7-5 deletion law remains unchanged: deleting a Cast removes linked canonical placements; independent generated outputs remain.

**Gate:** server projection tests, two-tab cache drive, Canvas/library/Profile browser drive, no source-unavailable regression for live models.

### R7-7B5 — Wardrobe/VTO model-image resolution

For enabled accounts, model-backed Wardrobe calls stop accepting a client-supplied Cast image as authority:

- upload-only/model-less sessions continue to accept their owned upload input;
- the inventory covers every client `modelImageUrl` input, not only the generate procedures: `wardrobe.session.create` (which persists `modelId` beside a client URL) and `seedChat` included. For an enabled account, a durable session/look row that carries a `modelId` must carry the server-resolved selected view, never a client-substituted URL;
- a model-backed session identifies the model and intended canonical angle/use;
- the server resolves the selected view from effective snapshot state after ownership/lifecycle checks;
- session/look durable writes preserve their existing deletion fences;
- the live pixel tattoo scanner remains presentation-only guidance and never becomes identity evidence;
- no typed-mark/evidence behavior enters this slice.

During mixed rollout, unflagged accounts retain the old request contract only as rollback compatibility. The client must not be able to choose the legacy branch for a flagged account.

**Gate:** cross-owner/client-URL substitution tests, current/sealed selection tests, upload-only regression, VTO billing/refund non-regression, Fable review.

### R7-7B6 — Founder pin retirement

For snapshot-enabled accounts:

- `model_assets.pinned` no longer changes selection, stale acceptance, refresh eligibility, mint validity, composition, or UI state;
- the Cast-slot pin mutation refuses free before operation claim/lock/mutation;
- Studio, Details, history, lobby, and Canvas Cast-sheet pin controls are hidden using server-projected capability truth;
- pinned stale slots remain stale and require the same deliberate priced action as any stale slot;
- failure-marker Retry behavior remains visible;
- `Use this version` remains the explicit selection ceremony;
- board-item presentation pins remain unchanged.

Add a separate, bounded, operator-run pin-convergence tool:

- read-only by default;
- exact user/model selector plus expected-model and expected-pinned-row counts;
- apply requires explicit write and target confirmation ceremony;
- freezes the cohort;
- for each model, takes the model row lock, proves snapshot/R6 consumer parity in the same transaction, refuses any active conflicting model operation, and clears only `model_assets.pinned`;
- reports ids/counts/status codes only;
- is replay-safe and never touches board metadata pins;
- performs a postflight parity audit;
- never runs automatically or from a route/worker.

Clearing legacy pins makes rollback conservative and predictable: the R6 path returns to ordinary newest-filled/stale behavior rather than resurrecting old accepted-final exemptions. The column remains in schema during R7-7B so rollback code can still run; dropping it is a later cleanup migration after global cutover stability.

**Gate:** disposable pin-migration parity, zero pin writers for enabled accounts, UI/source guards, founder drive, Fable review, separate authorization before any production apply.

### R7-7B7 — Founder rollout, expansion, and global completion

Rollout sequence:

1. deploy all B runtime code with `R7_SNAPSHOT_READ_SCOPE=off`;
2. run the bounded production parity audit again against the exact founder cohort;
3. enable the exact founder user id in the server-owned scope;
4. verify package state, mint/refresh plans, Profile, Library, Canvas, registry-safe views, export, iteration, restore, and Wardrobe without automatic paid actions;
5. run the bounded pin plan, obtain separate authorization, apply, and verify its postflight;
6. keep the rollback command and last known R6-compatible deployment identified;
7. expand only to explicitly counted/audited cohorts with zero unexplained structural or consumer mismatches;
8. enable `all` only after every live eligible model is converged/audited and every B reader is adopted;
9. after global stability, remove the public Cast-slot pin route and dead client controls in a final reviewed cleanup while retaining the dormant column for rollback;
10. record R7-7B complete before R7-7C owned candidate/plate/crop ingestion starts.

No time interval alone authorizes expansion. Evidence is zero unexplained mismatches, clean request/refusal telemetry, credit conservation, and browser verification.

## 7. Error and rollback behavior

Snapshot-mode validation errors use typed, non-leaking classes mapped to plain product copy:

- headless: existing “generate a headshot first” behavior;
- unavailable/deleted/foreign: NOT_FOUND;
- incomplete/corrupt snapshot: PRECONDITION_FAILED with “This Cast is temporarily unavailable while its saved state is checked. No credits were used.”;
- stale quoted head: CONFLICT with a refresh/retry instruction and no charge;
- disabled pin action: PRECONDITION_FAILED with “This Cast already keeps the version you chose. Use version history to choose another.”

Logs contain model/user/operation ids, closed error codes, counts, and hashes only. No prompts, schemas, preferences, names, URLs, storage keys, provider messages, or raw SQL parameter values.

Rollback:

1. set `R7_SNAPSHOT_READ_SCOPE=off`;
2. redeploy/restart the current build;
3. verify R6 package state and paid plans for the bounded account;
4. run read-only snapshot parity to diagnose; do not mutate snapshots during rollback;
5. do not restore old pins. Cleared pins remain cleared, and the dual-written R6 ledger remains the fallback source.

## 8. Verification matrix

### Pure/unit

- strict scope parser, invalid/duplicate/whitespace cases;
- one request captures one mode;
- snapshot closure and safe DTO projection;
- selected asset/angle/filled/duplicate validation;
- headless and seal laws;
- package-state/mint/refresh/export parity;
- failure-marker truth without selection;
- pin capability and refusal;
- no private-field serialization.

### Disposable MySQL

- valid draft and minted effective states;
- headless model;
- missing package/identity/slot/asset;
- cross-model package, identity, slot, anchor, and selected asset;
- stateVersion/pointer disagreement;
- identity-text hash mismatch;
- duplicate/cross-angle selection attempts;
- current/stale/unverified projection;
- late-view package preserving the seal;
- plan-versus-execute head race before charge;
- simultaneous read and transition;
- enabled pin refusal and bounded pin clearing;
- R6 rollback reads after pin clearing;
- model/account deletion closure.

### Routes/services

- enabled and disabled account outputs;
- client cannot provide a mode or snapshot ids;
- package state and paid plans share authority;
- execute re-resolution before money;
- an enabled account whose pre-receipt convergence would rewrite the snapshot head refuses free (no charge, no generation, closed telemetry code); an unflagged account converges exactly as today;
- enabled-account identity-pack export ignores client-supplied image URLs and renders server-resolved selected views;
- current-target iterate rules versus historical restore rules;
- library/registry/board/Profile output;
- Wardrobe ignores substituted model image URLs for enabled accounts;
- no automatic generation or credit movement.

### Browser/founder drive

- Studio opens the same Cast and six selected states;
- Details/history shows “In use” accurately;
- “Use this version” changes the selected slot and survives reload/another tab;
- no Pin/Unpin control for the enabled account;
- stale selected views show deliberate priced actions;
- failed views still show honest Retry/refund truth;
- Canvas nodes, pop-outs, lobby cards, Profile, and export all agree;
- minted Cast remains immutable and late views preserve its seal;
- Wardrobe uses the selected model view;
- flag-off rollback restores the R6 surface without data loss.

## 9. Explicit exclusions

- evidence/candidate/plate/crop schema or generation;
- tattoo/ink add, replace, remove, probe, or acceptance;
- true whole-Cast restore;
- automatic refresh/generation/spending;
- deletion or storage-cleanup redesign;
- board-item pin retirement;
- dropping `model_assets.pinned`, `identityRevisionId`, mutable model documents, or R6 ledger fields;
- public snapshot ids or client-selected read mode;
- broad production enablement without bounded parity evidence and founder authorization.

## 10. Ratification questions

The plan recommends, and Fable should challenge:

1. one strict environment scope (`off`, exact users, `all`) rather than a client flag or database boolean;
2. fail-closed snapshot reads with configuration-level rollback, never per-request R6 fallback;
3. Wardrobe model-image resolution as a required B slice before global cutover;
4. failure markers remaining ledger-backed until durable-operation child truth replaces them;
5. founder-only pin retirement before global removal, with the dormant column retained for rollback;
6. a bounded parity-proven pin clearing tool rather than an automatic migration;
7. no schema migration in B unless review proves one is unavoidable.

Ratification authorizes planning only. Every implementation slice, production flag change, pin apply, cohort expansion, and global enablement remains separately reviewed and founder-authorized.
