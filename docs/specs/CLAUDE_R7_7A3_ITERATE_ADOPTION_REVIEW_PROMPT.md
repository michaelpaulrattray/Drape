# Fable review prompt — R7-7A3 typed-iteration snapshot adoption

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


Read-only review only. Do not edit, stage, commit, push, deploy, migrate, enable flags, contact production, or run paid generations.

## Baseline and bounded scope

- Repository: `C:\Users\Admin\Drape`
- Expected HEAD: `077abbc` (`R7-7A3: adopt slot restore snapshot writes`)
- Review the complete staged diff.
- Expected staged files, exactly nine:
  1. `server/routes/generation/castingRefinement.ts`
  2. `server/casting/snapshotTransitions.ts`
  3. `server/casting/aiService.ts`
  4. `server/casting/typedIterationDoors.test.ts`
  5. `server/casting/iterationFraming.test.ts`
  6. `server/batchC-failureInjection.test.ts`
  7. `server/batchC-sourceGuards.test.ts`
  8. `server/batchC-doors.test.ts`
  9. `server/r7-snapshot-transitions-db.test.ts`
- Protected/local files must remain unstaged: `.agents/`, `.codex/`, `.claude/settings.local.json`, `CLAUDE.local.md`, brand files, this prompt and every `docs/specs/CLAUDE_*` file.

## Product intent

Adopt the existing paid `generation.iterate` door into the R7 immutable snapshot system as one bounded slice. Both branches move together because they share one paid operation:

- image-only/cosmetic edits append a new display asset plus a package snapshot while leaving identity documents and the identity snapshot unchanged;
- typed identity edits append the updated legacy documents/revision/new anchor and the paired `identity_edit` identity snapshot + `identity_change` package snapshot atomically, with every carried sibling stale, pinned included.

There is no read cutover, schema change, migration, client change, evidence/candidate UI, composer, Wardrobe change, or automatic spending in this slice.

## Required review challenges

Verify all of the following against reachable production code, not only test claims.

1. **One paid door, both branches adopted.** `generation.iterate` no longer directly calls `createModelAsset` or `commitIdentityEdit`. Every successful image-only or identity result crosses the private atomic snapshot transition boundary. There is no third success path that can update R6 truth without updating snapshots.

2. **Existing free authority boundary is preserved.** Ownership, archived exclusion, mask refusal, canonical view framing, typed classifier/normalizer, permanent-mark refusal, vague-hair clarification, minted identity refusal, and other R6 policy decisions still finish before snapshot bootstrap, generation-row creation, receipt running state, credits, or Gemini. Adding snapshot adoption must not make any prior free refusal paid.

3. **Bootstrap and receipt ordering.** After a request is authorized and while the operation owns `model:<id>`, the route converges the R6 ledger through `bootstrapModelSnapshot`, refuses a headless model for free, creates the generation row, then calls `markGenerationOperationRunning`. The receipt therefore captures the exact bootstrapped head before credits/provider work. Bootstrap failure honestly seals the claimed operation and releases its lock through existing failure machinery.

4. **Server-owned transition authority.** Both new commit helpers accept no expected state/package/identity/revision fields from the client or route. `commitModelSnapshotTransition` independently locks the owned/live model, exact running `casting.iterate` receipt, and exact operation-owned model lock; expectations come only from the receipt.

5. **Image-only atomic truth.** `commitImageRefineSnapshot` must:
   - re-read an owned same-model, canonical, filled target in the transaction;
   - insert exactly one legacy asset with its real view, URL, exact storage key, cost, engine/categories and current-revision `display` identity stamp;
   - append one `image_refine` package snapshot selecting that asset as `current/generated` and carrying all other slots;
   - leave master prompt, technical schema, preferences, identity revision, identity anchor and identity snapshot unchanged;
   - work for both drafts and minted Casts, while a minted result continues to reference the exact sealed identity snapshot and never changes the seal pointers.

6. **Typed identity atomic truth.** `commitIteratedIdentitySnapshot` must:
   - require a draft and `frontClose` target;
   - compute changes solely from the server-authorized typed patch through the existing `computeIdentityCommit` handlers;
   - atomically update master prompt, technical schema, preferences and a fresh legacy identity revision;
   - insert the generated candidate as the new `anchor`, preserving exact storage key/cost/engine and typed edit provenance;
   - stale every other newest filled sibling in legacy assets, pinned included;
   - append an `identity_edit` identity snapshot paired with an `identity_change` package snapshot;
   - select the new head as `current/generated` and carry every sibling as `stale/carried`;
   - return the exact committed documents and stale ids used by the existing client response.

