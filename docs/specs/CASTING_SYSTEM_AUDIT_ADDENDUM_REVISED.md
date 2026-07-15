# Casting system audit — revised addendum and R6 recovery plan

**Status: REPORT / EXECUTION GATE — nothing in Batches 0–D is authorized merely by this document.**

**Date:** 2026-07-15  
**Milestone:** R6 recovery and closure. This is not R7 yet.  
**Read with:**

1. `docs/specs/CASTING_SYSTEM_AUDIT.md` — the original 15-divergence audit.
2. `C:\Users\Admin\Downloads\YOUTUBE\EP0\CASTING_SYSTEM_AUDIT_ADDENDUM.md` — the 2026-07-14 bench evidence and first canon proposal.
3. `docs/specs/DECISION_LOG.md` — current law and every ruling this plan may amend.
4. `docs/specs/CASTING_SYSTEM_AUDIT_WRAP_STATE.md` — the stabilization note produced by the previous coding session, when present.

This document supersedes the original audit's repair sequence and the first addendum's statements that **Batch A is unchanged**, that **Batch C is implementation-ready**, and that **Batch D is an executable build plan**. The original evidence remains useful; the sequencing and architecture below govern the next review.

---

## 1. Executive ruling

The propagation addendum established a credible central fact:

> Text can describe a class of mark, but visual evidence is required to preserve the appearance of a specific mark across generated views.

That finding is retained. The proposed zone-crop, visibility-probe and multi-reference direction is promising.

It did **not** establish that the full canon architecture is ready to build. The four-view, one-model bench does not settle persistence, initial-mark bootstrap, general identity edits, undo branching, partial mint, concurrency, billing, storage lifecycle, or probe failure. Those are now explicit design gates.

The next task is therefore:

1. stabilize the interrupted mechanical work;
2. close authority and security bypasses;
3. land only safe, coupled mechanical repairs;
4. define an honest interim for unsupported propagation;
5. design and ratify canon as its own milestone before implementing it.

R6 remains open until the casting loop is both technically green and behaviorally honest. R7 does not begin merely because the previous terminal ran out of context or credits.

---

## 2. Current baseline at handoff

The previous coding session stopped mid–Batch A immediately after adding `threeQuarter` to the export/PDF flow. It had not started R-A, the identity-document split, structured marks, reference plates, canon versions, or propagation.

The interrupted worktree contained partial changes for V1/V2/V3/V4/V15 and a partial `shared/modelStatus.ts`. At review time:

- TypeScript failed with seven errors: incomplete prop removal, one impossible narrowed tool-state comparison, and the missing `PdfModelData.images.threeQuarter` type.
- The casting unit suites passed inside the broader unit run; one unrelated account-export test timed out.
- No production deployment, commit or migration had been made from the interrupted batch.

The wrap session must leave `docs/specs/CASTING_SYSTEM_AUDIT_WRAP_STATE.md` stating the actual post-wrap truth. New work must trust that state note and the live diff over this historical paragraph.

---

## 3. Confirmed blockers the earlier reports missed

### B0.1 — Status transition authority is bypassable

`models.update` currently accepts `draft`, `active`, or `archived` directly. An owner can therefore:

- change `active → draft` while retaining `agencyId` and `mintedAt`, unsealing a minted identity;
- change `draft → active` without the mint ceremony, name or agency id;
- create combinations for which status, agency id and UI provenance disagree.

`getUserModels` and direct `models.get` also return archived rows, and board picker logic can interpret archived as draft.

**Consequence:** V10 cannot be solved by a shared `isMintedStatus()` helper alone. Legal server transitions and data invariants must land first.

### B0.2 — Nameless mint has a live legacy route

`generation.mint` accepts only `modelId` and calls `mintModel` without the tier dialog's name guard. Both export implementations use it.

**Consequence:** the original audit's statement that nameless mint is refused at a single router boundary is false. A guard inside `executeMintPackage` does not close the bypass. Export can also bypass any future canon-current mint gate unless it uses the same server-owned state machine.

### B0.3 — The identity writer inventory is incomplete

Identity state is written by more than typed iterate:

