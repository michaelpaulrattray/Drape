/**
 * THE HEARTBEAT HAS A CALLER, AND THE WINDOW IS ABOVE A REAL SHIFT (issue #295).
 *
 * The founder opened his own page at 20:18 and read **"Stalled — … It has
 * probably died"** over a shift that had merged PR #294 at 19:46 and shipped
 * briefing edition 144 at 20:17 — one minute earlier. Three pieces of real work
 * sat inside the window the page reported as death.
 *
 * Two independent faults produced that, and this file guards both.
 *
 * # 1. THE MECHANISM WAS DESIGNED, DOCUMENTED, AND HAD NO CALLER
 *
 * `crew-shift-start.mts --note` updates `heartbeatAt` on the newest open run,
 * and its own docblock explains at length why that is deliberately manual. It
 * is right about the design. **Nothing ever called it** — not the standing
 * orders, not the runner, not another script — so `heartbeatAt` was written
 * once at open and never again, and every shift longer than the window read as
 * dead. `CLAUDE.md`'s invariant 7 exactly: *a control that is not invoked does
 * not exist*, and the third instance of it on this one feature (#286 was the
 * first two).
 *
 * ⚠ **The real call site is `.agents/foreman/prompt.md`, which is gitignored,
 * so no test here can ever read it.** That is the honest limit of this file and
 * it is why the repair is not only documentation: `crew-shift-close.mts` now
 * DETECTS a run that never checked in and exits 2 saying so. Every shift passes
 * through the close, so the omission announces itself on the path rather than
 * waiting to be noticed on his screen. The arms below pin that detector at its
 * source, because a detector that gets refactored away is the same defect
 * wearing next month's date.
 *
 * # 2. THE WINDOW WAS BELOW THE TEAM'S OWN WORKING RHYTHM
 *
 * One hour, chosen in #272 before any shift had been timed. Measured since over
 * **83 close-stamped runs, 31% ran longer than an hour** and the longest ran
 * 138 minutes. The arm below pins the window against that measured maximum
 * rather than against a literal, so a change back reddens and says why
 * (memory: *magic number pins the fixture* — assert the bar, not the value).
 *
 * # ⚠ THE POSITIVE CONTROLS ARE THE POINT
 *
 * Every source-reading arm here runs TWICE: once over the real file (must pass)
 * and once over a doctored copy carrying the defect (must FAIL). A grep that
 * cannot go red is the instrument this repository has been burned by five times
 * — working law 2, and `crewShiftWriterBoundary.test.ts` set the shape.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CREW_SHIFT_STALL_MS, hasEverCheckedIn } from "../shared/crewShiftState";
import { withoutComments } from "./testing/withoutComments";

const REPO = join(__dirname, "..");
const read = (relative: string) => readFileSync(join(REPO, relative), "utf8");

/**
 * Comments out, code only — `crewShiftWriterBoundary.test.ts`'s own helper, and
 * the reason is the same one it gives.
 *
 * ⚠ Both files below QUOTE the defect they forbid: the close script's docblock
 * explains the never-checked-in case by name, and the banner's docblock quotes
 * the old *"It has probably died"* copy so the next reader knows what changed
 * and why. Searching raw source would find those quotes and either pass on
 * prose or fail on history — the arm has to read what SHIPS.
 */
function code(source: string): string {
  return withoutComments(source);
}

/**
 * The longest run the team has ever recorded, in minutes.
 *
 * Provenance, so the number is re-derivable rather than remembered: the
 * runner's own `## Runner close-stamp` trailers in `.agents/mailbox/*.md`,
 * `exit:` minus `shift launched`, 83 completed runs spanning 2026-08-27 →
 * 2026-08-30. Distribution: median 47, p75 67, p90 88, p95 99, p99 115.
 *
 * ⚠ It is quoted rather than computed BECAUSE `.agents/` is gitignored — CI
 * cannot see the population, so a test that tried to recompute it would pass
 * vacuously on the machine that matters. A stale bar that is too LOW is the
 * safe direction here: the window must clear it, and shifts only get longer.
 */
const LONGEST_RECORDED_SHIFT_MINUTES = 138;

