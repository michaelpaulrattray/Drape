# Drape — Shared App Foundation

**This is infrastructure, not a redesign.** Nothing here changes what a screen does. It fixes *what things are made of* so every surface built from here on — lobby, canvas, casting, assets, library — looks like one product without anyone re-deciding a border colour.

Build this once, before or alongside the first real surface. Everything after it gets cheaper.

---

## What's in the package

```
drape-foundation/
├── tokens.css                    ← THE deliverable. Copy into the app.
├── Drape Foundation.dc.html      ← Living reference. Open in a browser.
├── README.md                     ← This file: the rules.
├── reference/                    ← The three designed surfaces, runnable
│   ├── Klieg Casting.dc.html
│   ├── Klieg Canvas.dc.html
│   └── Drape Studio.dc.html      (lobby)
└── casting-brief/README.md       ← Casting Studio UX spec (separate brief)
```

**Open `Drape Foundation.dc.html` first.** It renders every primitive in this document, live, in both themes — and it loads `tokens.css` itself, so if the tokens are wrong the page is visibly wrong. Toggle the theme in the topbar; nothing on the page is theme-conditional.

`reference/` holds the three surfaces this system was extracted from. Every value in `tokens.css` already ships in at least two of them. Nothing here is theoretical.

### Coverage

**Lobby, casting and canvas are all covered.** Verified: every token the lobby and casting reference files use is defined in `tokens.css` at an identical value in both themes — zero missing, zero conflicts. Their only hardcoded hexes are the brand orb gradient and the lobby's decorative card art, both sanctioned exceptions.

**Canvas ships as a `--cv*` layer** (§1, "Canvas layer"). `reference/Klieg Canvas.dc.html` itself is still hardcoded — it predates the token system and is left as a visual artifact, not a code model. **Build canvas from the tokens, not by copying hexes out of that file.** Section 08b of the living reference renders the canvas primitives from the real tokens; that is the code model.

---

## 1. Tokens

`tokens.css` is the only place a colour is allowed to exist. Load it once, globally, before any component styles.

```html
<link rel="stylesheet" href="/tokens.css">
<body data-theme="light">   <!-- or "dark" -->
```

**Three rules, in priority order:**

1. **No hex outside `tokens.css`.** Two exceptions only: white text/glyphs on a scrim, and the brand orb's gradient.
2. **Every token exists in both themes.** No component ever branches on theme — dark mode is a body attribute and nothing else. If you find yourself writing `isDark ? … : …` in a component, a token is missing.
3. **Elevation by value, not shadow.** A card on `--surface` uses `--raised`. A working surface behind cards uses `--page`. Shadow is reserved for things that genuinely float over content: dock, dialog, menu, tooltip.

### The groups

**Surfaces** (`--surface --raised --page --wellSoft --well --fill --fillStrong --media`) — ordered by elevation. `--media` goes behind every image or video, so an unloaded image looks intentional rather than broken.

**Lines** (`--rule --ruleSoft --border --borderSoft --borderMedia --borderInput --borderCard --dots --dotsStrong --dashed --sink --lineStrong --lineSoft`) — this many exist because the distinctions are real: a divider inside a card should be lighter than the card's own border, or the card looks segmented. Don't collapse them.

**Text** (`--muted --faint --meta --metaStrong --linkHover --secondary --ink --inkDeep`) — lightest to darkest. Body copy is `--metaStrong`; primary text is `--ink`. `--metaStrong` intentionally equals `--meta` in dark mode: the light-mode distinction stops being legible on a dark ground.

**Glass** (`--barGlass --dockGlass`) — always with `backdrop-filter: blur(14px)` and the `-webkit-` prefix.

**Accent** (`--accentSolid --accentInk --accentWash --accentWashHover --accentLine --onWash`) — one hue, four roles. See §3.

**Scrim** (`--scrim --scrimChip --scrimChipHov --scrimPill --onScrim`) — identical in both themes, because media is media. See §6.

**Structure** — radii (`--r-*`), spacing (`--s-*`), chrome geometry (`--rail-w --topbar-h --content-max`), fonts, motion (`--t-* --ease`).

### Canvas layer (`--cv*`)

