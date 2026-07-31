# 04 — Selection, marquee, groups, context menus

## Selection model
- `sel` = array of node names; default selection is the Try-on node (the only place a default is defined).
- Click selects (ring: 1.5px `--ink`; unselected: 1px `--border`). Shift/⌘-click toggles membership — removing the last member re-selects the clicked node (never an empty click-selection).
- Clicking a card's controls (button, input, textarea, [data-run]) never selects or drags.
- Selecting a single generator shows its **node toolbar strip** (doc 05). Selecting ≥2 shows the **multi bar**.

## Dragging
- 3px movement threshold before a drag begins (protects click-to-select).
- All selected nodes move together, from their positions at mousedown. Clamp: x ≥ 40, y ≥ 4.
- The selection boundary box travels WITH the drag (recomputed from stored box + delta, then re-measured on mouseup) instead of lagging.

## Marquee
Mousedown on empty floor clears selection and starts a marquee rectangle (1px accent-free dashed box). On mouseup, every node whose rect intersects the marquee is selected and the boundary box is computed (union of node boxes + 9px pad).

## Multi bar
Floats centred 10px under the boundary box: "{n} selected" · Align · Group · Duplicate · **Run · {summed credits}** (Run only enabled when the selection contains a runnable node). Group converts the selection into a group.

## Groups
- A group = name + member list + a frame **derived from its members' union** (+16px) on every update — a member can never end up outside the frame (`syncGroup`).
- Frame: dashed boundary + a floating label bar 30px above (group icon, editable name — Enter/Escape blurs — member count, Run · summed cost, ungroup, collapse chevron).
- Dragging: the label bar, or any empty canvas INSIDE the frame (+16px ring), drags all members together; inputs are excluded from the drag.
- Ungroup dissolves the frame only — nodes stay put.

## Context menus (right-click)
Right-clicking a node outside the current selection selects it first. Menu is 232px, positioned at the cursor; **flips back toward the pointer** when within 12px of the right/bottom scene edge (est. heights: 404 single / 344 multi).

**Single node:** Run (⌘↵) · Re-run with variations ·—· Open in Create · Save to Assets · Download (⌘⇧D) ·—· Rename · Duplicate (⌘D) · Copy (⌘C) · Focus node (⌘.) ·—· Add comment (C) ·—· Clear output ⚠ · Delete node (Del) ⚠

**Multi ({n} NODES SELECTED):** Run selection (⌘↵) · Run forward · Re-run with variations ·—· Align left · Distribute evenly · Group into a subgraph ·—· Duplicate {n} (⌘D) · Save all to Assets · Download all (⌘⇧D) ·—· Clear outputs ⚠ · Delete {n} nodes (Del) ⚠

Danger rows in `--accentInk`-adjacent danger styling; separators are hairlines; shortcuts render as key chips. Escape closes menus/popovers; outside click closes via capture-phase listeners keyed on data-markers.
