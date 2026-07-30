# Fable Review Prompt — R7-7B1 Effective Reader Foundation

Perform a read-only review of the staged R7-7B1 foundation diff.

Baseline: `c35f677`

Read first:

- `docs/specs/CASTING_SYSTEM_R7_7B_SNAPSHOT_READER_CUTOVER_PLAN.md`
- `docs/specs/CASTING_SYSTEM_R7_6_EVIDENCE_COMPOSER_DESIGN.md`
- `docs/specs/CASTING_SYSTEM_R7_7A_EXECUTION_PLAN.md`
- `docs/specs/CASTING_SYSTEM_R7_7A_SNAPSHOT_SELECTION_INVENTORY.md`
- `server/casting/snapshotShadow.ts`
- `server/casting/snapshotBootstrap.ts`
- `server/casting/snapshotTransitions.ts`
- `server/casting/identity/anchorSelector.ts`
- `server/db/connection.ts`
- the staged files in full.

Product boundary:

- This slice adds only the strict server rollout-scope parser and a private,
  read-only, snapshot-only effective Cast-state resolver.
- The resolver must remain unreachable from routes, clients, workers and paid
  execution.
- `R7_SNAPSHOT_READ_SCOPE` remains unset/off. R6 is still the only live reader.
- No snapshot read cutover, pin retirement, convergence, database migration,
  Railway variable, push or deploy is authorized.

Verify all of the following against the code:

1. Missing/empty/`off` scope resolves to R6; exact `all` and
   `users:<ids>` are the only enabling forms.
2. Whitespace, empty members, zero/negative/fractional/unsafe ids, leading
   zeroes, duplicates, and unknown modes fail closed. Malformed startup
   configuration stops `validateEnv`.
3. One call captures one `r6` or `snapshot` mode; no client input, snapshot id,
   model id, state version or selection claim influences scope.
4. The effective resolver has no production caller. Its only database entry
   point is owner-scoped, alive-only, archived-excluding and snapshot-only.
5. There is no R6 fallback, bootstrap or convergence inside the resolver. A
   pointerless Cast with an anchor refuses as `snapshot_head_missing`; only a
   genuinely anchorless Cast returns `headless`.
6. Pointer/stateVersion agreement is fail-closed.
7. Current package pointer, model ownership, package-to-identity closure and
   identity ownership are independently validated.
8. `identityTextHash` is recomputed and checked before identity authority is
   returned.
9. The identity anchor is same-model, filled, frontClose, non-failed and
   anchor-eligible. A selected/display headshot remains separate authority.
10. Every selection belongs to the current package, has one canonical unique
    angle, a unique selected asset, a closed compatibility value, and an
    existing same-model/same-angle filled asset.
11. Storage-URL-empty or status-failed marker rows can never become selected.
12. A selected frontClose is mandatory for a non-headless package and becomes
    the displayed headshot without becoming the identity anchor.
13. Draft versus minted seal-pair, sealed-row ownership,
    sealed-package-to-identity, and current-identity-to-sealed-identity laws
    all fail closed.
14. The resolver performs selects only: no row locks, inserts, updates,
    deletes, credits, Gemini/provider, storage, Slack or automatic work.
15. Errors contain only a closed code and static safe copy; no prompts,
    schemas, preferences, URLs, storage keys, SQL values or cross-owner
    existence leak.
16. Raw ledger rows are clearly internal/history-only and cannot become
    newest-filled selection authority; no public projection is added.
17. Existing A3 writer authority, operation receipts, deletion/account
    closure, billing, pins, failure markers and client behavior are unchanged.
18. Pure tests behaviorally exercise scope, headless/current, anchor/display,
    pointer, package/identity/hash, selection, marker and seal laws rather
    than merely source matching.
19. The real-MySQL cases call the production bootstrap and resolver, prove a
    real head, foreign refusal, pointerless-anchor refusal, cross-model
    selection refusal and zero resolver writes.
20. The dedicated disposable runner refuses production app ids and non-dev
    database URLs, refuses stale prefix databases, creates/drops only the exact
    `drape_r7_7b1_disposable_*` database, applies migrations only through 0010,
    injects no real storage/provider work, and cleans up in `finally`.
21. Exactly the eight intended files are staged. The intentional two-line
    `server/routes/emailVerification.ts` sender/reply-to edit remains unstaged
    and must not be modified, staged or discarded. All local/private/prompt
    files remain unstaged.

Challenge especially:

- whether accepting legacy no-role anchors is still required and consistent
  with the ratified bootstrap law;
- whether any current/sealed closure invariant is missing;
- whether returning internal ledger rows creates a realistic future
  accidental-serialization hazard that should be removed now;
- whether startup validation can be bypassed by another server entry point;
- whether the source guard genuinely prevents premature route adoption.

Recorded verification evidence:

- `pnpm check` — clean.
- Focused pure/contract suites — 38/38 passed.
- Guarded disposable MySQL B1 drive — 51/51 passed; scratch database dropped.
- Full unit suite — 2,579 passed / 157 environment-gated skipped / one known
  unrelated parallel-load timeout in
  `server/routes/emailVerification.test.ts`; the timed-out test passed alone
  2/2 in 1.56 seconds. Its production file is intentionally unstaged.
- `pnpm build` — passed.

Return exactly one verdict:

- `APPROVE — safe to commit R7-7B1 locally`
- `REQUEST CHANGES` with a concrete reachable blocker.

Keep non-blocking observations separate. This review can authorize only a
local commit. It cannot authorize push, deploy, Railway variables, snapshot
read enablement, pin migration, convergence, production contact, B2 adoption
or any other R7-7 work. Do not edit, stage, commit, push, deploy, run a
database, or change environment variables.
