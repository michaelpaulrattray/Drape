# When does a scratch working directory stop being needed?

**The rule run 16 owed to run 17.** Written 2026-10-27 (Janitor patrol #17).
Run 16 left it as an instruction rather than a document: *"`drape-scratch` needs
its manifest rule written by whichever run first finds a file past the floor
there — on today's dates ~2026-10-22."* This run is that run.

**What a customer sees: nothing.** This is about the machine the team works on.

Its sibling is [`JANITOR_BACKUP_RETENTION.md`](JANITOR_BACKUP_RETENTION.md), and
the method here is deliberately the same one: **a check, never a date.**

---

## What the tree actually holds, measured before the rule was written

`C:\Users\Admin\drape-scratch` — **2,951 files / 3,268 MB** across 38 working
directories and 27 loose files (run 16: 1,618 files / 2,015 MB, so it is growing
by roughly 600 MB a week). **2,806 files / 3,161 MB are past the 7-day floor.**

⚠ **It is NOT a cache tree, and that is the whole reason it needs its own rule.**
`%TEMP%\drape-*` holds machine-written caches a generator can rebuild; this holds
**court output — renders, strips and logs from paid measurements**, the artifacts
behind verdicts his eye closed. `relay-801r2`/`r3`/`r3b`/`w` (1,133 MB) is the
#801 engine court; `relay-fangs` is 492 MB of frames; `relay-court-waist` and
`relay-waist-b` are the waist court. Working law 1 is the reason a floor alone
cannot govern it: **reports are claims, artifacts are facts**, and these are the
artifacts.

⚠ **And it is LIVE while a seat is running.** Measured during this run:
`seat1-2616` was written at **2026-10-27T03:53Z**, seconds after this patrol
opened its row, by a builder seat working beside it. A sweep keyed on age alone
would have deleted a running seat's working directory.

## The rule

> **A scratch working directory expires when (1) it is past the 7-day floor,
> (2) its anchor resolves to a CLOSED card, and (3) what it holds is provably
> recoverable elsewhere. Anything that fails any of the three is KEPT, with the
> reason printed beside it.**

Every directory's name carries its own anchor — `relay-2583` → card #2583,
`seat1-2609` → #2609, `repair-2590` → #2590 — so the population is **derived
from the names and the queue**, never from a second list somebody maintains
(working law 4).

### The four dispositions, and it fails CLOSED

| disposition | test | action |
|---|---|---|
| **LIVE** | inside the floor, or named by an open shift row or a running process | **keep** — never touched |
| **KEEP-OPEN** | the anchor resolves to an **open** card | **keep** — it is that card's evidence |
| **KEEP-UNREADABLE** | the name carries no resolvable anchor | **keep and report** — never delete on a guess |
| **EXPIRED** | past the floor **and** anchor closed **and** recoverable elsewhere | eligible, and still needs clause 3 below |

⚠ **Clause 3 is the one that does real work, and it is not satisfied by a card
merely being closed.** A court's verdict is recorded in the card, the log and
sometimes `CLAUDE.md`; the **frames** are recorded only if they were uploaded —
`scripts/crew-upload-eye-frame.mts` puts an eye frame in the bucket, and a card
can carry posted images. A directory whose renders went to neither is **the only
copy of the artifact behind a recorded verdict**, and law 9 (*his eyes are king;
frames go in front of eyes*) is why that is not disposable because a card closed.
**Unverified recoverability reads as NOT recoverable.**

## ⚠ And the rule has an action gate, because the sweep buys almost nothing

This is a measurement rather than a preference, and it is why run 17 wrote the
rule and swept **nothing** here:

> **C: has 2,977.8 GB free of 3,725.0 GB — 79.9% free.** The whole tree is
> **3.3 GB = 0.09%** of the volume; the set this rule would call expired today is
> **~1.9 GB = 0.05%.**

So deleting a closed court's frames is **irreversible, and buys five
hundredths of one percent of an empty disk.** Housekeeping is last in the
category order precisely because *"its work is deletion, which is the only kind a
gate cannot give back"* — and a deletion with no benefit on the other side of it
is the easiest version of that mistake to make, because it looks like diligence.

**So: the disposition is REPORTED every run, and acted on only with a reason —**
disk pressure, a card asking for it, or clause 3 verified for a named directory.
A reported set is never a surprise; a 3 GB tree on a 3.7 TB disk is not a problem
waiting to happen.

### What this does NOT license

- **It is not a licence to hoard.** The report is per-run and the totals are in
  the log, so the growth rate stays visible (600 MB/week today). If the trend or
  the disk changes, the gate opens on a number rather than on a mood.
- **It is not the `%TEMP%` rule.** Cache trees under `%TEMP%\drape-*` are swept
  on the floor alone, as runs 15–17 did (194 entries this run) — a rebuildable
  cache has no clause 3 to fail.
- **It says nothing about the in-repo `drape-scratch\`.** That is three loose
  machine-written files inside the repository and is ordinary root litter,
  governed by the manifest rule in the log.

## Run 17's disposition, as the worked example

| directory | disposition | why |
|---|---|---|
| `seat1-2616` | **LIVE** | written 03:53Z this run; #2616 open |
| `relay-2570r`, `relay-court-waist`, `relay-waist-b` | **LIVE** | inside the floor |
| `relay-2565`, `relay-2576`, `relay-2583`, `relay-2626`, `relay-2626-rulings`, `relay-2647` | **KEEP-OPEN** | #2565, #2576, #2583, #2626, #2647 all open |
| `relay-fangs`, `relay-layout`, `relay-loader` | **KEEP-UNREADABLE** | no resolvable anchor — 638 MB, and not guessed at |
| the remaining 25 | **EXPIRED-ELIGIBLE** | anchors closed, past the floor — **reported, not swept**, on the action gate above |
