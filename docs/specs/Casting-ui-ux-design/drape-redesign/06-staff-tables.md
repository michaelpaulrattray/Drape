# Staff tables — one pattern, eleven surfaces

**One PR. Prerequisite: the staff shell.**

Live reference: `design_handoff_studio/Klieg Studio.dc.html` — account menu → Admin → Users, Audit, Invites; → Moderation → Flagged, Referrals, Blocked IPs. Open it and expand a row.

---

## 1. What this is

Eleven staff surfaces are the same thing wearing eleven different implementations: a filtered list of records, and a way to look at one closely and act on it.

| | Surfaces |
|---|---|
| **Admin** | Users · Audit logs · Change requests · Bug reports · Invite codes |
| **Moderation** | Audit logs · Blocked IPs · Flagged referrals · My requests · Activity · Generations |

This brief describes the pattern once. It is the **first real consumer of `DataTable` and `ExpandableRow`** from section 00 — which have had no consumer since the day they were built, and whose shapes were guessed. Expect to change them; that is the point of a first consumer, and changing them now is far cheaper than after the fourth.

**Excluded:** Admin Overview (dashboard cards, own brief), Crew (own brief), and the moderator's three investigative tools — Reconciliation, Credits, User Investigation. Those last are 55KB of genuinely different UI and are the fifth brief.

---

## 2. The one change that matters: the row opens in place

Today every table has an **Actions** column of identical buttons, each opening a detail modal. Four such modals exist — `UserDetailModal` (15.7KB), `ChangeRequestDetail` (15.9KB), `AuditLogDetailModal` (7.7KB), `LogDetailModal` (5.3KB).

In the design, **the row expands.** No modal, no Actions column.

Three reasons, in order of weight:

**You keep your place.** A moderator working a 300-row list opens a record, acts, closes, and needs the next row. A modal loses the surrounding rows, and on close you are re-finding your position. An expanded row keeps everything above and below it on screen.

**The Actions column carries no information.** Twelve rows, twelve identical `Manage` buttons — a column whose every cell is the same. Same rule that took the shared perk off the plan cards: if it does not differ, it is not a column.

**Four modals become one row treatment.** That is the same consolidation as the settings work, for the same reason.

So: whole row is the click target, `cursor: pointer`, expands below itself. One row open at a time.

---

## 3. The section head

Above the table, `gap: 11px`, wrapping:

- Mono eyebrow, `500 9.5px JetBrains Mono`, `.13em`, `--metaStrong` — `USERS`, `AUDIT`, `INVITE CODES`
- `flex: 1; min-width: 20px` hairline in `--rule`
- The filter cluster, `flex: none`

### Search — real here, not a stub

⚠️ **The prototype draws search as a grey chip because the prototype has no data.** Admin search works today — `onSearch`, Enter-to-submit, server-side. **Keep it working.** Do not copy the topbar's stub treatment into a surface where the feature exists.

Same geometry, a real input:

```css
display: flex; align-items: center; gap: 9px;
padding: 6px 10px;
border: 1px solid var(--borderInput);
border-radius: var(--r-sm);
background: var(--surface);
min-width: 180px;
```
12px magnifier at `--meta`, then the input — borderless, transparent, `400 11.5px Archivo`, `--ink`.

**Drop the separate `Search` button.** It is a filled `bg-[#0A0A0A]` — the app's primary-action treatment — spent on submitting a search box. Enter submits; debounce 300ms so typing filters as you go.

### Filters — segmented, up to four options

```css
display: flex; gap: 1px; padding: 2px;
background: var(--fillStrong);
border-radius: var(--r-sm);
```
Options `padding: 4px 9px; border-radius: 6px; white-space: nowrap`. Selected: `--surface` + 1px shadow + `500`. Unselected: `400` `--secondary`.

**Four options or fewer: segmented. More: the foundation's select.** A segmented control's value is showing every state at once; past four it is a cramped row of unreadable stubs. So Role (4) and most status filters become segmented; a 5+ option filter stays a select.

**Sort stays a select**, because it pairs with a direction toggle and the pair reads as one control. Replace the `↑` / `↓` text button with a proper chevron icon button.

---

## 4. The table

```css
border: 1px solid var(--borderCard);
border-radius: var(--r-xl);          /* 12px */
background: var(--surface);
overflow: hidden;
```

