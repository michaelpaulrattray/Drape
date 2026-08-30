# Drape UI redesign — the running order

## Read this first: what this folder is, and is not

This pack lives at `docs/specs/Casting-ui-ux-design/drape-redesign/`. Its siblings — `design_handoff_studio/`, `design_handoff_canvas/`, `drape-foundation/` — **already hold the design grammar**:

| Existing package | What it defines |
|---|---|
| `design_handoff_studio/` (11 docs) | The lobby shell and seven tabs, the modals, the model picker. `10-shared-patterns.md` is the grammar: section header, media card, dashed create tile, hover reveal, toast, segmented control, motion vocabulary, popover discipline, the aspect-ratio rule. |
| `design_handoff_canvas/` (7 docs) | The node editor: chrome, nodes, wires, selection, node toolbar, agent, small print. |
| `drape-foundation/` | `tokens.css` (adopted verbatim into `client/src/foundation/tokens.css`) and the living reference. |

**Those documents remain the source of truth for how things look.** This folder does not restate them. Where a brief here and a handoff doc disagree on grammar, the handoff wins.

What this folder adds, and only this:

1. **A running order against the real codebase** — which repo files, in which order, at what risk. The handoff's build order is prototype-surface order; it was written before I could read the repo.
2. **Repo-specific briefs** — real paths (`AppLobby.tsx`, `adminConstants.ts`, `StaffGuard`), what to leave alone, what the existing code already does right.
3. **The surfaces the handoff does not cover at all** — Admin, Moderation, Crew, Cinema.

## ⚠ The committed prototype is stale

`docs/specs/Casting-ui-ux-design/design_handoff_studio/Klieg Studio.dc.html` predates all of this:

- **Cinema** — the whole production surface (Wall, Desk, Composer, shelf, takes, cut strip).
- **Crew** — lanes, costed decisions, visual-test reports, delivery pipeline, transcript.
- **Admin and Moderation** — both surfaces entirely.
- **Templates** as its own destination, and the Canvas tab's marquee header.
- **Home** rebuilt — quick start, on the wire, just landed, your cast.
- **Content widths** — 1120px everywhere became 1180 browse / 1240 working / 790 reading.
- **Tokens** — the scrim group (`--scrimChip`, `--scrimPill`, `--onScrim`) and the error group (`--error`, `--errorInk`, `--onError`) plus `--viewerScrim`.

**Refresh the committed copy at `docs/specs/Casting-ui-ux-design/design_handoff_studio/` before section 00**, or agents will build towards an old target. Copy the current `Klieg Studio.dc.html`, `support.js`, `image-slot.js` and `drape-foundation/tokens.css` over the committed ones, and add the new-surface docs as they are written.

## Why this order

1. **Shared parts first.** Twelve surfaces reuse the same nine components. `10-shared-patterns.md` already describes them as *patterns*; section 00 makes them *React components*, once.
2. **Staff before customers.** Admin and Moderation are the ugliest surfaces (`bg-[#EBEBEB]`, no shell) *and* the safest to get wrong — nobody outside the company sees them. Prove the components there.
3. **New destinations last.** Templates, Create and Cinema do not exist. A new surface on unproven components is two risks at once.

## The sections

| # | Section | Touches | Risk | Grammar from |
|---|---|---|---|---|
| 00 | Foundation top-up | `client/src/foundation/` | none — no visible change | studio `10-shared-patterns` |
| 00b | Chrome and menus | `UserCard`, `LobbyUtilityMenu` | low | studio `09-settings-account` + brief 00b |
| 01 | Staff shell adoption | `pages/Admin*`, `ModeratorDashboard` | low, staff-only | studio `01-shell-foundation` |
| 02 | Staff redesign | `features/admin/`, `features/moderator/` | low, staff-only | **new — brief 02** |
| 03 | Crew | `pages/AdminCrew`, `features/admin/components/crew/` | low, one user | **new — brief 03** |
| 04 | Lobby Home | `features/lobby/HomeView` | medium | studio `02-home` (+ refresh) |
| 05 | Library + Assets | `features/lobby/LibraryView` | medium | studio `08-assets-library` |
| 06 | Casting | `pages/CastingV2`, `features/castingV2/` | high — biggest | studio `07-casting`, `design_handoff_casting/` |
| 07 | Canvas tab | `features/lobby/BoardsView` | medium | studio `05-canvas-tab` |
| 08 | Templates | new | medium | studio `06-templates` |
| 09 | Create | new | medium | studio `03-create`, `04-model-picker` |
| 10 | Cinema | new | high — largest | **new — brief 10** |
| 11 | Retire the legacy nav | `components/Navigation.tsx`, `/studio` | low | — |