The node graph is the one surface with its own token group, because it has primitives nothing else has: a ground, wires, ports, and typed media tiles. **Only the canvas may reference `--cv*`.** If another surface reaches for one, the base set is missing something instead.

The canvas reuses base tokens wherever it can — node body `--surface`, node border `--borderCard`, filled port `--ink`, dot grid `--dots`, node label `--secondary`, menus and toolbars exactly as elsewhere. `--cv*` covers only what's left:

- **Ground** — `--cvGround` (floor), `--cvGroupLine` (group bounding box), `--cvGroupBar` (group / multi-select toolbar).
- **Ports & wires** — `--cvPortRim` (rim of an *empty* port; a filled one is `--ink`), `--cvWire`, `--cvWireSoft` (background/unselected), `--cvWireLive` (running branch), `--cvPipOff`, `--cvPlaceholder`.
- **Agent surfaces** — `--cvAgentHalo` / `--cvAgentCore` (orb), `--cvAgentRow` (agent-suggested row in a menu), `--cvKeyLine` (keycap border on accent text), `--cvProgA` / `--cvProgB` (progress gradient).
- **Node media tile** — `--cvTileA` → `--cvTileB`, one gradient at 160° for **every** node type.

**All nodes use the same tile colour.** Node type is signalled by its icon and label, never by colour — tinting per type turns an unloaded graph into a colour-coded diagram nobody asked to read, and it collides with the accent the moment a node is selected.

Section 08b of the living reference renders all of it from the real tokens in both themes.

### Retinting the accent

The accent is one hue expressed as four derived values. To change brand colour, set them together — don't set `--accentSolid` alone and let the others drift:

```js
const [r,g,b] = rgbOf(hex);
root.style.setProperty('--accentSolid', hex);
root.style.setProperty('--accentInk',   dark ? lighten(r,g,b) : darken(r,g,b));
root.style.setProperty('--accentWash',  `rgba(${r},${g},${b},${dark ? .14 : .07})`);
root.style.setProperty('--accentLine',  `rgba(${r},${g},${b},${dark ? .32 : .38})`);
```

Working implementation: `applyAccent()` in `reference/Klieg Casting.dc.html`.

---

## 2. Typography

Two families. **Archivo** for everything a human reads. **JetBrains Mono** for machine facts only — counts, indices, IDs, timestamps, status pills, section eyebrows. Never a sentence in mono.

| Role | Spec |
|---|---|
| Page headline | `500 31px/1.08`, `letter-spacing:-.038em`, two lines max |
| Entity name | `500 27px`, `-.032em` |
| Dialog title | `500 15px`, `-.012em` |
| Section heading | `500 13.5px` |
| Body | `400 13px/1.65`, capped ~520px |
| Card title / control label | `500 12.5px` |
| Secondary copy | `400 11.5px/1.55` |
| Small control | `400–500 11.5px` |
| Mono eyebrow | `500 10.5px`, `letter-spacing:.12em`, uppercase |
| Mono chrome | `500 10px`, `.1em` |
| Mono metadata | `400–500 10–10.5px` |

Weights: **400 and 500 only.** 600 exists in the webfont and is never used — a 600 heading next to a 500 heading reads as a mistake. Sizes come from this table; a new size needs a new reason.

**The answer to a long label is never a smaller font.** (Founder, 2026-08-30, at the section 00 frames.) When a label does not fit — a speaker column, a table cell, a pill — the fix is the column, the wrap, or the label; it is never a size below the table above. Mono's floor is `10.5px` and prose's is `11.5px`, and going under either to make something fit trades a measurable legibility loss for an invisible layout win. The specimen case: `"night shift"` needs 69.3px at 10.5px mono and clips at 64px, so the COLUMN went to 80px and the type did not move.

---

## 3. Accent discipline

Accent means **kept, selected, or active choice.** It is never decoration, never a background, never a gradient.

- `--accentSolid` — selection rings, filled check badges, determinate progress, the active playhead. On media, selection is its *only* job.
- `--accentInk` — accent-coloured **text**. Always this, never `--accentSolid` (which fails contrast at body sizes).
- `--accentWash` + `--accentLine` — the background/border pair for an accent chip or pill. Always together.

**Hover-preview pattern:** an action chip's hover state is the accent wash. That reads as "this will apply", where a resting accent would read "this is already selected". Used on nudge chips, try chips, refine chips.

