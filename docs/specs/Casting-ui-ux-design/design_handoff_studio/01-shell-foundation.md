# 01 — Shell & foundation

Build this before any surface. It is identical to what `drape-foundation/` describes; `tokens.css` in this folder is the verbatim palette (29 semantic tokens per theme + `--shadowPop` and `--viewerScrim` added during this round).

## Tokens
- One stylesheet. `:root` = light, `body[data-theme="dark"]` = dark. Paste from `tokens.css`, do not retype.
- Newer additions this prototype relies on: `--shadowPop` (small pop shadow: marquee cards, quick-start media), `--viewerScrim` (image-viewer backdrop: rgba(17,17,18,.62) light / rgba(0,0,0,.74) dark).

## Type
- **Archivo** — all UI text. Weights 400/500 only. Headings tighten: h1 32px/-.035em (Home hero), 26px/-.03em (tab titles), card titles 12–13px/-.014em.
- **JetBrains Mono** — eyebrows (9.5–10px, .1–.12em tracking, `--meta`), counts/timestamps (10px, `--faint`), keyboard hints, credit figures.

## App shell
- **Rail, 76px** fixed left. `background:var(--raised)`, `border-right:1px solid var(--border)`. Brand orb at top. Nav: Home, Create, Canvas, Templates (clapperboard icon), Casting, Assets, Library — icon over 9.5px label, active = `--fillStrong` bg + `--ink`, inactive = `--meta` icon / `--metaStrong` label.
- **Topbar, 56px** sticky. `--barGlass` + blur(14px), 1px `--border` bottom. Left: project scope switcher (swatch + name + chevron → dropdown of projects incl. "All projects"), 1×18px divider, breadcrumb (`Home`, `Casting / Sheet`, …). Right: search affordance, credits meter, theme toggle, 30px avatar → account menu.
- **Scope switching matters:** every surface's data is filtered by the selected project. The prototype does this everywhere (feed, wire, casting roster, assets, library counts). Build scope as a global, not per-page state.

## Theme
- Toggle sets `data-theme` on `<body>` and persists. Everything else is tokens.

## Modality inventory (z-order)
| Layer | z | Surface |
|---|---|---|
| Topbar | 25 | sticky |
| Settings modal | 40 | centered card + scrim |
| Template run modal | 60 | centered, 1010px max |
| Model picker panel | 60 | fixed, measured placement |
| Image viewer | 70 | full-screen split |
| Toast | 80 | bottom-centre pill |
