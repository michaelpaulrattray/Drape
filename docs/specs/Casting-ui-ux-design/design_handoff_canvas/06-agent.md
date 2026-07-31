# 06 — The canvas agent

## Orb
The brand orb with a **breathing halo** (design 2f from the explorations): conic warm→coral→periwinkle core, soft halo ring animating scale/opacity (`obreathe`/`ohalosoft` family). The orb is the agent's presence; it sits on the chat chip and panel header.

## Chat panel
Toggled from the chrome (open/closed per theme in the prototype). Closed state shows a compact pill when nothing is selected. Open panel:
- **Plan rows** — what the agent proposes next, as concrete node operations with costs: "Video · Seedance 2.0 — 6s walk cycle, 16:9 · from Try-on v3 — 12cr", "Reframe · 9:16 — waist-up crop, keeps the garment in frame — 6cr". Plans reference REAL graph nodes, not abstract suggestions.
- **Idea chips** — one-line starters: "Hold this cast, swap in the linen set" · "Three ad variants from the winning frame" · "Upscale the try-on to 4K before the cut".
- Input line for talking to the agent.

## Behavioural contract
The agent reads the graph (wired inputs, kinds, locked identities) — the same read that powers the picker's intent band. Its output is always expressed as graph edits (add node, wire, run scope) with credit costs shown before anything runs.

## Stale + queue
The queue pill (doc 01) is the agent-adjacent status surface: running count while jobs run; the stale state marks the board as edited-since-last-run and is where "re-run what changed" affordances hang.