**Not a `<table>`, and no `overflow-x-auto`.** Flex rows with `min-width: 0` and ellipsis, so the table always fits its column and never slides sideways. A staff table that scrolls horizontally hides columns behind an edge — the reader cannot tell there is more, and on a trackpad they discover it by accident. `primitives.tsx` already notes this: *"columns are flex strings rather than a grid."*

**Column header row**
```css
display: flex; align-items: center; gap: 12px;
padding: 9px 15px;
border-bottom: 1px solid var(--rule);
background: var(--well);
```
Each header: `flex: <basis>; min-width: 0; text-align: <align>`, `500 8.5px JetBrains Mono`, `.1em`, `--faint`, nowrap.

**Sizing rule: exactly one flexible column.** The identifying column — name, code, subject — takes `1 1 0`. Every other column takes a fixed basis (`0 0 92px` for a state pill, `0 0 148px` for a date, `0 0 210px` for a mono id). One flexible column is what makes eleven tables look like one table.

**Rows**
```css
display: flex; flex-direction: column;
border-bottom: 1px solid var(--ruleSoft);
cursor: pointer;
/* hover */ background: var(--well);
```
Row body: `display: flex; align-items: center; gap: 12px; padding: 11px 15px`.

**Three cell kinds, and only three:**

| Kind | Spec |
|---|---|
| **Text** | `font` and `color` per column, `min-width: 0`, nowrap, ellipsis |
| **Pill** | `padding: 2px 8px; border-radius: var(--r-pill); border: 1px solid <line>; background: <bg>; font: 500 8.5px JetBrains Mono; letter-spacing: .06em`, nowrap |
| **Dot** | `6px` circle, optional ring — for live/urgent state |

Cells are `flex: <basis>; min-width: 0; display: flex; align-items: center; gap: 7px; justify-content: <justify>`.

### Columns: keep what exists

**Derive each table's columns from the table it replaces.** Do not invent a set from my prototype — it has five tables where you have eleven, and its column choices were guessed. The rule is: keep every column the existing table has, **drop the Actions column**, and give each remaining one a basis per the sizing rule.

