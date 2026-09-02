# #413 — evidence

⚠ **#392 rode the same shift and has its OWN PR** — the batch is about the
session, never about merging changes together, so its record is on that PR.

**Shift:** foreman-183, 2026-09-02. **Money: zero.** No render, no text call, no
customer credit. Local drives only.

---

## 1 · What he asked

> *"why when scrolling through the admin pages only some pages contain the
> updated time the auto refresh toggle and a notification button? overview
> contains it but not all the other pages"* — founder, 2026-09-01 (#413)

Three named parts. Every reading below is taken **one part at a time**, because
the defect is a page having some of them.

---

## 2 · ⚠ THE CARD UNDERSTATED THE PROBLEM BY TWO PAGES, AND ITS INSTRUMENT IS WHY

#413 measured by grepping every staff page for `refreshControls` and reported
**five of eight** pages as having the cluster, naming Invite codes and Bug
reports as the only gaps.

**Read at what those five actually PASS, three had it.**

| page | updated time | AUTO toggle | manual button | card said |
|---|---|---|---|---|
| Overview | ✅ | ✅ | ✅ | ✅ |
| Audit logs | ✅ | ✅ | ✅ | ✅ |
| Moderation | ✅ | ✅ | ✅ | ✅ |
| **Users** | ❌ | ❌ | ✅ | ✅ — **wrong** |
| **Change requests** | ❌ | ❌ | ✅ | ✅ — **wrong** |
| Invite codes | ❌ | ❌ | ❌ | ❌ |
| Bug reports | ❌ | ❌ | ❌ | ❌ |
| Crew | own inline line | ❌ | ❌ | deliberately out |

`AdminUserManagement` and `AdminChangeRequests` passed `onRefresh` and
`isRefetching` alone — **a lone manual button** — which satisfies a grep for the
prop and fails two of the three things he named. **A property is proven at the
values, never at the prop name**; this is the shape-match-where-a-declaration-
exists class already named in `CLAUDE.md` for the Atlas collectors.

**So four pages were fixed, not two.** The negative control in §4 is the proof.

## 3 · ⚠ AND THE REASON BOTH PAGES GAVE WAS FALSE AT THE CODE

Each carried a docblock saying the page *"keeps no `lastRefresh` and no
auto-refresh preference … inventing the other two would be state no reader
produces (brief 05 §4)"* — **citing the brief**, so it read as a decision rather
than an omission.

`dataUpdatedAt` is produced by **every** TanStack query, and `AdminOverview` has
read its stamp from exactly that field since brief 05 shipped. Nothing needed
inventing. **Brief 05 §4's sentence — *"several surfaces do not poll"* — was true
of ONE surface, not several, and is corrected in the brief in this same commit**,
because the brief is what the next shift re-reads.

---

## 4 · The drive — both themes, all eight surfaces

`scripts/_413-drive-disposable.mts`, headless Edge, minted `verify-bot-admin`
session, viewport 1440×1000.

```
branch (team/413-staff-refresh-cluster, port 3151)   106 readings   0 not ok
main   (control, port 3152)                           90 readings  20 not ok
```

**The 20 reds on `main` are exactly the defect, and their SHAPE is the §2
correction:**

```
change-requests  NO STAMP · NO TOGGLE            (manual button present)
users            NO STAMP · NO TOGGLE            (manual button present)
invites          NO STAMP · NO TOGGLE · NO BUTTON
bugs             NO STAMP · NO TOGGLE · NO BUTTON
```

× two themes. Users and Change requests fail two arms each and pass the third —
which is the lone-button state the card's table could not see.

⚠ **THE TOGGLE IS DRIVEN, NOT ONLY SEEN.** A control that renders and does
nothing is invariant 7 and is invisible to a presence reading, so on every
surface the toggle is CLICKED and `aria-pressed` must flip, with the track's
`--on` class asserted to agree with the new state. 7 surfaces × 2 themes × 2 arms,
all ok.

⚠ **The frames are taken AFTER that click**, so a screenshot shows the
post-click toggle state. Stated rather than left to be inferred: Overview
defaults ON and photographs OFF, the other six default OFF and photograph ON.

### Frames — `output/413-frames/`

| | `main` (before) | branch (after) |
|---|---|---|
| Bug reports | empty right side | `9:11:28 pm │ ◉ AUTO 30s │ ↻` |
| Users | lone `↻` icon | `9:11:13 pm │ ◉ AUTO 30s │ ↻` |
| Overview | unchanged | unchanged |

