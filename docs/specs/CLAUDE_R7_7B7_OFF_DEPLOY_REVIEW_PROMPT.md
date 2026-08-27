# Fable Review Prompt — R7-7B7 Scope-Off Production Deployment

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


You are the independent, read-only reviewer for the first operational step of
R7-7B7.

The implementation was intentionally split into small, separately reviewed
R7-7B1 through R7-7B6 commits. This review is different: challenge the complete
cumulative deployment candidate as one system and decide whether it is safe to
deploy to production while snapshot reads remain disabled.

Do not edit, stage, commit, push, deploy, contact Railway, query a database,
change an environment variable, run a browser drive, or run a disposable
database. Local read-only inspection and local typecheck/unit/build commands are
allowed.

## Required verdict

Return exactly one of:

- `APPROVE — safe to deploy R7-7B1–B6 runtime code with R7_SNAPSHOT_READ_SCOPE=off`
- `REQUEST CHANGES` with a concrete reachable blocker

Keep non-blocking observations separate. An approval is deployment-readiness
evidence only. It does not itself authorize a push, deployment, Railway
variable change, production parity audit, founder-scope enablement, pin plan or
apply, cohort expansion, `all`, or any later R7 work.

## Repository facts to verify independently

- Production baseline: `c35f677`
- Candidate HEAD: `c2f8135`
- Production branch: `local-migration`
- Candidate range: `c35f677..c2f8135`
- The range contains 16 commits, 78 files, approximately 9,568 insertions and
  301 deletions.
- There is no B-series schema migration.
- Migration `0010_r7_snapshot_selection.sql` is already present in production.
- `R7_SNAPSHOT_READ_SCOPE` is absent locally and missing/empty parses as `off`.
- The intentional email sender/reply-to edit in
  `server/routes/emailVerification.ts` is unstaged and outside the candidate.
- The founder Asset Library note in `docs/specs/DECISION_LOG.md` is unstaged and
  outside the candidate.
- Private/local files, brand documents, plans, and review prompts remain
  unstaged.

Verify the range and staging facts yourself. Do not rely only on this summary.

## Ratified rollout law

Read in full:

- `docs/specs/CASTING_SYSTEM_R7_7B_SNAPSHOT_READER_CUTOVER_PLAN.md`
- especially §3, §4, §6 B1–B7, §7, §8, and §9.

The first B7 operation is only:

1. ensure the production scope is unambiguously `off`;
2. deploy the complete B1–B6 runtime candidate;
3. observe successful build/startup and ordinary R6 health;
4. stop.

The production parity audit, founder enablement, pin plan/apply, and browser
verification are later, separately reviewed and separately authorized
operations.

## Local evidence already recorded

Against exact HEAD `c2f8135`:

- `pnpm check` — clean.
- `pnpm test` — 2,700 passed / 171 environment-gated skipped / 0 failed.
- `pnpm build` — passed.
- Focused B6 disposable Railway-development gate — 3 passed / 15 filtered
  skips / 0 failed.
- The B6 scratch database was confirmed dropped by the driver.
- No Vitest, pnpm, or tsx processes remained afterward.

Earlier B1–B6 slices each received an independent Fable approval before local
commit. Treat those as supporting evidence, not a substitute for this
cumulative review.

## Required cumulative challenges

### A. Exact deployment content and boot safety

1. Verify `c35f677..c2f8135` is exactly the intended B1–B6 stack and that no
   email, decision-log, private, prompt, brand, or unrelated work enters it.
2. Confirm no new migration is required and the candidate is compatible with
   the already-deployed schema through `0010`.
3. Trace production startup through `server/_core/index.ts` and
   `server/_core/env.ts`. Missing, empty, and exact `off` must all boot in R6
   mode; malformed values must fail startup rather than partially enable.
4. Decide whether deployment should require an explicit Railway value `off`
   before the push, or whether an absent variable is equally fail-closed.
   Explain the safest ordering. Do not change the value yourself.
5. Confirm no module performs snapshot convergence, pin convergence, credit
   movement, generation, storage work, or database writes merely from import or
   startup.
6. Inspect deploy-skew risks: old client/new server, new client/old server, an
   in-flight operation during replacement, and two instances briefly serving
   different builds. Scope off must keep all authority in R6 throughout.

### B. Scope-off server behavior

7. Enumerate every runtime caller of `captureSnapshotReadMode` and prove that
   every `r6`/default branch preserves its pre-B behavior.
8. Check that no server route accidentally defaults to snapshot mode when
   `readMode` is omitted, undefined, or threaded through an internal caller.
9. Verify that snapshot resolvers, snapshot projections, and immutable
   identity-document authority are unreachable from ordinary production
   requests while scope is off.
10. Verify paid operations retain the original R6 ordering for bootstrap,
    validation, receipt, charge, provider, storage, transition, refund, and
    cleanup.
