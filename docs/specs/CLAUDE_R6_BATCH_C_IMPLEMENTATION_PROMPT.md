# Claude prompt — R6 Batch C implementation

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


The founder authorizes **R6 Batch C only**: implement the founder-ratified interim identity-edit policy in `docs/specs/IDENTITY_EDIT_INTERIM_POLICY.md`, complete its M1–M22 verification matrix, self-review the full result, leave everything unstaged and uncommitted, report, and stop.

This is an implementation task, not another policy-writing round. The policy is already founder-ratified. Perform a short evidence-based preflight, then code in coherent internal phases.

Do **not** begin R6 close-out, Batch D/R7, a composer/canon system, or unrelated cleanup if you finish early.

If code evidence reveals a genuine contradiction in the ratified policy, an unsafe migration requirement, or a missing founder decision, complete any independent safe work, explain the exact conflict, and stop. Do not silently reinterpret the policy.

## Binding documents — read completely before editing

1. `CLAUDE.md`
2. `docs/specs/CASTING_SYSTEM_R6_EXECUTION_PLAN.md`
3. `docs/specs/IDENTITY_EDIT_INTERIM_POLICY.md` — **Revision 9 is the binding implementation contract; read all sections and M1–M22**
4. `docs/specs/IDENTITY_WRITER_INVENTORY.md`
5. `docs/specs/CASTING_SYSTEM_AUDIT_ADDENDUM_REVISED.md`
6. Relevant D-21, D-30, D-43, D-53, D-55 and F3–F6 entries in `docs/specs/DECISION_LOG.md`

Where older documents conflict, the supersessions and founder ratification recorded in `IDENTITY_EDIT_INTERIM_POLICY.md` control. Do not resurrect superseded claims such as generic restore being identity rollback, pinned assets being exempt from staleness, or newest-headshot automatically being identity authority.

If the top-level model is Fable/Claude Fable 5, perform the architecture and risk review directly as self-review. Do not invoke a routine advisor merely because an advisor protocol exists.

## Start-state gate

Before editing:

1. Confirm branch `main` and `HEAD === 7fc87d9` (`R6 Batch A-coupled: six-view typed iteration and framing`).
2. Confirm the tracked worktree is clean and nothing is staged.
3. Local `main` being ahead of `origin/main` is expected. Confirm nothing from R6 has been pushed or deployed.
4. Inventory and preserve all existing untracked local-only items. Expected examples include `.agents/`, `.codex/`, `.claude/settings.local.json`, `CLAUDE.local.md`, and `docs/specs/CLAUDE_*` prompt/handoff files. Never edit, delete, stage, or commit them unless this prompt explicitly names a new Batch C implementation file under a tracked source/docs path.
5. If HEAD differs, tracked changes exist, or the baseline is ambiguous, stop and report it. Do not mix work.

## Authorization

Authorized:

- Implement the complete ratified Batch C policy across server, shared types, client copy/doors, tests and narrowly necessary drive scripts.
- Add the minimal schema and forward-only migration **source files** required for identity revision, asset role and fingerprint/provenance authority.
- Generate migration artifacts locally if the command only writes repository files and does not connect to a database.
- Run typecheck, unit tests, mocked/router tests, source guards and free local drives.
- Use Claude's Edit tool for source changes rather than `sed -i`, heredoc appends, or shell write commands.

Not authorized:

- `pnpm db:push`, applying any migration, or connecting to the hosted development or production database.
- Production row audits, backfills, data normalization or destructive migration behavior.
- Gemini/image/video generation, paid-credit verification, or any real external model call.
- Push, deploy, Railway changes, production URLs/services, auth/account mutations or Stripe operations.
- Staging or committing. The founder/Codex must review the entire Batch C diff first.
- Batch D/R7 architecture: persistent reference plates, anatomical-zone composer, per-category mark persistence, generative erase, masked-tool re-enablement, canon snapshots/checkout, true identity rollback, outfit propagation, visibility probes, or concurrency/idempotency redesign.

