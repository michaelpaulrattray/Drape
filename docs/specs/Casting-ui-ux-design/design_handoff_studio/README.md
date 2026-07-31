# Klieg Studio — full prototype handoff

**To:** the agents building the Klieg app
**From:** design
**Reference file:** `Klieg Studio.dc.html` — open it, it is fully interactive. Every claim in these docs can be verified by clicking through it. Where a doc and the file disagree, **the file wins**.
**Screenshots:** `screenshots/` — one per surface, light + dark.

## What this is

The complete design vision for the Klieg studio app, as a working single-file prototype. Very little of this exists in the product yet — that is expected. This package is the target: build towards it surface by surface, reusing the shared foundation so nothing needs a reconciliation pass later.

The prototype covers the **lobby shell and all seven tabs** (Home, Create, Canvas, Templates, Casting, Assets, Library), the **settings modal**, the **account menu**, the **template run modal**, the **image viewer modal**, the **shared model picker**, and the light/dark **token system**.

**Not in this package:** the canvas editor surface itself (the node board you open a canvas into). That is `Klieg Canvas.dc.html` and ships as a separate package. The Canvas *tab* (the lobby page that lists your canvases) IS here.

## Reading order

| Doc | Covers |
|---|---|
| 01-shell-foundation | Tokens, type, rail, topbar, theme — build FIRST |
| 02-home | Hero, composer, quick start, activity sections |
| 03-create | Kind switch, feed, run strip, hover actions, viewer modal, dock composer |
| 04-model-picker | The shared model dropdown (Home + Create) |
| 05-canvas-tab | Template marquee, "wire it" composer, canvases grid |
| 06-templates | Templates tab + the run modal (examples / generations / canvas panes) |
| 07-casting | Casting tab, candidate rolls, sign, casting room, sheet |
| 08-assets-library | Assets tab, Library tab |
| 09-settings-account | Settings modal, account menu |
| 10-shared-patterns | The recurring grammar: section headers, cards, pills, toasts, hover reveal, motion |

## Build order that avoids rework

1. **Foundation** (doc 01) — tokens.css verbatim, shell chrome, theme toggle.
2. **Shared patterns** (doc 10) — section header, media card, pill badge, toast. Every surface is assembled from these.
3. **Home** — smallest surface, exercises the composer + picker + card grammar.
4. **Create** — the deepest surface (feed, viewer, dock).
5. **Templates, Canvas tab, Casting, Assets, Library** in any order.
6. **Settings/account** any time after foundation.

## Ground rules (non-negotiable)

- **Never a raw hex in a component.** Every colour is a token from tokens.css. Only exceptions: white glyphs/text on a dark image scrim (`#FFFFFF`, `rgba(17,17,18,.66-.76)` scrim), and the brand-orb / agent-orb gradients.
- **Accent means state, never decoration.** `--accentSolid/-Ink/-Wash/-Line` = kept, selected, active, live, locked. If nothing is selected or running, a surface shows zero accent.
- **Dark mode is one attribute** — `data-theme="dark"` on `<body>`. No per-component dark variants.
- **All media is neutral.** Image wells are `--media` with a 1px `--border`; no tinted gradient placeholders anywhere.
- Type is **Archivo** (UI) + **JetBrains Mono** (metadata, eyebrows, counts, timestamps). Mono is always small (8.5–10px), letter-spaced (.06–.12em), and usually `--meta`/`--faint`.
