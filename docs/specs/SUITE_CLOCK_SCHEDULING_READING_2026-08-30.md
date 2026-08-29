# #233's SCHEDULING HALF — the reading, and why the global raise stays refused

foreman-109, 2026-08-30. Companion to `ATLAS_SUITE_TIMEOUT_DIAGNOSIS_2026-08-30.md`
(foreman-107, the *why two minutes* half) and
`ATLAS_SUITE_TIMEOUT_REPAIR_2026-08-30.md` (foreman-108, that half's repair).

**Nothing here is a product change.** No customer-visible behaviour, no money
path, no schema, no migration, no flag.

---

## 0. The card had two halves and only one was answered

#233 records that the full suite goes red on TIMEOUTS under machine load, and
that *"a different second suite falls each run"*. foreman-107 diagnosed and
foreman-108 repaired the Atlas half. The scheduling half was explicitly left:

> *"`vitest.config.ts` still sets no `testTimeout` and no pool limits, so
> everything without its own clock runs on the 5 s default. Removing ~90 s of CPU
> burn should make the 'different second suite each run' rarer, but **that is a
> mitigation and no reading was taken to claim it.**"*

This is that reading.

⚠ **The card had also CLOSED, which nobody knew.** PR #248's body read
`Closes #233 (the "why does it take two minutes" half — …)`; GitHub ignores the
qualifier and closed the whole card at `18:51:20Z`, one hundred seconds before
foreman-108's own comment saying *"THIS CARD STAYS OPEN"* landed on it, and about
six hours before its handoff asserted the same thing. Reopened, and the class
swept — see §6.

---

## 1. Instruments first (working law 2)

Three readers were built for this and **two of them were wrong before they were
right**, which is the reason each now carries controls that run before any
finding prints.

A test's clock comes from **four** shapes in this tree:

| | shape | example |
|---|---|---|
| 1 | trailing argument | `it("…", async () => {…}, 60_000)` |
| 2 | describe options | `describe("…", { timeout: 60_000 }, …)` |
| 3 | `vi.setConfig` | `vi.setConfig({ testTimeout: 60_000 })` |
| 4 | the shared helper | `allowColdImports()` |

- **Reader v1** knew shape 1 and wrote the literal as `\d{4,}` — which matches
  nothing in a repo that writes `60_000` with a numeric separator. It reported
  **"NONE (5s default)" for all 656 files**, including the two the card itself
  names as carrying 60 s and 120 s clocks. A reader that cannot fail.
- **Reader v2** fixed the separator and then placed four `atlasMergeDriver` tests
  measured at 6.5–9.5 s on a 5 s clock, **passing** — an impossible reading, and
  what exposed shape 2.
- **Reader v3** carries one control per shape plus a negative control, reading
  each control file from DISK rather than from the report (shape 3 lives only in
  `*-db.test.ts` suites, which skip for want of `TEST_DATABASE_URL` and therefore
  contribute no timed test — a control that cannot run is not a control).

A fourth control caught an assumption of my own: the sweep detector expected
`scriptExitDiscipline.test.ts` to carry 60 s like its sibling. It does not. That
became finding §4.

---

## 2. The measurement

Two full-suite runs, **the same 10,302 tests paired one by one**:

- **quiet** — nothing else running.
- **loaded** — eight busy CPU loops stealing cores from ~19 vitest forks on 20,
  which is the condition the card blames (*"the founder using his own computer in
  the evening can turn the team's suite red"*).

### 2a. Contention does not slow the suite broadly. It slows a thin tail, hard.

| | |
|---|---|
| bare-default tests finishing under 1 s **even loaded** | **9,950 of 9,988** |
| median contention factor (quiet → loaded) | **0.89×** — most tests got FASTER |
| p90 / p99 / max | **1.29× / 5.86× / 6.39×** |
| bare-default tests exceeding 4 s under load | **ONE** |

The median below 1.0 is not noise: with eight cores taken, vitest schedules fewer
forks concurrently and each gets cleaner CPU.

### 2b. The blow-up is inversely related to how slow a suite already is

| suite | quiet | loaded | factor |
|---|---|---|---|
| `r7-evidence-package-e1-contract` | 0.6 s | 4.3 s | **7.2×** |
| `clientInputCaps` | 0.8 s | 5.0 s | **6.4×** |
| `castingV2CssEmitters` | 2.9 s | 18.0 s | **6.1×** |
| `atlasMergeDriver` | 10.3 s | 49.6 s | 4.8× |
| `scriptGuards` | 14.6 s | 17.1 s | 1.2× |
| `architectureAtlas` | 23.0 s | 31.0 s | 1.3× |

What contends is fixed startup and transform cost, not the test's own arithmetic.
So one number per family gives the quick suites their ~6× and the slow ones their
~2× — **which is exactly why a single global default cannot serve both.**

---

## 3. ⚠ The verdict: fable-233 §5 was re-tested and it HELD

The tempting reading of §2 is *raise the default for everybody*. The numbers say
no: a global raise would buy a tail of two tests at the price of weakening what
"green" means for **9,950** that never come near it. `fable-233 §5`'s original
argument — *a logic test that hangs for thirty seconds is a defect, and the
default is what says so* — survives its own re-test, on a population it was not
measured against when it was written.

**The per-file opt-in is the right instrument and stays. Nothing global changed;
`vitest.config.ts` is untouched.**

### ⚠ And the quiet-run stopwatch is NOT the enrollment test

It does not predict the casualty. `clientInputCaps` had **4,166 ms of quiet
margin** — comfortably outside the fourteen tests nearest the ceiling — and fell
anyway, while `characterSheet`, which has the *smallest* quiet margin on the bare
default (646 ms), got **faster** under load (0.7×). Enrollment is by measured
casualty and by the shape of the work.

---

## 4. ⚠ Having a clock is not the same as having enough of one

The run taken to prove the first enrollments had worked **killed a file that was
already clocked**: `pathB-hardening` at **15,004 ms against its own 15,000 ms**.

Measured as UTILISATION — a file's slowest test ÷ its own clock — across all 25
clocked files, the population splits cleanly with nothing in the middle:

| utilisation | files | outcome under load |
|---|---|---|
| **67%** `pathB-hardening` | 1 | **FELL** |
| **51%** `pathB-completion` | 1 | survived at 74% of its clock |
| **≤48%** everything else | 23 | survived, most far under |

Both `pathB-*` files are 22 and 16 `await import()` calls apiece — family 1
exactly — carrying a hand-written `15_000` that **predated the helper and sat
BELOW the family's own 30 s.**

---

## 5. What shipped

`server/testing/coldImportTimeout.ts` → **`server/testing/suiteClocks.ts`**: the
module now holds more than one family, so its name said something untrue. Six
import sites updated; `allowColdImports()` and its 30 s are **unchanged**.

**New: `allowTreeSweeps()`, 60 s** — for a suite whose tests read the source tree
off disk. The value is **not new**: it is the repo's own precedent, already
hand-written in four places that all sweep the tree
(`scriptConnectionDiscipline`, `castingV2CssEmitters`, `atlasMergeDriver`,
`preCommitGate`). This states the reason once instead of a fifth time.

**Eight files enrolled. Every one has evidence of having actually gone red — none
on a stopwatch reading alone.**

| file | clock | the evidence |
|---|---|---|
| `capabilityAtlas` | tree sweep | timed out **3×** on #233 (foreman-98 r1; foreman-99 r1, r2) |
| `queueOrdinalDiscipline` | tree sweep | timed out **2×** on #233 (foreman-98 r2; foreman-99 r2) |
| `r7-evidence-ingestion-contract` | tree sweep | timed out on #233 (foreman-98 r3); **5.9×** blow-up here |
| `clientInputCaps` | tree sweep | **the casualty** — 5,016 ms vs 5,000 ms, from 785 ms quiet, **6.4×** |
| `scriptExitDiscipline` | tree sweep | law-7 sibling — sweeps the same directory as `scriptConnectionDiscipline`, which has carried 60 s since it was written |
| `phase-a-quota` | cold imports | timed out on #233 (foreman-99 r2); every arm is `await import()` |
| `pathB-hardening` | cold imports | **the second casualty** — 15,004 ms vs its own 15,000 ms |
| `pathB-completion` | cold imports | its sibling, at 74% of the same clock |

### The proof, driven rather than asserted

**Helper controls** — a purpose-built pair, run and then deleted: a 6 s test with
`allowTreeSweeps()` **passed at 6,014 ms**; the byte-identical test without it
**died at `Test timed out in 5000ms`**.

**At the real thing** — the fourth loaded run, all enrollments in place:
**2,942 files, 10,304 passing, 0 failed.** Three suites recorded durations that
would have killed them before this change:

| | loaded now | its clock before |
|---|---|---|
| `clientInputCaps` | **6,472 ms** | 5,000 ms |
| `pathB-hardening` | **15,924 ms** | 15,000 ms |
| `pathB-completion` | **12,664 ms** | 15,000 ms |

**Runs behind this record:** 3 quiet full runs (main tree, post-#248), 1 loaded
full run (main tree), 1 quiet + 3 loaded full runs (worktree). The two atlas
staleness reds in loaded run 3 were mine — edits made after a regenerate — and
are recorded rather than quietly re-run.

---

## 6. The record repair, and its class sweep (law 7)

**Class:** *a qualified `Closes #N` in a PR body closes the whole card anyway.*

The 25 most recently merged PRs were read. Three carry a closing keyword with a
qualifier; **#233 is the only live instance.** PR #213 is the safe form and is why
the class is not wider — it says *"Closes #211 and the law-4 half of #209 item
1"*, and because the second reference carries **no keyword**, #209 is correctly
still open.

**The rule going forward: a closing keyword takes the whole card. If half the
subject is staying, name the other issue without a keyword, or do not use one.**

---

## 7. What this does NOT claim

- **It does not claim the suite can never time out again.** It removes every
  member measured to have fallen, and states the utilisation rule that finds the
  next one. A clean loaded run is a floor, not coverage.
- **It takes no reading on `vitest.config.ts`'s pool limits.** The card names
  them; §2a says worker count is not the lever (the median went *down* under
  contention), so nothing was changed there and nothing is claimed about it.
- **The load model is synthetic.** Eight busy CPU loops are a stand-in for a dev
  server or the founder's browser. It reproduced the card's own symptom on the
  first try, which is the only evidence offered that it is representative.
