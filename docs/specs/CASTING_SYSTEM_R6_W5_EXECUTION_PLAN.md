# Casting System R6 — W5 Execution Plan

**Author:** Fable 5 (investigation + plan). **Executor:** Codex. **Date:** 2026-07-17. **Verified at:** `9799dbe` (R6 W4).
**Revision 2 (2026-07-17):** founder corrections applied per `CLAUDE_R6_W5_PLAN_CORRECTIONS.md` — the identity gate now covers the structured door (`executeApplyModelEdit`), validation runs **before** R2 upload, the retry is conversation-isolated, protected dimensions are exact-leaf and frame-aware with a per-dimension verdict schema, and the W5-A proof uses a fixed calibration matrix. The strip-first Package Health direction (§4, W5-B, §9.1) is founder-approved as written.
**Revision 3 (2026-07-18):** founder clarified the product contract after calibration. The structured panel is an explicit **recast** surface: it creates a new draft identity from the selected casting settings and may change the person. It is not a same-person surgical editor and must not be judged against the old anchor. Free-text, reference-assisted, and surgical iteration remain same-person operations and retain the strict post-generation identity gate. The UI must state the distinction; the larger interaction redesign remains R7.
**Boundaries for Codex:** implement exactly these batches; do not stage/commit/push/deploy/migrate/contact production without founder approval; never touch `.agents/`, `.codex/`, `CLAUDE.local.md`, `.claude/settings.local.json`, or `docs/specs/CLAUDE_*.md`; stop at each Fable review gate (§10).

## 1. Executive verdict

**R6 needs W5 before it can close.** An authorized hair-color-only edit replaced a protected identity (skin tone, heritage, face) and the system committed the result as the new identity anchor, then propagated it by refresh — with no gate anywhere between image generation and identity commit. That alone is release-blocking for a product whose promise is "cast the person once." Six further corrections (stale-banner truth, per-view refresh state, draft naming, variation connector, the export ruling, post-close truth) are honest-behavior fixes on shipped W1–W4 surfaces. Everything else from the founder's pass is either ratified behavior working as designed or R7.

## 2. Evidence table

| # | Founder finding | Current code path | Confirmed root cause | Severity | Class |
|---|---|---|---|---|---|
| 1 | Pink-hair edit changed the person; refresh propagated it | `server/routes/generation/castingRefinement.ts:110-257` → `server/casting/geminiGeneration.ts:536-756` → `server/casting/identity/identityCommit.ts:221` | Three verified iteration holes: (a) **no post-generation identity gate** — the generated image committed as the new anchor unconditionally; (b) **cross-model Gemini chat reuse** — the in-memory session map was keyed by `userId` only; (c) the iteration identity anchor omitted the technical schema. These are release-blocking because iteration promises to preserve the person. `executeApplyModelEdit` is different by founder ruling: its non-rerun structured NEW-mode generation is an intentional recast, so a new-looking person is permitted and no old-anchor similarity gate applies. | **Release blocker** | **W5-A** |
| 2 | No loading/continuation after leaving Casting; expected completion notice not observed | `client/src/features/casting/hooks/useCastingGeneration.ts:265-304`, `CastingTakeover.tsx:196-199` (W4/D-59) | The success notice exists in code (`useCastingGeneration.ts:266-274`) but was not observed live — the continuation lives in the unmounted takeover's closure and must be reproduced in a drive before fixing; the **failure path provably swallows post-close errors** (`:299` silent `return`). Durable node linkage / reopen-into-running-job is ratified R7 (boundary items 1–3). | Blocker (truth) for the notice; R7 for durability | **W5-F** + R7 |
| 3 | Restore creates v3/v4 from two images | `server/casting/mintPackage.ts:680-777` (`executeRestoreSlotVersion`) | Copy-forward immutable ledger append: `pointsCost: 0`, no generation call, no new R2 object (reuses `storageUrl`/`storageKey`), revision-compatibility gated (§7.4). Version number = filled-row count for the angle — exactly D-53's ratified "Use this version". The confusion is the R-10 "version-surfacing rethink", already a named post-pass item. | Not a bug | Not-a-bug / R7 |
| 4 | "Make the skin darker" refuses in free text | `server/casting/identity/editAuthority.ts` → policy §8.2 | Ratified: `person.skinTone` is a structured field; free-text doors refuse and route to the structured editor (R3). Conversational clarification/preset choices are R7 boundary item 7. | Not a bug | Not-a-bug / R7 |
| 5 | Variation connector appears only after completion | `client/src/features/boards/BoardPage.tsx:1105-1133` (temp nodes, no edge), `boardOps.ts:1267` (server edge post-creation) | Optimistic temp nodes ship without an optimistic edge; edges arrive only on post-success `listEdges` refetch. Pop-out already solves exactly this with an optimistic `listEdges` cache append (`BoardPage.tsx:763`). | Correction | **W5-D** |
| 6 | Back view hair somewhat longer | `server/casting/geminiViews.ts` + `backViewGate.ts` | Ordinary view/composer calibration drift; the back gate correctly passed it (its hair criterion is mass/length *plausibility*, not exactness). Distinct from finding 1 — no protected skin/face change. Composer/canonical-reference architecture is R7 item 6. | Minor | R7 |
| 7 | Stale banner persists after successful full refresh | Set: `useCastingGeneration.ts:369-373`; never cleared: `PackageHealthDialog.tsx:84-107` | `identityWarning` is client-local state; refresh completion updates assets and invalidates queries but never touches the warning. The banner copy is `REFUSAL_COPY.siblingsNeedRefresh` (`refusalCopy.ts:40-41`), matching the founder's quote verbatim. | Correction | **W5-B** |
| 8 | View strip doesn't mark the refreshing view | `ViewTabs.tsx:198-199` vs `useCastingRefreshStore.ts:5` | The per-angle in-flight registry (D-58) already exists and feeds Package Health and the canvas node; the strip renders only the aggregate count. Rendering gap, not a state gap. | Correction | **W5-B** |
| 9 | Add Views modal can't be dismissed during generation | `CastModelModal.tsx:338,394` (`disabled={isCasting}`); mutation owned by `useCastGate.ts:75` | Bounded R6 correction **exists without faking durability**: the mutation is hosted by the takeover (which stays mounted), so the modal may close while slots generate — provided the strip shows per-slot progress (W5-B) and `useCastGate`'s continuation gains the session-token guard it currently lacks. Full leave-and-resume across takeover close remains R7 item 4. | Correction | **W5-F** |
| 10 | Draft name not synchronized | Server write OK (`mintPackage.ts:440-448`); gaps in `useCastGate.ts` (no store write-back), `server/routes/boards.ts:259` (`getItems` overlays live draft *status* per D-57, not the live *name*), `ControlPanel.tsx:280` (name shown only for read-only/minted) | The nickname persists to the model row and lands on the origin node (`CastingTakeover.tsx:298` → `BoardPage.tsx:655`), but: (i) `useCastingFormStore.modelName` is never updated in-session → not visible in Casting and the later mint door doesn't prefill (`CastingTakeover.tsx:653` and `DrapeStudio.tsx:286` read the store); (ii) other placements of the same model never receive the live name; (iii) node-only rename (`item.label`) is visually indistinguishable from the model name. | Correction | **W5-C** |
| 11 | Expensive 2K export ZIP lacked the identity PDF | `useExportPack.ts:211-230,311-326`, `useCastingExport.ts:101-124`, `ExportModal.tsx`, `ExportPackDialog.tsx` | PDF failure is caught and an image-only ZIP ships anyway on all three paths; 2K is user-facing in both Studio (`ImageViewerPanel.tsx:456` → `ExportModal`) and Model Library (`ModelCardChooser.tsx:72` → `ExportPackDialog`). Founder ruling (§4) applies. | Ruling | **W5-E** |
| 12 | Forked draft shows no public ID | `mintPackage` (`agencyId` assigned at mint), `packageState.minted = !!agencyId` | Intentional: drafts have an internal database id; the public `MOD-…` agency ID is assigned and displayed only at mint. | Not a bug | Not-a-bug |

