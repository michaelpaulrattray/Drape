# 01 — Surface & chrome

(Anatomy verified against the live prototype — see screenshots 01/02.)

## The floor
Dot-grid canvas (`--page` + radial `--dots`) filling the viewport. An SVG layer (`data-scene`) carries the wires; it is pointer-transparent except each wire's 16px hit path.

## Top chrome (floating pills, no solid bar)
- **Top-left:** back chevron + board name in a white pill ("Autumn canvas"); beside it the **queue pill** — "1 running" on `--accentWash` with a live spinner ring (accent = running state). Clicking it in the prototype toggles the **stale** state (board edited since last run) — in the product stale derives from graph edits.
- **Top-right cluster:** "Saved" check chip · the **agent orb** (breathing conic gradient — opens the agent panel, doc 06) · assets (folder) · comments (chat bubble, with unread dot) · theme toggle (moon/sun) — then a solid ink **Share** button and the **account stack** (overlapping gradient avatars + "MR"; click opens Settings / Members & invites / Billing & credits).

## Bottom chrome
- **Bottom-centre toolbar**, one horizontal glass bar: Select (active = ink square), Pan (hand), Comment, ·sep· Image, Video, Avatar, Try-on, ·sep· Focus/fit, Notes. Hover shows tooltips; the add-tools drop nodes in the product.
- **Bottom-left zoom pill:** − · 72% · + · | · Fit.

## Theme
`theme` state toggled from the chrome. Product build: one scene + `data-theme` on body (see README warning about the prototype's duplicated scenes).
