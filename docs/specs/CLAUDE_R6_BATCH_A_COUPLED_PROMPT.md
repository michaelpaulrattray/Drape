# Claude prompt — R6 Batch A-coupled implementation

The founder authorizes one bounded implementation batch: **R6 Batch A-coupled only**.

Implement the V1 + V14 typed-iteration repair from `docs/specs/CASTING_SYSTEM_R6_EXECUTION_PLAN.md`, add/update its tests and free local verification, self-review the complete diff, report the result, and stop.

Do **not** start Batch C, R6 close-out, R7, or any other cleanup if you finish early. Leave the work unstaged and uncommitted for founder/Codex review.

This is an implementation task, not another broad planning exercise. If the evidence contradicts this prompt or the binding plan, explain the disagreement and stop before widening scope.

## Read before editing

Read completely:

- `CLAUDE.md`
- `docs/specs/CASTING_SYSTEM_R6_EXECUTION_PLAN.md`
- `docs/specs/CASTING_SYSTEM_AUDIT_ADDENDUM_REVISED.md`
- `docs/specs/IDENTITY_EDIT_INTERIM_POLICY.md`
- Relevant V1, V14, F3, F4 and D-43/D-55 entries in `docs/specs/DECISION_LOG.md`

The FR-1 policy is founder-ratified, but its shared enforcement is **not implemented until Batch C**. Ratification permits this local A-coupled batch; it does not authorize partial Batch C implementation or a release.

If the top-level model is Fable/Claude Fable 5, perform the architecture/risk review directly as self-review. Do not invoke a routine advisor merely because an advisor protocol exists.

## Start-state gate

Before editing:

1. Inspect `git log --oneline -8` and confirm HEAD is `f61a9ab` (`R6 Batch B: unify model lifecycle read state`).
2. Inspect `git status --short` and the current diff.
3. The tracked worktree must be clean.
4. Known local-only untracked items may exist: `.agents/`, `.codex/`, `.claude/settings.local.json`, `CLAUDE.local.md`, and `docs/specs/CLAUDE_*` prompt/handoff files. Do not edit, delete, stage, or commit unrelated local-only files.
5. Confirm nothing has been pushed or deployed. Local `main` being ahead of `origin/main` is expected.
6. If tracked changes already exist, HEAD differs, or the baseline is ambiguous, stop and report it. Do not mix work.

## Authorization and hard boundaries

Authorized:

- Inspect all typed-iteration UI, router, prompt-building, angle mapping, and relevant tests.
- Make the smallest code/test changes needed to complete V1 + V14 together.
- Run local typechecks, tests, and free local drives that do not call Gemini or move credits.
- Use Claude's Edit tool for source changes rather than `sed -i`, heredoc appends, or other shell write commands.

Not authorized:

- Batch C or any partial implementation of the ratified identity-policy architecture.
- Shared identity guard, normalized identity patches, identity revisions, anchor/display roles, persistent reference plates, composer/canon propagation, structured marks, reconcile redesign, or stale-package redesign.
- Re-enabling masks, eraser, surgical tools, or any `maskBase64` generation path.
- Creation-time reference images or broader reference-transfer work.
- Database schema changes, migrations, backfills, production audit, production access, auth/account changes, billing/credit redesign, or paid generation.
- Staging, committing, pushing, deploying, or changing Railway configuration.

Do not run `git add`, `git commit`, `git push`, migration commands, production URL/database commands, or Gemini/image-generation verification.

## Exact objective: V1 + V14 must move atomically

The earlier stabilization deliberately restored the per-view typed-iteration allowlist because lifting it alone would expose V14's incorrect framing. This batch removes that restriction **only while fixing and proving framing for all six canonical views**.

Canonical behavior:

| Canonical view | User-facing meaning | Required framing |
|---|---|---|
| `frontClose` | Head | close portrait |
| `sideClose` | Side | close portrait/profile |
| `threeQuarter` | 3/4 | close portrait/three-quarter |
| `frontFull` | Full | full body |
| `sideFull` | Walk | full body |
| `backFull` | Back | full body |

Required implementation:

1. Find every client and server allowlist/gate that limits ordinary **typed iteration** to a subset of views. Remove the obsolete angle restriction so typed iteration is reachable on all six canonical view types.
   - Trace and remove the full `isIterationAllowed` residue from `useCastingGeneration` through `ImageViewerPanel` and `RefinePanel`, including obsolete disabled/refusal copy such as “cannot be edited directly.” Treat these as known starting points, then verify there is no second surface.