No `git add`, `git commit`, `git push`, deployment command, database-application command, production command, or paid generation.

## Required preflight — short, then implement

Before code, trace every writer and door from `IDENTITY_WRITER_INVENTORY.md` and policy §13. Produce a concise working checklist mapping each to its shared guard/authority behavior:

- `generation.iterate`
- masked iterate path
- `generation.reconcile`
- compaction
- `applyModelEdit`
- `castingImage` / initial headshot / re-roll
- mint and add-views
- refresh
- restore
- export and rename regressions
- every creation/recast/fork/variation intake
- Canvas and Wardrobe isolation boundaries

Do not stop after producing this checklist. Use it to implement the batch.

## Non-negotiable architecture

### 1. One server-owned authorization boundary

Implement one shared, typed server authority for free-text and reference-assisted edit classification/authorization. All applicable doors consume the same decision contract; no door creates its own weaker classifier.

Required pipeline ordering from policy §6:

1. Deterministic refusal/category checks.
2. Strict LLM classification/parser where needed.
3. Leaf normalization.
4. Server-owned authorization against model status, source view/evidence, reference capability and registry enablement.
5. Most-restrictive-wins for mixed/multi-leaf requests.
6. Only then may a generation record, credit deduction, image call or identity write occur.

`unavailable`, malformed, unknown, ambiguous, parent-only, unrecognized leaf, vague reference, unsupported modality, or failed normalization must refuse safely, clearly and for free. Never fall back to unchecked image-only generation.

Retain the existing force-test hook. No client/tRPC input may carry authorization, normalized persistence destinations, asset role, revision authority, fingerprint authority, or other provenance-shaped fields. These are server-derived only.

### 2. Closed types and exhaustive registry

Implement the exact closed type contract in policy §5.4 and §8.5/§8.6:

- authorizable identity fields and supported leaves;
- leaf-specific normalized value types;
- closed preference keys and schema paths;
- `AuthorizedLeafEdit` preserving exact leaf↔value pairing;
- typed preference/schema writes, including `null` for no-mirror fields;
- exactly one exhaustive `IdentityFieldHandler<F>` per authorizable field.

Persistence destinations derive only from the server registry/handlers. An LLM response never selects a database field, preference key or schema path. Invalid/mismatched pairs must fail typecheck/tests.

Ratified but deliberately unsupported R6 leaves remain registry-disabled or type-excluded exactly as the ledger requires. Adding a parent category never authorizes a new child leaf.

### 3. Three outcome classes

- **Identity:** only policy-authorized leaves/structured fields; draft only; authoritative `frontClose` only; normalized typed patch; atomic new authority/revision commit; every filled sibling becomes stale, pinned included.
- **Presentation:** clothing, styling, accessories, hats, jewelry, makeup and cosmetic lash treatments refuse in Casting with the ratified Canvas/Wardrobe routing copy; no charge, image, document write or stale flag.
- **Image-only:** selected-view asset version only, drafts and minted; identity documents/preferences/schema byte-unchanged; no compaction, reconcile or stale flags. A `frontClose` result is display-only and never becomes identity authority.

Post-creation eyelash edits, natural or cosmetic, refuse during R6 and cannot escape through `features`, `eyeShape`, `browShape` or a parent field. Creation may retain only validated natural eyelash anatomy; cosmetic lash language refuses before save/charge.

### 4. Identity anchor, asset roles and revisions

Implement policy §7, §8.6, §13 and §14 with the smallest forward-only schema necessary:

- Explicit server-owned asset role: authoritative `anchor` versus `display`/ordinary view output as specified.
- Explicit identity revision authority and revision membership on every relevant output.
- Canon/document fingerprint or equivalent deterministic legacy compatibility evidence required by the ratified policy.
- One shared anchor selector consumed by iterate authority, refresh, add-views, mint, restore and other identity consumers.
- A newer displayed headshot must never silently replace an older authoritative anchor.
- Legacy rows follow the exact fingerprint pass/fail rules; uncertain legacy provenance refuses rather than guessing.

