# 03 — Create

The generation workspace. Header row → feed tabs → (run strip when generating) → masonry feed. A floating dock composer is pinned bottom-centre.

## Header
- Title "Image & video" 26px + segmented kind switch right: **Image / Video / Lip sync** (pill-in-well pattern). Switching kind re-filters models and resets the model pick.
- Feed tabs below: "Yours" / "Team" underline tabs.

## Run strip (while a job runs)
Bordered card above the feed. Header: eyebrow "RUN 04 · 4 FRAMES · 16:9", prompt echo, progress pill (accent wash + spinner + "2 of 4"). Frames arrive left-to-right: pending = `--fill` block with sweep shimmer (`dssweep`) + pulsing mono label; arrived = image rises in (`dsrise` .34s). Arrived frames get the same hover actions as feed cards. "Add to feed" appears when all frames land.

## Feed
CSS columns masonry (`columns:220px 4; gap:14px`). Card = image slot at its true ratio, radius 10, 1px `--border`:
- Top-left pills: kind ("Image"/"Video") + ratio ("4:5") — mono on rgba(17,17,18,.72).
- Top-right pill: cast tag ("Maya") when a cast member is in the frame.
- **Hover action row** (bottom, gradient scrim, revealed by hovering the CARD — see doc 10 "hover reveal"): 4 glass icon buttons — **Use as reference · Download · Copy image · Save to assets** — plus relative time right. Every action confirms with a toast.
- **Double-click opens the viewer.**

## Image viewer (double-click any frame)
Full-screen split at z-70 over `--viewerScrim`. Esc closes, ←/→ page (wrapping), click-scrim closes.

**Left: stage.** The frame at its true aspect ratio, centred, radius 12, deep shadow. Sizing rule (important, twice-burned): the pane is a size container; the stage is `height:auto; width:min(100%, 100cqh × ratio); aspect-ratio:R` — never set both axes. Round glass prev/next arrows; "01 / 14" mono counter pill bottom-centre. Video items show a centred glass play button. Hovering the stage reveals the same 4-icon action row as feed cards.

**Right rail: 336px, `--surface`, left border.**
1. Header — name 13px 500, eyebrow "IMAGE · 4:5 · just now", close ×.
2. **PROMPT** — copy button (bordered chip), prompt text 12px/1.6 incl. @cast mention.
3. **DETAILS** — leader-dot rows (label `--metaStrong` … value mono `--ink`): Model, Ratio, Size, Cast, Made.
4. **DO SOMETHING WITH IT** — described action rows (icon square + title + one-liner + chevron). **Branch on kind:**
   - Image: Turn into video · Make more like it
   - Video: Extend the clip · Pull a still from it · Make another take
   - then: "Try it on someone else" (cast attached) OR "Cast someone into it" (no cast)
   - always: Open on canvas
5. Footer (well bg) — icon buttons Download / Copy / Save to assets / Delete + solid **Use as reference** primary.

Deliberate non-goals: no author block, no comments tab, no accent-coloured primary — accent stays reserved for state.

## Dock composer
Floating 720px glass dock (`--dockGlass` + blur 18). Reference thumbnails row (POSE / LIGHT + dashed add), prompt line with inline @cast mention chip (typing @ opens a mention menu of cast + assets), footer: mention button · **model picker chip (doc 04)** · ratio · count · credits · Generate.
⚠ The dock's backdrop-filter makes it a fixed-position containing block — see doc 04 for why the picker must compensate.

## Toast
Bottom-centre pill, z-80: `--ink` bg, accent dot, 11.5px `--surface` text, ~2.1s, `dsrise` in. Used for every quick action ("Saved to assets", "Prompt copied", …).