describe("the stall window clears a real shift", () => {
  /*
    THE ARM THIS HALF EXISTS FOR. At one hour the banner fired on 26 of 83
    runs — an alarm that is wrong a third of the time is one he learns to
    scroll past, and then the first one he believes is the false one.
  */
  it("is longer than the longest shift the team has ever run", () => {
    const windowMinutes = CREW_SHIFT_STALL_MS / 60_000;
    expect(windowMinutes).toBeGreaterThan(LONGEST_RECORDED_SHIFT_MINUTES);
  });

  /*
    AND IT IS NOT UNBOUNDED. A window of a day would never cry wolf and would
    also never fire on a shift that really died, which is the only thing it is
    for. The ceiling is a judgement stated out loud rather than a measurement:
    a dead shift discovered the next morning is a wasted night.
  */
  it("is still short enough to catch a dead shift the same night", () => {
    expect(CREW_SHIFT_STALL_MS).toBeLessThanOrEqual(4 * 60 * 60 * 1000);
  });
});

describe("did this run ever check in", () => {
  const started = new Date("2026-08-30T09:00:00Z");

  /* The open write stamps both timestamps from two `UTC_TIMESTAMP()` calls, so
     "identical" in practice means "within a tick". */
  it("a run whose heartbeat still equals its start has never checked in", () => {
    expect(hasEverCheckedIn({ startedAt: started, heartbeatAt: started })).toBe(false);
    expect(hasEverCheckedIn({
      startedAt: started,
      heartbeatAt: new Date(started.getTime() + 400),
    })).toBe(false);
  });

  it("a single `--note` minutes later is a check-in", () => {
    expect(hasEverCheckedIn({
      startedAt: started,
      heartbeatAt: new Date(started.getTime() + 12 * 60_000),
    })).toBe(true);
  });

  it("accepts the ISO strings mysql2 and tRPC both hand back", () => {
    expect(hasEverCheckedIn({
      startedAt: started.toISOString(),
      heartbeatAt: started.toISOString(),
    })).toBe(false);
  });

  /*
    ⚠ THE SAFE DIRECTION IS THE OPPOSITE OF `deriveShiftRunState`'s, and the
    difference is deliberate. An unreadable heartbeat reads as STALLED there,
    because the cost of that error is that he looks. Here it reads as CHECKED
    IN, because the cost of this error is accusing a shift of skipping a step
    on the strength of a broken read.
  */
  it("an unreadable pair does not accuse", () => {
    expect(hasEverCheckedIn({ startedAt: "not a date", heartbeatAt: started })).toBe(true);
    expect(hasEverCheckedIn({ startedAt: started, heartbeatAt: "not a date" })).toBe(true);
  });
});

describe("the heartbeat's mechanism is still wired", () => {
  const START = "scripts/crew-shift-start.mts";

  it("`--note` updates heartbeatAt on the newest OPEN run", () => {
    const source = read(START);
    expect(source).toMatch(/SET heartbeatAt = UTC_TIMESTAMP\(\)/);
    /* Scoped by the row's own state, never by a caller-supplied id — a shift
       that has to remember its row id eventually stamps somebody else's. */
    expect(source).toMatch(/WHERE endedAt IS NULL/);
  });

  /*
    POSITIVE CONTROL. The arm above is a grep, and a grep that cannot fail is
    the thing five entries in `CLAUDE.md` were written about. This is the same
    read over bytes with the heartbeat write removed; it MUST come back false.
  */
  it("and that reading can say no", () => {
    const doctored = read(START).replace("SET heartbeatAt = UTC_TIMESTAMP()", "SET intent = intent");
    expect(doctored).not.toMatch(/SET heartbeatAt = UTC_TIMESTAMP\(\)/);
  });
});