An allowed identity edit must commit atomically in the §8.6 order: authorized normalized patch, updated documents/preferences/schema, new anchor asset, new identity revision/authority, and correct stale flags. No partial identity state may survive a failure. Follow the ratified refund behavior.

Do not implement true identity rollback. Ordinary restore never rolls authority or documents backward.

### 5. Iterate and reconcile

- Preserve Batch A-coupled's six-angle typed doors and per-angle framing.
- Masked submissions remain refused before rate/quota/model lookup/generation/credits; surgical/eraser UI remains unavailable.
- Identity edits are eligible only on a draft authoritative `frontClose`, for exact enabled leaves with required evidence.
- Non-anchor identity requests refuse with helpful routing to the headshot; minted identity requests retain the fork rule.
- Image-only iterations are asset-only, including on `frontClose`.
- Reference images provide evidence, never authorization; vague whole-reference requests refuse.
- Disable automatic reconcile: remove the client call and make the server procedure refuse. No generated image silently rewrites identity documents.

### 6. Marks and prompt rules

Create one shared categorized marks vocabulary for deterministic classification, creation validation, compaction protection and prompt-rule selection.

- Every new mark edit—tattoo/ink, scars, beauty spots/moles, freckles/clusters, birthmarks, pigmentation, piercings and structural marks—refuses during R6 before charge, text and reference.
- Casting creation may advertise/accept tattoo/ink only, with honest wording that designs can vary across views.
- Other mark families are not advertised or promised.
- Existing mark/body-art language in an identity document must be preserved byte-for-byte or semantically protected through allowed document operations.
- Three-state prompting: ink ⇒ persistence rule; non-ink mark ⇒ neither persistence nor clean-skin; mark-free ⇒ clean-skin. Non-ink marks must not gain the piercings prohibition that would erase them.
- A marked document must never receive `CLEAN_SKIN_RULE` through generation, refresh, iterate or compaction.

Per-category mark persistence remains Batch D/R7.

### 7. Reference-assisted edits

Implement the exact §8.5 ledger and §9 capability matrix:

- Reference presence never weakens deterministic or LLM classification.
- Only explicitly named, exact leaves are considered.
- Authorized reference identity edits follow the same draft + authoritative-headshot + normalized-patch + new-revision rules as text edits.
- Geometry unlocks only the single authorized leaf; every unrequested feature remains locked.
- Store concrete normalized values, never relational prose such as “like the reference.” A later sibling refresh must reproduce the identity trait with the temporary reference gone.
- Unsupported modality, tattoo/mark transfer, vague “use this look/copy everything,” whole-face/whole-person replacement, mixed refused content and unsupported leaves refuse before charge.
- Suggestion chips and reference analysis never constitute authorization and must pass through the same server boundary.
- UI advertises only capabilities the server/prompt actually supports.

Do not create persistent reference plates or exact reference replay.

### 8. Structured editor and `applyModelEdit`

- Use a strict server-owned schema; unknown keys reject.
- Supported draft structured changes use the same normalized handler registry and atomic identity commit.
- Structured person-level fields follow R3 and policy §8.2/§8.6 exactly.
- Presentation fields cannot be smuggled through structured inputs.
- Minted originals remain untouched; the existing fork boundary remains authoritative.
- Preserve protected amendments/mark language.
- Ordinary Canvas and Wardrobe reference/generation operations never mutate a cast.

### 9. Creation intake

Validate the final normalized intent before model save, generation record, deduction or image call on every creation, recast, fork and variation entry point.

- Validate `userPrompt`, `features`, structured fields and all assembled prompt fragments—not merely the raw text box.
- Presentation/styling and cosmetic-lash creation language refuses with routing.
- Validated natural eyelash anatomy may persist only in the initial brief.
- Creation-time reference images are schema-rejected everywhere and cleared from fork/recast/variation state.
- Fork-from-refusal text must pass the same validation.
- Reorder any deduct-before-parse path so refusal is free.

