# #421 — the staff dialogs join the design language

**Shift** foreman-177, 2026-09-02. **Card** #421, widened by his Crew reply #91.
**Money: ZERO** — no render, no text call, no credit.

> *"id like the change request modal and any other staff modals to be
> re-designed in our same design language. also the buttons copy 'new change
> request' is so long just called it file a request or something."*
> — Crew reply #91, 2026-09-02 01:33:53Z

---

## 1 · What a person sees

Open Admin in **dark mode** and suspend a user. Before this change a **white
box** appears over a dark app, with grey-on-grey field text you cannot read. The
same for freeze, unfreeze, adjust credits, change role, block an IP, approve or
deny a change request — and for the moderator's own **change request modal**,
which is the one he opened.

Afterwards every one of them is the app's own dark surface, in the app's own
palette: **no green, no blue, no amber, no cyan, no purple**, and exactly one
red — spent only on the two acts that genuinely end something.

And his button now reads **`File a request`** instead of `New change request`.

---

## 2 · The population is DERIVED, and the card's own table was short

#421 listed three files and 46 literals. Read at the code by taking **every file
under `features/admin`, `features/moderator`, `features/staff` and the staff
pages that mounts a `Dialog`**:

| file | hex before | after | note |
|---|---|---|---|
| `features/moderator/ChangeRequestModal.tsx` | **89** | 0 | ⚠ the modal he named — on no list |
| `features/admin/UserActionModals.tsx` | 45 | 0 | |
| `features/admin/AuditActionModals.tsx` | 29 | 0 | |
| `pages/AdminUserManagement.tsx` | 18 | 0 | ⚠ **two INLINE dialogs** (freeze, unfreeze) |
| `features/admin/ReviewModal.tsx` | 11 | 0 | |
| **total** | **192** | **0** | |

Plus **seven Tailwind tints** deleted with `UserBadges`'s two orphaned badges.

⚠ **Why the card's table was short, and it is the same shape as the bug.** Both
reports behind #421 were written from inside `features/admin/`, so both named
admin files; the moderator's own modal was in neither, and the two dialogs drawn
*inline* on the accounts page were described by the card's prose (*"same for
freeze"*) while its file table could not see them. **A population inherited from
a report is only as wide as the report.**

---

## 3 · ⚠ THE FIX IS DELETION, NOT SUBSTITUTION

This is the part most worth keeping, because the obvious repair was the wrong
one.

`client/src/index.css` carries a **semantic remap**: every shadcn slot already
resolves to a foundation token — `--color-background` → `--surface`,
`--color-primary` → `--ink`, `--color-destructive` → `--error`,
`--color-muted-foreground` → `--meta`. `DialogContent` already ships
`bg-background`; `Input` already ships `border-input` and
`placeholder:text-muted-foreground`.

**So the primitives were theme-correct the whole time and the dialogs were
painting over them.** The tempting fix — rewrite `bg-white` as
`bg-[var(--surface)]` — would have produced a second statement of a value the
component already states, which is working law 4 and drifts on the first token
move. Taking the classes off is the fix, and it is why **these files come out
shorter than the ones that had the bug**.

One class was ADDED, not deleted: `text-foreground` on each `DialogContent`.
The primitive sets its background and not its ink, and it portals to
`document.body` — outside `.dp-root` — so what it inherits is the body's.

---

## 4 · The two judgements, stated rather than smuggled

**a. Destructive confirms stop wearing the primary-action treatment.**
`ReviewModal` drew approve in `bg-emerald-600` and deny in `bg-red-600` — a
green/red pair that told you which was which by hue alone. Brief 07 §3 removed
exactly that device from the staff surfaces. Now:

| act | treatment | why |
|---|---|---|
| Suspend user (×2), Block IP, Deny request | `variant="destructive"` (`--error`) | ends or blocks something |
| Approve, add/deduct credits, promote, demote, freeze, unfreeze, submit | default (`--ink`) | constructive or reversible — freeze has Unfreeze two rows below it |

**b. Sentence case**, because brief 05 §"Labels" writes it down: *"Labels are
sentence case, not Title Case … House voice throughout the product."* `Block IP`
keeps its capitals; an initialism is not Title Case.

