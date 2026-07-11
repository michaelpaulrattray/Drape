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

### D-39 — Canonical identity package + tiered mint *(PROPOSED — assessment delivered, awaiting founder ratification; no build until then)*

**What (founder brief, 5a–5e):**
- **(a)** The canonical package is **six slots** — front headshot (default cast output), side profile, three-quarter, full-body front, full-body back, plus one further slot to be confirmed at ratification (five were named; the current system's sixth canonical view is full-body side). Face cluster (headshot, side profile, three-quarter) locks facial identity; body cluster locks silhouette/build for VTO and scene work. Back views need an identityCheck-style verification gate before joining the package (angles research: person-rotation hallucinates past ~120°).
- **(b)** The mint dialog's "generate side view (recommended)" is replaced by **tiered packages**: **Draft** (headshot only — always allowed; exploring candidates), **Core identity** (+ side, ¾, full-body front; ready for downstream work), **Production sheet** (all six; full comp card for scenes/video). Each tier shows its credit cost per D-15, and the copy explains what each tier is FOR.
- **(c)** Package completeness is a **first-class model property**: the R5 sheet renders empty slots with add-view affordances (upgrade anytime, no re-cast); D-30's composer degrades gracefully and records which slots it used per generation in the `InputSnapshot`.
- **(d)** Hard constraint on D-30: the composer operates under a **per-generation reference-image budget (~5–6 usable)** before identity fidelity degrades. Multi-model scenes fit inside it — per-model allocation drops to headshot + one task-relevant view, with the text identity description doing more work. Full-package-per-model is never the strategy; staged composition is the future escape hatch for 3+ subjects (logged, not scheduled).
- **(e)** Proposed landing in the R-sequence and per-slot capability/risk analysis: see the assessment doc; plan is rewritten only on ratification.

**Affects (on ratification):** studio view system (three-quarter slot is net-new), mint dialog (`CastModelModal` → tiered), D-29 sheet slots, D-30 composer + `InputSnapshot`, model-assets schema (per-slot status/pin home — see assessment collision), R-sequence.

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
