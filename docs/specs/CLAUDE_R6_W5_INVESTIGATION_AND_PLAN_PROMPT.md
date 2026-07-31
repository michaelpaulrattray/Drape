# Fable 5 prompt — investigate the final R6 live findings and produce the W5 execution plan

Use **Fable 5 only** for the substantive investigation and planning.

You are the reviewing/planning agent. Codex will be the implementation agent after you finish this task.

## Mode and boundaries

This is an **investigation and planning pass**, not an implementation pass.

- Inspect the current repository and verify every claim below against the current code at `HEAD`.
- Challenge the proposed conclusions when the code supports a different answer. Explain the evidence and recommend the better approach.
- You may run read-only searches and tests needed to understand existing behavior.
- Do not edit product code.
- Do not stage, commit, push, deploy, run migrations, contact production, or spend credits.
- The only file you may create or edit is:
  - `docs/specs/CASTING_SYSTEM_R6_W5_EXECUTION_PLAN.md`
- Leave that plan file uncommitted for Codex to execute from.
- Do not touch or stage `.agents/`, `.codex/`, `CLAUDE.local.md`, `.claude/settings.local.json`, or any `docs/specs/CLAUDE_*.md` file.
- Stop after writing the plan and reporting your verdict.

## Current state

The current R6 implementation through W4 is committed locally at:

- `9799dbe` — `R6 W4: casting session and Open choice truth`

It has already been pushed to the production deployment branch and the founder has completed another live manual test pass.

Do not plan from an old terminal transcript. Treat the current code, current decision documents, and the live findings below as authority.

Read at minimum:

- `AGENTS.md`
- `docs/specs/DECISION_LOG.md`
- `docs/specs/IDENTITY_EDIT_INTERIM_POLICY.md`
- the current R6 execution/audit documents that govern this work
- the current implementations and tests for casting creation, refinement, refresh, naming, fork/variation, export, and close/session behavior

## Product definition that remains binding

Casting creates a canonical character identity and its casting/reference views. It is not Photoshop and it is not the Wardrobe workflow.

- Draft identities can be edited under the ratified R6 policy.
- Minted identities are locked; identity changes require a fork.
- Cosmetic per-image changes must not silently mutate the identity document.
- An authorized identity edit may change only the requested identity attribute while protecting the rest of the person.
- Unsupported or ambiguous changes refuse before credits move.
- R6 must fail safely and tell the truth. Durable/background generation-job architecture belongs to R7.

## Founder’s latest live findings

### Behaviors that passed

- Normal draft landing works.
- Escape ownership works.
- Open-field metadata survives creation and downstream fork/variation.
- Fork and variation complete successfully.
- Stale counts and refresh prices agree.
- Package Health can refresh stale views and the refreshed views become current.
- Minting, export charging truth, policy refusals, and no-charge refusal behavior broadly work.

### Findings that need classification

#### 1. Serious identity-preservation failure during an authorized hair edit

The founder cast a dark-skinned male model and later asked to change only his hair color to pink.

The saved identity document is available here:

- `C:/Users/Admin/OneDrive/Desktop/master spec pink hair model.docx`

It still describes:

- Mediterranean heritage;
- a deep, rich ebony-dark skin tone;
- the original person and facial structure;
- an appended identity update changing only `person.hair.color` to pink.

Despite that, the generated headshot changed the subject into a much paler/white-looking person with a materially different overall identity. Refreshing the sibling views then propagated that altered appearance.

This is not acceptable model drift for an identity system. The authorized delta was hair color only.

#### 2. No useful loading/continuation state after leaving Casting

- If the founder begins a new cast from a canvas node and closes Casting before the headshot finishes, the originating node remains empty/default.
- The completed draft appears in the Model Library, but the node does not visibly remain connected to the in-flight cast.
- Reopening the same node does not show that generation is still running.
- Closing during a headshot iteration similarly loses visible progress in the node and Studio; the finished image later appears silently.
- The expected completion/Open Draft feedback was not observed in the fresh-cast case.

The desired fully durable behavior is a node that remains visibly generating, survives close/reopen, and later resolves into the created draft.

#### 3. Restore/version numbering is confusing

Restoring an earlier image creates a new higher version number: restoring v1 can produce v3, then v4, even when only two distinct images appear to exist.

Determine whether the current implementation is a copy-forward immutable audit entry rather than a new image generation, and ensure the plan states that truth.

#### 4. Free-text changes to structured/Open attributes refuse