2. Preserve every non-angle gate: ownership, archived exclusion, model-status/identity safety, rate/quota ordering, and any existing authority checks must not be weakened.
3. Fix the actual generation prompt/framing path so the close trio always maps to the existing `HEADSHOT` frame and the body trio always maps to `FULL_BODY`. Do not fix only display labels or UI copy. Prefer one typed, exhaustive server mapping built from `CanonicalViewAngle`/`CANONICAL_VIEW_ANGLES`, so a future canonical angle cannot silently inherit a default.
4. Use the shared canonical view types/constants. Do not reintroduce era-0 names such as `side` or `walk` into wire/storage contracts.
5. Keep masked editing closed at both layers. A request carrying `maskBase64` must still refuse before generation records, deductions, or image calls, and masked UI tools must remain absent/disabled.
6. Keep the product truth explicit: typed iteration in this batch is still an **individual selected-image generation**. It is not composer/canon-backed and does not automatically make sibling views consistent. Current propagation limits remain unchanged.
7. Keep user copy honest where this surface exposes the limitation. Do not promise that a hairstyle, outfit, mark, or other visible change will automatically propagate across the character sheet.
8. Do not opportunistically implement newly ratified identity-edit capabilities. Until Batch C lands the shared guard and complete test matrix, existing safety refusals and registry-disabled capabilities remain in force.
9. Preserve the current classifier behavior, identity-document writes, stale-sibling behavior, reference-image behavior, credit/cost behavior, model lifecycle, ordinary view-generation prompts, and asset selection. Do not call `composeIdentityPayload` or introduce anchor references through this path.

If removing the angle allowlist cannot be separated safely from Batch C enforcement, do not invent a workaround. Explain the concrete code evidence and stop for founder/Codex review.

## Required tests

Add focused tests that prove, at minimum:

1. All six canonical angles can reach ordinary typed iteration; no three-view or close-view allowlist remains.
2. A table-driven framing test covers every canonical angle and asserts exactly:
   - `frontClose`, `sideClose`, `threeQuarter` → close portrait framing;
   - `frontFull`, `sideFull`, `backFull` → full-body framing.
3. The tested value reaches the real image-generation prompt/request construction, not only a standalone helper with no integration proof.
4. Unknown/non-canonical angle input fails safely through the existing typed schema or an exhaustive mapping; it must not silently default to the wrong framing.
5. `maskBase64` remains refused before money or image generation.
6. Masked/eraser/surgical controls remain unavailable in the UI.
7. Existing Batch 0 authority, archived exclusion, and Batch B lifecycle behavior remain green.
8. No test claims composer/canon propagation or sibling synchronization exists.

Use a narrowly scoped source/literal regression guard if useful to prevent the obsolete per-view allowlist or a three-angle framing map from returning. Avoid a brittle repository-wide ban.

## Verification gates

Run and report honestly:

1. New six-angle framing and typed-iteration focused tests.
2. Existing masked-edit and Batch 0 authority regressions.
3. Affected casting/client tests.
4. Mocked router/component/harness verification of the six typed-iteration doors and the frame passed to `iterateModel`. Do **not** run a live six-iteration drive: that would invoke paid generation. A browser/UI reachability check may stop before submission only if it is genuinely free and adds evidence not already covered by component tests.
5. `pnpm check`.
6. `npx vitest run server/casting` plus every additionally affected focused suite.
7. Full `pnpm test`.
8. `git diff --check`.

Do not hide failures with tail-only output. Record exact totals and skipped suites. Diagnose only within this batch's scope.

## Required self-review before stopping

After gates are green:

1. Review the full diff, not only the files you expected to touch.
2. Re-search for typed-iteration angle allowlists and hard-coded three/five-view framing maps in the affected path.
3. Trace each canonical angle from UI input through router validation to the actual generation prompt.
4. Confirm the angle restriction and framing correction landed together.
5. Confirm masked editing remains closed before money movement.
6. Confirm no Batch C identity-policy implementation, composer/canon work, schema/migration, credit change, production contact, push, or deploy occurred.
7. Challenge the plan explicitly if you disagree: identify the exact evidence, risk, and safer alternative. Do not silently reinterpret the scope.

## Final handoff

Report:

1. Whether Batch A-coupled is complete and why.
2. Exact files changed and the purpose of each.
3. Where the obsolete typed-iteration allowlist lived and how it was removed.
4. The final six-angle framing mapping and proof it reaches the real generation prompt.
5. All non-angle safety gates preserved.
6. Masked-edit regression proof.
7. Test/drive commands and exact results, including skips or unrun gates.
8. Any remaining concern, disagreement, or evidence that belongs in Batch C.
9. `git status --short` and a diff summary.

Confirm explicitly:

- Batch C was not started.
- R6 close-out/R7 was not started.
- No composer/canon or propagation architecture was added.
- No masked tool was re-enabled.
- No database/schema/migration/backfill occurred.
- No production service, URL, or database was contacted.
- No Gemini/paid generation ran.
- Nothing was staged or committed.
- Nothing was pushed or deployed.

Then stop for founder/Codex review.
