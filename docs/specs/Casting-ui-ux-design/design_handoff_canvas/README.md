# Klieg Canvas — editor prototype handoff

**To:** the agents building the canvas editor
**From:** design
**Reference file:** `Klieg Canvas.dc.html` — fully interactive: drag nodes, drag pins to rewire, hover a wire to cut it, marquee-select, right-click, open the model picker, group a selection, toggle the theme. Where a doc and the file disagree, **the file wins**.
**Companion package:** `design_handoff_studio/` (the lobby + all tabs). The Canvas *tab* that lists boards lives there; THIS package is the editor you land in when you open a board. Same foundation, same tokens, same type.

## The one build-order warning

The prototype renders **two parallel scenes — one light, one dark — with hard-coded hex per theme** (a prototyping shortcut; the theme toggle swaps scenes). Do NOT replicate that. Build ONE scene on the token system (`tokens.css` here, same as the studio package); the file's light values map 1:1 onto tokens (#FFFFFF=--surface, #F1F1F3=--media, #ECECEE=--border, #111112=--ink, #8E8E94=--meta, #6B6B70=--metaStrong, #B4B4BA=--muted, #E4E4E7=--borderCard, …). The duplicated scenes are also why every interactive popover exists twice in the file — read one, build one.

## Docs

| Doc | Covers |
|---|---|
| 01-chrome | Top bar, left toolbar, queue pill, account stack, theme |
| 02-nodes | Node anatomy, the four archetypes, pins, costs |
| 03-wires | Wire drawing, lineage highlighting, rewiring, the cut affordance |
| 04-selection | Selection model, marquee, multi-select bar, groups, context menus |
| 05-node-toolbar | The floating strip under a selected node + model picker + run scopes + refs |
| 06-agent | The canvas agent: orb, panel, plan, ideas |
| 07-small-print | Every intricacy and magic number, plus known prototype seams |

## Ground rules (same as the studio)
- Accent = state only (selection, running, kept, locked). Idle canvas shows zero accent.
- All node media wells are **neutral** — one stripe/flat treatment for every node kind. Colour never encodes node type.
- Archivo UI + JetBrains Mono metadata. No raw hex once tokenised (exceptions: white-on-scrim, the orb gradients, the generating halo).
