/**
 * A DEAD ROW'S ROAD OUT OF ITSELF, DRIVEN ON THE REAL ROWS (#1863).
 *
 * The verdict under test answers the one question four consecutive Foreman
 * shifts could not: *is this open row's process dead?* It must say YES about
 * row #548 — which sat on his Working-now table for 9.5 hours reading as a live
 * shift — and it must say nothing at all about row #360, which was ALIVE while
 * a lane-mate ran beside it.
 *
 * # ⚠ THE FIXTURES ARE PRODUCTION ROWS, NOT INVENTED ONES, AND THAT IS THE
 * WHOLE VALUE OF THIS FILE
 *
 * A hand-written fixture proves the function does what its author meant. These
 * rows are the three the instrument's floor was MEASURED on — read off
 * `crew_shift_runs` on 2026-10-03 (562 rows, production), with the timestamps
 * transcribed from that read:
 *
 *   - **#548** `seat1-20261003-174138` — dead at 08:07Z, five complete
 *     lane-mates after it. The POSITIVE control.
 *   - **#549** `foreman-20261003-0754` — the power-cut death, closed on the
 *     relay's written confirmation. A second true positive, on the `foreman`
 *     lane, which the lane's own 438-row history would have disqualified.
 *   - **#360** `foreman-20260925-1649` — ALIVE while #361 ran beside it, the
 *     #1234 incident. The NEGATIVE control, and the only false positive the
 *     whole recorded history contains at a floor of 1.
 *
 * A green suite here means the reading answers the two deaths the record holds
 * and refuses the one living row that looks like them. Working law 2: the
 * negative control is the arm that makes the positive one worth anything.
 */
import { describe, expect, it } from "vitest";

import {
  CREW_SHIFT_LIVE_HEARTBEAT_MS,
  CREW_SHIFT_SUPERSEDING_RUNS_MIN,
  describeRunSupersession,
  readRunSupersession,
  shiftLaneOf,
  type LaneRunForSupersession,
} from "../shared/crewShiftState";
import { readRunSupersessions } from "../scripts/lib/crewRunSupersession.mts";
import type { ScriptConnection } from "../scripts/lib/dbConnection.mts";

/* ── THE REAL ROWS ─────────────────────────────────────────────────────────── */

/** A lane-mate as the table holds it. */
const run = (id: number, shift: string, started: string, ended: string | null): LaneRunForSupersession => ({
  id,
  shift,
  startedAt: new Date(started),
  endedAt: ended === null ? null : new Date(ended),
});

/**
 * The `seat1` lane on 2026-10-03, from #548's start to the shift that closed
 * it. Every row here is real and so is every timestamp.
 */
const SEAT1_LANE: LaneRunForSupersession[] = [
  run(544, "seat1-20261003-155318", "2026-10-03T06:04:57Z", "2026-10-03T06:27:41Z"),
  run(546, "seat1-20261003-165318", "2026-10-03T07:03:48Z", "2026-10-03T07:30:17Z"),
  run(550, "seat1-20261003-183015", "2026-10-03T08:41:35Z", "2026-10-03T09:44:13Z"),
  run(552, "seat1-20261003-195555", "2026-10-03T10:10:32Z", "2026-10-03T10:53:03Z"),
  run(554, "seat1-20261003-214401", "2026-10-03T11:57:20Z", "2026-10-03T12:31:19Z"),
  run(557, "seat1-20261004-002809", "2026-10-03T14:38:56Z", "2026-10-03T15:05:12Z"),
  run(560, "seat1-20261004-020333", "2026-10-03T16:18:18Z", "2026-10-03T16:46:50Z"),
];

/** #548 as it stood while four shifts looked at it: open, silent since 08:07Z. */
const ROW_548 = {
  id: 548,
  shift: "seat1-20261003-174138",
  startedAt: new Date("2026-10-03T07:54:06Z"),
  heartbeatAt: new Date("2026-10-03T08:07:00Z"),
};

/** The hour a shift met it — the fourth decline, ~17:40Z. */
const WHEN_IT_WAS_MET = Date.parse("2026-10-03T17:40:00Z");

/** The `foreman` lane across #549's silence. */
const FOREMAN_LANE: LaneRunForSupersession[] = [
  run(551, "foreman-20261003-1845", "2026-10-03T08:46:12Z", "2026-10-03T09:20:55Z"),
  run(553, "foreman-20261003-2015", "2026-10-03T10:13:01Z", "2026-10-03T11:32:34Z"),
  run(555, "foreman-20261003-2158", "2026-10-03T11:59:42Z", "2026-10-03T12:48:44Z"),
  run(556, "foreman-20261003-2317", "2026-10-03T13:19:38Z", "2026-10-03T14:10:31Z"),
];

