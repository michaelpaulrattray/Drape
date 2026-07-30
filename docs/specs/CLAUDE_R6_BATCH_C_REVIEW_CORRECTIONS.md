# R6 Batch C — Codex review corrections

Continue in the **current terminal** with the existing uncommitted Batch C working tree. Do not restart Batch C and do not discard any existing work.

## Stop conditions and scope

Batch C is **not approved for staging or commit yet**. Fix and verify only the findings below, then stop for founder/Codex review.

Do not stage, commit, push, deploy, apply the migration, contact production, spend image credits, or run paid live generation. Preserve `.agents/`, `.codex/`, `.claude/settings.local.json`, `CLAUDE.local.md`, and all existing local prompt/handoff files as untracked local-only material.

Use Claude's Edit tool for source changes, not `sed -i`, `cat >>`, or other shell write commands. You may run ordinary read-only searches and the existing local test/typecheck commands.

Challenge any finding you genuinely disagree with. Cite the exact code and explain the invariant in plain English before taking a different approach. If a correction requires a new founder product ruling or expands into Batch D/R7 architecture, stop and ask; do not silently invent policy.

## Founder rulings for the three handoff questions

1. **Approve identity-only updates.** Brand, vibe, brief, and notes remain creation/fork context, not mutable identity fields on an existing cast. However, the UI must not invite an unsupported change and only explain the refusal after the takeover closes. Make the relevant controls honest for the active edit mode: disable/hide them or clearly label them as requiring a fork/re-cast before the user attempts Save. Do not mislabel brand/vibe as a physical identity change.
2. **Approve aborting the mint transition when a required slot fails.** Successful views remain on the draft; the failed slot is honestly refunded; retrying an already-filled package adds no new generation charge.
3. **Approve fail-closed handling for unverifiable legacy provenance.** Never guess identity lineage. The refusal must explain which view needs refresh/replacement and how the user can proceed.

## Finding 1 — P0: `withAtomicCredits` can silently suppress its own refund

`server/casting/atomicCredits.ts` deducts using the supplied `referenceId`, then calls `addCredits` with the same ID after an operation failure. `server/db/credits.ts` treats any existing `(userId, referenceId)` transaction as a duplicate; the deduction already created that row. The refund is therefore skipped while the user remains charged.

Correct the contract so charge and refund use distinct, deterministic IDs—for example a charge ID plus a derived `refund:<charge-id>`—and repeated attempts to record the same refund remain idempotent. Do not use `Date.now()` for a refund that may be retried. Check the returned result from `addCredits`; never claim or persist “refunded” unless it actually succeeded. A refund-recording failure must be logged and surfaced/recoverable without losing the original operation error.

Add a regression proving:

- operation failure after a successful deduction uses a refund ID different from the charge ID;
- the balance is restored once;
- retrying the same refund does not add credits twice;
- a failed refund result is not reported as a successful refund.

The existing tests that mock `deductCredits` and `addCredits` independently do not prove this interaction.

## Finding 2 — P0: result-style database failures are being treated as successful writes

`createModelAsset`, `createGeneration`, and `updateGeneration` return result objects; they generally do not throw. Batch C often ignores `success` and continues.

Audit and correct every Batch C-touched paid path, including at minimum:

- `server/routes/generation/castingRefinement.ts`;
- `server/routes/generation/castingImaging.ts`;
- `server/casting/mintPackage.ts` and refresh callers;
- `server/lib/boardOps.ts` initial Canvas cast, `generateCastCandidate`, fork, structured update, and variations.

Required invariants:

- A failed `createGeneration` is detected. Do not dereference an undefined generation ID or charge while pretending an audit row exists.
- A failed `createModelAsset` is detected. No route may return success, `assetId:null`, or continue a mint transition when the required durable asset was not written.
- A failed `updateGeneration` is detected and logged as an audit gap. Because an audit-row update is not itself the paid image/identity result, do not automatically refund a successfully committed durable result merely because the audit status failed. Record/recover the audit gap honestly.
- Every returned `success:false` from a required database write is handled explicitly.

The mint/refresh slot path needs a direct regression: mock `createModelAsset` as `{ success:false }`; the slot must not be `{ ok:true }`, the model must not mint, and refund/marker copy must reflect what actually happened.

## Finding 3 — P0/P1: define the paid durable-effect boundary and prevent “free success” or charged failure

Several flows perform an irreversible durable write and then run later writes inside a catch that refunds everything:

- structured draft update commits the new identity, then board/version writes can fail and trigger a refund/error;
- fork creates a durable candidate, then node/edge writes can fail and trigger a refund/error;
- initial Canvas cast creates model/asset, then board/version writes can fail and trigger a refund/error;
- candidate/variation paths can leave durable model/image state while reporting a refunded failure.

This permits a successful identity/model/image to survive while the request says it failed and credits are returned; a retry can duplicate work or create another revision.

Restructure each affected path around an explicit invariant:

1. Before the durable paid result commits, failure means no usable paid result survives and the deterministic refund is recorded once.
2. After the durable paid result commits, later audit/UI synchronization failure must not refund that successful result or return a normally retryable “generation failed” response that can duplicate it.
3. Required same-database writes that define one user-visible result should commit together where practical. If a safe atomic grouping is not possible, use an explicit recoverable/pending state and report it honestly; do not guess.
4. Do not hold a database transaction open across the external image-generation call.

Add failure-injection tests at the boundaries: generation success + asset failure; identity commit success + board write failure; candidate success + node/edge failure; audit completion failure after durable success. Assert both durable state and credit outcome, not only mock call counts.

## Finding 4 — P1: structured edits can smuggle forbidden content

`server/casting/identity/structuredEdit.ts` only scans string values for eyelash terms. Descriptor fields and override prose can currently carry marks, presentation, relational-reference wording, or below-shoulder hair instructions—for example:

- `jawline: "scarred jawline with a tattoo"`;
- `skinFinish: "dewy makeup with highlighter"`;
- `eyeShape: "like the attached reference, with sunglasses"`;
- `hairLength: "waist-length"`.

Close this server-side before deduction. Prefer exact shared closed option schemas for fields that are closed in the UI. For legitimately open override/descriptor channels, apply the shared deterministic mark, presentation, eyelash, whole-identity/reference-relational, and field-specific validation before building an authorized patch. The structured editor must not become a second, weaker authorization boundary.

**SUPERSEDED BY THE FOUNDER'S FOLLOW-UP RULING:** long and very-long hair are allowed durable identity edits. Follow `CLAUDE_R6_BATCH_C_FINAL_REVIEW_CORRECTIONS.md`: persist the concrete length in the typed identity document, create the new anchor/revision, stale every sibling view, and ensure refresh/new-view generation consumes it. Remove the earlier below-shoulder refusal rather than mapping UI labels to it.

Add raw-router tests proving forbidden content cannot ride any permitted structured key and that refusal occurs before deduction/generation/document writes.

## Finding 5 — P1: creation intake does not validate the complete normalized intent it claims to validate

`server/casting/identity/creationIntake.ts` scans only seven free-text channels, while `models.create` and Canvas creation accept many open `z.string()`/arbitrary attribute fields. The comment saying structured fields are closed enums “by construction” is false at the server wire boundary.

Make creation validation match policy M22:

- use shared closed schemas/options for genuinely structured fields;
- validate every remaining open prose/override channel after parsing/merging and before model save or charge;
- reject presentation/cosmetic/reference-relational content in the wrong structured channel rather than silently persisting it;
- preserve the ratified creation-only natural-eyelash and initial-mark rules in their intended validated channel—do not accidentally ban legitimate initial identity traits globally;
- apply the same normalized validation to direct `models.create`, Canvas `runGeneration`, fork/recast, variations, and every shared creation helper.

Add raw tests with forbidden text inside fields such as `jawline`, `skinFinish`, `hairLength`, and arbitrary Canvas attributes. Prove refusal precedes `createModel`, deduction, and image calls.

## Finding 6 — P1: classifier prompt and strict parser contradict each other

The classifier prompt says an identity + non-identity request should use `kind:"identity"` and list every category. The parser then rejects any non-identity category under `kind:"identity"` as `unknown`. That is fail-safe, but it is not the ratified most-restrictive-wins contract and gives the wrong refusal/routing behavior.

Make the response contract and parser agree. A mixed response must retain every recognized category and apply deterministic precedence/most-restrictive behavior. Cover at least:

- allowed identity + image-only;
- identity + presentation;
- refused mark/structured/unmapped identity + image-only;
- presentation + image-only;
- unknown category in a mixed response.

Also make “strict JSON” real: reject unexpected top-level keys in classifier and normalizer responses, not only unexpected keys inside normalizer entries. Do not add any channel by which the LLM can choose persistence destinations.

## Finding 7 — honest client refusal behavior

The minted-edit dialog closes the takeover before the fork mutation completes. Unsupported `features`/structured content can therefore be refused only afterward as a toast, leaving the user dumped out of the editor. Keep the takeover open until the mutation succeeds, or restore it with the user's changes intact on a free refusal. Show the server's plain-English routing message in context. Do not convert the refusal into a fallback generation.

## Required verification and report

After corrections:

1. Run `pnpm check`.
2. Run focused identity/Batch C/credit/mint/board tests, including all new failure-injection regressions.
3. Run the casting suite and full unit suite.
4. Run `git diff --check` and inspect the complete Batch C diff.
5. Rewalk M1–M22. Correct the handoff and D-56 claims so they describe tested truth, not mocked call-count assumptions.
6. Do not run migration-backed drives or paid image generations.

Report:

- verdict on each finding, including any challenged item and evidence;
- exact files changed;
- tests and counts;
- remaining migration/drive work;
- any founder ruling genuinely required;
- confirmation that nothing was staged, committed, pushed, deployed, or migrated.

Then stop for review.
