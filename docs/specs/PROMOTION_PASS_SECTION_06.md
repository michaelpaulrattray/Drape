# Promotion pass — section 06, the staff tables

**Run per `PROMOTION-PASS.md`, on brief 06's own instruction that *"this one
matters more than usual: `DataTable` and `ExpandableRow` were built without
consumers and are about to get eleven."***

Filed with PR for card #396. Nothing here is a behaviour change.

---

## 1 · What the section built, and its real consumer count

Counted by import, in the codebase, today — not planned surfaces. The barrels
(`foundation/index.ts`, `features/staff/index.ts`), the components' own files
and the two guards are excluded from every count.

| Part | Consumers | Verdict |
|---|---|---|
| `DataTable` | **14** | already in `foundation/` — this section is its first consumer, and its eleventh |
| `StatePill` | **13** | stays in `features/staff/` — see §3 |
| `RowId` | **12** | stays in `features/staff/` |
| `pageRange` | **11** | stays in `features/staff/` |
| `TableHead` | **8** | **in `foundation/`** |
| `TableFilter` | **7** | **in `foundation/`** |
| `RowStack` | **5** | stays in `features/staff/` |
| `TableSearch` | **3** | **in `foundation/`** |
| `RawPayload` | **3** | stays in `features/staff/` |
| `SUSPEND_CONSEQUENCE` | **2** | stays in `features/staff/` — see §4 |
| `TableSort` | **1** | **in `foundation/` anyway** — see §2 |
| `MiniList` | **1** | **in `foundation/` anyway** — see §2 |
| `ExpandableRow` | 1 | already in `foundation/`; it is `DataTable`'s own part |
| `RolePill` | 1 | stays in `features/staff/` |

## 2 · ⚠ Two parts at ONE consumer sit in the foundation, and that is a departure

⚠ **A note on the word "promoted".** The pass's method assumes a part is built
in a feature and moved afterwards. These were authored in `foundation/` from
the start, because `DataTable` was already there and its head could not
sensibly live anywhere else. **The counts above are therefore the pass's
question asked in retrospect — "would this have earned its place?" — and every
row answers yes except the two below.**

The rule is *"anything at one stays where it is"*, and `TableSort` (Admin →
Users) and `MiniList` (the credits/activity sub-panel) each have exactly one.
They stay in `foundation/` regardless, for one reason stated rather than
assumed: **they are parts of a component that is already there.** `TableSort`
is the third control of a filter cluster whose other two are promoted, and
`MiniList` is what `DataTable`'s own expansion draws inside a sub-tab. Leaving
them in `features/staff` would mean `foundation/` shipping a table whose
sub-panel and third filter live in a feature folder — which is the collision
the pass exists to prevent, arriving from the other direction.

**If a later section finds no second use for either, they are the first
candidates for removal** at the end-of-lane sweep the founder already ordered
(*"whatever nothing uses by the end gets removed then"*).

## 3 · Why the six busiest parts did NOT move

`StatePill`, `RowId`, `RowStack`, `pageRange`, `RawPayload` and `RolePill` have
between 1 and 13 consumers each and stay in `client/src/features/staff/`.

**They are not general.** `StatePill` encodes a rule about STAFF work — *"status
is a state and may carry accent; role is a category and may not"* — which is a
judgement about who is reading and what they are scanning for. A customer
surface showing a render's status wants a different rule, and a foundation part
that two callers must configure differently is `AppShell`'s width prop all over
again.

This is the same shape `StaffSurface` took one section ago and for the same
stated reason: **the pure primitive lives in the foundation, the domain-aware
composition sits outside it.** `DataTable` draws rows; `StatePill` decides what
a row's colours MEAN.

## 4 · ⚠ One collision found, and the loser is deleted rather than left alive

**`TableHead` already existed** — `client/src/components/ui/table.tsx`, shadcn's
`<th>` wrapper, present since the initial bootstrap.

Rule 6 settles it at the consumer count and nothing else: **the new one has 8,
the incumbent has 0.** Nothing in the product has ever imported
`@/components/ui/table` — measured with a repository-wide grep, and after this
section no staff surface contains a `<table>` element at all, so nothing ever
will.

Rule 6's second half is *"never leave both alive as options"*, so
`components/ui/table.tsx` is **deleted** in this PR. It is a dead bootstrap
leftover that happens to own a name the shared kit now needs; leaving it would
mean `import { TableHead }` resolving to two different things depending on the
path a future author typed.