- every successful environment iteration fires `generation.reconcile`;
- `reconcile` rewrites `masterPrompt` and `technicalSchema`;
- `compactPrompt` rewrites `masterPrompt`;
- board `applyModelEdit` regenerates `frontClose` and rewrites prompt, schema and preferences;
- board surgical/eraser flows call iteration through their own orchestration;
- fork/recast and model creation initialize the same identity fields;
- legacy export/mint changes model state.

**Consequence:** removing freeze-and-append from one route would not make cosmetic edits document-neutral or canon writes centralized.

### B0.4 — Reconcile contains a server-side URL-fetch vulnerability

`generation.reconcile` accepts a client-supplied URL and fetches it without `validateProxyUrl` or an equivalent server-derived asset lookup.

**Consequence:** fix or retire this path before broader architecture work. New canon APIs must accept owned asset ids, not arbitrary remote URLs.

### B0.5 — V1 is coupled to V14 and masked-edit policy

The interrupted V1 patch removed client gates, but the server maps every non-`frontClose` iterate to `FULL_BODY`. `sideClose` and `threeQuarter` would therefore receive the wrong framing.

The same patch exposed surgical and eraser tools on every view, while the propagation addendum correctly says masked edits are not cosmetic by construction.

**Consequence:** V1 is not a standalone mechanical deletion. Typed iteration, framing and masked capability must be separated.

---

## 4. Corrections to the first propagation addendum

### C1 — `identity_plate` cannot be both frozen forever and authoritative after general identity edits

The classifier treats face geometry, hair identity, build, proportions, age, ethnicity and skin tone as identity-level changes, not only marks.

If a draft changes its nose, hairstyle or build while the original identity/body plates remain frozen, later generations are visually anchored to the old person. That is the same instance-versus-text failure identified for tattoos.

**Required design answer:** either version the visual identity/body evidence on every identity commit, sharply limit which identity edits exist, or define another evidence mechanism. A frozen original may remain provenance, but it cannot automatically remain the sole current authority.

### C2 — A `clean_body_plate` is not guaranteed to be clean

Casting briefs already accept tattoos, scars, freckles, beauty marks and other distinctive features. A first `frontFull` may legitimately contain them. Existing models cannot be safely backfilled by keyword detection.

The design must specify:

- initial structured-mark extraction;
- initial evidence capture;
- whether a separate clean-body generation is required and who pays;
- what happens when a clean reference cannot be obtained;
- legacy behavior for existing marked drafts and minted models.

### C3 — Marks require typed categories

`model.marks.length > 0` must not control tattoo prompting. The registry includes semantically different features:

- ink/body art/branding;
- scars and scar tissue;
- pigmentation, birthmarks, moles and freckles;
- piercings;
- structural identity features.

Each category needs its own persistence and anti-invention directives. The current clean-skin rule forbids tattoos, ink and body art; it does not by itself forbid scars or birthmarks.

### C4 — Visibility is circular for empty slots

An ungenerated slot has no image to probe. A refreshed generation may expose different anatomy from the old image.

The architecture must choose and calibrate an explicit loop, for example:

1. predict visibility from the requested view/pose;
2. generate a candidate with the predicted evidence;
3. probe the candidate;
4. validate mark presence/absence and pose preservation;
5. retry, refuse or ask for acceptance.

Probe failure cannot silently fail open for a canon decision. `unknown` must remain an actionable state.

### C5 — “Depth is always 1” conflicts with current-plate masks

The proposed eraser applies a mask to the current asset, which is a chained delta. Applying that mask to a newly composed image risks coordinate and pose misalignment.

**Founder ruling — eraser mechanism:** Drape will not build a Photoshop-style underlying/reveal layer, aligned pixel composite, or saved layer stack. That option is closed as unnecessary complexity and is not a Batch D candidate. An eraser is either a generative masked edit routed through the unified classifier/canon writer, or it is unavailable. Restore/version checkout is the exact, free path back to prior pixels. Current-asset masking remains a one-step delta, so accumulation behavior still requires calibration; the plan may not claim depth is always 1.

### C6 — Canon membership is not `<`