/** #549, the power-cut death: it never checked in, so heartbeat equals start. */
const ROW_549 = {
  id: 549,
  shift: "foreman-20261003-0754",
  startedAt: new Date("2026-10-03T07:55:22Z"),
  heartbeatAt: new Date("2026-10-03T07:55:22Z"),
};

/**
 * #360 — the row that was ALIVE. It ran 06:50Z→07:55Z on 2026-09-25 while #361
 * opened at 07:45Z, and at 07:50Z a reading taken about it would have had
 * exactly one closed lane-mate to point at if #361 had finished first.
 */
const ROW_360 = {
  id: 360,
  shift: "foreman-20260925-1649",
  startedAt: new Date("2026-09-25T06:50:00Z"),
  heartbeatAt: new Date("2026-09-25T06:50:00Z"),
};

/* ── THE LANE KEY ──────────────────────────────────────────────────────────── */

describe("the lane a shift id belongs to", () => {
  it.each([
    ["seat1-20261003-174138", "seat1"],
    ["seat1-20261004-040542", "seat1"],
    ["foreman-20261004-0320", "foreman"],
    ["foreman-20260912-2050b", "foreman"],
    ["foreman-118", "foreman"],
    ["foreman-169b", "foreman"],
    ["fable-189", "fable"],
    ["seat2-20261003-2015", "seat2"],
    ["janitor-20260901-0400", "janitor"],
  ])("%s is in lane %s", (shift, lane) => {
    expect(shiftLaneOf(shift)).toBe(lane);
  });

  /*
    ⚠ THE IDS IT CANNOT PARSE ARE THE POINT, NOT AN OVERSIGHT. Each becomes its
    OWN lane, which leaves it no lane-mates and therefore no verdict — the same
    silence a shift got before any of this existed. Under-grouping fails safe,
    and these four are real rows.
  */
  it.each(["fable-531-stripe-domain", "219", "warden", "seat-court-1394"])(
    "%s keeps a lane of its own rather than guessing",
    (shift) => {
      expect(shiftLaneOf(shift)).not.toBe("");
      expect(readRunSupersession({
        run: { id: 1, shift, startedAt: new Date(0), heartbeatAt: new Date(0) },
        runs: SEAT1_LANE,
        now: WHEN_IT_WAS_MET,
      }).kind).toBe("unreadable");
    },
  );

  it("an id that is nothing but a stamp keeps its whole self", () => {
    expect(shiftLaneOf("-123")).toBe("-123");
  });
});

/* ── THE VERDICT ───────────────────────────────────────────────────────────── */

