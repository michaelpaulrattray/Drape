# Drape UI redesign — one brief at a time

> ⚠ **This file was called "the running order" and there is no longer a running
> order.** Founder, 2026-08-30: *"disregard the plan for earlier and ill just
> send you a breif per ui/ux re-design and we can figure it out from there."*
> **A section exists when he sends its brief.** No shift picks the next one, and
> no list in this folder names it — see `START-HERE.md` for the current state
> and `BRIEF-RECONCILIATION.md` for what to do with a brief when it arrives.
> Item 1 below is struck for the same reason; items 2 and 3 stand.

## Read this first: what this folder is, and is not

This pack lives at `docs/specs/Casting-ui-ux-design/drape-redesign/`. Its siblings — `design_handoff_studio/`, `design_handoff_canvas/`, `design_handoff_casting/`, `drape-foundation/` — **already hold the design grammar**:

| Existing package | What it defines |
|---|---|
| `design_handoff_studio/` (11 docs) | The lobby shell and the tabs, the modals, the model picker. `10-shared-patterns.md` is the grammar: section header, media card, dashed create tile, hover reveal, toast, segmented control, motion vocabulary, popover discipline, the aspect-ratio rule. |
| `design_handoff_canvas/` (7 docs) | The node editor: chrome, nodes, wires, selection, node toolbar, agent, small print. |
| `design_handoff_casting/` | The casting hero, and the sign / delete / rename modals. |
| `drape-foundation/` | `tokens.css` (adopted verbatim into `client/src/foundation/tokens.css`) and the living reference. |

**Those documents remain the source of truth for how things look.** This folder does not restate them. Where a brief here and a handoff doc disagree on grammar, the handoff wins.

What this folder adds, and only this:

1. **A running order against the real codebase** — which repo files, in which order, at what risk.
2. **Repo-specific briefs** — real paths, what to leave alone, what the existing code already does right.
3. **The surfaces the handoff does not cover at all** — Admin, Moderation, Crew, Cinema.

## Why this order — and why it changed

**The first version of this pack ordered shared components before the surfaces that use them. That was wrong.**

The pack's own worked example on projects says why: *"Speculative plumbing is the failure mode to avoid — a `projectId` threaded through twenty call sites 'ready for later' will be the wrong shape by the time later arrives. Add it with the feature, in one diff."* Section 00 shipped nine components; **eight have no consumer in the product.** The same pass missed two parts that appear on five surfaces each — the fanned card stack and the image viewer — because it inventoried from the design instead of counting real usage.

