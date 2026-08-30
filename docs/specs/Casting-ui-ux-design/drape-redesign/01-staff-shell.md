# 01 — Staff shell adoption

**Prerequisite: section 00.** Staff-only, so nothing customer-facing can break.

## What this section is

Put the seven staff pages on the foundation shell and the token system. Structure and content stay exactly as they are — same tabs, same tables, same modals, same queries. This is the change that deletes `bg-[#EBEBEB]` and makes the staff pages theme.

The redesign proper is section 02. Keeping them apart means that if something looks wrong afterwards, you know whether it was the shell or the design.

**Note: staff surfaces are absent from the existing handoff.** `../design_handoff_studio/` covers the lobby and its seven tabs; Admin, Moderation and Crew are not in it. So briefs 01–03 are the only spec for these surfaces, and the live prototype (account menu → Admin / Moderation) is the reference.

**Excluded:** any layout change, any new component, any copy change, any query change. If a diff in this section changes what a page *says* or *does*, it is out of scope.

## Why staff first

1. Nobody outside the company sees these pages, so the new patterns get proven where a mistake is cheap.
2. They are the only surfaces with **no** shell at all — `AdminHeader` and `ModeratorHeader` are bespoke bars over a hardcoded grey. Every other surface already has the rail.
3. `AdminOverview`, `AdminCrew` and `ModeratorDashboard` all hardcode the same auth-guard spinner on `bg-[#EBEBEB]`. Fixing it once in the shell removes seven copies.

## Files

**Read first**
- `client/src/pages/AppLobby.tsx` — the reference adoption. Note `width="bare"`, and note the comment explaining that it wraps the views without restyling them. Do the same thing here.
- `client/src/foundation/AppShell.tsx` — `breadcrumb`, `current`, `account`, `topbarRight`, `width`.
- `client/src/foundation/Rail.tsx` — `RAIL_DESTINATIONS`. **There is no staff destination and there must not be one.**

**Change**
- `client/src/pages/AdminOverview.tsx`
- `client/src/pages/AdminUserManagement.tsx`
- `client/src/pages/AdminAuditLogs.tsx`
- `client/src/pages/AdminChangeRequests.tsx`
- `client/src/pages/AdminCrew.tsx`
- `client/src/pages/AdminInviteCodes.tsx`
- `client/src/pages/ModeratorDashboard.tsx`
- `client/src/features/admin/AdminHeader.tsx` → becomes a thin wrapper over `SurfaceBar`, or is deleted
- `client/src/features/moderator/ModeratorHeader.tsx` → same
- `client/src/components/UserCard.tsx` — add the staff group (§3)

**Leave alone**
- Every tab component, table, filter and modal under `features/admin/` and `features/moderator/`. Their internals are section 02.
- Every tRPC query and mutation.
- `Rail.tsx`.

## 1. The shell wrap

Each staff page becomes:

```tsx
<AppShell
  breadcrumb="Admin / Overview"
  current={undefined}          /* no rail item is current — see §2 */
  width="working"              /* 1240px; these are data surfaces */
  account={accountProps}
  topbarRight={<CreditsChip … />}
>
  {/* the page's existing main content, unchanged */}
</AppShell>
```

Then, inside, replace the bespoke header:

```tsx
<SurfaceBar
  eyebrow="ADMIN"
  title="Overview"
  meta={<>updated {formatDate(lastRefresh)}</>}
  right={<>{autoRefreshToggle}{refreshButton}</>}
/>
```

**Breadcrumbs:** `Admin / Overview`, `Admin / Requests`, `Admin / Crew`, `Admin / Users`, `Admin / Audit`, `Admin / Invites`, `Moderation`. The `Admin /` prefix earns its place because there are six sibling pages; Moderation is one page and takes no prefix.

**Widths:** `working` (1240px) for all six admin pages and Moderation. **Except `AdminCrew`, which takes `bare` and centres its own 790px column** — it is a briefing, and its own file says so: *"single column, restrained, no charts and no KPI tiles."* Do not put it on 1240.

## 2. `current` stays undefined

No rail item highlights on a staff page. The rail is the product's seven destinations and staff surfaces are not among them — highlighting Home while on Audit Logs is a lie, and adding an eighth rail item breaks the rail's own stated rule that it never changes shape.

The account menu is the entry point (§3). That is deliberate: staff access should be discoverable by the people who have it and invisible to everyone else.

## 3. Account-menu access — mostly already built