### 10. Mint, add-views, refresh, restore and package integrity

Implement the policy's separate integrity checks and state-specific copy:

- Mint checks identity-anchor validity, displayed-headshot validity and selected-tier view validity separately.
- Same-revision display headshot over an older anchor can pass; mint/add-views still consume the authoritative anchor.
- Stale, failed, missing, cross-revision and unknown-authority cases refuse with precise resolution copy.
- Selected tier views must belong to the current revision; pinned does not waive staleness.
- Add-views and refresh consume the shared anchor selector and stamp outputs with the current revision.
- Pinned stale views surface an unpin-and-refresh route.
- Restore is free and owner-scoped but only within the current identity revision (or exact ratified legacy fingerprint match). Restored `frontClose` is display-only; cross-revision/uncertain restore refuses with §7.4 copy.
- Update the Batch A-safe earlier-version UI offer so it appears only when revision-compatible.
- Preserve FR-2A export refusal/no implicit mint and FR-3B rename behavior.

### 11. Credits, failures and atomicity

Prove every refusal class has zero net charge and no generation record/image call/document write.

- Failed slot generation refunds exactly once with durable evidence.
- Retry deducts normally and refunds only on repeat failure.
- Mint-transition retry without new generation is free of generation charges.
- Failure during the atomic identity commit leaves no partial identity/revision/role/stale state and follows the refund policy.

Do not weaken `withAtomicCredits` or existing Batch 0 authority controls.

### 12. Copy and decisions

- Update F5 and all relevant UI copy so the product never advertises refused edits or automatic propagation.
- Presentation refusals gracefully explain Canvas/Wardrobe routing.
- Mark refusals explain that persistent mark editing is not supported during R6.
- Classifier outages/uncertainty explain that the edit was not charged and can be retried.
- Record D-56 in `docs/specs/DECISION_LOG.md`, including the ratified interim policy, superseded clauses, masked-tool status, naming wording and actual implementation truth.

Do not claim Batch D/R7 functionality exists.

## Schema and migration safety

The live schema currently has no explicit identity revision/asset-role system. If Batch C requires schema changes:

1. Design the smallest additive, forward-only schema that implements the ratified contract.
2. Preserve existing rows and define conservative legacy defaults/fingerprint resolution. Do not silently promote newest images to authority.
3. Add repository schema and migration source/artifacts plus pure migration-shape tests.
4. Do not apply the migration to any database.
5. Do not run `pnpm db:push`.
6. Do not use the hosted dev database as a disposable test database.
7. If correctness requires observing or mutating real rows, stop and report the exact separately authorized migration/audit step.

## Required verification — policy M1 through M22

Treat policy §16 as an acceptance matrix, not suggestions. Add tests for **every M1–M22 row** and every marked required implementation. Use table-driven coverage and shared fixtures rather than thousands of duplicated assertions.

Required test layers:

1. Type-level and registry completeness tests.
2. Deterministic classifier/parser/normalizer units, including the §6.2 corpus and malformed/outage states.
3. Shared authorization units across statuses, source views, text/reference modalities, leaves and mixed requests.
4. Router-harness tests proving refusal ordering, zero charge, no rows/writes/calls and foreign-owner/archive behavior.
5. Writer/door agreement tests for every §13 entry.
6. Anchor/revision/role/fingerprint/mint/restore matrix.
7. Atomic failure and credit/refund matrix.
8. Prompt-rule and protected-language tests across generation, refresh, iterate and compaction.
9. Client component/source guards for copy, routing, masked tools and revision-compatible restore offers.
10. Canvas/Wardrobe two-sided isolation tests.
11. Creation-intake tests across every creation/recast/fork/variation path.

Add narrowly scoped permanent literal/source guards proving:

