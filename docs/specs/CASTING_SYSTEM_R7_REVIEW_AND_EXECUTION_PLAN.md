# Casting System R7 — Review and Execution Plan

**Date:** 2026-07-18

**Baseline:** `e66b8db` (`main`; deployed to production through `local-migration`)

**Status:** IN EXECUTION — R7-0 through R7-4B are locally complete as of 2026-07-21; R7-5 is at the destructive-data planning gate

**Scope:** Casting, its Canvas placements, model lifecycle, generation operations, package/history UX, and the future identity-evidence composer.

## 1. Executive verdict

R7 is ready to begin, but the repository currently uses the name **R7** for two different bodies of work:

1. the original short hardening and dogfood sweep in `PASS_1_BUILD_PLAN.md`; and
2. the much larger architecture and product program deferred by R6: durable generation operations, a minted Cast Profile, strip-first package controls, real identity history/rollback, deletion/archive semantics, conversational editing, quality choice, and the Batch D identity-evidence composer.

The old 1.5-day estimate is therefore obsolete. R7 must not run as one automatic coding batch. It should be executed as reviewable releases with founder gates between the trust foundation, product UX, and experimental composer.

The first R7 code should **not** be the composer. The first code should close concurrency, idempotency, exact-insert, and durable-operation gaps that every later R7 surface will depend on.

## 2. What R6 leaves us with

R6 is live and founder-driven tests now pass for:

- draft creation, editing, adding views, stale detection, refresh, naming, mint, fork, variation, export, and restore refusal visibility;
- server-owned lifecycle and identity-edit authority;
- authoritative identity revisions for allowed draft identity edits;
- fail-closed mark edits and unsupported requests;
- same-tab continuation when Casting closes;
- package health and truthful per-view states;
- live model-name propagation to Canvas placements.

Important R6 boundaries remain deliberate:

- generation progress does not survive reload or another tab;
- a minted model still opens the Casting workspace framed as locked, rather than a purpose-built Profile;
- routine package actions remain inside Package Health instead of the strip;
- restore is compatible-image reuse inside the current identity revision, not identity rollback;
- permanent marks, reference plates, zone evidence, generative masks, and canon snapshots are unavailable;
- the structured panel is a recast door, but the UX separation from same-person refinement is minimal;
- 2K generation is not a user-facing Casting choice;
- draft hard deletion leaves storage and historical-reference questions unresolved.

## 3. Source reconciliation

| Source | What remains authoritative | Correction required for R7 |
|---|---|---|
| `PASS_1_BUILD_PLAN.md` R7 | Hardening, dead-code/TODO sweep, real-board acceptance drive, navigation/profile-popout audit, deployment discipline | Keep as the **final R7 hardening phase**, not the whole milestone. The 1.5-day estimate no longer applies. |
| `CASTING_SYSTEM_R6_W5_EXECUTION_PLAN.md` §9 | Twelve deferred product items plus strip-first package controls | Use as the product backlog, corrected for W6's same-tab continuation work. |
| `CASTING_SYSTEM_R6_W6_EXECUTION_PLAN.md` §10 | Strip controls, history redesign, persisted job truth, true-mint close | Still open. W6 built only same-tab operation handoff. |
| `CASTING_SYSTEM_AUDIT_ADDENDUM_REVISED.md` Batch D | Design requirements and production contracts for canon/evidence/composer work | Remains the governing safety specification. It is a design gate, not implementation-ready code. |
| `IDENTITY_EDIT_INTERIM_POLICY.md` | R6 authority, fail-closed behavior, typed identity leaves, marks refusal, reconcile disabled | Binding until a feature-flagged R7 capability explicitly supersedes a category with evidence and tests. |
| `CANVAS_FOUNDATIONS.md` §10 | Historical intent | Its 15 criteria describe retired inline-prompt/attribute surfaces and stale pin semantics. Rewrite before using it as an R7 acceptance checklist. |