**Law 6 / law 9: the frames were looked at, both themes, before and after.**

### ⚠ One reading was wrong before it was right

The Crew arm read `body.innerText` after waiting for skeletons to clear — and
**Crew draws no skeleton**, so it measured the page before `stateQuery` landed
and reported Crew's inline freshness line ABSENT on both themes. The line is
there (`AdminCrew.tsx:401`, behind `stateQuery.data`). Fixed by waiting on
`[data-testid="crew-edition-stamp"]` itself. **A reading of a state nobody
entered is not a null result — it is a measurement of the wrong thing.**

---

## 5 · The arms, and the sabotage that rewrote one of them

`client/src/features/staff/section05-guard.test.ts` (+6 arms). Population
derived from the pages folder, as every arm in that file is. (#392's five arms
are on its own PR; the sabotage driver ran all seven cases in one pass.)

**7 sabotages, 7 caught by the arm that names them** (`_413-sabotage-disposable.mts`,
restoring in `finally`).

⚠ **ONE WAS MISSED ON THE FIRST RUN, AND IT WAS THE CARD'S OWN DEFECT.** The
partial-cluster arm exempted any page that MENTIONED `useStaffRefresh` anywhere
in the file — so a page that calls the hook and then hands the bar a hand-rolled
`{{ onRefresh }}` stayed green. **The exact defect this card fixes, surviving in
the arm that fixes it, by the same shape-match error the card's own instrument
made.** The arm now parses the balanced `refreshControls={…}` expression and
judges what is actually PASSED. Re-run: 7 of 7.

| sabotage | caught by |
|---|---|
| Invite codes loses the cluster again | the population is real |
| Bug reports ships a manual button alone | no staff page ships a partial cluster |
| the hook returns four fields instead of five | the shared hook returns all five |
| the stamp is taken at the refetch call | the shared hook returns all five |
| Crew folded in without the list updated | the two pages outside the cluster |
| the appeal link points at the retired domain | *(#392's PR — same driver run)* |
| the appeal route is deleted entirely | *(#392's PR — same driver run)* |

---

## 6 · The law-7 class sweep

**The class: a control the founder named, shipped in part, under a docblock
whose stated reason is false at the code.**

- **Four instances, four fixed** — Invite codes and Bug reports (no cluster),
  Users and Change requests (button only, with the false reason).
- **Two swept clear and left alone, each with its reason on the record**:
  `AdminCrew` states its own freshness inline and #415 §3 folds it in on his
  word; `AdminFoundation` mounts no staff bar at all, by his ruling.
- **Three left deliberately untouched**: Overview, Audit logs and Moderation had
  the whole cluster already. Their inline copies differ in ways that are
  decisions — Overview defaults ON and toasts *"Dashboard refreshed"*, the other
  two default OFF and toast *"Data refreshed"*, and two stamp beside the refetch
  call rather than off `dataUpdatedAt`. **Folding them into the hook is a
  promotion pass with his eye on the copy, not a side effect of a bug fix.** An
  arm names all three, so converting one is a deliberate act.

---

## 7 · ⚠ #413's OWN ITEM 2 IS SUPERSEDED — recorded rather than obeyed

#413 item 2 says *"Leave Crew alone, and record in its docblock why it is
deliberately outside the pattern."*

**#415 §3 reverses that on his word**, filed the same day: *"even thought crew
has its own refresh principles should we just fold it into the same as overview
so everything is consistent"* — and #415 answers *yes*.

**So that docblock was NOT written.** Writing a paragraph explaining a permanent
exception, on the day a card exists to remove the exception, is a document born
stale. What was written instead is an arm that goes **RED the day #415 lands**,
forcing that shift to delete Crew's inline line in the same commit — otherwise
the page states its freshness twice, which is the double-count brief 08 removed.
Recorded on both cards.

---

## 8 · Checks

- `pnpm check` exit 0
- `npx vitest run` — **11,140 passed, 0 failed**, 337 skipped, measured with #392's five arms present too (was 11,129; +11 across both PRs)
- Atlas regenerated — 996 modules, 280 procedures, 288 findings (0 error);
  `architectureAtlas.test.ts` 20/20
- `pnpm capability:check` OK — 59 doors, 62 corpus rows, 0 error
- Script guards run on this shift's disposables
