# R6 Batch C — final Codex review corrections

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


Continue in the **current terminal** from the existing uncommitted Batch C worktree. This is a bounded final correction pass; do not restart or redesign Batch C.

Do not stage, commit, push, deploy, apply migrations, contact production, or run paid image generation. Preserve all local-only files. Use Claude's Edit tool for source edits. Challenge any finding you disagree with using exact code evidence and plain-English reasoning.

## Founder ruling — long hair is a durable identity trait

The founder **amends/reverses R1b's R6 refusal**. `Long` and `Very Long` hair are allowed post-creation identity edits, alongside `Very Short`, `Short`, and `Medium`.

Required behavior:

- long-hair changes are identity edits, never image-only cosmetic edits;
- they remain draft-only and follow the same authoritative identity-edit door as other allowed hair traits;
- structured, text, and supported reference-assisted instructions must normalize to a concrete durable hair-length value;
- commit the value to the real hair-length preference and master identity description through the typed field handler (and the schema mirror only if one genuinely exists—never invent a path);
- the successful edit creates the new anchor/revision and marks every filled sibling view stale, pinned included;
- existing sibling images do not change magically: the UI must explain that they need refresh/regeneration, and every refreshed/new view must consume the updated long-hair master identity so the character sheet converges across all views;
- `Long Layers` remains a valid hairstyle, and may coexist with `Long`/`Very Long` hair;
- reference images provide evidence for the requested hair trait but never bypass the ordinary identity/status/view/classifier rules.

Update `IDENTITY_EDIT_INTERIM_POLICY.md`, D-56/decision records, availability tables, refusal copy, handlers, tests, and handoff claims so no stale “below-shoulder refuses during R6” rule remains. This ruling does not authorize outfit propagation, marks, presentation edits, or Batch D composer work.

## 1. Refund truth must reach the user, not stop at the server log

The new code checks failed refund writes, but several server errors and client surfaces still say “you were refunded” or “you weren't charged” unconditionally.

Examples include:

- `castingImaging.ts` errors after `refundOnce`;
- `castingRefinement.ts` asset-save failure copy;
- `boardOps.ts` Canvas/candidate failure copy and variation logging;
- `useCastGate.ts`, `ViewTabs.tsx`, and `CastNode.tsx` when a failed slot has `refunded: 0`;
- `BoardPage.tsx` variation failures, which currently carry no refund outcome but always say the candidate was free.

Make the refund helper/path return the actual outcome and propagate it into typed server results/errors. Copy must branch:

- refund landed: say the exact credits refunded / not charged;
- refund failed: say the generation failed **and the automatic refund could not be recorded**, with a recoverable reference for reconciliation; never claim the user is uncharged.

Variation failure results must include actual refund status/amount/reference. Client toasts and failed-slot surfaces must render that truth. Add tests for both successful and failed refunds at server and client-copy/helper level.

## 2. Validate the LLM normalizer's output with the policy boundary

The original user sentence is checked, but `parseNormalizerResponse` currently checks normalized values only for shape, length, option-pair validity, and relational wording. The LLM itself could introduce forbidden durable content, such as:

- `sharp jaw with a scar`;
- `dewy makeup-contoured skin`;
- a hair length different from the one actually requested, or hair presentation/accessories not requested;
- an accessory or other presentation term not present in the original request.

Before any normalized value becomes an `AuthorizedIdentityPatch`, run every returned descriptor/override through the same deterministic mark, presentation, eyelash, whole-identity/reference-relational, and field-specific policy validation. For `person.hair.length`, require a concrete durable result consistent with the requested length; long and very-long results are now valid under the founder ruling. Fail closed and free if the normalizer invents a different length or introduces forbidden content.

Add adversarial normalizer tests proving a benign request cannot persist hallucinated marks, presentation, reference wording, cosmetic lashes, or an unrequested hair length. Add positive structured, text, and supported reference-assisted tests proving `Long`, `Very Long`, `mid-back`, and `waist-length` requests become durable identity values, update the master identity, stale all sibling views (pinned included), and are consumed by later refresh/view generation with the temporary reference absent.