## 4. Current-code findings

### 4.1 Durable operation truth does not exist

Current behavior is split across three client-only mechanisms:

- `pendingCastRegistry.ts` — same-tab Casting operation handoff;
- `useCastingRefreshStore.ts` — same-tab per-model refresh counts;
- `useGenerationJobs.ts` — same-tab Canvas node progress.

The `generations` table records individual AI calls. It does not represent one user operation that may contain several slot generations, one charge, several refunds, an origin board item, a result model, and an exactly-once landing.

**Consequence:** reload/cross-tab recovery cannot be added by persisting a Zustand store. R7 needs a server-owned parent operation with child attempts.

### 4.2 Minting is not concurrency-atomic

`mintModel` reads the model, checks `agencyId`, then performs a separate update. Two simultaneous mint requests can both pass the read and generate/charge before racing the transition.

**Required correction:** a clean-draft → active compare-and-swap guarded by expected status/version, plus one idempotent operation id for the whole ceremony.

### 4.3 Refund references are not concurrently idempotent

`point_transactions` has a non-unique `(userId, referenceId)` index. `addCredits` checks for a duplicate before insert. Concurrent identical refunds can both pass the read.

**Required correction:** audit existing duplicates, add a database uniqueness constraint for non-null operation references (using the MySQL-compatible schema shape chosen during migration design), and treat duplicate insert as the already-recorded outcome.

### 4.4 `createModel` can return another concurrent insert

`createModel` inserts, then selects the user's newest model by `createdAt`. A user starting concurrent cast/fork/variation operations can receive the wrong model id.

`createModelAsset` and `createGeneration` already use `$returningId()`; `createModel` must join them.

### 4.5 The minted Profile is absent

Minted models reuse `CastingTakeover`/`CastingWorkspace` with locked framing and fork guidance. This is an honest R6 safeguard, not the intended product.

R7 needs a separate read-only **Cast Profile** surface that can:

- show the saved name, stable agency id, identity summary, package state, and view history;
- add missing package views through explicit priced actions;
- export from the correct library-owned surface;
- route identity change to Fork;
- never present the structured recast form as an in-place minted editor.

### 4.6 The strip shows truth but does not own routine care

`ViewTabs.tsx` shows current/stale/refreshing/failed/missing state. Stale and failed actions route into `PackageHealthDialog`; missing slots route into the tier modal.

The server plans and mutations already support most strip actions. R7 should attach deliberate priced controls to the truthful states, while Package Health becomes optional detail.

### 4.7 Current history is an asset ledger, not identity history

`restoreSlotVersion` appends a compatible asset as the newest display row. It does not restore:

- the identity anchor;
- preferences;
- `masterPrompt`;
- `technicalSchema`;
- identity revision;
- the package's selected assets and stale states as one unit.

That behavior is valid for **Use this version** inside one identity revision. It must not be relabelled as rollback. True rollback needs immutable identity snapshots and explicit slot selections.

### 4.8 The future composer is not present

`composeIdentityPayload.ts` currently builds headshot + one intent view + text. It has no:

- immutable identity plate/snapshot selection;
- owned reference plates;
- typed mark registry;
- anatomical-zone evidence;
- visibility prediction/probe state;
- candidate acceptance;
- recipe versioning;
- generative erase contract.

Its current selection is newest-filled rather than a future explicit snapshot selection. It is a useful pass-1 adapter, not the Batch D composer.

### 4.9 Final deletion semantics remain incomplete

Draft deletion hard-deletes the model, assets, wardrobe looks, and wardrobe sessions in SQL, but does not delete R2 objects or resolve every board/generation reference. Minted deletion is still refused. The founder subsequently rejected a user-facing archive/recovery product: deletion must instead be immediate, permanent, and simple, with linked Cast placements removed rather than degraded.

There is an unused `deleteModelWithAssetKeys` helper, but storage deletion alone would not solve retention, historical placement, rollback, GDPR, or partial-failure semantics.

