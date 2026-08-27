# Fable review — R7-7A4 consumer-level shadow parity

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


Read-only review only. Do not edit, stage, commit, push, deploy, run migrations,
contact production, enable snapshot reads, or run the disposable database driver.

## Baseline and scope

- Baseline: `a726d32` (`R7-7A4: add bounded snapshot parity audit`)
- Expected staged files, exactly five:
  - `server/casting/snapshotConsumerShadow.ts`
  - `server/casting/snapshotShadow.ts`
  - `server/casting/snapshotShadow.test.ts`
  - `server/r7-snapshot-selection-contract.test.ts`
  - `server/r7-snapshot-transitions-db.test.ts`
- R6 remains the only live read authority.
- This slice adds no route, client, worker, scheduler, migration, writer, credit,
  storage, provider, convergence, repair, or read-cutover path.

## Product purpose

The existing A4 comparator proves structural snapshot parity. This slice adds a
second, consumer-level proof: if R6 and snapshot selection were each fed into
the real decision laws, would they produce the same package state, mint
price/refusal, refresh price/refusal, export manifest, Canvas/library selection,
and registry selection?

This is needed because structural equality alone can miss policy drift. The
founder scenario pinned here is a selected side view whose snapshot slot says
`current`, but whose R6 asset provenance is unknown. The selected asset ids and
slot compatibility may look structurally sound while the live mint authority
correctly refuses the view. The audit must report `consumer_mint_plan` before
any snapshot read cutover.

## Verify all of the following

1. **No live adoption.** `snapshotConsumerShadow.ts` is reachable only from the
   private `snapshotShadow.ts` comparator. No route, client, worker, scheduler,
   bootstrap, transition writer, or production reader calls it.

2. **Pure and read-only.** The new module performs no I/O and has no database
   insert/update/delete, row lock, credit movement, storage call, Gemini/provider
   call, logging, Slack, or mutation. Importing production pure helpers must not
   trigger side effects.

3. **Closed surface set.** It compares exactly:
   `casting_package_state`, `casting_mint_plan`, `casting_refresh_plan`,
   `casting_export`, `board_library`, and `models_registry`.
   Explain whether any live selection-dependent consumer is missing. Do not ask
   for Profile or mint-seal digests if their existing structural laws already
   fully cover them; challenge that assumption with code evidence.

4. **Actual production laws reused where possible.** R6 truth must reuse
   `deriveBootstrapState`, `computeMintIntegrity`, `tierCosts`,
   `computeRefreshPlan`, and the canonical view/tier constants rather than
   reimplementing their policy.

5. **Package-state fidelity.** Both projections must compare selected asset,
   filled/missing, pinned, stale/current, version count, failed marker, and
   ledger-truth refund amount for all six canonical angles.

6. **Failure markers survive.** An unselected failure-marker row must still
   influence package state, mint refusal, and refresh retry truth on both sides.
   Snapshot selection must never select the marker itself.

7. **Pinned semantics remain R6-compatible.** A selected pinned stale view must
   remain pinned and stale in both projections. This slice must not prematurely
   retire pins; that remains the later R7-7B cutover/migration decision.

8. **Mint-plan fidelity.** Compare all three tiers, missing-slot price, anchor
   validity, displayed-headshot validity, per-tier-view presence/validity, and
   overall allow/refuse truth. Verify the snapshot projection validates that
   every selected asset exists, belongs to the model, has the selected angle,
   and is filled.

9. **Founder provenance case is real.** The behavioral test removing the
   side-view provenance must leave structural mismatch kinds empty while
   producing only `consumer_mint_plan`. Confirm this matches the live
   `computeMintIntegrity` unknown-authority refusal and is not a test artifact.

10. **Refresh-plan fidelity.** Costs, refreshable angles, pinned/stale flags,
    and refusal codes must be derived through the real `computeRefreshPlan`.
    No automatic refresh, retry, or spending exists.

11. **Export fidelity.** The digest must cover the selected six-view manifest
    plus the identity documents and authoritative anchor id that export
    consumes, without exposing raw prompts, schema, preferences, URLs, or keys.

12. **Canvas/library and registry fidelity.** Canvas/library compares the
    displayed front-close selection. Registry compares the identity plus full
    selected manifest. Challenge whether this matches their current live reads.

13. **Safe output only.** Public audit reports may contain only booleans, nulls,
    closed mismatch/surface enums, ids/counts already permitted by the A4
    contract, and SHA-256 hashes. Raw identity content, URLs, storage keys,
    names, failure messages, or credentials must never be returned or logged.

14. **Determinism.** Hashing uses `stableCanonicalJson`; manifests sort by
    canonical angle; row/property order cannot create false mismatches.

15. **Headless and corrupt states fail honestly.** Headless R6/snapshot truth
    should compare null-to-null. Invalid snapshot selections or missing identity
    closure must create consumer mismatches, never throw private content or
    fabricate parity.

16. **Mismatch integration.** Six new closed mismatch kinds must feed the
    existing canonical mismatch ordering, affected-surface mapping, cohort
    summary zero-fill, JSON output, attention exit, and overall `parity`.

17. **No authority expansion through imports.** Challenge the use of the pure
    `buildIdentityAnchor` exported from `geminiClient.ts`, and pure helpers
    exported from `mintPackage.ts`/`refreshSlots.ts`. Confirm import-time module
    evaluation cannot call Gemini, storage, credits, or mutate the database.

18. **Caller guards remain strong.** The A3 transition-writer allowlist must be
    unchanged. The A4 shadow caller allowlist must permit only the consumer
    adapter and bounded audit. The pure-adapter source guard must reject real
    provider/storage/credit/write authority without false-positive matching
    crypto hash `.update()`.

19. **DB fixture correction is legitimate.** The side-view fixture gains a
    `genesis` revision stamp so the previously “clean” fixture is genuinely
    mint-authorized under R6. Confirm updated expected mismatch lists reflect
    real consumer effects and do not weaken structural assertions.

20. **Scope hygiene.** Exactly the five expected files are staged. No schema,
    migration, route, client, writer, billing, storage, Wardrobe, evidence
    composer, deletion, flag, protected/local, or unrelated file is staged.

## Verification evidence

- `pnpm check` — clean.
- Standalone audit typecheck:
  `pnpm exec tsc -p scripts/tsconfig.snapshot-audit.json` — clean.
- Focused pure suites — 21/21 passed.
- Full unit suite, run sequentially — 2,542 passed / 151 environment-gated
  skipped / 0 failed.
- `pnpm build` — passed.
- `git diff --check` — clean.
- The guarded disposable Railway-development MySQL gate passed 43/43 earlier
  after the consumer adapter and DB expectation changes. A later exact-state
  rerun was stopped by the host command timeout rather than a test failure;
  its scratch database cleanup was independently checked and zero guarded
  scratch databases remain. The only later implementation correction was pure
  failure-marker projection logic plus its pure unit test. Do not treat this
  paragraph as stronger evidence than it is.
- No test runner or newly spawned Node process remains.

## Required verdict

Return exactly one:

- `APPROVE — safe to commit R7-7A4 consumer parity locally`
- `REQUEST CHANGES` with concrete reachable blockers, product impact, code
  evidence, and the smallest sound correction.

List non-blocking observations separately. Approval is local-commit scoped
only; it does not authorize audit execution against production, convergence,
backfill, snapshot read cutover, push, deploy, migration, flag enablement, or
later R7-7 work.
