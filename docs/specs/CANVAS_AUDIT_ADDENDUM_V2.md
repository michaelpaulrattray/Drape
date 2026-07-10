# Canvas Pass 1 — Audit Addendum V2

**Status:** supersedes `CANVAS_AUDIT_ADDENDUM.md` in full. Read alongside the revised `CANVAS_FOUNDATIONS.md` and `DESIGN_SYSTEM.md`. Where any document disagrees with this one on a *code fact*, this one wins; where it disagrees on a *design decision*, `DECISION_LOG.md` records the ruling.

**Method:** fresh audit of the repo at commit `d74beee` (July 2026, post-Manus-migration, post-lobby). Every claim below carries a file:line reference verified this session. The original addendum's findings are each dispositioned as **CONFIRMED** (still true, refs corrected where drifted), **CORRECTED** (partially true), or **RETIRED** (no longer true or no longer relevant). New findings the original could not have known follow in Part 2.

---

## Part 1 — Disposition of original findings

### A1 — Hook refactor prerequisite: **CONFIRMED, and understated**

Both generation hooks still read global Zustand stores at the top of their bodies and cannot be called node-locally:

- `client/src/features/casting/hooks/useCastingGeneration.ts` (522 lines): reads `useCastingFormStore` (line 31), `useCastingGenerationStore` (lines 32–57), `useCastingUIStore` (lines 58–67). Side-effects into the legacy studio store via `useStudioStore.getState().setCanvas({ hasModel: true, modelSource: 'cast' })` at **line 286** (import line 7).
- `client/src/features/casting/hooks/useCastingViewGeneration.ts` (239 lines): reads `useCastingGenerationStore` (lines 20–27) and `useCastingUIStore` (lines 28–37). It does **not** read `useCastingFormStore` — the original addendum said "three stores"; it's two for this hook.
- **New:** the original addendum only flagged the `setCanvas` call in `useCastingGeneration`. `useCastingViewGeneration` has a **second one** at **line 81** (`setCanvas({ hasModel: true, hasFullBody: true, modelSource: 'cast' })`, import line 6). Both must be removed in the parameter-taking refactor, not just the first.

The refactor shape prescribed by the original A1 (convert store reads to explicit params/setters; logic unchanged) remains correct. The estimate of 1–2 focused days for both hooks stands.

`useCastingCanvas` and `useCastingExport` remain clean parameter-taking hooks with no store reads (original Section K.5) — re-confirmed.

### A2 — BrandSelector extraction: **CONFIRMED**

`BrandSelector.tsx` still does not exist anywhere in `client/src` (zero grep matches). The brand picker is inline JSX in `client/src/features/casting/ControlPanel.tsx` **lines 166–191** (maps over `BRAND_OPTIONS`; section labeled "Brand Direction"). Extraction spec in the original A2 stands, with the G.6 instruction to redesign-during-extraction (canvas tokens, no inline styles) carried into the revised `DESIGN_SYSTEM.md`.

`ControlPanel.tsx` is 490 lines (original said 491 — one line drifted, immaterial).

### B1 — Field count: **CORRECTED (minor)**

`ModelPreferences` (`client/src/features/casting/constants.ts` lines 134–169) has **34 declared fields**: 32 required plus optional `referenceImage?` (line 166) and `ethnicityBlend?` (line 168). `DEFAULT_PREFERENCES` (`client/src/features/casting/stores/useCastingFormStore.ts` lines 6–40) initializes **33** of them (everything except `referenceImage`). The original's "33 fields" is right for the defaults object; specs should say "the ~34 `ModelPreferences` fields." The original main docs' "27 attributes" remains wrong either way. Note `referenceImage` exists as a preference field — the canvas cast node's blue image pin maps to it.

### B2 — `skinTone`, not `skin`: **CONFIRMED**

Field is `prefs.skinTone`; values are compound strings `"Porcelain / Pale"` … `"Ebony / Dark"` (`WarmPrimitives.tsx` lines 483–490, selection passes the compound string at line 495). The chip-display pattern `.split(' / ')[0]` is used today by `SummaryStrip` at `WarmPrimitives.tsx:434` — follow it.