## 3. Challenges to the preliminary (Codex) audit

1. **A — sharpened, not just confirmed.** The map is user-keyed as claimed, but the live-failure attribution must stay honest: the code proves cross-model reuse is *structural* (every fork/variation candidate creation at `boardOps.ts:750` runs a NEW-mode generation that overwrites the user's single session; a later iterate on any model reuses it via `geminiGeneration.ts:669`), and the founder's pass exercised fork/variation successfully before the hair edit — a concrete mechanism, but **unproven** as the live cause. The plan treats it as a serious independent hole that must close regardless. Also verified (the preliminary audit didn't check): all NEW call sites pass a real `userId` (`boardOps.ts:399/756/894`, `castingImaging.ts:132`), so there is no `'anonymous'` cross-*user* session sharing in practice.
2. **B — confirmed with a caveat.** The master prompt itself carries the heritage/skin prose, so the missing schema cannot alone explain the failure; including it is still correct — every other identity consumer passes the schema (`geminiViews.ts:55/158/270`, `mintPackage.ts:89/162/380/659/707`, `composeIdentityPayload.ts:101`) — and cheap.
3. **C — confirmed; all four criticisms of `checkIdentityConsistency` stand** (`geminiClient.ts:241-298`: would flag the authorized change as a difference, not expected-change-aware, fails open on every error/parse path, zero live call sites). **Addition the preliminary audit missed:** `backViewGate.ts` is the live in-house precedent for a post-generation identity gate with a caller-enforced one-retry-then-named-refund credit contract. W5 builds a *new* expected-change-aware validator on that caller contract — but **inverts its fail-open rule** (§7): a gate protecting identity authority fails closed.
4. **D/E/F/H/I — confirmed** as described, with F sharpened to the three exact gaps in the evidence table and H extended to all three export code paths and both entry surfaces.
5. **G — revised approach.** The preliminary audit asked whether a safe temporary edge is possible; the codebase already answers it: pop-out appends optimistic edges to the `listEdges` cache (`BoardPage.tsx:763`) with restore-previous-cache rollback (`:818-829`). Reuse that pattern; do not invent a parallel edge overlay.
6. **Finding 9 — R7 not required.** The mutation outlives the modal (owned by `useCastGate` in the mounted takeover), so dismissal is a bounded R6 correction — *if* the missing session-token guard is added (defect 7 below).
7. **Two defects the preliminary audit missed entirely:** (a) post-close **failure** results are silently discarded (`useCastingGeneration.ts:299` `if (!session.isCurrent()) return;`) — the required "one truthful global failure notice" is currently impossible; (b) `useCastGate`'s success continuation calls `useCastingGenerationStore.getState().setCurrentAssets(...)` (`useCastGate.ts:87-105`) with **no session-token guard** — after a close-triggered reset it writes stale assets into the next session, the exact F1/VC-R6-r3 corruption class the token system exists to prevent.
8. **Restore (I) — confirmed; classification is "state the truth".** No W5 code change; this plan documents the copy-forward semantics (§2 row 3) and leaves the UX rethink to the named R-10 post-pass item.
9. **Founder clarification (revision 3, supersedes revision 2 on this point):** `executeApplyModelEdit` and the populated-panel **Recast model** action are new-identity operations. Their fresh NEW-mode generation is deliberate and may change the person. The same-person gate applies only to free-text, reference-assisted, and surgical iteration. Recast still requires free validation, exact document computation, tracked upload, atomic document/anchor/revision/stale/board commit, truthful charge/refund, and explicit UI copy. It must never masquerade as a same-person edit.

## 4. Founder rulings already settled — do not re-ask

- **Export (finding 11, ruled):** no user-facing 2K export in Casting; free current-resolution (1K) export; the Identity Pack **must** contain the identity PDF — PDF failure refuses the pack honestly and charges nothing; Identity Pack export lives in the **lobby Model Library only**, not Casting Studio; explicit 1K/2K *generation-time* quality choice comes later (R7 item 9). Backend upscale capability is hidden, not deleted — safely hiding the unapproved surface is the smaller change.
- **R6/R7 boundary:** the investigation prompt's ten R7 items stand (durable jobs; node↔pre-headshot linkage across close/reopen/reload; reopening Casting into an in-flight job; Add-Views leave-and-resume; true rollback/revision-history UX; composer/canonical reference architecture; conversational clarification; the minted Cast Profile viewer; 1K/2K quality choice; broader modal/first-run redesign). Nothing in this plan builds toward them beyond what the corrections require.
- **Intentional behaviors:** free-text structured-field refusal routes to the structured editor (R3/§8.2); restore is copy-forward versioning without generation or charge (D-53); drafts expose no public agency ID (mint assigns it); a canvas-node-only label may differ from the model's canonical name — but W5 must make that distinction visible (W5-C); minor back-view hair drift is calibration, never conflated with a protected skin/face identity change.
- **Recast versus iterate (founder ruling, 2026-07-18):** changing Casting panel settings after a draft exists and pressing **Recast model** deliberately creates a new draft identity and may change the person. LLM, reference-assisted, and surgical iteration preserve the person and are identity-gated. R6 adds truthful helper copy; R7 owns the fuller mode separation, confirmation, and conversational UX.
- **D-56 / `IDENTITY_EDIT_INTERIM_POLICY.md` (revision 9)** remains the binding identity contract; W5 adds a post-generation gate *behind* the existing authorization boundary and changes no policy classifications, no ledger entries, no refusal classes.
- **Strip-first package health (founder UX direction, 2026-07-17, binding):** Package Health works but is too deeply hidden for routine status and refresh. The **Casting view strip is the future primary package-health surface**. W5 establishes truthful per-view states there (W5-B); the full strip-first controls (per-view refresh with price, retry, add-missing, refresh-all) are the planned R7 UX (§9.1); Package Health survives as an **optional detailed summary** (versions, restore, mint-blocker detail). **Never refresh or charge automatically** — every spend stays a deliberate, priced click (D-15).

## 5. Genuinely unresolved founder questions

**None that block implementation.** Two judgment calls are made in this plan and flagged for veto rather than asked as questions, because ratified rulings already imply them:

1. **Gate failure behavior = fail closed with refund** (§7). R2 ratified fail-safe classification; extending fail-closed to the only gate that protects identity authority is the same principle. Practical cost: during a Gemini-text outage, identity edits refuse (free, retryable) rather than commit unverified.
2. **Model Library export = one action** ("Export identity pack": free, current resolution, PDF-mandatory), per the ruling's wording and the required proof "Model Library offers one free current-resolution Identity Pack action". The current separate PDF-only button is folded into it.

## 6. Implementation batches (dependency/risk order)

### W5-A — Identity-edit safety (the release blocker; ships first, alone)

**Objective:** every same-person free-text/reference-assisted identity iteration (`castingRefinement.ts`) is gated before its result can become the identity anchor. Drift refuses, refunds truthfully, commits nothing, and **uploads nothing**. Session bleed and the missing anchor schema close in the same pass. Structured panel recast (`executeApplyModelEdit` non-rerun), `intent:'rerun'`, fork, variation, and creation are deliberately classified new-person operations and remain exempt from old-anchor comparison.

**Likely files/symbols:**
- `server/casting/geminiGeneration.ts` — session map key `userId` → `` `${userId}:${modelId}` ``; `generateCastingImage` gains a session-scope (modelId) parameter; ITERATE reuses only a same-model session; NEW clears/creates only its own model's entry; `clearCastingSession(userId)` clears all of that user's entries (prefix scan); eviction/cap logic unchanged. `buildIterationImagePrompt` receives the technical schema and passes it to `buildIdentityAnchor` (`:934`).
- `server/casting/aiService.ts` — **narrow raw-candidate boundary (validate-before-upload, §7):** add `iterateModelRaw` / `generateCastingImageRaw` variants returning `{ imageBase64, engineUsed }` **without** the S3 upload, plus an exported upload step (`uploadBase64ToS3` already exists). The existing uploading wrappers keep their signatures for every unrelated consumer (views, mint, refresh, creation paths unchanged). Thread `modelId` and `technicalSchema` through the options.
- Call sites for session scoping: `server/lib/boardOps.ts:395/888` (the placed model's id), `boardOps.ts:750` (**the newly created candidate's `model.modelId`** — created at `:729` before generation — never the parent model's id), `server/routes/generation/castingImaging.ts:126`, `server/routes/generation/castingRefinement.ts:166`.
- **New:** `server/casting/identity/editGate.ts` — the exact-leaf, frame-aware validator (§7).
- `server/routes/generation/castingRefinement.ts` — gated sequence inside the `withAtomicCredits` operation (§8): generate raw → gate → upload-on-pass.
- `server/lib/boardOps.ts` `executeApplyModelEdit` (update, non-rerun) — preserve the intentional recast path: compute the exact post-recast document, generate one raw NEW-mode candidate, upload it with a tracked key, then atomically commit document + anchor + revision + sibling stale state + board landing. Do **not** compare it with the old person.
- `server/casting/identity/refusalCopy.ts` — the new copy entries (§7).

**Invariants:** server authority; classification/authorization unchanged; no same-person identity-document, asset-ledger, anchor, revision, sibling-stale, board-landing, or version-row write before the iteration gate passes; **no R2 object exists for an iteration candidate that never passed**; refunds use the existing truth contract; rejected iteration chat state never feeds retry; structured recast is separately labelled and audited, validates before charge, uploads once, and keeps its existing atomic durable boundary plus tracked-upload cleanup on commit failure; multi-process/session honesty remains explicit; `pnpm test` never touches a live DB.

**Acceptance criteria:** a hair-color-only free-text edit on a dark-skinned draft keeps skin tone, face identity, age, build, and ethnicity; user A iterating model 1 after casting/forking/varying model 2 cannot inherit model 2's chat; iteration gate fail → zero net credits, no upload or durable write, honest copy; iteration gate pass → one upload and one commit. Structured hair-color, skin-tone, and face-field operations bypass the verifier, generate one recast candidate, and atomically commit the updated casting document and new anchor; audit metadata identifies `structured_recast`; the UI says the person may look different.

**Behavioral tests** (new `server/w5-identity-gate.test.ts` + unit tests beside the modules):
- *Session scoping:* same user, two models → two independent sessions; NEW on model 2 leaves model 1's session untouched; ITERATE on model 1 never consumes model 2's session; `generateCastCandidate` scopes by the candidate's new `modelId`, not the parent's; `clearCastingSession` clears all of a user's entries and no other user's.
- *Anchor:* the iteration prompt builder emits schema-derived identity fields.
- *Gate matrix (validator mocked):* verdict fail → refund recorded under the derived `refund:<charge-id>` reference, `commitIdentityEdit` never called, refusal copy returned, exactly one regeneration retry attempted; infra-unavailable → one re-check then fail closed, free-retryable copy; verdict pass → single upload + single commit; image-only class bypasses the gate entirely; exact ledger balance assertions per the `batchC-failureInjection.test.ts` patterns.
- *Structured-recast coverage:* structured **hair color**, structured **skin tone**, and a structured **face field** (jawline) never call the same-person verifier; each generates once, tracks the upload, commits document + anchor + revision + stale state + board landing atomically, and records `operationMode: "structured_recast"`. Commit failure deletes the tracked upload and refunds truthfully. `intent:'rerun'` remains a separately classified re-roll.
- *Exact-leaf exemption (correction 4):* hair color does not exempt hair length, texture, style, hairline, or skin tone; hair style does not exempt length or texture; jawline does not exempt face shape or cheekbones — exhaustive over the leaf→dimension map.
- *Frame awareness (correction 4):* a headshot comparison never reports build (or any non-visible dimension) as *verified*; `not_observable`/`uncertain` on an expected-observable protected dimension fails closed; unknown dimensions or malformed per-dimension responses fail closed.
- *Upload hygiene (correction 2, storage layer mocked with call counting):* first candidate fails, retry passes → **exactly one** upload, zero deletes needed; both candidates fail → **zero** uploads; pass → one upload; database commit failure **after** the passing upload → the tracked key is deleted (best-effort, logged) and the refund still lands.
- *Retry isolation (correction 3):* candidate 1's bytes are never an input to attempt 2 (attempt 2's source is the original pre-edit image); the failed attempt clears **only** `${userId}:${modelId}` from the session map (other models' and users' sessions untouched) so the retry runs stateless/fresh; the generation audit row records attempt count and verdicts without provider internals in user-facing output.
- *Pure functions:* `protectedDimensionsFor` exhaustive over the authorizable union; the per-frame expected-observable sets; the strict per-dimension response parser against a malformed corpus.

**Browser-drive proof (paid, bounded, human-graded) — the fixed calibration matrix (correction 5), not an ad-hoc threshold:**
1. legitimate free-text hair-color edit (the pink-hair reproduction: dark-skinned male draft → fork/variation → back to the original → pink hair);
2. legitimate hairstyle or hair-length edit;
3. structured skin-tone **recast** (must succeed as a recast; human grading does not require the old person);
4. structured face-field **recast** (same contract);
5. deliberately injected protected drift on a same-person iteration (must refuse);
6. a second injected protected-drift iteration (must refuse);
7. validator timeout/malformed response (must fail closed, free);
8. retry after a failed first candidate (must pass from the original source, one upload).

The drive is human-graded evidence; sequencing, persistence, refunds, exact delta mapping, retry isolation, and upload hygiene are proven by the deterministic tests above, never by the drive. `IDENTITY_GATE_FORCE_FAIL=1` powers legs 5–7 where injection isn't reproducible on demand.

The calibration script also requires the explicit acknowledgement
`W5_DRIVE_DB_OK=local-development-database` after the operator confirms that
`DATABASE_URL` is the development database. Localhost and app-ID checks remain
mandatory as separate guards. This acknowledgement is never configured in
production.

**Rollback/stop:** the identity gate has one call site: the same-person iterate door. Stop if legitimate iteration legs 1–2 cannot pass reliably or injected/unavailable legs fail open; never weaken the protected set to make calibration pass. Structured legs 3–4 are judged as recasts: they must commit exactly, charge/refund honestly, and present truthful UI, but they are not required to preserve the old person.

### W5-B — Refresh truth (banner + the strip's five-state per-view truth)

**Objective:** the stale banner clears only when server truth confirms the package is fully fresh; the Casting view strip becomes a **truthful five-state per-view surface — current / stale / refreshing / failed / missing** — from the existing authorities. This is the W5 foundation of the founder's strip-first direction (§4, §9.1): status truth lands now; the strip's *controls* land in R7.

**Current strip audit (what already exists in `ViewTabs.tsx`):** current = plain `ViewThumbnail`; stale = dim + ink dot (`:192-196`, unpinned rule shared with the board mosaic); failed = `FailedSlot` (named, refund-honest, retry → Package Health at that angle); missing = `GhostSlot` (mint/upgrade door). Only **refreshing** is invisible, and the stale tooltip copy ("refresh from the comp card") points at the wrong surface.

**Files:** `client/src/features/casting/components/PackageHealthDialog.tsx` — on refresh settle, after the existing invalidation, refetch `packageState`; if it reports zero stale and zero failed slots *and* the model has no in-flight refreshes, call `setIdentityWarning(null)`; any slot failure or remaining staleness leaves the warning standing. `client/src/features/casting/components/ImageViewer/ViewTabs.tsx` + `ViewThumbnail` — subscribe to the per-angle set `refreshingByModel[currentModelId]` and render an in-progress treatment (dimmed image + small spinner/ink dot in the house language) on the matching slot; align the stale tooltip copy to route to Package Health (the R6 repair surface, D-58) rather than "the comp card"; the summary line stays.

**Invariants:** `useCastingRefreshStore` remains the single in-flight authority (D-58) and `packageState` the single status authority — no second source of truth; the five states are mutually coherent (a refreshing slot renders as refreshing, not stale; a failed slot never renders as missing); partial refresh failure leaves an accurate warning and failed/stale slot state; **nothing refreshes or charges automatically**; no new polling; restrained monochrome treatment, existing tokens only. Pinned-stale keeps the existing shared display rule (board-mosaic parity); its strip presentation is an R7 strip-design question (§9.1), not silently changed here.

**Acceptance/tests:** unit — the warning is cleared only when refetched package truth is fully fresh; partial failure keeps it; each of the five states renders its own distinct treatment from the correct authority (component or source-level assertions per house style), and no state transition fires a mutation. **Drive:** identity edit → banner appears → refresh all → per-slot refreshing marks visible → stale dots clear **and** the banner clears; force one slot failure → banner, failed slot, and copy remain accurate; a missing slot still opens the mint/upgrade door and charges nothing until confirmed.

**Rollback:** pure client rendering/state — revert the two files.

### W5-C — Draft-name synchronization

**Objective:** a draft label entered at Add Views is visible in Casting, prefills the later mint door, and reaches every placement of that model; node-only rename stays node-only and visibly so.

**Files:** `client/src/features/studio/hooks/useCastGate.ts` — on stays-draft success with a nickname, `useCastingFormStore.getState().setModelName(nickname)`. `server/routes/boards.ts` `getItems` — the D-57 batched model-status read additionally selects the model **name**; return `sourceName` on model-linked items (no new query). `client/src/features/boards/canvas/nodes/CastNode.tsx` — label precedence: a model-linked node displays live `sourceName` unless the item carries an explicit user rename; right-click Rename on a model-linked node sets `metadata.customLabel: true` going forward, and its menu copy reads "Rename node (this placement only)". `client/src/features/casting/ControlPanel.tsx` — drafts show the honest draft label quietly (e.g. "«name» — draft"), reusing `honestModelName`.

**Invariants:** rename never writes the model row (`models.update` name-only strictness untouched); `honestModelName` sentinel-stripping preserved (`DRAFT_AUTO_NAME` never displayed or prefilled); no new query — extend the existing batched read; the optimistic fill path (D-38) unchanged; mint prefill continues through `initialMintName`.

**Tests:** unit — stays-draft nickname reaches the `mintPackage` input and the form store; `getItems` returns live `sourceName` and the label precedence resolves (custom rename wins; otherwise live name; fallback to stamped label); the later mint door prefills the nickname; node-only rename does not mutate the model name. **Drive:** enter a label at Add Views → visible in the Casting header, on the origin node, and on a duplicate placement after refetch → the later mint door arrives prefilled → right-click rename affects only that node and says so.

**Rollback:** additive overlay field + one store write — revert files.

### W5-D — Optimistic variation lineage edge

**Objective:** a loading variation node shows its `variant_of` connector immediately; success reconciles without duplicates; failure removes the temporary edge and node cleanly.

**Files:** `client/src/features/boards/BoardPage.tsx:1105-1133` — on temp creation, append `{ sourceItemId: originItemId, targetItemId: tempId, relation: 'variant_of' }` rows to the `listEdges` cache (the `:763` pop-out pattern; temp ids are already negative); on success, remap surviving temp edges to `landed.itemId` in the same pass that remaps the temp nodes, then let the existing invalidate reconcile — dedupe by (source, target, relation) when the refetch merges; on the failure/error paths, strip temp edges alongside their temp nodes (the restore-previous-cache pattern at `:818-829`). Extract the remap/dedupe as pure helpers for testability.

**Invariants:** the server remains the durable edge authority; no orphan edges after failure; no duplicate edges after refetch; cascade-prediction alive-filtering (VC-R5 fix 1) unaffected — temp edges never survive settlement; edge rendering stays class-driven (`EDGE_CLASS`), no ad-hoc relation lists.

**Tests:** unit on the pure remap/dedupe helpers (temp→landed remap; failed-candidate edge removal; dedupe against fetched rows). **Drive:** run 2 variations → connectors visible while loading → after completion exactly one edge per landed candidate → force one candidate failure → its node and edge both vanish with the named-and-refunded toast.

**Rollback:** client-cache-only change — revert the file.

### W5-E — Export ruling

**Objective:** apply the founder's export ruling exactly; the words "Identity Pack" never describe a PDF-less download.

**Files:** `client/src/features/casting/ImageViewerPanel.tsx:456` — remove the Studio "Export identity pack" action. `client/src/features/casting/ExportModal.tsx` + `client/src/features/casting/hooks/useCastingExport.ts` — delete (the Studio surface retires; clean up `useCastingUIStore.showExportModal` and `castingBindings` plumbing). `client/src/features/export/ExportPackDialog.tsx` — one free action: "Export identity pack" (current resolution); remove the 1K/2K selector and the separate PDF-only button. `client/src/features/export/useExportPack.ts` — `downloadZip`: PDF failure **aborts** — no ZIP download, honest error copy, nothing charged; the user-facing path takes no resolution parameter (2K plumbing in `prepareExportViews` and the server `upscale` route stays, hidden — capability preserved per the smaller-change instruction); fold `downloadPdf` into the single action or delete it. Update `server/w1-export-truth.test.ts` pinned copy honestly.

**Invariants:** export never mints (FR-2A); draft refusal + routing unchanged (`withExportEligibility`); the free path charges nothing (no upscale mutation reachable from any UI); all six canonical views export with correct labels (`exportViews.ts` ordering/filenames); the PDF carries the saved model name and identity content (existing `pdfService`); no misleading partial-success toast survives.

**Tests:** update `w1-export-truth.test.ts` + component/source assertions — no Studio export affordance remains; the Model Library offers exactly one free action; no user-visible 2K option anywhere; PDF failure → no download, no "Identity Pack" success/warning toast, zero charge; six-view labels correct; the PDF contains the model name. **Drive:** export a minted model from the Model Library (free; ZIP contains six labeled images + the identity PDF); force PDF failure → honest refusal, no ZIP, balance unchanged.

**Rollback:** UI-surface removal + one fallback deletion — revert files. **Stop condition:** if any *other* consumer of `useCastingExport` or the 2K surfaces turns up beyond those enumerated here, stop and report before removing anything.

### W5-F — Post-close truth + Add Views dismissal

**Objective:** a fresh cast finishing after Casting closes produces one truthful global notice with a working **Open Draft** action; failure/refund after close produces one truthful global failure notice; the Add Views modal can be dismissed while slots generate, without pretending durability.

**Files:**
- **Reproduce first** (bounded drive, before writing the fix): close the takeover mid-headshot and observe whether the existing toast (`useCastingGeneration.ts:266-274`) fires. Whatever the result, make the mechanism structurally robust: register the in-flight cast (model promise, origin itemId, session token) in a small module-level **pending-cast registry** owned at the `BoardPage`/app level (same-tab, in-memory — the D-58 class); the registry — not the unmounted takeover closure — renders the success toast + Open Draft action and the failure toast on settle, exactly once per cast. `handleBackgroundDraftReady` (`BoardPage.tsx:678`) remains the Open Draft implementation, including its refuse-if-session-active guard.
- `useCastingGeneration.ts:299` — post-close failures must surface truthfully (the server error already carries `refundTruth`), never return silently.
- `client/src/features/studio/hooks/useCastGate.ts` — capture a session guard (`captureCastingSession`) before `mutateAsync`; continuations that write store state check `isCurrent()`; outcome toasts still fire regardless of session state.
- `client/src/features/studio/components/CastModelModal.tsx` — enable dismissal during casting ("Keep editing" stays enabled; copy notes the views keep generating); `useCastGate` registers the tier's missing angles in `useCastingRefreshStore` (`begin` on mutate, `end` on settle) so the strip (W5-B) and Package Health show per-slot progress after dismissal.

**Invariants:** no durable/background-job claims — same-tab, in-memory, dies with the tab (R7 owns durability); Open Draft refuses safely over an active Casting session (existing guard, drive-asserted); exactly one notice per completion (registry entry consumed on settle); the W4 close contract (D-59: session invalidated before the exit animation; single auto-land) unchanged; D-40 — the toast is correct here because the action's surface has closed.

**Tests** (extend the `w4-close-open-contract.test.ts` pattern into `w5` additions): registry unit tests — completion after invalidation → success notice exactly once with a working action payload; failure after invalidation → failure notice, never silence; completion before close → no duplicate notice; `useCastGate` token guard — a post-reset continuation does not write assets into the new session but still reports its outcome; modal dismissal leaves the mutation running and slots land (store-level assertion).

**Drive:** start a cast from a node → close immediately → wait → one global notice appears → Open Draft opens the draft; repeat with a forced failure → one truthful failure notice; Open Draft over an active session refuses safely; Add Views → dismiss the modal → the strip shows the generating slots → slots land.

**Rollback:** the registry is additive; the modal dismissal is a one-line gate — revert files. **Stop condition:** if the reproduction shows the notice failure has a *different* root cause (e.g. a full page unload killing the tab's JS), report to Fable before building — a same-tab registry cannot fix a page unload, and pretending otherwise would fake durability.

## 7. Identity-safety design (the gate Codex must not soften)

**Module:** `server/casting/identity/editGate.ts`. **This is an identity guard, not a similarity score.** It must be impossible to implement as "the images look alike".

- **Call site:** `castingRefinement.ts` iterate, `authorization.class === "identity"` — *inside* the `withAtomicCredits` operation. Source = the edited view's pre-edit image (`targetAsset.storageUrl`); authorized delta = `authorization.identityPatch.edits`.
  - Explicitly exempt, each with its own classification: image-only edits; presentation/refused classes; structured panel recast (`executeApplyModelEdit` non-rerun); `intent:'rerun'` re-rolls; fork/variation/creation. These are new-person or non-identity operations, not weaker same-person paths.
- **Inputs:** source image (per door, above); **raw candidate bytes from the generation call — before any R2 upload** (see sequencing); the exact typed authorized fields with normalized values — never the raw user sentence.
- **Validate-before-upload sequencing (correction 2):** generate raw candidate → fetch source → gate → on **pass**, upload exactly that candidate (`uploadBase64ToS3`) and hand the URL to the commit → on **fail**, retry from the original source (below), gate again, upload only a passing candidate. A candidate that never passed is never persisted — no R2 object, no cleanup debt. One residual tracked-cleanup case remains: if the **database commit fails after the passing upload**, the caller holds the exact storage key it just created and best-effort-deletes it (logged, never user-visible, never blocking the refund). Failed candidates are not persisted "for the validator's convenience"; the gate consumes in-memory bytes. The `aiService` refactor is deliberately narrow — raw variants beside the existing uploading wrappers; no unrelated consumer changes.
- **Retry contract — conversation isolation (correction 3):** a failed first verdict means the model that produced it is suspect *and so is its chat state*. The retry: uses the **original pre-edit source image** and the **same authorized normalized delta** (never the rejected candidate as source, structurally — the raw candidate is bytes in a local variable, never fed back); **clears only this model's session entry** (`${userId}:${modelId}`) before regenerating, so the retry runs through a fresh or stateless path and cannot inherit the conversation that just produced the rejected identity; never touches another model's or user's session; records per-attempt verdicts and attempt count in the generation audit row's metadata (internal only — user-facing copy stays sanitized).
- **Protected dimensions — exact-leaf, no grouping (correction 4):** one protected dimension per independently authorizable identity leaf and structured field — the leaf→dimension map is **1:1** (`person.hair.color` → hair color; `person.hair.length` → hair length; `person.hair.texture` → hair texture; `person.hair.style` → hair style; `person.face.jawline` → jawline; `person.face.faceShape` → face shape; `person.face.cheekbones` → cheekbones; … every §8.5 ledger leaf and structured field, plus non-authorizable always-protected dimensions: ethnicity/heritage facial structure, age, build, gender presentation, visible permanent marks). `protectedDimensionsFor(authorizedFields)` subtracts **only the exact authorized leaves** — authorizing hair color exempts hair color alone (never length, texture, style, hairline, or skin tone); authorizing hair style exempts style alone; authorizing jawline exempts jawline alone (never face shape or cheekbones). An unmapped field subtracts nothing. Exhaustively unit-tested over the authorizable union.
- **Frame-aware per-dimension verdicts (correction 4):** the validator returns a **strict per-dimension schema**, not a broad boolean: exact JSON, one entry per queried dimension, value ∈ `"unchanged" | "changed" | "not_observable" | "uncertain"` (`responseMimeType: 'application/json'`, small `maxOutputTokens`, `TEXT_ECONOMY` via `withTextQueue`, `withTimeout` ≈15s). A per-frame **expected-observable set** is defined in code: for a headshot↔headshot comparison — skin tone, every face leaf, eye color/shape, brows, hair color/style/texture, in-frame hair length, and facial marks are expected-observable; **build and out-of-frame marks are not** — the gate never claims to have visually verified them, and they remain protected by the typed patch + atomic document commit (which is the real guarantee for non-visual fields). Decision rules: any expected-observable protected dimension reporting `changed` **or** `uncertain` → verdict fail; `not_observable` on an *expected-observable* dimension → treated as uncertain → fail; `not_observable` on a non-expected dimension → acceptable; a missing dimension, an unknown dimension, or any parse deviation → `checked: false`, never a pass. Authorized dimensions are stated in the prompt as **EXPECTED — do not count as a difference** and are excluded from the failing set regardless of their reported value.
- **Decision contract:**
  - all rules satisfied → pass → upload → commit.
  - verdict fail → **one** isolated regeneration (retry contract above), re-gate; a second fail → typed `TRPCError(PRECONDITION_FAILED)` with the drift refusal copy — the credit layer refunds and appends `refundTruth`.
  - `checked: false` → one re-check of the same candidate; still unchecked → the verification-unavailable copy — refund, no upload, no commit. **Fail closed** — a deliberate inversion of `backViewGate`'s fail-open house rule: that gate risks one view's asset, this one guards identity authority; R2's fail-safe principle governs.
- **Copy** (`refusalCopy.ts`): drift — *"The edited image didn't preserve {name}'s identity — only the requested change may differ. Nothing was saved."* Verification unavailable — *"The edit couldn't be verified just now — nothing was changed. Try again in a moment."* (The truthful refund sentence is appended by the credit layer.)
- **Force hook:** `IDENTITY_GATE_FORCE_FAIL=1` (mirroring `BACK_VIEW_GATE_FORCE_FAIL`) for the live drive; never ships enabled.
- **Test doubles:** the validator is one mockable module boundary; the prompt builder, `protectedDimensionsFor`, the per-frame expected-observable sets, and the strict per-dimension parser are pure and unit-tested (parser against a malformed corpus); the storage layer is mockable with upload/delete call counting; no unit test calls Gemini or a database.

## 8. Credit and persistence sequence (identity edits, post-W5)

**Door 1 — free-text/reference iterate (`castingRefinement.ts`):**

```
authorizeEditRequest ── refused? ──► free typed refusal (no records, no charge)
        │ pass
createGeneration (audit row; failure ⇒ refuse free)
        │
withAtomicCredits BEGIN ── deductCredits (charge, reference gen-<id>)
        │
   iterateModelRaw ── generate RAW candidate (bytes, NO upload)
        │               (session scoped userId:modelId; anchor includes schema)
   editGate(source = pre-edit image, delta = typed patch)
        │── verdict fail ⇒ clear THIS model's session ⇒ ONE isolated
        │                  regeneration from the ORIGINAL source ⇒ re-gate
        │                  └─ still fail / unverifiable ⇒ THROW
        │ pass                                  │
   upload passing candidate ONLY (tracked key)  └─► auto-refund (refund:gen-<id>)
        │                                           with truthful copy · audit row
withAtomicCredits END                               → failed. NO upload happened,
        │                                           NO document write, NO asset row,
        │                                           NO revision, NO stale flags —
        │                                           nothing durable exists anywhere.
commitIdentityEdit (ONE transaction):
   preference patch + schema write + masterPrompt fragments
   + anchor asset row (role anchor, new identityRevisionId)
   + sibling stale flags (pinned included)
        │  commit throw ⇒ recordRefund(refund:gen-<id>) + best-effort delete of the
        │                 tracked passing upload + honest error
updateGeneration → completed
   (a failure AFTER commit is a logged audit gap; the result stands — never refunded twice)
```

**Door 2 — structured recast (`executeApplyModelEdit`, non-rerun):**

```
buildStructuredPatch ── refused? ──► free typed refusal (before deduction)
        │ pass ── computeIdentityCommit (pure; generation doc)
deductPoints (charge, reference apply-edit-<id>) · createGeneration audit row
        │
   generateCastingImageRaw ── ONE fresh NEW-mode identity (bytes, NO upload)
        │  (intentional recast: no comparison with the old person's face)
   upload candidate (tracked key)
        │
commitIdentityEdit + board landing (ONE transaction:
   document + anchor + revision + sibling stale
   + node stamp + version row + downstream stale)
        │  commit throw ⇒ recordRefund + tracked-upload delete
updateGeneration → completed
```

The recast path is not an identity-gate bypass: it is explicitly a different product operation whose purpose is to cast a new identity from the panel settings. `intent:'rerun'` is another deliberate re-roll classification. Refresh, add-views, and mint consume whichever anchor the user deliberately accepted through the relevant operation.

## 9. Explicit exclusions (R7)

Durable server-backed generation jobs · a canvas node linked to a pre-headshot cast across close/reopen/**reload** · reopening Casting into an accurate in-flight job · Add-Views leave-and-resume beyond same-tab modal dismissal · true rollback/revision-history UX · composer/canonical-reference architecture for sibling drift · conversational clarification for structured identity attributes · the locked/minted Cast Profile viewer · explicit 1K/2K generation-time quality choice and reusable 2K derivatives · broader error-modal, fork-modal, first-run, and **recast-versus-iterate mode separation/confirmation** · refund-ledger concurrency hardening · the strip-first package-health **controls** (§9.1 — W5 ships the status truth only).

### 9.1 Planned R7 UX — the strip as the primary package-health surface (founder-directed 2026-07-17; shape recorded here, not built in W5)

Target: routine package care happens **on the view strip** without opening Package Health.

- **Per-slot affordances** (on the slot's own surface — hover/selection in the strip, house language, no new chrome class): stale → `Refresh · {price}`; failed → `Retry · {price}`; missing → `Add view · {price}`; refreshing → progress only, no actions; current → nothing. Every price is server plan truth at the moment of the click (`refreshSlotsPlan` / `mintPackagePlan`, D-15) — never a client literal, never a stale cached figure at fire time.
- **Aggregate:** when >1 slot is actionable, the strip's summary segment offers `Refresh all · {total}` — one deliberate confirm, per-slot named-and-refunded failures (existing `refreshSlots` contract).
- **Never automatic:** no state transition, no reopen, no landing ever fires a refresh or moves credits; every spend is a priced, explicit click (D-15's deliberate-spend covenant — reaffirmed by this direction).
- **Package Health demotes to the optional detailed summary:** version thumb-strips/restore, mint-integrity blocker detail, pinned-stale unpin flow, and the bulk plan overview. The strip links into it ("Details"); nothing routine *requires* it.
- **Server side is already sufficient:** `refreshSlots` (per-angle, priced, refund-honest), `mintPackage mint:false` (add missing views), the plan procedures, and the D-58 in-flight registry all exist — this is a client UX build, which is why W5-B deliberately lands the five-state truth and the per-slot in-flight marks first: R7 attaches controls to states that are already honest.
- **Open design questions for the R7 pass** (rule at design time, not now): pinned-stale presentation in the strip (unpin inline vs route to Package Health); whether the ghost slot's add-view keeps routing through the tier dialog or gains a direct priced confirm; strip affordance density vs the restrained-editorial rule (D-34's no-chrome spirit applies to canvas nodes, but the strip is a workspace surface — still, less is more).

## 10. Fable review gates for Codex

1. **After W5-A, before any UI batch:** staged diff + full test output + the graded eight-leg calibration matrix. Same-person iteration legs 1–2 must preserve the person, injected drift legs 5–6 must refuse, unavailable must fail closed, and retry must be isolated. Structured recast legs 3–4 must succeed with exact persistence/credit/audit truth; they are not graded for old-person preservation.
2. **After W5-B + W5-C + W5-D (the small client batches together):** staged diff + drive clips for banner, strip, naming, and the variation edge.
3. **After W5-E:** staged diff — the export change is product-visible and pins founder-ruled copy; Fable checks no backend capability was deleted.
4. **After W5-F:** staged diff + the post-close drive evidence for both outcomes — and immediately if W5-F's stop condition (a different root cause for the missing notice) triggers.
5. **Before the final report:** `pnpm check`, the focused W5 tests, the **full** unit suite, and the bounded browser drive rerun; exact credit-ledger assertions attached wherever money moved.

Prefer these six coherent batches; do not split further. The identity gate (W5-A) is the reason W5 exists — it ships first and is never bundled behind UX polish.

---

*Investigation verified at `9799dbe` by Fable 5, 2026-07-17. Produced under `CLAUDE_R6_W5_INVESTIGATION_AND_PLAN_PROMPT.md`. No product code, commits, pushes, deployments, production data, or credits were touched. This file is deliberately left uncommitted for Codex to execute from.*
