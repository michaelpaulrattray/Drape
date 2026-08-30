# 00b — Chrome and menus

**Prerequisite: section 00.** Small, low risk, and it fixes chrome that every surface shows.

## What this section is

The account menu, the utility menu and the topbar's right slot exist and work — but they were built before the foundation settled and they break its rules. This section redesigns them onto the grammar, and establishes the project-wide rule for features that do not exist yet.

**Excluded:** any change to what the menus *do*. Same items, same mutations, same role gating, same modals. Only how they look, and what inert entries appear alongside.

## Why this comes before the surfaces

Every surface renders this chrome. Fixing it once, early, means no surface inherits the inconsistency — and the staff pages in section 01 mount the same account menu.

## Files

**Read first**
- `client/src/foundation/index.ts` — the weight rule, stated in a comment: *"Weights 400 and 500 only. 600 exists in both webfonts and is never used — a 600 heading next to a 500 heading reads as a mistake."*
- `client/src/foundation/Rail.tsx` — the inert-stub pattern, already shipped. This is the precedent §3 generalises.
- `design_handoff_studio/09-settings-account.md` and `10-shared-patterns.md`.

**Change**
- `client/src/components/UserCard.tsx`
- `client/src/features/lobby/LobbyUtilityMenu.tsx`
- `client/src/pages/AppLobby.tsx` — only the `topbarRight` composition

**Leave alone**
- `bugReports.submit` and every other mutation.
- The role gating in `UserCard` — `isAdmin = role === 'admin'`, `isModerator = isAdmin || role === 'moderator'`. It mirrors the server and is correct.
- `LobbyUtilityMenu`'s position in the topbar row. It used to sit `absolute top-4 right-5` and became unclickable when the shell put the theme toggle in the same square (#73). It must stay an ordinary `dp-iconbtn` in the row.

## 1. Rule violations to fix

These are not opinions — each one breaks a rule the foundation states about itself.

| Violation | Where | Correct |
|---|---|---|
| `fontWeight: 600` | `UserCard` ×3, `LobbyUtilityMenu` ×2 | **400 or 500 only.** The foundation says 600 "is never used". |
| Sans face used as an eyebrow — `fontSize: 11, fontWeight: 600, letterSpacing: .08em, textTransform: uppercase` for "Help" | `LobbyUtilityMenu` | JetBrains Mono, `500 8.5–9.5px`, `.12em`, `--faint`. Mono is what a machine-ish label is set in. |
| Credits shown in sans (`fontSize: 11`) | `UserCard` | Mono — it is a measured number. `400 10.5px JetBrains Mono`, `--faint`. |
| `<style>` blocks inside components | `UserCard`, `LobbyUtilityMenu` | Hover states belong in `foundation.css` as `.dp-menuitem`, once. Two components should not each ship a stylesheet for the same hover. |
| Tailwind spacing (`space-y-1`, `px-2 py-2`, `px-3 py-1.5`, `mt-2`) | both | The `--s-*` scale. |
| `rounded-lg` / `rounded-xl` | both | `--r-sm` / `--r-md` / `--r-2xl`. |
| `top-10`, `right-0` magic offsets | `LobbyUtilityMenu` | The `usePopover` hook from section 00. |
| `width: mode ? 300 : 200` | `LobbyUtilityMenu` | One width, `264px`. A panel that resizes when you click inside it reads as a glitch. |
| Icon sizes 3.5/4/15 mixed | both | 13px in menu rows, 15px in topbar buttons. Two sizes, not four. |

## 2. The account menu, redesigned

Structure stays. Grammar changes.

```
┌────────────────────────────────┐
│  ◍  Michael Rattray            │   avatar 30px, 1px --border ring
│     1,240 credits              │   mono 10.5px --faint
├────────────────────────────────┤
│  ⚙  Settings                   │   13px icon --metaStrong
│  ▭  Billing                    │   label 400 12px Archivo --secondary
│  ⌾  Share Drape                │   row hover: --well bg, --ink text
├─ STAFF ────────────────────────┤   mono 8.5px .13em --faint + 1px --rule
│  ▤  Admin                 (3)  │   count pill --fillStrong / mono 9px
│  ◉  Moderation            (4)  │
├────────────────────────────────┤
│  ⭎  Log out                    │   --accentInk, hover --accentWash
└────────────────────────────────┘
```

- Name: `500 12.5px Archivo`, `--ink`. **Not 600.**
- The name row currently shows credits underneath. Keep it — but consider showing the plan tier instead once the topbar credits chip is always visible; two credit displays 40px apart is one too many. Founder's call.
- `STAFF` group label is new. It is currently two bare dividers with no heading, which reads as an accident rather than a section.
- Count badges: Admin = pending change requests + unanswered Crew cards; Moderation = audit entries above `info` in 24h. Omit at zero; never render `(0)`.
- Rename `Moderator` → `Moderation` so both labels name a place.

## 3. The inert-stub rule — a project-wide ruling

**Features that do not exist yet are still designed in, and rendered inert.**

This is not new. `Rail.tsx` already does it, and its own comment argues the case better than I can: *"the rail never changes shape. A navigation bar that grows an item every few weeks teaches people to re-read it every time they open the app, and the muscle memory they build is wrong by construction. Better to show the whole map at once and be honest about which roads are open."*

**This supersedes the no-dead-links comment in `LobbyUtilityMenu`**, which currently justifies leaving Documentation, theme and cookie preferences out entirely. Show them, inert.

