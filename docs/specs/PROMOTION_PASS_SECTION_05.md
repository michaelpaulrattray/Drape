# Promotion pass — section 05, the staff shell (#395)

**Run per `docs/specs/Casting-ui-ux-design/drape-redesign/PROMOTION-PASS.md`, at
the end of the section, before it is called done.** Founder, 2026-09-01: *"we
have to ensure promotion passes run on ui improvements."*

Consumer counts are **files that import it today**, read with a grep, not
planned surfaces.

---

## 1 · What this section built

| what | kind | real consumers | verdict |
|---|---|---|---|
| `StaffSurface` | component | **9** — every staff page | **stays in `features/staff/`, and it is barred from the foundation** (see §3) |
| `StaffBarAdmin` | component | **7** — the seven admin pages | stays — staff vocabulary, and it reaches into `features/admin` for the Crew flag |
| `StaffBarModeration` | component | **1** — `ModeratorDashboard` | **stays, by rule 4.** One consumer has not earned a place |
| `StaffLoading` | component | **8** | stays — it is `.dp-staff`'s own empty state and means nothing outside the frame |
| `MODERATOR_TABS` / `ModeratorTab` | data + type | **2** (the page, the barrel) | stays in `features/moderator/` — *which* sections moderation has is a fact about moderation |
| `.dp-staff`, `.dp-staff__pane`, `.dp-staff__col` | CSS | 1 component | **already in `foundation.css`** — the stylesheet is shared and every other frame block lives there |
| `.dp-staffbar__*` (refresh cluster, toggle, stamp) | CSS | 1 component | same |
| `.dp-segmented__count`, `a.dp-segmented__seg` | CSS | **2** — `SurfaceBar`, `ChangePlanModal` inherits the block | **folded into the foundation's existing control** (§2) |

**Nothing hit two or more consumers AND was movable, so no file moved.** That
is a discharge of the pass, not a skip of it — and the reason is structural
rather than a judgement call, which §3 sets out.

## 2 · Collisions found, and which side won

**Rule 5 says grep the foundation BEFORE adding anything. Two collisions were
found that way, and both were resolved toward the incumbent.**

### a. The staff bar vs `SurfaceBar` — **`SurfaceBar` wins, and it predicted this**

The brief's §4 specifies a bar: one row, eyebrow + title, a divider, a
segmented control, a spacer, a meta cluster, wrapping, `padding: 13px 24px`,
`border-bottom: 1px solid var(--border)`. **`foundation/primitives.tsx` already
had all of it**, down to the same padding, and its docblock had already named
this card as its second consumer:

> *"Cinema's production bar and the staff ops bar are one component with two
> consumers."*

So no second bar was written. **Two capabilities were folded IN** (rule 6 —
fold in what the loser has, never leave both alive):

- **a count pill** on a segment, omitted at zero
- **an optional `href`**, so a segment can be a route rather than a setting —
  which is what keeps the admin tabs deep-linkable

Both live in the foundation, so `ChangePlanModal` and the specimen sheet get
them without asking.

### b. `AdminHeader` vs `ModeratorHeader` — **neither wins; both are deleted**

⚠ **The brief names only `AdminHeader`, because it was drawn on a canvas with
no codebase in view.** `ModeratorHeader` was the same component written a
second time: its own sticky header, its own `Studio` button, its own
`max-w-7xl`, its own `Live` / `Paused` pair, six hex literals between them.
Renaming the first alone would have left the moderator page wearing two
headers and nothing would have said so.

This is the pass's own evidence list repeating itself — *"every one is a
component built twice because nobody counted"* — and it is the reason the
guard's population is **derived from the pages folder** rather than typed out.
A hand-written list would have had the same blind spot the mockup did.

## 3 · Why `StaffSurface` stays out of `foundation/`, at 9 consumers

**It is the one entry that would otherwise be promoted on the numbers alone,
and it cannot be.** `StaffSurface` mounts `AppChrome`, which is made of
`features/lobby`, `features/billing`, `features/settings` and tRPC —
and **`foundation/` is forbidden from importing `features/`**, guarded by
`foundation/promotion-guard.test.ts`. The reason is in `AppChrome`'s own
docblock: *"a shared kit that reaches back into a feature is a feature
subfolder with a different address."*

So the shape here is the same one `AppChrome` itself took: the pure layout
primitive is in the foundation (`AppShell`, `SurfaceBar`), and the composition
that knows about features sits outside it. **The visual half already got
promoted — it just got promoted in a previous section**, which is the system
working rather than a gap.

## 4 · Naming accidents fixed on the way in

| was | is | why |
|---|---|---|
| `AdminHeader` | *(deleted)* — `StaffBarAdmin` / `StaffBarModeration` | it described a page header that no longer exists, and it served moderation too |
| `features/admin/AdminHeader.tsx` | `features/staff/StaffBar.tsx` | a component serving **both** staff roles does not live in one of their folders. The brief said "rename it"; leaving it in `features/admin` would have been the second name this brief exists to stop |
| `TabNavigation` | `MODERATOR_TABS` (data) | *"tab navigation"* names a widget; the surviving thing is the LIST, and the drawing moved to the bar |

## 5 · The specimen sheet

`/admin/foundation` is how the founder judges this pass (*"one place he can
open and see every shared part at once"*). The `SurfaceBar` specimen there now
carries a **count pill** on one of its segments, because a capability the
foundation gained that the specimen does not show is a capability he cannot
see. One prop; no behaviour change.

⚠ **The specimen page is deliberately NOT inside `StaffSurface`** — it is a
component sheet, not a staff surface, and the founder ruled it gets no tab.
Wrapping it in the frame would draw a staff bar whose tabs do not contain the
page you are looking at. That exclusion is pinned by an arm.

## 6 · Logged, not fixed — for briefs 06–09

The brief's own instruction: *"expect to find hard-coded light values inside
page content, and **log them for the later briefs rather than fixing them
here**."* Counted at the source, comments stripped:

| page | colour literals in page content |
|---|---|
| `AdminBugReports.tsx` | 35 |
| `AdminInviteCodes.tsx` | 33 |
| `AdminChangeRequests.tsx` | 18 |
| `AdminUserManagement.tsx` | 16 |
| `AdminAuditLogs.tsx` | 13 |
| `AdminCrew.tsx` | 12 |
| `AdminOverview.tsx` | 5 |
| `ModeratorDashboard.tsx` | 2 |
| `AdminFoundation.tsx` | **0** — it is on `token-guard`'s enrolled list |
| **total across the nine** | **134** |

Counted at the source with comments stripped, over
`(bg|text|border|ring|from|to|via|fill|stroke)-[#…]`. The zero on the specimen
sheet is the control: it proves the counter is reading the right thing and that
an enrolled file really does come out clean.

**Staff has never been dark-tested, and the frames show why that matters**: the
frame follows the theme and the content does not, so a staff page in dark mode
is a dark shell around white cards. That is the honest state after this card
and it is what briefs 06–09 are for — the frame had to land first, because
restyling content inside a page that still owned its own background would have
had to be done twice.