The promotion audit (#262) worked the other way round: it read the code, counted consumers, and was right about everything, including the popover collision section 00 itself created. **That is the method this pack now follows.**

### Build a page. Then promote what it proved.

Pure page-by-page has its own failure mode, and this repo already holds the evidence: casting carries 148KB of its own stylesheet because it was built alone and invented its own vocabulary. Six pages built that way produce six vocabularies.

The correction is not to predict the sharing up front. It is to run a **promotion pass** at the end of every section, while the page is fresh — see `PROMOTION-PASS.md`. The audit proved this is cheap: 96.9% of casting's CSS was attributable to a single component by class name, so the split was mechanical rather than a negotiation.

### What stays shared-first

Two things, because they are genuinely shared and already proven:

- **The chrome every surface renders** — section 00b, merged.
- **The five components casting already proved** — section 01, next.

### Then, in order

- **Staff first.** Low risk, nobody outside the company sees it, and Crew is a tool the founder uses daily. *Not* "to prove the components" — that was the old argument and it was wrong: staff surfaces carry almost no media, and `MediaCard` is the most-reused part in the product.
- **Existing customer surfaces next, worst first.** Home is a title, a grid and three numbered lines of type; it is the first thing anyone sees.
- **New destinations last.** Templates, Create and Cinema do not exist. A new surface is enough risk on its own.
- **Casting is frozen.** It is the only surface with real design in it, it is the reference the others match, and the audit says most of it moves *outward* rather than being rebuilt. Only section 01 touches it.

## The sections

| # | Section | Touches | Risk | State |
|---|---|---|---|---|
| 00 | Foundation top-up | `client/src/foundation/` | none | ✅ merged |
| 00b | Chrome and menus | `UserCard`, `LobbyUtilityMenu`, topbar | low | ✅ merged |
| 01 | **Promotion — five parts out of casting** | `features/castingV2/` → `foundation/` | low, no behaviour change | next |
| 02 | Admin & Moderation | `pages/Admin*`, `features/admin/`, `features/moderator/` | low, staff-only | |
| 03 | Crew | `pages/AdminCrew`, `features/admin/components/crew/` | low, one user | |
| 04 | Home | `features/lobby/HomeView` | medium | |
| 05 | Library & Assets | `features/lobby/LibraryView` | medium | |
| 06 | Canvas tab | `features/lobby/BoardsView` | medium | |
| 07 | Templates | new | medium | |
| 08 | Create | new | medium | |
| 09 | Cinema | new | high — largest | |
| 10 | Retire the legacy nav | `components/Navigation.tsx`, `/studio` | low | |
| — | **Casting** | — | — | **frozen — reference only** |

Every section from 02 to 09 ends with a promotion pass. Sections 04–06 can run in any order. 07–09 need at least one of 04–06 shipped, so there is a second consumer to promote against.

The **canvas editor** (`DrapeStudio.tsx` / `features/boards/`) is not in this list. It has its own package — `design_handoff_canvas/` — and its own sequencing decision; section 06 is the lobby page that lists boards, not the editor.

## The known promotion queue

Found and deferred, in the order they will come up. Do not build these speculatively — each one lands in the section that gives it its second consumer.

| Part | Consumers | Lands with |
|---|---|---|
| **Fanned card stack** | casting hero + templates run modal | 07 Templates |
| **Image viewer** | Create + Cinema | 08 Create |
| **Text field** — resolve `Field` vs `Input` vs casting's brief box | everywhere | 01 (decide), whichever section needs it (build) |
| **Spinner** | everywhere | when a second surface needs one |

Two notes on those, both corrections to earlier guidance:

- **The stack is shared in mechanism, not in trim.** Casting's is always 4:5 and rotates itself; the templates one takes any ratio and is clicked through. Promote the stack with shape, rotation and tilt as settings; each page supplies what sits underneath. The tilt and fade values currently differ between the two for no reason — pick one set.
- **The viewer is two components, not one.** Create's and Cinema's do the same job and should be one. **Casting's is a different job** — judging a person, with keep / discard / sign / compare — and stays separate. Same rectangle, different purpose.

## Rules that apply to every section

The handoff's ground rules stand — no raw hex, accent means state, one theme attribute, neutral media, Archivo + JetBrains Mono. Additions from working in the repo:

- **The prototype is the reference, not the source.** It is one file of inline styles because that is how it paints while streaming. Read values out of it; write idiomatic React against the foundation.
- **Widths come from the foundation:** 1180 browse, 1240 working, 790 reading. No fourth number.
- **A part joins the shared kit when a second real page uses it.** Not when a third surface is planned to. Discovered, never predicted.
- **`--error` is the only colour besides accent**, and only for genuinely urgent state.
- **Accent means state, and one state gets one signal.** A kept card wears an underline and a badge — not also a border and a check. Four signals for one fact is how a system starts shouting.
- **Colour never encodes a category.** Types, kinds and tags are greyscale. `IDENTITY LOCKED` is accent because locked is a state; `PERFORMER` is not.
- **Solid border = fact. Dashed border = not yet.** Load-bearing across staff, casting and Cinema.
- **A create tile and a gap tile are the same shape and different sentences.** Create says the action ("New cast member"); gap says `NEEDED` plus what is blocking. Never both.
- **Nothing ships behind a scroll.** Four overflow bugs in the prototype came from `flex:1; min-width:0` text beside `flex:none` controls. Such a row needs a `min-width` floor and `flex-wrap: wrap` — never `overflow-x: auto`.
- **The answer to a long label is never a smaller font.** Give the column its measured width.
- **Do not touch `Rail.tsx`** except in the section that owns it.
- **Do not change `DEFAULT_THEME`.** Light is a founder ruling (2026-07-30) holding until every surface follows tokens. Section 10 revisits it.

### Two rulings that override what the code currently says

**1. Existing does not mean finished.** Several features were built before the foundation settled and break its documented rules — `fontWeight: 600` (the foundation states 600 "is never used"), sans-face eyebrows, per-component `<style>` blocks, Tailwind spacing. A section that touches a working feature is still expected to bring it onto the grammar.

**2. Unbuilt features are designed in, greyed out.** `Rail.tsx` already does this and argues it well: *"the rail never changes shape… Better to show the whole map at once and be honest about which roads are open."*

Copy `Rail.tsx`'s treatment exactly: not a link, not a button, `aria-disabled`, out of the tab order, `--muted`, `title="{label} — not built yet"`.

The line that keeps it honest: **a stub names a place, never a capability.** An inert "Documentation" entry is fine. An inert "Publish" button is a lie about what the product does. Stubs belong in navigation and menus, never on an action — and never with an unread dot, which promises content.

Two corollaries learned in 00b:

- **Never stub something that already exists.** A greyed "Theme" row beside a working theme toggle reads as "theming isn't built".
- **Watch the ratio.** Four dead rows out of six reads as a broken menu, not a menu with things coming. If most of a menu is stubs, cut the ones that may never exist.

**Worked example — projects.** Projects are coming but unbuilt. The prototype scopes everything by them: a topbar switcher, per-project counts, a brand dot on every asset card, and `project === proj.name` filtering through every list.

- The **switcher ships inert**, reading `All projects` — which is not a placeholder, it is *true today*, and that is what makes the stub honest.
- Everything else does **not** ship: no `projectId` on any query, no per-project counts, no brand dot, no scoped filter chips.

## How to use a brief

Six parts each: what it is (and excludes) · files (read / change / leave alone) · the design · copy · what NOT to do · definition of done.

Precedence, highest first: **the shipped foundation** → **the live prototype** → **the handoff docs** → **these briefs**.
