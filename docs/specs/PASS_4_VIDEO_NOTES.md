# Pass 4 — Video / animation nodes (vision note, not a spec)

**Purpose:** capture the founder's intended end-state so passes 1–3 are architected with it in view. Nothing here is built in pass 1; pass 1 must simply not foreclose it.

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

## What pass 1 must therefore preserve

1. `kind` stays an extensible enum; renderers dispatch on kind + provenance (already the design — keep it).
2. `runGeneration` / job-tracking primitives must not assume image output (byte type, single-file result, or synchronous-ish latency). Video jobs are minutes-long: the in-flight job store and node progress UI should tolerate long-running jobs with progress states from day one, even if only images use them in pass 1.
3. Storage layer already handles arbitrary content types via R2 — verify the CSP/media serving path won't need special-casing for `video/mp4` (media-src vs img-src).
4. The floating tool pill's design should visually accommodate a fourth tool entry without redesign.