### B3 — `castingBrand` / `castingVibe`: **CONFIRMED**

Both field names verified in `ModelPreferences`. `castingVibe` is an `{editorial, commercial, runway}` object. `BRAND_OPTIONS` (`constants.ts` lines 14–23) has 8 entries: Gucci, Prada, Saint Laurent, Balenciaga, Miu Miu, Versace, Zara, Social Media.

### B4 — ethnicity dual-write: **CONFIRMED**

Both `ethnicityBlend` (structured, optional) and legacy `ethnicity` (string) exist in `ModelPreferences`. The blend-change handler updates both atomically (`ControlPanel.tsx`, blend section). `boardOps.updateAttributes` must preserve the dual-write as originally specified.

### C — EthnicityBlender caps at 2: **CONFIRMED**

`toggleEth` (`WarmPrimitives.tsx` lines 214–227) replaces the oldest selection when `selected.length >= 2` (branch at line 220). The drag handler additionally guards `selected.length !== 2` (line 190). `formatEthnicity` capped at two values stands; "3 mixed" case is unreachable.

### D — Hair chip is hair color only: **CONFIRMED**

`hairColor` and `hairStyle` remain distinct fields with 9 more hair-related fields alongside. Decision stands: canvas `Hair` chip = `hairColor` via `HairColorWheel`; the rest are refinement-studio-only.

### D1 — Cross-field reset on gender change: **CONFIRMED, plus a second rule**

`ControlPanel.tsx:204`: changing gender clears `hairStyle`, `hairFade`, `facialHair` atomically. **New:** hair-style selection has its own cascade at **lines 305–310** (clears dependent hair fields). `boardOps.updateAttributes`' cross-field invalidation map must encode both rules, not just the gender one. Read those lines during implementation and port the exact behavior.

### E — EyeGrid / 6th chip: **CONFIRMED (component facts), recommendation carried to decision log**

`EyeGrid` is a named export inside `WarmPrimitives.tsx` (lines 154–178) — **not** a standalone file. 15 iris swatches with radial gradients. The "add an Eyes chip" recommendation is unchanged on the merits and is now a `DECISION_LOG.md` item (D-19) rather than a buried recommendation.

### F — Vibe display shows preset name: **CONFIRMED**

`TriBlendSelector.tsx` (323 lines): two-slider structure confirmed (edge slider lines 163–210, heat slider 212–259, converters `weightsToEdgeHeat`/`edgeHeatToWeights` lines 10–25). `PRESETS` (lines 28–37, 8 presets) and `SNAP_THRESHOLD = 35` (line 39) are **module-private, not exported** — the small export refactor the original called for is still needed. `formatVibe` returning preset-name-or-Custom stands.

### G.0–G.11 — Redesign lifted components in canvas language: **CONFIRMED in intent, refs corrected**

The redesign position (canvas language everywhere; color-data swatches are the only chromatic exception) is ratified design content and moves into the revised `DESIGN_SYSTEM.md` as normative spec. Corrected component locations for implementers:

| Component | Actual location |
|---|---|
| `TriBlendSelector` | `components/TriBlendSelector.tsx` (standalone, 323 lines) |
| `HairColorWheel` | `components/HairColorWheel.tsx` (standalone, 290 lines) |
| `EthnicityBlender` | export inside `components/WarmPrimitives.tsx` lines 182–285 |
| `EyeGrid` | export inside `WarmPrimitives.tsx` lines 154–178 |
| `SkinToneGrid` | export inside `WarmPrimitives.tsx` lines 492–505 |
| `WarmSelectControl` | export inside `WarmPrimitives.tsx` from line 119 |
| `CollapsibleSection` | export inside `WarmPrimitives.tsx` from line 289 |
| `SummaryStrip` | export inside `WarmPrimitives.tsx` from line 421 |
| `BrandSelector` | does not exist — extract per A2 |
| helpers | `castingHelpers.tsx` (**.tsx**, not `.ts`) |