**One state, one signal.** (Founder, 2026-08-30, at the section 00 frames.) A single fact gets a single accent — a kept card is an underline plus a pill, not an underline AND a pill AND a border AND a check. His reason is about the things that are not good news: *"Four signals for one fact is how a system starts shouting, and it makes the genuinely urgent things — a failed run, a destructive confirm — indistinguishable from a good outcome."*

**Accent never encodes a CATEGORY.** A type is not a state. `MASCOT` and `PERFORMER` are what a cast member IS and are greyscale; `IDENTITY LOCKED` is a state the accent is exactly for. Colour carrying a category is the one job the accent is not allowed to take, because the moment two categories need two colours the system has a palette and no longer has a signal.

**How much accent is right:** almost none. Across the lobby, casting and canvas, accent appears only where something is kept, selected, running or locked — typically two or three elements on a full screen, often zero. If a screen has accent in its headings, its labels, its code, its icons or its dividers, the accent has stopped meaning anything. When in doubt the answer is `--metaStrong`, not accent.

---

## 4. Chrome

Fixed, app-wide, on every signed-in surface.

**Rail — 76px.** `border-right: 1px solid var(--border)`, `background: var(--raised)`, `position: sticky; top: 0; height: 100vh`, `padding: 22px 0 14px`, `z-index: 30`. Brand orb at 34px on top (12px bottom margin), then destinations, then `margin-top:auto` and the account chip.

Destination item: 60px wide, `padding: 9px 0 7px`, `border-radius: 10px`, icon over a 9.5px label, `gap: 5px`. Active = `--fillStrong` background, `--ink` icon and label at weight 500. Inactive = transparent, `--meta` icon, `--metaStrong` label at 400, hover to `--fillStrong`.

**Topbar — 56px.** `border-bottom: 1px solid var(--border)`, `background: var(--barGlass)`, `backdrop-filter: blur(14px)`, `position: sticky; top: 0`, `z-index: 25`, `padding: 0 18px 0 24px`. Left: brand/workspace switcher (16px gradient tile + name + chevron) → 1px `--borderSoft` divider → breadcrumb in `--metaStrong`. Then `flex: 1`. Right: 30px icon buttons, then a secondary button.

**Breadcrumbs** read `Casting`, `Casting / Sheet`, `Casting / Maya Okafor`. The trailing segment is the entity's real name.

**Casting, canvas and the lobby are rail destinations — never modals over another surface.** Detail views are navigated, with a quiet "‹ Casting" back link at the top of the content column. Iteration inside a modal is a trap: you can't reference the list while you work.

---

## 5. Components

All of these are in the living reference with their exact values. The notes below are the *reasoning*, which the code can't carry.

**Buttons.** Primary is `--ink` fill, `--surface` label, `radius 8`, `9px 14px`, hover `opacity:.86` — opacity rather than a colour change, so it survives theme flip and accent retint. Secondary is `1px --borderInput`, `--secondary` label, hover moves border to `--ink` and label follows. Icon-only in chrome is 30px, `radius 8`, hover `--fillStrong`.

**One primary per view.** If two things look equally primary, one of them isn't.

**Destructive** is a hover state on a secondary button, never a resting red button. **Disabled** should usually be replaced by an instruction in `--meta` where the button would be — "Keep the ones worth a second look" instead of a greyed-out Sign.

**Inputs.** `1px --borderInput`, hover `--lineStrong`, radius 11 (primary) or 8 (compact). Placeholders are **real examples, never instructions** — "a dad in his 30s in a cluttered garage" teaches the input's grammar in a way "Enter a description" never will. Error state is `1.5px #C0473A` plus a mono `REQUIRED` marker; error colour is deliberately not a token because it must not be retintable by brand.

**Chips.** Action chip (does something on tap): `1px --border`, `radius 999`, `5px 10px`, hover to the accent wash triple. Derived chip (removable state): resting accent wash + `×`. Scope pill: active `--ink` fill, inactive outline, `radius 7`. Tabs: 2px `--ink` bottom border on the active one, `margin-bottom:-1px` over the container's border.

**Derived chips carry a hard rule: no setting is ever applied invisibly.** If the system inferred something from a user's sentence, or a user changed something from default, it appears as a chip they can see and remove. A collapsed advanced panel hiding active settings is worse than no panel.