### 4.10 Generation quality is internally inconsistent

Assets support `1K`/`2K`/`4K`, and an upscale backend exists, but Casting generation writes 1K in the live package paths. A UI resolution store defaults to HIGH without governing those server paths. The removed export upscale surface must not be revived as a substitute for a generation-time quality contract.

### 4.11 Recast and refinement are only minimally separated

The server contracts are now correct:

- structured panel + Recast = a new draft identity may result;
- text/reference refinement = preserve the accepted person and pass the post-generation gate.

The UI still puts these tools in one environment without a strong mode boundary, confirmation hierarchy, or conversational clarification for requests such as “make the hair longer” or “make the skin darker.”

### 4.12 The old acceptance checklist is stale

`CANVAS_FOUNDATIONS.md` still expects retired inline prompt/attribute chrome and old pin/staleness behavior. R7 cannot honestly “walk all 15 criteria” until the checklist is rewritten against the shipped takeover and character-sheet model.

## 5. Corrections to the inherited R7 plan

1. **Do not combine hardening and Batch D.** Product reliability and the experimental evidence composer have different risk, migration, billing, and calibration gates.
2. **Do not make `generations` pretend to be the parent job.** One user operation can own several generation attempts and refunds. Add an operation-level record and link attempts to it.
3. **Do not build cross-tab spinners before server truth.** UI recovery consumes durable operations; it cannot be the persistence mechanism.
4. **Do not use asset version numbers as canon membership.** Current/effective snapshot and slot selection must be explicit.
5. **Do not call compatible per-slot restore identity rollback.** Keep the simple feature and build snapshot restore separately.
6. **Do not freeze one original plate after identity changes.** Every allowed identity commit must version its authoritative visual evidence or the edit must remain prohibited.
7. **Do not silently author unseen identity evidence after mint.** Late views may derive from a sealed identity, but may not expand identity canon without a deliberate ceremony.
8. **Do not treat an uploaded iteration reference as a plate.** It is temporary generation input today. Persistent plates require owned storage, validation, retention, deletion, provenance, and versioning.
9. **Do not propagate outfits through Casting.** Casting defines the reusable person/character sheet. Wardrobe and Canvas own outfit application. Shared low-level composition primitives can be extracted later without merging product semantics.
10. **Do not promise exact generative replay.** Inputs, selections, recipes, and provenance can be reproduced; unseeded pixels can drift.
11. **Do not delete pinning as a one-line UI cleanup.** Pin rules affect stale behavior, refresh, restore, Package Health, and D-29/D-30/D-53. Supersede the complete contract in one phase.
12. **Do not expose 2K until cost and derivative reuse are defined.** Quality must be server-planned, deliberately chosen, persisted, and never cause surprise regeneration at export.

## 6. Proposed R7 execution sequence

### R7-0 — Close R6 documentation and ratify R7 boundaries

**No product code.**

- Record the W5/W6 and post-live corrections in `DECISION_LOG.md`.
- Rewrite the obsolete Canvas success criteria into a current founder drive.
- Mark the original 1.5-day R7 estimate as superseded.
- Ratify the decisions in §7 that affect later schema or UX.
- Establish deployment windows for migration-backed R7 releases.

**Gate:** founder + Fable approve this plan and the decision record.

### R7-1 — Trust foundation: exact ids, idempotency, atomic transitions

This is the first implementation batch.

- Convert `createModel` to `$returningId()` and add concurrent-insert tests.
- Design/audit/migrate unique operation references for the credit ledger.
- Introduce cryptographically strong client-request/operation ids with database uniqueness.
- Make mint a compare-and-swap transition against clean draft status and expected revision.
- Prevent duplicate mint/add-view/refresh/iterate submissions from charging or generating twice.
- Define recovery for an operation whose provider succeeds but final commit fails.
- Preserve public refund truth and internal failure logs from R6.

