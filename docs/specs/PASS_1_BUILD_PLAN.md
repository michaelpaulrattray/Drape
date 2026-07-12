# Canvas Pass 1 — Build Plan

**Inputs:** revised `CANVAS_FOUNDATIONS.md` + `DESIGN_SYSTEM.md` (the what), `CANVAS_AUDIT_ADDENDUM_V2.md` (verified code facts), `DECISION_LOG.md` (ratified 2026-07-10; Groups 6c/6d ratified 2026-07-11), `RULING_4_ASSESSMENT.md` (ratified 2026-07-11). This document is the build order: who-does-what-when, honest sizing, and the founder checkpoints.

> **RESEQUENCED 2026-07-11.** M1–M4 shipped and their history is preserved below. The founder's D-32…D-37 rulings (VC2 driving + ElevenLabs Flows study) restructured everything after M4: casting authoring moves off the canvas into an overlay-hosted takeover environment (D-35, Option B), the canvas receives finished reference assets, and the original M2b/M5–M10 are replaced by **R1–R7**. Old milestone sections live in git history (P-1).

**Two shape requirements from the original ratification, and their current status:**

1. **An interactive cast node reaches the founder as early as possible, even rough.** Honored — VC2 delivered 2026-07-11, loop confirmed working.
2. **Zoom-tier thresholds tuned by feel (D-1/D-2/D-3).** Superseded — D-37 retired the tier system entirely (spatial constancy); the VC1 threshold work is moot.

**Working agreements (apply to every milestone):**

- Gates before a milestone is "done": `pnpm check` clean, `pnpm test` green, `scripts/verify-canvas.mts` invariants green, and the milestone's checkpoint delivered (screenshots via the headless-drive recipe where useful; live `pnpm dev` walkthrough for feel checkpoints).
- Two mechanical guards (permanent architectural boundaries per the 2026-07-11 D-24 re-ratification): **(a)** no import of `useCastingFormStore|useCastingGenerationStore|useCastingUIStore` under `features/boards/**` — the takeover is `features/studio`-scoped code *hosted* by the board page; **(b)** no numeric literal adjacent to the word `credits` in canvas client code (D-15).
- One commit-worthy state per milestone; `/studio?tool=casting` is smoke-tested after any milestone that touches casting code (R1, R2, R3, R6).
- Push milestones to the deploy branch (`git push origin main:local-migration`) as they land — the founder is the only production user during pass 1.
- Checkpoint feedback is folded in before the next milestone starts when it's cheap; logged as polish-pass items when it isn't.

---

## Milestone map

| # | Milestone | Size (focused days) | Checkpoint |
|---|---|---|---|
| M1 | Tokens, shell primitives, zoom-tier mock | ✅ shipped 2026-07-10 | VC1 + VC1.5 ruled |
| M2a | Generation-hook refactor (audit A1) | ✅ shipped | — |
| M3a | Schema migration + boardOps core + job store | ✅ shipped | — |
| M4 | First interactive cast node | ✅ shipped | **VC2 ruled: loop works** (+ trust batch, D-31 geometry) |
| — | D-32…D-37 application (picker modal, chrome strip, tiers retired) | ✅ shipped 2026-07-11 | — |
| R1 | **Casting takeover** (overlay-hosted environment, mint → board landing) | 2.5–3 | **VC-R1 — drop → picker → Cast new → environment → mint → root lands** |
| R2 | Server prompt parser + prerequisites (old M2b, as ruled by D-33) | 2 | async — prompt → parsed attributes in the environment |
| R3 | Edit path + identity events (minted-edit session mode, `applyModelEdit` → D-11) | 1.5–2 | **VC-R3 — edit a placed cast, watch the stale flow** |
| R3b | **Identity package + tiered mint** (D-39: ¾ view, back gate, Draft/Core/Production dialog, package read model) | ✅ built 2026-07-11 | **VC-R3b — mint through the tiers** |
| R4 | Canvas grammar: toolbar, fork/recast, variations, delete+undo, keyboard incl. Cmd+C/V→Duplicate (old M6) | ✅ shipped 2026-07-12 | **VC-R4 ruled: grammar passes** (+ fix batch, D-47…D-49) |
| R5 | Edges, refresh/pin, snapshots, character sheet + composer (old M7 + D-29 as amended by D-39 + D-30; **identity-edit staleness deleted by D-43** — per-tile quality refresh, pins, and aggregate refresh remain) | 2.5–3 | **VC-R5 — lineage and the sheet** |
| R6 | First-touch (old M9) + **full environment restyle to canvas language** (named slot; scope amended 2026-07-11 to include the panel header, progress donut, and viewer/master-prompt chrome) | 3–3.5 | **VC-R6 — first-run + the environment in Drape's language** |
| R7 | Hardening + success-criteria sweep (old M10; **watch for silent-audit-gap failures** — the bug-4 class where an action applies but its audit write dies) | 1.5 | Dogfood start |
| | **Remaining total** | **≈ 17.5–20 focused days** | |