For example, “make the skin darker” refuses even when the field was Open or selected. The founder can change it through the structured selector.

Confirm whether that is the intentional R6 policy and whether conversational clarification/preset choices belong to R7.

#### 5. Variation node lacks an immediate connector

A variation creates a temporary/loading node, but the lineage connector appears only after the server result completes. The founder wants the connector present immediately, including during loading.

#### 6. Visual drift in generated sibling views

The back view made hair somewhat longer than the other views. Treat ordinary view/composer calibration separately from the serious protected-identity failure in finding 1.

#### 7. Persistent stale warning after successful refresh

After all stale views were successfully refreshed and the stale dots/dimming cleared, the banner remained:

> The other views still show the previous identity — refresh them when you're ready to bring the whole card in line.

#### 8. Incomplete per-view refresh feedback inside Casting

- Package Health correctly reports that one view is refreshing.
- The canvas node shows the affected view loading.
- The Casting view strip does not visibly mark the individual refreshing view.

#### 9. Add Views modal cannot be closed while views generate

The founder is forced to remain in the modal until all selected views finish. Determine whether safely dismissing it requires the R7 durable-job architecture or whether a bounded R6 correction exists without faking durability.

#### 10. Draft naming does not stay synchronized

On an existing draft, the founder entered a name/draft label in the Add Views / mint-door modal.

Observed result:

- the name did not appear consistently on the canvas node;
- it did not appear visibly in Casting;
- it was not prefilled when minting later;
- right-click Rename changed only the canvas node label;
- after mint, nodes representing the same model synchronized to the minted name.

The existing-draft Add Views path is intended to preserve the optional draft label. Confirm the actual broken path and distinguish a model name/draft label from a canvas-node-only label.

#### 11. Export product ruling

The current export UI offers Original resolution for free and a paid 2K upscale across all six views. The founder tested it and found that the expensive 2K ZIP did not contain the identity PDF.

The founder’s ruling for now is:

- remove the 2K export/upscale option from the user-facing Casting export flow;
- export the current/original 1K images for free;
- do not silently deliver an “identity pack” without its identity PDF;
- if PDF creation fails, refuse the pack download with an honest error rather than degrading to an image-only ZIP;
- offer Export Identity Pack from the lobby Model Library only, not inside Casting Studio;
- later, add an explicit 1K/2K generation-quality choice at generation time rather than regenerating every image during export.

Confirm every current export entry point before planning removals. Do not remove backend capability merely for tidiness if safely hiding the unapproved product surface is the smaller change.

#### 12. Draft and minted identifiers

A minted model exposes its public `MOD-...` agency ID. A forked draft did not visibly expose a public ID. Confirm whether this is intentional: drafts have an internal database identity, while the public agency ID is assigned/displayed only after mint.

## Preliminary code-audit findings to verify, not blindly accept

Codex performed a read-only pass and found the following. Independently confirm each finding, including all call sites and tests.

### A. Gemini conversation state may cross model boundaries

In `server/casting/geminiGeneration.ts`, the in-memory casting session map appears to be keyed only by `userId`.

If confirmed, one user’s iterative Gemini chat can be reused across different cast models. That is a latent cross-model identity-contamination risk. Determine:

- every NEW and ITERATE entry point using this map;
- when sessions are created, reused, overwritten, and cleared;
- whether the live pink-hair failure can be proven to have come from this, or whether it is only a serious independent risk;
- the smallest sound scoping rule: model ID, model+asset, explicit session key, or no conversational reuse for protected identity edits;
- how multi-process/redeploy behavior affects this design.

Do not state that session bleed caused the live failure unless the evidence proves it. It may be one contributor or merely an uncovered hole.

### B. The iteration identity anchor may omit the technical schema

The iteration prompt appears to build its identity anchor from `masterPrompt` while passing `undefined` for the technical schema, even though the schema carries protected structured identity details.

Verify whether that is true along the live refinement path and whether including the schema is safe and necessary.

### C. There appears to be no post-generation protected-identity validation

The refinement route appears to:

1. authorize/classify the requested edit;
2. generate an edited image;
3. accept the generated asset;
4. commit the allowed identity-document delta.

There does not appear to be a gate proving that the returned image changed only the authorized attribute.

An unused `checkIdentityConsistency` helper may exist, but the preliminary review found it unsuitable as-is because it:

- may treat the deliberately changed hair attribute as an identity failure;
- is not expected-change-aware;
- may fail open on validator/parser errors;
- appears to have no live call sites.