**Migration rule:** additive/forward-only; disposable-database drive first; production migration before code that requires it.

**Gate:** concurrency tests, duplicate raw-tRPC drives, credit conservation proof, Fable review.

### R7-2 — Durable generation operations

Add a server-owned parent operation, separate from individual `generations` attempts. The final schema is designed in this batch, but it must support at least:

- user, kind, model, origin board/item, expected model revision;
- operation id/idempotency key;
- queued/running/partial/succeeded/failed/cancelled-or-not-cancellable states;
- planned cost, charge reference, actual refunds;
- child attempt ids and per-angle outcomes;
- durable public-safe failure/result payload;
- timestamps, heartbeat/lease or explicit stale-operation recovery;
- exactly-once landing acknowledgement without making the board the durable result.

Then replace the in-memory-only recovery boundary:

- reload and another tab show truthful in-flight state;
- reopening the originating node resumes the operation view;
- pre-headshot casts remain linked to their originating node;
- Add Views and true mint may close safely;
- completed library results survive failed board landing and offer a deliberate re-link;
- same-tab stores become presentation caches over server truth.

**Gate:** reload/cross-tab drives, server restart simulation, duplicate subscription tests, no duplicate toast/landing/charge.

### R7-3 — Product surface split and conversational UX

#### R7-3A — Minted Cast Profile

- Route minted models to a dedicated Profile, not the authoring form.
- Show identity metadata, six-view package, status, versions, and package actions.
- Allow name as display metadata.
- Add missing views with explicit server-planned cost.
- Route identity change to Fork; no in-place recast.
- Keep export in Model Library; Profile may link to that action rather than duplicate its implementation.

#### R7-3B — Draft authoring modes

- Make **Cast/Recast identity** and **Refine this person** visibly different modes.
- Recast confirmation states that a different person may result.
- Refinement states the same-person guarantee and refund-on-gate-failure.
- Add server-backed clarification for ambiguous closed attributes, returning safe choices such as hair-length pills rather than a red refusal toast.
- Preserve fail-closed behavior when classification or clarification is unavailable.
- Redesign fork, error, first-run, and blocked-action copy as in-context choices rather than generic error toasts where user action is required.

**Gate:** founder UX review with screenshots plus keyboard/Escape/accessibility drives; no policy weakening.

### R7-4 — Strip-first package care and coherent history

#### R7-4A — View strip controls

- stale → `Refresh · price`;
- failed → `Retry · price`;
- missing → `Add view · price`;
- refreshing → truthful progress, no action;
- multiple actionable → `Refresh all · total`;
- Package Health demoted to details and integrity explanations.

Every click re-plans server-side at fire time. Nothing refreshes or charges automatically.

#### R7-4B — History terminology and selection

- Keep **Use this version** for compatible per-slot reuse.
- Make the current selected asset obvious.
- Explain why earlier-identity assets cannot be selected.
- Remove competing Canvas/Studio history behavior by routing both through one package history component.
- Do not claim true rollback until R7-6 snapshots exist.

#### R7-4C — Pin-retirement UX decision, if ratified

- Ratify the replacement UX and remove no schema/state in this phase.
- Do not create an interim slot-selection schema. “Explicit current-version selection” is the same authority concept that R7-6 must ratify as effective snapshot + per-slot selection.
- Execute pin retirement and migrate existing pinned rows only after R7-6 ratifies that selection shape, using the Batch D selection contract verbatim in R7-7 step 1.
- When it executes, supersede every pin-dependent rule together, including stale/refresh behavior and `composeIdentityPayload`'s stale-input handling.

**Gate:** priced-action tests, no-auto-spend assertions, Canvas/Studio parity drive.

### R7-5 — Final model deletion, storage cleanup, and reference removal