- no client can submit authorization/provenance fields;
- no second identity guard/classifier appears at another door;
- no automatic reconcile caller survives;
- no image-only branch writes identity documents or stale flags;
- no stale writer exempts pinned assets;
- no raw newest-headshot selector bypasses the shared anchor selector;
- masked UI cannot arm and the server mask refusal remains first;
- refused presentation/mark suggestions are not advertised.

Avoid repository-wide textual bans that catch unrelated user, wardrobe, board or generation concepts.

## Drives

Create/update free local drive scripts for the real client/server seams where mocks alone are insufficient.

- Use router harnesses, intercepted requests, local fixtures and mocked image/model boundaries.
- Do not call Gemini or move real credits.
- Do not use production or hosted development data.
- If a browser drive would submit a paid generation, stop before submission and prove reachability/disabled state only.
- If no disposable DB is available for schema-dependent legs, run pure/router layers and report the exact deferred migration-backed drive. Never substitute production access.

## Gate order

Run and report:

1. Type-contract/registry tests.
2. Classifier/authorization/normalizer tests.
3. Anchor/revision/role and migration-shape tests.
4. Writer-by-writer M1–M22 focused suites.
5. Masked, authority, lifecycle and Batch A-coupled regressions.
6. Free local/router/component drives.
7. `pnpm check`.
8. `npx vitest run server/casting` plus every touched client/server focused suite.
9. Full `pnpm test`.
10. `git diff --check`.

`pnpm build` is reserved for R6 close-out unless a changed build-only path requires it for diagnosis. Do not contact external services. Do not hide failures with tail-only reporting.

If a gate fails, fix only within Batch C scope. After the first failed fix attempt on a substantive issue, pause and reassess the architecture rather than stacking patches. If the failure proves a founder decision or unsafe database action is required, report and stop.

## Required self-review

Before reporting completion:

1. Review the entire diff and every new file.
2. Rewalk the writer inventory and policy §13; account for every door.
3. Rewalk M1–M22 and provide evidence for every row; no “covered indirectly” without naming the actual test.
4. Trace at least one identity edit, one image-only edit, one presentation refusal, one mark refusal, one reference identity edit, one classifier outage, one creation refusal, one mint, one refresh and one restore end-to-end.
5. Verify ordering before generation records/credits/model calls/writes.
6. Verify the shared anchor selector is the sole authority source and displayed images cannot self-promote.
7. Verify pinned assets stale correctly and revision compatibility is enforced.
8. Verify no Batch D/R7 feature, masked editing, paid generation, database application, production contact, staging, commit, push or deployment occurred.
9. Challenge the implementation and ratified plan explicitly: list any disagreement with concrete evidence, risk and proposed resolution.
10. Re-run affected gates after review corrections.

## Final handoff

Report clearly:

1. Whether Batch C is genuinely complete; if not, exact remaining items.
2. Exact files changed/added/deleted and why.
3. Shared authorization architecture and closed types.
4. Classification/refusal ordering and zero-charge proof.
5. Identity patch, anchor, role, revision and fingerprint design.
6. Behavior of identity, presentation and image-only operations.
7. Reference-assisted and creation-intake behavior.
8. Mark prompting/protection behavior.
9. Mint/add-views/refresh/restore/package integrity behavior.
10. Schema/migration artifacts created and confirmation none were applied.
11. D-56 and UI-copy reconciliation.
12. M1–M22 evidence table naming exact tests.
13. Exact gate results, totals, skips, mocked/deferred drive legs and any known flaky rerun.
14. Full `git status --short`, diff statistics and the exact intended Batch C file set.
15. Any concern or disagreement for founder/Codex review.

Confirm explicitly:

- Batch D/R7 and R6 close-out were not started.
- Masked editing was not re-enabled.
- No true identity rollback, persistent reference plate, composer/canon, generative erase, outfit propagation or per-category mark persistence was added.
- No migration was applied and no hosted database was contacted.
- No production service, URL, database or Railway configuration was contacted.
- No real Gemini/paid generation ran.
- Nothing was staged or committed.
- Nothing was pushed or deployed.

Then stop for founder/Codex review.
