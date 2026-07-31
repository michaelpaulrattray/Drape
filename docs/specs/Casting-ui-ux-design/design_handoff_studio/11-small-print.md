# 11 — Small print (details easy to miss)

A sweep of intricacies that live in the prototype but are easy to skip when skimming the surface docs. The file remains the source of truth — this is the checklist to diff a build against.

## Global
- **Slot-id conventions**: every image well has a stable id (`ds-fd-*` feed, `ds-l-*` library, `ds-a-*` cast, `ds-as-*` assets, `ds-tpl-*` templates, `ds-qs-*` quick start, `ds-cd-{roll}-{i}` candidates, `ds-run-{seq}-{i}` run frames). The **marquee and the Templates grid intentionally share `ds-tpl-*` ids** — one artwork shows in both.
- **Project scope filters everything**: feed, wire list, library counts, casting roster, assets, suggestions, the composer's default cast. "All projects" is the union.
- **Keyboard**: viewer — Esc close, ←/→ page (wraps at both ends). Picker footer advertises ↑↓/↵ (visual affordance in the prototype). Composer Create button shows ⏎.
- **Every non-navigating action toasts**; navigating actions never do.

## Home
- Wire rows: spinner ring uses `--accentLine` with an `--accentSolid` top arc (live = accent; done = `--muted` check — accent-as-state rule).
- Quick-start slots are 4:3 while every collection card is 4:5 — deliberate, they read as doors not content.
- Mode switch resets manual model pick AND closes an open picker.

## Create
- Run strip: frames arrive sequentially; pending frames shimmer (`dssweep`) with a pulsing mono label; "Add to feed" prepends the run's frames to the feed (they become permanent feed items, newest first) and dismisses the strip.
- Feed cards double-click → viewer opens **on that item's index**; viewer paging order = feed order.
- Viewer stage hover row shows kind · ratio · time on its right end.
- Delete in the viewer closes it first, then toasts.
- The @ mention menu in the dock lists cast members (with look counts) AND assets — referencing either inserts a chip inline in the prompt.

## Templates
- Opening a template resets modal state: pane (Generations if runs exist, else Examples), slide 0, prompts cleared, pan re-centred.
- Example deck arrows wrap; dots are clickable; active dot stretches 5→16px.
- Canvas pane: per-step prompt edits persist while the modal is open (cleared on reopen); panning excludes inputs from drag; board recentres on pane resize.
- "Run it" label flips to "Run it again" once that template has a generation.
- Category chips and the Ours/All tabs compose (both filters apply).

## Casting
- Kept candidates survive re-rolls; Discard is a pure delete (no archive); Follow stamps children with a mono "FROM 0X" lineage pill.
- Voice lines play with the `dswave` bar animation (700–1220ms staggered bars).
- DRAFT pill only on unsigned cast — signed members show usage instead.

## Chrome
- Topbar search shows ⌘K hint; the credits meter and "2 running" live-status pill sit right of the search.
- Scope menu, account menu, model picker: all close on capture-phase outside click, each keyed on its own data-marker; picker also closes on outside scroll but NOT its own internal scroll.
- Theme toggle persists; every popover/modal/scrim is tokenised in both themes (`--viewerScrim`, `--barGlass`, `--dockGlass`).

## Known prototype seams (do not replicate)
- "Wire it" and some canvas-open actions point at exploration files (`window.open`) — in the product they open the real canvas editor.
- Search fields, "More options ›", ratio/frame-count chips are visual affordances without behaviour.
- The image-slot Replace/Edit chrome seen while editing filled slots is the design tool's editor, not product UI.
