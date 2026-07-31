# 03 — Wires, lineage & cuts

Wires are drawn imperatively into the scene SVG on every update (`drawEdges`), measured from the LIVE pin positions — so they track drags with zero lag.

## Geometry
- Edge list: pairs of pin ids, default `[[g-out,t-img1],[c-out,t-img2],[t-out,v-img]]`.
- Cubic curve, horizontal handles: `off = clamp(56, |x2-x1|·0.55, 150)`; endpoints at pin centres, scaled by the scene's current CSS scale.
- Stroke 1px. Base colour `--muted` (#B4B4BA light / #8E8E96 dark).

## Lineage highlight (the selection story)
When nodes are selected, the highlight is not just their wires — it is the **entire lineage**: grow the selected set through the edge pairs upstream (all ancestors) then downstream (all descendants), 12 passes max. Every wire whose BOTH ends are in the lineage renders in `--ink` (white in dark); everything else stays muted. Select the Try-on and the whole Product→Try-on→Video chain lights up.

## Rewiring (drag a pin)
- Mousedown on a pin starts a **ghost wire**: 1px dashed (5 4), .75 opacity, from the pin centre to the cursor.
- On drop: find a pin under the cursor. Valid only if one end is an `-out` and the other an input, and the pair doesn't already exist. **An input accepts one wire** — wiring into an occupied input REPLACES its existing wire (filter old, concat new). Invalid drops just dissolve the ghost.

## The cut affordance (broken-link, no scissors)
Hovering a wire (16px invisible hit path) previews the cut:
- The wire itself **tears open in the middle**: dasharray `(L-gap)/2, gap, L, 0` — four values, because an odd-length pattern would repeat and tear a second gap. `gap = clamp(14, L·0.34, 34)`, measured live via `getTotalLength` so mid-drag geometry never leaves a stale gap.
- In the gap, a **broken-link mark** (two curled wire ends with frayed ticks, 1.4px stroke, ink) fades in, positioned at the path midpoint and rotated to the local tangent (sampled ±6px around L/2), scaled `gap/34` so short wires get a proportionally smaller mark.
- Click = cut (edge removed from state). Mousedown is stopped so a cut never starts a marquee.
- Leaving hover restores the solid wire and hides the mark.
