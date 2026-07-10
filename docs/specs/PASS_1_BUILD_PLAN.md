# Canvas Pass 1 — Build Plan

**Inputs:** revised `CANVAS_FOUNDATIONS.md` + `DESIGN_SYSTEM.md` (the what), `CANVAS_AUDIT_ADDENDUM_V2.md` (verified code facts), `DECISION_LOG.md` (ratified 2026-07-10 with notes). This document is the build order: who-does-what-when, honest sizing, and the founder checkpoints.

**Two shape requirements from ratification, and how the sequence honors them:**

1. **An interactive cast node reaches the founder as early as possible, even rough.** The plan splits the prerequisite work: only the hook refactor (the true blocker for node-local generation) runs before the first interactive milestone; everything else (parser prerequisites, BrandSelector, constants dedupe, full component redesign) lands *after* the founder can already cast on a board. VC2 — prompt → cast on a real canvas — arrives around day 6–7, not week 3.
2. **Zoom-tier thresholds are tuned by feel before being final (D-1/D-2/D-3 provisional).** VC1 is a seeded-density zoom mock with a live threshold control, built on the real primitives (so the mock is productive work, not throwaway).

**Working agreements (apply to every milestone):**

- Gates before a milestone is "done": `pnpm check` clean, `pnpm test` green, and the milestone's checkpoint delivered (screenshots via the headless-drive recipe where useful; live `pnpm dev` walkthrough for feel checkpoints).
- Two mechanical guards run from M3 onward (add as a tiny script or grep in CI later): **(a)** no import of `useCastingFormStore|useCastingGenerationStore|useCastingUIStore` under `features/boards/**` (D-24); **(b)** no numeric literal adjacent to the word `credits` in canvas client code (D-15).
- One commit-worthy state per milestone; `/studio?tool=casting` is smoke-tested after any milestone that touches casting code (M2a, M2b, M5).
- Checkpoint feedback is folded in before the next milestone starts when it's cheap; logged as polish-pass items when it isn't. Roughness is expected at VC2–VC4; the checkpoints exist to start the feel loop, not to gate on polish.

---

## Milestone map

| # | Milestone | Size (focused days) | Checkpoint |
|---|---|---|---|
| M1 | Tokens, shell primitives, zoom-tier mock | 1.5–2 | **VC1 — zoom tiers + chip-row density (tune D-1/2/3, re-eval D-19)** |
| M2a | Generation-hook refactor (audit A1) | 1.5–2 | — |
| M3a | Schema migration + boardOps core + job store | 2 | — |
| M4 | **First interactive cast node (rough)** | 2.5–3 (D-28 picker core pulled in) | **VC2 — cast a model from a sentence on a real board** |
| M2b | Remaining prerequisites + prompt parser | 2 | VC2.5 (async) — parsed chips fill in |
| M5 | Lifted-component redesign + chip popovers + attributes op | 2.5–3 | **VC3 — the tactile loop** |
| M6 | Toolbar, fork/recast, variations, delete+undo, keyboard | 2.5 | **VC4 — the grammar** |
| M7 | Views, edges, stale/pin, snapshots | 3 | **VC5 — lineage and staleness** |
| M8 | Refinement studio (4 tabs) | 4 | **VC6 — the deep path** |
| M9 | Empty states, first-run, library-bridge completion, thumbnails | 1.5–2 (picker core moved to M4) | **VC7 — first-touch experience** |
| M10 | Hardening + success-criteria sweep | 1.5 | Dogfood start |
| | **Total** | **≈ 24–27 focused days (~5 calendar weeks with feedback loops)** | |

The original docs said 2–3 weeks; the audit stretched M1 alone to ~1.5 weeks. Five weeks is the honest number for the ratified scope (which grew: fork/recast, pin, undo, library bridge, empty states, zoom tiers, error states). Nothing here is padding; the cut-line if needed is M9's library bridge → early pass 2.

---

## M1 — Tokens, shell primitives, zoom-tier mock → **VC1**

**Goal:** the design language exists in code, and the zoom-tier architecture is provable/tunable at density before anything is built on it.

