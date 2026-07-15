# R6 Batch B — status read-model unification: implementation handoff

**Date:** 2026-07-16 (overnight batch per `CLAUDE_R6_BATCH_B_OVERNIGHT_PROMPT.md`; **review-corrections round — see §13 — and the FINAL review round's three blockers — see §14 — applied same day per `CLAUDE_R6_BATCH_B_REVIEW_CORRECTIONS.md`**)
**State: COMPLETE including all review corrections and final-round blockers A/B/C, all gates green. NOTHING staged, committed, pushed, or deployed. Awaiting founder/Codex review.**
**Start-state gate:** passed — HEAD `f5e489b` (FR-1 ratification docs) above `7e97cf6`, tracked worktree clean.

## 1. What Batch B is

One shared, exhaustive model-lifecycle read-model contract — `shared/modelLifecycle.ts` — and every in-scope consumer now agrees with it:

```ts
type ModelLifecycleStatus = "draft" | "active" | "locked" | "archived";
// draft = editable, unminted · active = minted · locked = legacy minted alias
// archived = deleted/unavailable · unknown status = conservative (not draft, not minted, not available)
```

Predicates (each an exhaustive switch with `assertNeverModelStatus`, so a fifth status stops compiling instead of inheriting behavior): `isModelDraftStatus`, `isModelMintedStatus`, `isModelArchivedStatus`, `isModelAvailableStatus`, plus `MODEL_MINTED_STATUSES` for DB query filters and the `isModelLifecycleStatus` narrower. No server-only imports — usable by client and server.

## 2. Files changed and why

### New

| File | Why |
|---|---|
| `shared/modelLifecycle.ts` | THE read-model contract (above). |
| `server/modelLifecycle.test.ts` | Predicate units: the full 4-status table, unknown-status conservatism, the agencyId-mismatch table (25 tests). |
| `server/batchB-status-readmodel.test.ts` | Cross-surface agreement over the real routers with mocked DB (23 tests) — packageState, mintPackage result, picker, board fill, registry lookup/verify, generatePdf. |
| `server/modelLifecycleGuard.test.ts` | Permanent scoped literal guard, floorParity pattern (12 tests) — see §6. |
| `scripts/drive-batchB-status.mts` | Free local status-agreement drive, B1–B7 (see §8). |

### Modified — server read surfaces

| File | Removed derivation → replacement |
|---|---|
| `server/casting/mintPackage.ts` | `minted: !!model.agencyId` in the stays-draft/upgrade **result** and in `getPackageState` → `isModelMintedStatus(model.status)`. A stray-ID draft no longer reports `minted:true`; a legacy locked row without its ID no longer reports `minted:false`. The mint-transition `cleanDraft` guard and the post-transition `minted: true` are untouched (mutation allowlist). |
| `server/lib/boardOps.ts` | Two `draft = status !== "active" && status !== "locked"` (fillFromLibrary provenance stamp, listCastableModels picker) → `isModelDraftStatus`. The old form degraded archived/unknown to *draft*. The picker also now skips `!isModelAvailableStatus` rows outright — defense in depth over Batch 0's `getUserModels` archived filter, not a replacement for it. The applyModelEdit D-43 seal (`status !== "draft"`) untouched. |
| `server/routes/registry.ts` | `lookup`: `status !== 'active'` → `!isModelMintedStatus(status)` — a **legacy locked identity is now retrievable** (it 404'd before); stray-ID drafts and archived still NOT_FOUND. `verify`: any non-minted row now returns the **public-absence shape** (`valid:true, exists:false, minted:false`, no timestamp) — byte-identical to a nonexistent ID, so verify leaks neither draft nor archived existence and fully agrees with lookup (§13.2). |
| `server/routes/generation/castingExport.ts` | Final round A: the route now runs the ONE shared `resolveExportEligibility` gate (whitespace-only IDs count as missing — the old `!!agencyId` let them through), refuses `not_minted` with the mint prompt and `missing_agency_id` with the repair copy (distinct responses), and prints ONLY the resolver's trimmed verified ID into `PdfModelData.agencyId` and the filename — the fabricated `MOD-YY-DRAFT` and `IDENTITY_DRAFT.pdf` fallbacks are deleted and guard-banned. |
| `server/db/models.ts` | `getUserMintedModelsWithThumbnail` filtered `eq(status,'active')` — **legacy locked minted models were invisible in every gallery/lobby surface**. Now `inArray(status, [...MODEL_MINTED_STATUSES])`, and rows carry `status` so consumers derive minted state from status truth. Drafts source and archived helpers untouched. |
| `server/db/wardrobe.ts` | `getRecentUserSessions` payload gains `modelStatus` (the linked model's status; `null` when the row is gone) so session resume stops assuming every linked model is minted. |

### Modified — client read surfaces

| File | Removed derivation → replacement |
|---|---|
| `client/src/features/studio/stores/useStudioStore.ts` | The `isMinted: true // Gallery-loaded models are always minted` hardcode is dead. `loadModelFromCast` now REQUIRES a `minted: boolean` argument — every caller must supply status truth; there is no default to regress to. |
| `client/src/features/studio/hooks/useCastGate.ts` | The `if (!stayDraft) setCanvas({isMinted:true})` action inference is dead. Post-action gate state is `result.minted` — the server's returned status truth. |
| `client/src/features/studio/hooks/useResumeDraft.ts` | `isMinted = status === 'active'` → `isModelMintedStatus(status)`. Legacy locked resumes as minted, never as an editable draft. |
| `client/src/features/studio/hooks/useSessionPersistence.ts` | Same fix in `useSessionRestore`. (Archived can't reach either hook: `models.get` reads it as deleted per FR-4.) |
| `client/src/features/studio/hooks/useSessionReset.ts` | `loadGalleryModel` threads `minted`. `resumeWardrobeSession` derives from `modelStatus`: draft resumes as draft, locked as minted; an archived or hard-deleted source resumes as **session imagery only** (upload-style canvas, no cast link, no localStorage persistence of a link the restore would 404 on) — previously it resumed any linked model as minted, and `persistSession(..., true)` was hardcoded. |
| `client/src/features/studio/hooks/useLoadWardrobeModel.ts` | Both gallery entry points pass `isModelMintedStatus(model.status)`. |
| `client/src/features/studio/components/ModelGallery.tsx` | `MintedModel` row type gains `status`. |
| `client/src/features/export/useExportPack.ts` | `isMinted = !!model?.agencyId` → `isModelMintedStatus(model?.status)` (UI display), and BOTH actions (`downloadPdf`, `downloadZip`) gate on the shared `resolveExportEligibility` before any proxy/upscale/PDF work; the `"DRAFT"` filename fallbacks are removed (§13.1). |
| `client/src/features/casting/hooks/useCastingExport.ts` | The `!agencyId ⇒ draft ⇒ mint door` conflation is split via the shared `resolveExportEligibility` gate (§13.1): not-minted-by-status → mint-door routing (as before); minted-but-ID-missing → fail-closed refusal with repair copy, resolved BEFORE any upscale/proxy/PDF call. |

### Modified — tests only

`server/model-gallery.test.ts`, `server/session-reset.test.ts` (new 4th argument + a new gallery-honesty case), `server/models.test.ts` (the registry-rule replica now uses the shared predicate and covers stray-ID/locked/archived), `server/export.test.ts` (the "detect minted by agencyId presence" tests replaced with the status-truth contract).

## 3. How the surfaces now agree

Package (`packageState.minted`), gallery (`listMinted` + `loadModelFromCast`), picker/board fill (`draft` flag), session restore, resume, wardrobe-session resume, gate (`result.minted`), registry, and export all read the SAME predicate over the same status field. For each status: **draft** → draft everywhere (even with a stray ID); **active/locked** → minted everywhere (even with the ID missing, for read state); **archived** → 404/absent/degraded everywhere, never an editable fallback; **unknown** → not draft, not minted, unavailable.

## 4. agencyId mismatch behavior (proven by unit + drive)

- Draft + stray `agencyId`: draft in package/picker/fill/canvas; registry NOT_FOUND; export refused; mint transition still fails closed (Batch 0, untouched).
- Active/locked without `agencyId`: minted read state (package/gallery/canvas), but `generatePdf` and the client ZIP path still fail closed on the missing ID — integrity contracts kept their own checks.
- Archived + `agencyId`: NOT_FOUND/absent everywhere.

## 5. What was deliberately NOT changed

- **Mutation/transition guards:** `cleanDraft` mint invariant, D-43 iterate/compact/reconcile seals (`status !== "draft"` in castingRefinement/castingImaging/applyModelEdit), drafts-only deletion, `assertNotArchived` — all authoritative server rules, all untouched.
- **Status writers:** `mintModel`, `updateModel`, stale-writer — untouched. No status writes, backfills, or normalization of legacy rows.
- **Board provenance:** persisted `provenance.draft` snapshots are not rewritten; `fillFromLibrary` still stamps at the established boundary (now via the shared predicate); `CastNode`'s provenance-driven `isDraft`/`isMinted` reads the server-stamped flag and is reconciled by the existing mint/fill boundaries — left as is per the board-metadata caution. Batch 0's `sourceArchived` degradation untouched and its tests pass.
- Out-of-domain status code (user-account `locked` in `db/admin.ts`, `users.lockedUntil`, invite codes, billing/subscription, board status, job status) — untouched, and the guard's scope cannot flag it.

## 6. Literal guard scope and allowlist (`server/modelLifecycleGuard.test.ts`)

**Scope** (exact file list, nothing else scanned): 10 client read/UI modules (now including `NodeInfoPanel.tsx`) + 6 server read surfaces. **Bans:** any `status ===/!== 'active'|'locked'|'archived'` comparison; `minted`+`agencyId` on one line without `isModelMintedStatus`; `minted/isMinted = !!…agencyId`; `isMinted: true` in the studio store or gate; `stayDraft`-driven `isMinted`; a gallery filter of `eq(models.status,'active')`; `"DRAFT"` filename fallbacks in the export hooks; `agencyId ?? 'Not minted'` display copy. **Positive pins:** the required-`minted`-param signature, `result.minted` in the gate, packageState as the sheet controller's only minted source, shared-module + `exportEligibility` imports, export-eligibility-before-first-mutation ORDERING in all three export actions (string-index assertions), availability gates on all four load/restore hooks, the dead-link clear paths (`clearPersistedSession` + `isDeadSessionErrorCode` restricted to NOT_FOUND/FORBIDDEN), and the `assertNever` wiring. **Pinned allowlist (by count):** `model.status === "draft"` ×3 in mintPackage (mint ceremony) and ×1 in boardOps (D-43 seal); `minted: true` ×1 in mintPackage (post-transition result) and ×1 in registry (verify's branch, order-pinned AFTER its `!isModelMintedStatus` guard); `hasAgencyId` telemetry; `cleanDraft`/`mintModel(` transition lines; `eq(status,'draft')` ×1, `eq/ne(status,'archived')` ×1 each in db/models.ts. **Documented-intentional board provenance (review correction 5):** `CastNode.tsx`'s server-stamped `prov.draft === true` snapshot read and `boards.ts`'s single archived-source comparison (Batch 0's D-12 degradation boundary) are now explicitly pinned in the guard — visible and count-locked, not redesigned. Growing any pin fails the test.

## 7. Tests — exact totals (final, after the §13 corrections round)

| Gate | Result |
|---|---|
| 1. Predicate units (`modelLifecycle.test.ts`) | 25/25 passed |
| 2. Literal guard (`modelLifecycleGuard.test.ts`, expanded) | 18/18 passed |
| 3. Focused (batchB-readmodel, exportEligibility 10, sessionPersistence 6, batch0-authority 48, model-gallery, session-reset, models, export) | 217/217 passed, 10 files |
| 4. Hardened drive (see §8) | 30/30 legs PASS (+ both refusal gates verified) |
| 5. `pnpm check` | green (0 errors) |
| 6. Casting/studio/board suites (29 files) | 319 passed / 40 skipped, 0 failed |
| 7. Full `pnpm test` | **100 files passed / 6 skipped (106); 1790 tests passed / 50 skipped; 0 failed** |

Skips are the standing env-gated suites (boards + boardVersions need `TEST_DATABASE_URL`; billingAlerts, slackChannels, slackWebhook, promptParser.gold need env keys) — identical before and after this batch. Honesty note from the FIRST round: one full run had a single failure — `pathB-hardening.test.ts` "account.exportData registered" timed out at 5s on `await import("./routers")` under parallel load; this is the pre-existing flake the revised addendum §2 records, it passed in isolation (22/22) and in every rerun including the final corrections run. Full logs preserved in the session scratchpad (`pnpm-test-full.log`, `pnpm-test-final.log`, `pnpm-test-final2.log`, `pnpm-test-corrections.log`).

## 8. Drive (`scripts/drive-batchB-status.mts`, hardened) — ran green, 30/30

Free ops only against the local dev server + dev DB. **Hardened per review correction 4:** refuses without an explicit `DRIVE_ALLOW_DB_FIXTURES=1` opt-in (verified: exits 2); refuses any non-loopback `VERIFY_BASE_URL` before opening any connection (verified with a production hostname: exits 2, nothing contacted); refuses `NODE_ENV=production`, a production-looking `VITE_APP_ID`, and a `railway.internal` DATABASE_URL host. Fixture rows (draft, draft+strayID, active, active-no-ID, locked, locked-no-ID, archived+ID) use **run-unique agency IDs** (random hex per run), are tracked incrementally from the first insert, leftovers from interrupted runs are swept before inserting, and cleanup is per-step try/catch with the connection close in its own finally — one failed delete cannot skip the rest. Legs: **B1** `models.get` carries status, archived 404s · **B2** `packageState.minted` per the full table · **B3** picker draft flags + archived absent · **B4** gallery returns active AND locked with status; drafts/archived never · **B5 (extended)** lookup AND verify agree; stray-ID draft and archived are **publicly absent through both** (B5d/B5f: `exists:false`, no timestamp; B5g: hidden-row shape byte-identical to no-row shape) · **B6** session payload carries `modelStatus` truth · **B7** credit balance byte-identical before/after. No Gemini call, no credit movement, no production URL/DB.

Honest limitation: the drive cannot cryptographically distinguish the dev Railway MySQL proxy URL from a production one typed into `.env` — the guards catch the app identity (`VITE_APP_ID`), `NODE_ENV`, the internal-network host, and the remote app URL, which is every signal the environment actually carries. It only ever runs when explicitly opted in.

## 9. Behavior changes a reviewer should sanity-check

1. **Legacy `locked` models now APPEAR in the My Models gallery, lobby feed, and registry** — they were silently invisible/refused before. This is FR-4's ruling made real; if any legacy locked row in dev/prod data is junk, it will now surface (the read-only prod-row audit script from Batch 0 item 8 is the tool for that question — not run, per authorization).
2. A wardrobe session whose linked model was hard-deleted or archived now resumes as plain imagery instead of a broken "minted" cast link — and actively clears the stale `drape_active_session` localStorage link (§13.3).
3. Both client export paths (PDF and ZIP, both hooks) refuse a minted-without-ID row with repair copy **before any proxy/upscale/PDF call**, and never route it to the mint door or print a `DRAFT` placeholder (§13.1).
4. `registry.verify` now answers `exists:false` for draft/archived/unknown rows — a public caller can no longer distinguish a hidden row from a nonexistent ID (§13.2). Minted (`active`/`locked`) verification is unchanged.

## 10. Deviations and remaining concerns

- **One tool deviation:** a single `sed -i` was used to update repeated call sites in `server/model-gallery.test.ts` (a test file) before switching back to the Edit tool for everything else, including all source files. The result was reviewed in the diff and is correct.
- `useSessionPersistence` still has the pre-existing `castModelId: isMinted ? model.id : null` convention on restore (drafts restore without `castModelId`); it now keys off the corrected predicate but the convention itself was not redesigned — out of Batch B's smallest-truthful-change scope.
- `CastNode.isMinted = isLibrary && !isDraft` reads the server-stamped provenance flag, not live status. It is reconciled at the established fill/mint boundaries and the sheet controller reads live `packageState.minted` once a package exists; left alone per the board-metadata caution — and now **explicitly pinned in the literal guard** as documented-intentional (a direct status literal appearing in `CastNode.tsx` fails the guard), so it is visible rather than invisible (§13.5). If the founder wants live-status node chrome, that's a follow-up ruling.
- The `pathB-hardening` account-export flake (§7) predates this batch and remains; a `testTimeout` bump there is a one-line fix for whoever owns it.

## 11. Confirmations

- Batch A-coupled: **not started**. Batch C / identity policy implementation: **not started** (policy read, nothing implemented).
- No production code outside Batch B scope intentionally changed; no masked-edit, iteration-policy, mint-policy, identity-document, credit, or generation-prompt changes.
- No database schema change, migration, backfill, or status write. No production DB or URL contacted (drive = localhost + dev DB). No Gemini or paid generation (drive proves zero credit movement).
- Auth/account status untouched. Railway untouched.
- **Nothing staged, committed, pushed, or deployed** (`git status` above: 19 modified + 5 new Batch B files, all unstaged; local-only `.agents/`, `.codex/`, `CLAUDE.local.md`, prompt docs untouched).

## 12. Is Batch B complete?

Yes, in my assessment: the shared contract exists with the exact required names, every named location (`useStudioStore.ts` gallery hardcode, `useCastGate.ts` action inference, `useResumeDraft`/`useSessionPersistence` `active`-only tests) is fixed, the sweep found and fixed six additional in-scope derivations the plan didn't name (packageState/mint result, picker/fill, registry ×2, gallery DB filter, session payload, both export hooks), the guard pins the boundary, and all seven gates ran green in order after self-review corrections. No plan contradiction was found. The one open judgment call is §10's `CastNode` provenance read — I believe leaving it is what the board-metadata caution requires, but it is flagged for the founder rather than silently decided.

**Stopping here for founder/Codex review.**

---

## 13. Review-corrections round (2026-07-16, per `CLAUDE_R6_BATCH_B_REVIEW_CORRECTIONS.md`)

All five findings were verified against the code, **accepted as valid** (no challenges), fixed, and re-gated. Additional files touched in this round: `shared/exportEligibility.ts` + `server/exportEligibility.test.ts` + `server/sessionPersistence.test.ts` (new), `NodeInfoPanel.tsx`, and the files below.

1. **Export gated before paid work.** New shared `resolveExportEligibility({status, agencyId})` → `{ok, agencyId} | {ok:false, reason: not_minted | missing_agency_id}` with one shared repair-copy string. All three export actions gate on it before any proxy/upscale/PDF work; `"DRAFT"` filename fallbacks removed and guard-banned. Tests: the full status×ID decision table on the real helper. *(Superseded in the final round: the gate became the `withExportEligibility` action BOUNDARY with genuine behavior-level zero-mutation tests — see §14.C.)*
2. **Registry public absence.** `verify` returns the exact no-row shape (`valid:true, exists:false, minted:false`, no timestamp key) for every non-minted row — draft, archived, unknown. Router test asserts `exists` for all five statuses AND that the hidden-row response deep-equals the no-row response; drive legs B5d/B5f/B5g prove it over real HTTP.
3. **Stale persisted links cleared.** Degraded wardrobe resume now calls `clearPersistedSession()` (previously it only skipped the write). Startup restore clears the entry when the model query fails with a **confirmed** dead-link code (`NOT_FOUND` — deleted or FR-4 archived — or `FORBIDDEN`), via the exported `isDeadSessionErrorCode`; transient network failures (no tRPC code) never clear. `useSessionRestore` also now refuses to restore an unknown-status model (availability required) and clears the entry. Tests start from a pre-populated stale `drape_active_session` entry against a stubbed localStorage (6 tests).
4. **Drive hardened.** Explicit `DRIVE_ALLOW_DB_FIXTURES=1` opt-in (refuses by default — verified); loopback-only base URL (verified against a production hostname — refused before any connection); production identity/NODE_ENV/internal-host refusals; run-unique agency IDs; interrupted-run leftovers swept by fixture marker; incremental ID tracking from the first insert; per-step try/catch cleanup with `conn.end()` in its own finally. Re-ran green 30/30.
5. **Guard/read-surface gaps closed.** `NodeInfoPanel` shows `Missing` for a minted row without an ID (status-derived; `Not minted` only when the status says unminted) and is in guard scope. `useLoadWardrobeModel` (both entry points), `useResumeDraft`, and `useSessionRestore` now require `isModelAvailableStatus` before loading — an unknown status refuses instead of loading as a not-minted editable model. The guard grew from 12 to 18 tests: export ordering, availability pins, dead-link pins, and the **documented-intentional** board-provenance boundary (`CastNode.tsx` snapshot read + `boards.ts`'s single archived-source comparison, both count-pinned).

**Corrections-round gates (all green):** `pnpm check` · focused lifecycle/registry/export/session/guard/Batch-0 suites 217/217 (10 files) · hardened drive 30/30 + both refusal paths · affected casting/studio/board suites 319 passed / 40 skipped · full `pnpm test` **1790 passed / 50 skipped, 0 failed (100 files passed / 6 skipped)**. Nothing staged, committed, pushed, or deployed; no production contact; no Gemini/paid generation; Batch A-coupled and Batch C untouched.

---

## 14. Final review round (2026-07-16) — the three remaining blockers

All three verified against the code and **accepted** (the whitespace-ID bypass, the DRAFT fabrications at lines 119/139, the public-proxy-URL gap, and the absence of an executed rejected-path test were all real). No challenges.

**A. The authoritative PDF route runs the shared contract.** `generatePdf` now calls `resolveExportEligibility` after ownership/archive checks and before any PDF preparation. The two refusals are distinct (`not_minted` → "Name & mint…"; `missing_agency_id` → the shared repair copy), whitespace-only IDs refuse (the old `!!agencyId` passed them), and the resolver's trimmed verified ID is the only ID that reaches `PdfModelData.agencyId` and the returned filename — both `MOD-YY-DRAFT` fabrications are deleted. Guard: the server route must import `shared/exportEligibility`, resolve eligibility before `PdfModelData`/`generatePremiumIdentityPdf`, print only `exportId`, and contain no DRAFT fallback shape. Tests: the obsolete `export.test.ts` DRAFT-fallback test is replaced with the no-fallback contract; new direct-router cases cover null/empty/whitespace IDs on active AND locked (repair copy asserted), the distinct mint-prompt refusal, and a success case proving filename + PDF data carry the TRIMMED ID (`"  MOD-26-LEGACY  "` → `IDENTITY_MOD-26-LEGACY.pdf`).

**B. The drive positively binds to the dev database.** Beyond the round-1 gates, the drive now refuses unless (a) `VITE_APP_ID` is EXACTLY `drape-local`, and (b) the runtime `DATABASE_URL` EXACTLY equals the repository `.env`'s `DATABASE_URL` (read and compared, never printed) — dotenv never overrides shell variables, so a lingering one-off production `MYSQL_PUBLIC_URL` override produces a mismatch and refuses before `mysql.createConnection`. New `server/batchB-drive-guards.test.ts` runs the real script as a child process and proves: a public-Railway-style `DATABASE_URL` override is REFUSED with the binding message (no connection attempted, no credential echoed), plus the opt-in, loopback, and app-identity refusals (4 tests). The legitimate drive re-ran green under the new binding: 30/30.

**C. Behavior-level zero-mutation proof.** `withExportEligibility(model, mutations, run)` is now the real action boundary in `shared/exportEligibility.ts`: on refusal the runner is never entered and the mutations object is never touched. All three export actions' full bodies now execute INSIDE this boundary, receiving their mutation functions through it (`m.upscale`/`m.proxyImage`/`m.generatePdf`); the guard bans any direct `.mutateAsync(` call inside an export action, so the boundary cannot be bypassed. New behavior tests execute the real boundary with `vi.fn()` mutation spies and a spending runner, proving refusal + zero calls for: active/locked missing ID, active/locked whitespace-only ID, and draft-with-stray-ID; plus the eligible path (runner entered exactly once with the trimmed ID) and error propagation. The source-ordering guard remains as defense in depth, no longer presented as the behavior test.

**Final-round gates (all green):** `pnpm check` · focused export/guard/readmodel/Batch-0/session suites 159/159 · drive-guard child-process suite 4/4 · legitimate hardened drive 30/30 · affected suites 370 passed / 11 skipped (31 files) · full `pnpm test` **1808 passed / 50 skipped, 0 failed (101 files passed / 6 skipped)** — log preserved (`pnpm-test-final-round.log`). Nothing staged, committed, pushed, or deployed; no production contact; no Gemini/paid generation; Batch A-coupled and Batch C untouched.