11. Check the cumulative receipt-head assertions added during B2/B3. In R6 mode
    they must be compatible with the existing bootstrap/operation-lock law and
    must not introduce a reachable charge, replay, or recovery regression.
12. Challenge strict Zod schema additions. Confirm every current client caller
    sends only the accepted legacy fields and no real request is rejected after
    deployment merely because the server code is new.
13. Confirm registry/public routes scope by the correct server-owned user
    identity and cannot accidentally enable a foreign or unauthenticated
    request.
14. Confirm Wardrobe R6 mode still accepts its legacy request/session contract,
    including sessions that predate B5, and does not require a snapshot-only
    `sessionId` while off.
15. Confirm Cast-slot pin writes and R6 pin semantics still work while off.
    The B6 refusal must be unreachable, and no code in the deployment clears
    pins automatically.
16. Confirm Canvas board-item pins are unrelated and untouched.

### C. Scope-off client behavior

17. Trace the new `pinningAvailable` capability defaults. When the R6 response
    omits it, Pin/Unpin controls and old pinned behavior must remain available.
18. Check `selectedAssets` hydration. When the R6 `models.get` response omits
    the field, every client surface must retain the legacy newest-ledger
    behavior; an omitted field must not be confused with explicit `[]`.
19. Check cross-tab cache invalidation. It may run while scope is off, but it
    must be invalidation-only, bounded, non-authoritative, loop-safe, and unable
    to trigger a write, generation, or spend.
20. Verify new-client/old-server compatibility for optional response fields and
    old-client/new-server compatibility for the stricter request schemas.
21. Confirm no B4/B5 client change silently changes image-angle preference,
    current asset selection, Wardrobe model authority, or Canvas placement
    semantics while scope is off.

### D. Data, billing, storage, and lifecycle non-regression

22. Confirm all B-series production writes remain the already-reviewed dual
    writes and operation-bound transitions; deploying scope off must not start
    any new background writer.
23. Confirm the private convergence CLIs have no route, worker, scheduler,
    startup, or package-script reachability.
24. Confirm account deletion and final Cast deletion still close over all
    snapshot rows and that the new readers introduce no persistent references
    outside the existing deletion law.
25. Confirm no new public DTO leaks snapshot ids, state versions, storage keys,
    provenance, identity hashes, receipt expectations, raw provider errors, or
    identity documents beyond an already-authorized surface.
26. Confirm billing primitives, deterministic charge/refund references,
    refund-truth reporting, and post-commit audit-gap behavior were not weakened
    by cumulative reader wiring.
27. Confirm exact-key storage cleanup remains correct for every paid adopter and
    that no snapshot projection or PDF helper can delete or persist storage on
    startup/read.
28. Confirm failure-marker rows remain ledger evidence only and cannot become a
    selected current view in any enabled-capable projection.
29. Confirm minted seal immutability and late-view seal preservation remain
    enforced even though the scope is off initially.

### E. Operational rollback and observability

30. Identify the exact last-known R6-compatible production deployment
    (`c35f677`) and verify that Railway redeploying that build remains a valid
    code rollback.
31. Verify that setting/keeping scope `off` is sufficient data-level rollback:
    no reverse migration, snapshot deletion, pin restoration, or database
    mutation is required.
32. Check whether any B1–B6 client behavior is active independent of the scope
    and therefore survives a config-only rollback. If so, prove it is
    non-authoritative and R6-compatible or flag it.
33. Define the minimum post-deploy smoke evidence before any production audit:
    successful Railway build, terminal healthy deployment, boot with scope off,
    login/session health, ordinary package state, and no startup/config errors.
    Do not perform these checks.
34. Identify closed-code logs or metrics that should be watched after the
    deployment. Confirm no prompt, schema, preference, name, URL, storage key,
    database credential, or raw SQL value is expected in them.
35. Challenge the ambiguous-COMMIT and future recovery-redrive cautions carried
    by the B3 writers. Determine whether scope-off deployment makes either
    reachable or worse. If not, keep them explicitly non-blocking for the later
    recovery workstream.

## Specific judgment requests

Give a direct recommendation on:

1. absent variable versus explicitly setting
   `R7_SNAPSHOT_READ_SCOPE=off` before deploy;
2. whether one deployment of all 16 commits is safer than splitting the already
   interdependent B1–B6 stack at this stage;
3. whether any live-off behavior change requires founder acceptance before the
   deploy;
4. whether the existing rollback point and smoke plan are adequate;
5. the exact next separately authorized operation if the verdict is APPROVE.

## Required final report shape

1. Verdict.
2. Cumulative behavior summary in plain product language.
3. Evidence for challenges A–E, with file/line references for any load-bearing
   claim.
4. Any blocking finding and the smallest sound correction.
5. Non-blocking operational cautions.
6. Exact deployment scope the approval covers and everything it does not cover.

Do not approve based only on green tests or prior slice verdicts. The question
is whether the complete B1–B6 candidate is safe to put into production with
snapshot reads definitively off.
