# Pass 4 — Video / animation nodes (vision note, not a spec)

**Purpose:** capture the founder's intended end-state so passes 1–3 are architected with it in view. Nothing here is built in pass 1; pass 1 must simply not foreclose it.

> **PLANNING POINTER (founder-directed at VC-R5, 2026-07-12 — read before planning pass 4):** the founder holds hands-on Seedance prompting experience from a prior project (segment discipline, reference conventions incl. single-sheet-per-character, continuity-ledger patterns for multi-segment consistency). Do NOT treat any pre-written conventions in this file as current at pass-4 time — video models move fast and this knowledge is a snapshot. Pass-4 planning starts with **(1)** a fresh capability review of the then-current Seedance version, and **(2)** a working session with the founder to extract which of his conventions still hold. The video node's aesthetic layer builds from `TOOL_PROTOTYPES_NOTES.md`'s Set/Moment/Technique vocabularies (fashion-film direction language) regardless — the mechanical layer gets re-derived fresh.

## The vision

The canvas becomes a full creative pipeline with identity lock end to end: cast a model → dress them (wardrobe VTO) → compose scenes/angles via image-gen nodes (any engine) → **animate the outputs with video generation, on the same board.** Drape's differentiator across all of it is the identity layer: every downstream node inherits the locked model identity through lineage edges. Competitors offer the graph; none offers the identity guarantee.

## Architectural shape (intended fit with existing primitives)

- **Node:** `kind: "video"` — one additive enum value on `board_items.kind`.
- **Provenance:** e.g. `{ type: "img2video"; engine: "seedance"; sourceItemId: number; prompt: string; durationSec: number }`. Text-to-video later adds a sibling provenance type; same kind.
- **Inputs:** the standard blue image pin accepts any upstream node's output (cast view, VTO result, image-gen output) as the driving frame; purple prompt pin for motion direction. Lineage edges carry identity exactly as for image nodes.
- **Card:** video thumbnail with hover/press play; duration badge in the control strip (`0:12 · v2 · ···`); engine label top-right per NodeLabelRow. Generation cost shown before Run (video is credit-expensive; the views-popover cost-total pattern is the precedent).
- **Refinement studio:** video nodes get their own tab set eventually (trim, reprompt, upscale); pass 4 minimum is prompt + rerun + version history, reusing the existing studio hosting.

## Engine notes — Seedance first

First engine: Seedance (founder has deep prompting expertise with it). Encode these conventions in the video node's prompt layer when built:

