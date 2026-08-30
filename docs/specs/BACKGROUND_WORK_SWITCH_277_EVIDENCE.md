# #277 — the background-work switch: what was built, and what was driven

**Card:** #277, founder-written, `urgent`, and named THIRD in `PROGRAM.md`'s
founder-ordered run order after section 02 (#271 discharged, #272 merged as
PR #282). Its hard prerequisite — the freshness pass — is done.

**Founder-ordered 2026-08-30, verbatim:**

> *"if the shifts have nothing to work on e.g they are not working actively on
> the main goal … it should have a toggle on the crew page showing bug fixes etc
> that can run outside of the main work so if i go to sleep i can toggle it on
> and the shifts will go ahead with bug fixes an stuff when waiting on me to make
> decision on the main stuff if im sleeping or whatever"*

---

## 1. What changes, and it is a real change rather than a surface for a rule

**Today, MAINTENANCE MODE is the DEFAULT** when no focus is confirmed
(`PROGRAM.md`, his law of 2026-08-25): with nothing named, shifts work
agent-detected bugs and inside-existing-behaviour improvements **on their own
judgement**.

**His order inverts that.** Background work becomes **OPT-IN, and the switch is
his.** Off — the ordinary state while he is awake and deciding — a shift with no
focus and no named side lane **stops**. On, it works the bounded list until he
turns it off.

That is **stricter** than what we have, and it guards a failure he named himself
(2026-08-25): *"we need to ensure if they are waiting a long time for me they
dont completly over engineer security or anything because they are bored."*
**Idle is a legitimate state for an autonomous team; inventing work is not.**

---

## 2. ⚠ The part that matters most: it is a CONTROL, not a documented rule

A switch whose only enforcement is a shift reading it and choosing to obey is
**exactly** the class `CLAUDE.md` catalogues at length — written, documented,
call site never added. So the enforcement is driven, with both a negative and a
positive control, on the real database:

| # | State | `crew-shift-start.mts --kind background` |
|---|---|---|
| 1 | empty store | ⛔ *"the master is off and no category is on."* |
| 2 | **he flips master + Bugs on his page** | ✅ *"background work is ON for: Bugs"* — run opened |
| 3 | master off, **Bugs still on** | ⛔ *"the master is off — Bugs is switched on, but the master gates everything."* |
| 4 | master on, no category | ⛔ *"the master is on but no category is."* |
| 5 | **switch table absent** | ⛔ *"the switch table does not exist in this world yet, which reads OFF (his bar)."* |

**Row 2 is the arm that makes the other four mean anything.** A gate that always
refuses is indistinguishable from a broken tool; this one opens exactly when he
opens it, and names the category he chose.

**Row 2 went through HIS road, not a shortcut** — a real click on the real
switch in the running app, through `crew.setWorkSwitch`, persisted, then read
back by the shift tool from the database. Shifts structurally cannot write those
rows (§4), so there was no other way to produce it.

### The honest limit, stated rather than dressed up

Three arms make this real: the gate above, the row recording `workKind` so a
bypass is **visible on his page**, and the shift reader printing a verdict.
Beyond that, enforcement is the shift running its own tools — **the same class
of control as `.agents/STOP`**. It is strong because the team is built to use
it, not because it is unbypassable. Claiming more would be a promise wearing a
guard's name.

---

## 3. Four panel states, DRIVEN and photographed (`docs/specs/evidence/277/`)

| State | What it says | Produced by |
|---|---|---|
| **Off** | *"shifts stop and write why they are idle"*, six switches off, five counts | empty store |
| **On** | *"On · changed just now"*, master + Bugs on | **real clicks**, verified after a full reload |
| **Master off, category on** | *"Some categories are switched on but nothing runs while the master is off."* | master toggled off |
| **Not live yet** | the ceremony command | both tables renamed away |

**`Security (0)` is drawn and remains switchable** — his bar in his own words:
*"it must not vanish, or he cannot tell 'nothing to do' from 'not offered'."*

⚠ **With both tables absent, the rest of his page survived** — measured in the
same drive: program section ×1, **6 reply boxes**, and **#272's Working now strip
still live**. Two independent degrading readers, one dark and one unaffected.
`crew.getState` is the one call the whole tab makes, so a reader that threw would
take his briefing down to report a missing panel.

---

## 4. Two tables, because there are two writers

`0054_crew_replies.sql` states the store's law: **split by WHO WRITES, and
neither writer can reach the other's road.**

| Table | Writer | Reader |
|---|---|---|
| `crew_work_switches` | **HE does** — `crew.setWorkSwitch`, an `adminProcedure` with his session | shifts, **read-only** |
| `crew_queue_counts` | shifts, mechanically from the queue | his page |

⚠ **A shift that could write his switches could switch its own permission on.**
That is the sharpest boundary in this diff and it is pinned at the source:
`server/crewShiftWriterBoundary.test.ts` now carries a `READ_ONLY_TABLES` list,
and asserts that **no** shift script — including the one that reads them —
issues an INSERT/UPDATE/DELETE against `crew_work_switches`. Reading is allowed
and necessary; writing is a breach.

**One row per switch, not one row of columns.** A sixth category is a row and a
line in `shared/crewWorkSwitches.ts`, never a migration (which would be a
founder ceremony for what is conceptually a new label).

⚠ **OFF IS THE ABSENCE OF A ROW, so his bar holds by construction.** A truncated
table, a failed ceremony or a half-written insert all fail toward nothing
running, because **there is no default to get backwards**. The ceremony
deliberately **seeds nothing** for the same reason.

---

## 5. ⚠ The counts: what he asked for, what shipped, and the difference

His card is emphatic — *"THE COUNTS AND THE CATEGORIES ARE DERIVED FROM THE
QUEUE'S OWN LABELS — NEVER A SECOND LIST … A card relabelled in GitHub moves
category on his page without anyone touching the panel."*

**The categories are exactly that, and it cost nothing**: all five map to labels
that already existed — `bug`, `seat:warden`, `seat:machinist`, `seat:janitor`,
`seat:retro`. **Not one was invented for this feature.** Demonstrated live
during this build: filing #283 with `seat:retro` moved **Process from 6 to 7**
with nobody touching the panel.

**The freshness is not free, and the difference is declared rather than
glossed.** A live count needs the SERVER to call GitHub, which needs a
**repo-scoped token as a production environment variable** — a credential that
can read this private repository, living in the app's environment, plus an
outbound dependency on his admin page. **That is a founder-level decision about
a credential, not a shift's**, so it is named as the upgrade and not taken.

What shipped is a **derived cache with its age on screen**: a shift writes the
counts from `gh issue list`, and the panel says **"counted 14 min ago"**. That
does not break *never a second list* — that law is about lists somebody
**authors** (the standing-exceptions ranking rotted because a person typed it),
and no hand can edit these. What it is not is **instant**, and that word is on
the panel rather than buried in a docblock.

⚠ **A failed count writes `null`, never `0`.** They are opposite facts: zero
tells him toggling a category buys nothing, and a broken `gh` telling him zero is
the confident-wrong-number failure this card exists to prevent. A null is
skipped, the old row stands with its **older** timestamp, and the page shows the
age.

---

## 6. Four things caught by driving rather than reading

1. ⚠ **The gate's refusal misstated its own reason.** It always said *"no
   category is on"* — **false whenever the master was off and a category was
   on**, which is the commonest way he will leave it (one tap on the master
   stops everything without clearing five switches). A refusal that misstates
   why it refused sends the next shift to the wrong switch. Now four distinct
   branches, each driven (§2).
2. ⚠ **The writer-boundary reader called `openCount` a table.** MySQL's upsert
   ends `ON DUPLICATE KEY UPDATE openCount = VALUES(openCount)`, and a bare
   `\bUPDATE\s+(\w+)` reads the **column** as a table. The tempting fixes were to
   widen the allowlist with a column name — which would blind the arm to a
   genuine second table — or to stop using upserts. A negative lookbehind
   instead, **with its own control** asserting it still finds a real `UPDATE` in
   a file containing an upsert.
3. **`gh` does not need `shell: true`.** Driven both ways (3 rows either way)
   before choosing: the shell form emits node's DEP0190 on every run, and
   `crew-read-replies.mts` needs a shell only because `railway.cmd` is a batch
   file. A shift tool should print its answer and no noise.
4. **An uncalled export.** `isCrewWorkSwitchKey` was written and had no caller —
   the wire is validated by `z.enum` and both readers filter the array directly.
   **Deleted rather than given an invented consumer**, which would have been the
   sweep working backwards. Its absence is recorded where it was.

---

## 7. ⚠ ONE THING IS HIS — one command, and it creates BOTH tables

```
railway.cmd run --service MySQL -- npx tsx scripts/ceremony-crew-work-switches.mts --production
```

**One script for both**, deliberately: switches with no counts give him a toggle
over an unknown quantity, counts with no switches give him a number he cannot
act on. One command, not two.

It is idempotent, proves its existence-reader against a control table, replays
the migration file rather than retyping the DDL, handles the **partial** case (a
ceremony interrupted between the two CREATEs), reads every column back and
refuses a surplus one — and **reads back the UNIQUE index**, because without it
the `ON DUPLICATE KEY UPDATE` silently becomes an INSERT and the tables grow a
second row per key.

**Until he runs it, nothing breaks**: the panel says *"Not live yet"* and names
the command, the shift reader says background work is off, and the gate refuses.
Both tables sit in `DECLARED_BUT_UNMIGRATED`, and **their pin in
`server/schemaConformance.test.ts` moves in the same commit** — `crew_replies`
reddened main for exactly that mistake.

---

## 8. Checks

| Check | Result |
|---|---|
| `pnpm check` | **exit 0** (includes the uncalled-export sweep) |
| `server/crewWorkSwitches.test.ts` | 12 passed, positive control first |
| `server/crewShiftWriterBoundary.test.ts` | 32 passed |
| crew + conformance + atlas + script-discipline suites | **157 passed, 0 failed** (12 files) |
| `pnpm architecture:check` | **OK** |
| `pnpm capability:check` | **OK** — 59 doors, 0 error |

⚠ **`pnpm test` whole-suite is red on this machine for #249's reason** — six
untracked disposables breaching exit discipline, verified by name as none of
this shift's. CI is the authority.

---

## 9. What is deliberately NOT here

- **No live GitHub call from the server** — §5, and it is his decision to make.
- **No seeded rows** — off must remain the absence of a row.
- **No optimistic write on the switch.** Unlike the reply box beside it, a
  switch that flips instantly and silently reverts would tell him background
  work was off when it was on. It waits for the server's row.
- **No change to `PROGRAM.md`'s maintenance-mode law.** The switch now gates it
  in practice; rewriting his law is his act, and that is flagged on the card
  rather than done.
