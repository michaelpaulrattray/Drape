# Claude prompt — R6 Batch B overnight implementation

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


The founder authorizes one bounded unattended implementation batch: **R6 Batch B only**.

Implement Batch B from `docs/specs/CASTING_SYSTEM_R6_EXECUTION_PLAN.md`, add/update its tests and local verification drive, run all required local gates, self-review the completed diff, write a full handoff, and stop.

Do **not** start Batch A-coupled or Batch C if you finish early.

This is an implementation task, not another broad planning exercise. Read the binding documents, perform a short evidence-based preflight, then code.

## Primary references

Read completely before editing:

- `CLAUDE.md`
- `docs/specs/CASTING_SYSTEM_R6_EXECUTION_PLAN.md`
- `docs/specs/CASTING_SYSTEM_AUDIT_ADDENDUM_REVISED.md`
- `docs/specs/IDENTITY_EDIT_INTERIM_POLICY.md`
- The relevant D-43/FR-4/status entries in `docs/specs/DECISION_LOG.md`

The identity policy is founder-ratified but its Batch C behavior is not implemented. Batch B must not implement or partially implement it.

If the top-level model is Fable/Claude Fable 5, follow `CLAUDE.md`: perform the architecture/risk review directly as self-review and do not invoke a routine advisor.

## Start-state gate

Before editing:

1. Inspect `git log --oneline -6`.
2. Confirm the ratified FR-1 documentation commit exists above `7e97cf6`.
3. Inspect `git status --short`.
4. The tracked worktree must be clean. Local-only untracked files such as `.agents/`, `.codex/`, `.claude/settings.local.json`, `CLAUDE.local.md`, and `docs/specs/CLAUDE_*_PROMPT.md` may remain, but never edit, delete, stage, or commit them.
5. If tracked changes from the documentation session remain, stop and report the start-state problem. Do not mix them into Batch B.

## Authorization and hard boundaries

Authorized:

- Read the repository and binding documents.
- Edit only code, tests, and a narrowly necessary local drive script for Batch B.
- Run local typechecking, unit tests, focused tests, and a free local/dev status-agreement drive.
- Use Claude's Edit tool for source-file changes instead of shell write commands such as `sed -i`, heredoc appends, or `cat >`.

Not authorized:

- Batch A-coupled work.
- Batch C identity-policy implementation.
- Masked editing, iteration-policy, mint-policy, identity-document, credit, or generation-prompt redesign.
- Database schema changes or migrations.
- Status writes, status backfills, or normalization of legacy rows.
- Production database access or the production row-audit script.
- Gemini/image/video generation or paid-credit verification.
- Auth/account status changes.
- Staging or committing.
- Pushing, deploying, changing Railway variables, or contacting production.

No `git add`, `git commit`, `git push`, deployment command, migration command, or production URL/database command.

## Exact Batch B objective

Create one shared, exhaustive **model lifecycle read-model** contract and make every in-scope consumer agree with it.

The model lifecycle status domain is exactly:

```ts
type ModelLifecycleStatus = "draft" | "active" | "locked" | "archived";
```

Semantics:

- `draft` = editable, unminted.
- `active` = minted.
- `locked` = legacy minted alias.
- `archived` = deleted/unavailable—not draft, unminted, or an editable fallback.

Prefer an exhaustive switch with an `assertNever`-style failure so a future status cannot silently inherit behavior.

Use domain-specific names such as:

- `ModelLifecycleStatus`
- `isModelMintedStatus`
- `isModelDraftStatus`
- `isModelArchivedStatus`

Do not create dangerously generic helpers such as `isLocked` or `isActive`.

## Critical domain boundary

This batch concerns **model/cast lifecycle status only**.

Do not alter or reinterpret:

- User/account `locked` status.
- `users.lockedUntil`.
- Admin or moderator user-status filters.
- Board status.
- Garment or wardrobe status.
- Job/generation status.
- Parser/form fields named `locked`.
- Any unrelated domain that happens to use `active`, `locked`, or `archived`.

The literal guard and source sweep must be scoped tightly enough that legitimate unrelated status code remains untouched.

## `agencyId` rule

`agencyId` is detail and integrity data. It is never the read-model discriminator for whether a model is minted.

Required behavior:

- A `draft` carrying a stray `agencyId` still reads as a draft in UI/session/gate state.
- `active` and legacy `locked` read as minted by status.
- `archived` reads unavailable even if it still carries an `agencyId`.
- Operations that genuinely require an agency ID—such as registry/export integrity—retain their separate fail-closed checks.
- Do not weaken Batch 0's inconsistent-row protections.

No status writes or migrations: do not convert `locked` rows to `active`, remove stray IDs, backfill anything, or run the production audit.

## Required implementation sweep

The named locations are minimum evidence, not the complete sweep.

### Shared predicates

Add the shared model-lifecycle read contract in the appropriate shared module. Keep it usable by both client and server without importing server-only code.

### Studio store gallery load

Remove `client/src/features/studio/stores/useStudioStore.ts`'s hardcoded gallery `isMinted: true`.

The gallery may normally return minted rows, but its consumer must still use authoritative status/server-derived model lifecycle truth rather than a permanent assumption.

Carry or consume the authoritative status through the existing shape with the smallest truthful change.

### Cast gate

Remove `client/src/features/studio/hooks/useCastGate.ts` action/`stayDraft`-based inference of minted state.

The post-action gate state must come from authoritative server result/status, not what action the client requested.

