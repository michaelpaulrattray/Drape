# Fable Review — R7-7B7 Snapshot Pin-Retirement Copy Correction

You are the independent, read-only reviewer for the small corrective slice
found during the founder-only production browser verification.

Review the staged diff completely and return the required verdict. Do not edit,
stage, commit, push, deploy, contact Railway, query a database, change scope,
control a browser, run convergence, or perform any product action.

## Required verdict

Return exactly one:

- `APPROVE — safe to commit the R7-7B7 stale-view copy correction locally`
- `REQUEST CHANGES` with a concrete reachable blocker and the smallest sound
  correction

Approval covers only a local commit of the exactly staged two files. It does
not authorize push/deploy, Railway variables, browser verification, pin
planning/apply, cohort expansion, `all`, or later R7 work.

## Production discovery

Production is running commit `8bc1b29` with
`R7_SNAPSHOT_READ_SCOPE=users:1`.

The Fable-approved passive browser pass loaded:

- authenticated lobby;
- Models library;
- audited founder model id 4 in Casting Studio;
- snapshot-selected package and Profile presentation;
- the read-only Versions & details / Package Health dialog.

No mutation or paid action was performed.

The dialog displayed this for five ordinary stale snapshot-selected views:

> `{View} is out of sync with the current identity — refresh it (unpin first if pinned) before minting.`

This violated the B6 product contract because Cast-slot pins are retired for a
snapshot-enabled account and the client correctly hides Pin/Unpin controls.
The browser pass stopped immediately before Export, Wardrobe, or Canvas.

## Root cause

`PackageHealthDialog.tsx` correctly derives
`pinningAvailable = packageQuery.data?.pinningAvailable !== false` and hides
its local pinned copy and Unpin button when false.

However, the dialog renders `blocker.message` from the mint-plan integrity
projection before its local stale copy. The shared ordinary-stale refusal
`REFUSAL_COPY.mintTierViewStale` still contained the parenthetical
`(unpin first if pinned)`.

The mint law already has a separate pinned-stale branch:

- ordinary stale:
  `reason: "stale"` → `REFUSAL_COPY.mintTierViewStale`;
- pinned stale:
  `reason: "pinned_stale"` → `REFUSAL_COPY.pinnedStale`.

Therefore the ordinary stale message mentioning pins was redundant and became
misleading after snapshot pin retirement.

## Exact staged change

Exactly two files should be staged:

1. `server/casting/identity/refusalCopy.ts`
   - change only `mintTierViewStale` from:
     `refresh it (unpin first if pinned) before minting`
     to:
     `refresh it before minting`.
2. `server/casting/identity/mintIntegrity.test.ts`
   - add one assertion that the ordinary stale failure message does not
     contain `unpin`.

The existing pinned-stale assertion remains:

`expect(pinnedFailure.message).toContain("unpin")`

so R6 pinned-stale guidance is preserved.

## Required challenges

1. Confirm staged scope is exactly the two named files and the intentional
   unstaged `server/routes/emailVerification.ts` and
   `docs/specs/DECISION_LOG.md` changes remain untouched.
2. Verify the changed function is the exact source of the production text
   observed in Package Health.
3. Verify ordinary stale and pinned stale are distinct branches in
   `computeMintIntegrityForSelection`.
4. Verify removing the parenthetical from ordinary stale is correct in both
   snapshot and R6 modes.
5. Verify an R6 pinned stale row still uses `REFUSAL_COPY.pinnedStale` and keeps
   explicit unpin guidance.
6. Verify unknown-authority rows that reuse `mintTierViewStale` remain
   fail-closed and get more truthful guidance, not weaker authority.
7. Verify no eligibility, pricing, credit, provider, storage, selection,
   snapshot, lifecycle, or mutation behavior changes.
8. Verify no client, schema, migration, route, Railway, or pin writer changes.
9. Verify the regression assertion would fail against the baseline copy.
10. Search for other reachable ordinary-stale copy sites and confirm none
    require the removed parenthetical.
11. Verify the production browser pass should be restarted from the beginning
    only after this correction is separately pushed/deployed and scope remains
    founder-only.

## Local evidence

- `pnpm check` — clean.
- Focused suites:
  - `server/casting/identity/mintIntegrity.test.ts`
  - `server/r7-strip-first-package-care.test.ts`
  - `server/r7-snapshot-selection-contract.test.ts`
  - 33 passed / 0 failed.
- `git diff --check` for the two files — clean.

## Required report

1. Verdict.
2. Staged-scope confirmation.
3. Root-cause and behavior proof.
4. Regression-test proof.
5. Any blocker and smallest correction.
6. Non-blocking observations.
7. Exact scope of approval and next unauthorized operation.
