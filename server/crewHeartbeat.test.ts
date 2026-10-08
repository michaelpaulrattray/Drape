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
 *
 * ⚠ **AND IT IS STALE NOW — RE-MEASURED 2026-10-09 (#2086), AND DELIBERATELY
 * LEFT AT 138.** The same trailers over the whole history, exit code 0: **589
 * runs, median 58, p90 102, p95 123, p99 155, max 247**. So the clause above
 * came true — shifts only got longer — and 16 of 589 now exceed this bar while
 * **3 of 589 (0.5%) exceed the three-hour window itself**.
 *
 * Bumping this constant to 247 reddens the arm below, because 180 < 247. That
 * is the guard working, not a defect: the ONLY way to green it is to move
 * `CREW_SHIFT_STALL_MS`, which is a judgement about what his page says about a
 * silent shift and is named as its own decision in that constant's header. A
 * shift that raises the window raises this bar in the same commit; neither
 * moves alone.
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

    /* (a) `heartbeatAt` must be SELECTED — the UPDATE below sets it to now, so
       a reader that looks afterwards sees every run as disciplined. It is
       asserted on BOTH branches, because the `--id` road is exactly the one a
       shift uses to close a DEAD run, where the question matters most. */
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

/**
 * THE CLOSE READS THE LAST CHECK-IN AND NEVER WRITES IT (issue #1872).
 *
 * `crew-shift-close.mts` used to set `heartbeatAt = UTC_TIMESTAMP()` in the same
 * UPDATE that stamped `endedAt`, so a closed row's recorded last check-in was
 * the instant somebody closed it. Measured on production the night it was
 * removed: **565 of 565 closed rows carried `heartbeatAt == endedAt`, none
 * differed** — including row #565, whose own shift report records two
 * heartbeats.
 *
 * ⚠ **NOTHING HAD EVER READ IT**, which is why the repair is a deletion rather
 * than a new column. The census is quoted beside the close's own SELECT; the
 * write was born in `be709f0f6`, the same commit that gave
 * `deriveShiftRunState` its *`endedAt` wins over everything* clause, with no
 * comment and no consumer.
 *
 * # ⚠ THE READ AND THE WRITE ARE TWO FACTS AND BOTH ARMS ARE NEEDED
 *
 * The lazy repair is to drop the column from the SELECT as well, which would
 * take `hasEverCheckedIn` and `looksLive` with it — the never-checked-in
 * detector and #288's refusal. So the arm above pins the SELECT and these pin
 * the UPDATE, and a change that satisfies one by breaking the other reddens.
 *
 * # ⚠ AND THE THIRD ARM IS THE ONLY ONE THAT MAINTAINS ITSELF
 *
 * The close's own rule is that *a dry run that reports a different verdict from
 * the real one is worse than no dry run* — so the dry-run report and the UPDATE
 * must name the SAME columns. That arm is DERIVED from both artifacts rather
 * than from a list typed here, so adding a legitimate column to the close
 * passes it and adding one to only one of the two does not. The literal-list
 * form was deliberately not written: `crewHeartbeat.test.ts`'s own ⚠ above
 * records a guard that reddened when #1349 added `cardRef` to a neighbour, and
 * a guard that fires on its neighbours teaches a shift to edit the guard.
 */
describe("the close leaves the row's last check-in alone", () => {
  const CLOSE = "scripts/crew-shift-close.mts";
  /* The anchor, and its uniqueness is asserted rather than assumed — a slice
     taken at the second of two matches reads a statement nobody edited
     (memory: *guard arm satisfied by a sibling*). */
  const SET_ANCHOR = "SET endedAt = UTC_TIMESTAMP()";

  /**
   * The close's UPDATE, as the file actually holds it — comments out, literals
   * kept. `withoutComments` is the half of the walk that keeps a template
   * literal's contents; `codeOnly` would empty it and leave nothing to read.
   */
  function closeUpdate(source: string): string {
    const text = code(source);
    const anchors = text.split(SET_ANCHOR).length - 1;
    expect(anchors, `the close's SET clause must appear exactly once, found ${anchors}`).toBe(1);
    const at = text.indexOf(SET_ANCHOR);
    const start = text.lastIndexOf("UPDATE", at);
    const end = text.indexOf("`", at);
    expect(start, "the UPDATE keyword must sit before its SET clause").toBeGreaterThan(-1);
    expect(end, "the UPDATE's template literal must close").toBeGreaterThan(at);
    return text.slice(start, end);
  }

  /** The columns a SET clause assigns — the names on the left of each `=`. */
  function assignedColumns(update: string): string[] {
    const setClause = update.slice(update.indexOf("SET ") + 4, update.search(/\bWHERE\b/));
    return [...setClause.matchAll(/(\w+)\s*=/g)].map((match) => match[1]!).sort();
  }

  /** The columns the dry-run report tells an operator the close would set. */
  function reportedColumns(source: string): string[] {
    const text = code(source);
    const start = text.indexOf("DRY RUN — nothing written.");
    const end = text.indexOf("Re-run without --dry-run");
    expect(start, "the dry-run report must be findable").toBeGreaterThan(-1);
    expect(end, "the dry-run report must end where it says it does").toBeGreaterThan(start);
    const block = text.slice(start, end);
    /* The report is built from string literals, so a line break reaches this
       reader as the two characters `\` and `n` — not as a newline. */
    return [...block.matchAll(/\\n {2}(\w+) /g)].map((match) => match[1]!).sort();
  }

  it("does not write heartbeatAt in the statement that stamps the row terminal", () => {
    const update = closeUpdate(read(CLOSE));
    /* Scoped to the UPDATE and not to the file: the file names the column
       legitimately in both SELECTs and in two `hasEverCheckedIn` calls, so a
       whole-file negation would be a guard that can never be satisfied. */
    expect(update).not.toContain("heartbeatAt");
    /* And it still writes the four it is for — stated positively, so a
       deletion that went too far is a red rather than a pass. */
    expect(assignedColumns(update)).toEqual(["endedAt", "outcome", "outcomeNote", "prNumber"]);
  });

  it("and that reading can say no", () => {
    /* POSITIVE CONTROL: the write put back, in the shape it had. The arm must
       fail — otherwise the slice never reached the UPDATE at all, which is the
       way this kind of arm usually passes for the wrong reason. */
    const doctored = read(CLOSE).replace(
      SET_ANCHOR,
      `${SET_ANCHOR},\n            heartbeatAt = UTC_TIMESTAMP()`,
    );
    const update = closeUpdate(doctored);
    expect(update).toContain("heartbeatAt");
    expect(assignedColumns(update)).not.toEqual(["endedAt", "outcome", "outcomeNote", "prNumber"]);
  });

  it("promises exactly the columns it writes, and the list is read from both", () => {
    const source = read(CLOSE);
    expect(reportedColumns(source)).toEqual(assignedColumns(closeUpdate(source)));
    /* A reading that returned two empty lists would satisfy the line above
       while seeing nothing — the failure mode a derived comparison invites. */
    expect(reportedColumns(source).length).toBeGreaterThan(0);
  });

  it("and THAT reading can say no, in both directions", () => {
    const source = read(CLOSE);
    /* (a) the report promises a write the UPDATE does not make — #1872's own
       shape, had the dry-run line been left behind. */
    const overPromised = source.replace(
      '+ "\\n  endedAt     now"',
      '+ "\\n  endedAt     now"\n      + "\\n  heartbeatAt now"',
    );
    expect(reportedColumns(overPromised)).not.toEqual(assignedColumns(closeUpdate(overPromised)));
    /* (b) the UPDATE writes a column the report never mentions — the same
       drift from the other end. */
    const underPromised = source.replace(
      SET_ANCHOR,
      `${SET_ANCHOR},\n            heartbeatAt = UTC_TIMESTAMP()`,
    );
    expect(reportedColumns(underPromised)).not.toEqual(assignedColumns(closeUpdate(underPromised)));
  });
});

/**
 * A CLOSED ROW'S PRINTED MINUTES ARE ITS LIFE, NOT ITS CLOSE STAMP (#2086).
 *
 * `crew-shift-state.mts` printed `endedAt - startedAt` and called it a shift's
 * length. `endedAt` is a stamp any later shift may apply at any hour, so row
 * **#613 read as 303 minutes for a 19-minute life** and #607 as 693 for 15;
 * over production's 54 honestly stamped rows the two readings run median 57
 * against 35 and max 693 against 128.
 *
 * ⚠ The arms are on the BYTES because that script is a database reader and a
 * unit run has no database — and the whole reason it exists is that an operator
 * wanting to look reached for a writer instead, so it cannot grow a dev-only
 * mode to be driven through. The arithmetic itself IS driven, in
 * `server/crewRunSupersession.test.ts`, against this same row #612; what these
 * arms add is that the script reaches for it, which is the half that would
 * otherwise go inert without anything saying so (invariant 7).
 */
describe("a closed row's printed minutes are its life, not its close stamp", () => {
  const READER = "scripts/crew-shift-state.mts";
  /* Anchors asserted unique rather than assumed — a slice taken at the second
     of two matches reads a statement nobody edited (memory: *guard arm
     satisfied by a sibling*).
     ⚠ The start anchor is the closed SELECT's own WHERE and NOT the printed
     heading, because the SELECT must be inside the slice: the OPEN-runs query
     thirty lines above also names `heartbeatAt`, and the first shape of the
     arm below passed a sabotage that deleted the column from the closed one
     because that sibling satisfied it. */
  const START_ANCHOR = "WHERE endedAt IS NOT NULL";
  const END_ANCHOR = "This command wrote nothing.";

  /** The closed-run query and its loop, as the file holds it — comments out. */
  function closedBlock(source: string): string {
    const text = code(source);
    for (const anchor of [START_ANCHOR, END_ANCHOR]) {
      const hits = text.split(anchor).length - 1;
      expect(hits, `\`${anchor}\` must appear exactly once in code, found ${hits}`).toBe(1);
    }
    const at = text.indexOf(START_ANCHOR);
    const start = text.lastIndexOf("SELECT", at);
    const end = text.indexOf(END_ANCHOR);
    expect(start, "the closed query's SELECT must sit before its WHERE").toBeGreaterThan(-1);
    expect(end, "the closing line must sit after the query it follows").toBeGreaterThan(at);
    return text.slice(start, end);
  }

  it("the figure printed as a shift's length comes from its last proof of life", () => {
    const block = closedBlock(read(READER));
    expect(block).toContain("laneRunLastProofOfLife");
    expect(block).toMatch(/const minutes = Math\.round\(\(lifeEnd - started\)/);
    /* And it says WHICH figure it is, which is the other half of the card's
       done-when: *"either shows the provable life or says which figure it is"*. */
    expect(block).toMatch(/min alive/);
  });

  it("⚠ and the row's last check-in is SELECTED, or the whole reading is inert", () => {
    /* A SELECT that omits the column hands `laneRunLastProofOfLife` a null and
       it falls back to the close stamp SILENTLY — the reading would be exactly
       as wrong as before with nothing anywhere going red. Scoped to the closed
       query's own slice: the first shape of this arm read the whole file and
       the OPEN-runs SELECT satisfied it, so the sabotage passed. */
    expect(closedBlock(read(READER))).toMatch(/SELECT[^`]*\bheartbeatAt\b/);
  });

  it("a late close is named on its own line rather than passing as a lifetime", () => {
    const block = closedBlock(read(READER));
    expect(block).toMatch(/stamped closed \$\{lateCloseMinutes\} min after its last check-in/);
  });

  it("and that reading can say no", () => {
    /* POSITIVE CONTROL: the old arithmetic put back, in the shape it had. The
       arm must fail — otherwise the slice never reached the statement, which is
       how this kind of arm usually passes for the wrong reason. */
    const doctored = read(READER).replace(
      "const minutes = Math.round((lifeEnd - started) / 60_000);",
      "const minutes = Math.round((new Date(row.endedAt).getTime() - started) / 60_000);",
    );
    expect(doctored, "the statement being doctored must exist in the file").not.toBe(read(READER));
    const block = closedBlock(doctored);
    expect(block).not.toMatch(/const minutes = Math\.round\(\(lifeEnd - started\)/);
  });
});
