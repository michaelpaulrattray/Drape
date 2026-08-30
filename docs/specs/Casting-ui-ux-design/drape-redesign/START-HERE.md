# Start here

**This pack lives at `docs/specs/Casting-ui-ux-design/drape-redesign/`**, beside the design handoff it builds on. Every path below is from the repo root.

## What is already built — do not rebuild it

`client/src/foundation/` is done and shipped:

- `Rail.tsx` — 76px rail, seven destinations, three inert stubs, account chip
- `Topbar.tsx` — 56px glass topbar, theme toggle
- `AppShell.tsx` — rail + topbar + content column (1180 / 1240 / bare)
- `tokens.css` — adopted verbatim from the handoff, light + dark, `[data-theme]` on `<html>`
- `primitives.tsx` — 20 components (Button, Card, Chip, CreditsChip, Dock, DropZone, EmptyState, Field, IconButton, Input, MediaFrame, Progress, SectionHead, Skeleton, StatusPill …)
- `theme.ts`, `foundation.css`, `BrandOrb.tsx`, `token-guard.test.ts`

`AppLobby.tsx` already mounts the lobby inside `AppShell`. **The rail and theming are live.** Nobody needs to design or build them again.

## Already built — but not finished

These exist and work. **They still need redesigning** — they were built before the foundation settled and they break its rules (`fontWeight: 600`, sans-face eyebrows, per-component `<style>` blocks, Tailwind spacing). Section **00b** covers them. Working is not the same as done.

| Live in the app | Where |
|---|---|
| **Report a bug** and **Send feedback**, wired to `bugReports.submit` | `features/lobby/LobbyUtilityMenu.tsx` |
| **Admin / Moderator access from the account menu**, role-gated to match the server | `components/UserCard.tsx` |
| Settings, Billing, Share Drape (referral), Log out | `components/UserCard.tsx` |
| Credits chip in the topbar | `CreditsChip` in `primitives.tsx`, mounted by `AppLobby` |
| Profile avatar with a real image | `features/profile/ProfileVisual.tsx` |
| Five account modals (settings, billing, top-up, referral) | `AppLobby.tsx` |