- There is no user-facing archive, recovery window, restore ceremony, or deletion undo. Deleting a Cast is an explicitly confirmed permanent action for drafts and minted Casts alike.
- Remove every direct representation of the Cast from Canvas in the same durable deletion boundary: Cast roots, library placements, and popped-out Cast views. Remove their versions and incident edges. Independently generated image/video outputs remain; deletion does not recursively erase unrelated creative work.
- Never leave `Source unavailable` placeholders for a deliberately deleted Cast. Recompute affected board thumbnails from surviving nodes, or clear them when none remain.
- Delete the Cast's identity documents, model assets, version history, and linked Wardrobe sessions/looks. A minimal non-image, non-recoverable internal tombstone/receipt may remain only to preserve idempotency, credit/accounting integrity, security auditability, and the fact that the subject was deleted. It must not contain a name, prompt, schema, preferences, image URL, storage key, or recoverable identity evidence, and it is never presented as an archive.
- Fence every model-linked writer at its durable write. The Casting/Canvas model lock does not cover Wardrobe session/look insertion or a rename already in flight; owned/alive predicates and conditional model updates must make every post-delete write affect zero rows.
- Build owned-R2 cleanup as a durable retryable background operation. The UI disappearance is immediate after the database deletion boundary; object deletion is verified and retried. Never attempt deletion for an external/legacy URL that is not provably owned by the configured Drape bucket.
- Cover every asset class that exists when this phase executes: model assets, generations/results, Wardrobe looks/sessions, board placements/versions, exports if any become persisted, operation-result payloads, and GDPR export/delete. Reference plates/crops do not exist until R7-7; their schema must join the same cleanup contract when introduced.
- Add a read-only dependency/orphan audit before mutation code, and prove cleanup against disposable data before any production deletion is enabled.

**Gate:** founder-approved dependency matrix; disposable-database delete drive; owned-storage cleanup simulation; no production migration, cleanup, or runtime enablement without separate authorization.

### R7-6 — Batch D design and calibration

**Founder-ratified 2026-07-22.** `CASTING_SYSTEM_R7_6_EVIDENCE_COMPOSER_DESIGN.md` is the authoritative implementation contract after Fable challenge and correction. This remains **design before build**. It ratifies:

- immutable identity snapshots and parentage;
- explicit effective snapshot and per-slot selections;
- versioned authoritative face/body/hair evidence;
- typed mark categories and anatomical zones;
- owned reference plates and crop evidence;
- initial marked-cast and legacy bootstrap;
- visibility prediction → generation → probe → validation → retry/refuse/accept;
- first-region acceptance semantics;
- late-view behavior after mint;
- true snapshot rollback;
- generative mask/edit/erase policy (no Photoshop layer stack);
- recipe versions, provenance, retention, fork, export, Wardrobe/Canvas consumption;
- billing/idempotency for probes, retries, rejected candidates, conflicts, and cleanup;
- calibration matrix across people, skin tones, marks, zones, poses, occlusion, and repeated generations.

The design should prefer explicit tables/constraints over authority hidden only in asset JSON. No migration or production code lands in R7-6.

### R7-7 — Feature-flagged evidence composer build

Only after R7-6 ratification. Start with one narrow identity-evidence category and a founder-approved calibration threshold. Do not ship all marks, all identity edits, masks, timeline, and toolbar redesign together.

Suggested order:

1. snapshot/selection infrastructure with current R6 behavior unchanged;
2. owned plate/evidence ingestion;
3. one category (recommended: tattoo/ink) on drafts only;
4. visibility/probe/retry and explicit candidate acceptance;
5. sibling regeneration from selected evidence;
6. true identity snapshot restore;
7. additional mark categories one at a time;
8. generative masked edit/erase only after the unified boundary is proven.

Every capability stays behind a server-owned feature flag with old R6 refusals as the fallback.

### R7-8 — Quality choice, downstream reference sheets, and dogfood closure