## 3. Close non-string creation-container smuggling

`validateCreationIntent` scans direct strings, but Canvas `attributes` still accepts `z.unknown()` values. Arrays and nested objects can therefore carry forbidden text or malformed preference types without being scanned—for example `jawline: ["sharp", "red dress"]`. Malformed `ethnicityBlend` container types can also bypass the current conditional check.

At the server wire boundary, use an explicit allowed creation-attribute schema/types where practical. Reject unknown container shapes and wrong types before save or charge. If a legitimate nested field is allowed (`castingVibe`, `ethnicityBlend`), validate its exact shape and allowed values; do not recursively accept arbitrary objects. Preserve the intentional creation-only mark and natural-eyelash rules in their proper text channels.

Add raw `runGeneration`/helper tests for arrays, nested objects, malformed blend/vibe values, and unknown keys. Prove refusal precedes deduction, model save, and image generation.

## 4. Make post-generation board records atomic or explicitly recoverable

Board item, version-history, and lineage-edge writes are domain records, not optional logging. Current best-effort blocks can partially write the first record and fail the second while returning success or only logging:

- node stamp succeeds, version insert fails;
- fork/variation node and initial version succeed, lineage edge fails;
- identity board update succeeds, version row fails.

Group the required same-database board writes for each landing into a transaction where possible (no external image call inside it). If a transaction genuinely cannot be used, persist an explicit recoverable/pending synchronization state; a server log alone is not recovery.

Failure-injection tests must fail the **second** write as well as the first and prove no half-versioned or unlinked board state survives.

## 5. A charged partial success must not re-enable the paid action

When a fork candidate is successfully created and charged but board placement fails, the server correctly says the draft exists in the library. The client currently handles every rejection like a free refusal: it keeps the dialog open and re-enables `Fork as new model`. Clicking again creates and charges another fork.

Represent post-boundary placement failure as a typed partial-success outcome (recommended) or another explicit non-repeatable state—not the same rejection shape as a free policy refusal. Close/resolve the paid fork action, show where the created draft can be found, and prevent accidental repeat charging. Preserve the dialog only for genuine pre-charge/free refusals.

Cover this in client behavior tests.

## 6. Check failed-slot marker persistence result

`createModelAsset` returns `{ success:false }`; it does not normally reject. The `.catch(...)` around the failed-slot marker write in `mintPackage.ts` therefore misses ordinary marker failure while comments and UI claim the failure is durable.

Check the returned result explicitly. If the marker cannot be saved, log/report a recoverable persistence gap and do not claim the Retry marker will survive reopening. Add the missing marker-failure regression.

## 7. Charge/reference uniqueness and honest R7 deferral

The new refund reference derivation is correct only when the charge reference is genuinely unique. `Date.now()` alone can collide for parallel requests; `withAtomicCredits`' no-reference fallback and several callers still rely on timestamp-only IDs. Use a collision-resistant per-operation ID (for example `crypto.randomUUID()`, or an already-persisted unique generation ID) for Batch C-touched/shared-helper charge paths. Add a test with a frozen clock and parallel invocations proving distinct charge/refund pairs.

Separately, the ledger's `addCredits` duplicate check is still read-before-write without a database uniqueness constraint, so two truly concurrent refund writers can race. The ratified policy explicitly defers the broader concurrency/idempotency redesign to R7. Do **not** add an unreviewed production constraint/migration in this correction pass. Instead:

- remove any claim that the current ledger is concurrency-safe;
- record the exact concurrent-refund race as an R7 pre-launch financial-hardening item;
- describe current behavior precisely as sequential retry idempotency only.

## Verification and stop

Run typecheck, focused Batch C/identity/credit/mint/board/client-helper tests, the full unit suite, and `git diff --check`. Rewalk the correction findings and update the handoff/D-56 wording to tested truth.

Report exact changes, test counts, the R7 concurrent-ledger item, migration/drive work still deferred, and confirmation that nothing was staged, committed, pushed, deployed, migrated, or run as paid generation. Then stop for founder/Codex review.