The pre-ruling plan had 18–19.5 days remaining with M8's from-scratch `RefinementStudio` as the riskiest item; the R-sequence deletes that build entirely (the existing studio casting flow *is* the environment) and absorbs M5's canvas popovers into R3's environment-side identity events.

---

## R1 — Casting takeover → **VC-R1**

**Goal (D-35, Option B):** the full casting flow becomes: drop cast node → picker modal → "Cast new" → the complete casting environment opens as a TAKEOVER in the image-viewer overlay pattern (near-full-screen, slim frame, back/close, Esc with unsaved-work confirmation), containing full studio capability. On mint it closes back to the untouched board and the finished cast lands on the originating node.

Build:
- `features/studio/takeover/CastingTakeover.tsx` — the overlay shell: slim top bar (title, close; Esc), light studio climate, board stays mounted underneath. Shell conventions from the double-click image viewer (`ruling4-takeover-pattern-image-viewer.png`).
- `features/studio/components/CastingWorkspace.tsx` — the casting surface composed from the existing parts (`ControlPanel` + `ImageViewerPanel` + `MasterPromptPanel`, `useCastingCanvas`, `useLegacyCastingBindings`, `useCastingGeneration`, `useCastingViewGeneration`, `StageLockModal`, `CreditTopupModal`). `DrapeStudio` swaps its inline casting block for the same component — one casting surface, two hosts.
- Reset-on-open: the `useStudioEntry` casting-new reset block extracted into a callable shared by both entries.
- Mint path: `useCastGate` gains an `onMinted` override — in the takeover, mint ends with `boardOps.fillFromLibrary(itemId, modelId)` → close → the root fills in place (existing landing op, shipped M4).
- Esc/close with in-progress work → confirmation dialog (red confirm per D-8 — abandoning paid in-progress state is the "stop" moment); clean close when nothing is at stake.
- Picker modal's "Cast new" opens the takeover (click-to-open is permanent — founder ruling; the interim prompt+Run tab retires).

**VC-R1 (founder, live):** the full loop — drop, picker, Cast new, takeover opens, configure + generate in the environment, mint, land, board untouched. What's being felt: the open/close transition (the point of the ruling), the environment's completeness, the landing moment.

Gate: `pnpm check`, `pnpm test`, guards, verify-canvas drive, studio smoke (`/studio?tool=casting` full flow).

## R2 — Server prompt parser + prerequisites (old M2b, as re-scoped by D-33)

**Goal:** the parser ships fully server-side, tested against the gold standard; it surfaces as the "from prompt" option inside the create path (the environment), never as a node face.

- `BrandSelector` extraction + redesign (DS §13.6); `ControlPanel` swaps to it. Constants dedupe (audit H, minding `EYE_PRESETS.image`). Export `PRESETS`/`SNAP_THRESHOLD`.
- Parser prerequisites: `Mediterranean` in `ETHNICITIES`; six `*Override` fields on `ModelPreferences`; override-preferring reads in `buildNewPromptContent`.
- `server/casting/promptParser.ts`: system prompt + response schema from `PARSER_PROMPT_V2.md`, through `withTextQueue` + circuit breaker; dispatch inside `boardOps.runGeneration` (which remains the server op — the environment calls the same engine functions). Test suite against `PARSER_GOLD_STANDARD_V2.md`; canaries (Tests 16, 25) are hard assertions; model escalates only if canaries fail (D-14).
- "From prompt" in the create path: a sentence field in the environment that parses into the attribute controls (prefill, not bypass).

