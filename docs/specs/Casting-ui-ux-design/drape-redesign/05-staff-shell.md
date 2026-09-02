# Staff shell — Admin and Moderation come home

**One PR. Routing and frame only. Zero content changes.**

Live reference: `design_handoff_studio/Klieg Studio.dc.html` — account menu → Admin, and → Moderation. Open it beside your build.

This is the first of five staff briefs. The other four (staff tables, Admin Overview, Crew, the moderator's investigative tabs) get written after this one ships, against what it actually leaves behind.

---

## 1. What this is

Today Admin and Moderation are **nine separate full-page routes** that replace the app. `AdminHeader` renders its own sticky header with a `Studio` button to get back, its own `max-w-7xl` column, and each page paints its own `min-h-screen bg-[#EBEBEB]`. Going to Admin means leaving Klieg and arriving somewhere that looks like a different product.

In the design, staff is a **surface inside the same app** — same rail, same topbar, same shell — with one staff bar carrying the section tabs. Nothing about it announces that you have left.

**This PR moves the frame and nothing else.** Every page keeps its exact current content, ugly, inside the new frame. The tables stay Tailwind, the cards keep their hex literals, the modals stay as they are. They get fixed in their own briefs.

**The acceptance test is: same data, same actions, same everything — new frame.** If a diff in this PR changes a table, a card, a query or a modal, it is out of scope. Resist the urge; the whole reason this is one small PR is so the frame can be judged on its own.

### Excluded
- Any change to page content, tables, cards, charts, modals, queries or mutations.
- Any change to what the pages *do*, including auth behaviour beyond where the redirect lands.
- `AdminFoundation` — the specimen page. It is not a staff surface and it is not designed. Its own fix is to move out of the `/casting` namespace entirely (staff routes or a dev-only build), which can ride along in this PR or go separately. It does **not** get a tab.

---

## 2. Files

**Change**
- `client/src/features/admin/AdminHeader.tsx` → becomes `StaffBar` (rename it; the old name describes a page header that no longer exists)
- All nine page files: strip the `min-h-screen bg-[…]` wrapper and the `max-w-7xl mx-auto` column, keep the body
- The router — staff routes mount inside `AppShell`
- `client/src/foundation/foundation.css` — the staff bar

**Read, do not change**
- `client/src/foundation/AppShell.tsx` — its widths and gutters are correct; this consumes them
- `client/src/features/admin/components/crew/useCrewState.ts` — the Crew visibility flag stays exactly as it is

**Leave alone**
- Every file under `overview/`, `crew/`, `moderator/` except where the page-level wrapper is stripped.
- Every auth guard's logic. Only the *destination* of the non-admin redirect is in scope (§6).

---

## 3. The frame

Staff renders inside `AppShell`, so the rail and topbar are already there and unchanged. Below the topbar:

```css
height: calc(100vh - 56px);
display: flex; flex-direction: column;
min-height: 0; overflow: hidden;
background: var(--page);
```

**`overflow: hidden` on the outer, scrolling on the inner pane.** Staff surfaces are working tools — the bar stays put while a 4,000-row audit table scrolls under it. This is the same arrangement Cinema uses and the opposite of the lobby's page scroll.

No `min-h-screen`, no page background, no `max-w-7xl` on the page. The shell owns all three.

### Content width
`AppShell` at **`working` (1240px)** for every staff surface except Crew, which is **790px** — it is a briefing you read, not a grid you scan. Do not introduce a fourth width.

`AppLobby` currently mounts `width="bare"`. Staff must not copy that.

---

## 4. The staff bar

One row, wrapping, replacing `AdminHeader`'s two-row title/nav stack.

```css
flex: none;
display: flex; align-items: center;
gap: 12px 16px; flex-wrap: wrap;
padding: 13px 24px;
border-bottom: 1px solid var(--border);
background: var(--surface);
```

Left to right:

**1. Eyebrow + title**, a `gap: 2px` column, `flex: none`:

| | |
|---|---|
| Eyebrow | `500 9.5px JetBrains Mono`, `.13em`, `--meta` — `ADMIN` or `MODERATION` |
| Title | `500 14px Archivo`, `-.015em`, nowrap with ellipsis |

Titles: `Klieg Studio — everything` for admin, `Klieg Studio — watch and propose` for moderation. The workspace name, then what the role can do. It replaces per-page titles like `Admin Overview`, which the tab already says.

**2. Divider** — `1px × 28px`, `--borderSoft`, `flex: none`.

**3. Tabs** — a segmented control, `flex: none`:

```css
display: flex; gap: 1px; padding: 2px;
background: var(--fillStrong);
border-radius: var(--r-lg);
```
Segments: `padding: 7px 12px; border-radius: var(--r-sm); white-space: nowrap`. Selected gets `--surface` + a 1px shadow and `500` weight; unselected is `400` `--secondary`, hover `--ink`.

A segment may carry a count pill — `padding: 1px 5px; border-radius: var(--r-pill)`; selected `--fillStrong` on `--metaStrong`, unselected `--surface` on `--faint`. **Omitted at zero**, never `(0)` — same rule as the account menu, and `showsMenuCount` already implements it.

**4. Spacer** — `flex: 1 1 0; min-width: 0`. A spacer element, never `margin-left: auto`: any computed-style read resolves auto margins to hard pixels, which overflows a wrapping row and clips inside `overflow: hidden`.

**5. Refresh cluster** — `gap: 7px; flex-wrap: wrap; min-width: 0`:
- The stamp — `400 11px JetBrains Mono`, `--faint`, nowrap. This is `refreshControls.lastRefresh.toLocaleTimeString()`, which already exists.
- `1px × 14px` `--borderSoft` divider.
- The auto-refresh toggle: a `22 × 13px` track, `border-radius: var(--r-pill)`, `--ink` on / `--dotsStrong` off; a 9px `--surface` knob at `left: 2px → 11px`, `transition: left .14s`. Label `AUTO 30s` in `400 11px` mono `--faint`.
- The manual refresh icon button, 26px, `--metaStrong`, spinning on `dp-spin` while refetching.

**Render the cluster only when the surface provides refresh controls.** It is already optional in `AdminHeader` and several surfaces do not poll.

> ⚠ **CORRECTED 2026-09-02 (#413) — THIS SENTENCE WAS TRUE OF ONE SURFACE, NOT
> SEVERAL, AND IT WAS READ AS PERMISSION.** The founder's own question is what
> found it, verbatim: *"why when scrolling through the admin pages only some
> pages contain the updated time the auto refresh toggle and a notification
> button? overview contains it but not all the other pages"*
>
> Measured at the code the day the card was worked: **four of the eight staff
> pages failed it.** Invite codes and Bug reports had no cluster at all; Users
> and Change requests provided `onRefresh` alone — a lone manual button, no
> stamp, no toggle — each under a docblock stating that the page *"keeps no
> `lastRefresh` … inventing the other two would be state no reader produces
> (brief 05 §4)"*, **citing this sentence.** ⚠ **That premise is false at the
> code**: `dataUpdatedAt` is produced by every TanStack query, and Overview has
> read its stamp from exactly that field since this brief shipped. Nothing
> needed inventing.
>
> **The rule going forward: a staff surface that holds a query provides the
> whole cluster. All three parts travel together or none of them do**, which
> `useStaffRefresh` now makes structural. The ONE real exception is `AdminCrew`,
> which states its own freshness inline — and #415 §3 folds even that in on his
> word. `section05-guard.test.ts` holds the rule, reading the object each page
> actually PASSES rather than the prop name, because a grep for the prop is the
> instrument that reported five of eight as correct when three were.

**The toggle replaces the `Live` / `Paused` buttons.** Those were two `Button`s with a hard-coded `bg-[#0A0A0A]`, and a filled black button is the app's primary-action treatment — spending it on a polling preference makes the loudest thing on a staff page a setting nobody changes.

### What the bar drops

**The `Studio` button.** It exists because staff is elsewhere. Once staff is inside the shell, the rail is how you get back and it is always there.

**The `Moderator` nav entry.** Admin and Moderation are peers reached from the account menu, not a tab inside one another. Two doorways, both in the STAFF group, already built.

**Every hex literal.** `#D5D5D5`, `#EBEBEB`, `#0A0A0A`, `#999`, `#bbb`, `#E5E5E5` all go. `token-guard` should be extended to cover this file.

---

## 5. The tab sets — derive them, do not copy mine

⚠️ **My prototype's tab lists are approximations. The repo's routes are the truth.** Two known divergences:

**Bug Reports is missing from my admin list.** It is live, it closed a real hole, and it must be the seventh admin tab. My list of six was written before it existed.

**Moderation has sub-tabs I did not draw.** `ActivitySubTab`, `CreditsSubTab`, `GenerationsSubTab`, `ReconciliationSubTab` sit under `TabNavigation` inside `ModeratorDashboard`. Keep that structure. Do not flatten it to fit my six, and do not drop a tab because my list lacks it.

So:

**Admin** — one tab per existing route, in this order: Overview · Requests · Crew · Users · Audit · Invites · Bug reports.

**Moderation** — the tab set `TabNavigation` already has, in the order it already has, with its sub-tabs intact one level down.

**Crew stays conditional.** `useCrewTabVisible` is right and its reasoning is right — the query succeeding *is* the flag, and no flag value reaches the client. Tab absent when the query is not `ok`. This is the one tab that may legitimately not be there.

**Labels are sentence case, not Title Case.** `Audit logs`, not `Audit Logs`; `Change requests`, not `Change Requests`. House voice throughout the product.

**Counts come from what already exists.** Where a tab has no reader for a number, no pill. Do not add a query in this PR — that is a content change.

---

## 6. Routing

Staff routes keep their paths — `/admin/*` and `/moderator` — and mount inside `AppShell`. Deep links, bookmarks and the browser back button must all behave exactly as they do now.

Tabs are **routes, not local state.** Clicking Users navigates to `/admin/users`. That is what the pages already are, it keeps refresh and back working, and it means this PR does not restructure any page's data loading.

**Auth guards stay as they are**, with one change: a non-admin currently gets `Redirect to="/app"` plus a `toast.error` fired during render. Firing a toast from a render body is a side effect in the wrong place and will double-fire under strict mode. Move it to the effect that performs the redirect, or drop it — a silent redirect to the lobby is fine, since someone who cannot see Admin does not need telling why.

---

## 7. What NOT to do

- **Do not restyle any page's content.** If the diff touches a table, card, chart or modal, it belongs in a later brief.
- **Do not flatten Moderation's sub-tabs**, and do not drop a tab because my prototype lacks it.
- **Do not convert tabs to local state.**
- **Do not keep the `Studio` button**, and do not add a breadcrumb in its place.
- **Do not add `Moderator` as an Admin tab.**
- **Do not give `AdminFoundation` a tab.**
- **Do not use `margin-left: auto`** anywhere in the bar. Spacer elements.
- **Do not add a fourth content width.**
- **Do not add `min-h-screen` or a page background.** The shell owns both.
- **Do not invent a count.** No reader, no pill.
- **Do not change `DEFAULT_THEME`.**

---

## 8. Definition of done

**The frame**
- [ ] `/admin/*` and `/moderator` render inside `AppShell` with the rail and topbar visible.
- [ ] No page sets `min-h-screen`, a page background, or its own `max-w-7xl` column.
- [ ] `working` (1240px) everywhere except Crew at 790px.
- [ ] The staff bar is `flex: none`; only the pane below it scrolls; the bar stays put with a long table under it.
- [ ] No `Studio` button; the rail is the way back.

**The bar**
- [ ] Eyebrow + title per role; no per-page titles.
- [ ] Tabs are a segmented control, sentence case, counts omitted at zero.
- [ ] Refresh cluster: stamp, divider, `AUTO 30s` toggle, manual refresh icon — **all three or none** (#413), and absent entirely on surfaces that hold no query.
- [ ] No `Live` / `Paused` buttons.
- [ ] Zero hex literals in the file; `token-guard` covers it.
- [ ] Bar wraps cleanly at 1024px with nothing behind a horizontal scroll.

**Behaviour unchanged**
- [ ] Every tab reaches the same page it does today; deep links and back work.
- [ ] Admin needs `role === 'admin'`; Moderation shows for admin and moderator.
- [ ] The Crew tab is absent when `crew.getState` is not `ok`.
- [ ] Bug reports is present as an admin tab.
- [ ] No toast fired from a render body.
- [ ] Both themes. Staff surfaces have never been dark-tested — expect to find hard-coded light values inside page content, and **log them for the later briefs rather than fixing them here.**

---

## 9. Then the promotion pass

Per `PROMOTION-PASS.md`.

One candidate is already known: `primitives.tsx` notes that *"the surface bar and the staff ops bar are one component with two consumers."* That is now true rather than anticipated — check `SurfaceBar` before writing a second bar, and if the staff bar needs something it lacks, fold it in rather than forking.

The segmented control is the other: `.dp-segmented` exists with real consumers, and `ChangePlanModal` already had to be pulled back from declaring a near-duplicate. Use the foundation's.
