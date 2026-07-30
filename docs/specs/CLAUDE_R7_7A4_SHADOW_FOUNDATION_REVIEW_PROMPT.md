# Fable review — R7-7A4 private shadow-comparator foundation

Read-only review. Do not edit, stage, commit, push, deploy, run migrations, run backfill/convergence, contact production, enable snapshot reads, or run paid generations.

## Baseline and bounded scope

- Baseline HEAD: `7f7382d`
- Review the full staged diff and the surrounding R6/snapshot code it relies on.
- This is a bounded R7-7A4 foundation slice, not the full A4 reader-inventory rollout.
- Expected staged files (exactly four):
  - `server/casting/snapshotShadow.ts`
  - `server/casting/snapshotShadow.test.ts`
  - `server/r7-snapshot-selection-contract.test.ts`
  - `server/r7-snapshot-transitions-db.test.ts`

Protected/local files (`.agents/`, `.codex/`, `.claude/settings.local.json`, `CLAUDE.local.md`, brand files, this prompt, and other `CLAUDE_*` prompts) must remain unstaged.

## Product claim

This slice creates the private, read-only comparison primitive required before any snapshot read can become authoritative. It compares the current R6 model/asset truth with the current R7 identity/package/slot head and emits only ids, counts, booleans, closed mismatch enums, and SHA-256 hashes. It never returns or logs identity text, prompts, schemas, preferences, names, public URLs, or storage keys.

R6 remains authoritative. Nothing calls this comparator from a public route, user request, background loop, or production reader in this slice. It performs no convergence/backfill and changes no user-visible behavior.

Later bounded A4 slices still own the named consumer comparisons for mint/refresh plans, export, boards/library, registry/model DTOs, and the eventual cohort report. Do not reject this foundation merely because those deliberately separate consumers are not wired here; do reject any claim or code that accidentally enables snapshot reads now.

## Challenge these contracts

1. Snapshot authority remains bounded. `snapshotShadow.ts` is the only newly allowed production file containing snapshot table/head tokens, and no other allowlist is broadened.
2. The module is private and has no route/client/background-job caller. Search all runtime code for imports/calls.
3. `compareModelSnapshotShadow` is owner-scoped and excludes archived/tombstoned models with the same non-leaking `NOT_FOUND` result.
4. The database reader is genuinely read-only: no insert/update/delete, bootstrap, convergence, lock claim, credit, storage, provider, audit, or operation-receipt mutation occurs.
5. All rows are read through one transaction so one report cannot mix different committed model/package states. It deliberately takes no mutation lock because it is an observational shadow read.
6. R6 truth is derived through the existing `deriveBootstrapState` law: newest-filled current slot truth, failure-marker exclusion, authoritative anchor selection, displayed frontClose separation, and stale/current compatibility remain identical to bootstrap.
7. Pointer/head state is classified honestly: genuine no-anchor/no-pointer models are headless, pointer/state-version disagreement is a mismatch, legacy truth without a head is `snapshot_head_missing`, and a snapshot pointer without valid legacy anchor truth is `snapshot_head_unexpected`.
8. Identity comparison covers model documents versus the current identity snapshot, the stored identity-text hash's integrity, and authoritative anchor asset parity.
9. Package comparison covers every canonical angle, missing-on-either-side slots, selected asset ids, stale/current compatibility, displayed headshot, slot counts, and deterministic selection hashes.
10. Snapshot closure fails closed: duplicate angle/asset selection, cross-model/missing assets, wrong view angle, empty storage URL, or a non-empty package without frontClose produces `snapshot_selection_invalid`/the bounded mismatch set rather than parity.
11. Seal comparison distinguishes the current package from the original sealed mint package. A valid minted Cast may advance to a later package while current and sealed packages still reference the same sealed identity snapshot.
12. Minted rows require a paired seal; drafts may not carry seals; missing seal rows, current-vs-sealed identity mismatch, and sealed-package-vs-sealed-identity mismatch are named separately.
13. The returned object contains only the documented safe shapes. Challenge indirect leaks through hash inputs, exception messages, logger calls, object spreading, database row returns, or test-only assumptions.
14. Hashes are deterministic canonical hashes. Package ordering cannot create a false mismatch; raw JSON insertion order should not affect identity-document comparison.
15. `parity: true` is reachable only with zero mismatch kinds. Mismatch ordering is deterministic from the closed vocabulary, not database row order.
16. `headState` is not falsely advertised as a complete parity result. Challenge whether `"current"` on a structurally valid but drifted head is an honest structural classification alongside `parity: false`; request a rename/correction if the API is materially misleading.
17. The pure tests exercise true parity, headless truth, document/display/slot/compatibility drift, invalid selections, incomplete seals, privacy, and the valid late-view-after-mint shape.
18. The real-MySQL tests call the production reader and prove: no model/snapshot/asset writes; parity on a real bootstrapped head; document and newest-slot drift; privacy-safe output; cross-model selection refusal; incomplete mint seals; and foreign-owner non-leakage.
19. The source guard genuinely prevents writes/provider/credits/storage in the private reader and does not accidentally match harmless hash operations or weaken the existing A2/A3 authority/adopter guards.
20. Scope is clean: no schema/migration, bootstrap/convergence, writer, public API, client/UI, flag, billing, storage, Wardrobe, evidence/composer, read cutover, pin retirement, or deployment change.

Also look for important holes not named above, especially:

- a mismatch class that could make corrupt snapshot closure report parity;
- current/sealed package identity relationships that are insufficiently checked;
- different canonical JSON ordering producing false document drift;
- public or logged content leaks;
- TOCTOU claims stronger than the transaction actually provides;
- tests whose fixtures are stronger than reachable production rows.

## Verification evidence to independently challenge

- `pnpm check` — clean.
- Focused local suites — 15 passed / 25 disposable-DB cases skipped / 0 failed.
- Guarded disposable dev-Railway MySQL snapshot gate — 41/41 passed, including all 25 transition/shadow DB cases; the regex-scoped scratch database was dropped.
- Full unit suite — 2,533 passed / 150 environment-gated skipped / 0 failed.
- `pnpm build` — passed.
- `git diff --check` — clean.
- No orphan test runner remains.

## Required verdict

Return exactly one of:

- `APPROVE — safe to commit R7-7A4 shadow-comparator foundation locally`
- `REQUEST CHANGES` with each concrete reachable blocker, code evidence, product impact, and the smallest sound correction.

Approval is local-commit scoped only. It does not authorize push, deploy, migration, backfill/convergence, cohort execution, read cutover, feature enablement, or the remaining A4 consumer adapters.