Checkpoint (async, screenshots): a sentence → parsed attribute values visible in the environment's controls.

Gate: `pnpm check`, `pnpm test` (parser suite green), studio smoke.

## R3 — Edit path + identity events → **VC-R3**

**Goal:** post-cast editing consolidates in the environment (D-34); saving changes to a placed cast is a D-11 identity event, full stop (founder ruling 2026-07-11 — no separate "amend mode" concept).

- Edit entry on the placed root (control strip / `···`) → takeover opens with the model loaded (the gallery-hydration path exists in `CastingWorkspace` — reuse).
- **Minted-edit session mode (ratified 2026-07-11):** the studio's linear stage-lock (`isViewLocked` chain + `StageLockModal`) is disabled for minted-edit sessions; every save routes through `applyModelEdit` → the D-11 dialog. The mode flag lives in **shared workspace state** (not the takeover shell) so a `/studio` resume of the same session carries identical routing — session bleed can never bypass the dialog.
- `boardOps.updateAttributes` with both cross-field invalidation rules (gender reset AND hair-style cascade, audit D1), ethnicity dual-write (B4) — fired from environment saves.
- `boardOps.applyModelEdit(itemId)` landing op: restamps the node (image, version row `tool:'attributes'|'rerun'`, provenance) and fires the D-11 dialog — update-with-cascade / fork-as-new-model / keep-old+pin. Node version rows remain the canvas-side ledger, stamped only by landing ops (extends D-23). Landing renders optimistically per D-38.
- Downstream staleness wiring (consumed fully in R5; until package views exist, the dialog's cascade set is empty and applies directly).

**VC-R3 (founder, live):** place a cast → Edit → change identity in the environment → save → the D-11 dialog → watch the root update. What's being felt: the takeover as an editing room, dialog copy, trust in the identity event.

Gate: full gates + studio smoke.

## R3b — Identity package + tiered mint (D-39) → **VC-R3b**

**Goal:** the canonical six-slot package (face cluster: front/side/¾ close · body cluster: front/side/back full) and the mint dialog that prices it honestly.

- **Three-quarter view** (net-new): prompt config + `viewType` value + cost entry + studio plumbing.
- **Back-view identity gate:** adapt `checkIdentityMatch` (silhouette/build/hair vs headshot + full-body front); one auto-retry, then fail named-and-refunded. Replaces the "No new back tattoos" text plea.
- **Tiered `CastModelModal`:** Draft (headshot, +0 — exploring candidates) / Core identity (+side, ¾, full-body front — ready for downstream work) / Production sheet (all six — full comp card for scenes/video); costs from a server `plan()` per D-15; copy states upgrade-anytime-at-same-cost so Draft isn't a trap.
- **Package as model property:** additive `model_assets` columns (status, pinned, provenance stamp) — the single staleness ledger (D-29 as amended); package-completeness read model.
- **Composer slot-recording:** D-30's composer records which slots each generation used in its `InputSnapshot`; the ~5–6 reference-image budget is enforced here (multi-model scenes: headshot + one task-relevant view per model). *(Status: per-asset `provenance` (inputs + engine + tier) shipped with R3b; the composer's own `InputSnapshot` moves with the composer to R5 — nothing to record against until it exists.)*