Sections 04–07 can run in any order once 00–02 land. 08–10 need 00 plus at least one of 04–07 shipped.

The **canvas editor** (`DrapeStudio.tsx` / `features/boards/`) is not in this list. It has its own package — `design_handoff_canvas/` — and its own sequencing decision to make; section 07 is the lobby page that lists boards, not the editor.

## Rules that apply to every section

The handoff's ground rules stand — no raw hex, accent means state, one theme attribute, neutral media, Archivo + JetBrains Mono. Additions from working in the repo:

- **The prototype is the reference, not the source.** It is one file of inline styles because that is how it paints while streaming. Read values out of it; write idiomatic React against the foundation.
- **Widths come from the foundation:** 1180 browse, 1240 working, 790 reading. No fourth number. The prototype's old 1120 was invented and has been removed.
- **`--error` is the only colour besides accent**, and only for genuinely urgent state. `adminConstants.ts` and `moderatorConstants.ts` define seven tints between them; all seven collapse to greyscale plus `--error`.
- **Solid border = fact. Dashed border = not yet.** Load-bearing across staff, casting and Cinema.
- **Nothing ships behind a scroll.** Four overflow bugs in the prototype came from `flex:1; min-width:0` text beside `flex:none` controls. Such a row needs a `min-width` floor and `flex-wrap: wrap` — never `overflow-x: auto`.
- **Do not touch `Rail.tsx`** except in the section that owns it. Seven destinations, three inert stubs, and the rail's own rule is that it never changes shape.
- **Do not change `DEFAULT_THEME`.** Light is a founder ruling (2026-07-30) holding until every surface follows tokens. Section 11 revisits it.

### Two rulings that override what the code currently says

**1. Existing does not mean finished.** Several features are built but were made before the foundation settled, and they break its documented rules — `fontWeight: 600` (the foundation states 600 "is never used"), sans-face eyebrows, per-component `<style>` blocks, Tailwind spacing, four icon sizes. A section that touches a working feature is still expected to bring it onto the grammar. "It already works" is not a reason to leave it ugly.

**2. Unbuilt features are designed in, greyed out.** `Rail.tsx` already does this and argues it well: *"the rail never changes shape… Better to show the whole map at once and be honest about which roads are open."* That approach now applies everywhere — **superseding the no-dead-links comment in `LobbyUtilityMenu`**, which currently justifies omitting entries entirely.

Copy `Rail.tsx`'s treatment exactly: not a link, not a button, `aria-disabled`, out of the tab order, `--muted`, `title="{label} — not built yet"`.

The line that keeps it honest: **a stub names a place, never a capability.** An inert "Documentation" entry is fine. An inert "Publish" button is a lie about what the product does. Stubs belong in navigation and menus, never on an action — and never with an unread dot, which promises content.

**Worked example — projects.** Projects are coming but unbuilt. The prototype scopes everything by them: a topbar switcher, per-project counts, a brand dot on every asset card, and `project === proj.name` filtering through every list.

- The **switcher ships inert**, reading `All projects` — which is not a placeholder, it is *true today*, which is what makes the stub honest.
- Everything else does **not** ship: no `projectId` on any query, no per-project counts (show the real workspace total), no brand dot (with no projects it encodes nothing, and a colour that means nothing breaks the accent rule), no scoped filter chips.

Speculative plumbing is the failure mode to avoid — a `projectId` threaded through twenty call sites "ready for later" will be the wrong shape by the time later arrives. Add it with the feature, in one diff. Brief 00b §4 has the detail.

## How to use a brief

Six parts each: what it is (and excludes) · files (read / change / leave alone) · the design · copy · what NOT to do · definition of done.

Precedence, highest first: **the shipped foundation** → **the live prototype** → **the handoff docs** → **these briefs**.