Determine whether W5 needs an expected-change-aware, fail-closed validator. If so, plan its exact contract rather than saying “run an identity check.” The plan must define:

- protected attributes;
- authorized deltas that the validator must ignore;
- source/reference inputs;
- structured response schema and strict parsing;
- what happens on model uncertainty, timeout, invalid JSON, or unavailable classification;
- credit behavior;
- storage/asset cleanup behavior;
- whether the identity document, asset ledger, current version, or sibling-stale state can change before validation passes;
- user-facing refusal/failure copy;
- test doubles and deterministic behavioral tests.

If a post-generation visual validator is too unreliable or expensive to be a safe R6 gate, say so and propose a more conservative R6 boundary. Do not invent false assurance.

### D. The stale banner is local state that refresh does not clear

`useCastingGeneration.ts` appears to set `identityWarning` after an identity edit, while Package Health refresh completion updates assets/package state without clearing the warning when the package becomes fully fresh.

The fix must clear it only after server truth confirms there are no stale sibling views. Partial failure must leave an honest warning.

### E. Refresh state is aggregate, not per thumbnail

`ViewTabs.tsx` appears to read an aggregate `refreshingCount` but does not render the affected slot as loading. Inspect the refresh store and avoid creating a second source of truth.

### F. Existing-draft name persistence is intended but not reflected everywhere

The Add Views path appears to carry an optional nickname through `confirmArgsForDoor`, `useCastGate`, and the server stay-draft path. The live UI still failed to show/prefill it consistently.

Trace:

- modal local name;
- mutation input;
- server model row;
- query invalidation/refetch;
- Casting store `modelName`;
- canvas node label;
- later mint prefill.

Do not conflate right-click node rename with model rename.

### G. Variation lineage is durable but not optimistic

The server appears to create the lineage edge only after the variation is created, and the client invalidates/refetches edges after success. Confirm whether a safe temporary client edge can be shown and atomically replaced without duplicate/orphan edges on failure.

### H. Export currently degrades to an image-only ZIP

The export hook appears to catch PDF generation failure and continue downloading the images. This conflicts with the founder’s identity-pack ruling.

Inspect both Studio and Model Library entry points. The plan must preserve free original-resolution export while making the PDF mandatory for anything called an Identity Pack.

### I. Restore appears copy-forward, not regenerated

The restore route appears to append a new asset/version ledger row pointing at an existing storage URL with zero credit cost. Verify that it does not call image generation or create a new R2 image.

## Required R6 versus R7 boundary

Do not turn W5 into an unbounded redesign.

The working classification is below. Challenge it only with concrete code/product evidence.

### Candidate W5 release blockers/corrections

1. Prevent protected-identity drift on an authorized identity edit, with honest credit and persistence behavior.
2. Clear the stale-warning banner only when server truth says the package is fully fresh.
3. Show per-view refreshing state in the Casting view strip using the existing refresh authority.
4. Repair existing-draft name synchronization and later mint prefill.
5. Show an optimistic variation lineage connector and remove/replace it safely on failure/success.
6. Apply the founder’s export ruling: free current-resolution identity pack, lobby Model Library only, mandatory PDF, no user-facing 2K export option.
7. Restore reliable global success/failure/Open Draft feedback when a fresh cast finishes after the user has left Casting, without pretending the originating node owns a durable job.

### Keep for R7 unless you prove a small safe correction exists

1. Durable server-backed generation jobs.
2. A canvas node that remains linked to a pre-headshot generation across close/reopen/reload.
3. Reopening Casting into an accurate in-flight headshot or iteration job.
4. Safely dismissing Add Views while its multi-view job continues and can be resumed.
5. True rollback/revision-history UX instead of copy-forward version ledger semantics.
6. Composer/canonical reference architecture for reducing sibling drift and repeated headshot degradation.
7. Conversational clarification UI for structured identity attributes such as skin tone, age, and build.
8. The dedicated locked/minted profile viewer and additional-view flow.
9. Explicit 1K/2K quality choice at generation time.
10. Broader error-modal, fork-modal, and first-run UX redesign.

### Behaviors that are likely intentional, not bugs

- R6 free-text identity changes to guarded structured fields may refuse and route the user to the structured editor.
- Restoring an earlier version may create a new immutable ledger version without generating or charging.
- A draft may have an internal database ID without exposing a public minted agency ID.
- A canvas-node-only label may differ from the model’s canonical saved name, although the UI must make that distinction clear.
- Minor back-view hair drift is a composer/calibration problem; it must not be confused with a protected skin/face identity change.

