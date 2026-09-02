# The pending-request count reaches the staff bar, and Crew joins the one refresh — evidence (#415)

**Shift:** foreman-185, night of 2–3 September 2026. **Card:** #415 (`founder-ordered`).
**Money: ZERO.** No render, no text call, no customer credit. Dev-database writes only (five fixture rows), production reads.

---

## 1 · What he asked for, and what was actually missing

His two asks, 2026-09-01, verbatim:

> *"the notification button needs to count any requests sent from moderators to admin. e.g if mods sent 5 requests to the admin panel it shold show 5 requests pending and they should sit as cards at the top of the overview page and when i click the card itl take me to the requests page"*

> *"even thought crew has its own refresh principles should we just fold it into the same as overview so everything is consistent"*

**Half of the first ask was already live** and the card said so: the cards at the top of Overview, and the click through to `/admin/change-requests`, shipped with #397. What was missing was **the number in the bar**, and per the card's §2 it is a **count pill on the `Change requests` tab** rather than a separate notification button — a button beside the tab would be two doors to one room.

**What a customer-facing admin sees now:** the number of moderator requests waiting on him is on the bar of **every** admin page, not only the one page whose query happened to fetch it. Five pending requests draws `Change requests 5`; zero draws nothing at all.

---

## 2 · The count-pill mechanism already existed — this is plumbing, not a new control

Read at the code before writing a line (law 7c). `SurfaceBarSegment` in `client/src/foundation/primitives.tsx` **already declares `count`**, and `segmentBody` already enforces omit-at-zero, in its own words:

> *"Omitted at zero, never `(0)` — enforced here rather than left to each caller, because 'omit at zero' is a rule that only holds if the one place that draws the pill is the place that decides."*

So nothing about the pill was designed or styled by this shift. **The whole engineering question was the one the card named: where the number comes from.**

### One reader, three surfaces

| surface | how it gets the number |
|---|---|
| Overview's `NeedsHuman` card | `admin.getOverview` → `governance.pendingChangeRequests` |
| Overview's `GovernanceCard` tile | the same object, passed as a prop |
| **the bar's pill (new)** | `useStaffCounts()` → the same query |

There is exactly **one** producer in the whole product — `getGovernanceMetrics` in `server/db/adminOverviewQueries.ts` — and this change adds no second one. A bar saying `5` over a card saying `4` is worse than a bar saying nothing (working law 4), and two arms hold that derived from the tree rather than from a list.

⚠ **A dedicated lighter procedure was considered and NOT taken, and it is worth stating as a tradeoff rather than leaving it implied.** `getOverview` runs seven aggregations to produce a number two of them answer, and the bar now runs it on the seven admin pages that previously did not. Against that: a `getStaffCounts` procedure is a second caller that must be kept pointing at the same db function forever, and the card asked for the overview data at the bar in those words. **The cost is reversible in one file** — `useStaffCounts` is the only thing that knows where the number comes from, and no page reaches past it. On Overview it costs nothing at all: TanStack keys on procedure + input, so the hook and the page share one cache entry and one request.

---

## 3 · Crew folded into the shared refresh cluster — and the one thing that was deliberately kept

`AdminCrew` was the last staff page stating its own freshness inline. It now passes `refreshControls` like the other seven, and **the inline `· checked {checkedAgo}` was deleted in the same commit** — otherwise the page states its freshness twice, six inches apart, in two different notations.

⚠ **Two things were kept at the foot on purpose, and neither is freshness:**

- **The SHIFT NAME.** *"Briefing edition 217, written by Foreman — night of 2 September…"*. That is **authorship**, and it is the more useful half of the old sentence — the bar's stamp has no room for it and no business with it. Losing it while "making things consistent" is exactly the quiet cost law 7 exists to catch.
- **The failed-check clause.** The bar's stamp reports when data last **landed**; `· the last check failed — trying again` reports whether the last **attempt** succeeded. A stamp reading 14:02 merely looks old and cannot say *"and I know it is stale"*.

### ⚠ The trade this makes, said plainly rather than buried

Crew's live re-read (#133 — *"is there a way to have the desk page auto refresh… because i keep hard refreshing it"*) used to be **unconditional at 60s** while the tab was visible. It is now the panel-wide `AUTO` switch:

- **On by default** (#453), so the behaviour he asked for in #133 is unchanged out of the box.
- **Turned off, Crew stops polling** like every other staff page, with the manual button beside the stamp. That is what "consistent" means, and it is his instruction.
- **Thirty seconds, not sixty** — because the bar's switch is LABELLED `AUTO 30s`, and a control that names its own period must not sit over a page using another one. It derives from `STAFF_REFRESH_INTERVAL_MS` rather than restating `30_000`, so the label and the timer cannot drift apart in a later edit.

---

## 4 · The drive — and what makes it a control rather than a decoration

My predecessor's first control was worthless and looked fine: both arms returned identical readings at every step. **The question that saves it is: what reading would the two arms give if the fix did nothing?**

Every step below is a discriminator by construction, and **all seven disagree**. Five pending change requests were seeded in the dev database first, so the pill had a real number to draw — an absence-only reading is green in exactly the state this card exists to fix.

| # | step | branch | `main` (control) |
|---|---|---|---|
| 1 | `/admin/users` pill, **dark** | segment `"Change requests5"` · pill **"5"** | segment `"Change requests"` · pill **ABSENT** |
| 2 | `/admin/users` pill, **light** | pill **"5"** · bg `rgb(255,255,255)` | pill **ABSENT** · bg `rgb(255,255,255)` |
| 3 | `/admin/overview` — pill vs card | pill **"5"** · page says **5 change requests** | pill **ABSENT** · page says 5 change requests |
| 4 | `/admin/crew` bar cluster, **dark** | **PRESENT** · stamp `12:15:57 am` · switch `AUTO 30s` · manual `true` | **ABSENT** · no stamp, no switch, no button |
| 5 | `/admin/crew` foot, **dark** | *"…written by Foreman — night of 2 September (…)"* | *"…(…) **· checked just now**"* |
| 6 | `/admin/crew` bar cluster, **light** | **PRESENT** · switch `AUTO 30s` | **ABSENT** |
| 7 | `/admin/crew` foot, **light** | no timestamp | **· checked just now** |

**Law 6 / law 9: I looked at every frame myself.** The pair that is the whole argument is `/admin/crew` — branch, bar carrying stamp + `AUTO 30s` + refresh with a foot line that names the shift and no time; `main`, an empty bar right-hand side with the timestamp at the foot.

### ⚠ WHICH FRAMES EXIST, AND WHY SOME DO NOT — I HIT A TRAP THIS REPOSITORY HAD ALREADY WRITTEN DOWN

`git worktree remove --force` empties the directory it removes, and the shift's **first** worktree held twelve frames. The recorded rule is *copy receipts out before removing the worktree*; I did that for the second worktree and not the first.

**What is in `output/415-frames/` now, and it is the set that matters:**

| frame | what it shows |
|---|---|
| `merged-users-bar-{dark,light}.png` | the pill reading **5** on a page that is not Overview, both themes |
| `merged-crew-{dark,light}.png` | Crew carrying the bar's stamp, `AUTO 30s` and the manual button |
| `merged-crew-foot-{dark,light}.png` | the foot line naming the shift with **no second timestamp** |
| `branch-deny-{before,after}.png` | the pill going **5 → 4** when a request is resolved |
| `control-noinvalidate-deny-after.png` | ⚠ **the defect photographed** — the bar saying `5` over a filter saying `Pending (4)` |

The `merged-*` frames were **re-driven against merged `main`**, which now IS that code, with every reading identical to the branch drive above.

**The `main`-side control frames are gone and are not being recreated.** That tree state is a commit behind a merge, and photographing a state the product no longer has is an hour spent on a picture of the past. **Their readings survive quoted verbatim in the table above**, which is the substance — and the round-2 control frame demonstrates the same discipline on a live defect. What matters is that this document does not cite files that are not there.

### ⚠ TWO INSTRUMENT FAILURES, BOTH MINE, BOTH CAUGHT BEFORE THEY BECAME EVIDENCE

1. **A three-second sleep reported the pill ABSENT on Overview** while it drew `5` on `/admin/users` two steps earlier — which reads exactly like a real defect on the page that matters most. Overview runs `getOverview` **and** `getTimeSeries` against a remote database, so it is the slowest admin page, not a broken one. **A fixed sleep reports a slow answer as no answer.** Fixed by waiting on the sentence.
2. **The frame labelled "light" was a second photograph of the dark theme.** The switcher toggled a `dark`/`light` CLASS and wrote `vite-ui-theme` — a different library's convention. This app stores `drape_theme` and applies `data-theme` on `<html>` (read at `contexts/ThemeContext.tsx`). It changed nothing and threw no error. **A frame is evidence of what it shows, never of what its filename claims** — the driver now ASSERTS the applied attribute and records the measured page background beside every themed reading, which is why the table above carries `rgb(28,28,31)` and `rgb(255,255,255)`.

---

## 5 · The arms, and the proof they can fail

**22 new arms** in `client/src/features/staff/counts415-guard.test.ts`. `pnpm test` has no DOM by config, so the pill's positive control could not be a render — instead `adminSegments` was extracted as a **pure function** and driven with `5` and with `0`. That is the difference between an arm that can fail and an arm that is green because nothing is there.

**Sabotage: 10 of 10 caught by the arm named for them**, tree restored green afterwards and proven so (`scripts/_415-sabotage-disposable.mts`, judged on the **exit code** and the JSON reporter — never on scraped output, which is how the previous shift's driver read 0/5 with every arm working).

| # | sabotage | arm that caught it |
|---|---|---|
| 1 | the pill attached by INDEX | *follows the ROUTE through a reorder* |
| 2 | the count never reaches the bar (the #416 defect) | *put a 5 on Change requests* |
| 3 | omit-at-zero moved out of the foundation | *enforced where the pill is DRAWN* |
| 4 | a SECOND server module counts pending requests | *exactly one module in the product COUNTS* |
| 5 | the bar fetches for itself | *issues no query of its own* |
| 6 | Crew's inline timestamp returns | *the inline timestamp is GONE* |
| 7 | the shift name dropped | *the SHIFT NAME survived* |
| 8 | Crew keeps 60s under an `AUTO 30s` switch | *polls at the interval the bar's switch NAMES* |
| 9 | the nav gate goes live (#133 rebuilt) | *the live re-read follows the shared switch* |
| 10 | the hook fires for non-admins | *returns 0 rather than a placeholder* |

**Three sabotages redden a second arm as well, and all three are honest supersets** rather than duplicated coverage: removing the count entirely breaks both the "5 lands here" arm and the routing arm; making the bar fetch for itself is by definition also a second client fetcher. Declared rather than contorted away.

### ⚠ THE DRIVER CAUGHT TWO OF MY OWN ERRORS, AND THE FIRST IS THE ONE WORTH READING

- **A sabotage that broke nothing.** `indexOf(tab) === 1` produced identical output to the route keying — because `CREW_TAB_INDEX` is 2, so Crew splices in **after** Change requests and index 1 is Change requests either way. **My arm's docblock had claimed the index form was "already live for half the admins today", and that was false** — written from the shape of the code rather than read off it. The claim is corrected in place and kept as a note rather than quietly deleted; the route keying is still right, but its reason is the **reorder** (his §5 order has changed once already, and #416 adds a second counted tab), not a live bug.
- **A find-string that never applied.** It assumed `written by` began its line; it is the tail of the `Briefing edition {…},` line. The driver reported FIND STRING ABSENT rather than a pass — **a driver that treats an unapplied sabotage as a caught one certifies whatever it failed to break.**

---

## 5b · ⚠ THE GATE REVIEW FOUND A REAL BUG I HAD SHIPPED, AND IT WAS THE WORST-PLACED ONE POSSIBLE

The `review` job on PR #456 passed the gate and then found this, correctly:

> *"the pill goes stale on the exact page where requests are resolved."*

**Five requests pending; he opens `/admin/change-requests` and declines all five. The list empties. The bar keeps reading `Change requests 5`.** With the window focused and no navigation, nothing ever refetches it.

⚠ **This is the exact state the pill exists to prevent, produced by the one action the pill exists to drive** — and my own docblock had named that state as the failure to avoid, three files away.

### Why it happened, and the sentence of mine that was false

`useStaffCounts` holds `staleTime: 30_000` and no `refetchInterval`. **`staleTime` makes a refetch PERMISSIBLE at the next trigger; it does not schedule one.** The QueryClient is stock (`client/src/main.tsx`), so the only triggers are remount and window refocus.

My docblock said *"a number that appears within thirty seconds of a request landing is soon enough"* — **describing a poll the hook does not have.** That is law 7b inside a comment: a claim about behaviour, written from an assumption about `staleTime` rather than driven. It is corrected in place, and it now states exactly what refreshes the pill and what does not.

### The fix, and the half that was NOT a fix

**Repaired:** `AdminChangeRequests` invalidates `admin.getOverview` in both mutation handlers, so the number he just changed is right immediately, on the page where he changed it.

**Filed as #457, not taken:** a request *arriving* while he sits still reaches the pill on his next navigation or refocus. The reviewer called this a decision rather than a repair and was right — the alternative is wiring `refetchInterval` to the shared `AUTO` switch, which puts seven aggregations on a 30s timer across eight pages. That is a different tradeoff from the one declared in §2 and it should be chosen, not slipped in. The card carries both options and a recommendation.

**Population derived, not listed:** three client mutations move this count. Two resolve requests and both now invalidate. The third — `moderator.createChangeRequest` — is **deliberately excluded and the reason is structural**: it runs in the moderator's session on a page drawing `StaffBarModeration`, which carries no admin pill. A moderator's browser cannot invalidate an admin's cache; adding the call would be a control that looks like one and does nothing.

### It is DRIVEN, and the control is the same tree one edit apart

| arm | mutation fired | `getOverview` refetched | pill |
|---|---|---|---|
| **branch** (with the invalidate) | 1 | **YES** (1 → 2) | **5 → 4** |
| **control** (invalidate removed, nothing else) | 1 | **NO** (1 → 1) | **5 → 5** |

The control patches the same working tree so the two arms differ in exactly one edit, and restores in a `finally` — verified byte-identical afterwards. ⚠ **`git checkout` is not the restore here:** the fix under test was uncommitted, so a checkout would have wiped it along with the sabotage.

**`control-noinvalidate-deny-after.png` is the defect photographed:** the bar reads `Change requests 5` while the filter beside it says `Pending (4)` and four rows are listed. One frame, three numbers, one of them wrong.

**5 more arms, sabotage 5 of 5 caught by the arm named for each**, derived from the client tree so a third resolving mutation cannot arrive without an invalidate.

### ⚠ AND THE DRIVER'S FIRST RUN READ `5 -> 5` ON THE FIXED BRANCH

The modal's confirm button carries **the same word** as the detail button that opens it (`Decline`), so an unscoped deepest-match clicked the detail button again, reopened the modal, and reported two happy clicks **with no mutation fired**. The reading was indistinguishable from the defect under test.

The repair is that the driver now **counts the mutation request** and throws when it is zero — *"this run proves nothing either way"* — and scopes the confirm to `[role=dialog]`. **A driver that cannot tell "the fix failed" from "I never pressed the button" is not an instrument.** That is the third time tonight a fixed wait or an unverified action produced a confident wrong reading; each one is recorded above rather than tidied away.

## 5c · THE SECOND REVIEW FOUND TWO MORE, AND THE FIRST IS THE ONE WORTH KEEPING

**Verdict: pass with two findings.** Both taken.

### ⚠ Finding 1 — `retry: false` reached a page it was never about

The hook carried `retry: false`, copied from `useCrewState` where it is right for a different reason: that query answers `NOT_FOUND` outside a flag scope, so retrying spends three round trips rediscovering a permanent no.

**`retry` is a FETCH-level option.** TanStack resolves it from the **last observer to set options on the query**, not per observer the way `staleTime` works. On `/admin/overview` this hook and the page observe the **same key**, and the bar renders as a child of the page — so `retry: false` landed last and **stripped the page's three default retries**. One transient blip on Overview's 30s poll, which `main` absorbs silently, would have drawn *"The dashboard could not load."* over a dashboard still showing live data.

It bought nothing: the non-admin round trip is already prevented by `enabled`.

⚠ **The general shape is worth more than the line, and it corrects a sentence in this document.** §2 says *"on Overview it costs nothing — same query key, same request."* That is true of COST and **not of behaviour**: **sharing a query key shares more than the request.**

**The arm is aimed at the class, not the instance.** It does not ban `retry` by name — it holds the options object to exactly the two that are observer-scoped (`enabled`, `staleTime`), so any fetch-level option reddens it and has to be checked against every consumer of the key first. Sabotage 3 of 3: `retry: false` returning, a *different* fetch-level option (`networkMode`), and a key going missing — the arm is an equality, not a subset test.

### Finding 2 — a comment this change made false, left standing

The note above `<CrewWorkingNow>` still said `now` comes from *"the same ticker the 'checked' stamp uses"* — **the stamp this change deleted.** Corrected in place with the reason kept.

⚠ **That is the THIRD comment in one change asserting something the tree no longer held** — after the `staleTime` sentence and the index-arm claim. All three were caught by an instrument or a reviewer rather than by re-reading, and the pattern is one thing: **a comment written from what the code was about to do, never re-read against what it does.**

## 6 · The law-7 class sweep

**Two classes, swept mechanically over every staff page.**

**Class A — a page states its own freshness while the shared frame also states it.** Every page passing `refreshControls` was scanned for an elapsed-time or "last updated" statement in its body. **Population: one, and it is fixed.** All other hits are inside comments. `AdminOverview` is the confirming sibling: its `Data as of …` footer was already deleted for the same reason (brief 07 §9).

**Class B — a control whose LABEL names a period its timer does not use.** ⚠ **Three siblings found, all filed, none fixed here** — every one is inside the three pages #415 explicitly scopes out:

| where | what |
|---|---|
| `AdminAuditLogs.tsx:66` | `getAuditStats` polls at **60000** under a switch labelled `AUTO 30s` |
| `ModeratorDashboard.tsx:109` | same shape, same 60000 |
| `AdminOverview.tsx:54` | `REFRESH_INTERVAL_MS = 30_000` restated locally instead of importing `STAFF_REFRESH_INTERVAL_MS` — a third copy of one number |

These are **weaker instances than Crew's**: the label is true of each page's principal reader and understates one auxiliary one, where Crew's label was over its only reader and so was unambiguously wrong. Fixing them means either changing his words or changing a poll rate — a decision, not a repair — so they are carded rather than taken. They belong with the promotion pass that converts those three inline pages, which is where the toast copy and intervals converge.

---

## 7 · What else moved, and why

- **`section05-guard.test.ts`** — three arms moved, and one of them was **written to go red on this exact day**: *"this arm goes RED the day #415 lands, which is the point: that shift must delete Crew's inline line in the same commit."* It fired, and the line came out in the same commit. The other two are populations: 7 → 8.
- **`section08-guard.test.ts`** — ⚠ an arm titled *"the tab is still absent when crew.getState is not ok"* was pinning the string `{ live: true }`, which is a fact about **polling** and not about the tab gate it is named for. It would have gone red over a change §7 does not forbid while never having checked the gate it defends. **It now asserts the gate itself** — visibility from `isSuccess`, the nav gate asking with no options, and `live` being opt-in.
- **The token guard.** `#415` is a valid three-digit hex and a `describe` title is a string, so five titles read to `token-guard.test.ts` as colour literals on a guarded staff file. **The carve-out was deliberately not taken** — exempting a whole file to spare four characters blinds the colour guard to everything else in it — and the titles say `card 415`, with the `#415` reference in comments the guard strips, which is the guard's own documented prescription.

---

## 8 · Checks

- `pnpm check` — exit 0
- `pnpm test` — **11,173 passed, 0 failed** (was 11,151 — **+22 arms**)
- `pnpm architecture:check` — OK · Atlas regenerated: **998 modules**, 280 procedures, 288 findings (0 error)
- `pnpm capability:check` — OK, 59 doors, 0 error
- script guards (`scriptExitDiscipline`, `scriptConnectionDiscipline`) — 18 passed
- Browser drive — 7 discriminating readings × 2 arms, both themes, 12 frames

**Fixture rows:** five `change_requests` rows written to the **dev** database only, titled `#415 drive fixture N`. The seeding script refuses any database that is not dev (`:52008`), because five fake moderator requests in production would put a `5` on his real bar.