**Cards.** `1px --borderCard` + radius 13–14 on `--surface` or `--raised`. Interactive cards hover border to `--lineStrong` and background to `--raised`. Panels with a header use a `--rule` divider, not a heavier border. Dashed `--dashed` means "you can put something here" — never decoration.

**Status pills** are mono, uppercase, `letter-spacing:.06–.08em`, `radius 999`. Neutral on `--fillStrong`, meaningful on the accent wash pair, over media on `--scrimPill`.

**Dialogs.** Overlay `rgba(10,10,11,.44)` + `blur(3px)`. Panel max 432px, radius 14, `--shadowCard`. Body 18/20/14 padding; footer on `--raised` above a `--rule` line with actions right-aligned, secondary then primary. Enter animation `dp-scaleIn 200ms`.

**Menus.** `--shadowPop`, radius 11, 5px padding, 7px-radius items, hover `--well`. Destructive item is `--metaStrong` at rest, red on hover only.

**Docks.** Sticky bottom, `--dockGlass` + blur, radius 14, `--shadowCard`, sitting on a `linear-gradient(to top, var(--page) 42%, transparent)` fade. The scroll container needs bottom padding ≥ dock height + 24px so the last row is never trapped underneath.

**Floating bars** (zoom control, add-node dock, canvas toolbars). Solid `--surface` + `1px --borderCard` + `--shadowPop`, radius 10–16, 3–6px padding, 26px icon cells, 1px `--borderSoft` dividers. Solid, not glass — glass is for full-width chrome bars; floating bars are small enough that blur reads as smudge.

**Live status / queue pill.** Accent wash pill + an 11px spinner (`1.6px --accentLine` ring, `--accentSolid` top, `dp-spin 1s`) + a 500 11px accent label ("Rendering 2"). This is the one sanctioned spinner: tiny, inside a status pill, announcing background work. A spinner over or instead of content is still banned — that's what skeletons are for.

**Long-running single jobs** (a video render, a likeness lock) show progress *inside the element's own frame*: 26px brand-gradient conic ring + "Generating · 14s" time estimate + a 3px gradient bar (`dp-prog`). The shimmer skeleton is for batches; this is for one thing the user is waiting on. The ring/bar gradients use the orb's brand hexes — a sanctioned exception.

**Presence & badges.** Collaborator/kept stacks are overlapping circles with a `0 0 0 1.5px var(--surface)` ring and `margin-right:-8px`, overflow collapsing to a +N circle. Unread indicators are a 5px `--accentSolid` dot at the icon's top-right — never a count bubble.

---

## 6. Media

**Two treatments, chosen by size.** Real drop-slots at ≥64px. Below that, a gradient tile: `linear-gradient(160deg, var(--fill), var(--dots))` + `1px --border`, optional short mono label, description on `title`. Placeholder prose clips mid-word under ~64px and reads as broken text.

Always `--media` behind imagery, `4/5` for portraits, `overflow:hidden` with the radius on the container.

**Text over media always sits on a scrim** — `linear-gradient(to top, var(--scrim), transparent)` with generous top padding (22–26px) so the fade is soft.

**⚠ Buttons over media use dark glass — `--scrimChip`, hover `--scrimChipHov`.** We shipped translucent *white* chips (`rgba(255,255,255,.22)`) and measured ~2.5:1 against white glyphs over light imagery, below the 3:1 floor for UI components. The one exception is a deliberately high-contrast primary — a near-solid white pill with `#111112` text.

Scrim tokens are identical in both themes on purpose. Media doesn't have a theme.

---

## 7. Layout

**Chrome:** rail 76, topbar 56, both sticky, both always present.

**Two content widths:** 1180px for browsing and detail; 1240px for working surfaces needing grid room (candidate sheet, canvas). Centred, 32px side padding.

**Columns wrap, they don't collapse.** Two-column layouts use `flex-wrap` with `flex: 1 1 <ideal>` + `min-width`, so they reflow at any container width with no media query. Left column basis 560px, right 300px.

**Grids are intrinsic:** `repeat(auto-fill, minmax(N, 1fr))` — 178px roster, 212px candidates, 104px takes, gap 16 (12 dense). Never a fixed column count.

