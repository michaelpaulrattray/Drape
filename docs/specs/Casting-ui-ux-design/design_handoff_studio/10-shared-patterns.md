# 10 — Shared patterns (the grammar everything is built from)

## Section header
Mono eyebrow (9.5–10px, .12em, `--meta`) · flex hairline (1px `--rule`) · right slot = count (`--faint`) or a link ("All in library" + arrow, `--metaStrong` → `--ink` on hover). Used on Home sections, Library groups, Canvas tab, marquee band.

## Media card
Image slot at true ratio in a radius-10/11 well (`--media` bg, 1px `--border`, hover `--lineStrong`). Pills ON media: mono 8.5px, .06em, white on rgba(17,17,18,.66–.72), radius 999. Text BELOW media (never overlaid on short cards): title 11–12.5px 500, meta 10–10.5px `--metaStrong`, mono time `--faint` right. Grid gap 12px.

## Dashed create tile
First in every collection grid (New canvas, New cast member, Upload): 1px dashed `--dashed`, hover = `--ink` border + `--wellSoft` bg, plus icon + 11.5px label. The create action never hides behind the collection.

## Hover reveal (action rows on media)
Row = bottom gradient scrim (to top, rgba(17,17,18,.72) → transparent) with 25–28px glass icon buttons (`--barGlass`, hover `--surface`). Revealed by hovering the **card**, not the row — parent-hover needs one real CSS rule: `[data-hoverfade]{opacity:0} [data-hoverhost]:hover [data-hoverfade]{opacity:1}`. Standard set: Use as reference · Download · Copy image · Save to assets.

## Toast
z-80 bottom-centre: `--ink` pill, 5px accent dot, 11.5px `--surface` text, `dsrise` in, auto-dismiss ~2.1s. Every non-navigating action confirms with one.

## Segmented control
Pill-in-well: wrapper `--fillStrong` radius 8–9, active segment `--surface` + 500 weight + 0-1px-2px shadow, inactive `--metaStrong`.

## Motion vocabulary
`dsrise` (rise-in .2–.34s) for arriving content · `dssweep` shimmer for pending media · `dspulse` for live dots · `dsspin`/`dcspin` for spinners · `dswave` for playing audio · `dsmarq` for the template marquee. All under `prefers-reduced-motion: none`.

## Popover discipline
Every dropdown: capture-phase click-away keyed on a data-marker; Escape closes; fixed-position panels measure their chip AND correct for containing-block ancestors (doc 04); close on outside scroll, never on internal scroll.

## Aspect-ratio sizing rule (three bugs came from this)
When a box must honour a ratio inside a constrained pane: make the pane `container-type:size`, set ONE axis derived from the other (`width:min(cap, 100cqh × ratio); height:auto; aspect-ratio:R`). Never pin one axis and cap the other — `aspect-ratio` only resolves an auto axis.