Build:
- `client/src/styles/canvas-tokens.css` (DS §2, incl. destructive/warning tokens) + `border-hairline` utilities (DS §4), imported from the main CSS entry. Light-scope container decision wired in `BoardPage` hosting (D-22) — a wrapper, nothing more yet.
- Primitives with no data dependencies: `DottedGridBackground`, `CanvasNodeShell`, `NodeLabelRow`, `CastImageArea` (static states), `NodeControlStrip` (static), `BlenderChipStrip`/`BlenderChip` (visual states only, no popovers), `CostLabel`, `ImageFallback` (DS §5.16).
- `zoomTiers.ts` + `useZoomTier()` (hysteresis included, DS §12).
- **The mock:** a dev-only route or query flag (`/app/board/:id?mock=density`) that renders ~40 seeded fake cast/view/image nodes (static data, no DB writes) through the real primitives on the real React Flow shell, plus a floating dev slider for `ZOOM_TIER_MID`/`ZOOM_TIER_FAR` and a toggle for 5-vs-6 chips on a selected mock node. Throwaway surface, real components.

**VC1 (founder, live `pnpm dev`):** pan/zoom the seeded board; tune the two thresholds by feel; confirm the screen-fixed badge/toolbar behavior reads right at 40%; look at the 6-chip strip on a selected node and rule on the D-19 crowding flag. Output: final threshold constants (committed) + chips 6-or-5 ruling.

> **VC1 outcome (2026-07-10):** thresholds ruled **0.45 / 0.35** and committed. Chip ruling superseded: the filled-pill resting render fails (reads as a second card); architecture retained, resting state redesigned. **VC1.5 added:** three resting-state variants (selection-only pills / collapsed summary line / text-row restyle) shown on the seeded board via a mock panel switcher; founder rules, then `DESIGN_SYSTEM.md` §5.9 is amended and the 5-vs-6 question re-decided in the winning treatment. M5 (attribute popovers) consumes the ruled treatment.
>
> **VC1.5 ruled (same day): the synthesis — summary line at rest, spec-sheet rows on engagement.** Shipped as the `NodeAttributeBlock` primitive (pills deleted); DS §5.9 rewritten; six attributes confirmed. M4's cast node and M5's popovers build on `NodeAttributeBlock`.

Gate: `pnpm check`. (No tests affected.)

## M2a — Generation-hook refactor (audit A1)

**Goal:** `useCastingGeneration` + `useCastingViewGeneration` become parameter-taking; the canvas can call generation logic node-locally.

- Convert both hooks store-reads → params/setters exactly per audit A1; delete **both** `setCanvas` side-effects (`useCastingGeneration.ts:286`, `useCastingViewGeneration.ts:81`).
- `/studio` keeps working by passing the existing stores' values through at its call sites (`DrapeStudio`, `BoardCastingPanel` untouched for now — it dies in M4).
- Smoke: `/studio?tool=casting&new=1` full cast flow.

Gate: `pnpm check`, `pnpm test`, studio smoke. Runs in parallel with M1 if two streams are available; otherwise immediately after.

## M3a — Schema migration + boardOps core + job store

**Goal:** the data layer and the mutation spine exist; still no new UI.

- Drizzle: `board_edges` table; `board_items.kind` + `deletedAt` columns (F §6). `pnpm db:push` against dev.
- Backfill script (provenance-aware mapping table, F §6 / D-26) — written as a runnable script, executed on dev now, prod at cutover.
- `server/lib/boardOps.ts` + `server/lib/boardState.ts` + `server/routes/boardOps.ts` with the cheap operations first: `createNode`, `updateNodeMetadata`, `moveNodes` (wrapping `batchUpdatePositions`), `deleteNode`/`undoDelete` (soft delete), `addEdge`/`removeEdge`, `getSnapshot`, and the `plan/execute` scaffold with server-side cost derivation from `CREDIT_COSTS`.
- `boardOps.runGeneration` v0: composes the existing server casting functions (`generateMasterPrompt` → `generateCastingImage`, R2 store, `board_items` update + version row + provenance stamp with `engine` and empty parse — parser lands in M2b). Registered in `useGenerationJobs` (new store, D-18-shaped job records) with client polling.
- Unit tests: backfill mapping, plan cost derivation, snapshot shape.

