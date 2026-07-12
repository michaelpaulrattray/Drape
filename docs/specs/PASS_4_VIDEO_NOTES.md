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

## What pass 1 must therefore preserve

1. `kind` stays an extensible enum; renderers dispatch on kind + provenance (already the design — keep it).
2. `runGeneration` / job-tracking primitives must not assume image output (byte type, single-file result, or synchronous-ish latency). Video jobs are minutes-long: the in-flight job store and node progress UI should tolerate long-running jobs with progress states from day one, even if only images use them in pass 1.
3. Storage layer already handles arbitrary content types via R2 — verify the CSP/media serving path won't need special-casing for `video/mp4` (media-src vs img-src).
4. The floating tool pill's design should visually accommodate a fourth tool entry without redesign.