`asset.canon_version < model.canon_version` fails after checkout to an earlier version: a future v3 asset is not less than v2 and could appear current.

Freshness requires exact snapshot membership or equality against the effective selected asset. A version column alone is insufficient under the current newest-row-wins ledger.

### C7 — Checkout needs immutable snapshots and selection state

Before implementation the design must define:

- immutable canon snapshot rows and parentage;
- current/effective slot selection at each snapshot;
- zone and evidence versions at each snapshot;
- assets valid across several unchanged canon snapshots;
- edit-after-undo behavior: linear redo destruction or branching/DAG;
- atomic package checkout;
- per-slot re-roll selection inside one canon snapshot.

### C8 — Partial mint conflicts with later first-region authoring

The first addendum simultaneously says:

- mint freezes canon;
- an unseen region's first render authors and seals new canon;
- missing views may be generated after mint.

If a post-mint back view reveals an unseen nape, those statements cannot all hold. The founder must choose whether partial mint blocks unsealed regions, whether post-mint canon extension is allowed under ceremony, or whether the late view must remain non-canonical/refused.

### C9 — First-region invention needs acceptance semantics

A generated invention must not silently become permanent merely because it was first. Define Accept / Retry / Cancel, or explicitly ratify automatic commit plus undo.

### C10 — Minted cosmetic behavior remains unresolved

D-43 permits cosmetic iteration on minted identities. The first addendum's persistent-toolbar section instead disables the toolbar for minted models.

Artifact-level cosmetic refinements are non-canon writes under the proposed design. The founder must decide whether they remain allowed after mint.

### C11 — Empirical claims must stay calibrated

The bench supports multi-reference visual evidence as a promising mechanism. It does not yet validate the full zone/probe/canon system.

Remove or qualify claims that:

- any view can be rebuilt “exactly”;
- V20 is a deterministic code defect rather than observed model behavior;
- the zone ontology is proven;
- the multi-reference budget is settled across several people or zones.

Inputs and provenance can be reproducible. Unseeded generative pixels are not exact.

---

## 5. Revised execution sequence

### Wrap — stabilization only

The interrupted terminal performs no new audit batch. It:

- completes the interrupted PDF type change;
- resolves incomplete V2 prop cleanup;
- restores/defer V1 rather than shipping wrong framing or universal masks;
- removes/defers the partial Batch B status helper work;
- runs checks;
- writes `CASTING_SYSTEM_AUDIT_WRAP_STATE.md`;
- stops without commit/deploy unless separately authorized.

### Batch 0 — authority and security

This is the first new-terminal implementation candidate, after plan ratification.

1. Remove status from the generic model update mutation.
2. Define server-owned legal transitions for mint and archive.
3. Enforce invariants:
   - `draft`: no mint identity commitment;
   - `active`/`locked`: valid name, `agencyId`, `mintedAt`;
   - `archived`: rejected by generation/edit routes and excluded from active reads.
4. Audit/backfill inconsistent existing rows before status-driven reads expand.
5. Remove or route legacy `generation.mint` through the validated mint state machine.
6. Make export consume the validated server snapshot; export must not mint implicitly around the ceremony.
7. Retire or secure `reconcile`; accept owned asset ids and enforce status/canon policy.
8. Inventory every writer of model identity and asset selection.

**Required tests:** illegal transitions, nameless mint through every route, archived reads/operations, export bypass, raw tRPC bypass, reconcile URL validation.

### Batch A-safe — mechanical repairs with no architecture commitment

1. V2 — finish dead stage-lock UI/plumbing deletion.
2. V3/V4 — canonical six-slot export, PDF types/layout and completeness.
3. V15 — one package observer cadence/source, if the live cache behavior remains correct.
4. V21 — normalize internal adapter naming only where it reduces real ambiguity; do not present it as a user-visible defect.
5. V9 — repair the placed-draft name field **together with Batch 0's mint-route closure**. UI-only V9 is insufficient.
6. V8 — make the displayed stale count equal the actionable refresh set, and surface a stale headshot as a separate state with an explicit iterate/restore exit. This is an honesty and recoverability patch, not the future canon architecture.