Where a column is genuinely two facts stacked (Users' name-over-email), keep the stack — `gap: 1px` column, name `500 12px` `--ink`, email `400 11px` `--metaStrong` — and give it the flexible basis.

### Status and role pills

**Status is a state, so it may carry accent. Role is a category, so it may not.**

- `active` and other resting states: greyscale — `--fill` background, `--borderSoft` line, `--metaStrong` text.
- `suspended`, `frozen`, `locked`: `--accentWash` / `--accentLine` / `--accentInk`. These are what a moderator is scanning for.
- Every role pill — user, moderator, admin — greyscale. A role is what someone *is*, not something needing attention. `RoleBadge`'s current tints go.

⚠ **SUPERSEDED FOR ONE VALUE — `admin` CARRIES ACCENT** (founder ruling, #422, 2026-09-02). The line above is kept as the origin because it is still the rule for every other role; what changed is one carve-out and its reason: **who has the keys is worth spotting fast.** That is a security-legibility argument, not an attention one, which is why it does not reopen this section for anything else — `user` and `moderator` stay greyscale, every resting STATE stays greyscale, and the zero rule below is untouched. ⚠ `admin` is the first thing in the product to wear the accent that is **not a state someone must act on**, and it wears the same accent as `suspended`/`frozen`/`locked` one line away, because `StatusPill` has no greyscale-with-emphasis tone. The rule lives in `RolePill` (`client/src/features/staff/staffTable.tsx`) and is pinned by `section06-guard.test.ts` as *exactly `admin`, and no other role*.

Ids stay mono at `--faint`: `#4417`, not `#CCC` grey sans.

---

## 5. The expanded row

```css
display: flex; flex-direction: column; gap: 14px;
padding: 2px 15px 16px;
animation: dp-rise .2s ease-out both;
```
Opens with a full-width `--rule` hairline, then, in order:

**1. Facts grid** — `repeat(auto-fit, minmax(168px, 1fr))`, `gap: 12px`. Each fact is a `gap: 3px` column: key in `500 8.5px` mono `.1em` `--faint`; value in `400 12px` mono `--secondary` with **`word-break: break-all`**, because these are ids, hashes, IPs and emails, and an unbroken 64-character value otherwise blows the grid open.

**2. Sub-tabs** *(only where the record has them)* — a segmented control at `padding: 5px 11px`, then a bordered list: `when` in mono `--faint` at a fixed 52px, `what` flexible, `amount` in mono, right-aligned and coloured only if it is a state.

**3. Evidence block** *(only where there is prose)* — `padding: 12px 13px; border-radius: var(--r-md); background: var(--well)`, `400 11.5px/1.65 Archivo`, `--metaStrong`, `text-wrap: pretty`. This is where a bug report's body, a change request's reasoning, or an audit entry's raw payload goes.

**4. Actions row** — `gap: 9px`, wrapping. Buttons `padding: 8px 13px; border-radius: var(--r-sm)`, `500 11.5px`. Then a `flex: 1; min-width: 170px` note in `400 11px` `--faint` explaining a consequence: *"Retiring a code never affects anyone who already used it."*

**Every destructive action needs that note, and it must be specific.** The whole value of expand-in-place over a modal is that the consequence sits beside the button rather than in a dialog nobody reads.

**Actions keep the promoted confirm dialog** for anything irreversible — suspending a user, blocking an IP, rejecting a request. Do not build a second confirm.

---

## 6. Footer, loading, empty

**Footer** — `padding: 10px 15px; background: var(--well)`. Left: the count in `400 10.5px` mono `--faint` — `Showing 1–25 of 312`. Right: `Back` / `Next`, `padding: 5px 10px; border-radius: 7px`, disabled state is `--muted` + `cursor: not-allowed`.

**Loading** — `Skeleton` rows at the real row height, not a centred spinner. A spinner in a `colSpan={6}` cell collapses the table to one row and the layout jumps when data lands.

**Empty** — the `EmptyState` primitive. One line of what is missing, one of what to do: *"No users match those filters."* / *"Clear the filters or search a different term."* No 40px icon.

---

## 7. What NOT to do

- **Do not keep the detail modals.** If `UserDetailModal` still exists at the end, this failed.
- **Do not keep an Actions column.**
- **Do not stub the search.** It works today.
- **Do not use `overflow-x-auto`** or a `<table>` element.
- **Do not give two columns a flexible basis.**
- **Do not colour role pills.**
- **Do not open more than one row at a time.**
- **Do not build a second confirm dialog.**
- **Do not invent columns from my prototype.** Keep what each table has.
- **Do not add a query or change a mutation.** Same data, same actions.
- **Do not fix Overview, Crew or the investigative tabs here.**
- **Do not `margin-left: auto`** in any wrapping row. Spacers.

---

## 8. Definition of done

**Pattern**
- [ ] One shared table component serves all eleven surfaces; no surface hand-rolls rows.
- [ ] Rows expand in place; all four detail modals deleted.
- [ ] No Actions column anywhere.
- [ ] Exactly one flexible column per table; no horizontal scroll at 1024px, 1440px, 1920px.
- [ ] Three cell kinds only.
- [ ] Facts values carry `word-break: break-all`.
- [ ] Every destructive action has a specific consequence note beside it.
- [ ] Irreversible actions route through the promoted confirm dialog.

**Filters**
- [ ] Search is a working debounced input; no separate Search button.
- [ ] ≤4 options segmented, more as a select; sort is a select plus a chevron direction toggle.

**States**
- [ ] Skeleton rows while loading, at row height.
- [ ] `EmptyState` when empty, with a next step.
- [ ] Footer shows the range and total; Back disabled on the first page.

**Behaviour and tokens**
- [ ] Every existing filter, sort, page and action behaves exactly as before.
- [ ] Status pills accent only for attention states; roles greyscale **except `admin`, which carries accent by his #422 ruling** (see §4).
- [ ] Zero hex literals across all eleven surfaces; `token-guard` extended to cover them.
- [ ] Both themes — these surfaces have never been dark-tested.

---

## 9. Then the promotion pass

Per `PROMOTION-PASS.md`, and this one matters more than usual: `DataTable` and `ExpandableRow` were built without consumers and are about to get eleven.

Report what their real shapes turned out to be, and **change them rather than working around them.** A component that eleven surfaces each adapt to is worse than no component.

Likely new candidates: the state pill, the filter segment, the facts grid, and the footer pager.
