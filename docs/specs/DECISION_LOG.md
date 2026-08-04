# Canvas Pass 1 — Decision Log

**Purpose:** every divergence from the original canvas docs, one entry each: what changed, why, what it affects. Status legend: **RATIFY** = design judgment awaiting the founder's call · **FACT** = correction to match verified code · **PROCESS** = how the revision was executed.

> **RATIFICATION RECORD (founder, 2026-07-10):** all entries ratified. Notes binding on implementation:
> - **D-1/D-2/D-3 — provisional on thresholds.** Architecture approved; the 0.65/0.35 values are tuned by feel at the zoom-tier visual mock (build plan VC1) before being treated as final.
> - **D-8 — approved as scoped** (dialog-confirm + error glyph only).
> - **D-11 — approved**, including the generalization to all identity-changing operations.
> - **D-12 — approved with amendment:** input snapshots must degrade gracefully when a referenced R2 object no longer resolves — an explicit "Source unavailable" state, never a broken image. Encoded in `CANVAS_FOUNDATIONS.md` Decision 1 and `DESIGN_SYSTEM.md` §5.16.
> - **D-19 — approved (six chips), flagged for re-evaluation at the first visual checkpoint** if the row feels crowded.
> - All others ratified as written. Build-plan shape requirement: an interactive cast node reaches the founder as early as possible in the milestone sequence, even rough.
>
> **VC1 outcomes (founder, on the seeded density mock, 2026-07-10):**
> - **D-1/D-2/D-3 thresholds finalized: mid 0.45, far 0.35** (committed to `zoomTiers.ts`).
> - **D-19 is moot as posed.** The chip *resting render* fails — filled pills below a selected card read as a second card competing with the image. The chip architecture (tap → popover) is retained; the resting state is being redesigned. Three variants under exploration at VC1.5: (1) selection-only pills (the specced status quo, shown in context), (2) collapsed tertiary-gray summary line expanding to chips on interaction, (3) same-position no-fill text-row treatment at uniform width. Five-vs-six is re-decided after the resting-state ruling. `DESIGN_SYSTEM.md` §5.9 is amended once ruled.
>
> **VC1.5 ruled (founder, 2026-07-10): the synthesis** — variant 2's summary line at rest, variant 3's spec-sheet rows as the engaged state (replacing pills entirely below the card; empty roots show rows immediately). Encoded as `NodeAttributeBlock` and the rewritten `DESIGN_SYSTEM.md` §5.9; `BlenderChipStrip` deleted. **Five-vs-six re-decided: six** — the crowding objection was a property of the filled pills, which no longer exist; dropping Eyes remains a one-line change if dogfooding disagrees.

Referenced docs: `CANVAS_FOUNDATIONS.md` (F), `DESIGN_SYSTEM.md` (DS), `CANVAS_AUDIT_ADDENDUM_V2.md` (A2). Build sequencing: `PASS_1_BUILD_PLAN.md`.

---

## Group 1 — Brief §2 mandated designs (previously unaddressed)