### Session and draft restoration

Correct at least:

- `client/src/features/studio/hooks/useResumeDraft.ts`
- `client/src/features/studio/hooks/useSessionPersistence.ts`

Current `status === "active"` logic misreads legacy `locked`. Both active and locked must restore as minted; archived must be unavailable.

### Remaining read derivations

Audit the relevant model package, session, board, environment, gallery, and gate code for ad-hoc model lifecycle derivations such as:

- `status === "active"`
- `status !== "active"`
- `status === "locked"`
- `!!agencyId`
- `!isDraft`
- Requested-action or `stayDraft` inference
- Gallery-source assumptions

Replace only read-model derivations that belong to this Batch B domain.

Do not rewrite authoritative server transition guards merely to remove a literal. Mutation rules and operation-specific integrity checks may legitimately inspect status directly.

### Board metadata caution

Do not casually rewrite persisted `provenance.draft` snapshots or expand the board schema.

Reconcile board state through existing server truth at established load/mint boundaries. Preserve Batch 0's archived-source degradation and “Source unavailable” behavior.

## Permanent literal guard

Add a scoped source-level test that prevents new ad-hoc model read-state derivations in the relevant read/UI modules.

The guard should catch in its intended scope:

- `status === "active"` as the complete minted test.
- `!!agencyId` or agency-ID presence as minted-state inference.
- `!isDraft` as a minted shortcut where archived/inconsistent states exist.
- Action/`stayDraft`-based mint inference.
- Reintroduction of the gallery `isMinted: true` assumption.

Use an explicit narrow allowlist for legitimate authoritative mutation and integrity checks.

Do not create a repository-wide textual ban that flags user-account, board, billing, job, or other correct status code.

## Required tests

### Shared predicate units

Cover all four model statuses:

| Status | Draft | Minted | Available |
|---|---:|---:|---:|
| `draft` | yes | no | yes |
| `active` | no | yes | yes |
| `locked` | no | yes | yes |
| `archived` | no | no | no |

Prove unknown/unrecognized status fails conservatively rather than silently becoming draft or minted.

### Agency-ID mismatch cases

Prove:

- Draft + stray `agencyId` reads draft, not minted.
- Active without `agencyId` reads minted for read-state purposes but still fails any operation whose separate integrity contract requires the ID.
- Locked without/with ID follows the same legacy-minted read state and separate integrity checks.
- Archived remains unavailable regardless of ID.

### Cross-surface agreement

Prove package, gallery, session restore, resume, board/environment load, and gate state agree for all four statuses.

At minimum:

- Gallery loading no longer hardcodes minted state.
- Resume/session treat legacy `locked` as minted.
- Gate state comes from returned server/status truth rather than requested action.
- Archived never degrades to draft/editable.
- Batch 0 archived-source board behavior remains intact.

### Drive

Add or update a free local/dev status-agreement drive covering the relevant client/server seam.

Requirements:

- No Gemini call.
- No paid credit movement.
- No production database or production URL.
- Fixtures are local/dev-only and cleaned up where applicable.
- All four statuses and mismatch cases are exercised where the real boundary permits.

If a live drive cannot safely run in the available local environment, do not replace it with production access. Run the pure/router portions, document the exact local blocker, and stop honestly.

## Verification gates

Run, in this order:

1. Shared predicate unit tests.
2. Scoped literal-guard test.
3. Focused tests for every affected store/hook/server result.
4. Free local status-agreement drive, when safely available.
5. `pnpm check`.
6. The affected casting/studio/board suites.
7. Full `pnpm test`.

Do not hide failures with `tail`-only reporting. Preserve full output in the task record and summarize the actual totals and skipped suites honestly.

If a gate fails:

- Diagnose within Batch B scope.
- Do not widen into A-coupled, Batch C, billing, auth, migrations, or production.
- If the failure proves a genuine plan contradiction or founder decision is required, complete any independent safe work, report the blocker precisely, and stop.

## Required self-review before stopping

After tests are green:

1. Review the complete Batch B diff.
2. Re-run the scoped status search and literal guard.
3. Confirm only model lifecycle read-state behavior changed.
4. Confirm no status writer, transition guard, database schema, credit path, identity policy behavior, auth/account status, or production configuration changed.
5. Confirm `agencyId` remains an operation-specific integrity field rather than a read-state discriminator.
6. Confirm archived-source degradation and Batch 0 authority tests still pass.
7. Re-run any affected focused gate after review corrections.

If Batch B finishes early, do this self-review again, prepare the handoff, and stop. Do not begin another batch.

## Final handoff

Report:

1. Exact files changed and why.
2. The shared model lifecycle contract.
3. Every removed ad-hoc derivation.
4. How gallery, session, resume, board/package, and gate now agree.
5. How `agencyId` mismatch cases behave.
6. Literal-guard scope and allowlist.
7. Tests and drive results with exact totals/skips.
8. Any remaining Batch B concern or unrun gate.
9. Full `git status --short` and diff summary.
10. Whether you believe Batch B is complete, with reasoning and any disagreement with the plan.

Confirm explicitly:

- Batch A-coupled was not started.
- Batch C was not started.
- No production code outside Batch B scope was intentionally changed.
- No database schema/data migration or backfill occurred.
- No production database or production URL was contacted.
- No Gemini/paid generation ran.
- Nothing was staged or committed.
- Nothing was pushed or deployed.

Stop for founder/Codex review.