V8 may be omitted here only if Batch C instead makes the stale-headshot state unreachable, clears or migrates every existing instance, and proves both properties with tests. R6 may not close while the current silent dead end remains.

### Batch A-coupled — V1 plus minimal V14

V1 may land only with:

- per-angle framing (`frontClose`/`sideClose`/`threeQuarter` close; full-body trio full);
- focused tests for all six angles;
- typed iteration separated from masked tool availability;
- surgical/eraser remaining gated until classification/canon policy is implemented;
- an explicit statement that current iteration still uses the existing non-canon propagation limitations.

Full multi-reference iterate composition remains Batch D. This batch only prevents the known wrong-frame regression.

### Batch B — status read-model unification

Only after Batch 0:

1. Introduce the shared status predicates.
2. Sweep gallery, session, gate, board, package and export derivations.
3. Treat `locked` as the legacy minted alias.
4. Treat `archived` as deleted everywhere.
5. Remove `agencyId`, provenance and session-action inference as permission signals.

### Batch C — honest interim and identity-writer consolidation

Batch C is redesigned; it is not the original 0.5–1 day text split.

1. Build a complete identity-writer inventory and one service boundary for:
   - asset-only cosmetic edit;
   - identity/canon-changing edit;
   - refusal;
   - fork.
2. Remove freeze-and-append and prevent automatic reconcile from reintroducing photo-specific state.
3. Separate person identity fields from per-view pose, expression, camera, lighting, background, framing and wardrobe.
4. Define typed initial marks and category-specific prompting. Do not key tattoo behavior off total mark count.
5. If reliable instance propagation is not yet built, define the small, evidence-backed subset of identity-changing edits—if any—that the current anchor can safely propagate. Refuse every other unsupported identity-changing edit, including marks, face, hair, build, age and similar person-level changes, consistently across **all** affected doors:
   - identity-edit commit;
   - refresh;
   - add missing views;
   - mint;
   - export;
   - downstream wardrobe/board consumers where incoherence matters.
6. Do not allow a successful identity-changing edit to create a permanently unresolvable stale package. Either refuse before commit, limit it to a proven-safe state, or provide an explicit rollback/restore exit.
7. Before R6 closes, route every masked edit through the same classifier and identity-writer boundary. If that policy is not implemented, disable masked editing everywhere; the temporary stabilization allowlist is not a permanent safety boundary.

Batch C closes only when the interim loop has a reachable honest end state.

### Batch D-design — canon specification, no production code

Produce and ratify:

- schema tables, keys, constraints, indexes and forward-only migrations;
- canon snapshot and slot-selection state machine;
- visual evidence rules for marks and non-mark identity changes;
- initial and legacy bootstrap;
- visibility generate/probe/validate/retry policy;
- generative edit/erase/mask policy, or tool unavailability; no underlying/reveal layer, aligned pixel composite, or saved layer stack;
- mint/late-view policy;
- concurrency and expected-version commit protocol;
- billing, idempotency, retries and refund rules;
- storage, deletion, GDPR and orphan cleanup;
- export, registry, boards, wardrobe/VTO and fork integration;
- provenance and recipe-version requirements;
- feature flag and rollback behavior;
- calibration and acceptance matrix.

### Batch D-build — feature-flagged implementation

Begins only after Batch D-design and the founder rulings below are ratified. Start narrowly; do not combine composer, timeline, toolbar redesign, pin deletion and all generative eraser cases into one unreviewable release.

---

## 6. Founder rulings required before Batch D-build

**Already settled — not open for re-ruling:** the eraser will not use an underlying/reveal layer or Photoshop-style compositing. Restore handles exact rollback; erasure, when enabled, is generative and must pass through the unified masked-edit boundary.

1. **Visual identity evidence:** does a face/hair/build identity edit version the authoritative plates, or are some edits prohibited?
2. **Partial mint:** may unseen regions extend canon after mint, or must they be sealed/refused before mint?
3. **First-region authoring:** explicit Accept / Retry / Cancel, or automatic commit with undo?
4. **Minted cosmetics:** do non-canon artifact refinements remain allowed under D-43?
5. **History:** linear undo with redo destruction, or a branching canon DAG?
6. **Pin deletion:** if slot pinning dies, explicitly supersede every affected D-29/D-30/D-53 clause, not only D-21.
7. **Reference budget:** explicitly amend D-39(d)'s ~5–6 image budget as well as D-30's two-image recommendation.
8. **Interim behavior:** refuse unsupported identity-changing edits before commit, or permit them with what exact escape?