Gate: `pnpm check`, `pnpm test`, both mechanical guards live from here.

## M4 — First interactive cast node (rough) → **VC2**

**Goal — the ratification hard requirement:** the founder casts a model from a sentence on a real board. Rough is fine; the loop is the deliverable.

- `FloatingToolPill` with Add → Cast (menu may be Cast-only at this point).
- `CastNode` v0: empty state (auto-select, focused `NodeInlinePrompt`, attribute rows with faint Add values — rows render, popovers don't open yet), Run with `CostLabel` (from `runGeneration.plan`), generating state (job polling → progress), completed state (image, read-only prompt, Edit button present but inert). Prompt goes through as `userPrompt` passthrough — the engine already interprets free text; structured parsing arrives in M2b and simply starts filling the attributes.
- **D-28 (pulled forward from M9):** the empty node's `or choose from your models` link + a minimal Models-only `LibraryPickerPopover` (grid + search over the existing models list procedure), wired to the **fill-in-place** path (provenance → `library_cast`, canonical headshot, initial version row). Constrained to canonical cast reference imagery per DS §7.3. M9 completes the picker (Add-menu placement path, garments tab prep, empty-library state).
- Minimal `ImageNode` (upload/reference/library provenance render path) so backfilled legacy items still display; retire `BoardItemNode` for those kinds.
- **Delete `BoardCastingPanel.tsx`** and the right-panel casting path — inline creation replaces it.

**VC2 (founder, live):** open a board, drop a cast node, type a sentence, watch cost → run → progress → headshot — then drop a second cast node and take the other path: `or choose from your models` → pick → node fills in place. What's being felt: the prompt-to-result loop speed, the empty-node posture with both paths at the node (D-28), selection/border behavior on the real shell. Known-rough list stated up front: attribute popovers inert, no toolbar, no views, Edit inert, picker is Models-only.

Gate: `pnpm check`, `pnpm test`, guards, studio smoke unaffected.

## M2b — Remaining prerequisites + prompt parser → VC2.5 (async)

**Goal:** the deferred prerequisites land; prompts now parse into structured chips.

- `BrandSelector` extraction + redesign in one step (DS §13.6); `ControlPanel` swaps to it. Constants dedupe (audit H, minding `EYE_PRESETS.image`). Export `PRESETS`/`SNAP_THRESHOLD`.
- Parser prerequisites: `Mediterranean` in `ETHNICITIES` (both copies die in the dedupe first); six `*Override` fields on `ModelPreferences`; override-preferring reads in `buildNewPromptContent` (locate by content near `geminiGeneration.ts:253`).
- `server/casting/promptParser.ts`: system prompt + response schema from `PARSER_PROMPT_V2.md`, through `withTextQueue` + circuit breaker; three-path dispatch inside `runGeneration` (randomizer made server-callable). Test suite against `PARSER_GOLD_STANDARD_V2.md` — the two canaries (Test 16 Zendaya, Test 25 overrides) are hard assertions; model escalates only if canaries fail (D-14).
- `runGeneration` first-run path now: parse → merge (defaults < parser < per-field random < locked chips) → engine.

**VC2.5 (async, screenshots):** the same sentence from VC2 now fills chips (`Vibe · Editorial`, `Ethnicity · Latino`…). No live session needed — a before/after pair.

Gate: `pnpm check`, `pnpm test` (parser suite green), studio smoke (constants + ControlPanel touched).

## M5 — Lifted-component redesign + chip popovers + attributes op → **VC3**

**Goal:** the tactile loop — Drape's differentiator — works on the canvas in the canvas language.

- Redesign per DS §13: `TriBlendSelector`, `EthnicityBlender`, `SkinToneGrid`, `HairColorWheel`, `EyeGrid`, `WarmSelectControl`, `CollapsibleSection`, `ChipRow`/`OptionGrid`/`SummaryStrip`/`FieldLabel` (≈1–1.5d of it).
- `CanvasPopoverContent` + the five/six chip popovers (DS §7.1 pattern) with Apply & run footers + `CostLabel`.
- `boardOps.updateAttributes`: cross-field invalidation (both rules — gender reset AND hair-style cascade, audit D1), ethnicity dual-write (B4), identity-level detection returning affected-view lists (consumed in M7; until then roots have no views, so Apply & run commits + reruns directly).
- Chip display formatters (`formatVibe`, `formatEthnicity`, skinTone split) per DS §5.9.

**VC3 (founder, live):** select a completed cast → open each chip → drag the vibe sliders, build an ethnicity blend, pick skin/hair/eyes → Apply & run → new generation. What's being felt: popover weight, slider/blend-bar feel in the flat language, chip labels' legibility. `/studio` dissonance check (redesigned primitives inside the warm ControlPanel) happens here too — decide whether the G.9 CSS-scope mitigation is needed.

Gate: `pnpm check`, `pnpm test`, guards, studio smoke.

## M6 — Toolbar, fork/recast, variations, delete+undo, keyboard → **VC4**

**Goal:** the four-verb grammar plus the safety net.

- `NodeFloatingToolbar` (screen-fixed per DS §12), type-scoped action sets.
- `ForkRecastPopover` (DS §7.4) + `boardOps.forkRoot`/`recastRoot` (`forked_from` edges; recast = identity event — dialog arrives with views in M7, red confirm per D-8).
- `boardOps.runVariations` (plan → confirm → N sibling roots, `variant_of` edges).
- Delete: cascade-confirm dialog for roots-with-views (dialog shell built now, cascade populated in M7), soft delete + Undo toast + `Cmd+Z`; move-undo stack; arrow nudge; Esc layer stack; `Cmd+A`; full Decision-7 table.
- Duplicate, Download (existing image-proxy path), Info (minimal provenance readout — snapshots render via `ImageFallback`).

**VC4 (founder, live):** the grammar tour — rerun→fork a root, spawn variations, duplicate, delete, undo it, nudge, Esc everything. What's being felt: does the grammar teach itself; is fork-vs-recast copy right; does undo feel trustworthy.

Gate: `pnpm check`, `pnpm test`, guards.

## M7 — Views, edges, stale/pin, snapshots → **VC5**

**Goal:** the reference-asset model becomes visible: lineage on the board, honest staleness, pinning.

- `boardOps.generateViews` (plan/execute, `InputSnapshot`s of the root image, `generated_from_cast` edges, row placement) + `ViewsGenerationPopover` (real per-view costs; all-views-exist state).
- Edge rendering (default 40%, full on endpoint selection).
- `NodeStatusBadge` with `stale` + `error` variants; error state in `CastImageArea` with retry + "You weren't charged".
- Identity-change dialog (three options, plan-derived counts/costs) wired into `updateAttributes`, `recastRoot`, and History-revert (the M8 surface calls the same path); `refreshStaleViews`; **Keep old = pin** (`setNodePinned`, strip glyph, unpin in `···`, exemptions everywhere).
- D-12 amendment enforced: any snapshot/thumb render path uses `ImageFallback`; consuming ops fail named-and-refunded.

**VC5 (founder, live):** generate 3 views → change the vibe on the root → take Update later → watch views go stale → refresh one, pin one → recast the root → confirm the pinned view stays exempt. What's being felt: does staleness read as information rather than nagging; is the pin gesture right; edge visibility taste.

Gate: `pnpm check`, `pnpm test`, guards.

## M8 — Refinement studio → **VC6**

**Goal:** the deep path — a room, not a dialog.

- `RefinementStudio` shell (props-only), `?edit=:itemId` hosting in `BoardPage`, TopBar studio state, three-column grid, `MetadataRail` with plan-driven cost card.
- Tabs in order: **Refine** (`boardOps.runRefinement`; retires `BoardPage`'s inline iteration orchestration :632–685 and `NodeContextMenu`'s prompt path) → **Surgical** (salvage `MaskCanvasLayer` + zoom/pan viewer from `ModelEditorOverlay`, `boardOps.runSurgicalEdit`) → **Attributes** (redesigned widgets + `SimpleAttributeChipGrid`, root vs view read-only modes) → **History** (existing rails; revert-as-identity-event on roots; `branchFromVersion`).
- **Delete `ModelEditorOverlay.tsx`** once Surgical is proven equivalent.
- New version `tool` values (`'attributes'`, `'rerun'`, `'views'`) written by the corresponding ops.

**VC6 (founder, live):** Edit from a node → refine with a prompt → surgical mask edit → attribute change from the studio (stale dialog fires) → history revert and branch → `← Boards`/Esc back with canvas state intact. What's being felt: the room-not-dialog transition, three-column proportions, tab rhythm.

Gate: `pnpm check`, `pnpm test`, guards; the old overlay's deletion is in this milestone's diff.

## M9 — Empty states, first-run, library bridge, thumbnails → **VC7**

**Goal:** first-touch experience and the "boards don't start from zero" bridge.

- First-run intro (DS §11.1; `canvasIntroSeen` on the profile), returning-user hint, all-views-exist popover state (landed in M7 — verify), empty library state.
- `LibraryPickerPopover` completion (the Models-only fill-in-place path shipped in M4 per D-28): "From library" in the Add menu → `library_cast` *placement* (`boardOps.createNode`), empty-library state, search polish, garments-tab prep for pass 2; canvas-minted casts confirmed visible in the Models library via the existing minting flow.
- Board `thumbnailUrl` freshness: set on first completed node, debounced update thereafter (D-27); verify `lobby.recentWork` cards.

**VC7 (founder, live, fresh account or reset flag):** open a brand-new board → the intro → `Cast your first model` → later, Add → From library placing an existing model → check the lobby card thumbnail. What's being felt: the welcome's restraint, whether the intro earns its permanence rule.

Gate: `pnpm check`, `pnpm test`, guards.

## M10 — Hardening + success-criteria sweep → dogfood

- Walk all 15 success criteria in `CANVAS_FOUNDATIONS.md` §10 on a real board; each gets a pass/fail note; fails become fix-or-log decisions with the founder.
- Full-suite gates; `pnpm build` sanity; verify skill headless pass over the golden path (drop → cast → views → stale → studio → back).
- Sweep: dead code from retired components (`NodeContextMenu` remnants, `AddNodeMenu` if superseded), TODO audit, `DECISION_LOG.md` updated with any checkpoint-driven amendments (threshold finals, D-19 outcome).
- Team dogfooding starts; friction notes accumulate for the polish pass (which is pass-4-adjacent, per foundations §7 — not this plan).

---

## Dependencies and parallelism

- Hard chain: M1 (tokens) → everything visual. M2a → M4 (node-local generation). M3a → M4. M2b → M5 (redesign needs BrandSelector/dedup; popovers need parser-filled chips to feel real). M5 → M7 (updateAttributes feeds the stale flow). M6's dialog shell → M7's cascade/identity dialogs. M7's stale flow → M8's Attributes tab. Everything → M10.
- Safe parallel pairs for a second stream: M1 ∥ M2a; M2b ∥ M4 (different layers — parser/server vs node UI); M9's intro art ∥ M8.
- **Prod migration timing:** the M3a migration + backfill run against production only at pass-1 cutover (with `MYSQL_PUBLIC_URL` override per deployment runbook), not at M3a time. Additive columns are prod-safe but there's no reason to carry them live for weeks.

## Risks, with handles

- **Parser quality on the chosen model** (D-14): canary tests decide early (M2b day 1); escalation path is a model swap behind one function.
- **`runGeneration` server-composition vs. the legacy client-orchestrated flow** — the studio keeps the old path (refactored hooks) while the canvas uses `boardOps`; divergence in output quality between the two paths is possible. Handle: both paths call the same `server/casting` engine functions; any divergence is a wiring bug, findable by comparing master prompts. M4 includes one side-by-side sanity cast (studio vs canvas, same brief).
- **Zoom-tier perf on dense boards** (40+ image nodes × React Flow): the VC1 mock doubles as the perf probe — if pan/zoom stutters there, the fix (image `loading="lazy"`, far-tier placeholder swap) lands before real nodes exist.
- **Scope pressure:** the cut-line order if the five weeks slip: library bridge (M9, → pass 2) → first-run intro (M9, → fast-follow) → Surgical tab (M8, studio ships 3-tab, Surgical fast-follows). Fork/recast, pin, undo, and cost display are not cuttable — they're the ratified trust layer.

**End of build plan. First action: M1 branch, `canvas-tokens.css`.**