## Architecture and safety requirements for the plan

The plan must preserve:

- server authority over identity policy;
- fail-closed behavior before credits when classification is unsupported or ambiguous;
- truthful refunds and errors when a post-generation safety gate fails;
- no unauthorized identity-document changes;
- no bad generated image becoming the current canonical asset before required validation passes;
- no false “fresh” package state after partial refresh failure;
- no production DB access from unit tests;
- existing W1–W4 behavior and ratified founder decisions;
- no broad refactor merely because nearby code is untidy.

For UI work, preserve Drape’s restrained editorial design. Reuse existing stores, loading indicators, dialogs, and design tokens rather than adding parallel mechanisms.

## Tests and proof the plan must require

At minimum, specify deterministic coverage for:

### Identity-edit safety

- User A/model 1 and user A/model 2 cannot share iterative model context.
- A hair-color-only edit keeps skin tone, face identity, age, build, ethnicity, and other protected traits unchanged.
- The validator permits the authorized hair-color delta rather than rejecting it as inconsistency.
- Validator uncertainty, timeout, invalid response, or unavailable classification fails safely.
- A failed safety gate charges zero net credits or issues a truthful verified refund according to the existing atomic-credit contract.
- A failed safety gate does not commit the identity delta, current asset, version ledger entry, or sibling-stale state.
- A passed safety gate commits exactly once.
- Cosmetic-only edits and refused categories keep their existing policy behavior.

### Refresh truth

- One refreshing slot is visibly marked in the view strip.
- A successful full refresh clears the old identity warning.
- Partial refresh failure leaves an accurate warning and failed/stale slot state.

### Naming

- Existing draft label entered at Add Views persists to the model.
- Casting and every linked node receive/refetch the canonical draft label.
- The later mint door prefills it.
- Node-only rename does not silently mutate the model name.

### Variation lineage

- A temporary variation has one visible lineage edge while loading.
- Success replaces/reconciles it without duplicates.
- Failure removes the temporary edge and node cleanly.

### Export

- No Studio Identity Pack action remains.
- Model Library offers one free current-resolution Identity Pack action.
- No paid 2K option is user-visible.
- All six canonical views are exported with correct labels.
- The identity PDF contains the saved model name and required identity information.
- PDF failure produces no misleading image-only “Identity Pack” download and charges nothing.

### Post-close feedback

- Completing a fresh cast after Casting unmounts produces one truthful global notice with a working Open Draft action.
- Failure/refund after unmount produces one truthful global failure notice.
- The action refuses safely rather than overwriting a different active Casting session.

Also require:

- `pnpm check`
- focused W5 tests
- the full unit suite
- a bounded browser drive for the behaviors that source-string tests cannot prove
- exact credit-ledger assertions where money can move

## Deliverable

Write `docs/specs/CASTING_SYSTEM_R6_W5_EXECUTION_PLAN.md` with:

1. **Executive verdict** — whether R6 needs W5 before it can close.
2. **Evidence table** — each founder finding, current code path, confirmed root cause, severity, W5/R7/not-a-bug classification.
3. **Challenge section** — every preliminary Codex conclusion you reject or materially revise, with evidence.
4. **Founder rulings already settled** — especially export and R6/R7 boundaries; do not ask these again.
5. **Any genuinely unresolved founder questions** — only questions whose answers materially change implementation. Do not manufacture choices the current rulings already settle.
6. **Bounded implementation batches** — ordered by dependency and risk. Give each batch:
   - exact objective;
   - likely files and symbols;
   - invariants;
   - acceptance criteria;
   - behavioral tests;
   - browser-drive proof;
   - rollback/stop condition.
7. **Identity-safety design** — precise enough that Codex cannot accidentally implement a cosmetic similarity check as an identity guarantee.
8. **Credit and persistence sequence** — show when generation, validation, upload, ledger mutation, identity commit, stale marking, and refund happen.
9. **Explicit exclusions for R7**.
10. **Fable review gates for Codex** — where Codex should stop and hand the staged diff back to Fable before continuing.

Prefer a few coherent batches over many tiny passes. The plan should be executable, but it must not bury the serious identity issue inside UX polish.

When complete, report in plain English:

- whether you agree R6 needs W5;
- the confirmed cause or causes of the pink-hair identity failure;
- what is truly release-blocking;
- what remains R7;
- the path of the plan document;
- that no product code, commit, push, deployment, production data, or credits were touched.