- Add a server-planned 1K/2K generation choice only after persistence, pricing, duration, retry, and derivative reuse are defined.
- Define a generated **reference-sheet derivative** for future image/video nodes: a pure layout of selected canonical views, not six independent attachments. Support engine-specific presets (for example, a one-visible-face preset) without changing identity canon.
- Rewrite and walk the current acceptance criteria on production.
- Audit back navigation, profile-popout wiring, dead code, TODOs, deploy-version skew, 30+ node performance, and stale local-only components.
- Run full suites, build, migration checks, headless drives, and founder manual drives.
- Begin dogfooding only after release blockers are closed or explicitly logged.

## 7. Founder rulings — ratified 2026-07-19

The following early direction is already clear and should be recorded, not re-asked:

- Casting creates the reusable person/character sheet; Wardrobe and Canvas own outfits.
- Minted identities need a separate read-only Profile.
- Missing views may be added after mint through deliberate priced actions.
- Permanent marks remain refused until proper evidence/composer support exists.
- No Photoshop-style reveal layer or saved layer stack.
- Nothing refreshes or spends credits automatically.
- Reference images are temporary iteration inputs today, not canonical plates.

The founder approved all eight recommendations below as binding R7 direction:

1. **Pinning retires.** Explicit selected versions plus deliberate refresh replace accepted-final pin semantics. Schema/state removal waits for R7-6's selection contract and executes through R7-7 step 1.
2. **Identity history retains immutable parentage.** The UI shows a simple active timeline. Restore creates a new current snapshot and never destroys evidence.
3. **First unseen-region evidence never silently becomes canon.** Use Accept / Retry / Cancel for evidence-bearing first-region authoring.
4. **Post-mint missing views may derive from the sealed snapshot but never silently extend identity canon.** Evidence-bearing ambiguity requires a separate deliberate ceremony or refusal.
5. **The first Cast Profile release is read-only for visual changes.** Presentation work routes to Canvas/Wardrobe; identity change routes to Fork. Name remains display metadata.
6. **Generation quality is a persisted package default selected before generation.** Every paid confirmation shows resolution and cost; export never triggers surprise upscale.
7. **Tattoo/ink is the first calibrated composer category.** Other mark families remain refused until separately calibrated and enabled.
8. **Deletion is final; archive recovery is retired.** A deliberate delete removes the Cast, every Cast view, its linked Cast placements, and owned image evidence without a recovery window. Deliberately deleted placements are removed rather than degraded to `Source unavailable`. Independent downstream creative outputs remain. Only a scrubbed, non-recoverable internal receipt required for idempotency, credit/accounting integrity, security, or the published legal policy may remain; it contains no identity documents or images and is not a user-facing archive.

## 8. Review and release discipline

- R7-1 and R7-2 are security/billing/data-integrity work: never full-auto overnight.
- R7-3 and R7-4 may be executed in bounded UI batches after contracts are fixed.
- R7-5 destructive cleanup requires a read-only dependency inventory, disposable-data proof, and separate production migration/runtime authorization.
- R7-6 is document/calibration work only.
- R7-7 requires feature flags, per-category calibration, and a founder visual gate.
- Every schema batch: generate migration → disposable DB → mixed-version compatibility check → Fable review → explicit production migration → deploy.
- Every paid drive records balance before/after and exact charge/refund references.
- Protected local files (`.agents/`, `.codex/`, `.claude/settings.local.json`, `CLAUDE.local.md`, and local Claude handoff files) are never staged.

## 9. Immediate next action

1. Complete R7-0 by reconciling `DECISION_LOG.md`, `PASS_1_BUILD_PLAN.md`, the R6 wrap state, and the obsolete Canvas success criteria.
2. Fable reviews the complete staged R7-0 documentation batch.
3. Commit R7-0 locally after approval.
4. Produce the exact R7-1 implementation plan and migration design.
5. Begin code only after the R7-1 plan is approved.

R7 should move quickly in bounded batches, but it should not hide architecture inside an overnight prompt. The trust foundation is mechanical enough to execute once reviewed; the evidence composer is a separate founder-gated product and research program.
