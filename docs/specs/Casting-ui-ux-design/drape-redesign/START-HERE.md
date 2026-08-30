# Start here

**This pack lives at `docs/specs/Casting-ui-ux-design/drape-redesign/`**, beside the design handoff it builds on. Every path below is from the repo root.

Read `README.md` next — it carries the running order, the rules, and the reasoning behind both.

## Where the lane is

| | |
|---|---|
| ✅ **00 — Foundation top-up** | Merged. Nine components, four keyframes, the popover hook. Zero changed pixels. |
| ✅ **00b — Chrome and menus** | Merged. Account menu, utility menu, topbar, the inert-stub rule. |
| ▶ **02 — Topbar and rail** | **RUNNING** — card #270. The frame every page sits inside. |
| ⏸ **01 — Promotion: five parts out of casting** | Approved and specified (his reply #43 on #262), **not yet run**. It is the first thing to take when he next says so — the number is its file name, not its position. |

⚠ **THERE IS NO RUNNING ORDER ANY MORE — struck 2026-08-30 by the founder.**
This table used to end *"Then 02 Admin & Moderation → 03 Crew → 04 Home → 05
Library & Assets → 06 Canvas tab → 07 Templates → 08 Create → 09 Cinema → 10
Retire the legacy nav."* **That list is dead.** His words:

> *"disregard the plan for earlier and ill just send you a breif per ui/ux
> re-design and we can figure it out from there"*

and, when he parked the lane:

> *"we're switching to one brief per thing, written just before it's built. No
> more specifying six sections ahead."*

**A section exists when he sends its brief, and not before.** Sections arrive in
whatever order he needs them — the rails first, then the Settings modal, then
the credits/subscription modal, then whatever the product asks for next. **The
file numbers are names, not a queue.** A shift finishing one section STOPS and
waits; it does not pick the next from any list, including this one.

**Why**, in his words: the mockups were *"designed on a canvas with no
functions"*, and building six sections ahead of the pages that use them is what
produced nine shared components of which eight have no consumer. See
`BRIEF-RECONCILIATION.md` — every brief is reconciled against the codebase
before it is built.

**Casting is frozen.** Only section 01 touches it, and only to move things out.

## The order changed after 00 — read this before section 01

The original pack put shared components before the surfaces that use them. Section 00 shipped nine; **eight have no consumer in the product**, and the same pass missed two parts that appear on five surfaces each. The audit filed as #262 found this by reading the code rather than the design, and its method is now the method.

**Build a page. Then promote what it proved.** Every section from 02 onward ends with a promotion pass — `PROMOTION-PASS.md`, half an hour, written, before the section is called done.

The eight orphaned components stay where they are. Do not delete them and do not build more like them. As pages get built, each either uses one or does not; whatever nothing uses at the end gets removed then.

## What is already built — do not rebuild it

`client/src/foundation/` is done and shipped:

- `Rail.tsx` — the rail, its destinations, the inert-stub pattern, the account chip
- `Topbar.tsx` — 56px glass topbar, theme toggle, `right` slot
- `AppShell.tsx` — rail + topbar + content column (1180 browse / 1240 working / bare)
- `tokens.css` — light + dark, `[data-theme]` on `<html>`, the motion keyframes
- `primitives.tsx` — Button, Card, Chip, CreditsChip, Dock, DropZone, EmptyState, Field, IconButton, Input, MediaFrame, Progress, SectionHead, Skeleton, StatusPill and more
- `Popover.tsx`, `theme.ts`, `foundation.css`, `BrandOrb.tsx`, `token-guard.test.ts`
- Section 00's additions: `MediaCard`, `HoverActions`, `SurfaceBar`, `DataTable`, `ExpandableRow`, `CostedOption`, `MilestoneRail`, `Transcript`, `Marquee`

**Check before you add anything to that folder.** Three popover implementations existed at once because section 00 built one without looking.

## Two open items from 00 and 00b

Small, and they should land with section 01 rather than waiting:

1. ⚠ ~~**`dp-prog` is defined twice**~~ — **STRUCK 2026-08-30, read at the files. There is no duplicate, and the deletion this item ordered would have broken the progress bar.** `foundation.css` contains **zero `@keyframes` blocks**; all eleven live in `tokens.css`, each declared exactly once (`dp-marquee` 252, `dp-slidein` 253, `dp-pop` 254, `dp-prog` 255). The scan this item asked for is done: all four clean.
   **Why it read as doubled — a real trap, not a misreading.** `foundation.css` holds CLASS names that collide with keyframe names: `.dp-pop` (966) is the popover's styling, `.dp-progress` (921) is the progress bar's, `.dp-marquee` (1651) is the marquee's, and 1671 is `animation: dp-marquee …`, which *uses* the keyframe. CSS keeps class names and keyframe names in different namespaces; a grep for the bare name cannot tell them apart. **"Delete the `foundation.css` one" resolves to `.dp-progress`** — consumed by `primitives.tsx:394` — leaving an animation with nothing to animate.
   **The duplication was real in the brief and never reached the code**: brief 00 §3 listed additions §6 already had, and foreman-115 caught it during the build, put the four keyframes in `tokens.css`, and declared the deviation (its §5 item 2). **Before deleting on any duplicate-name finding, match the declaration form — `@keyframes <name>` or `.<name>` — never the bare name.**
2. **The specimen page is reachable by anyone**, signed out included, and it sits inside the `/casting` namespace. Move it out — staff routes or a dev-only build — rather than gating it in place, then sweep the other unlinked routes for the same shape.

## Known gaps against the design

The shell's skeleton is right; what hangs off it is not finished. These land in the section that owns the surface, not before:

| Missing | Where it lands |
|---|---|
| **Centred search** — "Search frames, faces, prompts…" with ⌘K. Ships **inert and non-focusable**: a text field that accepts typing is claiming a capability. | 00b follow-up or 04 |
| **Queue pill** — "3 running · 40s". Needs a real jobs feed; a pill over nothing is a lie about what the studio is doing. | 04 Home |
| **Cinema as an eighth rail destination.** `Rail.tsx` fixes the rail at seven on ruling F1 (2026-07-31); F1 is reversed once, then the shape is fixed at eight. Cinema ships inert until section 09. | 09 Cinema, stub earlier |
| **Bug and help as discrete topbar icons**, not buried in `···`. Report a bug should be one click. | 00b follow-up |
| **Member stack + Invite** at the bottom of the rail, with the account chip moved to the topbar's right cluster. | 04 |
| **One Settings modal, six sections** — Profile, Usage, Billing, Members, Notifications, Security — replacing the four separate modals `AppLobby` mounts today. Account-menu items open it at a section. | its own section, after 04 |

## The message to send

> The running order changed after section 00. Read `docs/specs/Casting-ui-ux-design/drape-redesign/README.md` and `PROMOTION-PASS.md` before starting.
>
> Short version: shared-components-first was wrong. Eight of the nine components from 00 have no consumer, and the same pass missed two parts used on five surfaces each. We build a page at a time from here, and each section ends with a written promotion pass that counts real consumers — the method your audit on #262 used, which was right about everything.
>
> **Next is section 01: the promotion.** Five parts out of casting into the shared kit, the `signm` stylesheet renamed first, and the three popover implementations collapsed to one with casting's surviving. The brief text box is held back pending a check against `Field` and `Input`. No behaviour changes anywhere.
>
> Fold in the two loose ends while you are there: the duplicated `dp-prog` keyframe, and moving the specimen page out of the `/casting` namespace.
>
> Casting is frozen otherwise. It is the only surface with real design in it and it is the reference every other page matches.
