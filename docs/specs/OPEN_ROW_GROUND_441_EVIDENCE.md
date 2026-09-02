# The open row has a ground — evidence pack (card #441)

**Shift:** foreman-182, 2026-09-02. **Money: zero** — no render, no text call, no
customer credit.

His words, and they are the whole brief:

> *"when im in the admin menu and click into a user there is no background color
> to show this profile is highlighted like the original prototype design, its all
> one color … you can see how i have the user michael rattray selected and its
> background color is slightly different to the others. so i can easily tell
> which profile im look into."*

And his follow-up: *"this should be checked across all the admin/moderator pages
that are relevant like this."*

---

## 1 · What changed, in one sentence

**An open row and its expansion now sit on one lighter block, and the two things
inside that block which used to separate themselves with a fill now separate
themselves with a hairline** — because on the new ground a fill separates
nothing.

Three declarations, all in the shared component. **Zero surface files changed**,
which is his §7 bar and is the point of brief 06's shared table.

| | before | after |
|---|---|---|
| open row + panel | no ground at all | `--fillStrong` on the **group**, so row and panel cannot drift apart |
| evidence prose block | `background: var(--well)` | `border: 1px solid var(--borderCard)`, no fill |
| sub-tab track inside the panel | `background: var(--fillStrong)` | keeps its fill, plus an inset `--borderCard` ring inside an open row |

## 2 · ⚠ This reverses his own earlier answer, and the code says so

He passed the flat row on **#396**: *"The expansion reads fine — it is obviously
open when you click it. No change."* He then looked at it beside his own
prototype and ruled the other way. Law 9 — his eye is king and the second look
wins.

**The docblock that argued for the flat row is rewritten rather than deleted**,
because its finding was TRUE: *a well behind the panel would swallow the evidence
block that sits ON the well.* That is exactly why half (b) exists. A future shift
reading #396's reply in isolation would restore the flat row as a fix; the
comment and four guard arms are what stop that being a green change.

## 3 · ⚠ THE PROTOTYPE DOES NOT SOLVE THIS — read at its bytes

The card's §3 says *"how the prototype solves it — and it is the answer."* Opened
at `Klieg Studio.dc.html` rather than inferred from his frame, **it does not**:

| line | what it paints |
|---|---|
| 6434 | open row → `var(--well)` |
| 1442 | row hover → `var(--well)` |
| 1488 | evidence block → `var(--well)` |

**One colour doing three jobs.** His frame reads correctly only because the
account he opened is `active`, and the prototype draws no evidence block for an
active account (`hasEvidence: state !== "active"`). So the mockup is
authoritative on the LOOK — an open row has a ground — and cannot be copied for
the VALUE. This is `BRIEF-RECONCILIATION.md`'s rule in its plainest form.

Ours keeps the three apart. Measured at the tokens:

| state | light | dark |
|---|---|---|
| resting row | `#FFFFFF` | `#1C1C1F` |
| hovered row | `#F6F6F8` | `#202024` |
| **open row + panel** | `#F2F2F4` | `#26262A` |

His bar is *"slightly different"* — findable at a glance, not a block of colour.

## 4 · The drive — 289 readings, 0 not ok, twelve surfaces, both themes

`scripts/_441-drive-disposable.mts`. **Grounds are sampled from the rendered
frame, not from computed style, and that is the point:** the open row and its
panel are both `background: transparent`, so their computed background-color is
`rgba(0,0,0,0)` whether the block behind them is painted or not. A
computed-style reading cannot tell this fix from its absence. Each ground is a
1×1 screenshot clip decoded with sharp.

Every surface `DataTable` reaches, per the card's §7 table:

**Admin** — `ChangeRequestList`, `UserTable`, `AuditLogTable` +
`AuditLogsFilters`, `BlockedIPsTab`, `AdminBugReports`, `AdminInviteCodes`,
`AdminFoundation` (the specimen).
**Moderation** — `AuditLogsTab`, `UserInvestigation` (+ the Credits /
Generations / Activity sub-tabs), `BlockedIPsTab`, `FlaggedReferralsTab`,
`MyRequestsTab`.

Representative numbers, identical on every surface because it is one component:

```
⭑ the open row is a different ground from the rows around it
    light: open rgb(242,242,244) vs table rgb(255,255,255) — 37 step
    dark:  open rgb(38,38,42)    vs table rgb(28,28,31)    — 31 step
⭑ the open row and its panel are ONE block
    row rgb(242,242,244) vs panel rgb(242,242,244) — 0 step
⭑ hover and open stay distinguishable
    light: hovered rgb(246,246,248) vs open rgb(242,242,244) — 12 step
    dark:  hovered rgb(32,32,36)    vs open rgb(38,38,42)    — 18 step
⭑ the evidence block is still SEPARATED on the open ground
    its edge paints rgb(228,228,231) against the block's rgb(242,242,244) — 41 step
⭑ the sub-tab track keeps its edge on the open ground — 41 step
```

**The three named surfaces (§8), with what was seen:**

- **`ChangeRequestList`** — checked first, as the card instructs, because its
  expansion carries the evidence prose block. Open row and panel are one lighter
  block; the evidence block is a bordered box on it, legible in both themes.
