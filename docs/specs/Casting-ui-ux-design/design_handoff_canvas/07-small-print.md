# 07 — Small print (magic numbers & seams)

## Numbers that matter
- Node x-clamp ≥ 40, y-clamp ≥ 4; drag threshold 3px (|dx|+|dy|).
- Selection boundary pad 9px; group frame pad 16px; group label bar 30px above the frame; group drag ring extends 16px outside the frame.
- Pins: 22px, 30px off the card edge, 40px vertical rhythm; wire handle offset clamp(56, dx·0.55, 150).
- Cut: hit path 16px; gap clamp(14, L·0.34, 34); dasharray `(L-gap)/2 gap L 0` (four values — see doc 03); mark scales gap/34; tangent sampled ±6px around midpoint.
- Lineage growth: 12 passes each direction (bounded fixpoint).
- Context menu 232w, est. 404h/344h, 12px edge margin, flips toward the pointer.
- Picker flip threshold 412px below the chip.
- Selection ring 1.5px ink vs 1px border idle.

## Interaction rules easy to miss
- An input pin holds ONE wire; wiring into it replaces the old wire silently.
- Ghost-wire drops enforce out→in; any other pairing dissolves.
- Right-click outside the selection re-selects before opening the menu.
- Empty-floor mousedown inside a group's frame drags the group; outside it marquees.
- Card controls (button/input/textarea/[data-run]) never start drags or selection.
- Wire cut clicks stopPropagation so they never marquee.
- Edges are re-measured from live DOM every render — resize, font-load and drag all self-heal (`drawEdges` re-runs on resize + fonts.ready + timeouts 120/500/1200ms after mount).
- Disabled pins carry `title` tooltips explaining the exclusivity rule.

## Known prototype seams (do not replicate)
- **Two scenes, hard-coded hex per theme** — build one tokenised scene (README).
- The four nodes are fixed demo content; Add-tool buttons and several menu items are visual affordances without behaviour (Align, Duplicate, Distribute…).
- The picker's placement lacks the containing-block correction the studio version gained — use the studio's engine (`design_handoff_studio/04-model-picker.md`).
- No zoom/pan implementation (Pan mode is a mode button only); no undo; no persistence — positions/edges/groups live in component state.
- Node media wells show placeholder captions instead of real thumbnails.