describe("is this open row's process dead", () => {
  /*
    THE ARM THIS FILE EXISTS FOR. Row #548, at the hour the fourth shift looked
    at it and wrote that three declines was itself the finding.
  */
  it("row #548 is SUPERSEDED, named by the five sessions that proved it", () => {
    const verdict = readRunSupersession({ run: ROW_548, runs: SEAT1_LANE, now: WHEN_IT_WAS_MET });
    expect(verdict.kind).toBe("superseded");
    if (verdict.kind !== "superseded") throw new Error("unreachable");
    expect(verdict.lane).toBe("seat1");
    expect(verdict.by.map((r) => r.id)).toEqual([550, 552, 554, 557, 560]);
    /* The two lane-mates that ran BEFORE it went quiet are not evidence. */
    expect(verdict.by.map((r) => r.id)).not.toContain(544);
    expect(verdict.by.map((r) => r.id)).not.toContain(546);
  });

  /*
    THE SECOND TRUE POSITIVE, and the one the lane's whole history would have
    lost: the `foreman` lane carries 5 overlapping pairs across 438 rows, so a
    "this lane has never run two at once" test is permanently silent on it.
  */
  it("row #549 is SUPERSEDED on the foreman lane, which is not a serial lane by history", () => {
    const verdict = readRunSupersession({
      run: ROW_549,
      runs: FOREMAN_LANE,
      now: Date.parse("2026-10-03T14:30:00Z"),
    });
    expect(verdict.kind).toBe("superseded");
    if (verdict.kind !== "superseded") throw new Error("unreachable");
    expect(verdict.lane).toBe("foreman");
    expect(verdict.by.map((r) => r.id)).toEqual([551, 553, 555, 556]);
  });

  /*
    ⚠ THE NEGATIVE CONTROL, AND IT IS A REAL ROW THAT WAS REALLY ALIVE (#1234).
    #360 was mid-shift on a founder-ordered card while #361 ran beside it. One
    completed lane-mate is not evidence, and this is the row that says so: at a
    floor of 1 it is the single false positive the entire recorded history
    contains.
  */
  it("row #360 — alive while one lane-mate ran — gets NO verdict", () => {
    const verdict = readRunSupersession({
      run: ROW_360,
      runs: [run(361, "foreman-20260925-1745", "2026-09-25T07:45:00Z", "2026-09-25T07:52:00Z")],
      now: Date.parse("2026-09-25T07:53:00Z"),
    });
    expect(verdict.kind).toBe("unreadable");
    if (verdict.kind !== "unreadable") throw new Error("unreachable");
    expect(verdict.why).toContain(`floor is ${CREW_SHIFT_SUPERSEDING_RUNS_MIN}`);
    expect(verdict.why).toContain("#360");
  });

  /*
    AND THE FLOOR IS LOAD-BEARING RATHER THAN DECORATIVE: the same row with one
    more completed lane-mate does cross it. An arm that only ever asserted the
    refusal would be green on a function that never fires at all.
  */
  it("the floor is exactly where the constant says, in both directions", () => {
    const mates = [
      run(361, "foreman-20260925-1745", "2026-09-25T07:45:00Z", "2026-09-25T07:52:00Z"),
      run(362, "foreman-20260925-1800", "2026-09-25T08:00:00Z", "2026-09-25T08:30:00Z"),
    ];
    const below = readRunSupersession({
      run: ROW_360,
      runs: mates.slice(0, CREW_SHIFT_SUPERSEDING_RUNS_MIN - 1),
      now: Date.parse("2026-09-25T09:00:00Z"),
    });
    const at = readRunSupersession({
      run: ROW_360,
      runs: mates.slice(0, CREW_SHIFT_SUPERSEDING_RUNS_MIN),
      now: Date.parse("2026-09-25T09:00:00Z"),
    });
    expect(below.kind).toBe("unreadable");
    expect(at.kind).toBe("superseded");
  });

  /*
    ⚠ THE CLAUSE THAT KEEPS A CONCURRENT LAUNCHER FROM READING AS A SERIAL ONE.
    Two complete lane-mates that overlapped EACH OTHER are proof the lane ran
    two at once inside the silence — which is the one thing that would make the
    whole inference unsound — so the verdict is withheld and says which pair.
  */
  it("two completed lane-mates that overlapped each other prove nothing", () => {
    const verdict = readRunSupersession({
      run: ROW_548,
      runs: [
        run(900, "seat1-20261003-190000", "2026-10-03T09:00:00Z", "2026-10-03T10:00:00Z"),
        run(901, "seat1-20261003-193000", "2026-10-03T09:30:00Z", "2026-10-03T10:30:00Z"),
      ],
      now: WHEN_IT_WAS_MET,
    });
    expect(verdict.kind).toBe("unreadable");
    if (verdict.kind !== "unreadable") throw new Error("unreachable");
    expect(verdict.why).toContain("#900");
    expect(verdict.why).toContain("#901");
    expect(verdict.why).toContain("two at once");
  });

  /* A lane-mate still RUNNING is not a completed session and is not counted. */
  it("an open lane-mate is not evidence", () => {
    const verdict = readRunSupersession({
      run: ROW_548,
      runs: [
        run(902, "seat1-20261003-190000", "2026-10-03T09:00:00Z", "2026-10-03T10:00:00Z"),
        run(903, "seat1-20261003-200000", "2026-10-03T11:00:00Z", null),
      ],
      now: WHEN_IT_WAS_MET,
    });
    expect(verdict.kind).toBe("unreadable");
  });

  /* A completed session from ANOTHER lane says nothing about this one: seat2
     runs beside seat1 in the same pass by design. */
  it("another lane's sessions are not this lane's", () => {
    const verdict = readRunSupersession({
      run: ROW_548,
      runs: [
        run(904, "seat2-20261003-190000", "2026-10-03T09:00:00Z", "2026-10-03T09:30:00Z"),
        run(905, "seat2-20261003-200000", "2026-10-03T10:00:00Z", "2026-10-03T10:30:00Z"),
        run(906, "foreman-20261003-2015", "2026-10-03T10:13:01Z", "2026-10-03T11:32:34Z"),
      ],
      now: WHEN_IT_WAS_MET,
    });
    expect(verdict.kind).toBe("unreadable");
  });

  /*
    ⚠ NOTHING IS EVER SAID ABOUT A LIVE ROW. A death verdict printed beside the
    refusal `crew-shift-close` is about to give would be the contradiction
    `shared/crewShiftState.ts`'s own header warns about — an operator staring at
    a refusal must see the fact that caused it.
  */
  it("a row that looks live gets no verdict however much is behind it", () => {
    const justCheckedIn = {
      ...ROW_548,
      heartbeatAt: new Date(WHEN_IT_WAS_MET - CREW_SHIFT_LIVE_HEARTBEAT_MS / 2),
    };
    const verdict = readRunSupersession({ run: justCheckedIn, runs: SEAT1_LANE, now: WHEN_IT_WAS_MET });
    expect(verdict.kind).toBe("unreadable");
    if (verdict.kind !== "unreadable") throw new Error("unreachable");
    expect(verdict.why).toContain("live window");
  });

  /* An unreadable timestamp is not evidence of death — the same direction
     `looksLive` and `hasEverCheckedIn` take for the same reason. */
  it("an unparseable heartbeat gets no verdict", () => {
    const verdict = readRunSupersession({
      run: { ...ROW_548, heartbeatAt: "not a date" },
      runs: SEAT1_LANE,
      now: WHEN_IT_WAS_MET,
    });
    expect(verdict.kind).toBe("unreadable");
  });

  /*
    ⚠ A ROW IS NEVER ITS OWN EVIDENCE — a DEFENSIVE clause, driven, and the
    distinction is worth stating. `readRunSupersessions` reads lane-mates with
    `endedAt IS NOT NULL`, so the open row under test never reaches the function
    in the live wiring; this exported reading is shared and pure, and a future
    caller handing it the whole table would otherwise let a row supersede
    itself.

    ⚠ The first version of this arm was INERT and the sabotage pass found it:
    it supplied a self-row started at 07:54:06, which the silence window already
    excluded, so removing the id check left the suite green. The row below is
    one that WOULD qualify on every other test.
  */
  it("a row is never its own evidence", () => {
    const selfAfterItsOwnSilence = run(548, ROW_548.shift, "2026-10-03T09:00:00Z", "2026-10-03T09:30:00Z");
    const verdict = readRunSupersession({
      run: ROW_548,
      runs: [selfAfterItsOwnSilence, ...SEAT1_LANE],
      now: WHEN_IT_WAS_MET,
    });
    expect(verdict.kind).toBe("superseded");
    if (verdict.kind !== "superseded") throw new Error("unreachable");
    expect(verdict.by.map((r) => r.id)).not.toContain(548);
    expect(verdict.by.map((r) => r.id)).toEqual([550, 552, 554, 557, 560]);
  });
});

