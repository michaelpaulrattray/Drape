# 02 — Home

Landing tab. Order top-to-bottom: hero → composer → QUICK START → ON THE WIRE → JUST LANDED → YOUR CAST. Content column max-width 1120px, 32px side padding.

## Hero
- "Good afternoon, {name}" — 32px/1.1 Archivo 500, -.035em.
- Subhead 13.5px `--metaStrong`: "Start from a prompt, or pick up where you left off — what's running, what just landed, and who you can cast."

## Composer (the "LLM chat box")
A bordered card (`--borderCard`, radius 14) with four rows:
1. **Mode tabs** — Image, Video, Try-on, UGC, Upscale, Voice. Active = `--ink` bg / `--surface` text pill; inactive text-only. Switching mode resets any manual model pick.
2. **Context chips** — attached cast member (avatar chip with chevron; opens cast picker) + "+ Reference" chip.
3. **Textarea** — "Describe what you want to make…", 13.5px/1.55, min-height 74px, borderless.
4. **Suggestion chips** — 3 per project scope, 11px on `--fill`.
5. **Footer row** (top border `--fillStrong`): **model picker chip** (see doc 04) · ratio (16:9) · frame count (4 frames) · "More options ›" · right side: credits estimate + solid Create button with ⏎ glyph.

## QUICK START
Section header grammar (doc 10) with "All templates →" link. 4 image cards, grid `auto-fit minmax(232px,1fr)`:
- Media: 4:3 image slot, radius 12, `--shadowPop`, hover lifts -2px + `--lineStrong` border. Glass pill top-left: icon + mono meta (CASTING / 30S · 9:16 / 9 FRAMES / CANVAS).
- Text BELOW the media (never overlaid): 12.5px 500 title + 11px `--metaStrong` one-liner + arrow.
- Routes: **Cast a model** → Casting tab · **Make a UGC ad** → Templates with "Weekly testimonial" modal open · **Shoot a product** → "Hero shots" modal · **Wire it yourself** → Canvas tab.

## ON THE WIRE
Live + recent jobs, scoped to project. Bordered list card (radius 12): each row = status (13px accent spinner if live / `--muted` check if done) · kind pill (mono 8.5px on `--fill`) · title 12.5px 500 + sub 11.5px `--metaStrong` · mono timestamp right. Header count: "2 running · 1 done".

## JUST LANDED
Six most-recent frames. Standard media-card grid (doc 10): 4:5 slots, kind pill top-left, name + mono time below. Header link "All in library →". This is a glance, not the library — no filters here.

## YOUR CAST
"New cast member" dashed tile FIRST, then up to 5 roster cards: 4:5 portrait slot, DRAFT pill when unsigned, name 11.5px 500 + usage line ("12 frames · 2 campaigns" / "Not yet used"). All route to Casting. Header link "All casting →".
