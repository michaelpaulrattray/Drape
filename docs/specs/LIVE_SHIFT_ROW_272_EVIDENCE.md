# #272 — the live shift row: what was built, and what was driven

**Card:** #272, founder-written, `urgent`, and named SECOND in `PROGRAM.md`'s
founder-ordered run order after section 02 (#271 discharged by foreman-117).

**Founder, 2026-08-30, verbatim:**

> *"yeah because thats an issue like if my shifts are running and i have no idea
> what they are working on or doing thats dangerous"*

and, immediately before:

> *"how was i meant to be aware of these 77 if i never asked you?"*

---

## 1. What changes for him

His Crew page gets one strip at the very top, above the program banner, that
says **what a shift is doing while it is doing it** — the card number and
title, one sentence of intent, which seat, what kind of work, when it started,
and the branch. Under it, the last three shifts with how each ended.

It arrives **without a deploy**. That is the whole point: `crew-briefing.json`
ships inside the bundle, so it reaches him only when a shift pushes — at the
END of a shift, if at all. Its `shift` field names the last shift to write it,
never the one that is running. So today the page describes the previous session
while the current one edits his product, and the way he found a running shift
was by noticing its browser window on his screen.

**Worked example.** At 16:51 this shift opened its own row. Within a minute his
page read:

> **WORKING NOW** · live
> **#272 · He cannot see what a shift is doing while it runs**
> A live shift row read from the database, so his page names what is running.
> foreman-118 · foreman · the focus · started 4 min ago · `feat/272-live-shift-row`

Had that said *"#203 · retire the wardrobe path"* — a road he has ruled deleted
— he could have stopped it at 16:52 instead of reading about it at 06:00.

---

## 2. The four states, each DRIVEN and photographed (working law 1, law 6)

Not asserted from the source. Each state was produced in the dev database, the
page reloaded, and the strip read and photographed.

| State | Screenshot | What it says | Proven |
|---|---|---|---|
| **Running** | `272-working-now-running.png` | card, intent, seat, branch, `live` dot | live row, 4.0 s to paint |
| **Stalled** | `272-working-now-stalled.png` | *"Stalled — this shift has not checked in for over an hour…"*, red border, **no** live dot | heartbeat set 9 h back |
| **Nothing running** | `272-working-now-idle.png` | *"Nothing running."* | all runs closed |
| **Not live yet** | `272-working-now-dark.png` | *"Not live yet"* + the ceremony command | table renamed away |

**The state driver is `scripts/_drive-272-states-disposable.mts`** and it
restores explicitly; the dev database was returned to run #1-open afterwards
and the restore printed its rows back.

### The two readings that matter most

**(a) "Not live yet" is a different sentence from "Nothing running".** Those two
look identical in a bare array and mean opposite things — the instrument is dark
versus the team is idle. `crewShiftRuns.ts` returns `{ available, runs }` rather
than a list for exactly this reason.

**(b) With the table absent, the REST OF HIS PAGE SURVIVED.** Measured in the
same drive: `The program` section present ×1, **5 reply boxes still rendered**.
`crew.getState` is the one call the whole Crew tab makes, so a reader that threw
on an absent table would have taken his briefing, his replies and his reply box
down with it in order to report that a status strip was missing. The reader
rescues MySQL's `ER_NO_SUCH_TABLE` **alone** and still throws on everything
else, so a dropped connection cannot hide in the same silence.

### Colour was measured, not eyeballed

The screenshots show colour fringing on the text. It is ClearType subpixel
rendering, not a palette break — computed styles read
`rgb(10,10,10)` / `rgb(68,68,68)` / `rgb(153,153,153)`, border `rgb(229,229,229)`.
The one non-monochrome value is the stalled border, `rgb(192,71,58)` = `#C0473A`,
which is the house error ink `CrewProgramBanner` already documents as the single
sanctioned exception. **The strip matches its neighbours' hardcoded light
palette** — the Crew tab is a single-theme surface today (`AdminCrew` sets
`bg-[#EBEBEB]` directly), so this adds no theme decision.

### The neighbour was measured too

The program banner keeps its full 720 × 2085 box with the strip above it, and
the section order reads: **Working now → The program → Needs you → For your
eyes**.

⚠ The full-page screenshot behind that reading is **deliberately not committed**:
the Crew page is ~2,400 px tall and the PNG came to 8.8 MB, which is not a thing
to carry in the repository forever for one ordering check. The four strip
screenshots above are 13–28 KB each and are committed. The ordering and the
banner's box are quoted as measurements instead.

---

## 3. ⚠ It overrides a stated design principle, and that is declared

`0054_crew_replies.sql` — the migration this one sits beside — rejected this
exact shape in as many words:

> *"A night shift writing production rows outside deployed code is the class of
> direct production change `CLAUDE.local.md` reserves for the founder … So each
> writer keeps the road it already owns."*

**That reasoning was right about the BRIEFING, and the briefing keeps its road.**
What #272 measured is a property the briefing road cannot shed: it arrives on a
deploy. A live row cannot travel it.

So the override is taken deliberately and narrowed as far as the shape allows:

- **One table wide.** The two writers name `crew_shift_runs`, issue no DDL and
  never `DELETE`.
- **His half stays untouchable.** `crew_replies` is unreachable from the shift
  road exactly as before — `crew-read-replies.mts` is still one SELECT.
- **It owns nothing that matters.** No user data, no bytes, no money, no
  credential. The worst a corrupt row can do is tell him the wrong thing about
  the team, which is the failure he has today.

**The narrowing is a control, not a promise** (`server/crewShiftWriterBoundary.test.ts`,
23 arms): it reads the writers' actual bytes and reddens on a second table in a
write statement, on DDL, and on a DELETE.

### ⚠ That guard caught itself twice while being written, and both are recorded

1. **It went red on the real scripts** for naming `crew_replies` in a *docblock*
   and `users` in the existence-reader's *control query*. A substring test over
   raw source would have left two options: delete the explanation, or delete the
   test. Comments are stripped now, and the question asked is *"does a WRITE
   STATEMENT name another table"*.
2. ⚠ **Then it passed while seeing nothing at all.** The writers build SQL in a
   template literal, so a quoted identifier reaches the file as `` \` `` —
   backslash, backtick — and a character class without the backslash stopped
   dead. `writeTargetsIn` returned `[]` for both scripts, and
   `expect(stray).toEqual([])` was green **because the reader was blind**. Fixed,
   and pinned by an arm that asserts the reader **finds** the real writes before
   its silence counts for anything. *A reader that can only say "no" is not a
   reader.*

---

## 4. Stalled is derived, never stored

A shift that dies cannot write that it died — so no `status` column could ever
report the one case #272's bar is about. `shared/crewShiftState.ts` derives it
from two timestamps: `endedAt` set ⇒ finished; heartbeat inside the hour ⇒
running; outside it ⇒ **stalled**. One owner, shared by server and client, so
the two can never disagree about what stalled means.

The window is **his number** — *"neither updated nor stamped for an hour"* — and
`now` is a parameter rather than a mocked clock, so the stalled arm is driven
directly (working law 3). The boundary is asserted **against the constant**, not
against a literal, so moving the window cannot leave a test passing about the
wrong thing.

No heartbeat *process* was added: that would be a new persistent process, which
`PROGRAM.md` makes a founder-announced act. The shift's own `--note` carries it.

---

## 5. The write road, driven end to end on dev

| # | Drive | Result |
|---|---|---|
| 1 | open a run | `OPENED — run #1: foreman-118 (foreman, focus) on #272` |
| 2 | `--note` heartbeat | `NOTED`, branch recorded |
| 3 | second open run | ⚠ **warns**, listing the open run and how to close it |
| 4 | close newest open | `CLOSED — run #2 (relay-test): shipped · PR #280` |
| 5 | bad `--seat` | `REFUSING: --seat "captain" is not one of: foreman, janitor, …` |
| 6 | bad `--kind` | `REFUSING: --kind "whatever" is not one of: focus, sidelane, …` |
| 7 | bad `--outcome` | `REFUSING: --outcome "maybe" is not one of: shipped, stopped, failed` |
| 8 | close a missing run | `REFUSING: no run #9999.` |
| 9 | close twice | `REFUSING: run #2 is already closed (…). Closing it twice would rewrite the record.` |

**Each refusal names its own bad value** rather than printing a generic
sentence — an arm that asserts its own reason.

Two defects were fixed by driving rather than by reading:

- **Timestamps printed as locale strings with a "UTC" suffix.** On this UTC+10
  machine the open row printed `16:51:53 GMT+1000 … UTC`. That is the ten-hours
  class `scripts/lib/dbConnection.mts` carries an incident about, wearing the
  letters UTC. Both writers print `toISOString` now.
- ⚠ **Neither writer said WHICH WORLD it wrote to**, and this is the silent
  failure that matters most here: the page #272 exists for is PRODUCTION, and a
  shift that opens its row against dev has done everything right, seen a success
  message, and left his page saying *"Nothing running"* for a whole shift.
  Both now print `world: PRODUCTION · …` or `world: DEV · …`, keyed on whether
  `MYSQL_PUBLIC_URL` answered.

---

## 6. ⚠ ONE THING IS HIS TO DO — one command

The table exists in **dev**. Production takes it by ceremony, and a
production-database migration is a founder act (`CLAUDE.local.md`):

```
railway.cmd run --service MySQL -- npx tsx scripts/ceremony-crew-shift-runs.mts --production
```

It is idempotent, proves its existence-reader against a control table before
believing a negative, replays the migration file rather than retyping the DDL,
and reads every column back — refusing a surplus column as a finding.

**Until he runs it, nothing breaks and nothing is lost.** The strip says *"Not
live yet"* and names the command (photographed above); `crew_shift_runs` sits in
`DECLARED_BUT_UNMIGRATED` so the deploy rite reports a known absence rather than
a finding; and `crew-shift-start.mts` refuses with the reason instead of writing
into the dark. The ceremony's last line tells him to delete the exception, and
that line moves **in the same commit as the pin** in
`server/schemaConformance.test.ts` — `crew_replies` reddened main for exactly
that mistake and the pin's own docblock says so.

---

## 7. Checks

| Check | Result |
|---|---|
| `pnpm check` | **exit 0** |
| `server/crewShiftState.test.ts` | 10 passed |
| `server/crewShiftWriterBoundary.test.ts` | 23 passed (incl. 8 positive controls) |
| crew + conformance + atlas suites | **109 passed, 0 failed** (8 files) |
| `pnpm architecture:check` | **OK** — fresh, schema-valid, deterministic, secret-free |
| `pnpm capability:check` | **OK** — 59 doors, 62 corpus rows, 0 error |

⚠ **`pnpm test` whole-suite is red on this machine for #249's reason** (untracked
disposables breaching exit discipline, none of them from this shift). CI is the
authority, as the previous two shifts also recorded.

---

## 8. What is deliberately NOT here

- **No streaming logs, no progress bar, no per-file activity.** #272 puts all
  three out of scope: *"He does not need to watch it work; he needs to know what
  it is doing and be able to stop it"* — which he already can, via `.agents/STOP`.
- **No `crew.shiftRun` mutation.** The server READS these rows and never writes
  them; a mutation appearing later would break the split above and needs to say
  why.
- **#277's switch is not in this PR.** `workKind` carries `background` ahead of
  it — declared in migration 0055's header, because adding the column later
  costs him a second ceremony and adding it now costs one varchar.

## 9. The bootstrap note

This shift wrote its own start-of-shift record **by hand**, in the mailbox,
because the mechanism that would have written it is the thing being built. It is
the last shift that has to.
