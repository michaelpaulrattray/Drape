# 05 — Canvas tab (lobby page, NOT the editor)

Lists your boards and starts new ones. The editor itself is the separate Klieg Canvas package.

## Header card
One bordered card, three bands:
1. **Title band** — eyebrow "CANVAS", h1 "Drop in your material. Get a board that runs." + right-aligned 13px blurb about live re-runnable chains.
2. **Template marquee** — dotted-grid band (`--page` + radial `--dots`), header row: mono "START FROM A TEMPLATE" + "a board already wired — bring your material" + "Browse all →" (→ Templates tab). Below: an auto-scrolling row of ALL templates as 172px 4:5 image cards — name + output shape over a bottom gradient, category pill top-right. Pauses on hover; cards lift. **Click → Templates tab with that template's modal open.** Loop mechanics: the track holds the list twice and animates translateX(-50%); the track carries NO padding/gap (spacing = per-card margin-right) so one copy's stride is exactly 50% and the loop is seamless. 62s linear. Edge fades 36/56px. Slot ids are shared with the Templates grid so a dropped image shows in both.
3. **Composer band** — "wire it" prompt input (placeholder: "six product stills of the serum, then a 9:16 talking cut with Maya"), paperclip attach, solid "Wire it →" button. Attached assets render as 44×54 chips with × remove + a note line ("One asset attached. The board will build around it."). TRY row: seed chips (accent wash on hover) + divider + "Browse templates" link.

## Canvases grid
Section header "YOUR CANVASES" + count. Grid of 16:10 cards: **"New canvas" dashed tile FIRST**, then boards — image slot, bottom gradient with board-glyph + name, meta line below (nodes · last run). Click opens the canvas editor.