| ID | Decision | Why | Affects | Status |
|---|---|---|---|---|
| D-1 | **Zoom renders in three tiers** — working ≥0.65 (full spec), mid 0.35–0.65 (chrome retracts), far <0.35 (image tiles), with ±0.03 hysteresis, one `useZoomTier()` source | 10px labels and 0.5px hairlines are unreadable at 40% on a dense board; retracting chrome preserves the flat language instead of shrinking it into smudge | DS §12; every node component | RATIFY |
| D-2 | **Toolbar, status badges, and pins render at fixed screen size** (counter-scaled); labels/strips stay canvas-space and retract instead | A badge that scales to 9px is decoration; what needs attention must stay findable at any zoom | DS §12 | RATIFY |
| D-3 | **Card borders upgrade 0.5px→1px at mid tier and below** | 0.5px at 0.5× zoom renders sub-pixel/aliased; 1px canvas-space at low zoom ≈ the hairline's *rendered* look at working zoom — the language is the look, not the CSS number | DS §12, §4 | RATIFY |
| D-4 | At far tier, **selection = 2px ink border / offset outline; image, status dot, and selection are the only things that never retract** | What you made, what needs attention, what you're touching — everything else is negotiable at density | DS §12 | RATIFY |
| D-5 | **Frames become the wayfinding text layer at far zoom** (pass 3; noted now so pass 1 doesn't fight it) | Something must label clusters at density; frames are the natural unit | DS §12 | RATIFY |
| D-6 | **Statuses stay visible at all zooms** as a screen-fixed 14px dot below working tier | A stale/failed node that vanishes at low zoom is a silent data-integrity lie | DS §12, §5.14 | RATIFY |
| D-7 | **Monochrome is defended at density by mechanism, not hope**: silhouette distinguishes types, weight/fill distinguishes states, one badge channel for statuses, pins keep their two hues, edges stay monochrome. No per-type node colors | Type-coding by hue is the generic-canvas look; Drape's types already differ in silhouette, and the restraint is the brand | DS §2.1 | RATIFY |
| D-8 | **Amends a locked rule:** the confirm button of a dialog whose action destroys work (delete-cascade, recast) renders red (`--color-canvas-destructive`); the `error` badge glyph also uses it. Red appears nowhere else — no toolbars, chips, strips, hovers | Argued per the brief's invitation: red-confirm is a universal error-prevention convention; withholding it costs users a real safety signal and buys the aesthetic nothing, because dialogs are already the one "stop" moment | DS §2.1, §3, §9; tokens | **RATIFY (locked-rule amendment)** |
| D-9 | **First-run intro**: an on-canvas ghost composition (three captioned ghost cards: cast → views → connected) + one dark `Cast your first model` pill; dismissed permanently by any interaction; flag persisted on the user profile (not localStorage) | Higgsfield-spirit welcome in Drape's restrained language — shows capability without a tour, modal, or coach marks; profile persistence survives devices | DS §11.1; profile router (one flag) | RATIFY |
| D-10 | **Empty-state set specced**: returning-user hint, failed-generation node state (retry + "You weren't charged"), all-views-exist popover (offers `Open a view`, no dead end), empty library picker | A blank surface or dead-end popover is a bug, not a missing polish item | DS §11 | RATIFY |

## Group 2 — Brief §4 proposals and parser integration

| ID | Decision | Why | Affects | Status |
|---|---|---|---|---|
| D-11 | **Rerun on a cast root = explicit Fork / Recast choice** (popover, not dialog); generalized to "every image change on a root is an identity event" — recast, attribute change, *and History-tab revert* all route through the stale-flow confirmation; `forked_from` edge added; views/image-gen/VTO keep plain vN versioning | Accepted brief §4.1, extended: a rerun root is a different person, and revert-to-v1 is equally an identity change — one rule instead of two special cases | F 3e/3f, §4 (`forkRoot`/`recastRoot`); DS §7.4 | RATIFY |
| D-12 | **Provenance snapshots inputs at generation time** (`InputSnapshot[]`: itemId, versionId, exact imageUrl) and records `engine` on every generated node | Accepted brief §4.2: pointer-only lineage lies after identity edits; R2 URLs never expire so snapshots stay resolvable; `engine` is the multi-engine door | F Decision 1; all generation ops | RATIFY |
| D-13 | **Library ↔ canvas bridge, scoped**: pass 1 ships "Add from library" (models → `library_cast` nodes; picker popover); garments land with pass 2; canvas-minted casts reach the Models library through the existing minting flow | Accepted brief §4.3 with honest scoping — placement is the leverage ("boards must not start from zero"); full bidirectional curation isn't pass-1-sized | F 3a/§4; DS §5.3, §7.3 | RATIFY |
| D-14 | **Parser lands as `server/casting/promptParser.ts`** using the existing Gemini text path (`getAiClient` + `withTextQueue` + circuit breaker); the three-path dispatch (parsed/random/per-field) runs **server-side inside `boardOps.runGeneration`**; the preference randomizer moves to `shared/` or is ported server-side. Model: start with the Gemini text tier already in production, validated against `PARSER_GOLD_STANDARD_V2.md`; escalate model only if the gold-standard canaries (Tests 16, 25) fail | `server/_core/llm.ts` is gone (A2 N9); the casting service layer has the queue/breaker infrastructure the brief points at; server-side dispatch keeps the agent path pure | F 3a, §4, §9; new parser module + tests | RATIFY |
| D-15 | **Every paid affordance shows its cost before firing**, computed server-side by `plan()` from `CREDIT_COSTS` — the docs' flat "1,200/view" examples are void (real: castingImage 350, multiView 300, iterate 350…); costs display as estimates ("~") because of the Flash fallback multiplier | Accepted brief §4.5; the hardcoded numbers in the original docs never matched production pricing (A2 N5) | F Decision 6; DS §5.15 + every popover/dialog/rail | RATIFY |

## Group 3 — Keyboard and undo (originally deferred to pass 3–4)

| ID | Decision | Why | Affects | Status |
|---|---|---|---|---|
| D-16 | **Full keyboard model specified for pass 1** (Esc layer order, Delete-with-cascade-confirm, arrow nudge 1/16 units, Enter, Cmd+A, Cmd+Z, Cmd+K reserved) so components are built against it, not retrofitted | Accepted brief §2.4's reassessment; retrofit keyboard semantics onto built chrome is strictly more expensive | F Decision 7; DS §9 | RATIFY |
| D-17 | **Undo ships in pass 1, scoped to delete and move**: delete becomes a soft delete (`deletedAt` column, additive) with an Undo toast + Cmd+Z; cascade units restore together; versions/edges survive; move gets a position-snapshot stack. Generations are not undoable (versions cover recovery); the full undo stack stays pass 4 | Delete on a spatial canvas is the trust cliff and is cheaply invertible with a flag; a command-pattern stack across paid generations is not pass-1-sized | F Decision 7, §6 schema; DS §9 | RATIFY |

## Group 4 — Future-proofing (video / multi-engine)

| ID | Decision | Why | Affects | Status |
|---|---|---|---|---|
| D-18 | **Pass-1 primitives are engine- and media-agnostic by contract**: `kind` enum ships with `video` reserved; `runGeneration` returns `{ outputs[], engine }` (never assumes one image); `useGenerationJobs` carries `estimatedDurationMs`/progress and tolerates minutes-long jobs with polling backoff; the tool pill isn't sized to its current icon count | PASS_4_VIDEO_NOTES obligations folded into the foundations so pass 4 needs no rework of pass-1 code | F Decisions 1/4, §4; DS §5.3 | RATIFY |

## Group 5 — Component-level divergences

| ID | Decision | Why | Affects | Status |
|---|---|---|---|---|
| D-19 | **Six blender chips — Eyes joins Brand/Vibe/Ethnicity/Skin/Hair**, wrapping the existing `EyeGrid` | Carried from the original audit's recommendation: eye color is genuinely identity-level, the component exists, removal later is one line | DS §5.9; F 3a | RATIFY |
| D-20 | **Frames-as-export-units accepted in principle, designed at start of pass 3**; pass 1 only guarantees the primitives don't block it (frame kind + `getSnapshot`) | Accepted brief §4.4 at the right time — export needs real boards to design against | F §7 | RATIFY |
| D-21 | Small component corrections: empty-node Run button is **ghosted/disabled** until input exists (the original draft had it active-with-red-flash, contradicting the foundations); `NodeStatusBadge` gains the pass-1 `error` variant with retry + refund copy; new primitives `CostLabel`, `ForkRecastPopover`, `LibraryPickerPopover`; "Keep old" on stale views now **pins** the node (`pinned` metadata) — pinned = finished work, exempt from all staleness pressure | Internal contradiction fixed; error is a pass-1 reality; Keep-old previously did nothing durable, which made stale nagging | DS §5.7/5.12/5.14/5.15, §7.3/7.4, §9; F Decision 1, 3c | RATIFY |

## Group 6 — Integration with the current codebase

| ID | Decision | Why | Affects | Status |
|---|---|---|---|---|
| D-22 | **Canvas + studio render inside a light-scoped theme container** in `BoardPage`; canvas tokens stay self-contained light values; dark canvas variants post-pass-3 | The app shell defaults dark (`ThemeProvider defaultTheme="dark"`); without an explicit scope, dialogs/toasts/dropdowns inside the canvas render dark against light chrome (A2 N11) | DS §2; `BoardPage` hosting | RATIFY |
| D-23 | `boardOps` **wraps existing procedures instead of duplicating them** (`addItem`, `updateItem`, `batchUpdatePositions`, the four version procedures, the iterate path); new version `tool` values (`'attributes'`, `'rerun'`, `'views'`) are additive on the existing varchar; `BoardPage`'s inline iteration orchestration (:632–685) moves into `boardOps.runRefinement` | Version rails and board CRUD already exist and work (A2 N3/N8); duplication would fork behavior | F §4; server layout | RATIFY |
| D-24 | **The three casting stores are NOT deleted in pass 1.** They survive as `/studio`-scoped state (consumed by DrapeStudio/ControlPanel and `useStudioEntry`'s reset contract) and die when `/studio` retires. The enforced rule becomes: zero imports from any canvas code — mechanically checkable | Original plan ("delete in M1") predates `useStudioEntry`, which resets those stores as its entry contract (A2 N1); migrating a retirement-path route isn't worth days | F Decision 4, §8, success criteria 13 | RATIFY |
| D-25 | **`ModelEditorOverlay` is rebuilt into `RefinementStudio`, not renamed** — salvage the zoom/pan viewer and `MaskCanvasLayer` internals; the overlay (a modal with scrim, violating the no-modal rule) is deleted | It's 786 lines of modal-shaped code (A2 N12); pretending it's a rename would smuggle the scrim pattern into the new studio | F §9; DS §6 | RATIFY |
| D-26 | **Backfill is provenance-aware**: legacy `type` rows get both `kind` and a stamped `metadata.provenance` using the `source*` FKs (e.g. `model`+`sourceModelId` → `library_cast`) | The original backfill set only `kind`, leaving old nodes provenance-less and invisible to the snapshot/agent layer | F §6 mapping table; migration script | RATIFY |
| D-27 | **Board thumbnails stay fresh from canvas work** (update on first completed node + debounced thereafter) | The lobby's `recentWork` feed renders `thumbnailUrl`; a live canvas with a stale lobby card breaks the navigation model the brief mandates slotting into | F §1 | RATIFY |

## Group 6b — Post-ratification founder directives

| ID | Decision | Why | Affects | Status |
|---|---|---|---|---|
| D-28 | **Both paths at the node** (founder, 2026-07-10, with ElevenLabs Flows reference shots): the empty cast node carries a quiet secondary affordance — `or choose from your models` — opening the `LibraryPickerPopover` directly at the node; picking **fills the node in place** as `library_cast` (no sibling spawned). **Constraint:** the picker offers canonical cast reference imagery only — never outfitted/styled/scene outputs (ElevenLabs offers styles at pick time; Drape deliberately does not — §1.5 reference-asset framing). Patterns stolen, rendering not: popovers and hairlines, no modals/scrims | Create-new and pick-existing split across menu surfaces makes the empty node a dead end for returning users; merging them at the node is the stronger ergonomic, and the constraint keeps identity slots truthful | DS §5.12/§7.3/§9; F 3a/§4; build plan M4 (affordance slot) + M9 (picker wiring) | FOUNDER-DIRECTED (encoded) |

## Group 6c — Character-sheet rendering + weighted reference semantics *(RATIFIED 2026-07-11, alongside the D-35 assessment — see Group 6d ratification record)*

Two connected VC1-review findings from the founder (2026-07-10, with ElevenLabs composite-card reference shot). **D-29 amends an item on the locked ledger** (the root/view node model) — founder-initiated, so permitted. Neither `CANVAS_FOUNDATIONS.md` nor `DESIGN_SYSTEM.md` is edited until this section is ratified; M3a–M6 are unaffected and proceed.

### D-29 — Character-sheet root: views are data records, the sheet is the default rendering

**What changes:** nothing in the data model; everything in the default rendering. `cast_view` rows keep their full record (versions, staleness, `pinned`, position) but **spawn no standalone cards by default**. Once ≥1 view exists, the root's image area renders as a composite character sheet — the fashion comp-card form. Any view can be **popped out** to a standalone connectable card on demand (`poppedOut: boolean` in the view's metadata) and collapsed back.

**Why it's right (and why it strengthens ratified architecture rather than fighting it):** §1.5 already defines the five-view package as *the* reference asset — "talent roster headshots." Rendering the package as one board object is more faithful to that framing than five cards and four edges; the exploded default was paying real board-footprint and visual-unity costs for a per-view addressability that (per D-30) turns out not to be data-load-bearing.

**Amended interaction model (restrained per the anti-patterns — the sheet must not become a mini-app):**
- **Sheet:** fixed comp-grid templates by view count (headshot-dominant), card width unchanged at 260, height grows by template. Tiles are images only at rest — no buttons, no labels inside.
- **One per-view surface:** with the root selected, hovering a tile shows a 1px inset ring; *clicking* a tile opens a `CanvasPopoverContent` — view label · vN, status line, and the complete per-view action set: `Pop out` · `Refresh · ~cost` · `Pin`/`Unpin` · `Open in studio`. No per-tile toolbars, ever.
- **Staleness per tile:** 70% dim + the compact screen-fixed status dot at the tile corner (reuses `NodeStatusBadge`), visible at all zooms. **Aggregate:** the root control strip gains a `{N} stale` action segment → bulk-refresh plan dialog. The 3c dialog (Update now / later / Cancel), pin semantics, and 3f fork/recast are unchanged — counts refer to view *records*.
- **Pop out / collapse:** popping materializes the standard view card (reduced toolbar, pose prompt) at the view row's stored position, connected by its `generated_from_cast` edge; the sheet tile remains (package integrity) with a small `⤢` corner glyph. Collapsing dematerializes the card and **re-anchors any outgoing edges to the root, preserving `viewAngle` intent in edge metadata** (see D-30) — no data loss either direction.
- **`+ Views` popover unchanged**; results land as tiles. **Zoom tiers:** the sheet is simply the card image at mid/far — identity survives density as a comp card (strengthens D-1).

### D-30 — Weighted reference semantics: edges express intent, payloads are composed

**What changes:** an edge from a cast to a consumer no longer means "this image is the input." It means **"reference this cast, weighted toward this view"** — edge metadata carries `{ viewAngle }`; the system composes the actual identity payload server-side. Rationale (founder, empirical): a single view alone is an invalid identity reference — the generating model invents unseen features, as proven by the hallucination clamps in the angles prototype.

**Payload strategy — evaluated, with recommendation:**
- *(a) Full canonical package* (all views as reference images): maximum constraint, but 5–6 reference images invite guidance dilution and pose-intent conflict, scale badly in cost/latency toward video (pass 4), and force a stale-filtering policy across the whole package on every run.
- *(b) Headshot + intent view + generated identity text* — **recommended.** The identity text already exists and is already tuned: `buildIdentityAnchor(masterPrompt, technicalSchema)` (`server/casting/geminiClient.ts:196`) is exactly the "generated text identity description," and the shipped view/body pipeline already generates from **one anchor image + that text** (`geminiViews.ts:53, :73, :182, :266` — "THE ATTACHED IMAGE IS THIS EXACT PERSON"). The hallucination clamps live in the structured text — the precise role the prototype proved necessary. Strategy (b) = the proven house pattern plus one intent image for pose/framing weight. Two images + text avoids multi-ref dilution, is cheap, and keeps pass-4 video payloads sane.
- **Escalation path:** one server function, `composeIdentityPayload(modelId, intentViewAngle)` in `server/casting/`, owns composition — if dogfooding shows identity drift, switching to (a) (or per-run hybrid) is a change to one function, not to callers.
- **Stale-input rule:** the composer always uses the *current* root headshot + identity text. If the intent view is stale and unpinned, `plan()` flags it and the confirm UI warns ("Side view is out of sync — refresh first?"); pinned views are accepted-final and used silently.
- **D-12 compliance:** `InputSnapshot[]` records the exact image URLs sent, and provenance additionally snapshots the composed `identityText` verbatim (a few KB of JSON — full reproducibility, not just a pointer).
- **Reinforces D-29 (founder's own observation, confirmed):** if payloads are package-level, per-view edges are *intent annotations*, not data plumbing — permanent per-view cards lose their strongest justification. Pop-out remains a *work* surface (refining, inspecting a view), not a wiring requirement. In pass 1 no consumer nodes exist (image-gen is pass 3, VTO pass 2), so pass 1 ships the composer + edge-metadata shape + provenance manifest; the weighted-edge *UI* arrives with pass 2's first consumers.
- **Future-pass pointer (founder-directed 2026-07-16):** strategy (b) stands ratified and unchanged for multi-reference image engines. Its capability-aware escalation path — **adaptive derived reference-sheet recipes** per engine/model-version/task (three- and four-panel derived sheets, single-visible-face profile, portrait-only fallback), automatic and calibration-gated, selected server-side behind the same "reference this cast" edge semantics — is recorded in `PASS_4_VIDEO_NOTES.md` §"Adaptive derived reference-sheet recipes". It composes delivery payloads downstream of the composer and changes neither D-30's edge semantics nor identity-document writes.

### Impact on M7 and sizing delta

Removed from M7: view-node spawning + auto-row placement, per-card view chrome exercise, root↔view edge-highlight scope (−0.75–1d). Added: `CharacterSheetImageArea` (0.75–1d), tile popover + per-tile status (0.5d), pop-out/collapse + `poppedOut` + edge re-anchoring (0.75d), aggregate-stale strip segment + hover list (0.25d), `composeIdentityPayload` + provenance manifest (0.5d — mostly wiring the existing `buildIdentityAnchor`). **Net: M7 3d → 4–4.5d; plan total ≈25–28.5 focused days.** M3a/M4/M5/M6 unaffected (M4 is a single-headshot root; M6's dialogs count view records, not cards).

**On ratification:** foundations 3b/3e and success criteria 5/6/8 rewritten; DS gains §5.17 (character sheet) with touches to §5.11/§9/§12; build plan M7 rewritten. Until then those documents intentionally still describe the exploded model.

### D-31 — Cast card geometry *(founder-ratified 2026-07-11, VC2 re-drive cycle)*

| What | Ruling |
|---|---|
| Image area | **3:4 portrait at every state** (empty/generating/complete) — matches the measured generation output (896×1200, consistent across all samples), so cover-fit never crops. The model image is sacred (founder). |
| Canonical width | **280** for cast roots and library casts |
| View width | **200** (same 3:4 area) |
| Ratio drift | If a future engine breaks the 3:4 contract, that's a design event to surface — never a silent crop |
| Zoom tiers | VC1 thresholds (0.45/0.35) were tuned on shorter cards — sanity-checked against the new geometry same day; founder flags any retune himself (dev slider retained) |

## Group 6d — Founder rulings, 2026-07-11 (VC2 driving + ElevenLabs Flows study) *(D-32…D-37, founder-ratified)*

Six rulings from hands-on VC2 driving plus a structured study of ElevenLabs Flows. Reference screenshots in `docs/specs/references/` — filenames map to rulings (`ruling1-*.png` … `ruling5d-*.png`). Two of these amend locked-ledger items (the no-modal rule and the inline-first principle) — founder-initiated, so permitted, same class as D-8/D-29. Rulings 1–3 and 6 were applied in code same-day where cheap; ruling 4 is a ratified *direction* whose execution is gated on the founder ratifying a written assessment (see D-35); ruling 5 is reference-logging only.

> **RATIFICATION RECORD (founder, 2026-07-11) — `RULING_4_ASSESSMENT.md` ratified; D-35's execution gate is lifted. Six rulings binding on implementation:**
> 1. **Option B** — overlay-hosted takeover; the transition feel is the point.
> 2. **D-24 re-ratified as inverted:** the casting stores are the flagship environment's load-bearing state; the mechanical guard (zero imports under `features/boards/**`) stands verbatim as a permanent architectural boundary, not a retirement fence.
> 3. **`isMinted`/amend: no new concept.** Saving changes to a placed cast is a D-11 identity event, full stop — the dialog offers update-with-cascade, fork-as-new-model, or keep-old/pin.
> 4. **Picker is click-to-open permanently** — matches the ElevenLabs reference and preserves the create→drag trust invariant. The auto-open question is closed.
> 5. **D-29 and D-30 ratified alongside** (Group 6c gate cleared; foundations 3b/3e, success criteria 5/6/8, and DS §5.17 rewrites land with R5 prep per the resequenced plan).
> 6. **The warm→canvas-language restyle of the environment gets a named slot in the plan** (R6/R7), not an unscheduled "later."
>
> Resequenced plan R1–R7 approved; `PASS_1_BUILD_PLAN.md` rewritten to the R-sequence same day.

### D-32 — No-modal rule refined: workspaces never, selection surfaces may *(amends the locked rule)*

**What:** WORKSPACES are never modals — editing, refinement, and dense configuration always get a room (D-25 stands unchanged). SELECTION/SETUP surfaces may be modal-class: single-purpose choose-and-dismiss, one purpose per modal, no nesting, no editing workflows inside, rendered in Drape's visual language (hairlines, canvas tokens, light scrim). Concretely: the `LibraryPickerPopover` upgrades to a modal-class picker — grid + search (filters later) — with tabs for select-existing and cast-new. (refs: `ruling1-picker-modal-select-existing.png`, `ruling1-create-modal-upload-or-prompt.png`)

**Why:** the blanket rule was defending against modal *workflows*, not modal *choices*. A choose-and-dismiss picker is the one surface where a modal's focus-stealing is the point; ElevenLabs' avatar picker demonstrates the class working at production quality.

**Affects:** DS §6/§7.3; D-28 amended — its "popovers, no modals/scrims" rendering note is superseded (both-paths-at-the-node survives as both-paths-in-the-picker); `CastPickerModal` replaces `LibraryPickerPopover` (applied 2026-07-11).

### D-33 — Inline NL prompt removed as the cast node's face *(amends the locked inline-first principle for casting)*

**What:** the empty cast node's front door is the picker modal: choose existing or cast new. `NodeInlinePrompt` is no longer the node's primary interface. The M2b parser still ships fully server-side, tested against the gold standard — surfaced later as a "from prompt" option inside the create path, never as the node's face. Interim (until D-35 executes): the picker's Cast-new tab carries the prompt + cost + Run path so the VC2 loop keeps working.

**Why:** VC2 driving showed the inline prompt makes the empty node a form, not a slot; the reference-asset framing (§1.5) wants the node to *receive* an identity, not to host authoring. ElevenLabs' create-avatar flow (upload-or-prompt inside the create surface) is the working pattern.

**Affects:** DS §5.7/§5.12; foundations 3a posture; build plan M2b checkpoint (VC2.5 chip-fill on nodes is void — parser output surfaces in the create path instead). `NodeInlinePrompt` deleted from the cast node (applied 2026-07-11).

### D-34 — Cast nodes carry no attribute chrome on canvas

**What:** no chip rows, no chip popovers, no collapsed attribute display on canvas. Node face = label row, image, control strip. All configuration happens pre-cast in the casting environment; all post-cast editing consolidates in that same environment via Edit.

**Why:** the attribute block re-created the second-card problem VC1.5 tried to solve, and it duplicates the casting environment's controls in a worse medium. The board shows finished reference assets; the environment does the shaping.

**Affects:** supersedes the VC1.5 `NodeAttributeBlock` ruling and moots D-19 on canvas (the six-attribute question moves into the casting environment); M5's canvas chip popovers die (the `updateAttributes` op survives — identity events still originate in the environment and must stale downstream nodes). `NodeAttributeBlock` deleted (applied 2026-07-11). Edit's entry point on the node lands with D-35 execution.

### D-35 — The casting environment is a takeover; the canvas hosts no casting workflow *(RATIFIED 2026-07-11 with the assessment — Option B, see ratification record above)*

**What:** the full casting flow becomes: drop cast node → picker modal → "Cast new" → the complete casting environment opens as a TAKEOVER in the exact pattern of the existing double-click image viewer overlay (near-full-screen, slim frame, back/close, Esc with unsaved-work confirmation — casting holds paid in-progress state), containing full studio capability: attributes, generation, views, surgical edits, refinement. On save/mint it closes back to the untouched board and the finished package lands as the root node rendered as a character sheet, registered as the identity reference for downstream nodes. The canvas itself hosts NO casting workflow — it receives finished reference assets. (ref: `ruling4-takeover-pattern-image-viewer.png` — reuse its shell conventions.)

**Why:** rulings 2–3 already moved authoring off the node; a takeover room is the D-25-consistent home for it, and the existing `/studio` casting flow may serve as its contents — potentially collapsing most of M8.

**Affects (pending assessment ratification):** M2b/M5/M7/M8 restructure; reinforces proposed D-29 (character-sheet root) — view generation moves into the environment; amends the locked inline-first principle alongside D-33. Assessment scope ruled by the founder: (1) `/studio` casting flow as takeover contents via hosting/routing with return-to-board context + savings vs M8; (2) M7 impact — view-spawning dies, stale/identity machinery survives; (3) full scope delta + resequenced plan; (4) collisions with ratified decisions surfaced, not silently resolved. Nothing after the picker modal is built until the founder ratifies.

### D-36 — Interaction-pattern references logged (design targets, mostly M7/pass 3 — nothing built now)

| Ref | Pattern | Disposition |
|---|---|---|
| a | **Pin-initiated spawning:** dragging from a typed pin into empty space opens a menu of COMPATIBLE node types and spawns the choice pre-connected | Adopt as the primary edge-creation gesture when edges render in M7 (refs: `ruling5a-pin-spawn-menu-from-avatar.png`, `ruling5a-pin-spawn-menu-image-node.png`) |
| b | **Edge hover reveals an X-to-disconnect affordance** | Adopt with M7 edge rendering (ref: `ruling5b-edge-hover-x-disconnect.png`) |
| c | Confirmed already-covered: typed side pins (foundations §5.4/`ConnectionDot`), control strip gains an engine DROPDOWN at pass-3 multi-engine (D-12's `engine` field is the door; `ControlSegment` already has a `dropdown` kind), multi-image references per the fan-in/typed-input-roles decision (D-30 composer) | No new decisions needed (refs: `ruling5c-*.png`) |
| d | **Future-pass marker:** a board-aware agent panel is the eventual consumer of `boardState.getSnapshot` + the parser; their agent credit meter / spend-cap pattern is the D-15-consistent reference | Logged for the agent pass (refs: `ruling5d-*.png`) |

Everything renders in Drape's language — their patterns, our tokens.

### D-37 — Zoom tiers retired: spatial constancy *(amends D-1/D-2/D-3; supersedes D-4)*

**What:** with D-33/D-34 stripping the cast node's chrome, the tier system's justification is mostly gone. New policy, ElevenLabs-style spatial constancy: nodes render the same at every zoom — no chrome retraction, no placeholder-block far tier, no visual mode switches; small text at far zoom simply reads small. Two survivors, reframed: **(a)** status indicators stay counter-scaled/screen-legible at any zoom per D-6's data-integrity reasoning — a stale or failed node must never become invisible (the compact-dot *variant* is retired; one badge, floor-scaled to screen size); **(b)** a pure-performance image downgrade (thumbnail swap below readable zoom) may return **only if profiling shows dense boards need it** — invisible to the user, never a visual mode.

**Why:** the tiers existed to retract chrome that no longer exists. Constancy is simpler, calmer, and matches how the reference product survives density.

**Affects:** D-1/D-3/D-4 superseded (VC1's 0.45/0.35 threshold ruling is moot); D-2 narrowed — statuses (and the M6 toolbar's counter-scaling, pending M6) remain the only screen-fixed chrome; D-6 unchanged and load-bearing; D-5 (frames as far-zoom wayfinding, pass 3) unaffected. Applied 2026-07-11: `zoomTiers.ts` → `canvasZoom.ts` (live zoom only), all tier gates removed from primitives, `DensityMock` (a tier-tuning tool) deleted with its `?mock=density` gate.

## Group 6e — Post-VC-R1 directives (founder, 2026-07-11)

Follow-up batch after the founder drove the R1 takeover. Items 1–2 (optimistic mint landing, picker prefetch) and 4 (context-menu strip to Rename/Info/Download/Copy Image/Delete) shipped same day; D-38 records the general principle; D-39 records the identity-package brief as PROPOSED pending the founder ratifying the written assessment (`docs/specs/D39_PACKAGE_ASSESSMENT.md`).

### D-38 — Optimistic rendering is the default wherever the client already holds the data *(founder-directed, ratified)*

**What:** any interaction where the client already possesses the data renders optimistically — server confirms reconcile, **never gate**. Errors reconcile back to server truth (refetch), never leave phantom state. Corollary: queries behind user-visible surfaces are prefetched so those surfaces open against cache and revalidate (never open empty-then-load).

**Why:** the founder drives from AU against a US server; his latency is free QA — what feels snappy to him is instant for everyone. VC2's optimistic creation + local-position ledger already proved the pattern; this generalizes it from a fix to a rule.

**Applied 2026-07-11:** mint → node fill is optimistic (the takeover passes the client-held headshot + name across the D-24 boundary as plain data; `fillFromLibrary` confirms behind); `listCastableModels` prefetched on board load + front-door hover so the picker opens instantly from cache.

**Affects:** every future paid-op landing (R3 `applyModelEdit`, R5 view refresh) and every picker/dialog data dependency. Plan-derived *costs* still come from the server before firing (D-15) — optimism applies to rendering what the client knows, never to skipping the cost contract.

### D-40 — Feedback renders where the action happened *(founder-directed, 2026-07-11 post-R2)*

**What:** the toast is the fallback, not the default. When an action's surface is on screen, its feedback belongs there — the node fills, the form animates, the strip summarizes — not in a floating corner. Toasts remain correct for outcomes with no visible surface of their own (background failures, actions whose surface just closed, cross-surface notices). The toast primitive itself is restyled once in Drape's language (flat white, hairline border, no shadow, ink type, 8px radius, monochrome icons — error keeps the destructive-red glyph per D-8's reasoning) so every call site inherits it; per-surface toast styling is forbidden.

**Why:** the stock dark-blob toast violated the design language on every surface, and — worse — corner feedback made in-workspace actions (the parser's "Brief translated") invisible where the user was looking. The founder's parse-choreography directive (post-R2 item 4) is the archetype: the sentence must be SEEN becoming the form.

**Applied 2026-07-11:** toast primitive restyled app-wide (`components/ui/sonner.tsx`); the library-pick and mint success toasts removed (the node filling IS the feedback). Call-site audit delivered with the post-R2 report; inline migrations land with their surfaces (parse summary strip with item 4, wardrobe flows with pass 2, modal-local errors opportunistically). **R6's design-system update encodes this principle** in `DESIGN_SYSTEM.md`.

### D-43 — Minted casts are identity-immutable *(founder-ratified 2026-07-11, amends D-11; assessment: `IMMUTABLE_IDENTITY_ASSESSMENT.md`)*

**What (all four sub-decisions as recommended):** **(1)** Fork is the SOLE identity operation on a minted cast — the D-11 dialog becomes **fork-or-keep**, with no update option and no red (D-8's red now belongs to delete-cascade alone). Drafts stay freely editable pre-mint; mint is the moment identity becomes real. **(2)** Refinements/surgical edits on minted casts are **not staleness events** — same person; D-12 `InputSnapshot`s carry reproducibility; at most a quiet Info note. **(3)** The v-chip is hidden at v1; at >1 the chip itself opens version history. **(4)** Immutability is enforced server-side keyed off **`status !== 'draft'`** — no status value is a loophole; `applyModelEdit` refuses `decision:'update'` structurally, verified in the permanent drive over raw tRPC HTTP with the UI bypassed.

**Why:** the system already promised this three times — the D-11 dialog's own copy ("makes this a different person"), the studio's "identity is locked" banner, and D-39's model-level identity key. R3's update path was the anomaly. Immutability makes `modelId` a trustworthy identity key before R3b builds the package on it.

**Affects:** D-11 amended (identity events on minted casts resolve to fork); D-8 scope sharpened (one red action in the app: deleting work); R5 scope shrinks ~1–1.5d (identity-edit staleness vanishes; per-tile quality refresh, pins, and aggregate refresh remain; the stale machinery stays built as pass-2 infrastructure). Implemented 2026-07-11 (server guard, fork-or-keep dialog, v-chip ruling, drive invariant E).

### D-42 — Drafts in the picker: placeable, honestly presented *(founder-ratified 2026-07-11, post-parser-signoff ruling B)*

**What:** the Draft tier's exploration-without-commitment extends to the board — candidate comparison (cast several, place side by side, commit to the winner) is a core workflow. **(1)** The picker gains sections: "Your models" (minted, named) first; **Drafts** below, visually quieter, captioned "exploring, not yet cast". **(2)** Draft cards wear a **Draft badge** and never the fake auto-name — unnamed renders as unnamed (the "Draft Model" sentinel is stripped server-side). **(3)** A placed draft node carries its status in the label row (`Cast · Draft`), and its **Edit path is the promotion route**: the takeover opens on the draft with the normal mint gate — name/mint/add views — and the node updates in place, badge cleared, via the same fill landing. **Applied 2026-07-11** (picker sections + badges + node label + honest stamping shipped with R3, which owns the Edit entry).

**Why:** hiding drafts made the board lie about the library; showing them with a fake name lied about the drafts. Honest presentation gets both workflows.

**Affects:** `listCastableModels` (+`draft`, minted-first sort), `fillFromLibrary` (draft stamp + honest label), `library_cast` provenance (+`draft`), `CastPickerModal`, `CastNode` label row, R3's Edit entry.

### D-41 — Open (né "Engine's choice") + the two-keystroke cast *(founder-ratified 2026-07-11, per-field rulings included)*

> **Ruling A (founder, 2026-07-11, post-parser-signoff): the UI vocabulary is "Open".** "Engine's choice" was dev vocabulary leaking into the UI (users don't know there's an engine), and "AI's choice" is the wrong register and collides with the future board-agent feature. The state means *deliberately unspecified — resolved at generation*; fashion's own word fits. Canonical copy: chips and field states read **"Open"** (`Age · Open`); the summary strip tail reads **"everything else stays open"**; tooltips/long copy say **"left open — the casting resolves it."** One vocabulary across every surface this state appears — form fields, chips, strip, and any D-11-adjacent copy. Internal identifiers (`engineChoice`, `resolveEngineChoices`) stay dev-side and must never leak into copy.

**What:** the required-field contradiction is resolved in the restraint philosophy's favor. **(a)** Every required cast field supports an explicit **Engine's choice** state that satisfies validation — displayed as the field's value, cleared by selecting a value, selectable on the pure form path. It is UI-only state: what the engine receives is *absence*, made honest per the per-field rulings: gender → `ENGINE'S CHOICE — cast whoever best serves the brand direction`; age → suited to brand and vibe (the old silent Female/23 defaults are dead, including as form defaults); brand → resolves to a random pick from the eight **at fire time only** (recorded for D-12 reproducibility; the prefill path leaves brand open — a pick the user never made must not appear as "understood"); everything else (skin, iris, hair, ethnicity) was already genuine engine creative space. **(b)** The flow is two keystrokes: brief + Enter fills the form (parsed values + Engine's choice on the rest) and arms the Cast button with its cost visible and focused; Enter again fires. **No auto-fire** — D-15's deliberate-spend covenant holds; the armed-button glance is the correction window.

**Parse choreography (the visible half):** parsed fields fill with a sequential ink-pulse sweep (~600ms), affected sections auto-open and scroll into view, and a **summary strip directly under the brief field** replaces the corner toast (D-40's archetype): "Understood: [chips, tappable to jump to their control] · everything else — engine's choice."

**Why:** the parser's ratified restraint deliberately leaves fields null as the engine's creative space; validation that blocks on those same fields contradicts the philosophy and strands the brief flow one step from casting. And feedback that lands in a far corner while the form changes silently fails the first-time user — the sentence must be SEEN becoming the form.

**Affects:** `useCastingFormStore` (empty gender/age/brand defaults, `engineChoice` state), `isFormValid` semantics, `buildNewPromptContent` identity directives, `resolveEngineChoices` on both paid paths, `EngineChoiceChip`/`ParseSummaryStrip` (new surfaces, canvas language per the R6 discipline), Cast button cost display. R4's keyboard work inherits Enter-fires-focused-button as the ratified second keystroke.

### D-44 — The sixth slot is WALK, not static side-full *(founder-ratified 2026-07-12 at VC-R3b; amends D-39.1)*

**What:** D-39's sixth slot `sideFull` is ratified as a **deliberate walking pose** (option A), not a static full-body side. It turned out the legacy full-body-side was already generated as a walking shot and occupies this slot; the ruling makes that intentional and first-class. Fashion comp cards traditionally include a walk, and a walking side view is a stronger dynamic-pose reference for D-30's composer payload and the future video pass than a static side-full. The slot's label stays ("Walk"); its prompt treats the motion pose as intended; **its identity gate is mandatory** — a motion pose has more drift room than any static view, so the slot that most needs the gate must have it. **Gate-on-walk is scoped into the stage-lock unification report** (`STAGE_LOCK_UNIFICATION_ASSESSMENT.md`) and lands with that work, pending ratification; the label/semantics amendment applies now.

**Why:** the package should encode a real comp card, and a walk is part of that vocabulary. Leaving the walk ungated while the back view is gated is backwards — rotation-and-motion drift is worst exactly here.

**Affects:** `VIEW_ANGLE_LABELS.sideFull` ("Walk"), `mintPackage` `SINGLE_VIEW_TYPE.sideFull='walk'` (already), the gate set (extends beyond `backFull` to `sideFull` — folded into the unification report), D-39.1 record.

### D-45 — Credit balance visible on money-spending surfaces *(founder-ratified 2026-07-12 at VC-R3b; closes a D-15 gap)*

**What:** balance was invisible from the canvas and the takeover — you had to return to the lobby to see it, on the exact surfaces where credits are spent. Two placements, both ratified, both in canvas language, build when convenient (R4-adjacent or with R6): **(1)** the takeover header carries the balance as a quiet tertiary figure (tabular number, ink, no icon) left of the primary Cast/Save action, clickable to the top-up modal, updating on the same refetch that already follows every generation; **(2)** the board top bar's profile/avatar button opens a small popover with the balance line + a "Top up" action — no permanent number on the canvas (keeps D-34's clean-canvas spirit). If only one ships, it is (1).

**Why:** D-15's deliberate-spend covenant assumes the user can see what they're spending against. The tier dialog shows prices; the balance completes the arithmetic at the decision point (D-40 — feedback where the action happens).

**Affects:** `CastingTakeover` header, board top bar profile popover, `credits.getBalance` reuse; no schema.

**Applied 2026-07-12 (with R4):** placement (1) shipped — quiet tabular figure left of the primary action, click → top-up modal, updates on the post-generation refetch. Placement (2) rides with R6's board-chrome work.

### D-46 — One view system: stage-lock retired, view generation is the mint gate *(founder-ratified 2026-07-12, Fable audit + riders; assessment: `STAGE_LOCK_UNIFICATION_ASSESSMENT.md`)*

**What:** the pre-D-39 sequential ladder (headshot → *"Lock Headshot & Generate Body?"* → body → *"Lock Body & Generate Side?"* → side) and its `StageLockModal` are retired. There is **one** view system: the six-slot package strip, where an empty slot's ghost opens `CastModelModal` — **mint** mode for a draft, **upgrade** mode for a minted model. Nothing in the old stage-lock was load-bearing (full-body generation reads the *current* headshot at generation time, never a frozen one; `isViewLocked` already bypassed minted edits). It crudely pre-empted staleness by forbidding edits, which D-43 + the package ledger now *represent* instead. Ratified **with riders**, all three landed in the unification commit:

> **Rider 1 (draft views, ratified knowingly):** adding views to a draft routes through the **mint gate** — a draft holds only its headshot; the pre-mint body/side ladder is gone. Exploring beyond the headshot is a Core mint away (same cost, upgrade-anytime).
>
> **Rider 2 (endpoint removal, MANDATORY in this change):** the legacy `generation.fullBody` / `generation.multiView` procedures are **removed**. Fable verified they accepted `back`/`walk` with **no identity gate** over raw tRPC — the exact ungated-write bypass class D-43 closed. An ungated view path may not outlive the unification. All view generation now flows through `mintPackage` (gates back/walk, prices per slot). Closure asserted by unit (`batch3-hardening`: both procedures absent) **and** drive (invariant **E5**: raw tRPC POST to both → 404/NOT_FOUND).
>
> **Rider 3 (D-40 toast hygiene, this batch):** the `"${name} has been cast!"` toast (a legacy survivor — the node filling on the board IS the feedback) and the `"N views added"` toast (the strip visibly fills) are removed.

**Why:** two view systems split by `status` — draft ghosts firing the old stage-lock while minted ghosts opened the tier dialog — is incoherent, and the stage-lock's threat copy (*"you won't be able to return and edit the head"*) directly contradicts D-43's freely-editable drafts. The endpoints were a live re-opening of the D-43 bypass. Unifying is mostly deletion.

**Walk-gate (folds in, D-44):** the sixth slot's identity gate is mandatory; `backViewGate` generalizes to a per-angle gate covering `sideFull`/walk with the same retry-then-refund contract. **Calibration note (log):** motion poses have more drift room — if the walk gate over-rejects, tune the prompt/threshold before it churns refunds on every Production mint; budget a calibration loop when real walk generations flow.

**Affects:** `castingImaging.ts` (both procedures deleted + import cleanup), `useCastingViewGeneration` (gutted to an Export-only `nextStage`; stage handlers + `generation.fullBody`/`multiView` mutations gone), `useCastingGeneration` (`isViewLocked`/`hasDownstreamDependencies` → constant `false`), `StageLockModal` (deleted), `ViewTabs` (one six-slot render; ghosts → `casting-open-mint` | `casting-open-package-upgrade`), `CastingTakeover` + `DrapeStudio` (mint-event listeners), `useCastGate` (rider-3 toasts removed), `batch3-hardening.test.ts`, drive invariant E5.

**R7 log (from Fable's audit + this batch):** (1) the failed-slot marker insert in `mintPackage` uses `.catch(() => {})` — unlogged, the same silent-audit-gap class as the `createGeneration` bug; give it a logged failure path. (2) `createModel`/`createModelAsset` still use newest-row-by-`createdAt` id lookup (convert to `$returningId()`). (3) storageUrl-less **marker rows leak unfiltered** into `models.get` and the public registry bundle — filter them at the query boundary (client `buildHistoryFromAssets` already filters, but the raw payloads shouldn't carry them). (4) dead stage-lock plumbing (`setLockModal`/`closeLockModal`/`LockModalState`/auto-gen bindings in `castingBindings` + `useCastingUIStore`) — remove once the canvas `useCastNodeController` (R4) is settled, to avoid churn on a concurrently-built file.

**R6 log:** `FailedSlot`'s amber is a **named third hue**, unsanctioned by any ruling — defensible pre-restyle (a failure genuinely isn't ink-or-red), but it needs a verdict when the environment restyle sets the palette.

## Group 6f — VC-R4 rulings (founder, 2026-07-12)

VC-R4 verdict: **the grammar passes** — toolbar, fork-beside, delete/undo, keyboard, Esc stack. Reference screenshots in `docs/specs/references/` (`fix2-`, `fix3-`, `fix5-`, `ruling1-`, `logitem-` prefixes). Five fixes shipped same day: **(1)** takeover balance labeled "{n} credits" + hairline-separated from the action cluster (it read as the action's price — D-15/D-45); **(2)** Info panel formats human fields (`ethnicityBlend` → "South Asian 100%", `castingVibe` → percentage blend; `referenceImage`/`engineChoice` never rendered — D-41 leak guard) and Technical Schema gets the same Copy affordance as Master Prompt; **(3)** Spec tab rendered literal "null" — edit-session hydration never set `currentTechnicalSchema` (the other hydration paths did); plus a graceful no-spec state for pre-schema models; **(4)** click-vs-drag threshold (`nodeDragThreshold`/`paneClickDistance` = 4px) — tiny drags were eating selection clicks; **(5)** marquee select via ruling R1.

**Delete-cascade semantics CONFIRMED as implemented (not a bug):** post-D-46, views are model-level and a board root is a placement — deleting it soft-deletes silently with Undo. The red cascade dialog keys off `generated_from_cast` edges (client prediction and server unit alike), which cannot exist until R5 pop-outs; when R5 materializes pop-outs with those edges, the dialog activates with no further wiring.

### D-47 — Pointer splits into Select and Hand *(ruling R1)*

**What:** two pointer tools as a left cluster on the pill (ElevenLabs reference: `ruling1-elevenlabs-tool-separation-select-hand-comment.png`): **Select** — drag on empty canvas draws a marquee (partial-intersection selection; middle/right-drag still pans); **Hand** — drag pans. **Space held = temporary hand** (canvas convention; React Flow `panActivationKeyCode`). Resolves fix 5's pan/marquee conflict; Select is the default tool.

**Affects:** `FloatingToolPill` (pointer cluster), `BoardCanvas` (`selectionOnDrag`/`panOnDrag`/`SelectionMode.Partial`), DS §5.3; F Decision 7's Space+drag row now formalized as the temporary-hand.

### D-48 — Variations spawn BELOW; fork spawns beside — geometry is semantics

**What:** the founder withdraws his earlier "beside might feel better": beside is the FORK geometry (a different person joins the row), below is the VARIATIONS geometry (candidates of the same person). Two semantically different spawn types must not share a geometry. Revisit only at R5 if the sheet's node heights change the feel.

**R7-7D correction (D-69):** D-69 supersedes the parenthetical identity
meaning above. Fork now means an independent copy of the same Cast identity;
this entry preserves only the historical Canvas placement choice. Recast may
create a different person. Its Canvas geometry is not decided here.

### D-49 — Frames tool retired until pass 3 *(ruling R3)*

**What:** the frames tool is removed from the pill and Add menu NOW — it was a legacy stub with no real job. Frames return at **pass 3 as export units** per the ratified frames-as-export proposal (D-20) — the tool comes back wearing its real job. Existing frame nodes keep rendering (FrameNode stays; only creation affordances are gone).

### Logged for future passes (VC-R4, no build)

- **Board chrome top-right cluster** — profile / assets / comments (ElevenLabs reference, `logitem-*.png`). Assets-as-persistent-library-sidebar is a pass-2/3 question; comments are collaboration-pass; **comment-click → pan/zoom-to-location** is the interaction to spec when it arrives.
- **Board-agent capability bar** — ElevenLabs' Flows Agent located and rewrote an LLM node's prompt from the chat instruction "make the text more dramatic" (`logitem-agent-edits-node-prompt-from-chat.png`). The bar for our future board agent: the `boardState.getSnapshot` consumer must be able to read the board, locate the right node, and propose/apply edits. Extends D-36d.

### D-39 — Canonical identity package + tiered mint *(RATIFIED 2026-07-11, all lines — see ratification record below)*

> **RATIFICATION RECORD (founder, 2026-07-11) — `D39_PACKAGE_ASSESSMENT.md` ratified, all lines:**
> 1. **Sixth slot = `sideFull`, confirmed** — symmetric face cluster (front/side/¾ close) + body cluster (front/side/back full).
> 2. **Model-level package ratified** — one staleness ledger on `model_assets`; board pop-outs *reference* model assets; `cast_view` board rows never ship. **Amends D-29** (its board-level view records are superseded; the sheet, per-tile status, and pins read/write model-asset state).
> 3. **R3b ratified as scoped** (three-quarter view, back gate, tiered mint dialog, package read model, composer slot-recording; between R3 and R4; plan +2–2.5d).
> 4. **Back-view identityCheck gate ratified**: one auto-retry, then fail named-and-refunded — replaces the "No new back tattoos" text plea.
> 5. **Keyboard**: `Cmd+C`/`Cmd+V` alias to Duplicate for same-board in R4 (hands expect the keys); **cross-board paste logged as a future D-16 amendment**, not R4 scope.
> 6. **R3 session-mode design ratified**: stage-lock disabled for minted edits; every save routes through `applyModelEdit` → the D-11 dialog; the mode lives in shared workspace state so session bleed can never bypass the dialog (a `/studio` resume carries the same routing).

**What (founder brief, 5a–5e):**
- **(a)** The canonical package is **six slots** — front headshot (default cast output), side profile, three-quarter, full-body front, full-body back, plus one further slot to be confirmed at ratification (five were named; the current system's sixth canonical view is full-body side). Face cluster (headshot, side profile, three-quarter) locks facial identity; body cluster locks silhouette/build for VTO and scene work. Back views need an identityCheck-style verification gate before joining the package (angles research: person-rotation hallucinates past ~120°).
- **(b)** The mint dialog's "generate side view (recommended)" is replaced by **tiered packages**: **Draft** (headshot only — always allowed; exploring candidates), **Core identity** (+ side, ¾, full-body front; ready for downstream work), **Production sheet** (all six; full comp card for scenes/video). Each tier shows its credit cost per D-15, and the copy explains what each tier is FOR.
- **(c)** Package completeness is a **first-class model property**: the R5 sheet renders empty slots with add-view affordances (upgrade anytime, no re-cast); D-30's composer degrades gracefully and records which slots it used per generation in the `InputSnapshot`.
- **(d)** Hard constraint on D-30: the composer operates under a **per-generation reference-image budget (~5–6 usable)** before identity fidelity degrades. Multi-model scenes fit inside it — per-model allocation drops to headshot + one task-relevant view, with the text identity description doing more work. Full-package-per-model is never the strategy; staged composition is the future escape hatch for 3+ subjects (logged, not scheduled).
- **(e)** Proposed landing in the R-sequence and per-slot capability/risk analysis: see the assessment doc; plan is rewritten only on ratification.

**Affects (on ratification):** studio view system (three-quarter slot is net-new), mint dialog (`CastModelModal` → tiered), D-29 sheet slots, D-30 composer + `InputSnapshot`, model-assets schema (per-slot status/pin home — see assessment collision), R-sequence.

## Group 6g — R5 planning rulings (founder, 2026-07-12)

Issued at R5 plan approval (the comp-card milestone). Reference screenshots `ruling6-*.png` in `docs/specs/references/`. The four R5 design forks were put to the founder with previews and ratified: **(1)** comp-card grid = headshot-dominant mosaic (headshot spans 2×2, views fill around, ghosts for empty slots); **(2)** pop-out placement = right of root, stacked downward — knowingly shares fork's "beside" axis; **flagged for the founder's VC-R5 feel ruling per D-48's revisit clause**, placement is one constant; **(3)** pin-initiated spawning (D-36a) ships scoped: drag from the root's out-pin into empty space → six-slot menu → spawns that view popped-out, pre-connected (consumer node types join the menu with pass 2/3); **(4)** D-36b's edge-hover X-disconnect is **deferred to pass 2, superseding the original milestone brief knowingly** — lineage edges are facts (history), not wiring; disconnect arrives with the input-edge class it applies to.

### D-50 — Group selection grammar *(founder-directed at R5 plan approval; ElevenLabs reference `ruling6-elevenlabs-group-select-context-menu.PNG`, current clutter `ruling6-drape-multiselect-clutter-current.png`)*

**What:** multi-select (D-47 marquee) currently renders N per-node toolbars — cluttered and group-illiterate. Five sub-rulings:

1. **Selection >1 renders as a group**: one visual container with padding around the selected set, in the selection language (hairline/ink, no blue); per-node floating toolbars suppressed, replaced by ONE group toolbar. Right-click on the selection opens a context menu in **parity** with the group toolbar — same actions, two surfaces.
2. **Group action set, pass-1-honest**: Duplicate · Download all · Focus (zoom-to-selection) · Delete (routes through the existing soft-delete + cascade dialog; one red confirm covers the set). Cmd+C/V alias Duplicate per the R4 keyboard ruling.
3. **Tidy up** (auto-arrange respecting D-31 geometry and variable comp-card heights) — v1 spec banked: row-major pack over **measured** node dimensions (React Flow `node.measured`), reading-order sort (y then x), 60px gutters, row height = tallest node in row, committed as ONE batched `moveNodes`. **Ratified as a requirement, not an implementation detail: Cmd+Z reverses the whole tidy** (one entry on the move-undo stack). Cluster-aware arrangement (roots + popped views/variations/forks keeping their semantic geometry) is deliberately not v1 — it lives in D-48's revisit territory and is ruled on real boards.
4. **Run all — semantics ratified now, execution deferred to first consumer nodes**: run-all = execute the selected subgraph in dependency order. Cast roots are **sources** — they feed, never regenerate; D-43 untouched by design. Pass-1 boards contain no executable nodes, so the action ships with pass 2/3's first consumers; the group toolbar **reserves the slot** (disabled, tooltip). Batch execution inherits existing contracts: one aggregate `plan()` confirm (D-15), per-node named-and-refunded failures.
5. **Edge classes** (the full context for run-all, D-30's composer, and the future board agent — all consume the *input* graph): lineage edges (history: `generated_from_cast`, `forked_from`, `variant_of`, `iterated_from`) stay distinguishable from input edges (dataflow: `vto_input_model`, `vto_input_garment`, `reference_for`, D-30 weighted references). R5 ships `EDGE_CLASS` in `shared/boardTypes.ts`; edge rendering and the pop-out edge select by class, never by ad-hoc relation lists. R5 is the cheap moment to shape this — encoded in foundations Decision 2.

**Landing seam (founder-ruled):** items 1–2 + the reserved Run-all slot ride R5 as a thin rider (suppression is a render gate; the actions reuse shipped mutations; VC-R5's marquee-over-tall-comp-cards drive is exactly when the clutter is worst). **Tidy up defers to R6** with the v1 spec above banked.

### D-51 — The comp card: canonical vocabulary + the strip verb *(founder-ruled at R5 planning; same class as D-41's "Open" ruling)*

**What:** the user-facing name for the composite object (the root rendering its package) is the **COMP CARD** — fashion's own word for exactly this artifact (headshot + angles + walk on one card; agencies hand these to clients). "Character sheet" remains internal/docs shorthand only; "views" remains schema vocabulary only; neither appears on user-facing chrome. Related copy inherits now: the tier dialog's **"Production sheet" tier renames to "Full comp card"** (its description already says "the full six-view card"), and all R5 copy refers to the rendered composite as the comp card.

**The strip segment — one verb, three honest states** (replaces the dead pre-D-46 `+ Views` stub):
- **Draft** (headshot only, no card grid exists): segment reads **"Build comp card"** — opens the takeover at the mint gate. This state is why the segment must exist: ghost tiles can't carry the affordance when there's no grid yet.
- **Minted with empty slots**: segment reads **"Complete card"** — opens the takeover in upgrade mode, same route as the ghost tiles.
- **Complete six-slot model**: the segment **disappears entirely** — a permanent verb with nothing to do would be the unintuitive thing.

Ghost tiles remain the in-card accelerator; the strip verb is the stable anchor (the R4 grammar philosophy: stable locations anchor, in-context affordances accelerate). **Scope guard:** only the vocabulary and state logic land in R5 — the strip's visual treatment stays R6's restyle problem.

### R5 build log (for R6/R7)

- **R7, trust surface — E1b phantom-diff race:** under bot-speed interaction (the drive, ~50% of runs on a loaded machine), opening Edit on a minted model and saving with ZERO changes intermittently raises the D-11 fork ceremony — the VC-R3b bug-2 class surviving as a hydration late-write race (baseline vs a post-hydration prefs write; the drive's E1b leg now retries once and still catches it). Pre-existing surface (R5 didn't touch hydration); at human speed it needs a fast save right after open. Diagnose which field drifts (suspects: the D-41 Open-state gender/brand normalization) before R7 closes.
- **R6/R7, perf — `listCastableModels` N+1:** one `getModelAssets` roundtrip per model; at ~30 models on the remote dev DB the picker's first paint exceeded 10s under load. One joined query fixes it.
- **R6/R7, perf — `packageState` fan-out:** one query per model per board (prefetched, D-38). Fine at pass-1 board sizes; a batched `packageStates(modelIds[])` is the fix if boards grow.
- **Drive lesson (encoded in the script):** mid-run zoom/pan gets debounce-saved to the board, so the drive now resets the viewport at setup — without it, runs start wherever the previous one ended and every position-sensitive leg lies.

## Group 6h — VC-R5 rulings (founder, 2026-07-12)

**Verdict: the comp card lands** — mosaic reads as one object, pop-out/collapse, ledger-exact refresh, pin, group selection, strip verb states, and the D-51 vocabulary all pass. Five fixes shipped same day:

1. **BUG (trust layer): cascade prediction counted phantom views** — the red dialog claimed "2 connected views" over an empty cascade after a pop-out/collapse cycle. Two holes closed: server `cascadeUnit` now alive-filters `generated_from_cast` targets (edges survive soft deletes by design — a directly deleted popped view left a phantom), and the client prediction requires the target alive in the items cache (the edge cache holds optimistic appends + stale rows at AU latency); collapse also prunes its lineage edge from the edge cache optimistically. Drive: O7b (collapse removes the edge server-side), O9 (pop-out → collapse → delete root = NO dialog, plain soft delete). **The one red mark in the app must never lie about its blast radius.**
2. Lineage edges stroke `ink-soft` (border-grey on the grey board was nearly invisible); DS §8 amended. Curve rigidity accepted as-is for lineage.
3. Popped views' first toolbar slot = **Return to sheet** (right-click-only was a hidden verb) — replacing Rerun, which is a root verb (views regenerate via per-tile Refresh, foundations 3e).
4. Marquee of ONE = a single selection: React Flow's invisible nodes-selection rect gets `pointer-events: none` (it was eating strip/toolbar clicks); group-drag survives via node-drag.
5. Comp-card tile double-click opens the viewer on the CLICKED view (tile dblclick stops propagation past React Flow's node handler).

### Rulings

- **R1 — mosaic feel: PASS as built** (reads as one comp card).
- **R2 — D-48 pop-out geometry flag CLOSED:** right-of-root approved; no hand-confusion with fork-beside in practice.
- **R3 / D-52 — the canvas double-click viewer is VIEW-ONLY:** zoom, pan, download, full stop. It exposed editing/refine affordances with no Edit intent and outside the D-11 ceremony; editing lives in the environment via Edit. Implemented as `CanvasImageViewer` (replaces `ModelEditorOverlay` on the board — that file is now orphaned; R7 sweeps it, closing the D-25 remnant). **R6 note:** the viewer's background (`#FAFAF8` + dot grid) is founder-flagged as better than the board's — restyle reference.

### Assessments commissioned (report-only, founder rules)

- **A1 — per-view edit coherence:** the environment's per-view refine path can diverge one view from the package (e.g. tattoos added on the full-body only). Assess what the current path does, what guards coherence, and the right model (package-level edits / divergence marking / cross-package identityCheck); fold into R6's environment-restyle scope if that's the home. → `PER_VIEW_EDIT_ASSESSMENT.md`.
- **A2 — lobby grace (R6-adjacent, sizing):** (a) Library → Models → clicking a cast teleports into the wardrobe studio — should offer options (view / open in casting / dress); (b) every canvas cast floods the lobby Recent Work feed — needs curation (group by board, exclude unnamed drafts, or cap per source).

### Logged for future passes (VC-R5 batch — encoded in `PASS_4_VIDEO_NOTES.md`)

- **Voice as identity attribute** (pass 4): voiceId + provider on the model record, assigned in the casting environment; comp card voice affordance; D-30 composer includes the voice reference on video-with-dialogue — identity lock extends to audio.
- **Engine-aware payload + two comp-card classes** (extends D-30; pass 3/4): image engines get individual references (unchanged); video engines get one sheet per character — usually the STYLED comp card, itself a pass-3 generation ("Make styled comp card": dressed output + canonical references → multi-angle dressed sheet, paid + identity-gated). Canonical vs styled sheet classes; manifest records which fed each generation. **Design principle rider: node inputs are never prescriptive — the composer adapts to whatever the user wired and degrades gracefully; guarantees over workflows.**
- **Pass-4 planning pointer:** the founder's Seedance conventions are a snapshot — pass-4 planning starts with a fresh capability review + a working session to extract what still holds; aesthetic layer builds from TOOL_PROTOTYPES_NOTES.md regardless.

## Group 6i — Post-VC-R5 follow-up batch (founder, 2026-07-12)

Rulings on the Group 6h assessments plus a driving batch that hadn't reached the build session. All fixes-1–5 acknowledged; the A1/A3 combined ruling is pending A3's report.

### Rulings applied

- **A1 — SEAL NOW, DESIGN IN R6 (two stages, both logged):** *Stage 1 (applied)* — `generation.iterate` refuses identity-level edits on non-draft models BEFORE money moves, via a TEXT_ECONOMY edit classifier (`server/casting/editClassifier.ts`; fail-open like the back gate; `ITERATE_CLASSIFY_FORCE_IDENTITY=1` hook; refusal copy carries fork guidance). Cosmetic refinements stay allowed (D-43.2); drafts stay freely editable. The bypass was the same ungated-write class as D-46's rider-2 endpoints and did not outlive its milestone. *Stage 2 (R6, with the surface restyle):* the full A + B-lite — designed fork-guidance UI, and the stale-writer lit for identity-classified draft edits (siblings marked on `model_assets`; the dormant read side activates).
- **A2(b) applied:** UNNAMED drafts excluded from the lobby Recent Work feed (`mergeRecentWork` filters to honestly-named drafts; `DRAFT_AUTO_NAME` sentinel exported) — canvas candidates live on their board (D-42's marker). Grouping/per-source caps remain the escalations. **A2(a) → R6:** modal-class library-card chooser (View comp card / Open in casting / Dress in wardrobe).
- **Ruling A — the empty board is QUIET (applied):** the floating "+ / click to add" affordance is dead; dotted grid + one tertiary line ("Add a cast to begin"); no introductory modal (workspaces-never-modals; D-9's ratified ghost-composition first-run owns onboarding at R6). The pill carries the invitation.
- **Ruling B — the pill is FLAT (applied):** no + → popup; every addable node type is its own segment (Cast · Note today; Image/Video/etc. join as passes land — one ToolButton each, nothing sized to the segment count per D-18). Right-click `AddNodeMenu` survives as the at-cursor path. DS §5.3 amended.

### R6 log additions

- **Note nodes need a design pass** — current rendering is unconsidered; fold into R6's restyle sweep (typography, sizing, the yellow).
- **Out-pin discoverability** — the D-36a spawn pin (10px monochrome dot, card's right edge at label height) is easy to miss; consider grow/ink on hover or selection at the restyle.
- (Carried from 6h: A1 stage 2, A2(a) chooser, viewer background as board restyle reference.)

### Assessment commissioned

- **A3 — slot versions vs legacy studio undo** (report only, → `SLOT_VERSION_REVERT_ASSESSMENT.md`): the slot ledger (Three-quarter · v3, newest-wins rows) and the studio's in-session undo are two version systems unaware of each other. Assess: what the legacy undo actually controls; revert-as-copy-forward on the ledger (tile popover version row → "Use this version", zero generation cost, pin-compatible); collisions with pins/staleness/D-12 snapshots; whether it folds into A1's coherence question. Founder rules on the combined A1/A3 picture.

> **RATIFICATION RECORD (founder, 2026-07-12, post-re-drive):** re-drive PASSED — the seal refuses identity edits and allows cosmetic tweaks correctly, pin-drag works, the phantom cascade is gone, quiet board + flat pill + feed all correct. **Combined A1/A3 ruling: RATIFIED as recommended → D-53.** Both assessment docs marked RATIFIED.

### D-53 — The slot ledger governs generated views *(founder-ratified 2026-07-12; combines A1 + A3; assessments: `PER_VIEW_EDIT_ASSESSMENT.md`, `SLOT_VERSION_REVERT_ASSESSMENT.md`)*

**Canonical statement (law):** *"Every change to a slot is a new ledger row (cosmetic iterate / refresh / restore); identity changes fork; the ledger is the single version history; pins mark accepted-final."*

Ratified specifics:
- **`restoreSlotVersion`** naming approved — never "revert" (boards' `revertItemVersion` mutates the head backward; two same-named verbs with opposite semantics is the confusion to avoid; the board-side verb keeps its name and its 3f identity-event routing). UI verb: **"Use this version."** Copy-forward append, zero generation cost; restored rows arrive **unpinned** with `restoredFromAssetId` provenance (D-12 audit chain intact).
- **Surface:** the tile popover's version thumb-strip (the D-29 per-view surface — no new chrome class).
- **Legacy casting undo/redo retired** for generated views; **hold-to-compare kept** (honest preview, no persistence pretense); the viewer's vN **unifies onto the ledger count** (one version vocabulary; the client-stack denominator dies). Wardrobe's separate VTO undo untouched.
- **Lands as ONE rider (~2–2.75d, incl. A1 stage 2:** designed fork-guidance UI + the stale-writer for identity-classified draft edits**) on R6's environment-restyle slot** — the restyle reworks these exact surfaces; three separate touches would be waste.

### Second re-drive batch (founder, 2026-07-12 — F1–F6; fixes applied same day)

- **F1 (trust class, applied + drive invariant T):** a cosmetic iterate on a minted model wiped sibling views from the environment strip. NOT the seal — the pre-package ladder's client-side sibling-dropping in `performIteration` (rows were always alive; the undo toggle "restoring" them was the tell). Fixed per D-53: only the edited slot's asset replaces; siblings stay; divergence marking belongs to the stale-writer. Invariant T (paid, letter-gated) proves it live: seal passes cosmetic, ONE new row, siblings survive, ledger nets 350.
- **F2 (applied + drive N5):** the out-pin rendered as an invisible white sliver — `CanvasNodeShell`'s `overflow-hidden` clipped the outer half, leaving white-on-white. The pin now lives outside the shell (12px, bordered) and **grows + inks on node hover/selection** (discoverability promoted from the R6 log to now). N5 asserts visible-at-edge permanently.
- **F3 (applied):** the Recent Work over-cut — the casting source keyed on `status='draft'`, but naming happens at MINT which flips status active: a cast left the feed's universe the moment it was named, and the unnamed-filter emptied the rest. The source is now **named casting work** (named drafts + minted models) through the same honest-name filter; unnamed candidates stay excluded (A2(b)'s intent).
- **F4 (copy, applied; stage 2 designs the surface):** the refusal teaches the doors — *"This changes who {name} is — their identity is minted. Fork to explore it, or include it at casting time."*
- **F5 (R6 log, no build):** distinctive marks (tattoos, scars, accessories — ANY added feature) are already supported through the right doors (casting-brief free text → minted identity, all views inherit; or iterate on a draft). What's missing is **discoverability, not a feature** — nobody knows iterate can ADD things. R6's environment work surfaces it (e.g. rotating placeholder examples on the iterate field: "brighten the lighting · add a small tattoo · soften the makeup"). **Explicitly NOT a selector** — marks are open creative space; enum-izing them is wrong. Copy caveat: small positional details are the hardest cross-view consistency case; the refresh identity gate is the guard.
- **F6 (sharpens A1 stage-2 scope — the rider's MOTIVATING CASE):** confirmed on a draft — iterating a tattoo onto one view leaves siblings visibly inconsistent with nothing marking or offering the fix; this holds for ANY divergent addition (tattoos were the test case). The iterate classifier's cosmetic/identity line **doubles as the doesn't-stale/stales-siblings line for drafts**: a divergent edit marks siblings stale, the `{N} stale` segment lights, bulk refresh offers the paid fix per D-15. R5 shipped the entire read side dormant — until the writer lands, draft packages silently diverge.

### Close-out batch (founder, 2026-07-12 — final re-drive all green; session ends, R6 opens fresh)

**Re-drive:** F1 (siblings survive iterate), F2 (pin visible, inks on hover, drag-spawn end-to-end), F3 (feed correct), F4 (copy live) all verified. The v4→v3 undo non-update confirmed expected per A3 (legacy toggle, dies in R6).

**Bug 0 (applied + drive invariant U):** pop-out placement degraded with multiple views — the stack formula incremented y unboundedly, sending a fifth view half a screen down. Placement is now the **nearest free slot**: a 2-rows-per-column grid wrapping rightward, collision-checked against every alive node (not just siblings), capped at 8 columns — every placement within 1.5 view-heights of its predecessor and beside the root. Invariant U pops all filled views over raw tRPC and asserts the geometry.

**Small logs (R6 sweep):**
1. **D-38 straggler:** after a cosmetic iterate in the environment, exiting to the board updates the mosaic tile with a visible delay — carry the client-held new image across the close optimistically (the mint path's 5ms-fill pattern), refetch reconciles behind.
2. **Naming collision:** the SLOT pin (tile popover Pin/Unpin — the keeper flag) and the OUT-pin (spawn drag-dot) are two unrelated concepts sharing one word — R6's restyle renames one (out-pin → "spawn dot"/connector, or slot-pin → "Keep").
3. **D-54 — double-click routing by node class (ruled; implementation rides R6):** comp-card TILES double-click into the casting environment focused on that view (tiles are working objects; pairs with the spatial-environment direction). The view-only image viewer (D-52) remains the double-click for standalone image-class cards (popped views, future image nodes).

**R6 scope addendum — the legacy `/studio` shell (both "last pre-canvas residue" class):**
- **(a) Shell unification (assess in the R6 plan):** the lobby-accessed studio still renders the old left sidebar (profile/settings) — functions long since moved to the lobby rail and popover. Assess whether anything in it is still load-bearing (wardrobe tool-switching?); founder's lean: `/studio` renders the SAME clean environment chrome regardless of entry — **one environment, one look, two doors** (takeover from a board, route from the lobby); relocate any load-bearing function rather than keep the shell.
- **(b) Export tab → verb:** the environment's legacy Export tab retires into context actions — "Export identity pack" joins the A2(a) library-card chooser (View comp card / Open in casting / Dress in wardrobe / **Export identity pack**) and the card's right-click menu. **Export becomes a verb on the model wherever you meet it, not a tab you visit.** Convergence note: this is an early customer of the sheet-as-asset composite renderer in the future-pass log; R6 ships against the current export implementation, renderer upgrade lands later. (A2(a) stays ratified — this extends its action set.)

**Wardrobe boundary (binding on the R6 plan):** wardrobe is acknowledged archaeology (its own undo system, pre-canvas stores, warm skin, legacy routing) but **explicitly OUT of R6 scope** — its reckoning is pass 2's wardrobe-on-canvas redesign; restyling it now pays for a wall pass 2 rebuilds. R6 touches wardrobe only at the seams: the shell unification must state what happens to wardrobe's route (inherits the clean chrome or is explicitly carved out until pass 2), and the A2(a) chooser routes to it as-is. Known residue mapped in `WARDROBE_ARCHAEOLOGY.md` so pass 2's planning starts with the map.

**Framing note (founder-directed — context for R6 and pass 2):** the residue this pass keeps excavating all descends from ONE dead architecture — the original linear pipeline (cast → wardrobe → export as a single conveyor workflow). The decomposition is now law: **casting = a summonable environment producing identity; wardrobe = a tool/node for dressing references (pass 2); export = a verb on the asset wherever it's met, never a destination.** The canvas is the connective tissue and the USER composes the sequence (the guarantees-over-workflows rider). Any surviving surface assuming the old sequence — routing that presumes the next stage, chrome that navigates between stages, session handoffs between tools — is belt-plumbing: **flag as archaeology on sight, whichever milestone finds it.**

### R6 design-direction note — the environment as a SPATIAL surface *(founder-directed 2026-07-12; price in the R6 plan, both versions)*

Consider making the environment's work area a spatial surface in the canvas image viewer's exact language — scroll-zoom, pan, the `#FAFAF8` + dot grid, the fluidity — rather than the current fixed-frame page. **Scope: camera-on-a-fixed-composition** — the panel stays docked, views hold canonical arrangement, no board grammar transfers; only the viewer's camera and feel. Rationale: closes the last dialect gap (board → environment currently reads canvas → webpage), and post-R5 the environment's content is a package + version strips + compare — spatial inspection handles that natively. **The R6 plan must price both the full version and the cheap fallback** (viewer background + scroll-zoom on the existing layout).

## Group 6j — R6 mid-milestone record (VC-R6a/VC-R6b rulings + founder driving-notes backlog, 2026-07-12/13)

*Interim record so nothing rides only in session state; C8's docs batch reconciles this into the DS/build plan properly.*

### Rulings (binding, applied where noted)

| Ref | Ruling | Status |
|---|---|---|
| R-1 | FailedSlot wears the destructive channel (red glyph + ink copy; board and environment agree on failure) | applied C1 |
| R-2 | Spatial work area ships the FALLBACK (camera on the existing layout); the full camera-on-composition build is a **named post-pass item**, judged on the restyled environment | applied C2 |
| R-3 | Save/Cast: same anchor, different weight (Cast = dark pill, Save = quiet outline). **Confirmed at VC-R6a: the header Cast pill carries NO cost label — the tier dialog is the D-15 cost surface** | applied C1/C3 |
| R-4 | One environment chrome, two doors; wardrobe inherits the slim chrome, internals untouched; sidebar functions relocated (popover) | applied C3 |
| R-5 | Out-pin → spawn-dot, code-only; slot "Pin" keeps its learned name; R7 docs note: ConnectionDots become "ports" in docs when convenient | applied C4 |
| R-6 | Note surface: **MONOCHROME**; plus a "make notes actually good" interaction/sizing pass folded into C6's note work | rides C6 |
| R-7 | Floor **UNIFIED on the field**: ONE field + dot token pair consumed identically by board, image viewer, and studio work area — no per-surface tuning; three-surface screenshot set for confirmation | rides C6 |
| R-8 | Camera pan stays (earns its keep at 2×+) | closed |
| R-9 | Background dots darken one step (they vanish today; the board reads as blank paper) — one token nudge, shown with the R-7 set | rides C6 |
| R-10 | Version-chip UX is failing its job — **no redesign now**; "version surfacing rethink" joins the A4 mask-rebuild as ONE named post-pass item (the thumb-strip data model is right, the chrome isn't) | logged |
| A4 | Belt-slimming rider **APPROVED**: export chip → `···` menu row (chip + `useCastingViewGeneration` deleted), menu Retry retired, mask stroke language conformant; mask-model rebuild = named post-pass item | rides C6 |

### D-55 — Views decouple from minting *(founder-ratified 2026-07-13; trap ruling (a); KNOWINGLY AMENDS D-46 rider 1)*

**What:** a draft may hold a full package — the tier flow gains a stays-draft path (`mintPackage` `mint: false`): same slots, same pricing, same identity gates (they key off the CURRENT headshot, never mint state — verified through the decoupling). The model stays a draft, freely identity-iterable, until deliberately named-and-minted. The name belongs to the mint moment, not to adding views.

**Why (founder's rationale, verbatim intent):** view generation fused to minting was belt-plumbing — the conveyor's "views = done" assumption. (a) is the only resolution where the stale-writer, the fork door, and bulk refresh form a closed loop on flows that actually exist. The F4 copy's "fork to explore it" becomes true: fork → draft-with-views → iterate freely → siblings stale → refresh → re-mint.

**Affects:** D-46 rider 1 (reversed, knowingly); `executeMintPackage` (+`mint` flag), `generation.mintPackage` input (name optional when staying draft), `CastModelModal` (stays-draft path in mint mode), `useCastGate` (stayDraft threading, no isMinted flip, stays in session). Drive invariant **Y** (paid): the full walkable loop incl. Y5 — after mint the same edit is refused. D-43 untouched: mint remains the immutability moment.

> **FR-3 amendment (founder, 2026-07-15, R6 execution plan):** naming is **required by the mint ceremony** — a nameless mint stays refused — but the display label is **not permanently frozen** after mint. A minted model may be renamed as display metadata; renaming never alters visual identity, and `agencyId` remains the stable identity key. "Naming-as-identity" refers to the ceremony (identity becomes real under a name), not to label immutability.

**Popped-view toolbar slimming ruled YES alongside** (Return to sheet · Download · Delete · Info; Edit reserved for the root) — shipped with the C6 consolidation.

### R7 additions (hardening list, founder driving notes 2026-07-13; items 4–5 added at Batch C final corrections 2026-07-16; item 6 added by the W1 export audit 2026-07-17)

1. **Model deletion doesn't exist** — and it is a cascade DESIGN question, not a button: deleted models may have board placements and D-12 snapshots referencing their assets (the graceful-degradation ruling anticipated exactly this). Spec deletion semantics (soft-delete? placements? snapshots?) as an R7 item; the same thinking extends to garments/looks libraries.
2. **Back-navigation audit**: library → draft → studio → back lands at lobby HOME, not the entry point. Standardize return-to-origin across all libraries and pages.
3. **Profile popout surfaces** (settings/billing/security/usage): audit what is WIRED vs broken — broken items are R7 hardening; the visual redesign is L6 below.
4. **The identity-locked Cast Profile viewer (founder-ruled product separation, Batch C final corrections).** Draft → editable Casting Studio; Minted → an identity-locked Cast Profile/character-sheet viewer; Fork-to-edit → a new derived draft opens in Casting Studio. R6 state: the read-only "Identity locked" workspace EXISTS and serves the /studio route (`isReadOnly = minted && !mintedEditContext`); the board's Edit door still opens the form-based minted session, now honestly framed ("<name> — identity locked", header door "Fork changes", panel copy "changes fork a new draft") — copy safeguard only, no flow rebuild in R6. R7 builds the proper Cast Profile: identity-locked viewer hosting the ADDITIVE operations that exist today (add missing canonical views via `mintPackage mint:false`; retry failed slots and refresh views via `refreshSlots` — both consume the locked §7 anchor + documents without modifying them; export; canvas placement; wardrobe; FR-3B rename; fork) plus fork-FIRST-then-edit routing (fork currently lands a board node; it does not open the new draft in the studio). "Supported additional views" beyond the canonical six do NOT exist and are not claimed.
5. **Concurrent-refund ledger race (pre-launch financial hardening, Batch C final corrections).** `addCredits`' referenceId duplicate check is read-before-write with NO database uniqueness constraint: two truly concurrent writers of the same refund reference can both pass the check and double-credit. Batch C provides sequential-retry idempotency ONLY (deterministic `refund:<charge-id>` references; collision-resistant UUID charge ids) and removed every concurrency-safe claim. R7: unique index on (userId, referenceId) or equivalent compare-and-swap, alongside the existing mintModel CAS item (§B1 inventory).
6. **Reusable 2K export derivatives (export hardening).** R6 W1 makes 1K the free default, discloses every 2K operation, prevents duplicate active submissions, and reports mixed/refunded outcomes honestly. It deliberately does not cache upscales: repeating a completed 2K export is a newly disclosed paid operation. R7 should persist a source-asset/version → 2K-derivative mapping so unchanged views can be reused without a second generation charge, with invalidation tied to the source asset identity rather than model version labels.

### R6 C8-flex candidate

4. **Recent Work draft rule**: canvas-born casts are represented by their BOARD only (the board IS the recent work); standalone-born casts appear individually. One provenance check on the feed source. *Take in C8 only if genuinely trivial; else joins the L batch.* **TAKEN in C8** — `getPlacedModelIds` (alive placements on active boards) filters the casting source in `mergeRecentWork`; unit-covered.

### C8 record (docs batch + closures, 2026-07-13)

- **Docs reconciled:** DS §5.5 (label grammar + engine-slot death), §5.8 (`NodeControlStrip` dead — segments ride the one node pill), §5.10 (consolidated pill + popped-view slimming + group Tidy up), §5.11 touches, §11.1 (comp-card captions, implemented) / §11.2 (ruling-A quiet line); build plan R6 build record + R7 additions (6j items 1–3, deploy-version-skew note) + migration-0004 gate. `HANDOFF_C6.md` deleted (served its purpose; git history keeps it).
- **Toast audit (D-40):** no violations remain on in-scope surfaces — survivors are clipboard/download confirmations, closed-surface outcomes, and cross-surface notices (all sanctioned classes); `ModelEditorOverlay`'s toasts are in the orphaned file R7 sweeps. The takeover's zero-edit "No identity changes yet" stays as the E1b-asserted quiet note.
- **Admin named debts (R6 pile b):** the emerald Add-Credits button (+ the credit modal's emerald/amber confirms) now wear the house ink; labels sentence-cased. The "stock error toast in admin" debt was already resolved app-wide by D-40's sonner restyle (one Toaster, verified) — recorded, no change needed.
- **Engine-slot death (C7, founder-flagged):** raw `provenance.engine` ids on node chrome were the D-41 leak class; the label row is the NAME alone. Drive O4b guards it.

### Named batch — LOBBY & HOME POLISH *(post-R7 or alongside dogfood; founder briefs it properly when the design ideas form — these are the collected seeds)*

- **L1** Casting-from-library workspace placeholder is lackluster — needs a designed answer (possibly none at all); no reference identified yet.
- **L2** Home redesign toward inviting/fun first-landing (founder ideas pending); Recent Work possibly graduates to its own page with search.
- **L3** Canvas cards in the lobby need a real design — mosaic-of-board-contents thumbnails or similar; also answer where archived canvases go (does archive even exist?).
- **L4** Notifications in the lobby rail (release notes, low credits, refunds, security, usage).
- **L5** Rail menu items get proper designed icons complementing the house language — explicitly not generic AI-slop icons.
- **L6** Profile popout surfaces redesigned in the house language (wiring audit is R7 item 3).

### VC-R6 FINAL (founder, 2026-07-13) — the ceremony largely passes; three fixes, two graduations

**PASSES:** first-run intro (appears once, dies forever, teaches) · cast path end to end · notes · money surfaces · name-only labels · environment tools + monochrome mask halo + export verb · lobby thumbnail + Recent Work provenance · Tidy v1 as banked.

**Fixes (applied same day):**

- **Fix 1 — D-55 sharpened (implementation-honesty):** the stays-draft path **never demands a name** — a typed name rides as an *optional nickname* (`mintPackage` `mint:false` + `characterName` names WITHOUT minting); naming-as-identity stays fused to the mint moment (nameless mint still refused). The Draft tier's old copy ("Name them and keep exploring") claimed exploration while it name+minted — now reads "Just the headshot — mint now, add views anytime." Draft state wears a **real badge on the card face** (the `· Draft` label crumb is dead — it was missable and a named draft read as minted). The stays-draft confirm **LANDS the draft on its node** (session stays open; closing later abandons nothing — the old path dead-ended at a leave-confirm that dropped the work), and a fresh draft node teaches its next step once ("Keep exploring — add views or edit freely, mint when ready"), retired by first selection. Drive invariant **SD1–SD5** (badge/no-crumb/hint/nickname-without-mint/nameless-mint-refused). The stays-draft ghost action now exists on **every** tier in mint mode.
- **Fix 2 — randomizer silver bias:** the uniform 8-color hair pick gave Silver+Platinum a combined 25%. Now weighted (`RANDOM_HAIR_WEIGHTS`, silver class <10% by construction, darks dominant) with a sampled distribution test. Two residues of the E1b family also closed: `HairColorWheel` rested on Dyed[0]=Silver for unparsed values (mount default AND the sync-effect fallback) — both rest on Natural now.
- **Fix 3 — floor drift:** React Flow draws dot radius = `size/2` × zoom; `size={1}` rendered 0.5px against the CSS surfaces' 0.75px — the board WAS a step lighter at 100% (geometry, same token). `size={1.5}` converges it. Guards: `floorParity.test.ts` (source-level — one token pair, 0.75px, 24px on every surface; no second dot constant can creep in) + drive **FL1/FL2** (live rendered radius/rhythm ÷ zoom). **Counter-scale recommendation (small ruling, pending):** keep board dots canvas-space — the floor is the space itself, and dots scaling with zoom is what tells your hands the camera moved (D-37's constancy doctrine covers CONTENT, not the space); reference canvases behave the same; revisit only if far-zoom blankness grates in practice, where the remedy would be a minimum screen radius, not counter-scaling.

**Graduations (logged, not built):**

- **G1 — Tidy v2, cluster-aware:** connected sets stay together, children placed relative to parents, forks-beside/variations-below geometry preserved, THEN row-pack the clusters. v1 was the banked spec; real boards ruled it too dumb. Joins the **named post-pass items** (mask-model rebuild, version-surfacing rethink — R-10).
- **G2 — note authorship:** notes gain a user tag when teams land (multi-user accounts, team management in the lobby). Files with the **collaboration pass** alongside comments (Group 6f log).

**Confirmed:** the top-right board cluster (profile/assets/comments, ElevenLabs logitem refs) remains future-pass — D-45(2)'s balance popover was the R6 slice, as built.

**Sequence:** founder re-drives the stays-draft path + the floor → **R6 closes, R7 opens**; paid invariant Y (~1600cr walkable-loop proof) folds into R7's run.

### VC-R6 FINAL re-drive ROUND 2 (founder, 2026-07-13) — D-55 decoupling HALF-shipped; the permissions/doors didn't follow the status

**Diagnosis confirmed by probe:** the SERVER was already status-correct (status stays `draft` through a Core purchase, `packageState.minted = !!agencyId`, the iterate seal keys off `status !== 'draft'`, an identity edit on a draft returns 200). The disease lived in the CLIENT: a "has-views ⇒ minted" era assumption in three specific places, plus one server id hazard.

**Fixes (applied same day; the founder's root suspicion was right — sweep, not spot-fix):**

- **Defect 1 — iterate "Asset not found" on a draft-born view:** `useCastGate` synthesized `id: Date.now()+i` for freshly-generated views instead of the real ledger id, so the next iterate's `assets.find(id)` missed. `mintPackage` now returns each slot's REAL `assetId` (threaded through `SlotGenResult` → `generated[]`), and `useCastGate` uses it. **`createModelAsset` converted to `$returningId`** (D-46 R7 log): the newest-row-by-`createdAt` lookup could return a SIBLING slot's id under the parallel mint — the returned id must be exactly this row's.
- **Defects 2 & 3 — draft opened in minted-edit mode (fork ceremony + only "Save changes", no mint door):** the stays-draft optimistic fill (`handleDraftLanded`) dropped `draft` from the fill ledger, so during the fill window the node read as MINTED (no badge; Edit → `editContext.draft=false` → `isMintedEdit` → "Save changes" + the D-11 dialog). The optimistic fill now carries `draft: true`, so the whole chain is status-driven end-to-end (server status → `fillFromLibrary` → node provenance → `editContext` → `isMintedEdit`). Once correct, a draft's Edit shows "Cast this model" → the tier dialog with the mint door.
- **Defect 4 — tier dialog state-aware:** an existing placed draft's dialog now LEADS with adding views ("Add N views — she stays a draft"; header "Add views"; primary "Add views") and mint ("Name & mint") is a distinct labeled door; a fresh cast leads with mint (name field labeled "Name — this mints her identity") with "Add views — stays a draft" as the second door. Every door says where it leads. `existingDraft` threaded from `editContext.draft`.
- **Sweep result — one more status gap fixed:** `useSheetController.isSheet` required `minted`, so a view-bearing DRAFT rendered only its headshot on the canvas (its package invisible off the environment). Now `isSheet = filledCount >= 2` (MINTED OR DRAFT) — a draft's comp card renders on the board, per D-55 first-class drafts. Every other `isMinted`/`minted` derivation audited: all status/agencyId-driven (`packageState.minted = !!agencyId`, `CastNode.isMinted = isLibrary && !isDraft`, `useResumeDraft`/`useSessionPersistence` = `status === 'active'`). `refreshSlots` confirmed status-agnostic (works on drafts).

**Verification:** free drive **SD6–SD9** (draft not minted / synthetic-id refused / comp card renders on a draft / Edit opens the mint door not "Save changes") + **paid invariant Y** (the full walkable loop: fork → Core views as draft [Y2b asserts real asset ids] → identity iterate SUCCEEDS on a draft view [Y3a, defect 1 closed] → siblings stale → bulk refresh offer → name-and-mint → post-mint seal engages). The loop is walkable by someone who never read the log.

### VC-R6 FINAL re-drive ROUND 3 (founder, 2026-07-13) — the loop walks further, breaks at its heart

**F1 — session re-entry corruption (three faces, one disease):** closing a fresh-cast / draft-edit takeover did NOT reset the casting stores (the cleanup reset only minted edits). `currentModelId`, `currentAssets`, and `canvas.castModelId` leaked into the next session; the next mount's child-hydration effect (runs before the parent's reset) read the stale `canvas.castModelId` and its async fetch re-poisoned the store after the reset. The iterate then fired against a stale — often minted — model + a stale asset id, producing the three faces: the seal spoke "this changes identity" on a *draft* (wrong model was minted), "asset not found" (stale id), "Unable to transform response" (compounded mismatch); a hard refresh cleared it. **Fix: reset the casting session on EVERY close.** Drafts persist server-side, so re-hydration on next open loses nothing; the bleed contract holds (mintedEditContext dies with the reset). Drive **SD10** (close → stores empty; hydrated-then-reset).

**F2 — D-38 gap:** draft-generated views didn't paint the node mosaic until a hard refresh (the optimistic carry only covered the mint path). **Fix: `startClose` fires `onSessionSlots` for EVERY session** (model id from the edit context or the live fresh-cast session), so the board patches the fresh view urls + revalidates on close, not just for minted edits.

**F3 — THE STALE-WRITER NEVER FIRED:** the stale-writer is gated on `classification.identityLevel`, and the TEXT_ECONOMY classifier called "add a small tattoo to her forearm" *cosmetic* often enough that siblings never staled — F6's whole machinery silent. Diagnosis: not the writer (correctly wired), the classifier's reliability. **Fix: permanent marks are now a DETERMINISTIC identity/stale trigger** (`namesAPermanentMark`, word-boundary matched so "scarf"/"branding" don't false-positive) — a named mark short-circuits to identity-level with no model call, so it ALWAYS stales siblings on a draft and ALWAYS seals on minted. Detection only; the board's `{N} stale` segment surfaces via F2's close-revalidate. Drive **Y3** now uses the founder's exact failing phrasing and asserts the stale fires.

**F4 — REFERENCE BLEED (founder-RATIFIED 2026-07-13; `REFERENCE_BLEED_ASSESSMENT.md`): detection ships now, propagation is calibration-gated — a D-30 amendment pending calibration.** Detection (this round) is honest — the bulk-refresh copy says "regenerates against the current headshot", promising no propagation. **Propagation** (making siblings carry the mark) is **gated** behind: (a) roled references with explicit per-reference intent (identity from anchor, mark-only from the edited view, no pose/framing bleed), (b) repair-refreshes through the identityCheck-class gate — highest-drift class, retry-then-refund like back views, (c) a human-graded calibration run BEFORE shipping. **If the engine can't earn it, detection-only IS the feature** and propagation is logged as engine-dependent. Recorded as a **D-30 amendment pending calibration** — a new roled-reference composition mode (`composeRepairPayload`), not built until calibrated. *"Trust behavior should never be a dice throw."*

**F6 — headshot refuses Refresh on a draft (founder-RATIFIED 2026-07-13; `REFERENCE_BLEED_ASSESSMENT.md` F6 section): not a fossil in mechanism, a fossil in copy + routing.** The headshot **stays non-refreshable** — the anchor can't refresh against itself (that's a re-cast, a different face, regardless of status). The refusal copy is now **status-aware**: a draft is routed to **iterate-in-environment** (free, fluid identity, whole-package-stales — never "fork", the minted answer); a minted model forks. The whole-package-stale cascade on a headshot iterate is confirmed (`selectStaleSiblingHeads("frontClose")` stales every other non-pinned filled view — unit-tested). **Applied** (copy + confirmed cascade, no new generation path). Drive **SD12** (draft headshot refusal carries the iterate copy, never "fork").

**Working correctly, for the record (founder):** draft badge, no-name stays-draft, "Add views — she stays a draft" copy, Core purchase keeping draft status, tattoo edits landing on the target view (clean session), no fork ceremony on draft identity edits.

### Parked (founder's own notes, not the log)

- Community / jobs / templates tab — post-launch strategy question.

### D-56 — The founder-ratified interim identity-edit policy is IMPLEMENTED (R6 Batch C)

**What:** `IDENTITY_EDIT_INTERIM_POLICY.md` (revision 9, founder-ratified 2026-07-16) is now enforced in code. One shared, typed, server-owned authorization boundary (`server/casting/identity/`) governs every free-text and reference-assisted image-edit instruction and every creation intake: deterministic checks → strict closed-union LLM classification → leaf normalization into concrete durable values → server-owned authorization → most-restrictive-wins. Fail-CLOSED (R2): `unavailable`/`malformed`/`unknown`/ambiguous/parent-only/vague-reference/unmapped-leaf refuse free, before generation records, deductions, and image calls. Three outcome classes: **identity** (ratified R1/R1c leaves + R3 structured fields, drafts only, authoritative `frontClose` only, §8.6 atomic commit: typed preference/schema patches from the exhaustive `IDENTITY_FIELD_HANDLERS` registry + new anchor + new `identityRevisionId` + stale flags pinned-included), **presentation** (refused in Casting, routed to Canvas/Wardrobe — makeup and cosmetic lashes included), **image-only** (asset-only: documents byte-unchanged, `display` role, no compaction/reconcile/stale). All mark-family edits refuse during R6; creation advertises tattoo/ink only (R6) with honest variance wording; the eyelash boundary is creation-only natural anatomy (§5.2).

**Identity anchor + revisions (§7):** `models.identityRevisionId` (additive, forward-only migration `0005`, NULL = genesis) + server-written `provenance.identityRole`/`identityRevisionId`/`identityText`. One shared anchor selector feeds iterate authority, refresh, add-views, and mint; a display-only headshot refinement can never silently become the identity reference. Restore is free reuse WITHIN the current identity revision (recorded revision or D-12 fingerprint match); cross-revision and uncertain provenance refuse; restored `frontClose` is always display. Mint validity is R8's three separate checks with state-specific copy, predicted per-check in the tier dialog; a mid-mint slot failure now aborts the mint transition (views kept, refund per slot, filled-package retry free).

**Supersessions now operational (recorded per §3 of the policy):**
- **D-43** "drafts stay freely editable, full stop" — narrowed to the ratified leaf/structured ledger (§8).
- **D-43.2** cosmetic class — split into presentation (refused, routed) and image-only (allowed, asset-only).
- **F5** mark-discoverability framing — the refine bar's examples advertise only supported edits; mark/makeup/accessory examples removed (marks are "not yet", never "never").
- **F6 / D-21** pinned-staleness exemption — REMOVED for identity changes: pinning prevents automatic replacement, not staleness.
- The implicit "newest headshot is the identity reference" convention — replaced by anchor authority.
- The C5-era "restore/version checkout is the exact rollback" clause — narrowed to within the current identity revision; true identity rollback is Batch D/R7.
- **D-12** exact-reproducibility scope for reference-assisted identity edits — provenance records the normalized patch, not the transient reference.
- **F3 (VC-R6 r3)** deterministic mark trigger — marks are no longer a stale trigger: every mark EDIT refuses outright during R6 (the stale-writer now serves authorized identity edits and headshot re-rolls).
- **R7 ratified:** `generation.reconcile` is disabled (procedure refuses; client auto-call removed). Masked tools REMAIN disabled (Batch 0 closure stands; re-enablement stays gated on a future boundary + tests).
- **FR-3(B)/D-55 wording** unchanged: naming is required by the mint ceremony; the label is display metadata.

**D-56.1 — final founder rulings folded in (2026-07-16, final corrections round):**

- **Hair length (REVERSES R1b's R6 refusal):** `Long` and `Very Long` are valid durable identity values everywhere the ratified pipeline reaches — initial casting (typed `hairLength` preference + master identity, consumed by every later view, nothing staled), draft edits through the real typed identity pathway (structured, text, and supported reference-assisted; new anchor + new revision + every sibling staled pinned-included; existing views are explained as needing refresh and are NEVER regenerated or charged automatically), minted refusal → Fork unchanged, and per-image iteration NEVER treats hair length as asset-only cosmetic work (it has no image-only category). `Long Layers` is a hairstyle characteristic, independent of length; explicitly requested layered Medium hair stays Medium. **Deterministic band preservation (final corrections):** on the text/reference path the committed durable value is exactly the closed band the user named — `Very Short` / `Short` / `Medium` / `Long` / `Very Long` (the same list the structured editor and brief parser use): explicit `Long` remains `Long`, explicit `Very Long` remains `Very Long`, below-shoulder/chest/mid-back wording maps to `Long`, waist/hip/tailbone wording maps to `Very Long`. The normalizer can never commit a more (or less) extreme band than the user requested — its returned length prose is overridden by the requested band — and wording that names no single band (vague comparatives, conflicting terms) fails closed and free. The policy document's R1b rows carry dated amendment notes.
- **Minted Cast Profile separation:** recorded as R7 addition 4 above, with the R6 copy safeguard shipped (the minted takeover presents as identity-locked; its one identity door is Fork).
- **Refund/ledger honesty:** every refund outcome now reaches the user verbatim (recorded amount, or the support reference when recording failed); failed-slot Retry markers are result-checked and never promised when unsaved; charge references are collision-resistant; the ledger's concurrent-refund race is R7 addition 5 — nothing claims concurrency safety.
- **Public error sanitization (final corrections):** raw provider/database/SDK/`Error.message` text never reaches clients, failed-slot records, board cards, or toasts. Complete internal errors are logged server-side (and kept in the internal generation audit rows moderators read); deliberately written `TRPCError`/`PublicError` wording passes through; unknown errors get safe fixed wording; the truthful refund outcome or support reference is always appended. `formatGeminiError`'s raw-400 and raw-default passthroughs are closed — every branch returns fixed safe copy.
- **Board landing atomicity (final corrections):** the board-door identity update (`applyModelEdit` update/recast) commits the identity change AND its required board state — node stamp, version row, downstream stale statuses — in ONE database transaction. A failure anywhere inside rolls the whole landing back and refunds honestly; downstream stale-write failures are never swallowed. There is no post-commit board synchronization left to fail silently, so no repair path is needed for this landing.

**Implementation truth (honest scope, as corrected in the same-day Codex review round):** the shared guard, closed §5.4 type contract, marks vocabulary, three-state prompt rule, creation-intake validation (EVERY string channel, refusal before money on every creation path), and the M1–M22 test matrix are BUILT and verified at unit/router level — including failure-injection coverage of the paid durable-effect boundaries. Credit contract: charge and refund use distinct deterministic references (`refund:<charge-id>`; the ledger's duplicate rule would silently swallow a same-id refund), every refund result is checked, and nothing is ever recorded as refunded that didn't land. Durable-effect boundaries: refunds happen only before the paid durable result commits; afterwards, AUDIT-row failures are logged gaps that never refund or invite a duplicating retry. For the board-door identity update, the board landing is INSIDE the durable boundary (one transaction with the identity commit — final corrections); for creations (initial Canvas cast, fork, variations), the charged library result is the durable boundary and a failed atomic board placement reports a typed partial success naming the library, never a retryable failure. The structured editor and creation intake run the same deterministic content boundary as free-text edits (closed-option enforcement where the UI is closed; marks/presentation/eyelash/relational scans on open prose; all five hair lengths — Long and Very Long included — proceed at the structured door per the founder's final ruling, D-56.1). Mixed classifications keep every recognized category and resolve by the ratified most-restrictive order; classifier/normalizer JSON is strict to the declared keys. The board's recast gesture is the R4 anchor re-roll through the shared atomic commit. Minted-edit refusals render in-context with the takeover open (D-11 dialog owns the round-trip); brand/vibe are labeled casting context, never a physical identity change (founder ruling). The migration is generated but NOT applied to any database; migration-backed drive legs are deferred to the separately authorized migration step (`scripts/drive-batchC-identity.mts` documents them). Batch D/R7 remains unbuilt: no reference plates, composer, per-category mark persistence, generative erase, canon snapshots, true rollback, outfit propagation, or concurrency redesign.

### D-57 — Board placements read live model lifecycle truth *(founder-approved W2 correction, 2026-07-17)*

**What:** `boards.getItems` now derives both unavailable and draft state from one batched server status read. `sourceDraft` is live status truth, so minting through one placement clears the Draft badge on every duplicate placement after refetch. The original provenance draft stamp remains only for the optimistic pre-refetch window. A model-linked placement whose source row was hard-deleted degrades through the existing “Source unavailable” state instead of remaining interactive and failing later.

**Why:** lifecycle state belongs to the model, not to the placement snapshot. The prior D-42 stamp was honest only at placement time and became a lie after another placement minted the same draft.

### D-58 — Package health is the R6 repair surface; in-flight state is same-tab only *(W3, 2026-07-17)*

**What:** Casting Studio exposes one package-health surface backed by the existing server-owned package, refresh-plan, mint-integrity, version, pin, restore, and refresh procedures. It shows stale and failed rows, exact server-planned per-view costs, compatible-version restore, and an explicit route from mint-integrity blockers. Successful refreshes return their real asset ledger ids so the open Studio session never invents a client id. An authorized identity iterate returns the exact canonical sibling angles written stale plus the ratified quiet refresh notice; image-only edits return no stale angles.

**Concurrency boundary:** Canvas and Studio share a small same-tab, per-model in-flight registry so work started in one surface is visible in the other and overlapping refreshes are reference-counted. This is UI coordination only. It does not claim durable/background job recovery, cross-tab truth, or state that survives reload; server-persisted generation-job state remains R7.

**Prompt honesty:** Side and Three-quarter prompts use one frame-relative direction, and marks may render only where their recorded anatomical location is visible. This is prompt tightening, not a guarantee that the image model will never drift or hallucinate; visual calibration remains a separate R7 gate.

### D-59 — Closing Casting preserves the draft without leaking its async session *(W4, 2026-07-17)*

**Close contract:** Closing a board-originated Casting session invalidates its client session immediately, before the exit animation. Server generation already in flight may finish and persist normally, but its continuation cannot write into a closed or newer Studio session. A ready headshot auto-lands into the originating blank node exactly once. If the user leaves before the headshot exists, the node stays empty; completion is reported honestly as saved to Drafts with an **Open Draft** action. This is an R6 continuation guard, not R7 durable/background-job machinery.

**Open choices:** Required fields deliberately delegated to the engine are stored as a strict true-only `engineChoice` map in model preferences. Those flags satisfy draft validity after reopen, but are stripped before creation-intent scanning and prompt generation. Fork, recast, and variation candidates carry untouched Open flags forward without passing that metadata to the content gate or Gemini; an explicit concrete edit clears only the flag for the field it replaces. The concrete generated values remain read-only technical-schema truth labelled **Resolved at casting**; they are never silently promoted into editable preferences.

**Reference replacement:** The existing temporary iteration reference accepts drag-to-replace even when occupied, through the same file validation path as the empty slot. It remains one-generation input and does not become a persistent reference plate.

### D-60 — Recast and iteration are different identity contracts *(founder ruling, 2026-07-18)*

**Structured panel = recast:** once a draft headshot exists, changing Casting panel settings and pressing **Recast model** deliberately casts a new draft identity from those settings. The person may change. This is not a same-person surgical edit and must not be compared with the old anchor. Recast remains draft-only; minted identity changes still require Fork. It validates before charge, computes the updated casting document deterministically, generates one NEW-mode candidate, tracks its upload, and commits document + new anchor + revision + sibling stale state + board landing atomically. Failure keeps refund and tracked-upload cleanup truth. Audit metadata names `structured_recast`.

**LLM/reference/surgical = iteration:** free-text, reference-assisted, and surgical edits operate on the accepted person. Only the explicitly authorized identity delta may change; the post-generation identity gate stays strict and fail-closed before upload or canon commit. Session scope is per user + model, and an isolated retry always starts from the original accepted source.

**UX:** R6 states beside the populated-panel action that recasting creates a new draft identity and the person may look different. R7 owns the fuller mode separation, confirmation, interactive clarification, and error/modal redesign. No operation refreshes siblings or spends credits automatically.

### D-61 — R6 is closed at the founder-tested production baseline *(founder-confirmed 2026-07-18; recorded during R7-0)*

**Closure baseline:** R6 closes at `e66b8db`, deployed through `local-migration` and founder-tested on production. The W5/W6 and post-live correction chain completed the release blockers that the original wrap record could not yet describe: same-person post-generation identity gating; truthful structured recast; strip/package status truth; atomic free identity-pack export; refund/public-error honesty; same-tab background operation handoff and originating-node progress; Add Views continuation; neutral completed-package mint UX; durable draft-name persistence; immediate synchronization of committed identity documents; board thumbnail clear-on-last-delete; visible restore refusals; chained headshot identity edits from a verified current display row; and live model-name propagation to linked Canvas placements.

**Founder drive:** the final two post-live checks passed: (1) an image-only headshot edit followed by an authorized identity edit succeeds against the current display headshot without weakening anchor/revision authority; (2) saving a draft name updates the linked Canvas node without minting or a page refresh. Full R6 creation, package, refresh, mint, fork, variation, export, history-refusal, naming, and lifecycle walks were completed in the preceding founder passes.

**Honest boundary:** R6 does not claim cross-tab/reload job recovery, a minted Cast Profile, strip-owned package actions, true identity rollback, archive/R2 cleanup, generation-time quality choice, persistent plates/marks/zones, or a visual-evidence composer. Same-tab stores remain presentation coordination over server-persisted assets/charges/refunds; those named boundaries become the ratified R7 program in D-62.

### D-62 — R7 is a gated program, not the old 1.5-day hardening batch *(founder-ratified 2026-07-19 after Fable architecture approval)*

**Authoritative plan:** `CASTING_SYSTEM_R7_REVIEW_AND_EXECUTION_PLAN.md` supersedes the old R7 sizing and sequencing in `PASS_1_BUILD_PLAN.md`. R7 executes as R7-0 through R7-8: documentation/decision closure → trust foundation → durable operations → product-surface split → strip/history UX → lifecycle/archive → Batch D design/calibration → feature-flagged composer → quality/reference-sheet/dogfood closure. The composer never precedes the concurrency, idempotency, exact-id, and durable-operation foundations it depends on.

**Eight founder rulings:**

1. pinning retires, but its data migration waits for the R7-6 effective-snapshot/per-slot-selection contract and uses that contract verbatim in R7-7;
2. identity history keeps immutable parentage internally and presents a simple active timeline; restore creates a new current snapshot and destroys no evidence;
3. first unseen-region evidence requires Accept / Retry / Cancel and never silently becomes canon;
4. post-mint missing views may derive from the sealed snapshot but never silently extend identity canon;
5. the first minted Cast Profile is read-only for visual changes; presentation routes to Canvas/Wardrobe and identity change to Fork;
6. generation quality is a persisted package default chosen before generation, with resolution/cost shown at every paid confirmation and no export-time surprise upscale;
7. tattoo/ink is the first calibrated composer category; every other mark family stays refused until separately proven and enabled;
8. archive hides immediately, is recoverable for 30 days, then is purge-eligible; confirmed privacy erasure bypasses recovery, historical placements degrade to `Source unavailable`, and the final non-image retention period must match published privacy/accounting policy before launch.

**Permanent product boundaries:** Casting defines the reusable person/character sheet; Wardrobe and Canvas own outfits. Missing views and package repair are deliberate priced actions; nothing refreshes or spends automatically. Temporary iteration references are not persistent plates. No Photoshop-style reveal layer or saved layer stack will be built. Inputs/provenance can be reproducible; unseeded generated pixels are not promised exact.

**Release discipline:** R7-1/R7-2 are never unattended full-auto work. Every schema batch is additive and forward-only, proves itself against a disposable database and mixed-version client/server behavior, receives Fable review, migrates production before dependent code, and deploys only in an explicit window when no founder drive is active. Paid drives record exact balance, charge, and refund truth. R7-5 cleanup remains dry-run and separately production-authorized; R7-6 is design/calibration only; R7-7 stays server-feature-flagged with R6 refusals as fallback.

### D-63 — R7-1 trust foundation starts by closing public write doors and returning exact insert ids *(R7-1A, 2026-07-19)*

**Execution authority:** `CASTING_SYSTEM_R7_1_TRUST_FOUNDATION_EXECUTION_PLAN.md` governs R7-1. Its first independently shippable batch removes the authenticated `credits.add` and `credits.deduct` procedures. Credit balance changes remain server-owned through generation, billing, Stripe, referral, admin/change-request, and refund flows; clients retain read-only credit procedures.

**Retired upscale door:** the public `generation.upscale` procedure is removed. R6 already removed its connected UI, while the residual route accepted an arbitrary client URL, performed an unrestricted server fetch, charged under a fresh reference on every call, and produced no owned asset or generation record. It must not be restored for convenience. Any future quality feature requires a server-owned asset id, ownership proof, a persisted operation, and the ratified package-quality contract.

**Exact model identity:** `createModel` returns the id produced by its own insert via `$returningId()`. It never discovers the result by selecting the user's newest model, so concurrent casts, forks, variations, and Canvas creation cannot receive a sibling operation's id.

### D-64 — Cast deletion is permanent and removes its direct surfaces *(founder correction, 2026-07-21; supersedes D-62 ruling 8)*

**Simple product contract:** Drape does not ship a user-facing Cast archive, 30-day recovery window, restore ceremony, or deletion undo. After explicit confirmation, drafts and minted Casts use the same permanent-delete contract. The Cast disappears immediately from the library and Studio. Its identity documents, package assets, version history, linked Wardrobe sessions/looks, and owned image evidence are scheduled for verified deletion.

**Canvas behavior:** every direct representation of the deleted Cast is removed: Cast roots, library placements, and popped-out Cast views, together with their versions and incident edges. A deliberate deletion never leaves a `Source unavailable` placeholder. Affected board thumbnails are recalculated from surviving nodes or cleared. Independently generated image/video outputs remain; deletion does not recursively destroy separate creative work merely because it used the Cast as an input.

**Future Asset Library ownership rule** *(founder-directed, 2026-07-24)*: when the future user Asset Library allows an eligible creative output to be explicitly saved from Canvas or Wardrobe, that save creates an independently owned durable asset. Deleting the source Canvas board, Wardrobe session/look, or Cast must not remove the saved library asset. The save boundary must give the asset its own durable ownership/storage authority (or proven shared-object reference protection), so a source-deletion manifest cannot delete its object. Source provenance may remain as scrubbed historical lineage, but it cannot make the saved asset depend on the source row remaining alive. This does not turn canonical Cast reference/package images into general library assets; Cast models and their identity views remain governed by Casting.

**Internal safety is not recovery:** Drape may retain only a scrubbed, non-recoverable, non-image tombstone/receipt required to prevent replay or double charging and to satisfy security, accounting, or published legal obligations. It may contain identifiers, timestamps, kind, and monetary totals, but no display name, prompt, technical schema, preferences, image URL, storage key, or recoverable identity evidence. It is never exposed as an archive and cannot restore the Cast.

**Deletion boundary:** database disappearance is atomic and immediate after the model operation lock is acquired. The lock covers Casting/Canvas paid work but is not the only fence: every Wardrobe/model writer that can persist a model id must re-prove an owned, available subject at its durable write, and ordinary model updates must include a live-row predicate so a racing rename or save cannot repopulate the tombstone. Owned-object deletion is durable, background, idempotent, and retryable so a transient R2 failure cannot resurrect database state or silently orphan content. Only storage keys proven to belong to Drape's configured bucket may be deleted. R7-5 requires a read-only dependency and writer-fence audit, disposable-data proof, Fable review, and separate production authorization before destructive runtime behavior is enabled.

### D-65 — R7 evidence composer uses immutable snapshots and complete-image accumulation *(founder-ratified 2026-07-22 after Fable challenge)*

**Authority:** `CASTING_SYSTEM_R7_6_EVIDENCE_COMPOSER_DESIGN.md` governs R7-7. Effective Cast truth is one immutable identity snapshot plus one immutable package snapshot with explicit per-slot selections. History is append-only; restore creates a new current state and destroys no evidence. True whole-Cast restore is draft-only in the first release; minted identity change routes to Fork.

**First capability:** tattoo/ink add is the first calibrated evidence operation: draft `frontFull`, one front upper-torso feature and one evidence input per operation, explicit Accept / Retry / Cancel, and no automatic refresh or spending. A valid delivered candidate is charged; Accept is free; Cancel is not refunded; Retry is a new quoted generation; a system-invalid candidate receives one included retry and then a full refund. An undecided candidate expires after 30 days with disclosed expiry, no refund, and exact-key cleanup. At most one ready candidate exists per model per capability in the pilot.

**Complete-image law:** typed tattoos remain separate identity-feature records, but every selected canonical view is one complete flattened generated image. A later tattoo starts from the latest complete selected view, preserves every earlier accepted feature predicted visible, and becomes a new complete selected image only after validation. Earlier features never become separate Photoshop layers or one mandatory Gemini input each. Multi-zone accumulation remains feature-flagged until it proves new-feature fidelity and preservation of all earlier visible features.

**Ownership and downstream law:** evidence objects copy on Fork; candidate, plate, crop, accepted evidence, account deletion, and model deletion use the exact-key cleanup contract. Composer inputs are server-resolved and recipe-bounded; the pilot budget is anchor + target view + one relevant plate/crop. Minted late evidence ambiguity refuses and routes to Fork. Cohort failures block calibration release even when aggregate quality passes. R7-7 remains server-feature-flagged with R6 refusals as fallback.

### D-66 — Future teams use individual accounts and workspace-owned resources *(founder direction, 2026-07-25)*

**Product model:** when team collaboration lands, members do not share one login. Each person keeps an individual authenticated account and joins a shared workspace through an explicit membership with a role such as owner, admin, editor, or viewer.

**Authority model:** Casts, boards, Wardrobe sessions, saved assets, and shared credits become workspace-owned resources while retaining the individual actor id for attribution and audit. The active workspace and membership are resolved server-side from the authenticated user; no client-supplied `userId`, `workspaceId`, membership, or role is authority.

**Durable enforcement:** the current owner-scoped database law is the foundation, not something teams weaken. Reads and writes must constrain the resource to the workspace and prove the authenticated actor's active membership and required role at the durable statement or transaction boundary. Client-supplied child ids remain anchored to that owned parent in the same statement. Cross-workspace refusal tests must prove both that the foreign action fails and that the victim's rows remain unchanged.

**Migration boundary:** today's `userId` ownership remains correct until the team feature is deliberately designed. Adding teams requires an explicit workspace/membership schema and data migration, role and invitation/revocation rules, workspace credit/billing decisions, and a reviewed conversion of owner-scoped queries. It must never be approximated by accepting a workspace id from the client or by sharing account credentials.

### D-67 — New public Cast identifiers use cryptographic Klieg Identity codes *(founder-ratified 2026-07-25)*

**New format:** newly minted Casts receive a human-readable `KI-XXXX-XXXX-XXXX-XXXX` identifier ("Klieg Identity"). The 16-character payload is generated from Node cryptographic randomness with an unambiguous 32-character alphabet, providing 80 bits of entropy. The identifier is presentation and integrity data; model lifecycle and authority continue to come from server-owned status and ownership, never from the ID's spelling.

**Compatibility:** existing `MOD-*` identifiers remain valid permanently and are never rewritten. Exports, PDFs, Studio, Canvas, and lifecycle readers treat persisted identifiers as opaque strings, so old and new Casts coexist without a migration.

**Collision boundary:** `models.agencyId` remains database-unique. A new mint retries with a fresh cryptographic identifier only when MySQL reports that exact unique constraint, with a bounded attempt count. The already-generated package candidates are reused inside the atomic mint settlement; an ID collision never repeats provider work, charges credits again, or leaves a partial lifecycle/package transition.

### D-68 — Customer evidence uses private authenticated delivery *(founder-ratified 2026-07-26)*

**Privacy posture:** customer-uploaded reference plates and evidence crops may contain real likenesses, tattoos, scars, or other sensitive identity evidence. They live in a separate private R2 bucket. Drape does not issue permanent public URLs or presigned evidence URLs. The authenticated owner receives a same-origin Drape delivery route whose database read re-proves owner, live Cast, evidence kind, and child identity before the private object is read.

**UX boundary:** strongest security and durability must not make the product feel worse. Evidence renders as an ordinary in-product image with no extra prompt, download ceremony, manual refresh, or repeated full download when the immutable content is unchanged. Owner-private conditional caching revalidates authentication and ownership before a 304 response; privacy remains invisible to the normal Studio/Canvas/Wardrobe experience.

**Storage boundary:** the existing `R2_BUCKET` remains the permanent-public generated-image bucket because persisted product URLs depend on it. Evidence never enters that bucket. The private adapter uses a separately named `R2_EVIDENCE_BUCKET` and a dedicated least-privilege credential restricted to that bucket; no public development URL or custom domain is enabled for it.

**Cleanup authority:** every durable cleanup item records its storage backend explicitly. The worker never guesses a bucket from a key prefix, URL, batch kind, or caller. Public objects delete through the public adapter; evidence objects delete through the private adapter. If private delivery is unavailable, private cleanup remains pending without false success or attempt burn.

**Rollout boundary:** migration, adapter deployment, bucket provisioning, and founder-only evidence enablement remain separate reviewed operations. Evidence scope stays off until the private put/read/delete ceremony and authenticated owner-delivery tests pass. After the first real evidence write, rollback may use only an adapter-capable build; a pre-adapter runtime is no longer a valid cleanup authority.

**Founder ceremony completed (2026-07-27):** the reviewed production adapter
passed one bounded `users:1` stage/read/discard ceremony against a founder-owned
draft. The synthetic private plate rendered through the authenticated owner
route and returned HTTP 401 without a session. Worker cleanup settled to zero
live private objects, plates, crops, and cleanup items; one cleaned receipt,
one succeeded cleanup batch, and two succeeded zero-credit operation records
remain as the durable audit trail. Model head, credit balance, point
transactions, and generation history were unchanged. The final counts-only
orphan audit is clean, production health is green on commit `380efb0`, and
`R7_EVIDENCE_INGEST_SCOPE` is back to `off`. R7-7C stops here; R7-7D still
requires its own plan and review.

### D-69 — Fork-to-edit is a free identity-preserving copy; Recast remains the paid new-person action *(founder-ratified 2026-07-27)*

**Product meaning:** Fork and Recast are separate actions. **Fork to edit**
creates a free, independent, editable duplicate of the same Cast. The original
remains unchanged. The duplicate receives its own model, snapshot, selected
package objects, typed feature records, and copied private evidence keys, so
deleting either Cast cannot break the other. **Recast** remains the separately
labelled paid AI-generation action that may produce a different person.

**Visibility and failure law:** a Fork under construction is not a draft and
is invisible to Models, Studio, Canvas, Wardrobe, billing, snapshot
bootstrap/shadow/convergence, evidence delivery, and export. It becomes a
normal draft only after every required public/private object copy is
byte/hash-verified and the complete snapshot/feature graph commits. Failure
keeps it invisible, changes nothing on the source, charges no generation
credits, and queues every pre-recorded destination key through exact-key
cleanup.

**Ink pilot price:** one delivered
`ink.add.front_upper_torso.v1` candidate costs **350 credits**, equal to one
current Cast iteration. The one system-invalid internal retry is included at
zero additional credits. Accept costs zero. Cancel costs zero but does not
refund an already-delivered valid candidate. A user-requested Retry replaces
the old candidate and is a new disclosed 350-credit operation.

**Pilot UX boundary:** R7-7D remains founder/calibration-only. After ink is
accepted, feature-blind edit/refresh/restore/mint paths refuse rather than
erase or contradict the selected evidence. The capability cannot widen to
ordinary customers until R7-7E restores evidence-aware sibling refresh and
the complete edit/refresh/mint experience.

**Execution authority:** the reviewed implementation plan is
`CASTING_SYSTEM_R7_7D_INK_ADD_PILOT_PLAN.md` at planning commit `57a67b0`.
This ruling supplies the founder decisions required for bounded local
D1/D2/D3/D4 implementation and review in the order recorded there. Every
implementation slice still requires its recorded verification and review
gate. It does not authorize migration, deployment, production
provider/database/storage work, feature-flag enablement, or paid founder
calibration; each remains separately gated.

### D-70 — Evidence editing is natural-language-first and invalidates only views that can show the change *(founder-ratified 2026-07-28; amends R7-7D sibling-stale scope)*

**Public interaction:** the finished evidence composer is one frictionless
natural-language instruction, for example “add a small black star tattoo on
her left chest.” The server may derive a closed anatomical zone, surface,
laterality, operation, and visibility footprint internally, but users are not
required to operate placement chips, technical selectors, forms, or an
intermediate confirmation ceremony. Founder-only calibration controls may
remain temporarily as a test harness; they are not the public product
contract. Deliberate paid generation and explicit first-region Accept remain
required.

**View-impact law:** accepting evidence invalidates only selected views whose
canonical framing and visible body surface could show that evidence.
Unaffected views retain their prior compatibility; an already-stale view never
becomes current merely because it is unaffected. Unknown ontology or framing
fails closed by treating every view as possibly affected. No view refreshes or
spends automatically.

For `ink.add.front_upper_torso.v1`, the accepted `frontFull` replaces its
source and remains current. The pilot surface is anterior pec:
left/centre/right locates the mark within that front surface but does not make
it reliably visible in the strict full-body profile `sideFull`. Walk therefore
retains its prior compatibility for every side. `frontClose`, `threeQuarter`,
and `sideClose` are head-and-shoulders crops, while `backFull` shows the
posterior surface, so those views also retain their prior compatibility. This
server-owned mapping is authority; the client cannot supply or narrow it.

### D-71 — Generated angle labels are intent, not anatomical proof *(founder-ratified 2026-07-28)*

**What:** Side and three-quarter generation prompts may request a direction,
but model output can drift or mirror the requested orientation. No
evidence-aware operation may infer visible anatomical left/right from the
canonical angle name or prompt alone.

For a future tattoo capability whose ontology positively identifies a
Walk-visible lateral surface, the server chooses the direction that should
expose that surface, supplies an angle-and-side-specific visual placement
guide, and then uses strict image probes to verify the actual visible
anatomical side, placement, and framing. Unknown, contradictory, or unverified
side truth refuses the canon commit and refunds under the normal operation
law. The current anterior-pec pilot is not such a capability: no Walk-visible
surface may be inferred from its left/right placement label.

**UX law:** the person simply describes the change in natural language. They
never choose “face left,” “face right,” an anatomical side control, or a
technical visibility setting. Direction selection, visual guidance,
verification, and provenance are server-owned implementation details.

**Scope:** this amends D-39 only for evidence-aware package generation. The
canonical slot remains `sideFull` / Walk. A future positively lateral recipe
may vary its direction to show selected evidence; the current anterior-pec
recipe uses flexible strict-profile direction and omission. Ordinary legacy
generation may retain its existing prompt, but its requested direction is
never treated as verified anatomy.

**R7-7E identity-boundary correction (2026-07-29):** accepting a typed
feature creates a new immutable identity snapshot because the selected feature
graph changed, but it does **not** advance the legacy facial-identity revision
when the identity documents and headshot anchor are unchanged. The accepted
complete image is stamped into the existing revision; selective package
compatibility carries the view-impact law. This keeps the unchanged headshot a
valid mint anchor without duplicating or mutating headshot history. The one
founder pilot row written before this correction uses a bounded, lock-fenced,
all-or-nothing repair: the model revision and mis-stamped accepted asset are
 corrected, while only carried views proven `current` in the immutable parent
 package and `unaffected` by the accepted feature are restored in both slot
 compatibility and asset status. Parent-stale and genuinely affected views
 remain stale. Read-only planning exposes the exact closed view/asset set;
 separate model and restored-view count fences plus an in-transaction
postflight proof prevent a broader repair.

**Production repair completed 2026-07-29:** deployment
`6a9eae64-37b2-4105-9759-62dd3318d69b` at commit `853fffb` repaired only
founder model `35`: one model revision, one accepted-asset provenance stamp,
and the four parent-current/unaffected views `frontClose`, `threeQuarter`,
`sideClose`, and `backFull` (asset ids `152`, `154`, `155`, `156`). The
feature-affected `sideFull` remained stale. The in-transaction proof and a
separate read-only postflight both passed; the latter reported `repaired` with
zero remaining repair rows and zero remaining restorable views.

**R7-7E diagnostic correction (2026-07-29):** a rejected evidence-package
candidate records only a closed server-owned failure code in its generation
audit and terminal failure-marker provenance. No prompt, model response,
private evidence locator or free text is retained. Closed execution-stage and
provider-outcome telemetry is also permitted; it contains no prompt, image,
locator, model response text or free-form provider error. This makes
calibration and infrastructure failures distinguishable without turning blind
retries into the workflow.

**R7-7E Walk diagnosis correction (2026-07-29):** raw structured Railway logs
showed three pre-correction founder Walk actions, not two. Each ran two image
attempts and two strict probes; all six candidates stopped at the same closed
`low_confidence` gate and all three parent charges were refunded. None reached
the later observed-side or observed-direction checks. The earlier claim that
those actions proved a laterality/direction mismatch was therefore
overstated. The registry's anatomical-left/frame-right and
anatomical-right/frame-left pairings were still physically contradictory and
were corrected as a latent geometry defect, but they are not the evidenced
cause of those six rejections. The first post-correction action then failed at
`execution_error` before any probe was queued and was refunded, so it did not
validate the facing change. Closed execution-stage telemetry was added for any
future failure; no further paid attempt is authorized by this diagnosis.

**R7-7E anterior-pec visibility ruling (founder-ratified 2026-07-29; amends the
R7-7E application of D-71):** the pilot tuple is
`front_upper_torso + anterior`. Its `left | centre | right` value locates the
feature within the anterior pec surface; it is not proof that the feature is
on a lateral surface visible in a strict Walk profile. The accepted founder
tattoo is not fully visible in Walk, and forcing it into that image would be
anatomically wrong.

For this pilot tuple, an existing `sideFull` / Walk selection is therefore
`unaffected` for every side and must never offer a paid preservation refresh.
A genuinely missing Walk remains optional progressive coverage and may be
composed only with `hidden_omit`, flexible strict-profile direction, no
feature-placement target zone, and strict framing/omission/identity/
continuity/anti-invention probes. A future truly lateral-chest capability
requires a distinct ontology/surface and calibration; it may not be inferred
from `side`.

The v3 registry/composer/probe identity records that visibility correction.
The completed identity-revision repair remains frozen to its historical v1
impact law. Founder model `35` requires a separate, exact-cohort,
compatibility-only restoration of its parent-current Walk asset and current
snapshot slot; that repair changes no identity, feature, package selection,
credits, storage or image bytes and still requires a separately authorized
production apply.

**R7-7E Walk compatibility closure (2026-07-29):** commit `17b7f3a` deployed
successfully as Railway deployment
`e49f630a-605d-454f-aaf4-67cccaff3930`. After a read-only exact-cohort plan
found founder user `1`, model `35`, Walk asset `157` as the sole eligible row,
the founder separately authorized the compatibility-only production apply.
The transaction restored exactly one asset status and one current snapshot
slot, changed no image bytes or selections, and invoked no generation,
provider, credit, storage, identity or feature write. Its in-tool proof passed,
and a separate read-only postflight found the same model/asset `repaired` with
zero remaining repair rows.

### D-72 — Cast packages are progressive, not a six-view prerequisite *(founder-ratified 2026-07-29; amends R7-7E mint and post-mint package scope)*

**Minimum useful Cast:** the normal product path presents a strong portrait
and front full-body reference as the essential Cast, then offers additional
coverage only when it is useful. Canonical angle names, tier machinery, and
technical package management stay behind the product surface. Drape may
recommend one contextual action such as “Add a side view to preserve the
right-arm tattoo”; it must not make the user configure a reference sheet.

**Mint law:** evidence-aware mint requires the identity anchor and every view
in the deliberately chosen tier to exist, be current, and pass the ordinary
mint integrity law. Missing, stale, failed, or unverified views outside that
tier do not block mint. Mint remains zero-generation and zero-credit: it
never fills or refreshes a view implicitly.

**Progressive expansion:** mint seals the exact identity and package truth at
that moment, but does not permanently close the reference package. After
mint, the identity remains immutable while deliberate evidence-aware
add/update actions may append package snapshots and make optional views
current. Every paid addition remains explicit and plan-priced; nothing spends
or generates automatically.

**UX direction:** the primary interface should communicate “Ready to use”
and a secondary “Add coverage” path, with contextual recommendations when
selected evidence makes a view valuable. Sophistication comes from Drape
choosing the useful view, not from exposing more controls.

### D-73 — Cast history presents states, not restore audit events *(founder-ratified 2026-07-29; R7-7F correction)*

**Product surface:** repeated whole-Cast restores must not create a growing
stack of indistinguishable `Restored state` rows. The public history presents
each unique semantic Cast state once, puts the state containing the current
identity head first, and labels it `Current`. A valid restore snapshot resolves
transitively through its restore provenance to the original non-restore state,
so restore-of-restore chains collapse as well.

**Safety boundary:** this is projection-only. Every restore still appends its
identity snapshot, package snapshot, selections, durable zero-credit receipt,
parent link, and restore-source link. No ledger row is rewritten, deleted, or
made reusable as mutable authority. Malformed or non-closing restore
provenance remains fail-closed rather than being silently coalesced.

**R7-7F production closure (founder-confirmed 2026-07-29):** founder-only
whole-Cast restore proved both the featureless Original Cast state and the
evidence-bearing accepted-tattoo state without generation or credit changes.
The live-drive client rehydration defect was corrected at `9fe64cd`; the
state-not-events projection was corrected at `d09ca4c` and founder-confirmed
on production. Append-only restore authority remains intact. R7-7F is closed;
R7-8 quality/reference-sheet/dogfood closure is next.

### D-74 — Current Casting generation stays 1K; downstream reference sheets are deferred *(founder-ratified 2026-07-29; narrows R7-8)*

**Generation quality:** do not build a generation-time quality selector or
1K/2K package default in the current release. Casting image generation remains
on its existing 1K path. Identity-pack export is also 1K-only. Residual 2K
planning, execution, pricing, or identity-document claims are not part of the
customer contract and must be removed rather than left as a latent paid path.

**Reference-sheet derivative:** the proposed generated downstream
reference-sheet derivative and engine-specific presets are deferred beyond
R7. Existing identity canon, package selections, and downstream payload
contracts remain unchanged.

**R7-8 closure scope:** R7-8 now consists of rewritten production acceptance
criteria, the named navigation/profile/dead-code/deploy-skew/performance
audits, the full release verification matrix, founder manual drives, and
dogfood closure. Deferred quality and reference-sheet work do not block R7
closure.

### D-75 — The chest recipe is a pilot; tattoo completion means natural-language all-body ink add *(founder-ratified 2026-07-29; adds R7-7G)*

**End-state correction:** the shipped `front_upper_torso + anterior` recipe
proved the evidence, preview, billing, acceptance, package, history, and
restore architecture. It is not the intended final tattoo product. R7 cannot
close while a chest-placement harness is presented as tattoo editing.

**Public interaction:** a person describes the tattoo and its location
naturally. Drape resolves anatomical zone, surface, laterality, useful source
view, placement guidance, strict verification, affected views, and refresh
planning internally. Manual chest-side buttons are calibration tooling, not
the public interface. An optional direct point on the person may assist
location, but users never operate an anatomical-zone configuration form.

**Tattoo-category completion:** `ink.add` expands across body locations
represented by the Cast, including head/neck, front and back torso,
shoulders/arms and full sleeves, hands, hips, legs, and feet. Multiple accepted
tattoos accumulate as typed feature evidence and complete selected images;
later additions preserve every earlier accepted tattoo predicted visible.
Each zone/surface/laterality tuple earns release through its own visibility,
guidance, probe, occlusion, mirroring, and cohort calibration. Unknown or
contradictory truth refuses free, and nothing refreshes or spends
automatically.

**Operation and category boundary:** this completes tattoo addition anywhere;
it does not implicitly authorize tattoo removal, replacement, cover-up,
movement, or resizing. Those remain distinct generative edit/erase operations.
Cybernetics, moles, scars, and other permanent-feature categories follow only
after all-body `ink.add` passes its founder gate.

**R7-7G local implementation checkpoint (2026-07-29; not a production
closure):** G0–G6 are implemented. New v2 writes use a closed all-body
registry and natural-language planner; the server owns anatomy, source view,
visibility, feature graph, price, and affected-view authority. Multiple
tattoos close positively, initial authoring costs 350 credits, and
first-unseen-region projections use private Accept / Retry / Cancel candidates
at the existing canonical slot price (300 credits for the current body
slots). Prior visible ink is an explicit fail-closed probe outcome. Public
DTOs omit ontology keys, source asset IDs, storage locators, and other
features' private text. Casting generation and identity-pack export are
1K-only, with no customer-callable upscale path.

Additive migrations `0015` and `0016` passed the guarded disposable-MySQL
mixed-version/default/final-fence drive and the scratch database was dropped.
`pnpm check`, the full 3,157-test local suite, and `pnpm build` pass. A
feature-off headless Edge drive against a disposable fully migrated database
routed a right-forearm tattoo from the ordinary Refine field and refused
before any candidate-generation route. No paid generation or production
mutation occurred. Production migration, feature-off landing, founder-only
enablement, paid cohort calibration, and R7-7G closure remain pending.

**R7-7G production landing and first calibration checkpoint (2026-07-29; not
closure):** production applied additive migrations `0015` and `0016` without
changing existing evidence row counts. The all-body runtime landed feature-off
and healthy; the ordinary Refine field resolved a right-forearm request but
refused before provider or credit work, preserving the 69,200-credit balance.
Evidence ingestion, composer, package, and candidate worker were then enabled
for founder user 1 only.

The first paid G8 drive resolved “right arm, full sleeve” and Full front,
charged 350 credits, and delivered a private candidate. The provider mirrored
the sleeve onto the subject's anatomical left arm. The original semantic
feature-placement probe returned pass, so visual inspection—not the machine
gate—prevented an incorrect acceptance. Cancel removed the preview and left
the disclosed successful-delivery charge in place at a 68,850-credit balance.
No second paid generation has run.

**Laterality repair:** all-body composer v2 now receives server-owned
subject/frame side authority, and an independent placement-audit recipe
examines a server-annotated candidate. Readiness requires both semantic feature
truth and positive proof that the ink is on the requested anatomical side,
inside the authorized zone, with no conflicting new mark outside it. Unknown
remains fail-closed; an opposite-side result takes the included retry, then
fails/refunds. Production has zero accepted all-body composer-v1 feature
versions. The repair passes typecheck, 3,158 tests, build, and diff checks
locally, but remains pending production deployment and one controlled paid
retest. No anatomical cohort is enabled and R7-7G remains open.

**R7-7G founder calibration and release-policy closure (2026-07-29;
production-confirmed):** the production calibration Cast accepted five
independent tattoos across centre anterior face, centre posterior upper torso,
left anterior shoulder, right circumferential full arm, and left anterior
thigh. Multi-feature accumulation/preservation, cancellation, exact refunds,
whole-Cast history/restore, and affected-view planning passed. The accepted
authoring graph remains available only to founder user 1.

First-unseen projection did not earn release under the current Gemini image
configuration. Side failed both included attempts at the combined
identity/placement/preservation gate and refunded 300 credits (operation
`3421a924-4666-4439-a044-ff0ab86e58d9`). A delivered 3/4 candidate visibly
mirrored the left-shoulder triangle despite the then-current semantic probe;
founder inspection rejected it and Cancel removed the private candidate
(operation `a394dc93-2eb5-4c52-8106-b649200fc913`, 300-credit successful
delivery). The added independent per-feature placement audit then rejected
both Walk attempts with 90% confidence for wrong anatomical side and
authorized zone while identity/framing passed; the 300 credits refunded
exactly once (operation `637c1649-c8ce-4186-8313-6f25250d051d`). No unsafe
projection entered canon.

Release policy `ink.add.release-policy.2026-07-29.v1` admits only the exact
founder-confirmed v2 tuples—centre anterior face, centre posterior upper torso,
left anterior shoulder, right circumferential full arm, and left anterior
thigh—plus all three sides of the previously calibrated anterior upper-torso
pilot. Every other tuple refuses before durable or paid work. First-unseen
projection is disabled for every canonical angle under the current
provider/recipe configuration: package plans expose no price or retry and
direct mutation calls refuse before quota, operation, provider, or credits.
This is an explicit cohort disablement, not a weakened evidence check. The
candidate acceptance machinery stays in place for future recalibration.
The release policy deployed at `4e11c6c`. A no-cost production drive confirmed
that 3/4, Side, and Walk expose neither price nor generation controls, each is
named unavailable in Coverage & versions, and a right-lower-leg request
refuses before durable or paid work with the balance unchanged at 66,200.

That drive found one history-reader defect: the reader required every earlier
tattoo's original accepted asset to remain selected even after a later
preservation-probed candidate validly replaced the same view. `8a2413d`
retains accepted asset/plate closure and requires every selected feature's
source angle to remain represented, while allowing the later immutable
snapshot selection at that angle. Production now shows the current
five-feature state and all earlier accumulated states with six views, and the
coverage footer truthfully reports three unavailable views. Typecheck, 247
files / 3,178 tests, build, diff checks, and the live drive pass. R7-7G is
closed; execution returns to R7-8.

### D-76 — R7 closes on current production truth, with no implicit R8 *(founder-directed 2026-07-29; production closure)*

**Current acceptance authority:** the R7 production criteria are now the
sixteen contracts in
`CASTING_SYSTEM_R7_8_ACCEPTANCE_AND_DOGFOOD_CLOSURE.md`. They cover deliberate
spend, durable operations, exact identity/snapshot authority, Profile,
strip/package/history truth, final deletion, evidence privacy, calibrated
natural-language tattoo addition, the Walk refusal/refund boundary, fixed 1K
generation/export, navigation/account truth, Canvas scale, and deploy skew.
The older R6-entry criteria remain historical evidence rather than the current
release checklist.

**R7-8 hardening ruling:** account Security must report the actual persisted
sign-in provider. A connection action without a complete server contract and
handler is false product affordance and must not ship. Stale unreferenced
implementations are removed when their replacement is already authoritative;
billing-sensitive dormant referral behavior is logged for a founder ruling
rather than casually wired or deleted.

**Production evidence:** a visible no-cost drive created a temporary 36-node
Canvas, cold-loaded all nodes in 1,856 ms, selected a Cast in 563 ms, and
persisted a keyboard nudge in 73 ms. The board was deleted after the drive and
the founder balance remained 66,200 credits. Casting and Canvas back actions
landed at `/app`; the account popout and real settings tabs opened. The
Security correction and dead-code removal landed at `f96a6b0`.

**Verification and environment boundary:** typecheck, 248 files / 3,182 tests,
production build, focused hardening/deploy-skew/1K tests, migration-journal
validation, and diff checks pass. The local development database is behind
cleanup-backend migration `0012`; R7 does not contact production data or
migrate a shared target merely to force the extended headless script green.
That script now contains the provider-free 36-node leg for the next fully
migrated disposable environment. The equivalent current production drive
passed and the local preparation gap is explicitly logged.

**Closure:** R7-0 through R7-8 are complete. Dogfooding may begin only inside
the released scopes. Cybernetics, scars, moles, other permanent-feature
families, tattoo erase/replace/move/resize, generated reference sheets, quality
tiers, demo-video/CDN launch work, and automatic referral claiming are not
silently promoted into R7. There is no ratified R8 plan; the founder chooses
the next product and technical boundary before one is defined.

**R7 post-closure package-truth correction (2026-07-30):** founder dogfooding
found that accepted forehead and right full-sleeve evidence appeared only in
their authoring views while 3/4 and Side still looked current. The immutable
package transition was correct: centre anterior face invalidates Head, 3/4,
and Side; the accepted Head replaces its stale source; and facial ink may be
omitted from Full, Walk, and Back at 1K as below-resolution truth. A right
circumferential full sleeve invalidates 3/4, Full, Side, Walk, and Back; the
accepted Full replaces its source.

The display defect was downstream. When first-unseen tattoo projection is
safety-closed, the evidence plan deliberately exposes no paid action and
projects an `attention` explanation. The strip and details dialog incorrectly
used that actionability projection in place of the package slot's immutable
stale compatibility, making incompatible images look current. Display truth
and action authority are now separate: stale slots remain visibly out of sync
and are counted as issues, while the existing no-price/no-generation refusal
remains intact. No provider work, production data access, safety-check
weakening, or projection enablement is part of this correction. Typecheck, 248
files / 3,183 tests, production build, focused anatomy/package-display tests,
and diff checks pass locally.

### D-77 — Casting V2 M1: the foundation token scope is deliberately narrow until M2 *(executor decision 2026-07-30; advisor-reviewed; converges on the plan, does not amend it)*

**What shipped.** `CASTING_V2_ARCHITECTURE_PLAN.md` M1: `client/src/foundation/`
(tokens, scoped reset, AppShell/rail/topbar, primitives), the theme rewrite, a
no-hex source guard, a theme-boot test, and the reusable light/dark screenshot
drive. Mounted on an unlinked `/casting` route: no product surface changed.

**Token scope — the one deviation.** Plan §D.1 puts the foundation tokens on
`:root`, loaded first in `index.css`, with the shadcn semantic remap following
at M2. Four custom-property names collide with CSS that legacy surfaces still
read: `--border`, `--muted`, `--secondary` (defined in `index.css`'s shadcn
`:root`, consumed through `@theme inline`) and `--font-sans` (defined at
`:root` in the marketing `styles/tokens.css` and read by its utility classes).
Landing the block at `:root` before the remap either repaints every legacy
surface or resolves the foundation to shadcn's values — both break M1's law
that the milestone has no visible product effect. M1 therefore scopes the
block to the shell root element (`.dp-root`, and `[data-theme="dark"]
.dp-root`), which wins for the whole foundation subtree regardless of
stylesheet order. `data-theme` on `<html>` remains the only switch, so no
component branches on theme. **M2 promotes the block to `:root` as part of the
remap — a selector change, not a rewrite.** Consequence carried forward: while
the scope is narrow, tokens do not reach Radix portals (they mount on
`<body>`), so M1 deliberately ships no dialog, menu or tooltip primitive;
those arrive with the M2 promotion.

**Theme mechanics.** `ThemeProvider`'s `switchable` prop is gone — it defaulted
to false, so persistence never ran and the stored value was never read. The
theme now persists under `drape_theme` (the dead `theme` key is never read),
applies as `data-theme` on `<html>`, and defaults to dark for continuity. The
`.dark` class is still written in step with the attribute because ~46 `dark:`
utilities on legacy surfaces read it; that second write dies at M2 when the
`dark` custom variant is redefined as `[data-theme="dark"]`.

**Production CSP.** The first-paint script is inline and classic on purpose (a
module script is deferred and would flash), and production `script-src` carries
no `unsafe-inline`. Its sha256 is now an exported constant in
`server/security/securityHeaders.ts`, and a test recomputes the hash from
`client/index.html` and fails on drift. Verified that `pnpm build` emits the
script byte-identically, so the hash is valid against the served HTML and not
just the source.

**Test surface.** `vitest.config.ts` now includes `client/src/**/*.test.ts` for
pure-logic and source-guard tests only (node environment, no DOM, no component
rendering). The no-hex guard covers `client/src/foundation/**`, the future
`features/casting-v2/**`, and the M1 surface, with exactly two named
carve-outs: `tokens.css` (the token source) and `brand-orb.css` (brand artwork,
identical in both themes). A companion test proves every themeable token is
defined in both themes, so a missing token cannot force a theme conditional.

**Not pulled forward.** The Tailwind token mapping (§D.2), the shadcn semantic
remap and lobby shell adoption (M2), the `Navigation.tsx`/`ui/sidebar.tsx`
delete-now hygiene (§L), and the D-22/D-74 supersessions (recorded at the
Canvas and Sign milestones) all remain outside M1 so its rollback stays a
single revert.

### D-78 — Casting V2 M2: the app has one palette, and it was never really dark *(executor decisions 2026-07-30; advisor-reviewed; one founder question raised, not decided)*

**What shipped**, as four independently revertible commits: (A) foundation
tokens promoted from `.dp-root` to `:root`, closing D-77's deferral; (B) the
shadcn semantic remap; (C) the marketing stylesheet's Tailwind shadowing
removed; (D) the lobby moved onto the foundation shell.

**Name correspondence is broken in the remap, deliberately.** shadcn's
`--muted`, `--secondary` and `--accent` are *background* colours; the
foundation's same-named tokens are *text* colours. Mapping by name would have
made `bg-muted` a mid-grey slab and `bg-accent` a brand-orange slab — the
latter also breaking non-negotiable 5, which reserves accent for selection.
Each maps to the surface it actually is, with its `-foreground` partner taking
the text token. The reasoned table lives inline in `index.css`; that block is
the milestone's rollback unit.

**One switch.** The `dark` custom variant now reads `[data-theme="dark"]`, so
the `.dark` class is gone from `applyTheme`, from the first-paint script and
from the CSP hash. `--errorInk` was added as the error family's text role
after measuring plain `--error` at 3.40:1 on the dark surface — below the
4.5:1 floor — mirroring how `--accentInk` relates to `--accentSolid`.

**Two things measurement contradicted.**

1. **§B-10's premise is wrong.** It sets the default theme to dark "for
   continuity with the current product", and M2's own reality check says the
   app is "dark today via hardcoded component styling". It is not: every
   legacy surface rendered *light* regardless of theme, because the shadcn
   slots were light-only and the components hardcoded their colours. The
   consequence is now visible — the lobby and Casting V2 follow the theme
   while `/studio`, admin, moderator and the board canvas remain light until
   their own milestones, so a founder on the dark default sees a mixed app.
   **This is a product decision and it is left to the founder** (§K M2's gate
   is exactly this eyeball): keep dark and accept the mixed period, or default
   to light until enough surfaces migrate and flip later. No code presumes the
   answer — it is one constant in `foundation/theme.ts`.

2. **§D.1's "scope the marketing stylesheet to marketing routes" is not the
   tidy-up it sounds like.** That file's `:root` block shadows Tailwind's own
   palette names — `--color-gray-100/200/400/500` and `--color-black` — so it
   silently repaints roughly 90 utility usages on surfaces with no relation to
   marketing. Scoping or deleting it is therefore an app-wide visual change
   needing its own reviewed commit, not part of M2. What *was* removed is the
   narrower, unambiguous bug: unlayered `.text-primary` / `.text-secondary` /
   `.text-muted` classes overriding Tailwind's same-named utilities
   everywhere. A guard test now fails on any class named after a semantic
   utility. (Correction to an earlier count in this program: the reported "45
   affected usages" came from a word-boundary grep in which `text-muted` also
   matched `text-muted-foreground`. Real figures: 0, 0, and 9 — the nine all
   wanting the shadcn primary, which they now correctly get.)

**Lobby scope.** §D.14 says M2 wraps existing lobby content "cheaply". Wrapping
alone would have produced a themed shell around permanently light content, so
the 125 hardcoded colours in the 13 lobby files were tokenised too — that is
the "tokens" §D.14 names, not the deferred redesign. Information architecture,
views and modals are untouched. Controls over media were converted to dark
glass on the way (non-negotiable 13). `LobbyRail.tsx` and `MobileHeader` are
deleted, their duties covered by the shell.

## Group 7 — Factual corrections (no design content — verified against code, A2 for details)

| Ref | Correction |
|---|---|
| F-1 | Credit costs: real `CREDIT_COSTS` (350/300/…) replace every "1,200 credits" example (A2 N5) |
| F-2 | `/studio` reality: bare `/studio` redirects to `/app`; fallback = the `?tool=` entries (A2 N1) |
| F-3 | Version history already exists (table + 4 procedures + client UI); History tab builds on it (A2 N3) |
| F-4 | Garment auto-captioning already shipped; foundations Decision 5.3 removed from the workload (A2 N4) |
| F-5 | Field names: `castingBrand`/`castingVibe`/`skinTone` (compound values)/`hairColor`; ~34 `ModelPreferences` fields, not 27/33 (A2 B1–B3) |
| F-6 | Component locations: `EthnicityBlender`/`SkinToneGrid`/`EyeGrid` live inside `WarmPrimitives.tsx`; `BrandSelector` doesn't exist yet; `castingHelpers.tsx` not `.ts` (A2 G/N12) |
| F-7 | `TriBlendSelector` `PRESETS`/`SNAP_THRESHOLD` are private — export needed for `formatVibe` (A2 F) |
| F-8 | Second legacy side-effect: `useCastingViewGeneration` also calls `setCanvas` (line 81) — both must go in the refactor (A2 A1) |
| F-9 | Ethnicity blends cap at 2; vibe chip shows preset-name-or-Custom; skin chip shows compound-value first half (A2 C/F/B2) |
| F-10 | Cross-field rules: gender change clears hairStyle/hairFade/facialHair AND hair-style selection has its own cascade (:305–310) — both port into `updateAttributes` (A2 D1) |
| F-11 | Parser prerequisites still unmet: no `Mediterranean`, no `*Override` fields; PARSER_PROMPT_V2 §4's line refs are stale — locate by content in `buildNewPromptContent` (@ `geminiGeneration.ts:253`) (A2 N10) |
| F-12 | Current canvas already runs React Flow with drag-fingerprint protection and imperative viewport helpers — preserved, not rebuilt (A2 N6) |
| F-13 | `parentItemId` exists but nothing writes it; frozen, edges are the lineage (A2 N7) |
| F-14 | Constants dedupe trap: `WarmPrimitives` `EYE_PRESETS` copy lacks the `image` field the `constants.ts` copy has (A2 H) |

## Group 8 — Process

| Ref | Decision |
|---|---|
| P-1 | Docs revised **in place** (full revisions, not delta documents) — a coding agent reads one authoritative document; split-brain deltas defeat that. Originals live in git history |
| P-2 | Original `CANVAS_AUDIT_ADDENDUM.md` kept with a superseded banner pointing to V2 (delete later if you prefer) |
| P-3 | Detailed M-milestones removed from the foundations (§7 is pass-level scope only); `PASS_1_BUILD_PLAN.md` is authored **after this log is ratified** and will carry milestone ordering, sizing, and founder visual checkpoints |
| P-4 | `PARSER_PROMPT_V2.md` / `PARSER_GOLD_STANDARD_V2.md` untouched — inputs, not revision targets; their engine-change prerequisites are tracked via F-11 |

---

**Nothing from brief §4 was rejected**; D-11/D-13/D-20 accepted with modifications noted. **Locked-ledger amendments to date, all founder-initiated or brief-invited:** D-8 (red confirm), D-29 (root/view rendering, proposed), D-32 (no-modal rule refined), D-33/D-35 (inline-first for casting). Everything else in the locked ledger (reference-asset framing, edges-as-lineage, the non-negotiables, sentence case / two weights / hairlines) is preserved unchanged.

### D-79 — Partial deference: RULED, SHIPPED, AND ROLLED BACK ON FIRST FOUNDER VERIFICATION *(founder ruling 2026-08-01; shipped `6ec7878c`; reverted `7596848f` the same day)*

**Status: reverted. Not in production. Do not re-ship without the fix and the
tests described below.**

**The ruling stands** — the unit of "said" is the fact, not the axis. What
failed was the implementation, on its first contact with real briefs.

**What the founder saw.** Three of five verification briefs dropped their stated
hair fact entirely: "shaved head" returned zero shaved heads, "pastel pink hair"
returned all black, "a redhead" returned no redheads and the brief echo omitted
the hair fact altogether ("everyone on this sheet is a woman in her 30s").
"Silver at the temples" still worked.

**Root cause: the interpreter's decomposition CONSUMED the fact.** Reproduced by
running the real interpreter against the shipped build:

| brief | role | characterNotes | hairSpoken |
|---|---|---|---|
| "a woman with pastel pink hair" | **null** | **null** | `["colour"]` |
| "a redhead in her 30s" | **null** | **null** | `["colour"]` |
| "silver at the temples" | "skincare founder" | "silver at the temples" | `[]` + greyOverlay |

`role` and `characterNotes` are the ONLY fields that carry the user's words to
the image model. Told to classify hair into a new structured field, the model
treated `hairSpoken` as the place hair now lives and stopped writing the words
at all — so the fact reached neither the prompt nor the echo. "Redhead" also took
`role` down with it, losing the casting category as well as the hair.

Silver survived precisely because it routed through `greyOverlay`, a path that
did not invite the model to drop prose. That asymmetry is the diagnostic
signature the founder identified before any code was read, and it was correct.

**The scrubbing was not the culprit.** "Complement, never restate" only edits the
authored line; the stated words travel separately and were intact wherever the
interpreter still wrote them.

**Why the tests were green while this shipped — the important lesson.** Every
test in `partialDeference.test.ts` drove the interpreter through a stub engine
that returned a hand-written intent already containing the phrase. They proved
the COMPOSER behaves when handed a good intent, and never exercised the
decomposition that produces one. The sacred coverage regression was green for
the same reason. A test that supplies the input the bug corrupts cannot see the
bug.

**Conditions for re-shipping**, beyond the founder's original four:

1. The interpreter prompt must state that `hairSpoken` is a CLASSIFICATION and
   that the user's words must STILL appear verbatim in `role` or
   `characterNotes` — the structured field is a hint about what is open, never a
   substitute for the fact.
2. Pinned tests asserting the stated words are present in the COMPOSED PROMPT
   for each of the five founder briefs — at the prompt layer, not the composer's
   input.
3. At least one test that exercises the real decomposition rather than a stub,
   so a prompt change that makes the model drop prose fails the build.
4. All five founder briefs pass a live verification before the flag goes on.


### D-80 — Styling realization is subordinate to creative context; biology is not *(founder ruling 2026-08-01 after Fable review, refined same day; executor-implemented, advisor-reviewed)*

**The split.** The six realized axes are two tiers. **Biology** — eye colour,
brow character, skin character — authors everywhere, unchanged: no creative
direction implies them, so a named cast direction and a realized eye colour can
never disagree. **Styling** — hair cut, hair texture, facial hair — changes
resolution by context.

**Precedence: stated > category > styling-bias > prior.**

**Why.** A prescribed cut competes with the category the user asked for and
wins, being the more specific instruction: "a 30 year old heavy metal bogan"
plus "a brown straight french crop" is a sheet arguing with itself. Under
creative context the styling axes drop to silhouette resolution.

**What counts as context is the STATED intent** — `intent.role`, or a
strongly-flavoured stated archetype/look. Never the resolved archetype:
`resolveArchetype` always returns a direction, so reading it would put every
context-free brief into bias mode whenever the roll drew a flavoured one.

**The flavoured set is computed, not curated**, from each shelf entry's own
positive description — `avoid` is excluded, because a prohibition mentioning
styling is the shelf refusing a styling idea rather than owning one. Scanning
whole entries wrongly flagged "everyday real", whose text says *do not render as
a model with dressed-down styling*. Current outcome, pinned by test so an edit
asks for a ruling: archetypes `street cast`, `quiet luxury`; looks
`raw street-cast`, `quiet luxury`. Everything else neutral.

**Hair colour is deliberately NOT in the styling tier.** It is closer to biology
than grooming, and it is the twin-breaker's only second axis on a sheet of
women.

**The prose went through two versions, and the second is the ruling.** The first
deferred everything — "worn toward the longer end of how this casting genuinely
wears it" — and a paid sheet came back as eight ordinary people. A deferral
renders as the model's own default; the named cut it replaced had at least been
carrying the subcultural signal. The founder's correction: *prescription was not
the enemy, category-blind prescription was.* So code still picks the silhouette
family — that is the distinctness engine and what the taste rules count — but
names it renderably, deferring only the CHARACTER (sharp or grown out, groomed
or neglected), which is the part a category genuinely owns.

Phrasing is absolute, never comparative: the image model renders one candidate
and never sees the other seven, so "longer than the others" is a claim the
prompt cannot keep.

**Distinctness counts at family level under bias**, because that is the
resolution the prompt carries — counting names there would score eight distinct
cuts on a sheet showing four silhouettes.

**Explicitly untouched, by ruling:** the sex and heritage spread (a subculture
casts across every heritage — that dilution is a product value) and the wardrobe
constant (the framing law is what makes candidates comparable).

**THIS TIER IS AN INTERIM ANSWER.** Two paid bogan sheets met the ≥4-silhouette
bar and neither read as visibly subcultural. That is the expected ceiling:
subculture lives in what someone *wears*, and the cohort constant forbids all of
it on purpose. **Path B — an authored treatment that knows what a bogan wears —
is the real fix**, and the bias prose must not accrete cleverness that Path B
will have to unpick. The note is recorded in the code beside the prose itself.


### D-81 — The four-pass adversarial review, and the test-teeth lesson *(Fable review + founder-directed hardening batch, 2026-08-01)*

**Why this is in the repo and not a chat log:** the findings below are the kind
a future session will re-introduce unless it can read what went wrong and why.
Two commits: `63d3ca42` (gates, repairs, record truth) and `c127ab09` (test
teeth).

#### The gravest finding: a guard causing the contradiction it prevented

`briefStatesHair`'s ambiguous-word surrender asked *"does any feature word
appear anywhere in this brief"* — a question about the sentence rather than
about the phrase. So **"a silver fox in his 50s with a trimmed beard"**
surrendered "silver" to a beard eight words away, concluded hair had never been
mentioned, and authored a dark colour directly against the silver fox the user
asked for. The gate added to prevent over-deference was producing the exact
contradiction deference exists to prevent.

Claiming is now per-occurrence within two tokens either side.

Three more in the same family, each a live defect:
- Eye words did not claim, so **"grey eyes"** deferred the entire hair axis.
- Bare `"cut"` sat in `HAIR_WORDS`, so **"a clean-cut banker"** did too.
- `"shaven"`/`"cleanshaven"` sat in `HAIR_WORDS` as well as facial hair, so a
  **clean-shaven** brief lost its authored cuts AND the twin rule's fallback
  axis at once — the one brief shape where both separators vanish together.

#### The rest of pass one

- Vocabulary gaps that authored against stated facts: mohawk, balding,
  cornrows, topknot, pigtail(s), ponytails, auburn; salt-and-pepper matched as
  a phrase because the tokenizer splits it; unshaven and beardless on the
  facial-hair axis.
- **"Greying" sat in the interpreter's 60s age-idiom list.** A literal model
  absorbed a HAIR fact into an age band, and a number cannot carry a colour, so
  the grey never reached the picture. Same shape as D-79 and live at the time.
- The heritage repair mapped bare **"asian"** to East Asian only, so *"a South
  Asian model"* on an interpreter miss was repaired into the WRONG heritage — a
  lock the user never wrote, over a fact they had stated correctly.
- The role repair fired on *"an archetype was set"*, and an archetype lands from
  VIBE as readily as from a category, so a mood brief had its whole sentence
  installed as a casting category — killing build variation, flipping the sheet
  into styling-bias mode past the flavoured-archetype design, and making the
  echo claim a category nobody wrote.
- **Record truth.** The persisted identity — which M7's registry will read as
  sole truth — carried two fictions: suppressed axes kept fabricated values (a
  shaved-head candidate recorded `hair: long, brown`), and bias-mode candidates
  recorded a named cut where the prompt had carried a silhouette. Suppressed
  axes are null now, the types say so, and the resolution tier is recorded
  beside the identity.
- **Follow precedence.** Bias mode never consulted the anchor, so every follow
  under a role brief rendered an inherited named cut as generic silhouette
  prose. The taste pass's follow skip keyed on `anchor?.realized != null`, so a
  parent cast before realized axes existed left the pass free to rewrite
  anchored hair. And unpinning was silently inert on a follow: `applyUnlocks`
  cleared the intent, then the resolver read the anchor and put it straight
  back.
- The energy cycle had no per-roll offset, so tile 1 of every disposition sheet
  was the same persona and re-rolling never moved it.

#### THE TEST-TEETH LESSON — the part worth keeping

Every defect above was invisible to a green suite, and they failed in two
recurring shapes.

**1. Tests were excluded from the typecheck.** The root `tsconfig.json`
excluded `**/*.test.ts`, so for the whole life of this subsystem no test file
was ever typechecked. `followAnchor.test.ts` built a `FollowAnchor` with **no
`realized` field at all** — meaning no test in that file had ever exercised
realized-axis inheritance, the most-changed thing about follows. A
`ResolvedIdentity` fixture had drifted four fields. A `vi.fn` stub was declared
with no arguments and called with one.

**2. Suites proved the layer ABOVE the one that breaks.** The brand scrub had
unit tests and no compile-path test, so deleting its call site in the compiler
left the entire suite green — for the guard that exists because a trademark
reaching the provider cost a real roll five of eight candidates. Absence-only
assertions ("the prompt does not contain X") passed just as happily when the
line was never emitted at all: the bias beard test was passing on **zero**
facial-hair lines. And `COHORT_CONSTANT_MARKERS` was a hand-maintained parallel
array missing `SKIN_AND_FEATURES` — the most craft-dense block in the file was
the one block nothing checked, including in the version the craft-port audit
declared a working guard.

**The three standing rules that follow:**

- **Assert at the boundary that matters.** If deleting a rule's call site leaves
  the suite green, the rule is untested however many unit tests it has.
- **Never absence-only.** Pair every "does not contain" with a count floor, or
  the test passes when the feature silently disappears.
- **Never a parallel list.** Derive the guard's list from the thing it guards;
  a hand-kept copy always drifts, and patching one omission leaves the shape
  that caused it.

Enforced rather than remembered: `tsconfig.casting-tests.json` (glob-scoped, so
it grows with the tree) runs inside the suite via
`server/castingV2/typecheckGate.test.ts` and from `pnpm check`. Both were
verified by negative control — disabling the scrub's call site, and introducing
a type error, each fail the suite.

**Scoped, not repo-wide.** Removing the test exclusion everywhere surfaces 471
errors across unrelated suites and build scripts, mostly `downlevelIteration`
and long-standing drift. That is a project, not a gate, and the only fast way
through it would be loosening compiler options — worse than the gap. Recorded
here as known and open.


### D-82 — A name never becomes a casting category *(executor finding, advisor-reviewed, 2026-08-01)*

Gate 21's second occurrence, and it came from our own repair rather than from
the model.

The golden harness went red on "a Wes Anderson casting, mid 30s". Measured
live, six samples: the interpreter returned `role: null` every time — it never
wrote the name, and captured the aesthetic into the direction correctly.
`promoteStatedRole` then promoted THE WHOLE BRIEF, so every candidate of the
roll carried `CASTING CATEGORY (ABSOLUTE): This person is cast as — a Wes
Anderson casting, mid 30s`. Same shape as the Versace roll that lost five of
eight to provider refusal.

**The ruling: never-reaches-the-engine outranks the user's own words.**
`scrubBrands` deleting "Versace" from a user's sentence is the ratified
precedent, and this extends it from a list of houses to a listless shape. No
list of directors, films or people exists here, or is wanted.

Two halves, because either alone leaves it reachable — gate 21's own doctrine:

1. The **repair** declines when the span still names someone *after* the brand
   scrub. Cheap, and it separates "the repair declined" from "the interpreter
   wrote a name" in the logs.
2. The **guard**, at intent finalization beside `scrubBrands`, nulls a name
   from any author. This is the load-bearing half: the interpreter wrote
   "Versace" into `role` unprompted once already, and no repair covers that.

**Where the guard sits is the design decision.** Not at prompt assembly —
`role` is read by gate B5's category-owns-physique rule and by the echo, so
guarding only the prompt would leave B5 clamping variation and the echo
claiming a category the prompt does not carry. Three readers disagreeing about
one field is the same three-way contradiction the narrowing of this repair
already recorded once. Null it once, where every reader sees it.

**The trigger was never the bug.** `variationAxis === "look"` is honest on this
brief — it really does ask for a kind of face. The broken step was inferring
"this sentence IS a category string" from it.

**A wrong golden was demanding the defect.** The entry was marked
`category: true` against the file's own definition ("names an occupation, type
or kind of person"); "a Wes Anderson casting" names an aesthetic and an age.
The only way to make that assertion pass was to promote the whole brief. It is
re-marked `category: false` in the same commit as the behaviour, with the
aesthetic assertion untouched — **founder: this is a change to your pinned
memory, flagged rather than made silently.**

**Two over-reaches the suite caught before they shipped**, both now pinned:
a capitalized leading article ("An East Asian model") must not read as a name,
and a brand brief must still promote its category, because the scrub removes
the house and keeps the sentence. Getting either wrong reopens category-drop —
the original defect wearing the fix's clothes.

Verified live, not stubbed: goldens 12 briefs x 3 runs green with Margiela
still capturing, and 0 of 64 candidate prompts carrying a name.

**RATIFIED AND SCOPED BY THE FOUNDER, 2026-08-03.** The listlessness rule reads
**listless about PEOPLE; lists of non-people are allowed.** This entry's header
says executor/advisor, and the program's notes had come to attribute the
listlessness to the founder — so the scope is now settled rather than inferred.

The occasion was the twitch role-null miss, measured at 12 of 120 live samples
(10.0%) and traced to this very guard: eleven of the twelve were `guardRole`
discarding a role the interpreter had written correctly as "a Twitch streamer".
The interpreter normalizes to correct English because Twitch IS a proper noun,
and a shape test cannot tell a platform from a person — "Twitch" and "Zendaya"
are the same shape.

The remedy is `VOUCHED_NON_PEOPLE` in `properNouns.ts`, and the founder ratified
its doctrine as written:

- **Platforms, institutions and industries only.** Never a person, never a
  stage name, never a house, never a character.
- **Every gap fails closed** — an unlisted "Kick streamer" still nulls, which is
  the pre-existing behaviour and not a regression. That asymmetry is the entire
  licence for the list existing.
- **A new row is reviewed like a new public endpoint**, not treated as a
  convenience.

This does not loosen D-82. `VOCABULARY_WORDS` and `scrubBrands` were always
lists; what the ruling forbids is a list of PEOPLE, the thing nobody can
enumerate or defend the edges of. Re-measured after the fix: 0 of 120
(95% CI 0.0–3.1%), with negative controls pinned in `roleNameGuard.test.ts` —
Wes Anderson and Zendaya still null, and a vouched word never vouches for its
neighbours.

### D-83 — A reply cut off at the ceiling is transport, not a verdict *(founder ruling 2026-08-01)*

> *"Close the class, not just the ceiling. 500 ate locks, then 1200, now 1800 —
> every new field walks the reply toward whatever the ceiling is, and each time
> the failure is silent."*

A truncated interpreter reply is a JSON fragment; a fragment fails the whole
parse; the compiler falls back and casts the sheet as though the brief had said
nothing. Every lock the user typed, lost — silently, and indistinguishably from
a genuine "the model returned nonsense".

Two structural additions, and neither is a bigger number:

1. The provider reports `truncated` from `finish_reason`, and the interpreter
   classifies it as the **retryable transport failure it is** rather than
   swallowing it into the fallback. A reply that is merely malformed is NOT
   retried — that is the model failing, and retrying it would be superstition.
2. The parse-failure rate is **counted and alarms**, in the roll alarm's shape
   and with its `failureRate` key. A ceiling will always be a guess; whether we
   are hitting it must not be.

The A/B harness tallies TRUNCATED apart from parse-failed, because folding them
together is exactly how this stayed invisible through three raises — and the
run that found it had itself been counting truncated replies as landed.


### D-84 — Two instrument near-misses, and why they are logged as wins *(executor findings, founder-directed record, 2026-08-01)*

D-81's third rule is that a test without teeth is worse than no test, because
it converts an unknown into a false assurance. Its practical form is a habit:
**check the instrument before believing the reading.** Two near-misses in one
session, both caught by that habit rather than by review, both logged because
the founder asked for them by name.

**1. The query that could not see what it was looking for.**

Auditing the roll a deploy orphaned, the ledger was searched with
`referenceId LIKE '%<operationId>%'`. It returned a charge of 160 and **zero
refunds** — which reads as 120 credits owed to the founder and not returned.

It was the query that was wrong. Candidate refund references
(`refund:op:<uuid>:charge:candidate:<uuid>`) exceed the ledger's 64-character
limit and are hashed by `normalizeCreditReferenceId` into `sha256:…`. The
operation id is not in the stored string at all, so a substring search cannot
match a real refund. Computing the exact expected references found all six
present and the money conserved exactly.

The near-miss was a **false money finding reported to the founder** — the
worst kind, because it is alarming, specific, and wrong. What caught it was
refusing to report a money conclusion without confirming the query could
observe the thing it claimed was absent.

**2. The paraphrased money rule that was already wrong.**

The deploy-collision test needed to know which candidates a sweep may settle.
Rather than importing `isSettleable`, the first version restated it: "is this
terminal and does it have an image?" The product asks something different:
"was this ever settled by anyone?" The paraphrase re-refunded `failed`
candidates on a second pass — free credits on every sweep tick — and it was
wrong within ten lines of being written.

**The rule this makes explicit: never paraphrase a money rule into a test.**
Import it. A paraphrase is a second implementation of the rule, with none of
the review the first one got, and its divergence is invisible precisely
because it looks like agreement. `isSettleable` is exported for this reason.

**The shared lesson.** Both failures were silent by construction: a query that
matches nothing and a predicate that matches too much both return plausible
answers. Neither would have been caught by a passing suite, and the same
session had already invalidated an A/B measurement (broken ceiling) and a
graded eye sheet (zero amber tiles drawn). Four instrument failures, four
different shapes, all in work that was otherwise correct.

### D-85 — Shorten the operation lease; a dead operation's user should not wait fifteen minutes *(founder ruling 2026-08-01)*

`DEFAULT_GENERATION_OPERATION_LEASE_MS` was fifteen minutes, and the recovery
sweep may not touch a `running` operation until its lease expires. Measured on
the real deploy collision: 937 seconds from creation to settlement, six seconds
after expiry. Fifteen minutes of frozen tiles and held credits, for no
benefit — a live operation renews every 30 seconds, so lease length governs
only how long a DEAD one keeps its rows non-terminal.

> *"Shorten the default to 5 minutes — a live operation renews every 30s so
> lease length only governs how long a dead operation's user waits for honesty;
> 5 min keeps 10 heartbeats of tolerance and cuts the stranded window to
> ~6 minutes."*

Shipped, with the pinned arithmetic reading the real constant rather than a
copy, so the next change updates deliberately.

**Companion UX, same ruling.** Past ~2 minutes — longer than the 66–82s a roll
actually takes — a still-casting tile says *"Taking longer than usual — this
refunds automatically if it can't finish"*. True, cheap, and it converts the
stranded window from broken to supervised: slow and dead look identical from a
caption that only ever says "Casting…".

**Recorded sharp edge this brings closer, not one it introduces:**
`startOperationHeartbeat` latches on its first failure and stops renewing for
good, so the grace after a heartbeat error is one lease rather than ten
heartbeats. At five minutes that window is smaller than it was. Worth fixing on
its own terms; not fixed here.


### D-86 — The post-M7 order, and Refine as a ratified feature *(founder ruling 2026-08-01)*

The order of everything after M7, settled in one pass so that no later milestone
has to be argued for on its own merits while the one before it is still warm:

> **Sign → Refine → Path B → Takes → invites open → Voice → Fantasy.**

Two things in that list are new, and one of them changes what M7 must build.

**Refine is a ratified feature, second in the order.** Pre-Sign candidate
refinement: a viewer with an instruction box, Nano Banana Pro reference-guided
edits, variants stacked inside the candidate card. Full spec at
`docs/specs/CASTING_V2_REFINEMENT_PROPOSAL.md` — written now, built at M8, and
nothing may be built from it before then. The short form of why it ranks second:
every refine is a deposit toward a Sign, and it moves identity decisions
upstream to where they are made against one cheap image rather than against a
built package.

Its load-bearing conditions, recorded here because they are rulings rather than
design detail:

- **The sheet always shows ONE face per slot.** The variant stack is
  viewer-only depth. Eight tiles that compare as characters is the product.
- **Base-anchored edits.** Variant N = edit(ORIGINAL, composed instructions
  1..N), never edit-of-edit; the original is immutable. A chain of edits is a
  chain of lossy re-renders, invisible per step and obvious at the end.
- **Eyes-only tier, and no validator pre-Sign.** There is no signed identity to
  preserve yet, so **Sign remains the only identity guarantee in the product**
  — a line defended in copy, not by a gate.
- **HARD CONDITION: the record round-trip ships with v1.** Every edit
  instruction round-trips through the interpreter to update the variant's
  persisted identity, under the golden-harness rules. This is the
  record-that-lies class minted in reverse: every prior instance was a value
  persisted but never composed into a prompt; this one would be a value
  composed into the picture but never written to the record. Same
  disagreement, other direction, and the class is expensive enough already.

**What this obliges M7 to do, and it is one line:** `castingV2.sign` reads the
candidate's **selected image key**, never `candidate.imageKey` as though a
candidate could only ever have one image. Today there is exactly one, so the
cost is a single indirection and no schema; when variants land, Sign signs the
face the user is actually looking at.

**Path B stays where it has always been** — the standing answer to every
"the category knows what the axes don't" finding (D-80's interim styling tier
says so in its own comments), with the legacy bombshell image as the
designed-face bar. **Voice (M8b) and Fantasy deliberately wait.** The one queue
item allowed to cut the line is the retention-confession UI, because it gates
real invites.

### D-87 — The unowned axis is now mechanizable; the registry is where it gets closed *(executor finding under the ratified M7 slice zero, advisor-reviewed, 2026-08-01)*

Recorded at the point the sweep was designed rather than after it ran, because
the finding is about the *method* and it arrived before the code did.

The unowned-axis collapse has been found five times, every time by the
founder's eye. Its tell is mechanical and the founder named it: **a resolved
value that is persisted but never composed into the prompt in the tier it was
resolved in.** Slice zero's registry turns that from a hand-written per-axis
check into a loop.

**The sweep found its sixth instance before it existed.** `Hair.family` is
drawn by `varyHair` from its own weighted list, persisted on every candidate's
`resolvedIdentity`, and **composed into nothing** — the composer reads
`hairStyle.family` (a different, independently drawn value) and `hair.colour`.
The two families routinely disagree, and a follow inherits the inert one
alongside a `hairStyle` that contradicts it. Write-only, and a record that lies
about hair on every sheet ever cast.

It is logged here rather than quietly repaired inside the refactor for the
reason D-81 gives: a finding folded silently into a large diff is a finding
nobody reviewed. **Slice zero is behavior-preserving; this is fixed as its own
named commit.** Where "behavior-preserving" and "sweep green" genuinely
conflict, the conflict is the slice's product, not its embarrassment — each
case is an individually-noted fix or a pinned known-gap, and never a quiet
weakening of the sweep.

### D-88 — Biology deference silences without nulling, and that is a record that lies *(Fable checkpoint-1 finding, 2026-08-01; FIXED with the D-79 re-ship by founder ruling)*

**Status: closed.** The founder ruled it rides the D-79 re-ship rather than
waiting — *"it's the same deference-record-truth change; biology tier admits
nulls there, not later"* — which is right: hair and biology are one doctrine and
splitting them would have left the registry excusing half of it. `RealizedAxes`
now admits nulls on `eyeColour`, `browStyle` and `skinCharacter`; the record
blanks what deference silenced; and the three `stated-*` suppressors are retired
from the registry, leaving the sweep's escape hatch holding only the honest kind
of exemption. The finding as originally written follows.

Found by the M7 slice-zero review, in the registry's own suppressor list.

**Hair deference nulls what it silences.** A brief that states its hair blanks
the cut, the texture, the components and the worn state in the persisted record
(`withHonestRecord`), so nothing is left to disagree with the prompt.

**Eye, brow and skin deference do not.** `describeRealizedAxes` skips the line
when the brief spoke about the axis, but the resolved value stays in the record.
So "a woman with green eyes" persists a fabricated `eyeColour` — dark brown, say
— beside a prompt that never mentioned eyes.

**Why it is worse than a passive lie.** A follow inherits the biology tier whole
— that is the ruling, and it is right, because eyes, brows and skin are the
followed *person*. So the fabrication travels; and if the follow's brief does
not repeat the eye words, the inherited fabrication **composes**, flipping the
followed face's eyes away from what the parent brief asked for.

**Why it was excused on the day it was found.** Nulling them needs
`RealizedAxes` to admit nulls on the biology tier, which is a record-shape
change beyond slice zero's behavior-preserving mandate. Queued then, ruled onto
the D-79 re-ship the same day, and closed there.

**Why it is written down loudly.** The argument for a closed, shared, named
suppressor list over per-axis `composesWhen` predicates was that a shared list
cannot be bent to excuse one axis quietly. Excusing three axes quietly would
have proved the opposite on the day the list was created. The three entries are
annotated as known-defect excuses in `axisRegistry.ts`, not as clean
suppressors.

### D-89 — The D-79 re-ship mechanism: the gate owns WHETHER, the interpreter only owns WHAT *(founder-ratified mechanism 2026-08-01; conditions amendment PARKED for the founder)*

D-79's ruling stands and its conditions stand. This records the **mechanism** the
re-ship uses, which the log did not previously carry, and the one safety rule
that makes it survivable.

**The mechanism.** Stated hair facts become **structured fields the composer
renders** — the `greyOverlay`/eye-colour pattern, the one path that survived the
rollback — never prose that must survive the interpreter. The reverted build gave
the model `hairSpoken`, a CLASSIFICATION; told to classify hair into a structured
field, it treated that field as the place hair now lived and stopped writing the
words at all.

**The safety rule, and it is the whole design:**

> **The code-owned raw-text gate is the authority on WHETHER a sub-axis was
> spoken. The interpreter is only the authority on WHAT was said.**

`briefStatesHair` reads the user's own sentence, which no model can corrupt. So:

- the composer **never authors a sub-axis the gate detects as spoken**;
- a gate-spoken sub-axis whose structured value is null **degrades to
  suppression, never to authoring**.

The consequence is the theorem worth having: **the worst possible interpreter
output reproduces today's shipped behaviour.** It can never reproduce the D-79
contradiction, because a contradiction requires authoring an axis the brief
stated, and the gate makes that unreachable. This is deterministic, so it is a
build test rather than a hope.

**Free text in a paid prompt, contained by a closed SOURCE rather than a closed
vocabulary.** "Pastel pink" is not in `HAIR_COLOURS`, and forcing it into the
enum would lose the user's own words, which is the point of the feature. Instead
every content token of a structured value must appear in the raw `briefText` —
so the model cannot put words into the SUBJECT block that the user did not type.
That one check closes hallucination, paraphrase drift and injection together.
The existing containment applies on top: caps, `scrubBrands`, garment rejection,
digit rejection, and drop-to-null on any failure — never fail the roll.

**Coverage stays all-or-nothing and needs no structured field at all.** There is
no cut on a bald man, so a coverage word suppresses the entire axis exactly as
today, and the user's words travel in prose as they already do. That is the
founding bug of the whole doctrine and it is left on the path that works.

**Stated hair is NOT a lock.** `LockFacts` excludes prose deliberately — a lock
has to be comparable, and `validateLocks` compares enum values across eight
candidates. "Pastel pink" is comparable to no `HairColour`. Stated hair is a
**deference fact**: it suppresses authoring and injects the user's phrase. It
gets its own derived view rather than widening the lock channel.

**CONDITIONS AMENDMENT — APPROVED (founder ruling, 2026-08-01).**

> *"Conditions serve their intent, not their letter."*

D-79's conditions 1 and 3 were written against the `hairSpoken`-classification
design, and the re-ship does not use it.

**Condition 1 is moot by design.** It required the interpreter prompt to state
that the structured field is a hint and the user's words must still appear in
`role`/`characterNotes`. The classification field it guarded no longer exists —
the gate reads the sentence, so nothing depends on prose surviving.

**Condition 3 is met in intent, more strongly than in letter.** Its intent was
*never again a suite that proves the layer above the broken one*. A build test
cannot call a paid provider, so the literal wording is unreachable; the
substitute tests the exact failure shapes that shipped last time — an
adversarial-stub suite driving the composer with a silent, all-null, junk,
string-shaped and hallucinating interpreter, plus the live golden driver. That
is a stronger instrument than the original wording, which would have been
satisfied by any test that happened to call the real decomposition once.

**Both substitutes are PERMANENT, not one-off gate-passes.** The stub suite
stays in the build gate. The live driver
(`scripts/drive-partial-deference.mts`) remains the bar for every future
interpreter-prompt change, which is already law for the golden harness and now
covers this too.

Condition 4 was unchanged and is met: all seven briefs verified live, 0 safety
failures across 21 samples, and the founder's own dogfood passed — pink 8/8,
silver-at-the-temples with eight distinct cuts, shaved 8/8, the goth's stated
length with colour varying. **`PARTIAL_DEFERENCE_ENABLED` is ON.**

### D-90 — Pool tendencies: three axes, and a deliberate fourth that will never exist *(founder ruling 2026-08-01/02)*

A casting category knows things about a pool the brief never states. Three axes
carry that, and one is refused on principle.

**The three:** `ageLean` (a streamer pool is young, a physical trade is
working-age), `facialHairLean` (three-valued — the lumberjack mirrors the idol,
and `any` is a lean toward RANGE rather than a shrug), and `heritageLean` (a
k-pop pool is predominantly East Asian). All soft: they re-weight, never lock,
never enter `LockFacts`, never reach the validator, never appear in the echo,
and can never make a value impossible.

**The boundary against the heritage-draw ruling, because they sit next to each
other and could be confused.** That ruling bans weighting the heritage draw to
fix a TASTE problem — *"cast fewer of X" is never the answer to a sheet you
dislike* — and it stands untouched. `heritageLean` is a different thing: a k-pop
idol pool really is predominantly East Asian, exactly as a streamer pool really
is young. Category-implied heritage is **pool demography**; the banned move is
**aesthetic-driven demographic tuning**. The test that separates them: would the
answer change if we simply liked the sheet better the other way? For demography
it would not.

Honest tails are therefore mandatory rather than decorative — five or six of
eight, never more. **Named limit, and it belongs on the F6 flag:** an honest
k-pop tail wants a SOUTHEAST ASIAN heritage row that the vocabulary does not
have. Until F6's researched workstream adds one, the tail draws from the general
cycle, which is wider than the truth rather than narrower — the safe direction,
and worth naming rather than quietly accepting.

**THE FOURTH, REFUSED: there is no `sexLean`, and there will not be one.**

"A clean-shaven lumberjack" alternated sex and produced women lumberjacks. That
is the design working, not a miss. Three reasons, and the first is the one that
decides it: occupational sex-skew is a **values call** dressed as a demographic
fact, and encoding it would make the product quietly assert who does which job.
Counter-stereotype casting is a product value rather than an accident we
tolerate. And a user who means a man types one — the affordance already exists,
costs one word, and is unambiguous.

Recorded as a deliberate non-feature so that the next person who notices the
"gap" finds the reasoning instead of filling it.

### D-91 — The expression floor yields its CENTRE to the direction *(founder ruling 2026-08-02, from the presence audit)*

Every sheet the product has ever cast shared one expression centre, and it was
in the cohort constant: *"the default is interested, not neutral — someone who
wants the job."* That block is appended LAST with override authority, so nothing
could outrank it. A biker gang leader came back eager. The direction block was
describing gravity into a prompt that had already decided the person was pleased
to be there.

**What stays absolute:** the mechanics. Mouth closed, lips together, no teeth,
no mid-laugh, no acted moment. Those are the comparability law — a sheet whose
subjects are photographed differently cannot be compared, and that is the whole
product.

**What yields:** the centre. When the DIRECTION block names a presence, that
presence governs, within the same closed-mouth bounds. Gravity, flint, cool
detachment and unimpressed all become expressible **without a mouth ever
opening**.

Per-tile disposition still varies around whatever centre is set, so the one warm
biker survives — a lean, never a lock, the same law the tendencies obey.

**Its companion, same audit:** `composedDirection` was emitting for aesthetic
REFERENCES only, by its own instruction — *"ONLY when the brief names an
aesthetic reference: a fashion house, a director, a film, a scene."* A k-pop
idol is a category, so the interpreter obeyed and emitted nothing, and the
sheet had no aesthetic at all. Live diagnosis confirmed it on six categories in
a row: kpop, drill sergeant, monk, biker gang leader, Viking — `composedDirection`
null on every one. The scope now includes **categories with a strong documented
aesthetic**, while ordinary occupations (skincare founder, nurse, accountant)
still earn nothing, because inventing an aesthetic for them narrows the sheet
for free.

And the direction grammar gains its **attitude half**: the thesis asks for face
AND BEARING, because bearing is half of an aesthetic and usually the missing
half — a house that commands the lens, a casting that is doe-eyed and slightly
awkward, the soft stage-charisma of an idol, the flint of a man who leads a gang.

**This also explains the Viking**, and it is a different fault from the one it
resembled. "An early 30s male Viking look" returned Nordic heritage, a beard
lean, and `composedDirection: null` — not because the aesthetic retry failed to
fire, but because the retry re-sampled against an instruction that forbade the
answer. The Wes Anderson golden's occasional miss IS the stochastic retry class;
the Viking's is not, and treating them as one would have produced a fix for the
wrong thing.

### D-92 — The Sign ceremony's crash-point table, and why its ordering inverts M4's *(Fable design review, 2026-08-02; recorded before the build)*

Written down before signService exists, because the money bugs live in the
ordering and a table is the only form in which that reasoning survives.

**M4's law, generalised.** The authority-creating write and the charge must be
ordered so the ambiguous middle state always resolves to *"refund in full"* or
*"owed nothing"*. For a ROLL, rows are not authority — they are cheap to fail —
so rows commit first and "rows but no ledger charge" means nothing was taken.
For SIGN the DB transaction **creates authority**: a Cast, and a consumed
candidate. An unpaid Cast is unacceptable, and undoing one means un-signing. So
the charge precedes the durable boundary, and everything between the charge and
that boundary must be fully compensable — money by refund, the storage copy by
cleanup. Both orderings serve one invariant: **authority exists ⟹ money was
taken.**

The adjudicator's fork variable is `casting_candidates.signedCastId`, never the
operation's still-unbound modelId.

| Crash after | Durable evidence | Verdict | Money |
|---|---|---|---|
| claim | claimed op, no charge, CAS null | free failure | none |
| running | running op, no `op:<id>:charge` row | free failure (with the late-deduct recheck) | none |
| deduct / copy | charge row, CAS null, no model | paid failure, candidate stays `ready` | **full refund** |
| mid-transaction | same (the txn is atomic) | same | same |
| txn commit, mid-package | CAS set, model `provisioning`, some slots committed | committed views stand; claim each uncommitted slot, then refund its slice; activate + bind + seal | promotion never refunded once the CAS is set |
| package terminal, pre-activation | CAS set, all slots terminal | activate + bind + seal, idempotently | none |
| activation, pre-receipt | model `active`, op non-terminal | recompute from the ledger, seal | none |

**Two failure modes the plan does not spell out, and they are the dangerous
ones.**

1. **Sweep-versus-live at the paid-failure point.** The sweep sees a stale
   `running` operation with the CAS unset, refunds the full Sign price — and
   then the stalled live process wakes and commits: a Cast created AND fully
   refunded. This is the claim-before-pay law in Sign's clothing. The defence is
   `evidenceFork`'s: the Sign transaction re-proves its own operation row
   `WHERE status='running'` FOR UPDATE and aborts if it is gone, and the sweep
   finalises the operation FIRST and refunds second, so the finalised status
   fences the live commit out. The same shape applies per-slot.
2. **The orphaned storage copy.** The copy can succeed before a crash, and
   nothing then references the key — the cleanup worker only deletes keys a row
   hands it. `evidenceFork`'s manifest pattern applies: register the destination
   key in a cleanup batch BEFORE the copy, delete the manifest inside the commit
   transaction.

**The double-Sign race charges twice by construction** when two distinct
`clientRequestId`s race, because idempotency is per request. The CAS loser must
take the paid-failure exit — full refund plus an honest refusal — and the race
test must assert **the loser's money**, not merely the winner's Cast.

**Migration 0018 records the REASON, not the refund.** `expiredReason` enum
(`cancelled_unseen` | `retention`) is written in the same statement as the
status at both write sites. "Was it refunded" already has an authority — the
ledger's unique reference index — and a second copy of that fact is a copy that
can be wrong. `unseenRefundedAt` was rejected for exactly that: it cannot be
written truthfully in one statement, because at landing time no refund exists
yet. **NULL means a pre-0018 row and the sweep leaves it alone**, which is the
fail-closed direction: declining to refund beats risking a double refund on data
whose meaning cannot be recovered. No backfill.

**View conformance is theatre unless it can fail.** Three independent axes —
identity against the anchor, angle as requested, wardrobe against the *spec*
rather than against the generation prompt — with parse failure or refusal
counting as failure, never as a default pass. It needs negative fixtures proving
each axis rejects, a forced-fail switch so the refusal path is testable
end-to-end, and the verdict persisted on the slot so a dispute is answerable
from the record. Prompt compliance as the sole check is the settled anti-pattern.

**Surfaced for the founder at the gate rather than decided here:** a permanently
failed view has no repair path until M12 — no per-slot purchase exists and "roll
again" does not apply to views. That is ratified rather than an oversight.

**FOUNDER RULING ON IT (2026-08-02): accepted knowingly, with one UX condition.**

> *"The room must meet it honestly too: a permanently failed slot confesses in
> place — 'this view didn't arrive — refunded; repairs come with revisions' —
> rather than shimmering or sitting blank. The confession is the interim repair
> path."*

Same law as every refund surface since the cancel rework: the honest answer to
a thing the product cannot yet do is to say so in place, at the moment and in
the spot where the user is looking for it. A shimmer promises arrival and a
blank promises nothing; both leave the user waiting for something that is never
coming, and both are worse than the sentence. **This is a gate condition on M7,
not a polish item** — the slot ships with its confession or the room is not
done.

### D-93 — A garbage render is a failure, and nobody is checking *(founder finding 2026-08-02; QUEUED before real invites)*

**The incident, recorded so it is not re-discovered:** on the k-pop verification,
roll 2 tile 01 came back as a **nine-face grid inside a single tile** — a
contact sheet where a portrait should be. It landed as a *successful* paid
candidate: `ready`, an image key, a charge, no refund, no detection, and no way
for the user to say otherwise short of discarding it and paying again.

**Why it matters more than it looks.** Every failure taxonomy in the roll domain
answers "did the provider fail". None answers "did the provider succeed at
producing garbage". A transport error, a content refusal and a capability
refusal all refund honestly; a returned image that is not a photograph of one
person refunds nothing, because nothing ever looks at it. That is the only class
of paid failure the product currently cannot see.

**The queued fix:** a cheap landing heuristic — face count and grid detection —
classifying a multi-face or tiled render as a **render failure**, routed into the
same taxonomy the provider classes already use, so it auto-fails and slice-refunds
with no new money path. Cheap deliberately: this is a smoke alarm, not a quality
judge, and a quality judge at the landing site would be the prompt-compliance
anti-pattern wearing a new hat.

**Sequencing: before real invites, after Sign.** The founder is the only user
today and can see and report one; a stranger cannot, and would simply have paid
for a contact sheet. Noted manually against that roll in the meantime.

**BUILT, MEASURED AND FLIPPED TO ENFORCING — 2026-08-03.**

Shipped first in shadow mode (classify, persist, alarm; never fail or refund),
then flipped on the number this ruling asked for.

**The measurement: a sweep of 1,017 real production candidates — the founder's
entire cast history, every brief he has ever run — fired exactly ONCE, with zero
false positives.** The single fire was this incident: roll index 2 of "a kpop
idol", tile 01. It was found BY the detector rather than by being told where to
look, after a hand-picked guess at the roll turned out to be the wrong one of two
sharing that brief. Better evidence than forward shadow traffic would have given,
because it is the whole back catalogue rather than a sample.

**The founder ruled the flip happens immediately rather than at invites**, and
the rationale belongs on the record: he is the only affectable user today, so a
misfire costs one 20-credit self-refund and produces exactly the evidence needed
to fix it, while waiting gains nothing and would mean the first stranger's
garbage tile arrives before the alarm is armed.

**Half of this ruling's letter was deliberately not built.** D-93 names "face
count and grid detection". Face counting means a vision model at the landing
site, which is the anti-pattern this ruling's own next sentence forbids — a
quality judge on the paid path, eight calls per roll, latency on every landing.
The shipped tier is grid detection only, deterministic and offline;
**multi-face-without-tile-seams is an explicit non-goal**, recorded rather than
silently dropped.

Two measurement failures on the way, both kept because they generalise:

1. **The detector was inert and looked fine.** It downsampled to 192px before
   measuring, which turns a 10px gutter into under two pixels and averages it
   into the faces either side — 0 of 8 synthesised grids. The rule it cost:
   **never blur the axis you are measuring along.**
2. **The discriminator excluded the case it was written for.** It asked "is
   there detail on both sides of this flat line", but these are portraits on
   seamless paper, so both sides of a gutter are plain backdrop. The real
   specimen said the signal is a STEP — seam rows at mean 249-251 against
   neighbours at 195-215.

**The first detector passed every synthetic test and called the real specimen
clean.** The genuine article is what caught it, and it is now committed as the
fixture (`docs/specs/references/nine-tile-sheet.png`) so the suite tests the
failure rather than a reconstruction. Recorded for accuracy: it is a 2x4 sheet
of EIGHT faces; this entry's prose says nine, written from memory in the moment.

Fail-open throughout and pinned by test: unreadable bytes deliver rather than
destroy. Invariant 7's refuse-on-missing-dependency posture is deliberately
inverted here — it governs security controls, where allowing is a breach; a
false positive here destroys an image the customer paid for, and the refund does
not give them the face back.

**The specimen's own 20 credits were refunded** under D-113's correction
precedent, in production, under the standing ceremony (ledger row #474,
reference `refund:correction:<charge ref>` in its own namespace, because a
failure refund's reference is the ledger's authority for "this candidate
failed" — and this one succeeded, at producing garbage).

**Also confirmed at the same pass:** glasses and jewelry are correctly absent
from dice output, per the stated-only rulings. The stated-eyewear check — "a
model in her 20s wearing chunky glasses" — rides the founder's next wildcard
roll, and it is a *drop-a-stated-fact* check rather than a feature: if the
framing constant's anti-prop language eats a stated accessory, that is a bug
today, not a future tier.

### D-94 — The never-zero law protects people, not grooming *(founder ruling 2026-08-02)*

The principled boundary the lean philosophy was missing, and it was missing in a
way that produced a real defect.

Every soft tendency was built on one rule: a lean re-weights, never locks, and
the excluded value always stays reachable. That rule is right, and the reason it
is right is **not** symmetry — it is that an excluded age or heritage is an
**existence claim**. A casting system that makes a fifty-year-old streamer
impossible has said something about who exists, and this product does not say
that.

**A silhouette is not a person.** A world's grooming register may genuinely rule
a cut out: idols do not have buzz cuts, and holding a floor of one there was the
principle misapplied — it kept putting buzz cuts on idol sheets in the name of
something that was never about hair.

So the split, recorded beside D-90:

- **Demographic leans — age, heritage — keep their floor of one.** They are
  claims about people, and the reachable tile is the whole ethic.
- **Styling exclusions at `defines` tier are TRUE exclusions.** They are claims
  about grooming, and a world may exclude a silhouette outright.

**Stated cuts override absolutely, as ever.** Deference outranks every tendency,
so "a k-pop idol with a shaved head" renders exactly as written and the pool's
opinion is never consulted. And an exclusion that would empty a candidate's
whole shelf is discarded rather than obeyed — the exclusion is wrong in that
case, not the shelf.

### D-95 — Stated-only is worth nothing if stated does not work *(founder verification 2026-08-02)*

"A model in her 20s wearing chunky glasses" rendered **zero glasses**. The cause
was in the cohort constant itself: its no-accessories clause, plus the AUTHORITY
paragraph's instruction to ignore implied props, were overruling words the user
had actually typed.

Both clauses are correct about UNSTATED accessories — the frame is a plain grey
tee on seamless paper, and a prop nobody asked for is exactly what the framing
law exists to keep out. Neither was ever meant to apply to a stated fact.

**This is the drop-a-stated-fact class arriving through the CONSTANT** rather
than through the interpreter, which is a place it had not been found before —
worth naming, because every previous instance was upstream and the constant has
override authority over everything above it by design.

It also quietly emptied a ratified product rule. Eyewear and jewelry are
**stated-only**; stated-only means nothing at all if stated does not work.

The fix mirrors the STRUCTURAL FEATURES licence in the same constant, which
exists for precisely this reason and after precisely this evidence (a named
broken nose rendering as an intact handsome face): a named worn accessory
renders plainly, and **a failure to appear is a failed candidate**. It licenses
nothing else — props, held objects, headwear and scene stay forbidden, and the
clause says so rather than leaving it to be inferred. Unstated accessories are
banned exactly as before.

Nothing enters the echo: an accessory neither varies across the eight nor pins
an identity axis, and the echo speaks locks.

---

### D-96 — Sign's fence: what "finalise first, refund second" has to mean *(executor decision, Fable-reviewed, 2026-08-02; refines D-92)*

D-92 says the recovery sweep must "finalise the operation FIRST and refund
second, so the finalised status fences the live commit out". Building it exposed
that the literal reading is impossible AND dishonest, and the honest form is one
step away.

**Why the literal reading fails.** Every terminal finalizer in
`server/db/generationOperations.ts` gates on `status='running'` and takes
`chargedCredits`/`refundedCredits` at write time. Sealing before the refund
means sealing a receipt that claims 500 credits moved back before they have —
and nothing ever revisits a terminal receipt to correct it. The roll adjudicator
avoids this by refunding first and sealing after, which is exactly what Sign
cannot do: refunding first is how a Cast ends up existing AND fully refunded.

**The resolution.** The ruling's intent is *leave `running` before touching the
money*, and a non-terminal state that satisfies it already exists.
`fenceCastingV2SignOperationIn` moves the operation to **`recovery_required`**
inside the same transaction that reads the fork variable, before a credit is
touched. From that moment the live Sign transaction's `FOR UPDATE` re-prove
finds it gone and rolls back. The true totals are sealed afterwards by a new
narrow finalizer gated on `status='recovery_required' AND kind='castingV2.sign'`
— narrow because widening an existing finalizer would let any recovery path in
the repo seal an operation it had proved nothing about.

Three consequences, each of which is a control rather than a note:

1. **The fenced state is swept.** Nothing else in the recovery sweep looks at
   `recovery_required`, so a crash between the fence and the seal would park a
   Cast half-settled for ever. The sweep's selection now includes
   `recovery_required` **for this kind only**; re-adjudication is idempotent
   because the verdict is a pure function of (candidate CAS, ledger).
2. **The fenced finalizer binds `modelId` itself.** `bindGenerationOperationModel`
   gates on `running` too, so after the fence it would silently do nothing — a
   control not on the path. A Sign that crashed mid-package has a Cast whose
   operation was never bound, and the receipt is the last place that link can
   be recorded.
3. **Per-slot commits re-prove the operation, not just the model.** `models.status
   = 'provisioning'` is NOT a fence against the sweep: the model stays
   provisioning throughout recovery. Without the operation predicate, a stalled
   generation could commit a slot the sweep had already refunded — delivered AND
   refunded, per view. The provisioning predicate fences post-activation
   stragglers; the operation predicate fences the sweep.

### D-97 — The headshot slot always fills, and the refund says why *(executor decision, 2026-08-02)*

`buildEffectiveCastState` refuses a package with no `frontClose` selection
(`displayed_headshot_missing`). The package's six views are generated, so if the
2K headshot re-render were the only thing that could fill that slot, **one
provider failure would produce a Cast the snapshot authority cannot read** — an
invariant broken by weather.

So activation fills `frontClose` from the **1K anchor** when no 2K headshot
landed. The anchor is a real filled `frontClose` asset — it is the face the
customer signed — and newest-filled selection means it is chosen only in that
fallback case.

The money stays honest and the room says so in place: the failed 2K view refunds
its 50 credits like any other, and the headshot slot carries its own sentence —
*"Shown at the resolution you signed — the larger version didn't arrive;
refunded"* — rather than the confession used for a genuinely empty slot. This is
not "refunded and delivered": what the customer keeps is the candidate image
they had already paid for on the sheet, and what was refunded is the re-render
that never happened.

The anchor is stamped `identityRole: 'anchor'` and every generated view
`display`, so the anchor selector keeps choosing the signed original after the
2K headshot lands. Without that stamp the newest `frontClose` silently becomes
the identity anchor and every later identity operation compounds its drift from
a generated copy.

### D-98 — No validator, no Sign *(executor decision, 2026-08-02)*

`CASTING_V2_SCOPE` already refuses to enable without the cleanup worker and the
image transport. Sign adds a third dependency with the same shape:
`OPENROUTER_API_KEY`, which is the view-conformance judge's transport.

Unconfigured, nothing crashes — which is the problem. Every Sign would charge
500, fail all six views closed (§I: where no trustworthy verifier exists, refuse
rather than pass), refund 300, and hand the customer an empty package, with the
money technically correct throughout. The boot guard refuses instead, which is
invariant 7 applied to a dependency rather than to a call site.

---

### D-99 — Package v2: five views, and what a reconstruction actually needs *(founder ruling 2026-08-02, after the first two real Signs)*

Amends §H.10's price and D-44's walk-as-sixth-slot, for the V2 profile only.

**The package becomes five:** close-up portrait (NEW), three-quarter, full
front, side profile, full back. **Sign reprices to 200 + 5 × 50 = 450.**

**Why the headshot went.** The founder's first signed Cast proved the old
`frontClose` spec — a waist-up head-and-shoulders — merely duplicated the
anchor's own crop. The package contained no view of the face at detail scale,
which is the single most useful reference a downstream generator can be handed.
The slot keeps its canonical name and gets a new spec: a tight close-up, framed
from above the hairline to below the chin, at 2K, where skin texture and iris
detail resolve. It is both the identity-detail reference and the showpiece.

**Why the walk went.** Motion belongs to Takes. It was costing a slot that a
reconstruction needs more.

**The reasoning, recorded because it is the reusable part:** a generator
rebuilding a person from three-to-five references needs **close-up** (detail),
**front** (proportions), **profile** (bone structure) and **back** (hair mass,
and the garment surface VTO works on). **Three-quarter** stays for the comp-card
deliverable rather than for reconstruction.

**No migration.** A profile is policy: it chooses from the canonical angles
rather than inventing one, so `modelAssets.viewType` is untouched. Three
consequences were handled rather than discovered:

1. **A package is a historical record.** The two Casts signed under six views
   keep showing six. The room renders each Cast's OWN slots — its promise and
   its evidence — never today's profile, or a deploy would have deleted a paid
   view from someone's room.
2. **Recovery settles what was BOUGHT.** The refund work-list now comes from
   the per-view audit rows the Sign opened, written before any generation.
   Deriving it from the profile constant would have left a six-view Sign, swept
   by five-view code, with its walk charged and never refunded — silently. Where
   no rows exist, the promise is cross-checked against `plannedCredits` and a
   disagreement parks for a human rather than guessing.
3. **The close-up's wardrobe axis got its own sentence.** At that crop the
   garment is often out of frame, and the judge is told to fail what it is
   unsure of — the shared sentence would have refunded views for being hard to
   see. Its sentence makes "nothing visible" a stated pass and points the axis
   at what a close-up can really show: earrings, glasses, a collar logo, things
   added to a face that the reference never had.

### D-100 — A user-visible surface triggers the UI completion contract, whatever the milestone was about *(founder ruling 2026-08-02)*

> *"Any milestone that ships a user-visible surface triggers the UI completion
> contract — evidence pack, prototype side-by-sides in both themes, copy audit,
> Fable skim — before founder dogfood, regardless of the milestone's primary
> character."*

M7 is the case that produced the ruling. It was a money milestone, reviewed
adversarially as one, and its money passed its gate on the first real Sign. Its
*surfaces* were never held to the contract at all — so Sign shipped as quiet
text under a tile the founder could not find on his own product, and a signed
Cast was reachable from nowhere.

The failure mode is specific and worth naming: a milestone whose primary
character is not UI will produce UI anyway, and nobody thinks to run the UI
process on it. "Regardless of the milestone's primary character" is the whole
ruling.

**M7 owes the pack retroactively**, produced with the package-v2 batch and
covering the surfaces it already shipped — the Sign affordance, the sheet's
tile states and the room — not merely the new diffs.

---

### D-101 — The UI-drift prevention law: render the drawing, or the reconciliation did not happen *(founder ruling 2026-08-02)*

The room shipped with the right parts list and an invented design. It was built
from prose descriptions of the prototype's markup — with the styles stripped
out — so every module was *named* and none was *seen*: an oversized collage, a
detached identity bar, the refine bar flattened to a paragraph, the Takes
section absent entirely, the right-hand cards reduced to sentences.

**Descriptions of a drawing are not the drawing.**

The evidence pack did not catch it because the pack had no side-by-sides, which
is the one thing that makes it a pack rather than a screenshot folder.

**Five gates. Four before the code, one after.**

1. **Render-first.** No UI code is written until the binding prototype screen
   has been rendered in a browser and screenshotted. The headless-Edge drive
   renders `docs/specs/Casting-ui-ux-design/design_handoff_studio/` directly.
2. **Pre-build reconciliation table.** From that render, a per-element table —
   drawn element → planned build → deviation with its ratified ruling cited —
   posted for a skim before building. **A deviation without a citation does not
   get built.** Geometry is measured off the DOM, not estimated by eye.
3. **Paint before plumbing.** On any new surface, static markup is screenshotted
   for a founder eyeball before it is wired to anything.
4. **Anatomy tests.** Every reconciled surface carries a structure assertion
   that its drawn elements exist, alongside the existing law checks. Existence,
   not geometry — a whole module quietly not being built is the failure this
   catches; pixel pinning would only make honest refinement fail.
5. **The evidence pack remains the exit gate** — prototype-left, build-right,
   both themes, every screen. That is what "side-by-side" means. No UI batch
   ships without renders of the binding.

The first four are entry gates, and their purpose is to make the fifth boring.

Recorded artefacts for the room: `docs/specs/CASTING_V2_ROOM_RECONCILIATION.md`
(the measured table) and `client/src/features/castingV2/roomAnatomy.test.ts`
(the structure assertion).

---

## D-102 — A legacy authority meeting a V2 snapshot widens or refuses. It never filters.

**Ruling (2026-08-02), after the first paid package-v3 Sign.**

Package v3 added a true `closeUp`. It was deliberately kept OUT of
`CANONICAL_VIEW_ANGLES`, because six modules correctly assert the comp card is
exactly six — the PDF has six cells, the export six filenames, ink placement six
zones. `CastViewAngle = CanonicalViewAngle | "closeUp"` carried the wider
vocabulary instead.

That was the right boundary and the wrong enforcement. **A filter or a loop
typechecks identically against either list**, so nine read sites kept narrowing
to the six, and the compiler had nothing to say. The paid run showed the cost:
the close-up was planned, generated, charged, judged and refunded — and then
dropped between the database and the screen. Every individual record was
correct. The customer simply never saw the view they paid for.

Two of the nine were worse than cosmetic, and neither was reachable from the
failed run:

- `promisedPackageAngles` is the RECOVERY REFUND WORK-LIST. Reading the durable
  promise back through the six is the deploy-collision landmine wearing a
  different coat: a v3 Sign swept by recovery would have refunded four slices of
  five, leaving the customer 50 credits down with nothing to show.
- `effectiveCastState` refused any snapshot holding a close-up
  (`slot_angle_invalid`). Because every view failed, the run never sealed one.
  **The first SUCCESSFUL v3 Sign would have bricked ink, evidence, export and
  restore for exactly the Casts whose packages worked** — and
  `wholeCastRestore` would have left such a Cast with no restore point at all,
  making its deletion unrecoverable.

**The law.** A legacy authority that meets a V2 snapshot has two honest moves:

1. **Widen**, when its job is reading what a Cast actually has. That is right
   for `effectiveCastState`, `snapshotTransitions` and `wholeCastRestore` — the
   ledger legitimately holds a close-up and they exist to read the ledger.
2. **Refuse by name**, when it genuinely cannot represent the view.

It may never silently filter. Where a legacy artifact really does need the six —
the PDF, the export, ink placement, minting — it calls `compCardViews(state)`,
whose RETURN TYPE is narrowed, so a comp-card builder cannot be handed a
close-up by accident; it would not compile. The narrowing is stated once, in one
place, with its reason attached.

**Enforcement, because fixing nine sites does nothing about the tenth.**
`server/castingV2/viewVocabulary.test.ts` fails CI if any module under
`server/castingV2/` so much as names `CANONICAL_VIEW_ANGLES` or
`CanonicalViewAngle` outside a pinned exception list, and pins that the three
legacy authorities read `CAST_VIEW_ANGLES`. The wrong list now fails the build
even where it compiles. Prefer `Record<CastViewAngle, T>` over lists at any new
site that enumerates views: a Record fails to compile when the union grows,
an array never does.

---

## D-103 — Zero of N refunds everything, base included. The Cast survives.

**Founder ruling (2026-08-02),** after the first paid package-v3 Sign delivered
nothing because our OpenRouter balance had run out.

Sign charges 200 for promotion plus 50 per view. The promotion buys permanence:
the anchor is rescued from the sheet's purge, the identity is sealed, the Cast
is repairable. **That story is true, and it survives a PARTIAL package** — the
customer has views in hand and a Cast to keep them in. It does not survive a
total loss. Nobody came here to buy the preservation of a face they had already
paid for on the sheet.

Zero-of-N is only reachable through systemic failure: an exhausted provider
account, a transport outage, a judge that cannot be reached. Never through
ordinary stochastic misses — those lose a view or two, not five. Retaining the
base there charges the customer for OUR outage, which is exactly what the
confession law forbids.

**The ruling.**

- **Zero committed views ⟹ the whole price returns, base included.** Under its
  own derived reference (`<charge>:promotion`), so the live path and the
  recovery adjudicator produce byte-identical references and a second settlement
  is a duplicate rather than a second payment.
- **The Cast survives** as a master-only signed identity. She keeps the face she
  chose. A Cast she cannot open is not a kinder outcome than one that explains
  itself.
- **The room confesses once, at the top** (`TOTAL_LOSS_CONFESSION`), not five
  times in the strip: nothing arrived, everything came back including the Sign
  itself, the views are rebuildable when repairs ship. Derived on the server
  from the Cast's own evidence, so what the room says and what the ledger did
  cannot drift.
- **Partial failures are unchanged.** The base stays. Pinned by its own test,
  because this is the half most likely to drift.
- **A total loss raises the roll alarm's shape** — "stop, look at the plumbing",
  not "what was wrong with this Cast".

**What it does to the invariant.** D-92's *authority exists ⟹ money was taken*
is operationally an anti-race law: it exists so a Cast cannot be created and
fully refunded by two writers disagreeing. The rule it states becomes

> promotion is retained ⟺ the candidate CAS is set **and at least one view
> committed**

and both halves are recomputable from durable rows alone — the CAS from the
candidate, the committed views from the 2K asset rows
(`committedPackageAngles`). That is the property that matters: the adjudicator
reaches the same verdict as the live orchestrator after the process that built
the package is dead. No race is reopened, because the refund is deliberate,
written at finalization, and idempotent by reference.

**A fenced writer never invokes it.** Losing the fence does not mean the views
failed — it means this process is no longer the authority on what happened to
them. Its "nothing committed" is an opinion, not a fact, and acting on it would
be a fenced writer spending money.

### The companion fix: 402 is out of funds, not unreachable

The outage that produced this ruling recorded itself as *"the conformance judge
could not be reached"*. It was a 402. `provider_account` already existed for
precisely this — split out of `capability` when an exhausted fal balance cost
three rounds of the M5 gate — but the OpenRouter classifiers never mapped 402 at
all, so it fell through to `unknown`.

402 (balance) and 401/403 (key) now classify as `provider_account` on both
OpenRouter transports, and the conformance judge records `our judging account is
out of funds` with the account alarm. Pinned in `providerContract.test.ts`,
beside the fal case that taught the lesson the first time.

---

## D-104 — Identity anchors WHO. Takes re-enter as STYLE.

**Founder ruling (2026-08-02), recorded for campaigns / M8.** Nothing is built
against this yet; it is written down now because it settles a question that will
otherwise be answered by whoever writes the campaign generator first.

A Cast carries two different kinds of truth and they must not be confused:

- **The identity pack** — the signed anchor and the package views — answers
  **who she is**. It is the thing the conformance validator guards and the thing
  M12 revisions change.
- **A take** answers **how she looked that time**: outfit, styling, light,
  setting. It is a moment, not a fact about her.

**Campaign generation therefore feeds two inputs: the identity pack, plus a
SELECTED TAKE used as a style reference** — the take supplies outfit and styling
continuity across a campaign's images without ever being asked to supply the
face. That is what makes "the same person, in the same jacket, across nine
frames" expressible without minting a second identity for the jacket.

**A take is never a permanent change.** If a customer wants the new hair, the
new wardrobe, the different age to become *what she is*, that is an **M12
revision** — a change to the identity pack, validated, versioned and paid for as
such. A take that quietly became canonical would be the record-lies class in its
most expensive form: the pack says one person and every future generation
renders another.

**The choice surfaces in the UI when M12 ships**, and not before. Until
revisions exist there is nothing to choose between, and offering the choice
early would be an honest-capability violation — a control that names a
capability the product does not have.

**Consequence for the character-sheet artifact:** it composes from the identity
pack only. A take must never be composited into it, for the same reason a take
is not a revision.

---

## D-105 — One interaction grammar for images. Download amends D-52's letter.

**Founder ruling (2026-08-02), product-wide, no exceptions.**

> click opens the viewer · ← → walk the set · Esc closes · download lives in
> the viewer chrome

Hero and thumbnail alike. **The expand icon is removed everywhere** — an icon
whose only job is to do what clicking the picture already does is furniture, and
it was also the only thing announcing that a picture could be opened at all,
which meant the affordance was hidden behind the icon rather than carried by the
image. Every media frame is now a real `<button>`: a tab stop with a name.

**No hover-revealed download anywhere.** It failed twice over — a control you
must hover to discover is a control most people never find, and a permanent row
of file chrome over someone's face turns a room into a file manager.

**Sheet candidates are included**, by founder ruling: *they own what they
generated*. "A customer's cast is their work" (2026-07-25) extends to the
candidates they paid 20 credits a face for. No access control changes — those
objects already sit at persistently public URLs (`server/storage.ts`) — only the
product's posture, which was previously silence.

**The room additionally gets an explicit "Download package" button** — a real
control in the package head, not hover chrome — as the bulk-ownership
affordance. Deliberately not a server-side archive: it is a staggered sequence
of the same public URLs the viewer already serves, so the control adds an
affordance and no attack surface. **The character-sheet artifact joins it there
when it ships**, as the single-file form of the same idea.

### The D-52 amendment

D-52 made the canvas viewer **view-only** because it exposed EDITING affordances
outside the edit ceremony. Download neither spends, destroys nor edits — it
hands the owner bytes they already own and already paid for. So the *reason*
stands untouched and the *letter* is amended: the viewer may carry download, and
nothing else. Keep, Discard and Sign stay on the tile, where the surrounding
context is.

**No retention warning accompanies it.** Download is the REMEDY for the seven-day
purge, not its victim — handing the owner the bytes is precisely how a face
outlives §G.6. The retention confession already has one ratified home and tone
(`retentionCopy.ts`), and repeating it under a download button would be the same
sentence, off-tone, in the wrong place.

### Enforcement

`client/src/features/castingV2/imageGrammar.test.ts` scans every casting source
and fails CI on a `download=` attribute outside the viewer (and the room's one
named bulk helper), on any `Maximize` import, on `onDoubleClick`, and on a
viewer that has lost any of its four bindings. `CandidateTile` takes a
**required** `onOpenViewer`, so a tile that forgets the grammar fails to
compile. The viewer takes the **set**, not a frame — the three call sites had
grown three near-identical modulo walks, which was the drift already happening.

### Companion: a sibling tile navigates by state

Also founder-ruled the same day. A sibling who was signed opens **her room**; one
still a face opens **her sheet, focused on her tile** (`?focus=<candidateId>`,
landing on the kept tray, which is cross-roll and therefore always holds her).
The viewer stops being their only destination.

**A sibling tile is an object card, not a media frame** — the image grammar
governs pictures of *this* Cast; a card standing for another person goes to that
person.

**The third case is the one only the server knows.** §G.6's retention exemption
protects a signed Cast's kept siblings — the rows and the objects — but it does
not hold their SESSION open. So the faces can outlive the sheet they lived on,
and a client assuming "unsigned means sheet" would hand out a dead link. The
projection therefore derives `destination: "cast" | "sheet" | "viewer"` and a
top-level `sheetOpen`, and the room's "Open the sheet she came from" is offered
only while there is a sheet to open.

---

## D-106 — Package v3.1. The composition is final.

**Founder ruling (2026-08-02).** This ends the package saga.

    Master · Close-up · Three-quarter · Full front · Side profile · Full back

**The three-quarter returns; the Portrait retires.** Five generated views,
price unchanged at 450.

**The reasoning, on the record.** v3 carried `frontClose` ("Portrait") alongside
the Master and the close-up — **three frontal crops, one too many.** The Master
already shows her chest-up and square to camera, so a Portrait beside it was the
same rung of the zoom ladder climbed twice. 45° was the genuinely missing
viewpoint and the one downstream generation asks for most. Read as angles, the
package is now a clean **0° / 45° / 90° / 180° turnaround plus the detail shot**.

**Historical record, as ever.** "Package Three" keeps her Portrait forever.
Every Cast renders its own slots from its own durable promise, which is what
makes a mixed roster legal by construction (D-102). Nothing is retroactive.

### The close-up is a BAND

Founder's final framing, from two supplied references:

- **tight bound** — brow-to-chin
- **loose bound** — forehead-to-chin
- chin and both eyes always present; crown may crop; hair may frame the edges;
  front-on

**Written as landmark predicates, not proportions**, because that is the
difference between a check and a shrug. A vision judge answers "is the chin
inside the frame" and "are the shoulders in frame" reliably; it answers "does
the face fill 80% of the height" badly. So *too tight* is a **cut required
landmark** — the margin of skin below the chin is what a too-tight crop destroys
first — and *too loose* is a **present forbidden landmark**: shoulders, or
headroom above the hair. Both are yes-or-no by looking, which is also what makes
§I's fail-closed default work for us instead of against us.

**The directive aims mid-band.** v3's directive commanded "to just below the
lower lip"; shipped beside this spec, every close-up would have failed its own
conformance check by construction and refunded the customer for our
contradiction. That is the maiden-voyage wardrobe defect exactly, and it does
not get to happen twice.

### The hero shows her as a person, from three angles

Master large, **three-quarter and side profile** in the two companion cells. The
close-up was the wrong companion — a face macro next to a chest-up frame is one
view at two zooms. It lives one click away, in the strip and the viewer, which
is where someone goes when detail is what they came for.

### Two consequences that had to be fixed with it

**The anchor no longer conjures a slot.** `castProjection` counted
`entry.anchor` as evidence that a view existed. With `frontClose` unpromised,
that would have drawn a "Portrait" tile out of the Master's own pixels and stood
the two side by side. A landed 2K view or a failure marker each prove a slot was
bought; the 1K anchor proves only that she was signed. Verified against every
historical shape, and against the database: **no signed Cast lacks its durable
promise**, so none loses a tile.

**The recovery receipt counted slots, not views.** `activateSignedCast` seals a
`frontClose` slot from the anchor to satisfy D-97, so recovery reported **six
views on a five-view Sign** — on the one document support reads when something
has gone wrong. Now intersected with the Sign's own promise. The live path was
never wrong; only recovery read the slots.

### And the wardrobe defect, found a second time

The v3.1 verification lost its full-back view to *"dark leather dress shoes
instead of plain neutral shoes, and trousers with visible stitch detailing not
specified as plain."* **The anchor is a chest-up photograph.** It shows no
trousers and no shoes, so there was nothing to compare against and the judge was
left adjudicating our own adjective "plain" against its own taste. The customer
paid 50 credits for the ambiguity.

**An axis told to fail when unsure must never be pointed at something the
reference cannot establish.** The judged spec now names its own limits: compare
what both images show, and treat additions as failures wherever they appear. The
garment instruction moved into the three full-length **directives**, which the
generator reads and the judge never sees — the trousers are still asked for,
they simply stop being grounds for a refund nobody could have earned.

The trap worth recording: `spec.wardrobe` is read by BOTH the judge and the
generator (`composePackageViewPrompt`). Scoping it for the judge alone would
have quietly stopped asking for trousers at all — a fix creating a worse defect
than the one it closed.

---

## D-107 — Deletion purges what only the deleted thing owns.

**Founder ruling (2026-08-02).** §G.6 said *"purge source roll lineage"*, and
that sentence was written when one sheet made one Cast. Two Casts can be signed
from one sheet, and they share everything behind them: the session, the rolls,
and each other's kept faces as Siblings-card content.

> **Deletion purges what only the deleted thing owns, and preserves what
> anything living still owns.**

Applied:

| | |
|---|---|
| **goes** | her Cast-owned objects, and her candidate's signed linkage |
| **goes** | every other candidate on that sheet that no living Cast claims |
| **stays** | the session and its rolls — shared history |
| **stays** | any candidate a surviving Cast still claims as a sibling |

**The lineage purge runs only when nothing living references it.**

**Liveness is `deletedAt IS NULL`, never `availableModelWhere()`.** A sibling
Cast whose package is still building is `provisioning`, which that helper
excludes — counting her as dead would purge the faces her room is about to show.

**Order matters.** The deleted Cast's `signedCastId` is cleared FIRST. While it
still points at the model, her candidate reads as "signed" to every protection
downstream, including the release statement's own guard, so her own face would
be the one thing deletion could not release.

**Concurrency.** The purge takes the session row `FOR UPDATE` — the same
serialization point `signCandidateIntoCast` takes. A Sign racing a deletion
either committed first, and is visible to the liveness test, or waits behind it
and finds its candidate no longer `ready`, failing cleanly with its money
refunded.

**One authority, extended — never a second path.** The purge runs INSIDE
`executeFinalCastDeletion`'s transaction (D-64's manifests, tombstones and
bounded worker purge). A follow-on step would be the parallel deletion path the
ruling forbids, and would also sit outside the manifest boundary that function
enforces. A legacy Cast has no candidate and passes through untouched.

Rows are moved to `expired` and the existing retention purge feed hands their
keys to the cleanup worker — one vocabulary for "this candidate is releasable",
not two. `castingSessions.signedCastCount` is deliberately **not** decremented:
it is a display counter, and every liveness question is asked of
`casting_candidates.signedCastId` against a living model.

### The bug the audit found first — and it was the opposite of the fear

The founder asked whether sheet deletion hard-deletes signed rows today. **It
does not, and never could:** signed candidates and kept siblings are protected
in `expireSessionCandidates`'s `WHERE` *and* again in `deleteCandidateRowsIn`'s
`WHERE`. There was no data-loss hazard.

**The hazard was inverted — a purge the user asked for that never happened.**
`abandonCastingSession` wrote `status = 'abandoned'` and stopped; the sweep's
`listExpiredSessions` selected `status = 'open'` past expiry. So a sheet the
user deleted was never swept: its candidates stayed `ready`,
`listPurgeableCandidates` requires `expired`, and the objects lived in the
bucket forever. **Both the db helper's and the route's doc comments claimed the
downstream machinery ran.** That is how it survived review — invariant 7, in the
two places that promised it was fine.

**Fixed by running the release inline**, in the same transaction as the status
change, sharing `expireSessionCandidatesIn` with the sweep so the §G.6
carve-outs cannot drift between callers. Deliberately NOT by widening the sweep,
which is wrong twice: an abandoned sheet's `expiresAt` is whatever the last
activity set, so the purge would be deferred up to seven days after the user
asked for it; and nothing transitions `abandoned`, so the sweep would re-select
every abandoned sheet on every tick forever, eventually crowding real expiries
out of its own row limit.

`abandoned` stays a **distinct terminal status**: that row is the only record of
whether the user deleted this sheet or it aged out, and support answers those
two questions differently.

### The sibling's third destination

Confirmed from the polish round: where a sibling's sheet has expired or been
deleted, the viewer is her destination and it says why — *"From a sheet that has
expired or was deleted — she remains as a sibling of [name]."* §G.6 is the
reason she is still there at all, and saying so is the difference between a dead
end and an explanation.

---

## D-108 — Two permanent laws from the v3.1 close, and one field for one fact

**Founder ruling (2026-08-02), closing M7.**

### The landmark law

**A vision judge is asked for landmarks, never for proportions.** It answers
*"is the chin inside the frame"* and *"are the shoulders in frame"* reliably;
it answers *"does the face fill 80% of the height"* badly, and a spec written in
proportions gets a shrug dressed as a verdict.

So a two-sided constraint is written as two landmark predicates and two named
failure directions — one **cut required landmark** for too-tight, one **present
forbidden landmark** for too-loose. Both are yes-or-no by looking, which is also
what makes §I's fail-closed default work for us rather than against us.

### The judged-spec limits law

**An axis told to fail-when-unsure is never pointed at something the reference
cannot establish.**

Found twice. The maiden voyage lost a view to "mid-grey vs off-white"; the v3.1
verification lost its full back to *"dark leather dress shoes instead of plain
neutral shoes"* — against a chest-up anchor that shows no shoes at all. Both
times the judge was left adjudicating our own adjective against its own taste,
and the customer paid for the ambiguity.

The judged spec therefore names its own limits, and instructions the judge must
not police move to the `directive`, which the generator reads and the judge
never sees. **The trap:** `spec.wardrobe` is read by BOTH, so scoping it for the
judge alone would quietly stop asking the generator for the garment — a fix
creating a worse defect than the one it closed.

### One field for one fact — the judge cannot contradict itself

The v3.1 Sign produced the specimen: a side profile came back `pass: false`
beside the note *"overall it satisfies the 90-degree side profile
requirement."* A passing sentence attached to a failing boolean. The customer
was refunded 50 credits for a correct view, and the record contained its own
contradiction.

**Two fields for one fact is two facts that can disagree** — the drift class
every record-truth fix this month has killed. Killed the same way: the model now
answers with a single `verdict` of `matches` / `differs` / `unsure`, and `pass`
is DERIVED from it. The note explains and has no authority; a note that
disagrees is a badly-written sentence, not a second opinion the code must
arbitrate. The old shape no longer parses, so a reply carrying a bare boolean
fails closed rather than being read as an authority.

`unsure` is explicit rather than inferred, because fail-closed is only honest if
the judge can SAY it could not tell instead of being forced to pick a side and
hedge in prose.

### The tripwire

Two dev rows appeared both `signed` to a living Cast and `expired` — a state
every writer forbids in the WHERE of the statement that writes. Today's code
provably cannot produce it, and *"it cannot happen any more"* without a tripwire
is how it happens again silently. `checkCandidateInvariants` runs before each
retention sweep (before, so it is never checking the sweep's own output),
alarms in the roll alarm's shape, and **repairs nothing** — a row in a forbidden
state is evidence, and tidying it away would destroy the only trace of whatever
wrote it.

### Pronouns come from the record

The room called every Cast "she"; Jericho is male. Derived server-side from
`technicalSchema` and projected as three words — pronouns are not identity
documents, the record they came from is (2026-07-25). `they` is the fallback for
an unstated sex, and the correct English for a person whose pronouns you do not
know. All three conjugations are tested for all three cases, because the bug was
not "the wrong word" but "one word everywhere".

### Two smaller grammar corrections

**The magnifier goes.** `zoom-in` promises a zoom the viewer does not perform —
it opens the picture rather than magnifying in place. `cursor: pointer` is the
standard clickability signal, invisible through familiarity, and makes no claim
the surface does not keep. It carries the affordance alone; no hover treatment
is needed beside it.

**The viewer closes on anything that is not the picture or the chrome.**
`target === currentTarget` only closed on the scrim itself, so the figure's
padding and the caption's whitespace swallowed the click and the dialog felt
stuck for a reason nothing on screen explained.

---

## D-109 — Where a price lives. D-15's display doctrine.

**Founder ruling (2026-08-03), third and final pricing iteration.**

D-15 says the client never carries a hardcoded price — it is always
server-derived. That settled where a number comes FROM and left open where it
GOES, and the answer drifted three times: prices on every tile, then prices on
every button, then a mix. This is the rule that ends it.

> **The price lives where the commitment happens. Cost is metadata, never button
> text.**

### Immediate-fire actions — Roll again, Cast it, Follow

**The button goes clean.** The cost lives ONCE per surface, in the adjacent meta
line: right-aligned, muted, and set in **mono**, because "160 credits · 449,920
left" is numbers and a unit and that is exactly what the mono law is for.
Setting it in the sentence face would make it read as a sentence and demand to
be read; this is meant to be glanceable and otherwise ignorable.

**The balance rides along only where the action REPEATS.** On the sheet you
roll, look, roll again, and the number is genuinely moving — so
`160 credits · 449,920 left`. In the lobby, casting happens once, and "how much
is left" answers a question nobody is asking yet — so `160 credits` alone.

That distinction also fixed a layout fault: the lobby's cost had its own line
under the brief box, which pushed the seed chips down and left a gap between
the two. **A price is metadata and metadata should not cost a row.** Folded to
the end of the TRY row it sits at the same optical distance from the button and
takes no vertical space at all.

### Ceremony-gated actions — Sign, Delete

**The button carries no price at all.** "Sign to roster", plain. The confirm is
the commitment point, it already states the full price and what it includes, and
that is where D-15's letter is satisfied.

**Confirms keep explicit numbers forever** — they are the last thing read
before money moves — **but ABOVE the button, never inside it.**

*Amended the same day, and the amendment is the doctrine catching its own
exception.* The first version put the price on the confirm's button ("Sign to
your roster · 450 credits") on the reasoning that confirms are special. They are
not: the NUMBER stays because this is the commitment point, but it is still
metadata, and metadata does not live in button text. One rule, no exception —
the cost sits directly above the button, in the same muted mono as every other
cost line in the product.

### A destructive action is a sentence, not a menu

Also ruled 2026-08-03, and it belongs here because it is the same instinct:
**weight matches consequence, and furniture is not weight.**

A three-dot menu beside a Cast's name put file-manager chrome on the one line
meant to be *her*, and offered a Rename the name already does when clicked —
two affordances for one action, the heavier one redundant. Deleting her is now
one quiet accent line in the package head, beside "Download package", which is
where the other whole-Cast action already lives.

Accent-coloured because it is the only irreversible thing in the room; last in
the row because it is the last thing anyone should reach for. The ceremony
behind it, and its gating, are unchanged.

**A menu belongs on a CARD** — a small repeated object in a grid, where the
actions have nowhere else to live. A page has room to say what it means.

### The topbar credits chip is unchanged

It is the account's balance, not any action's price, and it was never part of
this problem.

## D-110 — A toast is the fallback channel. It is never a second copy.

Founder ruling, 2026-08-03, resolving what looked like two of the founder's own
rulings contradicting each other and was actually one rule nobody had written
down.

The apparent conflict: the prototype's toast law is an ink pill, bottom-centre,
`z-index: 80`, ~2.1s, accent dot. The app-wide sonner was restyled flat-white by
a founder directive (2026-07-11) whose own note says *"never restyle
per-surface."* Both are founder rulings. Both are still in force.

**They resolve by OWNERSHIP, not by precedence.**

- **D-40 governs wherever a live surface owns the action.** Feedback renders in
  place. Never as a toast. The casting sheet polls itself and every outcome
  already has a surface on it — the failure banner, the per-tile captions, the
  cancel line that counts refunds down as they land, and now the notice slot.
- **The foundation toast law governs actions with NO live surface** — which is
  the `GenerationOperationBridge`'s entire reason to exist: unwatched work
  landing somewhere the user has navigated away from.

So the bridge keeps toasting for unwatched work, in the toast law's FORM.
Anything a casting surface can say in place, the surface says.

**And the load-bearing half: no toast may duplicate an owned notice.** Toasts
are the fallback channel, never a second telling. This is the rule the
`castingV2.roll` exclusion (2026-08-01) was already an instance of — the founder
watched *"That roll was cancelled. 160 credits were refunded"* arrive
bottom-right while they were doing something else entirely, describing something
they had chosen on purpose and had already watched resolve. That exclusion was
correct and was reasoned from the specific case; this is the general law it
belongs to.

"Never restyle per-surface" is unharmed and now means what it always meant: one
toast form everywhere, not one toast form and a separate casting toast form.
What changed is which form that is.

## D-111 — A rejected frame is QC evidence, and evidence never goes in the public bucket.

Founder ruling, 2026-08-03. Two conformance verdicts have been confirmed wrong
(the grey-vs-cream wardrobe rejection, and the judge failing a change on one
view while passing it on four). A judge whose mistakes vanish cannot be
improved, and today a conformance-rejected frame is deleted the moment it is
rejected — so the evidence for a wrong judgment is gone before anyone can look
at it.

**Retained in the PRIVATE evidence bucket, never the public one.** The reasoning
is not that the frame is more sensitive than a delivered view — it is that a
rejected frame is *a near-identity of a customer's face that they never bought
and never saw*, and `storage.ts` writes URLs that are permanent by design
because they are persisted in database records. Permanence is exactly the wrong
property for QC evidence. Product imagery lives in the public bucket; evidence
does not.

**Short retention (~14 days), through the cleanup worker's manifests** — the
same machinery that already discharges the Sign path's orphaned-copy risk, not
a second disposal path.

**If the private evidence adapter is not configured in an environment, retain
nothing there. Fail toward privacy.** Note the configuration gap; never fall
back to the public bucket. A retention feature that silently downgrades its
storage guarantee when unconfigured is the invoked-but-inert class with the
blast radius pointing at the customer.

## D-112 — The timestamp fix belongs at the connection, and is reached with instrument discipline.

Founder ruling, 2026-08-03, on a defect that twice nearly produced a false
timeline conclusion during incident work.

**The mechanism, measured rather than inferred:** mysql2 serialises a JS `Date`
into a LOCAL wall-clock string, while SQL `NOW()` / `defaultNow()` writes the
server's UTC. On a development machine at UTC+10 the two writers therefore land
**ten hours apart in the same column**. Reads compound it — a typed drizzle
`select()` returns a `Date` parsed as local (ten hours early), while
`db.execute()` returns the raw string. Production is unaffected: Railway runs
UTC, so the offset is zero and the two conventions coincide.

**A shared read-path helper was REJECTED as the fix.** It is the opted-out law
waiting to happen: every future reader must remember to use it, and the one that
forgets is silently wrong in a way that looks right. One source of truth at the
pool is the destination.

**But changing timezone semantics under a live product is the risky class**, so
the route matters as much as the destination:

1. **Inventory the readers.** Every site that compares, formats or persists a
   timestamp.
2. **Prove the connection fix behaviour-preserving against real persisted rows
   in dev** — not against fixtures, which cannot carry the mixed convention that
   is the whole problem.
3. **Fix any reader that depended on the broken behaviour IN THE SAME CHANGE.**
   A reader that silently compensated for the skew becomes wrong the moment the
   skew is removed.
4. Then ship.

**Measure, then move it once.**

### CORRECTION, on measuring it (2026-08-03)

**The mechanism recorded above is wrong, and the route it prescribed is what
caught it.** "Measure first" was written to protect a risky change; what it
actually did was disprove the premise.

**The application was never broken.** Drizzle's typed column mapper writes and
reads UTC, so a JS `Date` and a `defaultNow()` on the same row have always
landed in the same frame. Measured against 43 real rows carrying both an
SQL-written `createdAt` and an app-written `leaseExpiresAt`: the gaps run 5.6 to
16.6 minutes — the lease itself — and **zero rows are more than two hours
apart.** There are no mixed conventions on disk, and the sentence "the two
writers land ten hours apart in the same column" describes something that has
never happened here.

That claim came from probing `db.execute()` with a raw parameter — a path the
product does not use for typed columns — and generalising from it. The lesson is
the ordinary one: an instrument pointed at the wrong path measures that path
faithfully and tells you nothing about the product.

**What IS broken is the raw driver default**, and only there.
`mysql.createConnection` with no `timezone` parses a DATETIME as LOCAL, so on a
machine at UTC+10 every timestamp read that way is **ten hours early** —
silently, producing a Date that looks entirely reasonable. That is the
investigation tooling, and it is exactly where the two near-miss false timelines
came from. The founder's original framing — "one shared timestamp read-path so
it can't recur per-investigation" — had the location right.

**The destination stands; the reasoning changes.** `timezone: "Z"` is now set on
the pool, and it was measured for harm as well as for cure: the typed round-trip
stays correct (no double application), the bytes on disk stay UTC, and a raw
read through the same setting becomes correct. Nothing is re-interpreted,
because nothing was ever written in local time.

The rejected shape stays rejected. `scripts/lib/dbConnection.mts` is a
CONNECTION factory, not a read-path helper — one obvious thing to import,
shorter than the thing it replaces. The instrument is kept as
`scripts/measure-timestamp-frame.mts` so this is re-runnable rather than
believed.

**Named rather than left implicit:** 43 scripts still open a bare connection,
and about a dozen of those read a timestamp without `CAST(... AS CHAR)`. The
incident-work ones are migrated; the remaining test drivers are exposed and
should move when touched. Until then the exposure is real and it is written
down.

## D-113 — A fallback roll is charged. The confession is the product, not a refund.

Founder ruling, 2026-08-03, arising from the sweep that made the fallback
visible for the first time.

When the interpreter cannot be read, the compile falls back to the raw sentence
and every fact the brief stated is lost — on a roll that still runs and is still
charged. The sheet now says so (the highest line in the notice slot). The
question that opened was whether it should also refund.

**It should not.** Eight real images were delivered from an honest degraded
compile. What was owed was *saying so*, and that is now paid. A roll that
produced eight faces is not a roll that produced nothing.

**The refund line stays exactly where the existing laws already put it:**

- **Nothing dispatched → nothing charged.** Structurally true rather than
  policed, because compile precedes the charge: a compile that fails outright
  throws before the claim, so there is no money to return.
- **Zero usable delivered → everything back**, base included — the D-103 family,
  unchanged.
- **A fallback roll that provably dropped a stated fact remains the
  support-correction precedent** (`refund:correction`), case by case.

**Never an automatic.** An automatic refund on fallback turns every interpreter
outage into a free-roll festival, and it would price our bad day as the
customer's windfall rather than as what it is — a degraded delivery we now
declare.

## D-114 — A package view gets one automatic re-attempt. It knowingly amends D-92.

Founder ruling, 2026-08-03. **This amends a ratified design**, so the amendment
is stated rather than slipped in: D-92 gave the Sign package no repair path at
all — a view that failed conformance was refunded and the slot confessed. That
was the right shape for a machine nobody had watched work yet. The maiden
voyage and the closes since have shown the judge rejecting frames that a second
draw would have satisfied, and paying the customer back for a coin toss is not
the same as trying twice.

**One automatic re-attempt, before the slot is declared failed.**

### The line that keeps this from becoming a money path

**The retry runs BEFORE settlement.** That is the whole safety argument, and it
is why this needs no new billing anything: the original 50 credits already
covers the slot, and a refund only comes into existence after the *second* miss.
There is no second charge, no second reference, no new reconciliation. The
receipt arithmetic D-92 and D-103 established is untouched, because the retry
happens entirely inside the window where the slot has not yet settled.

### The bars, all five

- **Retry before settlement.** No new money path. One charge, one possible
  refund, unchanged references.
- **One retry maximum.** Not a loop, not a budget, not "until it passes". A
  second miss settles as a failure exactly as today.
- **Both attempts' verdicts persist on the slot.** The judge is young and this
  is the record that lets it be improved — a slot that passed on the second draw
  should say what the first draw was rejected for.
- **Fenced writers are unchanged. A process that lost its fence retries
  nothing.** Losing the fence means this process stopped being the authority for
  this operation; a fenced writer that "helpfully" retried would be a second
  process generating against a slot the sweep already owns.
- **A test proves no double-settlement and no post-fence retry.** Both are
  silent failures — the first pays or seals twice, the second races recovery —
  so neither may rest on reading the code.

### What this is NOT

**Per-slot user retry with money attached waits for M12.** A button that spends
credits to redraw a view is a purchase surface, and purchase surfaces get
designed as purchases: price, confirmation, receipt, refusal. This ruling is
strictly the machine giving itself one more go inside a slot the customer has
already paid for.

### CORRECTION, on implementing it (2026-08-03)

**The automatic re-attempt already existed, and this ruling does not amend
D-92.** Both halves of that sentence matter, because a decision log that records
a softening which never happened is worse than one that records nothing.

`buildOneView` has run `for (attempt = 1; attempt <= 2)` since the Sign ceremony
first shipped (`dbac7383`), with the comment "one generation, one regeneration.
Then the slot fails named-and-refunded." A conformance rejection drops the frame
and continues; a provider error retries unless it is terminal. Four of this
ruling's five bars were therefore already true when it was written:

- retry before settlement, no new money path — `failView` runs only after the
  loop;
- one retry maximum — the loop is bound at two;
- fenced writers unchanged — the fenced branch RETURNS rather than continuing,
  so a process that lost its fence has never retried;
- no double-settlement on a retry — pinned by "keeps a view that passes on the
  second attempt, and charges nothing extra".

**And D-92 never forbade this.** Its passage reads: *"a permanently failed view
has no repair path until M12 — no per-slot purchase exists and 'roll again' does
not apply to views."* That is about the CUSTOMER's repair path for a view that
has already failed and settled — the same thing this ruling defers to M12 in its
own "what this is NOT" section. The machine's internal re-attempt before
settlement is a different mechanism, and D-92 is untouched by permitting it.

**What was genuinely missing was bar three.** Every attempt's verdict is now
persisted: the loop kept a single `lastVerdict`, so the second attempt
overwrote the first and a slot that failed twice recorded only its final
rejection. The final verdict stays under the key the room already reads;
earlier attempts ride beside it under `earlierAttempts`. That is the half the
judge's improvability actually depends on (D-115) — the record of what was
thrown away, not only what the customer was finally told.

Bar five gained its missing half too: the no-double-settlement case was already
pinned, and **no post-fence retry** is now asserted by counting generations
rather than by reading the code.

### Shipping

Ships as **one batch with (0g) rejected-frame retention**, slotted after D-93,
because they are the same pipeline lines:

    generate → judge → retain the rejected frame (0g, private bucket) → retry once → settle

Doing them separately would mean touching the same four lines twice and writing
the retention of a rejected frame without the second attempt that makes a
rejected frame interesting.

## D-115 — The judge self-measures. It never self-modifies.

Founder ruling, 2026-08-03, recorded alongside D-114 because the retry is what
makes it urgent: a machine that retries is a machine generating evidence about
its own judgments, and the tempting next step is to let it act on that.

**It does not.**

- **Evidence accumulates automatically.** Retained rejected frames (D-111),
  both attempts' verdicts on a slot (D-114), the disagreement between a first
  and second draw — all of it collects without anybody deciding to collect it.
- **Judge improvements ship as reviewed changes, with fixtures.** A threshold, a
  prompt, an axis, a landmark — each one is a diff somebody read, pinned by
  fixtures drawn from the accumulated evidence.

The thing being refused is a judge that tunes itself from its own outcomes.
That machine has no negative control: it would drift toward whatever it already
believes, its own record would agree with it at every step, and the first sign
of trouble would be customers paying for views a quietly-loosened judge stopped
catching. The program has met the general shape before — a control that is
invoked but inert, evidence tidied away, a suite that proves the layer above the
one that breaks. Self-tuning is all three at once.

Measurement is free and reversible. Modification is neither, so it stays a
decision somebody makes.

## D-116 — Makeup joins the accessory family: never unbidden, honoured wherever asked.

Founder ruling, 2026-08-03.

Makeup is currently unsayable at three layers at once — the interpreter is told
"no makeup", the cohort constant carries a bare-lashes clause, and no carve-out
exists anywhere. **That was never decided. It was a default**, arrived at by
three independent restraints agreeing, and it has been quietly overruling people
who asked for something.

It now follows exactly the law eyewear and jewelry follow: **never unbidden,
honoured wherever asked.** The dice stay bare — that is the unbidden-adornment
law and it earns its keep, because eight bare faces are comparable *as people*
and eight variously-made-up ones are comparable as looks.

Three doors, and only the first is scheduled.

### Door 1 — stated in the brief

A carve-out on **D-95's pattern**, which exists for precisely this failure and
after precisely this evidence: "a model in her 20s wearing chunky glasses"
rendered zero glasses, because the constant's own no-accessories clause was
overruling words the user had typed. Same licence shape here, including its
sharpest clause — **a failure to appear is a failed candidate.** Stated-only is
worth nothing if stated does not work.

Ships as a stated-channel batch **together with (0c) echo accessories**: both
are interpreter-prompt changes, so one D-89 golden-driver run covers both.
Slotted after the character sheet, before Refine.

### Door 2 — Refine vocabulary

"Subtle blush", "gloss the lip", "mascara" are recognised Refine edits, folded
into Refine's design alongside the barbershop finishes the line-up ruling sent
there. Refine IS the stated channel at maximum intent — adornment never arrives
unbidden, and refine is asking, per face.

### Door 3 — world-default glam

Whether a k-pop sheet arrives idol-groomed *unbidden* is a per-world property,
and therefore an F8 shelf row beside its ground, its garment and its colour
latitude. Nothing to schedule: it is rows in F8's table when that era comes.

**Nothing here weakens the frame.** The photograph is still a plain studio tee
on seamless paper; makeup is on the person, which is the side of that line the
stated channel has always been allowed to touch.

## D-117 — The reference form is decided by ablation, not by taste. The prior has flipped.

Founder ruling, 2026-08-03, on the back of commissioned research now living at
`docs/specs/research/`. **Recorded, not built** — nothing wires a conditioning
default until the gate below runs.

The character sheet was designed as "the default single-image identity reference
for all downstream generation". The research moves that from a decision to a
hypothesis, and the prior now points the other way:

- **Luma's own guidance (Grade A) warns that multi-angle sheets can hallucinate
  details and leak artifacts, and recommends one angle per image.**
- Kling builds a character Element from a main image plus one to three
  supplemental SINGLE-view images; Runway supports three separate references.
- The cell-fidelity arithmetic points the same way: a face occupying a third of
  a bounded sheet carries less usable detail than the same face filling its own
  frame.

**So the likely default is a small shot-matched subset of individual views**,
with the sheet remaining the human-facing export and a candidate reference only
for models that accept one image.

### The gate, redesigned

It was three fixed forms judged against each other. That would have answered
"which of these three" rather than "how many, and of what" — so it is now
ablation arms:

- **reference count** — 1, 2, 3, and the most the endpoint coherently accepts;
- **form** — separate views against the composed sheet;
- **selection** — shot-matched against a fixed subset.

Scored by the conformance judge plus founder eyes, and reporting **marginal
identity gain per added reference**, because "more is better" and "more is
free" are different claims and only the second one is obviously false.

**It stays an entry gate BEFORE Takes wires any conditioning default.** A
default chosen by intuition and then measured is a default nobody removes.

## D-118 — The runtime reference selector. One authority, calibrated by the gate.

**Recorded, not built.** Belongs to the Takes/canvas wiring era and inherits
D-117's gate.

There will be exactly one server-side component that decides which references a
generation is handed: what shot is being made, what the target model accepts,
and the fewest references that cover it — per the selection table in the
research's `character_reference_asset_specification.md` §8.

**Its rules are calibrated by the gate's results and never hand-authored.** The
failure it exists to prevent is the one this program keeps meeting in other
clothes: a rule of thumb written once, spread across three call sites, and never
measured again. One authority means one place to correct when the next model
changes what it accepts.

## D-119 — Two Casts may share a frame only when one account owns both.

Founder ruling, 2026-08-03, **effective immediately** even though
multi-character generation is not built.

Multi-character generation — two or more Casts in one frame — is a named
Takes/canvas-era problem. The shape of it is recorded so it is not re-derived:
per-person reference bundles via model-native person binding where available;
the conformance judge extends to **per-face assignment scoring** (the research
framework's §3.2 — a similarity matrix plus a constrained one-to-one
assignment, so two output faces matching one Cast, or a swapped assignment, are
FAILURES rather than near-misses); and the A/B gains multi-character scenarios.

**The consistency claim covers solo generations until group shots pass their own
gate.**

The law that binds now, ahead of any of it:

> **Two Casts may co-star in one generation only when the same account owns
> both.**

Anything else is the steal-a-customer's-cast shape the founder ruled on
2026-07-25 — *"if a marketing team or content creator comes on the platform and
makes a model that's theirs, no one should be able to steal or copy that
work"* — arriving through a side door marked "collaboration". A generation is a
place two identities can be combined; the ownership predicate belongs in the
statement that assembles the reference bundle, not in a check somebody
remembers to run.

## D-120 — We promise the process, never the outcome.

Founder ruling, 2026-08-03. For whenever marketing copy gets written, and for
every product surface that describes what a Cast is.

**The product promises the PROCESS** — reference-anchored, drift-tested,
checked and refunded. It never promises "zero drift", "100% consistent", or
"identical every time".

The research grades this A: **no current model supports an unconditional
consistency guarantee.** An absolute claim is therefore two things at once — a
statement that is not true, and a refund generator, because every customer who
finds the one frame that drifted is holding our own sentence.

This is the honest-capability law the product already applies to its own UI
("the sentence gains 'or sign' the day the button does") pointed at the thing
most likely to be written by somebody who was not in these conversations.

## D-121 — A refine costs 25 credits.

Founder ruling, 2026-08-03. The Refine pricing gate, answered.

Two arguments, and they point the same way.

**Margin.** A refine runs on the identity engine, which is dearer than the roll
engine behind a 20-credit sheet candidate, and cheaper than the 2K package view
at 50. The number sits where the cost sits.

**Behaviour, which is the stronger half.** Refine is the conversion path to a
450-credit Sign: every refine is a deposit toward one, and it reduces post-Sign
revision churn because identity decisions get made against one cheap image
instead of a whole package. Priced at package-view parity, exploring three
variants costs 150 — a third of a Sign — and people stop exploring exactly where
the product wants them to continue. At 25, three variants cost 75: visible, and
not a decision of its own.

**Confirmed with it:** removing a mid-stack instruction is a **paid re-render**,
because a new combination is a new generation. Backing up to a variant that
already exists is **free selection**. Per D-109 the UI must never let those two
look alike, and the price lives in the quiet meta line — never in button text.

## D-122 — Unselected variants follow ordinary candidate retention.

Founder ruling, 2026-08-03. Ratified rather than assumed, because the
refinement proposal recorded it as an open question and an assumption in this
area is how an artifact quietly outlives the thing it belonged to.

Sign copies its own anchor, so **the Cast depends on nothing in the variant
table.** A signed candidate's unselected variants are therefore ordinary
candidate debris and age out on the ordinary candidate schedule — no special
case, no second retention path, nothing to keep in step with anything.

## D-123 — Follow reads the SELECTED variant, and the roll records which one.

Founder ruling, 2026-08-03. The see-what-the-system-uses law applied to Follow.

If a user refines a face and then follows it, the family must descend from the
face **they are looking at** — not from the original the variant was derived
from. Reading the parent candidate directly is how the proposal's own
green-eyes/brown-cousins example happens: you refine her eyes green, follow her,
and get eight brown-eyed cousins.

**And the roll stamps which variant it descended from, from day one.** Lineage
is cheap to record while the row is being written and painful to backfill once
there are rolls in the world without it.

## D-124 — A stated faith covering is a rendering channel, not a loose word.

Founder ruling, 2026-08-03, after looking at the verification renders.

Both halves of the presentation-is-intent law verified: unstated "a Muslim woman
in her 30s" produced **zero coverings across eight** with a wide heritage draw
(founder-confirmed as demographically true), and "wearing a hijab" produced
**eight of eight**. The law works.

**What the pictures showed is that the covering was styled rather than worn.**
The founder's words: *"desert scarf like rather than faith based"* — and the
tell is hair visible at the front. A draped scarf and a hijab are not the same
garment, and rendering the first when the second was asked for is the
drop-a-stated-fact class arriving as a near-miss rather than an absence.

**The fix is the A9 / broken-nose pattern**: a stated covering translates to
**engineered prose** rather than travelling as a loose noun — covers the hair
and neck fully, neatly framed around the face, worn as the faith garment and
never as fashion styling. Golden-driver verified.

**And it closes a latent fragility recorded the same day, which is the second
bird rather than a rider.** Today the covering renders only because it rides the
free-text character-detail channel: the STATED ACCESSORIES licence explicitly
excludes headwear and the framing block bans hats, so the behaviour is correct
by accident of routing. A future tightening of the headwear exclusion would
have taken faith presentation with it silently. Formalising the channel means
the law now holds because something guarantees it.

**Unstated behaviour does not change at all.** No covering is ever inferred from
a faith, a name, or a heritage — that is stereotype authoring, and the zero of
eight stands.

**Built and verified, 2026-08-03.** `server/castingV2/statedCovering.ts` reads
the user's own stated words for a closed, short list of coverings and emits a
STATED COVERING block; the cohort constant gains the matching carve-out naming
it the ONE exception to the no-hats and no-headwear lines, so the law now holds
by construction rather than by routing. Sixteen paid images, both directions:

- **"a woman in her 30s wearing a hijab" — 8 of 8, correctly worn.** Hair
  covered to the hairline with no fringe or loose strands, the fabric framing
  the face and covering the ears, neck and shoulders. The founder's complaint
  — *"desert scarf like rather than faith based"* — does not survive the change.
- **"a Muslim woman in her 30s" — 0 of 8, and 0 of 8 prompts carried the
  block.** Nothing inferred, and the heritage draw stayed as wide as before.

Evidence: `docs/specs/evidence/faith-presentation/covering-{stated,unstated}.jpg`,
against `faith-{stated,unstated}.jpg` from the verification that prompted this.
Driver: `scripts/drive-stated-covering.mts`, which runs both directions or
neither — the unstated half is the one a future change here will break first.

## D-125 — A schema-dependent change is never flag-dark. Migrate first, always.

Recorded 2026-08-03 after breaking production for about three minutes.

M8's code was pushed to `main` with migration 0020 applied only to dev. It
deployed, ran SUCCESS, and served a build whose casting reads LEFT JOIN a table
production did not have. Health stayed 200 the whole time, because `/api/health`
does not touch casting tables — the "deploy SUCCESS ≡ healthy" lesson, met
again from a new direction.

**Two separate mistakes, and the second is the one worth the law.**

**The flag was not dark in production, and that was an assumption rather than a
reading.** `CASTING_V2_SCOPE` is `all` in prod. The standing autonomy grant says
new V2 code ships dark behind its flag so autonomous deploys never change live
behaviour — that protection was believed, not verified. **Never infer a
production flag's value from the dev `.env`. Read it.**

**And even a genuinely dark flag would not have made this safe.** A feature flag
gates a FEATURE; a migration changes the SQL shape of statements that run for
anyone the flag admits. The moment a read path names a new column or table, the
deploy is schema-dependent, and schema must lead code — there is no flag
position that makes a query against a missing table work.

**The rule, stated so it is checkable:** if a change touches `drizzle/`, the
production migration happens BEFORE the push, or the push waits. Since
production migrations are a founder gate (the `MYSQL_PUBLIC_URL` ceremony), that
means a schema change is a founder-gated release, not an autonomous one —
however dark the feature behind it looks.

Recovered by reverting all six commits and pushing the revert; production came
back on the restored build with health 200. The work is intact in history and
re-lands behind the migration.

## D-126 — A reviewer clears the DIFF, never a precondition.

Founder ruling, 2026-08-03, from the same wreckage as D-125.

Fable reviewed the M8 diff and returned "CLEAR to push". I pushed. The diff was
genuinely clear; what was not clear was migration 0020, which sat unanswered on
my own founder checklist — named in two consecutive reports as something the
founder had to do, and then pushed past anyway.

**A review verdict speaks only about the code it read.** It cannot clear a
deploy precondition, because the reviewer was not asked about one and does not
hold the gate. Treating "clear to push" as permission to push is reading a
narrow answer as a broad one.

**The rule: no push while any founder item on your own checklist is
unanswered.** If you wrote it down as needing the founder, it needs the founder
— a reviewer saying yes to something else does not convert it.

## D-127 — `CASTING_V2_SCOPE` stays `all` in production, deliberately.

Founder ruling, 2026-08-03. Recorded so nobody later "fixes" it.

Every production account is the founder's, so there is no third party to
protect from a flag that is wide open, and Refine went live for all of them on
the M8 re-land. **This is a decision, not an oversight**, and the next person
who reads D-125 — which turns on the flag having been open when it was assumed
dark — must not conclude that tightening it is the fix. The fix was reading the
flag and leading with the migration; the scope itself is correct.

What D-125 still requires, unchanged and independent of scope: a change touching
`drizzle/` is founder-gated regardless of flag position, because no flag makes a
query against a missing table work.

## D-128 — The eye-shape vocabulary, approved.

Founder ruling, 2026-08-03. All nine as proposed: almond, round, hooded,
monolid, upturned, downturned, deep-set, wide-set, close-set.

Each renders as engineered anatomy rather than the bare adjective — lid
exposure, crease depth, canthal tilt, inter-eye set — because a single word
loses to the model's portrait prior exactly as the broken nose and the
styled-not-worn hijab did (A9, D-124).

**Final taste check rides the founder's dogfood.** Single words can still be
argued there without reopening the design: the list is a vocabulary, and
swapping a name or dropping a member costs one constant and one prose line.

## D-129 — The structural-features licence does NOT cover ordinary feature shape. Finding, not yet a fix.

Measured 2026-08-03 on the founder's rider, which asked for proof rather than
presumption. The presumption would have been wrong.

**Both briefs reach every prompt — 8/8 — and neither does so through the
licence.** They travel as `characterNotes`, the free-text character-detail
channel, and land as `Character detail: button nose.` That is the *exact* shape
D-124 named and closed for faith coverings: correct today, correct by accident
of routing, and guaranteed by nothing.

The licence enumerates *marks and damage* — "a broken or crooked nose, a scar, a
cleft, cauliflower ear, a missing or chipped tooth, asymmetry, a birthmark,
freckling, active acne or acne scarring, weathered or sun-damaged skin, a shaved
head, a tattoo". Its opening clause is broader ("a permanent physical feature"),
but every example is a deviation from an unmarked face.

- **A beauty mark is arguably in**, sitting next to "a birthmark", though the
  user's actual word is not the listed one.
- **A button nose is out.** It is a nose SHAPE, not a mark — the licence has no
  example of ordinary feature geometry, so nothing tells the model that "render
  it plainly, do not idealise it away, a named feature that fails to appear is
  a failed candidate" applies to the shape of a nose.

**Why that matters even though both render today.** The licence's teeth are the
failed-candidate clause. Free text has none. So reaching the prompt is not the
same as being guaranteed to render, and the idealising prior is strongest
exactly where feature shape is concerned — a button nose is precisely the sort
of thing a beauty prior "corrects" toward a conventional one.

**Recorded rather than fixed**, because widening a licence in the cohort
constant changes every candidate on every sheet, and the honest sequence is the
one D-124 used: name the gap, get the ruling, then verify on paid renders in
both directions. The proposed fix is one clause — extending the enumeration to
ordinary feature geometry (nose, ear, chin and jaw shape) so a stated shape gets
the same teeth a stated scar already has.

## D-130 — The licence widened, and the paid renders say a clause is not enough.

Founder ruling on D-129, executed 2026-08-04 with D-124's sequence: clause,
then paid renders both directions. The clause is in — STRUCTURAL FEATURES now
names the shape of the nose, cheekbones, jaw, chin, lips and teeth alongside
the damage it always covered, with a second line saying plainly that ordinary
geometry is how a face is built rather than a flaw to resolve.

**The control is clean.** "a model in her 20s" — eight ordinary faces, nothing
invented, heritage draw as wide as ever. A widened licence that started adding
features nobody asked for would be worse than the narrow one it replaced, and
it does not.

**The stated direction only half worked, and the half that failed is the
informative one.** "a model with a button nose and high cheekbones":

- **High cheekbones landed** on most of the eight.
- **Button noses largely did not** — roughly two of eight, the rest straight or
  aquiline.

The distinction is not random. **The licence works where it agrees with the
prior and fails where it contradicts it.** High cheekbones are what a model's
face already looks like, so permission was all that was missing; a button nose
is a departure from the studio-portrait prior, and permission alone does not
move it. That is the A9 lesson arriving for the fourth time — the broken nose,
the hijab, the eye shapes, now feature geometry — and it is now measured rather
than argued.

**So the clause is necessary and not sufficient.** Feature geometry needs
engineered prose per value, the way `EYE_SHAPE_RENDER` describes lid exposure
and canthal tilt rather than saying "hooded". A bare adjective is permission;
prose is instruction.

This is evidence for the sweep's open question. D-129's siblings — lip shape
and teeth character — were queued with "engineered vocabularies wait for
dogfood evidence"; this IS that evidence, one axis early, and it says the
vocabularies are the load-bearing part rather than the registration.

Evidence: `docs/specs/evidence/refine/d129-{stated,unstated}.jpg`.

## D-131 — Refine is OPEN-EXCEPT-WALLS. The catalogue is the guarantee lane, never the gate.

Founder ruling, 2026-08-04. Supersedes the tier-by-tier rollout.

Every person-touching instruction gets an honest attempt — cuts beyond the 36,
arbitrary colours, brows, lashes, feature shapes, visible marks, ink. The
engineered catalogue continues underneath as the **guarantee lane**: where a
value is expressible in an engineered vocabulary it is promoted into it and
keeps its prose and its failed-candidate teeth. Everything else runs in the
**free lane**, whose copy is honest that it is an attempt.

**Four absolute walls. A refusal always names which one it hit.**

  (a) **Identity / likeness** — never another person.
  (b) **Person, never stage** — wardrobe, backdrops and props stay post-Sign.
  (c) **Every image-text, brand and safety guard rides every instruction.**
  (d) **Every free-lane ask files into the variant's record, or it refuses.**
      No render the paperwork did not learn.

**Wall (d) is structural, not disciplinary** (advisor, and it is why the build
is shaped as it is): the edit prompt composes from the PERSISTED
`variant.deltas`, re-validated, rather than from the in-memory object that
happens to match it. Anything filing drops is therefore absent from the prompt
too, so a failure degrades to filed-but-not-rendered — which the sweep can see
— and never to rendered-but-not-filed, which nothing can.

**The subject vocabulary is CODE-OWNED; only values are free.** A model-authored
subject string hands the composition key to the model, which is what D-89
forbids: "her brows" arrives as brows, brow shape, eyebrows; last-writer-wins
silently becomes accumulation; and "thin" and "thick" end up in one prompt
arguing. Closed subjects also ARE wall (b): a red coat has no subject to file
under, so the wall is a missing slot rather than an instruction.

**The guarantee lane stays guaranteed by promotion, not by prompt.** Guaranteed
subjects are excluded from the free-lane vocabulary at the type level, and the
parser re-checks every free entry: expressible in an engineered vocabulary
becomes a promotion; a guaranteed subject filed free rejects the whole reply. A
saboteur engine that deliberately routes "green eyes" into the free lane proves
it cannot land there regardless of what the interpreter does.

## D-132 — Every body-art design gets a document. Words commission it; only pixels render it.

Founder ruling, 2026-08-04.

A reference image supplied: derive a clean flat plate, riding the refine, free.
Words only: generate the flash FROM the words at the standard 25, and the user
approves or regenerates the artwork **before it touches the cast**. The accepted
plate is a cast-lifetime asset in private storage, with the content walls
applying to it as to anything else — no lettering, no logos.

**The principle, on the record: words commission the document; only pixels
render. Words are never load-bearing for a design.** A description is not a
design, it is a request for one, and rendering ink straight from a sentence
produces a different tattoo in every frame — which is a person who does not
have one tattoo.

## D-133 — Ink placement law: pixels only, and nothing invisible is ever charged.

Founder ruling, 2026-08-04. Three cases, by what the canonical frames can see.

**(a) Fully in-frame** (face, neck). Apply only, one generation at 25. The
anchor IS the document, and the conformance judge referees it into every view
for free.

**(b) Fully covered** (chest, back). Plate only at 25, nothing applied, with an
honest confession — *recorded; appears when wardrobe reveals it*. The skin-truth
views render it at Sign, judged against the plate as reference.

**(c) Partially visible** (a sleeve). Plate first at 25, then a **mandatory**
application from the plate at 25. Mandatory because Sign copies and never
invents and the judge referees views against the anchor, so the anchor must
carry every fact the canonical frames will show. **Two steps are always shown as
two steps.**

**Words-only ink records are dormant notes.** They render nothing, anywhere,
until a plate is commissioned. There is no drift-disclaimed path.

Ink files as a **permanent identity fact**: Follow inherits it, and the
conformance judge only judges it where a reference can establish it.
Bodysuit-scale editorial ink refuses with the worlds-era pointer.

## D-134 — The skin-truth slice: two hidden base-layer views, after the dogfood.

Founder ruling, 2026-08-04. Built after the founder's dogfood, before VTO.

Two views generated at Sign — full front and full back, neutral undergarment —
under conditions that are all mandatory:

- **judged like real views**: identity axis, D-114's one retry, graceful
  degradation, so a failed doll view never blocks the Sign;
- **free to the customer**, absorbed, never on a receipt;
- **private bucket and an authenticated route only** — never the public bucket,
  never in the room, the downloads, the character sheet or the view-count copy,
  and excluded at the projection by construction rather than by omission;
- a one-page dignified **per-sex base-layer spec**, V1 precedent as the start;
- two new view names mean a **migration** (founder ceremony) and D-102's
  widen-or-refuse discipline at every legacy reader.

The production private-bucket configuration is a founder Railway item, requested
when the slice is ready to land.

## D-135 — The face-completeness sweep, because lips and teeth were about to be nobody's.

Founder ruling, 2026-08-04.

**(a)** Lip shape and teeth character register as never-drawn axes exactly as
eye shape did — 180-draw null pin, bit-identical sheets, mutation-verified red.
Teeth and dimples carry **conditional visibility**: rendered when the expression
shows them, recorded regardless. Engineered vocabularies wait for dogfood
evidence. (D-130 is early evidence that the vocabularies, not the registration,
are the load-bearing half.)

**(b)** Vitiligo, albinism and large birthmarks get the **D-124 dignity
treatment**: stated-only forever, never inferred, engineered respectful
translations aimed at accuracy rather than the prior's caricature,
failed-candidate teeth, driver-verified in both directions.

**(c)** Heterochromia files as a **source-contained stated detail**, because the
single eye-colour field cannot hold per-eye colour. The schema widening is
recorded as a known registry limit rather than quietly worked around.

**(d)** Stated height files as record metadata, for the comp-card era to read.

**(e)** Then the sweep itself: walk the full inventory of sayable human features
against the axis registry and file every unowned-but-sayable one as never-drawn.

## D-136 — Expression is presentation state. Follow never inherits it.

Founder ruling, 2026-08-04. Expression joins the free lane — "a warm open
smile" — under a filing law different from every other free-lane subject, and
the difference is the whole entry.

**Expression records as the variant's PRESENTATION STATE, not as identity.** A
follow means "more people like this one", and inheriting a smile would make a
momentary choice permanent for eight strangers. The destination is a property
the code owns, not the identity blob — `readResolvedIdentity` passes unknown
fields through whole, so filing expression into the identity would make it
heritable by default.

**But features an expression REVEALS file as identity facts at first showing.**
Teeth character is a fact about the person; the smile that showed it is not.

Sign signs the selected variant, expression included, and the confirm quietly
reflects it.

## D-137 — Non-face ink is gated until the studio exists.

Founder ruling, 2026-08-04, acting on the recommendation raised at the wide-open
gate.

Face and neck ink stays live under D-133(a): fully in-frame, the anchor is the
document, one generation is the whole of it. **Everything else refuses**, with
the honest sentence — *needs a design document; the body-art studio is coming,
and face and neck ink work today.*

The alternative was rendering a sleeve from words, which D-132 already forbids
and which produces a different tattoo in every frame — a person who does not
have one tattoo. A gate that says "not yet, and here is what does work" is the
honest shape of a missing feature; silently rendering something is not.

The dogfood proceeds on the wide build with this gate in place.

## D-138 — The Body-Art Studio. Supersedes D-132's flat plates.

Founder-designed, adversarially tested, adopted 2026-08-04. Built after the
dogfood, together with the skin-truth slice (D-134).

**Templates are code-owned static assets, never generated.** Neutral mannequin
sheets: M/F × (torso front+back as ONE multi-panel sheet / arm multi-view /
leg), plus a composite upper-body sheet (torso, neck and both arms) for pieces
that cross regions.

**A one-time tone ladder — about ten skin tones per sheet, curated at build.**
Opening a tab selects the template nearest the candidate's recorded skin tone.
Never a per-use generation, never credits, and **dignity-critical**: an ink
preview that only exists on pale skin misrepresents the purchase for exactly the
customers this product renders truthfully. Template selection covers the
nonbinary case with a **visible toggle, never a silent guess**.

**Aesthetic law.** Limbs and torsos terminate in **fades, never cuts**. Matte,
low-contrast skin. One relaxed canonical pose per template, held identical
across the whole tone ladder. Background tone — near-white against studio grey —
is decided at the founder's one-time template taste gate, with grey the safer
default for the pale rungs; the founder supplies a reference image at curation.
**Templates carry no text, ever.**

**Tabs.** Browser-style tabs in the viewer, one per artwork, **derived from the
record and never parallel state**. Inactive on ink-free variants. A design
renders at the standard 25 and iterates freely; left/right placement is a
defaulted, visible toggle.

**One sheet per region, multi-view within the sheet.** A neck wrap renders
across the torso sheet's front and back panels in ONE generation — consistent by
composition rather than by hoping two generations agree.

**Scope promotion.** Extending a piece inside its tab past its region re-plates
onto the composite sheet at 25; the user approves the migration and it is
supersession-versioned. **One artwork, one document, always.** A separate new
tattoo is a separate tab and a separate document. Full-body pieces refuse with
the worlds-era pointer. Region seams are defined once, in the template spec page.

**The apply law, unchanged and load-bearing:** every visible portion is
mandatorily applied to her. The anchor must carry everything the frames can see,
because Sign copies and never invents and the judge referees views against the
anchor. A **staleness marker** derives from document-version against
applied-version, and the **Sign currency gate** refuses on stale visible ink,
names the region, and offers the one-click re-apply at 25.

## D-139 — Three gap rulings: inheritance, tone, and conditioning.

Founder rulings, 2026-08-04.

**(1) Ink does NOT inherit on Follow.** A sleeve is a possession, not a family
trait — the follow sheet carries the honest note, and applying her documents to
a cousin is an ordinary two-click apply. **Words-rendered ink never exists
anywhere**, on a follow or otherwise.

**(2) The tone ladder** is as D-138 states, and it is a dignity requirement
rather than a nicety.

**(3) Sign, package and doll-view generation take region documents as
conditioning references** — a named spec requirement with its own test. Without
it, drift returns at the durable boundary, which is the one place it cannot be
undone.

## D-140 — Lettered ink: system-invented text never, user-stated text legal.

Founder ruling, 2026-08-04. **Supersedes the blanket no-lettering ban** in
D-132.

Phrases are **typed by the user**, or **OCR-extracted from their reference and
explicitly confirmed** — *this design contains "MEMENTO MORI"; keep the
lettering?* Every phrase passes text moderation and the brand scrub before any
render, and refusals name their wall. Scripts we cannot verify refuse honestly:
*can't verify this script yet.*

**Plate-time verification is mandatory.** The rendered design's lettering is read
back and must match the stated phrase exactly; a mismatch is a failed render and
regenerates. This is the difference between permitting text and shipping
gibberish that looks like text.

The product's no-letters output guards gain a **named, test-held carve-out** for
recorded lettered-ink regions — the D-124 exception pattern, so the guard holds
everywhere it should and yields only where a record says it must.

If a user asks for "some script" without supplying words, **ask for the words**.
The system never invents them.

## D-141 — The studio's hardening, shipped inside the slice.

Founder ruling, 2026-08-04. Not a follow-up list; part of the same slice.

- **Ink conformance judges design identity, never placement-exactness.**
  Mannequin anatomy is not hers, and the judged-spec limits law applies.
- **Region-document version CAS** against concurrent edits — the state-bleed
  class, which this program has already paid for once.
- **The third-party-character refusal extends to plate derivation.** A dragged-in
  protected character is the same wall as a typed one.
- **Region documents and doll views join D-107's deletion manifests.**
- **D-101 discipline on the tab UI**: mock, founder eyeball, build, evidence pack.

## D-142 — A subject is one FACET. Coarse filing let a colour annihilate a cut.

Founder dogfood defect A, 2026-08-04. Deterministic, and the tooltip was the
smoking gun.

The stack was *"change hair to mullet"*, *"copper hair"*, *"actually black
hair"*. Every instruction survived in the record — visible in the chip tooltip —
and the picture had **no mullet**. All three had filed into one coarse `hair`
subject, so last-writer-wins did exactly what it says and a colour edit deleted
a cut.

**The eyes were already right, and that is the whole diagnosis.** "Seafoam" and
"hooded" coexisted on the same session because eye colour and eye shape were
separate subjects. The only difference was that eyes had been split and hair
had not.

**So: a subject is one facet a person can change independently.** Two things
that can be true at once need two slots, or the second silently deletes the
first. Hair becomes cut / colour / texture / finish / worn; skin becomes tone
and character; eyes stay split.

## D-143 — Compose-completeness: every filed fact reaches the prompt, or the render refuses.

Founder ruling, 2026-08-04, and it is the half that matters more than the fix.

D-131 promised that a filing failure would degrade to filed-but-not-rendered
"which the sweep can see". **Nothing saw this.** The mullet was in the record
and absent from the picture, and the only witness was a chip tooltip the founder
happened to hover.

So the promise gets mechanical teeth: composition is CHECKED against the delta
it came from, and a fact that did not make it stops the render. **Annihilation
becomes unrepresentable rather than detectable** — which is the difference
between a law and a hope.

Checked BEFORE the claim, so an instruction that cannot survive composition
costs nothing: the roll's compile-and-admit-first arrow, applied to the defect.
The check and the render share ONE prose object, because two copies would let
the check pass on a prompt the render never builds — the same shape as the
defect it exists to catch.

## D-144 — Render recipe v2: the original for identity, the parent for realization.

Founder dogfood defect B, 2026-08-04. Stochastic, and invisible to every
instrument we had.

The mullet **shortened** under a later "seafoam eyes" edit, with no hair
instruction anywhere between. The cause: words persist and the PICTURES OF THEM
RE-ROLL. "A mullet" is a description, and base-anchoring meant every render
drew a brand-new one from the original.

**Two references now.** The ORIGINAL stays the identity base, so degradation
still never compounds and the tenth variant is as close to the signed face as
the first. The SELECTED PARENT rides along as a **realization pin** — not an
identity source, but the picture of the choices already made: *keep everything
exactly as this shows; change only the delta.*

## D-145 — A stated placement is never relocated.

Founder ruling, 2026-08-04.

Pre-gate, *"chest tattoo of two swallows"* rendered on the **collarbones**. That
is silent substitution in space — the mullet-becomes-wolf-cut disease, one
dimension over: the user named a thing, the model produced something adjacent,
and nothing said so.

The gate refuses that class now, but the law generalises to placements that DO
render: *"a rose on her left cheek"* must never land right. The placement is
carried into the prompt as an explicit, non-negotiable clause with
failed-candidate teeth, rather than left inside a sentence the model may
paraphrase.

**Render where stated, or refuse naming the wall.**

## D-146 — In an edit, a colour word is a dye job unless told otherwise.

Measured 2026-08-04. "Copper" came back saturated traffic-cone orange; "black"
came back faintly dyed.

The colourist palette is right for the ROLL, where the colour is drawn on a
fresh head and reads as hair. Used as an EDIT on existing dark hair, the same
words render a dye job — because recolouring dark hair is literally what that
is. So the refine adds what the roll never needed to say: *natural hair rather
than a dye job, dimensional rather than flat, deeper at the roots, grown rather
than freshly coloured, never poster-bright.*

Applied at the refine's prose rather than in the palette, because the palette is
correct for the sheet and only wrong for the edit.

**Partially resolved, honestly.** Copper is visibly more dimensional than
before and still reads vivid; black reads blue-black. Recorded rather than
iterated on, because this is now a taste conversation the founder is one look
away from being able to have.

## D-147 — Stack the real thing and compare. The instrument lesson.

Recorded 2026-08-04, and it is why both defects shipped.

Every driver tested ONE edit against a fresh candidate. **Both defects only
exist in a stack** — a facet collision needs two instructions about one thing,
and a realization re-roll needs an unrelated edit to happen afterwards. A
single-edit harness cannot see either, however many times it runs.

`drive-refine-stack.mts` scores prior-edit survival: after edit N, is edit 1
still visibly there? That is the question a user asks and the one no previous
instrument could answer.

**It carries a FIXED PAIR**, founder-supplied: the mullet stack that must NOW
pass, and the fox-eyes stack that must STILL pass. Keeping both is the point — a
fix that made the mullet pass by loosening what the fox-eyes stack depended on
would look like success against one and be a regression against the other.

## D-148 — "Fox eyes" joins the eye-shape vocabulary, stated-only forever.

Founder ruling, 2026-08-04, earned by verified demand rather than by guessing.

The tenth eye shape, and the first with a **trend-name key** rather than an
anatomical one: the word people actually type is "fox eyes", so that is the key,
with the anatomy behind it — lifted outer canthus, elongated palpebral fissure,
high canthal tilt.

**Two riders, and both generalise past this word.**

**(1) The registry gains value-level metadata: rollable vs stated-only.** Fox
eyes is **stated-only forever** — a styled, of-the-moment look that the dice
must never deal unbidden, which is the faith-covering filing (D-124) applied to
aesthetics rather than to belief. The distinction has never existed at value
level before: axes were rollable or not, but a single axis can hold both kinds
and now says which is which.

**(2) Bare-term ownership.** "Fox eyes" alone files as SHAPE. "Fox eye liner"
and "fox eye makeup" reach the makeup reading. The founder had to type *"not
makeup"* to get the structural read — **that workaround is the defect**, not a
usage note. A term that needs a correction phrase to reach its commonest meaning
is a term filed wrong by default.

## D-149 — The ambiguity class: every promoted word declares its bare-term owner.

Founder ruling, 2026-08-04, generalising D-148's second rider.

Beauty language systematically overloads across **structure | makeup | styling |
temporary state**: contoured cheekbones, fuller lips, arched brows, freckles,
glowy skin, a beauty mark, tired or kind eyes. Each can be a fact about a face,
a thing painted on it, a way it is worn today, or a mood — and the parser has to
pick one before it can file anything.

**The rulings:**

- **Every promoted word declares bare-term ownership at promotion**, per word,
  on evidence rather than on intuition.
- **A bare colour word means born-with**, and gets the colourist prose. A dye is
  reachable by SAYING it is a dye, and files as styling — consistent with
  D-146's finding that an edit reads a colour word as a dye job unless told.
- **The variant chip displays the filed subject** for every instruction.
  **Filing decides Follow inheritance**, so a misfile corrupts the RECORD and
  not merely the render — which makes the filing a thing the user must be able
  to see and correct.
- **Correction phrases always work.** Owning the bare term never removes the
  ability to say which reading was meant.

## D-150 — Vocabulary priority: effort goes where the prior fights.

Founder observation, 2026-08-04, from two dogfood sessions.

Lip geometry MOVES — "more defined cupid's bow" landed. Nose does not, three
times measured now. **The prior resists unevenly**, so the engineered-vocabulary
queue is ordered by resistance rather than by how sayable a feature is.

Nose keeps first place and gets the full anatomical treatment. Lips likely need
only light touches. Writing elaborate prose for a feature the model already
honours is effort spent where nothing was wrong.

## D-151 — The Refine self-improvement loop: self-measuring, never self-modifying.

Founder design, 2026-08-04. D-115 applied to taste.

**(a) The satisfaction ledger ships early.** Per-instruction outcome signals —
selected, backed-up, rephrased, corrected — because **a signal not collected is
lost forever**, and the dogfood era is the richest labelling this product will
ever get.

**(b) The delivery judge.** An async vision pass per render: parent versus
variant versus instruction, answering delivered / not / unsure in D-108's
one-field shape, persisted on the variant. **Shadow-only, never money.**
Calibrated against the dogfood's own labelled fixtures — mullet, rose and fox
eyes delivered; button nose not — before any verdict of its own is believed.

**(c) The word report lives in the ADMIN DASHBOARD**: a term table (asks,
delivery rate, corrections), the delivery × satisfaction 2×2 that separates
needs-vocabulary from needs-taste from misfiled, and a READY queue carrying
driver evidence, with a badge on the admin nav.

**The boundary is built in from birth**: aggregates only, never an individual
user's instructions in context, never customer render thumbnails — the
staff-image-boundary family. Proposer test renders use **system fixtures, never
customer casts**.

**(d) The shadow proposer** drafts and driver-tests candidate prose for
resistant terms and files READY reports. **Proposals are never deployments**:
the founder ratifies with one word, D-89's goldens gate every ship, and the next
report shows the production delta.

Sequencing: the ledger rides near-term; judge, report and proposer queue after
the Body-Art Studio.

## D-152 — Recipe v3: pixels teach, words remember.

Founder dogfood round 2, stop-the-line, 2026-08-04.

Six edits deep the gauntlet is **visibly blurred** while every facet is
perfectly intact. v2's realization pin worked and cost quality: conditioning on
the selected parent inherits its softness, its tone-crush and its vignette once
per generation. **Photocopy loss through the pin.**

**The caption pattern.** A realization is a FACT about how something looked, and
a fact keeps better in words than in a re-photograph of a photograph. After a
render lands, a vision pass reads it back in precise language — the specific
mullet, the exact blue-black — and every later render returns to **ONE step from
the sharp original**, carrying captions instead of parent pixels.

Quality anchors to the original forever, because there is no chain of pixels for
softness to accumulate along.

**Two named driver cases**, both required:

**(a) The six-edit gauntlet replayed** — facets AND quality both held. The
driver gains a **quality axis**: sharpness and tone scored mechanically against
the original per render. D-147 extended, and for the same reason it existed:
degradation was invisible to a facet-survival-only instrument.

**(b) Restatement is idempotent.** Under v2, copper conditioned on
already-copper parent pixels brightened — re-dyeing dyed hair. Under v3 the
parent is not in the frame, so **copper on copper renders the same copper**.

**Interim, while v3 lands:** a deep-stacked variant should not be Signed, because
the Master would seal the blur. Recorded here at minimum, and quietly noted near
Sign where it can be seen.

Captions are captured only for the facets an instruction TOUCHED. Captioning an
untouched facet restates what the original already establishes as though it were
a change, and a few rounds of that has the words quietly replacing the
reference.

## D-153 — Ink placement classifies by VISIBILITY, not by region word.

Founder ruling, 2026-08-04, and it was a live bug.

The classifier asked *"is this a head word?"* when the question D-133 turns on is
*"can the ANCHOR see it?"*. Behind an ear, the nape, the scalp under hair: all on
the head, none in a chest-up frontal frame. Confirmed live — "a tiny star behind
her ear" passed as in-frame by matching on "ear".

Visibility is now checked FIRST and wins, which is what stops the substring
match. Verified: *behind her ear* gates, *on her cheekbone* renders.

**The head template joins the studio** (D-138 amendment): left profile, right
profile and back-of-head panels, tone-laddered like the rest — the home for
behind-ear, nape and scalp designs. **No apply step exists for them**, because
nothing is front-visible; their reveal is the side-profile canonical view at
Sign, conditioned on the document per the Gap-3 requirement and judged on design
identity. The confession copy is honest that worn-down hair may occlude the spot.

## D-154 — The refine panel owns its outcomes. Never a toast.

Founder ruling, 2026-08-04. D-110's own law, applied to Refine.

The founder's first failed refine arrived as a long, unreadable, uncopyable
toast, and wall refusals vanish before they can be read. **The surface is live
and owns the action**, so failures and refusals render IN THE PANEL and stay
until dismissed — and they are selectable, because a support conversation starts
with copying the text.

Refusal copy that carefully names its wall is worthless at 2.1 seconds.

## D-155 — Remove is paid and says so; backing up is free and says nothing.

Founder ruling, 2026-08-04.

D-121 required that removing a mid-stack instruction and backing up never look
alike. In practice remove barely looked like anything and the founder could not
find it. **Two different things must look like two different things** — so
remove is visible on the instruction chips carrying its price, while backing up
stays free navigation between pictures that already exist.

## D-156 — D-146 CLOSES: colour rendering exonerated.

Founder finding, 2026-08-04.

The vividness was isolated to **same-facet stacking under recipe v2** — copper
conditioned on already-copper pixels. On clean branches from the original, both
bare "copper hair" and "natural copper hair, dark roots" render well. **No prose
iteration is needed**, and the guard is permanent: D-152's idempotence driver
case is this finding's regression test.

A reminder worth keeping: the prose was suspected for a day and was never the
problem. The recipe was.

---

**End of decision log.** Ratify, amend, or veto per line; the build plan follows your pass.