---

## 7. Production contracts required in the design

### Persistence and migration

- Existing models with no reference plates or mark evidence.
- Existing marked models whose text cannot be trusted for backfill.
- Draft, active, locked and archived rows with inconsistent fields.
- Forward-only Railway migration and mixed-version deploy behavior.

### Concurrency and atomicity

AI calls run outside a long database transaction. Every commit carries an expected canon/status version. Asset row, canon snapshot, mark/zone versions, slot selection, document and provenance commit atomically or remain a recoverable pending operation.

### Billing and idempotency

Define charges/refunds for probe calls, retries, candidate rejection, crop/evidence failure, identity-gate failure, compare-and-swap conflict and duplicate client submission. Use operation ids with database uniqueness; `Date.now()` labels are not an idempotency contract.

### Storage and privacy

Reference plates and crops need owned R2 keys, content validation, cleanup, account deletion, GDPR export, fork behavior, retention and orphan recovery. URLs are derived server-side from owned records.

### Downstream coherence

Mint, export, registry, boards, pop-outs, version selection, wardrobe/VTO, fork/recast, thumbnails and model deletion must all consume the same effective canon snapshot.

---

## 8. Verification gates

### Before any new batch

- `pnpm check` green.
- Focused casting unit tests green.
- Dirty-file/state note reconciled.
- No production migration, push or deploy without explicit authorization.

### Batch 0/A/B tests

- Every illegal status transition through raw tRPC.
- Nameless mint through tier, legacy export and direct route.
- Archived exclusion and operation refusal.
- All six iteration frames.
- Mask tools remain unavailable where policy is not implemented.
- Six-slot ZIP/PDF export.
- Package/session/board status agreement.

### Batch C interim tests

- Cosmetic edits write no identity document through any writer.
- Every allowed identity-changing edit is in the explicitly documented, evidence-backed subset.
- Unsupported identity-changing edits—including marks, face, hair, build and age—cannot create an unresolvable package.
- Masked tools cannot bypass classification: they use the unified boundary or are unavailable everywhere.
- Refresh/add-view/mint/export refusal agreement.
- Restore/rollback is a reachable exit where promised.
- V8 has either shipped with count/exit honesty or the stale-headshot state has been made unreachable and all existing instances cleared or migrated.

### Batch D calibration matrix

Multiple subjects, skin tones, genders, asymmetric marks, mark categories, body zones, birth-view angles, occlusions, empty slots, existing stale views, 1–N zone references, repeated generations, generative mask removal, identity drift and gate/probe failures. Human review records composition fidelity separately from micro-linework fidelity.

---

## 9. R6 closure criterion

R6 closes when all of the following are true:

1. the worktree and permanent checks are green;
2. authority bypasses cannot unseal, fake-mint or export around the ceremony;
3. the six-view iterate/mint/stale/refresh loop has no silent or dead-end state;
4. unsupported instance propagation is refused consistently and recoverably;
5. the founder has accepted which deeper canon work moves to the next milestone;
6. the state note and DECISION_LOG accurately describe what is built versus designed.

Batch D may then become a named R7 architecture/build track if the founder chooses. Until those closure conditions hold, calling the work R7 would hide unfinished R6 invariants rather than advance the product.

---

## 10. Immediate next action

1. Run the bounded stabilization prompt in the current terminal.
2. Start a fresh terminal after `CASTING_SYSTEM_AUDIT_WRAP_STATE.md` exists.
3. The new agent reads the original audit, this revised addendum, the state note, the decision log and the live diff.
4. It reports conflicts and a concrete Batch 0/A/B plan before changing code.
5. The founder ratifies the plan and required rulings.
6. Implementation proceeds in green, reviewable batches.

**Do not resume the original R-A/text-propagation leg. Do not treat the first canon proposal as approved implementation.**