**Spacing is `gap`, never margin.** Sibling groups — chips, buttons, nav items, toolbars — are flex or grid with `gap`. It survives drag-reorder, delete and duplicate; whitespace text nodes don't.

**Wrapping split panels use `outline: 1px` on the second column, not `border-left`** — a border strands a stray edge once the columns stack.

Below ~720px the rail collapses to icons only (or a bottom bar), content padding drops to 20px, and two-column layouts stack. Nothing else changes; the intrinsic grids handle themselves.

---

## 8. Motion

```
dp-rise    340ms  content arriving
dp-fade    200ms  overlays
dp-scaleIn 200ms  dialog panel
dp-sweep   1.5s   skeleton shimmer
dp-pulse   1.6s   pending label
dp-wave    0.7–1.2s  audio bars, only while playing
```

**Nothing in a task flow exceeds 340ms.** Hover is 120ms, open/close 200ms, content arrival 340ms. Ambient brand motion (the orb's 9–23s drifts) is the only exception, and it never sits next to a control.

**Streaming beats batching.** A batch of eight items renders eight skeletons immediately and swaps each as it lands. Never hold a set behind the slowest item — it makes a fast system feel slower than a serial one.

`prefers-reduced-motion` kills every animation and collapses transitions to 1ms. Already in `tokens.css`.

---

## 9. Copy

- **Domain verbs, not tool verbs.** Cast, sign, roll, keep, discard, follow, take, sheet, room. Not "generate", "prompt", "iterate", "asset".
- **State the cost or the size.** "Locks in about four minutes." "184 performers already cleared for paid ads."
- **Say why a feature exists** where it isn't self-evident — a Siblings card earns its space with "when a campaign needs a near-miss rather than a new face".
- **Placeholders are examples.** Instructions live in labels.
- **Instructions replace disabled buttons.**
- **Headlines promise the mechanism**, not the category: "Meet eight of them."

---

## 10. Non-negotiables

1. No hex outside `tokens.css` (except white-on-scrim and the orb gradient).
2. Every token in both themes; no component branches on theme.
3. Elevation by value; shadow only for floating things.
4. One primary button per view.
5. Accent = kept/selected/active. Never decoration.
6. Accent text is `--accentInk`, never `--accentSolid`.
7. Mono for machine facts only.
8. Radii from the scale: 7 · 8 · 9 · 10 · 11 · 12 · 13 · 14 · 999.
9. Placeholders are examples; instructions replace disabled buttons.
10. Copy states cost or size.
11. Nothing in a task flow animates past 340ms; reduced-motion kills it all.
12. Stream, don't batch.
13. Buttons over media use dark glass, never translucent white.
14. `gap` for sibling spacing, never margin.
15. Real drop-slots ≥64px; gradient tiles below.

---

## 11. Build order

1. **`tokens.css` + the reset**, loaded globally, `data-theme` on body, theme persisted to storage and read on boot before first paint (no flash).
2. **Rail + topbar** as an app shell layout, with the content column and both max-widths as a layout primitive.
3. **Buttons, inputs, chips, pills** — the four that appear on every screen.
4. **Cards, list rows, media containers** including both media treatments.
5. **Dialog, menu, dock** with the glass/shadow rules.
6. **Skeleton + empty + selected states** as shared components, so streaming is the default everywhere.
7. Then the first real surface. Recommended: **Casting** (`casting-brief/README.md`) — it's the densest, so it proves the system hardest. Anything that survives casting makes the lobby trivial.
8. **Canvas** last, on the `--cv*` layer. Build it from the tokens and §08b of the living reference — not by copying hexes out of `reference/Klieg Canvas.dc.html`, which predates the token system.

Check work against `Drape Foundation.dc.html` — if a component doesn't match it, one of the two is wrong and it's worth knowing which.

---

## 12. Questions back

1. React with CSS variables, Tailwind with a token preset, or CSS modules? Tailwind needs the tokens mapped into `theme.extend` and the arbitrary-value escape hatch banned, or it'll drift within a week.
2. Does the design system live in the app repo or its own package? Own package is better if canvas is a separate deploy.
3. Is the accent brand-configurable per workspace, or fixed? Affects whether `applyAccent()` is runtime or build-time.
4. Any existing component library already in the app that these need to coexist with, rather than replace?
