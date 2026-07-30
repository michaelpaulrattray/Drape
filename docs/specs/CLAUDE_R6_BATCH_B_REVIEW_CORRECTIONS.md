# R6 Batch B — review corrections before commit

Codex reviewed the actual Batch B diff and the repository advisor independently challenged it. **Batch B is not ready to stage or commit yet.** The shared lifecycle contract and legacy `locked` handling are broadly correct, but the following gaps must be fixed.

Work only inside Batch B. Do not stage, commit, push, deploy, contact production, run migrations, or start Batch A-coupled/Batch C. Challenge any finding you disagree with using exact code and test evidence; do not silently accept or dismiss it.

## 1. Block paid export work when the agency ID is missing

`useExportPack.ts` now derives `isMinted` correctly from status, but both export actions gate only on that value. In `downloadZip`, a status-minted model with no `agencyId` reaches the paid `generation.upscale` loop before `generatePdf` eventually refuses it. `downloadPdf` also proxies images before that refusal.

- Keep lifecycle state and export eligibility separate.
- A model may read minted while still being ineligible to export because its agency ID is missing.
- Refuse with clear “record needs repair” copy before **any** proxy, upscale, PDF, ZIP, Gemini, or credit-affecting call.
- Remove the `"DRAFT"` agency-ID fallback from minted identity-artifact filenames.
- Add behavior-level tests proving a missing-ID minted row makes zero export/upscale/proxy mutations. Do not rely only on server `generatePdf` tests.

## 2. Make public registry verification obey “archived = deleted everywhere”

`registry.lookup` hides draft and archived rows, but `registry.verify` currently returns `exists: true` for any found row and changes only `minted`. Therefore the two endpoints do not agree, and the public endpoint leaks archived/draft row existence.

- For any row that is not minted by the shared lifecycle predicate (including draft, archived, and unknown), return the public absence shape: `valid: true, exists: false, minted: false` with no minted timestamp.
- Preserve active and legacy locked as minted.
- Extend router tests to assert `exists`, not merely `minted`/`mintedAt`.
- Extend the B5 drive to prove draft-with-stray-ID and archived IDs are publicly absent through both lookup and verify.

## 3. Clear stale persisted links for unavailable models

The wardrobe-session fallback correctly keeps historical imagery when its source is archived/deleted, but merely skipping a new persistence write can leave a previous `drape_active_session` cast link in localStorage. The normal persisted-session restore also has no confirmed-NOT_FOUND cleanup path, so it can retry the dead link on every mount.

- Clear the persisted cast session when a DB wardrobe session degrades to imagery because the linked model is archived/deleted/unavailable.
- On normal startup restore, clear it when the model query is confirmed NOT_FOUND/unavailable; do not clear it for a transient network failure.
- Add tests beginning with a pre-populated stale localStorage entry.

## 4. Harden the mutating local drive

`drive-batchB-status.mts` trusts the current `DATABASE_URL`, permits a non-local `VERIFY_BASE_URL`, and creates fixtures before entering its cleanup `try/finally`. A setup failure can leak rows, and one cleanup failure can prevent the remaining cleanup/connection close.

- Hard-refuse non-loopback base URLs and production app identity/configuration.
- Require an explicit dev-only fixture-mutation opt-in consistent with the repository’s other verification tooling.
- Start cleanup protection before the first fixture insert, track created IDs incrementally, and make cleanup/connection close robust even if one cleanup step fails.
- Avoid fixed-ID collisions after an interrupted prior run.
- Keep the drive dev-only and free; do not contact production.

## 5. Close the lifecycle guard/read-surface gaps