**Shipped 2026-07-11:** `shared/boardTypes` package contracts (`MINT_TIER_SLOTS`, slot labels), `threeQuarter` view (prompt + enum + plumbing), `backViewGate` (headshot-only comparison — the full-body front generates in parallel so it can't be a gate input; fails open on infra errors), `mintPackage` plan/execute/packageState (missing-slots pricing, upfront deduct, per-slot named-and-refunded failures), tier-picker `CastModelModal` + single-call `useCastGate`, migration `0003` (dev applied; **prod pending — see Dependencies**). Drive invariant G covers the tier costs, Core mint, ledger-vs-balance agreement, and the packageState route.

**VC-R3b (founder, live):** cast through each tier; force a back-view failure to see the refund copy; upgrade a Draft to Core from the environment.

**VC-R3b fix batch (2026-07-12):** (1) six-slot hydration — `buildHistoryFromAssets`'s legacy trio whitelist hid half a Production package on re-edit; plus `createGeneration` newest-row id lookup collided under the parallel mint (four rows stuck `processing` — the silent-audit-gap class) → `$returningId()`. (2) D-11 baseline now written by hydration from the payload that fills the form — zero-edit save is a quiet no-op (invariants E1b/H3). (3) Upgrade path built: minted strip = six package slots, ghosts open the tier dialog in upgrade mode (remaining-slots pricing; invariants H4–H7). (4) Leave dialog above the z-40 loading overlay; mid-generation copy states the cast continues to the draft. `BACK_VIEW_GATE_FORCE_FAIL=1` env hook for live refund verification. Drive now A–H (~1,850cr paid run).

Gate: full gates + studio smoke.

## R4 — Canvas grammar: toolbar, fork/recast, variations, delete+undo, keyboard → **VC-R4**

Unchanged from the old M6, with rerun/recast routing through the identity dialog (R3's path):

- `NodeFloatingToolbar` wiring (screen-legible per D-37), type-scoped action sets.
- `ForkRecastPopover` (DS §7.4) + `boardOps.forkRoot`/`recastRoot` (`forked_from` edges; recast = identity event, red confirm per D-8).
- `boardOps.runVariations` (plan → confirm → N sibling roots, `variant_of` edges).
- Delete: cascade-confirm dialog (cascade populated in R5), soft delete + Undo toast + `Cmd+Z`; move-undo stack; arrow nudge; Esc layer stack (now including the takeover layer); `Cmd+A`; full Decision-7 table. **`Cmd+C`/`Cmd+V` alias Duplicate for same-board** (founder ruling 2026-07-11); cross-board paste is a logged future D-16 amendment, not R4 scope.
- Duplicate, Download, Info (minimal provenance readout via `ImageFallback`).

**VC-R4 (founder, live):** the grammar tour — rerun→fork a root, spawn variations, duplicate, delete, undo, nudge, Esc everything.

**Shipped 2026-07-12:** `runVariations` plan/execute (parallel candidates, per-candidate named-and-refunded, `variant_of` edges, plan positions as the optimistic-temp contract), fork/recast as `applyModelEdit` intents (`tool:'rerun'` version rows; recast sealed on minted per D-43 — the popover explains, the server refuses), six-slot toolbar on cast + image nodes (type-scoped), `ForkRecastPopover`/`VariationsPopover` (plan-priced), delete trust net (ALL canvas deletes off the legacy hard `boards.deleteItem` onto soft `boardOps.deleteNodes`; cascade dialog carries the app's one red confirm; undo entry pushed at mutate time so Cmd+Z has no dead window at AU latency), move/nudge undo batching, full Decision-7 keyboard (Esc layer registry incl. node popovers; Cmd+C/V→Duplicate same-board; RF a11y arrow-move disabled to prevent double-nudge), `boardOps.listEdges` (client cascade knowledge now, edge rendering feed for R5), D-45(1) takeover-header balance. Drive extended: J (delete→undo round trip, soft-not-hard asserted), K (duplicate), L (paid variations landing + ledger + stuck-processing guard). **Flag for VC-R4:** DS §5.11's "library_cast: Rerun/Variations disabled" predates D-35 — post-R1 every placed cast is `library_cast` provenance, so R4 treats a model-backed library cast as root-grade for the grammar; §5.11 needs a one-line amendment on ratification.

**VC-R4 ruled (founder, 2026-07-12): the grammar passes** — toolbar, fork-beside, delete/undo, keyboard, Esc stack. Same-day batch: five fixes (credits label, Info-panel human formatting + schema Copy, Spec-tab hydration, 4px click-vs-drag threshold, marquee select), rulings D-47 (Select/Hand pointer split + Space-hand), D-48 (variations-below is semantics, not preference), D-49 (frames tool retired until pass-3 export units), delete-cascade semantics confirmed as implemented, and two future-pass log items (board chrome cluster; board-agent capability bar). See DECISION_LOG Group 6f.

Gate: full gates.

## R5 — Edges, stale/pin, snapshots, character sheet + composer → **VC-R5**

The old M7 with D-29 (as amended by D-39: the package and its staleness/pins live on `model_assets`, built in R3b — the sheet *reads* the model's package; `cast_view` board rows never ship) and D-30 folded in; view-card spawning removed:

- **Doc pre-work (scheduled here per the ratification):** foundations 3b/3e + success criteria 5/6/8 rewritten; DS gains §5.17 (character sheet) with touches to §5.11/§9/§12.
- `CharacterSheetImageArea`: fixed comp-grid templates by slot count, empty slots render add-view affordances (D-39c — upgrade anytime, no re-cast); tiles image-only at rest; tile click → `CanvasPopoverContent` (label · vN, status, `Pop out` · `Refresh · ~cost` · `Pin` · `Open in environment`); per-tile status dots (screen-legible); aggregate `{N} stale` strip segment → bulk-refresh plan dialog.
- Pop out / collapse (pop-outs are board items **referencing model assets** per the D-39 ratification; edge re-anchoring with `viewAngle` preserved in edge metadata). **Pop-out materialization MUST write the `generated_from_cast` edge** — R4's delete-cascade dialog (client prediction and server unit) keys off exactly that relation and activates with no further wiring (VC-R4 confirm).
- View generation lives in the environment (R1's capability); results land as sheet tiles. No standalone view-card spawning, no canvas views popover.
- Edge rendering (default 40%, full on endpoint selection); `generated_from_cast`/`forked_from`/`variant_of` visible lineage.
- Refresh flow (as reduced by D-43 — identity-edit staleness no longer exists): per-tile quality refresh with plan-derived costs, pin exemptions, aggregate refresh; the stale machinery (`NodeStatusBadge` stale variant, `markNodeStatus`) stays built as pass-2 infrastructure. D-12 amendment enforced (`ImageFallback` everywhere, consuming ops fail named-and-refunded).
- `composeIdentityPayload(modelId, intentViewAngle)` in `server/casting/` (D-30 strategy b: current headshot + intent view + `buildIdentityAnchor` text), provenance manifest with verbatim `identityText`; stale-input rule (plan flags unpinned stale intent views; pinned used silently).

**VC-R5 (founder, live):** generate views in the environment → sheet renders → change identity → Update later → tiles go stale → refresh one, pin one → recast → pinned tile exempt. What's being felt: the sheet as one board object, staleness as information, pin gesture.

Gate: full gates.

## R6 — First-touch + environment restyle → **VC-R6**

Two named halves (restyle slot per founder ruling 2026-07-11 — not an unscheduled "later"):

- **First-touch (old M9):** first-run intro (DS §11.1, `canvasIntroSeen` on the profile; the CTA opens the picker modal), returning-user hint, empty-library state, picker completion (filters per the ElevenLabs reference, Add-menu placement path, garments-tab prep), board `thumbnailUrl` freshness (D-27), lobby card verification.
- **Full environment restyle (~1.5–2d of this slot; scope amended per founder, 2026-07-11):** the warm studio surfaces inside the takeover move to the canvas language — DS §13 redesign of the lifted components (`TriBlendSelector`, `EthnicityBlender`, `SkinToneGrid`, `HairColorWheel`, `EyeGrid`, `WarmSelectControl`, section/row primitives) applied in place, **plus the panel header block, the progress donut (`CastingProgressRing`), and the viewer/master-prompt panel chrome**; D-40's feedback-inline principle encoded in `DESIGN_SYSTEM.md`; `/studio` dissonance check retired with it. (The D-41 surfaces — `EngineChoiceChip`, `ParseSummaryStrip`, sweep — shipped in canvas language already and are not restyle scope.)
- **R6 pile from VC-R3 (founder, 2026-07-11, log-only until this slot):** (a) the takeover's top-right primary slot is doing double duty — "Cast this model" (fires a paid generation) and "Save changes" (routes to a decision dialog) share coordinates across modes; different action weights shouldn't wear the same position — rethink primary-action placement. (b) The admin panel's green Add-Credits button is a colored action off-language, and the stock error toast still renders in admin surfaces — bring both into the restyled system. (c) Version-strip redesign (the v-chip form feels dated) — pending the immutability ruling's v-chip recommendation.
- **R5-era accumulation (ruled 2026-07-12 — Groups 6g–6i + D-53; the R6 planning session prices and sequences these):**
  - **D-53 rider (~2–2.75d, rides the restyle of the same surfaces):** A1 stage 2 (fork-guidance UI + the stale-writer for identity-classified draft edits) + A3 (`restoreSlotVersion` copy-forward, tile-popover version thumb-strip, legacy casting undo/redo retired with hold-to-compare kept, viewer vN unified onto the ledger count). **Motivating case (VC-R5 F6, founder-confirmed): a divergent edit to one draft view leaves siblings visibly inconsistent with nothing marking or offering the fix — until the stale-writer lands, draft packages silently diverge.** Also in this territory: F5's iterate-can-ADD discoverability (rotating placeholder examples on the refine field; explicitly NOT a selector).
  - **D-50.3 Tidy up** (v1 spec banked in Group 6g; Cmd+Z-reverses-the-whole-tidy is a ratified requirement).
  - **D-51 strip-verb visual treatment** (state logic shipped in R5; visuals were scope-guarded to here).
  - **Spatial environment work area** (Group 6i design-direction note): camera-on-a-fixed-composition in the canvas image viewer's language — price BOTH the full version and the cheap fallback (viewer bg + scroll-zoom on the existing layout). The viewer's `#FAFAF8` + dot grid is the founder-flagged restyle reference for canvas backgrounds generally.
  - **A2(a) library-card chooser** (View comp card [static `CharacterSheetImageArea` reuse] / Open in casting / Dress in wardrobe), ~0.5–1d.
  - **Note nodes design pass** (typography, sizing, the yellow) + **out-pin discoverability** (grow/ink on hover or selection) + **FailedSlot amber verdict** (the named third hue, from D-46's R6 log) + **D-45(2)** board profile popover with balance.
  - **Close-out addendum (Group 6i, 2026-07-12):** `/studio` shell unification assessment (one environment, one look, two doors; relocate load-bearing functions, kill the legacy sidebar) **with the wardrobe seam stated explicitly** (inherits clean chrome or carved out until pass 2 — see `WARDROBE_ARCHAEOLOGY.md`; wardrobe itself is OUT of R6 scope, binding); Export tab → "Export identity pack" verb (joins the A2(a) chooser + card right-click; ships against the current export implementation); **D-54** double-click routing (tiles → environment focused on that view; D-52 viewer stays for image-class cards); D-38 straggler (iterate result carries across the environment close optimistically); pin naming collision (out-pin vs slot-pin — rename one).
  - Perf log-items if convenient: `listCastableModels` N+1; `packageState` batch endpoint (Group 6g R5 build log).

**VC-R6 (founder, live, fresh account or reset flag):** brand-new board → intro → cast the first model through the picker + takeover, now in Drape's language → lobby thumbnail check.

Gate: full gates + studio smoke.

## R7 — Hardening + success-criteria sweep → dogfood

- Walk all 15 success criteria in `CANVAS_FOUNDATIONS.md` §10 (as rewritten in R5/R7 for the takeover + sheet model) on a real board; fails become fix-or-log decisions with the founder.
- Full-suite gates; `pnpm build` sanity; headless golden path (drop → picker → cast in takeover → mint → land → views → stale → edit → back).
- Sweep: dead code from retired components (`ModelEditorOverlay`, `NodeContextMenu` remnants, `AddNodeMenu` if superseded), TODO audit, `DECISION_LOG.md` updated with checkpoint-driven amendments.
- Team dogfooding starts; friction notes accumulate for the polish pass.

---

## Dependencies and parallelism

- Hard chain: R1 → R3 (Edit needs the environment) → R3b (tier dialog sits in the takeover; the D-11 dialog shell precedes it) → R5 (the sheet reads R3b's package; stale flow needs R3's identity events). R2 ∥ R3 (server parser vs edit path — different layers). R4 mostly independent after R3 (rerun/recast route through the identity dialog). R6's restyle touches R1's surfaces — sequence after VC-R1 feedback settles. Everything → R7.
- **Prod migration timing:** R3b added migration `0003` (additive `model_assets` changes: `threeQuarter` enum value + `pinned`/`status`/`provenance` columns; applied to dev 2026-07-11). It must run against prod (`pnpm db:push` with `MYSQL_PUBLIC_URL` pasted inline) **before** `local-migration` syncs past R3b — the new `createModelAsset` insert names those columns, so deploying first breaks every view generation. Deploys continue per-milestone to `local-migration` otherwise.

## Risks, with handles

- **Takeover/studio dual-hosting divergence** — one `CastingWorkspace`, two hosts; any drift is a wiring bug. Studio smoke after every casting-adjacent milestone.
- **Store lifecycle in the takeover** (reset-on-open vs shared session autosave): a half-finished takeover session resumes in `/studio` and vice versa — one casting session wherever you enter it. If dogfooding shows confusion, isolation is a scoped-storage-key change, not an architecture change.
- **`$returningId` id-lookup class (R7 sweep target):** `createGeneration` returned the caller's *newest row by `createdAt`* instead of the inserted id — under the parallel mint, five concurrent inserts all got one id and four audit rows stuck `processing` forever (fixed at VC-R3b with `$returningId()`). `createModel` (`server/db/models.ts:32`) and `createModelAsset` (`:309`) still use the same newest-row pattern; harmless today (returns unused or non-concurrent) but they are the same latent bug — convert both to `$returningId()` in R7 and grep for any other newest-row-after-insert lookups.
- **Parser quality on the chosen model** (D-14): canaries decide early (R2 day 1); escalation is a model swap behind one function.
- **Sheet template edge cases** (D-29): fixed comp-grid templates by view count keep this bounded; pop-out covers anything a template can't.
- **Scope pressure:** cut-line order if the days slip: picker filters (R6) → first-run intro (R6, fast-follow) → environment restyle (R6, → polish pass, but it stays a *named* item per the founder's ruling). Fork/recast, pin, undo, cost display, and the identity-event flow are not cuttable — they're the ratified trust layer.

---

## Shipped-milestone history (M1–M4)

> **M1 (2026-07-10):** canvas tokens, 14 shell primitives, zoom-tier system + density mock. **VC1:** thresholds 0.45/0.35. **VC1.5:** `NodeAttributeBlock` synthesis, six attributes. *(Tier system and attribute block since retired by D-37/D-34 — 2026-07-11.)*
>
> **M2a:** `useCastingGeneration`/`useCastingViewGeneration` decoupled via the `CastingBindings` interface; both `setCanvas` side-effects deleted; studio passes store-backed bindings.
>
> **M3a (commit 968d47e):** `board_edges` + `kind`/`deletedAt` migration (applied to prod 2026-07-10), provenance-aware backfill, `boardOps` plan/execute spine with server-side cost derivation, `boardState.getSnapshot`, `useGenerationJobs`.
>
> **M4 (commit b923853, VC2):** CastNode + controller + ImageNode + kind-routing, `FloatingToolPill`, library picker + `fillFromLibrary` (D-28), `BoardCastingPanel` deleted. **VC2 ruled (2026-07-11): the core loop works.** Trust batch (76954c1): generating-state precedence, wheel=zoom, optimistic create + local-position ledger, unified creation path, width parity. Permanent regression drive `scripts/verify-canvas.mts`. **D-31:** 3:4 image area, 280/200 widths.
>
> **D-32…D-37 application (d94d8ae, 2026-07-11):** `CastPickerModal` front door (BoardPage-hosted), attribute chrome + inline prompt deleted, zoom tiers → `canvasZoom.ts`, temp-id resize guard. Queued from VC2 into R-sequence: library-cast attribute hydration (→ R3, hydration now happens in the environment), residual jank characterization (→ R7).

**End of build plan. Next action: R1 — `CastingTakeover` shell.**