`WarmPrimitives.tsx` is 505 lines. G.9 (don't redesign `ControlPanel.tsx` itself) stands — but see N1 below: the "/studio is preserved untouched" premise it rested on has changed shape, not conclusion.

### H — Duplicate constants: **CONFIRMED, with one trap**

`WarmPrimitives.tsx` still carries local copies: `ETHNICITIES` (exported, lines 11–15, plus private `ETH_COLORS` 17–21), `EYE_PRESETS` (private, lines 143–152), `SKIN_TONES` (private, lines 483–490). All three components read the **local** copies, never `constants.ts`. Values match `constants.ts` **except**: the local `EYE_PRESETS` omits the `image` field that the `constants.ts` copy carries. The dedupe (delete locals, import from `constants.ts`) must confirm `EyeGrid` doesn't break when the richer objects arrive — it reads only `label`/`hex`, so it shouldn't, but verify.

### I — Revised M1 sequencing: **SUPERSEDED**

The original Section I ordering (refactor hooks → tokens+schema → component redesign → canvas shell) remains directionally right, but the sequencing inputs changed enough (see Part 3) that the build plan — written after founder ratification of `DECISION_LOG.md` — replaces it. Do not implement from Section I.

### J — Corrections table: **SUPERSEDED** by this document.

### K — What the audit did not find: **RE-CONFIRMED**

Still no architectural blockers: the foundational decisions implement cleanly on the current schema and routers. Two of K's items got *stronger*: the tRPC surface is better-shaped than assumed (N6), and versioning infrastructure the spec planned to build already exists (N3).

---

## Part 2 — New findings (the current codebase vs. what the docs assume)

### N1 — The "/studio preserved as fallback" premise no longer matches how /studio works

`client/src/features/studio/hooks/useStudioEntry.ts` (lines 54–185) made studio entry URL-driven:

- A **bare `/studio` redirects to `/app`** (lines 78–81). There is no studio lobby.
- Valid entries require `?tool=casting|wardrobe|export` (`VALID_TOOLS` line 37). `?tool=casting&new=1` resets the casting stores (lines 91–111); `?modelId` resumes a draft (line 112); wardrobe resolution is async (lines 131–169).

Consequences for the canvas docs:

1. "Preserve the classic `/studio` route unchanged" now means: **preserve the tool-URL entries** (`/studio?tool=casting…` etc.), which the lobby's recent-work cards and library pages link into. It is a workflow fallback, not a destination.
2. The A1 recommendation ("migrate `ControlPanel` to local state so the three stores can be deleted") gets harder: `useStudioEntry` itself resets those stores as its entry contract (lines 91–111), and `BoardCastingPanel` (see N8) also consumes them. Deleting the three stores in pass 1 therefore touches **three** consumers: `/studio`'s DrapeStudio + ControlPanel, `useStudioEntry`'s reset logic, and `BoardCastingPanel` (which pass 1 deletes anyway). The revised recommendation is in `DECISION_LOG.md` D-24: keep the three stores alive as `/studio`-only state in pass 1 (they become dead code the day `/studio` retires), rather than spending days migrating a route that's on a retirement path. The foundations' "only `useGenerationJobs` remains as a global store" success criterion is restated as "…remains as a global store **consumed by canvas code**."

### N2 — No canvas-foundations code exists (re-confirmed greenfield)

Zero occurrences of `provenance`, `boardOps`, `boardState`, `board_edges`, `generateViews`, or `useGenerationJobs` outside `docs/specs/` (the only stray hit is the word "provenance" in a PDF-certificate string, `server/casting/pdfService.ts:655`). Pass 1 is greenfield on the board side, as the brief stated.

### N3 — Version history already exists end to end — the spec builds on rails, not greenfield

- **Table:** `board_item_versions` (`drizzle/schema.ts` lines 793–803): `itemId`, `version` (1-based), `imageUrl`, `prompt`, `tool` (varchar: `'chat' | 'surgical' | 'eraser' | 'initial'`), `createdAt`; index `idx_biv_item (itemId, version)`.
- **Server:** `boards.addItemVersion` (auto-increments version, `server/routes/boards.ts:322`, computation lines 334–345), `getItemVersions` (:348), `revertItemVersion` (:360, writes the version image back onto the item), `getItemVersionCount` (:380).
- **Client:** `VersionHistoryBadge` (rendered from `BoardItemNode.tsx:189–192`) and `VersionHistoryModal` already browse and revert.

Impact: `boardOps.revertToVersion` wraps an existing procedure; the History tab reads existing rows; the version-writing discipline ("every operation that changes visible output writes a version") extends an existing pattern. The `tool` column needs new values (e.g. `'attributes'`, `'rerun'`) — it's a varchar(32), so additive. `branchFromVersion` is the only genuinely new versioning operation.

### N4 — Garment auto-captioning is already shipped — Foundations Decision 5.3 is done

`server/wardrobe/garmentAnalysis.ts` → `analyzeGarmentMetadata()` (line 36) runs a vision-LLM call (`getAiClient()` line 42, `generateContent` line 91) with a structured response schema returning `{ shortName, description, tags[] }` (lines 99–101), a controlled tag vocabulary (lines 56–78), and a safe fallback (lines 122–124). The columns exist on `wardrobe_garments` (`schema.ts` lines 639–641). The revised foundations doc removes this commitment from the pass-1 workload.

### N5 — Real credit costs contradict the flat 1,200/view used throughout both docs

`server/casting/aiService.ts` lines 62–75:

```ts
export const CREDIT_COSTS = {
  castingImage: 350,   // initial headshot (Text Pro + Image Pro)
  fullBody:     300,   // full body from headshot
  multiView:    300,   // single additional view
  allViews:     900,   // all 3 views at once
  iterate:      350,   // surgical edit / iteration
  eraser:       350,   // magic eraser
  upscale:      300,
  exportPack:  1500,
  flashMultiplier: 0.5, // Flash fallback = 50% of Pro cost
};
```

Every cost surface in the specs (views popover totals, stale-refresh dialog, MetadataRail cost card, per-Run affordances) must read from this module (or a server-computed plan cost derived from it), never hardcode. The example strings in the design docs ("1,200 credits", "3,600 credits") were illustrative and are replaced. Note also the Flash-fallback multiplier: a plan's `estimatedCreditCost` is an *estimate* — the UI copy should not promise exactness if the engine can fall back to Flash pricing.

### N6 — The current boards implementation is further along than the docs assume

Inventory of `client/src/features/boards/` (18 files):

- **`BoardCanvas.tsx`** (React Flow via `@xyflow/react`, imports lines 14–26). Three registered node types (`nodeTypes` lines 76–80): `boardItem` → `BoardItemNode` (covers `model|garment|vto_result|reference|iteration`), `frame` → `FrameNode`, `note` → `NoteNode`. DB items map to flow nodes via `itemToNode` (lines 86–150), node id convention `item-${id}`. A fingerprint diff (lines 153–155, 194–209) protects in-flight drags from server round-trips — keep this. Drag-end and resize persist via callbacks (lines 212–238). **Edges are declared but permanently empty** (`useEdgesState<Edge>([])`, line 184). Imperative viewport-center/scroll-to-node refs exist (lines 321–350). Background is React Flow's dots variant (lines 366–371) — replaced by `DottedGridBackground` per the design system.
- **`BoardItemNode.tsx`** (323 lines): shared card shell; type icon/label maps (41–57); generating-skeleton driven by `metadata.isGenerating`/`generatingStep` (70–71, 197–218); **invisible (opacity-0) React Flow `Handle`s already stubbed** (135–144); `NodeResizer` on selection.
- **`BoardPage.tsx`**: route `useRoute('/app/board/:id')` (:32); board + items via `trpc.boards.get`/`getItems` (:66, :74); all state is **local React state, no store** (selection, active panel/tool, context menu, placement mode — lines 36–57); viewport derived from `board.viewportX/Y/Zoom` (374–381) and saved debounced (153–163); Delete/Escape keydown handling (177–199); right-side 380px tool panel where only casting is wired (590–609); node iteration orchestrated inline (632–685): save version → `trpc.generation.iterate` → update image → save version.
- `overlays/ModelEditorOverlay.tsx` (786 lines): the current full-screen-ish (~92% viewport, frosted backdrop) refine dialog — zoom/pan viewer, chat refine bar, surgical + eraser mask tools, reference upload, via `useBoardIteration`. This is the component the spec renames/rebuilds into `RefinementStudio`; note it is currently a *modal-style overlay with scrim*, exactly what the design language forbids.
- `panels/BoardCastingPanel.tsx` (361 lines): the right-panel casting flow the spec deletes. It wraps `ControlPanel` + the three casting stores + all four casting hooks; inserts a skeleton `board_items` row at viewport center, then fills the image in (metadata keys `viewType`, `isGenerating`, `generatingStep`).
- `hooks/useBoardIteration.ts`, `hooks/useBoardMutations.ts`; `components/`: `AddNodeMenu`, `CanvasChatToggle`, `CanvasToolbar`, `CanvasZoomControls`, `NodeContextMenu`, `NodeInfoPanel`, `VersionHistoryBadge`, `VersionHistoryModal`; `nodes/FrameNode.tsx`, `nodes/NoteNode.tsx`, `BoardHeader.tsx`.

Impact: pass 1 is a **rebuild of the node layer and chrome on an existing React Flow shell**, not a from-scratch canvas. The deletion list grows (see Part 3).

### N7 — Schema reality for `boards` / `board_items`

- `boards` (`schema.ts` 730–747): includes `startedWith` enum `["casting","wardrobe","blank"]` **notNull** (:737), `status ["active","archived"]`, `viewportX`/`viewportY` ints + `viewportZoom` int **stored ×100 as percent** (740–742), thumbnail fields.
- `board_items` (757–784): `type` enum `["model","garment","vto_result","reference","iteration","note","frame"]` (:763), `label`, `imageUrl`/`imageKey`, position/size/z, `parentItemId` (:774 — **present but never written by any current client code**), `sourceModelId`/`sourceGarmentId`/`sourceSessionId`/`sourceLookId` FKs, untyped `metadata` json (:780; router accepts `z.record(z.string(), z.unknown())`, `boards.ts:196`).
- No `kind` column, no `board_edges` table — the pass-1 migration is exactly as specced (additive `kind` + new table).
- `MAX_BOARDS_PER_USER = 50` (`boards.ts:37`).

The foundations' backfill SQL and additive-column plan remain valid. New: the `kind` backfill must also account for `sourceModelId`-style FKs when stamping provenance (a `model` row with `sourceModelId` becomes `kind:"image"` with `provenance.type:"cast_root"` or `"library_cast"` — mapping table in the revised foundations §6).

### N8 — tRPC surface: better-shaped than the docs assume

- `boards` router (`server/routes/boards.ts` 68–442, all `protectedProcedure` + `requireBoardOwnership` 41–50): `create` (:72, requires `startedWith`), `list`, `get`, `update`, `saveViewport` (:139, zoom clamped 10–500), `archive`, `delete`, `addItem` (:179), `addItems` (:205, batch 1–100), `getItems`, `updateItem` (:245), `batchUpdatePositions` (:276), `deleteItem`, `deleteItems`, plus the four version procedures (N3) and `getItemModelInfo` (:391 — returns linked model masterPrompt/technicalSchema/preferences + `latestAssetId`).
- `generation` is a **directory router** (`server/routes/generation/`): `castingImaging` (headshot, full body, multi-view), `castingRefinement` (iterate, upscale, enhance, suggestions, analyzeReference, …), `castingExport` (PDF, minting, history, costs), `queueStatus` — flat-merged in `index.ts:18–23`. The index comment anticipates future sub-modules; **`boardOps` should follow this shape** (a `server/routes/boardOps.ts` or a `generation/`-style directory) rather than inventing a new layout.
- `lobby.recentWork` exists (`server/routes/lobby.ts:97`, merge logic 55–93): a cross-tool union feed where canvas items carry `{tool:"canvas", boardId, startedWith, thumbnailUrl}`. New-node flows must keep board `thumbnailUrl` fresh or the lobby cards go stale.
- Board creation from the lobby: `useBoardMutations.createBoard(startedWith)` → `boards.create` → navigate `/app/board/:id` (`useBoardMutations.ts:85–90`, :26); lobby CTAs pass `'blank'` (`HomeView.tsx:98`, `BoardsView.tsx:111`).

### N9 — Parser home: `server/_core/llm.ts` is gone; the casting service layer is the landing zone

Confirmed no `llm.ts` anywhere. The infrastructure the parser should reuse, all in `server/casting/`:

- `geminiClient.ts` — `getAiClient()` (lines 33–38, `@google/genai`), plus `SAFETY_SETTINGS`, `extractImageFromResponse`, `withTimeout`, `withSingleRetry503`, `formatGeminiError` (56–233).
- `geminiQueue.ts` — `withTextQueue` / `withImageQueue` concurrency limiter (2–45), `getQueueStats` (:166), max queue depth env-tunable.
- `geminiCircuitBreaker.ts` — `checkCircuit` (:102) / `recordSuccess` (:57) / `recordFailure` (:69).
- `geminiGeneration.ts` — engine entry points: `generateMasterPrompt` (:117), **`buildNewPromptContent` (:253)** (the function the parser-override reads modify, called at :150), `enhanceUserPrompt` (:462), `generateCastingImage` (:517).
- Wardrobe already consumes this layer via re-exports in `server/wardrobe/utils.ts` (imports lines 9–13, re-export :20) — precedent for the parser doing the same.

The parser lands as `server/casting/promptParser.ts`: text-model call through `withTextQueue` + circuit breaker, structured-output schema from `PARSER_PROMPT_V2.md` §2. Model choice is a decision-log item (D-14).

### N10 — Parser prerequisites re-confirmed unmet, with exact targets

- `ETHNICITIES` (`constants.ts` lines 25–29) = 9 values, **no `Mediterranean`**. The duplicate in `WarmPrimitives.tsx:11–15` needs the same addition (or, better, dies in the H dedupe first). `EthnicityBlender`'s grid derives from the array, so the new value appears automatically; sanity-check `ETH_COLORS` (17–21) has an entry or a fallback for it.
- **No `*Override` fields** (`hairStyleOverride`, `hairColorOverride`, `eyeColorOverride`, `facialHairOverride`, `skinTextureOverride`, `castingBrandOverride`) anywhere in the casting feature — `ModelPreferences` additions plus the `buildNewPromptContent` preference-reads (`PARSER_PROMPT_V2.md` §4) are both still to do. The "~30 minutes" engine-change estimate is plausible; line refs in PARSER_PROMPT_V2 §4 ("line 404-405", "line 372-378", "line 260") are stale — locate by content (`- Style: ${prefs.hairStyle...}` etc.) within `buildNewPromptContent` starting at :253.

### N11 — Theme collision: the app defaults dark; the canvas spec is light-only

`App.tsx` mounts `ThemeProvider defaultTheme="dark"`; the app tokens (`client/src/styles/tokens.css`) are a different palette (warm monochrome, different names) from the proposed `canvas-tokens.css`. The canvas spec authored light-mode values only ("no dark mode in pass 1"). Unaddressed, the canvas routes would render light chrome inside a dark-themed app shell (top bar, toasts, dialogs inherit app theming). Resolution — decision-log D-22: canvas and refinement-studio routes render inside a light-scoped container (canvas tokens are self-contained and don't read the app's dark variables); shared primitives (sonner toasts, dialogs) mounted within the canvas tree get the same scope. This is a one-container decision, not a theming project — but it must be explicit or the first build hits it blind.

### N12 — Small corrections roll-up

| Docs say | Reality |
|---|---|
| `castingHelpers.ts` | `castingHelpers.tsx` |
| `EthnicityBlender`/`SkinToneGrid`/`EyeGrid` standalone files | exports inside `WarmPrimitives.tsx` |
| `TriBlendSelector` "~324 lines" | 323 lines; `PRESETS`/`SNAP_THRESHOLD` private (need export) |
| `ModelEditorOverlay` "becomes RefinementStudio" (simple rename) | 786-line modal-with-scrim overlay; it's a rebuild-into-new-shell, salvaging the viewer/mask internals |
| viewport "existing columns" (unspecified) | `viewportX/Y` ints, `viewportZoom` int ×100; `saveViewport` clamps 10–500 (i.e. 0.1×–5× zoom — the zoom-tier design in the design system works within this range) |
| edge relation enum incl. `generated_from_cast` in one place, missing it in the `BoardStateSnapshot` type (§4) | revised foundations aligns the enum in both places, plus new relations from ratified decisions |
| `useCastingViewGeneration` reads three stores | reads two (no form store) |

---

## Part 3 — Corrected inputs to the build plan

The build plan itself is written after `DECISION_LOG.md` ratification. These are the facts it must be built on:

**Prerequisite refactors (pass-1 critical path, all confirmed):**
1. Parameter-taking refactor of `useCastingGeneration` **and** `useCastingViewGeneration`, removing **both** `setCanvas` side-effects (lines 286 and 81 respectively). Legacy `/studio` keeps working by passing store values through at its call sites.
2. Extract + redesign `BrandSelector` out of `ControlPanel.tsx:166–191`.
3. Dedupe constants (H), minding the `EYE_PRESETS.image` field difference.
4. Export `PRESETS`/`SNAP_THRESHOLD` from `TriBlendSelector`.
5. Parser prerequisites: `Mediterranean` in `ETHNICITIES`; six `*Override` fields on `ModelPreferences`; override-preferring reads in `buildNewPromptContent` (locate by content near `geminiGeneration.ts:253`).
6. `canvas-tokens.css` + `border-hairline` utility before any component redesign (original Section I ordering note stands).

**Schema (unchanged from spec, validated against real schema):** additive `kind` column + backfill (now provenance-aware per N7), new `board_edges` table, new version-`tool` values.

**Already exists — do not rebuild:** version history rails (N3), garment auto-captioning (N4), React Flow shell with drag-fingerprint protection and imperative viewport helpers (N6), board CRUD + batch position procedures (N8), lobby integration + `startedWith` (N8).

**Deletion list (grows vs. the original):** `BoardCastingPanel.tsx`, `ModelEditorOverlay.tsx` (salvage viewer/mask internals into studio tabs), `NodeContextMenu`'s inline iteration orchestration in `BoardPage.tsx:632–685` (moves into `boardOps`), plus — per D-24 — the three casting stores survive pass 1 as `/studio`-scoped state and die with `/studio`, contra the original "delete in M1."

**Cost wiring:** all cost UI derives from `CREDIT_COSTS` (N5) via plan objects; no literals.

---

## Part 4 — What this re-audit did not find

1. **No architectural blockers, again.** kind+provenance, board_edges, per-node state, plan/execute — all still implement cleanly on the current schema, router shape, and React Flow shell.
2. **No new store-coupling.** No additional hooks grew store reads since the original audit; the two known hooks are still the only generation-path offenders.
3. **No schema drift against the migration plan.** `board_items` accepts the additive `kind`; nothing else claimed the name; `board_edges` doesn't collide.
4. **No R2/CSP obstacle for pass 1.** Image serving is public-URL based end to end; the only media caveat (video `media-src`) is a pass-4 note, already recorded in `PASS_4_VIDEO_NOTES.md`.

**End of audit addendum V2. The original `CANVAS_AUDIT_ADDENDUM.md` is superseded and kept only for provenance.**
