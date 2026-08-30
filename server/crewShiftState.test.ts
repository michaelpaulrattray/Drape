/**
 * THE STALLED VERDICT, DRIVEN DIRECTLY (issue #272, `shared/crewShiftState.ts`).
 *
 * #272's bar: *"A shift that dies without stamping its row shows as stalled,
 * not as working."* That case cannot be produced by running the product — it
 * requires a shift to DIE — so the only honest way to test it is to drive the
 * derivation with the clock as a parameter (working law 3: a backstop needs a
 * test the model cannot rescue; here, a test the absent shift cannot rescue).
 *
 * `now` is passed in rather than mocked for the same reason: a frozen clock is
 * a second mechanism that can itself be wrong, and this function has no other
 * input worth isolating.
 */
import { describe, expect, it } from "vitest";

import {
  CREW_SHIFT_OUTCOMES,
  CREW_SHIFT_SEATS,
  CREW_SHIFT_STALL_MS,
  CREW_SHIFT_WORK_KINDS,
  deriveShiftRunState,
} from "../shared/crewShiftState";

const NOW = Date.UTC(2026, 7, 30, 6, 0, 0);
const minutesAgo = (n: number) => new Date(NOW - n * 60_000);

describe("what a shift run is doing", () => {
  it("a fresh heartbeat is running", () => {
    expect(deriveShiftRunState({ heartbeatAt: minutesAgo(2), endedAt: null }, NOW)).toBe("running");
  });

  it("a heartbeat inside the hour is still running", () => {
    expect(deriveShiftRunState({ heartbeatAt: minutesAgo(59), endedAt: null }, NOW)).toBe("running");
  });

  /*
    THE ARM THIS FILE EXISTS FOR. An open run whose shift died: nothing wrote
    "failed", nothing wrote `endedAt`, and the page must not say it is working.
  */
  it("an open run past the hour is STALLED, not running", () => {
    expect(deriveShiftRunState({ heartbeatAt: minutesAgo(61), endedAt: null }, NOW)).toBe("stalled");
    expect(deriveShiftRunState({ heartbeatAt: minutesAgo(60 * 9), endedAt: null }, NOW)).toBe("stalled");
  });

  /*
    THE BOUNDARY IS ASSERTED AGAINST THE CONSTANT, NEVER AGAINST A LITERAL —
    a magic number here would pin the fixture rather than the rule, and moving
    the window would leave a test that passes about the wrong thing.
  */
  it("the window is exactly the declared one", () => {
    expect(deriveShiftRunState({ heartbeatAt: new Date(NOW - CREW_SHIFT_STALL_MS), endedAt: null }, NOW)).toBe("running");
    expect(deriveShiftRunState({ heartbeatAt: new Date(NOW - CREW_SHIFT_STALL_MS - 1), endedAt: null }, NOW)).toBe("stalled");
  });

  /*
    `endedAt` WINS OVER EVERYTHING. Without this, every run in the "last three
    shifts" list would read as stalled the moment it aged past an hour — which
    is all of them, always.
  */
  it("a closed run is finished however old its heartbeat is", () => {
    expect(deriveShiftRunState({ heartbeatAt: minutesAgo(60 * 24 * 30), endedAt: minutesAgo(60 * 24 * 30) }, NOW))
      .toBe("finished");
  });

  it("accepts the ISO strings tRPC puts on the wire, not just Dates", () => {
    expect(deriveShiftRunState({ heartbeatAt: minutesAgo(2).toISOString(), endedAt: null }, NOW)).toBe("running");
    expect(deriveShiftRunState({ heartbeatAt: minutesAgo(90).toISOString(), endedAt: null }, NOW)).toBe("stalled");
    expect(deriveShiftRunState({ heartbeatAt: minutesAgo(2).toISOString(), endedAt: minutesAgo(1).toISOString() }, NOW))
      .toBe("finished");
  });

  /* An unreadable timestamp is not evidence of life. The safe direction is the
     one that makes him look. */
  it("an unparseable heartbeat reads as stalled, never as running", () => {
    expect(deriveShiftRunState({ heartbeatAt: "not a date", endedAt: null }, NOW)).toBe("stalled");
  });
});

/**
 * The closed vocabularies. These are asserted because the shift scripts
 * validate against them and the page draws from them — a member added on one
 * side and not the other is how a typo'd seat draws a blank strip.
 */
describe("the vocabularies are closed and shared", () => {
  it("the seats are the ones PROGRAM.md names", () => {
    expect([...CREW_SHIFT_SEATS]).toEqual(["foreman", "janitor", "warden", "machinist", "retro"]);
  });

  it("the work kinds include `background`, which #277's switch gates", () => {
    expect(CREW_SHIFT_WORK_KINDS).toContain("background");
    expect([...CREW_SHIFT_WORK_KINDS]).toEqual(["focus", "sidelane", "patrol", "maintenance", "background"]);
  });

  it("the outcomes are exactly the three #272 names", () => {
    expect([...CREW_SHIFT_OUTCOMES]).toEqual(["shipped", "stopped", "failed"]);
  });
});