Copy `Rail.tsx`'s exact treatment — it is already correct:

- Not a link and not a button: no `href`, no handler.
- `aria-disabled="true"`, removed from the tab order.
- `title="{label} — not built yet"`.
- Visually: label and icon at `--muted`, no hover state, no cursor change.

**The distinction that keeps this honest:** a stub *names a place*, it never *claims a capability*. "Documentation" inert is fine. A "Publish" button that does nothing is not — that is a lie about what the product does. Stubs belong in navigation and menus, never on an action.

Inert entries to add:

| Menu | Inert entries |
|---|---|
| Utility (`…`) | **HELP** group: Send feedback ✓live, Report a bug ✓live, Documentation ○inert, Keyboard shortcuts ○inert. **PREFERENCES** group: Theme ○inert (the shell owns the toggle today), Cookie preferences ○inert |
| Account | none — every entry is live |
| Topbar | Project switcher ○inert (§4), What's new ○inert — no unread dot; a dot on a stub promises content |

## 4. The project switcher — inert, and the line it draws

Projects are coming but do not exist. Under the stub rule the switcher **ships visible and inert**, and it is worth doing carefully because it is the clearest example of where that rule stops.

**Build:** the switcher sits at the far left of the topbar, before the breadcrumb.

- Reads **All projects**, with the folder glyph and a chevron.
- `aria-disabled="true"`, out of the tab order, no handler, `title="Projects — not built yet"`.
- Label `400 12px Archivo` `--muted`; chevron `--muted`. No hover state.
- Today's label is not a placeholder — it is **true**. Everything in the workspace *is* all projects. That is what makes this stub honest rather than a promise.

**Do not build:**

| Not this | Why |
|---|---|
| A `projectId` param on any tRPC query | Speculative plumbing that rots. Add it with the feature, in one diff, so the shape is decided by real requirements. |
| Per-project counts — "8 canvases", "3 in this project" | Show the real workspace total. A scoped count with no scope is a wrong number. |
| The brand dot on asset cards | In the prototype it encodes which project an asset belongs to. With no projects it encodes nothing — and a coloured dot that means nothing breaks the accent rule. Drop it until projects exist. |
| A dropdown that opens onto one item | An inert control is honest; a working control with nothing in it is a dead end. |
| Filter chips scoped by project | Same reason. Kind and date filters are real and stay. |

**The line, stated once:** the switcher *names a place*, so it is a legitimate stub. Per-project filtering is a *capability*, so it is not faked anywhere — not in the UI, not in a query signature, not in a count.

## 5. The topbar right slot

Order, left to right: **queue pill → credits chip → utility menu → theme toggle → account chip.**

The queue pill is **not** built in this section — it needs a real jobs feed and belongs with section 04. Leave the slot for it, and do not ship a fake one.

`Help & docs` as a separate topbar icon is dropped: it duplicates the utility menu's Documentation entry. One route to a thing.

## Copy

| Slot | Copy |
|---|---|
| Utility menu button title | `Help and preferences` |
| Utility group labels | `HELP`, `PREFERENCES` |
| Feedback placeholder | `What should we improve?` |
| Bug placeholder | `What happened, and what did you expect?` |
| Inert tooltip | `{label} — not built yet` |
| Project switcher | `All projects` · tooltip `Projects — not built yet` |
| Account staff group | `STAFF` |
| Log out | `Log out` |

Existing copy is good — keep it. The bug/feedback placeholders in particular are specific rather than generic, which is why the reports are usable.

## What NOT to do

- **Do not change what any menu item does.** This is a grammar pass.
- **Do not use `fontWeight: 600` anywhere**, including in the components you are rewriting. It is the single most common violation in the current chrome.
- **Do not put an unread dot on an inert entry.** A dot promises something to read.
- **Do not build the queue pill.**
- **Do not move `LobbyUtilityMenu` back to a fixed corner position.** See #73.
- **Do not make a stub look enabled.** If a user can click it and nothing happens, the stub has failed at its one job.
- **Do not add inert entries to action surfaces** — buttons, run controls, primary CTAs. Navigation and menus only.
- **Do not thread a `projectId` through any query "ready for later".** The switcher is a stub; the data layer is not.
- **Do not keep the prototype's per-project counts or brand dots.** They encode a thing that does not exist.

## Definition of done

- [ ] `grep -rn "fontWeight: 600\|font-weight: 600\|font-semibold" client/src/components/UserCard.tsx client/src/features/lobby/LobbyUtilityMenu.tsx` returns nothing.
- [ ] No `<style>` block inside either component; the shared hover lives in `foundation.css`.
- [ ] Utility menu is one width in both states.
- [ ] Both menus use `usePopover` — no magic `top-10`.
- [ ] `STAFF` group label present; Admin and Moderation carry live counts and omit at zero.
- [ ] Inert entries render with `aria-disabled`, out of tab order, `--muted`, with the `— not built yet` tooltip, and are not focusable by keyboard.
- [ ] No unread dot on any inert entry.
- [ ] Both menus render correctly in dark mode.
- [ ] Project switcher renders inert at the far left of the topbar, reads `All projects`, is not focusable, and carries the `— not built yet` tooltip.
- [ ] `grep -rn "projectId" client/src` shows no new occurrences.
- [ ] No per-project count and no brand dot anywhere.
- [ ] Every mutation, modal and role gate behaves exactly as before.