7. **No anchor/display regression.** Image-only `frontClose` edits remain display-only and never replace the identity anchor. Identity edits create a new anchor and select it as the displayed head. Existing selector and restore semantics remain intact.

8. **Target and concurrency law.** Challenge whether the transaction-owned target lookup plus the continuously held operation lock is sufficient against target deletion/replacement, stale head, cross-model asset, old version, or a concurrent restore/edit. Any stale receipt/head/revision must refuse before the callback writes. No cross-model or noncanonical target can be persisted.

9. **Credits and refund truth.** The original one-charge boundary remains unchanged. A provider failure uses `withAtomicCredits` refund behavior. A later atomic transition failure rolls all database writes back, deletes the exact uploaded candidate object when a key exists, records exactly one derived-reference refund, and returns honest refund wording. A failed refund must remain honestly reported. A post-commit generation-audit-row failure must not refund or report a durable result as failed.

10. **Exact storage ownership.** Ordinary image-only `iterateModel` now returns the exact key from `uploadRawCandidate` rather than discarding it. The asset owns that key on success; a commit failure uses that same key for cleanup without parsing a public URL. Identity-gated upload continues to do the same. Confirm no public API or unrelated generation path is accidentally widened.

11. **Replay/crash safety.** Existing durable replay still returns the stored result without a second generation, charge, asset, identity snapshot or package snapshot. Challenge the crash window after the atomic transition but before receipt finalization: it must remain owned by the existing running/recovery machinery, while `createdByOperationId` prevents a duplicate snapshot transition if the same operation ever re-enters.

12. **Snapshot closure and lifecycle.** The transition wrapper still enforces unique/canonical/fill-valid selections, paired identity/package reasons, document/revision immutability for package-only changes, revision advancement for identity changes, minted identity sealing, CAS state advancement and one current package head. No new way to mutate seal authority or lifecycle exists.

13. **Tests are honest.** The route unit suites mock the new transaction seam only to preserve prior authority/refund/failure assertions; they must not be presented as proof of the real database transition. The disposable MySQL tests must exercise the actual production helpers and prove:
   - image-only asset/package selection and unchanged identity;
   - typed identity document/revision/anchor/stale/paired-snapshot writes;
   - post-mint image-only package advancement against the sealed identity;
   - the pre-existing rollback, stale-head, stale-revision, kind and selection laws.

14. **Scope and privacy.** No schema/migration/client/read-cutover/Wardrobe/evidence/composer/billing-rate change. No client-controlled provenance or expectation fields. No storage key, URL, prompt, credential or raw provider error newly enters public operation results or production logs.

15. **Regression guards.** Confirm the source-authority guard bans direct legacy writers in the iterate route, the exact-key AI-service test drives the production `iterateModel` upload path, and the route-order tests genuinely pin bootstrap → generation row → running receipt → provider → atomic transition plus headless refusal before all paid work.

## Verification evidence to reproduce where safe

Recorded on the staged state:

- `pnpm check` — clean.
- Focused local suites — 203/203 passed:
  - `server/casting/typedIterationDoors.test.ts`
  - `server/casting/iterationFraming.test.ts`
  - `server/batchC-failureInjection.test.ts`
  - `server/batchC-sourceGuards.test.ts`
  - `server/batch0-authority.test.ts`
  - `server/batchC-doors.test.ts`
  - `server/r7-snapshot-selection-contract.test.ts`
- Guarded disposable Railway development MySQL drive — 27/27 passed; exact prefixed scratch database dropped in `finally`.
- Full unit suite — 2,513 passed / 136 environment-gated skipped / 0 failed.
- `pnpm build` — passed.
- `git diff --cached --check` — clean after staging.

Do not rerun the disposable database driver during this read-only review unless the founder separately authorizes remote dev-DB writes. Reading the test is sufficient for review; the executor's run is recorded above.

## Required verdict

Return exactly one of:

- `APPROVE — safe to commit R7-7A3 typed-iteration adoption locally`
- `REQUEST CHANGES` with each concrete, reachable blocker, exact code evidence, product impact and the smallest sound correction.

Separate genuine blockers from non-blocking later-R7 cautions. Approval is local-commit scoped only and does not authorize push, deploy, migration, backfill, read cutover, feature enablement or further writer adoption.