**c. `RoleBadge` → `RolePill`.** The role dialog drew a purple `admin` crown and
a blue `moderator` shield inside a dialog this change just made monochrome.
`features/staff`'s `RolePill` already existed, is already greyscale, and its own
docblock rules on this case. ⚠ **Both halves of that clause expired on
2026-09-02 (#422): `RolePill` carries accent for `admin` now, and its docblock
rules the other way.** The swap itself is unaffected and still correct — it was
about seven tints collapsing to one rule in one function, and `admin` wearing a
single accent by his ruling is not a return to the purple crown. In this dialog
only the LEFT pill can ever show it: `targetRole` is typed `"user" | "moderator"`,
so it never draws two accents facing each other. Measured before it was believed:
**`RoleBadge`'s
only consumer in the product is that dialog** — `UserTable.tsx` imports
`formatDate` and `getUserStatus` from `UserBadges` and nothing else, because
brief 06 already moved the table to `StatePill`. `StatusBadge` had **zero**
consumers. Both are deleted; no other surface moves.

---

## 5 · Driven, both themes, both trees

`scripts/_421-drive-disposable.mts` opens all five dialogs in the running app.

| | branch | `main` (control) |
|---|---|---|
| readings ok | **87 / 87** | **70 / 87** |

**The reading that answers his complaint is a DELTA**, not a per-theme arm. A
dialog hard-coded to `bg-white` computes the same white in dark and in light, so
it passes any single-theme check on its own:

| dialog | `main` dark → light | branch dark → light |
|---|---|---|
| suspend | `rgb(255,255,255)` → `rgb(255,255,255)` ✗ | `rgb(28,28,31)` → `rgb(255,255,255)` ✓ |
| credits | `rgb(255,255,255)` → `rgb(255,255,255)` ✗ | `rgb(28,28,31)` → `rgb(255,255,255)` ✓ |
| role | `rgb(255,255,255)` → `rgb(255,255,255)` ✗ | `rgb(28,28,31)` → `rgb(255,255,255)` ✓ |
| freeze | `rgb(255,255,255)` → `rgb(255,255,255)` ✗ | `rgb(28,28,31)` → `rgb(255,255,255)` ✓ |
| change request | `rgb(255,255,255)` → `rgb(255,255,255)` ✗ | `rgb(28,28,31)` → `rgb(255,255,255)` ✓ |

**Painted tint, read off computed styles** so hex, rgb, `oklch` and named
colours are judged alike (the one red carved out by channel ratio, since it is
allowed):

| dialog | `main` | branch |
|---|---|---|
| suspend | 5 tinted of 19 | **0 of 19** |
| credits | 0 of 22 | 0 of 22 |
| role | 17 tinted of 41 | **0 of 36** |
| freeze | 9 tinted of 19 | **0 of 19** |
| change request | 7 tinted of 63 | **0 of 63** |

⚠ **`credits` reads 0 on BOTH trees, and that is the honest shape of this
instrument** — that dialog never had a tint, only a white panel. An arm that
fired uniformly would be measuring something other than what it claims.

His copy, read on the surface bar: `main` → *"My requests · New change request ·
Submit Request"*; branch → *"My requests · File a request · Submit request"*.

Frames: `output/421-frames/` — ten branch, ten `main`, both themes.

---

## 6 · ⚠ THREE THINGS I GOT WRONG BEFORE I GOT THEM RIGHT

Written down rather than quietly fixed, because each is a shape that recurs.

**a. My own eye called a defect that was not there.** Looking at
`branch-dark-suspend.png` I read the `Cancel` button as a **white filled pill in
dark mode** and started to chase it. The computed style says
`background-color: rgba(0, 0, 0, 0)` with `rgb(237,237,239)` text, and sampling
the frame's own pixels agrees — the action row is `rgb(27,27,30)` on the branch
and `rgb(255,255,255)` on `main`. **A 492px downscaled render of a bordered
transparent pill reads as a filled one.** Law 9 says his eye is king over a
reader; the mirror of it is that a *model's* eye is not king over an artifact,
and the cheap settle was sampling the bytes.

**b. A disjunction is only as strong as its weakest arm.** The driver's
row-ready wait was `rows > 0 || tds > 0 || buttons.length > 4`. The navigation
rail satisfies the third **before the accounts query is even sent**, so four of
five dialogs reported `NO ROWS` over a page that draws seven. A wait that can be
satisfied by the page shell is not a wait.

**c. The sabotage driver's own baseline caught a broken driver.** Its first run
printed *"baseline: RED — the tree is dirty, stop"* on a clean tree:
`spawnSync("npx.cmd", …)` without `shell: true` returns non-zero on Windows
whatever the test did. **Without the baseline arm, all six sabotages would have
reported RED and I would have believed them.**

---

## 7 · Instruments

- **`token-guard` enrolled over the whole of `features/moderator`** (not file by
  file — the remainder that enrolment was routing around is now gone) plus the
  four admin files and the accounts page. One carve-out added, for
  `section09-guard.test.ts`'s own planted `#BADA55` positive control, on the
  same narrow reasoning as its two existing siblings.
- **Eight sabotages, `scripts/_421-sabotage-disposable.mts`**, each restoring in
  a `finally` and each verified restored at the bytes: **all eight RED, and each
  names its own file** — a count alone cannot tell a correct catch from an
  unrelated break. Baseline green before, green after.
- `pnpm check` clean · **396 client guard arms pass** across 15 files, including
  `section05`–`section09`, `promotion-guard`, `theme` and `icons-guard`.

---

## 8 · Declared remainders — filed, not smuggled

- **`ChangeRequestConstants.tsx` holds ~19 Title Case action labels**
  (`"Approve Refund"`, `"Confirm Suspend"`) that `ReviewModal` renders. It also
  feeds `ChangeRequestList.tsx`, a surface brief 06 already shipped, so
  lowercasing it is a copy change across a file no modal owns. **The one string
  this PR leaves in Title Case is `& Send to Slack`**, because it concatenates
  onto those labels and lowercasing it alone would read as a typo.
- **`ChangeRequestAttachments.tsx`** holds 16 hex literals. It is a detail-row
  component on the change-requests page, not a modal, so it is outside both
  #421 and his reply.

---

## 9 · The reviewer's notes, and what they cost

`review` returned **pass, no blocking findings**, and verified the deletion
claims independently at the consumers. Three non-blocking notes; two were mine
and are fixed on this branch.

**1. My own sentence-case sweep stopped one label short.** `Evidence Summary
(optional)` survived while its siblings became `Credit amount`, `Target user
ID`, `Related audit log`. It renders identically — the label carries
`uppercase`, so the source casing is invisible — which is exactly why nothing
caught it and why it is worth recording: **a sweep whose misses are invisible on
screen has no feedback loop.** Fixed.

**2. Thirteen redundant rows, not eight.** The reviewer counted eight
`features/moderator/*` rows made redundant by the directory row; read at the
file there were **thirteen** (six from brief 06's block, seven from brief 09's).
All thirteen removed, and both docblocks amended rather than left describing
rows that no longer exist.

⚠ **And the removal needed its own proof, which is the part I would most want
read.** *"The directory row collects them"* is a claim about `collect()`. Two
sabotage arms were added on files that had a named row before and have only the
directory row now — `CreditsSubTab.tsx` and `UserInvestigationWidgets.tsx` —
and both go **RED and name themselves**. Without them, a row removal that
un-guarded seven files would have looked exactly like this one.

⚠ **Adding those two arms produced a fourth mistake of the kind §6 collects.**
The first attempt patched the driver with a Python string whose `
` did not
match the file's `
`; the replace matched nothing, and **the patch script
printed `two arms added` anyway.** The sabotage run then reported six arms, all
green-and-named, and read as a complete success. The tell was the arm COUNT, not
the verdict — **a script that reports its own success without asserting it is a
report, not a fact** (working law 1, pointed at a five-line helper).

**3. The freeze/unfreeze `<textarea>`s hand-mirror the `Textarea` primitive's
focus classes.** Left as-is; the PR declares why the element was not swapped
(IME guard and field-sizing behaviour parity, against #421's own no-behaviour-
change bar), which is the declared-shortcut form the fidelity law permits.