- `NodeInfoPanel.tsx` currently displays a missing `agencyId` as `Not minted`; that is false for active/locked rows missing integrity data. Use honest copy such as `Missing` or `Unavailable` without redefining lifecycle state.
- Unknown lifecycle statuses are defined as unavailable, but `useLoadWardrobeModel`, `useResumeDraft`, and `useSessionPersistence` currently use only `isModelMintedStatus`; unknown therefore becomes `false` and can load as an editable draft. Require availability before loading/restoring.
- Expand the scoped permanent guard to cover the omitted relevant surfaces. Explicitly pin/document intentional board-provenance snapshot logic (`CastNode` and the established archived-source boundary) instead of leaving those files invisible to the guard. Do not redesign persisted board provenance in Batch B.

## Verification and handoff

After corrections:

1. Review the complete diff again.
2. Run focused lifecycle, registry, export, session/localStorage, guard, and Batch 0 authority tests.
3. Run the hardened local B drive only with explicit dev safeguards satisfied.
4. Run `pnpm check`, affected suites, and full `pnpm test`.
5. Update `CLAUDE_R6_BATCH_B_HANDOFF.md` so it no longer claims ZIP missing-ID refusal, registry agreement, or cleanup guarantees unless the corrected code and tests prove them.
6. Report exact changes and results, leave everything unstaged/uncommitted, and stop for review.

---

## Final review round — remaining blockers found after the first corrections

The first correction round fixed the client ordering, public registry behavior, session cleanup, unavailable-status loading, and board/UI guard coverage. Do not redo those working fixes. Three items remain before Batch B can be committed.

### A. Make the authoritative PDF server consume the shared export contract

`server/routes/generation/castingExport.ts` still diverges from `shared/exportEligibility.ts`:

- it uses `isModelMintedStatus(model.status) && !!model.agencyId`, so a whitespace-only ID passes even though the shared resolver rejects it;
- it still writes fallback IDs containing `DRAFT` into both `PdfModelData.agencyId` and the returned PDF filename;
- a direct server caller with a status-minted/missing-ID row receives the misleading “Name & mint” response instead of the repair response.

Use `resolveExportEligibility` in the server procedure after ownership/archive checks and before PDF preparation. Distinguish `not_minted` from `missing_agency_id`, carry the resolver’s trimmed verified ID into the PDF data and filename, and remove every `DRAFT` identity-ID fallback. Extend the literal guard to cover this server route. Replace the obsolete test in `server/export.test.ts` that positively expects the `DRAFT` fallback, and add direct-router cases for null, empty, and whitespace-only IDs plus the correct refusal copy.

### B. Positively bind the mutating drive to the development database

The current drive rejects `railway.internal`, but Drape production is normally accessed for one-off work through Railway’s **public** `MYSQL_PUBLIC_URL`. That URL does not contain `railway.internal`. If a PowerShell session still has a one-off production `DATABASE_URL` override while `.env` supplies the local app ID, every current drive gate can pass.

Before opening a connection, positively prove the database is the configured development database. Use a durable mechanism such as requiring the runtime `DATABASE_URL` to exactly match the repository’s normal dev `.env` `DATABASE_URL` (read/compare without logging either value), combined with the explicit fixture opt-in and an exact expected local app identity. Refuse any environment override or mismatch. Do not print credentials. Add a refusal test proving a different public Railway-style URL is rejected before `mysql.createConnection`.

### C. Add behavior-level zero-mutation proof for rejected exports

The pure eligibility table plus source-string ordering guard is useful but does not itself execute an export action or prove mutation call counts. Add a small testable action boundary/orchestrator (without requiring a broad UI-test-stack installation) or another genuine behavior-level harness that invokes the rejected export path with mocked proxy/upscale/PDF actions and proves all mutation call counts remain zero for:

- active/locked with missing ID;
- active/locked with whitespace-only ID;
- draft with a stray ID.

Keep the existing source guard as defense in depth, but do not present it as the behavior-level test.

After these three changes, rerun the focused export/guard/drive-refusal suites, `pnpm check`, affected suites, and full `pnpm test`. Update the handoff with exact totals. Leave everything unstaged and uncommitted and stop for review.
