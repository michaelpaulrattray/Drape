# The account menu's two badges — #416 evidence

**Shift:** foreman-188, 2026-09-03 AEST. **Card:** #416, `founder-ordered`.
**Money: zero.** No render, no text call, no credit. Production and dev reads only.

---

## His ask

> *"go with your reccomendation and the moderator pages should also have
> notifications which show any flags thats come up that need attention. in the
> profile drop down menu in the top bar next to admin and moderator the
> notification count should sit next to each also e.g admin 4 or moderator 6"*
> — 2026-09-01

## What was wrong

`UserCard` **declared** `adminCount` and `moderationCount`, rendered a pill for
each, and omitted at zero. `AppChrome` — its **one** call site — passed neither.
Both arrived `undefined`, both pills omitted, and **the badges had never once
shown a number.**

Nothing was broken on screen. No test was red. It shipped looking finished.
Invariant 7 in its gentlest form: *written, styled, rendered, wired never.*

⚠ **Every absence-shaped assertion is green against that state**, which is why
every arm in `counts416-guard.test.ts` is written as a PRESENCE.

---

## The frames — law 6, both themes

| | |
|---|---|
| light | `docs/specs/evidence/416-account-menu-light.png` |
| dark | `docs/specs/evidence/416-account-menu-dark.png` |
| the card the badge agrees with | `docs/specs/evidence/416-flagged-card-dark.png` |

Driven at `localhost:3000` as **verify-bot (admin, id 823)** — deliberately not
the founder's account, so nothing in this drive touched his rows. Menu text read
back off the live DOM in both themes, identical:

```
Verify Bot · 442,535 credits · Owner
Settings · Members & invites · Billing & credits
STAFF
  Admin       5
  Moderation  1
Sign out
```

Both numbers are the dev database's own rows, not fixtures: **5 pending change
requests**, and **1 account flagged above 500 credits** (verify-bot, +750, of 8
scanned). The moderator page's own card says the same thing in the same sitting
— *"1 of 8 accounts scanned are above 500 credits."*

---

## What each number is

### Admin = pending change requests, and nothing added to it

