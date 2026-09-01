# Brief 06 — what was DRIVEN in the running app (card #396)

Founder law 6: no visual change ships without being looked at in the running
app. This is that reading, and the frames it produced.

Driver: `scripts/_396-drive-disposable.mts` (disposable, deleted at shift
close — its readings and frames are the artefact and they are kept).
Frames: `output/396-frames/`. Raw readings: `branch-reading.txt`,
`main-reading.txt`.

---

## 1 · The numbers, and why the second column is what makes the first mean anything

Six surfaces × two widths × two themes, plus one delta reading.

| | branch (`:3000`) | `main` (`:3100`) |
|---|---|---|
| readings taken | **245** | 25 |
| pass | **245** | **0** |
| fail | **0** | 25 |

**`main` scores zero because the shared table does not exist there** — every
one of the 24 surface visits reports *"the shared table is on screen · saw: NOT
FOUND"* and the driver stops measuring that surface, which is why `main` yields
25 readings rather than 245. That is the honest shape of a before/after here:
there is no partial credit to award, because before this card there was no
pattern to measure against.

**A driver pointed only at the fixed tree cannot tell a working arm from a
vacuous one.** Section 05's guard shipped five arms that passed over zero
elements one card ago; running the same instrument against `main` is the cheap
control that catches it.

## 2 · What each surface reported, per visit

Every reading names what it SAW (D-235). Per surface, per width, per theme:

- **the shared table is on screen** — `.dp-table__head` found
- **the table fits its column** — `scrollWidth` vs `clientWidth`, equal on all
  24 visits (1174 at 1440, 882 at 1024); §4's *"never slides sideways"*
- **exactly one column gives way** — the flexible count read off computed
  `flex-grow`, with the column names quoted
- **no Actions column** — read at the header text
- **no legacy `<table>`, no `overflow-x: auto`** — 0 and 0 on every page
- **the section head names the surface**
- **rows, or an empty state that says what to do** — with the row count or the
  empty text quoted
- **the row opens in place** — clicked, then the panel's fact count, height and
  action count measured
- **fact values break anywhere** — `word-break: break-all` read off the
  computed style of a real fact
- **a destructive action states its consequence** — the sentence quoted
- **the theme really applied** — `data-theme` AND `--surface` read back

## 3 · ⚠ The instrument was wrong twice before the code was

Both found by running it rather than trusting it.

**The light-theme pass was photographing DARK.** The first shape set
`data-theme` on `<html>` after `goto` and wrote storage under `dp-theme`. The
real key is `drape_theme`, and `ThemeProvider` (`defaultTheme="dark"`)
re-applies its own value on mount — so the attribute was overwritten within a
frame. **All 122 "light" readings in that run were dark readings wearing a
light label**, and the arm that should have caught it asked only whether the
background was not transparent, which is true of every colour there is.

Fixed by seeding storage on the origin BEFORE navigating, asserting the
attribute holds, and adding a **delta**: `dark --surface #1C1C1F vs light
--surface #FFFFFF`. Two themes reporting the same token means the switch never
moved, whatever each individual reading said.

**The `main` run could not finish.** With a 45-second wait it spent 18 minutes
timing out on a selector that will never appear. `--wait` is an argument now,
and the control runs at 8 seconds.

## 4 · ⚠ Three defects a frame caught that all 245 readings passed

This is the part worth reading, and it is founder law 6 earning its place.

**The category ran into the action.** `Security → Immutable_log` and its
category `security` were two spans inside one cell span, so the cell's own
`gap` never applied to them and the audit log read
**`Security → Immutable_logsecurity`** on every warning row. Every assertion
passed — the cell had the right content, the column had the right width, the
text was there. Fixed with `.dp-table__pair`, and the same shape was swept in
the moderator audit tab and the generations sub-tab (working law 7: fix the
class).

**A five-option select said only "All".** Status has five options, so
`TableFilter` correctly draws a `<select>` — and a closed select shows its
current value alone, so a control reading `All` sat in the filter row saying
nothing about what it filtered. Its `aria-label` was right; nothing visible
was. The options are `All statuses` now. The segmented Role filter beside it
needs no such help, which is the whole reason four-or-fewer is segmented.

**Six colours sat above a one-colour table.** `UserStatsCards` drew black,
emerald, red, amber, blue and purple figures directly above a table whose
colour rule is *"accent only where somebody needs to act"*. It read as a
different product. Now one rule: `suspended` and `locked` carry accent **only
when non-zero** — a red `0 SUSPENDED` is the loudest thing on the page saying
nothing is wrong — and `admins` stays greyscale because a role is what someone
IS.

## 5 · The frames

Twelve on the branch at 1440 and twelve at 1024, both themes:
`output/396-frames/branch-<surface>-<width>-<theme>.png` for
`users`, `audit`, `requests`, `bugs`, `invites`, `moderation`.

Two worth his eye in particular:

- `branch-audit-1440-dark.png` — moderation's audit log in dark, which had
  never been dark-tested before brief 05 put a themed frame around it. The
  count row, the expansion's facts grid and a consequence note beside a
  destructive button, all on tokens.
- `branch-users-1440-dark.png` — the six counts, the filter row (real search,
  a select, a segmented control, sort + chevron), and a row open in place.

## 6 · What a source read and a drive both CANNOT see, stated rather than implied

- **Whether the expansion animation reads well.** `dp-rise` is asserted to be
  applied; whether 200ms is right is an eye judgement.
- **Whether a 300-row list still feels right.** The dev database's largest
  staff list is 3,034 audit entries paged at 20; nothing here was measured
  under a page of 300.
- **The five form modals in dark mode.** They are unchanged by this card and
  still light-only — see `PROMOTION_PASS_SECTION_06.md` §5.