`LobbyUtilityMenu` carries one real bug fix worth not undoing: it used to sit `absolute top-4 right-5` and became unclickable when the shell put the theme toggle in the same square (#73). It must stay an ordinary `dp-iconbtn` in the topbar row.

Its *other* comment — the no-dead-links rule justifying why Documentation, theme and cookie preferences are omitted — **is superseded.** Unbuilt features get designed in and greyed out, following `Rail.tsx`'s existing stub pattern. See README → *Two rulings*.

## What the prototype has that the app does not

Chrome-level gaps, small enough to fold into whichever section touches the topbar:

| Missing | Note |
|---|---|
| **Queue pill** — "2 running · 40s", accent wash, live spinner | The only genuinely absent piece of chrome. It needs a real jobs feed, so it belongs with section 04 (Home), not before. |
| **What's new** icon | Ships **inert** in section 00b — visible, greyed, `— not built yet`. No unread dot; a dot on a stub promises content. |
| **Documentation, keyboard shortcuts, cookie preferences** | Ship **inert** in the utility menu, section 00b. |
| **Help & docs** as a separate topbar icon | Dropped — it duplicates the utility menu's Documentation entry. One route to a thing. |
| **Project switcher** in the topbar | Projects are coming but unbuilt. **Decided:** the switcher ships **inert** in 00b reading `All projects`; the scoping does not ship at all — no `projectId` on queries, no per-project counts, no brand dots. See 00b §4. |
| **Staff count badges** in the account menu | Small, real, and covered in brief 01 §3. |

## What is not built

| | State |
|---|---|
| Lobby content (Home, Boards, Library) | Wrapped in the shell, content still pre-redesign (`width="bare"`) |
| Admin, Moderation, Crew | No shell at all — hardcoded `bg-[#EBEBEB]` |
| Templates, Create, Assets | Inert rail stubs, no pages |
| Cinema | Does not exist, not in `RAIL_DESTINATIONS` |
| `/studio` | Still on the legacy glass `Navigation.tsx` |

## The two things to do now

### Step 1 — refresh the stale spec (30 minutes, no code)

This pack is already in the repo. What is stale is the **prototype** committed beside it. Overwrite these with the current versions from design:

- `docs/specs/Casting-ui-ux-design/design_handoff_studio/Klieg Studio.dc.html`
- `docs/specs/Casting-ui-ux-design/design_handoff_studio/support.js`
- `docs/specs/Casting-ui-ux-design/design_handoff_studio/image-slot.js`
- `docs/specs/Casting-ui-ux-design/drape-foundation/tokens.css`

The committed copy predates Cinema, Crew, Admin, Moderation, Templates-as-a-destination, the Home rebuild, the width change from 1120 to 1180/1240, and the scrim + error token groups. Building from it means building towards an old target.

**Sanity check before moving on:** open the refreshed `Klieg Studio.dc.html` and confirm the rail shows **eight** items including Cinema, and that the account menu has a **STAFF** group. If either is missing, the copy did not land.

### Step 2 — section 00: foundation top-up (one PR, no visible change)

Read `docs/specs/Casting-ui-ux-design/drape-redesign/00-foundation-topup.md`.

Nine components go into `client/src/foundation/`, plus four keyframes, one CSS rule and a `usePopover` hook. Six of the nine are already specified visually in `docs/specs/Casting-ui-ux-design/design_handoff_studio/10-shared-patterns.md` — brief 00 gives the API, that doc gives the look.

**Acceptance test for the whole section: no existing page changes appearance.** If a surface moved, something overreached.

### Step 3 — section 00b: chrome and menus (one PR, visible)

Read `docs/specs/Casting-ui-ux-design/drape-redesign/00b-chrome-and-menus.md`.

The account menu and utility menu onto the grammar, plus the inert-stub rule. Small, and every surface shows this chrome — fixing it before the surfaces means none of them inherit the inconsistency.

## Then stop and check in

Do not run ahead to section 02. Section 01 (staff shell adoption) is written and ready, but 02 onward should be written knowing what 00 and 01 actually shipped — component APIs shift once they have real consumers.

## The message to send

> Two tasks, in order.
>
> The brief pack is at `docs/specs/Casting-ui-ux-design/drape-redesign/`. Read its `START-HERE.md` and `README.md` first, then work one brief at a time.
>
> **First**, refresh the stale prototype: overwrite `docs/specs/Casting-ui-ux-design/design_handoff_studio/Klieg Studio.dc.html`, `support.js`, `image-slot.js` and `docs/specs/Casting-ui-ux-design/drape-foundation/tokens.css` with the current versions from design. The committed copy predates Cinema, Crew, Admin and Moderation. Check: the refreshed prototype's rail should show eight items including Cinema.
>
> **Second**, do `docs/specs/Casting-ui-ux-design/drape-redesign/00-foundation-topup.md` as one PR. It adds nine shared components to `client/src/foundation/`, four keyframes, one CSS rule and a `usePopover` hook. It must not change how any existing page looks — that is the acceptance test.
>
> **Third**, do `docs/specs/Casting-ui-ux-design/drape-redesign/00b-chrome-and-menus.md` as one PR. It redesigns the account and utility menus onto the foundation grammar and adds the inert-stub rule.
>
> Do not build the rail, topbar, shell or tokens themselves — they are already shipped in `client/src/foundation/` and adopted by `AppLobby.tsx`. But do bring the menus that hang off them onto the grammar; several use `fontWeight: 600`, which the foundation explicitly bans.
>
> Two rulings that override comments you will find in the code: **(1)** a feature already working is still expected to be brought onto the grammar; **(2)** features we have not built yet get designed in and greyed out, following `Rail.tsx`'s stub pattern — this supersedes the no-dead-links comment in `LobbyUtilityMenu`. A stub names a place, never a capability, and never carries an unread dot.
>
> Do not start section 01 or later until 00 and 00b are merged and I have looked at them.
