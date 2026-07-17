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

**End of decision log.** Ratify, amend, or veto per line; the build plan follows your pass.