**A second, softer collision was resolved without moving anything**: brief 06
§3 specifies a segmented filter, and `.dp-segmented` — the `SurfaceBar`'s
control, with nine consumers — already implements it almost line for line.
`TableFilter` renders THAT class rather than a second segmented control. Its
geometry differs from the brief by 1px of gap and 1–2px of padding; forking a
nine-consumer control over that would be the third popover again.

## 5 · The colour literals still in staff, counted rather than forgotten

Brief 06 §8's bar is *"zero hex literals across all eleven surfaces"*, and the
twelve surfaces and their heads read **zero**. `token-guard` is extended over
each of them by name, and the enrolment was proven able to fail: a planted
`#BADA55` in `GenerationsSubTab.tsx` reddens exactly one arm.

**What is NOT enrolled, and whose brief owns it. ⚠ These numbers were
MEASURED, and the first draft of this table estimated them and was wrong on
every row** — the largest by a factor of four:

| File | Literals | Owner |
|---|---|---|
| `features/moderator/ChangeRequestModal.tsx` | 89 | none yet — a form modal |
| `features/moderator/ReconciliationSubTab.tsx` | 69 | brief 09 |
| `features/moderator/UserInvestigationWidgets.tsx` | 58 | brief 09 |
| `features/admin/UserActionModals.tsx` | 45 | none yet — form modals |
| `features/moderator/CreditsSubTab.tsx` | 33 | brief 09 |
| `features/admin/AuditActionModals.tsx` | 29 | none yet — form modals |
| `features/moderator/FlaggedDiscrepanciesCard.tsx` | 27 | brief 09 |
| `pages/AdminUserManagement.tsx` (its two inline dialogs) | 18 | none yet — form modals |
| `features/moderator/UserInvestigationTab.tsx` | 12 | brief 09 |
| `features/admin/ReviewModal.tsx` | 11 | none yet — a form modal |
| `features/moderator/StatsCards.tsx` | 4 | brief 07's shape, on the moderator page |
| `features/admin/UserBadges.tsx` | 1 | see below |

**442 in total across every staff file this section did not rebuild.** Roughly
half belong to brief 09's three investigative tools; the rest are the form
modals.

**The five FORM modals are the honest gap.** Brief 06 kills the four DETAIL
surfaces and says nothing about dialogs that take a typed reason before firing;
those are still light-only, and a staff page in dark mode opens a white
dialog. It is visible, it is not a regression this section caused, and
restyling five shadcn dialogs inside a table brief would be the scope creep
the promotion pass is meant to prevent. **Filed rather than fixed.**

**One dead export surfaced and is left standing deliberately**: `UserBadges`'s
`StatusBadge` is now imported by nothing (`RoleBadge` still has a consumer —
`UserActionModals` draws it in the role-change dialog, which is why the check
was worth running rather than assuming both died together). `getUserStatus` and
`formatDate` beside them are still used, so the file lives. Deleting exports is
the Janitor's clock and the Atlas is its authority.

## 6 · What the first consumer taught `DataTable`, per §9

*"Report what their real shapes turned out to be, and change them rather than
working around them."* Six changes, all made in the component rather than at
eleven call sites:

1. **Loading is a state it owns.** It had none, so every surface would have
   drawn its own spinner. It draws skeleton ROWS at row height.
2. **Empty is `EmptyState`, not a string.** It took an `emptyLabel` string;
   §6 wants a title AND a next step, so it takes `{ title, body }`.
3. **Expansion can be CONTROLLED.** It owned `openId` internally — which cannot
   work on the three surfaces where opening a row is what enables that row's
   detail query. Uncontrolled still works and is what six surfaces use.
4. **`actions` became a typed union, not a `ReactNode`.** This is the change
   that matters: `destructive: true` cannot be written without `consequence`,
   so §5's rule is enforced by the compiler rather than remembered by a
   reviewer.
5. **Columns align.** `align: "center" | "end"` — a `Uses` column reading
   `3/10` belongs centred, and it was the only surface that wanted it.
6. **Sub-tabs inside the panel**, because `UserDetailModal` had three tabs and
   folding them into the facts grid would have made one row 40 facts long.

**And one thing it did NOT need**: a `dense` mode, a `striped` mode, or a
`sortable` column header. Eleven surfaces, none of them asked.

## 7 · What is on the specimen page now

`/admin/foundation` §07 draws the table with a destructive action carrying its
consequence, and a new §07b draws the head: the real search, a three-option
segmented filter, a six-option select and the sort pair — so the ≤4/>4 rule can
be seen rather than read. That page is how this pass is judged (#366).
