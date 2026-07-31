# 02 — Nodes

## Anatomy (every node)
- **Header line** (outside the card): kind icon (11px, `--meta`) + kind label 11px 500 `--secondary` + right-aligned instance name 11px `--metaStrong` ("Maya R.", "Klieg V2", "Seedance 2.0"). The header is part of the draggable node.
- **Card**: `--surface` bg, radius 10, ring = selection state (see doc 04). Media well + (on generator nodes) a prompt footer.
- **Media well**: NEUTRAL for every kind — light `repeating-linear-gradient(45deg,#F1F1F3 0 10px,#E8E8EB 10px 20px)` (= --media/--borderMedia stripe), dark `#232326/#2A2A2E`. A mono caption sits at the bottom ("source · flat", "output · 4:5"). **No per-kind colour** — this was deliberately removed; kind is carried by the header icon + label only.
- **Prompt footer** (generator nodes): 12px/1.55 editable prompt text + Run/Stop button, 1px `--rule` top border.

## The four archetypes on the demo board
| Node | Width | Role | Pins |
|---|---|---|---|
| Product (upload) | 232px | source | 1 out (g-out) |
| Avatar · Maya R. | 232px | locked identity source | 1 out (c-out) |
| Try-on · Klieg V2 | 288px | generator, SELECTED by default | 2 in filled (t-img1/t-img2) + 1 open in + 1 out (t-out) |
| Video · Seedance 2.0 | 384px | generator, GENERATING | 1 open in, 1 filled in (v-img), 1 DISABLED in, 1 open out (v-out) |

## Pins
22px circles floating 30px off the card edge (left = inputs, right = output), vertically spaced 40px.
- **Filled/wired**: ink disc (`--ink` bg, white glyph, small shadow).
- **Open**: `--surface` bg, 1px `--lineStrong` border, muted glyph.
- **Disabled**: open styling + `title` tooltip explaining why ("Video reference unavailable while an image is connected") — mutually-exclusive inputs are shown, not hidden.
- Glyphs are 11px kind icons (image/person/video/text).

## Generating state (Video node)
- A blurred warm→coral→periwinkle gradient **halo** behind the card (inset 16/-12/-12, blur 24, .5 opacity) — the one sanctioned decorative gradient; it means "running".
- Media well: conic spinner ring (donut mask, `dcspin` 1.6s) + "Generating · 14s".
- 3px progress bar under the media: warm gradient, `dcprog` animation.
- Run button becomes **Stop**.

## Costs
COST map: Product 0 · Avatar 0 · Try-on 2 · Video 12 credits. Multi-select and group bars sum member costs into their Run labels.