/* ── THE SENTENCE A SHIFT CITES ────────────────────────────────────────────── */

describe("the one sentence both readers print", () => {
  it("names the lane, the count and every row it rests on", () => {
    const line = describeRunSupersession(
      readRunSupersession({ run: ROW_548, runs: SEAT1_LANE, now: WHEN_IT_WAS_MET }),
    );
    expect(line).toContain("SUPERSEDED");
    expect(line).toContain("its process is dead");
    expect(line).toContain("`seat1`");
    for (const id of [550, 552, 554, 557, 560]) expect(line).toContain(`#${id}`);
  });

  /*
    ⚠ AND THE WITHHELD SENTENCE NEVER READS AS A PASS. "not readable" is the
    whole of it: a row nothing can settle is not thereby alive, and it is not
    thereby closeable either.
  */
  it("a withheld reading says it is not readable and claims nothing", () => {
    const line = describeRunSupersession(
      readRunSupersession({
        run: ROW_360,
        runs: [run(361, "foreman-20260925-1745", "2026-09-25T07:45:00Z", "2026-09-25T07:52:00Z")],
        now: Date.parse("2026-09-25T07:53:00Z"),
      }),
    );
    expect(line).toContain("not readable");
    expect(line).not.toContain("SUPERSEDED");
    expect(line).not.toContain("dead");
  });
});

/* ── THE ROW READ THE TWO COMMANDS SHARE ───────────────────────────────────── */

/**
 * `readRunSupersessions` is the SQL half, and it is driven against a stub
 * connection rather than a database for the reason the whole split exists: the
 * two commands that print this reading run against PRODUCTION, so the only
 * honest place to prove the query's own shape — what it asks for, what it
 * throws away — is here.
 *
 * ⚠ **The stub RECORDS what was asked.** A read whose SQL and bound value go
 * unexamined is a reader proven to return whatever the stub was told to return.
 */
