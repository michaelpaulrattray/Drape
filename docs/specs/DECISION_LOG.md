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

**Nothing from brief §4 was rejected**; D-11/D-13/D-20 accepted with modifications noted. **One locked rule is amended (D-8)** — with the explicit argument the brief invited; everything else in the locked ledger (reference-asset framing, inline-first, root/view model, edges-as-lineage, the non-negotiables, sentence case / two weights / hairlines / no modals) is preserved unchanged.

**End of decision log.** Ratify, amend, or veto per line; the build plan follows your pass.