- Shots ≤ 15 seconds; longer sequences are multiple nodes chained left-to-right (each node's output frame can seed the next).
- Structured prompt construction (subject / action / camera / atmosphere) rather than freeform — the node UI can scaffold this the way blender chips scaffold casting.
- Motion direction belongs to the video node's prompt, never baked into the upstream image prompt.

## Voice as identity attribute (logged at VC-R5, 2026-07-12 — concept only)

A cast model may carry an **assigned voice**: `voiceId` + `provider` on the model record (ElevenLabs API first), assigned in the casting environment alongside identity (reference: ElevenLabs' own Create Avatar "Default Voice" pattern — screenshots in `docs/specs/references/`). The comp card gains a small voice affordance when assigned. D-30's composer extends: video-with-dialogue generations include the voice reference in the payload — **identity lock extends to audio**. Pipeline questions (Seedance-native audio vs ElevenLabs TTS + lip-sync; per-generation voice cost in the D-15 ledger) are pass-4 integration work; only the attribute concept is logged now.

## Engine-aware payload + two comp-card classes (logged at VC-R5, 2026-07-12 — extends D-30)

The composer's payload strategy diverges by generation class:

- **Image engines** get individual references (D-30 strategy b, ratified, unchanged).
- **Video engines (Seedance-class)** get ONE sheet per character — slot economy: two sheets + storyboard + prompt fits the reference budget; loose images don't. *(Convention caveat: one-sheet-per-character is the CURRENT Seedance convention — re-verify at pass 4 per the planning pointer above.)*

The video-bound sheet is usually the **STYLED comp card**, not the canonical one: by video time the character has been dressed via wardrobe/VTO, and no photo set of the dressed model exists to composite. The styled sheet is therefore itself a GENERATION — a pass-3 image-gen capability (**"Make styled comp card"**) that takes the dressed output + canonical identity references through the composer and produces a multi-angle dressed sheet in one image (paid, identity-gated like any generation). Two comp-card classes:

1. **Canonical** — the identity document; R5's rendering; server-side flatten for export/lookbooks (same renderer frames-as-export needs).
2. **Styled** — per-outfit production sheet, generated on demand; the video pipeline's primary character input.

The composer manifest records which sheet class fed each generation.

**Design principle rider (founder-ruled, log as principle):** node inputs are never prescriptive — the composer adapts to whatever references the user actually wired (canonical sheet, styled sheet, single VTO output, loose uploads, any mix), composing the best identity payload from what's present and degrading gracefully. The styled comp card is a CAPABILITY users may generate when they want production-grade video prep, never a required pipeline stage. **Guarantees over workflows:** each node promises an outcome (consistent identity / effortless dressing / identity-locked motion) and accepts flexible inputs toward it.

## Adaptive derived reference-sheet recipes — founder-directed, calibration-gated D-30 extension *(logged 2026-07-16)*

Operational design for **downstream engine payload composition** — deliberately kept out of `IDENTITY_EDIT_INTERIM_POLICY.md`, which governs identity-document writes, not delivery payloads. This does **not** replace ratified D-30 strategy (b); it is strategy (b)'s capability-aware escalation path for consumers that benefit from a single reference image. A pointer lives beside the D-30 entry in `DECISION_LOG.md`.

**Terminology:** internally these are **derived reference sheets**. Drape's user-facing composite remains the **comp card** (D-51), and "call sheet" is avoided — it means something else in film production.

### User experience

- The user connects a Cast node **once**. The connection means "use this person," not "send this displayed image."
- Drape's server selects the best identity payload for the chosen engine, model version, and task.
- Reference-sheet strategy is automatic, never a normal user setting; a manual override may exist later only as an advanced diagnostic control.

### Payload profiles (per-engine, calibration-gated)

- **Multi-reference engines** continue with D-30 (b): anchor + task-relevant intent view + identity text.
- **Single-reference engines** may receive a deterministic **derived reference sheet**.
- **Engines sensitive to multiple visible faces** receive a **single-visible-face sheet**.
- **Portrait-only** remains a fallback where calibration shows it performs best.
- **Four-panel sheets** are allowed only where engine calibration proves they outperform the three-panel version.

### Three-panel reference sheet (the general derived sheet)

1. A dominant `frontClose` portrait.
2. `frontFull` for body proportions.
3. One **task-selected** view: `backFull` (general rear silhouette and rear hair) · `sideClose` (profile intent) · `threeQuarter` (facial/body angle intent) · the walk view — the `sideFull` slot per D-44 — (movement and video intent).

The side view remains important canonical evidence; it is not discarded merely because it is not present in every delivery sheet. For engines proven tolerant of richer sheets, a **four-panel** profile may use: dominant portrait · full front · side/profile · full back.

### Single-visible-face profile

For engines where multiple visible faces increase identity drift:

- The dominant portrait is normally the only visible face.
- The front-body panel is **cropped geometrically** from shoulders/clavicle to feet.
- A rear full-body panel may remain (no face visible).
- **Never** blur, pixelate, paint over, mask, or place black bars across body-panel faces — generators reproduce those artefacts.
- For a specifically profile-led task, calibration may determine whether the side profile replaces the frontal portrait as the sheet's single visible face.

### Prompt accompanying the reference sheet

The instruction travels outside the image pixels, e.g.:

> "The same person is shown in these reference panels. The portrait defines facial identity. The other panels provide body proportions, pose and silhouette only. Do not reproduce the sheet layout."

No text, labels, or metadata are ever rendered into the reference-sheet image itself.

### Authority and source eligibility

A canonical derived reference sheet may use **only**: the current authoritative identity anchor; current-revision compatible canonical views; filled and successful assets; fresh views (unless an explicitly accepted pinned-final rule is later calibrated for a specific engine). It must **never** include: stale assets; failed assets; cross-revision assets; unknown-authority legacy assets; display-only headshots standing in as identity authority; or Canvas/Wardrobe outputs pretending to be canonical cast views. The identity anchor remains authoritative even when the displayed headshot differs (the anchor/display split in `IDENTITY_EDIT_INTERIM_POLICY.md` §7).

### Deterministic assembly and cache behaviour

Canonical derived reference sheets are assembled **mechanically — no AI generation**. They are derived delivery assets: never canonical `model_assets` views, never identity writers, never permitted to alter the identity document, never treated as new identity evidence.

Cache/version key, at minimum: model ID · identity revision · recipe version · engine/model capability-profile version · task/intent view · constituent asset IDs or content hashes · crop/transformation configuration. Invalidate or regenerate when any included identity revision, source asset, recipe, or engine capability profile changes.

Rendering: neutral background; narrow gutters; no labels, logos, shadows, or decorative comp-card chrome; no overlapping figures; no face blur, pixelation, masks, black bars, or painted-over facial areas; enough resolution preserved for the dominant portrait.

### Canonical versus styled reference sheets

Two distinct classes — never confused:

- **Canonical derived reference sheet** — built deterministically from the cast's authoritative current-revision assets; communicates identity, body proportions, angles, and silhouette; neutral casting presentation; regenerable **without image-generation credits** (it is an image-composition operation, not a generation).
- **Styled comp card / reference sheet** — a separate **paid generation** created from Wardrobe/VTO or dressed-scene evidence plus canonical identity references; represents a particular outfit or production look; **not canonical cast identity**; identity-gated with its own provenance; never writes styling back into the cast identity document; its internal panels are not independently authoritative or safely croppable unless its manifest explicitly records panel roles and coordinates; may be selected as the video character reference when it is the most relevant wired input.

The composer adapts to what the user connected (the D-30 design-principle rider above), but it must not silently convert a neutral Cast connection into a styled identity asset.

### Video start-frame boundary

A derived reference sheet is **character-reference material only** — it must never be used as the video start frame. Character-reference input → identity guidance; start-frame input → the actual composed scene to animate. If a video engine accepts only a start frame: (1) generate the actual scene still through an image-generation node using the cast identity payload; (2) pass that composed scene image to the video node; (3) animate that scene image. Never ask a video model to animate the reference-sheet grid.

### Calibration profiles

Calibration is required per engine × model version × task class × reference-input capability. Compare: (1) D-30 anchor + intent view + identity text; (2) full three-panel sheet; (3) single-visible-face three-panel sheet; (4) portrait-only; (5) four-panel where appropriate; (6) canonical vs styled reference input where both apply. Measure: facial identity retention · body/proportion fidelity · side/profile fidelity · hair-silhouette fidelity · unintended extra people · montage/grid reproduction · pose adherence · cropping/masking artefacts · outfit bleed into identity · drift across video segments.

**A recipe is never enabled because it looks sensible** — only after calibration demonstrates a benefit for that engine/model/task profile. Capability profiles are versioned, because hosted model behaviour changes under the same name.

### Provenance and manifest

Record: engine and exact model version · capability-profile version · reference-sheet recipe version · sheet class (canonical/styled) · identity revision · source asset IDs and exact URLs · panel roles and view angles · crop/transformation coordinates · derived sheet URL and content hash · identity text · requested intent view/task class · **the exact final reference payload sent to the provider** · for styled sheets, the wardrobe/VTO/source-output provenance used. D-12 provenance snapshots both the final sheet actually sent and its constituent-source manifest.

### Tests and future verification

Future implementation must prove: the user connects the Cast node only once; the server selects the recipe automatically; current-revision sources are used; stale/cross-revision sources are refused or excluded; a derived sheet cannot become identity authority; single-visible-face recipes contain exactly one visible face; side/profile evidence is selected for profile tasks when the calibrated profile calls for it; a reference sheet can never enter the video start-frame field; cache invalidation follows identity and recipe changes; provenance reproduces the exact payload decision; canonical and styled sheets cannot be confused.

**This remains future planning.** The composer adapter, sheet renderer, image node, and video node are not implemented now.

## What pass 1 must therefore preserve

1. `kind` stays an extensible enum; renderers dispatch on kind + provenance (already the design — keep it).
2. `runGeneration` / job-tracking primitives must not assume image output (byte type, single-file result, or synchronous-ish latency). Video jobs are minutes-long: the in-flight job store and node progress UI should tolerate long-running jobs with progress states from day one, even if only images use them in pass 1.
3. Storage layer already handles arbitrary content types via R2 — verify the CSP/media serving path won't need special-casing for `video/mp4` (media-src vs img-src).
4. The floating tool pill's design should visually accommodate a fourth tool entry without redesign.
