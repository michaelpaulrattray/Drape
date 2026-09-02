# Brief 09 — what was DRIVEN, and what a source read could not have said

Law 6 for #399. The section guard (`client/src/features/moderator/section09-guard.test.ts`)
holds the rules a source read can hold; this file holds the readings only a
browser can make, and it exists because that guard cites it.

⚠ **It was cited before it was written** — #412's review found the pointer
dangling, which is exactly the failure the citation exists to prevent (a later
shift follows it to re-check a measurement and finds nothing). Recorded here on
the same day, from the driver's own output rather than from memory.

**Instrument:** `scripts/_399-drive-disposable.mts`, headless Edge, a minted
`verify-bot-admin` session, `/moderator` → *User investigation* → an account row
→ *Reconciliation*. **Both themes, 1440 and 1024, against the branch AND
against `main`.**

---

## 1 · The control is the point

| | branch (:3000) | `main` (:3100) |
|---|---|---|
| readings | **94** | 94 |
| pass | **94** | **36** |

Running the same instrument against `main` is what tells a working arm from a
vacuous one. What the control paints, in its own words:

- `TINTS: rgb(21, 93, 252) rgb(0, 153, 102) rgb(20, 71, 230) rgb(142, 197, 255) rgb(74, 85, 101) rgb(0, 122, 85)` — six, including blue and green
- `no computed weight above 500 — saw: 5, e.g. text-2xl font-bold … @ 700`
- `the list is the shared staff table — saw: 0 .dp-table__row · 5 <tr> · 1 horizontal scroller(s)`
- `the discrepancy is the largest figure — saw: figure -1px vs largest text on the surface 24px`

⚠ **The scope of every type and colour arm is `.dp-staff__col`, which BOTH trees
have.** Scoping to a class only the branch carries makes each absence arm find
zero elements on `main`, count zero violations and report PASS — a vacuous pass
on the control tree, which is worse than no control because it is quotable.
That defect was measured on this repo's own instruments one card earlier.

## 2 · The readings a source read cannot make

| what | measured |
|---|---|
| the discrepancy is the largest figure in the pane | `figure 30px vs largest text on the surface 30px` — at every width and theme |
| the figure is on the mono face | computed `JetBrains Mono` |
| the verdict sits above the evidence **on screen** | by bounding box, not source order |
| the workings end at *Recorded charges* | `last leader row: "Recorded charges (all records)"` |
| the evidence columns lay out by `auto-fit` | `2 card(s) across 1 row(s)` at **both** 1440 and 1024 |
| the investigation opens at the working width | **1144px** inside a 1240px column (1440); **852px** inside 948px (1024) |
| the pane never scrolls sideways | `scrollWidth == clientWidth` at both widths |
| nothing below the type floor | 0 below 10.5px, eyebrows at 8.5px+ |
| no tint painted anywhere | `16 distinct paints, all greyscale or red-family` |
| the theme is a **delta**, not a label | card surface `rgb(28, 28, 31)` dark vs `rgb(255, 255, 255)` light |

⚠ **The two evidence columns do NOT stack at 1024, and the arm says so.** The
investigation is 852px there, so two 292px-minimum tracks still sit side by
side — which is `auto-fit` working, not failing. An earlier shape of that arm
was captioned *"the evidence columns stack at 1024"* and passed on a condition
that could not fail: **a caption asserting something that never happens, with a
green tick on it.**

## 3 · ⚠ What the browser found that no arm could

### a. The account rows were INERT

`ExpandableRow` makes a row clickable only when it has an expansion
(`facts || evidence || actions || panel`). The first shape of this table put the
investigation in a panel *below* the table and gave the rows nothing, so
**clicking an account did nothing at all.** The surface drew perfectly, every
source arm passed, and it could not be opened.

Found on the first drive as `SUB-TAB NOT FOUND`. Fixed by using the pattern that
already existed for it: `DataRow`'s `subTabs` / `panel`.

### b. `Last active` had read `Never` for every account, always

The client read `u.lastLoginAt`; `moderator.listUsers` returns `lastSignedIn`
and nothing has ever returned `lastLoginAt`. Visible in the `main` control
frame, where every row of the column says `Never`.

### c. `Total spent −0`

A negative zero, printed in a ledger, in the one pane whose whole job is
arithmetic. **Twenty-nine source arms and ninety-four driven readings all passed
over it; an eye on the frame did not.** Zero now takes no sign, and the minus is
U+2212 rather than the hyphen `toLocaleString` returns.

## 4 · ⚠ Three of the instrument's own arms were wrong first, all toward a false reading

Recorded because an instrument's faults are worth more than its passes:

1. **`Discrepancy` counted case-sensitively** read **0** on a surface that draws
   it once — `innerText` applies `text-transform`, and the eyebrow written
   `Discrepancy` renders `DISCREPANCY`. An arm reporting a violation of the
   opposite rule.
2. **Then counted across the whole pane** it read **2**, because
   `FlaggedDiscrepanciesCard` sits on the same page under the head *Credit
   discrepancies* — a different surface answering a different question.
3. **The 10.5px floor arm flagged `.dp-chrome`**, the expansion's fact labels:
   mono, tracked, 10px, and already spelled `ACCOUNT` / `EMAIL` in the source.
   It is an eyebrow by every property except `text-transform`, which was the
   only one the reader looked at. **An eyebrow may be uppercase in the data
   rather than in CSS.**

## 5 · Frames

`output/399-frames/` — 18 PNGs (branch and `main`, dark and light, 1440 and
1024, captured by scrolling `.dp-staff__pane`) plus `branch-reading.txt` and
`main-reading.txt`, the full 94 readings each with what it SAW.

⚠ `fullPage` cannot photograph a staff page: the shell is `overflow: hidden`
with the scroll on the pane, so a full-page capture returns exactly one
viewport and a report claiming both themes were driven.

## 6 · What was NOT driven, stated rather than implied

- **The flagged-card link-through from an account that is off page 0.** #412's
  review found that path broken by this PR's own restructure; the fix (search
  the destination list by the account's email before selecting it) is covered
  by a source arm, and the driven database has one flagged account which is on
  page 0 — so the drive could not have caught it and did not.
- **The freeze and unfreeze mutations.** The dialog's arming was driven; the
  writes were not fired against a real account.
- **The CSV export.** Untouched by this PR and not exercised.