describe("a shift that never checked in is caught at its close", () => {
  const CLOSE = "scripts/crew-shift-close.mts";

  /*
    THE CALL SITE. This is the only place in the repository that can notice the
    standing orders' heartbeat step going missing again, because the orders
    themselves are gitignored. Three separate things have to survive together
    and each has its own reason:
  */
  it("reads the pre-write timestamps, judges them, and exits 2", () => {
    const source = code(read(CLOSE));

    /* (a) `heartbeatAt` must be SELECTED, so the verdict is snapshotted before
       any write. ⚠ The REASON changed with #1872 and the requirement did not:
       the UPDATE used to set this field to now, so a reader looking afterwards
       saw every run as disciplined and the pre-write read was the only road.
       The close leaves the field alone now, so this is belt and braces — kept
       because a snapshot cannot be invalidated by a later edit to the
       statement. It is asserted on BOTH branches, because the `--id` road is
       exactly the one a shift uses to close a DEAD run. */
    /* ⚠ The pattern tolerates COLUMNS BEING ADDED and refuses `heartbeatAt`
       being dropped, which is the fact it is about. It was the exact column
       list until #1349 added `cardRef` to both reads, and it reddened on a
       change that did nothing to the heartbeat — a guard that fires on its
       neighbours teaches a shift to edit the guard. */
    expect(source.match(/SELECT id, shift, seat, [^`]*heartbeatAt, endedAt/g))
      .toHaveLength(2);

    /* (b) the verdict comes from the shared owner, not a second copy of the
       rule living here (working law 4). */
    expect(source).toMatch(/hasEverCheckedIn\(/);

    /* (c) it must actually REPORT — a detector that computes a finding and
       swallows it is invariant 7 one layer deeper than the bug it replaced. */
    expect(source).toMatch(/process\.exit\(2\)/);
    expect(source).toContain("NEVER CHECKED IN");
  });

  /*
    POSITIVE CONTROLS, ONE PER CLAUSE. A single doctored copy would prove only
    that the arm notices SOMETHING; each clause is neutered separately so a
    green suite means all three readings can still fail.
  */
  it("and each of those three readings can say no", () => {
    const source = code(read(CLOSE));

    /* ⚠ GLOBAL, and the first version of this control was not. The SELECT
       appears on both branches, so a single string replace neutered one and
       left the other matching — the doctored copy passed the arm it was built
       to fail, which is a control that cannot say no wearing a control's
       clothes. */
    const noSelect = source.replace(/, heartbeatAt, endedAt/g, ", endedAt");
    expect(noSelect).not.toMatch(/SELECT id, shift, seat, [^`]*heartbeatAt, endedAt/);

    const noVerdict = source.replace(/hasEverCheckedIn\(/g, "alwaysTrue(");
    expect(noVerdict).not.toMatch(/hasEverCheckedIn\(/);

    const noReport = source.replace(/process\.exit\(2\)/g, "process.exit(0)");
    expect(noReport).not.toMatch(/process\.exit\(2\)/);
  });

  /*
    THE FINDING NEVER COSTS A SHIFT ITS CLOSE. If the row were left open by a
    check that fired early, the next shift would inherit a stale open run and
    his page would show a dead shift as working — the exact failure the whole
    feature exists to prevent, reintroduced by its own guard.
  */
  it("the finding is raised AFTER the row is stamped terminal", () => {
    const source = code(read(CLOSE));
    const stamped = source.indexOf("SET endedAt = UTC_TIMESTAMP()");
    const finding = source.indexOf("NEVER CHECKED IN");
    expect(stamped).toBeGreaterThan(0);
    expect(finding).toBeGreaterThan(stamped);
  });
});

/**
 * THE CLOSE LEAVES THE LAST CHECK-IN ALONE (#1872).
 *
 * It used to set `heartbeatAt = UTC_TIMESTAMP()` in the same UPDATE that
 * stamped `endedAt`, so a closed row's recorded last check-in was the instant
 * somebody closed it: **563 of 563 closed rows carried
 * `heartbeatAt == endedAt`**, and the only evidence of WHEN a row went silent
 * was destroyed on its way into the record. Nothing was ever given a wrong
 * answer by it — every reader consults the field on OPEN rows only — so the
 * whole cost was in the future, on the day somebody re-measures #1863's floor,
 * its lane parser or its window. #1866's first pass is that day arriving early:
 * it read `heartbeatAt` and returned 0 superseded rows in 565 where #1863 had
 * measured 2.
 *
 * ⚠ **THE SUBJECT IS SLICED TO THE UPDATE STATEMENT AND NOTHING ELSE.** The
 * file mentions `heartbeatAt` in two SELECTs, a dry-run line and several
 * docblocks, so a file-wide "does not contain" would be red for ever and a
 * file-wide "contains" would be satisfied by any of them. Comments are stripped
 * first for the same reason: the paragraph above would otherwise satisfy a
 * reader looking for the word.
 */
describe("the close does not overwrite the row's last check-in (#1872)", () => {
  const CLOSE = "scripts/crew-shift-close.mts";

  /** The terminal UPDATE, as the file holds it — `crewShiftHeartbeatScope`'s shape. */
  const closeUpdate = (source: string): string => {
    const at = source.indexOf("SET endedAt = UTC_TIMESTAMP()");
    expect(at, "the close's terminal UPDATE could not be found at all").toBeGreaterThan(-1);
    const end = source.indexOf("`", at);
    expect(end, "the UPDATE's template literal does not end").toBeGreaterThan(at);
    return source.slice(at, end);
  };

  it("the terminal UPDATE sets endedAt and NOT heartbeatAt", () => {
    const update = closeUpdate(code(read(CLOSE)));
    /* Verify the instrument: the slice must really be the statement, or the
       absence below is the absence of a subject rather than of a write. */
    expect(update).toContain("outcome = ?");
    expect(update).toContain("WHERE id = ? AND endedAt IS NULL");
    expect(
      update,
      "The close is writing `heartbeatAt` again. That erases the one piece of "
        + "evidence saying when a row went silent, which is what #1863's floor, "
        + "lane parser and window all rest on — and nothing reads the field on a "
        + "closed row, so there is nothing to gain by it.",
    ).not.toContain("heartbeatAt");
  });

  /*
    POSITIVE CONTROL. The arm above is an absence, and an absence passes just as
    well when the slice is empty or the reader has stopped reading. So the write
    is put BACK into the slice and the reading must flip.
  */
  it("and that reading can say no", () => {
    const doctored = code(read(CLOSE)).replace(
      "SET endedAt = UTC_TIMESTAMP(),",
      "SET endedAt = UTC_TIMESTAMP(),\n            heartbeatAt = UTC_TIMESTAMP(),",
    );
    expect(closeUpdate(doctored)).toContain("heartbeatAt");
  });

  /*
    ⚠ AND THE FIELD IS STILL SELECTED. Dropping the write is only half of it:
    the finding is snapshotted from the pre-write read, and a shift closing a
    row that never checked in is what #295 exists to catch. The clause above in
    this file asserts the SELECTs; this says out loud that the two facts are a
    PAIR, so a future edit that removes the now-redundant-looking select cannot
    read as tidying.
  */
  it("the pre-write read of the pair survives the write being dropped", () => {
    const source = code(read(CLOSE));
    expect(source.match(/SELECT id, shift, seat, [^`]*heartbeatAt, endedAt/g)).toHaveLength(2);
    expect(source).toMatch(/hasEverCheckedIn\(/);
  });
});

describe("the page reports the timestamp and never a death", () => {
  const BANNER = "client/src/features/admin/components/crew/CrewWorkingNow.tsx";

  /*
    His words on #295: *"never 'it has probably died', which is a claim"*.
    Nothing reports process liveness to the database, so the page genuinely
    cannot tell a dead shift from one inside a long build — working law 1, on
    the surface rather than in a report.
  */
  it("says when the last check-in was, and names both possibilities", () => {
    const source = code(read(BANNER));
    expect(source).toContain("No check-in since");
    expect(source).toContain("this page cannot tell which");
    /* The claim is gone from what SHIPS. The docblock still quotes it, on
       purpose — a copy change with no record of what it replaced is how the
       next shift writes it back. */
    expect(source).not.toContain("probably died");
  });

  it("and that reading can say no", () => {
    const doctored = code(read(BANNER)).replace("No check-in since", "Stalled — it has probably died");
    expect(doctored).not.toContain("No check-in since");
    expect(doctored).toContain("probably died");
  });
});