describe("the row read the reader and the start warning share", () => {
  type Asked = { sql: string; values: unknown };

  function stub(rows: unknown[]): { conn: ScriptConnection; asked: Asked[] } {
    const asked: Asked[] = [];
    const conn = {
      query: async (sql: string, values?: unknown) => {
        asked.push({ sql, values });
        return [rows, []] as [unknown[], unknown[]];
      },
    } as unknown as ScriptConnection;
    return { conn, asked };
  }

  const ROW_548_OPEN = {
    id: ROW_548.id,
    shift: ROW_548.shift,
    startedAt: ROW_548.startedAt,
    heartbeatAt: ROW_548.heartbeatAt,
  };

  /*
    THE POSITIVE PATH END TO END: the five real `seat1` rows come back from the
    query and #548 reads as SUPERSEDED, which is the sentence the four shifts
    that met it did not have.
  */
  it("row #548's five lane-mates come back and the verdict is SUPERSEDED", async () => {
    const { conn, asked } = stub(SEAT1_LANE.map((r) => ({ ...r })));
    const verdicts = await readRunSupersessions(conn, [ROW_548_OPEN], WHEN_IT_WAS_MET);
    expect(verdicts.get(548)?.kind).toBe("superseded");
    expect(describeRunSupersession(verdicts.get(548)!)).toContain("SUPERSEDED");

    /*
      WHAT THE QUERY ASKS FOR — and this is a PIN on the two clauses, said
      plainly rather than dressed as behaviour: a stub cannot execute a WHERE,
      so the `endedAt IS NOT NULL` half is held by its text while the BOUND
      VALUE is held by what the function actually passed. The clauses doing
      their job on real rows is the production drive, where both live rows read
      correctly the day this landed.
    */
    expect(asked).toHaveLength(1);
    expect(asked[0]!.sql).toMatch(/endedAt IS NOT NULL/);
    expect(asked[0]!.sql).toMatch(/startedAt > \?/);
    expect(asked[0]!.values).toEqual([new Date(ROW_548.heartbeatAt)]);
  });

  /* Another lane's completed sessions reach this function and are dropped by
     the VERDICT, which owns the lane question — see the lib's own note on the
     redundant filter the sabotage pass removed. */
  it("rows from another lane never reach the verdict", async () => {
    const { conn } = stub([
      { id: 904, shift: "seat2-20261003-190000", startedAt: new Date("2026-10-03T09:00:00Z"), endedAt: new Date("2026-10-03T09:30:00Z") },
      { id: 905, shift: "seat2-20261003-200000", startedAt: new Date("2026-10-03T10:00:00Z"), endedAt: new Date("2026-10-03T10:30:00Z") },
    ]);
    const verdicts = await readRunSupersessions(conn, [ROW_548_OPEN], WHEN_IT_WAS_MET);
    expect(verdicts.get(548)?.kind).toBe("unreadable");
  });

  /* With no open runs there is nothing to ask about, and it asks nothing. */
  it("no open runs, no query", async () => {
    const { conn, asked } = stub([]);
    expect((await readRunSupersessions(conn, [], WHEN_IT_WAS_MET)).size).toBe(0);
    expect(asked).toHaveLength(0);
  });

  /* Several open rows share ONE read, bounded by the EARLIEST silence — a later
     row's window is a subset of it, so one query answers both. */
  it("two open rows share one read, bounded by the earlier silence", async () => {
    const { conn, asked } = stub(SEAT1_LANE.map((r) => ({ ...r })));
    const later = { id: 999, shift: "seat1-20261004-040542", startedAt: new Date("2026-10-03T17:00:00Z"), heartbeatAt: new Date("2026-10-03T17:00:00Z") };
    const verdicts = await readRunSupersessions(conn, [ROW_548_OPEN, later], WHEN_IT_WAS_MET);
    expect(asked).toHaveLength(1);
    expect(asked[0]!.values).toEqual([new Date(ROW_548.heartbeatAt)]);
    expect(verdicts.get(548)?.kind).toBe("superseded");
    /* Nothing closed after 17:00Z, so the later row gets no verdict — the same
       silence the live production read gave both running rows the day this
       landed. */
    expect(verdicts.get(999)?.kind).toBe("unreadable");
  });

  /*
    ⚠ A FAILED READ THROWS. It must not come back as an empty map, which both
    printers would render as the ordinary silence while the real reason was a
    broken query — the absence-only failure this repository has a memory about.
    Both callers catch it and say "the lane read failed".
  */
  it("a failed query throws rather than reading as nothing superseded", async () => {
    const conn = {
      query: async () => {
        throw new Error("Table 'crew_shift_runs' doesn't exist");
      },
    } as unknown as ScriptConnection;
    await expect(readRunSupersessions(conn, [ROW_548_OPEN], WHEN_IT_WAS_MET)).rejects.toThrow(/crew_shift_runs/);
  });
});