The **same value** as the `Change requests` tab pill (#415) and Overview's
attention card, all descending from the single `getGovernanceMetrics` statement.

⚠ **Not "+ unanswered Crew cards"**, which is what `00b-chrome-and-menus.md` and
the retired `01-staff-shell.md` proposed. #416 itself rules on this — *"three
surfaces, one source"* — and adding a second term would have made the menu the
one surface of the three that disagrees. A menu saying `4` over a bar saying `3`
is worse than a menu saying nothing.

### Moderation = flagged referrals + flagged credit discrepancies

Both are things a moderator must **act on**, and both come off procedures the
moderator surfaces already call. No new query was added; #416 §4 put one out of
scope in those words.

⚠ **It does NOT count audit entries above `info` in 24h**, which is what both
briefs proposed. That line was written **before either flagged surface existed**.
An audit log is a RECORD — it fills every day whether or not anything is wrong —
so a badge counting it is never zero and therefore says nothing, which is the
same defect as a badge that never shows a number at all. The proposal is treated
as a proposal, per the card's own instruction, and the departure is written into
the hook's docblock rather than left to be rediscovered from a diff.

**This is the recommendation #416 put to him for acceptance.** It is built as
recommended; **one line reverses it** if he wants audit volume instead.

---

## ⚠ The threshold, and the one thing a reviewer should push on

`FlaggedDiscrepanciesCard` lets a moderator pick any of six thresholds
(100 · 250 · 500 · 1000 · 2000 · 5000, default 500). **A badge cannot ask a
question — it has to state a number.** So it counts at the default, and the
default moved out of the card into `flagThresholds.ts` so that the badge and the
card cannot each own their own `500`.

**Measured through the product's own reader, in both worlds, because they
differ:**

| threshold | production | dev |
|---|---|---|
| 100 | 1 | 1 |
| 250 | 1 | — |
| 500 | 1 | **1** |
| 1000 | 1 | — |
| 2000 | 1 | **0** |
| 5000 | 1 | **0** |

So the divergence is **not hypothetical — dev shows it today.** Driven at the
running app: with the card set to `2000+` it reads *"No accounts need looking at.
Nothing above 2000 credits across 8 accounts"* while the badge still reads `1`.

**That is correct, and it reads correctly**, because the card's empty state names
its own lens. The badge is the count at the attention threshold; the chips are a
lens over it — the same relationship an unread count has to a search box. What
must never happen is the two disagreeing about what *the default is*, and that is
the part the shared constant actually guarantees.

---

## ⚠ What he will see, and it is worth him knowing before he opens the menu

**On production the Moderation badge will read `1` for him today**, and clicking
through shows **his own account**, flagged at **−11,600**.

The flag is honest — the scan is list-only since #119, it freezes nobody, and
that number is real. But it has **moved a long way** from what the record says:
`discrepancyQueries.ts`'s own docblock records **+1,050** on his account on
2026-08-26 and *"every other production account reads 0 under this formula."*
Read today: **−11,600**, sign flipped, magnitude eleven times larger.

**Filed as its own card** rather than chased here — it is a measurement about the
money-adjacent reconciliation formula, not about a menu badge. But this wiring is
what puts it in front of him, so it is named here rather than left to surprise him.

---

## The arms — 13, and 11/11 sabotages red on their own arm

`client/src/features/staff/counts416-guard.test.ts`.

⚠ **The arithmetic is driven, not grepped.** `pnpm test` runs with no DOM by
config, so the hook cannot be rendered — which is exactly why the part that can
be wrong was pulled out into `readFlagCounts` and is driven with **non-zero
counts**, as #416's bar demands. Grepping the hook's source for a `?? 0` would be
a guard on a spelling.

The three ways to get it wrong, each with an arm:

- reading the referral count off the returned **page** (the hook asks for one
  row) instead of the procedure's unbounded `COUNT(*)` — a badge silently capped
  at a page size;
- reading the discrepancy count off **`scannedCount`**, which is how many
  accounts were EXAMINED and is never zero on a live database;
- dropping the zero fallback, which totals **NaN** — and a NaN fails the
  greater-than test, so the pill omits and **looks exactly like the correct
  loading state**. It would only show itself on the day the badge mattered.

**Sabotage driver:** `scripts/_416-sabotage-disposable.mts`, committed, so
"11/11" can be re-run by somebody other than its author.

```
baseline: GREEN
RED  the call site stops passing adminCount (the original defect, half of it)
RED  the call site stops passing moderationCount (the original defect, other half)
RED  the referral count is read off the returned page instead of the unbounded total
RED  the discrepancy count is read off scannedCount instead of the flagged accounts
RED  the zero fallback is dropped, so an unanswered query totals NaN
RED  a FETCH-level option is set on a key another surface observes
RED  the hook writes its own threshold literal instead of importing the shared one
RED  the card grows a second declaration of the default
RED  the default is moved off the chip row, so no chip can show as pressed
RED  the composer starts fetching for itself, becoming a second reader of the admin count
RED  the gate narrows to admins, so a moderator's badge silently never fills
RED 11 / 11  ·  NO RED 0  ·  WRONG ARM 0
```

---

## ⚠ No guard arm was moved, and that was a design constraint rather than luck

`counts415-guard.test.ts` derives from the client tree that **exactly one module
both names `pendingChangeRequests` and calls tRPC** — the arm #415 was asked for
in those words, so a second reader of the admin count cannot appear without
reddening the suite.

`AppChrome` calls tRPC for credits and profile. **Reading the field there would
have tripped that arm**, and the tempting repair is to widen the arm's expected
list — which turns a derived guard back into the hand-kept list it replaced.
#414's card names the same trap.

So `useAccountMenuCounts` composes hooks and issues **no query of its own**. The
field is named in a module with no `trpc.` in it. `counts415-guard`'s 22 arms
pass **untouched**.

---

## The #415 defect that was NOT repeated

`useModeratorFlagCounts` sets **only observer-scoped options** (`enabled`,
`staleTime`). `retry` and its family are FETCH-level — TanStack resolves them
from the *last observer* on a key. `getFlaggedUsers` is observed by
`FlaggedDiscrepanciesCard` at this same key, and this hook mounts inside the page
that renders it, so a fetch-level option here would silently change that card's
behaviour. That is the defect the gate review caught on PR #456; it has an arm
here, and a third option key reddens it on purpose.

**The shared key is also why the cost is nothing where it matters:** on the
moderator dashboard the badge and the card are one request. Elsewhere it is one
call per mount, held 30s.

---

## What was NOT built, and why — the card's third item

#416 §4 also asks for *"the moderator's flags as attention cards on the
moderation surface."* Read at the code before building anything:

- **Flagged discrepancies already have one.** `FlaggedDiscrepanciesCard` sits at
  the top of `ModeratorDashboard`, always rendered (not tab-gated), and links
  through to the account's investigation. Brief 09 §5 built it as *"the
  moderator's equivalent of Overview's needs a human"*. **Nothing to add.**
- **Flagged referrals have a tab, and no population.** `referrals` holds
  **zero rows, all time, on production AND dev** — not zero flagged, zero
  referrals. A second attention card there would be a surface that has never had
  anything to show.

**Recommendation, for his word:** leave the referrals tab as the road until
referrals have a population. The badge already counts them, so the moment one is
flagged he gets a number; what is deferred is only a second card above a list
that is currently the empty set. **One line reverses this.**