- **`UserInvestigation` / the Credits sub-tab** — this is where the sub-tab
  track lives, and it is the collision the card predicted. Fixed in the shared
  component with an inset ring; the track's edge reads 41 steps off the ground.
- **`AdminFoundation`** (the specimen, where the component is judged in
  isolation) — reads the same as the eleven real surfaces.

**Five surfaces had no rows in the dev database** (change requests, both blocked-IP
tabs, flagged referrals, my requests), so they were **seeded with dev fixtures**
(`scripts/_441-seed-disposable.mts`, tagged and removed afterwards) rather than
reported as unmeasurable — his bar is *"opened with a row expanded"*, and a
source read does not satisfy it.

## 5 · ⚠ The negative control — the instrument can fail

Working law 2. The same driver, same fixtures, run against **`main`**:

```
24 of 24  ⭑ the open row is a different ground from the rows around it   FAIL
24 of 24  the open group carries the `--open` modifier                   FAIL
14 of 14  ⭑ the evidence block is still SEPARATED on the open ground     FAIL
14 of 14  the evidence block no longer separates itself with a fill      FAIL
 2 of 2   ⭑ the step survives in DARK / in LIGHT on its own              FAIL
```

⚠ **Two arms did NOT fail on `main`, and that is stated rather than glossed.**
*"The row and panel are one block"* is trivially true when neither is shaded, and
*"hover and open stay distinguishable"* passes on `main` for the wrong reason —
open has no ground at all. Neither is evidence that the fix landed; both are
guards against a HALF-fix, and the suite's prototype-copy sabotage is what
actually pins the second one.

## 6 · Three driver defects found on the way, each fixed rather than noted

Recorded because each would have produced a confident wrong reading:

1. **A surface measured under a name it never reached.** The moderator tab is
   labelled *"User investigation"*, not *"Users"*. The click found no segment,
   the driver measured the page anyway, and twelve readings about the moderator's
   AUDIT tab were filed under `mod-users`. It now `continue`s on a tab it cannot
   reach.
2. **Two coordinate systems conflated.** `page.screenshot({clip})` is
   DOCUMENT-relative; `page.mouse.move` and `getBoundingClientRect` are
   VIEWPORT-relative. On an unscrolled page they agree — which is why this stayed
   invisible until the specimen table at y 2275 in a 1000px viewport needed
   scrolling.
3. **A hover nobody entered.** The cursor was moved to a rect measured several
   hundred milliseconds earlier; on the long specimen page the layout had shifted
   and `elementFromPoint` was a `.dp-sectionhead`. The arm reported *"hover does
   not paint"* when the truth was *"this driver never hovered the row"*. It now
   asserts `:hover` matches **before** believing the pixel — a reading of a state
   nobody entered is not a null result, it is a measurement of the wrong thing.

## 7 · The arms, and the attack on them

**7 new arms** in `client/src/features/staff/section06-guard.test.ts`, each
paired with a positive control. **7 sabotages, 7 caught**, arm count steady at 28
on every run (a sabotage that silently shrinks the population reads as a pass):

| sabotage | caught |
|---|---|
| delete the open-row ground (a shift "reverting" to #396's answer) | ✅ 2 arms red |
| **copy the prototype literally — open row takes `var(--well)`** | ✅ |
| put the evidence block's fill back (half (b) undone) | ✅ |
| drop the sub-tab track's edge | ✅ |
| break the closed-row hover while "tidying" the two rules into one | ✅ |
| the className goes but the rule stays (dead CSS) | ✅ |
| paint the ground on EVERY row, not only the open one | ✅ |

⚠ **One pre-existing arm was made less fragile, and it caught itself.** The
facts-grid arm sliced the stylesheet between bare class names, so the moment a
docblock elsewhere MENTIONED `.dp-table__evidence` the end index fell before the
start and the slice was the empty string. Its own *"the arm is reading nothing"*
message is what surfaced it. It now slices on the rules (`selector {`).

## 8 · The law-7 class sweep

**The class:** *a fill used as a separator, for something that sits on a ground
the fill matches.* Swept every `--fill` / `--fillStrong` background in the app
against "can this render inside `.dp-table__rowgroup--open`".

**Three instances found, three fixed** — the evidence block, the sub-tab track,
and the absent open-row ground itself.

**Two swept and clear, verified at the numbers rather than assumed:**

- **`.dp-skeleton`** (`--fill`) *can* land on the new ground —
  `ReconciliationSubTab` and `CreditsSubTab` render inside `row.panel`. It
  already carries `border: 1px solid var(--border)` and so does not rely on its
  fill: 18 total channel steps against the open ground, in both themes.
- **`.dp-inv__card` / `.dp-inv__flagged`** are `--surface` inside the panel, so
  on the new ground they LIFT rather than sink — 13 steps light, 10 dark. Better
  than before, not worse.

Everything else carrying those fills is chrome, a modal or a casting surface and
cannot appear inside a table panel.

## 9 · Law 6 and law 9 — I looked

Frames in his gallery, and the whole point is the pair:
`before-users-dark.png` / `after-users-dark.png`, plus the light pair. Same
surface, same row, **panel fully loaded on both sides** — the drive's own frames
caught the branch mid-fetch and `main` loaded, which would have made the pair
differ in two ways and let him compare the wrong one.

I looked at these myself, both themes, section and full page — not only at the
readings.
