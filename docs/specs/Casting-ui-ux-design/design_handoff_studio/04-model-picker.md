# 04 — Shared model picker

One component, two hosts: Home composer footer and Create dock footer. Identical to the picker on the Klieg Canvas floating toolbar — this is the app-wide pattern.

## Chip
Model name 11px 500 + chevron; hover `--fillStrong`. Label = manual pick if one was made this session, else the default model for the current tool (Image→Klieg V2, Video→Seedance 2.0, UGC/Lip sync→Klieg Live, …). Switching tool clears the manual pick.

## Panel (326px, max-height 396, radius 12, `--shadowCard`)
Top-to-bottom:
1. **Search models** row (static affordance in the prototype).
2. **Kind band** (well bg): tool icon + "Image models" / "Video models" / "Try-on models" / "Performance models" + right mono "set by the tool". The tool decides the model class; the picker never mixes classes.
3. **Intent band** ("FROM WHAT IS ATTACHED", `--wellSoft`): tiny conic-gradient orb + eyebrow; question line ("Maya is attached with one reference. What are you making with them?"); a ghost typed-intent input with ↵; mono footer "SOUNDS LIKE A STILL SET · RANKED BY CONSISTENCY". On canvas this reads wired nodes; in the lobby it reads attached context. It is the AI ranking explanation, not chrome — keep it.
4. **RANK BY** segmented: Cost / Speed / Consistency / Creative. Functional — reorders the list, updates the section header (CHEAPEST FIRST / FASTEST FIRST / MOST CONSISTENT FIRST / WIDEST RANGE FIRST).
5. **Model rows**: 26px tag tile (G/K/N/S) · name 12px 500 + capability 10.5px `--metaStrong` ("holds a face", "garment structure") · SUGGESTED pill on the top-ranked row · 5 score pips + mono spec ("4K · ~20s") · right-aligned credits. Active row = 2px `--ink` bar on the left edge. Click selects + closes.
6. Footer (well): "↑↓ move · ↵ select" + "{n} {kind} models".

## Placement engine (hard-won — copy it, don't reinvent)
- Panel is `position:fixed`, placed from the chip's `getBoundingClientRect()`.
- Opens downward unless space below < 240px AND above beats below; max-height = real available gap (min 180, cap 396) so it scrolls internally instead of clipping.
- **Containing-block correction:** an ancestor with backdrop-filter/transform/filter re-bases fixed children (the Create dock does). Walk ancestors for any containing-block-forming property and subtract that element's rect from the coordinates.
- Click-away closes (capture-phase, keyed on a `data-picker` marker). Page scroll closes it; scrolling INSIDE the panel must not (check the event path before closing).

## Model data (prototype table)
tag / name / capability / spec / credits / creative / consistency:
G GPT Image 2 · invents a scene · 2K ~14s · 3cr · 100/38
K Klieg Draft · loose and quick · 1K ~6s · 1cr · 62/26
N Nano Banana Pro · holds a face · 4K ~20s · 4cr · 48/100
K Klieg V2 · garment structure · 4K ~18s · 2cr · 40/80
K Klieg Fine · identity lock · 4K ~42s · 6cr · 26/92
S Seedance 2.0 · motion from a still · 1080p ~40s · 8cr · 74/66 (motion)
K Klieg Live · talking performance · 1080p ~55s · 9cr · 58/88 (motion)