**`UserCard.tsx` already does this.** It has `Settings`, `Billing`, `Share Drape`, a role-gated group with `Admin` → `/admin/overview` and `Moderator` → `/moderator`, then `Log out`. The gating already mirrors the server: `isAdmin = role === 'admin'`, `isModerator = isAdmin || role === 'moderator'`. It is on tokens, with hairline dividers.

**Do not rebuild it.** Two small additions only:

1. **Count badges.** `Admin` shows pending change requests + unanswered Crew cards; `Moderator` shows audit entries above `info` in the last 24h. Pill on the right of the row: `--fillStrong` background, `500 9px JetBrains Mono`, `--metaStrong`. Omit at zero rather than rendering `(0)`. This is the only reason the group beats a bookmark — it turns the menu into a reason to look.
2. **A mono group label.** The group is currently two bare dividers with no heading. Add `STAFF` — `500 8.5px JetBrains Mono`, `.13em`, `--faint`, with a `1px --rule` line beside it — matching the eyebrow grammar used everywhere else.

Optionally rename `Moderator` → `Moderation` so both labels name a place rather than one naming a place and the other a person. Cosmetic; skip if it costs a test.

## 4. The auth guard moves to the shell

Seven copies of this exist:

```tsx
if (authLoading) return <div className="min-h-screen bg-[#EBEBEB] …"><div className="animate-spin …"/></div>;
if (!isAuthenticated) return <Redirect to="/login" />;
if (user?.role !== "admin") { toast.error("Access denied…"); return <Redirect to="/studio" />; }
```

Replace with one component:

```tsx
<StaffGuard require="admin">…</StaffGuard>   // or require="moderator"
```

- Loading renders `<Skeleton>` on `--surface`, not a bespoke spinner on grey.
- The redirect target changes from `/studio` to `/app`. `/studio` is the legacy surface with the old glass navigation (retired in section 11); sending a denied user there is sending them somewhere we are trying to remove.
- Keep the `toast.error("Access denied. …")` — it is correct and users rely on knowing why they bounced.

**The server boundary is unchanged.** `crew.getState` is `adminProcedure` behind `CREW_TAB_SCOPE`; the client guard is a courtesy for the person, not the boundary. Do not weaken either.

## 5. Colour sweep

Within the seven pages only (their tab components are section 02):

| Now | Becomes |
|---|---|
| `bg-[#EBEBEB]` | delete — the shell supplies `--surface` |
| `text-[#0A0A0A]` | delete — the shell supplies `--ink` |
| `bg-white` | `--surface` |
| `border-[#E5E5E5]` | `--borderCard` |
| `text-[#666]` | `--metaStrong` |
| `text-[#999]`, `text-[#bbb]`, `text-[#BBB]` | `--faint` |
| `bg-red-50 border-red-200 text-red-700` (error panel) | `--surface` + `1px --error` + `--errorInk` |
| `animate-pulse` skeletons | `<Skeleton>` |
| `max-w-7xl mx-auto px-4 sm:px-6 py-6` | the shell's content column |

`AdminOverview`'s "Data as of …" footer keeps its copy and moves to `400 10.5px JetBrains Mono` `--faint`, centred.

## What NOT to do

- **Do not redesign anything.** Same tabs in the same order, same tables, same modals, same words. Section 02 is the redesign; conflating them makes both unreviewable.
- **Do not add a rail destination for staff.**
- **Do not put Crew on the 1240 column.**
- **Do not change any tRPC call, refetch interval, or query key.** Auto-refresh stays 30s on admin overview and moderator, 60s on stats.
- **Do not delete `AdminHeader`/`ModeratorHeader` before their consumers are migrated** — reduce them to `SurfaceBar` wrappers first, delete once nothing imports them.
- **Do not "fix" the seven-colour severity constants here.** They are section 02, and they are used by tab components this section does not touch.

## Definition of done

- [ ] All seven pages render inside `AppShell` with the rail and topbar.
- [ ] `grep -r "EBEBEB\|#0A0A0A" client/src/pages/Admin* client/src/pages/ModeratorDashboard.tsx` returns nothing.
- [ ] Both themes render every staff page with no hardcoded light surface.
- [ ] `StaffGuard` replaces all seven inline guard blocks; denied users land on `/app`.
- [ ] The account menu shows the STAFF group for admin and moderator, with live counts, and nothing for a normal user.
- [ ] `current` is undefined on every staff page — no rail item highlights.
- [ ] Crew is a centred 790px column; the other six are 1240px.
- [ ] Every existing tab, filter, table and modal still works and still says what it said before.
- [ ] `token-guard.test.ts` and the existing page tests pass.
